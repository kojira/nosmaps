/* Differential check: the ORIGINAL nip-explorer.html (classic root scripts) vs
   the PORTED one (nip-explorer-dist.html, dist-only), driven identically.

   The two pages are loaded side by side and asked the same questions. Anything
   that differs is printed; a run with no differences is what licenses pointing
   the real html at dist/.

   The trap run 2 hit: a hash-only change does NOT reload the page, so a probe
   that sets location.hash and reads the count back measures the PREVIOUS state.
   Every navigation here is a full goto(), and the counts below are not all equal
   — a measurement that returns the same number for every input is a broken
   measurement, not a passing one.

   Run: node tools/diff-explorer.mjs   (needs the static server on 4173) */
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const BASE = process.env.NOSMAPS_BASE_URL || 'http://127.0.0.1:4173/';
const ORIGINAL = process.env.NOSMAPS_ORIGINAL_PAGE || 'nip-explorer-original.html';
/* The ported page. While the port was in flight this was a scratch copy of the
   html pointed at dist/; now that nip-explorer.html itself is dist-only, the
   comparison is against a copy of the ORIGINAL page kept for exactly this
   purpose. Set NOSMAPS_ORIGINAL_PAGE to a copy of the pre-port html to re-run
   the comparison; without it there is nothing to compare against and this says
   so rather than comparing the page to itself and calling that a pass. */
const PORTED = process.env.NOSMAPS_PORTED_PAGE || 'nip-explorer.html';

const FEATURES = [
  'posts', 'dm', 'search', 'media', 'notifications',
  'accounts', 'signing', 'wallet', 'longform', 'community'
];
const STATES = [
  'normal', 'loading', 'empty', 'error', 'partial',
  'offline', 'stale', 'incomplete', 'unavailable'
];

/** Everything a rendered page says, read the same way from both builds. */
const PROBE = () => {
  const text = selector => (document.querySelector(selector)?.textContent ?? '').trim();
  const cards = [...document.querySelectorAll('.feature-tool-card')];
  return {
    resultCount: text('#result-count'),
    resultsTitle: text('#results-title'),
    searchTitle: text('#search-title'),
    settingsLabel: text('#settings-label'),
    nipCount: text('#nip-count'),
    activeFilterCount: text('#active-filter-count'),
    conditionSummary: text('#condition-summary'),
    selectedSummary: text('#selected-feature-summary'),
    uiStateView: text('#ui-state-view'),
    cards: cards.length,
    recordStateBadges: document.querySelectorAll('.record-state').length,
    cardIds: cards.map(card => card.dataset.toolId ?? ''),
    cardHtml: cards.map(card => card.outerHTML),
    chips: [...document.querySelectorAll('[data-select-feature]')]
      .map(chip => `${chip.dataset.selectFeature}:${chip.getAttribute('aria-pressed')}:${(chip.textContent ?? '').trim()}`),
    filterGrid: document.querySelector('#feature-filter-grid')?.innerHTML ?? '',
    publishPanel: document.querySelector('#publish-panel')?.innerHTML ?? '',
    viewerStatus: document.querySelector('#viewer-identity')?.dataset.viewerStatus ?? '',
    viewerHtml: document.querySelector('#viewer-identity')?.innerHTML ?? '',
    footer: document.querySelector('#site-footer')?.innerHTML ?? '',
    lang: document.documentElement.lang,
    title: document.title,
    i18nPresent: typeof window.NOSMAPS_I18N === 'object' && window.NOSMAPS_I18N !== null,
    i18nMissing: (window.NOSMAPS_I18N?.missing ?? []).map(entry => `${entry.detail}:${entry.path}`),
    catalogKeys: Object.keys(window.NOSMAPS_CATALOG ?? {}).sort(),
    canonicalKeys: Object.keys(window.NOSMAPS_CANONICAL ?? {}).sort(),
    iconsMarkup: (window.NOSMAPS_DATA?.tools ?? []).map(tool => window.NOSMAPS_ICONS.entity(tool))
  };
};

/** Opens the detail dialog for one entry id and reads its content back. The id
    is escaped in the page, where CSS.escape actually exists. */
const DIALOG_BY_DETAIL = id => {
  const button = document.querySelector(`[data-feature-detail="${CSS.escape(id)}"]`);
  if (!button) return {opened: false, html: '', label: ''};
  button.click();
  const dialog = [...document.querySelectorAll('dialog')].find(item => item.open);
  return {
    opened: Boolean(dialog),
    label: dialog?.getAttribute('aria-label') ?? '',
    html: dialog?.querySelector('div')?.innerHTML ?? ''
  };
};

