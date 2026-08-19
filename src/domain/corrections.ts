/* issue #18 phase 2: the write side of "several signers, one identifier".

   Phase 1 (src/domain/stacks.ts) said what it means for two records to be about
   the same identifier. This module says how a second signer produces one, and it
   is deliberately small: NIP-01 already does the hard part. Replacement is keyed
   on `kind:pubkey:d`, so signing the same `d` with a different key does not
   overwrite anybody — it creates a second coordinate. There is nothing to
   negotiate and no permission to ask for.

   Two things live here.

   1. `normaliseSourceUri` — D2 / D6 / M1.6.4 N1-N6. A `d` is
      `nosmaps:<normalised canonical source URI>`. The rules are as restrictive as
      the design says and no more: the scheme is kept (N1) because `htree://` is
      real data, only the scheme name is lowercased (N2), trailing slashes (N3)
      and a trailing `.git` (N4) go, and case in the authority (N5) and the path
      (N6) is left alone. Nothing else is touched — no `www.` stripping, no
      `http`->`https`, no host special cases. Inventing a value we did not
      observe is worse than refusing.

   2. `buildCorrectionDraft` — the unsigned event a correction is. It takes the
      `d` it is given and copies it byte for byte. It does NOT normalise on the
      way in: M1.3 says a signed `d` is never rewritten on read, and the same
      holds here, or a correction aimed at an existing record would quietly miss
      it. Normalisation belongs to the moment a *new* identifier is minted, which
      is `normaliseSourceUri`, called by the caller, before this.

   D1 again: nothing here ranks the new record above or below the one already
   there. There is no "supersedes", no "corrects" pointer, no collector key.
   Whoever signed is who says so.

   Pure domain layer: no DOM, no network, no key material, no clock of its own —
   `createdAt` is passed in, because a module that reads the wall clock cannot be
   tested against a fixture. */

import {D_ASCII_RE, D_MAX_BYTES, SOFTWARE_D_PREFIX, SOFTWARE_SCHEMA} from './policy.ts';
import {utf8ByteLength} from './json.ts';

/** The topic tag that makes a record discoverable. A correction without it is
    signed, valid and invisible (M3.1-5), so it is not optional here. */
export const DISCOVERY_TOPIC = 'nosmaps';

/** Software records are parameterised replaceable events. */
export const SOFTWARE_KIND = 30078;

/** `<scheme>://<rest>`: scheme starts with an ASCII letter and continues with
    letters, digits, `+`, `-`, `.`; `rest` is non-empty (M1.6.4). No whitelist of
    schemes — we cannot enumerate how a canonical source will be published, and a
    whitelist would put the identifier back in our pocket (M1.6.1). */
const SCHEME_RE = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/(.+)$/;

export interface NormalisedUri {
  /** The normalised URI, scheme included. Empty when `problem` is set. */
  readonly uri: string;
  /** `SOFTWARE_D_PREFIX + uri`, the `d` this URI becomes. Empty when rejected. */
  readonly d: string;
  /** Why the input was refused, or null when it was accepted. Never a repaired
      value: a URI we cannot read is reported, not guessed at. */
  readonly problem: string | null;
}

function reject(problem: string): NormalisedUri {
  return {uri: '', d: '', problem};
}

/** Applies N1-N6 to a canonical source URI and returns the `d` it becomes.

    Schemeless input is refused rather than repaired (M1.6.4): prefixing
    `https://` would assert a scheme we never observed. The caller is expected to
    show the returned `d` to the user before signing — a silent rewrite is why a
    record fails to meet another one, and the reason has to be visible. */
export function normaliseSourceUri(input: string): NormalisedUri {
  if (typeof input !== 'string') return reject('not a string');
  const trimmed = input.trim();
  if (trimmed === '') return reject('empty');

  const match = SCHEME_RE.exec(trimmed);
  if (!match) return reject('not <scheme>://<rest>; a schemeless URI is refused, not completed');

  const scheme = (match[1] ?? '').toLowerCase(); // N2: scheme name only.
  let rest = match[2] ?? ''; // N5 / N6: authority and path case are left alone.

  while (rest.endsWith('/')) rest = rest.slice(0, -1); // N3: every trailing slash.
  if (rest.endsWith('.git')) rest = rest.slice(0, -4); // N4.
  if (rest === '') return reject('nothing left after the scheme');

  const uri = `${scheme}://${rest}`;
  const d = `${SOFTWARE_D_PREFIX}${uri}`;
  if (!D_ASCII_RE.test(d)) return reject('d holds characters outside printable ASCII');
  if (utf8ByteLength(d) > D_MAX_BYTES) return reject(`d is ${utf8ByteLength(d)} bytes, over the ${D_MAX_BYTES} limit`);
  return {uri, d, problem: null};
}

