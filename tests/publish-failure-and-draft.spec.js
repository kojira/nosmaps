const {test, expect} = require('@playwright/test');

/* Two permanent guards for issue #12.

   1. §W4.3 / W-I3, the test hole recorded in issue #12: "every relay rejected"
      was only ever checked once with a throwaway spec. A publish that every
      relay refused must read as a refusal -- headline, reason, and one rejected
      row per relay -- and must not contain a single string that a user could
      read as success.

   2. §W1.4, gap 4: a publish attempt fails for reasons outside the user's
      control, so losing what they typed is a failure mode we do not have to
      have. The fields keep their values across the failure, across a language
      switch, and across a reload -- and are only dropped once publication was
      actually observed.

   The relay stub refuses every EVENT (`ok: false`), which is the whole point:
   nothing is acknowledged and nothing is outstanding, so §W4.5's "there is
   nothing to read back" branch is the one under test. */

const EXPLORER = 'nip-explorer.html';
const RELAY_URL = 'wss://mock.relay.test/';
const PUBLISHER_SECKEY = '77'.repeat(32);

/* The strings the page uses to say a record got out -- the two success headlines
   and their ja counterpart. None may appear on a screen produced by a publish
   that every relay refused. `read back.` carries its full stop deliberately:
   the form's standing lead says "read back from a relay" as a promise about
   when the app will claim success, and that sentence is present either way. */
const SUCCESS_STRINGS = ['read back.', 'Published to', '公開し、読み戻せました'];

const TYPED = {
  dLocal: 'com.example.keepdraft',
  name: 'Draft Keeper',
  summary: 'A summary the user typed and must not lose to a relay refusal.',
  homepage: 'https://example.com/keepdraft',
  topics: 'relay'
};

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/* A relay stand-in that answers every EVENT with OK false, and serves nothing
   back. Kept at the WebSocket boundary so the app's real publish path runs. */
function installRefusingMocks(seckey) {
  window.__MOCK_RELAY__ = {published: [], ok: false};

  class MockRelaySocket extends EventTarget {
    constructor(url) {
      super();
      this.url = String(url);
      this.readyState = 0;
      setTimeout(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); }, 0);
    }
    send(raw) {
      let message;
      try { message = JSON.parse(raw); } catch (error) { return; }
      if (message[0] === 'EVENT') {
        const event = message[1];
        window.__MOCK_RELAY__.published.push(event);
        const accepted = window.__MOCK_RELAY__.ok === true;
        setTimeout(() => {
          this.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify(['OK', event.id, accepted, accepted ? '' : 'blocked: mock relay refuses everything'])
          }));
        }, 0);
        return;
      }
      if (message[0] !== 'REQ') return;
      const subId = message[1];
      setTimeout(() => { this.dispatchEvent(new MessageEvent('message', {data: JSON.stringify(['EOSE', subId])})); }, 0);
    }
    close(code) { this.readyState = 3; this.dispatchEvent(new CloseEvent('close', {code: typeof code === 'number' ? code : 1000})); }
  }
  MockRelaySocket.OPEN = 1;
  window.WebSocket = MockRelaySocket;

  // Real schnorr signing, as in write-path.spec.js: a mock signature is dropped
  // by rx-nostr's verifier before it reaches anything worth testing.
  let signerPromise = null;
  function signer() {
    if (!signerPromise) signerPromise = import(new URL('dist/rx-nostr-crypto.js', location.href).href).then(module => module.seckeySigner(seckey));
    return signerPromise;
  }
  window.nostr = {
    async getPublicKey() { return (await signer()).getPublicKey(); },
    async signEvent(draft) { return (await signer()).signEvent(draft); }
  };
}

const QUERY = [
  'relay=1',
  `relays=${encodeURIComponent(RELAY_URL)}`,
  'readbackattempts=3',
  'readbackbackoff=0,150,300',
  'publishtimeout=5000'
].join('&');

async function openExplorer(page) {
  await page.addInitScript(installRefusingMocks, PUBLISHER_SECKEY);
  await page.route(`${RELAY_URL.replace('wss://', 'https://')}**`, route => route.fulfill({
    status: 200,
    contentType: 'application/nostr+json',
    body: JSON.stringify({name: 'mock relay', supported_nips: [1], limitation: {}})
  }));
  await page.goto(`${EXPLORER}?${QUERY}`);
  await page.evaluate(() => window.NOSMAPS_CATALOG.cache.wipe());
}

