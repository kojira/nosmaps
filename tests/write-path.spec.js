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
  /* One ordered log of the two things whose *order* is under test (§5 U1): the
     coordinate is read before the signer is touched. Kept separate from
     __NOSTR_CALLS__ because that array carries the "no NIP-07 call before a
     gesture" assertion, which a REQ entry would break. */
  window.__TIMELINE__ = [];

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
      window.__TIMELINE__.push({call: 'REQ', filters: JSON.parse(JSON.stringify(filters))});
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
      window.__TIMELINE__.push({call: 'signEvent', createdAt: draft && draft.created_at});
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

/* Puts a real, really-signed record of the *same* publisher into the relay pool
   at a chosen created_at. Signed rather than faked because rx-nostr's verifier
   drops anything else before the app can see it, so an unsigned stand-in would
   make the pre-sign read round look empty and the test would pass on a broken
   implementation. Returns the created_at actually used, so the assertions can
   name it rather than recompute a clock that has since moved. */
async function seedPrior(page, seckey, {dLocal, name, offsetSec}) {
  return page.evaluate(async ({seckey, dLocal, name, offsetSec}) => {
    const module = await import(new URL('dist/rx-nostr-crypto.js', location.href).href);
    const signer = module.seckeySigner(seckey);
    const createdAt = Math.floor(Date.now() / 1000) + offsetSec;
    const event = await signer.signEvent({
      kind: 30078,
      created_at: createdAt,
      tags: [['d', `nosmaps:${dLocal}`], ['t', 'nosmaps']],
      content: JSON.stringify({
        schema: 'org.nosmaps.software', version: 1, state: 'active',
        name, summary: 'The record already at this coordinate.'
      })
    });
    window.__MOCK_RELAY__.events.push(event);
    return {createdAt, id: event.id};
  }, {seckey, dLocal, name, offsetSec});
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

/* issue #12 G2 (§W3.4, AC-G2-1 / AC-G2-3 / AC-G2-4, and §5 U1).

   What is under test is not "an update was published" but *which second it was
   stamped with*. §5.3 breaks ties by lowest event id, so an update stamped at
   the same second as the record it replaces can lose -- a completely successful
   publish that leaves the user staring at their old record. So the assertion is
   on the bytes handed to the signer, and on the fact that the coordinate was
   read from a relay *before* those bytes existed. Reading it from a warm cache
   instead would still produce a +1 and would still pass a weaker test, which is
   exactly why the order is asserted here and not the arithmetic alone. */
test('an update to an existing coordinate is stamped past the observed winner, after reading it from the relay', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);
  await signIn(page);

  // A prior at this coordinate, stamped in the same second the publish will run
  // in: the case where `now` alone would tie.
  const prior = await seedPrior(page, PUBLISHER_SECKEY, {
    dLocal: 'com.example.update', name: 'Before The Edit', offsetSec: 0
  });

  await fillForm(page, {
    dLocal: 'com.example.update',
    name: 'After The Edit',
    summary: 'The same coordinate, corrected.',
    homepage: '',
    topics: ''
  });
  await page.locator('[data-publish-submit]').click();
  await expect(page.locator('[data-publish-state]')).toHaveAttribute('data-publish-state', 'published', {timeout: 20_000});

  const observed = await page.evaluate(() => ({
    signArg: window.__SIGN_ARG__,
    timeline: window.__TIMELINE__,
    published: window.__MOCK_RELAY__.published.map(event => ({id: event.id, created_at: event.created_at}))
  }));

  // AC-G2-3: this app set the field; no library defaulted it.
  expect(Object.prototype.hasOwnProperty.call(observed.signArg, 'created_at')).toBe(true);
  // AC-G2-1: strictly past the winner that was actually observed. `>` alone
  // would also pass on `now` when the clock happens to have ticked, so the
  // exact +1 is named -- the seed is stamped at the same second on purpose.
  expect(observed.signArg.created_at).toBe(prior.createdAt + 1);
  expect(observed.published.at(-1).created_at).toBe(prior.createdAt + 1);

  /* §5 U1: the read happened before the signer was touched, and it asked for
     this coordinate. A cache-first regression puts signEvent first (or drops
     the `#d` round entirely) and lands here rather than in the arithmetic. */
  const signIndex = observed.timeline.findIndex(entry => entry.call === 'signEvent');
  expect(signIndex, 'signEvent never happened').toBeGreaterThan(-1);
  const priorReqIndex = observed.timeline.findIndex(entry => entry.call === 'REQ'
    && entry.filters.some(filter => Array.isArray(filter['#d']) && filter['#d'].includes('nosmaps:com.example.update')));
  expect(priorReqIndex, 'no REQ for this coordinate before signing').toBeGreaterThan(-1);
  expect(priorReqIndex).toBeLessThan(signIndex);

  // AC-G2-4: the +1 is disclosed, not hidden. A user who is told "published"
  // and shown a second they did not choose deserves the reason on the screen.
  const note = page.locator('[data-publish-clock="bumped"]');
  await expect(note).toHaveCount(1);
  await expect(note).toContainText(String(prior.createdAt + 1));

  expect(await page.locator('body').innerText()).not.toContain('undefined');
  expect(errors, 'console/page errors').toEqual([]);
});

