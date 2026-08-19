/* §9.4 byte-aware REQ chunking (NIP-11 values absent -> labelled `assumed`).
   Pure domain layer: no DOM, no network, no window — it only decides shapes. */

import {utf8ByteLength} from './json.ts';
import {POLICY} from './policy.ts';

/** A relay filter. Values are scalars or arrays of scalars; the chunker only
    needs to know which keys hold arrays, so this is the honest shape. */
export type FilterValue = string | number | readonly string[] | readonly number[];
export type RelayFilter = {readonly [key: string]: FilterValue | undefined};

export type ChunkResult =
  | {readonly ok: true; readonly chunks: readonly (readonly RelayFilter[])[]; readonly filterCount: number}
  | {readonly ok: false; readonly reason: string; readonly chunks: readonly (readonly RelayFilter[])[]};

export interface ChunkOptions {
  readonly maxFilters?: number;
  readonly maxBytes?: number;
  readonly maxArrayItems?: number;
  readonly subId?: string;
}

function serializeReq(subId: string, filters: readonly RelayFilter[]): string {
  return JSON.stringify(['REQ', subId, ...filters]);
}

/** The keys of a filter whose value is an array, in sorted order. */
function arrayKeys(filter: RelayFilter): string[] {
  const out: string[] = [];
  for (const key of Object.keys(filter).sort()) {
    if (Array.isArray(filter[key])) out.push(key);
  }
  return out;
}

/** The array behind a key, or null when that key is not an array. Returning null
    rather than assuming keeps every length read below honest. */
function arrayAt(filter: RelayFilter, key: string | null): readonly unknown[] | null {
  if (key === null) return null;
  const value = filter[key];
  return Array.isArray(value) ? value : null;
}

function withKey(filter: RelayFilter, key: string, value: readonly unknown[]): RelayFilter {
  return {...filter, [key]: value as readonly string[]};
}

function capArrays(filter: RelayFilter, cap: number): RelayFilter[] {
  let out: RelayFilter[] = [filter];
  let changed = true;
  let guard = 0;
  while (changed) {
    if (++guard > 64) break;
    changed = false;
    const next: RelayFilter[] = [];
    for (const f of out) {
      let bigKey: string | null = null;
      for (const k of arrayKeys(f)) {
        const arr = arrayAt(f, k);
        const big = arrayAt(f, bigKey);
        if (arr && arr.length > cap && (bigKey === null || (big && arr.length > big.length))) {
          bigKey = k;
        }
      }
      const arr = arrayAt(f, bigKey);
      if (bigKey === null || !arr) {
        next.push(f);
        continue;
      }
      changed = true;
      for (let s = 0; s < arr.length; s += cap) {
        next.push(withKey(f, bigKey, arr.slice(s, s + cap)));
      }
    }
    out = next;
  }
  return out;
}

function largestArrayKey(filter: RelayFilter): string | null {
  let big: string | null = null;
  for (const key of arrayKeys(filter)) {
    const arr = arrayAt(filter, key);
    const current = arrayAt(filter, big);
    if (!arr) continue;
    if (big === null || (current && arr.length > current.length)) big = key;
  }
  return big;
}

function reqBytes(subId: string, filters: readonly RelayFilter[]): number {
  return utf8ByteLength(serializeReq(subId, filters));
}

/** Serialize the full ["REQ", subId, ...filters] and split until both the filter
    count and the byte length fit. A filter that does not fit the remaining byte
    budget is split by its largest array so the byte budget is actually filled
    rather than wasted on uniform array-cap granularity. A scalar-only filter
    that cannot fit fails visibly. */
export function chunkFilters(
  filters: readonly RelayFilter[],
  opts?: ChunkOptions
): ChunkResult {
  const maxFilters = Number.isFinite(opts?.maxFilters)
    ? (opts?.maxFilters as number) : POLICY.MAX_FILTERS_PER_REQ;
  const maxBytes = Number.isFinite(opts?.maxBytes)
    ? (opts?.maxBytes as number) : POLICY.MAX_SERIALIZED_REQ_BYTES_FALLBACK;
  const arrayCap = Number.isFinite(opts?.maxArrayItems)
    ? (opts?.maxArrayItems as number) : POLICY.MAX_ARRAY_ITEMS_PER_FILTER;
  const subId = typeof opts?.subId === 'string' && opts.subId ? opts.subId : 'nosmaps-000000000000';
  const input = Array.isArray(filters) ? filters : [];

  const queue: RelayFilter[] = [];
  for (const f of input) {
    for (const capped of capArrays(f, arrayCap)) queue.push(capped);
  }

  const chunks: RelayFilter[][] = [];
  let current: RelayFilter[] = [];
  let guard = 0;
  while (queue.length) {
    if (++guard > 8192) return {ok: false, reason: 'chunk-guard', chunks: []};
    const f = queue[0];
    if (f === undefined) break;
    const withF = current.concat([f]);
    if (withF.length <= maxFilters && reqBytes(subId, withF) <= maxBytes) {
      current = withF;
      queue.shift();
      continue;
    }
    const key = withF.length <= maxFilters ? largestArrayKey(f) : null;
    const arr = arrayAt(f, key);
    if (key && arr && arr.length > 1) {
      // Largest prefix of the biggest array that still fits this REQ.
      let lo = 1;
      let hi = arr.length - 1;
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const trial = withKey(f, key, arr.slice(0, mid));
        if (reqBytes(subId, current.concat([trial])) <= maxBytes) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (best > 0) {
        current.push(withKey(f, key, arr.slice(0, best)));
        queue[0] = withKey(f, key, arr.slice(best));
        chunks.push(current);
        current = [];
        continue;
      }
    }
    if (current.length) {
      chunks.push(current);
      current = [];
      continue;
    }
    return {ok: false, reason: 'filter-too-large', chunks: []};
  }
  if (current.length) chunks.push(current);
  let filterCount = 0;
  for (const chunk of chunks) filterCount += chunk.length;
  return {ok: true, chunks, filterCount};
}
