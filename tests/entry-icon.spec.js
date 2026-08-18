/* issue #3 — an entry's own icon on the explorer card and on the carousel slide.

   No URL is a literal here. Every one was requested in the probe recorded in icons-probe.md and is
   stored, with the markup that declared it, in tools/build-data.mjs; the generated `tool.icon` is
   what these tests read. A URL that gets invented, dropped or quietly rewritten fails here rather
   than being described.

   These tests do not stub the icon hosts. Request interception was tried and rejected on evidence:
   with `page.route` active, Chromium never delivers an <img> request whose filename is exactly
   `favicon.ico` to the handler and the load fails instead — seven of the recorded URLs are such a
   file, and without interception all seven load in both Chromium and WebKit. A stub would have
   reported a failure the page does not have. The one test that *wants* a failure turns interception
   on for exactly that reason. */
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

/* The catalogue split the way the UI has to split it: the entries that carry a verified icon URL
   and the entries that do not. Read from data.js, so the split is the data's and not this file's. */
/** @param {import('@playwright/test').Page} page */
function catalogue(page) {
  return page.evaluate(() => window.NOSMAPS_DATA.tools.map(tool => ({
    id: tool.id,
    name: tool.name,
    url: tool.icon ? tool.icon.url : null,
    source: tool.icon ? tool.icon.source : null,
    initial: [...String(tool.name || '').trim()][0]?.toLocaleUpperCase() ?? ''
  })));
}

/* (1) and (2) at once, and against the markup the page will draw rather than against the markup it
   happens to be showing: `entity()` is the single place both the card and the slide get their icon
   box from, so asking it directly pins the URL for all 41 entries without waiting on 24 hosts. */
