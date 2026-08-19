/* The relay layer: rx-nostr context, one REQ round, coverage merging, filters.
   Data layer: talks to relays, never to the DOM.

   DEVIATION: rx-nostr 3.7.5 high-level EOSE-per-relay correlation is not verified
   without the implementation-preflight live probe (design §13.1, §20.3). We
   therefore approximate coverage: on clean completion of the backward request all
   relays are marked 'eose'; on timeout the still-unresolved relays are marked
   'timeout'; on any import/subscribe failure every relay is marked 'error'.
   Per-relay granularity is a live-probe follow-up. coverage values are objects
   {status, observedAt} because §8.1 requires observation time to be recorded. */

import {compareCodePoints, type NostrEvent} from '../domain/event.ts';
import {COORD_RE, POLICY} from '../domain/policy.ts';
import {chunkFilters, type RelayFilter} from '../domain/chunking.ts';
import type {RelayCoverage} from '../domain/catalogue.ts';
import {stats} from './stats.ts';

/** What rx-nostr hands back per event. `from` is the relay that delivered it. */
export interface EventPacket {
  readonly event: NostrEvent;
  readonly from: string | null;
}

export interface Round {
  readonly label: string;
  readonly events: EventPacket[];
  coverage: Record<string, RelayCoverage>;
  logicalReqs: number;
  physicalReqs: number;
  chunks: number;
  filters: readonly (readonly RelayFilter[])[];
  reason: string | null;
}

/* The slice of rx-nostr this layer uses. Declared structurally so the dynamic
   import stays honest about what is actually called, without pulling the whole
   library's types into the build. */
interface Subscription {
  unsubscribe?: () => void;
}

interface BackwardReq {
  emit: (filters: readonly RelayFilter[]) => void;
  over?: () => void;
}

export interface RxNostr {
  setDefaultRelays: (relays: readonly string[]) => void;
  use: (req: BackwardReq) => {
    subscribe: (observer: {
      next: (packet: {event?: NostrEvent; from?: string}) => void;
      error: () => void;
      complete: () => void;
    }) => Subscription;
  };
  /** The write path (§W4.1). Optional because the read path never calls it and
      must keep working against a context that only ever subscribed. */
  send?: (event: NostrEvent, opts?: unknown) => {
    subscribe: (observer: {
      next: (packet: unknown) => void;
      error: () => void;
      complete: () => void;
    }) => Subscription;
  };
  dispose?: () => void;
}

export interface RelayContext {
  readonly ok: boolean;
  readonly rxNostr: RxNostr | null;
  readonly createRxBackwardReq: (() => BackwardReq) | null;
  readonly relays: readonly string[];
  readonly timeoutMs: number;
}

/** Read the dynamically imported module without asserting its whole surface. */
function readRxModule(mod: unknown): {
  createRxNostr?: (opts: {verifier: unknown}) => RxNostr;
  createRxBackwardReq?: () => BackwardReq;
} {
  return (mod ?? {}) as {
    createRxNostr?: (opts: {verifier: unknown}) => RxNostr;
    createRxBackwardReq?: () => BackwardReq;
  };
}

export async function createRelayContext(
  relays: readonly string[],
  timeoutMs: number
): Promise<RelayContext> {
  try {
    // Lazy dynamic import; specifiers resolve against the document base URL.
    const [rxModRaw, cryptoModRaw] = await Promise.all([
      import('../../dist/rx-nostr.js'),
      import('../../dist/rx-nostr-crypto.js')
    ]);
    const rxMod = readRxModule(rxModRaw);
    const cryptoMod = (cryptoModRaw ?? {}) as {verifier?: unknown};
    /* Signature verification is supplied here: createRxNostr({verifier}) drops
       events with invalid ids/signatures before they reach our next handler.
       This is invariant I1 — no bytes influence a displayed value first. */
    if (!rxMod.createRxNostr || !rxMod.createRxBackwardReq) {
      return {ok: false, rxNostr: null, createRxBackwardReq: null, relays: relays.slice(), timeoutMs};
    }
    const rxNostr = rxMod.createRxNostr({verifier: cryptoMod.verifier});
    rxNostr.setDefaultRelays(relays);
    return {
      ok: true,
      rxNostr,
      createRxBackwardReq: rxMod.createRxBackwardReq,
      relays: relays.slice(),
      timeoutMs
    };
  } catch {
    return {ok: false, rxNostr: null, createRxBackwardReq: null, relays: relays.slice(), timeoutMs};
  }
}

export function emptyCoverage(
  relays: readonly string[],
  status: string,
  observedAt: number
): Record<string, RelayCoverage> {
  const coverage: Record<string, RelayCoverage> = {};
  for (const relay of relays) coverage[relay] = {status, observedAt};
  return coverage;
}

export function skippedRound(label: string, relays: readonly string[]): Round {
  return {
    label,
    events: [],
    coverage: emptyCoverage(relays, 'skipped', Date.now()),
    logicalReqs: 0,
    physicalReqs: 0,
    chunks: 0,
    filters: [],
    reason: 'skipped'
  };
}

