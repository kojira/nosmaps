/* Nosmaps relay-native catalog data layer.
   Classic browser script (no modules). Exposes window.NOSMAPS_CATALOG.
   Implements the frozen data-layer contract: pointer/manifest validation,
   HTTP mirror fetch+verify, an IndexedDB derived cache, the rx-nostr relay
   layer, and loadCatalog orchestration.
   Authoritative design: design-relay-native-data.md (§1, §3.2, §3.3, §3.4,
   §4.3, §7.1, §7.2). Depends on window.NOSMAPS_CANONICAL. */
(() => {
  'use strict';

  const C = window.NOSMAPS_CANONICAL;
  const utf8Encode = C.utf8Encode;
  const utf8ByteLength = C.utf8ByteLength;
  const isLowercaseSha256Hex = C.isLowercaseSha256Hex;
  const sha256Hex = C.sha256Hex;
  const strictParse = C.strictParse;
  const isCanonicalBytes = C.isCanonicalBytes;

  // 64-hex identifiers (pubkey, event id, pointer id) share the sha256 shape.
  function isLowercaseHex64(v) {
    return isLowercaseSha256Hex(v);
  }

  const POLICY = {
    POINTER_KIND: 30367,
    MANIFEST_MIME: 'application/vnd.nosmaps.catalog+json',
    POINTER_D_PREFIX: 'nosmaps:catalog:v1:',
    DEFAULT_RELAYS: ['wss://x.kojira.io', 'wss://nos.lol'],
    DEFAULT_SCOPE: 'global',
    CATALOG_STALE_AFTER_MS: 24 * 60 * 60 * 1000,
    MAX_MIRROR_ATTEMPTS: 4,
    MAX_TRUSTED_CURATORS_FOR_SINGLE_COLD_REQ: 8,
    MAX_FUTURE_SKEW_SEC: 600,
    MAX_FUTURE_HORIZON_SEC: 30 * 24 * 60 * 60,
    MAX_POINTER_MIRRORS: 8,
    MAX_MANIFEST_BYTES: 2 * 1024 * 1024,
    REQ_TIMEOUT_MS: 8000,
    HTTP_TIMEOUT_MS: 8000
  };

  const POINTER_SCHEMA = 'org.nosmaps.catalog-pointer';
  const MANIFEST_SCHEMA = 'org.nosmaps.catalog';
  const POINTER_L_NAMESPACE = 'org.nosmaps.schema';
  const POINTER_L_TYPE = 'catalog-pointer';

  const SCOPE_RE = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
  const COORD_RE = /^32267:([0-9a-f]{64}):(.{1,192})$/;

  // ---- observable cumulative stats (with a bounded log) ----
  const stats = {
    logicalReqs: 0,
    physicalReqs: 0,
    httpAttempts: 0,
    cacheHits: 0,
    _log: [],
    _push(entry) {
      this._log.push(entry);
      if (this._log.length > 200) this._log.shift();
    },
    _logReq(relay, detail) {
      this.physicalReqs += 1;
      this._push({ at: Date.now(), kind: 'req', relay, detail });
    },
    _logHttp(url) {
      this.httpAttempts += 1;
      this._push({ at: Date.now(), kind: 'http', url, detail: 'get' });
    },
    _logCache(detail) {
      this.cacheHits += 1;
      this._push({ at: Date.now(), kind: 'cache', detail });
    },
    getLog() {
      return this._log.slice();
    },
    reset() {
      this.logicalReqs = 0;
      this.physicalReqs = 0;
      this.httpAttempts = 0;
      this.cacheHits = 0;
      this._log = [];
    }
  };

  // ---- pure helpers ----

  function fail(reason) {
    return { ok: false, reason };
  }

  const NO_TAG = {};

  function singleTagValue(tags, name) {
    let found = null;
    let count = 0;
    for (let i = 0; i < tags.length; i += 1) {
      const t = tags[i];
      if (Array.isArray(t) && t[0] === name) {
        count += 1;
        found = t;
      }
    }
    if (count !== 1) return NO_TAG;
    return found.length >= 2 ? found[1] : NO_TAG;
  }

  function tagsWithName(tags, name) {
    const out = [];
    for (let i = 0; i < tags.length; i += 1) {
      const t = tags[i];
      if (Array.isArray(t) && t[0] === name) out.push(t);
    }
    return out;
  }

  function getDtag(tags) {
    if (!Array.isArray(tags)) return '';
    for (let i = 0; i < tags.length; i += 1) {
      const t = tags[i];
      if (Array.isArray(t) && t[0] === 'd' && typeof t[1] === 'string') return t[1];
    }
    return '';
  }

  function isValidScope(scope) {
    return typeof scope === 'string' && scope.length <= 64 && SCOPE_RE.test(scope);
  }

  // Compare two strings by Unicode code point (RFC 8785 / manifest sort order).
  function compareCodePoints(a, b) {
    const ai = Array.from(a);
    const bi = Array.from(b);
    const len = Math.min(ai.length, bi.length);
    for (let i = 0; i < len; i += 1) {
      const ca = ai[i].codePointAt(0);
      const cb = bi[i].codePointAt(0);
      if (ca !== cb) return ca < cb ? -1 : 1;
    }
    if (ai.length === bi.length) return 0;
    return ai.length < bi.length ? -1 : 1;
  }

  function isValidCoordinate(coord) {
    if (typeof coord !== 'string') return false;
    const m = COORD_RE.exec(coord);
    if (!m) return false;
    // The regex bounds the d part by UTF-16 units; the normative limit is UTF-8 bytes.
    if (utf8ByteLength(m[2]) > 192) return false;
    return true;
  }

  function validatePrevious(prev) {
    if (prev === null) return true;
    if (!prev || typeof prev !== 'object' || Array.isArray(prev)) return false;
    const keys = Object.keys(prev);
    if (keys.length !== 3) return false;
    if (!('generation' in prev) || !('pointer_id' in prev) || !('sha256' in prev)) return false;
    if (!Number.isSafeInteger(prev.generation) || prev.generation < 0) return false;
    if (!isLowercaseHex64(prev.pointer_id)) return false;
    if (!isLowercaseSha256Hex(prev.sha256)) return false;
    return true;
  }

  function previousEquals(a, b) {
    if (a === null && b === null) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    return a.generation === b.generation && a.pointer_id === b.pointer_id && a.sha256 === b.sha256;
  }

  function validateMirror(url, sha256) {
    if (typeof url !== 'string') return false;
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return false;
    }
    if (u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    if (u.hash) return false;
    // §3.1: retrieval path is derived from origin + /<sha256>.json; reject a hint
    // whose path hash differs.
    if (u.pathname.indexOf(sha256) === -1) return false;
    return true;
  }

  // ---- validatePointerEvent (§3.2) ----
  // NOTE: signature verification is NOT done here. It is asynchronous and handled
  // in the relay layer by rx-nostr's verifier (createRxNostr({verifier})). This
  // function is pure and synchronous so it can be unit-tested without crypto/IO.
  function validatePointerEvent(event, opts) {
    opts = opts || {};

    if (!event || typeof event !== 'object') return fail('bad-schema');
    if (event.kind !== POLICY.POINTER_KIND) return fail('bad-kind');
    if (!isLowercaseHex64(event.pubkey)) return fail('bad-schema');
    if (!Array.isArray(event.tags)) return fail('bad-schema');
    if (typeof event.content !== 'string') return fail('bad-schema');
    if (!Number.isSafeInteger(event.created_at)) return fail('bad-schema');

    const trusted = opts.trustedCurators;
    if (Array.isArray(trusted) && trusted.length > 0) {
      if (trusted.indexOf(event.pubkey) === -1) return fail('untrusted-curator');
    }

    const tags = event.tags;

    // d tag: exactly one, prefixed, valid scope grammar.
    const dTags = tagsWithName(tags, 'd');
    if (dTags.length !== 1 || typeof dTags[0][1] !== 'string') return fail('bad-d');
    const d = dTags[0][1];
    if (d.indexOf(POLICY.POINTER_D_PREFIX) !== 0) return fail('bad-d');
    const scope = d.slice(POLICY.POINTER_D_PREFIX.length);
    if (!isValidScope(scope)) return fail('bad-d');
    if (opts.scope != null && scope !== opts.scope) return fail('bad-d');

    // §7.1 common envelope: exactly one L and one l with the schema namespace.
    // This alone rejects the unrelated live XRP-directory kind-30367 events,
    // which carry no L/l tags.
    const lUpper = tagsWithName(tags, 'L');
    if (lUpper.length !== 1 || lUpper[0][1] !== POINTER_L_NAMESPACE) return fail('bad-schema');
    const lLower = tagsWithName(tags, 'l');
    if (lLower.length !== 1 || lLower[0][1] !== POINTER_L_TYPE || lLower[0][2] !== POINTER_L_NAMESPACE) {
      return fail('bad-schema');
    }

    // Content must be strict canonical JSON.
    const contentBytes = utf8Encode(event.content);
    const parsed = strictParse(contentBytes);
    if (!parsed.ok) return fail('noncanonical-content');
    if (!isCanonicalBytes(contentBytes, parsed.value)) return fail('noncanonical-content');
    const c = parsed.value;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return fail('bad-schema');

    // Exact top-level key set (§7.2).
    const allowed = ['schema', 'version', 'state', 'scope', 'generation', 'sha256',
      'bytes', 'mime', 'entry_count', 'generated_at', 'previous', 'mirrors'];
    const keys = Object.keys(c);
    for (let i = 0; i < keys.length; i += 1) {
      if (allowed.indexOf(keys[i]) === -1) return fail('unknown-field');
    }
    for (let i = 0; i < allowed.length; i += 1) {
      if (!(allowed[i] in c)) return fail('bad-schema');
    }

    if (c.schema !== POINTER_SCHEMA) return fail('bad-schema');
    if (c.version !== 1) return fail('bad-schema');
    if (c.state !== 'active' && c.state !== 'withdrawn') return fail('bad-state');
    if (c.scope !== scope) return fail('tag-content-mismatch');
    if (!Number.isSafeInteger(c.generation) || c.generation < 0) return fail('bad-schema');
    if (!isLowercaseSha256Hex(c.sha256)) return fail('bad-sha256');
    if (!Number.isSafeInteger(c.bytes) || c.bytes <= 0 || c.bytes > POLICY.MAX_MANIFEST_BYTES) {
      return fail('bad-schema');
    }
    if (c.mime !== POLICY.MANIFEST_MIME) return fail('bad-mime');
    if (!Number.isSafeInteger(c.entry_count) || c.entry_count < 0) return fail('bad-schema');
    if (!Number.isSafeInteger(c.generated_at) || c.generated_at <= 0) return fail('bad-schema');

    // previous (§3.2 rule 5): mandatory, nullable only for generation 0.
    if (!validatePrevious(c.previous)) return fail('bad-previous');
    if (c.generation !== 0 && c.previous === null) return fail('bad-previous');

    // mirrors (§3.2 rule 3): HTTPS only, <= 8, each path hash === sha256.
    if (!Array.isArray(c.mirrors)) return fail('bad-schema');
    if (c.mirrors.length > POLICY.MAX_POINTER_MIRRORS) return fail('bad-mirror');
    for (let i = 0; i < c.mirrors.length; i += 1) {
      if (!validateMirror(c.mirrors[i], c.sha256)) return fail('bad-mirror');
    }

    // Tag/content equality (§3.2 rule 4) — the core anti-forgery check.
    if (singleTagValue(tags, 'v') !== '1') return fail('tag-content-mismatch');
    if (singleTagValue(tags, 'state') !== c.state) return fail('tag-content-mismatch');
    if (singleTagValue(tags, 'generation') !== String(c.generation)) return fail('tag-content-mismatch');
    if (singleTagValue(tags, 'x') !== c.sha256) return fail('tag-content-mismatch');
    if (singleTagValue(tags, 'size') !== String(c.bytes)) return fail('tag-content-mismatch');
    if (singleTagValue(tags, 'm') !== c.mime) return fail('tag-content-mismatch');
    if (singleTagValue(tags, 'count') !== String(c.entry_count)) return fail('tag-content-mismatch');
    if (singleTagValue(tags, 'generated_at') !== String(c.generated_at)) return fail('tag-content-mismatch');

    const prevTags = tagsWithName(tags, 'prev');
    if (c.previous === null) {
      if (prevTags.length !== 0) return fail('tag-content-mismatch');
    } else {
      if (prevTags.length !== 1) return fail('tag-content-mismatch');
      const pt = prevTags[0];
      if (pt[1] !== String(c.previous.generation) || pt[2] !== c.previous.pointer_id ||
          pt[3] !== c.previous.sha256) {
        return fail('tag-content-mismatch');
      }
    }

    // Ordered mirror URL list must match byte-for-byte (§3.2 rule 4). We compare
    // exact strings; both sides already passed HTTPS/hash mirror validation.
    const urlTags = tagsWithName(tags, 'url');
    if (urlTags.length !== c.mirrors.length) return fail('tag-content-mismatch');
    for (let i = 0; i < urlTags.length; i += 1) {
      if (urlTags[i][1] !== c.mirrors[i]) return fail('tag-content-mismatch');
    }

    // Future timestamp quarantine (§8.3): reject clearly-future events.
    const nowSec = Number.isFinite(opts.nowSec) ? opts.nowSec : Math.floor(Date.now() / 1000);
    if (event.created_at > nowSec + POLICY.MAX_FUTURE_SKEW_SEC) return fail('future-timestamp');
    if (c.generated_at > nowSec + POLICY.MAX_FUTURE_SKEW_SEC) return fail('future-timestamp');

    const pointer = {
      curator: event.pubkey,
      scope,
      d,
      generation: c.generation,
      sha256: c.sha256,
      bytes: c.bytes,
      mime: c.mime,
      entryCount: c.entry_count,
      generatedAt: c.generated_at,
      previous: c.previous,
      mirrors: c.mirrors.slice(),
      state: c.state,
      eventId: typeof event.id === 'string' ? event.id : null,
      createdAt: event.created_at
    };
    return { ok: true, pointer };
  }

  // ---- addressable winner selection (NIP-01) ----
  function selectPointerWinner(events) {
    if (!Array.isArray(events) || events.length === 0) return null;
    let best = null;
    for (let i = 0; i < events.length; i += 1) {
      const e = events[i];
      if (!e || typeof e !== 'object') continue;
      if (!Number.isFinite(e.created_at) || typeof e.id !== 'string') continue;
      if (best === null) {
        best = e;
      } else if (e.created_at > best.created_at) {
        best = e;
      } else if (e.created_at === best.created_at && e.id < best.id) {
        best = e; // tie -> lexicographically lowest event id
      }
    }
    return best;
  }

  function selectWinnersByCurator(events, opts) {
    const groups = new Map();
    if (Array.isArray(events)) {
      for (let i = 0; i < events.length; i += 1) {
        const e = events[i];
        if (!e || typeof e !== 'object' || typeof e.pubkey !== 'string') continue;
        const key = String(e.kind) + ':' + e.pubkey + ':' + getDtag(e.tags);
        let list = groups.get(key);
        if (!list) {
          list = [];
          groups.set(key, list);
        }
        list.push(e);
      }
    }
    const out = [];
    groups.forEach((list) => {
      const winner = selectPointerWinner(list);
      if (winner) out.push({ curator: winner.pubkey, event: winner });
    });
    out.sort((a, b) => (a.curator < b.curator ? -1 : a.curator > b.curator ? 1 : 0));
    return out;
  }

  // ---- manifest value validation (§3.3) ----
  function validateFields(fields) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return fail('bad-schema');
    const allowed = ['name', 'summary', 'category', 'homepage'];
    const keys = Object.keys(fields);
    for (let i = 0; i < keys.length; i += 1) {
      if (allowed.indexOf(keys[i]) === -1) return fail('unknown-field');
    }
    if ('name' in fields) {
      if (typeof fields.name !== 'string' || fields.name.length > 120) return fail('bad-schema');
    }
    if ('summary' in fields) {
      if (typeof fields.summary !== 'string' || fields.summary.length > 1000) return fail('bad-schema');
    }
    if ('category' in fields) {
      // DEVIATION: the contract does not give a length bound for `category`; it only
      // requires the key be in the allowed subset. We require a string and cap at 120
      // chars (same as name) to keep display metadata bounded rather than unbounded.
      if (typeof fields.category !== 'string' || fields.category.length > 120) return fail('bad-schema');
    }
    if ('homepage' in fields) {
      if (typeof fields.homepage !== 'string' || fields.homepage.length > 2048) return fail('bad-schema');
      if (fields.homepage.indexOf('https://') !== 0) return fail('bad-schema');
    }
    return { ok: true };
  }

  function validateEntry(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return fail('bad-schema');
    const keys = Object.keys(entry);
    if (keys.length !== 4) return fail('bad-schema');
    if (!('coordinate' in entry) || !('state' in entry) || !('event_id' in entry) || !('fields' in entry)) {
      return fail('bad-schema');
    }
    if (!isValidCoordinate(entry.coordinate)) return fail('bad-schema');
    if (entry.state !== 'active' && entry.state !== 'withdrawn') return fail('bad-state');
    if (entry.event_id !== null && !isLowercaseHex64(entry.event_id)) return fail('bad-schema');
    const fr = validateFields(entry.fields);
    if (!fr.ok) return fr;
    return { ok: true };
  }

  function validateManifestValue(value, pointer) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('bad-schema');
    const allowed = ['schema', 'version', 'scope', 'curator', 'generation',
      'generated_at', 'previous', 'entries'];
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i += 1) {
      if (allowed.indexOf(keys[i]) === -1) return fail('unknown-field');
    }
    for (let i = 0; i < allowed.length; i += 1) {
      if (!(allowed[i] in value)) return fail('bad-schema');
    }
    if (value.schema !== MANIFEST_SCHEMA) return fail('bad-schema');
    if (value.version !== 1) return fail('bad-schema');

    // Commitments must equal the pointer (§3.3).
    if (value.curator !== pointer.curator) return fail('tag-content-mismatch');
    if (value.scope !== pointer.scope) return fail('tag-content-mismatch');
    if (value.generation !== pointer.generation) return fail('tag-content-mismatch');
    if (value.generated_at !== pointer.generatedAt) return fail('tag-content-mismatch');
    if (!previousEquals(value.previous, pointer.previous)) return fail('tag-content-mismatch');

    if (!Array.isArray(value.entries)) return fail('bad-schema');
    if (value.entries.length !== pointer.entryCount) return fail('bad-schema');

    let prevCoord = null;
    for (let i = 0; i < value.entries.length; i += 1) {
      const entry = value.entries[i];
      const r = validateEntry(entry);
      if (!r.ok) return r;
      if (prevCoord !== null) {
        // Strictly increasing by code point => sorted AND unique.
        if (compareCodePoints(prevCoord, entry.coordinate) >= 0) return fail('bad-schema');
      }
      prevCoord = entry.coordinate;
    }
    return { ok: true };
  }

  // ---- verifyManifestBytes (invariant I1: hash safety; order matters) ----
  async function verifyManifestBytes(bytes, pointer) {
    try {
      if (!(bytes instanceof Uint8Array)) return fail('size');
      if (bytes.length !== pointer.bytes) return fail('size');
      const hash = await sha256Hex(bytes);
      if (hash !== pointer.sha256) return fail('hash');
      const parsed = strictParse(bytes);
      if (!parsed.ok) return fail('parse');
      if (!isCanonicalBytes(bytes, parsed.value)) return fail('noncanonical');
      const mr = validateManifestValue(parsed.value, pointer);
      if (!mr.ok) return mr;
      return { ok: true, value: parsed.value };
    } catch (e) {
      return fail('error');
    }
  }

  // ---- HTTP mirror fetch + verify (§3.4) ----
  function deriveMirrorUrls(pointer) {
    const out = [];
    const seenOrigins = new Set();
    const mirrors = Array.isArray(pointer.mirrors) ? pointer.mirrors : [];
    for (let i = 0; i < mirrors.length; i += 1) {
      let u;
      try {
        u = new URL(mirrors[i]);
      } catch (e) {
        continue;
      }
      if (u.protocol !== 'https:') continue;
      if (u.username || u.password) continue;
      if (u.pathname.indexOf(pointer.sha256) === -1) continue;
      if (seenOrigins.has(u.origin)) continue;
      seenOrigins.add(u.origin);
      out.push(u.toString());
    }
    return out;
  }

  function urlPathHasHash(url, sha256) {
    try {
      return new URL(url).pathname.indexOf(sha256) !== -1;
    } catch (e) {
      return false;
    }
  }

  function errSlug(err) {
    if (err && err.name === 'AbortError') return 'timeout';
    return 'network-error';
  }

  async function fetchVerifiedManifest(pointer, opts) {
    opts = opts || {};
    const fetchImpl = typeof opts.fetchImpl === 'function'
      ? opts.fetchImpl
      : (typeof globalThis !== 'undefined' ? globalThis.fetch : undefined);
    const maxMirrorAttempts = Number.isFinite(opts.maxMirrorAttempts)
      ? opts.maxMirrorAttempts : POLICY.MAX_MIRROR_ATTEMPTS;
    const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : POLICY.HTTP_TIMEOUT_MS;
    const failures = [];

    const urls = deriveMirrorUrls(pointer).slice(0, Math.max(0, maxMirrorAttempts));

    if (typeof fetchImpl !== 'function') {
      if (opts.cached && opts.cached.value) {
        return { status: 'stale', value: opts.cached.value, failures };
      }
      return { status: 'unavailable', failures };
    }

    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i];
      let controller = null;
      let timer = null;
      try {
        controller = typeof AbortController === 'function' ? new AbortController() : null;
        if (controller && timeoutMs > 0) {
          timer = setTimeout(() => { try { controller.abort(); } catch (e) { /* noop */ } }, timeoutMs);
        }
        stats._logHttp(url);
        // Anonymous GET only: no Authorization header, credentials omitted,
        // redirects followed with the final URL's hash re-checked.
        const resp = await fetchImpl(url, {
          method: 'GET',
          credentials: 'omit',
          redirect: 'follow',
          signal: controller ? controller.signal : undefined
        });
        if (!resp || !resp.ok) {
          failures.push({ url, error: 'http-' + (resp && resp.status ? resp.status : 0) });
          continue;
        }
        const finalUrl = resp.url || url;
        if (!urlPathHasHash(finalUrl, pointer.sha256)) {
          failures.push({ url, error: 'redirect-hash-mismatch' });
          continue;
        }
        const headers = resp.headers;
        if (headers && typeof headers.get === 'function') {
          const clen = headers.get('content-length');
          if (clen != null) {
            const n = Number(clen);
            if (Number.isFinite(n) && n > pointer.bytes) {
              failures.push({ url, error: 'too-large' });
              continue;
            }
          }
        }
        const buf = await resp.arrayBuffer();
        const body = new Uint8Array(buf);
        if (body.length > pointer.bytes) {
          failures.push({ url, error: 'too-large' });
          continue;
        }
        const verified = await verifyManifestBytes(body, pointer);
        if (!verified.ok) {
          failures.push({ url, error: 'verify-' + verified.reason });
          continue;
        }
        return { status: 'fresh', value: verified.value, url: finalUrl, failures };
      } catch (err) {
        failures.push({ url, error: errSlug(err) });
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    if (opts.cached && opts.cached.value) {
      return { status: 'stale', value: opts.cached.value, failures };
    }
    return { status: 'unavailable', failures };
  }

  // ---- IndexedDB derived cache (rebuildable; never authoritative) ----
  const DB_NAME = 'nosmaps-catalog';
  const DB_VERSION = 1;
  const STORE = 'manifests';

  function idbAvailable() {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  }

  function cacheKey(curator, scope) {
    return String(curator) + ':' + String(scope);
  }

  function open() {
    // Resolves to an IDBDatabase or null; never rejects. Degrades when IndexedDB
    // is unavailable (e.g. node globals) so the app does not throw at load time.
    return new Promise((resolve) => {
      if (!idbAvailable()) {
        resolve(null);
        return;
      }
      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        resolve(null);
        return;
      }
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'key' });
          }
        } catch (e) { /* noop */ }
      };
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }

  function putManifest(record) {
    return new Promise((resolve) => {
      open().then((db) => {
        if (!db) { resolve(); return; }
        try {
          const stored = Object.assign({}, record, { key: cacheKey(record.curator, record.scope) });
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(stored);
          tx.oncomplete = () => { try { db.close(); } catch (e) { /* noop */ } resolve(); };
          tx.onerror = () => { try { db.close(); } catch (e) { /* noop */ } resolve(); };
          tx.onabort = () => { try { db.close(); } catch (e) { /* noop */ } resolve(); };
        } catch (e) {
          try { db.close(); } catch (e2) { /* noop */ }
          resolve();
        }
      });
    });
  }

  function getManifest(curator, scope) {
    return new Promise((resolve) => {
      open().then((db) => {
        if (!db) { resolve(null); return; }
        try {
          const tx = db.transaction(STORE, 'readonly');
          const r = tx.objectStore(STORE).get(cacheKey(curator, scope));
          r.onsuccess = () => { try { db.close(); } catch (e) { /* noop */ } resolve(r.result || null); };
          r.onerror = () => { try { db.close(); } catch (e) { /* noop */ } resolve(null); };
        } catch (e) {
          try { db.close(); } catch (e2) { /* noop */ }
          resolve(null);
        }
      });
    });
  }

  function getAll() {
    return new Promise((resolve) => {
      open().then((db) => {
        if (!db) { resolve([]); return; }
        try {
          const tx = db.transaction(STORE, 'readonly');
          const r = tx.objectStore(STORE).getAll();
          r.onsuccess = () => {
            try { db.close(); } catch (e) { /* noop */ }
            resolve(Array.isArray(r.result) ? r.result : []);
          };
          r.onerror = () => { try { db.close(); } catch (e) { /* noop */ } resolve([]); };
        } catch (e) {
          try { db.close(); } catch (e2) { /* noop */ }
          resolve([]);
        }
      });
    });
  }

  function wipe() {
    return new Promise((resolve) => {
      open().then((db) => {
        if (!db) { resolve(); return; }
        try {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).clear();
          tx.oncomplete = () => { try { db.close(); } catch (e) { /* noop */ } resolve(); };
          tx.onerror = () => { try { db.close(); } catch (e) { /* noop */ } resolve(); };
          tx.onabort = () => { try { db.close(); } catch (e) { /* noop */ } resolve(); };
        } catch (e) {
          try { db.close(); } catch (e2) { /* noop */ }
          resolve();
        }
      });
    });
  }

  function deleteDatabase() {
    return new Promise((resolve) => {
      if (!idbAvailable()) { resolve(); return; }
      try {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  const cache = { open, putManifest, getManifest, getAll, wipe, deleteDatabase };

  // ---- relay layer ----
  // DEVIATION: rx-nostr 3.7.5 high-level EOSE-per-relay correlation is not verified
  // without the implementation-preflight live probe (design §8.1, §15). We therefore
  // approximate coverage: on clean completion of the backward request all relays are
  // marked 'eose'; on timeout the still-unresolved relays are marked 'timeout'; on any
  // import/subscribe failure every relay is marked 'error'. Per-relay granularity is a
  // live-probe follow-up. coverage values are objects {status, observedAt} because §4.1
  // requires per-relay observation time to be recorded.
  async function fetchPointers(opts) {
    opts = opts || {};
    const relays = (Array.isArray(opts.relays) && opts.relays.length)
      ? opts.relays.slice() : POLICY.DEFAULT_RELAYS.slice();
    const curators = Array.isArray(opts.curators) ? opts.curators : [];
    const scope = typeof opts.scope === 'string' ? opts.scope : POLICY.DEFAULT_SCOPE;
    const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : POLICY.REQ_TIMEOUT_MS;
    const d = POLICY.POINTER_D_PREFIX + scope;

    const observedAt = Date.now();
    const coverage = {};
    for (let i = 0; i < relays.length; i += 1) {
      coverage[relays[i]] = { status: 'error', observedAt };
    }

    if (curators.length > POLICY.MAX_TRUSTED_CURATORS_FOR_SINGLE_COLD_REQ) {
      return {
        ok: false,
        reason: 'too-many-curators',
        events: [],
        coverage,
        stats: { logicalReqs: 0, physicalReqs: 0 }
      };
    }

    const baseLogical = stats.logicalReqs;
    const basePhysical = stats.physicalReqs;
    const events = [];
    let rxNostr = null;

    try {
      // Lazy dynamic import; specifiers resolve against the document base URL.
      const [rxMod, cryptoMod] = await Promise.all([
        import('./dist/rx-nostr.js'),
        import('./dist/rx-nostr-crypto.js')
      ]);
      const createRxNostr = rxMod.createRxNostr;
      const createRxBackwardReq = rxMod.createRxBackwardReq;
      const verifier = cryptoMod.verifier;

      // Signature verification is supplied here: createRxNostr({verifier}) drops
      // events with invalid ids/signatures before they reach our next handler.
      rxNostr = createRxNostr({ verifier });
      rxNostr.setDefaultRelays(relays);

      let filters;
      if (curators.length === 0) {
        // Discovery filter when no trusted curators are configured.
        filters = [{ kinds: [POLICY.POINTER_KIND], '#d': [d], limit: 64 }];
      } else {
        // One exact filter per curator so no curator consumes another's limit.
        filters = curators.map((cur) => ({
          kinds: [POLICY.POINTER_KIND],
          authors: [cur],
          '#d': [d],
          limit: 8
        }));
      }

      // Budget: one logical REQ per relay; one physical REQ message per relay.
      stats.logicalReqs += relays.length;
      for (let i = 0; i < relays.length; i += 1) stats._logReq(relays[i], 'pointers');

      const rxReq = createRxBackwardReq();
      await new Promise((resolve) => {
        let settled = false;
        let sub = null;
        const timer = setTimeout(() => finish('timeout'), timeoutMs);

        function finish(mode) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          const at = Date.now();
          for (let i = 0; i < relays.length; i += 1) {
            const r = relays[i];
            if (mode === 'eose') {
              coverage[r] = { status: 'eose', observedAt: at };
            } else if (coverage[r].status === 'error') {
              coverage[r] = { status: 'timeout', observedAt: at };
            }
          }
          if (sub && typeof sub.unsubscribe === 'function') {
            try { sub.unsubscribe(); } catch (e) { /* noop */ }
          }
          resolve();
        }

        try {
          sub = rxNostr.use(rxReq).subscribe({
            next: (packet) => {
              try {
                if (packet && packet.event) events.push(packet.event);
              } catch (e) { /* noop */ }
            },
            error: () => finish('error'),
            complete: () => finish('eose')
          });
        } catch (e) {
          finish('error');
          return;
        }

        // Emit the per-relay filters, then close the backward request so the
        // observable completes after EOSE. Guarded because exact method names are
        // a live-probe follow-up in this rx-nostr version.
        try {
          if (typeof rxReq.emit === 'function') rxReq.emit(filters);
          if (typeof rxReq.over === 'function') rxReq.over();
        } catch (e) {
          finish('error');
        }
      });
    } catch (e) {
      // Import or setup failed: leave coverage marked 'error', return empty events.
    } finally {
      if (rxNostr && typeof rxNostr.dispose === 'function') {
        try { rxNostr.dispose(); } catch (e) { /* noop */ }
      }
    }

    return {
      events,
      coverage,
      stats: {
        logicalReqs: stats.logicalReqs - baseLogical,
        physicalReqs: stats.physicalReqs - basePhysical
      }
    };
  }

  // ---- orchestration: loadCatalog (§4.3 empty-cache rebuild) ----
  function isFresh(record, nowMs) {
    if (!record || !Number.isFinite(record.verifiedAt)) return false;
    return (nowMs - record.verifiedAt) < POLICY.CATALOG_STALE_AFTER_MS;
  }

  function mergeManifestView(perCoordinate, desc) {
    const entries = (desc.value && Array.isArray(desc.value.entries)) ? desc.value.entries : [];
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const coord = entry.coordinate;
      let m = perCoordinate.get(coord);
      if (!m) {
        m = { views: [] };
        perCoordinate.set(coord, m);
      }
      m.views.push({
        curator: desc.curator,
        state: entry.state,
        fields: entry.fields,
        generation: desc.generation,
        blobHash: desc.blobHash,
        stale: desc.stale
      });
    }
  }

  async function loadCatalog(opts) {
    opts = opts || {};
    const scope = typeof opts.scope === 'string' ? opts.scope : POLICY.DEFAULT_SCOPE;
    const curators = Array.isArray(opts.curators) ? opts.curators : [];
    const relays = (Array.isArray(opts.relays) && opts.relays.length)
      ? opts.relays.slice() : POLICY.DEFAULT_RELAYS.slice();
    const useCache = opts.useCache !== false;
    const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
    const nowSec = Math.floor(nowMs / 1000);

    const base = {
      l: stats.logicalReqs,
      p: stats.physicalReqs,
      h: stats.httpAttempts,
      c: stats.cacheHits
    };
    function delta() {
      return {
        logicalReqs: stats.logicalReqs - base.l,
        physicalReqs: stats.physicalReqs - base.p,
        httpAttempts: stats.httpAttempts - base.h,
        cacheHits: stats.cacheHits - base.c
      };
    }

    const diagnostics = [];
    const curatorReports = [];

    try {
      // 1. fetch pointers.
      let pointerResult;
      try {
        pointerResult = await fetchPointers({
          relays,
          curators,
          scope,
          timeoutMs: opts.timeoutMs
        });
      } catch (e) {
        pointerResult = { events: [], coverage: {}, stats: {} };
      }

      if (pointerResult && pointerResult.ok === false) {
        diagnostics.push('pointers-refused:' + pointerResult.reason);
        return {
          status: 'unavailable',
          entries: [],
          curators: [],
          coverage: pointerResult.coverage || {},
          asOf: nowMs,
          diagnostics,
          stats: delta()
        };
      }

      const coverage = pointerResult.coverage || {};
      const events = Array.isArray(pointerResult.events) ? pointerResult.events : [];

      // 2. validate + select winner per curator.
      const validEvents = [];
      const pointerByEvent = new Map();
      for (let i = 0; i < events.length; i += 1) {
        const vr = validatePointerEvent(events[i], { trustedCurators: curators, scope, nowSec });
        if (vr.ok) {
          validEvents.push(events[i]);
          pointerByEvent.set(events[i], vr.pointer);
        }
      }
      const winners = selectWinnersByCurator(validEvents, {});

      let allEose = relays.length > 0;
      for (let i = 0; i < relays.length; i += 1) {
        const cov = coverage[relays[i]];
        if (!cov || cov.status !== 'eose') {
          allEose = false;
          break;
        }
      }

      const perCoordinate = new Map();
      const resolvedCurators = new Set();
      let anyFresh = false;
      let anyStaleServed = false;

      // 3/4. per winner: consult cache, else fetch+verify, then store.
      for (let i = 0; i < winners.length; i += 1) {
        const pointer = pointerByEvent.get(winners[i].event);
        let cached = null;
        if (useCache) {
          cached = await cache.getManifest(pointer.curator, scope);
        }

        let servedDesc = null;
        let curatorStatus = 'unavailable';
        let reason;
        let verifiedAt = null;

        if (cached && cached.sha256 === pointer.sha256 && isFresh(cached, nowMs) && cached.value) {
          // Cache hit for the exact current generation: 0 HTTP.
          stats._logCache('reuse:' + pointer.curator);
          servedDesc = {
            curator: pointer.curator,
            generation: pointer.generation,
            blobHash: pointer.sha256,
            value: cached.value,
            stale: false
          };
          curatorStatus = 'fresh';
          verifiedAt = cached.verifiedAt;
          resolvedCurators.add(pointer.curator);
          anyFresh = true;
        } else {
          const fr = await fetchVerifiedManifest(pointer, {
            cached: cached || undefined,
            fetchImpl: opts.fetchImpl,
            timeoutMs: opts.timeoutMs
          });
          if (fr.status === 'fresh') {
            servedDesc = {
              curator: pointer.curator,
              generation: pointer.generation,
              blobHash: pointer.sha256,
              value: fr.value,
              stale: false
            };
            curatorStatus = 'fresh';
            verifiedAt = nowMs;
            resolvedCurators.add(pointer.curator);
            anyFresh = true;
            if (useCache) {
              await cache.putManifest({
                curator: pointer.curator,
                scope,
                generation: pointer.generation,
                sha256: pointer.sha256,
                pointerId: pointer.eventId,
                verifiedAt: nowMs,
                bytes: pointer.bytes,
                entryCount: pointer.entryCount,
                value: fr.value
              });
            }
          } else if (fr.status === 'stale' && fr.value && cached) {
            // Serving a previously verified older generation.
            servedDesc = {
              curator: pointer.curator,
              generation: cached.generation,
              blobHash: cached.sha256,
              value: cached.value,
              stale: true
            };
            curatorStatus = 'stale';
            verifiedAt = cached.verifiedAt;
            reason = 'served-cached';
            resolvedCurators.add(pointer.curator);
            anyStaleServed = true;
          } else {
            curatorStatus = 'unavailable';
            reason = 'fetch-failed';
          }
        }

        curatorReports.push({
          curator: pointer.curator,
          status: curatorStatus,
          pointerId: pointer.eventId,
          generation: pointer.generation,
          sha256: pointer.sha256,
          verifiedAt,
          reason
        });

        if (servedDesc) mergeManifestView(perCoordinate, servedDesc);
      }

      // 5. merge entries across curators (dedupe by coordinate; listable iff >=1 active).
      const entries = [];
      const coords = Array.from(perCoordinate.keys()).sort(compareCodePoints);
      for (let i = 0; i < coords.length; i += 1) {
        const m = perCoordinate.get(coords[i]);
        const activeViews = m.views.filter((v) => v.state === 'active');
        if (activeViews.length === 0) continue;
        // Deterministic display choice: lowest curator hex among active endorsers.
        activeViews.sort((a, b) => (a.curator < b.curator ? -1 : a.curator > b.curator ? 1 : 0));
        const chosen = activeViews[0];
        const endorsers = [];
        const seen = new Set();
        for (let j = 0; j < activeViews.length; j += 1) {
          if (!seen.has(activeViews[j].curator)) {
            seen.add(activeViews[j].curator);
            endorsers.push(activeViews[j].curator);
          }
        }
        endorsers.sort();
        entries.push({
          coordinate: coords[i],
          state: 'active',
          fields: chosen.fields,
          curators: endorsers,
          generation: chosen.generation,
          blobHash: chosen.blobHash,
          stale: chosen.stale
        });
      }

      // status precedence (documented): prefer 'stale' only when actually serving
      // cached bytes; otherwise 'incomplete' when coverage/curators are unresolved.
      const configuredUnresolved = curators.some((cur) => !resolvedCurators.has(cur));
      const winnerUnresolved = winners.some((w) => !resolvedCurators.has(w.curator));
      let status;
      if (!anyFresh && !anyStaleServed) {
        status = 'unavailable';
      } else if (anyStaleServed) {
        status = 'stale';
      } else if (!allEose || winnerUnresolved || (curators.length > 0 && configuredUnresolved)) {
        status = 'incomplete';
      } else {
        status = 'fresh';
      }

      if (!allEose) diagnostics.push('relay-coverage-incomplete');
      if (curators.length > 0 && configuredUnresolved) diagnostics.push('curator-unresolved');

      return {
        status,
        entries,
        curators: curatorReports,
        coverage,
        asOf: nowMs,
        diagnostics,
        stats: delta()
      };
    } catch (e) {
      diagnostics.push('load-error');
      return {
        status: 'unavailable',
        entries: [],
        curators: curatorReports,
        coverage: {},
        asOf: nowMs,
        diagnostics,
        stats: delta()
      };
    }
  }

  window.NOSMAPS_CATALOG = {
    POLICY,
    validatePointerEvent,
    selectPointerWinner,
    selectWinnersByCurator,
    validateManifestValue,
    verifyManifestBytes,
    fetchVerifiedManifest,
    cache,
    fetchPointers,
    loadCatalog,
    stats
  };
})();