test('the icon box is built from the recorded URL, and from nothing else', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  const tools = await catalogue(page);

  const withIcon = tools.filter(tool => tool.url);
  const without = tools.filter(tool => !tool.url);
  // Both branches are real; neither is dead code being asserted about.
  expect(withIcon.length).toBeGreaterThan(0);
  expect(without.length).toBeGreaterThan(0);
  expect(withIcon.length + without.length).toBe(tools.length);

  // Every recorded URL is absolute https and arrived with the markup source that declared it.
  for (const tool of withIcon) {
    expect(tool.url, tool.id).toMatch(/^https:\/\/\S+$/);
    expect(tool.source, `${tool.id} icon source`).toBeTruthy();
  }

  const built = await page.evaluate(() => window.NOSMAPS_DATA.tools.map(tool => window.NOSMAPS_ICONS.entity(tool)));
  built.forEach((markup, index) => {
    const tool = tools[index];
    if (!tool) throw new Error('catalogue and markup are the same length');
    expect(markup, `${tool.id} icon markup`).not.toMatch(/undefined|\[object/);
    if (tool.url) {
      // (1) a verified icon is an <img> at that exact URL, lazy, and carrying no text of its own.
      expect(markup, tool.id).toContain(`src="${tool.url}"`);
      expect(markup, tool.id).toContain('loading="lazy"');
      expect(markup, tool.id).toContain('alt=""');
      expect(markup.startsWith('<img '), `${tool.id} is an img`).toBe(true);
    } else {
      // (2) no verified icon is the placeholder, and it is not an img at all.
      expect(markup, tool.id).not.toContain('<img');
      expect(markup, tool.id).toContain('is-placeholder');
      expect(markup, tool.id).toContain(`data-entity-initial="${tool.initial}"`);
    }
  });

  // A record with no name still yields a box, and it says nothing rather than saying "undefined".
  const empty = await page.evaluate(() => [
    window.NOSMAPS_ICONS.entity(null),
    window.NOSMAPS_ICONS.entity(/** @type {any} */ ({id: 'x', name: '', icon: null}))
  ]);
  for (const markup of empty) {
    expect(markup).toContain('is-placeholder');
    expect(markup).toContain('data-entity-initial=""');
    expect(markup).not.toMatch(/undefined|\[object/);
  }

  expect(errors).toEqual([]);
});

/* The same two branches where they are actually rendered: every one of the 41 cards, in the DOM.
   Cards below the fold keep their <img> because the image is lazy and has not been asked for yet,
   so this reads what the card was built as. */
test('every card renders the box its record calls for, in the headline next to the name', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('nip-explorer.html');
  await expect(page.locator('.feature-tool-card').first()).toBeVisible();

  const tools = await catalogue(page);
  const rows = await page.evaluate(() => [...document.querySelectorAll('#tool-results .feature-tool-card')].map(card => {
    const box = card.querySelector('.entity-icon');
    return {
      id: /** @type {HTMLElement} */ (card).dataset['toolId'] ?? null,
      /* One box per card, never zero: an entry with no icon still gets the letter. */
      boxes: card.querySelectorAll('.entity-icon').length,
      initial: box ? box.getAttribute('data-entity-initial') : null,
      /* The icon is identity, not a fifth field: it lives inside the headline, beside the name. */
      inHeadline: Boolean(box && box.closest('.card-headline')),
      placeholder: Boolean(box && box.classList.contains('is-placeholder')),
      imgSrc: card.querySelector('img') ? card.querySelector('img')?.getAttribute('src') : null
    };
  }));

  expect(rows).toHaveLength(tools.length);
  rows.forEach((row, index) => {
    const tool = tools[index];
    if (!tool) throw new Error('the DOM and the catalogue are the same length');
    expect(row.id, 'card order').toBe(tool.id);
    expect(row.boxes, `${tool.id} icon boxes`).toBe(1);
    expect(row.initial, `${tool.id} initial`).toBe(tool.initial);
    expect(row.inHeadline, `${tool.id} icon sits in the headline`).toBe(true);
    if (tool.url) {
      /* The recorded URL, or -- if this host failed while the test ran -- the placeholder it is
         allowed to degrade to. What is never allowed is a *different* URL. */
      if (row.imgSrc !== null) expect(row.imgSrc, `${tool.id} icon src`).toBe(tool.url);
      else expect(row.placeholder, `${tool.id} fell back`).toBe(true);
    } else {
      expect(row.placeholder, `${tool.id} placeholder`).toBe(true);
      expect(row.imgSrc, `${tool.id} has no img`).toBeNull();
    }
  });

  // The entry the probe found no icon for renders its letter, and the letter is painted by CSS:
  // it stands in for a logo, so it must be visible and must not join the card's text.
  const first = tools.find(tool => !tool.url);
  if (!first) throw new Error('the catalogue needs an entry with no verified icon for this test');
  const box = page.locator(`.feature-tool-card[data-tool-id="${first.id}"] .entity-icon`);
  await expect(box).toHaveCount(1);
  await expect(page.locator(`.feature-tool-card[data-tool-id="${first.id}"] img`)).toHaveCount(0);
  const painted = await box.evaluate(element => ({
    content: getComputedStyle(element, '::before').content,
    width: element.getBoundingClientRect().width,
    text: /** @type {HTMLElement} */ (element).innerText
  }));
  expect(painted.content).toContain(first.initial);
  expect(painted.width).toBeGreaterThan(0);
  expect(painted.text).toBe('');

  // (3) nothing anywhere reads as undefined -- not in the text, not in the icons' own attributes.
  const suspicious = await page.evaluate(() => {
    const attributes = [...document.querySelectorAll('.entity-icon')]
      .flatMap(element => [...element.attributes].map(attribute => `${attribute.name}=${attribute.value}`));
    return [document.body.innerText, ...attributes].filter(value => /undefined|\[object/.test(value));
  });
  expect(suspicious).toEqual([]);

  expect(errors).toEqual([]);
});

test('an icon that fails at runtime falls back to the placeholder instead of a broken image', async ({page}) => {
  /** @type {string[]} */
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  /* Every third-party host is made to fail; the page's own origin is untouched. */
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return host === '127.0.0.1' || host === 'localhost' ? route.continue() : route.abort('failed');
  });
  await page.goto('nip-explorer.html');
  await expect(page.locator('.feature-tool-card').first()).toBeVisible();

  const tools = await catalogue(page);
  /* The first card is the one in view, so its lazy image is the one that is actually asked for. */
  const first = tools[0];
  if (!first || !first.url) throw new Error('this test needs the first entry to carry a verified icon');
  const card = page.locator(`.feature-tool-card[data-tool-id="${first.id}"]`);

  await expect(card.locator('span.entity-icon.is-placeholder')).toHaveCount(1);
  await expect(card.locator('img')).toHaveCount(0);
  await expect(card.locator('.entity-icon')).toHaveAttribute('data-entity-initial', first.initial);
  await expect(card.locator('.entity-icon')).toBeVisible();
  // A failing third-party host is not a broken page: the fallback itself throws nothing.
  expect(pageErrors).toEqual([]);
});

