/* Reactions (NIP-25 kind 7) and their retraction (NIP-09 kind 5) for catalogue
   entries. Data layer: signs via NIP-07, sends over the read path's own relay
   context, and reads back. No DOM.

   Two rules shape this file, and both are the same rule the write path already
   obeys (docs/design-relay-native-write-path.md §W4.3, design-relay-native-data.md
   invariant I8):

   1. A displayed count is a count of *observed* events. It is never derived from
      an id, a serial number, or from "I just pressed the button". Pressing the
      button publishes an event; the number only moves when a relay serves that
      event back.
   2. Not having looked is not the same fact as having looked and found none.
      `state: 'unobserved'` and `counts[coordinate] === 0` are different, and the
      caller is given both so the UI can print Unknown for the first and 0 for
      the second.

   The target of a reaction is the *coordinate* (30078:<pubkey>:<d>), not one
   version of the record: NIP-25 addresses replaceable events with an `a` tag,
   and a like belongs to the entry rather than to whichever revision happened to
   be on screen. */

import {ADDRESS_RE, POLICY} from '../domain/policy.ts';
import {isLowercaseHex64, type NostrEvent, type NostrTag} from '../domain/event.ts';
import {decodeNpub} from '../domain/npub.ts';
import type {RelayFilter} from '../domain/chunking.ts';
import {createRelayContext, fetchRound, type RelayContext} from './relay.ts';
import {checkSignedEvent, sendEvent, type Nip07Signer, type RelayReport} from './publish.ts';

/** NIP-25 §"Reaction to a website" leaves content open; `+` is the like. `-` is
    a *dislike* and is deliberately never counted as one. */
export const REACTION_KIND = 7;
export const LIKE_CONTENT = '+';
const DISLIKE_CONTENT = '-';

/** What was observed about a set of coordinates in one look.

    `coordinates` is the set that was actually asked about. A coordinate absent
    from it has not been looked at, which is why `counts` alone is not enough to
    answer "0 or unknown?". */
export interface ReactionObservation {
  readonly state: 'observed' | 'unobserved';
  readonly reason: string;
  readonly coordinates: readonly string[];
  /** coordinate -> number of live (not retracted) like events observed. */
  readonly counts: Readonly<Record<string, number>>;
  /** coordinate -> the viewer's own live reaction id, when one was observed. */
  readonly mine: Readonly<Record<string, string>>;
  readonly asOf: number;
}

export type ReactionState = 'published' | 'unconfirmed' | 'failed' | 'blocked' | 'invalid';

export interface ReactionResult {
  readonly state: ReactionState;
  readonly reason: string;
  readonly eventId: string | null;
  readonly relays: readonly RelayReport[];
  readonly accepted: number;
  /** The look that decided `published` vs `unconfirmed`, so the caller can use
      the very same numbers it was judged by instead of asking again. */
  readonly observation: ReactionObservation | null;
}

export interface ReactionOptions {
  readonly relays?: readonly string[];
  readonly timeoutMs?: number;
  readonly publishTimeoutMs?: number;
  readonly signer?: Nip07Signer | null;
  readonly nowSec?: number;
  readonly expectPubkey?: string | null;
  /** The coordinates whose counts should be re-read afterwards. The pressed one
      is always included; passing the rest keeps the whole list in step without
      a second round. */
  readonly observeCoordinates?: readonly string[];
}

export interface ObserveOptions {
  readonly relays?: readonly string[];
  readonly timeoutMs?: number;
  readonly viewerPubkey?: string | null;
}

function emptyObservation(
  coordinates: readonly string[], reason: string
): ReactionObservation {
  return {
    state: 'unobserved', reason, coordinates: coordinates.slice(),
    counts: {}, mine: {}, asOf: Date.now()
  };
}

/** The author half of a coordinate, or null when the string is not one. Reacting
    needs it for the NIP-25 `p` tag, and a guessed pubkey would attribute the
    reaction to the wrong person. */
export function coordinateAuthor(coordinate: string): string | null {
  const match = ADDRESS_RE.exec(String(coordinate ?? ''));
  const author = match?.[2] ?? '';
  return isLowercaseHex64(author) ? author : null;
}

function coordinateKind(coordinate: string): string | null {
  const match = ADDRESS_RE.exec(String(coordinate ?? ''));
  return match?.[1] ?? null;
}

/** NIP-25 for an addressable target: `a` is the coordinate, `p` the author being
    reacted to, `k` the kind that was reacted to. Fixed order, so identical input
    produces an identical event id. Returns null when the coordinate is not one —
    a reaction with no target is not a thing this app will sign. */
export function buildReactionDraft(input: {
  readonly coordinate: string;
  readonly pubkey: string;
  readonly createdAt: number;
}): NostrEvent | null {
  const author = coordinateAuthor(input.coordinate);
  const kind = coordinateKind(input.coordinate);
  if (!author || !kind) return null;
  const tags: NostrTag[] = [['a', input.coordinate], ['p', author], ['k', kind]];
  return {
    kind: REACTION_KIND,
    pubkey: input.pubkey,
    created_at: input.createdAt,
    tags,
    content: LIKE_CONTENT
  };
}

