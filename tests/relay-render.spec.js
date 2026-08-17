const {test, expect} = require('@playwright/test');

// Regression coverage for the relay -> UI boundary: a verified catalog must reach
// the card list. The bug this pins: relayEntryToTool passed the numeric
// `result.asOf` straight through as `tool.observed`, featureCard then called
// tool.observed.split(' '), renderResults threw, and loadRelayCatalog's catch
// silently degraded the page to the unavailable state.

const EXPLORER = 'nip-explorer.html';
const RELAY_URL = 'wss://mock.relay.test/';
const BLOSSOM_ORIGIN = 'https://blossom.mock.test';
// Any 32-byte scalar works as a secp256k1 secret key; the pubkey is derived in-page.
const SECKEY = '1'.repeat(64);

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

// A relay stand-in at the WebSocket boundary: rx-nostr resolves
// `globalThis.WebSocket` at connect time, so the real relay layer (REQ framing,
// EOSE handling, signature verification via the bundled verifier) still runs.
// Events are served from window.__MOCK_RELAY__.events, set by the test.
function installMockRelay() {
  window.__MOCK_RELAY__ = {events: [], urls: [], sent: []};
  class MockRelaySocket extends EventTarget {
    constructor(url) {
      super();
      this.url = String(url);
      this.readyState = 0;
      window.__MOCK_RELAY__.urls.push(this.url);
      setTimeout(() => {
        this.readyState = 1;
        this.dispatchEvent(new Event('open'));
      }, 0);
    }
    send(raw) {
      let message;
      try { message = JSON.parse(raw); } catch (error) { return; }
      window.__MOCK_RELAY__.sent.push(message);
      if (message[0] !== 'REQ') return;
      const subId = message[1];
      const events = window.__MOCK_RELAY__.events || [];
      setTimeout(() => {
        for (const event of events) {
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
}

// Builds the fixture inside the page so the pointer event and the manifest blob
// are correct by construction: canonical JSON on both sides, `x`/`size` tags equal
// to the blob's real sha256/length, and a real schnorr signature (rx-nostr's
// verifier drops anything else before it reaches the catalog layer).
async function buildFixture(page, entryFields) {
  return page.evaluate(async ({seckey, blossomOrigin, entryFields}) => {
    const C = window.NOSMAPS_CANONICAL;
    const crypto = await import('./dist/rx-nostr-crypto.js');
    const signer = crypto.seckeySigner(seckey);
    const curator = await signer.getPublicKey();

    const nowSec = Math.floor(Date.now() / 1000);
    const author = '2'.repeat(64);
    const entries = entryFields.map((fields, index) => ({
      coordinate: `32267:${author}:tool-${index}`,
      state: 'active',
      event_id: null,
      fields
    }));
    const manifest = {
      schema: 'org.nosmaps.catalog', version: 1, scope: 'global', curator,
      generation: 0, generated_at: nowSec, previous: null, entries
    };
    const bytes = C.canonicalize(manifest);
    const sha256 = await C.sha256Hex(bytes);
    const mirror = `${blossomOrigin}/${sha256}.json`;

    const content = {
      schema: 'org.nosmaps.catalog-pointer', version: 1, state: 'active', scope: 'global',
      generation: 0, sha256, bytes: bytes.length,
      mime: 'application/vnd.nosmaps.catalog+json', entry_count: entries.length,
      generated_at: nowSec, previous: null, mirrors: [mirror]
    };
    const contentStr = new TextDecoder().decode(C.canonicalize(content));
    const tags = [
      ['d', 'nosmaps:catalog:v1:global'],
      ['L', 'org.nosmaps.schema'],
      ['l', 'catalog-pointer', 'org.nosmaps.schema'],
      ['v', '1'],
      ['state', 'active'],
      ['generation', '0'],
      ['x', sha256],
      ['size', String(bytes.length)],
      ['m', content.mime],
      ['count', String(entries.length)],
      ['generated_at', String(nowSec)],
      ['url', mirror]
    ];
    const event = await signer.signEvent({kind: 30078, content: contentStr, tags, created_at: nowSec});

    return {event, mirror, sha256, manifestBytes: Array.from(bytes), entryCount: entries.length};
  }, {seckey: SECKEY, blossomOrigin: BLOSSOM_ORIGIN, entryFields});
}

test('relay-verified catalog entries render as tool cards', async ({page}) => {
  const errors = collectErrors(page);
  await page.addInitScript(installMockRelay);
  // rx-nostr fetches the relay's NIP-11 document over https on connect; serve it
  // so the relay layer behaves exactly as it does against a real relay.
  await page.route(`${RELAY_URL.replace('wss://', 'https://')}**`, route => route.fulfill({
    status: 200,
    contentType: 'application/nostr+json',
    body: JSON.stringify({name: 'mock relay', supported_nips: [1], limitation: {}})
  }));
  // No `relay=1`: the load is triggered explicitly below, after the mocks hold
  // the fixture. `relays` pins the request to the mock relay so no real socket
  // URL is ever used.
  await page.goto(`${EXPLORER}?relays=${encodeURIComponent(RELAY_URL)}`);

  const entryFields = [
    {name: 'Mock Client', category: 'clients', summary: 'relay-derived client entry'},
    {name: 'Mock Relay', category: 'relay', summary: 'relay-derived relay entry'},
    {name: 'Mock Signer', category: 'identity', summary: 'relay-derived signer entry'}
  ];
  const fixture = await buildFixture(page, entryFields);
  const expectedCount = entryFields.length;
  expect(fixture.entryCount).toBe(expectedCount);

  // Blossom mirror: served over real HTTP with the exact canonical bytes the
  // pointer commits to, so verifyManifestBytes does the real size/hash/canonical check.
  await page.route(`${BLOSSOM_ORIGIN}/*`, route => route.fulfill({
    status: 200,
    contentType: 'application/vnd.nosmaps.catalog+json',
    body: Buffer.from(fixture.manifestBytes)
  }));

  const result = await page.evaluate(async event => {
    window.__MOCK_RELAY__.events = [event];
    const loaded = await window.__NOSMAPS_RELAY_LOAD__();
    return loaded ? {status: loaded.status, entries: loaded.entries.length, asOfType: typeof loaded.asOf} : null;
  }, fixture.event);

  const cards = page.locator('#tool-results article.feature-tool-card:visible');
  await expect(cards).toHaveCount(expectedCount);
  await expect(page.locator('#result-count')).toHaveText(String(expectedCount));
  await expect(page.locator('.state-message.unavailable')).toHaveCount(0);
  await expect(page.locator('#ui-state-view')).not.toContainText('No verified catalog could be shown');
  await expect(cards.first().locator('h2')).toHaveText('Mock Client');
  // data.js contract: `observed` is "YYYY-MM-DD HH:MM UTC", so the card shows the date part.
  const observed = await cards.first().locator('.tool-facts div').last().locator('dd').textContent();
  expect(observed).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  expect(errors).toEqual([]);

  expect(result).not.toBeNull();
  expect(result.status).toBe('fresh');
  expect(result.entries).toBe(expectedCount);
  // The numeric asOf is the input the string `observed` contract has to absorb.
  expect(result.asOfType).toBe('number');
});
