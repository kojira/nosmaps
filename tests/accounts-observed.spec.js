/* issue #10: 「複数アカウント」の絞り込みが、NIP からの推論ではなく、人が実際に触って
   観測した記録で決まることを検査する。

   壊れていた形： `accounts` は NIP-19 と NIP-46 の OR で定義されていた。NIP-19 は bech32 の
   エンコード仕様であって、アカウントを切り替えられるかどうかを一言も述べていない。その結果
   Damus / YakiHonne Web App / Nostrcheck server が、NIP-19 を挙げているというだけで
   「複数アカウント対応」の一覧に出ていた。誰も見ていない事柄を、カタログが述べていた。

   直した形： 答えは各行の `accountSwitching`（result / method / detail / subject / observedAt）。
   一次情報を実際に取りに行って記録したものだけがそこにある。観測していない行は null で、
   それは unknown であって「非対応」ではない（§21.3 R3 case 2 / invariant I8）。

   期待値はこのファイルに書き写さない。data.js が述べている観測記録から毎回導く。書き写せば、
   検査しているのはカタログではなく写し間違いになる。 */
const {test, expect} = require('@playwright/test');
const {stubExternalImages} = require('./support/stub-external-images');

test.beforeEach(async ({context}) => { await stubExternalImages(context); });

const UNSTATED = ['unknown', 'out_of_family'];
const sorted = values => [...values].sort();

/** @param {import('@playwright/test').Page} page */
function collectErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/* 詳細設定は <details>。閉じたままでは #support-filter を操作できない。 */
/** @param {import('@playwright/test').Page} page */
async function openSettings(page) {
  const details = page.locator('#filter-details');
  if (!(await details.evaluate(node => node.open))) await page.locator('#filter-details > summary').click();
  await expect(details).toHaveJSProperty('open', true);
}

/** @param {import('@playwright/test').Page} page */
function shownIds(page) {
  return page.locator('#tool-results .feature-tool-card').evaluateAll(nodes => nodes.map(node => node.dataset.toolId));
}

/** カタログが述べている観測記録そのもの。 */
/** @param {import('@playwright/test').Page} page */
function observations(page) {
  return page.evaluate(() => window.NOSMAPS_DATA.tools.map(tool => ({
    id: tool.id,
    /* 未観測は key が null。観測して「どちらとも述べていない」も unknown。二つは画面上
       同じ答え（何も述べていない）だが、記録としては別物なので両方を持ち歩く。 */
    observed: tool.accountSwitching !== null,
    result: tool.accountSwitching ? tool.accountSwitching.result : null,
    nipIds: (tool.capabilities || []).filter(claim => claim.family === 'nip').map(claim => claim.id)
  })));
}

/** @param {import('@playwright/test').Page} page */
async function selectAccounts(page) {
  const chip = page.locator('[data-select-feature="accounts"]');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  return chip;
}

/* (a) 観測欄がある行は絞り込みに出る。既定モード（confirmed）の一覧は、`supported` と
   記録された行ちょうどに一致する。実際に人が確かめたものだけが、そこにいる。 */
test('accounts が出す行は、切替可否を実際に観測して supported と記録した行ちょうど', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  const rows = await observations(page);
  expect(rows.length, '実カタログ').toBe(41);

  const supported = rows.filter(row => row.result === 'supported').map(row => row.id);
  /* 空集合を相手に「一致している」と言っても何も守らない。両方の枝が実在することを先に言う。 */
  expect(supported.length, 'supported と観測された行').toBeGreaterThan(0);
  expect(rows.length - supported.length, 'それ以外の行').toBeGreaterThan(0);

  await selectAccounts(page);
  await openSettings(page);
  await expect(page.locator('#support-filter')).toHaveValue('confirmed');

  expect(sorted(await shownIds(page)), 'accounts の結果一覧').toEqual(sorted(supported));
  await expect(page.locator('#result-count')).toContainText(String(supported.length));
  expect(errors).toEqual([]);
});

/* (b) 未観測の行は unknown であって「非対応」ではない。`unknown` モードで戻ってくること、
   `not_supported` モードには一件も出ないことの両方で確かめる。片方だけでは、
   「消えている」と「非対応として扱われている」を区別できない。 */
