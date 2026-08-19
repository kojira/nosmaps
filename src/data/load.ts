/* Orchestration: loadCatalog (§8.4 empty-cache rebuild, §9.1 R1-R3).
   Data layer: relays + cache + the pure reducer. No DOM. */

import {
  compareCodePoints, coordinateOf, getDtag, isLowercaseHex64, type NostrEvent
} from '../domain/event.ts';
import {decodeNpub} from '../domain/npub.ts';
import {COORD_RE, POLICY} from '../domain/policy.ts';
import {deriveGraph, curationMembership} from '../domain/graph.ts';
import {
  buildCatalog,
  type CatalogReceipt, type CatalogResult, type RelayCoverage
} from '../domain/catalogue.ts';
import type {RelayFilter} from '../domain/chunking.ts';
import {cache, isFresh} from './cache.ts';
import {stats, type StatsDelta} from './stats.ts';
import {
  cleanupFilter, createRelayContext, emptyCoverage, fetchRound, groupByAuthor,
  mergeCoverage, skippedRound, type RelayContext, type Round
} from './relay.ts';

/** Where the viewer's identity came from. `none` is a state, not a failure. */
export type ViewerSource = 'none' | 'pasted' | 'nip07';

export interface RoundReport {
  readonly label: string;
  readonly logicalReqs: number;
  readonly physicalReqs: number;
  readonly chunks: number;
  readonly filters?: readonly (readonly RelayFilter[])[];
  readonly reason: string | null;
  readonly coverage?: Record<string, RelayCoverage>;
}

/** The catalogue plus how it was obtained. */
export interface LoadedCatalog extends CatalogResult {
  readonly viewerSource: ViewerSource;
  readonly rounds: readonly RoundReport[];
  readonly stats: StatsDelta;
}

export interface LoadCatalogOptions {
  readonly relays?: readonly string[];
  readonly topics?: readonly string[];
  readonly useCache?: boolean;
  readonly nowMs?: number;
  readonly timeoutMs?: number;
  readonly viewerPubkey?: string | null;
  readonly viewerNpub?: string | null;
  readonly useNip07?: boolean;
  readonly manualCounted?: readonly string[];
  readonly tier2?: boolean;
}

/** NIP-07, as the page exposes it. Optional because its absence is a state the
    app renders (§W1.2 state 1), not an error. */
interface Nip07Window {
  nostr?: {getPublicKey?: () => Promise<string> | string};
}

function reportRound(r: Round): RoundReport {
  return {
    label: r.label,
    logicalReqs: r.logicalReqs,
    physicalReqs: r.physicalReqs,
    chunks: r.chunks,
    filters: r.filters,
    reason: r.reason,
    coverage: r.coverage
  };
}

