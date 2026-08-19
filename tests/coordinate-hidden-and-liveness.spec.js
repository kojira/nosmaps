/* issue #15.

   Four things a reader sees, pinned against the real catalogue rather than against literals.

   1. The coordinate (`30078:<pubkey>:nosmaps:<d>`) is internal bookkeeping. A reader never types,
      copies or compares it, so it is off the compact card and out of the reader-facing part of the
      detail dialog. The one place an identifier is still named is the publish form, where the
      author has to supply one; there it is called 識別子 / Identifier in both languages.

   2. 導出された生存状態 was a mouthful and the value was the constant `unknown` for all 41 records,
      so the sentence said nothing. It is now 生存確認 / Liveness check, and the derivation reads the
      evidence that actually exists: an entry whose `sources` record an HTTP 200 response for its
      homepage is reported as reachable, with the recorded URL and fetch date printed as the
      grounds. An entry with no such recorded observation stays `unknown` -- absent stays absent,
      and no observation is invented. NOTE: the issue also mentions a `via` tag naming the damus
      client. No record carries a `via` tag, so nothing here is built on one.

   3. 一次情報 was stamped on headings where it distinguished nothing. Collecting from primary
      sources is a standing premise of the catalogue, so the headings read 出典 / Sources.

   4. Whether an entry is still active was one press away for no reason. It is on the card now, in
      the slot the coordinate vacated, so the card is still the four fields c15fafd cut it to. */
const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {stubExternalImages} = require('./support/stub-external-images');

test.beforeEach(async ({context}) => { await stubExternalImages(context); });

const PHONE = {width: 375, height: 812};

function catalogueData() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
  const sandbox = {};
  new Function('window', source)(sandbox);
  return sandbox.NOSMAPS_DATA;
}

/** The same rule the page applies, evaluated here against data.js so the expectation is derived
    from the records rather than copied out of the implementation's output. */
function recordedReachableSource(tool) {
  const trim = (/** @type {string} */ value) => String(value).replace(/\/+$/, '');
  return (tool.sources || []).find(source => Boolean(source && source.url)
    && /\bHTTP 200\b/.test(String(source.what || ''))
    && ((source.fields || []).includes('homepage') || (tool.homepage && trim(source.url) === trim(tool.homepage)))) || null;
}

function collectErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test('no reader-facing surface prints a coordinate, and the card carries the record state instead', async ({page}) => {
  const errors = collectErrors(page);
  const data = catalogueData();
  await page.goto('nip-explorer.html');
  await expect(page.locator('.feature-tool-card').first()).toBeVisible();

  /* Every record's coordinate really does name the signing pubkey (504cad2), so a page that leaked
     one would be leaking a 64-hex key. Assert the coordinates exist before asserting their absence,
     so this cannot pass by there being nothing to find. */
  const coordinates = data.tools.map(tool => tool.coordinate).filter(Boolean);
  expect(coordinates.length).toBe(data.tools.length);

  for (const language of ['en', 'ja']) {
    await page.locator(`#compact-identity [data-language="${language}"]`).click();
    await expect(page.locator('.feature-tool-card').first()).toBeVisible();
    const body = await page.evaluate(() => document.body.innerText);
    expect(body, `${language} list prints no 30078 coordinate`).not.toContain('30078:');
    for (const coordinate of coordinates) expect(body, `${language} ${coordinate}`).not.toContain(coordinate);
    // The record state is on the card, read from the record and the live dictionary.
    const states = await page.locator('#tool-results .feature-tool-card .record-state').allTextContents();
    expect(states).toHaveLength(data.tools.length);
    const expected = await page.evaluate(ids => ids.map(id => String(window.NOSMAPS_I18N.t(`recordStates.${id}`))),
      data.tools.map(tool => tool.recordState));
    expect(states.map(text => text.trim())).toEqual(expected);
    for (const text of states) expect(text).not.toContain('undefined');
  }

  // ...and the dialog is clean too.
  await page.locator('#compact-identity [data-language="ja"]').click();
  await page.locator('#tool-results .feature-tool-card').first().locator('[data-feature-detail]').click();
  const dialog = page.locator('#evidence-dialog');
  await expect(dialog).toBeVisible();
  const dialogText = await dialog.innerText();
  expect(dialogText).not.toContain('30078:');
  expect(dialogText).not.toContain('座標');
  expect(dialogText).not.toContain('undefined');
  await page.keyboard.press('Escape');

  expect(errors).toEqual([]);
});

