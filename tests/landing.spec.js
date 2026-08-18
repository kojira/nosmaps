const {test, expect} = require('@playwright/test');

const SOURCE_URL = 'https://github.com/kojira/nosmaps';
const ROTATION_MS = 2500;

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

function activeSlide(page) {
  return page.locator('.carousel-slide:not([aria-hidden])');
}

function activeIndex(page) {
  return activeSlide(page).first().getAttribute('data-slide-index');
}

async function expectNoOverflow(page) {
  const metrics = await page.evaluate(() => ({
    document: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    body: [document.body.scrollWidth, document.body.clientWidth]
  }));
  expect(metrics.document[0]).toBeLessThanOrEqual(metrics.document[1]);
  expect(metrics.body[0]).toBeLessThanOrEqual(metrics.body[1]);
}

test('the headline and lead are shown in both languages', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  await expect(page.getByRole('heading', {level: 1, name: "Here's the map of Nostr!"})).toBeVisible();
  await page.getByRole('button', {name: '日本語'}).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('heading', {level: 1, name: 'Nostrの地図、ここにあります！'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('the carousel only shows fields that exist in the dataset and never invents ranking data', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  const expected = await page.evaluate(() => {
    const tool = window.NOSMAPS_DATA.tools[0];
    return {name: tool.name, description: tool.description, platform: tool.platform, total: window.NOSMAPS_DATA.tools.length};
  });
  const slide = activeSlide(page);
  await expect(slide).toHaveCount(1);
  await expect(slide).toHaveAttribute('aria-label', `${expected.name} (1 of ${expected.total})`);
  await expect(slide.locator('.slide-name')).toHaveText(expected.name);
  await expect(slide.locator('.slide-description')).toHaveText(expected.description);
  await expect(slide.locator('.slide-facts')).toContainText(expected.platform);
  await expect(page.locator('#carousel-position')).toHaveText(`1 / ${expected.total}`);
  const slideText = await page.locator('#carousel-viewport').innerText();
  expect(slideText).not.toMatch(/popular|trending|ranking|rated|人気|話題|ランキング|評価/i);
  expect(slideText).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  expect(await page.locator('.carousel-slide:not([data-clone])').count()).toBe(expected.total);
  expect(errors).toEqual([]);
});

test('the carousel auto-advances and its controls are keyboard reachable with accessible names', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  const first = await activeIndex(page);
  expect(first).toBe('0');
  await expect.poll(() => activeIndex(page), {timeout: 4 * ROTATION_MS}).not.toBe(first);

  const next = page.getByRole('button', {name: 'Next item'});
  const previous = page.getByRole('button', {name: 'Previous item'});
  await expect(next).toBeVisible();
  await expect(previous).toBeVisible();
  await next.focus();
  await expect(next).toBeFocused();
  const beforeStep = await activeIndex(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => activeIndex(page)).not.toBe(beforeStep);
  await previous.focus();
  await expect(previous).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => activeIndex(page)).toBe(beforeStep);
  expect(errors).toEqual([]);
});

test('hover and focus pause the rotation, and it resumes afterwards', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  await page.locator('#carousel').hover();
  const hovered = await activeIndex(page);
  await page.waitForTimeout(2 * ROTATION_MS);
  expect(await activeIndex(page)).toBe(hovered);

  await page.mouse.move(0, 0);
  await expect.poll(() => activeIndex(page), {timeout: 4 * ROTATION_MS}).not.toBe(hovered);

  await page.getByRole('button', {name: 'Next item'}).focus();
  const focused = await activeIndex(page);
  await page.waitForTimeout(2 * ROTATION_MS);
  expect(await activeIndex(page)).toBe(focused);

  await page.locator('h1').click();
  await expect.poll(() => activeIndex(page), {timeout: 4 * ROTATION_MS}).not.toBe(focused);
  expect(errors).toEqual([]);
});

test('reduced motion stops the auto-advance while manual control keeps working', async ({page}) => {
  const errors = collectErrors(page);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('index.html');
  const first = await activeIndex(page);
  await page.waitForTimeout(3 * ROTATION_MS);
  expect(await activeIndex(page)).toBe(first);
  await page.getByRole('button', {name: 'Next item'}).click();
  expect(await activeIndex(page)).toBe('1');
  await page.waitForTimeout(2 * ROTATION_MS);
  expect(await activeIndex(page)).toBe('1');
  expect(errors).toEqual([]);
});

test('the primary link opens the explorer', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  const link = page.getByRole('link', {name: 'Explore by feature'});
  await expect(link).toHaveAttribute('href', 'nip-explorer.html');
  await link.click();
  await expect(page).toHaveURL(/nip-explorer\.html$/);
  await expect(page.locator('#search-title')).toHaveText('Search apps and services');
  expect(errors).toEqual([]);
});

test('both pages footer the GitHub source link in either language', async ({page}) => {
  const errors = collectErrors(page);
  for (const path of ['index.html', 'nip-explorer.html']) {
    await page.goto(path);
    await page.getByRole('button', {name: 'English'}).first().click();
    const link = page.locator('.site-footer .footer-source');
    await expect(link, path).toBeVisible();
    await expect(link, path).toHaveAttribute('href', SOURCE_URL);
    await expect(link, path).toHaveAttribute('target', '_blank');
    await expect(link, path).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link, path).toHaveText('View the source on GitHub');
    await page.getByRole('button', {name: '日本語'}).first().click();
    await expect(link, path).toHaveText('GitHubでソースコードを見る');
  }
  expect(errors).toEqual([]);
});

test.describe('375x812 landing presentation', () => {
  test.use({viewport: {width: 375, height: 812}});

  test('the landing page and both footers stay within the viewport width', async ({page}) => {
    const errors = collectErrors(page);
    for (const path of ['index.html', 'nip-explorer.html']) {
      await page.goto(path);
      const footer = page.locator('.site-footer .footer-source');
      await footer.scrollIntoViewIfNeeded();
      await expect(footer, path).toBeVisible();
      const footerBox = await page.locator('.site-footer').evaluate(element => [element.scrollWidth, element.clientWidth]);
      expect(footerBox[0], path).toBeLessThanOrEqual(footerBox[1]);
      await expectNoOverflow(page);
      await page.getByRole('button', {name: '日本語'}).first().click();
      await expectNoOverflow(page);
    }
    expect(errors).toEqual([]);
  });
});
