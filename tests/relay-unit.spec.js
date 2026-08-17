const {test, expect} = require('@playwright/test');

function collectErrors(page) {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

// Fixtures are constructed inside the page so they exercise the real browser
// globals (WebCrypto, IndexedDB) and the real classic-script data layer.
function installHelpers() {
  window.__T = {
    // A canonical, fully self-consistent pointer event. `over.content` merges
    // content-field overrides; tags are regenerated to match the content so the
    // fixture is correct by construction and only the intentionally-broken field
    // differs.
    makePointerEvent(over) {
      over = over || {};
      const C = window.NOSMAPS_CANONICAL;
      const content = Object.assign({
        schema: 'org.nosmaps.catalog-pointer', version: 1, state: 'active', scope: 'global',
        generation: 0, sha256: 'a'.repeat(64), bytes: 100,
        mime: 'application/vnd.nosmaps.catalog+json', entry_count: 2,
        generated_at: 1700000000, previous: null, mirrors: []
      }, over.content || {});
      const contentStr = new TextDecoder().decode(C.canonicalize(content));
      const tags = [
        ['d', 'nosmaps:catalog:v1:' + content.scope],
        ['L', 'org.nosmaps.schema'],
        ['l', 'catalog-pointer', 'org.nosmaps.schema'],
        ['v', '1'],
        ['state', content.state],
        ['generation', String(content.generation)],
        ['x', content.sha256],
        ['size', String(content.bytes)],
        ['m', content.mime],
        ['count', String(content.entry_count)],
        ['generated_at', String(content.generated_at)]
      ];
      if (content.previous !== null) {
        tags.push(['prev', String(content.previous.generation), content.previous.pointer_id, content.previous.sha256]);
      }
      for (let i = 0; i < content.mirrors.length; i += 1) tags.push(['url', content.mirrors[i]]);
      return {
        id: 'b'.repeat(64), pubkey: 'c'.repeat(64), kind: 30367,
        created_at: 1700000000, content: contentStr, tags: tags, sig: 'd'.repeat(128)
      };
    },
    async makeManifest() {
      const C = window.NOSMAPS_CANONICAL;
      const curator = 'e'.repeat(64);
      const pk = '1'.repeat(64);
      const entries = [
        {coordinate: '32267:' + pk + ':aaa', state: 'active', event_id: null, fields: {name: 'Alice'}},
        {coordinate: '32267:' + pk + ':bbb', state: 'active', event_id: null, fields: {name: 'Bob'}}
      ];
      const manifest = {
        schema: 'org.nosmaps.catalog', version: 1, scope: 'global', curator: curator,
        generation: 0, generated_at: 1700000000, previous: null, entries: entries
      };
      const bytes = C.canonicalize(manifest);
      const sha256 = await C.sha256Hex(bytes);
      const pointer = {
        curator: curator, scope: 'global', generation: 0, generatedAt: 1700000000,
        previous: null, entryCount: entries.length, bytes: bytes.length, sha256: sha256, mirrors: []
      };
      return {manifest: manifest, bytes: bytes, sha256: sha256, pointer: pointer};
    },
    enc(str) { return new TextEncoder().encode(str); }
  };
}

const EXPLORER = 'nip-explorer.html';

const XRP_SQUATTER = {
  content: '{"displayName":"rHwWjw...LPvD","pftlAddress":"rHwWjwq5Sxq9u48zrLzqH29c2ATg3zLPvD"}',
  created_at: 1765910648,
  id: 'd97f9222b84668fc68440fbbf8e13dc7deb23ecefb615e0849dcd66fe53213ab',
  kind: 30367,
  pubkey: '5772f4ffb014df0da170245d8216dafc3969e7516e392e2e51e76b6e087ee680',
  sig: '4e8f786e8c736d6f1efb49cf87c1a276dbedb65a3a474d6858124c0d82373f4d3e59a1a2ed278c51813acc2f6c7d52dc5adb915af482b2db96356b0fb384ccb6',
  tags: [['d', 'c376eab2ffe9489b'], ['p', 'a5aa1c83362a7c7e79d0cb596b488405a1e7350428826199729b58a44857b710']]
};

function registerUnit() {
  test.beforeEach(async ({page}) => {
    await page.addInitScript(installHelpers);
  });

  // ---- A. addressable winner selection ----
  test('A. selectPointerWinner / selectWinnersByCurator honour NIP-01 rules', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const {selectPointerWinner, selectWinnersByCurator} = window.NOSMAPS_CATALOG;
      const mk = (id, created_at, pubkey, d) => ({id, created_at, pubkey: pubkey || 'p'.repeat(64), kind: 30367, tags: [['d', d || 'nosmaps:catalog:v1:global']]});
      // 1. greater created_at wins regardless of id ordering.
      const greater = selectPointerWinner([mk('ffff', 10), mk('0000', 20)]);
      // 2. tie on created_at -> lexicographically lowest id, order independent.
      const a = mk('aaaa', 50);
      const b = mk('bbbb', 50);
      const tie1 = selectPointerWinner([a, b]);
      const tie2 = selectPointerWinner([b, a]);
      // 3. empty -> null.
      const empty = selectPointerWinner([]);
      // 4. two curators x two events -> exactly two winners, one per coordinate.
      const cx = 'c'.repeat(64);
      const cy = 'f'.repeat(64);
      const grouped = selectWinnersByCurator([
        mk('x1', 10, cx), mk('x2', 20, cx),
        mk('y1', 30, cy), mk('y2', 15, cy)
      ], {});
      return {
        greaterId: greater.id,
        tie1: tie1.id, tie2: tie2.id,
        empty: empty,
        winnerCount: grouped.length,
        curators: grouped.map(w => w.curator).sort(),
        cxWinner: (grouped.find(w => w.curator === cx) || {}).event && grouped.find(w => w.curator === cx).event.id,
        cyWinner: (grouped.find(w => w.curator === cy) || {}).event && grouped.find(w => w.curator === cy).event.id
      };
    });
    expect(r.greaterId).toBe('0000');
    expect(r.tie1).toBe('aaaa');
    expect(r.tie2).toBe('aaaa');
    expect(r.empty).toBeNull();
    expect(r.winnerCount).toBe(2);
    expect(r.cxWinner).toBe('x2');
    expect(r.cyWinner).toBe('y1');
    expect(errors).toEqual([]);
  });

  // ---- B. pointer validation ----
  test('B. validatePointerEvent accepts a well-formed pointer and rejects the live XRP squatter', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate((xrp) => {
      const V = window.NOSMAPS_CATALOG.validatePointerEvent;
      const good = window.__T.makePointerEvent();
      const okRes = V(good);
      const xrpRes = V(xrp);
      return {ok: okRes, xrp: xrpRes, goodPub: good.pubkey, goodCreated: good.created_at};
    }, XRP_SQUATTER);
    // 5. well-formed pointer validates and echoes the parsed fields.
    expect(r.ok.ok).toBe(true);
    expect(r.ok.pointer.curator).toBe(r.goodPub);
    expect(r.ok.pointer.scope).toBe('global');
    expect(r.ok.pointer.generation).toBe(0);
    expect(r.ok.pointer.sha256).toBe('a'.repeat(64));
    expect(r.ok.pointer.bytes).toBe(100);
    expect(r.ok.pointer.mime).toBe('application/vnd.nosmaps.catalog+json');
    expect(r.ok.pointer.entryCount).toBe(2);
    expect(r.ok.pointer.generatedAt).toBe(1700000000);
    expect(r.ok.pointer.previous).toBeNull();
    expect(r.ok.pointer.mirrors).toEqual([]);
    expect(r.ok.pointer.state).toBe('active');
    expect(r.ok.pointer.createdAt).toBe(r.goodCreated);
    // 6. the real live XRP squatter event is rejected.
    expect(r.xrp.ok).toBe(false);
    expect(r.xrp.reason).toBe('bad-d');
  });

  test('B. validatePointerEvent rejects each malformed variant with the documented reason', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(() => {
      const V = window.NOSMAPS_CATALOG.validatePointerEvent;
      const mk = window.__T.makePointerEvent;
      const out = {};

      // wrong kind
      const e1 = mk(); e1.kind = 30000;
      out.wrongKind = V(e1).reason;

      // bad d (wrong prefix)
      const e2 = mk();
      e2.tags = e2.tags.map(t => t[0] === 'd' ? ['d', 'nosmaps:catalog:v2:global'] : t);
      out.badD = V(e2).reason;

      // tag/content mismatch: flip one tag so it disagrees with content
      const e3 = mk();
      e3.tags = e3.tags.map(t => t[0] === 'state' ? ['state', 'withdrawn'] : t);
      out.tagMismatch = V(e3).reason;

      // non-canonical content (trailing space => still parses, not canonical)
      const e4 = mk();
      e4.content = e4.content + ' ';
      out.nonCanonical = V(e4).reason;

      // bad sha256 (not 64 lowercase hex)
      out.badSha = V(mk({content: {sha256: 'zz'}})).reason;

      // wrong MIME
      out.badMime = V(mk({content: {mime: 'application/json'}})).reason;

      // non-HTTPS mirror
      out.httpMirror = V(mk({content: {mirrors: ['http://cdn.example/' + 'a'.repeat(64) + '.json']}})).reason;

      // mirror whose path hash differs from x
      out.mirrorHash = V(mk({content: {mirrors: ['https://cdn.example/deadbeef.json']}})).reason;

      // unknown content field
      out.unknownField = V(mk({content: {extra: 'x'}})).reason;

      // bad state enum
      out.badState = V(mk({content: {state: 'paused'}})).reason;

      // future created_at beyond MAX_FUTURE_SKEW
      const e5 = mk();
      const nowSec = Math.floor(Date.now() / 1000);
      e5.created_at = nowSec + 100000;
      out.future = V(e5).reason;

      // untrusted curator when trustedCurators supplied
      out.untrusted = V(mk(), {trustedCurators: ['9'.repeat(64)]}).reason;

      return out;
    });
    expect(r.wrongKind).toBe('bad-kind');
    expect(r.badD).toBe('bad-d');
    expect(r.tagMismatch).toBe('tag-content-mismatch');
    expect(r.nonCanonical).toBe('noncanonical-content');
    expect(r.badSha).toBe('bad-sha256');
    expect(r.badMime).toBe('bad-mime');
    expect(r.httpMirror).toBe('bad-mirror');
    expect(r.mirrorHash).toBe('bad-mirror');
    expect(r.unknownField).toBe('unknown-field');
    expect(r.badState).toBe('bad-state');
    expect(r.future).toBe('future-timestamp');
    expect(r.untrusted).toBe('untrusted-curator');
    expect(errors).toEqual([]);
  });

  // ---- C. canonical JSON + strict parse ----
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
      // 9. valid nested object accepted, correct value returned.
      const nested = C.strictParse(enc('{"a":{"b":[1,2,3]},"c":true}'));
      // 10. canonicalize: key sort by UTF-16 code unit, non-ASCII literal.
      const canonStr = new TextDecoder().decode(C.canonicalize({b: 1, a: 'あ'}));
      // 11. isCanonicalBytes true for canonical, false for spaced / reordered.
      const value = {a: 1, b: 2};
      const canonBytes = C.canonicalize(value);
      const canonTrue = C.isCanonicalBytes(canonBytes, value);
      const spacedFalse = C.isCanonicalBytes(enc('{"a": 1,"b": 2}'), value);
      const reorderedFalse = C.isCanonicalBytes(enc('{"b":2,"a":1}'), value);
      return {
        rejects: Object.fromEntries(Object.entries(rejects).map(([k, v]) => [k, {ok: v.ok, error: v.error}])),
        nested: {ok: nested.ok, b1: nested.ok && nested.value.a.b[1], c: nested.ok && nested.value.c},
        canonStr,
        hasUnicodeEscape: canonStr.indexOf('\\u') !== -1,
        canonTrue, spacedFalse, reorderedFalse
      };
    });
    // 8. every strict-parse rejection.
    expect(r.rejects.duplicate).toEqual({ok: false, error: 'duplicate-key'});
    expect(r.rejects.nonInteger).toEqual({ok: false, error: 'bad-number'});
    expect(r.rejects.unsafe).toEqual({ok: false, error: 'unsafe-integer'});
    expect(r.rejects.leadingZero).toEqual({ok: false, error: 'bad-number'});
    expect(r.rejects.bom).toEqual({ok: false, error: 'bom'});
    expect(r.rejects.trailing).toEqual({ok: false, error: 'trailing-content'});
    expect(r.rejects.control).toEqual({ok: false, error: 'unescaped-control'});
    expect(r.rejects.proto).toEqual({ok: false, error: 'proto-key'});
    // 9. accepts nested.
    expect(r.nested.ok).toBe(true);
    expect(r.nested.b1).toBe(2);
    expect(r.nested.c).toBe(true);
    // 10. exact canonical bytes, non-ASCII literal.
    expect(r.canonStr).toBe('{"a":"あ","b":1}');
    expect(r.hasUnicodeEscape).toBe(false);
    // 11. isCanonicalBytes discrimination.
    expect(r.canonTrue).toBe(true);
    expect(r.spacedFalse).toBe(false);
    expect(r.reorderedFalse).toBe(false);
    expect(errors).toEqual([]);
  });

  // ---- D. manifest verification ----
  test('D. verifyManifestBytes detects every failure class independently', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(async () => {
      const CAT = window.NOSMAPS_CATALOG;
      const C = window.NOSMAPS_CANONICAL;
      const base = await window.__T.makeManifest();

      // 12. all-correct.
      const good = await CAT.verifyManifestBytes(base.bytes, base.pointer);

      // 13. size mismatch: bytes length differs from pointer.bytes.
      const size = await CAT.verifyManifestBytes(base.bytes, Object.assign({}, base.pointer, {bytes: base.bytes.length + 1}));

      // 14. hash mismatch: same length, one byte changed.
      const wrong = base.bytes.slice();
      wrong[wrong.length - 3] = wrong[wrong.length - 3] ^ 0x01;
      const hash = await CAT.verifyManifestBytes(wrong, base.pointer);

      // 15. non-canonical bytes that still hash correctly to the pointer.
      const pretty = C.utf8Encode(JSON.stringify(base.manifest, null, 2));
      const prettySha = await C.sha256Hex(pretty);
      const prettyPointer = Object.assign({}, base.pointer, {bytes: pretty.length, sha256: prettySha});
      const noncanonical = await CAT.verifyManifestBytes(pretty, prettyPointer);

      return {
        good: {ok: good.ok},
        size: size.reason,
        hash: hash.reason,
        noncanonical: noncanonical.reason,
        prettyHashMatches: prettySha === prettyPointer.sha256,
        prettySizeMatches: pretty.length === prettyPointer.bytes
      };
    });
    expect(r.good.ok).toBe(true);
    expect(r.size).toBe('size');
    expect(r.hash).toBe('hash');
    // proves canonical form is enforced independently of size and hash.
    expect(r.prettyHashMatches).toBe(true);
    expect(r.prettySizeMatches).toBe(true);
    expect(r.noncanonical).toBe('noncanonical');
    expect(errors).toEqual([]);
  });

  test('D. validateManifestValue rejects each schema violation', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(async () => {
      const validate = window.NOSMAPS_CATALOG.validateManifestValue;
      async function fresh() {
        const m = await window.__T.makeManifest();
        return {value: JSON.parse(JSON.stringify(m.manifest)), pointer: m.pointer};
      }
      const out = {};

      let f = await fresh(); f.value.extra = 'x';
      out.unknownTop = validate(f.value, f.pointer).reason;

      f = await fresh();
      out.entryCount = validate(f.value, Object.assign({}, f.pointer, {entryCount: 99})).reason;

      f = await fresh(); f.value.entries = [f.value.entries[1], f.value.entries[0]];
      out.unsorted = validate(f.value, f.pointer).reason;

      f = await fresh(); f.value.entries[1].coordinate = f.value.entries[0].coordinate;
      out.duplicate = validate(f.value, f.pointer).reason;

      f = await fresh(); f.value.entries[0].fields.bogus = 'x';
      out.unknownFieldsKey = validate(f.value, f.pointer).reason;

      f = await fresh(); f.value.entries[0].state = 'paused';
      out.badEntryState = validate(f.value, f.pointer).reason;

      f = await fresh(); f.value.curator = '9'.repeat(64);
      out.curator = validate(f.value, f.pointer).reason;

      f = await fresh(); f.value.scope = 'other';
      out.scope = validate(f.value, f.pointer).reason;

      f = await fresh(); f.value.generation = 5;
      out.generation = validate(f.value, f.pointer).reason;

      return out;
    });
    expect(r.unknownTop).toBe('unknown-field');
    expect(r.entryCount).toBe('bad-schema');
    expect(r.unsorted).toBe('bad-schema');
    expect(r.duplicate).toBe('bad-schema');
    expect(r.unknownFieldsKey).toBe('unknown-field');
    expect(r.badEntryState).toBe('bad-state');
    expect(r.curator).toBe('tag-content-mismatch');
    expect(r.scope).toBe('tag-content-mismatch');
    expect(r.generation).toBe('tag-content-mismatch');
    expect(errors).toEqual([]);
  });

  // ---- E. bounded mirror fallback ----
  test('E. fetchVerifiedManifest performs bounded, verified mirror fallback', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(async () => {
      const CAT = window.NOSMAPS_CATALOG;
      const base = await window.__T.makeManifest();
      const sha = base.sha256;
      const mirror = i => 'https://m' + i + '.example/' + sha + '.json';
      const okResp = (bytes) => ({
        ok: true, status: 200,
        headers: {get: () => null},
        arrayBuffer: async () => (new Uint8Array(bytes)).buffer
      });
      const failResp = {ok: false, status: 500, headers: {get: () => null}, arrayBuffer: async () => new ArrayBuffer(0)};

      // 17. first mirror 500, second serves valid bytes -> fresh, exactly two calls.
      let calls17 = 0;
      const p17 = Object.assign({}, base.pointer, {mirrors: [mirror(0), mirror(1)]});
      const r17 = await CAT.fetchVerifiedManifest(p17, {
        fetchImpl: (url) => { calls17 += 1; return Promise.resolve(calls17 === 1 ? failResp : okResp(base.bytes)); }
      });

      // 18. all mirrors fail, no cache -> unavailable, calls <= MAX_MIRROR_ATTEMPTS.
      let calls18 = 0;
      const p18 = Object.assign({}, base.pointer, {mirrors: [0, 1, 2, 3, 4, 5].map(mirror)});
      const r18 = await CAT.fetchVerifiedManifest(p18, {
        fetchImpl: (url) => { calls18 += 1; return Promise.resolve(failResp); }
      });

      // 19. all mirrors fail but a verified cache is supplied -> stale, cached value.
      let calls19 = 0;
      const cachedValue = {marker: 'cached-generation'};
      const r19 = await CAT.fetchVerifiedManifest(p18, {
        cached: {value: cachedValue},
        fetchImpl: (url) => { calls19 += 1; return Promise.resolve(failResp); }
      });

      // 20. bytes failing the hash check are never accepted (invariant I1).
      const tampered = base.bytes.slice();
      tampered[2] = tampered[2] ^ 0x01;
      let calls20 = 0;
      const p20 = Object.assign({}, base.pointer, {mirrors: [mirror(0)]});
      const r20 = await CAT.fetchVerifiedManifest(p20, {
        fetchImpl: (url) => { calls20 += 1; return Promise.resolve(okResp(tampered)); }
      });

      return {
        maxAttempts: CAT.POLICY.MAX_MIRROR_ATTEMPTS,
        r17: {status: r17.status, calls: calls17},
        r18: {status: r18.status, calls: calls18},
        r19: {status: r19.status, value: r19.value, calls: calls19},
        r20: {status: r20.status, value: r20.value}
      };
    });
    expect(r.r17.status).toBe('fresh');
    expect(r.r17.calls).toBe(2);
    expect(r.r18.status).toBe('unavailable');
    expect(r.r18.calls).toBeLessThanOrEqual(r.maxAttempts);
    expect(r.r19.status).toBe('stale');
    expect(r.r19.value).toEqual({marker: 'cached-generation'});
    expect(r.r20.status).toBe('unavailable');
    expect(r.r20.value).toBeUndefined();
    expect(errors).toEqual([]);
  });

  // ---- F. IndexedDB cache wipe -> rebuild ----
  test('F. IndexedDB derived cache stores, wipes, rebuilds, and degrades safely', async ({page}) => {
    const errors = collectErrors(page);
    await page.goto(EXPLORER);
    const r = await page.evaluate(async () => {
      const CAT = window.NOSMAPS_CATALOG;
      const cache = CAT.cache;
      const base = await window.__T.makeManifest();
      const curator = base.pointer.curator;
      const scope = 'global';
      const record = {
        curator, scope, generation: 0, sha256: base.sha256,
        entryCount: base.pointer.entryCount, verifiedAt: Date.now(), value: base.manifest
      };

      // 21. put then get returns it.
      await cache.putManifest(record);
      const got = await cache.getManifest(curator, scope);

      // 22. wipe clears everything.
      await cache.wipe();
      const afterWipe = await cache.getManifest(curator, scope);
      const allAfterWipe = await cache.getAll();

      // 23. full rebuild from pointer + Blossom bytes alone.
      const mirror = 'https://m0.example/' + base.sha256 + '.json';
      const pointer = Object.assign({}, base.pointer, {mirrors: [mirror]});
      const fetched = await CAT.fetchVerifiedManifest(pointer, {
        fetchImpl: () => Promise.resolve({
          ok: true, status: 200, headers: {get: () => null},
          arrayBuffer: async () => (new Uint8Array(base.bytes)).buffer
        })
      });
      await cache.putManifest({
        curator, scope, generation: 0, sha256: pointer.sha256,
        entryCount: pointer.entryCount, verifiedAt: Date.now(), value: fetched.value
      });
      const rebuilt = await cache.getManifest(curator, scope);

      // 24. deleteDatabase resolves and a later getManifest still resolves (no throw).
      let threw = false;
      let afterDelete = 'not-run';
      try {
        await cache.deleteDatabase();
        afterDelete = await cache.getManifest(curator, scope);
      } catch (e) {
        threw = true;
      }

      return {
        gotSha: got && got.sha256,
        gotEntryCount: got && got.entryCount,
        afterWipeNull: afterWipe === null,
        allAfterWipeEmpty: Array.isArray(allAfterWipe) && allAfterWipe.length === 0,
        fetchedStatus: fetched.status,
        rebuiltSha: rebuilt && rebuilt.sha256,
        rebuiltEntryCount: rebuilt && rebuilt.entryCount,
        originalSha: base.sha256,
        originalEntryCount: base.pointer.entryCount,
        threw,
        afterDeleteResolved: afterDelete === null || (afterDelete && typeof afterDelete === 'object')
      };
    });
    expect(r.gotSha).toBe(r.originalSha);
    expect(r.gotEntryCount).toBe(r.originalEntryCount);
    expect(r.afterWipeNull).toBe(true);
    expect(r.allAfterWipeEmpty).toBe(true);
    expect(r.fetchedStatus).toBe('fresh');
    expect(r.rebuiltSha).toBe(r.originalSha);
    expect(r.rebuiltEntryCount).toBe(r.originalEntryCount);
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