/* AC-G2-2. The prior is stamped further ahead than MAX_FUTURE_SKEW_SEC (600)
   allows this device to reach, so there is no honest timestamp that would win.
   The design forbids forging a farther-future time, which leaves refusing --
   and refusing has to happen *before* the signer, because a signature the user
   was asked for and that can never be sent is a cost with no product. */
test('a coordinate timestamped beyond the skew bound stops before the signer rather than forging a time', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);
  await signIn(page);

  await seedPrior(page, PUBLISHER_SECKEY, {
    dLocal: 'com.example.futurewinner', name: 'Stamped In The Future', offsetSec: 1200
  });

  await fillForm(page, {
    dLocal: 'com.example.futurewinner',
    name: 'Cannot Beat That Clock',
    summary: 'The record at this address is ahead of this device.',
    homepage: '',
    topics: ''
  });
  await page.locator('[data-publish-submit]').click();

  await expect(page.locator('[data-publish-state]')).toHaveAttribute('data-publish-state', 'blocked', {timeout: 20_000});
  await expect(page.locator('[data-publish-reason]')).toHaveAttribute('data-publish-reason', 'clock-conflict');

  // Nothing was signed and nothing was sent. Both, because either one alone
  // leaves the other regression alive.
  const after = await page.evaluate(() => ({
    calls: window.__NOSTR_CALLS__,
    published: window.__MOCK_RELAY__.published.length,
    signArg: window.__SIGN_ARG__
  }));
  expect(after.calls.filter(call => call === 'signEvent')).toHaveLength(0);
  expect(after.published, 'EVENTs sent on a clock conflict').toBe(0);
  expect(after.signArg).toBeUndefined();

  // The cause is on screen: this is a clock problem, and the user can only act
  // on it if told so.
  await expect(page.locator('[data-publish-clock="conflict"]')).toHaveCount(1);

  expect(await page.locator('body').innerText()).not.toContain('undefined');
  expect(errors, 'console/page errors').toEqual([]);
});

/* Puts a *foreign* 30078 of the same publisher into the pool: NIP-78 shares the
   kind across applications, so another app's settings record living under the
   same author is the normal case, not a fault. Really signed for the same reason
   seedPrior is -- rx-nostr's verifier drops anything else, and a dropped event
   would make this seed prove nothing. */
async function seedForeignApp(page, seckey, {d, content}) {
  return page.evaluate(async ({seckey, d, content}) => {
    const module = await import(new URL('dist/rx-nostr-crypto.js', location.href).href);
    const signer = module.seckeySigner(seckey);
    const event = await signer.signEvent({
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['d', d]],
      content: JSON.stringify(content)
    });
    window.__MOCK_RELAY__.events.push(event);
    return event.id;
  }, {seckey, d, content});
}

