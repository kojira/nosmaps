const fs = require('node:fs');
const path = require('node:path');
const {test, expect} = require('@playwright/test');
const {stubExternalImages} = require('./support/stub-external-images');

/* The category buttons are derived from the catalogue, not from a list of categories: nip-explorer.js
   renders `all`, then the seed topics, then every other topic the records published, sorted. So the
   expected set is read out of data.js here instead of being written down. A literal `7` was what
   broke this assertion -- it stayed 7 while the catalogue grew four free topics past it, and a frozen
   number reports the catalogue growing as a regression. */
function catalogueData() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
  const sandbox = {};
  new Function('window', source)(sandbox);
  return sandbox.NOSMAPS_DATA;
}

function catalogueCategoryIds() {
  const {tools, seedTopics} = catalogueData();
  const free = [...new Set(tools.flatMap(tool => tool.topics || []).filter(topic => !seedTopics.includes(topic)))].sort();
  return ['all', ...seedTopics, ...free];
}

/* The searchable text nip-explorer.js builds for an entry, restricted to what data.js itself holds:
   name, id, OS text, licence (plus the OSS words the licence earns), the metadata strings, the free
   topics rendered verbatim, and every capability claim with the registry title it resolves to. The
   two term sources that come from the dictionary rather than the record -- the seed-topic labels and
   the feature names/scenes/aliases -- are deliberately left out, so this is a *lower bound* on what
   the page matches and it is only used for queries whose words live in data.js. */
function catalogueSearchTerms(data, tool) {
  const flatten = value => value == null ? [] : Array.isArray(value) ? value.flatMap(flatten)
    : typeof value === 'object' ? Object.values(value).flatMap(flatten) : [String(value)];
  const nipByNumber = Object.fromEntries(data.nipCatalog.map(nip => [nip.number, nip]));
  const oss = tool.license && /^(MIT|AGPL|GPL|LGPL|Apache|BSD|MPL|Unlicense|ISC|CC0)/i.test(tool.license);
  const nipTerms = (tool.capabilities || []).flatMap(record => {
    const nip = record.family === data.registry.family ? nipByNumber[record.id] : null;
    return [record.key, `${record.family.toUpperCase()}-${record.id}`, `${record.family.toUpperCase()} ${record.id}`,
      record.id, record.registryTitle || '', nip ? nip.title : '', record.sourceText || ''];
  });
  return [tool.name, tool.id, tool.platformText || '', tool.license || '', oss ? 'OSS open source オープンソース' : '',
    ...flatten(tool.summary), ...flatten(tool.descriptions), ...flatten(tool.homepage), ...flatten(tool.sourceRepo), ...flatten(tool.distribution),
    ...(tool.topics || []).filter(topic => !data.seedTopics.includes(topic)),
    ...nipTerms].join(' ').toLowerCase();
}

/* The feature -> NIP mapping nip-explorer.js publishes in `featureDefinitions`, restated here so the
   expected result set of a feature filter is computed from the catalogue rather than read back off
   the page. Only the two features this file selects are needed. A feature counts as confirmed for a
   record when its best-ranked claim among those NIPs is `supported` or `partial` -- the same
   `confirmed` support mode the explorer defaults to (issue #7); `unknown` is not a no. */
const FEATURE_NIPS = {media: ['01', '19'], dm: ['44']};

function confirmedFeature(data, tool, featureId) {
  const rank = result => { const index = data.resultPrecedence.indexOf(result); return index === -1 ? -1 : data.resultPrecedence.length - index; };
  const claims = (tool.capabilities || []).filter(record => record.family === data.registry.family && FEATURE_NIPS[featureId].includes(record.id) && rank(record.result) > 0);
  if (!claims.length) return false;
  const best = claims.reduce((winner, record) => rank(record.result) > rank(winner.result) ? record : winner);
  return ['supported', 'partial'].includes(best.result);
}

/* Names of the entries data.js says a query has to bring back. Sorted, so it can be compared with
   the names on screen without depending on the render order. */
function catalogueSearchMatches(data, query) {
  return data.tools.filter(tool => catalogueSearchTerms(data, tool).includes(query.toLowerCase())).map(tool => tool.name).sort();
}

/* The one term that will not go stale: a name the catalogue holds, chosen because it identifies
   exactly one entry. `LumaPost` -- a name from the sample fixtures, absent from the 41 collected
   records -- is what used to be typed here, and a query nothing can match is a query that proves
   nothing about search. */
