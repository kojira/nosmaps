const fs = require('node:fs');
const path = require('node:path');
const {test, expect} = require('@playwright/test');
const {stubExternalImages} = require('./support/stub-external-images');

/* The category buttons are derived from the catalogue, not from a list of categories: nip-explorer.js
   renders `all`, then the seed topics, then every other topic the records published, sorted. So the
   expected set is read out of data.js here instead of being written down. A literal `7` was what
   broke this assertion -- it stayed 7 while the catalogue grew four free topics past it, and a frozen
   number reports the catalogue growing as a regression. */
function catalogueCategoryIds() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
  const sandbox = {};
  new Function('window', source)(sandbox);
  const {tools, seedTopics} = sandbox.NOSMAPS_DATA;
  const free = [...new Set(tools.flatMap(tool => tool.topics || []).filter(topic => !seedTopics.includes(topic)))].sort();
  return ['all', ...seedTopics, ...free];
}

/* Icons in the catalogue point at ~25 real third-party hosts. Serve those bytes locally so a remote
   host having a bad day cannot turn this file red; the URLs themselves are untouched. See
   tests/support/stub-external-images.js. */
test.beforeEach(async ({context}) => { await stubExternalImages(context); });

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
  /* Contexts made by hand miss the beforeEach above, which stubs the `context` fixture. */
  await stubExternalImages(jaContext);
  const page = await jaContext.newPage();
  await page.goto('index.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('heading', {name: /Nostrの地図/})).toBeVisible();
  await page.getByRole('button', {name: 'English'}).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', {name: /map of Nostr/})).toBeVisible();
  expect(await page.evaluate(() => ({session: sessionStorage.getItem('nosmaps.language'), localCount: localStorage.length}))).toEqual({session: 'en', localCount: 0});
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await jaContext.close();

  const enContext = await browser.newContext({locale: 'en-GB'});
  await stubExternalImages(enContext);
  const enPage = await enContext.newPage();
  await enPage.goto('nip-explorer.html');
  await expect(enPage.locator('html')).toHaveAttribute('lang', 'en');
  await expect(enPage.locator('#search-title')).toHaveText('Search apps and services');
  await enContext.close();
});

test('category titles and descriptions wrap without clipping or overflow on desktop and 375x812', async ({page}) => {
  const errors = collectErrors(page);
  const expectedCategoryIds = catalogueCategoryIds();
  for (const viewport of [{width: 1280, height: 900}, {width: 375, height: 812}]) {
    await page.setViewportSize(viewport);
    await page.goto('nip-explorer.html');
    await page.locator('#filter-details > summary').click();
    for (const language of ['en', 'ja']) {
      const switchName = language === 'ja' ? '日本語' : 'English';
      await page.getByRole('button', {name: switchName}).click();
      const choices = page.locator('.category-filter .category-icon');
      await expect(choices).toHaveCount(expectedCategoryIds.length);
      const layout = await choices.evaluateAll(elements => elements.map(element => {
        const title = element.querySelector('.category-title');
        const description = element.querySelector('.category-description');
        const fits = node => node.scrollHeight <= node.clientHeight && node.scrollWidth <= node.clientWidth;
        return {id: element.dataset['categoryFilter'], button: fits(element), title: fits(title), description: fits(description), titleText: title.textContent.trim(), descriptionText: description.textContent.trim()};
      }));
      expect(layout.map(item => item.id), `explorer ${viewport.width}/${language} ids`).toEqual(expectedCategoryIds);
      /* Every button carries a label in the language on screen. A missing dictionary entry surfaces
         as the literal `undefined` (or as the lookup path echoed back), and both read as a real
         label to the wrap check above, so they are rejected by name here. */
      for (const item of layout) {
        const where = `explorer ${viewport.width}/${language}/${item.id}`;
        for (const [field, text] of [['title', item.titleText], ['description', item.descriptionText]]) {
          expect(text, `${where} ${field}`).toBeTruthy();
          expect(text, `${where} ${field}`).not.toContain('undefined');
          expect(text, `${where} ${field}`).not.toMatch(/^(categories|explorer)\./);
        }
      }
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

test('explorer search records descriptions and tags in either UI language', async ({page}) => {
  const errors = collectErrors(page);
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

test('feature controls show localized labels below SVG icons, multi-select uses AND, search covers ja/en and Android/iOS', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  const chips = page.locator('.feature-chip');
  const labels = chips.locator('.feature-chip-label');
  await expect(chips).toHaveCount(10);
  await expect(chips.locator('.material-icon')).toHaveCount(10);
  await expect(labels).toHaveCount(10);
  expect(await chips.locator('svg').evaluateAll(elements => elements.every(element => element.getAttribute('aria-hidden') === 'true' && element.getAttribute('focusable') === 'false'))).toBe(true);
  await page.locator('[data-language="ja"]').click();
  await expect(labels).toHaveText(['投稿・返信', 'DM', '検索', '画像・動画', '通知', '複数アカウント', '外部署名', 'Wallet・Zap', '長文', 'チャンネル']);
  expect(await labels.evaluateAll(elements => elements.every(element => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0 && element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight;
  }))).toBe(true);
  await expect(chips.first()).toHaveAttribute('aria-label', /投稿・返信.+タイムライン/);
  await expect(chips.first()).toHaveAttribute('title', /投稿・返信.+タイムライン/);
  await page.locator('[data-language="en"]').click();
  await expect(labels).toHaveText(['Posts & replies', 'DM', 'Search', 'Images & video', 'Notifications', 'Multiple accounts', 'External signing', 'Wallet & Zap', 'Long-form', 'Channels']);
  await expect(chips.first()).toHaveAttribute('aria-label', /Posts & replies.+timeline/);
  await expect(chips.first()).toHaveAttribute('title', /Posts & replies.+timeline/);
  await expect(page.locator('.feature-chip[aria-pressed="true"]')).toHaveCount(0);
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
  await page.locator('#compact-identity [data-language="ja"]').dispatchEvent('click');
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

/* issue #8: このテストは元々「seeded image が local image を上書きする」を固定していた。
   プリセット画像の選択盤はモック時代の残骸として撤去されたので、上書きの主張も一緒に取り下げる。
   残る保証 -- 下書きの各欄と端末からの添付画像が言語切り替えを越えて生き残ること、そして
   選択盤がどこにも無いこと -- は tests/review-local-image.spec.js へ移した。 */

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
  /* issue #8: 画像付きレビューの画像は、プリセットではなく自分で添付したものだけになった。 */
  await page.locator('[data-review-form] input[name="deviceImage"]').setInputFiles({name: 'attached.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')});
  await expect(page.locator('[data-review-form] .local-image-preview img')).toBeVisible();
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
    const featureLabels = page.locator('.feature-chip-label');
    await expect(featureLabels).toHaveCount(10);
    expect(await featureLabels.evaluateAll(elements => elements.every(element => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return element.textContent.trim().length > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0 && element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight;
    }))).toBe(true);
    await expectNoOverflow(page);
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
