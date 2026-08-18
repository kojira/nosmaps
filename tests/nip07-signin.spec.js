const {test, expect} = require('@playwright/test');

// Coverage for GitHub issue #9: the explorer used to render a hardcoded
// `npub1currentviewer8q4k2p7cx` as if somebody were signed in. Sign-in is now
// window.nostr.getPublicKey() and nothing else, and every way it can fail has to
// land on an explicit signed-out state with its own, distinguishable reason.
//
// This slice is sign-in only: no publishing, no event signing.

const EXPLORER = 'nip-explorer.html';
const MOCK_NPUB = 'npub1currentviewer8q4k2p7cx';
// The bech32 charset, so "looks like an npub" is decided by NIP-19's alphabet and
// not by a hand-waved \w+.
const NPUB_LIKE = /npub1[023456789acdefghjklmnpqrstuvwxyz]{20,}/;

// NIP-19 vectors encoded by an independent reference implementation of BIP-173
// bech32, not by the code under test. Asserting exact equality against these
// means a wrong checksum, a wrong 8->5 bit regrouping or a truncated key all
// fail here, where a `toContain('npub1')`-style check would pass.
const VECTORS = {
  // The vector relay-unit.spec.js already pins for decodeNpub.
  a: {
    hex: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6'
  },
  // The NIP-19 specification's own example key.
  b: {
    hex: '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2',
    npub: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m'
  },
  // All-but-one zero bytes: catches an encoder that drops leading zero groups.
  low: {
    hex: '0000000000000000000000000000000000000000000000000000000000000001',
    npub: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqshp52w2'
  }
};

/* issue #6 でレビュー入口は一覧カードから詳細ビュー (#evidence-dialog) の中へ移った。 */
/** @param {import('@playwright/test').Page} page */
async function openReviews(page) {
  await page.locator('#tool-results .feature-tool-card [data-feature-detail]').first().click();
  await expect(page.locator('#evidence-dialog')).toBeVisible();
  await page.locator('#evidence-dialog [data-review-tool]').click();
  await expect(page.locator('#review-dialog')).toHaveAttribute('open', '');
}

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/* The signer stand-in is installed before any page script runs, so nip-explorer.js
   sees exactly what a real extension would expose. `mode` decides how
   getPublicKey() settles; the call counter lets a test prove the page did not
   prompt on its own. */
function installSigner(page, behaviour) {
  return page.addInitScript(config => {
    window.__SIGNER_CALLS__ = 0;
    window.nostr = {
      getPublicKey() {
        window.__SIGNER_CALLS__ += 1;
        if (config.mode === 'resolve') return Promise.resolve(config.value);
        if (config.mode === 'reject') return Promise.reject(new Error(config.message));
        if (config.mode === 'throw') throw new Error(config.message);
        return new Promise(() => {}); // never settles: the extension went quiet
      }
    };
  }, behaviour);
}

const viewer = page => page.locator('#viewer-identity');
const signInButton = page => page.locator('[data-viewer-signin]');
const reasonNode = page => viewer(page).locator('[data-viewer-reason]');

async function status(page) { return viewer(page).getAttribute('data-viewer-status'); }
async function reason(page) {
  return await reasonNode(page).count() ? reasonNode(page).getAttribute('data-viewer-reason') : null;
}

// The invariant that must hold in every signed-out state: nothing may be shown
// that reads like the viewer's identity, and the old mock must be gone entirely.
async function expectNoIdentityShown(page) {
  await expect(viewer(page)).toHaveAttribute('data-viewer-status', 'signedOut');
  await expect(viewer(page).locator('[data-viewer-npub]')).toHaveCount(0);
  const region = await viewer(page).innerText();
  expect(region).not.toMatch(NPUB_LIKE);
  expect(region).not.toContain('undefined');
  expect(await page.content()).not.toContain(MOCK_NPUB);
}

// The viewer's own profile is reachable from a review they posted; this opens it
// through the same delegated handler that reviewer link uses.
async function openLocalProfile(page) {
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.reviewer = 'local';
    button.id = 'test-open-local-profile';
    document.body.appendChild(button);
    button.click();
    button.remove();
  });
  await expect(page.locator('#profile-dialog')).toHaveAttribute('open', '');
}

