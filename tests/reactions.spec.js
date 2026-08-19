const {test, expect} = require('@playwright/test');

/* issue #20: いいね（NIP-25 kind 7）と、その取り消し（NIP-09 kind 5）。

   このファイルが押さえるのは五つだけで、どれも「画面に出ている数は観測した
   イベントの数である」という一点から出ている:

     1. 押すと、その行の座標あての kind 7 がリレーへ出る
     2. 取り消すと、その kind 7 を名指す kind 5 がリレーへ出る
     3. 表示される数は観測した kind 7 の数 — kind 5 で取り消された分は入らない
     4. 見ていない（unknown）と、見て 0 件だった（0）は別の事実として出る
     5. 未サインインでは押せず、押せない理由が読者に読める形で出ている

   モックリレーの流儀は tests/write-path.spec.js と tests/relay-render.spec.js の
   ものをそのまま使う。すなわち WebSocket 境界に置き、REQ に付いてきたフィルタを
   実際に適用し、EVENT には OK を返して（serveBack のときだけ）読み戻せる池に足す。
   数を数える側のフィルタ（kinds:[7] + #a、kinds:[5] + #e）が本当に効いているかを
   短絡させずに通すためで、ここを固定値で返すと数の検証は何も検証しなくなる。

   fixture の署名は本物。rx-nostr の verifier が読み取り経路の入口で落とすので、
   偽の sig を持つ kind 7 はそもそも数に届かず、テストが素通りする。 */

const EXPLORER = 'nip-explorer.html';
const RELAY_URL = 'wss://mock.relay.test/';
const KEYS = {
  publisher: '11'.repeat(32),
  fanA: '22'.repeat(32),
  fanB: '33'.repeat(32),
  fanC: '44'.repeat(32),
  viewer: '55'.repeat(32)
};

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

function installMocks(seckey) {
  window.__MOCK_RELAY__ = {events: [], urls: [], sent: [], reqs: [], published: [], ok: true, serveBack: true};

  function matchesFilter(filter, event) {
    if (Array.isArray(filter.kinds) && filter.kinds.indexOf(event.kind) === -1) return false;
    if (Array.isArray(filter.ids) && filter.ids.indexOf(event.id) === -1) return false;
    if (Array.isArray(filter.authors) && filter.authors.indexOf(event.pubkey) === -1) return false;
    if (typeof filter.since === 'number' && event.created_at < filter.since) return false;
    if (typeof filter.until === 'number' && event.created_at > filter.until) return false;
    for (const key of Object.keys(filter)) {
      if (key.charAt(0) !== '#') continue;
      const name = key.slice(1);
      const wanted = filter[key];
      // NIP-01: only the first value in any given tag is indexed.
      const indexed = (event.tags || []).filter(tag => tag[0] === name).map(tag => tag[1]);
      if (!indexed.some(value => wanted.indexOf(value) !== -1)) return false;
    }
    return true;
  }

  class MockRelaySocket extends EventTarget {
    constructor(url) {
      super();
      this.url = String(url);
      this.readyState = 0;
      window.__MOCK_RELAY__.urls.push(this.url);
      setTimeout(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); }, 0);
    }
    send(raw) {
      let message;
      try { message = JSON.parse(raw); } catch (error) { return; }
      window.__MOCK_RELAY__.sent.push(message);
      if (message[0] === 'EVENT') {
        const event = message[1];
        window.__MOCK_RELAY__.published.push(event);
        const accepted = window.__MOCK_RELAY__.ok === true;
        if (accepted && window.__MOCK_RELAY__.serveBack) window.__MOCK_RELAY__.events.push(event);
        setTimeout(() => {
          this.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify(['OK', event.id, accepted, accepted ? '' : 'blocked: mock relay refuses everything'])
          }));
        }, 0);
        return;
      }
      if (message[0] !== 'REQ') return;
      const subId = message[1];
      const filters = message.slice(2);
      window.__MOCK_RELAY__.reqs.push({subId, filters});
      const pool = window.__MOCK_RELAY__.events || [];
      const matched = pool.filter(event => filters.some(filter => matchesFilter(filter, event)));
      setTimeout(() => {
        for (const event of matched) {
          this.dispatchEvent(new MessageEvent('message', {data: JSON.stringify(['EVENT', subId, event])}));
        }
        this.dispatchEvent(new MessageEvent('message', {data: JSON.stringify(['EOSE', subId])}));
      }, 0);
    }
    close(code) {
      this.readyState = 3;
      this.dispatchEvent(new CloseEvent('close', {code: typeof code === 'number' ? code : 1000}));
    }
  }
  MockRelaySocket.OPEN = 1;
  window.WebSocket = MockRelaySocket;

  /* The NIP-07 stub: a real schnorr signer behind the extension surface, because
     the kind 7 and the kind 5 this test is about have to survive rx-nostr's
     verifier on the way back in. */
  let signerPromise = null;
  function signer() {
    if (!signerPromise) signerPromise = import(new URL('dist/rx-nostr-crypto.js', location.href).href).then(module => module.seckeySigner(seckey));
    return signerPromise;
  }
  window.__NOSTR_CALLS__ = [];
  window.nostr = {
    async getPublicKey() {
      window.__NOSTR_CALLS__.push('getPublicKey');
      return (await signer()).getPublicKey();
    },
    async signEvent(draft) {
      window.__NOSTR_CALLS__.push('signEvent');
      return (await signer()).signEvent(draft);
    }
  };
}

