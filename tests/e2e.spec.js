const { test, expect } = require('@playwright/test');

const routes = {
  local: process.env.NOSMAPS_BASE_URL || 'http://127.0.0.1:4173',
};

function collectErrors(page) {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  return errors;
}

test('A/B/C top remains reachable and D entry opens separate page', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${routes.local}/index.html`);
  await expect(page.getByRole('button', { name: 'A案を操作する' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'B案を操作する' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C案を操作する' })).toBeVisible();
  await page.getByRole('link', { name: 'D案を操作する' }).click();
  await expect(page).toHaveURL(/nip-explorer\.html/);
  await expect(page.getByRole('heading', { name: /NIPから/ })).toBeVisible();
  expect(errors).toEqual([]);
});


test('legacy A/B/C concepts still render and operate from shared data', async ({ page }) => {
  const errors = collectErrors(page);
  for (const mode of ['A','B','C']) {
    await page.goto(`${routes.local}/index.html`);
    await page.getByRole('button', { name: `${mode}案を操作する` }).click();
    await expect(page.locator('.tool-card').first()).toBeVisible();
    await page.locator('.tool-card .secondary').first().click();
    await expect(page.locator('#detail-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  }
  expect(errors).toEqual([]);
});

test('NIP search → reverse lookup → evidence → three-tool matrix', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${routes.local}/nip-explorer.html`);
  await expect(page.locator('#nip-list')).toBeVisible();
  await page.getByLabel('NIP番号・名称・用途').fill('暗号化');
  await expect(page.getByRole('option', { name: /NIP-44/ })).toBeVisible();
  await page.getByRole('option', { name: /NIP-44/ }).click();
  await expect(page.locator('#selected-nip-summary')).toContainText('NIP-44');
  await expect(page.locator('.nip-tool-card').first()).toBeVisible();
  await page.locator('[data-evidence-tool]').first().click();
  await expect(page.getByRole('heading', { name: /NIP-44/ })).toBeVisible();
  await expect(page.locator('#evidence-content')).toContainText('モック観測主体');
  await page.getByRole('button', { name: '閉じる' }).click();
  const checks = page.locator('[data-compare-tool]');
  await expect(checks).toHaveCount(await checks.count());
  expect(await checks.count()).toBeGreaterThanOrEqual(3);
  await checks.nth(0).check(); await checks.nth(1).check(); await checks.nth(2).check();
  await expect(page.locator('#compare-summary')).toContainText('3件');
  await page.getByRole('button', { name: 'マトリクスで比較' }).click();
  await expect(page.getByRole('heading', { name: '3件のNIP対応比較' })).toBeVisible();
  await expect(page.locator('.nip-matrix thead th')).toHaveCount(4);
  await page.locator('.matrix-evidence').first().click();
  await expect(page.locator('#evidence-dialog')).toBeVisible();
  expect(errors).toEqual([]);
});

test('state lab exposes loading empty error partial offline', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${routes.local}/nip-explorer.html`);
  const expected={loading:'読み込み中',empty:'0件',error:'取得できません',partial:'partial'};
  for (const name of ['loading','empty','error','partial','offline']) {
    await page.getByRole('button', { name, exact: true }).click();
    if (name === 'offline') await expect(page.locator('#offline-banner')).toBeVisible();
    else await expect(page.locator('#ui-state-view')).toContainText(new RegExp(expected[name], 'i'));
  }
  expect(errors).toEqual([]);
});

test.describe('mobile 375px', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('no page overflow and filters are summarized/collapsed', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${routes.local}/nip-explorer.html`);
    await expect(page.locator('#condition-summary')).toBeVisible();
    await expect(page.locator('#filter-details')).not.toHaveAttribute('open', '');
    const overflow = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth}));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
    await page.locator('#filter-details summary').click();
    await page.locator('#platform-filter').selectOption('Web');
    await expect(page.locator('#condition-summary')).toContainText('Web');
    const after = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth}));
    expect(after.scroll).toBeLessThanOrEqual(after.client);
    expect(errors).toEqual([]);
  });
});
