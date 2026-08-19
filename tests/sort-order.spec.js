const {test, expect} = require('@playwright/test');

/* issue #1: 候補一覧の並び順。

   このファイルが押さえるのは四つで、どれも「並び替えの鍵は実在する値だけ」という
   一点から出ている:

     1. 名前の昇順／降順が本当に並び替わる（既定の順とは違う順になる）
     2. いいね数順は観測した値どおりに並ぶ
     3. 観測していない（unknown）行は、観測して 0 件だった行と同じ扱いにされない
        —— 0 の並ぶ位置に混ざらず、未観測だと読める見出しの下に出る（不変条件 I8）
     4. ja / en どちらでも並び順のラベルが出て、undefined を描かない

   issue #21 で「収集日が新しい順／古い順」を足したので、その分がさらに三つ:

     5. 収集日順の両方向が ja / en 両方でラベルを持ち、undefined を含まない
     6. created_at が互いに異なる fixture で、実際に降順／昇順に並ぶ
     7. 収集日を持たない行は、収集日 0 の行と同じ場所に置かれない（unknown ≠ 0）

   「リリースが新しい順」はここにも無いし実装にも無い。レコードは自分の公開日を
   述べていないからである。持っているのは署名イベントの created_at ＝ 収集した時刻
   だけなので、鍵もラベルもそれをそのまま「収集日」と呼ぶ。表示と値が同じ事実を
   指しているので、これは捏造ではない。

   同値だけのデータで通るテストは書かない。カタログ41件は一括署名で created_at が
   distinct 1（1787011200）なので、それだけでは「並び替えた」ことを何も検証できない。
   順序そのものを見る 6 は、created_at が実際に違うリレー fixture の側で検証する。

   モックリレーの流儀は tests/reactions.spec.js のものをそのまま使う。いいね数を
   DOM に出す唯一の経路が「詳細を開いた行の座標を kind 7 で数え直す」ことなので、
   観測済み・未観測が混ざった一覧はこの経路を通してしか作れない。 */

const EXPLORER = 'nip-explorer.html';
const RELAY_URL = 'wss://mock.relay.test/';
const KEYS = {
  publisher: '11'.repeat(32),
  fanA: '22'.repeat(32),
  fanB: '33'.repeat(32),
  viewer: '55'.repeat(32)
};

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** 仕様側で独立に書いた符号位置比較。実装の compareCodePoints を呼ばないのが要点で、
    同じ関数を両側で使うと「並んでいること」を何も検証しないテストになる。 */
function codePointCompare(a, b) {
  const ai = Array.from(a);
  const bi = Array.from(b);
  for (let i = 0; i < Math.min(ai.length, bi.length); i += 1) {
    const ca = ai[i].codePointAt(0);
    const cb = bi[i].codePointAt(0);
    if (ca !== cb) return ca < cb ? -1 : 1;
  }
  return ai.length === bi.length ? 0 : (ai.length < bi.length ? -1 : 1);
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
      const wanted = filter[key];
      const indexed = (event.tags || []).filter(tag => tag[0] === key.slice(1)).map(tag => tag[1]);
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
            data: JSON.stringify(['OK', event.id, accepted, accepted ? '' : 'blocked'])
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

  let signerPromise = null;
  function signer() {
    if (!signerPromise) signerPromise = import(new URL('dist/rx-nostr-crypto.js', location.href).href).then(module => module.seckeySigner(seckey));
    return signerPromise;
  }
  window.nostr = {
    async getPublicKey() { return (await signer()).getPublicKey(); },
    async signEvent(draft) { return (await signer()).signEvent(draft); }
  };
}