/* 二つの 30078 レコードと、片方に付いた三つの kind 7。
   - fanA の「+」は生きている
   - fanB の「+」は fanB 自身の kind 5 で取り消されている
   - fanC の「-」は dislike であって like ではない
   よって観測される like は 1 件。もう一方のレコードには何も付いていないので 0 件で、
   これが「見て 0 件だった」側の実例になる。 */
async function buildFixtures(page) {
  return page.evaluate(async keys => {
    const crypto = await import('./dist/rx-nostr-crypto.js');
    const signers = {};
    const pubkeys = {};
    for (const name of Object.keys(keys)) {
      signers[name] = crypto.seckeySigner(keys[name]);
      pubkeys[name] = await signers[name].getPublicKey();
    }
    const now = Math.floor(Date.now() / 1000);
    const events = [];

    // `nosmaps:` 前置きは定数から読まずに書き下す。前置きが変わったらここが落ちてほしい。
    const D = slug => `nosmaps:${slug}`;
    const coord = (pub, slug) => `30078:${pub}:${D(slug)}`;

    async function software(slug, name, age) {
      const content = {
        schema: 'org.nosmaps.software', version: 1, state: 'active',
        name, summary: `${name} summary`, homepage: `https://example.com/${slug}`
      };
      const event = await signers.publisher.signEvent({
        kind: 30078, content: JSON.stringify(content),
        tags: [['d', D(slug)], ['t', 'nosmaps'], ['state', 'active'], ['v', '1']],
        created_at: now - age
      });
      events.push(event);
      return event;
    }

    async function reaction(who, coordinate, content, age) {
      const event = await signers[who].signEvent({
        kind: 7, content,
        tags: [['a', coordinate], ['p', pubkeys.publisher], ['k', '30078']],
        created_at: now - age
      });
      events.push(event);
      return event;
    }

    const liked = await software('com.example.liked', 'Liked Tool', 300);
    const quiet = await software('com.example.quiet', 'Quiet Tool', 200);
    const likedCoord = coord(pubkeys.publisher, 'com.example.liked');
    const quietCoord = coord(pubkeys.publisher, 'com.example.quiet');

    const live = await reaction('fanA', likedCoord, '+', 90);
    const takenBack = await reaction('fanB', likedCoord, '+', 80);
    const dislike = await reaction('fanC', likedCoord, '-', 70);
    const retraction = await signers.fanB.signEvent({
      kind: 5, content: '',
      tags: [['e', takenBack.id], ['k', '7']],
      created_at: now - 60
    });
    events.push(retraction);

    return {
      events, pubkeys,
      coordinates: {liked: likedCoord, quiet: quietCoord},
      ids: {
        liked: liked.id, quiet: quiet.id,
        live: live.id, takenBack: takenBack.id, dislike: dislike.id, retraction: retraction.id
      }
    };
  }, KEYS);
}

async function openExplorer(page, options) {
  options = options || {};
  if (options.signer !== false) await page.addInitScript(installMocks, KEYS.viewer);
  await page.route(`${RELAY_URL.replace('wss://', 'https://')}**`, route => route.fulfill({
    status: 200,
    contentType: 'application/nostr+json',
    body: JSON.stringify({name: 'mock relay', supported_nips: [1], limitation: {}})
  }));
  await page.goto(`${EXPLORER}?relays=${encodeURIComponent(RELAY_URL)}&publishtimeout=5000`);
  // 派生キャッシュは同一コンテキスト内のナビゲーションを越えて残るので、前のテストの
  // winner が「このテストが出した行」に見えないよう毎回消す。
  await page.evaluate(() => window.NOSMAPS_CATALOG.cache.wipe());
}

