const {test, expect} = require('@playwright/test');

/* End-to-end skeleton of the write path (issue #9 slice 2,
   design-relay-native-write-path.md). One test drives the whole chain:

     sign in -> fill the form -> build the 30078 draft -> window.nostr.signEvent
     -> EVENT to the relay -> OK -> read back by #d/#t -> one row in the explorer

   Two things are real here rather than stubbed, deliberately. The signature is a
   real schnorr signature over the real NIP-01 serialization (the page's own
   @rx-nostr/crypto seckeySigner backs the window.nostr stub), because rx-nostr's
   verifier drops anything else before it reaches the read path -- so a mock
   signer would test nothing. And the relay stub sits at the WebSocket boundary
   and *applies* the filters it is sent, so the `#d` and `#t` read-back queries
   are genuinely exercised instead of short-circuited.

   The assertion that matters is the last link: the row that comes back carries
   the id that was published. Anything weaker (a row with the right name, a
   success headline) would pass on a chain that is quietly broken in the middle. */

const EXPLORER = 'nip-explorer.html';
const RELAY_URL = 'wss://mock.relay.test/';
const PUBLISHER_SECKEY = '77'.repeat(32);

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/* A relay stand-in that speaks both halves of the write path: it answers EVENT
   with OK and, when `serveBack` is on, adds the event to the pool that REQ reads
   from. Splitting those two behaviours is the point -- "the relay said OK" and
   "the relay serves it back" are different facts, and the app is only allowed to
   claim publication from the second one (§W4.3). */
function installWriteMocks(seckey) {
  window.__MOCK_RELAY__ = {events: [], urls: [], sent: [], reqs: [], published: [], ok: true, serveBack: true};

  function matchesFilter(filter, event) {
    if (Array.isArray(filter.kinds) && filter.kinds.indexOf(event.kind) === -1) return false;
    if (Array.isArray(filter.ids) && filter.ids.indexOf(event.id) === -1) return false;
    if (Array.isArray(filter.authors) && filter.authors.indexOf(event.pubkey) === -1) return false;
    if (typeof filter.since === 'number' && event.created_at < filter.since) return false;
    if (typeof filter.until === 'number' && event.created_at > filter.until) return false;
    for (const key of Object.keys(filter)) {
      if (key.charAt(0) !== '#') continue;
      const name = key.slice(1);
      const wanted = filter[key];
      // NIP-01: only the first value in any given tag is indexed.
      const indexed = (event.tags || []).filter(tag => tag[0] === name).map(tag => tag[1]);
      if (!indexed.some(value => wanted.indexOf(value) !== -1)) return false;
    }
    return true;
  }

  class MockRelaySocket extends EventTarget {
    constructor(url) {
      super();
      this.url = String(url);
      this.readyState = 0;
      window.__MOCK_RELAY__.urls.push(this.url);
      setTimeout(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); }, 0);
    }
    send(raw) {
      let message;
      try { message = JSON.parse(raw); } catch (error) { return; }
      window.__MOCK_RELAY__.sent.push(message);
      if (message[0] === 'EVENT') {
        const event = message[1];
        window.__MOCK_RELAY__.published.push(event);
        const accepted = window.__MOCK_RELAY__.ok === true;
        if (accepted && window.__MOCK_RELAY__.serveBack) window.__MOCK_RELAY__.events.push(event);
        setTimeout(() => {
          this.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify(['OK', event.id, accepted, accepted ? '' : 'blocked: mock relay refuses everything'])
          }));
        }, 0);
        return;
      }
      if (message[0] !== 'REQ') return;
      const subId = message[1];
      const filters = message.slice(2);
      window.__MOCK_RELAY__.reqs.push({subId, filters});
      const pool = window.__MOCK_RELAY__.events || [];
      const matched = pool.filter(event => filters.some(filter => matchesFilter(filter, event)));
      setTimeout(() => {
        for (const event of matched) {
          this.dispatchEvent(new MessageEvent('message', {data: JSON.stringify(['EVENT', subId, event])}));
        }
        this.dispatchEvent(new MessageEvent('message', {data: JSON.stringify(['EOSE', subId])}));
      }, 0);
    }
    close(code) {
      this.readyState = 3;
      this.dispatchEvent(new CloseEvent('close', {code: typeof code === 'number' ? code : 1000}));
    }
  }
  MockRelaySocket.OPEN = 1;
  window.WebSocket = MockRelaySocket;

  /* The NIP-07 stub. A known hex pubkey and real signing, so every downstream
     check -- the app's own signer-mutated-event comparison and rx-nostr's
     verifier -- runs against bytes a real extension could have produced. */
  let signerPromise = null;
  function signer() {
    // Absolute, not './dist/...': an init script runs in a world whose base URL
    // WebKit will not resolve a relative module specifier against, and the
    // import fails with "unsupported URL" long before any of this is under test.
    if (!signerPromise) signerPromise = import(new URL('dist/rx-nostr-crypto.js', location.href).href).then(module => module.seckeySigner(seckey));
    return signerPromise;
  }
  window.__NOSTR_CALLS__ = [];
  window.nostr = {
    async getPublicKey() {
      window.__NOSTR_CALLS__.push('getPublicKey');
      return (await signer()).getPublicKey();
    },
    async signEvent(draft) {
      window.__NOSTR_CALLS__.push('signEvent');
      // Recorded before signing so a regression to a library-defaulted timestamp
      // (§W3.4) is visible as a missing property rather than as a plausible time.
      window.__SIGN_ARG__ = JSON.parse(JSON.stringify(draft));
      return (await signer()).signEvent(draft);
    }
  };
}

