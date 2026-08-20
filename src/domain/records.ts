/* The org.nosmaps.software v1 schema and its validators.
   Pure domain layer: no DOM, no network, no window.

   NOTE: signature verification is NOT done here. It is asynchronous and handled
   in the data layer by rx-nostr's verifier (createRxNostr({verifier})). These
   functions are pure and synchronous so they can be unit-tested without crypto/IO. */

import {strictParse, utf8Encode, utf8ByteLength, type JsonValue} from './json.ts';
import {
  charLength, coordinateOf, fail, futureCheck,
  isLowercaseHex64, isValidCoordinate, singleTagValue, tagsWithName,
  type ClockOptions, type EventEnvelope, type Validation
} from './event.ts';
import {
  ADDRESS_RE, D_ASCII_RE, D_MAX_BYTES, POLICY, SOFTWARE_D_PREFIX, SOFTWARE_SCHEMA
} from './policy.ts';

/** A record's publication state. `withdrawn` is a state the record declares about
    itself; it is not a claim about whether the project is alive. */
export type RecordState = 'active' | 'withdrawn';

/** The validated canonical record. Absent facts are `null`, never the string
    "undefined" and never an invented default. */
export interface SoftwareRecord {
  readonly coordinate: string;
  readonly publisher: string;
  readonly d: string;
  readonly state: RecordState;
  readonly name: string;
  readonly summary: string;
  /** Per-language texts, v2 only (§4.2 rule 7a). `null` — not `{}` — when the record carries none:
      "recorded no language" and "recorded an empty map" are the same fact and are stated once. */
  readonly descriptions: Readonly<Record<string, string>> | null;
  /** The language of `summary`, when the signer stated it (§4.2 rule 7e). `null` means unrecorded,
      which is not the same as English and must never be rendered as one. */
  readonly summaryLang: string | null;
  readonly homepage: string | null;
  readonly supersededBy: string | null;
  readonly topics: readonly string[];
  readonly eventId: string | null;
  readonly createdAt: number;
}

export interface CurationSet {
  readonly curator: string;
  readonly d: string;
  readonly coordinate: string;
  readonly members: readonly string[];
  readonly ignoredMembers: number;
  readonly title: string | null;
  readonly image: string | null;
  readonly description: string | null;
  readonly eventId: string | null;
  readonly createdAt: number;
}

export interface FollowList {
  readonly pubkey: string;
  readonly follows: readonly string[];
  readonly malformed: number;
  readonly total: number;
  readonly eventId: string | null;
  readonly createdAt: number;
}

export interface DeletionRequest {
  readonly author: string;
  readonly ids: readonly string[];
  readonly addresses: readonly string[];
  readonly eventId: string | null;
  readonly createdAt: number;
}

/** The shared envelope check. `requireContent` reproduces the difference between
    the kinds exactly: 30078/30267 demand a string `content`, kind 3 and kind 5 do
    not read it at all and must not reject on it. */
function checkEnvelope(
  event: unknown,
  kind: number,
  requireContent: boolean
): Validation<'event', EventEnvelope> {
  if (!event || typeof event !== 'object') return fail('bad-schema');
  const raw = event as Partial<EventEnvelope>;
  if (raw.kind !== kind) return fail('bad-kind');
  if (!isLowercaseHex64(raw.pubkey)) return fail('bad-schema');
  if (!Array.isArray(raw.tags)) return fail('bad-schema');
  if (requireContent && typeof raw.content !== 'string') return fail('bad-schema');
  if (!Number.isSafeInteger(raw.created_at)) return fail('bad-schema');
  const {kind: k, pubkey, created_at: createdAt, tags} = raw;
  if (typeof k !== 'number' || typeof pubkey !== 'string'
      || typeof createdAt !== 'number' || !Array.isArray(tags)) {
    return fail('bad-schema');
  }
  const envelope: EventEnvelope = {
    kind: k,
    pubkey,
    created_at: createdAt,
    tags,
    ...(typeof raw.content === 'string' ? {content: raw.content} : {}),
    ...(typeof raw.id === 'string' ? {id: raw.id} : {}),
    ...(typeof raw.sig === 'string' ? {sig: raw.sig} : {})
  };
  return {ok: true, event: envelope};
}

