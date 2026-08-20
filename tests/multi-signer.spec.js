/* issue #18: several signers holding a record under the same identifier.

   Phase 1 is the read side only — nothing here publishes, and nothing here
   rewrites a signed `d`. What is guarded:

   - two signers at one `d` are two coordinates, and neither is discarded;
   - records sharing a `d` are stacked, and a one-byte-different `d` is not;
   - a stack names no default (D1). The type carries no `displayed` / `primary` /
     `default`, and no collector key has standing in it;
   - the drawn cap is 3, but the count stated is the real total, and every record
     stays reachable.

   The pure parts are driven through NOSMAPS_CATALOG, the same diagnostic surface
   the other specs use. The rendered part runs against the mock relay so real
   signature verification still happens. */

const {test, expect} = require('@playwright/test');

const EXPLORER = 'nip-explorer.html';
const RELAY_URL = 'wss://mock.relay.test/';
// Five signers, so a single `d` can be observed with more records than the
// drawing cap of 3. Any 32-byte scalar is a usable secp256k1 secret key.
const KEYS = {
  signerA: '11'.repeat(32),
  signerB: '22'.repeat(32),
  signerC: '33'.repeat(32),
  signerD: '44'.repeat(32),
  signerE: '55'.repeat(32)
};

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

// Same WebSocket stand-in as relay-render.spec.js: rx-nostr resolves
// globalThis.WebSocket at connect time, so the real relay layer (REQ framing,
// EOSE, signature verification) still runs against these fixtures.
function installMockRelay() {
  window.__MOCK_RELAY__ = {events: [], urls: [], sent: [], reqs: []};

  function matchesFilter(filter, event) {
    if (Array.isArray(filter.kinds) && filter.kinds.indexOf(event.kind) === -1) return false;
    if (Array.isArray(filter.ids) && filter.ids.indexOf(event.id) === -1) return false;
    if (Array.isArray(filter.authors) && filter.authors.indexOf(event.pubkey) === -1) return false;
    if (typeof filter.since === 'number' && event.created_at < filter.since) return false;
    if (typeof filter.until === 'number' && event.created_at > filter.until) return false;
    for (const key of Object.keys(filter)) {
      if (key.charAt(0) !== '#') continue;
      const indexed = (event.tags || []).filter(tag => tag[0] === key.slice(1)).map(tag => tag[1]);
      if (!indexed.some(value => filter[key].indexOf(value) !== -1)) return false;
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
      if (message[0] !== 'REQ') return;
      const subId = message[1];
      const filters = message.slice(2);
      window.__MOCK_RELAY__.reqs.push({subId, filters});
      const matched = (window.__MOCK_RELAY__.events || [])
        .filter(event => filters.some(filter => matchesFilter(filter, event)));
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
}

// Five signed records: A..E all write the SAME `d`, and A additionally writes a
// second `d` that differs from it by one byte. Every event is signed in-page so
// rx-nostr's verifier has to accept it (invariant I1).
const SHARED_SLUG = 'com.example.shared';
const NEIGHBOUR_SLUG = 'com.example.share';

async function buildFixtures(page) {
  return page.evaluate(async ({keys, sharedSlug, neighbourSlug}) => {
    const crypto = await import('./dist/rx-nostr-crypto.js');
    const signers = {};
    const pubkeys = {};
    for (const name of Object.keys(keys)) {
      signers[name] = crypto.seckeySigner(keys[name]);
      pubkeys[name] = await signers[name].getPublicKey();
    }
    const now = Math.floor(Date.now() / 1000);
    const events = [];
    // The prefix is written literally rather than read from the constant, so a
    // change to the constant surfaces as a failure instead of being followed.
    const D = slug => `nosmaps:${slug}`;

    async function software(signer, slug, over) {
      const content = {
        schema: 'org.nosmaps.software', version: 1, state: 'active',
        name: over.name, summary: over.summary, homepage: `https://example.com/${slug}`
      };
      const tags = [['d', D(slug)], ['t', 'nosmaps'], ['state', content.state], ['v', '1']];
      const event = await signers[signer].signEvent({
        kind: 30078, content: JSON.stringify(content), tags, created_at: now - over.age
      });
      events.push(event);
      return event;
    }

    // Ages are all different, so `collected-desc` has a strict order to state.
    await software('signerA', sharedSlug, {name: 'Shared Tool', summary: 'A says: a relay client.', age: 500});
    await software('signerB', sharedSlug, {name: 'Shared Tool', summary: 'B says: a relay client, renamed upstream.', age: 400});
    await software('signerC', sharedSlug, {name: 'Shared Tool', summary: 'C says: the homepage moved.', age: 300});
    await software('signerD', sharedSlug, {name: 'Shared Tool', summary: 'D says: still maintained.', age: 200});
    await software('signerE', sharedSlug, {name: 'Shared Tool', summary: 'E says: packaged for android.', age: 100});
    // One byte away from the shared `d`. It must never join that stack.
    await software('signerA', neighbourSlug, {name: 'Neighbour Tool', summary: 'A different identifier.', age: 600});

    return {
      events, pubkeys,
      d: {shared: D(sharedSlug), neighbour: D(neighbourSlug)},
      coordinates: Object.keys(pubkeys).map(name => `30078:${pubkeys[name]}:${D(sharedSlug)}`)
    };
  }, {keys: KEYS, sharedSlug: SHARED_SLUG, neighbourSlug: NEIGHBOUR_SLUG});
}

async function loadRelayCatalog(page) {
  await page.addInitScript(installMockRelay);
  await page.route(`${RELAY_URL.replace('wss://', 'https://')}**`, route => route.fulfill({
    status: 200,
    contentType: 'application/nostr+json',
    body: JSON.stringify({name: 'mock relay', supported_nips: [1], limitation: {}})
  }));
  await page.goto(`${EXPLORER}?relays=${encodeURIComponent(RELAY_URL)}`);
  const fixtures = await buildFixtures(page);
  await page.evaluate(() => window.NOSMAPS_CATALOG.cache.wipe());
  const result = await page.evaluate(async events => {
    window.__MOCK_RELAY__.events = events;
    return window.__NOSMAPS_RELAY_LOAD__({});
  }, fixtures.events);
  return {fixtures, result, cards: page.locator('#tool-results article.feature-tool-card:visible')};
}

// ---- domain: winners ------------------------------------------------------

test('two signers at the same d produce two winners, and neither is discarded', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const CAT = window.NOSMAPS_CATALOG;
    const now = 1787000000;
    const record = (pubkey, id, over) => ({
      id, pubkey, kind: 30078, created_at: now - over.age, sig: 'f'.repeat(128),
      tags: [['d', over.d], ['t', 'nosmaps'], ['state', 'active'], ['v', '1']],
      content: JSON.stringify({
        schema: 'org.nosmaps.software', version: 1, state: 'active',
        name: over.name, summary: 'x', homepage: 'https://example.com/x'
      })
    });
    const d = 'nosmaps:com.example.shared';
    const events = [
      record('1'.repeat(64), 'a'.repeat(64), {d, name: 'From A', age: 200}),
      record('2'.repeat(64), 'b'.repeat(64), {d, name: 'From B', age: 100})
    ];
    const out = CAT.selectSoftwareWinners(events, {nowSec: now, receivedAtSec: now});
    return {
      coordinates: out.winners.map(w => w.coordinate),
      names: out.winners.map(w => w.record.name).sort(),
      ds: [...new Set(out.winners.map(w => w.record.d))],
      quarantined: out.quarantined.length
    };
  });
  expect(r.coordinates).toHaveLength(2);
  expect(new Set(r.coordinates).size).toBe(2);
  expect(r.names).toEqual(['From A', 'From B']);
  // Two coordinates, one identifier: that is exactly the situation issue #18 is about.
  expect(r.ds).toEqual(['nosmaps:com.example.shared']);
  expect(r.quarantined).toBe(0);
  expect(errors).toEqual([]);
});

