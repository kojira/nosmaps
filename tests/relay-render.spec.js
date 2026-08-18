const {test, expect} = require('@playwright/test');

// Regression coverage for the relay -> UI boundary under revision 2 of
// design-relay-native-data.md: signature-valid kind 32267 winners must reach the
// card list; kind 30267 curation must only reorder and count; and nothing the
// relays did not serve may appear as a value.

const EXPLORER = 'nip-explorer.html';
const RELAY_URL = 'wss://mock.relay.test/';
// Any 32-byte scalar works as a secp256k1 secret key; pubkeys are derived in-page.
const KEYS = {
  publisherP: '11'.repeat(32),
  publisherQ: '22'.repeat(32),
  curatorA: '33'.repeat(32),
  curatorB: '44'.repeat(32),
  viewer: '55'.repeat(32)
};

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

// A relay stand-in at the WebSocket boundary: rx-nostr resolves
// `globalThis.WebSocket` at connect time, so the real relay layer (REQ framing,
// EOSE handling, signature verification via the bundled verifier) still runs.
// This mock *applies the filters* it is sent, including NIP-01 single-letter tag
// indexing, so R1's `#t` discovery, R2's `authors` array and R3's `#d` recall
// fetch are genuinely exercised rather than short-circuited.
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
}

// Every fixture is built and signed inside the page, so rx-nostr's verifier — the
// only place signatures are checked (invariant I1) — has to accept it.
async function buildFixtures(page, keys) {
  return page.evaluate(async (keys) => {
    const crypto = await import('./dist/rx-nostr-crypto.js');
    const signers = {};
    const pubkeys = {};
    for (const name of Object.keys(keys)) {
      signers[name] = crypto.seckeySigner(keys[name]);
      pubkeys[name] = await signers[name].getPublicKey();
    }
    const now = Math.floor(Date.now() / 1000);
    const events = [];

    // §4.2 rule 1b: our `d` values are namespaced. The prefix is written out
    // literally here rather than read from NOSMAPS_CATALOG, so a change to the
    // constant shows up as a test failure instead of following it silently.
    const D = slug => `nosmaps:${slug}`;
    const coord = (pub, slug) => `32267:${pub}:${D(slug)}`;

    async function software(signer, slug, over) {
      over = over || {};
      const content = Object.assign({
        schema: 'org.nosmaps.software', version: 1, state: 'active',
        name: over.name, summary: over.summary || `${over.name} summary`,
        homepage: `https://example.com/${slug}`
      }, over.content || {});
      const tags = [['d', D(slug)]];
      for (const topic of (over.topics || ['nosmaps'])) tags.push(['t', topic]);
      tags.push(['state', content.state], ['v', '1']);
      const event = await signers[signer].signEvent({
        kind: 32267, content: over.rawContent || JSON.stringify(content), tags,
        created_at: now - over.age
      });
      events.push(event);
      return event;
    }

    async function set(signer, d, members, age) {
      const tags = [['d', d], ['title', 'My nostr app selection']];
      for (const member of members) tags.push(['a', member]);
      const event = await signers[signer].signEvent({kind: 30267, content: '', tags, created_at: now - age});
      events.push(event);
      return event;
    }

    const P = pubkeys.publisherP;
    const Q = pubkeys.publisherQ;

    const client = await software('publisherP', 'com.example.client', {name: 'Mock Client', age: 300});
    const relay = await software('publisherP', 'com.example.relay', {name: 'Mock Relay', age: 200, topics: ['nosmaps', 'relay']});
    const signer = await software('publisherQ', 'com.example.signer', {name: 'Mock Signer', age: 100});
    // §6.6 recall: no discovery topic at all, so §5.1 can never see it. It is
    // reachable only because a pubkey in the viewer's graph recommends it and
    // §5.2 then fetches it exactly by coordinate in R3.
    const untagged = await software('publisherP', 'com.example.untagged', {name: 'Untagged Recall', age: 400, topics: []});
    // §7.1 publisher retraction: an older active version plus a newer withdrawn one.
    await software('publisherP', 'com.example.gone', {name: 'Gone Tool', age: 500});
    await software('publisherP', 'com.example.gone', {name: 'Gone Tool', age: 50, content: {state: 'withdrawn', summary: 'No longer maintained.'}});
    // §7.3 cleanup: a valid same-author kind 5 covering this coordinate.
    const dead = await software('publisherQ', 'com.example.dead', {name: 'Deleted Tool', age: 600});
    // §4.2 foreign 32267, separation 2: signature-valid and inside our `d`
    // namespace, but another application's content profile — so only the schema
    // check stops it. (Separation 1, a foreign `d` prefix, is covered against real
    // relay events in relay-unit.spec.js.)
    await software('publisherQ', 'com.other.app', {name: 'Foreign', age: 700, rawContent: JSON.stringify({schema: 'com.other.app', version: 3, title: 'Foreign app'})});

    events.push(await signers.publisherQ.signEvent({
      kind: 5, content: 'cleanup',
      tags: [['a', coord(Q, 'com.example.dead')], ['k', '32267']],
      created_at: now - 10
    }));

    await set('curatorA', 'nostr', [coord(P, 'com.example.untagged'), coord(P, 'com.example.client')], 90);
    await set('curatorB', 'nostr', [coord(P, 'com.example.client')], 80);
    // A recommended coordinate nobody published: §5.4 says it must never become a row.
    await set('curatorB', 'extras', [coord(Q, 'com.example.ghost')], 70);

    events.push(await signers.viewer.signEvent({
      kind: 3, content: '',
      tags: [['p', pubkeys.curatorA, 'wss://mock.relay.test/'], ['p', pubkeys.curatorB]],
      created_at: now - 60
    }));

    return {
      events,
      pubkeys,
      coordinates: {
        client: coord(P, 'com.example.client'),
        relay: coord(P, 'com.example.relay'),
        signer: coord(Q, 'com.example.signer'),
        untagged: coord(P, 'com.example.untagged'),
        gone: coord(P, 'com.example.gone'),
        dead: coord(Q, 'com.example.dead'),
        ghost: coord(Q, 'com.example.ghost')
      },
      ids: {client: client.id, relay: relay.id, signer: signer.id, untagged: untagged.id, dead: dead.id}
    };
  }, keys);
}