/** NIP-09 for the retraction. Only `e` and `k`: an `a` tag here would name the
    catalogue record itself as the thing being deleted, which is a claim about
    someone else's event and not what the viewer asked for. */
export function buildReactionDeletionDraft(input: {
  readonly reactionId: string;
  readonly pubkey: string;
  readonly createdAt: number;
}): NostrEvent | null {
  if (!isLowercaseHex64(input.reactionId)) return null;
  return {
    kind: POLICY.DELETION_KIND,
    pubkey: input.pubkey,
    created_at: input.createdAt,
    tags: [['e', input.reactionId], ['k', String(REACTION_KIND)]],
    content: ''
  };
}

function tagValues(event: NostrEvent, name: string): string[] {
  const out: string[] = [];
  for (const tag of event.tags) {
    if (Array.isArray(tag) && tag[0] === name && typeof tag[1] === 'string') out.push(tag[1]);
  }
  return out;
}

function anyRelayCompleted(coverage: Record<string, {readonly status: string}>): boolean {
  return Object.keys(coverage).some(url => coverage[url]?.status === 'eose');
}

/** One look at the reactions on a set of coordinates.

    Two rounds, because a retraction names the reaction it retracts and that id
    is not known until the first round has answered. Skipping the second round
    would over-count by exactly the reactions their authors took back, which is
    the one direction a like counter must never err in. */
async function observeWithContext(
  ctx: RelayContext,
  coordinates: readonly string[],
  viewerPubkey: string
): Promise<ReactionObservation> {
  const wanted = [...new Set(coordinates.map(value => String(value ?? '').trim()).filter(Boolean))];
  if (!wanted.length) return emptyObservation(wanted, 'no-coordinates');

  const reactionRound = await fetchRound(
    ctx, [{kinds: [REACTION_KIND], '#a': wanted}], 'reaction-count'
  );
  if (!anyRelayCompleted(reactionRound.coverage)) {
    return emptyObservation(wanted, reactionRound.reason ?? 'no-relay-completed');
  }

  const reactions: NostrEvent[] = [];
  const seen = new Set<string>();
  for (const packet of reactionRound.events) {
    const event = packet.event;
    if (!event || event.kind !== REACTION_KIND) continue;
    if (!isLowercaseHex64(event.id)) continue;
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    reactions.push(event);
  }

  const retracted = new Set<string>();
  if (reactions.length) {
    const ids = reactions.map(event => event.id).filter(isLowercaseHex64);
    const filters: RelayFilter[] = [{kinds: [POLICY.DELETION_KIND], '#e': ids}];
    const deletionRound = await fetchRound(ctx, filters, 'reaction-retraction');
    for (const packet of deletionRound.events) {
      const event = packet.event;
      if (!event || event.kind !== POLICY.DELETION_KIND) continue;
      /* NIP-09: a deletion only speaks for its own author's events. A kind 5 that
         names someone else's reaction is not evidence of anything. */
      for (const target of tagValues(event, 'e')) {
        const reaction = reactions.find(item => item.id === target);
        if (reaction && reaction.pubkey === event.pubkey) retracted.add(target);
      }
    }
  }

  const counts: Record<string, number> = {};
  const mine: Record<string, string> = {};
  for (const coordinate of wanted) counts[coordinate] = 0;
  for (const event of reactions) {
    if (typeof event.id !== 'string' || retracted.has(event.id)) continue;
    // A dislike is a reaction, not a like. It is dropped rather than counted.
    if (event.content === DISLIKE_CONTENT) continue;
    for (const coordinate of tagValues(event, 'a')) {
      if (!(coordinate in counts)) continue;
      counts[coordinate] = (counts[coordinate] ?? 0) + 1;
      if (viewerPubkey && event.pubkey === viewerPubkey) mine[coordinate] = event.id;
    }
  }

  return {
    state: 'observed', reason: 'eose', coordinates: wanted,
    counts, mine, asOf: Date.now()
  };
}

/** Look at the reactions on a set of coordinates over their own relay context. */
export async function observeReactions(
  coordinates: readonly string[], opts?: ObserveOptions
): Promise<ReactionObservation> {
  const relays = (Array.isArray(opts?.relays) && opts.relays.length
    ? opts.relays : POLICY.DEFAULT_RELAYS).slice();
  const timeoutMs = Number.isFinite(opts?.timeoutMs)
    ? (opts?.timeoutMs as number) : POLICY.REQ_TIMEOUT_MS;
  const viewerPubkey = typeof opts?.viewerPubkey === 'string' ? opts.viewerPubkey : '';
  let ctx: RelayContext | null = null;
  try {
    ctx = await createRelayContext(relays, timeoutMs);
    if (!ctx.ok) return emptyObservation(coordinates, 'relay-unavailable');
    return await observeWithContext(ctx, coordinates, viewerPubkey);
  } catch {
    return emptyObservation(coordinates, 'observe-error');
  } finally {
    const rx = ctx?.rxNostr;
    if (rx && typeof rx.dispose === 'function') {
      try {
        rx.dispose();
      } catch { /* noop */ }
    }
  }
}