async function signIn(page) {
  await page.locator('[data-viewer-signin]').click();
  await expect(page.locator('#viewer-identity')).toHaveAttribute('data-viewer-status', 'signedIn');
}

async function fillForm(page, values) {
  await page.locator('#publish-d').fill(values.dLocal);
  await page.locator('#publish-name').fill(values.name);
  await page.locator('#publish-summary').fill(values.summary);
  await page.locator('#publish-homepage').fill(values.homepage);
  await page.locator('#publish-topics').fill(values.topics);
}

function formValues(page) {
  return page.evaluate(() => ({
    dLocal: document.getElementById('publish-d').value,
    name: document.getElementById('publish-name').value,
    summary: document.getElementById('publish-summary').value,
    homepage: document.getElementById('publish-homepage').value,
    topics: document.getElementById('publish-topics').value
  }));
}

test('a publish every relay rejected reads as a refusal and shows no success string', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);
  await signIn(page);
  await fillForm(page, {
    dLocal: 'com.example.refused',
    name: 'Refused Everywhere',
    summary: 'Every relay says OK false.',
    homepage: '',
    topics: ''
  });
  await page.locator('[data-publish-submit]').click();

  await expect(page.locator('[data-publish-state]')).toHaveAttribute('data-publish-state', 'failed', {timeout: 20_000});

  // The three things a user actually reads.
  await expect(page.locator('[data-publish-headline]')).toHaveText('Not published.');
  await expect(page.locator('[data-publish-reason]')).toHaveText('Every relay refused it.');
  await expect(page.locator('[data-publish-reason]')).toHaveAttribute('data-publish-reason', 'all-relays-rejected');

  // One rejected row per relay, naming the relay and carrying its notice.
  const rows = page.locator('.publish-relays li');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(RELAY_URL);
  await expect(rows.first()).toContainText('rejected (OK false)');
  await expect(rows.first()).toContainText('blocked: mock relay refuses everything');

  // Nothing anywhere on the screen may read as success.
  const panel = await page.locator('#publish-panel').innerText();
  for (const success of SUCCESS_STRINGS) expect(panel, `success string on a refused publish: ${success}`).not.toContain(success);
  const body = await page.locator('body').innerText();
  for (const success of SUCCESS_STRINGS) expect(body, `success string on a refused publish: ${success}`).not.toContain(success);
  expect(body).not.toContain('undefined');

  // §W5.6: a refused record is not a row.
  const painted = await page.evaluate(() => ((window.__NOSMAPS_RELAY_RESULT__ || {}).entries || []).map(entry => entry.coordinate));
  expect(painted.some(coordinate => coordinate.includes('com.example.refused'))).toBe(false);

  expect(errors, 'console/page errors').toEqual([]);
});

test('a failed publish keeps every field the user typed, across a language switch and a reload', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);
  await signIn(page);
  await fillForm(page, TYPED);
  await page.locator('[data-publish-submit]').click();
  await expect(page.locator('[data-publish-state]')).toHaveAttribute('data-publish-state', 'failed', {timeout: 20_000});

  // Straight after the failure: nothing retyped, nothing lost.
  expect(await formValues(page), 'fields after a failed publish').toEqual(TYPED);
  // §W4.5: no silent background retry. One EVENT, from the one click.
  expect(await page.evaluate(() => window.__MOCK_RELAY__.published.length), 'EVENTs sent by one click').toBe(1);

  // §W1.4: a language switch redraws the whole form; the draft is content, not chrome.
  await page.locator('[data-language="ja"]').click();
  await expect(page.locator('[data-publish-headline]')).toHaveText('公開されていません。');
  expect(await formValues(page), 'fields after switching to ja').toEqual(TYPED);
  await page.locator('[data-language="en"]').click();
  expect(await formValues(page), 'fields after switching back to en').toEqual(TYPED);

  /* §W1.4: and across a reload, because that is the retry a user reaches for.
     The viewer session is restored from sessionStorage, so the form is already
     on screen and no second sign-in gesture happens here. */
  await page.reload();
  await expect(page.locator('#viewer-identity')).toHaveAttribute('data-viewer-status', 'signedIn');
  expect(await formValues(page), 'fields after a reload').toEqual(TYPED);
  // §W4.5 again, on the fresh page: restoring a draft must not publish it.
  expect(await page.evaluate(() => window.__MOCK_RELAY__.published.length), 'EVENTs sent after a reload').toBe(0);

  expect(await page.locator('body').innerText()).not.toContain('undefined');
  expect(errors, 'console/page errors').toEqual([]);
});
