/* issue #8: レビューを書く画面に、意図の分からない巨大なプリセット画像の選択 UI が出ていた。
   あれはモック時代の残骸で、選べる画像は seedReviews() がその場で組み立てた作り物の SVG
   だった。カタログは実データになり、正当なプリセットレビュー画像の出所は一つも無いので、
   選択 UI ごと撤去した。

   ここで固定するのは二つ。
     1. レビューダイアログのどこにもプリセット画像の選択 UI は無い。
     2. 「自分の端末から選んだ画像」は残る -- 選べばプレビューが出て、言語を切り替えても
        そのプレビューと下書きの他の欄が一緒に生き残る。

   対象のエントリはカタログから引く。テストの中に id を書き写すと、そのテストはカタログでは
   なく写し間違いを検査することになる。 */
const {test, expect} = require('@playwright/test');
const {stubExternalImages} = require('./support/stub-external-images');

/* Icons in the catalogue point at ~25 real third-party hosts. Serve those bytes locally so a remote
   host having a bad day cannot turn this file red; the URLs themselves are untouched. See
   tests/support/stub-external-images.js. */
test.beforeEach(async ({context}) => { await stubExternalImages(context); });

const EXPLORER = 'nip-explorer.html';

/* 1x1 の本物の PNG。ファイル選択 -> FileReader -> data: URL の経路をそのまま通す。 */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** @param {import('@playwright/test').Page} page */
async function firstEntryId(page) {
  return page.evaluate(() => window.NOSMAPS_DATA.tools[0].id);
}

/* issue #6 でレビュー入口はカードから詳細ビュー (#evidence-dialog) へ移っている。 */
/** @param {import('@playwright/test').Page} page @param {string} id */
async function openReview(page, id) {
  await page.locator(`[data-tool-id="${id}"] [data-feature-detail]`).click();
  await expect(page.locator('#evidence-dialog')).toBeVisible();
  await page.locator('#evidence-dialog [data-review-tool]').click();
  await expect(page.locator('#review-dialog')).toBeVisible();
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

/* 撤去したマークアップの痕跡。どれか一つでも戻ってきたらここで落ちる。 */
const PICKER_SELECTORS = [
  '.image-picker',
  '.shot-choices',
  '.shot-choice',
  'input[name="imageChoice"]',
  'form.review-form input[type="radio"]',
  'form.review-form fieldset'
];

/* 選択盤の見出しに使っていた語。ja/en どちらの表示でも復活を検出する。 */
const PICKER_LABELS = ['Choose an image', '画像を選ぶ'];

for (const language of [{code: 'en', button: 'English'}, {code: 'ja', button: '日本語'}]) {
  test(`the review dialog offers no preset image picker in ${language.code}`, async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    await page.getByRole('button', {name: language.button}).first().click();
    await expect(page.locator('html')).toHaveAttribute('lang', language.code);

    const id = await firstEntryId(page);
    await openReview(page, id);
    const form = page.locator(`[data-review-form="${id}"]`);
    await expect(form).toBeVisible();

    for (const selector of PICKER_SELECTORS) {
      await expect(page.locator(`#review-dialog ${selector}`), `${selector} inside the review dialog`).toHaveCount(0);
    }
    const dialogText = await page.locator('#review-dialog').innerText();
    for (const label of PICKER_LABELS) expect(dialogText, `preset picker legend "${label}"`).not.toContain(label);
    expect(dialogText).not.toContain('undefined');

    /* 端末からの添付欄そのものは残っている。選択盤と一緒に消してはいけない。 */
    await expect(form.locator('input[name="deviceImage"]')).toHaveCount(1);
    await expect(form.locator('.local-image-preview')).toHaveCount(1);
    expect(errors, 'console/page errors').toEqual([]);
  });
}

test('a locally attached image previews, survives a ja/en switch with the rest of the draft, and is the review image on submit', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const id = await firstEntryId(page);
  await openReview(page, id);
  const form = page.locator(`[data-review-form="${id}"]`);

  await form.locator('textarea[name="body"]').fill('Keep this review draft');
  await form.locator('input[name="os"]').fill('Draft OS');
  await form.locator('input[name="version"]').fill('9.9');
  await form.locator('input[name="use"]').fill('Draft use');
  await form.locator('select[name="rating"]').selectOption('4');
  await form.locator('input[name="deviceImage"]').setInputFiles({name: 'draft-image.png', mimeType: 'image/png', buffer: PNG});
  await expect(form.locator('.local-image-preview img')).toBeVisible();
  await expect(form.locator('.local-image-preview')).toContainText('draft-image.png');
  const attached = await form.locator('.local-image-preview img').getAttribute('src');
  expect(attached).toMatch(/^data:image\/png/);

  /* モーダルが開いている間、ページ上部の言語ボタンはポインタで押せない (dialog が上層を覆う)。
     押されたときと同じハンドラを通すため、ここではクリックイベントを直接送る。 */
  await page.locator('#compact-identity [data-language="ja"]').dispatchEvent('click');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('#review-dialog')).toBeVisible();
  await expect(form.locator('.local-image-preview img')).toBeVisible();
  expect(await form.locator('.local-image-preview img').getAttribute('src')).toBe(attached);
  await expect(form.locator('.local-image-preview')).toContainText('draft-image.png');
  await expect(form.locator('textarea[name="body"]')).toHaveValue('Keep this review draft');
  await expect(form.locator('input[name="os"]')).toHaveValue('Draft OS');
  await expect(form.locator('input[name="version"]')).toHaveValue('9.9');
  await expect(form.locator('input[name="use"]')).toHaveValue('Draft use');
  await expect(form.locator('select[name="rating"]')).toHaveValue('4');

  await page.locator('#compact-identity [data-language="en"]').dispatchEvent('click');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(form.locator('.local-image-preview img')).toBeVisible();
  expect(await form.locator('.local-image-preview img').getAttribute('src')).toBe(attached);
  await expect(form.locator('.local-image-preview')).toContainText('draft-image.png');
  await expect(form.locator('textarea[name="body"]')).toHaveValue('Keep this review draft');

  /* 投稿された画像は、いま添付したものそのもの。作り物の SVG が代わりに入る余地は無い。 */
  await form.getByRole('button', {name: 'Add review'}).click();
  const added = page.locator('.review-item').filter({hasText: 'Keep this review draft'});
  await expect(added).toHaveCount(1);
  const addedImage = added.locator('.review-image-button img');
  await expect(addedImage).toBeVisible();
  expect(await addedImage.getAttribute('src')).toBe(attached);
  expect(errors, 'console/page errors').toEqual([]);
});

test.describe('375x812', () => {
  test.use({viewport: {width: 375, height: 812}});

  test('the review form with an attached image fits the narrow viewport', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const id = await firstEntryId(page);
    await openReview(page, id);
    const form = page.locator(`[data-review-form="${id}"]`);
    await expectNoOverflow(page);
    await form.locator('input[name="deviceImage"]').setInputFiles({name: 'draft-image.png', mimeType: 'image/png', buffer: PNG});
    await expect(form.locator('.local-image-preview img')).toBeVisible();
    await expectNoOverflow(page);
    await expect(page.locator('#review-dialog .image-picker')).toHaveCount(0);
    expect(errors, 'console/page errors').toEqual([]);
  });
});