/** One logical REQ round per relay. Physical REQs multiply only through §9.4
    chunking — never per curator, per tool, per card, or per event. */
export async function fetchRound(
  ctx: RelayContext,
  filters: readonly RelayFilter[],
  label: string
): Promise<Round> {
  const relays = ctx.relays;
  const observedAt = Date.now();
  const round: Round = {
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
  const chunked = chunkFilters(filters, {subId: 'nosmaps-' + label});
  if (!chunked.ok) {
    round.coverage = emptyCoverage(relays, 'rejected', observedAt);
    round.reason = chunked.reason;
    return round;
  }
  round.filters = chunked.chunks;
  round.chunks = chunked.chunks.length;
  if (!ctx.ok || !ctx.rxNostr || !ctx.createRxBackwardReq) {
    round.reason = 'relay-unavailable';
    return round;
  }

  stats.logicalReqs += relays.length;
  round.logicalReqs = relays.length;
  for (const relay of relays) {
    for (let j = 0; j < chunked.chunks.length; j += 1) {
      stats.logReq(relay, label + ':' + j);
      round.physicalReqs += 1;
    }
  }

  const rxNostr = ctx.rxNostr;
  const rxReq = ctx.createRxBackwardReq();
  await new Promise<void>(resolve => {
    let settled = false;
    let sub: Subscription | null = null;
    const timer = setTimeout(() => finish('timeout'), ctx.timeoutMs);

    function finish(mode: 'eose' | 'timeout' | 'error'): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const at = Date.now();
      for (const r of relays) {
        if (mode === 'eose') {
          round.coverage[r] = {status: 'eose', observedAt: at};
        } else if (round.coverage[r]?.status === 'error') {
          round.coverage[r] = {status: mode === 'timeout' ? 'timeout' : 'error', observedAt: at};
        }
      }
      if (sub && typeof sub.unsubscribe === 'function') {
        try {
          sub.unsubscribe();
        } catch { /* noop */ }
      }
      resolve();
    }

    try {
      sub = rxNostr.use(rxReq).subscribe({
        next: packet => {
          try {
            if (packet && packet.event) {
              round.events.push({event: packet.event, from: packet.from ?? null});
            }
          } catch { /* noop */ }
        },
        error: () => finish('error'),
        complete: () => finish('eose')
      });
    } catch {
      finish('error');
      return;
    }

    /* Emit one REQ per §9.4 chunk, then close the backward request so the
       observable completes after EOSE. Guarded because exact method names are
       a live-probe follow-up in this rx-nostr version. */
    try {
      for (const chunk of chunked.chunks) rxReq.emit(chunk);
      if (typeof rxReq.over === 'function') rxReq.over();
    } catch {
      finish('error');
    }
  });

  return round;
}

export function mergeCoverage(
  target: Record<string, RelayCoverage>,
  round: Round
): Record<string, RelayCoverage> {
  for (const k of Object.keys(round.coverage)) {
    const next = round.coverage[k];
    if (!next) continue;
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

/** §5.2: filters MUST be grouped by author. A single filter with
    authors:[A,B] and #d:[x,y] matches the Cartesian product and lets one
    author's events consume another's limit. Grouping is by author, not one REQ
    per author: all groups travel in the same REQ subject only to §9.4 chunking. */
export function groupByAuthor(coordinates: readonly string[]): RelayFilter[] {
  const byAuthor = new Map<string, string[]>();
  for (const coord of coordinates) {
    const m = COORD_RE.exec(coord);
    if (!m) continue;
    const author = m[1];
    const d = m[2];
    if (author === undefined || d === undefined) continue;
    let ds = byAuthor.get(author);
    if (!ds) {
      ds = [];
      byAuthor.set(author, ds);
    }
    if (ds.indexOf(d) === -1) ds.push(d);
  }
  const authors = Array.from(byAuthor.keys()).sort(compareCodePoints);
  const filters: RelayFilter[] = [];
  for (const author of authors) {
    const ds = (byAuthor.get(author) ?? []).slice().sort(compareCodePoints);
    filters.push({
      kinds: [POLICY.SOFTWARE_KIND],
      authors: [author],
      '#d': ds,
      limit: ds.length * 4
    });
  }
  return filters;
}

/** §7.3: at most one coalesced kind-5 REQ per relay per target round, carrying
    every newly learned coordinate plus the matching authors. Per-card and
    per-event cleanup requests are forbidden. */
export function cleanupFilter(
  authors: readonly string[],
  addresses: readonly string[]
): RelayFilter | null {
  const a = authors.slice().sort(compareCodePoints);
  const addr = addresses.slice().sort(compareCodePoints);
  if (!a.length && !addr.length) return null;
  return {
    kinds: [POLICY.DELETION_KIND],
    limit: POLICY.CLEANUP_LIMIT,
    ...(a.length ? {authors: a} : {}),
    ...(addr.length ? {'#a': addr} : {})
  };
}