// Backoff is collapsed to keep the test fast; the attempt *count* is left at the
// shipped 3, because that is the number the honesty of `unconfirmed` rests on.
const QUERY = [
  'relay=1',
  `relays=${encodeURIComponent(RELAY_URL)}`,
  'readbackattempts=3',
  'readbackbackoff=0,150,300',
  'publishtimeout=5000'
].join('&');

async function openExplorer(page) {
  await page.addInitScript(installWriteMocks, PUBLISHER_SECKEY);
  // rx-nostr fetches NIP-11 over https on connect; serve it so the relay layer
  // behaves as it does against a real relay.
  await page.route(`${RELAY_URL.replace('wss://', 'https://')}**`, route => route.fulfill({
    status: 200,
    contentType: 'application/nostr+json',
    body: JSON.stringify({name: 'mock relay', supported_nips: [1], limitation: {}})
  }));
  await page.goto(`${EXPLORER}?${QUERY}`);
  // The derived IndexedDB cache survives navigation inside a context, so a
  // leftover winner would otherwise look like a row this test produced.
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

test('a signed-in publisher submits one entry and it comes back as a row carrying the published id', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);

  // §W1.2: no NIP-07 method may be called before a user gesture.
  expect(await page.evaluate(() => window.__NOSTR_CALLS__)).toEqual([]);
  await signIn(page);

  await fillForm(page, {
    dLocal: 'com.example.slice2',
    name: 'Slice Two Tool',
    summary: 'A record published by the write-path skeleton test.',
    homepage: 'https://example.com/slice2',
    topics: 'relay'
  });

  const submit = page.locator('[data-publish-submit]');
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.locator('[data-publish-state]')).toHaveAttribute('data-publish-state', 'published', {timeout: 20_000});

  const publishedId = (await page.locator('[data-publish-event-id]').innerText()).trim();
  expect(publishedId).toMatch(/^[0-9a-f]{64}$/);

  // The relay saw exactly one EVENT, it was the canonical kind, and it is the
  // event whose id the UI is reporting.
  const relay = await page.evaluate(() => ({
    published: window.__MOCK_RELAY__.published.map(event => ({id: event.id, kind: event.kind, tags: event.tags})),
    signArg: window.__SIGN_ARG__,
    calls: window.__NOSTR_CALLS__
  }));
  expect(relay.published).toHaveLength(1);
  expect(relay.published[0].kind).toBe(30078);
  expect(relay.published[0].id).toBe(publishedId);
  // §W3.2: exact tag order, and none of the tags the design refuses to author.
  expect(relay.published[0].tags).toEqual([['d', 'nosmaps:com.example.slice2'], ['t', 'nosmaps'], ['t', 'relay']]);
  // §W3.4: this app set created_at; no library defaulted it.
  expect(Number.isSafeInteger(relay.signArg.created_at)).toBe(true);
  expect(relay.calls).toContain('signEvent');

  // The last link. Not "a row appeared" and not "a row with that name appeared":
  // the row the read path derived has to carry the id we published.
  const row = await page.evaluate(() => {
    const result = window.__NOSMAPS_RELAY_RESULT__;
    const entries = (result && result.entries) || [];
    return entries.map(entry => ({coordinate: entry.coordinate, eventId: entry.eventId, name: entry.fields && entry.fields.name}));
  });
  const mine = row.find(entry => entry.eventId === publishedId);
  expect(mine, `no relay-derived row carried the published id; rows were ${JSON.stringify(row)}`).toBeTruthy();
  expect(mine.name).toBe('Slice Two Tool');

  // ...and it is on screen, not merely in the result object.
  await expect(page.locator('#tool-results article.feature-tool-card:visible', {hasText: 'Slice Two Tool'})).toHaveCount(1);

  // 375x812: an event id and a relay URL are both long unbreakable tokens.
  await page.setViewportSize({width: 375, height: 812});
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow at 375x812').toBeLessThanOrEqual(0);
  expect(await page.locator('body').innerText()).not.toContain('undefined');

  expect(errors, 'console/page errors').toEqual([]);
});

