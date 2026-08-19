/* §6.2 the viewer's social graph, §6.1/§6.4 curation membership, §6.4 ordering.
   Pure domain layer: no DOM, no network, no window.

   Curation is a presentation-layer signal only: it contributes a recommendation
   count and the ordering key, and it can never add or remove a row (D4/I7). */

import {
  compareCodePoints, coordinateOf, isLowercaseHex64, type ClockOptions, type NostrEvent
} from './event.ts';
import {POLICY} from './policy.ts';
import {validateCurationSetEvent, validateFollowListEvent, type CurationSet} from './records.ts';
import {isSuppressed, selectAddressableWinner, type DeletionIndex} from './winners.ts';

/** `none` is not "you follow nobody" — it is "no viewer pubkey is known" (§6.2). */
export type GraphStateName = 'none' | 'self-only' | 'tier1';
export type GraphCoverage = 'unknown' | 'incomplete' | 'fresh' | 'stale' | 'truncated';

export interface GraphState {
  readonly viewerPubkey: string | null;
  readonly state: GraphStateName;
  readonly pubkeys: readonly string[];
  readonly coverage: GraphCoverage;
  readonly followsUsed: number;
  readonly followsTotal: number;
  readonly malformedPTags: number;
  readonly truncated: boolean;
  readonly followListId: string | null;
  readonly followListCreatedAt: number | null;
}

export interface GraphOptions extends ClockOptions {
  readonly viewerPubkey?: string | null;
  readonly events?: readonly unknown[];
  readonly deletions?: DeletionIndex | null;
}

function asEvent(value: unknown): NostrEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as NostrEvent;
}

