/* issue #7: 機能を選ぶと、その機能について一次情報が何も述べていないエントリ（`unknown` /
   `out_of_family`）が結果一覧に黙って混ざっていた。「これらはその機能を持つ」と読める並びに、
   何も主張していない行が同居していた。

   修正は側を選ばず、フィルタに第三の状態を与えた：`all`（不明も含むと名乗る）／`confirmed`
   （既定・肯定的主張のみ）／八つの結果値ちょうど一つ（`unknown` もそこにあるので不明は到達可能）。
   機能が未選択のときモードは不活性で、行は一つも消えない（invariant I9）。除けられた行は数えられ、
   `.unstated-notice` が件数を述べ、ボタン一つで戻る。

   ここで検査するのは実カタログ（41件）そのもの。期待値はテストに書き写さず、data.js の
   capabilities と、ページが「この機能はどの NIP を指すか」として描いた #nip-list から毎回導く。
   書き写せば、それはカタログではなく写し間違いを検査することになる。 */
const {test, expect} = require('@playwright/test');

const PHONE = {width: 375, height: 812};
const UNSTATED = ['unknown', 'out_of_family'];
const CONFIRMED = ['supported', 'partial'];

/** @param {import('@playwright/test').Page} page */
function collectErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/* 詳細設定は <details>。閉じたままだと #support-filter は操作できないので、実際の入口を開ける。
   開閉状態は renderAll が innerHTML を書き替えても残る（details 自体は書き替えられない）。 */
/** @param {import('@playwright/test').Page} page */
async function openSettings(page) {
  const details = page.locator('#filter-details');
  if (!(await details.evaluate(node => node.open))) await page.locator('#filter-details > summary').click();
  await expect(details).toHaveJSProperty('open', true);
}

/** @param {import('@playwright/test').Page} page */
function featureIds(page) {
  return page.locator('[data-select-feature]').evaluateAll(nodes => nodes.map(node => node.dataset.selectFeature));
}

/* この機能がどの NIP を指すかは、機能を選んだときページが描く NIP 参照カードが述べている。
   featureDefinitions をテストに複製しない。 */
/** @param {import('@playwright/test').Page} page */
function selectedNips(page) {
  return page.locator('#nip-list .nip-reference-card').evaluateAll(nodes => nodes.map(node => node.id.replace(/^nip-/, '')));
}

/* カタログ側の真値。nip-explorer.js の判定と同じ規則を data.js から独立に組み立てる：
   要求ファミリ内で precedence を持つ主張があればその最上位、無ければ——他ファミリの主張だけを
   持つなら out_of_family、主張が何も無ければ unknown。 */
/** @param {import('@playwright/test').Page} page @param {string[]} nips */
function supportByTool(page, nips) {
  return page.evaluate(nipIds => {
    const data = window.NOSMAPS_DATA;
    const family = data.registry.family;
    const precedence = data.resultPrecedence;
    const rank = result => { const index = precedence.indexOf(result); return index === -1 ? -1 : precedence.length - index; };
    return data.tools.map(tool => {
      const claims = tool.capabilities || [];
      const stated = claims.filter(record => record.family === family && nipIds.includes(record.id) && rank(record.result) > 0);
      const value = stated.length
        ? stated.reduce((best, record) => rank(record.result) > rank(best.result) ? record : best).result
        : (claims.length > 0 && !claims.some(record => record.family === family) ? 'out_of_family' : 'unknown');
      return {id: tool.id, value};
    });
  }, nips);
}

/** @param {import('@playwright/test').Page} page */
function shownIds(page) {
  return page.locator('#tool-results .feature-tool-card').evaluateAll(nodes => nodes.map(node => node.dataset.toolId));
}

/** @param {import('@playwright/test').Page} page @param {string} mode */
async function setMode(page, mode) {
  await page.locator('#support-filter').selectOption(mode);
  await expect(page.locator('#support-filter')).toHaveValue(mode);
}

const sorted = values => [...values].sort();

/* (1) 既定モードでは、選んだ機能について述べられていないエントリは結果一覧に出ない。
   10 機能すべてで確かめる。1件でも `unknown` / `out_of_family` が混ざれば落ちる。 */
