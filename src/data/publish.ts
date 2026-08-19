/* The write path (docs/design-relay-native-write-path.md).
   Data layer: signs via NIP-07, sends to relays, reads back. No DOM.

   One rule governs everything below and is the reason the code is shaped this
   way: `published` is a claim about a read-back, not about an OK (§W4.3). An
   OK is evidence. Only `readback.state === 'returned'` may produce success. */

import {bytesEqual, canonicalize} from '../domain/json.ts';
import {compareCodePoints, isLowercaseHex64, type NostrEvent, type NostrTag} from '../domain/event.ts';
import {decodeNpub} from '../domain/npub.ts';
import {DISCOVERY_TOPIC, POLICY, SOFTWARE_D_PREFIX, SOFTWARE_SCHEMA, WRITE} from '../domain/policy.ts';
import {validateSoftwareEvent} from '../domain/records.ts';
import {selectSoftwareWinners} from '../domain/winners.ts';
import {createRelayContext, fetchRound, type RelayContext, type Round} from './relay.ts';

/** What the publish form supplies. Every field is optional because a half-filled
    form is a real state; the validator, not the type, decides publishability. */
export interface SoftwareDraftInput {
  readonly dLocal?: string;
  readonly name?: string;
  readonly summary?: string;
  readonly homepage?: string;
  readonly topics?: readonly string[];
  readonly state?: string;
  readonly pubkey?: string;
  readonly createdAt?: number;
}

/** NIP-07 signer. */
export interface Nip07Signer {
  getPublicKey: () => Promise<string> | string;
  signEvent: (event: NostrEvent) => Promise<NostrEvent> | NostrEvent;
}

export type RelayOutcome = 'accepted' | 'rejected' | 'timeout' | 'connection-failed' | 'not-attempted';

export interface RelayReport {
  readonly url: string;
  readonly outcome: RelayOutcome;
  readonly notice: string;
}

export type ReadbackState =
  | 'returned' | 'not-returned-yet' | 'query-failed'
  | 'readback-quarantined' | 'superseded-during-publish';

export interface Readback {
  readonly state: ReadbackState;
  readonly round: Round;
  readonly event: NostrEvent | null;
  readonly tIndex: 'returned' | 'not-returned';
  readonly reason?: string;
  readonly winnerId?: string | null;
}

export type PublishState =
  | 'published' | 'published-partial' | 'unconfirmed' | 'failed'
  | 'blocked' | 'invalid' | 'superseded-during-publish' | 'readback-quarantined';

export interface PublishResult {
  readonly state: PublishState;
  readonly reason: string;
  readonly eventId: string | null;
  readonly coordinate: string | null;
  readonly event: NostrEvent | null;
  readonly relays: readonly RelayReport[];
  readonly accepted?: number;
  readonly readback: {
    readonly state: ReadbackState;
    readonly tIndex: 'returned' | 'not-returned';
    readonly winnerId: string | null;
  } | null;
  readonly attempts: number;
  readonly asOf: number;
}

export interface PublishOptions {
  readonly relays?: readonly string[];
  readonly timeoutMs?: number;
  readonly publishTimeoutMs?: number;
  readonly readbackAttempts?: number;
  readonly readbackBackoffMs?: readonly number[];
  readonly signer?: Nip07Signer | null;
  readonly nowSec?: number;
  readonly draft?: SoftwareDraftInput;
  readonly expectPubkey?: string | null;
}

/** §W3: the unsigned draft. Every value is either the user's or a computed
    constant (§W3.5) — nothing here is invented, and nothing is left for a
    library to default (which is why `created_at` is set even though rx-nostr
    would happily fill it in). The draft is deliberately unsigned so that
    validateSoftwareEvent — the *same* function the read path calls (§W0.1) —
    is what decides whether it may be published at all. */
