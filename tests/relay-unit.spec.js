const {test, expect} = require('@playwright/test');

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

// Fixtures are constructed inside the page so they exercise the real browser
// globals (WebCrypto, IndexedDB) and the real classic-script data layer.
// Signatures are NOT checked by these pure functions — rx-nostr's verifier does
// that in the relay layer — so plain objects with a well-shaped id suffice here.
function installHelpers() {
  const PUB_A = '1'.repeat(64);
  const PUB_B = '2'.repeat(64);
  const CUR_A = 'a'.repeat(64);
  const CUR_B = 'b'.repeat(64);
  const VIEWER = 'c'.repeat(64);
  const NOW_SEC = 1787000000;

  function hexKey(n) { return n.toString(16).padStart(64, '0'); }

  window.__T = {
    PUB_A, PUB_B, CUR_A, CUR_B, VIEWER, NOW_SEC, hexKey,
    OPTS: {nowSec: NOW_SEC, receivedAtSec: NOW_SEC},

    // A canonical, fully self-consistent kind 30078 record. `over.content` merges
    // content-field overrides and the `state` tag is regenerated to match, so the
    // fixture is correct by construction and only the intentionally-broken field
    // differs.
    makeSoftware(over) {
      over = over || {};
      const content = Object.assign({
        schema: 'org.nosmaps.software', version: 1, state: 'active',
        name: 'Example Tool', summary: 'A relay client.', homepage: 'https://example.com/tool'
      }, over.content || {});
      for (const key of (over.dropContentKeys || [])) delete content[key];
      const d = 'd' in over ? over.d : 'nosmaps:com.example.tool';
      const pubkey = over.pubkey || PUB_A;
      const tags = [];
      if (d !== null) tags.push(['d', d]);
      for (const topic of (over.topics === undefined ? ['nosmaps'] : over.topics)) {
        tags.push(Array.isArray(topic) ? ['t'].concat(topic) : ['t', topic]);
      }
      if (!over.noStateTag) tags.push(['state', 'stateTag' in over ? over.stateTag : content.state]);
      tags.push(['v', '1']);
      for (const tag of (over.extraTags || [])) tags.push(tag);
      return {
        id: over.id || 'e'.repeat(64),
        pubkey,
        kind: 30078,
        created_at: 'created_at' in over ? over.created_at : NOW_SEC - 1000,
        content: 'rawContent' in over ? over.rawContent : JSON.stringify(content),
        tags: over.tags || tags,
        sig: 'f'.repeat(128)
      };
    },

    // A NIP-51 App curation set. Members are plain `a` tag coordinates.
    makeSet(over) {
      over = over || {};
      const tags = [['d', 'd' in over ? over.d : 'nostr']];
      for (const member of (over.members || [])) tags.push(['a', member]);
      for (const tag of (over.extraTags || [])) tags.push(tag);
      return {
        id: over.id || '1234' + '0'.repeat(60),
        pubkey: over.pubkey || CUR_A,
        kind: 30267,
        created_at: 'created_at' in over ? over.created_at : NOW_SEC - 500,
        content: 'content' in over ? over.content : 'My nostr app selection',
        tags,
        sig: 'f'.repeat(128)
      };
    },

    makeFollows(over) {
      over = over || {};
      const tags = [];
      for (const p of (over.follows || [])) tags.push(Array.isArray(p) ? ['p'].concat(p) : ['p', p]);
      return {
        id: over.id || '5678' + '0'.repeat(60),
        pubkey: over.pubkey || VIEWER,
        kind: 3,
        created_at: 'created_at' in over ? over.created_at : NOW_SEC - 400,
        content: '',
        tags,
        sig: 'f'.repeat(128)
      };
    },

    makeDeletion(over) {
      over = over || {};
      const tags = [];
      for (const id of (over.ids || [])) tags.push(['e', id]);
      for (const address of (over.addresses || [])) tags.push(['a', address]);
      if (over.k) tags.push(['k', String(over.k)]);
      return {
        id: over.id || '9abc' + '0'.repeat(60),
        pubkey: over.pubkey || PUB_A,
        kind: 5,
        created_at: 'created_at' in over ? over.created_at : NOW_SEC - 300,
        content: '',
        tags,
        sig: 'f'.repeat(128)
      };
    },

    enc(str) { return new TextEncoder().encode(str); }
  };
}

const EXPLORER = 'nip-explorer.html';

// A real, unmodified kind-30267 event fetched from wss://x.kojira.io on
// 2026-08-18 (`{"kinds":[30267],"limit":10}`). Kind 30267 is NIP-51's App
// curation set, which revision 2 does read — but never as a canonical record.
// It is kept as a live sample of a wrong kind so `validateSoftwareEvent` can be
// shown to reject it outright rather than trying to interpret it.
const FOREIGN_KIND_EVENT = {
  id: "54aed11ebc14a4dfa06cf737c916f8bfd48999f7eae37a5f9a440134f3823ad0",
  pubkey: "659a74f6cfbc7c252c58d93452b9d9575e36c464aa6544c6375227c9166a6ed9",
  kind: 30267,
  created_at: 1784204478,
  tags: [
    ["name","Saved Apps"],
    ["d","zapstore-bookmarks"],
    ["f","android-arm64-v8a"]
  ],
  content: "5d+W7FLeGPck/8fOE/BLeTi8ceQ6/vShxZRc4L+StbILwXfBHiV7X1Y225a+Mgra0+k66rDWw2PW4IdiTH47GGHuA57SklRKa2ZYzAdO9wxstw3UP9wMGM8HQ+29nT/TvcZt8Ji8kcG9JcIfxGTLGg6+rjNLb0Duvr8xSDM2i+n9pNrBZorTR5P2YHxoZkDnGPkN8+CR3IJnAxeF1YcnQpqOjZRfRmk5lglPVNdvOzjz2yoqRdepqQ5aQ+oOg2vT?iv=glOAyEqd5j2g4OFgmbHRQA==",
  sig: "d5d87f0c3c7f720287b6240c3128dea452017a79c5d9d28ed33e5e8bc311224895ee493fce4f72057fcf851ee549d8567d399114de09e199d5cd231b985f5de7"
};

// Four real, unmodified kind-30078 events fetched from wss://x.kojira.io on
// 2026-08-18 (`{"kinds":[30078],"limit":80,"until":1786900000}`). NIP-78 defines
// 30078 as application-specific data that every application shares, so foreign
// records on this kind are the specified normal state and not an anomaly: these
// are four other applications' perfectly valid records, and §4.2 requires that we
// never read them as ours. Emitted verbatim from the relay response —
// id/pubkey/sig/tags/content bytes are untouched, so the `sig` over each one still
// verifies. Three carry `content` that is not a JSON object at all (two empty, one
// NIP-44 ciphertext); the fourth is a JSON object that carries no `schema` key.

const REAL_30078_NOSTTER = {
  id: "95e2c4e7d65056f09e4c94416e90d2ad8c7baf570250497a5c09b1de8a48653b",
  pubkey: "272d2bf9fe82a32a9c71001b736fb48ed08aac73529c8ee4ef2ce3f950bb7919",
  kind: 30078,
  created_at: 1786869343,
  tags: [
    ["d","nostter-read"]
  ],
  content: "",
  sig: "ce42d9b89c1bc6d18d2c3fa3ddd390dfac13e039ff706be8773739067b36fe7309a88a2361dbcbaffd7236c67a4c1b77e8453ec35ff459068c6aa6c6cba36193"
};