// Loads the explorer against the mock relay and runs one cold catalog round.
async function loadRelayCatalog(page, options) {
  options = options || {};
  const httpRequests = [];
  await page.addInitScript(installMockRelay);
  // rx-nostr fetches the relay's NIP-11 document over https on connect; serve it
  // so the relay layer behaves exactly as it does against a real relay.
  await page.route(`${RELAY_URL.replace('wss://', 'https://')}**`, route => route.fulfill({
    status: 200,
    contentType: 'application/nostr+json',
    body: JSON.stringify({name: 'mock relay', supported_nips: [1], limitation: {}})
  }));
  page.on('request', request => { if (/^https?:/.test(request.url())) httpRequests.push(request.url()); });

  const query = [`relays=${encodeURIComponent(RELAY_URL)}`];
  if (options.curators) query.push(`curators=${encodeURIComponent(options.curators)}`);
  await page.goto(`${EXPLORER}?${query.join('&')}`);

  const fixtures = await buildFixtures(page, KEYS);
  // Every measured load is a genuine empty-cache rebuild (§8.4): the derived
  // IndexedDB cache survives navigation inside one browser context, so a leftover
  // winner from an earlier load would otherwise show up as a stale row.
  await page.evaluate(() => window.NOSMAPS_CATALOG.cache.wipe());

  const result = await page.evaluate(async ({events, loadOptions}) => {
    window.__MOCK_RELAY__.events = events;
    window.__MOCK_RELAY__.reqs = [];
    window.__MOCK_RELAY__.sent = [];
    const loaded = await window.__NOSMAPS_RELAY_LOAD__(loadOptions);
    return {result: loaded, reqs: window.__MOCK_RELAY__.reqs};
  }, {events: fixtures.events, loadOptions: options.load || {}});

  return {
    fixtures,
    result: result.result,
    reqs: result.reqs,
    httpRequests,
    cards: page.locator('#tool-results article.feature-tool-card:visible')
  };
}

