const {test, expect} = require('@playwright/test');

const ROTATION_MS = 2500;
const SETTLE_MS = 900;

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

function trackTransform(page) {
  return page.evaluate(() => getComputedStyle(document.querySelector('#carousel-track')).transform);
}

function trackOffset(page) {
  return page.evaluate(() => {
    const match = /translate3d\((-?[\d.]+)px/.exec(document.querySelector('#carousel-track').style.transform);
    return match ? Number(match[1]) : null;
  });
}

function activeIndex(page) {
  return page.locator('.carousel-slide:not([aria-hidden])').getAttribute('data-slide-index');
}

/* Geometry as the reader sees it: rects include the scale applied to each slide. */
function geometry(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('#carousel-viewport').getBoundingClientRect();
    const slides = [...document.querySelectorAll('.carousel-slide')];
    const measure = element => {
      const rect = element.getBoundingClientRect();
      return {
        slot: Number(element.dataset.slotIndex),
        width: rect.width,
        fullyVisible: rect.left >= viewport.left - 1 && rect.right <= viewport.right + 1,
        visibleWidth: Math.max(0, Math.min(rect.right, viewport.right) - Math.max(rect.left, viewport.left)),
        centreOffset: (rect.left + rect.width / 2) - (viewport.left + viewport.width / 2)
      };
    };
    const current = document.querySelector('.carousel-slide.is-current');
    return {
      fullyVisible: slides.filter(element => measure(element).fullyVisible).map(measure),
      current: measure(current),
      sides: [...document.querySelectorAll('.carousel-slide.is-side')].map(measure),
      viewportWidth: viewport.width
    };
  });
}

async function pauseRotation(page) {
  await page.locator('#carousel').hover();
  await page.waitForTimeout(SETTLE_MS);
}

test('the track slides: its transform changes between steps instead of the slides toggling hidden', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  await pauseRotation(page);

  const before = await trackTransform(page);
  expect(before).toMatch(/^matrix/);
  await page.getByRole('button', {name: 'Next item'}).click();
  await page.waitForTimeout(SETTLE_MS);
  const after = await trackTransform(page);
  expect(after).not.toBe(before);

  await page.getByRole('button', {name: 'Previous item'}).click();
  await page.waitForTimeout(SETTLE_MS);
  expect(await trackTransform(page)).toBe(before);

  /* No slide is removed from layout: the movement is the transform, not a hidden toggle. */
  expect(await page.locator('.carousel-slide[hidden]').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('the centre slide is the current one and is the emphasised one', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  await pauseRotation(page);

  const before = await geometry(page);
  expect(Math.abs(before.current.centreOffset)).toBeLessThanOrEqual(2);
  expect(before.sides).toHaveLength(2);
  for (const side of before.sides) expect(side.width).toBeLessThan(before.current.width);
  expect(await page.locator('.carousel-slide.is-current').getAttribute('data-slide-index')).toBe(await activeIndex(page));

  await page.getByRole('button', {name: 'Next item'}).click();
  await page.waitForTimeout(SETTLE_MS);
  const after = await geometry(page);
  expect(Math.abs(after.current.centreOffset)).toBeLessThanOrEqual(2);
  for (const side of after.sides) expect(side.width).toBeLessThan(after.current.width);
  expect(await page.locator('.carousel-slide.is-current').getAttribute('data-slide-index')).toBe(await activeIndex(page));
  expect(errors).toEqual([]);
});

test('a wide viewport shows three slides at once with the current one in the middle', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  await pauseRotation(page);

  const view = await geometry(page);
  expect(view.fullyVisible).toHaveLength(3);
  const slots = view.fullyVisible.map(slide => slide.slot).sort((a, b) => a - b);
  expect(slots[1]).toBe(view.current.slot);
  expect(slots).toEqual([view.current.slot - 1, view.current.slot, view.current.slot + 1]);
  expect(errors).toEqual([]);
});

