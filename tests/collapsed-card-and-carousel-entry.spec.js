/* issue #6 and issue #2.

   #6: the collapsed explorer card had grown into a dossier -- facts grid, official links, capability
   chips, claim summary, liveness, likes, bookmarks, review thumbnails -- and measured a median 552px
   tall at 375x812, so barely one card fitted in a screen's worth of list and the list could not be
   scanned. The card now carries only the fields every one of the 41 collected records actually holds
   (name, the state of the record, its one-line description, the topics it published) and the detail
   moved behind the Details & evidence button. These tests pin both halves: the card exposes exactly
   that set and nothing else, the detail is one press away and still carries what left the card, and
   the height/fit numbers show the density actually improved.

   The two rows that changed since: the headline slot that used to print the coordinate now prints
   the record state (issue #15), and the one-line row is the description recorded for the language
   being read rather than the collected original (descriptions map, ecbb46b). Both are read out of
   the catalogue and the live dictionary below, never written down as literals.

   #2: a carousel item on the top page was inert. It is now a link to the explorer opened on that
   entry, and these tests pin that it lands on *that* entry rather than merely on the explorer. */
const {test, expect} = require('@playwright/test');
const {stubExternalImages} = require('./support/stub-external-images');

/* Icons in the catalogue point at ~25 real third-party hosts. Serve those bytes locally so a remote
   host having a bad day cannot turn this file red; the URLs themselves are untouched. See
   tests/support/stub-external-images.js. */
test.beforeEach(async ({context}) => { await stubExternalImages(context); });

const PHONE = {width: 375, height: 812};

/** @param {import('@playwright/test').Page} page */
function collectErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/* What a collapsed card must read as, built from data.js and the live dictionary rather than from
   literals, so a card that gained a field or invented a value fails instead of being described. */
/** @param {import('@playwright/test').Page} page */
function readCards(page) {
  return page.evaluate(() => {
    const i18n = window.NOSMAPS_I18N;
    const seeds = window.NOSMAPS_DATA.seedTopics;
    const label = (/** @type {string} */ topic) => seeds.includes(topic) ? String(/** @type {any} */ (i18n.value(`categories.${topic}`)).name) : topic;
    return [...document.querySelectorAll('#tool-results .feature-tool-card')].map(element => {
      const card = /** @type {HTMLElement} */ (element);
      const tool = window.NOSMAPS_DATA.tools.find(item => item.id === card.dataset['toolId']);
      if (!tool) throw new Error(`no catalogue record for ${card.dataset['toolId']}`);
      const topics = tool.topics || [];
      const recorded = tool.descriptions && tool.descriptions[i18n.language];
      const described = tool.summaryAbsent
        ? String(i18n.t('explorer.summaryAbsent'))
        : (typeof recorded === 'string' && recorded ? recorded : tool.summary);
      return {
        id: tool.id,
        /* Whatever branch produced it, the row is a real sentence: an absence is spelled out in
           words and nothing ever leaks the string `undefined` or a blank line. */
        described,
        children: [...card.children].map(element => element.className),
        /* The one record whose summary is absent keeps the `is-unknown` marker: an absent summary
           is stated as absent, it is not quietly filled and it is not quietly dropped. */
        expectedChildren: ['card-headline', tool.summaryAbsent ? 'tool-summary is-unknown' : 'tool-summary', 'card-topics', 'nip-card-actions'],
        actual: card.innerText.split('\n').map(line => line.trim()).filter(Boolean),
        expected: [
          tool.name,
          /* issue #15: the coordinate that used to occupy this slot is internal bookkeeping and was
             removed; the record state took its place because it is what a reader needs first. Read
             out of the record and the live dictionary, so a card that printed a state the record
             does not hold, or a raw key, fails here. */
          i18n.t(`recordStates.${tool.recordState}`),
          /* The one-line row is the description recorded for the language being read; a language
             with no recorded text falls back to the collected original (`summary`), which stays
             canonical. Derived from the record, so a card showing the other language's text, the
             original where a translation exists, or an invented sentence fails here. An absent
             original is still stated as absent in words. */
          described,
          ...(topics.length ? topics.map(label) : [`${i18n.t('explorer.category')}: ${i18n.t('unknown')}`]),
          i18n.t('explorer.compareAdd'),
          i18n.t('explorer.details')
        ]
      };
    });
  });
}