/* 三つの 30078 レコード。片方に生きた kind 7 が二つ、もう一方には一つも無く、
   三つめは「詳細を開かない」ことで数を一度も見に行かない行として使う。
   観測済み {2, 0} と 未観測 {unknown} が同じ一覧に並ぶ、という状況がここで作れる。 */
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
    async function reaction(who, coordinate, age) {
      const event = await signers[who].signEvent({
        kind: 7, content: '+',
        tags: [['a', coordinate], ['p', pubkeys.publisher], ['k', '30078']],
        created_at: now - age
      });
      events.push(event);
      return event;
    }

    await software('com.example.bravo', 'Bravo Tool', 300);
    await software('com.example.alpha', 'Alpha Tool', 200);
    await software('com.example.charlie', 'Charlie Tool', 100);
    const bravoCoord = coord(pubkeys.publisher, 'com.example.bravo');
    await reaction('fanA', bravoCoord, 90);
    await reaction('fanB', bravoCoord, 80);

    return {
      events, pubkeys,
      coordinates: {
        bravo: bravoCoord,
        alpha: coord(pubkeys.publisher, 'com.example.alpha'),
        charlie: coord(pubkeys.publisher, 'com.example.charlie')
      }
    };
  }, KEYS);
}

async function openExplorer(page, {relay = false} = {}) {
  if (relay) {
    await page.addInitScript(installMocks, KEYS.viewer);
    await page.route(`${RELAY_URL.replace('wss://', 'https://')}**`, route => route.fulfill({
      status: 200,
      contentType: 'application/nostr+json',
      body: JSON.stringify({name: 'mock relay', supported_nips: [1], limitation: {}})
    }));
    await page.goto(`${EXPLORER}?relays=${encodeURIComponent(RELAY_URL)}&publishtimeout=5000`);
    await page.evaluate(() => window.NOSMAPS_CATALOG.cache.wipe());
    return;
  }
  await page.goto(EXPLORER);
}

async function loadRelayCatalog(page, fixtures) {
  await page.evaluate(async ({events, viewerPubkey}) => {
    window.__MOCK_RELAY__.events = events.slice();
    await window.__NOSMAPS_RELAY_LOAD__({viewerPubkey});
  }, {events: fixtures.events, viewerPubkey: fixtures.pubkeys.viewer});
}

function cardFor(page, name) {
  return page.locator('#tool-results article.feature-tool-card:visible').filter({hasText: name});
}

/** いいね数を見に行かせる唯一の経路。詳細を開いた行だけが観測済みになる。 */
async function observeLikes(page, name) {
  await expect(cardFor(page, name)).toHaveCount(1);
  await cardFor(page, name).locator('[data-feature-detail]').click();
  await expect(page.locator('#evidence-dialog')).toBeVisible();
  /* ダイアログが開いたことは観測が終わった証拠にならない。件数は kind 7 の REQ が
     返ってはじめて確定し、それまでは未観測の「—」のままである。だから待つべきは
     「開いたこと」ではなく「件数が実数になったこと」。ここを待たずに並べ替えると、
     REQ が間に合った回だけ通る勝負になる。 */
  await expect(page.locator('#evidence-dialog [data-like-tool]')).toHaveText(/\d/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#evidence-dialog')).toBeHidden();
}

/** 一覧を上から順に読む。未観測の見出しがどこに入ったかも位置として拾うので、
    「ランキングの中に紛れ込ませた」場合と「別に立てた」場合が区別できる。 */
function readList(page) {
  return page.evaluate(() => Array.from(document.querySelector('#tool-results').children).map(node => {
    if (node.classList.contains('sort-unranked')) return {kind: 'unranked-notice', text: node.textContent.trim()};
    if (node.tagName === 'ARTICLE') return {kind: 'card', name: node.querySelector('h2').textContent.trim()};
    return {kind: node.tagName.toLowerCase()};
  }));
}

function cardNames(entries) { return entries.filter(e => e.kind === 'card').map(e => e.name); }

async function chooseSort(page, value) {
  await page.locator('#sort-order').selectOption(value);
}

test('1. name ascending and descending actually reorder the list, and neither is the default order', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);
  await expect(page.locator('#sort-order')).toHaveCount(1);

  const defaultNames = cardNames(await readList(page));
  expect(defaultNames.length).toBe(41);

  await chooseSort(page, 'name-asc');
  const ascending = cardNames(await readList(page));
  expect(ascending).toHaveLength(defaultNames.length);
  expect(ascending.slice().sort(codePointCompare)).toEqual(ascending);
  expect(ascending).not.toEqual(defaultNames);
  // 並び替えは行を落とさない。集合は既定と同じままである。
  expect(ascending.slice().sort(codePointCompare)).toEqual(defaultNames.slice().sort(codePointCompare));

  await chooseSort(page, 'name-desc');
  const descending = cardNames(await readList(page));
  expect(descending).toEqual(ascending.slice().reverse());
  expect(descending).not.toEqual(ascending);

  // 名前は全行が持っている鍵なので、外れる行は一つも無い。
  expect(await page.locator('.sort-unranked').count()).toBe(0);
  expect(errors, 'console/page errors').toEqual([]);
});