test.describe('NIP-07 sign-in (issue #9)', () => {
  test('A. with no window.nostr the viewer is signed out and says the extension is missing', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);

    // Nothing is claimed before the user asks for anything.
    expect(await status(page)).toBe('signedOut');
    expect(await reason(page)).toBeNull();
    await expect(signInButton(page)).toBeVisible();
    await expectNoIdentityShown(page);

    expect(await page.evaluate(() => Boolean(window.nostr))).toBe(false);

    await signInButton(page).click();

    expect(await status(page)).toBe('signedOut');
    expect(await reason(page)).toBe('noExtension');
    await expect(reasonNode(page)).toContainText('window.nostr');
    await expectNoIdentityShown(page);
    expect(errors).toEqual([]);
  });

  test('B. a rejected prompt is reported as rejected, not as a signed-in viewer', async ({page}) => {
    const errors = collectErrors(page);
    await installSigner(page, {mode: 'reject', message: 'User rejected the request'});
    await page.goto(EXPLORER);

    await signInButton(page).click();
    await expect(reasonNode(page)).toHaveAttribute('data-viewer-reason', 'rejected');

    expect(await status(page)).toBe('signedOut');
    // The extension's own words are shown too, so our classification is checkable.
    await expect(reasonNode(page)).toContainText('User rejected the request');
    await expectNoIdentityShown(page);
    expect(errors).toEqual([]);
  });

  test('C. an extension failure is reported as an error, distinct from a rejection', async ({page}) => {
    const errors = collectErrors(page);
    await installSigner(page, {mode: 'reject', message: 'internal signer failure'});
    await page.goto(EXPLORER);

    await signInButton(page).click();
    await expect(reasonNode(page)).toHaveAttribute('data-viewer-reason', 'error');

    expect(await status(page)).toBe('signedOut');
    await expect(reasonNode(page)).toContainText('internal signer failure');
    await expectNoIdentityShown(page);
    expect(errors).toEqual([]);
  });

  test('C2. a synchronous throw is caught and reported, not left unhandled', async ({page}) => {
    const errors = collectErrors(page);
    await installSigner(page, {mode: 'throw', message: 'signer exploded'});
    await page.goto(EXPLORER);

    await signInButton(page).click();
    await expect(reasonNode(page)).toHaveAttribute('data-viewer-reason', 'error');
    await expectNoIdentityShown(page);
    expect(errors).toEqual([]);
  });

  test('D. an extension that never answers times out, distinct from every other failure', async ({page}) => {
    const errors = collectErrors(page);
    await installSigner(page, {mode: 'hang'});
    await page.goto(`${EXPLORER}?nip07timeout=2500`);

    await signInButton(page).click();
    // While waiting the state is explicitly "connecting", never a provisional identity.
    await expect(viewer(page)).toHaveAttribute('data-viewer-status', 'pending');
    await expect(viewer(page).locator('[data-viewer-npub]')).toHaveCount(0);

    await expect(reasonNode(page)).toHaveAttribute('data-viewer-reason', 'timeout', {timeout: 15_000});
    expect(await status(page)).toBe('signedOut');
    await expectNoIdentityShown(page);
    expect(errors).toEqual([]);
  });

  test('E. a value that is not a public key is refused rather than shown', async ({page}) => {
    const errors = collectErrors(page);
    await installSigner(page, {mode: 'resolve', value: 'not-a-key'});
    await page.goto(EXPLORER);

    await signInButton(page).click();
    await expect(reasonNode(page)).toHaveAttribute('data-viewer-reason', 'badKey');
    await expectNoIdentityShown(page);
    expect(errors).toEqual([]);
  });

  test('E2. the four failure causes each render their own message', async ({page}) => {
    const errors = collectErrors(page);
    await installSigner(page, {mode: 'reject', message: 'User rejected the request'});
    await page.goto(`${EXPLORER}?nip07timeout=1500`);

    const seen = {};
    async function attempt(key, mode, message) {
      await page.evaluate(config => {
        window.nostr = config.mode === 'absent' ? undefined : {
          getPublicKey() {
            if (config.mode === 'reject') return Promise.reject(new Error(config.message));
            return new Promise(() => {});
          }
        };
      }, {mode, message});
      await signInButton(page).click();
      await expect(reasonNode(page)).toHaveAttribute('data-viewer-reason', key, {timeout: 15_000});
      seen[key] = (await reasonNode(page).innerText()).trim();
    }

    await attempt('rejected', 'reject', 'User rejected the request');
    await attempt('error', 'reject', 'internal signer failure');
    await attempt('timeout', 'hang', '');
    await attempt('noExtension', 'absent', '');

    const messages = Object.values(seen);
    expect(messages).toHaveLength(4);
    // Four causes, four distinct messages -- none collapsed into one vague string.
    expect(new Set(messages).size).toBe(4);
    for (const message of messages) expect(message.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  for (const [name, vector] of Object.entries(VECTORS)) {
    test(`F-${name}. a successful sign-in shows the npub encoding of the returned hex key`, async ({page}) => {
      const errors = collectErrors(page);
      await installSigner(page, {mode: 'resolve', value: vector.hex});
      await page.goto(EXPLORER);

      await signInButton(page).click();
      await expect(viewer(page)).toHaveAttribute('data-viewer-status', 'signedIn');

      // Exact equality against an independently-encoded vector: the right key in
      // the wrong bech32 encoding fails here.
      const shown = (await viewer(page).locator('[data-viewer-npub]').textContent()).trim();
      expect(shown).toBe(vector.npub);
      expect(shown).not.toBe(MOCK_NPUB);
      // The raw hex is never what the user is shown.
      expect(shown).not.toContain(vector.hex);
      await expect(page.locator('[data-viewer-signout]')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('G. the signed-in key survives a reload within the session without re-prompting', async ({page}) => {
    const errors = collectErrors(page);
    await installSigner(page, {mode: 'resolve', value: VECTORS.b.hex});
    await page.goto(EXPLORER);

    // Opening the page must not prompt; only the explicit control may.
    expect(await page.evaluate(() => window.__SIGNER_CALLS__)).toBe(0);

    await signInButton(page).click();
    await expect(viewer(page)).toHaveAttribute('data-viewer-status', 'signedIn');
    expect(await page.evaluate(() => window.__SIGNER_CALLS__)).toBe(1);

    await page.reload();
    await expect(viewer(page)).toHaveAttribute('data-viewer-status', 'signedIn');
    await expect(viewer(page).locator('[data-viewer-npub]')).toHaveText(VECTORS.b.npub);
    // Restored from the session, not by prompting again.
    expect(await page.evaluate(() => window.__SIGNER_CALLS__)).toBe(0);

    await page.locator('[data-viewer-signout]').click();
    await expectNoIdentityShown(page);

    // Sign-out clears the session too, so a reload does not resurrect the key.
    await page.reload();
    await expectNoIdentityShown(page);
    expect(errors).toEqual([]);
  });

  test('H. the viewer profile shows the signed-in npub and drops the fabricated joined date and vote counts', async ({page}) => {
    const errors = collectErrors(page);
    await installSigner(page, {mode: 'resolve', value: VECTORS.a.hex});
    await page.goto(EXPLORER);

    await signInButton(page).click();
    await expect(viewer(page)).toHaveAttribute('data-viewer-status', 'signedIn');

    await openLocalProfile(page);
    const dialog = page.locator('#profile-dialog');
    await expect(dialog.locator('[data-profile-npub]')).toHaveText(VECTORS.a.npub);

    const dialogText = await dialog.innerText();
    expect(dialogText).not.toContain(MOCK_NPUB);
    // joined 2026-08 and the 0 / 0 vote split were never measured.
    expect(dialogText).not.toContain('2026-08');
    expect(dialogText).not.toContain('0 / 0');
    expect(dialogText).not.toContain('undefined');
    // joined / activity / posting / vote history: four unmeasured facts, four unknown markers.
    expect(await dialog.locator('.profile-facts .no-support-record').count()).toBe(4);
    expect(errors).toEqual([]);
  });

  test('I. a signed-out viewer profile shows no npub at all', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);

    await openLocalProfile(page);
    const dialogText = await page.locator('#profile-dialog').innerText();
    expect(dialogText).not.toContain(MOCK_NPUB);
    expect(dialogText).not.toMatch(NPUB_LIKE);
    expect(dialogText).not.toContain('undefined');
    expect(dialogText).not.toContain('2026-08');
    await expect(page.locator('#profile-dialog [data-profile-npub]')).toHaveClass(/is-signed-out/);
    expect(errors).toEqual([]);
  });

  test('J. a review posted while signed in is attributed to the real npub, and to none while signed out', async ({page}) => {
    const errors = collectErrors(page);
    await installSigner(page, {mode: 'resolve', value: VECTORS.b.hex});
    await page.goto(EXPLORER);

    // issue #6: レビュー入口はカードから詳細ビューへ移った。開く手数が一つ増えただけで中身は同じ。
    await openReviews(page);
    await page.locator('#review-dialog textarea[name="body"]').fill('Checked on this screen.');
    await page.locator('#review-dialog form[data-review-form] button[type="submit"]').click();

    const posted = page.locator('#review-dialog .review-item').last();
    await expect(posted).toContainText('Checked on this screen.');
    // Signed out at post time: the review shows the signed-out label, not a fake npub.
    const signedOutLine = await posted.locator('.reviewer-link small').innerText();
    expect(signedOutLine).not.toContain(MOCK_NPUB);
    expect(signedOutLine).not.toMatch(NPUB_LIKE);

    await page.locator('#review-dialog [data-close-dialog]').click();
    // 詳細ビューはレビューダイアログの下に開いたままなので、ページ上部を触る前に閉じる。
    await page.locator('#evidence-dialog [data-close-dialog]').click();
    await expect(page.locator('#evidence-dialog')).toBeHidden();
    await signInButton(page).click();
    await expect(viewer(page)).toHaveAttribute('data-viewer-status', 'signedIn');

    await openReviews(page);
    await expect(page.locator('#review-dialog .review-item').last().locator('.reviewer-link small'))
      .toHaveText(VECTORS.b.npub);
    expect(errors).toEqual([]);
  });

  test('K. every viewer string is translated in both languages and nothing overflows at 375x812', async ({page}) => {
    const errors = collectErrors(page);
    await page.setViewportSize({width: 375, height: 812});
    await installSigner(page, {mode: 'reject', message: 'User declined'});
    await page.goto(EXPLORER);

    async function checkLanguage(language) {
      await page.locator(`#compact-identity [data-language="${language}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('lang', language);

      for (const phase of ['before', 'after']) {
        if (phase === 'after') {
          await signInButton(page).click();
          await expect(reasonNode(page)).toHaveAttribute('data-viewer-reason', 'rejected');
        }
        const text = await viewer(page).innerText();
        expect(text.trim().length).toBeGreaterThan(0);
        expect(text).not.toContain('undefined');
        // The missing-key contract renders the key path itself; that must not surface.
        expect(text).not.toContain('explorer.viewer');
      }

      const overflow = await page.evaluate(() => {
        const host = document.querySelector('#viewer-identity');
        return {
          doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          viewer: host.scrollWidth - host.clientWidth
        };
      });
      expect(overflow.doc).toBeLessThanOrEqual(0);
      expect(overflow.viewer).toBeLessThanOrEqual(0);
    }

    await checkLanguage('en');
    await checkLanguage('ja');

    // A signed-in 63-character npub is the widest thing this control ever holds.
    await page.evaluate(hex => { window.nostr.getPublicKey = () => Promise.resolve(hex); }, VECTORS.b.hex);
    await signInButton(page).click();
    await expect(viewer(page)).toHaveAttribute('data-viewer-status', 'signedIn');
    await expect(viewer(page).locator('[data-viewer-npub]')).toHaveText(VECTORS.b.npub);

    const wide = await page.evaluate(() => {
      const host = document.querySelector('#viewer-identity');
      const npub = host.querySelector('[data-viewer-npub]');
      return {
        doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        viewer: host.scrollWidth - host.clientWidth,
        npub: npub.scrollWidth - npub.clientWidth
      };
    });
    expect(wide.doc).toBeLessThanOrEqual(0);
    expect(wide.viewer).toBeLessThanOrEqual(0);
    expect(wide.npub).toBeLessThanOrEqual(0);

    // Scoped to this slice: unrelated pre-existing gaps elsewhere are not this test's subject.
    const missing = await page.evaluate(() => window.NOSMAPS_I18N.missing
      .filter(entry => entry.path.startsWith('explorer.viewer'))
      .map(entry => `${entry.language}:${entry.path}`));
    expect(missing).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('L. encodeNpub is the exact inverse of decodeNpub and refuses non-keys', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(vectors => {
      const {encodeNpub, decodeNpub} = window.NOSMAPS_CATALOG;
      return {
        encoded: Object.fromEntries(Object.entries(vectors).map(([key, v]) => [key, encodeNpub(v.hex)])),
        roundTrip: Object.fromEntries(Object.entries(vectors).map(([key, v]) => [key, decodeNpub(encodeNpub(v.hex))])),
        short: encodeNpub('abc'),
        empty: encodeNpub(''),
        notString: encodeNpub(null),
        nonHex: encodeNpub('z'.repeat(64)),
        tooLong: encodeNpub('a'.repeat(65))
      };
    }, VECTORS);

    for (const [key, vector] of Object.entries(VECTORS)) {
      expect(r.encoded[key]).toBe(vector.npub);
      expect(r.roundTrip[key]).toBe(vector.hex);
    }
    expect(r.short).toBeNull();
    expect(r.empty).toBeNull();
    expect(r.notString).toBeNull();
    expect(r.nonHex).toBeNull();
    expect(r.tooLong).toBeNull();
    expect(errors).toEqual([]);
  });
});