test('with a feature selected and the default mode, no unstated entry is in the result list', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  const total = await page.evaluate(() => window.NOSMAPS_DATA.tools.length);
  expect(total, 'the real catalogue').toBe(41);

  const features = await featureIds(page);
  expect(features.length, 'feature chips').toBe(10);

  for (const feature of features) {
    const chip = page.locator(`[data-select-feature="${feature}"]`);
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');

    await openSettings(page);
    // 既定は confirmed。既定が all に戻れば（＝修正が消えれば）ここで落ちる。
    await expect(page.locator('#support-filter'), `${feature} default mode`).toHaveValue('confirmed');

    const nips = await selectedNips(page);
    expect(nips.length, `${feature} NIP references`).toBeGreaterThan(0);
    const support = await supportByTool(page, nips);
    const confirmed = support.filter(entry => CONFIRMED.includes(entry.value)).map(entry => entry.id);
    const unstated = support.filter(entry => UNSTATED.includes(entry.value)).map(entry => entry.id);
    // どちらの枝も実在する。空集合を相手に「混ざっていない」と言っても何も守らない。
    expect(confirmed.length, `${feature} confirmed entries`).toBeGreaterThan(0);
    expect(unstated.length, `${feature} unstated entries`).toBeGreaterThan(0);

    const shown = await shownIds(page);
    expect(sorted(shown), `${feature} result list`).toEqual(sorted(confirmed));
    for (const id of shown) {
      const value = support.find(entry => entry.id === id).value;
      expect(UNSTATED, `${feature} / ${id} is in the list with support "${value}"`).not.toContain(value);
    }
    await expect(page.locator('#result-count')).toContainText(String(confirmed.length));

    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
  }
  expect(errors).toEqual([]);
});

/* (2) 除けられた行は黙って消えたのではない。通知が述べる件数は実際の件数と一致し、
   `all` ボタンでも `unknown` / `out_of_family` モードでも戻ってくる。

   community は件数の意味を分ける機能：既定で落ちる 31 件のうち 1 件は `not_supported`＝
   述べられた否定なので、通知は「落ちた数」ではなく「述べられていない数」を言わなければならない。 */
test('the set-aside entries are counted honestly and are one press away', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');

  for (const feature of ['posts', 'community', 'dm']) {
    const chip = page.locator(`[data-select-feature="${feature}"]`);
    await chip.click();
    await openSettings(page);

    const nips = await selectedNips(page);
    const support = await supportByTool(page, nips);
    const unstated = support.filter(entry => UNSTATED.includes(entry.value)).map(entry => entry.id);
    const unknownOnly = support.filter(entry => entry.value === 'unknown').map(entry => entry.id);
    const outOfFamily = support.filter(entry => entry.value === 'out_of_family').map(entry => entry.id);
    const shown = await shownIds(page);
    const removed = support.map(entry => entry.id).filter(id => !shown.includes(id));

    const notice = page.locator('.unstated-notice');
    await expect(notice, `${feature} notice`).toHaveCount(1);
    await expect(notice).toHaveAttribute('data-unstated-count', String(unstated.length));
    await expect(notice).toContainText(String(unstated.length));
    // 述べられた否定は「述べていない」に数え込まれない。
    if (feature === 'community') {
      expect(removed.length, 'community entries removed by the default mode').toBeGreaterThan(unstated.length);
    }

    // 通知のボタンは all へ。41件すべてが戻り、除けられた行も全部そこにいる。
    await notice.locator('[data-support-mode="all"]').click();
    await expect(page.locator('#support-filter')).toHaveValue('all');
    const all = await shownIds(page);
    expect(sorted(all), `${feature} all mode`).toEqual(sorted(support.map(entry => entry.id)));
    for (const id of unstated) expect(all, `${feature} / ${id} reachable via all`).toContain(id);
    await expect(page.locator('.unstated-notice'), `${feature} notice under all`).toHaveCount(0);

    // 不明そのものも一つのモードとして残っている（他方に丸め込まれていない）。
    await setMode(page, 'unknown');
    expect(sorted(await shownIds(page)), `${feature} unknown mode`).toEqual(sorted(unknownOnly));
    await setMode(page, 'out_of_family');
    expect(sorted(await shownIds(page)), `${feature} out_of_family mode`).toEqual(sorted(outOfFamily));
    // 二つのモードを合わせると、除けられた集合ちょうどになる。
    expect(sorted([...unknownOnly, ...outOfFamily])).toEqual(sorted(unstated));

    await setMode(page, 'confirmed');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
  }
  expect(errors).toEqual([]);
});