// The viewer key, so the load runs with graph: tier1.
async function viewerHex(page) {
  return page.evaluate(async seckey => {
    const crypto = await import('./dist/rx-nostr-crypto.js');
    return crypto.seckeySigner(seckey).getPublicKey();
  }, KEYS.viewer);
}

test('relay-observed 32267 winners render as tool cards, ordered by recommendation count', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const viewer = await viewerHex(page);
  const {result, cards} = await loadRelayCatalog(page, {load: {viewerPubkey: viewer}});

  expect(result).not.toBeNull();
  expect(result.status).toBe('fresh');
  expect(result.graph.state).toBe('tier1');
  // Two curators followed, plus the viewer themselves: |G| = 3.
  expect(result.graph.pubkeys).toHaveLength(3);
  // §6.4 ordering key: (rec1 DESC, created_at DESC, id ASC).
  expect(result.entries.map(entry => entry.fields.name)).toEqual(['Mock Client', 'Untagged Recall', 'Mock Signer', 'Mock Relay']);
  expect(result.entries.map(entry => entry.recommendations)).toEqual([2, 1, 0, 0]);

  await expect(cards).toHaveCount(4);
  await expect(page.locator('#result-count')).toHaveText('4');
  await expect(cards.first().locator('h2')).toHaveText('Mock Client');
  await expect(page.locator('.state-message.unavailable')).toHaveCount(0);
  // data.js contract: `observed` is "YYYY-MM-DD HH:MM UTC", so the card shows the date part.
  const observed = await cards.first().locator('.tool-facts div').last().locator('dd').textContent();
  expect(observed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  // The numeric asOf is the input the string `observed` contract has to absorb.
  expect(typeof result.asOf).toBe('number');
  expect(errors).toEqual([]);
});

test('a withdrawn winner, a deleted coordinate, and a foreign profile never become rows', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const viewer = await viewerHex(page);
  const {fixtures, result, cards} = await loadRelayCatalog(page, {load: {viewerPubkey: viewer}});

  const coordinates = result.entries.map(entry => entry.coordinate);
  // §7.1: the newer valid withdrawn winner suppresses the row.
  expect(coordinates).not.toContain(fixtures.coordinates.gone);
  // §7.3: a valid same-author kind 5 covering the coordinate suppresses it.
  expect(coordinates).not.toContain(fixtures.coordinates.dead);
  // §5.4: a recommended coordinate nobody published is unresolved, not a row.
  expect(coordinates).not.toContain(fixtures.coordinates.ghost);
  expect(result.unresolved).toEqual([fixtures.coordinates.ghost]);

  const quarantined = result.quarantined.map(item => item.reason);
  // §4.2: another application's 32267 is quarantined with a reason, retained, and
  // never reported as nonexistent.
  expect(quarantined).toContain('foreign-profile');
  expect(quarantined).toContain('deleted');

  await expect(cards).toHaveCount(4);
  for (const name of await cards.locator('h2').allTextContents()) {
    expect(name).not.toBe('Gone Tool');
    expect(name).not.toBe('Deleted Tool');
    expect(name).not.toBe('Foreign');
  }

  // Both are inspectable in diagnostics rather than silently dropped.
  await page.locator('#relay-diagnostics summary').click();
  const quarantineList = page.locator('#relay-diagnostics section').filter({hasText: 'Quarantined'}).locator('li');
  await expect(quarantineList.filter({hasText: 'foreign-profile'})).toHaveCount(1);
  const unresolvedList = page.locator('#relay-diagnostics section').filter({hasText: 'Recommended but unobserved'}).locator('li');
  await expect(unresolvedList.filter({hasText: fixtures.coordinates.ghost})).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('curation only adds recall and reorders: logged out never loses a topic-carrying row', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const viewer = await viewerHex(page);

  const loggedIn = await loadRelayCatalog(page, {load: {viewerPubkey: viewer}});
  const withGraph = loggedIn.result.entries.map(entry => entry.coordinate).slice().sort();

  const loggedOut = await loadRelayCatalog(page, {load: {viewerPubkey: ''}});
  const noGraph = loggedOut.result.entries.map(entry => entry.coordinate).slice().sort();

  expect(loggedOut.result.graph.state).toBe('none');
  // I7 / §6.6: changing G never removes a row. Every row the graph-less load found
  // is still there with a graph, and the only difference is the recall record that
  // publishes no discovery topic and is therefore invisible to §5.1 by construction.
  for (const coordinate of noGraph) expect(withGraph).toContain(coordinate);
  expect(withGraph.filter(coordinate => noGraph.indexOf(coordinate) === -1))
    .toEqual([loggedIn.fixtures.coordinates.untagged]);
  expect(noGraph).toHaveLength(3);

  // Only ordering and counts differ. Logged out: created_at DESC.
  expect(loggedOut.result.entries.map(entry => entry.fields.name)).toEqual(['Mock Signer', 'Mock Relay', 'Mock Client']);
  expect(loggedOut.result.entries.map(entry => entry.recommendations)).toEqual([null, null, null]);
  expect(errors).toEqual([]);
});