/** リレーから1ラウンド読み、カードが出るまで待つ。 */
async function loadRelayCatalog(page, fixtures) {
  await page.evaluate(async ({events, viewerPubkey}) => {
    window.__MOCK_RELAY__.events = events.slice();
    await window.__NOSMAPS_RELAY_LOAD__({viewerPubkey});
  }, {events: fixtures.events, viewerPubkey: fixtures.pubkeys.viewer});
}

function cardFor(page, name) {
  return page.locator('#tool-results article.feature-tool-card:visible').filter({hasText: name});
}

/** 詳細ダイアログを開く。数を見に行くのはこのタイミングだけなので、いいねの検証は
    すべてここを通る。 */
async function openDetail(page, name) {
  await expect(cardFor(page, name)).toHaveCount(1);
  await cardFor(page, name).locator('[data-feature-detail]').click();
  const dialog = page.locator('#evidence-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

async function closeDetail(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#evidence-dialog')).toBeHidden();
}

async function signIn(page) {
  await page.locator('[data-viewer-signin]').click();
  await expect(page.locator('#viewer-identity')).toHaveAttribute('data-viewer-status', 'signedIn');
}

/** リレーが受け取った EVENT のうち、指定した kind のもの。 */
function publishedOfKind(page, kind) {
  return page.evaluate(k => window.__MOCK_RELAY__.published
    .filter(event => event.kind === k)
    .map(event => ({id: event.id, kind: event.kind, pubkey: event.pubkey, content: event.content, tags: event.tags})), kind);
}

test('the displayed like count is the number of observed live kind 7 — a retracted one and a dislike are not counted', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);
  const fixtures = await buildFixtures(page);
  await loadRelayCatalog(page, fixtures);

  const dialog = await openDetail(page, 'Liked Tool');
  const like = dialog.locator('[data-like-tool]');
  await expect(like).toHaveCount(1);
  // fanA の1件だけ。fanB のは本人の kind 5 で取り消され、fanC のは dislike。
  await expect(like).toHaveText('♥ 1');

  // 数を出したのは本当に kind 7 と kind 5 を読んだラウンドである、という裏取り。
  // フィルタを見ずに数だけ合っていても、それは偶然でしかない。
  const reqs = await page.evaluate(() => window.__MOCK_RELAY__.reqs.map(entry => entry.filters));
  const reactionReq = reqs.find(filters => filters.some(filter => Array.isArray(filter.kinds) && filter.kinds.includes(7)));
  expect(reactionReq, `no REQ asked for kind 7; REQs were ${JSON.stringify(reqs)}`).toBeTruthy();
  expect(reactionReq[0]['#a']).toContain(fixtures.coordinates.liked);
  const deletionReq = reqs.find(filters => filters.some(filter => Array.isArray(filter.kinds) && filter.kinds.includes(5) && Array.isArray(filter['#e'])));
  expect(deletionReq, `no REQ asked for the kind 5 retractions; REQs were ${JSON.stringify(reqs)}`).toBeTruthy();
  expect(deletionReq[0]['#e']).toContain(fixtures.ids.takenBack);

  await closeDetail(page);
  expect(errors, 'console/page errors').toEqual([]);
});

test('a coordinate that was looked at and had none reads 0, while one that was never looked at reads Unknown', async ({page}) => {
  const errors = collectErrors(page);

  /* 見ていない側。リレーを一度も読んでいないページでは kind 7 を数える REQ が出ない
     ので、数は不明のまま。ここが 0 と出たら「見ていない」を「0 件だった」と偽っている。 */
  await openExplorer(page);
  const unknownDialog = await openDetail(page, 'Damus');
  const unknownLike = unknownDialog.locator('[data-like-tool]');
  await expect(unknownLike).toContainText('—');
  await expect(unknownLike.locator('.no-support-record')).toHaveAttribute('aria-label', 'Unknown');
  await expect(unknownLike).not.toHaveText('♥ 0');
  expect(await page.evaluate(() => window.__MOCK_RELAY__.reqs.length)).toBe(0);
  await closeDetail(page);

  // 見た側。リレーを読み、この座標あての kind 7 は一件も観測されなかった。
  const fixtures = await buildFixtures(page);
  await loadRelayCatalog(page, fixtures);
  const zeroDialog = await openDetail(page, 'Quiet Tool');
  const zeroLike = zeroDialog.locator('[data-like-tool]');
  await expect(zeroLike).toHaveText('♥ 0');
  await expect(zeroLike.locator('.no-support-record')).toHaveCount(0);

  await closeDetail(page);
  expect(errors, 'console/page errors').toEqual([]);
});