test.describe('375x812 collapsed card', () => {
  test.use({viewport: PHONE});

  test('a collapsed card exposes only name, record state, the one-line description in the language being read, and topics, and the detail is one press away', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto('nip-explorer.html');
    await expect(page.locator('.feature-tool-card').first()).toBeVisible();
    const total = await page.evaluate(() => window.NOSMAPS_DATA.tools.length);
    await expect(page.locator('.feature-tool-card')).toHaveCount(total);

    // 1. Every card is exactly the four field rows plus the action row, in both languages.
    for (const language of ['en', 'ja']) {
      await page.locator(`#compact-identity [data-language="${language}"]`).click();
      const rows = await readCards(page);
      expect(rows).toHaveLength(total);
      for (const row of rows) {
        expect(row.children, `${row.id} card structure`).toEqual(row.expectedChildren);
        expect(row.actual, `${row.id} card text`).toEqual(row.expected);
        /* Absent stays absent, but it is never blank and never the word `undefined`. */
        expect(row.described, `${row.id} description is a sentence`).toBeTruthy();
        expect(row.described, `${row.id} description is not undefined`).not.toBe('undefined');
      }
    }
    /* The rows above would also pass if every record fell back to the collected original, so pin
       that the recorded translations are actually being read: switching language changes the text
       of every record that has one recorded in both. */
    /** @type {Record<string, Record<string, string>>} */
    const perLanguage = {};
    for (const language of ['en', 'ja']) {
      await page.locator(`#compact-identity [data-language="${language}"]`).click();
      perLanguage[language] = Object.fromEntries((await readCards(page)).map(row => [row.id, row.described]));
    }
    const translated = await page.evaluate(() => window.NOSMAPS_DATA.tools
      .filter(tool => {
        const descriptions = tool.descriptions || {};
        return !tool.summaryAbsent && descriptions['en'] && descriptions['ja'] && descriptions['en'] !== descriptions['ja'];
      })
      .map(tool => tool.id));
    expect(translated.length, 'catalogue carries per-language descriptions').toBeGreaterThan(0);
    for (const id of translated) {
      expect(perLanguage['en']?.[id], `${id} reads differently per language`).not.toBe(perLanguage['ja']?.[id]);
    }

    // 2. Nothing that moved behind the detail view is still printed on a card.
    for (const selector of [
      '.tool-facts', '.card-layer', '.fact-layer', '.evaluation-layer', '.resource-links', '.basis-nips',
      '.claim-summary', '.liveness-block', '.provenance-badge', '.card-review-thumbnails',
      '[data-like-tool]', '[data-bookmark-tool]', '[data-review-tool]', '[data-resource-tool]', '[data-evidence-tool]',
      // issue #15: the coordinate is gone from the card entirely, element and all.
      '.tool-identifier'
    ]) {
      await expect(page.locator(`#tool-results .feature-tool-card ${selector}`), selector).toHaveCount(0);
    }
    /* `.record-state` left the list above rather than being quietly dropped: issue #15 put it back
       on the card, in the headline slot the coordinate used to occupy, so it is asserted present on
       every card here. Its text is pinned against the record and the dictionary in step 1, and
       tests/coordinate-hidden-and-liveness.spec.js pins the same in both languages. */
    await expect(page.locator('#tool-results .feature-tool-card .card-headline .record-state')).toHaveCount(total);

    // 3. Density. Before this change the median card was 552px and one card filled the screen.
    const density = await page.evaluate(height => {
      const cards = [...document.querySelectorAll('#tool-results .feature-tool-card')].map(card => card.getBoundingClientRect());
      const heights = cards.map(box => box.height).sort((a, b) => a - b);
      const first = cards[0];
      if (!first || !heights.length) throw new Error('no cards rendered');
      const top = first.top;
      return {
        median: heights[Math.floor(heights.length / 2)] ?? 0,
        max: heights[heights.length - 1] ?? 0,
        fit: cards.filter(box => box.bottom - top <= height).length
      };
    }, PHONE.height);
    expect(density.median).toBeLessThanOrEqual(200);
    expect(density.max).toBeLessThanOrEqual(220);
    expect(density.fit).toBeGreaterThanOrEqual(4);

    // 4. No horizontal overflow at 375 wide.
    const [scrollWidth, clientWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scrollWidth).toBeLessThanOrEqual(Number(clientWidth));

    // 5. The detail is reachable from the collapsed card and still carries what left it.
    const card = page.locator('#tool-results .feature-tool-card').first();
    const name = await card.locator('h2').textContent();
    await card.getByRole('button', {name: '詳細・根拠'}).click();
    const dialog = page.locator('#evidence-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-label', String(name));
    /* issue #15: '座標' left this list because the coordinate is no longer shown to a reader, and
       '一次情報' became '出典' because collecting from primary sources is a standing premise rather
       than a per-heading claim. Both are asserted absent below rather than merely dropped. */
    for (const label of ['ライセンス', 'OS／環境', '最終観測', 'カテゴリ', '出典', '対応主張', '利用者評価']) {
      await expect(dialog, label).toContainText(label);
    }
    for (const gone of ['座標', '30078:']) {
      await expect(dialog, gone).not.toContainText(gone);
    }
    await expect(dialog.locator('.resource-links [data-resource-tool]').first()).toBeVisible();
    await expect(dialog.locator('[data-like-tool]')).toHaveCount(1);
    await expect(dialog.locator('[data-bookmark-tool]')).toHaveCount(1);
    await expect(dialog.locator('[data-review-tool]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    expect(errors).toEqual([]);
  });
});

test('activating a carousel item lands on that entry in the explorer', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  await expect(page.locator('.carousel-slide').first()).toBeVisible();
  // Hovering pauses the rotation, so the slide that is read is the slide that is clicked.
  await page.locator('#carousel').hover();

  const catalogue = await page.evaluate(() => window.NOSMAPS_DATA.tools.map(tool => ({id: tool.id, name: tool.name})));

  // The second entry, not the first: landing on "that entry" has to mean the one that was tapped.
  await page.getByRole('button', {name: 'Next item'}).click();
  const slide = page.locator('.carousel-slide:not([aria-hidden])');
  await expect(slide).toHaveCount(1);
  await expect(slide).toHaveAttribute('data-slide-index', '1');
  const target = catalogue[1];
  if (!target) throw new Error('the catalogue needs at least two entries for this test');
  await expect(slide.locator('.slide-name')).toHaveText(target.name);
  const link = slide.locator('.slide-link');
  await expect(link).toHaveAttribute('href', `nip-explorer.html?tool=${encodeURIComponent(target.id)}`);
  await expect(link).toHaveAttribute('tabindex', '0');

  await link.click();
  await page.waitForURL(url => url.pathname.endsWith('nip-explorer.html'));
  expect(new URL(page.url()).searchParams.get('tool')).toBe(target.id);

  // The explorer is standing on that entry: one row, and it is that row.
  await expect(page.locator('.feature-tool-card')).toHaveCount(1);
  await expect(page.locator('.feature-tool-card h2')).toHaveText(target.name);
  await expect(page.locator('.feature-tool-card')).toHaveAttribute('data-tool-id', target.id);
  await expect(page.locator('#result-count')).toHaveText('1');

  // It is a condition like any other, so it is named and it can be cleared.
  const pill = page.locator('#condition-summary [data-remove-condition="tool"]');
  await expect(pill).toContainText(target.name);
  await pill.click();
  await expect(page.locator('.feature-tool-card')).toHaveCount(catalogue.length);

  expect(errors).toEqual([]);
});

test('an unknown ?tool= id filters nothing away rather than emptying the list', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html?tool=nosmaps:does.not.exist');
  const total = await page.evaluate(() => window.NOSMAPS_DATA.tools.length);
  await expect(page.locator('.feature-tool-card')).toHaveCount(total);
  await expect(page.locator('#condition-summary [data-remove-condition="tool"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