test('no graph: counts render as unknown, never zero, and the banner names both remedies', async ({page}) => {
  const errors = collectErrors(page);
  const {cards} = await loadRelayCatalog(page);

  await expect(cards).toHaveCount(3);
  const banner = page.locator('.graph-banner[data-graph-state="none"]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Not personalised');
  await expect(banner).toContainText('Connect a Nostr key');
  await expect(banner).toContainText('paste an npub');
  await expect(banner.locator('[data-graph-connect]')).toBeVisible();
  await expect(banner.locator('#graph-npub')).toBeVisible();

  // I8: an unknown count is rendered distinctly from a zero count.
  const counts = cards.locator('.recommendation-count');
  await expect(counts).toHaveCount(3);
  for (const label of await counts.allTextContents()) {
    expect(label).toContain('unknown');
    expect(label).not.toMatch(/\d/);
  }
  await expect(counts.first()).toHaveAttribute('data-recommendations', 'unknown');
  await expect(counts.first().locator('.no-support-record')).toHaveAttribute('aria-label', 'Unknown');

  // D10 / §5.1 rule 5: discovery results are labelled, never presented as "all tools".
  const scope = page.locator('[data-discovery-scope]');
  await expect(scope).toBeVisible();
  await expect(scope).toContainText('nosmaps');
  await expect(scope).toContainText('not all tools');
  expect(errors).toEqual([]);
});

