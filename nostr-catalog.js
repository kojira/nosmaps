/* Nosmaps relay-native catalog data layer — revision 2 (curation as signal).
   Classic browser script (no modules). Exposes window.NOSMAPS_CATALOG.

   The publisher-signed kind 30078 addressable event is the only canonical record
   (D2). There is no pointer, no manifest, no blob, no mirror, no curator
   allowlist, and no HTTP anywhere in this file. Kind 30267 NIP-51 App curation
   sets are a presentation-layer signal only: they contribute a recommendation
   count and the ordering key, and they can never add or remove a row (D4/I7).
   The pubkeys whose curation counts come from the viewer's own kind 3 follow
   list (D5), never from a shipped list.

   Authoritative design: design-relay-native-data.md revision 2
   (§4.2, §5.1-§5.4, §6.1-§6.6, §7.1-§7.3, §8.x, §9.1-§9.4, §12.3).
   Depends on window.NOSMAPS_CANONICAL. */
(() => {
  'use strict';

  const C = window.NOSMAPS_CANONICAL;
  const utf8Encode = C.utf8Encode;
  const utf8ByteLength = C.utf8ByteLength;
  const isLowercaseSha256Hex = C.isLowercaseSha256Hex;
  const strictParse = C.strictParse;

  // 64-hex identifiers (pubkey, event id) share the sha256 shape.
  function isLowercaseHex64(v) {
    return isLowercaseSha256Hex(v);
  }

  const POLICY = {
    // The canonical record (§4.2) and the presentation-only signal (§6.1).
    // 30078 is NIP-78 application-specific data. Kind 32267 ("Software
    // Application") was considered and rejected: its semantics sit close enough to
    // ours — an app-store listing record — that our listing policy would inherit
    // another project's curation rules. Sharing 30078 with unrelated apps costs
    // nothing, because NIP-78 specifies the kind as shared by construction.
    SOFTWARE_KIND: 30078,
    CURATION_KIND: 30267,
    FOLLOW_KIND: 3,
    DELETION_KIND: 5,

    DEFAULT_RELAYS: ['wss://x.kojira.io', 'wss://nos.lol'],
    // §16.2: an app-chosen token, user-editable, and a labelled visibility gap.
    DISCOVERY_TOPICS: ['nosmaps'],

    CATALOG_STALE_AFTER_MS: 24 * 60 * 60 * 1000,
    GRAPH_STALE_AFTER_MS: 24 * 60 * 60 * 1000,
    MAX_FUTURE_SKEW_SEC: 600,
    MAX_FUTURE_HORIZON_SEC: 30 * 24 * 60 * 60,
    MAX_MIGRATION_DEPTH: 8,

    DISCOVERY_LIMIT_PER_RELAY: 500,
    MAX_DISCOVERY_PAGES_PER_RELAY: 8,
    MAX_DISCOVERY_RAW_EVENTS_PER_RELAY: 4000,

    GRAPH_MAX_FOLLOWS: 512,
    GRAPH_MAX_SETS_PER_CURATOR: 8,
    GRAPH_TIER2_ENABLED: false,

    MAX_FILTERS_PER_REQ: 8,
    MAX_SERIALIZED_REQ_BYTES_FALLBACK: 12000,
    MAX_ARRAY_ITEMS_PER_FILTER: 128,
    CLEANUP_LIMIT: 256,

    REQ_TIMEOUT_MS: 8000
  };

  const SOFTWARE_SCHEMA = 'org.nosmaps.software';
  // §4.2 rule 1: every canonical Nosmaps `d` is namespaced with this literal
  // prefix. Kind 30078 is NIP-78 application-specific data, so records published
  // by other applications on the same kind are the specified normal state, not an
  // anomaly (observed on wss://x.kojira.io: `nostter-read`, `AmethystSettings`,
  // `circl-settings`). The namespace is therefore the primary separation, and it
  // does not depend on reading `content` at all. It is deliberately independent of
  // the `org.nosmaps.software` content check: either one alone rejects a foreign
  // record, and they fail with different reasons.
  const SOFTWARE_D_PREFIX = 'nosmaps:';
  const D_MAX_BYTES = 192;
  // Built from the constants above so the coordinate grammar can never drift from
  // the gate in validateSoftwareEvent. The local part is bounded so
  // prefix + local part still fits the 192-byte `d` ceiling.
  const COORD_RE = new RegExp(
    '^' + POLICY.SOFTWARE_KIND + ':([0-9a-f]{64}):('
      + SOFTWARE_D_PREFIX + '.{1,' + (D_MAX_BYTES - SOFTWARE_D_PREFIX.length) + '})$'
  );
  // Kind-agnostic address form (§7.3 deletion `a` tags). Any kind, any `d`: a
  // deletion may cover someone else's coordinate, so this MUST stay unnamespaced.
  const ADDRESS_RE = /^([0-9]{1,5}):([0-9a-f]{64}):(.{0,192})$/;
  // §4.2 rule 1: `d` is ASCII with a 192-byte ceiling. Printable, no spaces.
  const D_ASCII_RE = /^[\x21-\x7e]+$/;

  // ---- observable cumulative stats (with a bounded log) ----
  const stats = {
    logicalReqs: 0,
    physicalReqs: 0,
    // §9.2: HTTP in the catalog data path is zero. Nothing in this file
    // increments this counter — it exists so "zero" is an assertable number in
    // diagnostics and tests rather than an unverifiable claim. A non-zero value
    // can only mean a regression reintroduced an HTTP dependency.
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

  function tagsWithName(tags, name) {
    const out = [];
    for (let i = 0; i < tags.length; i += 1) {
      const t = tags[i];
      if (Array.isArray(t) && t[0] === name) out.push(t);
    }
    return out;
  }

  function singleTagValue(tags, name) {
    const found = tagsWithName(tags, name);
    if (found.length !== 1) return null;
    return typeof found[0][1] === 'string' ? found[0][1] : null;
  }

  function getDtag(tags) {
    if (!Array.isArray(tags)) return '';
    for (let i = 0; i < tags.length; i += 1) {
      const t = tags[i];
      if (Array.isArray(t) && t[0] === 'd' && typeof t[1] === 'string') return t[1];
    }
    return '';
  }

  // Compare two strings by Unicode code point. Used for every deterministic
  // ordering in this file (I4): coordinates, `d` values, pubkeys.
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
    if (utf8ByteLength(m[2]) > D_MAX_BYTES) return false;
    return true;
  }

  function coordinateOf(kind, pubkey, d) {
    return String(kind) + ':' + pubkey + ':' + d;
  }

  function charLength(str) {
    return Array.from(str).length;
  }

  // §12.3 future-timestamp eligibility. `receivedAtSec` is the receipt time, not
  // "now": advancing the clock alone must not rewrite receipt history.
  function futureCheck(createdAt, opts) {
    const receivedAt = Number.isFinite(opts && opts.receivedAtSec)
      ? opts.receivedAtSec
      : (Number.isFinite(opts && opts.nowSec) ? opts.nowSec : Math.floor(Date.now() / 1000));
    if (createdAt > receivedAt + POLICY.MAX_FUTURE_HORIZON_SEC) return 'future-horizon';
    if (createdAt > receivedAt + POLICY.MAX_FUTURE_SKEW_SEC) return 'future-timestamp';
    return null;
  }

  // ---- npub (bech32) decoding, so §6.2 step 2 "paste a pubkey" actually works ----
  const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  function decodeNpub(value) {
    if (typeof value !== 'string') return null;
    const s = value.trim();
    if (isLowercaseHex64(s)) return s;
    if (s.toLowerCase() !== s && s.toUpperCase() !== s) return null;
    const lower = s.toLowerCase();
    if (lower.indexOf('npub1') !== 0) return null;
    const data = lower.slice(5);
    if (data.length !== 58) return null; // 52 data chars + 6 checksum chars
    const values = [];
    for (let i = 0; i < data.length; i += 1) {
      const idx = BECH32_ALPHABET.indexOf(data[i]);
      if (idx === -1) return null;
      values.push(idx);
    }
    // Checksum over hrp "npub" + data.
    const hrpExpanded = [];
    const hrp = 'npub';
    for (let i = 0; i < hrp.length; i += 1) hrpExpanded.push(hrp.charCodeAt(i) >> 5);
    hrpExpanded.push(0);
    for (let i = 0; i < hrp.length; i += 1) hrpExpanded.push(hrp.charCodeAt(i) & 31);
    let chk = 1;
    const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    const all = hrpExpanded.concat(values);
    for (let i = 0; i < all.length; i += 1) {
      const top = chk >> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ all[i];
      for (let j = 0; j < 5; j += 1) if ((top >> j) & 1) chk ^= GEN[j];
    }
    if (chk !== 1) return null;
    // 5-bit -> 8-bit over the 52 data characters.
    let acc = 0;
    let bits = 0;
    const bytes = [];
    for (let i = 0; i < 52; i += 1) {
      acc = (acc << 5) | values[i];
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        bytes.push((acc >> bits) & 0xff);
      }
    }
    if (bytes.length !== 32) return null;
    let hex = '';
    for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, '0');
    return hex;
  }

  // ---- kind 30078: the canonical record (§4.2) ----
  // NOTE: signature verification is NOT done here. It is asynchronous and handled
  // in the relay layer by rx-nostr's verifier (createRxNostr({verifier})). This
  // function is pure and synchronous so it can be unit-tested without crypto/IO.
  function validateSoftwareEvent(event, opts) {
    opts = opts || {};

    if (!event || typeof event !== 'object') return fail('bad-schema');
    if (event.kind !== POLICY.SOFTWARE_KIND) return fail('bad-kind');
    if (!isLowercaseHex64(event.pubkey)) return fail('bad-schema');
    if (!Array.isArray(event.tags)) return fail('bad-schema');
    if (typeof event.content !== 'string') return fail('bad-schema');
    if (!Number.isSafeInteger(event.created_at)) return fail('bad-schema');

    // §4.2 rule 1: exactly one `d`.
    const dTags = tagsWithName(event.tags, 'd');
    if (dTags.length !== 1 || typeof dTags[0][1] !== 'string') return fail('bad-d');
    const d = dTags[0][1];

    // §4.2 "Foreign 30078 events", separation 1 of 2 — the address namespace.
    // NIP-78 specifies 30078 as shared application-specific data, so another
    // application's perfectly valid record is the normal case, not an error. A `d`
    // outside our namespace is theirs: it is neither malformed (`bad-d`) nor a
    // content-profile mismatch (`foreign-profile`), so it gets its own reason and
    // is decided before `content` is even parsed. Checked here rather than at the
    // call sites so it cannot be bypassed by a path that forgets it.
    if (d.indexOf(SOFTWARE_D_PREFIX) !== 0) return fail('foreign-d');
    // A bare prefix names nothing. Keep this after the namespace check so it is
    // reported as our own malformed `d`, which is what it is.
    if (d.length === SOFTWARE_D_PREFIX.length) return fail('bad-d');
    // §4.2 rule 1: ASCII, <= 192 UTF-8 bytes, prefix included.
    if (!D_ASCII_RE.test(d) || utf8ByteLength(d) > D_MAX_BYTES) return fail('bad-d');

    // Separation 2 of 2 — the content profile. Independent of the namespace gate
    // above, so a foreign record that lands inside our namespace anyway (copy,
    // typo, impersonation) is still quarantined, with its own distinct reason.
    const parsed = strictParse(utf8Encode(event.content));
    if (!parsed.ok) return fail('foreign-profile');
    const c = parsed.value;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return fail('foreign-profile');
    if (c.schema !== SOFTWARE_SCHEMA) return fail('foreign-profile');

    // §5.1 rules 1-2: `t` values are lowercase, and the multi-value form is
    // rejected because NIP-01 indexes only the first value of a tag.
    const topics = [];
    const tTags = tagsWithName(event.tags, 't');
    for (let i = 0; i < tTags.length; i += 1) {
      const tag = tTags[i];
      if (typeof tag[1] !== 'string' || tag[1] === '') return fail('bad-topic');
      for (let j = 2; j < tag.length; j += 1) {
        if (typeof tag[j] === 'string' && tag[j] !== '') return fail('multi-value-t');
      }
      if (tag[1] !== tag[1].toLowerCase()) return fail('uppercase-topic');
      if (utf8ByteLength(tag[1]) > 128) return fail('bad-topic');
      if (topics.indexOf(tag[1]) === -1) topics.push(tag[1]);
    }

    // §4.2 rule 2: exact content key set for the v1 profile.
    const required = ['schema', 'version', 'state', 'name', 'summary'];
    const optional = ['homepage', 'superseded_by'];
    const keys = Object.keys(c);
    for (let i = 0; i < keys.length; i += 1) {
      if (required.indexOf(keys[i]) === -1 && optional.indexOf(keys[i]) === -1) {
        return fail('unknown-field');
      }
    }
    for (let i = 0; i < required.length; i += 1) {
      if (!(required[i] in c)) return fail('bad-schema');
    }
    if (c.version !== 1) return fail('bad-version');
    if (c.state !== 'active' && c.state !== 'withdrawn') return fail('bad-state');
    if (typeof c.name !== 'string' || c.name.length === 0 || charLength(c.name) > 120) {
      return fail('bad-schema');
    }
    if (typeof c.summary !== 'string' || charLength(c.summary) > 1000) return fail('bad-schema');
    if ('homepage' in c) {
      if (typeof c.homepage !== 'string' || c.homepage.length > 2048) return fail('bad-schema');
      if (c.homepage.indexOf('https://') !== 0) return fail('bad-schema');
    }

    const coordinate = coordinateOf(POLICY.SOFTWARE_KIND, event.pubkey, d);
    if ('superseded_by' in c) {
      if (!isValidCoordinate(c.superseded_by)) return fail('bad-superseded-by');
      if (c.superseded_by === coordinate) return fail('bad-superseded-by'); // §11.1 self-loop
    }

    // §4.2 rule 4: the optional `state` tag is a scanning aid; disagreement with
    // content invalidates the event. `state` is not single-letter, so it is not
    // relay-indexable and can never be used as a filter.
    const stateTags = tagsWithName(event.tags, 'state');
    for (let i = 0; i < stateTags.length; i += 1) {
      if (stateTags[i][1] !== c.state) return fail('tag-content-mismatch');
    }

    const future = futureCheck(event.created_at, opts);
    if (future) return fail(future);

    return {
      ok: true,
      record: {
        coordinate,
        publisher: event.pubkey,
        d,
        state: c.state,
        name: c.name,
        summary: c.summary,
        homepage: 'homepage' in c ? c.homepage : null,
        supersededBy: 'superseded_by' in c ? c.superseded_by : null,
        topics,
        eventId: typeof event.id === 'string' ? event.id : null,
        createdAt: event.created_at
      }
    };
  }

  // ---- kind 30267: NIP-51 App curation set (§6.1) ----
  // Used exactly as NIP-51 specifies. No Nosmaps schema, no per-tool state, no
  // reason field, no content validation.
  function validateCurationSetEvent(event, opts) {
    opts = opts || {};
    if (!event || typeof event !== 'object') return fail('bad-schema');
    if (event.kind !== POLICY.CURATION_KIND) return fail('bad-kind');
    if (!isLowercaseHex64(event.pubkey)) return fail('bad-schema');
    if (!Array.isArray(event.tags)) return fail('bad-schema');
    if (typeof event.content !== 'string') return fail('bad-schema');
    if (!Number.isSafeInteger(event.created_at)) return fail('bad-schema');

    const dTags = tagsWithName(event.tags, 'd');
    if (dTags.length !== 1 || typeof dTags[0][1] !== 'string') return fail('bad-d');
    const d = dTags[0][1];
    if (d.length === 0 || utf8ByteLength(d) > 192) return fail('bad-d');

    const future = futureCheck(event.created_at, opts);
    if (future) return fail(future);

    // Members are `a` tags that parse as 30078:<64-hex>:<d>. Other `a` values
    // (a set may reference anything) are ignored, not errors.
    const members = [];
    let ignored = 0;
    const aTags = tagsWithName(event.tags, 'a');
    for (let i = 0; i < aTags.length; i += 1) {
      const value = aTags[i][1];
      if (typeof value !== 'string' || !isValidCoordinate(value)) {
        ignored += 1;
        continue;
      }
      if (members.indexOf(value) === -1) members.push(value);
    }

    return {
      ok: true,
      set: {
        curator: event.pubkey,
        d,
        coordinate: coordinateOf(POLICY.CURATION_KIND, event.pubkey, d),
        members,
        ignoredMembers: ignored,
        title: singleTagValue(event.tags, 'title'),
        image: singleTagValue(event.tags, 'image'),
        description: singleTagValue(event.tags, 'description'),
        eventId: typeof event.id === 'string' ? event.id : null,
        createdAt: event.created_at
      }
    };
  }

  // ---- kind 3: NIP-02 follow list (§6.2) ----
  function validateFollowListEvent(event, opts) {
    opts = opts || {};
    if (!event || typeof event !== 'object') return fail('bad-schema');
    if (event.kind !== POLICY.FOLLOW_KIND) return fail('bad-kind');
    if (!isLowercaseHex64(event.pubkey)) return fail('bad-schema');
    if (!Array.isArray(event.tags)) return fail('bad-schema');
    if (!Number.isSafeInteger(event.created_at)) return fail('bad-schema');

    const future = futureCheck(event.created_at, opts);
    if (future) return fail(future);

    // Deduplicated preserving first occurrence in the signed event's own tag
    // order: NIP-02 appends fresh follows, so tag order is meaningful and, being
    // part of the signed event, is arrival-order independent (I4).
    const follows = [];
    let malformed = 0;
    let total = 0;
    const pTags = tagsWithName(event.tags, 'p');
    for (let i = 0; i < pTags.length; i += 1) {
      total += 1;
      const value = pTags[i][1];
      if (!isLowercaseHex64(value)) {
        malformed += 1;
        continue;
      }
      if (follows.indexOf(value) === -1) follows.push(value);
    }

    return {
      ok: true,
      followList: {
        pubkey: event.pubkey,
        follows,
        malformed,
        total,
        eventId: typeof event.id === 'string' ? event.id : null,
        createdAt: event.created_at
      }
    };
  }

  // ---- kind 5: NIP-09 deletion request (§7.3) ----
  function validateDeletionEvent(event, opts) {
    opts = opts || {};
    if (!event || typeof event !== 'object') return fail('bad-schema');
    if (event.kind !== POLICY.DELETION_KIND) return fail('bad-kind');
    if (!isLowercaseHex64(event.pubkey)) return fail('bad-schema');
    if (!Array.isArray(event.tags)) return fail('bad-schema');
    if (!Number.isSafeInteger(event.created_at)) return fail('bad-schema');

    const future = futureCheck(event.created_at, opts);
    if (future) return fail(future);

    const ids = [];
    const eTags = tagsWithName(event.tags, 'e');
    for (let i = 0; i < eTags.length; i += 1) {
      if (isLowercaseHex64(eTags[i][1]) && ids.indexOf(eTags[i][1]) === -1) ids.push(eTags[i][1]);
    }

    // NIP-09: relays honour a deletion request only for events with an identical
    // pubkey. An `a` request naming somebody else's address is ignored, which is
    // invariant I2 (publisher locality).
    const addresses = [];
    const aTags = tagsWithName(event.tags, 'a');
    for (let i = 0; i < aTags.length; i += 1) {
      const value = aTags[i][1];
      if (typeof value !== 'string') continue;
      const m = ADDRESS_RE.exec(value);
      if (!m) continue;
      if (m[2] !== event.pubkey) continue;
      if (addresses.indexOf(value) === -1) addresses.push(value);
    }

    return {
      ok: true,
      deletion: {
        author: event.pubkey,
        ids,
        addresses,
        eventId: typeof event.id === 'string' ? event.id : null,
        createdAt: event.created_at
      }
    };
  }

  // Union of every valid observed deletion request. Returns plain objects so the
  // result crosses a page.evaluate boundary unchanged.
  function collectDeletions(events, opts) {
    const ids = {};
    const addresses = {};
    let accepted = 0;
    let rejected = 0;
    const list = Array.isArray(events) ? events : [];
    for (let i = 0; i < list.length; i += 1) {
      const e = list[i];
      if (!e || e.kind !== POLICY.DELETION_KIND) continue;
      const vr = validateDeletionEvent(e, opts);
      if (!vr.ok) {
        rejected += 1;
        continue;
      }
      accepted += 1;
      const del = vr.deletion;
      for (let j = 0; j < del.ids.length; j += 1) {
        const key = del.ids[j];
        if (!ids[key]) ids[key] = [];
        if (ids[key].indexOf(del.author) === -1) ids[key].push(del.author);
      }
      for (let j = 0; j < del.addresses.length; j += 1) {
        const key = del.addresses[j];
        // NIP-09: an `a` request covers versions up to the request's created_at.
        if (!(key in addresses) || addresses[key] < del.createdAt) addresses[key] = del.createdAt;
      }
    }
    return { ids, addresses, accepted, rejected };
  }

  function isSuppressed(event, coordinate, deletions) {
    if (!deletions) return false;
    const byId = deletions.ids && deletions.ids[event.id];
    if (Array.isArray(byId) && byId.indexOf(event.pubkey) !== -1) return true;
    if (coordinate && coordinate in (deletions.addresses || {})) {
      if (event.created_at <= deletions.addresses[coordinate]) return true;
    }
    return false;
  }

  // ---- addressable/replaceable winner selection (NIP-01, §5.3) ----
  function selectAddressableWinner(events) {
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

  // §5.3: validation precedes selection. A newer version that fails schema
  // validation is quarantined and the newest *valid* version wins, with the row
  // flagged so the display is not silently a version behind.
  function selectSoftwareWinners(events, opts) {
    opts = opts || {};
    const deletions = opts.deletions || null;
    const receipts = opts.receipts || null;
    const groups = new Map();

    function group(coordinate) {
      let g = groups.get(coordinate);
      if (!g) {
        g = { coordinate, valid: [], quarantined: [] };
        groups.set(coordinate, g);
      }
      return g;
    }

    const list = Array.isArray(events) ? events : [];
    for (let i = 0; i < list.length; i += 1) {
      const e = list[i];
      if (!e || typeof e !== 'object' || e.kind !== POLICY.SOFTWARE_KIND) continue;
      const receipt = receipts && typeof e.id === 'string' ? receipts[e.id] : null;
      const perEvent = {
        nowSec: opts.nowSec,
        receivedAtSec: receipt && Number.isFinite(receipt.receivedAtSec)
          ? receipt.receivedAtSec : opts.receivedAtSec
      };
      const vr = validateSoftwareEvent(e, perEvent);
      // Best-effort coordinate for a rejected event, so quarantine stays
      // inspectable and attributable rather than silently discarded (§3).
      const coordinate = vr.ok
        ? vr.record.coordinate
        : coordinateOf(POLICY.SOFTWARE_KIND, isLowercaseHex64(e.pubkey) ? e.pubkey : 'unknown', getDtag(e.tags));
      const g = group(coordinate);
      if (!vr.ok) {
        g.quarantined.push({
          coordinate,
          eventId: typeof e.id === 'string' ? e.id : null,
          pubkey: typeof e.pubkey === 'string' ? e.pubkey : null,
          createdAt: Number.isFinite(e.created_at) ? e.created_at : null,
          reason: vr.reason
        });
        continue;
      }
      if (isSuppressed(e, coordinate, deletions)) {
        g.quarantined.push({
          coordinate,
          eventId: vr.record.eventId,
          pubkey: e.pubkey,
          createdAt: e.created_at,
          reason: 'deleted'
        });
        continue;
      }
      g.valid.push({ event: e, record: vr.record });
    }

    const winners = [];
    const quarantined = [];
    const coords = Array.from(groups.keys()).sort(compareCodePoints);
    for (let i = 0; i < coords.length; i += 1) {
      const g = groups.get(coords[i]);
      const winnerEvent = selectAddressableWinner(g.valid.map((v) => v.event));
      const winner = winnerEvent ? g.valid.find((v) => v.event === winnerEvent) : null;
      for (let j = 0; j < g.quarantined.length; j += 1) quarantined.push(g.quarantined[j]);
      if (!winner) continue;
      // A quarantined version newer than the winner means the display is a
      // version behind; that must be visible, not hidden (§5.3).
      let newer = null;
      for (let j = 0; j < g.quarantined.length; j += 1) {
        const q = g.quarantined[j];
        if (!Number.isFinite(q.createdAt)) continue;
        if (q.createdAt <= winner.record.createdAt) continue;
        if (!newer || q.createdAt > newer.createdAt) newer = q;
      }
      winners.push({
        coordinate: g.coordinate,
        record: winner.record,
        event: winner.event,
        quarantinedNewer: newer ? { eventId: newer.eventId, reason: newer.reason, createdAt: newer.createdAt } : null,
        observedVersions: g.valid.length
      });
    }
    return { winners, quarantined };
  }

  // ---- §6.2 the viewer's social graph (tier 1) ----
  function deriveGraph(opts) {
    opts = opts || {};
    const viewerPubkey = isLowercaseHex64(opts.viewerPubkey) ? opts.viewerPubkey : null;
    const base = {
      viewerPubkey,
      state: 'none',
      pubkeys: [],
      coverage: 'unknown',
      followsUsed: 0,
      followsTotal: 0,
      malformedPTags: 0,
      truncated: false,
      followListId: null,
      followListCreatedAt: null
    };
    // graph: none — no viewer pubkey is known. Counts are unknown, not 0 (§3).
    if (!viewerPubkey) return base;

    const candidates = [];
    const list = Array.isArray(opts.events) ? opts.events : [];
    for (let i = 0; i < list.length; i += 1) {
      const e = list[i];
      if (!e || e.kind !== POLICY.FOLLOW_KIND || e.pubkey !== viewerPubkey) continue;
      const vr = validateFollowListEvent(e, opts);
      if (!vr.ok) continue;
      // kind 3 is replaceable at (3, pubkey); the coordinate has no `d`.
      if (isSuppressed(e, coordinateOf(POLICY.FOLLOW_KIND, e.pubkey, ''), opts.deletions)) continue;
      candidates.push(e);
    }
    // Union across relays first, then select: one relay's limit:1 answer is never
    // accepted as the global winner (§6.2 step 2).
    const winnerEvent = selectAddressableWinner(candidates);
    if (!winnerEvent) {
      // graph: self-only — reported as such, never as "you follow nobody" (§6.2).
      return Object.assign(base, {
        state: 'self-only',
        pubkeys: [viewerPubkey],
        coverage: 'incomplete',
        followsUsed: 0,
        followsTotal: 0
      });
    }
    const parsed = validateFollowListEvent(winnerEvent, opts).followList;
    const pubkeys = [viewerPubkey];
    for (let i = 0; i < parsed.follows.length; i += 1) {
      if (pubkeys.indexOf(parsed.follows[i]) === -1) pubkeys.push(parsed.follows[i]);
    }
    const truncated = pubkeys.length > POLICY.GRAPH_MAX_FOLLOWS;
    const used = truncated ? pubkeys.slice(0, POLICY.GRAPH_MAX_FOLLOWS) : pubkeys;
    const nowSec = Number.isFinite(opts.nowSec) ? opts.nowSec : Math.floor(Date.now() / 1000);
    const staleAfter = POLICY.GRAPH_STALE_AFTER_MS / 1000;
    let coverage = 'fresh';
    if (truncated) coverage = 'truncated';
    else if (nowSec - parsed.createdAt > staleAfter) coverage = 'stale';
    return {
      viewerPubkey,
      state: 'tier1',
      pubkeys: used,
      coverage,
      followsUsed: used.length,
      followsTotal: pubkeys.length,
      malformedPTags: parsed.malformed,
      truncated,
      followListId: parsed.eventId,
      followListCreatedAt: parsed.createdAt
    };
  }

  // ---- §6.1/§6.4 curation membership and recommendation counts ----
  function curationMembership(opts) {
    opts = opts || {};
    const counted = [];
    const source = Array.isArray(opts.pubkeys) ? opts.pubkeys : [];
    for (let i = 0; i < source.length; i += 1) {
      if (isLowercaseHex64(source[i]) && counted.indexOf(source[i]) === -1) counted.push(source[i]);
    }
    const countedSet = new Set(counted);

    // Group into (30267, curator, d) coordinates and select each winner.
    const groups = new Map();
    const list = Array.isArray(opts.events) ? opts.events : [];
    for (let i = 0; i < list.length; i += 1) {
      const e = list[i];
      if (!e || e.kind !== POLICY.CURATION_KIND) continue;
      if (!countedSet.has(e.pubkey)) continue;
      const vr = validateCurationSetEvent(e, opts);
      if (!vr.ok) continue;
      if (isSuppressed(e, vr.set.coordinate, opts.deletions)) continue;
      let g = groups.get(vr.set.coordinate);
      if (!g) {
        g = { curator: e.pubkey, d: vr.set.d, events: [] };
        groups.set(vr.set.coordinate, g);
      }
      g.events.push(e);
    }

    const byCurator = new Map();
    groups.forEach((g) => {
      const winnerEvent = selectAddressableWinner(g.events);
      if (!winnerEvent) return;
      const set = validateCurationSetEvent(winnerEvent, opts).set;
      let entry = byCurator.get(g.curator);
      if (!entry) {
        entry = { curator: g.curator, sets: [] };
        byCurator.set(g.curator, entry);
      }
      entry.sets.push(set);
    });

    const curators = [];
    const recommenders = new Map();
    const curatorKeys = Array.from(byCurator.keys()).sort(compareCodePoints);
    for (let i = 0; i < curatorKeys.length; i += 1) {
      const entry = byCurator.get(curatorKeys[i]);
      // §6.1: at most GRAPH_MAX_SETS_PER_CURATOR sets per curator, selected
      // deterministically by ascending `d` code-point order, truncation reported.
      entry.sets.sort((a, b) => compareCodePoints(a.d, b.d));
      const setsObserved = entry.sets.length;
      const used = entry.sets.slice(0, POLICY.GRAPH_MAX_SETS_PER_CURATOR);
      const members = [];
      for (let j = 0; j < used.length; j += 1) {
        for (let k = 0; k < used[j].members.length; k += 1) {
          const coord = used[j].members[k];
          if (members.indexOf(coord) === -1) members.push(coord);
        }
      }
      members.sort(compareCodePoints);
      // A curator counts once per tool no matter how many of their sets list it.
      for (let j = 0; j < members.length; j += 1) {
        let who = recommenders.get(members[j]);
        if (!who) {
          who = [];
          recommenders.set(members[j], who);
        }
        if (who.indexOf(entry.curator) === -1) who.push(entry.curator);
      }
      curators.push({
        curator: entry.curator,
        setsObserved,
        setsUsed: used.length,
        truncated: setsObserved > used.length,
        setIds: used.map((s) => s.d),
        memberCount: members.length,
        members
      });
    }

    const recommenderList = {};
    recommenders.forEach((who, coord) => {
      recommenderList[coord] = who.slice().sort(compareCodePoints);
    });
    return {
      counted,
      curators,
      recommenders: recommenderList,
      // Every coordinate any counted curator recommends, deterministically ordered.
      learned: Object.keys(recommenderList).sort(compareCodePoints)
    };
  }

  // ---- §6.4 deterministic ordering ----
  // When the graph is `none`, rec1 is unknown for every row, so the count
  // component is dropped from the key entirely rather than substituted with 0
  // (invariant I8).
  function orderEntries(entries, graphState) {
    const useCounts = graphState !== 'none';
    const copy = (Array.isArray(entries) ? entries : []).slice();
    copy.sort((a, b) => {
      if (useCounts) {
        const ra = Number.isFinite(a.recommendations) ? a.recommendations : 0;
        const rb = Number.isFinite(b.recommendations) ? b.recommendations : 0;
        if (ra !== rb) return rb - ra;
      }
      if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
      const ia = a.eventId || '';
      const ib = b.eventId || '';
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });
    return copy;
  }

  // ---- the pure reducer: observed events -> displayable catalog ----
  // Identical validated observed inputs produce byte-identical output including
  // ordering, independent of arrival order and of which relay delivered what (I4).
  function buildCatalog(input) {
    input = input || {};
    const nowMs = Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
    const nowSec = Number.isFinite(input.nowSec) ? input.nowSec : Math.floor(nowMs / 1000);
    const events = Array.isArray(input.events) ? input.events : [];
    const receipts = input.receipts || {};
    const sources = input.sources || {};
    const coverage = input.coverage || {};
    const diagnostics = Array.isArray(input.diagnostics) ? input.diagnostics.slice() : [];
    const validationOpts = { nowSec, receivedAtSec: nowSec, receipts };

    const deletions = collectDeletions(events, validationOpts);

    const graph = deriveGraph({
      viewerPubkey: input.viewerPubkey,
      events,
      deletions,
      nowSec
    });

    // §6.5.6: a user-editable "also count these" list. It ships empty, is never
    // populated by the app, and its contributions are labelled as manual.
    const manual = [];
    const manualInput = Array.isArray(input.manualCounted) ? input.manualCounted : [];
    for (let i = 0; i < manualInput.length; i += 1) {
      const key = decodeNpub(manualInput[i]);
      if (key && graph.pubkeys.indexOf(key) === -1 && manual.indexOf(key) === -1) manual.push(key);
    }

    const curation = curationMembership({
      events,
      pubkeys: graph.pubkeys,
      deletions,
      nowSec,
      receivedAtSec: nowSec
    });
    const manualCuration = manual.length
      ? curationMembership({ events, pubkeys: manual, deletions, nowSec, receivedAtSec: nowSec })
      : { counted: [], curators: [], recommenders: {}, learned: [] };

    const selection = selectSoftwareWinners(events, {
      deletions,
      nowSec,
      receivedAtSec: nowSec,
      receipts
    });

    const observedCoordinates = new Set();
    for (let i = 0; i < selection.winners.length; i += 1) {
      observedCoordinates.add(selection.winners[i].coordinate);
    }
    for (let i = 0; i < selection.quarantined.length; i += 1) {
      observedCoordinates.add(selection.quarantined[i].coordinate);
    }

    const rows = [];
    for (let i = 0; i < selection.winners.length; i += 1) {
      const w = selection.winners[i];
      // §5.4 listability — the complete rule. No curator, relay, configuration,
      // or local list participates.
      if (w.record.state !== 'active') continue;
      const receipt = w.record.eventId ? receipts[w.record.eventId] : null;
      const recommenders = curation.recommenders[w.coordinate] || [];
      const manualRecommenders = manualCuration.recommenders[w.coordinate] || [];
      rows.push({
        coordinate: w.coordinate,
        publisher: w.record.publisher,
        d: w.record.d,
        state: 'active',
        fields: {
          name: w.record.name,
          summary: w.record.summary,
          homepage: w.record.homepage
        },
        topics: w.record.topics.slice(),
        supersededBy: w.record.supersededBy,
        eventId: w.record.eventId,
        createdAt: w.record.createdAt,
        // unknown when the viewer has no graph; never 0, never invented (I8).
        recommendations: graph.state === 'none' ? null : recommenders.length,
        recommenders: graph.state === 'none' ? [] : recommenders.slice(),
        manualRecommendations: manual.length ? manualRecommenders.length : null,
        manualRecommenders: manualRecommenders.slice(),
        quarantinedNewer: w.quarantinedNewer,
        relays: (sources[w.record.eventId] || []).slice(),
        // stale: this winner was not re-observed in the current round and is
        // being served from the derived cache (§3).
        stale: Boolean(receipt && receipt.cached)
      });
    }

    const entries = orderEntries(rows, graph.state);

    // §5.4: a coordinate recommended by everyone but with no observed valid
    // winner is not listable. It appears here, never as a fabricated row.
    const unresolved = [];
    const learnedAll = curation.learned.concat(manualCuration.learned);
    for (let i = 0; i < learnedAll.length; i += 1) {
      const coord = learnedAll[i];
      if (observedCoordinates.has(coord)) continue;
      if (unresolved.indexOf(coord) === -1) unresolved.push(coord);
    }
    unresolved.sort(compareCodePoints);

    // ---- status (§3) ----
    const relayUrls = Object.keys(coverage);
    let allEose = relayUrls.length > 0;
    for (let i = 0; i < relayUrls.length; i += 1) {
      const cov = coverage[relayUrls[i]];
      if (!cov || (cov.status !== 'eose' && cov.status !== 'skipped')) {
        allEose = false;
        break;
      }
    }
    // §8.3 example B: a stale graph changes counts, never the row set (I7), so it
    // is reported in `graph.coverage` and does not make the catalog itself stale.
    const anyStale = entries.some((e) => e.stale === true);
    const observedAnything = events.length > 0;

    if (graph.state === 'none') diagnostics.push('graph-none');
    if (graph.state === 'self-only') diagnostics.push('graph-self-only');
    if (graph.truncated) diagnostics.push('graph-truncated:' + graph.followsUsed + '/' + graph.followsTotal);
    if (graph.malformedPTags > 0) diagnostics.push('graph-malformed-p-tags:' + graph.malformedPTags);
    for (let i = 0; i < curation.curators.length; i += 1) {
      if (curation.curators[i].truncated) {
        diagnostics.push('curator-sets-truncated:' + curation.curators[i].curator);
      }
    }
    if (selection.quarantined.length) diagnostics.push('quarantined:' + selection.quarantined.length);
    if (unresolved.length) diagnostics.push('recommended-coordinate-not-observed:' + unresolved.length);
    if (!allEose) diagnostics.push('relay-coverage-incomplete');

    if (allEose && !observedAnything) diagnostics.push('no-records-observed');
    if (graph.coverage === 'stale') diagnostics.push('graph-stale');

    let status;
    if (!observedAnything) {
      status = 'unavailable';
    } else if (anyStale) {
      status = 'stale';
    } else if (!allEose || diagnostics.indexOf('discovery-cap') !== -1 || graph.truncated) {
      status = 'incomplete';
    } else {
      status = 'fresh';
    }

    return {
      status,
      entries,
      graph,
      curation: {
        counted: curation.counted,
        curators: curation.curators.map((c) => ({
          curator: c.curator,
          setsObserved: c.setsObserved,
          setsUsed: c.setsUsed,
          truncated: c.truncated,
          setIds: c.setIds,
          memberCount: c.memberCount
        })),
        manual: manualCuration.curators.map((c) => ({
          curator: c.curator,
          setsObserved: c.setsObserved,
          setsUsed: c.setsUsed,
          truncated: c.truncated,
          setIds: c.setIds,
          memberCount: c.memberCount
        }))
      },
      quarantined: selection.quarantined,
      unresolved,
      deletions: { accepted: deletions.accepted, rejected: deletions.rejected },
      coverage,
      topics: Array.isArray(input.topics) ? input.topics.slice() : POLICY.DISCOVERY_TOPICS.slice(),
      asOf: nowMs,
      diagnostics
    };
  }

  // ---- §9.4 byte-aware chunking (NIP-11 values absent -> labelled `assumed`) ----
  function serializeReq(subId, filters) {
    return JSON.stringify(['REQ', subId].concat(filters));
  }

  function arrayKeys(filter) {
    const out = [];
    const keys = Object.keys(filter).sort();
    for (let i = 0; i < keys.length; i += 1) {
      if (Array.isArray(filter[keys[i]])) out.push(keys[i]);
    }
    return out;
  }

  function capArrays(filter, cap) {
    let out = [filter];
    let changed = true;
    let guard = 0;
    while (changed) {
      if (++guard > 64) break;
      changed = false;
      const next = [];
      for (let i = 0; i < out.length; i += 1) {
        const f = out[i];
        const keys = arrayKeys(f);
        let bigKey = null;
        for (let j = 0; j < keys.length; j += 1) {
          const k = keys[j];
          if (f[k].length > cap && (bigKey === null || f[k].length > f[bigKey].length)) bigKey = k;
        }
        if (bigKey === null) {
          next.push(f);
          continue;
        }
        changed = true;
        const arr = f[bigKey];
        for (let s = 0; s < arr.length; s += cap) {
          const copy = Object.assign({}, f);
          copy[bigKey] = arr.slice(s, s + cap);
          next.push(copy);
        }
      }
      out = next;
    }
    return out;
  }

  function largestArrayKey(filter) {
    const keys = arrayKeys(filter);
    let big = null;
    for (let i = 0; i < keys.length; i += 1) {
      if (big === null || filter[keys[i]].length > filter[big].length) big = keys[i];
    }
    return big;
  }

  function reqBytes(subId, filters) {
    return utf8ByteLength(serializeReq(subId, filters));
  }

  // Serialize the full ["REQ", subId, ...filters] and split until both the filter
  // count and the byte length fit. A filter that does not fit the remaining byte
  // budget is split by its largest array so the byte budget is actually filled
  // rather than wasted on uniform array-cap granularity. A scalar-only filter
  // that cannot fit fails visibly.
  function chunkFilters(filters, opts) {
    opts = opts || {};
    const maxFilters = Number.isFinite(opts.maxFilters) ? opts.maxFilters : POLICY.MAX_FILTERS_PER_REQ;
    const maxBytes = Number.isFinite(opts.maxBytes) ? opts.maxBytes : POLICY.MAX_SERIALIZED_REQ_BYTES_FALLBACK;
    const arrayCap = Number.isFinite(opts.maxArrayItems) ? opts.maxArrayItems : POLICY.MAX_ARRAY_ITEMS_PER_FILTER;
    const subId = typeof opts.subId === 'string' && opts.subId ? opts.subId : 'nosmaps-000000000000';
    const input = Array.isArray(filters) ? filters : [];

    const queue = [];
    for (let i = 0; i < input.length; i += 1) {
      const capped = capArrays(input[i], arrayCap);
      for (let j = 0; j < capped.length; j += 1) queue.push(capped[j]);
    }

    const chunks = [];
    let current = [];
    let guard = 0;
    while (queue.length) {
      if (++guard > 8192) return { ok: false, reason: 'chunk-guard', chunks: [] };
      const f = queue[0];
      const withF = current.concat([f]);
      if (withF.length <= maxFilters && reqBytes(subId, withF) <= maxBytes) {
        current = withF;
        queue.shift();
        continue;
      }
      const key = withF.length <= maxFilters ? largestArrayKey(f) : null;
      if (key && f[key].length > 1) {
        // Largest prefix of the biggest array that still fits this REQ.
        let lo = 1;
        let hi = f[key].length - 1;
        let best = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const trial = Object.assign({}, f);
          trial[key] = f[key].slice(0, mid);
          if (reqBytes(subId, current.concat([trial])) <= maxBytes) {
            best = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        if (best > 0) {
          const head = Object.assign({}, f);
          head[key] = f[key].slice(0, best);
          const tail = Object.assign({}, f);
          tail[key] = f[key].slice(best);
          current.push(head);
          queue[0] = tail;
          chunks.push(current);
          current = [];
          continue;
        }
      }
      if (current.length) {
        chunks.push(current);
        current = [];
        continue;
      }
      return { ok: false, reason: 'filter-too-large', chunks: [] };
    }
    if (current.length) chunks.push(current);
    let filterCount = 0;
    for (let i = 0; i < chunks.length; i += 1) filterCount += chunks[i].length;
    return { ok: true, chunks, filterCount };
  }

  // ---- IndexedDB derived cache (D14: discardable acceleration, never evidence) ----
  const DB_NAME = 'nosmaps-catalog';
  // v1 held manifest blobs keyed by curator:scope. Revision 2 caches signed
  // 30078 events keyed by coordinate, so the store changes with the version.
  const DB_VERSION = 2;
  const STORE = 'records';
  const LEGACY_STORE = 'manifests';

  function idbAvailable() {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
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
          if (db.objectStoreNames.contains(LEGACY_STORE)) db.deleteObjectStore(LEGACY_STORE);
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'coordinate' });
          }
        } catch (e) { /* noop */ }
      };
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }

  function putRecord(record) {
    return new Promise((resolve) => {
      open().then((db) => {
        if (!db) { resolve(); return; }
        try {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(record);
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

  function getRecord(coordinate) {
    return new Promise((resolve) => {
      open().then((db) => {
        if (!db) { resolve(null); return; }
        try {
          const tx = db.transaction(STORE, 'readonly');
          const r = tx.objectStore(STORE).get(coordinate);
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

  function isFresh(record, nowMs) {
    if (!record || !Number.isFinite(record.verifiedAt)) return false;
    return (nowMs - record.verifiedAt) < POLICY.CATALOG_STALE_AFTER_MS;
  }

  const cache = { open, putRecord, getRecord, getAll, wipe, deleteDatabase, isFresh };

  // ---- relay layer ----
  // DEVIATION: rx-nostr 3.7.5 high-level EOSE-per-relay correlation is not verified
  // without the implementation-preflight live probe (design §13.1, §20.3). We
  // therefore approximate coverage: on clean completion of the backward request all
  // relays are marked 'eose'; on timeout the still-unresolved relays are marked
  // 'timeout'; on any import/subscribe failure every relay is marked 'error'.
  // Per-relay granularity is a live-probe follow-up. coverage values are objects
  // {status, observedAt} because §8.1 requires observation time to be recorded.
  async function createRelayContext(relays, timeoutMs) {
    try {
      // Lazy dynamic import; specifiers resolve against the document base URL.
      const [rxMod, cryptoMod] = await Promise.all([
        import('./dist/rx-nostr.js'),
        import('./dist/rx-nostr-crypto.js')
      ]);
      // Signature verification is supplied here: createRxNostr({verifier}) drops
      // events with invalid ids/signatures before they reach our next handler.
      // This is invariant I1 — no bytes influence a displayed value first.
      const rxNostr = rxMod.createRxNostr({ verifier: cryptoMod.verifier });
      rxNostr.setDefaultRelays(relays);
      return {
        ok: true,
        rxNostr,
        createRxBackwardReq: rxMod.createRxBackwardReq,
        relays: relays.slice(),
        timeoutMs
      };
    } catch (e) {
      return { ok: false, rxNostr: null, relays: relays.slice(), timeoutMs };
    }
  }

  function emptyCoverage(relays, status, observedAt) {
    const coverage = {};
    for (let i = 0; i < relays.length; i += 1) coverage[relays[i]] = { status, observedAt };
    return coverage;
  }

  // One logical REQ round per relay. Physical REQs multiply only through §9.4
  // chunking — never per curator, per tool, per card, or per event.
  async function fetchRound(ctx, filters, label) {
    const relays = ctx.relays;
    const observedAt = Date.now();
    const round = {
      label,
      events: [],
      coverage: emptyCoverage(relays, 'error', observedAt),
      logicalReqs: 0,
      physicalReqs: 0,
      chunks: 0,
      filters: [],
      reason: null
    };
    if (!filters.length) {
      round.coverage = emptyCoverage(relays, 'skipped', observedAt);
      round.reason = 'skipped';
      return round;
    }
    const chunked = chunkFilters(filters, { subId: 'nosmaps-' + label });
    if (!chunked.ok) {
      round.coverage = emptyCoverage(relays, 'rejected', observedAt);
      round.reason = chunked.reason;
      return round;
    }
    round.filters = chunked.chunks;
    round.chunks = chunked.chunks.length;
    if (!ctx.ok) {
      round.reason = 'relay-unavailable';
      return round;
    }

    stats.logicalReqs += relays.length;
    round.logicalReqs = relays.length;
    for (let i = 0; i < relays.length; i += 1) {
      for (let j = 0; j < chunked.chunks.length; j += 1) {
        stats._logReq(relays[i], label + ':' + j);
        round.physicalReqs += 1;
      }
    }

    const rxReq = ctx.createRxBackwardReq();
    await new Promise((resolve) => {
      let settled = false;
      let sub = null;
      const timer = setTimeout(() => finish('timeout'), ctx.timeoutMs);

      function finish(mode) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const at = Date.now();
        for (let i = 0; i < relays.length; i += 1) {
          const r = relays[i];
          if (mode === 'eose') {
            round.coverage[r] = { status: 'eose', observedAt: at };
          } else if (round.coverage[r].status === 'error') {
            round.coverage[r] = { status: mode === 'timeout' ? 'timeout' : 'error', observedAt: at };
          }
        }
        if (sub && typeof sub.unsubscribe === 'function') {
          try { sub.unsubscribe(); } catch (e) { /* noop */ }
        }
        resolve();
      }

      try {
        sub = ctx.rxNostr.use(rxReq).subscribe({
          next: (packet) => {
            try {
              if (packet && packet.event) {
                round.events.push({ event: packet.event, from: packet.from || null });
              }
            } catch (e) { /* noop */ }
          },
          error: () => finish('error'),
          complete: () => finish('eose')
        });
      } catch (e) {
        finish('error');
        return;
      }

      // Emit one REQ per §9.4 chunk, then close the backward request so the
      // observable completes after EOSE. Guarded because exact method names are
      // a live-probe follow-up in this rx-nostr version.
      try {
        for (let i = 0; i < chunked.chunks.length; i += 1) rxReq.emit(chunked.chunks[i]);
        if (typeof rxReq.over === 'function') rxReq.over();
      } catch (e) {
        finish('error');
      }
    });

    return round;
  }

  function mergeCoverage(target, round) {
    const keys = Object.keys(round.coverage);
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const next = round.coverage[k];
      const prev = target[k];
      if (!prev) {
        target[k] = next;
        continue;
      }
      // Worst status across rounds wins; a skipped round never degrades coverage.
      if (next.status === 'skipped') continue;
      if (prev.status === 'skipped' || prev.status === 'eose') target[k] = next;
      else if (next.status !== 'eose') target[k] = next;
    }
    return target;
  }

  // §5.2: filters MUST be grouped by author. A single filter with
  // authors:[A,B] and #d:[x,y] matches the Cartesian product and lets one
  // author's events consume another's limit. Grouping is by author, not one REQ
  // per author: all groups travel in the same REQ subject only to §9.4 chunking.
  function groupByAuthor(coordinates) {
    const byAuthor = new Map();
    for (let i = 0; i < coordinates.length; i += 1) {
      const m = COORD_RE.exec(coordinates[i]);
      if (!m) continue;
      let ds = byAuthor.get(m[1]);
      if (!ds) {
        ds = [];
        byAuthor.set(m[1], ds);
      }
      if (ds.indexOf(m[2]) === -1) ds.push(m[2]);
    }
    const authors = Array.from(byAuthor.keys()).sort(compareCodePoints);
    const filters = [];
    for (let i = 0; i < authors.length; i += 1) {
      const ds = byAuthor.get(authors[i]).slice().sort(compareCodePoints);
      filters.push({
        kinds: [POLICY.SOFTWARE_KIND],
        authors: [authors[i]],
        '#d': ds,
        limit: ds.length * 4
      });
    }
    return filters;
  }

  // §7.3: at most one coalesced kind-5 REQ per relay per target round, carrying
  // every newly learned coordinate plus the matching authors. Per-card and
  // per-event cleanup requests are forbidden.
  function cleanupFilter(authors, addresses) {
    const a = authors.slice().sort(compareCodePoints);
    const addr = addresses.slice().sort(compareCodePoints);
    if (!a.length && !addr.length) return null;
    const filter = { kinds: [POLICY.DELETION_KIND], limit: POLICY.CLEANUP_LIMIT };
    if (a.length) filter.authors = a;
    if (addr.length) filter['#a'] = addr;
    return filter;
  }

  // ---- orchestration: loadCatalog (§8.4 empty-cache rebuild, §9.1 R1-R3) ----
  async function loadCatalog(opts) {
    opts = opts || {};
    const relays = (Array.isArray(opts.relays) && opts.relays.length)
      ? opts.relays.slice() : POLICY.DEFAULT_RELAYS.slice();
    const topics = (Array.isArray(opts.topics) && opts.topics.length)
      ? opts.topics.slice() : POLICY.DISCOVERY_TOPICS.slice();
    const useCache = opts.useCache !== false;
    const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : POLICY.REQ_TIMEOUT_MS;

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
    // §9.4: NIP-11 is not fetched here — reading it would put HTTP back into the
    // catalog data path, which §9.2 forbids. Conservative fallbacks are used and
    // labelled `assumed`.
    diagnostics.push('nip11-assumed');
    if (opts.tier2 === true || POLICY.GRAPH_TIER2_ENABLED) {
      // §6.3 tier 2 is opt-in and costs megabytes for a reordering signal. It is
      // not implemented in this phase; saying so is the honest degradation.
      diagnostics.push('tier2-not-implemented');
    }

    const rounds = [];
    let ctx = null;
    try {
      // ---- §6.2 step 1: identity, in preference order ----
      let viewerPubkey = null;
      let viewerSource = 'none';
      const pasted = opts.viewerPubkey || opts.viewerNpub;
      if (pasted) {
        viewerPubkey = decodeNpub(pasted);
        if (viewerPubkey) viewerSource = 'pasted';
        else diagnostics.push('viewer-key-unparsable');
      }
      // NIP-07 is only consulted on explicit request: getPublicKey() prompts the
      // user, and prompting on a plain page load is not opt-in (§6.2 step 1.1).
      if (!viewerPubkey && opts.useNip07 === true) {
        try {
          if (typeof window !== 'undefined' && window.nostr && typeof window.nostr.getPublicKey === 'function') {
            const key = await window.nostr.getPublicKey();
            viewerPubkey = decodeNpub(key);
            if (viewerPubkey) viewerSource = 'nip07';
            else diagnostics.push('nip07-key-unparsable');
          } else {
            diagnostics.push('nip07-unavailable');
          }
        } catch (e) {
          diagnostics.push('nip07-refused');
        }
      }

      ctx = await createRelayContext(relays, timeoutMs);
      if (!ctx.ok) diagnostics.push('relay-layer-unavailable');

      // ---- R1: discovery by `t` plus the viewer's kind 3 ----
      const r1Filters = [{
        kinds: [POLICY.SOFTWARE_KIND],
        '#t': topics.slice().sort(compareCodePoints),
        limit: POLICY.DISCOVERY_LIMIT_PER_RELAY
      }];
      if (viewerPubkey) {
        r1Filters.push({ kinds: [POLICY.FOLLOW_KIND], authors: [viewerPubkey], limit: 1 });
      }
      const r1 = await fetchRound(ctx, r1Filters, 'r1');
      rounds.push(r1);

      const r1Events = r1.events.map((p) => p.event);
      const discoveredSoftware = r1Events.filter((e) => e && e.kind === POLICY.SOFTWARE_KIND);
      // §5.1 rule 4: hitting a bound marks the relay `incomplete: discovery-cap`.
      // An empty page proves only "no more events returned in this round".
      // DEVIATION: a single page is issued per round; pagination beyond page 1 is
      // not implemented, so saturation is reported rather than silently truncated.
      if (discoveredSoftware.length >= POLICY.DISCOVERY_LIMIT_PER_RELAY) {
        diagnostics.push('discovery-cap');
      }

      // ---- §6.2 step 3: G ----
      const graph = deriveGraph({ viewerPubkey, events: r1Events, nowSec });

      // §6.5.6: the manual "also count these" list is user-owned configuration, so
      // its pubkeys must actually be consulted. They ride in the same R2 filter as
      // array elements and are counted separately from the follow graph (§6.4).
      const manualCounted = [];
      const manualInput = Array.isArray(opts.manualCounted) ? opts.manualCounted : [];
      for (let i = 0; i < manualInput.length; i += 1) {
        const key = decodeNpub(manualInput[i]);
        if (key && manualCounted.indexOf(key) === -1) manualCounted.push(key);
      }
      const countedPubkeys = graph.pubkeys.slice();
      for (let i = 0; i < manualCounted.length; i += 1) {
        if (countedPubkeys.indexOf(manualCounted[i]) === -1) countedPubkeys.push(manualCounted[i]);
      }

      // ---- R2: curation. Every counted pubkey is an array element, not a filter ----
      let r2 = { label: 'r2', events: [], coverage: emptyCoverage(relays, 'skipped', Date.now()), logicalReqs: 0, physicalReqs: 0, chunks: 0, filters: [], reason: 'skipped' };
      if (countedPubkeys.length) {
        r2 = await fetchRound(ctx, [{
          kinds: [POLICY.CURATION_KIND],
          authors: countedPubkeys.slice().sort(compareCodePoints),
          limit: POLICY.GRAPH_MAX_FOLLOWS
        }], 'r2');
      }
      rounds.push(r2);

      const r2Events = r2.events.map((p) => p.event);

      // ---- R3: gap-fill (§6.6 recall) plus one coalesced kind-5 cleanup ----
      const curationForRecall = curationMembership({
        events: r2Events,
        pubkeys: countedPubkeys,
        nowSec,
        receivedAtSec: nowSec
      });
      const observedInR1 = new Set();
      for (let i = 0; i < discoveredSoftware.length; i += 1) {
        const e = discoveredSoftware[i];
        observedInR1.add(coordinateOf(POLICY.SOFTWARE_KIND, e.pubkey, getDtag(e.tags)));
      }
      const missing = curationForRecall.learned.filter((coord) => !observedInR1.has(coord));

      const cleanupAuthors = [];
      const cleanupAddresses = [];
      function noteAuthor(pubkey) {
        if (isLowercaseHex64(pubkey) && cleanupAuthors.indexOf(pubkey) === -1) cleanupAuthors.push(pubkey);
      }
      function noteAddress(coord) {
        if (coord && cleanupAddresses.indexOf(coord) === -1) cleanupAddresses.push(coord);
      }
      for (let i = 0; i < discoveredSoftware.length; i += 1) {
        const e = discoveredSoftware[i];
        noteAuthor(e.pubkey);
        noteAddress(coordinateOf(POLICY.SOFTWARE_KIND, e.pubkey, getDtag(e.tags)));
      }
      for (let i = 0; i < missing.length; i += 1) {
        const m = COORD_RE.exec(missing[i]);
        if (m) noteAuthor(m[1]);
        noteAddress(missing[i]);
      }
      for (let i = 0; i < r2Events.length; i += 1) {
        const e = r2Events[i];
        if (!e || e.kind !== POLICY.CURATION_KIND) continue;
        noteAuthor(e.pubkey);
        noteAddress(coordinateOf(POLICY.CURATION_KIND, e.pubkey, getDtag(e.tags)));
      }
      if (viewerPubkey) noteAuthor(viewerPubkey);

      const r3Filters = groupByAuthor(missing);
      const cleanup = cleanupFilter(cleanupAuthors, cleanupAddresses);
      if (cleanup) r3Filters.push(cleanup);
      let r3 = { label: 'r3', events: [], coverage: emptyCoverage(relays, 'skipped', Date.now()), logicalReqs: 0, physicalReqs: 0, chunks: 0, filters: [], reason: 'skipped' };
      if (r3Filters.length) r3 = await fetchRound(ctx, r3Filters, 'r3');
      rounds.push(r3);

      // ---- union everything observed, then validate and select ----
      const observed = r1.events.concat(r2.events, r3.events);
      const receipts = {};
      const sources = {};
      const events = [];
      for (let i = 0; i < observed.length; i += 1) {
        const packet = observed[i];
        const e = packet.event;
        if (!e || typeof e.id !== 'string') continue;
        if (!receipts[e.id]) {
          receipts[e.id] = { receivedAtSec: nowSec, observed: true, cached: false };
          events.push(e);
        }
        if (!sources[e.id]) sources[e.id] = [];
        if (packet.from && sources[e.id].indexOf(packet.from) === -1) sources[e.id].push(packet.from);
      }

      // The cache is a discardable accelerator (D14). A cached event was observed
      // once; feeding it back in lets a partitioned round still show something,
      // flagged `stale`, rather than nothing.
      if (useCache) {
        let cached = [];
        try {
          cached = await cache.getAll();
        } catch (e) {
          cached = [];
        }
        for (let i = 0; i < cached.length; i += 1) {
          const rec = cached[i];
          if (!rec || !rec.event || typeof rec.event.id !== 'string') continue;
          if (receipts[rec.event.id]) continue;
          if (!isFresh(rec, nowMs)) continue;
          receipts[rec.event.id] = {
            receivedAtSec: Number.isFinite(rec.receivedAtSec) ? rec.receivedAtSec : nowSec,
            observed: false,
            cached: true
          };
          events.push(rec.event);
          stats._logCache('reuse:' + rec.coordinate);
        }
      }

      const coverage = {};
      mergeCoverage(coverage, r1);
      mergeCoverage(coverage, r2);
      mergeCoverage(coverage, r3);

      const result = buildCatalog({
        events,
        receipts,
        sources,
        coverage,
        viewerPubkey,
        manualCounted: opts.manualCounted,
        topics,
        nowMs,
        nowSec,
        diagnostics
      });

      result.viewerSource = viewerSource;
      result.rounds = rounds.map((r) => ({
        label: r.label,
        logicalReqs: r.logicalReqs,
        physicalReqs: r.physicalReqs,
        chunks: r.chunks,
        filters: r.filters,
        reason: r.reason,
        coverage: r.coverage
      }));
      result.stats = delta();

      // Persist the winners as a derived, rebuildable cache.
      if (useCache) {
        for (let i = 0; i < result.entries.length; i += 1) {
          const entry = result.entries[i];
          const receipt = receipts[entry.eventId];
          if (!receipt || receipt.cached) continue;
          const winner = events.find((e) => e.id === entry.eventId);
          if (!winner) continue;
          try {
            await cache.putRecord({
              coordinate: entry.coordinate,
              eventId: entry.eventId,
              createdAt: entry.createdAt,
              receivedAtSec: receipt.receivedAtSec,
              verifiedAt: nowMs,
              event: winner
            });
          } catch (e) { /* cache failures never affect the result */ }
        }
      }

      return result;
    } catch (e) {
      diagnostics.push('load-error');
      return {
        status: 'unavailable',
        entries: [],
        graph: { state: 'none', pubkeys: [], coverage: 'unknown', followsUsed: 0, followsTotal: 0, truncated: false, malformedPTags: 0, viewerPubkey: null },
        curation: { counted: [], curators: [], manual: [] },
        quarantined: [],
        unresolved: [],
        deletions: { accepted: 0, rejected: 0 },
        coverage: emptyCoverage(relays, 'error', Date.now()),
        topics,
        asOf: nowMs,
        diagnostics,
        rounds: rounds.map((r) => ({ label: r.label, logicalReqs: r.logicalReqs, physicalReqs: r.physicalReqs, chunks: r.chunks, reason: r.reason })),
        stats: delta()
      };
    } finally {
      if (ctx && ctx.rxNostr && typeof ctx.rxNostr.dispose === 'function') {
        try { ctx.rxNostr.dispose(); } catch (e) { /* noop */ }
      }
    }
  }

  window.NOSMAPS_CATALOG = {
    POLICY,
    SOFTWARE_SCHEMA,
    SOFTWARE_D_PREFIX,
    validateSoftwareEvent,
    validateCurationSetEvent,
    validateFollowListEvent,
    validateDeletionEvent,
    collectDeletions,
    selectAddressableWinner,
    selectSoftwareWinners,
    deriveGraph,
    curationMembership,
    orderEntries,
    buildCatalog,
    chunkFilters,
    groupByAuthor,
    decodeNpub,
    isValidCoordinate,
    compareCodePoints,
    cache,
    loadCatalog,
    stats
  };
})();