/* issue #12: the signed-in publisher sees what this app can actually observe of
   what they signed -- and only that. The foreign record is the load-bearing half
   of the test: kind 30078 is shared (NIP-78), so a list that counted everything
   the author signed under that kind would tell the user they published records
   they never published, in an app they may not even use. */
test('the signed-in publisher sees their own records, and another app’s 30078 is not one of them', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);

  // Seeded before signing in, because the list is fetched as soon as the key is
  // known: seeding afterwards would race the round it is supposed to be in.
  const mine = await seedPrior(page, PUBLISHER_SECKEY, {
    dLocal: 'com.example.mine', name: 'My Own Record', offsetSec: -60
  });
  const foreignId = await seedForeignApp(page, PUBLISHER_SECKEY, {
    d: 'AmethystSettings', content: {theme: 'dark', lastRead: 1712345678}
  });

  await signIn(page);

  const list = page.locator('[data-my-records]');
  await expect(list).toHaveAttribute('data-my-records', 'ok', {timeout: 20_000});

  // Exactly one row: the foreign record is neither listed nor counted.
  const rows = page.locator('[data-my-record]');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-event-id', mine.id);
  await expect(rows.first()).toContainText('My Own Record');
  await expect(rows.first()).toContainText('nosmaps:com.example.mine');
  expect(await page.locator('.my-records').innerText()).not.toContain('AmethystSettings');
  expect(await page.locator('[data-my-record]').first().getAttribute('data-event-id')).not.toBe(foreignId);

  expect(await page.locator('body').innerText()).not.toContain('undefined');
  expect(errors, 'console/page errors').toEqual([]);
});

/* issue #12 §W6 (withdraw). The withdrawal is not a new mechanism: it is one
   more record at the same coordinate, signed by the same key, with `state`
   flipped to `withdrawn` (§W6.2). Two things are load-bearing and easy to get
   wrong, so both are asserted on the bytes rather than on the headline. First,
   the withdrawal is a *tombstone*, not an erasure: §7.1 keeps name and summary
   required, so a client that only ever sees the withdrawal must still be able
   to say what was withdrawn -- blanking them would leave the publisher unable
   to tell which record they retired. Second, §W6.6 forbids a NIP-09 kind 5:
   a deletion request claims an erasure no one can guarantee, so the withdrawal
   event has to be the whole of it. That "no kind 5" is the main point here and
   is checked explicitly, not implied by "it worked". */
test('withdrawing a record republishes a withdrawn tombstone that keeps its name and summary, and sends no kind 5', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);

  // Seeded before signing in, because the "records you published" list is
  // fetched the instant the key is known: seeding after would race that round
  // (same reason as the my-records test above).
  const mine = await seedPrior(page, PUBLISHER_SECKEY, {
    dLocal: 'com.example.retire', name: 'Ready To Retire', offsetSec: -30
  });
  await signIn(page);

  const list = page.locator('[data-my-records]');
  await expect(list).toHaveAttribute('data-my-records', 'ok', {timeout: 20_000});
  const rows = page.locator('[data-my-record]');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-event-id', mine.id);

  // Two-stage on purpose (§W6.5 / §7.3): the first click only opens the confirm
  // copy that says withdrawal is not deletion; nothing is signed until confirm.
  await page.locator('[data-withdraw-record]').click();
  await page.locator('[data-withdraw-confirm]').click();

  // The relay served the withdrawal back, so this is the confirmed path.
  await expect(page.locator('[data-publish-state]')).toHaveAttribute('data-publish-state', 'published', {timeout: 20_000});
  // The same result panel, read in the withdrawal's vocabulary: the action flag
  // is what picks that vocabulary, and the confirmed headline only appears once
  // the read-back has actually happened.
  await expect(page.locator('.publish-result')).toHaveAttribute('data-publish-action', 'withdraw');
  const panel = await page.locator('#publish-panel').innerText();
  expect(panel).toContain('read back and confirmed');

  const relay = await page.evaluate(() => {
    const published = window.__MOCK_RELAY__.published;
    const record = published.find(event => event.kind === 30078);
    return {
      kinds: published.map(event => event.kind),
      deletions: published.filter(event => event.kind === 5).length,
      content: record ? JSON.parse(record.content) : null
    };
  });
  // §W6.2: the withdrawal flips state, and nothing else about the record.
  expect(relay.content.state).toBe('withdrawn');
  // §7.1: name and summary survive the withdrawal -- the tombstone still names
  // its dead. These are the values that were on the seeded record.
  expect(relay.content.name).toBe('Ready To Retire');
  expect(relay.content.summary).toBe('The record already at this coordinate.');
  // §W6.6: no NIP-09 deletion was sent. This is the assertion the whole design
  // choice rests on, so it is named rather than left to "it succeeded".
  expect(relay.deletions, `a kind 5 was published; kinds were ${JSON.stringify(relay.kinds)}`).toBe(0);

  expect(await page.locator('body').innerText()).not.toContain('undefined');
  expect(errors, 'console/page errors').toEqual([]);
});