test('pasting an npub in the banner ranks in read-only mode and turns unknown counts into real ones', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const viewer = await viewerHex(page);
  const {cards} = await loadRelayCatalog(page);
  await expect(cards.locator('.recommendation-count.is-unknown')).toHaveCount(3);

  await page.fill('#graph-npub', viewer);
  await page.click('[data-graph-apply]');

  await expect(cards).toHaveCount(4);
  await expect(page.locator('.graph-banner')).toHaveCount(0);
  const graphState = page.locator('.graph-state');
  await expect(graphState).toContainText('tier1');
  await expect(graphState).toContainText('3 of 3 in your graph');
  // A real zero is informative and renders as a number, not as "—".
  const counts = await cards.locator('.recommendation-count').allTextContents();
  expect(counts[0]).toBe('Recommended by 2 in your network');
  expect(counts[3]).toBe('Recommended by 0 in your network');
  await expect(cards.locator('.recommendation-count.is-unknown')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the cold catalog costs 3 logical REQ per relay and 0 HTTP, with no per-curator request', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const viewer = await viewerHex(page);
  const {result, reqs, httpRequests} = await loadRelayCatalog(page, {load: {viewerPubkey: viewer}});

  // §9.2: three logical rounds per relay, and physical REQs only via §9.4 chunking.
  expect(result.rounds.map(round => round.label)).toEqual(['r1', 'r2', 'r3']);
  expect(result.rounds.map(round => round.logicalReqs)).toEqual([1, 1, 1]);
  expect(result.stats.logicalReqs).toBe(3);
  expect(result.stats.physicalReqs).toBe(3);
  expect(result.stats.httpAttempts).toBe(0);
  // One REQ message per round actually reached the socket.
  expect(reqs).toHaveLength(3);

  // R1: discovery by #t plus the viewer's kind 3, in one REQ.
  expect(reqs[0].filters).toHaveLength(2);
  expect(reqs[0].filters[0]).toMatchObject({kinds: [32267], '#t': ['nosmaps'], limit: 500});
  expect(reqs[0].filters[1]).toMatchObject({kinds: [3], authors: [viewer], limit: 1});
  // R2: every pubkey in G is an array element, not a filter. This is the whole point.
  expect(reqs[1].filters).toHaveLength(1);
  expect(reqs[1].filters[0].kinds).toEqual([30267]);
  expect(reqs[1].filters[0].authors).toHaveLength(3);
  // R3: author-grouped #d recall plus exactly one coalesced kind-5 cleanup filter.
  const kindFive = reqs[2].filters.filter(filter => filter.kinds && filter.kinds[0] === 5);
  expect(kindFive).toHaveLength(1);
  // Two coordinates were learned from R2 sets and not returned by R1's topic
  // query, under two different publishers, so §5.2 grouping yields two filters —
  // both inside the same single REQ.
  const recall = reqs[2].filters.filter(filter => filter.kinds && filter.kinds[0] === 32267);
  expect(recall).toHaveLength(2);
  for (const filter of recall) expect(filter.authors).toHaveLength(1);
  // §4.2 rule 1b: the recall filter carries the whole namespaced `d`, prefix
  // included — a bare `com.example.ghost` would match another app's record.
  expect(recall.flatMap(filter => filter['#d']).sort())
    .toEqual(['nosmaps:com.example.ghost', 'nosmaps:com.example.untagged']);

  // No per-curator, per-tool, per-card, or per-event REQ anywhere: 6 filters, 3 REQs.
  const allFilters = reqs.flatMap(req => req.filters);
  expect(allFilters).toHaveLength(6);

  // §9.2: zero HTTP in the catalog data path. The only non-origin HTTP request is
  // rx-nostr's NIP-11 document fetch on connect, which cannot affect listability.
  const foreign = httpRequests.filter(url => !url.startsWith('http://127.0.0.1:') && !url.startsWith('https://mock.relay.test/'));
  expect(foreign).toEqual([]);
  expect(httpRequests.filter(url => /blossom|\.json$/.test(url))).toEqual([]);
  expect(errors).toEqual([]);
});

test('relay-derived cards invent no like count, category, OS, or URL', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const viewer = await viewerHex(page);
  const {cards} = await loadRelayCatalog(page, {load: {viewerPubkey: viewer}});
  await expect(cards).toHaveCount(4);

  // A relay entry carries no like count: no number is derived from the id shape.
  const likeButtons = cards.locator('[data-like-tool]');
  for (const label of await likeButtons.allTextContents()) expect(label).not.toMatch(/\d/);
  await expect(likeButtons.first()).toHaveText('♥ —');
  await expect(likeButtons.first().locator('.no-support-record')).toHaveAttribute('aria-label', 'Unknown');
  await likeButtons.first().click();
  await expect(cards.locator('[data-like-tool]').first()).toHaveText('♥ —');
  await expect(cards.locator('[data-like-tool]').first()).toHaveAttribute('aria-pressed', 'true');

  // 32267 v1 content has no category field. Only a `t` topic that matches a known
  // category is observed data; "Mock Relay" has one, "Mock Client" does not.
  const categoryOf = name => cards.filter({has: page.locator('h2', {hasText: name})}).locator('.tool-facts div').first().locator('dd');
  await expect(categoryOf('Mock Client')).toHaveText('Unknown');
  await expect(categoryOf('Mock Relay')).toHaveText('Relay operations');

  // No OS / delivery is observed, so the card says so instead of claiming "Web".
  await expect(cards.first().locator('.support-line')).toContainText('OS / platform: Unknown');
  await expect(cards.first().locator('.support-line')).not.toContainText('Web app');

  // Reviews and NIP records are not observed either.
  await expect(cards.first().locator('[data-review-tool]')).toHaveText('Reviews 0');
  await expect(cards.first().locator('.basis-nips')).toHaveCount(0);

  // The only URL a 32267 record observes is content.homepage, and only for "site".
  await cards.first().locator('[data-resource-type="docs"]').click();
  await expect(page.locator('#evidence-dialog .nip-evidence-grid dd').first()).toHaveText('Unknown');
  await page.locator('#evidence-dialog [data-close-dialog]').click();
  await cards.first().locator('[data-resource-type="site"]').click();
  await expect(page.locator('#evidence-dialog .nip-evidence-grid dd').first()).toHaveText('https://example.com/com.example.client');
  expect(errors).toEqual([]);
});