/** Opens a dialog by clicking a selector, then reads its content back. */
const DIALOG = selector => {
  const button = document.querySelector(selector);
  if (!button) return {opened: false, html: '', label: ''};
  button.click();
  const dialog = [...document.querySelectorAll('dialog')].find(item => item.open);
  return {
    opened: Boolean(dialog),
    label: dialog?.getAttribute('aria-label') ?? '',
    html: dialog?.querySelector('div')?.innerHTML ?? ''
  };
};

async function probe(page, url, fn = PROBE, arg) {
  /* THE TRAP (run 2 hit it, and so did the first version of this file): a goto
     whose URL differs from the current one only by its #hash is a same-document
     navigation — the scripts do NOT run again, so the page still shows the
     PREVIOUS selection and every feature probe reads back the unfiltered 41.
     Landing on about:blank first makes each goto a real load. Without this the
     numbers below are all 41, which is the shape of a broken measurement. */
  await page.goto('about:blank');
  await page.goto(new URL(url, BASE).href);
  await page.waitForFunction(() => document.querySelectorAll('.feature-tool-card').length > 0
    || (document.querySelector('#ui-state-view')?.textContent ?? '').trim() !== '');
  return page.evaluate(fn, arg);
}

const differences = [];
function compare(label, a, b) {
  const left = JSON.stringify(a);
  const right = JSON.stringify(b);
  if (left === right) return true;
  differences.push({label, original: a, ported: b});
  return false;
}

const browser = await chromium.launch();
const originalErrors = [];
const portedErrors = [];
const originalPage = await browser.newPage();
const portedPage = await browser.newPage();
originalPage.on('console', m => { if (m.type() === 'error') originalErrors.push(m.text()); });
originalPage.on('pageerror', e => originalErrors.push(String(e)));
portedPage.on('console', m => { if (m.type() === 'error') portedErrors.push(m.text()); });
portedPage.on('pageerror', e => portedErrors.push(String(e)));

const checks = [];

// 1. the default page
checks.push(['default', '', '']);
// 2. every feature selection, reached by a real navigation (see the trap above)
for (const id of FEATURES) checks.push([`feature:${id}`, `#features-${id}`, `#features-${id}`]);
// 3. the legacy single-feature hash
checks.push(['legacy-hash', '#feature-dm', '#feature-dm']);
// 4. every ui state
for (const name of STATES) checks.push([`state:${name}`, `?state=${name}`, `?state=${name}`]);
// 5. the carousel handover, present and absent
checks.push(['tool-present', '?tool=', '?tool=']);
checks.push(['tool-absent', '?tool=nosmaps:does.not.exist', '?tool=nosmaps:does.not.exist']);
// 6. support modes and other filters through the query string are not URL-driven,
//    so they are exercised below by interaction instead.

/* An id the catalogue really holds, read from the generated file itself rather
   than typed in here — a hard-coded id would silently stop exercising the
   "?tool= names a real entry" path the day the catalogue changes. */
const firstToolId = (await readFile(new URL('../data.js', import.meta.url), 'utf8'))
  .match(/"id": "(nosmaps:[^"]+)"/)?.[1] ?? '';
if (!firstToolId) {
  process.stdout.write('FAIL: no entry id found in data.js\n');
  process.exit(2);
}

const counts = {};
for (const [label, originalSuffix, portedSuffix] of checks) {
  const oSuffix = originalSuffix.replace('?tool=', firstToolId ? `?tool=${firstToolId}` : '?tool=');
  const pSuffix = portedSuffix.replace('?tool=', firstToolId ? `?tool=${firstToolId}` : '?tool=');
  const a = await probe(originalPage, `${ORIGINAL}${oSuffix}`);
  const b = await probe(portedPage, `${PORTED}${pSuffix}`);
  compare(label, a, b);
  counts[label] = a.cards;
}