// ---- domain: stacking -----------------------------------------------------

test('records sharing a d are stacked, and a d that differs by one byte is never stacked', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {stackRecords} = window.NOSMAPS_CATALOG;
    const rows = [
      {id: 'r1', d: 'nosmaps:com.example.shared'},
      {id: 'r2', d: 'nosmaps:com.example.shared'},
      {id: 'r3', d: 'nosmaps:com.example.share'},
      {id: 'r4', d: ''},
      {id: 'r5'}
    ];
    const stacks = stackRecords(rows, row => row.d, true);
    return stacks.map(stack => ({d: stack.d, ids: stack.records.map(row => row.id), observed: stack.observed}));
  });
  expect(r).toEqual([
    {d: 'nosmaps:com.example.shared', ids: ['r1', 'r2'], observed: 2},
    {d: 'nosmaps:com.example.share', ids: ['r3'], observed: 1}
  ]);
  expect(errors).toEqual([]);
});

test('a stack never designates a default record', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {stackRecords} = window.NOSMAPS_CATALOG;
    const collector = '3ce2f3e7dc1dfc7cab278e57d75384c7fcf6ad768ed189acba3b80fe4aa782b6';
    const rows = [
      {id: 'r1', d: 'nosmaps:x', pubkey: 'a'.repeat(64)},
      {id: 'r2', d: 'nosmaps:x', pubkey: collector}
    ];
    const [stack] = stackRecords(rows, row => row.d, true);
    return {keys: Object.keys(stack).sort(), order: stack.records.map(row => row.id)};
  });
  // D1: no field on the stack elects one record. Re-introducing a representative
  // (displayed / primary / default / chosen / winner) fails here.
  expect(r.keys).toEqual(['complete', 'd', 'observed', 'records']);
  for (const forbidden of ['displayed', 'displayedBy', 'primary', 'default', 'chosen', 'winner', 'others']) {
    expect(r.keys).not.toContain(forbidden);
  }
  // The collector key came in second and stays second: it buys no standing.
  expect(r.order).toEqual(['r1', 'r2']);
  expect(errors).toEqual([]);
});