// data.js sample cards keep the count they have always shown.
test('sample cards keep their like count', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  await expect(page.locator('#tool-results article.feature-tool-card').first().locator('[data-like-tool]')).toHaveText(/^♥ \d+$/);
  await expect(page.locator('#tool-results article.feature-tool-card').first().locator('.recommendation-count')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// The bug this pins: renderCompareActions filtered state.compare against the
// data.js `tools` array only, so a checked relay card was dropped from the
// comparison set immediately and the checkbox unchecked itself on the next render.
test('compare selection on relay cards survives a re-render and opens the comparison dialog', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const viewer = await viewerHex(page);
  const {cards} = await loadRelayCatalog(page, {load: {viewerPubkey: viewer}});
  await expect(cards).toHaveCount(4);

  await cards.nth(0).locator('[data-compare-tool]').check();
  await cards.nth(1).locator('[data-compare-tool]').check();
  await expect(page.locator('#compare-actions')).toBeVisible();
  await expect(page.locator('#compare-summary')).toHaveText('2 selected (maximum 3)');

  // Typing in the search box runs renderResults, which rebuilds every card from
  // state.compare — the render that used to drop the checkmark.
  await page.fill('#feature-query', 'mock');
  await expect(cards.nth(0).locator('[data-compare-tool]')).toBeChecked();
  await expect(cards.nth(1).locator('[data-compare-tool]')).toBeChecked();
  await expect(page.locator('#compare-summary')).toHaveText('2 selected (maximum 3)');

  await page.click('#open-compare');
  const dialog = page.locator('#compare-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.comparison-candidate strong')).toHaveText(['Mock Client', 'Untagged Recall']);
  // Nothing unobserved is filled in: no NIP record renders the "—" marker, and the
  // observed row keeps the "YYYY-MM-DD" card contract instead of going blank.
  await expect(dialog.locator('.comparison-group').filter({hasText: 'Features'}).locator('.no-support-record').first()).toBeVisible();
  const observedValues = await dialog.locator('.comparison-item').filter({hasText: 'Last observed'}).locator('.comparison-value').allTextContents();
  expect(observedValues).toHaveLength(2);
  for (const value of observedValues) expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  // OS and category are unobserved for both, so they read Unknown rather than blank.
  const osValues = await dialog.locator('.comparison-item').filter({hasText: 'OS / platform'}).locator('.comparison-value').allTextContents();
  expect(osValues).toEqual(['Unknown', 'Unknown']);
  expect(errors).toEqual([]);
});

