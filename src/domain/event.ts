/* What a Nostr event IS, and the tag/coordinate helpers every layer reads it with.
   Pure domain layer: no DOM, no network, no window. */

import {utf8ByteLength} from './json.ts';
import {COORD_RE, D_MAX_BYTES, POLICY} from './policy.ts';

/** A tag is a list of strings; `t[0]` is the tag name. Relays hand us arbitrary
    JSON, so the readonly array is the widest honest shape. */
export type NostrTag = readonly string[];

/** A signed Nostr event. `id` and `sig` are optional because the write path builds
    an unsigned draft and validates it with the SAME function the read path uses
    (§W0.1) — the draft is genuinely missing them, so they are modelled missing. */
export interface NostrEvent {
  readonly kind: number;
  readonly pubkey: string;
  readonly created_at: number;
  readonly content: string;
  readonly tags: readonly NostrTag[];
  readonly id?: string;
  readonly sig?: string;
}

/** The envelope the validators actually read. `content` is optional because the
    kind 3 and kind 5 validators deliberately do NOT require it to be a string —
    they read tags only, and rejecting on content would reject valid NIP-02/NIP-09
    events. Modelling it optional is what keeps that difference honest. */
export interface EventEnvelope {
  readonly kind: number;
  readonly pubkey: string;
  readonly created_at: number;
  readonly tags: readonly NostrTag[];
  readonly content?: string;
  readonly id?: string;
  readonly sig?: string;
}

/** Validation result: either the named payload, or a stated reason. Never a bare
    boolean — "why it was rejected" is the part the diagnostics need. */
export type Validation<Key extends string, Payload> =
  | ({readonly ok: true} & {readonly [K in Key]: Payload})
  | {readonly ok: false; readonly reason: string};

export function fail(reason: string): {readonly ok: false; readonly reason: string} {
  return {ok: false, reason};
}

/** 64-hex identifiers (pubkey, event id) share the sha256 shape. */
export function isLowercaseHex64(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
}

export function tagsWithName(tags: readonly NostrTag[], name: string): readonly NostrTag[] {
  const out: NostrTag[] = [];
  for (const t of tags) {
    if (Array.isArray(t) && t[0] === name) out.push(t);
  }
  return out;
}

/** The value of a tag that must appear exactly once, or null. "Exactly once" is
    the rule, so two occurrences are a miss rather than a first-wins pick. */
export function singleTagValue(tags: readonly NostrTag[], name: string): string | null {
  const found = tagsWithName(tags, name);
  if (found.length !== 1) return null;
  const value = found[0]?.[1];
  return typeof value === 'string' ? value : null;
}

export function getDtag(tags: unknown): string {
  if (!Array.isArray(tags)) return '';
  for (const t of tags as readonly NostrTag[]) {
    if (Array.isArray(t) && t[0] === 'd' && typeof t[1] === 'string') return t[1];
  }
  return '';
}

/** Compare two strings by Unicode code point. Used for every deterministic
    ordering in the data layer (I4): coordinates, `d` values, pubkeys. */
export function compareCodePoints(a: string, b: string): number {
  const ai = Array.from(a);
  const bi = Array.from(b);
  const len = Math.min(ai.length, bi.length);
  for (let i = 0; i < len; i += 1) {
    const ca = ai[i]?.codePointAt(0);
    const cb = bi[i]?.codePointAt(0);
    if (ca === undefined || cb === undefined) break;
    if (ca !== cb) return ca < cb ? -1 : 1;
  }
  if (ai.length === bi.length) return 0;
  return ai.length < bi.length ? -1 : 1;
}

export function isValidCoordinate(coord: unknown): boolean {
  if (typeof coord !== 'string') return false;
  const m = COORD_RE.exec(coord);
  if (!m) return false;
  const local = m[2];
  if (local === undefined) return false;
  // The regex bounds the d part by UTF-16 units; the normative limit is UTF-8 bytes.
  if (utf8ByteLength(local) > D_MAX_BYTES) return false;
  return true;
}

export function coordinateOf(kind: number | string, pubkey: string, d: string): string {
  return String(kind) + ':' + pubkey + ':' + d;
}

export function charLength(str: string): number {
  return Array.from(str).length;
}

/** Options shared by the validators: the receipt clock (§12.3). */
export interface ClockOptions {
  readonly receivedAtSec?: number;
  readonly nowSec?: number;
}

/** §12.3 future-timestamp eligibility. `receivedAtSec` is the receipt time, not
    "now": advancing the clock alone must not rewrite receipt history. */
export function futureCheck(createdAt: number, opts?: ClockOptions): string | null {
  const received = opts?.receivedAtSec;
  const now = opts?.nowSec;
  const receivedAt = Number.isFinite(received)
    ? (received as number)
    : (Number.isFinite(now) ? (now as number) : Math.floor(Date.now() / 1000));
  if (createdAt > receivedAt + POLICY.MAX_FUTURE_HORIZON_SEC) return 'future-horizon';
  if (createdAt > receivedAt + POLICY.MAX_FUTURE_SKEW_SEC) return 'future-timestamp';
  return null;
}