/* An entry with a recorded description in every language the catalogue uses, plus one that records
   only the collected original. Both are read out of data.js: `descriptions` is a plain language ->
   text map and the original stays canonical, so an unrecorded language is a fallback, never a blank.

   What is asserted is the property, not the roster. `['en','ja']` was what this pinned, and it was
   pinning the bug: `descriptions.en` was a byte-for-byte copy of `summary` (#14 D14-6), so the map
   looked bilingual while carrying one language and one duplicate. The catalogue is free to record
   any language or none; what it may not do is record a text that merely repeats the original, or
   record nothing at all in a language and leave a blank on the card. */
function describedEntries(data) {
  const languages = [...new Set(data.tools.flatMap(tool => Object.keys(tool.descriptions || {})))].sort();
  expect(languages.length, 'catalogue records at least one language of description').toBeGreaterThan(0);
  const copies = data.tools.flatMap(tool => Object.entries(tool.descriptions || {})
    .filter(([, text]) => text === tool.summary)
    .map(([language]) => `${tool.id}/${language}`));
  expect(copies, 'no recorded description is a second copy of the record\'s own summary').toEqual([]);
  const translated = data.tools.find(tool => tool.descriptions?.ja && tool.descriptions.ja !== tool.summary);
  expect(translated, 'catalogue records a description that differs from the collected original').toBeTruthy();
  /* The fallback case, taken from the catalogue rather than arranged: an entry with no recorded
     text for the language on screen. Today the only one is the record whose summary is absent
     altogether (R5), and what it must show is the explicit absent wording -- never "" and never
     the string `undefined`. See the FINDING in the report. */
  const noRecordedText = data.tools.find(tool => !tool.descriptions?.ja);
  expect(noRecordedText, 'catalogue has an entry with no recorded ja description').toBeTruthy();
  return {languages, translated, noRecordedText};
}

/* What each card must read, per language, computed from data.js alone: the recorded text for that
   language, else the collected original, else the explicit absent wording. */
function expectedDescriptions(data, language, absentLabel) {
  return data.tools.map(tool => tool.descriptions?.[language] || (tool.summaryAbsent ? absentLabel : tool.summary));
}

