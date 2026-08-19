/* What nip-explorer.html actually loads and renders, measured in a real browser.

   Every number printed here is read off the loaded page; nothing is assumed.
   Run: node tools/probe-explorer.mjs   (needs the static server on 4173) */
import {chromium} from '@playwright/test';

const BASE = process.env.NOSMAPS_BASE_URL || 'http://127.0.0.1:4173/';
const PAGE = process.env.NOSMAPS_PAGE || 'nip-explorer.html';

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
const pageErrors = [];
const scripts = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => pageErrors.push(String(error)));
page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });

await page.goto(new URL(PAGE, BASE).href);
await page.waitForSelector('.feature-tool-card');

const measured = await page.evaluate(() => ({
  cards: document.querySelectorAll('.feature-tool-card').length,
  /* The handoff's "82 badges" is this selector: 41 cards each carrying the
     data-record-state attribute AND the rendered .record-state span. Both halves
     are reported so the number cannot be read as 82 cards. */
  recordStateBadges: document.querySelectorAll('[data-record-state], .record-state').length,
  recordStateAttributes: document.querySelectorAll('[data-record-state]').length,
  recordStateSpans: document.querySelectorAll('.record-state').length,
  i18nPresent: typeof window.NOSMAPS_I18N === 'object' && window.NOSMAPS_I18N !== null,
  i18nMissing: (window.NOSMAPS_I18N?.missing ?? []).length,
  undefinedText: document.body.innerText.includes('undefined'),
  coordinateOnScreen: /30078:[0-9a-f]{64}:/.test(document.body.innerText),
  resultCount: (document.querySelector('#result-count')?.textContent ?? '').trim()
}));

await browser.close();

const loaded = scripts.map(url => url.replace(new URL(BASE).origin + '/', ''));
process.stdout.write(`page: ${PAGE}\n`);
process.stdout.write(`loaded scripts: ${JSON.stringify(loaded)}\n`);
process.stdout.write(`cards: ${measured.cards}\n`);
process.stdout.write(`record-state badges ([data-record-state], .record-state): ${measured.recordStateBadges} (${measured.recordStateAttributes} attributes + ${measured.recordStateSpans} spans)\n`);
process.stdout.write(`result count text: ${JSON.stringify(measured.resultCount)}\n`);
process.stdout.write(`consoleErrors: ${JSON.stringify(consoleErrors)}\n`);
process.stdout.write(`pageErrors: ${JSON.stringify(pageErrors)}\n`);
process.stdout.write(`window.NOSMAPS_I18N present: ${measured.i18nPresent}\n`);
process.stdout.write(`i18n missing keys reported: ${measured.i18nMissing}\n`);
process.stdout.write(`the text "undefined" on screen: ${measured.undefinedText}\n`);
process.stdout.write(`a coordinate on a reader-facing surface: ${measured.coordinateOnScreen}\n`);
