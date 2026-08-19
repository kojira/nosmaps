/* The pure reducer: observed events -> displayable catalogue.
   Pure domain layer: no DOM, no network, no window.

   Identical validated observed inputs produce byte-identical output including
   ordering, independent of arrival order and of which relay delivered what (I4). */

import {compareCodePoints} from './event.ts';
import {decodeNpub} from './npub.ts';
import {POLICY} from './policy.ts';
import {
  curationMembership, deriveGraph, orderEntries,
  type CurationMembership, type GraphState
} from './graph.ts';
import {collectDeletions, selectSoftwareWinners, type Quarantined, type QuarantinedNewer, type Receipts} from './winners.ts';

export type CatalogStatus = 'fresh' | 'stale' | 'incomplete' | 'unavailable';

/** What a relay told us, per relay. */
export interface RelayCoverage {
  readonly status: string;
  readonly observedAt?: number;
  readonly events?: number;
  readonly error?: string | null;
}

/** A displayable row. `recommendations` is null — not 0 — when the viewer has no
    graph: unknown and zero are different facts (I8). */
export interface CatalogEntry {
  readonly coordinate: string;
  readonly publisher: string;
  readonly d: string;
  readonly state: 'active';
  readonly fields: {
    readonly name: string;
    readonly summary: string;
    readonly homepage: string | null;
  };
  readonly topics: readonly string[];
  readonly supersededBy: string | null;
  readonly eventId: string | null;
  readonly createdAt: number;
  readonly recommendations: number | null;
  readonly recommenders: readonly string[];
  readonly manualRecommendations: number | null;
  readonly manualRecommenders: readonly string[];
  readonly quarantinedNewer: QuarantinedNewer | null;
  readonly relays: readonly string[];
  /** This winner was not re-observed in the current round and is being served
      from the derived cache (§3). */
  readonly stale: boolean;
}

export interface CuratorSummary {
  readonly curator: string;
  readonly setsObserved: number;
  readonly setsUsed: number;
  readonly truncated: boolean;
  readonly setIds: readonly string[];
  readonly memberCount: number;
}

export interface CatalogResult {
  readonly status: CatalogStatus;
  readonly entries: readonly CatalogEntry[];
  readonly graph: GraphState;
  readonly curation: {
    readonly counted: readonly string[];
    readonly curators: readonly CuratorSummary[];
    readonly manual: readonly CuratorSummary[];
  };
  readonly quarantined: readonly Quarantined[];
  readonly unresolved: readonly string[];
  readonly deletions: {readonly accepted: number; readonly rejected: number};
  readonly coverage: {readonly [relay: string]: RelayCoverage | undefined};
  readonly topics: readonly string[];
  readonly asOf: number;
  readonly diagnostics: readonly string[];
}

/** Per-event receipt facts the reducer reads. */
export interface CatalogReceipt {
  readonly receivedAtSec?: number;
  readonly cached?: boolean;
}

export interface CatalogInput {
  readonly nowMs?: number;
  readonly nowSec?: number;
  readonly events?: readonly unknown[];
  readonly receipts?: {readonly [eventId: string]: CatalogReceipt | undefined};
  readonly sources?: {readonly [eventId: string]: readonly string[] | undefined};
  readonly coverage?: {readonly [relay: string]: RelayCoverage | undefined};
  readonly diagnostics?: readonly string[];
  readonly viewerPubkey?: string | null;
  readonly manualCounted?: readonly string[];
  readonly topics?: readonly string[];
}

const EMPTY_MEMBERSHIP: CurationMembership = {
  counted: [], curators: [], recommenders: {}, learned: []
};

function summarise(list: CurationMembership['curators']): CuratorSummary[] {
  return list.map(c => ({
    curator: c.curator,
    setsObserved: c.setsObserved,
    setsUsed: c.setsUsed,
    truncated: c.truncated,
    setIds: c.setIds,
    memberCount: c.memberCount
  }));
}

