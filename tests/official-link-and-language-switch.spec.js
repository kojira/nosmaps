/* issue #4: 公式サイトの URL は表示されるだけでクリックできなかった。宣言された URL は本物の
   リンクにし、新しいタブで開く。homepage を述べていないエントリには、空でも死んでもいるリンクを
   作らない。
   issue #5: 言語切り替えがダイアログごとに複製されていた。ページ上部の一つだけを残す。ただし
   「言語を切り替えても開いているダイアログ・レビュー下書き・選択中の機能が消えない」という
   既存の保証は落とさない。 */
const {test, expect} = require('@playwright/test');

/* issue #6 で公式情報リンクとレビュー入口はカードから詳細ビュー (#evidence-dialog) へ移った。
   保証は変わらないので、入口を一段開いてから同じことを確かめる。カード側には「アンカーを
   一つも描かない」という形で残っている。 */
/** @param {import('@playwright/test').Page} page @param {string} id */
async function openDetail(page, id) {
  await page.locator(`[data-tool-id="${id}"] [data-feature-detail]`).click();
  await expect(page.locator('#evidence-dialog')).toBeVisible();
}

/** @param {import('@playwright/test').Page} page */
async function closeEvidence(page) {
  await page.locator('#evidence-dialog [data-close-dialog]').click();
  await expect(page.locator('#evidence-dialog')).toBeHidden();
}

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function expectNoOverflow(page) {
  const metrics = await page.evaluate(() => ({
    document: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    dialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => [dialog.id, dialog.scrollWidth, dialog.clientWidth, dialog.firstElementChild?.scrollWidth || 0, dialog.firstElementChild?.clientWidth || 0])
  }));
  expect(metrics.document[0]).toBeLessThanOrEqual(metrics.document[1]);
  for (const [id, scroll, client, contentScroll, contentClient] of metrics.dialogs) {
    expect(scroll, id).toBeLessThanOrEqual(client);
    expect(contentScroll, `${id} content`).toBeLessThanOrEqual(contentClient);
  }
}

/* 対象のエントリはカタログから引く。テストの中に URL を書き写すと、そのテストは
   カタログではなく写し間違いを検査することになる。 */
async function catalogSample(page) {
  return page.evaluate(() => {
    const tools = window.NOSMAPS_DATA.tools;
    const withHomepage = tools.find(tool => tool.homepage);
    const withoutHomepage = tools.find(tool => !tool.homepage);
    return {
      total: tools.length,
      withHomepageCount: tools.filter(tool => tool.homepage).length,
      withoutHomepageCount: tools.filter(tool => !tool.homepage).length,
      withoutHomepageIds: tools.filter(tool => !tool.homepage).map(tool => tool.id),
      withHomepage: withHomepage ? {id: withHomepage.id, homepage: withHomepage.homepage} : null,
      withoutHomepage: withoutHomepage ? {id: withoutHomepage.id} : null,
      /* URL ではない文章を値に持つ欄。Damus の配布欄は "Apple App Store id… (README badge link)"。 */
      nonUrlResource: tools.map(tool => ({id: tool.id, value: tool.distribution}))
        .find(entry => entry.value && !/^https?:\/\//.test(entry.value)) || null
    };
  });
}

test('a declared homepage renders a new-tab anchor and an entry without one renders no anchor', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  const sample = await catalogSample(page);
  expect(sample.withHomepageCount, 'entries that declare a homepage').toBeGreaterThan(0);
  expect(sample.withoutHomepageCount, 'entries that declare no homepage').toBeGreaterThan(0);

  // (1) homepage を持つエントリ: 公式サイトの URL 欄が本物のリンクになっている。
  await openDetail(page, sample.withHomepage.id);
  await page.locator('#evidence-dialog [data-resource-type="site"]').click();
  await expect(page.locator('#evidence-dialog')).toBeVisible();
  const urlCell = page.locator('#evidence-content .nip-evidence-grid > div').first();
  await expect(urlCell.locator('dt')).toHaveText('URL');
  const link = urlCell.locator('dd a');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('href', sample.withHomepage.homepage);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveText(sample.withHomepage.homepage);
  await closeEvidence(page);

  // (2) homepage の無いエントリ: 公式サイトの入口そのものが無く、アンカーは一つも描かれない。
  const withoutCard = page.locator(`[data-tool-id="${sample.withoutHomepage.id}"]`);
  await expect(withoutCard).toHaveCount(1);
  await expect(withoutCard.locator('a')).toHaveCount(0);
  for (const id of sample.withoutHomepageIds) {
    await openDetail(page, id);
    await expect(page.locator('#evidence-dialog [data-resource-type="site"]'), `site control for ${id}`).toHaveCount(0);
    await closeEvidence(page);
  }

  // (3) URL ではない値はリンクにしない。行き先を作れないところに行き先を書かない。
  if (sample.nonUrlResource) {
    await openDetail(page, sample.nonUrlResource.id);
    await page.locator('#evidence-dialog [data-resource-type="distribution"]').click();
    await expect(page.locator('#evidence-dialog')).toBeVisible();
    await expect(page.locator('#evidence-content .nip-evidence-grid > div').first().locator('dd a')).toHaveCount(0);
    await expect(page.locator('#evidence-content .nip-evidence-grid > div').first().locator('dd')).toHaveText(sample.nonUrlResource.value);
  }
  expect(errors).toEqual([]);
});

