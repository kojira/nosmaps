/* issue #6 and issue #2.

   #6: the collapsed explorer card had grown into a dossier -- facts grid, official links, capability
   chips, claim summary, liveness, likes, bookmarks, review thumbnails -- and measured a median 552px
   tall at 375x812, so barely one card fitted in a screen's worth of list and the list could not be
   scanned. The card now carries only the fields every one of the 41 collected records actually holds
   (name, the topics it published, its one-line summary, the id that identifies it) and the detail
   moved behind the Details & evidence button. These tests pin both halves: the card exposes exactly
   that set and nothing else, the detail is one press away and still carries what left the card, and
   the height/fit numbers show the density actually improved.

   #2: a carousel item on the top page was inert. It is now a link to the explorer opened on that
   entry, and these tests pin that it lands on *that* entry rather than merely on the explorer. */
const {test, expect} = require('@playwright/test');

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
      return {
        id: tool.id,
        children: [...card.children].map(element => element.className),
        /* The one record whose summary is absent keeps the `is-unknown` marker: an absent summary
           is stated as absent, it is not quietly filled and it is not quietly dropped. */
        expectedChildren: ['card-headline', tool.summaryAbsent ? 'tool-summary is-unknown' : 'tool-summary', 'card-topics', 'nip-card-actions'],
        actual: card.innerText.split('\n').map(line => line.trim()).filter(Boolean),
        expected: [
          tool.name,
          tool.id,
          tool.summaryAbsent ? i18n.t('explorer.summaryAbsent') : tool.summary,
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

  test('a collapsed card exposes only name, id, one-line summary and topics, and the detail is one press away', async ({page}) => {
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
      }
    }

    // 2. Nothing that moved behind the detail view is still printed on a card.
    for (const selector of [
      '.tool-facts', '.card-layer', '.fact-layer', '.evaluation-layer', '.resource-links', '.basis-nips',
      '.claim-summary', '.liveness-block', '.provenance-badge', '.record-state', '.card-review-thumbnails',
      '[data-like-tool]', '[data-bookmark-tool]', '[data-review-tool]', '[data-resource-tool]', '[data-evidence-tool]'
    ]) {
      await expect(page.locator(`#tool-results .feature-tool-card ${selector}`), selector).toHaveCount(0);
    }

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
    for (const label of ['ライセンス', 'OS／環境', '最終観測', 'カテゴリ', '座標', '一次情報', '対応主張', '利用者評価']) {
      await expect(dialog, label).toContainText(label);
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
