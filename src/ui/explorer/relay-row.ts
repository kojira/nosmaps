/* The relay -> row boundary.

   A live record states far less than a collected catalogue entry does, so a
   RelayRow is deliberately NOT a Tool: license, OS and NIPs are empty because the
   record says nothing about them, not because they were observed to be empty. The
   distinction is what keeps a relay row from claiming collected provenance.

   The one conversion that happens here is time: CatalogResult carries epoch
   milliseconds in `asOf`, while every rendered `observed` is the
   "YYYY-MM-DD HH:MM UTC" string data.js uses. Converting at this single boundary
   is the whole point of formatObserved, and the signature is what holds it. */

import type {CatalogEntry} from '../../domain/catalogue.ts';
import type {QuarantinedNewer} from '../../domain/winners.ts';

export interface RelayRow {
  /** "relay:" + the coordinate, so it never collides with a collected id. */
  readonly id: string;
  /** issue #18: the record's `d`, carried verbatim off the winning event.
      Two signers writing the same identifier produce two rows with two ids and
      two coordinates but ONE `d`, and this is the only field that says so. It is
      never normalised here — a signed `d` is not rewritten on read (§M1.3). */
  readonly d: string;
  readonly name: string;
  /** §21.4 R4: the record's state (active / withdrawn) is a different axis from
      whether the project is alive. Leaving it unset rendered
      `recordStates.undefined` on relay cards, so it is always carried. */
  readonly recordState: string;
  /** Display fallback for the icon when the topics name no seed category. */
  readonly category: string;
  /** Whether `category` was actually observed — the vocabulary keys off this,
      never off the fallback. */
  readonly categoryObserved: boolean;
  readonly status: 'active' | 'stale';
  readonly platform: string;
  readonly os: readonly string[];
  readonly license: string;
  readonly observed: string;
  readonly nips: readonly string[];
  readonly provenance: 'relay';
  /** issue #21: the winning event's `created_at`, in seconds. Null when the
      entry carries no usable second — unknown, never the epoch. */
  readonly collectedAt: number | null;
  readonly coordinate: string;
  readonly summary: string;
  readonly homepage: string | null;
  /** Null when the viewer has no graph — unknown, never 0 (invariant I8). */
  readonly recommendations: number | null;
  readonly recommenders: readonly string[];
  readonly quarantinedNewer: QuarantinedNewer | null;
}

/** data.js writes `observed` as "YYYY-MM-DD HH:MM UTC"; the relay result carries
    epoch milliseconds. Accepts either and always returns the formatted form. An
    unusable value returns "" rather than a fabricated date. */
export function formatObserved(value: string | number): string {
  if (typeof value === 'string') return value;
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  return `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** kind 30078's v1 content has no category, OS or licence field. A `t` topic is
    used as the observed category only when it matches a seed id; anything else
    stays unknown rather than being coerced into one. */
export function categoryFromTopics(
  topics: readonly string[] | undefined, seeds: readonly string[]
): string | null {
  if (!Array.isArray(topics)) return null;
  return topics.find(value => seeds.includes(value)) ?? null;
}

export function relayEntryToRow(
  entry: CatalogEntry, asOf: number, seeds: readonly string[]
): RelayRow {
  const observedCategory = categoryFromTopics(entry.topics, seeds);
  const stale = entry.stale === true;
  return {
    id: `relay:${entry.coordinate}`,
    d: entry.d,
    name: entry.fields.name || entry.coordinate || '—',
    recordState: entry.state,
    category: observedCategory ?? 'clients',
    categoryObserved: observedCategory !== null,
    status: stale ? 'stale' : 'active',
    platform: '', os: [], license: '',
    observed: formatObserved(asOf),
    nips: [], provenance: 'relay',
    /* The record's own second, read straight off the winning event. A value that
       is not a finite number is unknown and stays unknown; coercing it to 0 would
       file the row under 1970. */
    collectedAt: Number.isFinite(entry.createdAt) ? entry.createdAt : null,
    coordinate: entry.coordinate,
    summary: entry.fields.summary,
    homepage: entry.fields.homepage,
    recommendations: entry.recommendations,
    recommenders: entry.recommenders,
    quarantinedNewer: entry.quarantinedNewer
  };
}

/** A key that is long enough to be a pubkey is shown abbreviated; anything else
    verbatim. Never invents a key for an absent value. */
export function shortKey(value: string | null | undefined): string {
  if (typeof value === 'string' && value.length > 16) return `${value.slice(0, 8)}\u2026${value.slice(-8)}`;
  return value ?? '';
}