test('2. the likes order follows the observed counts, most first and fewest first', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page, {relay: true});
  const fixtures = await buildFixtures(page);
  await loadRelayCatalog(page, fixtures);

  // 二つの行の数だけを見に行く。Bravo は kind 7 が2件、Alpha は0件。
  await observeLikes(page, 'Bravo Tool');
  await observeLikes(page, 'Alpha Tool');

  await chooseSort(page, 'likes-desc');
  let entries = await readList(page);
  let ranked = entries.slice(0, entries.findIndex(e => e.kind === 'unranked-notice'));
  expect(cardNames(ranked)).toEqual(['Bravo Tool', 'Alpha Tool']);

  await chooseSort(page, 'likes-asc');
  entries = await readList(page);
  ranked = entries.slice(0, entries.findIndex(e => e.kind === 'unranked-notice'));
  expect(cardNames(ranked)).toEqual(['Alpha Tool', 'Bravo Tool']);

  expect(errors, 'console/page errors').toEqual([]);
});

test('3. an unobserved count is not ranked as a zero — it never lands where the real 0 lands', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page, {relay: true});
  const fixtures = await buildFixtures(page);
  await loadRelayCatalog(page, fixtures);

  // Bravo = 観測して2件、Alpha = 観測して0件、Charlie = 一度も見ていない。
  await observeLikes(page, 'Bravo Tool');
  await observeLikes(page, 'Alpha Tool');

  await chooseSort(page, 'likes-asc');
  const entries = await readList(page);
  const noticeAt = entries.findIndex(e => e.kind === 'unranked-notice');
  expect(noticeAt, 'the unobserved rows are announced, not silently sunk').toBeGreaterThan(-1);

  const ranked = cardNames(entries.slice(0, noticeAt));
  const unranked = cardNames(entries.slice(noticeAt));
  // 観測して 0 件だった Alpha は鍵を持っているので、ちゃんと並びの先頭に来る。
  expect(ranked).toEqual(['Alpha Tool', 'Bravo Tool']);
  // 未観測の Charlie は「0 件と同じ場所」に置かれない。少ない順の先頭は Alpha であり、
  // Charlie は順位そのものを持たない側にいる。
  expect(unranked).toEqual(['Charlie Tool']);
  expect(ranked).not.toContain('Charlie Tool');

  // 多い順にしても同じ。未観測は最下位という順位ではなく、順位の外にある。
  await chooseSort(page, 'likes-desc');
  const desc = await readList(page);
  const descNotice = desc.findIndex(e => e.kind === 'unranked-notice');
  expect(cardNames(desc.slice(0, descNotice))).toEqual(['Bravo Tool', 'Alpha Tool']);
  expect(cardNames(desc.slice(descNotice))).toEqual(['Charlie Tool']);

  // 見出しは読者に「未観測」と読める語で、件数を偽らない。
  expect(desc[descNotice].text).toContain('1');
  expect(desc[descNotice].text).not.toContain('undefined');

  // 行は一つも消えていない。
  expect(cardNames(desc)).toHaveLength(3);
  expect(errors, 'console/page errors').toEqual([]);
});