test('観測していない行は unknown として扱われ、非対応の側には一件も出ない', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  const rows = await observations(page);

  /* 画面上 unknown になるべき行 ＝ 未観測（null）＋ 観測したが result が unknown。 */
  const unknownIds = rows.filter(row => !row.observed || row.result === 'unknown').map(row => row.id);
  const unobserved = rows.filter(row => !row.observed).map(row => row.id);
  expect(unobserved.length, '未観測の行').toBeGreaterThan(0);

  await selectAccounts(page);
  await openSettings(page);

  /* 既定モードでは一覧に出ない。ただし黙って消えたのではなく、件数が述べられている。 */
  const shown = await shownIds(page);
  for (const id of unknownIds) expect(shown, `${id} は confirmed に出ない`).not.toContain(id);
  const notice = page.locator('.unstated-notice');
  await expect(notice).toHaveCount(1);
  await expect(notice).toHaveAttribute('data-unstated-count', String(unknownIds.length));

  /* unknown モードで、そのままの集合が戻る。 */
  await page.locator('#support-filter').selectOption('unknown');
  await expect(page.locator('#support-filter')).toHaveValue('unknown');
  expect(sorted(await shownIds(page)), 'unknown モード').toEqual(sorted(unknownIds));

  /* not_supported モードは空。観測していないことを否定に読み替えていない。
     カタログにも `not_supported` と記録された行は無い（＝空であることが正しい）。 */
  expect(rows.filter(row => row.result === 'not_supported'), 'not_supported と観測された行').toEqual([]);
  await page.locator('#support-filter').selectOption('not_supported');
  await expect(page.locator('#support-filter')).toHaveValue('not_supported');
  expect(await shownIds(page), 'not_supported モード').toEqual([]);

  /* out_of_family も空。accounts に「ファミリの外」という答えは無い ―― そもそも
     NIP レジストリに問うていないので、外もなにもない。 */
  await page.locator('#support-filter').selectOption('out_of_family');
  expect(await shownIds(page), 'out_of_family モード').toEqual([]);

  /* all では 41 件すべてが戻る。どの行も失われていない（invariant I9）。 */
  await page.locator('#support-filter').selectOption('all');
  expect(sorted(await shownIds(page)), 'all モード').toEqual(sorted(rows.map(row => row.id)));
  expect(errors).toEqual([]);
});

/* (c) issue #10 の起点そのもの。NIP-19 を挙げているが NIP-46 は挙げておらず、切替可否を
   supported と観測してもいない行は、accounts の絞り込みに出ない。着手前は Damus /
   YakiHonne Web App / Nostrcheck server の 3 件がこれで出ていた。

   3 件の id をここに書き写して「この 3 件が消えた」と言うのではなく、条件（NIP-19 を持ち
   NIP-46 を持たず、supported と観測されていない）を data.js に当てて集合を導く。 */
test('NIP-19 だけを根拠に accounts の一覧へ入る行は、もう一件も無い', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  const rows = await observations(page);

  const viaNip19Only = rows.filter(row =>
    row.nipIds.includes('19') && !row.nipIds.includes('46') && row.result !== 'supported');
  /* この集合が空だと、この検査は何も見ていないことになる。 */
  expect(viaNip19Only.length, 'NIP-19 を挙げるが切替は観測されていない行').toBeGreaterThan(0);

  await selectAccounts(page);
  await openSettings(page);
  const shown = await shownIds(page);
  for (const row of viaNip19Only) {
    expect(shown, `${row.id} は NIP-19 を挙げているだけ`).not.toContain(row.id);
  }

  /* 3 件は #10 が名指しした行。カタログ側の状態も一次情報どおりであることを押さえる：
     いずれも NIP-19 を挙げ、NIP-46 は挙げず、supported とは観測されていない。 */
  for (const id of ['nosmaps:io.damus', 'nosmaps:com.yakihonne.web', 'nosmaps:me.nostrcheck.server']) {
    const row = rows.find(item => item.id === id);
    expect(row, `${id} はカタログにいる`).toBeTruthy();
    expect(row.nipIds, `${id} の NIP 主張`).toContain('19');
    expect(row.nipIds, `${id} の NIP 主張`).not.toContain('46');
    expect(row.result, `${id} の切替観測`).not.toBe('supported');
    expect(shown, `${id} は accounts の一覧に出ない`).not.toContain(id);
  }
  expect(errors).toEqual([]);
});

/* (d) 直しても機能そのものは消えていない。チップは 10 個のままで accounts はそこにあり、
   選べば結果が返り、比較にも詳細にも accounts の欄が出る。「判定を厳しくする」を
   「機能を削る」で済ませていないことを、UI 側から確かめる。 */
test('accounts の絞り込み・比較・詳細は残っていて、選べば結果が返る', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');

  const features = await page.locator('[data-select-feature]').evaluateAll(nodes => nodes.map(node => node.dataset.selectFeature));
  expect(features.length, '機能チップ').toBe(10);
  expect(features, 'accounts のチップ').toContain('accounts');

  await selectAccounts(page);
  expect((await shownIds(page)).length, 'accounts の結果').toBeGreaterThan(0);

  /* NIP 参照カードは残っている：accounts がどの NIP の話をしているかという情報自体は
     消していない。消したのは「その NIP が答えである」という推論だけ。 */
  expect((await page.locator('#nip-list .nip-reference-card').count()), 'NIP 参照カード').toBeGreaterThan(0);

  /* 詳細ダイアログに accounts の対応欄が出る（バッジがある＝値として述べられている）。 */
  const first = page.locator('#tool-results .feature-tool-card').first();
  const firstId = await first.getAttribute('data-tool-id');
  await first.locator('[data-feature-detail]').first().click();
  await expect(page.locator('#evidence-dialog')).toBeVisible();
  await expect(page.locator('#evidence-content .support-line'), `${firstId} の詳細`).toBeVisible();
  expect(errors).toEqual([]);
});