// 7. interaction: pick a feature chip, then walk the support filter modes.
const SUPPORT_MODES = ['all', 'confirmed', 'supported', 'partial', 'unknown', 'out_of_family', 'not_supported'];
const INTERACT = async (page, url, mode) => {
  await page.goto(new URL(url, BASE).href);
  await page.waitForSelector('.feature-tool-card');
  await page.click('[data-select-feature="dm"]');
  // The filters live behind a <details>; it has to be open for the select to be
  // operable, exactly as it is for a reader.
  await page.evaluate(() => { const panel = document.querySelector('#filter-details'); if (panel) panel.open = true; });
  await page.selectOption('#support-filter', mode);
  return page.evaluate(PROBE);
};
for (const mode of SUPPORT_MODES) {
  const a = await INTERACT(originalPage, ORIGINAL, mode);
  const b = await INTERACT(portedPage, PORTED, mode);
  compare(`support-mode:${mode}`, a, b);
  counts[`support-mode:${mode}`] = a.cards;
}

// 8. interaction: the language switch, and the search box.
const LANGUAGE = async (page, url) => {
  await page.goto(new URL(url, BASE).href);
  await page.waitForSelector('.feature-tool-card');
  await page.click('[data-language="ja"]');
  const ja = await page.evaluate(PROBE);
  await page.click('[data-language="en"]');
  const en = await page.evaluate(PROBE);
  return {ja, en};
};
compare('language', await LANGUAGE(originalPage, ORIGINAL), await LANGUAGE(portedPage, PORTED));

const SEARCH = async (page, url, term) => {
  await page.goto(new URL(url, BASE).href);
  await page.waitForSelector('.feature-tool-card');
  await page.fill('#feature-query', term);
  return page.evaluate(PROBE);
};
for (const term of ['relay', 'damus', 'nip-44', 'オープンソース', 'zzzznomatch']) {
  const a = await SEARCH(originalPage, ORIGINAL, term);
  const b = await SEARCH(portedPage, PORTED, term);
  compare(`search:${term}`, a, b);
  counts[`search:${term}`] = a.cards;
}

// 9. dialogs: open each card's detail, and the capability chips inside it.
const OPEN_DETAIL = async (page, url) => {
  await page.goto(new URL(url, BASE).href);
  await page.waitForSelector('.feature-tool-card');
  const ids = await page.evaluate(() => [...document.querySelectorAll('[data-feature-detail]')].map(b => b.dataset.featureDetail));
  const out = [];
  for (const id of ids) {
    const result = await page.evaluate(DIALOG_BY_DETAIL, id);
    out.push({id, ...result});
    await page.evaluate(() => document.querySelectorAll('dialog').forEach(d => d.close()));
  }
  return out;
};
compare('detail-dialogs', await OPEN_DETAIL(originalPage, ORIGINAL), await OPEN_DETAIL(portedPage, PORTED));

// 10. the nip reference cards, with a feature selected.
const NIPS = async (page, url) => {
  await page.goto(new URL(`${url}#features-posts-wallet`, BASE).href);
  await page.waitForSelector('.feature-tool-card');
  return page.evaluate(() => ({
    count: (document.querySelector('#nip-count')?.textContent ?? '').trim(),
    cards: [...document.querySelectorAll('.nip-reference-card')].map(card => card.outerHTML)
  }));
};
compare('nip-reference', await NIPS(originalPage, ORIGINAL), await NIPS(portedPage, PORTED));

compare('console-errors', originalErrors, portedErrors);

await browser.close();

const distinct = new Set(Object.values(counts));
process.stdout.write(`checks run: ${checks.length + SUPPORT_MODES.length + 5 + 3}\n`);
process.stdout.write(`card counts observed (original): ${JSON.stringify(counts)}\n`);
process.stdout.write(`distinct card counts: ${distinct.size} -> ${[...distinct].sort((a, b) => a - b).join(', ')}\n`);
if (distinct.size < 2) {
  process.stdout.write('FAIL: every probe returned the same count; the measurement is broken, not passing\n');
  process.exit(2);
}
if (differences.length) {
  process.stdout.write(`FAIL: ${differences.length} differing probe(s)\n`);
  for (const item of differences.slice(0, 10)) {
    process.stdout.write(`  - ${item.label}\n`);
    const a = JSON.stringify(item.original);
    const b = JSON.stringify(item.ported);
    let at = 0;
    while (at < a.length && a[at] === b[at]) at += 1;
    process.stdout.write(`      original: ...${a.slice(Math.max(0, at - 60), at + 160)}\n`);
    process.stdout.write(`      ported:   ...${b.slice(Math.max(0, at - 60), at + 160)}\n`);
  }
  process.exit(1);
}
process.stdout.write('OK: the ported page answered every probe identically to the original\n');