test('4. every sort option is labelled in ja and en, and none of them renders "undefined"', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);

  const expected = {
    ja: ['既定の順', '名前（昇順）', '名前（降順）', 'いいねが多い順', 'いいねが少ない順', '収集日が新しい順', '収集日が古い順'],
    en: ['Default order', 'Name (A→Z)', 'Name (Z→A)', 'Most liked', 'Fewest liked', 'Newest collected', 'Oldest collected']
  };

  for (const [code, button] of [['ja', '日本語'], ['en', 'English']]) {
    await page.getByRole('button', {name: button}).first().click();
    await expect(page.locator('html')).toHaveAttribute('lang', code);

    const options = await page.locator('#sort-order option').evaluateAll(nodes => nodes.map(node => ({value: node.value, label: node.textContent})));
    expect(options.map(o => o.value)).toEqual(['default', 'name-asc', 'name-desc', 'likes-desc', 'likes-asc', 'collected-desc', 'collected-asc']);
    expect(options.map(o => o.label)).toEqual(expected[code]);
    for (const item of options) {
      expect(item.label, `${code}: option ${item.value}`).not.toContain('undefined');
      // 鍵の名前がそのまま出るのは i18n の欠落合図。ラベルとして許さない。
      expect(item.label, `${code}: option ${item.value}`).not.toContain('explorer.sort');
      expect(item.label.trim().length, `${code}: option ${item.value} is empty`).toBeGreaterThan(0);
    }
    const label = await page.locator('#sort-bar label').textContent();
    expect(label).not.toContain('undefined');
    expect(label).toContain(code === 'ja' ? '並び順' : 'Sort by');

    /* 並び順から外された行の見出しは次元ごとに別の文で、どちらの言語でも存在する。
       今のデータでは収集日を持たない行が出ないので画面には現れず、鍵の打ち間違いが
       黙って出荷されうる。だから i18n を直接引いて、鍵のパスがそのまま返ってきて
       いないこと（＝欠落していないこと）まで見る。 */
    const setAside = await page.evaluate(() => {
      const i18n = window.NOSMAPS_I18N;
      const out = {};
      for (const dimension of ['likes', 'collected']) {
        out[dimension] = {
          heading: i18n.t(`explorer.sort.unranked.${dimension}.heading`),
          notice: i18n.t(`explorer.sort.unranked.${dimension}.notice`, {count: 3})
        };
      }
      out.missing = i18n.missing.map(entry => entry.path);
      return out;
    });
    for (const dimension of ['likes', 'collected']) {
      for (const [part, text] of Object.entries(setAside[dimension])) {
        expect(text, `${code}: ${dimension}.${part}`).not.toContain('undefined');
        expect(text, `${code}: ${dimension}.${part}`).not.toContain('explorer.sort');
        expect(text.trim().length, `${code}: ${dimension}.${part} is empty`).toBeGreaterThan(0);
      }
      // 件数は必ず入る。プレースホルダのまま出たら文が壊れている。
      expect(setAside[dimension].notice, `${code}: ${dimension}.notice count`).toContain('3');
      expect(setAside[dimension].notice, `${code}: ${dimension}.notice count`).not.toContain('{count}');
    }
    // いいねの文と収集日の文は別物である。使い回すと観測していない値について嘘を書く。
    expect(setAside.collected.heading).not.toBe(setAside.likes.heading);
    expect(setAside.collected.notice).not.toBe(setAside.likes.notice);
    expect(setAside.missing, `${code}: i18n missing`).toEqual([]);

    // 並び順を実際に動かしても、i18n が欠落を報告しない。収集日順も選べることを
    // 「選んだうえで欠落ゼロ」まで見る（ラベルが出るだけでは動かした証拠にならない）。
    for (const value of ['likes-desc', 'collected-desc', 'collected-asc']) {
      await chooseSort(page, value);
      await expect(page.locator('#sort-order')).toHaveValue(value);
      expect(await page.evaluate(() => window.NOSMAPS_I18N.missing.map(entry => `${entry.detail}: ${entry.path}`)), `${code}: after ${value}`).toEqual([]);
    }
    await chooseSort(page, 'default');
  }
  expect(errors, 'console/page errors').toEqual([]);
});

