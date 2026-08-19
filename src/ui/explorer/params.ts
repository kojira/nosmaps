/* The query-string knobs the explorer reads, in one place.

   Every one of these has a shipped default that matches the design; the URL can
   only shorten waits for tests. The code never becomes more impatient than the
   design says it is, and a malformed value falls back to the default rather than
   producing NaN or an empty relay list. */

export interface ExplorerParams {
  /** §W0.2 read-back attempts. Default 3. */
  readonly readbackAttempts: number;
  /** §W0.2 read-back backoff in ms. Default [0, 2000, 8000]. */
  readonly readbackBackoff: readonly number[];
  /** Default 15000 ms. */
  readonly publishTimeoutMs: number;
  /** NIP-07 getPublicKey() timeout. Default 20000 ms — an extension whose prompt
      is never answered would otherwise never settle. */
  readonly nip07TimeoutMs: number;
  /** `?relay=1` asks for the live catalogue. */
  readonly relayRequested: boolean;
  /** A pasted viewer pubkey (§6.5.4). Empty when absent — never invented. */
  readonly viewerPubkey: string;
  /** `?relays=` overrides POLICY.DEFAULT_RELAYS. Empty means "use the default". */
  readonly relays: readonly string[];
  /** §17.2 / §6.5.6: a manual "count these too" list, not a listing gate. Empty
      on shipped builds, and it never changes which rows exist. */
  readonly manualCounted: readonly string[];
  readonly topics: readonly string[];
  /** `?tool=<id>` is how the landing carousel hands an entry over. */
  readonly requestedTool: string | null;
  readonly requestedState: string | null;
}

function positiveNumber(raw: string | null, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function list(raw: string | null): readonly string[] {
  if (!raw) return [];
  return raw.split(',').map(value => value.trim()).filter(Boolean);
}

function backoff(raw: string | null): readonly number[] {
  const fallback = [0, 2000, 8000];
  if (!raw) return fallback;
  const values = raw.split(',').map(Number).filter(Number.isFinite);
  return values.length ? values : fallback;
}

export function readExplorerParams(search: string): ExplorerParams {
  const params = new URLSearchParams(search);
  return {
    readbackAttempts: positiveNumber(params.get('readbackattempts'), 3),
    readbackBackoff: backoff(params.get('readbackbackoff')),
    publishTimeoutMs: positiveNumber(params.get('publishtimeout'), 15000),
    nip07TimeoutMs: positiveNumber(params.get('nip07timeout'), 20000),
    relayRequested: params.get('relay') === '1',
    viewerPubkey: (params.get('viewer') ?? '').trim(),
    relays: list(params.get('relays')),
    manualCounted: list(params.get('curators')),
    topics: list(params.get('topics')),
    requestedTool: params.get('tool'),
    requestedState: params.get('state')
  };
}
