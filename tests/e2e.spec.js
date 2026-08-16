const {test, expect} = require('@playwright/test');

const base = process.env.NOSMAPS_BASE_URL || 'http://127.0.0.1:4173';

function collectErrors(page) {
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function chooseComparisons(page, count) {
  const boxes = page.locator('[data-compare-tool]');
  expect(await boxes.count()).toBeGreaterThanOrEqual(count + 1);
  for (let index = 0; index < count; index += 1) await boxes.nth(index).check();
}

async function overflowMetrics(page) {
  return page.evaluate(() => ({
    document: {scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth},
    body: {scroll: document.body.scrollWidth, client: document.body.clientWidth},
    dialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => ({
      id: dialog.id,
      scroll: dialog.scrollWidth,
      client: dialog.clientWidth,
      contentScroll: dialog.firstElementChild?.scrollWidth || 0,
      contentClient: dialog.firstElementChild?.clientWidth || 0
    }))
  }));
}

async function expectDialogTrap(page, selector) {
  const dialog = page.locator(selector);
  const focusable = dialog.locator('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
  expect(await focusable.count()).toBeGreaterThan(0);
  await focusable.last().focus();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await focusable.first().focus();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
}

test('A/B/C and URLs remain available; common dialogs trap and restore focus', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/index.html`);
  expect(await page.evaluate(() => window.NOSMAPS_DATA.tools.length)).toBe(36);
  for (const mode of ['A', 'B', 'C']) await expect(page.getByRole('button', {name: `${mode}案を操作する`})).toBeVisible();
  await expect(page.getByRole('link', {name: 'D案を操作する'})).toHaveAttribute('href', 'nip-explorer.html');

  const submitOpener = page.getByRole('button', {name: '候補を投稿'});
  await submitOpener.click();
  await expectDialogTrap(page, '#contribute-dialog');
  await page.keyboard.press('Escape');
  await expect(submitOpener).toBeFocused();

  await page.getByRole('button', {name: 'A案を操作する'}).click();
  const detailOpener = page.locator('.tool-card [data-action="detail"]').first();
  await detailOpener.click();
  await expectDialogTrap(page, '#detail-dialog');
  await page.keyboard.press('Escape');
  await expect(detailOpener).toBeFocused();
  expect(errors).toEqual([]);
});

test('no initial feature, multi-select AND, full-text scope, Android/iOS, and zero-result help', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  expect(await page.evaluate(() => window.NOSMAPS_DATA.tools.length)).toBe(36);
  await expect(page.locator('#feature-chips')).toHaveAttribute('role', 'group');
  await expect(page.locator('.feature-chip')).toHaveCount(10);
  await expect(page.locator('.feature-chip[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('.feature-description')).toHaveCount(10);
  await expect(page.locator('#selected-feature-summary')).toContainText('機能は未選択');
  const initialExpected = await page.evaluate(() => window.NOSMAPS_DATA.tools.filter(tool => tool.status !== 'dead').length);
  await expect(page.locator('.feature-tool-card')).toHaveCount(initialExpected);

  for (const query of ['LumaPost', 'タイムライン', 'クライアント', 'Web', 'Webアプリ', 'Android', 'iOS', 'OSS', 'MIT', '暗号化DM', '画像投稿', 'NIP-44', 'Basic protocol flow description']) {
    await page.locator('#feature-query').fill(query);
    expect(await page.locator('.feature-tool-card').count(), query).toBeGreaterThan(0);
  }

  await page.locator('#feature-query').fill('');
  await page.locator('[data-select-feature="media"]').click();
  await page.locator('[data-select-feature="dm"]').click();
  await page.locator('#filter-details > summary').click();
  await page.locator('#platform-filter').selectOption('Android');
  await page.locator('#oss-filter').selectOption('yes');
  await expect(page.locator('#selected-feature-summary')).toContainText('画像・動画');
  await expect(page.locator('#selected-feature-summary')).toContainText('AND');
  await expect(page.locator('#selected-feature-summary')).toContainText('DM');
  await expect(page.locator('#condition-summary')).toContainText('すべてAND');
  await expect(page.locator('.feature-tool-card')).toHaveCount(1);
  await expect(page.locator('.feature-tool-card')).toContainText('NsecVault');
  await expect(page.locator('.feature-tool-card')).toContainText('Android / iOS');
  await expect(page.locator('.feature-tool-card')).toContainText('MIT');

  await page.locator('[data-select-feature="media"]').click();
  await expect(page.locator('[data-select-feature="media"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#selected-feature-summary')).not.toContainText('画像・動画');

  await page.getByRole('button', {name: '条件をリセット'}).click();
  await page.locator('#feature-query').fill('LumaPost');
  await page.locator('#platform-filter').selectOption('Android');
  await expect(page.locator('.feature-tool-card')).toHaveCount(0);
  await expect(page.locator('.zero-results')).toContainText('個別表示');
  await expect(page.locator('.relaxation-suggestion')).toContainText(/外すと \d+件/);
  await page.locator('.condition-pill').first().click();
  expect(await page.locator('.feature-tool-card').count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('support filter is explained until a feature enables it and reset restores that state', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  const support = page.locator('#support-filter');
  await page.locator('#filter-details > summary').click();
  await expect(support).toBeDisabled();
  await expect(support).toHaveAttribute('aria-describedby', 'support-filter-help');
  await expect(page.locator('#support-filter-help')).toContainText('機能を1つ以上選ぶ');

  const feature = page.locator('[data-select-feature="media"]');
  await feature.click();
  await expect(feature).toHaveAttribute('aria-pressed', 'true');
  await expect(support).toBeEnabled();
  await support.selectOption('implemented');
  expect(await page.locator('.feature-tool-card').count()).toBeGreaterThan(0);

  await page.getByRole('button', {name: '条件をリセット'}).click();
  await expect(feature).toHaveAttribute('aria-pressed', 'false');
  await expect(support).toHaveValue('all');
  await expect(support).toBeDisabled();
  expect(errors).toEqual([]);
});

test('dead opt-in, safe controls before click, fact/evaluation split, and evidence', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  await page.locator('[data-select-feature="wallet"]').click();
  await expect(page.locator('.feature-tool-card.dead-tool')).toHaveCount(0);
  await page.locator('#filter-details > summary').click();
  await page.getByLabel('終了／到達不能も含める').check();
  expect(await page.locator('.feature-tool-card.dead-tool').count()).toBeGreaterThan(0);
  await expect(page.getByRole('button', {name: '同じ機能の稼働候補へ戻る'}).first()).toBeVisible();

  await page.getByRole('button', {name: '条件をリセット'}).click();
  const card = page.locator('.feature-tool-card').first();
  await expect(card.getByRole('heading', {name: '事実・観測'})).toBeVisible();
  await expect(card.getByRole('heading', {name: '利用者評価'})).toBeVisible();
  await expect(card).toContainText('SAFE LINK PREVIEW · 外部遷移なし');
  for (const label of ['公式サイト', 'アプリ配布', '公式Docs', 'ソース']) {
    const button = card.getByRole('button', {name: new RegExp(`^${label}.*安全プレビュー`)});
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator('#evidence-content')).toContainText(/safe link preview/i);
    await expect(page.locator('#evidence-content')).toContainText('ページ内安全モック');
    await expect(page.locator('#evidence-content')).toContainText('.invalid');
    await expect(page.locator('#evidence-content')).toContainText('最終確認日時');
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
  }

  const detail = card.getByRole('button', {name: '詳細・根拠'});
  await detail.click();
  await expect(page.locator('#evidence-content')).toContainText('事実・観測');
  await expect(page.locator('#evidence-content')).toContainText('利用者評価');
  await page.locator('.basis-row').first().click();
  await expect(page.locator('#evidence-content')).toContainText('観測主体');
  await expect(page.locator('#evidence-content')).toContainText('公式NIP一次資料');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('three-way compare removes/adds/replaces in place and NIP evidence returns to scroll context', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  await chooseComparisons(page, 3);
  await page.locator('[data-compare-tool]').nth(3).click();
  await expect(page.locator('#compare-summary')).toContainText('3件');
  const opener = page.getByRole('button', {name: '機能で比較'});
  await opener.click();
  await expect(page.locator('.comparison-candidate')).toHaveCount(3);
  await expect(page.locator('.comparison-item').first()).toHaveAttribute('data-difference', 'true');

  const compareBody = page.locator('.comparison-body');
  const evidenceOpener = page.getByRole('button', {name: 'NIP裏付け'}).nth(4);
  await evidenceOpener.scrollIntoViewIfNeeded();
  const beforeScroll = await compareBody.evaluate(element => element.scrollTop);
  await evidenceOpener.click();
  await expect(page.locator('#evidence-dialog')).toBeVisible();
  await expect(page.locator('#compare-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#evidence-dialog')).toBeHidden();
  await expect(page.locator('#compare-dialog')).toBeVisible();
  await expect(evidenceOpener).toBeFocused();
  expect(await compareBody.evaluate(element => element.scrollTop)).toBe(beforeScroll);

  const firstName = await page.locator('.comparison-candidate strong').first().textContent();
  await page.locator('[data-compare-remove]').first().click();
  await expect(page.locator('.comparison-candidate')).toHaveCount(2);
  await page.locator('#compare-alternative').selectOption({label: firstName.trim()});
  await page.getByRole('button', {name: '比較に追加'}).click();
  await expect(page.locator('.comparison-candidate')).toHaveCount(3);

  const namesBeforeReplace = await page.locator('.comparison-candidate strong').allTextContents();
  const replacement = await page.locator('#compare-alternative option').first().textContent();
  await page.locator('#compare-alternative').selectOption({index: 0});
  await page.locator('#compare-replace-target').selectOption({index: 0});
  await page.getByRole('button', {name: '選んだ候補と入れ替え'}).click();
  await expect(page.locator('.comparison-candidate')).toHaveCount(3);
  expect(await page.locator('.comparison-candidate strong').allTextContents()).not.toEqual(namesBeforeReplace);
  expect(await page.locator('.comparison-candidate strong').allTextContents()).toContain(replacement.trim());
  await expectDialogTrap(page, '#compare-dialog');
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
});

test('loading/empty/error hide previous cards; partial and offline are explicitly current/cache data', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  const cards = page.locator('#tool-results');
  await page.locator('#state-lab > summary').click();
  const expected = {loading: '読み込み中', empty: '0件', error: '取得できません'};
  for (const name of ['loading', 'empty', 'error']) {
    await page.getByRole('button', {name, exact: true}).click();
    await expect(cards).toBeHidden();
    await expect(page.locator('#ui-state-view')).toContainText(new RegExp(expected[name], 'i'));
  }
  await page.getByRole('button', {name: 'partial', exact: true}).click();
  await expect(cards).toBeVisible();
  await expect(page.locator('#ui-state-view')).toContainText('現在の候補カード');
  await page.getByRole('button', {name: 'offline', exact: true}).click();
  await expect(page.locator('#offline-banner')).toContainText('端末キャッシュ済み');
  await expect(page.locator('#ui-state-view')).toContainText('端末キャッシュ済み');
  await expect(cards).toBeVisible();
  expect(errors).toEqual([]);
});

test('likes, bookmarks, text/image reviews, profiles, gallery and image return are local evaluation UI', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  const card = page.locator('.feature-tool-card[data-tool-id="tool-1"]');
  const like = card.locator('[data-like-tool]');
  const likeBefore = await like.textContent();
  await like.click();
  expect(await card.locator('[data-like-tool]').textContent()).not.toBe(likeBefore);
  await card.locator('[data-bookmark-tool]').click();
  await expect(card).toContainText('ブックマーク済み');
  await page.locator('#filter-details > summary').click();
  await page.getByLabel('ブックマーク済みだけ').check();
  await expect(page.locator('.feature-tool-card')).toHaveCount(1);

  await card.locator('[data-review-tool]').click();
  const form = page.locator('[data-review-form]');
  await expect(form.locator('input[name="author"], input[name="date"]')).toHaveCount(0);
  await form.locator('textarea[name="body"]').fill('本文だけのレビュー');
  await form.getByRole('button', {name: '未送信プレビューを作る'}).click();
  await expect(form.locator('.review-preview')).toContainText('対象OS: 未入力');
  await form.locator('textarea[name="body"]').fill('');
  await form.locator('input[name="mockImage"]').first().check();
  await form.getByRole('button', {name: '未送信プレビューを作る'}).click();
  await expect(form.locator('.review-preview')).toContainText('本文なし（画像のみ）');
  await form.locator('textarea[name="body"]').fill('本文＋画像');
  await form.getByRole('button', {name: '未送信プレビューを作る'}).click();
  await expect(form.locator('.review-preview')).toContainText('本文＋画像');

  await page.locator('.review-item').first().locator('[data-review-vote="helpful"]').click();
  await expect(page.locator('.vote-preview-state')).toContainText('未署名・未送信');
  await page.locator('.review-item').first().locator('[data-reviewer]').click();
  await expect(page.locator('#profile-content')).toContainText('過去レビューと役立ち内訳');
  await expect(page.locator('#profile-content')).toContainText('投稿履歴の広がり');
  await page.keyboard.press('Escape');
  await expect(page.locator('#review-dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  await card.locator('.card-review-more').click();
  await expect(page.locator('.gallery-card').first()).toContainText('投稿日時');
  const galleryScroll = await page.locator('#gallery-content').evaluate(element => element.scrollTop);
  await page.locator('.gallery-card').first().getByRole('button', {name: '拡大'}).click();
  await expect(page.locator('#image-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#gallery-dialog')).toBeVisible();
  expect(await page.locator('#gallery-content').evaluate(element => element.scrollTop)).toBe(galleryScroll);
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('review child dialogs return to and focus the requested review', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  const card = page.locator('.feature-tool-card[data-tool-id="tool-1"]');
  await card.locator('[data-review-tool]').click();

  await page.locator('.review-item').first().locator('[data-reviewer]').click();
  await expect(page.locator('#profile-dialog')).toBeVisible();
  const profileJump = page.locator('#profile-dialog [data-review-jump][data-review-tool="tool-1"]').first();
  const profileReviewId = await profileJump.getAttribute('data-review-jump');
  await profileJump.click();
  await expect(page.locator('#profile-dialog')).toBeHidden();
  await expect(page.locator('#review-dialog')).toBeVisible();
  const profileTarget = page.locator(`[data-review-id="${profileReviewId}"]`);
  await expect(profileTarget.locator('button').first()).toBeFocused();
  await expect(page.locator('dialog[open]')).toHaveCount(1);

  await page.locator('#review-dialog [data-gallery-tool="tool-1"]').click();
  await expect(page.locator('#gallery-dialog')).toBeVisible();
  const galleryJump = page.locator('#gallery-dialog [data-review-jump]').first();
  const galleryReviewId = await galleryJump.getAttribute('data-review-jump');
  await galleryJump.click();
  await expect(page.locator('#gallery-dialog')).toBeHidden();
  await expect(page.locator('#review-dialog')).toBeVisible();
  const galleryTarget = page.locator(`[data-review-id="${galleryReviewId}"]`);
  await expect(galleryTarget.locator('button').first()).toBeFocused();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test.describe('375x812 review', () => {
  test.use({viewport: {width: 375, height: 812}});

  test('normal view, touch descriptions, controls and forms have no overflow or iOS-size text', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(`${base}/nip-explorer.html`);
    await expect(page.locator('.feature-description').first()).toBeVisible();
    const formAudit = await page.locator('input, select, textarea').evaluateAll(nodes => nodes.map(node => ({
      id: node.id || node.getAttribute('name') || node.tagName,
      size: Number.parseFloat(getComputedStyle(node).fontSize)
    })));
    expect(formAudit.filter(item => item.size < 16)).toEqual([]);
    const metrics = await overflowMetrics(page);
    expect(metrics.document.scroll).toBeLessThanOrEqual(metrics.document.client);
    expect(metrics.body.scroll).toBeLessThanOrEqual(metrics.body.client);
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport || '').not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
    expect(errors).toEqual([]);
  });

  test('three-way comparison stays readable and has zero horizontal overflow', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(`${base}/nip-explorer.html`);
    await chooseComparisons(page, 3);
    await page.getByRole('button', {name: '機能で比較'}).click();
    await expect(page.locator('.comparison-candidate')).toHaveCount(3);
    const sizes = await page.locator('.comparison-candidate, .comparison-label, .comparison-value, .comparison-evidence').evaluateAll(nodes => nodes.map(node => Number.parseFloat(getComputedStyle(node).fontSize)));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11.5);
    const metrics = await overflowMetrics(page);
    expect(metrics.document.scroll).toBeLessThanOrEqual(metrics.document.client);
    for (const dialog of metrics.dialogs) {
      expect(dialog.scroll, dialog.id).toBeLessThanOrEqual(dialog.client);
      expect(dialog.contentScroll, dialog.id).toBeLessThanOrEqual(dialog.contentClient);
    }
    const widths = await page.locator('.comparison-candidate').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1.5);
    expect(errors).toEqual([]);
  });

  for (const mode of ['evidence', 'review', 'gallery']) {
    test(`${mode} dialog has no horizontal overflow`, async ({page}) => {
      const errors = collectErrors(page);
      await page.goto(`${base}/nip-explorer.html`);
      const card = page.locator('.feature-tool-card[data-tool-id="tool-1"]');
      if (mode === 'evidence') await card.locator('[data-feature-detail]').click();
      if (mode === 'review') await card.locator('[data-review-tool]').click();
      if (mode === 'gallery') await card.locator('.card-review-more').click();
      const metrics = await overflowMetrics(page);
      expect(metrics.document.scroll).toBeLessThanOrEqual(metrics.document.client);
      for (const dialog of metrics.dialogs) {
        expect(dialog.scroll, dialog.id).toBeLessThanOrEqual(dialog.client);
        expect(dialog.contentScroll, dialog.id).toBeLessThanOrEqual(dialog.contentClient);
      }
      expect(errors).toEqual([]);
    });
  }
});