test('the carousel slide carries the same icon, from the same record', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  await expect(page.locator('.carousel-slide').first()).toBeVisible();
  // Hovering pauses the rotation, so the slides that are read are the slides that were built.
  await page.locator('#carousel').hover();

  const tools = await catalogue(page);
  /* Padding copies repeat the first and last entries and carry no data-slide-index, so a slot is
     matched to its entry by the index the slide publishes rather than by counting. */
  const slides = await page.evaluate(() => [...document.querySelectorAll('.carousel-slide[data-slide-index]')].map(slide => {
    const box = slide.querySelector('.entity-icon');
    return {
      index: Number(/** @type {HTMLElement} */ (slide).dataset['slideIndex']),
      boxes: slide.querySelectorAll('.entity-icon').length,
      initial: box ? box.getAttribute('data-entity-initial') : null,
      placeholder: Boolean(box && box.classList.contains('is-placeholder')),
      imgSrc: slide.querySelector('img')?.getAttribute('src') ?? null
    };
  }));

  expect(slides).toHaveLength(tools.length);
  slides.forEach(slide => {
    const tool = tools[slide.index];
    if (!tool) throw new Error(`no catalogue record for slide ${slide.index}`);
    expect(slide.boxes, `${tool.id} icon boxes`).toBe(1);
    expect(slide.initial, `${tool.id} initial`).toBe(tool.initial);
    if (tool.url) {
      if (slide.imgSrc !== null) expect(slide.imgSrc, `${tool.id} slide icon src`).toBe(tool.url);
      else expect(slide.placeholder, `${tool.id} slide fell back`).toBe(true);
    } else {
      expect(slide.placeholder, `${tool.id} slide placeholder`).toBe(true);
      expect(slide.imgSrc, `${tool.id} slide has no img`).toBeNull();
    }
  });

  const suspicious = await page.evaluate(() => [document.body.innerText].filter(value => /undefined|\[object/.test(value)));
  expect(suspicious).toEqual([]);

  expect(errors).toEqual([]);
});

test.describe('375x812', () => {
  test.use({viewport: PHONE});

  test('the icon box is one fixed size and costs the list no width', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto('nip-explorer.html');
    await expect(page.locator('.feature-tool-card').first()).toBeVisible();

    /* One box size for every card, whether it holds an image or a letter. That is what keeps a
       third-party image that is slow, or that never arrives, from moving the row it sits in. */
    const sizes = await page.evaluate(() => [...new Set([...document.querySelectorAll('#tool-results .entity-icon')]
      .map(box => { const rect = box.getBoundingClientRect(); return `${Math.round(rect.width)}x${Math.round(rect.height)}`; }))]);
    expect(sizes).toHaveLength(1);

    const [scrollWidth, clientWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scrollWidth).toBeLessThanOrEqual(Number(clientWidth));

    expect(errors).toEqual([]);
  });
});