export function buildSoftwareDraft(input?: SoftwareDraftInput): NostrEvent {
  const nfc = (value: unknown): string => (typeof value === 'string' ? value.normalize('NFC') : '');
  const local = nfc(input?.dLocal).trim();
  const name = nfc(input?.name).trim();
  const summary = nfc(input?.summary);
  const homepage = nfc(input?.homepage).trim();
  // §W3.3: state is computed from the invoked action and is never a form control.
  const state = input?.state === 'withdrawn' ? 'withdrawn' : 'active';

  /* §5.1 rule 1 / §W3.6: the author normalises and lowercases; the validator
     only rejects. If the form skipped this the record would still be valid —
     it would just be indexed under bytes the publisher did not expect. */
  const topics: string[] = [];
  const supplied = Array.isArray(input?.topics) ? input.topics : [];
  for (const raw of supplied) {
    const topic = nfc(raw).trim().toLowerCase();
    if (!topic || topic === DISCOVERY_TOPIC) continue;
    if (topics.indexOf(topic) === -1) topics.push(topic);
  }
  topics.sort(compareCodePoints);

  /* §W3.2: exact order, so identical input produces an identical event id.
     No `state` tag, no `client` tag, no `alt` tag — see §W3.2 for why each of
     those would be app-authored metadata nobody asked us to sign. */
  const tags: NostrTag[] = [['d', SOFTWARE_D_PREFIX + local], ['t', DISCOVERY_TOPIC]];
  for (const topic of topics) tags.push(['t', topic]);

  /* §W3.3 fixed key order. A blank homepage omits the key entirely: `""` fails
     the https:// check, so serialising it would make the record unreadable. */
  const content: Record<string, string | number> = {
    schema: SOFTWARE_SCHEMA, version: 1, state, name, summary
  };
  if (homepage) content['homepage'] = homepage;

  return {
    kind: POLICY.SOFTWARE_KIND,
    pubkey: typeof input?.pubkey === 'string' ? input.pubkey : '',
    created_at: Number.isSafeInteger(input?.createdAt)
      ? (input?.createdAt as number)
      : Math.floor(Date.now() / 1000),
    tags,
    content: JSON.stringify(content)
  };
}

/** §W1.3: what the signer handed back has to be the thing we asked it to sign.
    rx-nostr's own nip07Signer appends tags on signing, so "the signer changed
    the event" is documented behaviour of a shipped implementation, not a
    hypothetical. Returns a reason slug, or null when the signature is usable. */
export function checkSignedEvent(
  draft: NostrEvent,
  signed: unknown,
  expectedPubkey: string
): string | null {
  if (!signed || typeof signed !== 'object') return 'signer-missing-fields';
  const ev = signed as Partial<NostrEvent>;
  if (!isLowercaseHex64(ev.id) || !isLowercaseHex64(ev.pubkey)) return 'signer-missing-fields';
  if (typeof ev.sig !== 'string' || !/^[0-9a-f]{128}$/.test(ev.sig)) return 'signer-missing-fields';
  if (ev.pubkey !== expectedPubkey) return 'signer-wrong-pubkey';
  const shape = (event: Partial<NostrEvent>): Record<string, unknown> => ({
    kind: event.kind, created_at: event.created_at, tags: event.tags, content: event.content
  });
  let ours: Uint8Array;
  let theirs: Uint8Array;
  try {
    ours = canonicalize(shape(draft));
    theirs = canonicalize(shape(ev));
  } catch {
    return 'signer-mutated-event';
  }
  if (!bytesEqual(ours, theirs)) return 'signer-mutated-event';
  return null;
}

function normalizeRelayUrl(url: unknown): string {
  return String(url ?? '').trim().toLowerCase().replace(/\/+$/, '');
}

export interface SendOutcome {
  outcome: RelayOutcome;
  notice: string;
}

/** §W4.1: publication over the read path's own relay context. The per-relay
    outcome model of §W4.2 is what makes partial success expressible; an
    aggregate that cannot say "1 of 2" can only lie in one direction.

    Exported because every write this app makes goes through it: the reaction
    path (data/reactions.ts) reuses it rather than growing a second, subtly
    different notion of what "the relay accepted it" means. */
