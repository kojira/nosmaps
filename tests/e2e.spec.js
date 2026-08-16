const {test, expect} = require('@playwright/test');

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function chooseComparisons(page, count) {
  const boxes = page.locator('[data-compare-tool]');
  expect(await boxes.count()).toBeGreaterThanOrEqual(count + 1);
  for (let index = 0; index < count; index += 1) await boxes.nth(index).check();
}

async function expectNoOverflow(page) {
  const metrics = await page.evaluate(() => ({
    document: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    body: [document.body.scrollWidth, document.body.clientWidth],
    dialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => [dialog.id, dialog.scrollWidth, dialog.clientWidth, dialog.firstElementChild?.scrollWidth || 0, dialog.firstElementChild?.clientWidth || 0])
  }));
  expect(metrics.document[0]).toBeLessThanOrEqual(metrics.document[1]);
  expect(metrics.body[0]).toBeLessThanOrEqual(metrics.body[1]);
  for (const [id, scroll, client, contentScroll, contentClient] of metrics.dialogs) {
    expect(scroll, id).toBeLessThanOrEqual(client);
    expect(contentScroll, `${id} content`).toBeLessThanOrEqual(contentClient);
  }
}

async function expectDialogTrap(page, selector) {
  const dialog = page.locator(selector);
  const focusable = dialog.locator('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
  expect(await focusable.count()).toBeGreaterThan(0);
  await focusable.last().focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await focusable.first().focus();
  await page.keyboard.press('Shift+Tab');
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
}

test('browser language detection, visible switch, session memory, and no localStorage', async ({browser}) => {
  const jaContext = await browser.newContext({locale: 'ja-JP'});
  const page = await jaContext.newPage();
  await page.goto('index.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('heading', {name: /Nostrの道具/})).toBeVisible();
  await page.getByRole('button', {name: 'English'}).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', {name: /How do you want/})).toBeVisible();
  expect(await page.evaluate(() => ({session: sessionStorage.getItem('nosmaps.language'), localCount: localStorage.length}))).toEqual({session: 'en', localCount: 0});
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await jaContext.close();

  const enContext = await browser.newContext({locale: 'en-GB'});
  const enPage = await enContext.newPage();
  await enPage.goto('nip-explorer.html');
  await expect(enPage.locator('html')).toHaveAttribute('lang', 'en');
  await expect(enPage.locator('#search-title')).toHaveText('Search apps and services');
  await enContext.close();
});

test('all four concepts and canonical URLs remain available with visible localized category choices', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  expect(await page.evaluate(() => window.NOSMAPS_DATA.tools.length)).toBe(36);
  for (const mode of ['A', 'B', 'C']) await expect(page.getByRole('button', {name: `Open ${mode}`})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Open D'})).toHaveAttribute('href', 'nip-explorer.html');
  await page.getByRole('button', {name: 'Open C'}).click();
  const categories = page.locator('.category-tree .category-icon');
  await expect(categories).toHaveCount(7);
  await expect(categories.locator('.material-icon')).toHaveCount(7);
  await expect(categories.first().locator('.category-title')).toHaveText('All');
  await expect(categories.first().locator('.category-description')).toHaveText('Browse tools from every category.');
  await expect(categories.nth(1).locator('.category-title')).toHaveText('Clients');
  await expect(categories.nth(1).locator('.category-description')).toHaveText('Clients for timelines and publishing.');
  await expect(categories.nth(1)).toHaveAttribute('aria-label', 'Clients: Clients for timelines and publishing.');
  await expect(categories.nth(1)).toHaveAttribute('title', 'Clients: Clients for timelines and publishing.');
  await categories.nth(2).click();
  await expect(categories.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: '日本語'}).click();
  const localized = page.locator('.category-tree .category-icon');
  await expect(localized.first().locator('.category-title')).toHaveText('すべて');
  await expect(localized.first().locator('.category-description')).toHaveText('すべてのカテゴリから探します。');
  await expect(localized.nth(1).locator('.category-title')).toHaveText('クライアント');
  await expect(localized.nth(1).locator('.category-description')).toHaveText('タイムラインや投稿を扱うクライアント。');
  await expect(localized.nth(1)).toHaveAttribute('aria-label', 'クライアント: タイムラインや投稿を扱うクライアント。');
  await expect(localized.nth(2)).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('category titles and descriptions wrap without clipping or overflow on desktop and 375x812', async ({page}) => {
  const errors = collectErrors(page);
  for (const viewport of [{width: 1280, height: 900}, {width: 375, height: 812}]) {
    await page.setViewportSize(viewport);
    await page.goto('index.html#concept-c');
    for (const language of ['en', 'ja']) {
      const switchName = language === 'ja' ? '日本語' : 'English';
      await page.getByRole('button', {name: switchName}).click();
      const choices = page.locator('.category-tree .category-icon');
      await expect(choices).toHaveCount(7);
      const layout = await choices.evaluateAll(elements => elements.map(element => {
        const title = element.querySelector('.category-title');
        const description = element.querySelector('.category-description');
        const fits = node => node.scrollHeight <= node.clientHeight && node.scrollWidth <= node.clientWidth;
        return {button: fits(element), title: fits(title), description: fits(description), titleText: title.textContent.trim(), descriptionText: description.textContent.trim()};
      }));
      expect(layout.every(item => item.button && item.title && item.description && item.titleText && item.descriptionText), `${viewport.width}/${language}`).toBe(true);
      await expectNoOverflow(page);
    }
    await page.goto('nip-explorer.html');
    await page.locator('#filter-details > summary').click();
    for (const language of ['en', 'ja']) {
      const switchName = language === 'ja' ? '日本語' : 'English';
      await page.getByRole('button', {name: switchName}).click();
      const choices = page.locator('.category-filter .category-icon');
      await expect(choices).toHaveCount(7);
      const layout = await choices.evaluateAll(elements => elements.map(element => {
        const title = element.querySelector('.category-title');
        const description = element.querySelector('.category-description');
        const fits = node => node.scrollHeight <= node.clientHeight && node.scrollWidth <= node.clientWidth;
        return {button: fits(element), title: fits(title), description: fits(description), titleText: title.textContent.trim(), descriptionText: description.textContent.trim()};
      }));
      expect(layout.every(item => item.button && item.title && item.description && item.titleText && item.descriptionText), `explorer ${viewport.width}/${language}`).toBe(true);
      await expectNoOverflow(page);
      if (viewport.width === 375) {
        const fontSizes = await page.locator('input, select, textarea').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => parseFloat(getComputedStyle(element).fontSize)));
        expect(fontSizes.every(size => size >= 16)).toBe(true);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('A/B/C common dialogs trap focus, restore opener, and translate dynamic copy', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  const opener = page.getByRole('button', {name: 'Suggest a tool'});
  await opener.click();
  await expect(page.locator('#contribute-dialog')).toBeVisible();
  await expectDialogTrap(page, '#contribute-dialog');
  await page.locator('#contribute-dialog').getByRole('button', {name: '日本語'}).click();
  await expect(page.locator('#contribute-dialog')).toContainText('候補を提案');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-kind="submit"]')).toBeFocused();
  await page.getByRole('button', {name: 'Aを開く'}).click();
  const detail = page.locator('[data-action="detail"]').first();
  await detail.click();
  await expectDialogTrap(page, '#detail-dialog');
  await page.keyboard.press('Escape');
  await expect(detail).toBeFocused();
  expect(errors).toEqual([]);
});

test('A/B/C and explorer search record descriptions and tags in either UI language, and A/B/C use tool basis', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  await page.getByRole('button', {name: 'Open A'}).click();
  for (const language of ['en', 'ja']) {
    if (language === 'ja') await page.getByRole('button', {name: '日本語'}).click();
    for (const mode of ['A', 'B', 'C']) {
      await page.locator('.mode-switch').getByRole('button', {name: mode, exact: true}).click();
      await page.locator('#search').fill('迷わない導線');
      await expect.poll(() => page.locator('.tool-card').count(), {message: `${mode}/${language} description`}).toBeGreaterThan(0);
      await page.locator('#search').fill('セルフホスト');
      await expect.poll(() => page.locator('.tool-card').count(), {message: `${mode}/${language} tag`}).toBeGreaterThan(0);
    }
  }
  await page.locator('.mode-switch').getByRole('button', {name: 'A', exact: true}).click();
  await page.locator('#search').fill('LumaPost');
  const basis = await page.evaluate(() => window.NOSMAPS_DATA.tools.find(tool => tool.id === 'tool-1').basis);
  await page.locator('[data-tool-id="tool-1"] [data-action="detail"]').click();
  await expect(page.locator('#detail-dialog')).toContainText(basis);
  await page.keyboard.press('Escape');
  await page.locator('[data-tool-id="tool-1"] [data-action="compare"]').check();
  await page.locator('#search').fill('ZapNest');
  await page.locator('[data-tool-id="tool-2"] [data-action="compare"]').check();
  await page.getByRole('button', {name: '比較する'}).click();
  await expect(page.locator('#detail-dialog')).toContainText(basis);

  await page.goto('nip-explorer.html');
  for (const [language, switchName] of [['ja', null], ['en', 'English']]) {
    if (switchName) await page.getByRole('button', {name: switchName}).click();
    await page.locator('#feature-query').fill('迷わない導線');
    await expect.poll(() => page.locator('.feature-tool-card').count(), {message: `explorer/${language} description`}).toBeGreaterThan(0);
    await page.locator('#feature-query').fill('セルフホスト');
    await expect.poll(() => page.locator('.feature-tool-card').count(), {message: `explorer/${language} tag`}).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});

test('nested correction keeps its draft and rerenders the underlying detail in one language', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  await page.getByRole('button', {name: 'Open A'}).click();
  await page.locator('[data-tool-id="tool-1"] [data-action="detail"]').click();
  await page.locator('#detail-dialog').getByRole('button', {name: 'Correct information'}).click();
  const contribution = page.locator('#contribute-dialog');
  await contribution.locator('#con-name').fill('Draft tool name');
  await contribution.locator('#con-category').selectOption('relay');
  await contribution.locator('#con-note').fill('Keep this correction draft');
  await contribution.locator('#con-author').check();
  await contribution.getByRole('button', {name: '日本語'}).click();
  await expect(page.locator('#detail-dialog')).toBeVisible();
  await expect(page.locator('#detail-dialog')).toContainText('最終観測日時');
  await expect(contribution.locator('#con-name')).toHaveValue('Draft tool name');
  await expect(contribution.locator('#con-category')).toHaveValue('relay');
  await expect(contribution.locator('#con-note')).toHaveValue('Keep this correction draft');
  await expect(contribution.locator('#con-author')).toBeChecked();
  await contribution.getByRole('button', {name: '閉じる'}).click();
  await expect(page.locator('#detail-dialog')).toBeVisible();
  await expect(page.locator('#detail-dialog')).toContainText('最終観測日時');
  expect(errors).toEqual([]);
});

test('feature controls are icon-only, multi-select uses AND, search covers ja/en and Android/iOS', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  await expect(page.locator('.feature-chip')).toHaveCount(10);
  await expect(page.locator('.feature-chip .material-icon')).toHaveCount(10);
  expect(await page.locator('.feature-chip svg').evaluateAll(elements => elements.every(element => element.getAttribute('aria-hidden') === 'true' && element.getAttribute('focusable') === 'false'))).toBe(true);
  await expect(page.locator('.feature-chip')).toHaveText(['', '', '', '', '', '', '', '', '', '']);
  await expect(page.locator('.feature-chip[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('.feature-chip').first()).toHaveAttribute('title', /Posts & replies/);
  const initial = await page.evaluate(() => window.NOSMAPS_DATA.tools.filter(tool => tool.status !== 'dead').length);
  await expect(page.locator('.feature-tool-card')).toHaveCount(initial);
  for (const query of ['LumaPost', 'timeline', 'クライアント', 'Web app', 'Android', 'iOS', 'OSS', 'MIT', '暗号化DM', 'image video', 'NIP-44', 'Basic protocol flow description']) {
    await page.locator('#feature-query').fill(query);
    expect(await page.locator('.feature-tool-card').count(), query).toBeGreaterThan(0);
  }
  await page.locator('#feature-query').fill('');
  await page.locator('[data-select-feature="media"]').click();
  await page.locator('[data-select-feature="dm"]').click();
  await page.locator('#filter-details > summary').click();
  await page.locator('#platform-filter').selectOption('Android');
  await page.locator('#oss-filter').selectOption('yes');
  await expect(page.locator('#selected-feature-summary')).toContainText('Images & video');
  await expect(page.locator('#selected-feature-summary')).toContainText('AND');
  await expect(page.locator('.feature-tool-card')).toHaveCount(1);
  await expect(page.locator('.feature-tool-card')).toContainText('NsecVault');
  await expect(page.locator('.feature-tool-card')).toContainText('Android / iOS');
  expect(errors).toEqual([]);
});

test('feature rerender retains keyboard focus and support/reset/zero-result relaxation work', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  const media = page.locator('[data-select-feature="media"]');
  await media.focus();
  await page.keyboard.press('Space');
  await expect(media).toBeFocused();
  await expect(media).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#filter-details > summary').click();
  await expect(page.locator('#support-filter')).toBeEnabled();
  await page.getByRole('button', {name: 'Reset filters'}).click();
  await expect(page.locator('#support-filter')).toBeDisabled();
  await page.locator('#feature-query').fill('LumaPost');
  await page.locator('#platform-filter').selectOption('Android');
  await expect(page.locator('.feature-tool-card')).toHaveCount(0);
  await expect(page.locator('.relaxation-suggestion')).toBeVisible();
  await page.locator('.relaxation-suggestion').click();
  expect(await page.locator('.feature-tool-card').count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('language rerender preserves selected features, comparison, and open dialog context', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  await page.locator('[data-select-feature="media"]').click();
  await chooseComparisons(page, 2);
  await page.locator('[data-review-tool]').first().click();
  await expect(page.locator('#review-dialog')).toBeVisible();
  await page.locator('#review-dialog').getByRole('button', {name: '日本語'}).click();
  await expect(page.locator('#review-dialog')).toBeVisible();
  await expect(page.locator('#review-dialog')).toContainText('レビューを追加');
  await expect(page.locator('[data-select-feature="media"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#compare-summary')).toContainText('2件');
  await expect(page.locator('#review-dialog .review-item')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('dead opt-in, in-page official information, fact/evaluation split, and evidence', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  await page.locator('[data-select-feature="wallet"]').click();
  await expect(page.locator('.dead-tool')).toHaveCount(0);
  await page.locator('#filter-details > summary').click();
  await page.locator('#include-dead').check();
  expect(await page.locator('.dead-tool').count()).toBeGreaterThan(0);
  await expect(page.getByRole('button', {name: /Return to active candidates/}).first()).toBeVisible();
  await page.getByRole('button', {name: 'Reset filters'}).click();
  const card = page.locator('.feature-tool-card').first();
  await expect(card.getByRole('heading', {name: 'Facts & observations'})).toBeVisible();
  await expect(card.getByRole('heading', {name: 'User evaluations'})).toBeVisible();
  for (const name of ['Official site', 'Distribution', 'Official docs', 'Source']) {
    const control = card.getByRole('button', {name});
    await control.click();
    await expect(page.locator('#evidence-dialog')).toContainText('.invalid');
    await expect(page.locator('#evidence-dialog')).toContainText('Last checked');
    await page.keyboard.press('Escape');
    await expect(control).toBeFocused();
  }
  await card.getByRole('button', {name: 'Details & evidence'}).click();
  await page.locator('.basis-row').first().click();
  await expect(page.locator('#evidence-dialog')).toContainText('Observer');
  await expect(page.locator('#evidence-dialog')).toContainText('Official NIP source');
  expect(errors).toEqual([]);
});

test('three-way compare supports remove/add/replace and NIP evidence returns to position', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  await chooseComparisons(page, 3);
  await page.locator('[data-compare-tool]').nth(3).click();
  await expect(page.locator('[data-compare-tool]').nth(3)).not.toBeChecked();
  await expect(page.locator('#compare-summary')).toContainText('3 selected');
  const opener = page.getByRole('button', {name: 'Compare features'});
  await opener.click();
  await expect(page.locator('.comparison-candidate')).toHaveCount(3);
  await expect(page.locator('.comparison-item').first()).toHaveAttribute('data-difference', 'true');
  const body = page.locator('.comparison-body');
  const evidence = page.getByRole('button', {name: 'NIP evidence'}).nth(3);
  await evidence.scrollIntoViewIfNeeded();
  const scroll = await body.evaluate(element => element.scrollTop);
  await evidence.click();
  await expect(page.locator('#evidence-dialog')).toBeVisible();
  await expect(page.locator('#compare-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(evidence).toBeFocused();
  expect(await body.evaluate(element => element.scrollTop)).toBe(scroll);
  const removed = await page.locator('.comparison-candidate strong').first().textContent();
  await page.locator('[data-compare-remove]').first().click();
  await expect(page.locator('.comparison-candidate')).toHaveCount(2);
  await page.locator('#compare-alternative').selectOption({label: removed.trim()});
  await page.getByRole('button', {name: 'Add to comparison'}).click();
  await expect(page.locator('.comparison-candidate')).toHaveCount(3);
  await page.locator('#compare-alternative').selectOption({index: 0});
  await page.locator('#compare-replace-target').selectOption({index: 0});
  await page.getByRole('button', {name: 'Replace selected candidate'}).click();
  await expect(page.locator('.comparison-candidate')).toHaveCount(3);
  await expectDialogTrap(page, '#compare-dialog');
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
});

test('comparison distinguishes no record from explicit unknown and evidence follows the aggregate record', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  await page.locator('[data-compare-tool="tool-2"]').check();
  await page.locator('[data-compare-tool="tool-4"]').check();
  await page.getByRole('button', {name: 'Compare features'}).click();
  const longform = page.locator('.comparison-item').filter({has: page.locator('.comparison-label', {hasText: 'Long-form'})});
  await expect(longform.locator('.comparison-value').nth(0).locator('.no-support-record')).toHaveText('—');
  await expect(longform.locator('.comparison-value').nth(0).locator('.comparison-evidence')).toHaveCount(0);
  await expect(longform.locator('.comparison-value').nth(1).locator('.support-badge')).toHaveText('Unknown');
  await expect(longform.locator('.comparison-value').nth(1).locator('.comparison-evidence')).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByRole('button', {name: 'Clear selection'}).click();
  await page.locator('[data-compare-tool="tool-4"]').check();
  await page.locator('[data-compare-tool="tool-5"]').check();
  await page.getByRole('button', {name: 'Compare features'}).click();
  const notifications = page.locator('.comparison-item').filter({has: page.locator('.comparison-label', {hasText: 'Notifications'})});
  await expect(notifications.locator('.comparison-value').first().locator('.support-badge')).toHaveText('Supported');
  await notifications.locator('.comparison-value').first().locator('.comparison-evidence').click();
  await expect(page.locator('#evidence-dialog')).toContainText('NIP-57');
  await expect(page.locator('#evidence-dialog')).toContainText('Supported');
  expect(errors).toEqual([]);
});

test('review language rerenders preserve draft fields and images, and a seeded image overrides a local image', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  await page.locator('[data-tool-id="tool-1"] [data-review-tool]').click();
  const form = page.locator('[data-review-form="tool-1"]');
  await form.locator('textarea[name="body"]').fill('Keep this review draft');
  await form.locator('input[name="os"]').fill('Draft OS');
  await form.locator('input[name="version"]').fill('9.9');
  await form.locator('input[name="use"]').fill('Draft use');
  await form.locator('select[name="rating"]').selectOption('4');
  await form.locator('input[name="imageChoice"]').nth(1).check();
  await page.locator('#review-dialog').getByRole('button', {name: '日本語'}).click();
  await expect(form.locator('textarea[name="body"]')).toHaveValue('Keep this review draft');
  await expect(form.locator('input[name="os"]')).toHaveValue('Draft OS');
  await expect(form.locator('input[name="version"]')).toHaveValue('9.9');
  await expect(form.locator('input[name="use"]')).toHaveValue('Draft use');
  await expect(form.locator('select[name="rating"]')).toHaveValue('4');
  await expect(form.locator('input[name="imageChoice"]').nth(1)).toBeChecked();

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await form.locator('input[name="deviceImage"]').setInputFiles({name: 'draft-image.png', mimeType: 'image/png', buffer: png});
  await expect(form.locator('.local-image-preview img')).toBeVisible();
  await expect(form.locator('.local-image-preview')).toContainText('draft-image.png');
  await page.locator('#review-dialog').getByRole('button', {name: 'English'}).click();
  await expect(form.locator('textarea[name="body"]')).toHaveValue('Keep this review draft');
  await expect(form.locator('.local-image-preview img')).toBeVisible();
  await expect(form.locator('.local-image-preview')).toContainText('draft-image.png');
  await expect(form.locator('input[name="imageChoice"]:checked')).toHaveCount(0);

  await form.locator('input[name="imageChoice"]').nth(2).check();
  await expect(form.locator('.local-image-preview')).toBeEmpty();
  expect(await form.getAttribute('data-local-image')).toBe('');
  await form.getByRole('button', {name: 'Add review'}).click();
  const addedImage = page.locator('.review-item').last().locator('img');
  await expect(addedImage).toBeVisible();
  expect(await addedImage.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
  expect(errors).toEqual([]);
});

test('reviewer history gathers reviews from every tool before applying its display limit', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  await page.locator('#feature-query').fill('NsecVault');
  await page.locator('[data-tool-id="tool-9"] [data-review-tool]').click();
  const form = page.locator('[data-review-form="tool-9"]');
  await form.locator('textarea[name="body"]').fill('Late tool history entry');
  await form.getByRole('button', {name: 'Add review'}).click();
  const added = page.locator('.review-item').filter({hasText: 'Late tool history entry'});
  await added.locator('[data-reviewer="local"]').click();
  await expect(page.locator('#profile-dialog .profile-history')).toContainText('NsecVault');
  await expect(page.locator('#profile-dialog .profile-history')).toContainText('Late tool history entry');
  expect(errors).toEqual([]);
});

test('likes, bookmarks, text/image reviews, profiles, history, gallery, and image return work', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  const card = page.locator('[data-tool-id="tool-1"]');
  const like = card.locator('[data-like-tool]');
  const before = await like.textContent();
  await like.click();
  expect(await card.locator('[data-like-tool]').textContent()).not.toBe(before);
  await card.locator('[data-bookmark-tool]').click();
  await expect(card).toContainText('Bookmarked');
  await card.locator('[data-review-tool]').click();
  const form = page.locator('[data-review-form]');
  await form.locator('textarea[name="body"]').fill('Text-only review');
  await form.getByRole('button', {name: 'Add review'}).click();
  await expect(page.locator('.review-item')).toHaveCount(5);
  await page.locator('[data-review-form] input[name="imageChoice"]').first().check();
  await page.locator('[data-review-form]').getByRole('button', {name: 'Add review'}).click();
  await expect(page.locator('.review-item')).toHaveCount(6);
  await page.locator('.review-item').first().locator('[data-review-vote="helpful"]').click();
  await page.locator('.review-item').first().locator('[data-reviewer]').click();
  await expect(page.locator('#profile-dialog')).toContainText('Review and vote history');
  await expect(page.locator('#profile-dialog [data-review-jump]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await card.locator('.card-review-more').click();
  await expect(page.locator('.gallery-card')).toHaveCount(5);
  const galleryScroll = await page.locator('#gallery-content').evaluate(element => element.scrollTop);
  await page.locator('.gallery-card').first().getByRole('button', {name: 'Enlarge'}).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#gallery-dialog')).toBeVisible();
  expect(await page.locator('#gallery-content').evaluate(element => element.scrollTop)).toBe(galleryScroll);
  expect(errors).toEqual([]);
});

test('loading, empty, error, partial, and offline remain reachable without visible evaluation controls', async ({page}) => {
  const errors = collectErrors(page);
  for (const [name, text] of [['loading', 'Loading feature support'], ['empty', 'There are no candidates'], ['error', 'could not be loaded'], ['partial', 'Showing part'], ['offline', 'Showing saved']]) {
    await page.goto(`nip-explorer.html?state=${name}`);
    await expect(page.locator('#ui-state-view')).toContainText(text);
    await expect(page.locator('[data-set-state], #tool-results')).toHaveCount(name === 'error' ? 2 : 1);
  }
  await expect(page.locator('#state-lab, [data-ui-state]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('rendered text and attributes contain none of the forbidden presentation language', async ({page}) => {
  const forbidden = /(モック|操作イメージ|未署名|未送信|未永続|リロードで消える|架空データ|外部遷移なし|安全プレビュー|SAFE LINK PREVIEW|ページ内確認用|表示状態ラボ|レビュー用デモ|\bmock\b|\bdemo\b|safe preview|no external navigation|not persisted|reload clears|unsigned|unsent|test lab)/i;
  for (const path of ['index.html', 'nip-explorer.html']) {
    await page.goto(path);
    for (const language of ['English', '日本語']) {
      await page.getByRole('button', {name: language}).last().click();
      const values = await page.evaluate(() => {
        const attrs = [...document.querySelectorAll('*')].flatMap(element => [...element.attributes].filter(attribute => !['src', 'href', 'class', 'id', 'style'].includes(attribute.name)).map(attribute => `${attribute.name}=${attribute.value}`));
        return [document.body.innerText, document.title, document.querySelector('meta[name="description"]')?.content || '', ...attrs];
      });
      expect(values.filter(value => forbidden.test(value))).toEqual([]);
    }
  }
});

test.describe('375x812 responsive presentation', () => {
  test.use({viewport: {width: 375, height: 812}});

  test('pages, controls, inputs, and thumbnail occupancy remain compact with no overflow', async ({page}) => {
    const errors = collectErrors(page);
    for (const path of ['index.html', 'nip-explorer.html']) {
      await page.goto(path);
      await expectNoOverflow(page);
      const undersized = await page.locator('input,select,textarea').evaluateAll(nodes => nodes.filter(node => Number.parseFloat(getComputedStyle(node).fontSize) < 16).map(node => node.id || node.name));
      expect(undersized).toEqual([]);
    }
    const thumbs = page.locator('[data-tool-id="tool-1"] .card-review-thumbnail');
    await expect(thumbs).toHaveCount(3);
    await expect(page.locator('[data-tool-id="tool-1"] .card-review-more')).toHaveText('+1');
    const dimensions = await thumbs.evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return [box.width, box.height]; }));
    for (const [width, height] of dimensions) expect(width / height).toBeCloseTo(4 / 3, 1);
    const occupancy = await page.locator('[data-tool-id="tool-1"]').evaluate(card => card.querySelector('.card-review-thumbnails').getBoundingClientRect().height / card.getBoundingClientRect().height);
    expect(occupancy).toBeLessThan(0.2);
    expect(errors).toEqual([]);
  });

  test('three-way comparison and review/gallery dialogs have no horizontal overflow', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto('nip-explorer.html');
    await chooseComparisons(page, 3);
    await page.getByRole('button', {name: 'Compare features'}).click();
    await expectNoOverflow(page);
    const widths = await page.locator('.comparison-candidate').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1.5);
    await page.keyboard.press('Escape');
    await page.locator('[data-tool-id="tool-1"] [data-review-tool]').click();
    await expectNoOverflow(page);
    await page.keyboard.press('Escape');
    await page.locator('[data-tool-id="tool-1"] .card-review-more').click();
    await expectNoOverflow(page);
    expect(errors).toEqual([]);
  });
});