export async function loadCatalog(opts?: LoadCatalogOptions): Promise<LoadedCatalog> {
  const relays = (Array.isArray(opts?.relays) && opts.relays.length)
    ? opts.relays.slice() : POLICY.DEFAULT_RELAYS.slice();
  const topics = (Array.isArray(opts?.topics) && opts.topics.length)
    ? opts.topics.slice() : POLICY.DISCOVERY_TOPICS.slice();
  const useCache = opts?.useCache !== false;
  const nowMs = Number.isFinite(opts?.nowMs) ? (opts?.nowMs as number) : Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const timeoutMs = Number.isFinite(opts?.timeoutMs)
    ? (opts?.timeoutMs as number) : POLICY.REQ_TIMEOUT_MS;

  const base = stats.snapshot();
  const delta = (): StatsDelta => stats.since(base);

  const diagnostics: string[] = [];
  /* §9.4: NIP-11 is not fetched here — reading it would put HTTP back into the
     catalog data path, which §9.2 forbids. Conservative fallbacks are used and
     labelled `assumed`. */
  diagnostics.push('nip11-assumed');
  if (opts?.tier2 === true || POLICY.GRAPH_TIER2_ENABLED) {
    /* §6.3 tier 2 is opt-in and costs megabytes for a reordering signal. It is
       not implemented in this phase; saying so is the honest degradation. */
    diagnostics.push('tier2-not-implemented');
  }

  const rounds: Round[] = [];
  let ctx: RelayContext | null = null;
  try {
    /* ---- §6.2 step 1: identity, in preference order ---- */
    let viewerPubkey: string | null = null;
    let viewerSource: ViewerSource = 'none';
    const pasted = opts?.viewerPubkey ?? opts?.viewerNpub;
    if (pasted) {
      viewerPubkey = decodeNpub(pasted);
      if (viewerPubkey) viewerSource = 'pasted';
      else diagnostics.push('viewer-key-unparsable');
    }
    /* NIP-07 is only consulted on explicit request: getPublicKey() prompts the
       user, and prompting on a plain page load is not opt-in (§6.2 step 1.1). */
    if (!viewerPubkey && opts?.useNip07 === true) {
      try {
        const signer = typeof window !== 'undefined'
          ? (window as Window & Nip07Window).nostr
          : undefined;
        if (signer && typeof signer.getPublicKey === 'function') {
          const key = await signer.getPublicKey();
          viewerPubkey = decodeNpub(key);
          if (viewerPubkey) viewerSource = 'nip07';
          else diagnostics.push('nip07-key-unparsable');
        } else {
          diagnostics.push('nip07-unavailable');
        }
      } catch {
        diagnostics.push('nip07-refused');
      }
    }

    ctx = await createRelayContext(relays, timeoutMs);
    if (!ctx.ok) diagnostics.push('relay-layer-unavailable');

    /* ---- R1: discovery by `t` plus the viewer's kind 3 ---- */
    const r1Filters: RelayFilter[] = [{
      kinds: [POLICY.SOFTWARE_KIND],
      '#t': topics.slice().sort(compareCodePoints),
      limit: POLICY.DISCOVERY_LIMIT_PER_RELAY
    }];
    if (viewerPubkey) {
      r1Filters.push({kinds: [POLICY.FOLLOW_KIND], authors: [viewerPubkey], limit: 1});
    }
    const r1 = await fetchRound(ctx, r1Filters, 'r1');
    rounds.push(r1);

    const r1Events = r1.events.map(p => p.event);
    const discoveredSoftware = r1Events.filter(e => e && e.kind === POLICY.SOFTWARE_KIND);
    /* §5.1 rule 4: hitting a bound marks the relay `incomplete: discovery-cap`.
       An empty page proves only "no more events returned in this round".
       DEVIATION: a single page is issued per round; pagination beyond page 1 is
       not implemented, so saturation is reported rather than silently truncated. */
    if (discoveredSoftware.length >= POLICY.DISCOVERY_LIMIT_PER_RELAY) {
      diagnostics.push('discovery-cap');
    }

    /* ---- §6.2 step 3: G ---- */
    const graph = deriveGraph({viewerPubkey, events: r1Events, nowSec});

    /* §6.5.6: the manual "also count these" list is user-owned configuration, so
       its pubkeys must actually be consulted. They ride in the same R2 filter as
       array elements and are counted separately from the follow graph (§6.4). */
    const manualCounted: string[] = [];
    const manualInput = Array.isArray(opts?.manualCounted) ? opts.manualCounted : [];
    for (const raw of manualInput) {
      const key = decodeNpub(raw);
      if (key && manualCounted.indexOf(key) === -1) manualCounted.push(key);
    }
    const countedPubkeys = graph.pubkeys.slice();
    for (const key of manualCounted) {
      if (countedPubkeys.indexOf(key) === -1) countedPubkeys.push(key);
    }

    /* ---- R2: curation. Every counted pubkey is an array element, not a filter ---- */
    let r2 = skippedRound('r2', relays);
    if (countedPubkeys.length) {
      r2 = await fetchRound(ctx, [{
        kinds: [POLICY.CURATION_KIND],
        authors: countedPubkeys.slice().sort(compareCodePoints),
        limit: POLICY.GRAPH_MAX_FOLLOWS
      }], 'r2');
    }
    rounds.push(r2);

    const r2Events = r2.events.map(p => p.event);

    /* ---- R3: gap-fill (§6.6 recall) plus one coalesced kind-5 cleanup ---- */
    const curationForRecall = curationMembership({
      events: r2Events,
      pubkeys: countedPubkeys,
      nowSec,
      receivedAtSec: nowSec
    });
    const observedInR1 = new Set<string>();
    for (const e of discoveredSoftware) {
      observedInR1.add(coordinateOf(POLICY.SOFTWARE_KIND, e.pubkey, getDtag(e.tags)));
    }
    const missing = curationForRecall.learned.filter(coord => !observedInR1.has(coord));

    const cleanupAuthors: string[] = [];
    const cleanupAddresses: string[] = [];
    const noteAuthor = (pubkey: string): void => {
      if (isLowercaseHex64(pubkey) && cleanupAuthors.indexOf(pubkey) === -1) {
        cleanupAuthors.push(pubkey);
      }
    };
    const noteAddress = (coord: string): void => {
      if (coord && cleanupAddresses.indexOf(coord) === -1) cleanupAddresses.push(coord);
    };
    for (const e of discoveredSoftware) {
      noteAuthor(e.pubkey);
      noteAddress(coordinateOf(POLICY.SOFTWARE_KIND, e.pubkey, getDtag(e.tags)));
    }
    for (const coord of missing) {
      const m = COORD_RE.exec(coord);
      const author = m?.[1];
      if (author !== undefined) noteAuthor(author);
      noteAddress(coord);
    }
    for (const e of r2Events) {
      if (!e || e.kind !== POLICY.CURATION_KIND) continue;
      noteAuthor(e.pubkey);
      noteAddress(coordinateOf(POLICY.CURATION_KIND, e.pubkey, getDtag(e.tags)));
    }
    if (viewerPubkey) noteAuthor(viewerPubkey);

    const r3Filters = groupByAuthor(missing);
    const cleanup = cleanupFilter(cleanupAuthors, cleanupAddresses);
    if (cleanup) r3Filters.push(cleanup);
    let r3 = skippedRound('r3', relays);
    if (r3Filters.length) r3 = await fetchRound(ctx, r3Filters, 'r3');
    rounds.push(r3);

    /* ---- union everything observed, then validate and select ---- */
    const observed = r1.events.concat(r2.events, r3.events);
    const receipts: Record<string, CatalogReceipt> = {};
    const sources: Record<string, string[]> = {};
    const events: NostrEvent[] = [];
    for (const packet of observed) {
      const e = packet.event;
      if (!e || typeof e.id !== 'string') continue;
      if (!receipts[e.id]) {
        receipts[e.id] = {receivedAtSec: nowSec, cached: false};
        events.push(e);
      }
      const bucket = sources[e.id] ?? (sources[e.id] = []);
      if (packet.from && bucket.indexOf(packet.from) === -1) bucket.push(packet.from);
    }

    /* The cache is a discardable accelerator (D14). A cached event was observed
       once; feeding it back in lets a partitioned round still show something,
       flagged `stale`, rather than nothing. */
    if (useCache) {
      let cached: Awaited<ReturnType<typeof cache.getAll>> = [];
      try {
        cached = await cache.getAll();
      } catch {
        cached = [];
      }
      for (const rec of cached) {
        if (!rec || !rec.event || typeof rec.event.id !== 'string') continue;
        if (receipts[rec.event.id]) continue;
        if (!isFresh(rec, nowMs)) continue;
        const receivedAtSec = (rec as {receivedAtSec?: number}).receivedAtSec;
        receipts[rec.event.id] = {
          receivedAtSec: Number.isFinite(receivedAtSec) ? (receivedAtSec as number) : nowSec,
          cached: true
        };
        events.push(rec.event);
        stats.logCache('reuse:' + rec.coordinate);
      }
    }

    const coverage: Record<string, RelayCoverage> = {};
    mergeCoverage(coverage, r1);
    mergeCoverage(coverage, r2);
    mergeCoverage(coverage, r3);

    const result = buildCatalog({
      events,
      receipts,
      sources,
      coverage,
      viewerPubkey,
      ...(opts?.manualCounted === undefined ? {} : {manualCounted: opts.manualCounted}),
      topics,
      nowMs,
      nowSec,
      diagnostics
    });

    // Persist the winners as a derived, rebuildable cache.
    if (useCache) {
      for (const entry of result.entries) {
        const receipt = entry.eventId === null ? undefined : receipts[entry.eventId];
        if (!receipt || receipt.cached) continue;
        const winner = events.find(e => e.id === entry.eventId);
        if (!winner) continue;
        try {
          await cache.putRecord({
            coordinate: entry.coordinate,
            event: winner,
            verifiedAt: nowMs
          });
        } catch { /* cache failures never affect the result */ }
      }
    }

    return {
      ...result,
      viewerSource,
      rounds: rounds.map(reportRound),
      stats: delta()
    };
  } catch {
    diagnostics.push('load-error');
    return {
      status: 'unavailable',
      entries: [],
      graph: {
        state: 'none', pubkeys: [], coverage: 'unknown', followsUsed: 0, followsTotal: 0,
        truncated: false, malformedPTags: 0, viewerPubkey: null,
        followListId: null, followListCreatedAt: null
      },
      curation: {counted: [], curators: [], manual: []},
      quarantined: [],
      unresolved: [],
      deletions: {accepted: 0, rejected: 0},
      coverage: emptyCoverage(relays, 'error', Date.now()),
      topics,
      asOf: nowMs,
      diagnostics,
      rounds: rounds.map(r => ({
        label: r.label,
        logicalReqs: r.logicalReqs,
        physicalReqs: r.physicalReqs,
        chunks: r.chunks,
        reason: r.reason
      })),
      viewerSource: 'none',
      stats: delta()
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
