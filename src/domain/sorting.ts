/* issue #1: the order the candidate list is presented in.

   Only keys that name something the records actually state are here. There is no
   "newest first" / "oldest first", and that absence is deliberate: the 41 signed
   kind 30078 records carry no publication date, and the `created_at` on the
   events is the moment the collector signed them (all of them land on the same
   day). Ordering by it would show collection order while calling it recency,
   which is a fabricated fact wearing a real field's name. Until a record states
   its own date there is nothing to sort by, so nothing is offered.

   Likes are the observed count of live kind 7 events (issue #20). That count has
   three states, not two: a number, a real zero (we asked and there were none),
   and unknown (nobody asked). Invariant I8 says unknown is not zero, and
   `orderEntries` in domain/graph.ts already honours that by dropping the count
   from the ordering key rather than substituting 0. This module keeps the same
   rule at the row level: an unknown row is not ranked at all. It is returned
   separately so the caller can say out loud that it was set aside — silently
   sinking it to the bottom would read as "0 likes", which is exactly the lie
   I8 exists to prevent.

   domain layer: pure. No DOM, no i18n, no relay. */

import {compareCodePoints} from './event.ts';

/** Every order the list can be presented in. `default` is whatever order the
    caller already had — the relay list's own ordering key, or the collected
    catalogue's order — and is what the page starts in. */
export const SORT_KEYS = ['default', 'name-asc', 'name-desc', 'likes-desc', 'likes-asc'] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export function isSortKey(value: string): value is SortKey {
  return (SORT_KEYS as readonly string[]).includes(value);
}

/** What sorting reads off a row.

    `likes: null` means nobody has observed the reactions on this row. It is NOT
    the same fact as `likes: 0`, which means the reactions were observed and
    there were none (invariant I8). */
export interface Sortable {
  readonly id: string;
  readonly name: string;
  readonly likes: number | null;
}

/** The list split into the rows the key could rank and the rows it could not.
    `unranked` is never merged into `ranked` — not at the top, not at the bottom.
    A caller that wants to show them has to show them as what they are. */
export interface SortedRows<T> {
  readonly ranked: readonly T[];
  readonly unranked: readonly T[];
}

function byNameThenId(a: Sortable, b: Sortable): number {
  const name = compareCodePoints(a.name, b.name);
  return name !== 0 ? name : compareCodePoints(a.id, b.id);
}

/** Orders `rows` by `key`. The input array is never mutated.

    A likes key ranks only the rows whose count was actually observed; the rest
    come back in `unranked`, in their incoming order, having taken no part in the
    comparison. A name key ranks everything, because every row has a name. */
export function sortRows<T extends Sortable>(rows: readonly T[], key: SortKey): SortedRows<T> {
  const all = (Array.isArray(rows) ? rows : []).slice();
  if (key === 'default') return {ranked: all, unranked: []};
  if (key === 'name-asc' || key === 'name-desc') {
    const direction = key === 'name-asc' ? 1 : -1;
    all.sort((a, b) => direction * byNameThenId(a, b));
    return {ranked: all, unranked: []};
  }
  const ranked: T[] = [];
  const unranked: T[] = [];
  for (const row of all) {
    /* The only test is "is there an observed number here". `null` — and anything
       that is not a finite number — is unknown, and unknown is not a low score. */
    if (typeof row.likes === 'number' && Number.isFinite(row.likes)) ranked.push(row);
    else unranked.push(row);
  }
  const direction = key === 'likes-desc' ? -1 : 1;
  ranked.sort((a, b) => {
    const ca = a.likes as number;
    const cb = b.likes as number;
    if (ca !== cb) return direction * (ca - cb);
    return byNameThenId(a, b);
  });
  return {ranked, unranked};
}