test('pressing like publishes one kind 7 addressed to that entry, and the count moves only because it was read back', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);
  const fixtures = await buildFixtures(page);
  await signIn(page);
  await loadRelayCatalog(page, fixtures);

  const dialog = await openDetail(page, 'Liked Tool');
  const like = dialog.locator('[data-like-tool]');
  await expect(like).toHaveText('♥ 1');
  await expect(like).toBeEnabled();
  await expect(like).toHaveAttribute('aria-pressed', 'false');

  await like.click();
  await expect(like).toHaveText('♥ 2', {timeout: 15_000});
  await expect(like).toHaveAttribute('aria-pressed', 'true');

  const reactions = await publishedOfKind(page, 7);
  expect(reactions).toHaveLength(1);
  // NIP-25 for an addressable target: `a` は座標、`p` は反応された側の著者、`k` は種別。
  expect(reactions[0].tags).toEqual([
    ['a', fixtures.coordinates.liked],
    ['p', fixtures.pubkeys.publisher],
    ['k', '30078']
  ]);
  expect(reactions[0].content).toBe('+');
  expect(reactions[0].pubkey).toBe(fixtures.pubkeys.viewer);
  // 取り消しは押していない。
  expect(await publishedOfKind(page, 5)).toEqual([]);

  await closeDetail(page);
  expect(errors, 'console/page errors').toEqual([]);
});

test('pressing again publishes a kind 5 naming the viewer own kind 7, and the count comes back down', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);
  const fixtures = await buildFixtures(page);
  await signIn(page);
  await loadRelayCatalog(page, fixtures);

  const dialog = await openDetail(page, 'Liked Tool');
  const like = dialog.locator('[data-like-tool]');
  await like.click();
  await expect(like).toHaveText('♥ 2', {timeout: 15_000});
  const [mine] = await publishedOfKind(page, 7);
  expect(mine.id).toMatch(/^[0-9a-f]{64}$/);

  await like.click();
  await expect(like).toHaveText('♥ 1', {timeout: 15_000});
  await expect(like).toHaveAttribute('aria-pressed', 'false');

  const deletions = await publishedOfKind(page, 5);
  expect(deletions).toHaveLength(1);
  /* NIP-09: 消せるのは自分が出したその kind 7 だけ。`a` を足すと相手のカタログ
     レコードを消せと言ったことになるので、タグはこの二つで固定。 */
  expect(deletions[0].tags).toEqual([['e', mine.id], ['k', '7']]);
  expect(deletions[0].pubkey).toBe(fixtures.pubkeys.viewer);
  // 二度目の押下で新しい kind 7 が増えていないこと。
  expect(await publishedOfKind(page, 7)).toHaveLength(1);

  await closeDetail(page);
  expect(errors, 'console/page errors').toEqual([]);
});

test('a signed-out reader cannot like, and the button says why', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);
  const fixtures = await buildFixtures(page);
  await loadRelayCatalog(page, fixtures);

  const dialog = await openDetail(page, 'Liked Tool');
  const like = dialog.locator('[data-like-tool]');
  await expect(like).toBeDisabled();
  await expect(like).toHaveAttribute('data-like-blocked', 'blocked');
  // 拡張はある（window.nostr は入っている）のに押せない理由は「まだサインインしていない」。
  // 「押せません」ではなく、次にどうすればよいかが読める文言であること。
  await expect(like).toHaveAttribute('aria-label', 'Sign in with NIP-07 to like');
  await expect(like).toHaveAttribute('title', 'Sign in with NIP-07 to like');
  // 数の方は伏せない。押せないことと観測できていることは別の事実。
  await expect(like).toHaveText('♥ 1');

  // 押しても何も出ない。署名も求めない。
  await like.dispatchEvent('click');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__MOCK_RELAY__.published.map(event => event.kind))).toEqual([]);
  expect(await page.evaluate(() => window.__NOSTR_CALLS__)).toEqual([]);

  await closeDetail(page);
  expect(errors, 'console/page errors').toEqual([]);
});