export function sendEvent(
  ctx: RelayContext,
  signed: NostrEvent,
  relays: readonly string[],
  timeoutMs: number
): Promise<Record<string, SendOutcome>> {
  return new Promise(resolve => {
    /* §W4.2: every relay starts undetermined. `timeout` is NOT failure — the
       relay may hold the event and have lost the OK — so it never collapses
       into `rejected`, and it never counts as accepted either. */
    const outcomes: Record<string, SendOutcome> = {};
    for (const relay of relays) outcomes[relay] = {outcome: 'timeout', notice: ''};
    let settled = false;
    let sub: {unsubscribe?: () => void} | null = null;
    const timer = setTimeout(() => finish(), timeoutMs);

    function finish(): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (sub && typeof sub.unsubscribe === 'function') {
        try {
          sub.unsubscribe();
        } catch { /* noop */ }
      }
      resolve(outcomes);
    }

    function record(packet: unknown): void {
      if (!packet || typeof packet !== 'object') return;
      const p = packet as {from?: unknown; ok?: unknown; notice?: unknown};
      const from = typeof p.from === 'string' ? p.from : '';
      /* rx-nostr normalises relay URLs, so match on the trailing slash too
         rather than dropping a packet we cannot key. */
      let key: string | null = from in outcomes ? from : null;
      if (!key) {
        for (const relay of relays) {
          if (normalizeRelayUrl(relay) === normalizeRelayUrl(from)) {
            key = relay;
            break;
          }
        }
      }
      if (!key) return;
      const notice = typeof p.notice === 'string' ? p.notice : '';
      outcomes[key] = {outcome: p.ok === true ? 'accepted' : 'rejected', notice};
    }

    const rx = ctx.rxNostr;
    const send = rx?.send;
    if (!rx || typeof send !== 'function') {
      for (const relay of relays) outcomes[relay] = {outcome: 'connection-failed', notice: ''};
      finish();
      return;
    }

    try {
      const stream = send.call(rx, signed, {
        on: {relays},
        completeOn: 'all-ok',
        errorOnTimeout: false
      });
      sub = stream.subscribe({
        next: record,
        /* A socket that never opened is `connection-failed`, which is
           undetermined-leaning-negative and, crucially, not "the relay
           rejected the content". */
        error: () => {
          for (const relay of relays) {
            if (outcomes[relay]?.outcome === 'timeout') {
              outcomes[relay] = {outcome: 'connection-failed', notice: ''};
            }
          }
          finish();
        },
        complete: () => finish()
      });
    } catch {
      for (const relay of relays) outcomes[relay] = {outcome: 'connection-failed', notice: ''};
      finish();
    }
  });
}

/** §W5.1: two filters, both single-author. Filter 1 verifies the coordinate;
    filter 2 is the `#t` index probe §13.1 calls the most load-bearing probe in
    the design, and running it here means every publish contributes one real
    data point for free. §W5.2: a positive is weaker than it looks, so the
    result is recorded as "returned via #t", never as "#t is indexed". */