test('wrapping past the end keeps sliding forward instead of jumping back to the start', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  await pauseRotation(page);

  const total = await page.locator('.carousel-slide:not([data-clone])').count();
  const startOffset = await trackOffset(page);
  expect(await activeIndex(page)).toBe('0');

  /* Step backwards off the front edge: the track must travel towards the padding copy that sits
     before slide 0, not snap across the whole strip to the last slide. */
  await page.getByRole('button', {name: 'Previous item'}).click();
  const travelling = await trackOffset(page);
  expect(await activeIndex(page)).toBe(String(total - 1));
  expect(travelling).toBeGreaterThan(startOffset);

  await page.waitForTimeout(SETTLE_MS);
  const settled = await trackOffset(page);
  expect(await activeIndex(page)).toBe(String(total - 1));
  /* Once the movement finishes the track is silently re-seated on the real last slide, which is
     far to the left; the correction is invisible because both slots draw the same entry. */
  expect(settled).toBeLessThan(startOffset);

  await page.getByRole('button', {name: 'Next item'}).click();
  const returning = await trackOffset(page);
  expect(await activeIndex(page)).toBe('0');
  expect(returning).toBeLessThan(settled);
  await page.waitForTimeout(SETTLE_MS);
  expect(await trackOffset(page)).toBe(startOffset);
  expect(errors).toEqual([]);
});

test('off-screen slides and padding copies stay hidden from assistive technology', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto('index.html');
  await pauseRotation(page);

  const exposed = page.locator('.carousel-slide:not([aria-hidden])');
  await expect(exposed).toHaveCount(1);
  await expect(exposed).toHaveAttribute('data-slide-index', '0');
  expect(await page.locator('.carousel-slide[data-clone]:not([aria-hidden="true"])').count()).toBe(0);
  await expect(exposed).toHaveAttribute('aria-label', /\(1 of \d+\)$/);

  await page.getByRole('button', {name: 'Next item'}).click();
  await page.waitForTimeout(SETTLE_MS);
  await expect(exposed).toHaveCount(1);
  await expect(exposed).toHaveAttribute('data-slide-index', '1');
  expect(await page.locator('.carousel-slide[data-clone]:not([aria-hidden="true"])').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('reduced motion disables the auto-advance and the sliding animation', async ({page}) => {
  const errors = collectErrors(page);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('index.html');

  const durations = await page.evaluate(() => ({
    track: getComputedStyle(document.querySelector('#carousel-track')).transitionDuration,
    slide: getComputedStyle(document.querySelector('.carousel-slide')).transitionDuration
  }));
  expect(durations.track).toBe('0s');
  expect(durations.slide).toBe('0s');

  const first = await activeIndex(page);
  const firstOffset = await trackOffset(page);
  await page.waitForTimeout(3 * ROTATION_MS);
  expect(await activeIndex(page)).toBe(first);
  expect(await trackOffset(page)).toBe(firstOffset);

  /* Manual control still moves the track, it just arrives instantly. */
  await page.getByRole('button', {name: 'Next item'}).click();
  expect(await activeIndex(page)).toBe('1');
  expect(await trackOffset(page)).not.toBe(firstOffset);
  expect(errors).toEqual([]);
});

test.describe('375x812 carousel presentation', () => {
  test.use({viewport: {width: 375, height: 812}});

  test('one centred slide with the neighbours peeking, and no horizontal overflow', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto('index.html');
    await pauseRotation(page);

    const view = await geometry(page);
    expect(view.fullyVisible).toHaveLength(1);
    expect(view.fullyVisible[0].slot).toBe(view.current.slot);
    expect(Math.abs(view.current.centreOffset)).toBeLessThanOrEqual(2);

    expect(view.sides).toHaveLength(2);
    for (const side of view.sides) {
      expect(side.fullyVisible).toBe(false);
      expect(side.visibleWidth).toBeGreaterThan(8);
      expect(side.visibleWidth).toBeLessThan(side.width);
    }

    /* The overflowing track is clipped by the viewport box, so the page itself must neither
       report a wider scroll width nor be scrollable sideways. */
    const metrics = await page.evaluate(() => {
      window.scrollTo(2000, 0);
      const scrolled = window.scrollX;
      window.scrollTo(0, 0);
      const box = document.querySelector('#carousel-viewport').getBoundingClientRect();
      return {
        document: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
        body: [document.body.scrollWidth, document.body.clientWidth],
        carouselRight: box.right,
        carouselLeft: box.left,
        clientWidth: document.documentElement.clientWidth,
        scrolled
      };
    });
    expect(metrics.document[0]).toBeLessThanOrEqual(metrics.document[1]);
    expect(metrics.body[0]).toBeLessThanOrEqual(metrics.body[1]);
    expect(metrics.carouselLeft).toBeGreaterThanOrEqual(0);
    expect(metrics.carouselRight).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.scrolled).toBe(0);

    await page.getByRole('button', {name: 'Next item'}).click();
    await page.waitForTimeout(SETTLE_MS);
    const stepped = await page.evaluate(() => [document.body.scrollWidth, document.body.clientWidth]);
    expect(stepped[0]).toBeLessThanOrEqual(stepped[1]);
    expect(errors).toEqual([]);
  });
});