/** The fields a correction's content carries. Same v1 software profile the read
    path validates — a correction is an ordinary record, not a new kind of thing. */
export interface CorrectionContent {
  readonly name: string;
  readonly summary: string;
  readonly homepage: string;
  readonly state?: string;
}

export interface UnsignedEvent {
  readonly kind: number;
  readonly created_at: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
}

export interface CorrectionDraft {
  readonly event: UnsignedEvent | null;
  readonly problem: string | null;
}

/** Builds the unsigned kind:30078 event that states `content` under `d`.

    `d` is used verbatim. It is validated (prefix, ASCII, length) but never
    rewritten: a correction has to land on the identifier it was aimed at, and
    the only thing that puts two records together is byte equality of `d` (M1.3).
    An invalid `d` is refused outright rather than normalised into a different
    one — signing a `d` the caller did not ask for is how a correction silently
    becomes a new record nobody sees. */
export function buildCorrectionDraft(
  d: string,
  content: CorrectionContent,
  createdAt: number,
  extraTopics: readonly string[] = []
): CorrectionDraft {
  if (typeof d !== 'string' || d.indexOf(SOFTWARE_D_PREFIX) !== 0) {
    return {event: null, problem: `d is not inside the ${SOFTWARE_D_PREFIX} namespace`};
  }
  if (d.length === SOFTWARE_D_PREFIX.length) return {event: null, problem: 'd is the bare prefix and names nothing'};
  if (!D_ASCII_RE.test(d)) return {event: null, problem: 'd holds characters outside printable ASCII'};
  if (utf8ByteLength(d) > D_MAX_BYTES) {
    return {event: null, problem: `d is ${utf8ByteLength(d)} bytes, over the ${D_MAX_BYTES} limit`};
  }
  if (!Number.isSafeInteger(createdAt) || createdAt <= 0) return {event: null, problem: 'created_at is not a positive integer'};
  if (typeof content.name !== 'string' || content.name === '') return {event: null, problem: 'name is empty'};
  if (typeof content.summary !== 'string') return {event: null, problem: 'summary is not a string'};
  if (typeof content.homepage !== 'string' || content.homepage === '') return {event: null, problem: 'homepage is empty'};

  const state = content.state === undefined ? 'active' : content.state;
  if (typeof state !== 'string' || state === '') return {event: null, problem: 'state is empty'};

  /* The discovery topic goes first and duplicates are dropped, so a caller
     passing 'nosmaps' again cannot produce two identical `t` tags. */
  const topics: string[] = [DISCOVERY_TOPIC];
  for (const topic of extraTopics) {
    if (typeof topic === 'string' && topic !== '' && !topics.includes(topic)) topics.push(topic);
  }

  const tags: string[][] = [['d', d], ...topics.map(topic => ['t', topic]), ['state', state], ['v', '1']];
  const body = {
    schema: SOFTWARE_SCHEMA,
    version: 1,
    state,
    name: content.name,
    summary: content.summary,
    homepage: content.homepage
  };
  return {
    event: {kind: SOFTWARE_KIND, created_at: createdAt, tags, content: JSON.stringify(body)},
    problem: null
  };
}

/** The NIP-09 request that retracts events by id. Used for the throwaway events
    a verification run publishes, and for nothing else: a deletion aimed at
    somebody else's id is a request a relay is free to ignore, and this project
    never asks for one. `ids` must all be 64 lowercase hex. */
export const DELETION_KIND = 5;

const HEX64 = /^[0-9a-f]{64}$/;

export function buildDeletionDraft(
  ids: readonly string[],
  createdAt: number,
  reason = ''
): CorrectionDraft {
  if (!Array.isArray(ids) || ids.length === 0) return {event: null, problem: 'no ids to retract'};
  for (const id of ids) {
    if (typeof id !== 'string' || !HEX64.test(id)) return {event: null, problem: `not a 64-hex id: ${String(id)}`};
  }
  if (!Number.isSafeInteger(createdAt) || createdAt <= 0) return {event: null, problem: 'created_at is not a positive integer'};
  /* `k` states the kind being retracted (NIP-09), so a relay does not have to
     have the original in hand to apply the request. */
  const tags: string[][] = [...ids.map(id => ['e', id]), ['k', String(SOFTWARE_KIND)]];
  return {
    event: {kind: DELETION_KIND, created_at: createdAt, tags, content: typeof reason === 'string' ? reason : ''},
    problem: null
  };
}
