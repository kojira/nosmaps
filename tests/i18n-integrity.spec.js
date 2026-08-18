/* Guards the class of bug where a missing translation key is stringified into the page: the
   lookup returns nothing, String() turns it into the word "undefined", and the page renders that
   with no exception and no console error. Two assertions per page and language: nothing we render
   contains the literal "undefined", and the i18n layer reported no missing key at all. */
const {test, expect} = require('@playwright/test');

const PAGES = ['index.html', 'nip-explorer.html'];
const LANGUAGES = [{code: 'ja', button: '日本語'}, {code: 'en', button: 'English'}];

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

function scanForUndefined(page) {
  return page.evaluate(() => {
    const text = (document.body.innerText || '').split('\n').map((line, number) => ({number, line}))
      .filter(entry => entry.line.includes('undefined'))
      .map(entry => `innerText line ${entry.number}: ${entry.line.trim()}`);
    const attributes = [];
    for (const element of document.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        if (String(attribute.value).includes('undefined')) {
          attributes.push(`${element.tagName.toLowerCase()}[${attribute.name}]="${attribute.value.slice(0, 160)}"`);
        }
      }
    }
    if ((document.title || '').includes('undefined')) attributes.push(`<title>="${document.title}"`);
    return {text, attributes: [...new Set(attributes)]};
  });
}

function missingKeys(page) {
  /* Tolerates an i18n build without the reporting contract, so a page that silently renders
     "undefined" fails on the scan below rather than blowing up here. */
  return page.evaluate(() => (window.NOSMAPS_I18N.missing || []).map(entry => `${entry.detail}: ${entry.path} (${entry.language})`));
}

for (const path of PAGES) {
  for (const language of LANGUAGES) {
    test(`${path} renders no "undefined" and reports no missing key in ${language.code}`, async ({page}) => {
      const errors = collectErrors(page);
      await page.goto(path);
      await page.getByRole('button', {name: language.button}).first().click();
      await expect(page.locator('html')).toHaveAttribute('lang', language.code);
      await page.waitForTimeout(500);

      expect(await missingKeys(page), `${path} / ${language.code}: missing translation keys`).toEqual([]);
      const found = await scanForUndefined(page);
      expect(found.text, `${path} / ${language.code}: "undefined" in rendered text`).toEqual([]);
      expect(found.attributes, `${path} / ${language.code}: "undefined" in rendered attributes`).toEqual([]);
      expect(errors, `${path} / ${language.code}: console/page errors`).toEqual([]);
    });
  }
}

test('a missing key is reported and never rendered as "undefined"', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');

  const rendered = await page.evaluate(() => {
    const i18n = window.NOSMAPS_I18N;
    return {
      t: i18n.t('landing.thisKeyDoesNotExist'),
      formatted: i18n.t('landing.alsoMissing', {name: 'x'}),
      has: i18n.has('landing.thisKeyDoesNotExist'),
      hasReal: i18n.has('landing.headline'),
      value: i18n.value('landing.thisKeyDoesNotExist'),
      reported: i18n.missing.map(entry => entry.path)
    };
  });

  expect(rendered.t).toBe('landing.thisKeyDoesNotExist');
  expect(rendered.formatted).toBe('landing.alsoMissing');
  expect(String(rendered.t)).not.toContain('undefined');
  expect(rendered.has).toBe(false);
  expect(rendered.hasReal).toBe(true);
  expect(rendered.value).toBeUndefined();
  expect(rendered.reported).toContain('landing.thisKeyDoesNotExist');
  expect(rendered.reported).toContain('landing.alsoMissing');
  /* The probe above is deliberate, so it must be the only thing that logged. */
  expect(errors.filter(entry => !entry.includes('landing.thisKeyDoesNotExist') && !entry.includes('landing.alsoMissing'))).toEqual([]);
  expect(errors).toHaveLength(2);
});