/* ---- issue #21: 収集日順 ---------------------------------------------------- */

/** 一覧の行数が確定するまで待つ。「読み込みが始まった」ではなく「この件数のカードが
    DOM に出た」を完了の合図にする（#1 で踏んだ flaky の再発防止）。 */
async function expectCardCount(page, count) {
  await expect(page.locator('#tool-results article.feature-tool-card:visible')).toHaveCount(count);
}

test('5. the collection-date orders keep every row, and equal dates come out in the default order', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);
  await expectCardCount(page, 41);

  // 収集した41件が実際に何秒を持っているかを、ページから読む。
  const seconds = await page.evaluate(() => window.NOSMAPS_DATA.tools.map(tool => tool.collectedAt));
  expect(seconds).toHaveLength(41);
  for (const value of seconds) expect(Number.isFinite(value), 'every collected row states its second').toBe(true);
  const distinct = [...new Set(seconds)];

  const defaultNames = cardNames(await readList(page));
  expect(defaultNames).toHaveLength(41);

  for (const key of ['collected-desc', 'collected-asc']) {
    await chooseSort(page, key);
    const names = cardNames(await readList(page));
    // 行は落ちない。集合は既定と同じ。
    expect(names.slice().sort(codePointCompare), key).toEqual(defaultNames.slice().sort(codePointCompare));
    // 収集日を持たない行は無いので、外された行の見出しも出ない。
    expect(await page.locator('.sort-unranked').count(), key).toBe(0);
    if (distinct.length === 1) {
      /* 41件は一括署名なので秒が全部同じ。同値の並びは既定の順のまま出るのが正しく、
         ここで名前順に化けたら「収集日で並べた」と偽ったことになる。 */
      expect(names, `${key}: equal seconds stay in the incoming order`).toEqual(defaultNames);
    }
  }
  expect(errors, 'console/page errors').toEqual([]);
});

test('6. with records signed at different seconds, the collection order really is that of created_at', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page, {relay: true});
  const fixtures = await buildFixtures(page);
  await loadRelayCatalog(page, fixtures);
  await expectCardCount(page, 3);

  /* 期待値は実装の並びからではなく、リレーが返した created_at から仕様側で組み立てる。
     ここが同値のままだとテストが何も守らないので、まず「本当に互いに違う」ことを見る。 */
  const rows = await page.evaluate(() => window.__NOSMAPS_RELAY_RESULT__.entries.map(entry => ({
    name: entry.fields.name, createdAt: entry.createdAt
  })));
  expect(rows).toHaveLength(3);
  expect([...new Set(rows.map(row => row.createdAt))], 'the fixture must not be three equal seconds').toHaveLength(3);

  const newestFirst = rows.slice().sort((a, b) => b.createdAt - a.createdAt).map(row => row.name);
  const oldestFirst = newestFirst.slice().reverse();

  /* 一度名前順に崩してから収集日順を選ぶ。そうしないと「並べ替えた」のか「元のまま
     だった」のかが区別できない。 */
  await chooseSort(page, 'name-asc');
  const byName = cardNames(await readList(page));

  await chooseSort(page, 'collected-desc');
  expect(cardNames(await readList(page))).toEqual(newestFirst);

  await chooseSort(page, 'collected-asc');
  expect(cardNames(await readList(page))).toEqual(oldestFirst);

  // 収集日順は名前順の言い換えではない。どちらの向きも名前の並びとは違う。
  expect(newestFirst).not.toEqual(byName);
  expect(oldestFirst).not.toEqual(byName);
  expect(newestFirst).not.toEqual(oldestFirst);
  // 三件とも秒を持っているので、外された行は無い。
  expect(await page.locator('.sort-unranked').count()).toBe(0);
  expect(errors, 'console/page errors').toEqual([]);
});