/* (3) 機能が未選択なら、何についての不明でもないので、モードは何も削らない（invariant I9）。 */
test('with no feature selected the list is whole regardless of mode', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  const total = await page.evaluate(() => window.NOSMAPS_DATA.tools.length);

  // 初期状態：機能未選択、モードは操作対象ですらなく、41件そのまま。
  await openSettings(page);
  await expect(page.locator('#support-filter')).toBeDisabled();
  expect((await shownIds(page)).length, 'initial list').toBe(total);
  await expect(page.locator('.unstated-notice')).toHaveCount(0);

  for (const mode of ['unknown', 'all', 'not_supported', 'out_of_family']) {
    const chip = page.locator('[data-select-feature="dm"]');
    await chip.click();
    await setMode(page, mode);
    await chip.click(); // 機能を外す：ここから先、モードは何についての条件でもない。
    await expect(chip).toHaveAttribute('aria-pressed', 'false');

    expect((await shownIds(page)).length, `list with no feature after mode ${mode}`).toBe(total);
    await expect(page.locator('#support-filter'), `mode ${mode}`).toBeDisabled();
    await expect(page.locator('.unstated-notice'), `mode ${mode}`).toHaveCount(0);
    // 条件ピルにも現れない：何も削っていない条件を「有効な条件」として述べない。
    await expect(page.locator('#condition-summary [data-remove-condition="support"]'), `mode ${mode} pill`).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

/* (4) 日本語でも英語でもモードのラベルが出る。undefined はどこにも出ない。
   コンソール/ページエラー 0、375x812 で横はみ出し無し。 */
for (const language of ['ja', 'en']) {
  test(`the mode labels render in ${language} with no undefined, no errors and no horizontal overflow`, async ({page}) => {
    const errors = collectErrors(page);
    await page.setViewportSize(PHONE);
    await page.goto('nip-explorer.html');
    await page.locator(`#compact-identity [data-language="${language}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', language);

    await page.locator('[data-select-feature="posts"]').click();
    await openSettings(page);

    // 八つの結果値 + all + confirmed。どれも空でも "undefined" でもない。
    const options = await page.locator('#support-filter option').evaluateAll(nodes => nodes.map(node => ({value: node.value, label: node.textContent})));
    expect(options.map(option => option.value)).toEqual(
      ['all', 'confirmed', 'supported', 'partial', 'disabled', 'planned', 'withdrawn', 'not_supported', 'not_applicable', 'unknown', 'out_of_family']
    );
    for (const option of options) {
      expect(option.label, `${language} / ${option.value}`).toBeTruthy();
      expect(option.label, `${language} / ${option.value}`).not.toContain('undefined');
      // 未訳キーはキーのパスそのものが出る。それも露出とみなす。
      expect(option.label, `${language} / ${option.value}`).not.toContain('explorer.');
      expect(option.label, `${language} / ${option.value}`).not.toContain('support.');
    }
    // all と confirmed は結果値名ではなく、自分が何を含む/残すかを名乗る。
    const [all, confirmed] = options;
    expect(all.label).not.toBe(confirmed.label);

    const help = page.locator('#support-filter-help');
    await expect(help).not.toHaveText(/undefined/);
    await expect(help).not.toHaveText('');

    const notice = page.locator('.unstated-notice');
    await expect(notice).toHaveCount(1);
    await expect(notice).not.toHaveText(/undefined/);
    await expect(notice).not.toHaveText(/\{count\}/);
    await expect(notice.locator('[data-support-mode="all"]')).not.toHaveText(/undefined/);

    // 条件ピル（既定モードも述べられた条件として出る）にも undefined は無い。
    const pill = page.locator('#condition-summary [data-remove-condition="support"]');
    await expect(pill).toHaveCount(1);
    await expect(pill).not.toHaveText(/undefined/);

    const visible = await page.evaluate(() => document.body.innerText);
    expect(visible).not.toContain('undefined');

    const metrics = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
      notice: [document.querySelector('.unstated-notice')?.scrollWidth || 0, document.querySelector('.unstated-notice')?.clientWidth || 0]
    }));
    expect(metrics.scroll, 'document horizontal overflow').toBeLessThanOrEqual(metrics.client);
    expect(metrics.notice[0], 'notice horizontal overflow').toBeLessThanOrEqual(metrics.notice[1]);

    expect(errors).toEqual([]);
  });
}