test('the stack order follows the order handed in, so it follows the active sort key and nothing else', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {stackRecords, sortRows} = window.NOSMAPS_CATALOG;
    const rows = [
      {id: 'r1', name: 'A', d: 'nosmaps:x', likes: 1, collectedAt: 300},
      {id: 'r2', name: 'B', d: 'nosmaps:x', likes: 9, collectedAt: 100},
      {id: 'r3', name: 'C', d: 'nosmaps:x', likes: 5, collectedAt: 200}
    ];
    const stackFor = key => {
      const sorted = sortRows(rows, key);
      const [stack] = stackRecords([...sorted.ranked, ...sorted.unranked], row => row.d, true);
      return stack.records.map(row => row.id);
    };
    // I4: the same sort key over a permuted input yields the same stack order.
    const permuted = sortRows([rows[2], rows[0], rows[1]], 'likes-desc');
    const [permutedStack] = stackRecords([...permuted.ranked, ...permuted.unranked], row => row.d, true);
    return {
      likesDesc: stackFor('likes-desc'),
      likesAsc: stackFor('likes-asc'),
      collectedDesc: stackFor('collected-desc'),
      permuted: permutedStack.records.map(row => row.id)
    };
  });
  expect(r.likesDesc).toEqual(['r2', 'r3', 'r1']);
  expect(r.likesAsc).toEqual(['r1', 'r3', 'r2']);
  expect(r.collectedDesc).toEqual(['r1', 'r3', 'r2']);
  expect(r.permuted).toEqual(r.likesDesc);
  expect(errors).toEqual([]);
});