/** Sign one event, send it, then look. `published` is only ever claimed from the
    look — the same rule publishSoftwareRecord obeys (§W4.3). */
async function signSendObserve(
  draft: NostrEvent | null,
  invalidReason: string,
  opts: ReactionOptions | undefined,
  confirm: (observation: ReactionObservation, eventId: string) => boolean
): Promise<ReactionResult> {
  const relays = (Array.isArray(opts?.relays) && opts.relays.length
    ? opts.relays : POLICY.DEFAULT_RELAYS).slice();
  const timeoutMs = Number.isFinite(opts?.timeoutMs)
    ? (opts?.timeoutMs as number) : POLICY.REQ_TIMEOUT_MS;
  const publishTimeoutMs = Number.isFinite(opts?.publishTimeoutMs)
    ? (opts?.publishTimeoutMs as number) : POLICY.REQ_TIMEOUT_MS;
  const observeCoordinates = Array.isArray(opts?.observeCoordinates) ? opts.observeCoordinates : [];

  const failWith = (state: ReactionState, reason: string): ReactionResult => ({
    state, reason, eventId: null,
    relays: relays.map(url => ({url, outcome: 'not-attempted' as const, notice: ''})),
    accepted: 0, observation: null
  });

  if (!draft) return failWith('invalid', invalidReason);
  const signer: Nip07Signer | null | undefined = opts?.signer
    ?? (typeof window !== 'undefined'
      ? (window as Window & {nostr?: Nip07Signer}).nostr
      : null);
  if (!signer || typeof signer.signEvent !== 'function'
      || typeof signer.getPublicKey !== 'function') {
    return failWith('blocked', 'signer-absent');
  }

  /* §W1.4 / §W6.4: the extension can change accounts between page load and the
     press, so the key is re-read immediately before signing. */
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

  const toSign: NostrEvent = {...draft, pubkey};
  let signed: NostrEvent | null = null;
  try {
    signed = await signer.signEvent(toSign);
  } catch {
    return failWith('blocked', 'signer-rejected');
  }
  const problem = checkSignedEvent(toSign, signed, pubkey);
  if (problem) return failWith('blocked', problem);
  const signedEvent: NostrEvent = signed;
  const eventId = typeof signedEvent.id === 'string' ? signedEvent.id : null;

  let ctx: RelayContext | null = null;
  try {
    ctx = await createRelayContext(relays, timeoutMs);
    if (!ctx.ok) {
      return {
        state: 'failed', reason: 'relay-unavailable', eventId,
        relays: relays.map(url => ({url, outcome: 'connection-failed' as const, notice: ''})),
        accepted: 0, observation: null
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
    if (accepted === 0 && undetermined === 0) {
      return {
        state: 'failed', reason: 'all-relays-rejected', eventId,
        relays: perRelay, accepted: 0, observation: null
      };
    }

    const coordinates = [...new Set(observeCoordinates)];
    const observation = await observeWithContext(ctx, coordinates, pubkey);
    const confirmed = eventId !== null
      && observation.state === 'observed'
      && confirm(observation, eventId);
    return {
      state: confirmed ? 'published' : 'unconfirmed',
      reason: confirmed ? 'observed' : observation.reason,
      eventId, relays: perRelay, accepted, observation
    };
  } catch {
    return {
      state: 'failed', reason: 'reaction-error', eventId,
      relays: relays.map(url => ({url, outcome: 'connection-failed' as const, notice: ''})),
      accepted: 0, observation: null
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

/** Like one coordinate. Confirmed when the reaction we just signed is among the
    ones the relays serve back for that coordinate. */
export function publishReaction(
  coordinate: string, opts?: ReactionOptions
): Promise<ReactionResult> {
  const nowSec = Number.isSafeInteger(opts?.nowSec)
    ? (opts?.nowSec as number) : Math.floor(Date.now() / 1000);
  const draft = buildReactionDraft({coordinate, pubkey: '', createdAt: nowSec});
  const options: ReactionOptions = {
    ...opts,
    observeCoordinates: [coordinate, ...(opts?.observeCoordinates ?? [])]
  };
  return signSendObserve(
    draft, 'not-a-coordinate', options,
    (observation, eventId) => observation.mine[coordinate] === eventId
  );
}

/** Take a like back. Confirmed when the reaction is no longer among the live
    ones — an OK on the kind 5 is not the same fact and is not enough. */
export function retractReaction(
  coordinate: string, reactionId: string, opts?: ReactionOptions
): Promise<ReactionResult> {
  const nowSec = Number.isSafeInteger(opts?.nowSec)
    ? (opts?.nowSec as number) : Math.floor(Date.now() / 1000);
  const draft = buildReactionDeletionDraft({reactionId, pubkey: '', createdAt: nowSec});
  const options: ReactionOptions = {
    ...opts,
    observeCoordinates: [coordinate, ...(opts?.observeCoordinates ?? [])]
  };
  return signSendObserve(
    draft, 'not-an-event-id', options,
    observation => observation.mine[coordinate] === undefined
  );
}