function uniqueCatalogueName(data) {
  const name = data.tools.map(tool => tool.name).find(candidate => catalogueSearchMatches(data, candidate).length === 1);
  expect(name, 'catalogue has an entry whose name matches only itself').toBeTruthy();
  return name;
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

/* 1x1 の本物の PNG。ファイル選択 -> FileReader -> data: URL の経路をそのまま通す
   (tests/review-local-image.spec.js と同じもの)。 */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

/* issue #6 / c15fafd: 折りたたんだカードは「見て回る行」になり、評価まわりの導線 -- いいね、
   ブックマーク、レビュー、レビュー画像のサムネイル -- はカードから詳細ダイアログ
   (#evidence-dialog) へ移った。カードの上で [data-review-tool] や .card-review-thumbnail を
   待っていたのは、その移動より前のページ。導線は消えていないので、今ある入口から同じものを
   検査する。 */
async function openDetail(page, id) {
  await page.locator(`[data-tool-id="${id}"] [data-feature-detail]`).click();
  await expect(page.locator('#evidence-dialog')).toBeVisible();
}

async function openReviews(page, id) {
  await openDetail(page, id);
  await page.locator('#evidence-dialog [data-review-tool]').click();
  await expect(page.locator('#review-dialog')).toBeVisible();
}

/* レビューは観測物で、収集した41件は一件も持っていない。実在のプロジェクトに架空のレビューを
   付けるのは捏造なので、seedReviews はサンプル入口に閉じられた (app.ts の allReviews)。だから
   レビューの件数を伴う保証は、すべてこの関数を呼んだ回数から出す -- 4 や 5 や 6 のような、
   サンプル時代の seed が偶然作っていた数を書き写さない。 */
async function addReview(page, {body = '', image = false} = {}) {
  const form = page.locator('#review-dialog [data-review-form]');
  await expect(form).toHaveCount(1);
  if (body) await form.locator('textarea[name="body"]').fill(body);
  if (image) {
    await form.locator('input[name="deviceImage"]').setInputFiles({name: `${body || 'attached'}.png`, mimeType: 'image/png', buffer: PNG});
    await expect(form.locator('.local-image-preview img')).toBeVisible();
  }
  await form.getByRole('button', {name: 'Add review'}).click();
}

async function closeAllDialogs(page) {
  for (let attempt = 0; attempt < 8 && await page.locator('dialog[open]').count(); attempt += 1) await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
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

/* A record's description is a plain language-code -> text map, and the collected original stays the
   canonical fallback. `迷わない導線` and `セルフホスト` were what this typed: phrases from the sample
   fixtures that no collected record holds, so both queries matched nothing and the test was waiting
   on a page that could never arrive. The queries below are read out of the catalogue instead. */
test('explorer search records descriptions and tags in either UI language', async ({page}) => {
  const errors = collectErrors(page);
  const data = catalogueData();
  const {languages, translated, noRecordedText} = describedEntries(data);
  await page.goto('nip-explorer.html');

  /* (a) A query taken from a recorded description brings back exactly the entries data.js says it
     should, and the answer does not move when the UI language does: search reads every recorded
     language, so the result set is a property of the catalogue, not of the switch.

     Four queries, covering the four ways a term reaches the index. The first two are the pair that
     matters: a phrase that exists ONLY in a translation, and a phrase that exists ONLY in the
     collected original. Neither is on screen in both languages, so a search restricted to the
     language being displayed would answer one of them with an empty list in one language and the
     right list in the other -- which is what "the catalogue answers, not the switch" forbids. */
  const queries = [
    ...languages.map(language => translated.descriptions[language].slice(0, 24)),
    translated.summary.slice(0, 24),
    uniqueCatalogueName(data),
    [...new Set(data.tools.flatMap(tool => tool.topics || []).filter(topic => !data.seedTopics.includes(topic)))].sort()[0]
  ];
  expect(queries.length, 'at least three queries, from three different term sources').toBeGreaterThanOrEqual(3);
  for (const query of queries) expect(query, 'every query is a real term from data.js').toBeTruthy();

  /** @type {Record<string, string[][]>} */
  const resultsByLanguage = {};
  for (const [language, switchName] of [['ja', '日本語'], ['en', 'English']]) {
    await page.getByRole('button', {name: switchName}).first().click();
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    /* The absent-summary wording is read again per language. Reading it once, before the first
       switch, pinned one language's label and then expected it after switching to the other -- the
       test passed in the starting language and reported the other one's correct label as wrong. */
    const absentLabel = await page.evaluate(() => window.NOSMAPS_I18N.t('explorer.summaryAbsent'));
    expect(absentLabel, `the absent-summary wording is a real label in ${language}`).toBeTruthy();

    resultsByLanguage[language] = [];
    for (const query of queries) {
      const expected = catalogueSearchMatches(data, query);
      expect(expected.length, `${query} matches something in data.js`).toBeGreaterThan(0);
      await page.locator('#feature-query').fill(query);
      await expect.poll(() => page.locator('.feature-tool-card h2').allTextContents().then(names => names.sort()),
        {message: `explorer/${language} query ${query}`}).toEqual(expected);
      /* What the page actually showed, not what was expected of it -- comparing the two languages'
         expectations would compare data.js with itself and hold no matter what the page did. */
      resultsByLanguage[language].push((await page.locator('.feature-tool-card h2').allTextContents()).sort());
    }

    /* (b) and (c): every card shows the text recorded for the language on screen, falling back to
       the collected original -- and the entry with no recorded ja text is in that list, so the
       fallback is exercised rather than assumed. No card is blank and none says `undefined`. */
    await page.locator('#feature-query').fill('');
    await expect(page.locator('.feature-tool-card')).toHaveCount(data.tools.length);
    await expect(page.locator('.feature-tool-card .tool-summary')).toHaveText(expectedDescriptions(data, language, absentLabel));
    const fallbackCard = page.locator(`[data-tool-id="${noRecordedText.id}"] .tool-summary`);
    await expect(fallbackCard).toHaveText(noRecordedText.summaryAbsent ? absentLabel : noRecordedText.summary);
    const shown = await page.locator('.feature-tool-card .tool-summary').allTextContents();
    expect(shown.filter(text => !text.trim() || text.includes('undefined')), `explorer/${language} descriptions`).toEqual([]);
  }

  /* Stated as its own assertion rather than left implied by the two loops passing: for every query,
     the two languages returned the same set. Comparing the languages to each other is what the
     property says, and it fails on a language-dependent index even if the expectations were wrong. */
  expect(resultsByLanguage['ja'], 'the same query answers the same in either UI language')
    .toEqual(resultsByLanguage['en']);
  expect(errors).toEqual([]);
});

test('feature controls show localized labels below SVG icons, multi-select uses AND, search covers ja/en and Android/iOS', async ({page}) => {
  const errors = collectErrors(page);
  const data = catalogueData();
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
  /* No filter is set, so every record the catalogue holds is on screen. The count used to be read
     off `tool.status !== 'dead'`, a field no collected entry has -- it happened to equal the whole
     catalogue by accident rather than by saying so. */
  await expect(page.locator('.feature-tool-card')).toHaveCount(data.tools.length);

  /* Two kinds of query, kept apart on purpose.

     Catalogue terms: words data.js itself holds (a name, the OS text, a licence, a registry title).
     For those the catalogue can say exactly which records must come back, so the whole result set is
     compared by name -- a search that quietly returns everything, or nothing, fails here. */
  const uniqueName = uniqueCatalogueName(data);
  for (const query of [uniqueName, 'Web app', 'Android', 'iOS', 'OSS', 'MIT', 'NIP-44', 'Basic protocol flow description']) {
    const expected = catalogueSearchMatches(data, query);
    expect(expected.length, `${query} matches something in data.js`).toBeGreaterThan(0);
    await page.locator('#feature-query').fill(query);
    await expect.poll(() => page.locator('.feature-tool-card h2').allTextContents().then(names => names.sort()), {message: query}).toEqual(expected);
  }
  expect(catalogueSearchMatches(data, uniqueName)).toEqual([uniqueName]);

  /* Dictionary terms: words that live in the translations, not in the record. A seed topic is
     searchable by its label in either language whatever the UI is set to, so the answer is still
     fixed: every entry carrying that topic, plus any entry whose own text happens to contain the
     word (several relay and library summaries say "clients" in prose). Both halves come from the
     catalogue, so neither an over-broad match nor a dropped topic hit can pass. */
  const clientTopicNames = data.tools.filter(tool => (tool.topics || []).includes('clients')).map(tool => tool.name);
  expect(clientTopicNames.length, 'catalogue has entries under the clients seed topic').toBeGreaterThan(0);
  for (const query of ['クライアント', 'Clients']) {
    const expected = [...new Set([...clientTopicNames, ...catalogueSearchMatches(data, query)])].sort();
    await page.locator('#feature-query').fill(query);
    await expect.poll(() => page.locator('.feature-tool-card h2').allTextContents().then(names => names.sort()), {message: query}).toEqual(expected);
  }
  /* Feature names, scenes and aliases are searchable in both languages for every entry, because a
     row is described by the feature vocabulary whatever its claims say. The catalogue cannot name
     the expected set here, so this only asserts the ja and en vocabulary both reach the list. */
  for (const query of ['timeline', '暗号化DM', 'image video']) {
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
  /* Four conditions ANDed: media AND dm (both confirmed), Android in the OS text, and a licence the
     OSS filter recognises. The answer is whatever data.js says satisfies all four -- `NsecVault`,
     the name that stood here, is from the sample fixtures and is in no collected record. */
  const andMatches = data.tools.filter(tool => ['media', 'dm'].every(feature => confirmedFeature(data, tool, feature))
    && String(tool.platformText || '').toLowerCase().includes('android')
    && /^(MIT|AGPL|GPL|LGPL|Apache|BSD|MPL|Unlicense|ISC|CC0)/i.test(tool.license || ''));
  expect(andMatches.length, 'catalogue has an entry passing all four conditions').toBeGreaterThan(0);
  await expect(page.locator('.feature-tool-card h2')).toHaveText(andMatches.map(tool => tool.name));
  /* The OS text is on the record's own detail dialog (the card carries four fields since 457d74c),
     and it is shown exactly as the source stated it -- never normalised into a tidier platform list. */
  await page.locator('.feature-tool-card').first().getByRole('button', {name: 'Details & evidence'}).click();
  await expect(page.locator('#evidence-dialog')).toContainText(andMatches[0].platformText);
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
  /* 開くのは画面に出ている先頭の行の詳細。id を書き写すと、テストはカタログではなく写し
     間違いを検査することになる。 */
  const subject = await page.locator('.feature-tool-card').first().getAttribute('data-tool-id');
  await openReviews(page, subject);
  /* 言語を切り替えて生き残るものが「0件」では、生き残りを何も検査していない。カタログは
     レビューを一件も持たないので、切り替える前にこの場で書く。期待する件数は書いた回数から
     出す -- 4 は seedReviews がサンプル入口に作っていた数で、収集レコードには無い。 */
  const written = ['Survives the language switch'];
  for (const body of written) await addReview(page, {body});
  await expect(page.locator('#review-dialog .review-item')).toHaveCount(written.length);
  await page.locator('#compact-identity [data-language="ja"]').dispatchEvent('click');
  await expect(page.locator('#review-dialog')).toBeVisible();
  await expect(page.locator('#review-dialog')).toContainText('レビューを追加');
  await expect(page.locator('[data-select-feature="media"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#compare-summary')).toContainText('2件');
  await expect(page.locator('#review-dialog .review-item')).toHaveCount(written.length);
  for (const body of written) await expect(page.locator('#review-dialog .review-item').filter({hasText: body})).toHaveCount(1);
  expect(errors).toEqual([]);
});

/* The entry this test drives, chosen from the catalogue rather than named. It has to be one whose
   detail dialog can exercise every guarantee below at once: an official link of each kind data.js
   can carry (`homepage`/`distribution`/`sourceRepo` -- there is no fourth, see resourceTypes()), and
   at least one capability claim that resolves against the pinned registry snapshot so the evidence
   layer has a primary NIP source to reach. `tool-1` was what used to be named here: a sample-fixture
   id absent from the 41 collected records, so every locator below waited on a card that is not on
   the page. Deriving it means the day the catalogue changes shape this fails as "no entry can carry
   this test" rather than silently passing on a page it never found. */
function fullyDocumentedEntry(data) {
  const nipByNumber = Object.fromEntries(data.nipCatalog.map(nip => [nip.number, nip]));
  const resolvedClaims = tool => (tool.capabilities || []).filter(record =>
    record.family === data.registry.family && record.registryStatus === 'resolved' && nipByNumber[record.id]?.source);
  const tool = data.tools.find(candidate => candidate.homepage && candidate.distribution && candidate.sourceRepo && resolvedClaims(candidate).length);
  expect(tool, 'catalogue has an entry with all three official links and a registry-resolved claim').toBeTruthy();
  return tool;
}

/* The entry whose project is observably gone, again read out of the catalogue. §21.4 invariant I9 is
   why this is a *liveness observation* and not a filter: a 30370 observation must not remove a row,
   so "dead" is something the record says about itself in the detail dialog, never something that
   subtracts from the list. See the FINDING in the report for the opt-in control this replaces. */
function unreachableEntry(data) {
  const tool = data.tools.find(candidate => (candidate.liveness || []).some(item => item.result === 'unreachable'));
  expect(tool, 'catalogue has an entry with an unreachable liveness observation').toBeTruthy();
  return tool;
}

test('liveness never hides a row, in-page official information, fact/evaluation split, and evidence', async ({page}) => {
  const errors = collectErrors(page);
  const data = catalogueData();
  const subject = fullyDocumentedEntry(data);
  const dead = unreachableEntry(data);
  const dialog = page.locator('#evidence-dialog');
  await page.goto('nip-explorer.html');

  /* I9: the entry whose homepage does not resolve is listed with everything else, and narrowing the
     list by a feature and widening it again does not turn that into a special case. A count is
     asserted on both sides so "it is there" cannot be satisfied by an empty page. */
  const listed = await page.locator('.feature-tool-card').count();
  expect(listed).toBe(data.tools.length);
  await expect(page.locator(`[data-tool-id="${dead.id}"]`)).toHaveCount(1);
  await page.locator('[data-select-feature="wallet"]').click();
  const narrowed = await page.locator('.feature-tool-card').count();
  expect(narrowed).toBeGreaterThan(0);
  expect(narrowed).toBeLessThan(listed);
  await page.locator('#filter-details > summary').click();
  await page.getByRole('button', {name: 'Reset filters'}).click();
  await expect(page.locator('.feature-tool-card')).toHaveCount(listed);

  /* The record says what is wrong with it where the record is: the derived value is `unknown` and
     says so (no graph counts the observation), and both observations are printed verbatim with the
     subject they were made against. This is the sentence the old `.dead-tool` styling stood in for. */
  await page.locator(`[data-tool-id="${dead.id}"]`).getByRole('button', {name: 'Details & evidence'}).click();
  await expect(dialog.locator('.liveness-derived')).toHaveAttribute('data-liveness', 'unknown');
  await expect(dialog.locator('.liveness-why')).toContainText(String((dead.liveness || []).length));
  await expect(dialog.locator('.liveness-list li')).toHaveCount((dead.liveness || []).length);
  for (const observation of dead.liveness || []) {
    const row = dialog.locator('.liveness-list li').filter({hasText: observation.subject});
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(observation.detail);
  }
  await page.keyboard.press('Escape');

  /* issue #6 / c15fafd: the collapsed card is a row to scan, so the fact/evaluation split and the
     official links live one press away in the detail dialog -- not on the card. Both are asserted:
     the card does NOT carry them, the dialog does, and in that order (facts before evaluations). */
  const card = page.locator(`[data-tool-id="${subject.id}"]`);
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('heading', {name: 'Facts & observations'})).toHaveCount(0);
  await expect(card.getByRole('heading', {name: 'User evaluations'})).toHaveCount(0);
  const detailButton = card.getByRole('button', {name: 'Details & evidence'});
  await detailButton.click();
  await expect(dialog.getByRole('heading', {name: 'Facts & observations'})).toBeVisible();
  await expect(dialog.getByRole('heading', {name: 'User evaluations'})).toBeVisible();
  expect(await dialog.locator('.dialog-layer').evaluateAll(layers => layers.map(layer => layer.classList[1])))
    .toEqual(['fact-layer', 'claim-layer', 'evaluation-layer']);
  /* The split is a split: what people said about the entry is not filed under what was observed. */
  await expect(dialog.locator('.fact-layer [data-like-tool], .fact-layer [data-review-tool]')).toHaveCount(0);
  await expect(dialog.locator('.evaluation-layer [data-like-tool]')).toHaveCount(1);
  await expect(dialog.locator('.evaluation-layer [data-review-tool]')).toHaveCount(1);

  /* Official information is reachable without leaving the page, and what it shows is the string the
     primary source published -- not a URL built out of the name. `.invalid` hosts were what this
     asserted before: generated addresses that only ever existed for `provenance: 'sample'` entries.
     Every collected entry's link is checked against the value data.js holds for it. */
  for (const [type, label] of [['site', 'Official site'], ['distribution', 'Distribution'], ['source', 'Source']]) {
    const control = dialog.locator(`.resource-link[data-resource-type="${type}"]`);
    await expect(control).toHaveCount(1);
    await control.click();
    await expect(dialog).toContainText({site: subject.homepage, distribution: subject.distribution, source: subject.sourceRepo}[type]);
    await expect(dialog).toContainText('Last checked');
    await expect(dialog).toContainText(subject.observed);
    await page.keyboard.press('Escape');
    /* Closing the link detail returns to where it was opened from -- the card's detail button, which
       is the opener the dialog stack recorded. */
    await expect(detailButton).toBeFocused();
    await detailButton.click();
  }

  /* Evidence for a claim is reachable, and it carries the two things that make it evidence rather
     than a badge: the verbatim line the source published, and the primary NIP source it resolves to
     in the pinned snapshot. */
  const nipByNumber = Object.fromEntries(data.nipCatalog.map(nip => [nip.number, nip]));
  const claim = (subject.capabilities || []).find(record =>
    record.family === data.registry.family && record.registryStatus === 'resolved' && nipByNumber[record.id]?.source);
  const chip = dialog.locator(`.nip-tag-button[data-evidence-nip="${claim.key}"]`);
  await expect(chip).toHaveCount(1);
  await chip.click();
  await expect(dialog).toContainText('Verbatim source line');
  await expect(dialog.locator('.source-text')).toHaveText(claim.sourceText);
  await expect(dialog.getByRole('link', {name: 'Official NIP source'})).toHaveAttribute('href', nipByNumber[claim.id].source);
  await expect(dialog).toContainText(claim.registryTitle);
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

/* 比較表が一つの機能行の上に並べる三つの答えを、カタログから引いた三つのエントリで作る
   (§21.3 R3)。`tool-2` / `tool-4` / `tool-5` はサンプル入口の id で、収集した41件には無い。
     - 主張を一つも持たない行           -> unknown。記録が無いこと自体が答えで、空欄でも否定でもない
     - 主張はあるが NIP ファミリに無い行 -> out_of_family (case 1)。unknown とも否定とも別の第三の答え
     - その NIP について結果を名乗る行   -> 名乗った結果そのもの
   証拠ボタンが出るのは三つめだけ。記録の無い欄に証拠は無い。 */
function comparisonSubjects(data) {
  const nipClaims = tool => (tool.capabilities || []).filter(record => record.family === data.registry.family);
  const claimless = data.tools.find(tool => !(tool.capabilities || []).length);
  const otherFamily = data.tools.find(tool => (tool.capabilities || []).length && !nipClaims(tool).length);
  const stated = data.tools.find(tool => nipClaims(tool).some(record => data.resultPrecedence.includes(record.result)));
  expect(claimless, 'catalogue has an entry that claims nothing').toBeTruthy();
  expect(otherFamily, 'catalogue has an entry whose claims are all outside the NIP family').toBeTruthy();
  expect(stated, 'catalogue has an entry stating a result against a NIP').toBeTruthy();
  const claim = nipClaims(stated).find(record => data.resultPrecedence.includes(record.result));
  return {claimless, otherFamily, stated, claim};
}

test('comparison distinguishes no record from explicit unknown and evidence follows the aggregate record', async ({page}) => {
  const errors = collectErrors(page);
  const data = catalogueData();
  const {claimless, otherFamily, stated, claim} = comparisonSubjects(data);
  const supportLabel = value => page.evaluate(name => window.NOSMAPS_I18N.t(`support.${name}`), value);
  await page.goto('nip-explorer.html');
  /* 選んだ順が候補の並び順になる。 */
  const candidates = [[claimless, 'unknown'], [otherFamily, 'out_of_family'], [stated, claim.result]];
  for (const [tool] of candidates) await page.locator(`[data-compare-tool="${tool.id}"]`).check();
  await page.getByRole('button', {name: 'Compare features'}).click();

  /* 機能の名前も行の位置も書かない。集約した主張は証拠ボタンが data-evidence-nip として
     名乗り、その値は data.js の claim.key そのものなので、それで行を引く。 */
  const statedValues = page.locator('.comparison-value').filter({has: page.locator(`[data-evidence-nip="${claim.key}"]`)});
  expect(await statedValues.count(), `${claim.key} is aggregated into at least one feature row`).toBeGreaterThan(0);
  /* その主張で答えた行は、どれも data.js が言うその結果を出している。 */
  expect([...new Set(await statedValues.evaluateAll(nodes => nodes.map(node => node.dataset.support)))]).toEqual([claim.result]);

  const row = page.locator('.comparison-item').filter({has: page.locator(`[data-evidence-nip="${claim.key}"]`)}).first();
  const values = row.locator('.comparison-value');
  await expect(values).toHaveCount(candidates.length);
  const badges = [];
  for (const [index, [tool, support]] of candidates.entries()) {
    const value = values.nth(index);
    await expect(value, tool.id).toHaveAttribute('data-support', support);
    const badge = await supportLabel(support);
    expect(badge, `${support} is a real label`).toBeTruthy();
    await expect(value.locator('.support-badge'), tool.id).toHaveText(badge);
    await expect(value.locator('.comparison-evidence'), tool.id).toHaveCount(support === claim.result ? 1 : 0);
    badges.push(badge);
  }
  /* 三つとも別の答えだと名乗っている。 */
  expect(new Set(badges).size, 'the three answers read differently').toBe(candidates.length);

  /* 証拠は集約した主張そのものに従う: NIP 番号、名乗った結果、そして出典の一行。 */
  await values.nth(2).locator('.comparison-evidence').click();
  const dialog = page.locator('#evidence-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#compare-dialog')).toBeVisible();
  await expect(dialog).toContainText(`${claim.family.toUpperCase()}-${claim.id}`);
  await expect(dialog.locator('.support-badge')).toHaveText(await supportLabel(claim.result));
  await expect(dialog.locator('.source-text')).toHaveText(claim.sourceText);
  expect(errors).toEqual([]);
});

/* issue #8: このテストは元々「seeded image が local image を上書きする」を固定していた。
   プリセット画像の選択盤はモック時代の残骸として撤去されたので、上書きの主張も一緒に取り下げる。
   残る保証 -- 下書きの各欄と端末からの添付画像が言語切り替えを越えて生き残ること、そして
   選択盤がどこにも無いこと -- は tests/review-local-image.spec.js へ移した。 */

/* 表示上限そのものはここに書かない -- 観測する。カタログの末尾から一件ずつレビューを書き、
   そのたびに履歴を読む。上限に届くまでは「今書いた行」が必ず履歴に居る (= 収集はカタログの
   端まで届いている)。増えなくなったところが上限で、そのとき残っているのは「全部集めてから
   切った」もの -- カタログ順の先頭から count 件 -- でなければならない。tool ごとに切って
   いたら、最初に書いた末尾のエントリの一件が最初から見えない。

   `NsecVault` / `tool-9` はサンプル入口の名前と id で、41件の収集レコードには無い。 */
test('reviewer history gathers reviews from every tool before applying its display limit', async ({page}) => {
  const errors = collectErrors(page);
  const data = catalogueData();
  await page.goto('nip-explorer.html');
  const written = [];
  let limited = 0;
  for (const tool of [...data.tools].reverse()) {
    const body = `History probe ${written.length + 1}`;
    await openReviews(page, tool.id);
    await addReview(page, {body});
    await page.locator('#review-dialog .review-item').filter({hasText: body}).locator('[data-reviewer="local"]').click();
    await expect(page.locator('#profile-dialog')).toBeVisible();
    written.push({tool, body});
    const gathered = data.tools.flatMap(candidate => written.filter(item => item.tool === candidate));
    const names = await page.locator('#profile-dialog .profile-history article strong').allTextContents();
    const bodies = await page.locator('#profile-dialog .profile-history article p').allTextContents();
    const where = `history after ${written.length} reviews`;
    expect(names, where).toEqual(gathered.slice(0, names.length).map(item => item.tool.name));
    expect(bodies, where).toEqual(gathered.slice(0, names.length).map(item => item.body));
    if (names.length < written.length) { limited = names.length; break; }
    expect(names, where).toEqual(gathered.map(item => item.tool.name));
    await closeAllDialogs(page);
  }
  expect(limited, 'the history applies a display limit to what it gathered').toBeGreaterThan(0);
  expect(limited).toBeLessThan(written.length);
  await expect(page.locator('#profile-dialog .profile-history article')).toHaveCount(limited);
  expect(errors).toEqual([]);
});

test('likes, bookmarks, text/image reviews, profiles, history, gallery, and image return work', async ({page}) => {
  const errors = collectErrors(page);
  const data = catalogueData();
  await page.goto('nip-explorer.html');
  const dialog = page.locator('#evidence-dialog');
  await openDetail(page, data.tools[0].id);
  /* issue #20: いいねの数は「観測できた kind 7 の件数」そのもので、押したことでは動かないし、
     署名できない読み手は押せないと名乗る。押せば数字が変わることを期待していたのは、数を id の
     連番から作っていたサンプル時代の版。数え方そのものの保証は tests/reactions.spec.js が持つ。 */
  const like = dialog.locator('[data-like-tool]');
  await expect(like).toBeDisabled();
  await expect(like).toHaveAttribute('data-like-blocked', 'blocked');
  await dialog.locator('[data-bookmark-tool]').click();
  await expect(dialog.locator('[data-bookmark-tool]')).toHaveAttribute('aria-pressed', 'true');
  await dialog.locator('[data-review-tool]').click();
  await expect(page.locator('#review-dialog')).toBeVisible();
  /* 件数は書いた回数から出す。5 / 6 / 5 はサンプル入口の seedReviews が作っていた数。 */
  const reviews = page.locator('#review-dialog .review-item');
  await expect(reviews).toHaveCount(0);
  await addReview(page, {body: 'Text-only review'});
  await expect(reviews).toHaveCount(1);
  /* issue #8: 画像付きレビューの画像は、プリセットではなく自分で添付したものだけになった。 */
  const attached = ['Review with an attached image'];
  for (const body of attached) await addReview(page, {body, image: true});
  await expect(reviews).toHaveCount(1 + attached.length);
  await reviews.first().locator('[data-review-vote="helpful"]').click();
  await reviews.first().locator('[data-reviewer]').click();
  await expect(page.locator('#profile-dialog')).toContainText('Review and vote history');
  await expect(page.locator('#profile-dialog [data-review-jump]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#profile-dialog')).toBeHidden();
  /* ギャラリーの入口はレビューダイアログの道具立て。並ぶのは添付した画像の数だけ。 */
  await page.locator('#review-dialog [data-gallery-tool]').click();
  await expect(page.locator('.gallery-card')).toHaveCount(attached.length);
  const galleryScroll = await page.locator('#gallery-content').evaluate(element => element.scrollTop);
  await page.locator('.gallery-card').first().getByRole('button', {name: 'Enlarge'}).click();
  await expect(page.locator('#image-dialog')).toBeVisible();
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
    /* issue #6 / c15fafd: サムネイルの帯もカードから詳細ダイアログへ移った。占有率の保証も
       一緒に移る -- 帯は詳細のごく一部で、一枚一枚は 4:3 のまま、3枚を超えた分は「+N」に
       畳まれる。カタログはレビュー画像を一枚も持たない（観測していない）ので、枚数はこの場で
       添付した数から出す。 */
    const subject = await page.locator('.feature-tool-card').first().getAttribute('data-tool-id');
    const attached = ['first', 'second', 'third', 'fourth'];
    await openReviews(page, subject);
    for (const name of attached) await addReview(page, {body: `Attached ${name}`, image: true});
    /* 書いたあとの詳細を開き直して読む。レビューの投稿は開いているレビューダイアログだけを
       描き直すので、その後ろに残っている詳細は投稿前のままになっている。 */
    await closeAllDialogs(page);
    await openDetail(page, subject);
    const thumbs = page.locator('#evidence-dialog .card-review-thumbnail');
    await expect(thumbs).toHaveCount(3);
    await expect(page.locator('#evidence-dialog .card-review-more')).toHaveText(`+${attached.length - 3}`);
    const dimensions = await thumbs.evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return [box.width, box.height]; }));
    for (const [width, height] of dimensions) expect(width / height).toBeCloseTo(4 / 3, 1);
    const occupancy = await page.locator('#evidence-content').evaluate(content => content.querySelector('.card-review-thumbnails').getBoundingClientRect().height / content.getBoundingClientRect().height);
    expect(occupancy).toBeLessThan(0.2);
    await expectNoOverflow(page);
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
    const subject = await page.locator('.feature-tool-card').first().getAttribute('data-tool-id');
    await openReviews(page, subject);
    await expectNoOverflow(page);
    /* ギャラリーは画像が並んで初めて幅を試せる。カタログは観測したレビュー画像を持たないので、
       一枚添付してから開く。入口はレビューダイアログの道具立て（カードの「+N」ではない）。 */
    await addReview(page, {body: 'Attached for the gallery', image: true});
    await page.locator('#review-dialog [data-gallery-tool]').click();
    await expect(page.locator('.gallery-card')).toHaveCount(1);
    await expectNoOverflow(page);
    expect(errors).toEqual([]);
  });
});