test('the homepage link keeps its href in Japanese and stays inside 375x812', async ({page}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({width: 375, height: 812});
  await page.goto('nip-explorer.html');
  const sample = await catalogSample(page);
  await openDetail(page, sample.withHomepage.id);
  await page.locator('#evidence-dialog [data-resource-type="site"]').click();
  const link = page.locator('#evidence-content .nip-evidence-grid > div').first().locator('dd a');
  await expect(link).toHaveAttribute('href', sample.withHomepage.homepage);
  await expect(link).toHaveAttribute('title', 'Opens in a new tab');
  await expectNoOverflow(page);
  await page.locator('#compact-identity [data-language="ja"]').dispatchEvent('click');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(link).toHaveAttribute('href', sample.withHomepage.homepage);
  await expect(link).toHaveAttribute('title', '新しいタブで開きます');
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test('exactly one language control exists on the page and none inside an opened dialog', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  await expect(page.locator('.language-switch')).toHaveCount(1);
  await expect(page.locator('[data-language]')).toHaveCount(2);
  await expect(page.locator('#compact-identity .language-switch')).toHaveCount(1);

  const sample = await catalogSample(page);
  const openers = [
    {dialogSelector: '#evidence-dialog', open: async () => { await openDetail(page, sample.withHomepage.id); }},
    {dialogSelector: '#evidence-dialog', open: async () => { await openDetail(page, sample.withHomepage.id); await page.locator('#evidence-dialog [data-resource-type="site"]').click(); }},
    {dialogSelector: '#review-dialog', open: async () => { await openDetail(page, sample.withHomepage.id); await page.locator('#evidence-dialog [data-review-tool]').click(); }}
  ];
  for (const {dialogSelector, open} of openers) {
    await open();
    const dialog = page.locator(dialogSelector);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.language-switch'), `${dialogSelector} language switch`).toHaveCount(0);
    await expect(dialog.locator('[data-language]'), `${dialogSelector} language buttons`).toHaveCount(0);
    await expect(page.locator('.language-switch'), `${dialogSelector} page total`).toHaveCount(1);
    await page.locator(`${dialogSelector} [data-close-dialog]`).click();
    if (await page.locator('#evidence-dialog').isVisible()) await closeEvidence(page);
  }

  await openDetail(page, sample.withHomepage.id);
  await page.locator('#evidence-dialog [data-review-tool]').click();
  await page.locator('#review-dialog [data-gallery-tool]').click();
  await expect(page.locator('#gallery-dialog')).toBeVisible();
  await expect(page.locator('#gallery-dialog .language-switch')).toHaveCount(0);
  await expect(page.locator('#gallery-dialog [data-language]')).toHaveCount(0);
  await expect(page.locator('.language-switch')).toHaveCount(1);
  await page.locator('#gallery-dialog [data-close-dialog]').click();
  await page.locator('#review-dialog [data-close-dialog]').click();
  await closeEvidence(page);

  await page.locator('[data-compare-tool]').nth(0).check();
  await page.locator('[data-compare-tool]').nth(1).check();
  await page.locator('#open-compare').click();
  await expect(page.locator('#compare-dialog')).toBeVisible();
  await expect(page.locator('#compare-dialog .language-switch')).toHaveCount(0);
  await expect(page.locator('.language-switch')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('the single page-level control still switches language and preserves dialog state, review draft and selected features', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  const sample = await catalogSample(page);

  // 実クリックで効くこと (ダイアログが無いときの通常の経路)。
  await page.locator('#compact-identity [data-language="ja"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await page.locator('#compact-identity [data-language="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.locator('[data-select-feature="media"]').click();
  await page.locator('[data-compare-tool]').nth(0).check();
  await page.locator('[data-compare-tool]').nth(1).check();
  await openDetail(page, sample.withHomepage.id);
  await page.locator('#evidence-dialog [data-review-tool]').click();
  const form = page.locator(`[data-review-form="${sample.withHomepage.id}"]`);
  await expect(form).toBeVisible();
  await form.locator('textarea[name="body"]').fill('Keep this review draft');
  await form.locator('input[name="os"]').fill('Draft OS');
  await form.locator('input[name="version"]').fill('9.9');
  await form.locator('input[name="use"]').fill('Draft use');
  await form.locator('select[name="rating"]').selectOption('4');
  await form.locator('input[name="imageChoice"]').nth(1).check();

  /* モーダルが開いている間、ページ上部の言語ボタンはポインタで押せない (dialog が上層を覆う)。
     押されたときと同じハンドラを通すため、ここではクリックイベントを直接送る。 */
  await page.locator('#compact-identity [data-language="ja"]').dispatchEvent('click');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');

  await expect(page.locator('#review-dialog')).toBeVisible();
  await expect(page.locator('#review-dialog')).toContainText('レビューを追加');
  await expect(form.locator('textarea[name="body"]')).toHaveValue('Keep this review draft');
  await expect(form.locator('input[name="os"]')).toHaveValue('Draft OS');
  await expect(form.locator('input[name="version"]')).toHaveValue('9.9');
  await expect(form.locator('input[name="use"]')).toHaveValue('Draft use');
  await expect(form.locator('select[name="rating"]')).toHaveValue('4');
  await expect(form.locator('input[name="imageChoice"]').nth(1)).toBeChecked();
  await expect(page.locator('[data-select-feature="media"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#compare-summary')).toContainText('2');
  // 焦点はモーダルの中に残る。body は inert なので、外に落ちるとキーボードが行き場を失う。
  await expect.poll(() => page.evaluate(() => document.querySelector('#review-dialog').contains(document.activeElement))).toBe(true);
  await expect(page.locator('#review-dialog .language-switch')).toHaveCount(0);
  await expect(page.locator('.language-switch')).toHaveCount(1);
  expect(errors).toEqual([]);
});