export function buildCatalog(input?: CatalogInput): CatalogResult {
  const nowMs = Number.isFinite(input?.nowMs) ? (input?.nowMs as number) : Date.now();
  const nowSec = Number.isFinite(input?.nowSec)
    ? (input?.nowSec as number)
    : Math.floor(nowMs / 1000);
  const events = Array.isArray(input?.events) ? input.events : [];
  const receipts = input?.receipts ?? {};
  const sources = input?.sources ?? {};
  const coverage = input?.coverage ?? {};
  const diagnostics: string[] = Array.isArray(input?.diagnostics) ? input.diagnostics.slice() : [];
  const validationOpts = {nowSec, receivedAtSec: nowSec, receipts: receipts as Receipts};

  const deletions = collectDeletions(events, validationOpts);

  const graph = deriveGraph({
    ...(input?.viewerPubkey === undefined ? {} : {viewerPubkey: input.viewerPubkey}),
    events,
    deletions,
    nowSec
  });

  /* §6.5.6: a user-editable "also count these" list. It ships empty, is never
     populated by the app, and its contributions are labelled as manual. */
  const manual: string[] = [];
  const manualInput = Array.isArray(input?.manualCounted) ? input.manualCounted : [];
  for (const raw of manualInput) {
    const key = decodeNpub(raw);
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
    ? curationMembership({events, pubkeys: manual, deletions, nowSec, receivedAtSec: nowSec})
    : EMPTY_MEMBERSHIP;

  const selection = selectSoftwareWinners(events, {
    deletions,
    nowSec,
    receivedAtSec: nowSec,
    receipts: receipts as Receipts
  });

  const observedCoordinates = new Set<string>();
  for (const w of selection.winners) observedCoordinates.add(w.coordinate);
  for (const q of selection.quarantined) observedCoordinates.add(q.coordinate);

  const rows: CatalogEntry[] = [];
  for (const w of selection.winners) {
    /* §5.4 listability — the complete rule. No curator, relay, configuration,
       or local list participates. */
    if (w.record.state !== 'active') continue;
    const receipt = w.record.eventId === null ? undefined : receipts[w.record.eventId];
    const recommenders = curation.recommenders[w.coordinate] ?? [];
    const manualRecommenders = manualCuration.recommenders[w.coordinate] ?? [];
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
      relays: (w.record.eventId === null ? [] : sources[w.record.eventId] ?? []).slice(),
      stale: Boolean(receipt?.cached)
    });
  }

  const entries = orderEntries(rows, graph.state);

  /* §5.4: a coordinate recommended by everyone but with no observed valid
     winner is not listable. It appears here, never as a fabricated row. */
  const unresolved: string[] = [];
  const learnedAll = curation.learned.concat(manualCuration.learned);
  for (const coord of learnedAll) {
    if (observedCoordinates.has(coord)) continue;
    if (unresolved.indexOf(coord) === -1) unresolved.push(coord);
  }
  unresolved.sort(compareCodePoints);

  /* ---- status (§3) ---- */
  const relayUrls = Object.keys(coverage);
  let allEose = relayUrls.length > 0;
  for (const url of relayUrls) {
    const cov = coverage[url];
    if (!cov || (cov.status !== 'eose' && cov.status !== 'skipped')) {
      allEose = false;
      break;
    }
  }
  /* §8.3 example B: a stale graph changes counts, never the row set (I7), so it
     is reported in `graph.coverage` and does not make the catalog itself stale. */
  const anyStale = entries.some(e => e.stale === true);
  const observedAnything = events.length > 0;

  if (graph.state === 'none') diagnostics.push('graph-none');
  if (graph.state === 'self-only') diagnostics.push('graph-self-only');
  if (graph.truncated) {
    diagnostics.push('graph-truncated:' + graph.followsUsed + '/' + graph.followsTotal);
  }
  if (graph.malformedPTags > 0) diagnostics.push('graph-malformed-p-tags:' + graph.malformedPTags);
  for (const c of curation.curators) {
    if (c.truncated) diagnostics.push('curator-sets-truncated:' + c.curator);
  }
  if (selection.quarantined.length) diagnostics.push('quarantined:' + selection.quarantined.length);
  if (unresolved.length) {
    diagnostics.push('recommended-coordinate-not-observed:' + unresolved.length);
  }
  if (!allEose) diagnostics.push('relay-coverage-incomplete');

  if (allEose && !observedAnything) diagnostics.push('no-records-observed');
  if (graph.coverage === 'stale') diagnostics.push('graph-stale');

  let status: CatalogStatus;
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
      curators: summarise(curation.curators),
      manual: summarise(manualCuration.curators)
    },
    quarantined: selection.quarantined,
    unresolved,
    deletions: {accepted: deletions.accepted, rejected: deletions.rejected},
    coverage,
    topics: Array.isArray(input?.topics) ? input.topics.slice() : POLICY.DISCOVERY_TOPICS.slice(),
    asOf: nowMs,
    diagnostics
  };
}