const REAL_30078_AMETHYST = {
  id: "3bd0e939d05fd5c39e0042f2cfe147c2c43edb4df55aa395e7fdb859aa106ba6",
  pubkey: "21b196587f141cd964878c5ba2f0268fd9a208bd00242babac20964b4167248a",
  kind: 30078,
  created_at: 1786887555,
  tags: [
    ["d","AmethystSettings"],
    ["client","Amethyst"]
  ],
  content: "AsaGcrRoKwAy1ZXyBgI3U/7CPfcVriWXf45DNDlcxuIQVZlZmIeaGdr8HmPZ+60QDRa0FLtiLlja5iKvztJJ0gflweAnW5dXU1EhnPPR12MhsCp/zDofJOWjjbVopb7AjOOLfY9q26Q2DF7fKjQ8iIAj71nFIWWtc6NUiatJGo4X9UccWkxrmBlWMVNHHToro4NyhS9Z7o2+LRkBKUJaubX/7RfsikidiRwvdjoU39THKuOFAqt9UeOONG0dZDNEhbS+9NGmJfaKckwPQW7vUXXUVVDxT704QSsLrOPMql6/TckFP1h+5Pz+I+ksQ908ZfGta3hmYG11S5R95PUmUaWgZexxHylvv2jbDzt+FApuw32/2W2RU9cFpcZZcpv6gdkJwmvFA6Co4qbBUf3CELvSz+YM/FrGTYQEtXa1HZQnSyKyDAYH3g9uGXht9uklmwBw+mQS8NIVcYs4cywv5MDkxui2b9CAPlUeqLYtoIqXxcHyBqG00XUpBCtOC1tSIHNORBwEe+EL3u4RGR63W9oiHgAd+0EOV3IxzCbcBfBxC3I7oyi4nCFG8VDMX3jjLCOPjovtBlCg7IwBl/vEJ0DclQ==",
  sig: "1446a11ae7a2f12fd240e819bb26c06150ad6177ee5e22e0d6829866523455a544a6ff3bbf00d3f58073cb985fe2e365e9f1dc2c7e66a77bd5024d13d1a09dc3"
};

const REAL_30078_NYM = {
  id: "4577bb0fe429aec39af3ba267cdc250b33b7e162304ee3552c22a7f9be7aaab5",
  pubkey: "da6749efe87ee8e932e4fe6c150a620a0d1762dc0fa537901fd803e0c4741057",
  kind: 30078,
  created_at: 1786892230,
  tags: [
    ["d","nym-presence"],
    ["t","nym-presence"],
    ["n","RegnumUmbrae"],
    ["status","online"],
    ["avatar-update","https://npub1mfn5nmlg0m5wjvhylekp2znzpgx3wckup7jn0yqlmqp7p3r5zpts9fmfg6.blossom.band/ba53a2c35893d08ea406228670e9705a3fbc3cbffbd9706ac0664ccce9600f08.jpg"]
  ],
  content: "",
  sig: "21dcb2b374fa87cea5bab4f694c2d188f9b7eb4c34a13b8b01f234ef69139ad40a592f48e5f4d57edae681ba65eee45c2f3ff59275d6cadb347238dac10ec77b"
};

const REAL_30078_HEAT = {
  id: "3d77298dd5d85e3b253fe336ae06db2e40329743301b96f0ee80350261cafb6c",
  pubkey: "a021ff9a40de4f0faec848b1ac4bdc03d1d26758aa19691b91ae1fb4d5562041",
  kind: 30078,
  created_at: 1786869513,
  tags: [
    ["d","heat:user:90d:v2"],
    ["t","fish2018-home-v1"],
    ["app","fongmi-webhome"],
    ["expiration","1794645513"]
  ],
  content: "{\"v\":5,\"i\":[[\"m\",1745149,20681,\"猎虎贰\",\"/jUdZnyCzqGmbcFcDqGNnuoOBAyk.jpg\"]]}",
  sig: "1169a08aa043322572eb15804c0d45229cb8af5ce2819ecb1eedcd97902149a3e2373811380f92d5c276786cebc98d04388b99c255a75b78178824745a535b0f"
};

// Ours, for contrast, so the gate is provably not just rejecting everything: the
// same shape with a `d` inside the `nosmaps:` namespace and the
// `org.nosmaps.software` profile. Hand-authored rather than fetched, because
// Nosmaps publishes no kind 30078 records yet and there is no real one to fetch;
// `sig` is a placeholder, which is sound here because `validateSoftwareEvent` never
// looks at it (rx-nostr's verifier owns signatures, invariant I1).
const OUR_30078_EVENT = {
  id: 'a'.repeat(64),
  pubkey: 'b'.repeat(64),
  kind: 30078,
  created_at: 1786999000,
  tags: [
    ['d', 'nosmaps:io.kojira.nosmaps'],
    ['t', 'nosmaps'],
    ['state', 'active'],
    ['v', '1']
  ],
  content: JSON.stringify({
    schema: 'org.nosmaps.software', version: 1, state: 'active',
    name: 'Nosmaps', summary: 'A relay-native catalog of Nostr tools.',
    homepage: 'https://nosmaps.example/'
  }),
  sig: 'f'.repeat(128)
};