test('7. a row with no collection date is not ranked where a row collected at 0 is ranked', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);

  /* 収集日を持たない行は、今のデータでは画面に出ない —— 収集済みの41件は全部秒を持ち、
     リレー行の秒は署名イベントから来るので必ず有限。だから unknown ≠ 0 を確かめられる
     のは並び替えの規則そのものの側で、そこは NOSMAPS_CATALOG.sortRows として出ている。 */
  const measured = await page.evaluate(() => ({
    collectedRowsWithoutSecond: window.NOSMAPS_DATA.tools.filter(tool => !Number.isFinite(tool.collectedAt)).length
  }));
  expect(measured.collectedRowsWithoutSecond, 'today no collected row lacks a second').toBe(0);

  const result = await page.evaluate(() => {
    const rows = [
      {id: 'u', name: 'Unknown date', likes: null, collectedAt: null},
      {id: 'z', name: 'Collected at zero', likes: null, collectedAt: 0},
      {id: 'l', name: 'Collected later', likes: null, collectedAt: 100}
    ];
    const asc = window.NOSMAPS_CATALOG.sortRows(rows, 'collected-asc');
    const desc = window.NOSMAPS_CATALOG.sortRows(rows, 'collected-desc');
    /* 同値の安定性。名前は逆順に置いてあるので、名前で割り込んだら並びが入れ替わる。 */
    const tied = window.NOSMAPS_CATALOG.sortRows([
      {id: 'b', name: 'Zulu', likes: null, collectedAt: 7},
      {id: 'a', name: 'Alpha', likes: null, collectedAt: 7},
      {id: 'c', name: 'Mike', likes: null, collectedAt: 7}
    ], 'collected-desc');
    return {
      ascRanked: asc.ranked.map(row => row.id), ascUnranked: asc.unranked.map(row => row.id),
      descRanked: desc.ranked.map(row => row.id), descUnranked: desc.unranked.map(row => row.id),
      tiedRanked: tied.ranked.map(row => row.id), tiedUnranked: tied.unranked.map(row => row.id)
    };
  });

  // 0 は観測された秒なので順位を持ち、古い順の先頭に立つ。
  expect(result.ascRanked).toEqual(['z', 'l']);
  // 収集日を持たない行はその先頭を奪わないし、最下位という順位も与えられない。
  expect(result.ascUnranked).toEqual(['u']);
  expect(result.ascRanked).not.toContain('u');
  expect(result.descRanked).toEqual(['l', 'z']);
  expect(result.descUnranked).toEqual(['u']);
  // 0 の居場所と unknown の居場所は、どちらの向きでも同じにならない。
  expect(result.ascRanked.indexOf('u')).toBe(-1);
  expect(result.descRanked.indexOf('u')).toBe(-1);
  // 同値は入ってきた順のまま。名前でこっそり並べ替えない。
  expect(result.tiedRanked).toEqual(['b', 'a', 'c']);
  expect(result.tiedUnranked).toEqual([]);
  expect(errors, 'console/page errors').toEqual([]);
});

test.describe('375x812', () => {
  test.use({viewport: {width: 375, height: 812}});

  test('the sort control fits the phone width in both languages and in every order', async ({page}) => {
    const errors = collectErrors(page);
    await openExplorer(page);

    for (const button of ['日本語', 'English']) {
      await page.getByRole('button', {name: button}).first().click();
      for (const value of ['default', 'name-asc', 'name-desc', 'likes-desc', 'likes-asc', 'collected-desc', 'collected-asc']) {
        await chooseSort(page, value);
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const wide = [];
          for (const element of document.querySelectorAll('#sort-bar, #sort-bar *')) {
            const box = element.getBoundingClientRect();
            if (box.width > 0 && (box.right > doc.clientWidth + 0.5 || box.left < -0.5)) {
              wide.push(`${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}: ${box.left}..${box.right}`);
            }
          }
          return {wide, documentScroll: doc.scrollWidth - doc.clientWidth};
        });
        expect(overflow.wide, `${button} / ${value}`).toEqual([]);
        expect(overflow.documentScroll, `${button} / ${value}`).toBeLessThanOrEqual(0);
      }
    }
    expect(errors, 'console/page errors').toEqual([]);
  });
});