/** A parsed JSON value that is a plain object (not null, not an array). */
type JsonRecord = {readonly [key: string]: JsonValue};

function isJsonRecord(value: JsonValue): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read a parsed JSON object's property without widening the whole value. */
function prop(obj: JsonRecord, key: string): JsonValue | undefined {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/* ---- kind 30078: the canonical record (§4.2) ---- */

export function validateSoftwareEvent(
  event: unknown,
  opts?: ClockOptions
): Validation<'record', SoftwareRecord> {
  const envelope = checkEnvelope(event, POLICY.SOFTWARE_KIND, true);
  if (!envelope.ok) return envelope;
  const ev = envelope.event;
  const content = ev.content ?? '';

  // §4.2 rule 1: exactly one `d`.
  const dTags = tagsWithName(ev.tags, 'd');
  const dValue = dTags[0]?.[1];
  if (dTags.length !== 1 || typeof dValue !== 'string') return fail('bad-d');
  const d = dValue;

  /* §4.2 "Foreign 30078 events", separation 1 of 2 — the address namespace.
     NIP-78 specifies 30078 as shared application-specific data, so another
     application's perfectly valid record is the normal case, not an error. A `d`
     outside our namespace is theirs: it is neither malformed (`bad-d`) nor a
     content-profile mismatch (`foreign-profile`), so it gets its own reason and
     is decided before `content` is even parsed. Checked here rather than at the
     call sites so it cannot be bypassed by a path that forgets it. */
  if (d.indexOf(SOFTWARE_D_PREFIX) !== 0) return fail('foreign-d');
  // A bare prefix names nothing. Keep this after the namespace check so it is
  // reported as our own malformed `d`, which is what it is.
  if (d.length === SOFTWARE_D_PREFIX.length) return fail('bad-d');
  // §4.2 rule 1: ASCII, <= 192 UTF-8 bytes, prefix included.
  if (!D_ASCII_RE.test(d) || utf8ByteLength(d) > D_MAX_BYTES) return fail('bad-d');

  /* Separation 2 of 2 — the content profile. Independent of the namespace gate
     above, so a foreign record that lands inside our namespace anyway (copy,
     typo, impersonation) is still quarantined, with its own distinct reason. */
  const parsed = strictParse(utf8Encode(content));
  if (!parsed.ok) return fail('foreign-profile');
  const value = parsed.value;
  if (!value || !isJsonRecord(value)) return fail('foreign-profile');
  const c: JsonRecord = value;
  if (prop(c, 'schema') !== SOFTWARE_SCHEMA) return fail('foreign-profile');

  /* §5.1 rules 1-2: `t` values are lowercase, and the multi-value form is
     rejected because NIP-01 indexes only the first value of a tag. */
  const topics: string[] = [];
  for (const tag of tagsWithName(ev.tags, 't')) {
    const topic = tag[1];
    if (typeof topic !== 'string' || topic === '') return fail('bad-topic');
    for (let j = 2; j < tag.length; j += 1) {
      const extra = tag[j];
      if (typeof extra === 'string' && extra !== '') return fail('multi-value-t');
    }
    if (topic !== topic.toLowerCase()) return fail('uppercase-topic');
    if (utf8ByteLength(topic) > 128) return fail('bad-topic');
    if (topics.indexOf(topic) === -1) topics.push(topic);
  }

  /* §4.2 rules 2 and 7: the exact content key set, which is the one belonging to the version the
     record itself states. v1 and v2 are both current: v2 only adds two optional keys, so a v1
     record is not stale and is not rewritten -- it is a record that carries no per-language text.
     The key set is chosen by version rather than unioned, so a v1 record naming `descriptions` is
     still `unknown-field`: it would be claiming a key its own profile does not have. */
  const version = prop(c, 'version');
  if (version !== 1 && version !== 2) return fail('bad-version');
  const required = ['schema', 'version', 'state', 'name', 'summary'];
  const optional = version === 2
    ? ['homepage', 'superseded_by', 'descriptions', 'summary_lang']
    : ['homepage', 'superseded_by'];
  for (const key of Object.keys(c)) {
    if (required.indexOf(key) === -1 && optional.indexOf(key) === -1) {
      return fail('unknown-field');
    }
  }
  for (const key of required) {
    if (!(key in c)) return fail('bad-schema');
  }
  const state = prop(c, 'state');
  if (state !== 'active' && state !== 'withdrawn') return fail('bad-state');
  const name = prop(c, 'name');
  if (typeof name !== 'string' || name.length === 0 || charLength(name) > 120) {
    return fail('bad-schema');
  }
  const summary = prop(c, 'summary');
  if (typeof summary !== 'string' || charLength(summary) > 1000) return fail('bad-schema');

  /* §4.2 rules 7a-7c (v2 only; the key set above already refused these on a v1 record).
     A language map that is not a map of non-empty string to non-empty string is a *broken* record,
     not an empty one: dropping the bad entries would make it indistinguishable from a record that
     recorded nothing, so the whole event is invalid and says why. */
  let descriptions: Readonly<Record<string, string>> | null = null;
  if ('descriptions' in c) {
    const value = prop(c, 'descriptions');
    if (value === undefined || !isJsonRecord(value)) return fail('bad-schema');
    const keys = Object.keys(value);
    if (keys.length === 0) return fail('bad-schema'); // rule 7b: the empty map is not written.
    const map: Record<string, string> = {};
    for (const language of keys) {
      const text = prop(value, language);
      if (language === '') return fail('bad-schema');
      if (typeof text !== 'string' || text.length === 0) return fail('bad-schema');
      if (charLength(text) > 1000) return fail('bad-schema'); // the same ceiling `summary` has.
      /* rule 7c: the original already lives in `summary`. A second copy of the same bytes is a
         value that can drift out of agreement with the one it copies, and readers fall back to
         `summary` anyway, so it buys nothing and is refused rather than quietly kept. */
      if (text === summary) return fail('bad-schema');
      map[language] = text;
    }
    descriptions = map;
  }

  /* §4.2 rule 7e: optional, and it stays optional. The language of a text is a fact about that
     text; a signer who has not determined it writes nothing rather than guessing `en` (D7). */
  let summaryLang: string | null = null;
  if ('summary_lang' in c) {
    const value = prop(c, 'summary_lang');
    if (typeof value !== 'string' || value.length === 0) return fail('bad-schema');
    summaryLang = value;
  }

  let homepage: string | null = null;
  if ('homepage' in c) {
    const value = prop(c, 'homepage');
    if (typeof value !== 'string' || value.length > 2048) return fail('bad-schema');
    if (value.indexOf('https://') !== 0) return fail('bad-schema');
    homepage = value;
  }

  const coordinate = coordinateOf(POLICY.SOFTWARE_KIND, ev.pubkey, d);
  let supersededBy: string | null = null;
  if ('superseded_by' in c) {
    const value = prop(c, 'superseded_by');
    if (!isValidCoordinate(value)) return fail('bad-superseded-by');
    if (value === coordinate) return fail('bad-superseded-by'); // §11.1 self-loop
    supersededBy = typeof value === 'string' ? value : null;
  }

  /* §4.2 rule 4: the optional `state` tag is a scanning aid; disagreement with
     content invalidates the event. `state` is not single-letter, so it is not
     relay-indexable and can never be used as a filter. */
  for (const tag of tagsWithName(ev.tags, 'state')) {
    if (tag[1] !== state) return fail('tag-content-mismatch');
  }

  const future = futureCheck(ev.created_at, opts);
  if (future) return fail(future);

  return {
    ok: true,
    record: {
      coordinate,
      publisher: ev.pubkey,
      d,
      state,
      name,
      summary,
      descriptions,
      summaryLang,
      homepage,
      supersededBy,
      topics,
      eventId: typeof ev.id === 'string' ? ev.id : null,
      createdAt: ev.created_at
    }
  };
}

/* ---- kind 30267: NIP-51 App curation set (§6.1) ----
   Used exactly as NIP-51 specifies. No Nosmaps schema, no per-tool state, no
   reason field, no content validation. */

export function validateCurationSetEvent(
  event: unknown,
  opts?: ClockOptions
): Validation<'set', CurationSet> {
  const envelope = checkEnvelope(event, POLICY.CURATION_KIND, true);
  if (!envelope.ok) return envelope;
  const ev = envelope.event;

  const dTags = tagsWithName(ev.tags, 'd');
  const dValue = dTags[0]?.[1];
  if (dTags.length !== 1 || typeof dValue !== 'string') return fail('bad-d');
  const d = dValue;
  if (d.length === 0 || utf8ByteLength(d) > 192) return fail('bad-d');

  const future = futureCheck(ev.created_at, opts);
  if (future) return fail(future);

  /* Members are `a` tags that parse as 30078:<64-hex>:<d>. Other `a` values
     (a set may reference anything) are ignored, not errors. */
  const members: string[] = [];
  let ignored = 0;
  for (const tag of tagsWithName(ev.tags, 'a')) {
    const value = tag[1];
    if (typeof value !== 'string' || !isValidCoordinate(value)) {
      ignored += 1;
      continue;
    }
    if (members.indexOf(value) === -1) members.push(value);
  }

  return {
    ok: true,
    set: {
      curator: ev.pubkey,
      d,
      coordinate: coordinateOf(POLICY.CURATION_KIND, ev.pubkey, d),
      members,
      ignoredMembers: ignored,
      title: singleTagValue(ev.tags, 'title'),
      image: singleTagValue(ev.tags, 'image'),
      description: singleTagValue(ev.tags, 'description'),
      eventId: typeof ev.id === 'string' ? ev.id : null,
      createdAt: ev.created_at
    }
  };
}

/* ---- kind 3: NIP-02 follow list (§6.2) ---- */

export function validateFollowListEvent(
  event: unknown,
  opts?: ClockOptions
): Validation<'followList', FollowList> {
  const envelope = checkEnvelope(event, POLICY.FOLLOW_KIND, false);
  if (!envelope.ok) return envelope;
  const ev = envelope.event;

  const future = futureCheck(ev.created_at, opts);
  if (future) return fail(future);

  /* Deduplicated preserving first occurrence in the signed event's own tag
     order: NIP-02 appends fresh follows, so tag order is meaningful and, being
     part of the signed event, is arrival-order independent (I4). */
  const follows: string[] = [];
  let malformed = 0;
  let total = 0;
  for (const tag of tagsWithName(ev.tags, 'p')) {
    total += 1;
    const value = tag[1];
    if (!isLowercaseHex64(value)) {
      malformed += 1;
      continue;
    }
    if (follows.indexOf(value) === -1) follows.push(value);
  }

  return {
    ok: true,
    followList: {
      pubkey: ev.pubkey,
      follows,
      malformed,
      total,
      eventId: typeof ev.id === 'string' ? ev.id : null,
      createdAt: ev.created_at
    }
  };
}

/* ---- kind 5: NIP-09 deletion request (§7.3) ---- */

export function validateDeletionEvent(
  event: unknown,
  opts?: ClockOptions
): Validation<'deletion', DeletionRequest> {
  const envelope = checkEnvelope(event, POLICY.DELETION_KIND, false);
  if (!envelope.ok) return envelope;
  const ev = envelope.event;

  const future = futureCheck(ev.created_at, opts);
  if (future) return fail(future);

  const ids: string[] = [];
  for (const tag of tagsWithName(ev.tags, 'e')) {
    const value = tag[1];
    if (isLowercaseHex64(value) && ids.indexOf(value) === -1) ids.push(value);
  }

  /* NIP-09: relays honour a deletion request only for events with an identical
     pubkey. An `a` request naming somebody else's address is ignored, which is
     invariant I2 (publisher locality). */
  const addresses: string[] = [];
  for (const tag of tagsWithName(ev.tags, 'a')) {
    const value = tag[1];
    if (typeof value !== 'string') continue;
    const m = ADDRESS_RE.exec(value);
    if (!m) continue;
    if (m[2] !== ev.pubkey) continue;
    if (addresses.indexOf(value) === -1) addresses.push(value);
  }

  return {
    ok: true,
    deletion: {
      author: ev.pubkey,
      ids,
      addresses,
      eventId: typeof ev.id === 'string' ? ev.id : null,
      createdAt: ev.created_at
    }
  };
}