export function deriveGraph(opts?: GraphOptions): GraphState {
  const viewerPubkey = isLowercaseHex64(opts?.viewerPubkey) ? opts.viewerPubkey : null;
  const base: GraphState = {
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

  const candidates: NostrEvent[] = [];
  const list = Array.isArray(opts?.events) ? opts.events : [];
  for (const raw of list) {
    const e = asEvent(raw);
    if (!e || e.kind !== POLICY.FOLLOW_KIND || e.pubkey !== viewerPubkey) continue;
    const vr = validateFollowListEvent(e, opts);
    if (!vr.ok) continue;
    // kind 3 is replaceable at (3, pubkey); the coordinate has no `d`.
    if (isSuppressed(e, coordinateOf(POLICY.FOLLOW_KIND, e.pubkey, ''), opts?.deletions)) continue;
    candidates.push(e);
  }
  /* Union across relays first, then select: one relay's limit:1 answer is never
     accepted as the global winner (§6.2 step 2). */
  const winnerEvent = selectAddressableWinner(candidates);
  if (!winnerEvent) {
    // graph: self-only — reported as such, never as "you follow nobody" (§6.2).
    return {
      ...base,
      state: 'self-only',
      pubkeys: [viewerPubkey],
      coverage: 'incomplete',
      followsUsed: 0,
      followsTotal: 0
    };
  }
  const revalidated = validateFollowListEvent(winnerEvent, opts);
  /* The winner was validated above, so this cannot fail; if it ever did, the
     honest answer is self-only rather than a fabricated follow list. */
  if (!revalidated.ok) {
    return {
      ...base,
      state: 'self-only',
      pubkeys: [viewerPubkey],
      coverage: 'incomplete'
    };
  }
  const parsed = revalidated.followList;
  const pubkeys = [viewerPubkey];
  for (const key of parsed.follows) {
    if (pubkeys.indexOf(key) === -1) pubkeys.push(key);
  }
  const truncated = pubkeys.length > POLICY.GRAPH_MAX_FOLLOWS;
  const used = truncated ? pubkeys.slice(0, POLICY.GRAPH_MAX_FOLLOWS) : pubkeys;
  const nowSec = Number.isFinite(opts?.nowSec)
    ? (opts?.nowSec as number)
    : Math.floor(Date.now() / 1000);
  const staleAfter = POLICY.GRAPH_STALE_AFTER_MS / 1000;
  let coverage: GraphCoverage = 'fresh';
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

/* ---- §6.1/§6.4 curation membership and recommendation counts ---- */

export interface Curator {
  readonly curator: string;
  readonly setsObserved: number;
  readonly setsUsed: number;
  readonly truncated: boolean;
  readonly setIds: readonly string[];
  readonly memberCount: number;
  readonly members: readonly string[];
}

export interface CurationMembership {
  readonly counted: readonly string[];
  readonly curators: readonly Curator[];
  readonly recommenders: {readonly [coordinate: string]: readonly string[]};
  /** Every coordinate any counted curator recommends, deterministically ordered. */
  readonly learned: readonly string[];
}

export interface MembershipOptions extends ClockOptions {
  readonly pubkeys?: readonly string[];
  readonly events?: readonly unknown[];
  readonly deletions?: DeletionIndex | null;
}

export function curationMembership(opts?: MembershipOptions): CurationMembership {
  const counted: string[] = [];
  const source = Array.isArray(opts?.pubkeys) ? opts.pubkeys : [];
  for (const key of source) {
    if (isLowercaseHex64(key) && counted.indexOf(key) === -1) counted.push(key);
  }
  const countedSet = new Set(counted);

  // Group into (30267, curator, d) coordinates and select each winner.
  interface Group {readonly curator: string; readonly d: string; readonly events: NostrEvent[];}
  const groups = new Map<string, Group>();
  const list = Array.isArray(opts?.events) ? opts.events : [];
  for (const raw of list) {
    const e = asEvent(raw);
    if (!e || e.kind !== POLICY.CURATION_KIND) continue;
    if (!countedSet.has(e.pubkey)) continue;
    const vr = validateCurationSetEvent(e, opts);
    if (!vr.ok) continue;
    if (isSuppressed(e, vr.set.coordinate, opts?.deletions)) continue;
    let g = groups.get(vr.set.coordinate);
    if (!g) {
      g = {curator: e.pubkey, d: vr.set.d, events: []};
      groups.set(vr.set.coordinate, g);
    }
    g.events.push(e);
  }

  interface CuratorEntry {readonly curator: string; readonly sets: CurationSet[];}
  const byCurator = new Map<string, CuratorEntry>();
  groups.forEach(g => {
    const winnerEvent = selectAddressableWinner(g.events);
    if (!winnerEvent) return;
    const vr = validateCurationSetEvent(winnerEvent, opts);
    if (!vr.ok) return;
    let entry = byCurator.get(g.curator);
    if (!entry) {
      entry = {curator: g.curator, sets: []};
      byCurator.set(g.curator, entry);
    }
    entry.sets.push(vr.set);
  });

  const curators: Curator[] = [];
  const recommenders = new Map<string, string[]>();
  const curatorKeys = Array.from(byCurator.keys()).sort(compareCodePoints);
  for (const key of curatorKeys) {
    const entry = byCurator.get(key);
    if (!entry) continue;
    /* §6.1: at most GRAPH_MAX_SETS_PER_CURATOR sets per curator, selected
       deterministically by ascending `d` code-point order, truncation reported. */
    entry.sets.sort((a, b) => compareCodePoints(a.d, b.d));
    const setsObserved = entry.sets.length;
    const used = entry.sets.slice(0, POLICY.GRAPH_MAX_SETS_PER_CURATOR);
    const members: string[] = [];
    for (const set of used) {
      for (const coord of set.members) {
        if (members.indexOf(coord) === -1) members.push(coord);
      }
    }
    members.sort(compareCodePoints);
    // A curator counts once per tool no matter how many of their sets list it.
    for (const coord of members) {
      let who = recommenders.get(coord);
      if (!who) {
        who = [];
        recommenders.set(coord, who);
      }
      if (who.indexOf(entry.curator) === -1) who.push(entry.curator);
    }
    curators.push({
      curator: entry.curator,
      setsObserved,
      setsUsed: used.length,
      truncated: setsObserved > used.length,
      setIds: used.map(s => s.d),
      memberCount: members.length,
      members
    });
  }

  const recommenderList: Record<string, readonly string[]> = {};
  recommenders.forEach((who, coord) => {
    recommenderList[coord] = who.slice().sort(compareCodePoints);
  });
  return {
    counted,
    curators,
    recommenders: recommenderList,
    learned: Object.keys(recommenderList).sort(compareCodePoints)
  };
}

/* ---- §6.4 deterministic ordering ---- */

/** The fields ordering reads. Anything with these can be ordered.
    `recommendations` is `number | null` because "the viewer has no graph, so the
    count is unknown" is a real state and is NOT the same fact as zero (I8). The
    sort treats a non-finite count as 0 for key purposes only; it never writes
    that 0 back onto the row. */
export interface Orderable {
  readonly recommendations?: number | null;
  readonly createdAt: number;
  readonly eventId?: string | null;
}

/** When the graph is `none`, rec1 is unknown for every row, so the count
    component is dropped from the key entirely rather than substituted with 0
    (invariant I8). */
export function orderEntries<T extends Orderable>(
  entries: readonly T[],
  graphState?: GraphStateName | string
): T[] {
  const useCounts = graphState !== 'none';
  const copy = (Array.isArray(entries) ? entries : []).slice();
  copy.sort((a, b) => {
    if (useCounts) {
      const ra = Number.isFinite(a.recommendations) ? (a.recommendations as number) : 0;
      const rb = Number.isFinite(b.recommendations) ? (b.recommendations as number) : 0;
      if (ra !== rb) return rb - ra;
    }
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
    const ia = a.eventId ?? '';
    const ib = b.eventId ?? '';
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });
  return copy;
}