test('diagnostics expose relay coverage, graph state, the pubkeys behind each count, and REQ counts', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const viewer = await viewerHex(page);
  const {fixtures, result} = await loadRelayCatalog(page, {load: {viewerPubkey: viewer}});

  await page.locator('#relay-diagnostics summary').click();
  const diagnostics = page.locator('#relay-diagnostics');

  // Per-relay coverage with its observation time.
  await expect(diagnostics.locator('section').filter({hasText: 'Relays and coverage'}).locator('li'))
    .toContainText(['mock.relay.test']);

  // §6.2/§3: the graph state and its coverage travel with the counts.
  const graphGrid = diagnostics.locator('section').filter({hasText: 'Social graph'}).locator('.relay-diagnostics-grid > div');
  await expect(graphGrid.filter({hasText: 'State'}).locator('dd')).toHaveText('tier1');
  await expect(graphGrid.filter({hasText: 'Coverage'}).locator('dd')).toHaveText('fresh');
  await expect(graphGrid.filter({hasText: 'Graph size'}).locator('dd')).toHaveText('3 of 3');
  await expect(graphGrid.filter({hasText: 'Key source'}).locator('dd')).toHaveText('pasted');

  // §6.4: who recommended what is inspectable — that is the trust-adjustment mechanism.
  const recommenders = diagnostics.locator('section').filter({hasText: 'Recommenders in your network'}).locator('li');
  await expect(recommenders).toHaveCount(2);
  expect(result.curation.counted).toHaveLength(3);
  expect(result.entries[0].recommenders).toHaveLength(2);
  expect(result.entries[0].recommenders).toContain(fixtures.pubkeys.curatorA);
  expect(result.entries[0].recommenders).toContain(fixtures.pubkeys.curatorB);

  // §9.2: per-round and total REQ counts, with HTTP shown as the zero it must be.
  const rounds = diagnostics.locator('section').filter({hasText: 'Rounds' }).locator('li');
  await expect(rounds).toHaveCount(3);
  const reqGrid = diagnostics.locator('section').filter({hasText: 'REQ counts'}).locator('.relay-diagnostics-grid > div');
  await expect(reqGrid.filter({hasText: 'Logical REQs'}).locator('dd')).toHaveText('3');
  await expect(reqGrid.filter({hasText: 'Physical REQs'}).locator('dd')).toHaveText('3');
  await expect(reqGrid.filter({hasText: 'HTTP attempts'}).locator('dd')).toHaveText('0');
  // The as-of time uses the same format as the card `observed` contract.
  await expect(reqGrid.filter({hasText: 'As of'}).locator('dd')).toHaveText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);

  // §9.4: NIP-11 is not fetched, so its values are labelled assumed rather than claimed.
  await expect(diagnostics.locator('.relay-diagnostics-slugs')).toContainText('nip11-assumed');
  expect(errors).toEqual([]);
});

test('the ?curators= override counts manually, adds recall, and can never remove a row', async ({page}) => {
  const errors = collectErrors(page);
  await page.goto(EXPLORER);
  const curatorA = await page.evaluate(async seckey => {
    const crypto = await import('./dist/rx-nostr-crypto.js');
    return crypto.seckeySigner(seckey).getPublicKey();
  }, KEYS.curatorA);

  const plain = await loadRelayCatalog(page);
  const manual = await loadRelayCatalog(page, {curators: curatorA});

  const plainRows = plain.result.entries.map(entry => entry.coordinate).slice().sort();
  const manualRows = manual.result.entries.map(entry => entry.coordinate).slice().sort();
  // §17.2 / §6.5.6: a manual "also count these" entry is not an inclusion input. It
  // can never remove a row, and the one row it adds is the §6.6 recall path — a
  // coordinate with a genuinely observed valid winner, fetched exactly by §5.2,
  // not a row conjured from the list itself.
  for (const coordinate of plainRows) expect(manualRows).toContain(coordinate);
  const added = manualRows.filter(coordinate => plainRows.indexOf(coordinate) === -1);
  expect(added).toEqual([plain.fixtures.coordinates.untagged]);
  for (const entry of manual.result.entries) {
    expect(entry.eventId).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.relays.length).toBeGreaterThan(0);
  }
  // It ships empty and is labelled as manual rather than folded into the graph.
  expect(plain.result.curation.manual).toEqual([]);
  expect(manual.result.curation.manual.map(item => item.curator)).toEqual([curatorA]);
  expect(manual.result.graph.state).toBe('none');
  // Graph counts stay unknown: a manual pubkey is not a follow graph.
  expect(manual.result.entries.map(entry => entry.recommendations)).toEqual([null, null, null, null]);
  expect(manual.result.entries.filter(entry => entry.manualRecommendations === 1)).toHaveLength(2);

  await page.locator('#relay-diagnostics summary').click();
  await expect(page.locator('#relay-diagnostics')).toContainText('Manually counted pubkeys');
  expect(errors).toEqual([]);
});