function registerUnit() {
  test.beforeEach(async ({page}) => {
    await page.addInitScript(installHelpers);
  });

  // ---- A. addressable winner selection (§5.3, I3, I4) ----
  test('A. selectAddressableWinner honours the NIP-01 winner rules', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const {selectAddressableWinner} = window.NOSMAPS_CATALOG;
      const mk = (id, created_at) => ({id, created_at, pubkey: 'p'.repeat(64), kind: 30078, tags: [['d', 'x']]});
      const greater = selectAddressableWinner([mk('ffff', 10), mk('0000', 20)]);
      const a = mk('aaaa', 50);
      const b = mk('bbbb', 50);
      return {
        greaterId: greater.id,
        tie1: selectAddressableWinner([a, b]).id,
        tie2: selectAddressableWinner([b, a]).id,
        empty: selectAddressableWinner([])
      };
    });
    expect(r.greaterId).toBe('0000');
    expect(r.tie1).toBe('aaaa');
    expect(r.tie2).toBe('aaaa');
    expect(r.empty).toBeNull();
    expect(errors).toEqual([]);
  });

  test('A. selectSoftwareWinners quarantines an invalid newer version and flags the row', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const CAT = window.NOSMAPS_CATALOG;
      const T = window.__T;
      const older = T.makeSoftware({id: '1'.padEnd(64, '1'), created_at: T.NOW_SEC - 2000, content: {name: 'Older'}});
      // Newest version fails schema validation (unknown content field), so it is
      // quarantined and the newest *valid* version wins (§5.3).
      const newer = T.makeSoftware({id: '2'.padEnd(64, '2'), created_at: T.NOW_SEC - 100, content: {bogus: 'x'}});
      const forward = CAT.selectSoftwareWinners([older, newer], T.OPTS);
      const reverse = CAT.selectSoftwareWinners([newer, older], T.OPTS);
      // Per-relay divergence: relay 1 served only the older version, relay 2 both.
      const divergent = CAT.selectSoftwareWinners([older, T.makeSoftware({id: '3'.padEnd(64, '3'), created_at: T.NOW_SEC - 50, content: {name: 'Newest valid'}})], T.OPTS);
      return {
        forward: forward.winners.map(w => ({c: w.coordinate, name: w.record.name, q: w.quarantinedNewer})),
        reverseJson: JSON.stringify(reverse.winners.map(w => [w.coordinate, w.record.name, w.record.eventId])),
        forwardJson: JSON.stringify(forward.winners.map(w => [w.coordinate, w.record.name, w.record.eventId])),
        quarantined: forward.quarantined.map(q => q.reason),
        divergentName: divergent.winners[0].record.name,
        divergentNoFlag: divergent.winners[0].quarantinedNewer
      };
    });
    expect(r.forward[0].name).toBe('Older');
    expect(r.forward[0].q.reason).toBe('unknown-field');
    expect(r.quarantined).toEqual(['unknown-field']);
    // I4: arrival-order permutation produces identical output.
    expect(r.reverseJson).toBe(r.forwardJson);
    expect(r.divergentName).toBe('Newest valid');
    expect(r.divergentNoFlag).toBeNull();
    expect(errors).toEqual([]);
  });

  // ---- B. kind 30078 validation (§4.2) ----
  test('B. validateSoftwareEvent accepts the v1 profile and echoes the parsed record', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate((foreign) => {
      const V = window.NOSMAPS_CATALOG.validateSoftwareEvent;
      const T = window.__T;
      const good = T.makeSoftware({topics: ['nosmaps', 'relay-client']});
      return {
        ok: V(good, T.OPTS),
        wrongKind: V(foreign, T.OPTS),
        pub: good.pubkey
      };
    }, FOREIGN_KIND_EVENT);
    expect(r.ok.ok).toBe(true);
    expect(r.ok.record.coordinate).toBe(`30078:${r.pub}:nosmaps:com.example.tool`);
    expect(r.ok.record.publisher).toBe(r.pub);
    expect(r.ok.record.d).toBe('nosmaps:com.example.tool');
    expect(r.ok.record.state).toBe('active');
    expect(r.ok.record.name).toBe('Example Tool');
    expect(r.ok.record.summary).toBe('A relay client.');
    expect(r.ok.record.homepage).toBe('https://example.com/tool');
    expect(r.ok.record.supersededBy).toBeNull();
    expect(r.ok.record.topics).toEqual(['nosmaps', 'relay-client']);
    // Kind 30267 is read as a curation signal, never as a canonical record, so
    // the software gate must reject it on the kind alone.
    expect(r.wrongKind.ok).toBe(false);
    expect(r.wrongKind.reason).toBe('bad-kind');
    expect(errors).toEqual([]);
  });

  test('B. validateSoftwareEvent rejects each malformed variant with the documented reason', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const V = window.NOSMAPS_CATALOG.validateSoftwareEvent;
      const T = window.__T;
      const mk = T.makeSoftware;
      const reason = (event) => V(event, T.OPTS).reason;
      return {
        // §4.2 "Foreign 30078 events": another app's valid record, quarantined
        // with a reason and never reported as nonexistent.
        foreignProfile: reason(mk({rawContent: JSON.stringify({schema: 'com.other.app', version: 1})})),
        nonJsonContent: reason(mk({rawContent: 'not json'})),
        duplicateKey: reason(mk({rawContent: '{"schema":"org.nosmaps.software","schema":"x"}'})),
        // §4.2 rule 1
        noD: reason(mk({d: null})),
        twoD: reason(mk({extraTags: [['d', 'second']]})),
        // Both are inside our namespace, so they isolate the grammar failure from
        // the §4.2 rule 1b namespace failure below. `longD` is 193 bytes with the
        // 8-byte prefix included: the ceiling covers the whole `d`.
        nonAsciiD: reason(mk({d: 'nosmaps:com.例.tool'})),
        longD: reason(mk({d: 'nosmaps:' + 'a'.repeat(185)})),
        barePrefix: reason(mk({d: 'nosmaps:'})),
        // §5.1 rules 1-2: NIP-01 indexes only the first value of a tag, so the
        // multi-value form silently loses indexing and MUST be rejected.
        multiValueT: reason(mk({topics: [['nosmaps', 'relay-client']]})),
        uppercaseT: reason(mk({topics: ['Nosmaps']})),
        emptyT: reason(mk({topics: ['']})),
        // §4.2 rule 2
        unknownField: reason(mk({content: {extra: 'x'}})),
        missingName: reason(mk({dropContentKeys: ['name']})),
        missingSummary: reason(mk({dropContentKeys: ['summary']})),
        badVersion: reason(mk({content: {version: 2}})),
        longName: reason(mk({content: {name: 'x'.repeat(121)}})),
        longSummary: reason(mk({content: {summary: 'x'.repeat(1001)}})),
        httpHomepage: reason(mk({content: {homepage: 'http://example.com/'}})),
        // §4.2 rule 3
        badState: reason(mk({content: {state: 'paused'}})),
        // §4.2 rule 4: the state tag is a scanning aid; disagreement invalidates.
        stateTagMismatch: reason(mk({stateTag: 'withdrawn'})),
        // §11: superseded_by must be a real coordinate and never a self-loop.
        badSuperseded: reason(mk({content: {superseded_by: 'not-a-coordinate'}})),
        selfSuperseded: reason(mk({content: {superseded_by: `30078:${T.PUB_A}:nosmaps:com.example.tool`}})),
        // §12.3
        future: reason(mk({created_at: T.NOW_SEC + 100000})),
        horizon: reason(mk({created_at: T.NOW_SEC + 40 * 24 * 3600})),
        // A valid `state:"withdrawn"` record is valid, just not listable.
        withdrawnOk: V(mk({content: {state: 'withdrawn'}}), T.OPTS).ok
      };
    });
    expect(r.foreignProfile).toBe('foreign-profile');
    expect(r.nonJsonContent).toBe('foreign-profile');
    expect(r.duplicateKey).toBe('foreign-profile');
    expect(r.noD).toBe('bad-d');
    expect(r.twoD).toBe('bad-d');
    expect(r.nonAsciiD).toBe('bad-d');
    expect(r.longD).toBe('bad-d');
    expect(r.barePrefix).toBe('bad-d');
    expect(r.multiValueT).toBe('multi-value-t');
    expect(r.uppercaseT).toBe('uppercase-topic');
    expect(r.emptyT).toBe('bad-topic');
    expect(r.unknownField).toBe('unknown-field');
    expect(r.missingName).toBe('bad-schema');
    expect(r.missingSummary).toBe('bad-schema');
    expect(r.badVersion).toBe('bad-version');
    expect(r.longName).toBe('bad-schema');
    expect(r.longSummary).toBe('bad-schema');
    expect(r.httpHomepage).toBe('bad-schema');
    expect(r.badState).toBe('bad-state');
    expect(r.stateTagMismatch).toBe('tag-content-mismatch');
    expect(r.badSuperseded).toBe('bad-superseded-by');
    expect(r.selfSuperseded).toBe('bad-superseded-by');
    expect(r.future).toBe('future-timestamp');
    expect(r.horizon).toBe('future-horizon');
    expect(r.withdrawnOk).toBe(true);
    expect(errors).toEqual([]);
  });

  // §4.2 rule 1b. NIP-78 specifies kind 30078 as application-specific data shared
  // by every application, so foreign records on it are the normal state the spec
  // describes. This runs the primary separation against four real,
  // signature-valid events taken verbatim off wss://x.kojira.io. The two
  // separations are asserted independently: a foreign `d` is rejected without
  // content ever being read, and a foreign content profile is rejected even from
  // inside our namespace. The last case is ours and MUST be accepted, so the gate
  // cannot pass by rejecting everything.
  test('B. real foreign 30078 events are separated by the d namespace and ours is accepted', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(async (fx) => {
      const crypto = await import('./dist/rx-nostr-crypto.js');
      const CAT = window.NOSMAPS_CATALOG;
      const CANON = window.NOSMAPS_CANONICAL;
      const T = window.__T;

      async function probe(event) {
        const result = CAT.validateSoftwareEvent(event, T.OPTS);
        // The content-profile separation, evaluated here independently of the
        // gate, so "either one alone rejects it" is a measurement and not a claim.
        const parsed = CANON.strictParse(T.enc(event.content));
        const obj = parsed.ok && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)
          ? parsed.value : null;
        return {
          ok: result.ok,
          reason: result.reason || null,
          d: (event.tags.find(tag => tag[0] === 'd') || [])[1] || null,
          contentIsJsonObject: !!obj,
          contentSchema: obj && typeof obj.schema === 'string' ? obj.schema : null,
          // Unmodified off the wire, so the signature and id still check out.
          sigValid: await crypto.verifier(event),
          idValid: crypto.getEventHash(event) === event.id
        };
      }

      return {
        prefix: CAT.SOFTWARE_D_PREFIX,
        nostter: await probe(fx.nostter),
        amethyst: await probe(fx.amethyst),
        nym: await probe(fx.nym),
        heat: await probe(fx.heat),
        ours: await probe(fx.ours),
        oursRecord: CAT.validateSoftwareEvent(fx.ours, T.OPTS).record,
        // Their `d`, our content profile: the namespace rejects it with no help
        // from the schema check.
        ourSchemaTheirD: CAT.validateSoftwareEvent(T.makeSoftware({d: 'AmethystSettings'}), T.OPTS).reason,
        // Our namespace, their content profile: the schema check rejects it with
        // no help from the namespace gate.
        theirSchemaOurD: CAT.validateSoftwareEvent(
          T.makeSoftware({d: 'nosmaps:com.other.app', rawContent: JSON.stringify({schema: 'com.other.app', version: 1})}),
          T.OPTS
        ).reason,
        // A foreign coordinate is not a coordinate we can even address (§5.2).
        foreignCoordValid: CAT.isValidCoordinate('30078:' + fx.amethyst.pubkey + ':AmethystSettings'),
        ourCoordValid: CAT.isValidCoordinate('30078:' + fx.ours.pubkey + ':nosmaps:io.kojira.nosmaps')
      };
    }, {
      nostter: REAL_30078_NOSTTER, amethyst: REAL_30078_AMETHYST, nym: REAL_30078_NYM,
      heat: REAL_30078_HEAT, ours: OUR_30078_EVENT
    });

    expect(r.prefix).toBe('nosmaps:');

    // All four are genuine unmodified events, not something we typed.
    for (const key of ['nostter', 'amethyst', 'nym', 'heat']) {
      expect(r[key].sigValid, key).toBe(true);
      expect(r[key].idValid, key).toBe(true);
    }

    // Separation 1: `d` outside our namespace, so `foreign-d` — a distinct reason
    // from `foreign-profile`, decided from tags alone.
    expect(r.nostter.d).toBe('nostter-read');
    expect(r.nostter.ok).toBe(false);
    expect(r.nostter.reason).toBe('foreign-d');

    expect(r.amethyst.d).toBe('AmethystSettings');
    expect(r.amethyst.ok).toBe(false);
    expect(r.amethyst.reason).toBe('foreign-d');

    expect(r.nym.d).toBe('nym-presence');
    expect(r.nym.ok).toBe(false);
    expect(r.nym.reason).toBe('foreign-d');

    // A fourth application whose `content` is a well-formed JSON object, so this
    // one is rejected on the namespace alone while parsing perfectly well.
    expect(r.heat.d).toBe('heat:user:90d:v2');
    expect(r.heat.ok).toBe(false);
    expect(r.heat.reason).toBe('foreign-d');
    expect(r.heat.contentIsJsonObject).toBe(true);

    // Separation 2 holds for the same four events on its own: none of them claims
    // our schema, so the content check would reject every one of them too.
    for (const key of ['nostter', 'amethyst', 'nym', 'heat']) {
      expect(r[key].contentSchema, key).not.toBe('org.nosmaps.software');
    }
    // Three of the four are not JSON objects at all — empty, or NIP-44 ciphertext
    // — which is exactly why the namespace gate must not depend on parsing content.
    expect(r.nostter.contentIsJsonObject).toBe(false);
    expect(r.amethyst.contentIsJsonObject).toBe(false);
    expect(r.nym.contentIsJsonObject).toBe(false);

    // Each separation fires on its own when the other one would let the event by.
    expect(r.ourSchemaTheirD).toBe('foreign-d');
    expect(r.theirSchemaOurD).toBe('foreign-profile');

    // ...and ours is accepted, prefix carried through into the coordinate.
    expect(r.ours.ok).toBe(true);
    expect(r.ours.reason).toBeNull();
    expect(r.oursRecord.d).toBe('nosmaps:io.kojira.nosmaps');
    expect(r.oursRecord.coordinate).toBe(`30078:${'b'.repeat(64)}:nosmaps:io.kojira.nosmaps`);
    expect(r.oursRecord.name).toBe('Nosmaps');
    expect(r.oursRecord.state).toBe('active');

    expect(r.foreignCoordValid).toBe(false);
    expect(r.ourCoordValid).toBe(true);
    expect(errors).toEqual([]);
  });

  // ---- C. canonical JSON + strict parse (still the content parser) ----
  test('C. strictParse and canonicalize enforce the RFC 8785 boundary', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const C = window.NOSMAPS_CANONICAL;
      const enc = window.__T.enc;
      const rejects = {
        duplicate: C.strictParse(enc('{"a":1,"a":2}')),
        nonInteger: C.strictParse(enc('1.5')),
        unsafe: C.strictParse(enc('99999999999999999999')),
        leadingZero: C.strictParse(enc('01')),
        bom: C.strictParse(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d])),
        trailing: C.strictParse(enc('{}x')),
        control: C.strictParse(new Uint8Array([0x22, 0x61, 0x01, 0x62, 0x22])),
        proto: C.strictParse(enc('{"__proto__":1}'))
      };
      const nested = C.strictParse(enc('{"a":{"b":[1,2,3]},"c":true}'));
      const canonStr = new TextDecoder().decode(C.canonicalize({b: 1, a: 'あ'}));
      const value = {a: 1, b: 2};
      const canonBytes = C.canonicalize(value);
      return {
        rejects: Object.fromEntries(Object.entries(rejects).map(([k, v]) => [k, {ok: v.ok, error: v.error}])),
        nested: {ok: nested.ok, b1: nested.ok && nested.value.a.b[1], c: nested.ok && nested.value.c},
        canonStr,
        hasUnicodeEscape: canonStr.indexOf('\\u') !== -1,
        canonTrue: C.isCanonicalBytes(canonBytes, value),
        spacedFalse: C.isCanonicalBytes(enc('{"a": 1,"b": 2}'), value),
        reorderedFalse: C.isCanonicalBytes(enc('{"b":2,"a":1}'), value)
      };
    });
    expect(r.rejects.duplicate).toEqual({ok: false, error: 'duplicate-key'});
    expect(r.rejects.nonInteger).toEqual({ok: false, error: 'bad-number'});
    expect(r.rejects.unsafe).toEqual({ok: false, error: 'unsafe-integer'});
    expect(r.rejects.leadingZero).toEqual({ok: false, error: 'bad-number'});
    expect(r.rejects.bom).toEqual({ok: false, error: 'bom'});
    expect(r.rejects.trailing).toEqual({ok: false, error: 'trailing-content'});
    expect(r.rejects.control).toEqual({ok: false, error: 'unescaped-control'});
    expect(r.rejects.proto).toEqual({ok: false, error: 'proto-key'});
    expect(r.nested.ok).toBe(true);
    expect(r.nested.b1).toBe(2);
    expect(r.nested.c).toBe(true);
    expect(r.canonStr).toBe('{"a":"あ","b":1}');
    expect(r.hasUnicodeEscape).toBe(false);
    expect(r.canonTrue).toBe(true);
    expect(r.spacedFalse).toBe(false);
    expect(r.reorderedFalse).toBe(false);
    expect(errors).toEqual([]);
  });

  // ---- D. kind 30267 curation sets and counting (§6.1, §6.4, §7.2) ----
  test('D. validateCurationSetEvent parses NIP-51 members and ignores foreign a tags', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const V = window.NOSMAPS_CATALOG.validateCurationSetEvent;
      const T = window.__T;
      const coordA = `30078:${T.PUB_A}:nosmaps:com.example.app1`;
      const coordB = `30078:${T.PUB_B}:nosmaps:com.example.app2`;
      const good = V(T.makeSet({
        members: [coordA, coordB, coordA, '30023:' + T.PUB_A + ':article', 'garbage'],
        extraTags: [['title', 'My picks'], ['image', 'https://example.com/i.png']]
      }), T.OPTS);
      // An empty set is valid: "this curator currently recommends nothing" (§7.2).
      const empty = V(T.makeSet({members: []}), T.OPTS);
      return {
        ok: good.ok,
        members: good.set.members,
        ignored: good.set.ignoredMembers,
        title: good.set.title,
        coordinate: good.set.coordinate,
        curator: good.set.curator,
        emptyOk: empty.ok,
        emptyMembers: empty.set.members,
        noD: V(T.makeSet({d: null}), T.OPTS).reason,
        wrongKind: V(T.makeSoftware(), T.OPTS).reason,
        future: V(T.makeSet({created_at: T.NOW_SEC + 100000}), T.OPTS).reason,
        curA: T.CUR_A
      };
    });
    expect(r.ok).toBe(true);
    expect(r.members).toHaveLength(2);
    expect(r.ignored).toBe(2);
    expect(r.title).toBe('My picks');
    expect(r.coordinate).toBe(`30267:${r.curA}:nostr`);
    expect(r.curator).toBe(r.curA);
    expect(r.emptyOk).toBe(true);
    expect(r.emptyMembers).toEqual([]);
    expect(r.noD).toBe('bad-d');
    expect(r.wrongKind).toBe('bad-kind');
    expect(r.future).toBe('future-timestamp');
    expect(errors).toEqual([]);
  });

  test('D. a curator counts once per tool, set truncation is reported, removal lowers the count', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const CAT = window.NOSMAPS_CATALOG;
      const T = window.__T;
      const coord = `30078:${T.PUB_A}:nosmaps:com.example.tool`;
      const other = `30078:${T.PUB_B}:nosmaps:com.example.other`;

      // Nine sets from one curator, every one listing the same tool.
      const many = [];
      for (let i = 0; i < 9; i += 1) {
        many.push(T.makeSet({d: 'set-' + i, id: ('d' + i).padEnd(64, '0'), members: [coord]}));
      }
      const manyResult = CAT.curationMembership({events: many, pubkeys: [T.CUR_A], nowSec: T.NOW_SEC, receivedAtSec: T.NOW_SEC});

      // Two distinct curators, so the count is a count of distinct pubkeys.
      const two = [
        T.makeSet({pubkey: T.CUR_A, d: 'nostr', id: 'aa'.padEnd(64, '0'), members: [coord, other]}),
        T.makeSet({pubkey: T.CUR_B, d: 'nostr', id: 'bb'.padEnd(64, '0'), members: [coord]})
      ];
      const twoResult = CAT.curationMembership({events: two, pubkeys: [T.CUR_A, T.CUR_B], nowSec: T.NOW_SEC, receivedAtSec: T.NOW_SEC});

      // §7.2: the next version of the same (30267, curator, d) without that
      // member. Plain NIP-51 replaceable-set semantics, no tombstone.
      const removed = two.concat([
        T.makeSet({pubkey: T.CUR_B, d: 'nostr', id: 'cc'.padEnd(64, '0'), created_at: T.NOW_SEC - 100, members: []})
      ]);
      const removedResult = CAT.curationMembership({events: removed, pubkeys: [T.CUR_A, T.CUR_B], nowSec: T.NOW_SEC, receivedAtSec: T.NOW_SEC});

      // An empty set observed is distinguishable from no set observed.
      const emptyOnly = CAT.curationMembership({events: [T.makeSet({pubkey: T.CUR_B, members: []})], pubkeys: [T.CUR_A, T.CUR_B], nowSec: T.NOW_SEC, receivedAtSec: T.NOW_SEC});
      const noneObserved = CAT.curationMembership({events: [], pubkeys: [T.CUR_A, T.CUR_B], nowSec: T.NOW_SEC, receivedAtSec: T.NOW_SEC});

      // A pubkey outside the supplied set is not a curator at all (D5).
      const outside = CAT.curationMembership({events: two, pubkeys: [T.CUR_A], nowSec: T.NOW_SEC, receivedAtSec: T.NOW_SEC});

      return {
        maxSets: CAT.POLICY.GRAPH_MAX_SETS_PER_CURATOR,
        manyCount: (manyResult.recommenders[coord] || []).length,
        manySetsObserved: manyResult.curators[0].setsObserved,
        manySetsUsed: manyResult.curators[0].setsUsed,
        manyTruncated: manyResult.curators[0].truncated,
        manySetIds: manyResult.curators[0].setIds,
        twoCount: twoResult.recommenders[coord].length,
        twoOtherCount: twoResult.recommenders[other].length,
        removedCount: removedResult.recommenders[coord].length,
        removedRecommenders: removedResult.recommenders[coord],
        emptyOnlyCurators: emptyOnly.curators.map(c => [c.curator, c.memberCount]),
        noneObservedCurators: noneObserved.curators.length,
        outsideCount: outside.recommenders[coord].length,
        curA: T.CUR_A, curB: T.CUR_B
      };
    });
    // One curator with nine sets containing the same tool counts once.
    expect(r.manyCount).toBe(1);
    expect(r.manySetsObserved).toBe(9);
    expect(r.manySetsUsed).toBe(r.maxSets);
    expect(r.manyTruncated).toBe(true);
    // Deterministic selection by ascending `d` code-point order.
    expect(r.manySetIds).toEqual(['set-0', 'set-1', 'set-2', 'set-3', 'set-4', 'set-5', 'set-6', 'set-7']);
    expect(r.twoCount).toBe(2);
    expect(r.twoOtherCount).toBe(1);
    // The removal lowers the count by exactly one.
    expect(r.removedCount).toBe(1);
    expect(r.removedRecommenders).toEqual([r.curA]);
    // An empty set is observed (curator present, zero members).
    expect(r.emptyOnlyCurators).toEqual([[r.curB, 0]]);
    // No set observed at all: the curator does not appear.
    expect(r.noneObservedCurators).toBe(0);
    expect(r.outsideCount).toBe(1);
    expect(errors).toEqual([]);
  });

  // ---- E. graph derivation (§6.2) ----
  test('E. deriveGraph reports none, self-only, tier1, malformed p tags, and truncation', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const CAT = window.NOSMAPS_CATALOG;
      const T = window.__T;
      const none = CAT.deriveGraph({viewerPubkey: null, events: [], nowSec: T.NOW_SEC});
      const selfOnly = CAT.deriveGraph({viewerPubkey: T.VIEWER, events: [], nowSec: T.NOW_SEC});

      // Signed tag order is meaningful (NIP-02 appends), so dedupe preserves it.
      const ordered = T.makeFollows({follows: [T.CUR_B, T.CUR_A, T.CUR_B, 'nothex', ['', 'wss://r'], [T.CUR_A.toUpperCase()]]});
      const tier1 = CAT.deriveGraph({viewerPubkey: T.VIEWER, events: [ordered], nowSec: T.NOW_SEC});

      // Union-then-select across relays: the older list must not win.
      const older = T.makeFollows({id: '11'.padEnd(64, '0'), created_at: T.NOW_SEC - 5000, follows: [T.CUR_A]});
      const newer = T.makeFollows({id: '22'.padEnd(64, '0'), created_at: T.NOW_SEC - 400, follows: [T.CUR_A, T.CUR_B]});
      const forward = CAT.deriveGraph({viewerPubkey: T.VIEWER, events: [older, newer], nowSec: T.NOW_SEC});
      const reverse = CAT.deriveGraph({viewerPubkey: T.VIEWER, events: [newer, older], nowSec: T.NOW_SEC});

      // Another pubkey's follow list must never become the viewer's graph.
      const foreign = CAT.deriveGraph({viewerPubkey: T.VIEWER, events: [T.makeFollows({pubkey: T.CUR_A, follows: [T.PUB_A]})], nowSec: T.NOW_SEC});

      const big = [];
      for (let i = 1; i <= 600; i += 1) big.push(T.hexKey(i));
      const truncated = CAT.deriveGraph({viewerPubkey: T.VIEWER, events: [T.makeFollows({follows: big})], nowSec: T.NOW_SEC});

      return {
        cap: CAT.POLICY.GRAPH_MAX_FOLLOWS,
        none: {state: none.state, pubkeys: none.pubkeys, coverage: none.coverage},
        selfOnly: {state: selfOnly.state, pubkeys: selfOnly.pubkeys},
        tier1: {state: tier1.state, pubkeys: tier1.pubkeys, malformed: tier1.malformedPTags, coverage: tier1.coverage},
        forwardJson: JSON.stringify(forward.pubkeys),
        reverseJson: JSON.stringify(reverse.pubkeys),
        foreign: {state: foreign.state, pubkeys: foreign.pubkeys},
        truncated: {
          state: truncated.state, used: truncated.followsUsed, total: truncated.followsTotal,
          coverage: truncated.coverage, flag: truncated.truncated,
          first: truncated.pubkeys[0], last: truncated.pubkeys[truncated.pubkeys.length - 1]
        },
        viewer: T.VIEWER, curA: T.CUR_A, curB: T.CUR_B
      };
    });
    // graph: none — counts are unknown, not zero, and G is empty.
    expect(r.none.state).toBe('none');
    expect(r.none.pubkeys).toEqual([]);
    expect(r.none.coverage).toBe('unknown');
    // graph: self-only — never reported as "you follow nobody".
    expect(r.selfOnly.state).toBe('self-only');
    expect(r.selfOnly.pubkeys).toEqual([r.viewer]);
    // Viewer first, then follows in signed tag order, deduped; malformed dropped.
    expect(r.tier1.state).toBe('tier1');
    expect(r.tier1.pubkeys).toEqual([r.viewer, r.curB, r.curA]);
    expect(r.tier1.malformed).toBe(3);
    expect(r.tier1.coverage).toBe('fresh');
    // I4: union-then-select is arrival-order independent, and the newer list wins.
    expect(r.forwardJson).toBe(r.reverseJson);
    expect(JSON.parse(r.forwardJson)).toEqual([r.viewer, r.curA, r.curB]);
    expect(r.foreign.state).toBe('self-only');
    expect(r.foreign.pubkeys).toEqual([r.viewer]);
    // Truncation is deterministic and reported as "N of M".
    expect(r.truncated.flag).toBe(true);
    expect(r.truncated.used).toBe(r.cap);
    expect(r.truncated.total).toBe(601);
    expect(r.truncated.coverage).toBe('truncated');
    expect(r.truncated.first).toBe(r.viewer);
    expect(r.truncated.last).toBe((511).toString(16).padStart(64, '0'));
    expect(errors).toEqual([]);
  });

  // ---- F. invariant I7 (curation neutrality) ----
  test('F. I7: the listable row set is identical across every graph state', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const CAT = window.NOSMAPS_CATALOG;
      const T = window.__T;
      const topical = T.makeSoftware({id: 'a1'.padEnd(64, '0'), d: 'nosmaps:com.example.topical', created_at: T.NOW_SEC - 3000, content: {name: 'Topical'}});
      // A record that carries no discovery topic at all: only reachable through
      // §5.2 exact fetch, and still listable with zero recommendations (§5.4).
      const untagged = T.makeSoftware({id: 'a2'.padEnd(64, '0'), d: 'nosmaps:com.example.untagged', topics: [], created_at: T.NOW_SEC - 2000, content: {name: 'Untagged'}});
      const otherPub = T.makeSoftware({id: 'a3'.padEnd(64, '0'), pubkey: T.PUB_B, d: 'nosmaps:com.example.other', created_at: T.NOW_SEC - 1000, content: {name: 'Other publisher'}});
      const software = [topical, untagged, otherPub];
      const sets = [
        T.makeSet({pubkey: T.CUR_A, id: 'b1'.padEnd(64, '0'), members: [`30078:${T.PUB_A}:nosmaps:com.example.untagged`]}),
        T.makeSet({pubkey: T.CUR_B, id: 'b2'.padEnd(64, '0'), members: [`30078:${T.PUB_A}:nosmaps:com.example.untagged`, `30078:${T.PUB_A}:nosmaps:com.example.topical`]})
      ];

      const bigFollows = [T.CUR_A, T.CUR_B];
      for (let i = 100; i < 698; i += 1) bigFollows.push(T.hexKey(i));

      const scenarios = {
        none: {viewerPubkey: null, extra: []},
        selfOnly: {viewerPubkey: T.VIEWER, extra: []},
        tier1One: {viewerPubkey: T.VIEWER, extra: [T.makeFollows({follows: [T.CUR_A]})]},
        tier1Many: {viewerPubkey: T.VIEWER, extra: [T.makeFollows({follows: bigFollows})]}
      };
      const out = {};
      for (const key of Object.keys(scenarios)) {
        const s = scenarios[key];
        const result = CAT.buildCatalog({
          events: software.concat(sets, s.extra),
          viewerPubkey: s.viewerPubkey,
          nowMs: T.NOW_SEC * 1000,
          coverage: {'wss://r1': {status: 'eose', observedAt: 1}}
        });
        out[key] = {
          rowSet: result.entries.map(e => e.coordinate).slice().sort().join('|'),
          order: result.entries.map(e => e.coordinate).join('|'),
          counts: result.entries.map(e => e.recommendations),
          graph: result.graph.state,
          status: result.status
        };
      }
      return out;
    });
    const reference = r.none.rowSet;
    expect(reference.split('|')).toHaveLength(3);
    // I7: for any two graphs the listable row set is identical.
    expect(r.selfOnly.rowSet).toBe(reference);
    expect(r.tier1One.rowSet).toBe(reference);
    expect(r.tier1Many.rowSet).toBe(reference);
    expect(r.none.graph).toBe('none');
    expect(r.selfOnly.graph).toBe('self-only');
    expect(r.tier1One.graph).toBe('tier1');
    expect(r.tier1Many.graph).toBe('tier1');
    // Only ordering, counts, and badges differ.
    expect(r.none.counts).toEqual([null, null, null]);
    expect(r.tier1One.counts.some(value => value === 1)).toBe(true);
    expect(r.tier1One.order).not.toBe(r.none.order);
    expect(errors).toEqual([]);
  });

  // ---- G. invariant I8 (unknown is not zero) ----
  test('G. I8: an unknown count is excluded from the ordering key, a real zero is not', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const CAT = window.NOSMAPS_CATALOG;
      const T = window.__T;
      // Older record, one recommendation. Newer record, zero recommendations.
      const older = T.makeSoftware({id: 'c1'.padEnd(64, '0'), d: 'nosmaps:com.example.older', created_at: T.NOW_SEC - 9000, content: {name: 'Older recommended'}});
      const newer = T.makeSoftware({id: 'c2'.padEnd(64, '0'), d: 'nosmaps:com.example.newer', created_at: T.NOW_SEC - 100, content: {name: 'Newer unrecommended'}});
      const set = T.makeSet({pubkey: T.CUR_A, members: [`30078:${T.PUB_A}:nosmaps:com.example.older`]});
      const follows = T.makeFollows({follows: [T.CUR_A]});
      const events = [older, newer, set];

      const noGraph = CAT.buildCatalog({events, viewerPubkey: null, nowMs: T.NOW_SEC * 1000, coverage: {'wss://r1': {status: 'eose', observedAt: 1}}});
      const withGraph = CAT.buildCatalog({events: events.concat([follows]), viewerPubkey: T.VIEWER, nowMs: T.NOW_SEC * 1000, coverage: {'wss://r1': {status: 'eose', observedAt: 1}}});

      // orderEntries is the ordering key itself: unknown counts must be dropped,
      // never coerced to 0.
      const rows = [{coordinate: 'x', recommendations: null, createdAt: 1, eventId: 'a'}, {coordinate: 'y', recommendations: null, createdAt: 2, eventId: 'b'}];
      return {
        noGraphOrder: noGraph.entries.map(e => e.fields.name),
        noGraphCounts: noGraph.entries.map(e => e.recommendations),
        noGraphRecommenders: noGraph.entries.map(e => e.recommenders.length),
        withGraphOrder: withGraph.entries.map(e => e.fields.name),
        withGraphCounts: withGraph.entries.map(e => e.recommendations),
        orderedNone: CAT.orderEntries(rows, 'none').map(e => e.coordinate),
        orderedTier1: CAT.orderEntries(rows, 'tier1').map(e => e.coordinate)
      };
    });
    // No graph: counts unknown, ordering by created_at DESC only.
    expect(r.noGraphCounts).toEqual([null, null]);
    expect(r.noGraphRecommenders).toEqual([0, 0]);
    expect(r.noGraphOrder).toEqual(['Newer unrecommended', 'Older recommended']);
    // Known graph: a real 0 participates in ordering, so the order flips.
    expect(r.withGraphCounts).toEqual([1, 0]);
    expect(r.withGraphOrder).toEqual(['Older recommended', 'Newer unrecommended']);
    expect(r.withGraphOrder).not.toEqual(r.noGraphOrder);
    expect(r.orderedNone).toEqual(['y', 'x']);
    expect(r.orderedTier1).toEqual(['y', 'x']);
    expect(errors).toEqual([]);
  });

  test('G. a logged-out cold build is usable, ordered, and labelled — never empty and never invented', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const CAT = window.NOSMAPS_CATALOG;
      const T = window.__T;
      const events = [
        T.makeSoftware({id: 'd1'.padEnd(64, '0'), d: 'nosmaps:com.example.one', created_at: T.NOW_SEC - 500, content: {name: 'One'}}),
        T.makeSoftware({id: 'd2'.padEnd(64, '0'), d: 'nosmaps:com.example.two', created_at: T.NOW_SEC - 400, content: {name: 'Two'}})
      ];
      const result = CAT.buildCatalog({events, viewerPubkey: null, nowMs: T.NOW_SEC * 1000, coverage: {'wss://r1': {status: 'eose', observedAt: 1}}});
      return {
        count: result.entries.length,
        status: result.status,
        graph: result.graph.state,
        diagnostics: result.diagnostics,
        counted: result.curation.counted,
        curators: result.curation.curators,
        manual: result.curation.manual,
        json: JSON.stringify(result.entries)
      };
    });
    expect(r.count).toBe(2);
    expect(r.status).toBe('fresh');
    expect(r.graph).toBe('none');
    // The situation is stated, not hidden.
    expect(r.diagnostics).toContain('graph-none');
    // No default curator, bundled recommendation set, or featured list (§6.5.5).
    expect(r.counted).toEqual([]);
    expect(r.curators).toEqual([]);
    expect(r.manual).toEqual([]);
    // No fabricated count anywhere in the output.
    expect(r.json).not.toMatch(/"recommendations":\d/);
    expect(errors).toEqual([]);
  });

  // ---- H. withdrawal, reactivation, publisher locality (§7.1, I2, I3) ----
  test('H. only a newer valid winner from the same pubkey withdraws or reactivates a coordinate', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const CAT = window.NOSMAPS_CATALOG;
      const T = window.__T;
      const build = events => CAT.buildCatalog({events, viewerPubkey: null, nowMs: T.NOW_SEC * 1000, coverage: {'wss://r1': {status: 'eose', observedAt: 1}}});
      const active = T.makeSoftware({id: 'f1'.padEnd(64, '0'), created_at: T.NOW_SEC - 3000});
      const withdrawn = T.makeSoftware({id: 'f2'.padEnd(64, '0'), created_at: T.NOW_SEC - 2000, content: {state: 'withdrawn', summary: 'No longer maintained.'}});
      const reactivated = T.makeSoftware({id: 'f3'.padEnd(64, '0'), created_at: T.NOW_SEC - 1000});
      // Someone else publishing "withdrawn" at the same `d` is a different
      // coordinate and cannot touch the first publisher's record (I2).
      const impostor = T.makeSoftware({id: 'f4'.padEnd(64, '0'), pubkey: T.PUB_B, created_at: T.NOW_SEC - 10, content: {state: 'withdrawn'}});
      // A curator recommending it cannot resurrect a withdrawn row either.
      const set = T.makeSet({pubkey: T.CUR_A, members: [`30078:${T.PUB_A}:nosmaps:com.example.tool`]});
      const follows = T.makeFollows({follows: [T.CUR_A]});
      return {
        activeOnly: build([active]).entries.map(e => e.coordinate),
        afterWithdraw: build([active, withdrawn]).entries.map(e => e.coordinate),
        // I3: relay order must not matter.
        afterWithdrawReversed: build([withdrawn, active]).entries.map(e => e.coordinate),
        afterReactivate: build([active, withdrawn, reactivated]).entries.map(e => e.coordinate),
        withImpostor: build([active, withdrawn, impostor]).entries.map(e => e.coordinate),
        curatorCannotResurrect: CAT.buildCatalog({
          events: [active, withdrawn, set, follows], viewerPubkey: T.VIEWER,
          nowMs: T.NOW_SEC * 1000, coverage: {'wss://r1': {status: 'eose', observedAt: 1}}
        }),
        pubA: T.PUB_A, pubB: T.PUB_B
      };
    });
    expect(r.activeOnly).toEqual([`30078:${r.pubA}:nosmaps:com.example.tool`]);
    expect(r.afterWithdraw).toEqual([]);
    expect(r.afterWithdrawReversed).toEqual([]);
    expect(r.afterReactivate).toEqual([`30078:${r.pubA}:nosmaps:com.example.tool`]);
    // The impostor's own coordinate is withdrawn too, so neither row is listable.
    expect(r.withImpostor).toEqual([]);
    // The recommended-but-withdrawn coordinate shows up as unresolved, not a row.
    expect(r.curatorCannotResurrect.entries).toEqual([]);
    expect(r.curatorCannotResurrect.unresolved).toEqual([]);
    expect(errors).toEqual([]);
  });

  // ---- I. NIP-09 deletion is best-effort cleanup, not a ledger (§7.3) ----
  test('I. kind 5 covers versions up to created_at, only from the same author, and is never load-bearing', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const CAT = window.NOSMAPS_CATALOG;
      const T = window.__T;
      const coord = `30078:${T.PUB_A}:nosmaps:com.example.tool`;
      const older = T.makeSoftware({id: 'aa'.padEnd(64, '1'), created_at: 1000, content: {name: 'Older'}});
      const newer = T.makeSoftware({id: 'bb'.padEnd(64, '2'), created_at: 3000, content: {name: 'Newer'}});
      const select = events => CAT.selectSoftwareWinners(events, {
        deletions: CAT.collectDeletions(events, T.OPTS), nowSec: T.NOW_SEC, receivedAtSec: T.NOW_SEC
      });

      // `a` request at 2000 covers the 1000 version and nothing later.
      const upTo = select([older, newer, T.makeDeletion({addresses: [coord], created_at: 2000, k: 30078})]);
      // A deletion request from another pubkey names our address: ignored (I2).
      const foreign = select([older, newer, T.makeDeletion({pubkey: T.PUB_B, addresses: [coord], created_at: 4000})]);
      // An `e` request for the newest id by its own author suppresses that version.
      const byId = select([older, newer, T.makeDeletion({ids: [newer.id], created_at: 4000})]);
      // An `e` request from a different author does not.
      const byIdForeign = select([older, newer, T.makeDeletion({pubkey: T.PUB_B, ids: [newer.id], created_at: 4000})]);
      // No kind 5 observed at all still yields a correct current state.
      const noHistory = select([older, newer]);

      const parsedForeignAddress = CAT.validateDeletionEvent(T.makeDeletion({pubkey: T.PUB_B, addresses: [coord]}), T.OPTS);
      return {
        upToName: upTo.winners[0].record.name,
        upToQuarantined: upTo.quarantined.map(q => q.reason),
        foreignName: foreign.winners[0].record.name,
        foreignQuarantined: foreign.quarantined.length,
        byIdName: byId.winners[0].record.name,
        byIdForeignName: byIdForeign.winners[0].record.name,
        noHistoryName: noHistory.winners[0].record.name,
        parsedForeignAddresses: parsedForeignAddress.deletion.addresses,
        collected: CAT.collectDeletions([T.makeDeletion({addresses: [coord], created_at: 2000}), T.makeDeletion({addresses: [coord], created_at: 2500})], T.OPTS)
      };
    });
    expect(r.upToName).toBe('Newer');
    expect(r.upToQuarantined).toEqual(['deleted']);
    expect(r.foreignName).toBe('Newer');
    expect(r.foreignQuarantined).toBe(0);
    expect(r.byIdName).toBe('Older');
    expect(r.byIdForeignName).toBe('Newer');
    expect(r.noHistoryName).toBe('Newer');
    // NIP-09 same-author rule enforced at parse time.
    expect(r.parsedForeignAddresses).toEqual([]);
    expect(r.collected.accepted).toBe(2);
    expect(Object.values(r.collected.addresses)).toEqual([2500]);
    expect(errors).toEqual([]);
  });

  // ---- J. recall path and unresolved references (§5.4, §6.6) ----
  test('J. a recommended coordinate with no observed winner is unresolved, never a fabricated row', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const CAT = window.NOSMAPS_CATALOG;
      const T = window.__T;
      const ghost = `30078:${T.PUB_B}:nosmaps:com.example.ghost`;
      const events = [
        T.makeSoftware({id: 'g1'.padEnd(64, '0')}),
        T.makeSet({pubkey: T.CUR_A, members: [ghost]}),
        T.makeFollows({follows: [T.CUR_A]})
      ];
      const result = CAT.buildCatalog({events, viewerPubkey: T.VIEWER, nowMs: T.NOW_SEC * 1000, coverage: {'wss://r1': {status: 'eose', observedAt: 1}}});
      // §5.2 grouping: exact fetch filters are grouped by author, never Cartesian.
      const grouped = CAT.groupByAuthor([`30078:${T.PUB_A}:nosmaps:tool-a`, `30078:${T.PUB_A}:nosmaps:tool-b`, ghost]);
      return {
        rows: result.entries.map(e => e.coordinate),
        unresolved: result.unresolved,
        diagnostics: result.diagnostics,
        grouped,
        ghost, pubA: T.PUB_A, pubB: T.PUB_B
      };
    });
    expect(r.rows).toEqual([`30078:${r.pubA}:nosmaps:com.example.tool`]);
    expect(r.unresolved).toEqual([r.ghost]);
    expect(r.diagnostics).toContain('recommended-coordinate-not-observed:1');
    expect(r.grouped).toHaveLength(2);
    expect(r.grouped[0].authors).toEqual([r.pubA]);
    // The `#d` filter values keep the namespace prefix: a bare `tool-a` would ask
    // the relay for every app's `tool-a` record.
    expect(r.grouped[0]['#d']).toEqual(['nosmaps:tool-a', 'nosmaps:tool-b']);
    expect(r.grouped[1].authors).toEqual([r.pubB]);
    for (const filter of r.grouped) expect(filter.authors).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  // ---- K. REQ budget and byte-aware chunking (§9.3, §9.4) ----
  test('K. curator count grows bytes, never logical rounds; chunking matches §9.3', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const CAT = window.NOSMAPS_CATALOG;
      const T = window.__T;
      const out = {};
      for (const C of [1, 8, 64, 512, 2048]) {
        const authors = [];
        for (let i = 0; i < C; i += 1) authors.push(T.hexKey(i));
        const chunked = CAT.chunkFilters([{kinds: [30267], authors, limit: 512}], {subId: 'nosmaps-r2'});
        const maxBytes = Math.max.apply(null, chunked.chunks.map(chunk => new TextEncoder().encode(JSON.stringify(['REQ', 'nosmaps-r2'].concat(chunk))).length));
        const seen = new Set();
        for (const chunk of chunked.chunks) for (const f of chunk) for (const a of f.authors) seen.add(a);
        out['c' + C] = {chunks: chunked.chunks.length, maxBytes, covered: seen.size};
      }
      // A scalar-only filter that cannot fit fails visibly rather than silently.
      const tooBig = CAT.chunkFilters([{kinds: [30078], search: 'x'.repeat(200)}], {maxBytes: 40});
      // An array cap is applied independently of the byte budget.
      const capped = CAT.chunkFilters([{kinds: [5], '#a': Array.from({length: 300}, (_, i) => 'a' + i)}], {maxBytes: 1000000});
      return {
        out,
        arrayCap: CAT.POLICY.MAX_ARRAY_ITEMS_PER_FILTER,
        maxFilters: CAT.POLICY.MAX_FILTERS_PER_REQ,
        fallbackBytes: CAT.POLICY.MAX_SERIALIZED_REQ_BYTES_FALLBACK,
        tooBig: {ok: tooBig.ok, reason: tooBig.reason},
        cappedFilters: capped.chunks[0].map(f => f['#a'].length)
      };
    });
    // §9.3: R2 chunk counts, i.e. cold-catalog physical REQs of 1 + n + 1.
    expect(r.out.c1.chunks).toBe(1);
    expect(r.out.c8.chunks).toBe(1);
    expect(r.out.c64.chunks).toBe(1);
    expect(r.out.c512.chunks).toBe(3);
    expect(r.out.c2048.chunks).toBe(12);
    // Every curator still travels, and no REQ exceeds the byte fallback.
    for (const key of ['c1', 'c8', 'c64', 'c512', 'c2048']) {
      expect(r.out[key].maxBytes).toBeLessThanOrEqual(r.fallbackBytes);
    }
    expect(r.out.c2048.covered).toBe(2048);
    expect(r.tooBig).toEqual({ok: false, reason: 'filter-too-large'});
    expect(r.cappedFilters).toEqual([128, 128, 44]);
    expect(errors).toEqual([]);
  });

  test('K. npub decoding enables read-only ranking without a signer', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const decode = window.NOSMAPS_CATALOG.decodeNpub;
      return {
        // NIP-19 test vector.
        vector: decode('npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6'),
        hexPassthrough: decode('7e'.repeat(32)),
        badChecksum: decode('npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w7'),
        notNpub: decode('nsec180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6'),
        junk: decode('hello'),
        empty: decode('')
      };
    });
    expect(r.vector).toBe('3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d');
    expect(r.hexPassthrough).toBe('7e'.repeat(32));
    expect(r.badChecksum).toBeNull();
    expect(r.notNpub).toBeNull();
    expect(r.junk).toBeNull();
    expect(r.empty).toBeNull();
    expect(errors).toEqual([]);
  });

  // ---- L. IndexedDB derived cache (D14) ----
  test('L. the derived cache stores signed events by coordinate, wipes, rebuilds, and degrades safely', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(async () => {
      const CAT = window.NOSMAPS_CATALOG;
      const cache = CAT.cache;
      const T = window.__T;
      const event = T.makeSoftware({id: 'ca'.padEnd(64, '0')});
      const coordinate = `30078:${T.PUB_A}:nosmaps:com.example.tool`;
      const record = {coordinate, eventId: event.id, createdAt: event.created_at, receivedAtSec: T.NOW_SEC, verifiedAt: Date.now(), event};

      await cache.wipe();
      await cache.putRecord(record);
      const got = await cache.getRecord(coordinate);

      // A wiped cache is rebuildable purely from the signed events (§8.4).
      await cache.wipe();
      const afterWipe = await cache.getRecord(coordinate);
      const allAfterWipe = await cache.getAll();
      const rebuilt = CAT.buildCatalog({
        events: [got.event], viewerPubkey: null, nowMs: T.NOW_SEC * 1000,
        coverage: {'wss://r1': {status: 'eose', observedAt: 1}}
      });

      // A cached winner that was not re-observed is served as stale, not fresh.
      const staleResult = CAT.buildCatalog({
        events: [got.event], viewerPubkey: null, nowMs: T.NOW_SEC * 1000,
        receipts: {[got.event.id]: {receivedAtSec: T.NOW_SEC, observed: false, cached: true}},
        coverage: {'wss://r1': {status: 'eose', observedAt: 1}}
      });

      let threw = false;
      let afterDelete = 'not-run';
      try {
        await cache.deleteDatabase();
        afterDelete = await cache.getRecord(coordinate);
      } catch (e) {
        threw = true;
      }
      return {
        gotEventId: got && got.eventId,
        gotCoordinate: got && got.coordinate,
        afterWipeNull: afterWipe === null,
        allAfterWipeEmpty: Array.isArray(allAfterWipe) && allAfterWipe.length === 0,
        rebuiltRows: rebuilt.entries.map(e => e.coordinate),
        rebuiltStale: rebuilt.entries.map(e => e.stale),
        rebuiltStatus: rebuilt.status,
        staleRows: staleResult.entries.map(e => e.coordinate),
        staleFlags: staleResult.entries.map(e => e.stale),
        staleStatus: staleResult.status,
        threw,
        afterDeleteResolved: afterDelete === null || (afterDelete && typeof afterDelete === 'object'),
        eventId: event.id, coordinate
      };
    });
    expect(r.gotEventId).toBe(r.eventId);
    expect(r.gotCoordinate).toBe(r.coordinate);
    expect(r.afterWipeNull).toBe(true);
    expect(r.allAfterWipeEmpty).toBe(true);
    expect(r.rebuiltRows).toEqual([r.coordinate]);
    expect(r.rebuiltStale).toEqual([false]);
    expect(r.rebuiltStatus).toBe('fresh');
    expect(r.staleRows).toEqual([r.coordinate]);
    expect(r.staleFlags).toEqual([true]);
    expect(r.staleStatus).toBe('stale');
    expect(r.threw).toBe(false);
    expect(r.afterDeleteResolved).toBe(true);
    expect(errors).toEqual([]);
  });
}

registerUnit();

test.describe('375x812 relay unit coverage', () => {
  test.use({viewport: {width: 375, height: 812}});
  registerUnit();
});
