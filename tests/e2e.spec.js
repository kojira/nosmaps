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

test('D compact structure, icon-only chips, and early results', async ({page}, testInfo) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  expect(await page.evaluate(() => window.NOSMAPS_DATA.tools.length)).toBe(36);

  for (const selector of ['body > header', '.site-header', '.feature-hero', '.hero-copy', '.lead', '.mock-details', '.mock-badge', '#compare-dock', '.feature-matrix']) {
    await expect(page.locator(selector), `${selector} must be absent`).toHaveCount(0);
  }
  await expect(page.locator('#compare-actions')).toBeHidden();
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
    featuresTop: document.querySelector('#feature-chips').getBoundingClientRect().top,
    resultsTop: document.querySelector('#results').getBoundingClientRect().top,
    firstCardTop: document.querySelector('.feature-tool-card').getBoundingClientRect().top
  }));
  await testInfo.attach('desktop-first-view-metrics.json', {body: JSON.stringify(positions, null, 2), contentType: 'application/json'});
  expect(positions.searchTop).toBeLessThan(90);
  expect(positions.featuresTop).toBeLessThan(145);
  expect(positions.resultsTop).toBeLessThan(220);
  expect(positions.firstCardTop).toBeLessThan(340);
  expect(await page.locator('body').innerText()).not.toMatch(/mock|モック|架空/i);
  for (const query of ['マルチアカウント', '外部署名・リモート署名', 'チャンネル・コミュニティ']) {
    await page.locator('#feature-query').fill(query);
    await expect(page.locator('.feature-chip')).toHaveCount(1);
  }
  await page.locator('#feature-query').fill('');
  await page.screenshot({path: 'screenshots/nip-explorer-desktop.png', fullPage: true});
  expect(errors).toEqual([]);
});

test('feature reverse lookup and dead explicit opt-in', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  await page.getByRole('searchbox', {name: '機能名・利用場面・代替したいこと'}).fill('zapを送りたい');
  await page.getByRole('option', {name: /Wallet・Zap/}).click();
  await expect(page.locator('#selected-feature-summary')).toContainText('Wallet・Zap');
  expect(await page.locator('.feature-tool-card').count()).toBeGreaterThan(0);
  await expect(page.locator('.feature-tool-card.dead-tool')).toHaveCount(0);
  await page.locator('#filter-details summary').first().click();
  await page.getByLabel('終了／到達不能も含める').check();
  expect(await page.locator('.feature-tool-card.dead-tool').count()).toBeGreaterThan(0);
  await expect(page.getByRole('button', {name: '同じ機能の稼働候補へ戻る'}).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('safe OSS source action and evidence/NIP details', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(`${base}/nip-explorer.html`);
  const source = page.getByRole('button', {name: /ソース情報/}).first();
  await expect(source).toBeVisible();
  await source.click();
  await expect(page.getByRole('heading', {name: /ソース情報/})).toBeVisible();
  await expect(page.locator('#evidence-content')).toContainText('外部リポジトリへの移動は行いません');
  expect(await page.locator('#evidence-content').innerText()).not.toMatch(/mock|モック|架空/i);
  await page.keyboard.press('Escape');
  await expect(page.locator('#evidence-dialog')).toBeHidden();

  await page.getByRole('button', {name: '機能の根拠詳細'}).first().click();
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
        featuresTop: rect('#feature-chips').top,
        resultsTop: rect('#results').top,
        firstCardTop: rect('.feature-tool-card').top
      };
    });
    await testInfo.attach('mobile-first-view-metrics.json', {body: JSON.stringify(metrics, null, 2), contentType: 'application/json'});
    expect(metrics.scroll, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.client);
    expect(metrics.searchTop).toBeLessThan(85);
    expect(metrics.featuresTop).toBeLessThan(140);
    expect(metrics.resultsTop).toBeLessThan(255);
    expect(metrics.firstCardTop).toBeLessThan(390);
    await page.locator('#filter-details summary').first().click();
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
