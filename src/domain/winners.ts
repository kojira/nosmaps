/* NIP-01 addressable winner selection, deletion suppression, and quarantine.
   Pure domain layer: no DOM, no network, no window.

   §5.3: validation precedes selection. A newer version that fails schema
   validation is quarantined and the newest *valid* version wins, with the row
   flagged so the display is not silently a version behind. */

import {
  compareCodePoints, coordinateOf, getDtag, isLowercaseHex64,
  type ClockOptions, type NostrEvent
} from './event.ts';
import {POLICY} from './policy.ts';
import {validateDeletionEvent, validateSoftwareEvent, type SoftwareRecord} from './records.ts';

/** Union of every valid observed deletion request. Plain objects, so the result
    crosses a page.evaluate boundary unchanged. */
export interface DeletionIndex {
  /** event id -> the pubkeys that asked for it to go. */
  readonly ids: {readonly [eventId: string]: readonly string[]};
  /** coordinate -> the created_at up to which versions are covered. */
  readonly addresses: {readonly [coordinate: string]: number};
  readonly accepted: number;
  readonly rejected: number;
}

export interface Quarantined {
  readonly coordinate: string;
  readonly eventId: string | null;
  readonly pubkey: string | null;
  readonly createdAt: number | null;
  readonly reason: string;
}

export interface QuarantinedNewer {
  readonly eventId: string | null;
  readonly reason: string;
  readonly createdAt: number | null;
}

export interface Winner {
  readonly coordinate: string;
  readonly record: SoftwareRecord;
  readonly event: NostrEvent;
  readonly quarantinedNewer: QuarantinedNewer | null;
  readonly observedVersions: number;
}

export interface WinnerSelection {
  readonly winners: readonly Winner[];
  readonly quarantined: readonly Quarantined[];
}

/** When each event was received. Receipt time is not "now": advancing the clock
    alone must not rewrite receipt history (§12.3). */
export interface Receipts {
  readonly [eventId: string]: {readonly receivedAtSec?: number} | undefined;
}

export interface WinnerOptions extends ClockOptions {
  readonly deletions?: DeletionIndex | null;
  readonly receipts?: Receipts | null;
}

/** Read an unknown as an event without pretending it is well-formed. */
function asEvent(value: unknown): NostrEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as NostrEvent;
}

export function collectDeletions(events: readonly unknown[], opts?: ClockOptions): DeletionIndex {
  const ids: Record<string, string[]> = {};
  const addresses: Record<string, number> = {};
  let accepted = 0;
  let rejected = 0;
  const list = Array.isArray(events) ? events : [];
  for (const raw of list) {
    const e = asEvent(raw);
    if (!e || e.kind !== POLICY.DELETION_KIND) continue;
    const vr = validateDeletionEvent(e, opts);
    if (!vr.ok) {
      rejected += 1;
      continue;
    }
    accepted += 1;
    const del = vr.deletion;
    for (const key of del.ids) {
      const bucket = ids[key] ?? (ids[key] = []);
      if (bucket.indexOf(del.author) === -1) bucket.push(del.author);
    }
    for (const key of del.addresses) {
      // NIP-09: an `a` request covers versions up to the request's created_at.
      const current = addresses[key];
      if (current === undefined || current < del.createdAt) addresses[key] = del.createdAt;
    }
  }
  return {ids, addresses, accepted, rejected};
}

export function isSuppressed(
  event: NostrEvent,
  coordinate: string,
  deletions: DeletionIndex | null | undefined
): boolean {
  if (!deletions) return false;
  const byId = event.id === undefined ? undefined : deletions.ids[event.id];
  if (Array.isArray(byId) && byId.indexOf(event.pubkey) !== -1) return true;
  if (coordinate) {
    const covered = deletions.addresses[coordinate];
    if (covered !== undefined && event.created_at <= covered) return true;
  }
  return false;
}

/** The highest (created_at, id) event of the group, or null for an empty one. */
export function selectAddressableWinner(events: readonly unknown[]): NostrEvent | null {
  if (!Array.isArray(events) || events.length === 0) return null;
  let best: NostrEvent | null = null;
  for (const raw of events) {
    const e = asEvent(raw);
    if (!e) continue;
    if (!Number.isFinite(e.created_at) || typeof e.id !== 'string') continue;
    if (best === null) {
      best = e;
    } else if (e.created_at > best.created_at) {
      best = e;
    } else if (e.created_at === best.created_at && best.id !== undefined && e.id < best.id) {
      best = e; // tie -> lexicographically lowest event id
    }
  }
  return best;
}

interface Group {
  readonly coordinate: string;
  readonly valid: {event: NostrEvent; record: SoftwareRecord}[];
  readonly quarantined: Quarantined[];
}

export function selectSoftwareWinners(
  events: readonly unknown[],
  opts?: WinnerOptions
): WinnerSelection {
  const deletions = opts?.deletions ?? null;
  const receipts = opts?.receipts ?? null;
  const groups = new Map<string, Group>();

  const group = (coordinate: string): Group => {
    let g = groups.get(coordinate);
    if (!g) {
      g = {coordinate, valid: [], quarantined: []};
      groups.set(coordinate, g);
    }
    return g;
  };

  const list = Array.isArray(events) ? events : [];
  for (const raw of list) {
    const e = asEvent(raw);
    if (!e || e.kind !== POLICY.SOFTWARE_KIND) continue;
    const receipt = receipts && typeof e.id === 'string' ? receipts[e.id] : null;
    const received = receipt?.receivedAtSec;
    const perEvent: ClockOptions = {
      ...(opts?.nowSec === undefined ? {} : {nowSec: opts.nowSec}),
      ...(Number.isFinite(received)
        ? {receivedAtSec: received as number}
        : (opts?.receivedAtSec === undefined ? {} : {receivedAtSec: opts.receivedAtSec}))
    };
    const vr = validateSoftwareEvent(e, perEvent);
    /* Best-effort coordinate for a rejected event, so quarantine stays
       inspectable and attributable rather than silently discarded (§3). */
    const coordinate = vr.ok
      ? vr.record.coordinate
      : coordinateOf(
        POLICY.SOFTWARE_KIND,
        isLowercaseHex64(e.pubkey) ? e.pubkey : 'unknown',
        getDtag(e.tags)
      );
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
    g.valid.push({event: e, record: vr.record});
  }

  const winners: Winner[] = [];
  const quarantined: Quarantined[] = [];
  const coords = Array.from(groups.keys()).sort(compareCodePoints);
  for (const coord of coords) {
    const g = groups.get(coord);
    if (!g) continue;
    const winnerEvent = selectAddressableWinner(g.valid.map(v => v.event));
    const winner = winnerEvent ? g.valid.find(v => v.event === winnerEvent) : undefined;
    for (const q of g.quarantined) quarantined.push(q);
    if (!winner) continue;
    /* A quarantined version newer than the winner means the display is a
       version behind; that must be visible, not hidden (§5.3). */
    let newer: Quarantined | null = null;
    for (const q of g.quarantined) {
      if (q.createdAt === null || !Number.isFinite(q.createdAt)) continue;
      if (q.createdAt <= winner.record.createdAt) continue;
      if (!newer || newer.createdAt === null || q.createdAt > newer.createdAt) newer = q;
    }
    winners.push({
      coordinate: g.coordinate,
      record: winner.record,
      event: winner.event,
      quarantinedNewer: newer
        ? {eventId: newer.eventId, reason: newer.reason, createdAt: newer.createdAt}
        : null,
      observedVersions: g.valid.length
    });
  }
  return {winners, quarantined};
}