/* §W6.5 / W-I3, the same honesty the publish path owes (§W5.5): a withdrawal
   that is acknowledged but never served back must not read as "withdrawn".
   The seeded record is pushed straight into the pool, so the pre-sign read of
   the coordinate still succeeds with serveBack off (that only stops the *new*
   event from joining the pool) -- which is exactly the shape under test: the
   withdrawal is signed and sent, the relay just never hands it back. The
   confirmed copy ("read back and confirmed") must be absent, and the page must
   say instead that some clients still see the record as active. */
test('a withdrawal the relay never serves back is reported as unconfirmed, and does not claim the record is withdrawn', async ({page}) => {
  const errors = collectErrors(page);
  await openExplorer(page);

  // A neutral record name: "Withdrawn" must not appear in the fixture, because
  // this test asserts the *absence* of withdrawal-completion copy in the panel,
  // and a future change that prints the record name would turn a name carrying
  // that word into a false positive/negative.
  const mine = await seedPrior(page, PUBLISHER_SECKEY, {
    dLocal: 'com.example.retire.unread', name: 'Never Confirmed Retirement', offsetSec: -30
  });
  await signIn(page);

  const list = page.locator('[data-my-records]');
  await expect(list).toHaveAttribute('data-my-records', 'ok', {timeout: 20_000});
  await expect(page.locator('[data-my-record]')).toHaveCount(1);
  await expect(page.locator('[data-my-record]').first()).toHaveAttribute('data-event-id', mine.id);

  // Cut the read-back at the relay, only now -- after the list (which reads the
  // pool the seed was pushed into) has already rendered.
  await page.evaluate(() => { window.__MOCK_RELAY__.serveBack = false; });

  await page.locator('[data-withdraw-record]').click();
  await page.locator('[data-withdraw-confirm]').click();

  await expect(page.locator('[data-publish-state]')).toHaveAttribute('data-publish-state', 'unconfirmed', {timeout: 20_000});
  // Scoped to the result panel, not #publish-panel: the publish form's static
  // lead permanently reads "...says published when the record was read back
  // from a relay", so "was read back" lives on the page in every state and a
  // whole-panel check would fire regardless of the outcome. The claim under
  // test is what the *result* asserts, and that is what .publish-result holds.
  const result = await page.locator('.publish-result').innerText();
  // No "read back" *success* claim in the result. Both headlines that assert the
  // withdrawal was observed share the phrase "was read back" -- confirmed ("was
  // read back and confirmed") and partial ("was read back, but only ...") --
  // while the honest states say "could not be read back" (unconfirmed) and "has
  // not been read back" (the consequence). So the substring "was read back"
  // seals both success wordings in one assertion without colliding with the
  // wording this state is allowed to print.
  expect(result).not.toContain('was read back');
  // And the page says the true thing instead: until the withdrawal is observed,
  // some clients still see this record as active.
  expect(result).toContain('still see this record as active');

  expect(await page.locator('body').innerText()).not.toContain('undefined');
  expect(errors, 'console/page errors').toEqual([]);
});