test('the publish form is where an identifier is named, and it is called 識別子 / Identifier', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  await expect(page.locator('.feature-tool-card').first()).toBeVisible();

  for (const [language, word] of [['ja', '識別子'], ['en', 'Identifier']]) {
    await page.locator(`#compact-identity [data-language="${language}"]`).click();
    const label = await page.evaluate(() => String(window.NOSMAPS_I18N.t('explorer.publish.dLocal')));
    expect(label, `${language} publish identifier label`).toContain(word);
    expect(label).not.toContain('undefined');
    // Naming an identifier here is not naming a coordinate.
    expect(label).not.toContain('30078:');
  }
  expect(errors).toEqual([]);
});

test('生存確認 reports reachable exactly where a homepage response was recorded, and unknown elsewhere', async ({page}) => {
  const errors = collectErrors(page);
  const data = catalogueData();

  const reachable = data.tools.filter(tool => recordedReachableSource(tool));
  const silent = data.tools.filter(tool => !recordedReachableSource(tool));
  /* Both halves must be non-empty or this test proves nothing: a rule that says "reachable" for
     everything, and the old rule that said "unknown" for everything, would each pass one half. */
  expect(reachable.length, 'records with a recorded homepage response').toBeGreaterThan(0);
  expect(silent.length, 'records with no recorded homepage response').toBeGreaterThan(0);

  await page.goto('nip-explorer.html');
  await expect(page.locator('.feature-tool-card').first()).toBeVisible();
  const dialog = page.locator('#evidence-dialog');

  const heading = await page.evaluate(() => String(window.NOSMAPS_I18N.t('explorer.livenessDerived', {value: 'X'})));
  expect(heading).toContain('Liveness check');
  expect(heading).not.toContain('Derived liveness');

  const open = async (/** @type {string} */ id) => {
    await page.locator(`[data-tool-id="${id}"]`).locator('[data-feature-detail]').click();
    await expect(dialog).toBeVisible();
  };

  const witness = reachable[0];
  const source = recordedReachableSource(witness);
  await open(witness.id);
  await expect(dialog.locator('.liveness-derived')).toHaveAttribute('data-liveness', 'reachable');
  // The grounds are the recorded line: the URL that answered and the date it was fetched, verbatim.
  await expect(dialog.locator('.liveness-ground')).toContainText(String(source.url));
  await expect(dialog.locator('.liveness-ground')).toContainText(String(source.fetched));
  await expect(dialog.locator('.liveness-ground')).not.toContainText('undefined');
  await page.keyboard.press('Escape');

  const quiet = silent[0];
  await open(quiet.id);
  await expect(dialog.locator('.liveness-derived')).toHaveAttribute('data-liveness', 'unknown');
  // Nothing is claimed where nothing was recorded.
  await expect(dialog.locator('.liveness-ground')).toHaveCount(0);
  await page.keyboard.press('Escape');

  /* Every record, not just two: the rendered value equals the rule applied to the record, in both
     languages, and the printed label is a real word rather than the raw key or "undefined". */
  for (const language of ['en', 'ja']) {
    await page.locator(`#compact-identity [data-language="${language}"]`).click();
    for (const tool of [reachable[0], reachable[reachable.length - 1], silent[0], silent[silent.length - 1]]) {
      await open(tool.id);
      const expectedValue = recordedReachableSource(tool) ? 'reachable' : 'unknown';
      await expect(dialog.locator('.liveness-derived'), `${language} ${tool.id}`).toHaveAttribute('data-liveness', expectedValue);
      const label = await page.evaluate(value => String(window.NOSMAPS_I18N.t(`liveness.${value}`)), expectedValue);
      expect(label).not.toBe('undefined');
      expect(label.length).toBeGreaterThan(0);
      await expect(dialog.locator('.liveness-derived')).toContainText(label);
      await page.keyboard.press('Escape');
    }
  }
  expect(errors).toEqual([]);
});

test.describe('375x812', () => {
  test.use({viewport: PHONE});

  test('adding the record state to the card does not overflow 375 wide, in either language', async ({page}) => {
    const errors = collectErrors(page);
    const data = catalogueData();
    await page.goto('nip-explorer.html');
    await expect(page.locator('.feature-tool-card').first()).toBeVisible();

    for (const language of ['en', 'ja']) {
      await page.locator(`#compact-identity [data-language="${language}"]`).click();
      await expect(page.locator('#tool-results .feature-tool-card .record-state')).toHaveCount(data.tools.length);
      const [scrollWidth, clientWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(scrollWidth, `${language} horizontal overflow`).toBeLessThanOrEqual(Number(clientWidth));
      // No card is wider than the viewport either, badge included.
      const widest = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#tool-results .feature-tool-card')].map(card => card.getBoundingClientRect().right)));
      expect(widest, `${language} widest card right edge`).toBeLessThanOrEqual(PHONE.width);
    }
    expect(errors).toEqual([]);
  });
});