async function readBackOnce(
  ctx: RelayContext,
  signed: NostrEvent,
  d: string
): Promise<Readback> {
  const filters = [
    {kinds: [POLICY.SOFTWARE_KIND], authors: [signed.pubkey], '#d': [d], limit: 8},
    {kinds: [POLICY.SOFTWARE_KIND], authors: [signed.pubkey], '#t': [DISCOVERY_TOPIC], limit: 16}
  ];
  const round = await fetchRound(ctx, filters, 'publish-readback');
  const events = round.events.map(item => item.event);
  const mine = events.find(event => event && event.id === signed.id) ?? null;
  /* Every relay unreachable means nothing was learned. §W5.3 is explicit that
     `query-failed` must never be aggregated with `not-returned-yet`: one is
     ignorance, the other is a (weak, local, this-round-only) observation. */
  const statuses = Object.keys(round.coverage).map(url => round.coverage[url]?.status);
  const anyComplete = statuses.indexOf('eose') !== -1;
  if (!mine) {
    return {
      state: anyComplete ? 'not-returned-yet' : 'query-failed',
      round,
      event: null,
      tIndex: 'not-returned'
    };
  }
  /* §W5.4: the question is what readers will see, not whether our bytes
     arrived — so the returned set goes through the read path's own selector. */
  const check = validateSoftwareEvent(mine, {receivedAtSec: Math.floor(Date.now() / 1000)});
  if (!check.ok) {
    return {
      state: 'readback-quarantined',
      reason: check.reason,
      round,
      event: mine,
      tIndex: 'not-returned'
    };
  }
  const selection = selectSoftwareWinners(events, {});
  const winner = selection.winners.find(entry => entry.coordinate === check.record.coordinate);
  const winnerId = winner?.event.id ?? null;
  if (winnerId && winnerId !== signed.id) {
    return {state: 'superseded-during-publish', round, event: mine, winnerId, tIndex: 'returned'};
  }
  return {state: 'returned', round, event: mine, tIndex: 'returned'};
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** The whole chain, in one call. Returns a closed set of states and never a
    bare boolean: `unconfirmed` (acknowledged, not read back) is a different
    fact from `failed` (refused) and from `published`, and flattening them is
    exactly how a rejection becomes a success in a user's memory. */
export async function publishSoftwareRecord(opts?: PublishOptions): Promise<PublishResult> {
  const relays = (Array.isArray(opts?.relays) && opts.relays.length
    ? opts.relays : POLICY.DEFAULT_RELAYS).slice();
  const timeoutMs = Number.isFinite(opts?.timeoutMs)
    ? (opts?.timeoutMs as number) : POLICY.REQ_TIMEOUT_MS;
  const publishTimeoutMs = Number.isFinite(opts?.publishTimeoutMs)
    ? (opts?.publishTimeoutMs as number) : WRITE.PUBLISH_TIMEOUT_MS;
  const attempts = Number.isFinite(opts?.readbackAttempts)
    ? (opts?.readbackAttempts as number) : WRITE.READBACK_ATTEMPTS;
  const backoff: readonly number[] = Array.isArray(opts?.readbackBackoffMs)
    ? opts.readbackBackoffMs : WRITE.READBACK_BACKOFF_MS;
  const signer: Nip07Signer | null | undefined = opts?.signer
    ?? (typeof window !== 'undefined'
      ? (window as Window & {nostr?: Nip07Signer}).nostr
      : null);
  const nowSec = Number.isSafeInteger(opts?.nowSec)
    ? (opts?.nowSec as number) : Math.floor(Date.now() / 1000);

  const failWith = (state: PublishState, reason: string): PublishResult => ({
    state, reason, eventId: null, coordinate: null, event: null,
    relays: relays.map(url => ({url, outcome: 'not-attempted' as const, notice: ''})),
    readback: null, attempts: 0, asOf: Date.now()
  });

  if (!signer || typeof signer.signEvent !== 'function'
      || typeof signer.getPublicKey !== 'function') {
    return failWith('blocked', 'signer-absent');
  }

  /* §W1.4 / §W6.4 the account-switch hazard: an extension can change accounts
     between page load and publish, so the key is re-read immediately before
     signing and never taken from a cache. */
  let pubkey: string | null = null;
  try {
    pubkey = decodeNpub(await signer.getPublicKey());
  } catch {
    return failWith('blocked', 'signer-rejected');
  }
  if (!pubkey) return failWith('blocked', 'nip07-key-unparsable');
  if (opts?.expectPubkey && opts.expectPubkey !== pubkey) {
    return failWith('blocked', 'pubkey-mismatch');
  }

  const draft = buildSoftwareDraft({...opts?.draft, pubkey, createdAt: nowSec});
  /* §W0.1: the Publish control is enabled by, and only by, the read path's own
     validator. Re-checked here so no caller can route around the gate. */
  const preflight = validateSoftwareEvent(draft, {receivedAtSec: nowSec});
  if (!preflight.ok) return failWith('invalid', preflight.reason);
  const d = preflight.record.d;

  let signed: NostrEvent | null = null;
  try {
    signed = await signer.signEvent(draft);
  } catch {
    return failWith('blocked', 'signer-rejected');
  }
  const signerProblem = checkSignedEvent(draft, signed, pubkey);
  if (signerProblem) return failWith('blocked', signerProblem);
  const postflight = validateSoftwareEvent(signed, {receivedAtSec: nowSec});
  if (!postflight.ok) return failWith('blocked', 'signer-invalid-record');
  const coordinate = postflight.record.coordinate;
  const signedEvent: NostrEvent = signed;

  let ctx: RelayContext | null = null;
  try {
    ctx = await createRelayContext(relays, timeoutMs);
    if (!ctx.ok) {
      return {
        state: 'failed', reason: 'relay-unavailable', eventId: signedEvent.id ?? null,
        coordinate, event: signedEvent,
        relays: relays.map(url => ({url, outcome: 'connection-failed' as const, notice: ''})),
        readback: null, attempts: 0, asOf: Date.now()
      };
    }

    const outcomes = await sendEvent(ctx, signedEvent, relays, publishTimeoutMs);
    const perRelay: RelayReport[] = relays.map(url => ({
      url,
      outcome: outcomes[url]?.outcome ?? 'connection-failed',
      notice: outcomes[url]?.notice ?? ''
    }));
    const accepted = perRelay.filter(entry => entry.outcome === 'accepted').length;
    const undetermined = perRelay.filter(
      entry => entry.outcome === 'timeout' || entry.outcome === 'connection-failed'
    ).length;

    /* Nothing acknowledged and nothing outstanding: every relay said no. There
       is nothing to read back, so we do not spend 18 seconds pretending there
       might be. */
    if (accepted === 0 && undetermined === 0) {
      return {
        state: 'failed', reason: 'all-relays-rejected', eventId: signedEvent.id ?? null,
        coordinate, event: signedEvent,
        relays: perRelay, readback: null, attempts: 0, asOf: Date.now()
      };
    }

    /* §W5.5: a small bounded automatic wait, because relay propagation really
       is eventually consistent on a seconds timescale. After the budget the
       app stops claiming anything at all. */
    let readback: Readback | null = null;
    let used = 0;
    for (let i = 0; i < attempts; i += 1) {
      const wait = Number.isFinite(backoff[i]) ? (backoff[i] as number) : 0;
      if (wait > 0) await delay(wait);
      used = i + 1;
      readback = await readBackOnce(ctx, signedEvent, d);
      if (readback.state === 'returned'
          || readback.state === 'superseded-during-publish'
          || readback.state === 'readback-quarantined') break;
    }

    let state: PublishState;
    if (readback && readback.state === 'returned') {
      state = accepted === relays.length ? 'published' : 'published-partial';
    } else if (readback && readback.state === 'superseded-during-publish') {
      state = 'superseded-during-publish';
    } else if (readback && readback.state === 'readback-quarantined') {
      state = 'readback-quarantined';
    } else {
      state = 'unconfirmed';
    }

    return {
      state,
      reason: readback ? (readback.reason ?? readback.state) : 'no-readback',
      eventId: signedEvent.id ?? null,
      coordinate,
      event: signedEvent,
      relays: perRelay,
      accepted,
      readback: readback
        ? {state: readback.state, tIndex: readback.tIndex, winnerId: readback.winnerId ?? null}
        : null,
      attempts: used,
      asOf: Date.now()
    };
  } catch {
    return {
      state: 'failed', reason: 'publish-error', eventId: signedEvent.id ?? null,
      coordinate, event: signedEvent,
      relays: relays.map(url => ({url, outcome: 'connection-failed' as const, notice: ''})),
      readback: null, attempts: 0, asOf: Date.now()
    };
  } finally {
    const rx = ctx?.rxNostr;
    if (rx && typeof rx.dispose === 'function') {
      try {
        rx.dispose();
      } catch { /* noop */ }
    }
  }
}