/* issue #12 slice 1: `d` is the coordinate. Editing it after a record is out there does not
   update that record -- it publishes a second, different one (NIP-33). So once publication has
   actually been observed, the field is locked. The attribute is checked first, and then the
   input event is dispatched directly on the element: `readonly` only stops a human, and the
   thing worth guarding is the state transition behind it. */
test('the identifier is locked once the record has been published', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);
  await signIn(page);

  await fillForm(page, {
    dLocal: 'com.example.locked',
    name: 'Locked Identifier Tool',
    summary: 'Published once, so its coordinate is fixed.',
    homepage: '',
    topics: ''
  });
  await page.locator('[data-publish-submit]').click();
  await expect(page.locator('[data-publish-state]')).toHaveAttribute('data-publish-state', 'published', {timeout: 20_000});

  const field = page.locator('#publish-d');
  await expect(field).toHaveAttribute('readonly', /.*/);
  // The note is rendered through i18n, not hardcoded, so it must be a real string.
  const note = (await page.locator('[data-publish-d-note]').innerText()).trim();
  expect(note).not.toBe('');
  expect(note).not.toContain('undefined');

  // Bypass the attribute the way a script (or a devtools-edited DOM) would.
  await page.evaluate(() => {
    const input = document.querySelector('#publish-d');
    input.value = 'com.example.hijacked';
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await expect(field).toHaveValue('com.example.locked');
  expect(errors, 'console/page errors').toEqual([]);
});

/* The regression that the whole design is arranged around (§W5.5, W-I3): a relay
   that acknowledges the event and then never serves it must not produce success.
   Same chain, one link cut at the relay rather than in the app. */
test('an acknowledged but unreadable record is reported as unconfirmed, never as published', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);
  await page.evaluate(() => { window.__MOCK_RELAY__.serveBack = false; });
  await signIn(page);

  await fillForm(page, {
    dLocal: 'com.example.unread',
    name: 'Never Served Back',
    summary: 'The relay says OK and then forgets it.',
    homepage: '',
    topics: ''
  });
  await page.locator('[data-publish-submit]').click();

  await expect(page.locator('[data-publish-state]')).toHaveAttribute('data-publish-state', 'unconfirmed', {timeout: 20_000});
  const panel = await page.locator('#publish-panel').innerText();
  expect(panel).toContain('could not read it back');
  expect(panel).not.toContain('read back.');
  // §W5.6: nothing unconfirmed is painted into the catalog.
  const rows = await page.evaluate(() => ((window.__NOSMAPS_RELAY_RESULT__ || {}).entries || []).map(entry => entry.coordinate));
  expect(rows.some(coordinate => coordinate.includes('com.example.unread'))).toBe(false);
  expect(errors, 'console/page errors').toEqual([]);
});