test('observed equals the number of records, and complete is only what the caller observed', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const r = await page.evaluate(() => {
    const {stackRecords, drawnRecords, STACK_DRAWN_LIMIT} = window.NOSMAPS_CATALOG;
    const rows = [1, 2, 3, 4, 5].map(n => ({id: `r${n}`, d: 'nosmaps:x'}));
    const [complete] = stackRecords(rows, row => row.d, true);
    const [incomplete] = stackRecords(rows, row => row.d, false);
    return {
      observed: complete.observed,
      records: complete.records.length,
      completeFlag: complete.complete,
      incompleteFlag: incomplete.complete,
      drawn: drawnRecords(complete).map(row => row.id),
      limit: STACK_DRAWN_LIMIT,
      reachable: complete.records.map(row => row.id)
    };
  });
  expect(r.observed).toBe(5);
  expect(r.records).toBe(5);
  expect(r.completeFlag).toBe(true);
  expect(r.incompleteFlag).toBe(false);
  // The cap is a drawing limit, not a count: 3 drawn, 5 observed, 5 reachable.
  expect(r.limit).toBe(3);
  expect(r.drawn).toEqual(['r1', 'r2', 'r3']);
  expect(r.reachable).toEqual(['r1', 'r2', 'r3', 'r4', 'r5']);
  expect(r.observed).not.toBe(r.drawn.length);
  expect(errors).toEqual([]);
});

// ---- relay -> row ---------------------------------------------------------

test('a relay row carries the record d, so two signers at one identifier are one identifier', async ({page}) => {
  const errors = collectErrors(page);
  const {fixtures, result, cards} = await loadRelayCatalog(page);
  expect(result).not.toBeNull();
  expect(result.status).toBe('fresh');
  await expect(cards).toHaveCount(6);
  const r = await page.evaluate(() => {
    const rows = window.__NOSMAPS_RELAY_ROWS__();
    return rows.map(row => ({id: row.id, d: row.d, coordinate: row.coordinate}));
  });
  const shared = r.filter(row => row.d === fixtures.d.shared);
  expect(shared).toHaveLength(5);
  expect(new Set(shared.map(row => row.coordinate)).size).toBe(5);
  expect(new Set(shared.map(row => row.id)).size).toBe(5);
  expect(r.filter(row => row.d === fixtures.d.neighbour)).toHaveLength(1);
  expect(errors).toEqual([]);
});

// ---- render ---------------------------------------------------------------

test('at most three cards are drawn for one identifier, the stated count is the real total, and every record is still reachable', async ({page}) => {
  const errors = collectErrors(page);
  const {fixtures, cards} = await loadRelayCatalog(page);
  await expect(cards).toHaveCount(6);
  const stacked = page.locator(`#tool-results article.feature-tool-card[data-stack-d="${fixtures.d.shared}"]`);
  await expect(stacked).toHaveCount(5);
  const observed = await stacked.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-stack-observed')));
  // The count on every card is the real total, never the drawn cap.
  expect(observed).toEqual(['5', '5', '5', '5', '5']);
  const drawn = await stacked.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-stack-drawn')));
  expect(drawn.filter(value => value === 'yes')).toHaveLength(3);
  expect(drawn.filter(value => value === 'no')).toHaveLength(2);
  // Reachability: the two undrawn ones are real rows on the page, not dropped.
  const positions = await stacked.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-stack-position')));
  expect(positions.sort()).toEqual(['0', '1', '2', '3', '4']);
  expect(errors).toEqual([]);
});

test('a lone record is not stacked and carries no count', async ({page}) => {
  const errors = collectErrors(page);
  const {fixtures} = await loadRelayCatalog(page);
  const lone = page.locator(`#tool-results article.feature-tool-card[data-stack-d="${fixtures.d.neighbour}"]`);
  // M2.2-4: one record is a flat card. Printing "1 record" on every row is noise.
  await expect(lone).toHaveCount(0);
  const all = await page.locator('#tool-results article.feature-tool-card').evaluateAll(
    nodes => nodes.filter(node => node.hasAttribute('data-stack-observed')).length
  );
  expect(all).toBe(5);
  expect(errors).toEqual([]);
});
