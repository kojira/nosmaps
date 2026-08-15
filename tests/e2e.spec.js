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
  return page.evaluate(() => {
    const dialog = document.querySelector('#compare-dialog');
    const content = document.querySelector('#compare-content');
    return {
      document: {scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth},
      body: {scroll: document.body.scrollWidth, client: document.body.clientWidth},
      dialog: dialog?.open ? {scroll: dialog.scrollWidth, client: dialog.clientWidth} : null,
      content: dialog?.open ? {scroll: content.scrollWidth, client: content.clientWidth} : null
    };
  });
}

test('A/B/C regression, D entry, and common 36 records', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/index.html`);
  expect(await page.evaluate(() => window.NOSMAPS_DATA.tools.length)).toBe(36);
  for (const mode of ['A', 'B', 'C']) await expect(page.getByRole('button', {name: `${mode}案を操作する`})).toBeVisible();
  await expect(page.getByRole('heading', {name: '機能探索・比較（NIP裏付け）'})).toBeVisible();

  for (const mode of ['A', 'B', 'C']) {
    await page.getByRole('button', {name: `${mode}案を操作する`}).click();
    await expect(page.locator('.tool-card').first()).toBeVisible();
    await page.locator('.tool-card .secondary').first().click();
    await expect(page.locator('#detail-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto(`${base}/index.html`);
  }
  expect(errors).toEqual([]);
});

test('D search-first structure, details chips, and early results', async ({page}, testInfo) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  expect(await page.evaluate(() => window.NOSMAPS_DATA.tools.length)).toBe(36);

  for (const selector of ['body > header', '.site-header', '.feature-hero', '.hero-copy', '.lead', '.mock-details', '.mock-badge', '#compare-dock', '.feature-matrix']) {
    await expect(page.locator(selector), `${selector} must be absent`).toHaveCount(0);
  }
  await expect(page.locator('#compare-actions')).toBeHidden();
  await expect(page.locator('#filter-details')).not.toHaveAttribute('open', '');
  await expect(page.locator('#search-help')).toHaveCount(0);
  await expect(page.locator('.feature-chip')).toHaveCount(10);
  await expect(page.locator('.feature-chip svg.feature-icon')).toHaveCount(10);
  await expect(page.locator('.feature-chip small, .feature-chip .feature-description')).toHaveCount(0);

  const chips = await page.locator('.feature-chip').evaluateAll(elements => elements.map(element => ({
    label: element.querySelector('.feature-chip-label')?.textContent.trim(),
    title: element.getAttribute('title'),
    aria: element.getAttribute('aria-label')
  })));
  expect(chips.every(chip => chip.label && chip.label.length <= 10 && chip.title && chip.aria)).toBe(true);

  const positions = await page.evaluate(() => ({
    searchTop: document.querySelector('#feature-query').getBoundingClientRect().top,
    resultsTop: document.querySelector('#results').getBoundingClientRect().top,
    firstCardTop: document.querySelector('.feature-tool-card').getBoundingClientRect().top
  }));
  await testInfo.attach('desktop-first-view-metrics.json', {body: JSON.stringify(positions, null, 2), contentType: 'application/json'});
  expect(positions.searchTop).toBeLessThan(90);
  expect(positions.resultsTop).toBeLessThan(170);
  expect(positions.firstCardTop).toBeLessThan(300);
  expect(await page.locator('body').innerText()).not.toMatch(/mock|モック|架空/i);
  for (const query of ['LumaPost', 'タイムライン', 'クライアント', 'Webアプリ']) {
    await page.locator('#feature-query').fill(query);
    expect(await page.locator('.feature-tool-card').count()).toBeGreaterThan(0);
    await expect(page.locator('.feature-chip')).toHaveCount(10);
  }
  await page.locator('#feature-query').fill('');
  await page.screenshot({path: 'screenshots/nip-explorer-desktop.png', fullPage: true});
  expect(errors).toEqual([]);
});

test('feature reverse lookup and dead explicit opt-in', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  await page.getByRole('searchbox', {name: 'アプリ／サービスを全文検索'}).fill('');
  await page.locator('#filter-details summary').first().click();
  await page.getByRole('option', {name: /Wallet・Zap/}).click();
  await expect(page.locator('#selected-feature-summary')).toContainText('Wallet・Zap');
  expect(await page.locator('.feature-tool-card').count()).toBeGreaterThan(0);
  await expect(page.locator('.feature-tool-card.dead-tool')).toHaveCount(0);
  await page.getByLabel('終了／到達不能も含める').check();
  expect(await page.locator('.feature-tool-card.dead-tool').count()).toBeGreaterThan(0);
  await expect(page.getByRole('button', {name: '同じ機能の稼働候補へ戻る'}).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('safe OSS source action and evidence/NIP details', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  const source = page.getByRole('button', {name: 'ソース', exact: true}).first();
  await expect(source).toBeVisible();
  await source.click();
  await expect(page.getByRole('heading', {name: /ソース/})).toBeVisible();
  await expect(page.locator('#evidence-content')).toContainText('ページ内安全モック');
  await expect(page.locator('#evidence-content')).toContainText('.invalid');
  await page.keyboard.press('Escape');
  await expect(page.locator('#evidence-dialog')).toBeHidden();

  await page.getByRole('button', {name: '詳細・根拠'}).first().click();
  await expect(page.locator('#evidence-content')).toContainText('NIP-');
  await page.locator('.basis-row').first().click();
  await expect(page.locator('#evidence-content')).toContainText('観測主体');
  await expect(page.locator('#evidence-content')).toContainText('公式NIP一次資料');
  expect(await page.locator('#evidence-content').innerText()).not.toMatch(/mock|モック|架空/i);
  expect(errors).toEqual([]);
});

test('maximum three, responsive vertical comparison, and difference priority', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  await chooseComparisons(page, 3);
  await page.locator('[data-compare-tool]').nth(3).click();
  await expect(page.locator('#compare-summary')).toContainText('3件');
  await page.getByRole('button', {name: '機能で比較'}).click();
  await expect(page.getByRole('heading', {name: '3件の機能比較'})).toBeVisible();
  await expect(page.locator('.comparison-candidate')).toHaveCount(3);
  expect(await page.locator('.comparison-item').count()).toBeGreaterThan(6);
  await expect(page.locator('table, .feature-matrix')).toHaveCount(0);
  for (const label of ['投稿・返信', 'OS', 'カテゴリ', '更新状態', '提供形態', 'OSS', '最終観測']) await expect(page.locator('#compare-content')).toContainText(label);
  expect(await page.locator('.comparison-item.is-different').count()).toBeGreaterThan(0);
  expect(await page.locator('.comparison-item.is-identical').count()).toBeGreaterThan(0);
  await expect(page.locator('.comparison-item').first()).toHaveAttribute('data-difference', 'true');
  await page.getByRole('button', {name: 'NIP裏付け'}).first().click();
  await expect(page.locator('#evidence-dialog')).toBeVisible();
  expect(errors).toEqual([]);
});

test('state lab loading empty error partial offline', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  await page.locator('#state-lab > summary').click();
  const expected = {loading: '読み込み中', empty: '0件', error: '取得できません', partial: '一部データ'};
  for (const name of ['loading', 'empty', 'error', 'partial', 'offline']) {
    await page.getByRole('button', {name, exact: true}).click();
    if (name === 'offline') await expect(page.locator('#offline-banner')).toBeVisible();
    else await expect(page.locator('#ui-state-view')).toContainText(new RegExp(expected[name], 'i'));
  }
  expect(errors).toEqual([]);
});

test.describe('mobile 375px', () => {
  test.use({viewport: {width: 375, height: 812}});

  test('normal view has no overflow and reaches candidates early', async ({page}, testInfo) => {
    const errors = collectErrors(page);
    await page.goto(`${base}/nip-explorer.html`);
    await expect(page.locator('#filter-details')).not.toHaveAttribute('open', '');
    const metrics = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      return {
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
        searchTop: rect('#feature-query').top,
        resultsTop: rect('#results').top,
        firstCardTop: rect('.feature-tool-card').top
      };
    });
    await testInfo.attach('mobile-first-view-metrics.json', {body: JSON.stringify(metrics, null, 2), contentType: 'application/json'});
    expect(metrics.scroll, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.client);
    expect(metrics.searchTop).toBeLessThan(85);
    expect(metrics.resultsTop).toBeLessThan(270);
    expect(metrics.firstCardTop).toBeLessThan(410);
    await page.locator('#filter-details summary').first().click();
    await expect(page.getByRole('option', {name: /投稿・返信/})).toBeVisible();
    await page.locator('#platform-filter').selectOption('Web');
    await expect(page.locator('#condition-summary')).toContainText('Web');
    const after = await overflowMetrics(page);
    expect(after.document.scroll, JSON.stringify(after)).toBeLessThanOrEqual(after.document.client);
    await page.locator('#filter-details summary').first().click();
    await page.screenshot({path: 'screenshots/nip-explorer-mobile.png', fullPage: true});
    expect(errors).toEqual([]);
  });

  for (const count of [2, 3]) {
    test(`compare ${count} keeps full-width value grids without overflow`, async ({page}, testInfo) => {
      const errors = collectErrors(page);
      await page.goto(`${base}/nip-explorer.html`);
      await chooseComparisons(page, count);
      await page.getByRole('button', {name: '機能で比較'}).click();
      await expect(page.locator('#compare-dialog')).toBeVisible();
      await expect(page.locator('.comparison-candidate')).toHaveCount(count);

      const metrics = await page.evaluate(() => {
        const item = document.querySelector('.comparison-item');
        const label = item.querySelector('.comparison-label');
        const values = item.querySelector('.comparison-values');
        const candidateWidths = [...document.querySelectorAll('.comparison-candidate')].map(element => element.getBoundingClientRect().width);
        const itemRect = item.getBoundingClientRect();
        const labelRect = label.getBoundingClientRect();
        const valuesRect = values.getBoundingClientRect();
        const dialog = document.querySelector('#compare-dialog');
        const content = document.querySelector('#compare-content');
        return {
          document: {scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth},
          dialog: {scroll: dialog.scrollWidth, client: dialog.clientWidth},
          content: {scroll: content.scrollWidth, client: content.clientWidth},
          itemWidth: itemRect.width,
          labelWidth: labelRect.width,
          valuesWidth: valuesRect.width,
          labelBottom: labelRect.bottom,
          valuesTop: valuesRect.top,
          candidateWidths,
          candidateNames: [...document.querySelectorAll('.comparison-candidate')].map(element => element.textContent.trim())
        };
      });
      await testInfo.attach(`mobile-compare-${count}-metrics.json`, {body: JSON.stringify(metrics, null, 2), contentType: 'application/json'});
      expect(metrics.document.scroll, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.document.client);
      expect(metrics.dialog.scroll, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.dialog.client);
      expect(metrics.content.scroll, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.content.client);
      expect(metrics.labelWidth / metrics.itemWidth).toBeGreaterThan(.97);
      expect(metrics.valuesWidth / metrics.itemWidth).toBeGreaterThan(.97);
      expect(metrics.valuesTop).toBeGreaterThanOrEqual(metrics.labelBottom - 1);
      expect(Math.max(...metrics.candidateWidths) - Math.min(...metrics.candidateWidths)).toBeLessThan(1.5);
      expect(metrics.candidateNames.every(name => name.length > 0)).toBe(true);
      await page.screenshot({path: `screenshots/nip-explorer-compare-mobile-${count}.png`});
      expect(errors).toEqual([]);
    });
  }
});

test('D task 74 full-text, links, evaluation layers and local interactions', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  await expect(page.locator('.feature-chip')).toHaveCount(10);
  await expect(page.getByRole('searchbox', {name: 'アプリ／サービスを全文検索'})).toBeVisible();
  await expect(page.getByRole('searchbox', {name: /機能名/})).toHaveCount(0);

  for (const query of ['LumaPost', 'タイムライン', 'クライアント', 'Web', 'Webアプリ', '軽量']) {
    await page.locator('#feature-query').fill(query);
    expect(await page.locator('.feature-tool-card').count(), query).toBeGreaterThan(0);
  }
  await page.locator('#feature-query').fill('LumaPost');
  await page.locator('#filter-details summary').first().click();
  await page.getByRole('option', {name: /長文/}).click();
  await expect(page.locator('.feature-tool-card')).toHaveCount(1);
  await page.getByRole('option', {name: /DM/}).click();
  await expect(page.locator('.feature-tool-card')).toHaveCount(0);
  await page.locator('#feature-query').fill('');
  await page.getByRole('option', {name: /投稿・返信/}).click();

  const card = page.locator('.feature-tool-card').first();
  await expect(card.getByRole('heading', {name: '事実・観測'})).toBeVisible();
  await expect(card.getByRole('heading', {name: '利用者評価'})).toBeVisible();
  for (const label of ['公式サイト', 'アプリ配布', '公式Docs', 'ソース']) {
    const button = card.getByRole('button', {name: label, exact: true});
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator('#evidence-content')).toContainText(label);
    await expect(page.locator('#evidence-content')).toContainText('.invalid');
    await expect(page.locator('#evidence-content')).toContainText('最終確認日時');
    await page.keyboard.press('Escape');
  }

  const like = card.locator('[data-like-tool]');
  const before = await like.textContent();
  await like.click();
  const after = await page.locator('.feature-tool-card').first().locator('[data-like-tool]').textContent();
  expect(after).not.toBe(before);
  await expect(page.locator('#toast')).toContainText('未署名・未送信');

  await page.locator('.feature-tool-card').first().locator('[data-bookmark-tool]').click();
  await expect(page.locator('.feature-tool-card').first()).toContainText('非公開（既定）');
  await page.locator('.feature-tool-card').first().locator('[data-public-bookmark]').check();
  await expect(page.locator('.feature-tool-card').first()).toContainText('公開プレビュー・未送信');
  await page.locator('#saved-only').check();
  await expect(page.locator('.feature-tool-card')).toHaveCount(1);

  await page.locator('.feature-tool-card').first().locator('[data-review-tool]').click();
  await expect(page.getByRole('heading', {name: 'レビュー一覧'})).toBeVisible();
  await expect(page.locator('#review-content')).toContainText('対象OS');
  await expect(page.locator('#review-content')).toContainText('アプリversion');
  await page.locator('[data-review-form] textarea[name="body"]').fill('キーボード操作を確認しました。');
  await page.locator('[data-review-form] input[name="os"]').fill('Desktop');
  await page.locator('[data-review-form] input[name="version"]').fill('v9.1.0');
  await page.locator('[data-review-form] button[type="submit"]').click();
  await expect(page.locator('.review-preview')).toContainText('未送信プレビュー');
  await expect(page.locator('.review-preview')).toContainText('v9.1.0');
  await page.keyboard.press('Escape');
  await expect(page.locator('#review-dialog')).toBeHidden();
  expect(errors).toEqual([]);
});

test('task 74 reviewer profile, helpfulness, optional metadata, and gallery mock', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  const card = page.locator('.feature-tool-card').first();
  await card.locator('[data-review-tool]').click();
  await expect(page.locator('[data-reviewer]').first()).toContainText('npub1');
  await page.locator('[data-reviewer]').first().click();
  await expect(page.locator('#profile-dialog')).toBeVisible();
  await expect(page.locator('#profile-content')).toContainText('過去レビューと役立ち内訳');
  await expect(page.locator('#profile-content')).toContainText('投稿履歴の広がり');
  await expect(page.locator('#profile-content')).toContainText('単一の信頼スコアでは断定せず');
  await page.keyboard.press('Escape');

  await card.locator('[data-review-tool]').click();
  const firstReview = page.locator('.review-item').first();
  await firstReview.locator('[data-review-vote="helpful"]').click();
  await expect(page.locator('.vote-preview-state')).toContainText('未署名・未送信');
  await page.locator('.review-item').first().locator('[data-vote-basis]').click();
  await expect(page.locator('#evidence-content')).toContainText('評価者の広がり');
  await page.keyboard.press('Escape');

  await card.locator('[data-review-tool]').click();
  const form = page.locator('[data-review-form]');
  await expect(form.locator('input[name="author"], input[name="date"], input[name="created_at"]')).toHaveCount(0);
  await form.locator('textarea[name="body"]').fill('本文だけのレビュー');
  await form.getByRole('button', {name: '未送信プレビューを作る'}).click();
  await expect(form.locator('.review-preview')).toContainText('対象OS: 未入力');
  await expect(form.locator('.review-preview')).toContainText('アプリversion: 未入力');
  await form.locator('textarea[name="body"]').fill('');
  await form.locator('input[name="mockImage"]').first().check();
  await form.getByRole('button', {name: '未送信プレビューを作る'}).click();
  await expect(form.locator('.review-preview')).toContainText('本文なし（画像のみ）');
  await form.locator('textarea[name="body"]').fill('本文＋画像');
  await form.getByRole('button', {name: '未送信プレビューを作る'}).click();
  await expect(form.locator('.review-preview')).toContainText('本文＋画像');
  await page.keyboard.press('Escape');

  await card.locator('[data-feature-detail]').click();
  await page.getByRole('button', {name: 'レビュー画像ギャラリー'}).click();
  await expect(page.locator('#gallery-dialog')).toBeVisible();
  await expect(page.locator('.gallery-card').first()).toContainText('投稿日時');
  await page.locator('.gallery-card').first().locator('[data-reviewer]').click();
  await expect(page.locator('#profile-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await card.locator('[data-feature-detail]').click();
  await page.getByRole('button', {name: 'レビュー画像ギャラリー'}).click();
  await page.locator('.gallery-card').first().getByRole('button', {name: '拡大'}).click();
  await expect(page.locator('#image-dialog')).toBeVisible();
  await page.getByRole('button', {name: '元レビューへ'}).click();
  await expect(page.locator('#review-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await card.locator('[data-feature-detail]').click();
  await page.getByRole('button', {name: 'レビュー画像ギャラリー'}).click();
  await page.locator('.gallery-card').first().getByRole('button', {name: '拡大'}).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#image-dialog')).toBeHidden();
  expect(errors).toEqual([]);
});

test.describe('task 74 mobile dialogs at 375px', () => {
  test.use({viewport: {width: 375, height: 812}});
  for (const mode of ['details', 'review', 'gallery']) {
    test(`${mode} has no horizontal overflow`, async ({page}) => {
      const errors = collectErrors(page);
      await page.goto(`${base}/nip-explorer.html`);
      if (mode === 'details') await page.locator('#filter-details > summary').click();
      if (mode === 'review') await page.locator('.feature-tool-card').first().locator('[data-review-tool]').click();
      if (mode === 'gallery') {
        await page.locator('.feature-tool-card').first().locator('[data-feature-detail]').click();
        await page.getByRole('button', {name: 'レビュー画像ギャラリー'}).click();
      }
      await page.screenshot({path: `screenshots/nip-explorer-mobile-${mode}.png`, fullPage: true});
      const metrics = await overflowMetrics(page);
      expect(metrics.document.scroll, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.document.client);
      for (const item of [metrics.dialog, metrics.content].filter(Boolean)) expect(item.scroll, JSON.stringify(item)).toBeLessThanOrEqual(item.client);
      const openDialog = await page.locator('dialog[open]').evaluateAll(items => items.map(item => ({scroll: item.scrollWidth, client: item.clientWidth})));
      for (const item of openDialog) expect(item.scroll, JSON.stringify(item)).toBeLessThanOrEqual(item.client);
      expect(errors).toEqual([]);
    });
  }
});

test('latest review: persistent feature choices, iOS-safe forms, card thumbnails', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();
  await page.goto(`${base}/nip-explorer.html`);

  const chips = page.locator('#feature-search #feature-chips .feature-chip');
  await expect(chips).toHaveCount(10);
  await expect(chips.first()).toBeVisible();
  await expect(page.locator('#filter-details')).not.toHaveAttribute('open', '');
  await expect(page.locator('#filter-details #feature-chips')).toHaveCount(0);
  await expect(page.locator('#filter-details #platform-filter')).toHaveCount(1);

  await page.locator('#feature-query').fill('LumaPost');
  await chips.nth(1).click();
  const cards = page.locator('.feature-tool-card');
  await expect(cards).toHaveCount(0);
  await chips.first().click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('LumaPost');

  await page.locator('#feature-query').fill('');
  const thumbs = page.locator('.feature-tool-card[data-tool-id="tool-1"] .card-review-thumbnail');
  await expect(thumbs).toHaveCount(3);
  await expect(page.locator('.feature-tool-card[data-tool-id="tool-1"] .card-review-more')).toHaveText('+1');
  const label = await thumbs.first().getAttribute('aria-label');
  expect(label).toContain('2026-08-14');
  await page.locator('.feature-tool-card[data-tool-id="tool-1"] .card-review-more').click();
  await expect(page.locator('#gallery-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await thumbs.first().click();
  await expect(page.locator('#image-dialog')).toBeVisible();
  const originalReview = page.locator('#image-dialog [data-review-tool]');
  await expect(originalReview).toBeVisible();
  await originalReview.click();
  await expect(page.locator('#review-dialog')).toBeVisible();
  await expect(page.locator('#review-dialog .review-form textarea[name="body"]')).toBeVisible();

  const emptyCard = page.locator('.feature-tool-card[data-tool-id="tool-2"]');
  await expect(emptyCard.locator('.card-review-thumbnails')).toHaveCount(0);

  const formAudit = await page.locator('input, select, textarea').evaluateAll(nodes => nodes.map(node => ({
    id: node.id || node.getAttribute('name') || node.tagName,
    size: Number.parseFloat(getComputedStyle(node).fontSize)
  })));
  expect(formAudit.length).toBeGreaterThan(0);
  expect(formAudit.filter(item => item.size < 16)).toEqual([]);
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport || '').not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await context.close();
});
