/* issue #1: the order the candidate list is presented in.
   issue #21: plus the two collection-date keys.

   Only keys that name something the records actually state are here. There is no
   "newest release" / "oldest release": the 41 signed kind 30078 records carry no
   publication date of their own, so no key claims one.

   What the records DO carry is their event's `created_at` — the moment the
   record was signed into the catalogue. `collected-desc` / `collected-asc` order
   by exactly that, and they are labelled as exactly that ("collected"), so the
   value on screen and the value in the key are the same fact. Naming it recency
   would have been the fabrication; naming it collection is not.

   The 41 collected records were signed in one batch, so today they all carry the
   same second (1787011200) and this order returns them unchanged. That is the
   honest output for equal keys, not a reason to withhold the key: a record signed
   by anyone else lands on a different second and sorts where it belongs.

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
export const SORT_KEYS = [
  'default', 'name-asc', 'name-desc', 'likes-desc', 'likes-asc', 'collected-desc', 'collected-asc'
] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export function isSortKey(value: string): value is SortKey {
  return (SORT_KEYS as readonly string[]).includes(value);
}

/** What sorting reads off a row.

    `likes: null` means nobody has observed the reactions on this row. It is NOT
    the same fact as `likes: 0`, which means the reactions were observed and
    there were none (invariant I8).

    `collectedAt` is the `created_at` of the signed record, in seconds. `null`
    means this row carries no such second at all — the same shape of fact as an
    unobserved like count, and handled the same way: it is not ranked as an
    epoch 0, which would read as 1970. */
export interface Sortable {
  readonly id: string;
  readonly name: string;
  readonly likes: number | null;
  readonly collectedAt: number | null;
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

/** Which fact a key ranks on. The caller needs this to say out loud WHICH value
    the set-aside rows are missing: "no observed like count" and "no collection
    date" are different sentences, and printing the first one under a collection
    order would be a false statement about the data. `null` for keys that set
    nothing aside. */
export type SortDimension = 'likes' | 'collected';

export function sortDimension(key: SortKey): SortDimension | null {
  if (key === 'likes-desc' || key === 'likes-asc') return 'likes';
  if (key === 'collected-desc' || key === 'collected-asc') return 'collected';
  return null;
}

/** The value the key compares, or null when this row does not carry it. */
function keyValue(row: Sortable, dimension: SortDimension): number | null {
  const raw = dimension === 'likes' ? row.likes : row.collectedAt;
  /* The only test is "is there an observed number here". `null` — and anything
     that is not a finite number — is unknown, and unknown is neither a low score
     nor the epoch. */
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/** Orders `rows` by `key`. The input array is never mutated.

    A likes or collected key ranks only the rows that carry that value; the rest
    come back in `unranked`, in their incoming order, having taken no part in the
    comparison. A name key ranks everything, because every row has a name.

    Ties: a likes tie falls through to name, because two rows with the same count
    still differ by a value both of them state. A collected tie does NOT — it
    keeps the incoming order, so equal seconds come out exactly as the caller had
    them. That is what makes "all 41 signed in one batch" render as the default
    order rather than as an alphabetisation dressed up as chronology. */
export function sortRows<T extends Sortable>(rows: readonly T[], key: SortKey): SortedRows<T> {
  const all = (Array.isArray(rows) ? rows : []).slice();
  if (key === 'default') return {ranked: all, unranked: []};
  if (key === 'name-asc' || key === 'name-desc') {
    const direction = key === 'name-asc' ? 1 : -1;
    all.sort((a, b) => direction * byNameThenId(a, b));
    return {ranked: all, unranked: []};
  }
  const dimension = sortDimension(key);
  if (dimension === null) return {ranked: all, unranked: []};
  const ranked: {row: T; value: number; at: number}[] = [];
  const unranked: T[] = [];
  for (const row of all) {
    const value = keyValue(row, dimension);
    if (value === null) unranked.push(row);
    else ranked.push({row, value, at: ranked.length});
  }
  const direction = key === 'likes-desc' || key === 'collected-desc' ? -1 : 1;
  ranked.sort((a, b) => {
    if (a.value !== b.value) return direction * (a.value - b.value);
    /* The incoming index is carried explicitly rather than relying on the sort
       being stable, so the tie rule is stated by this module and not by whatever
       the host engine happens to do. */
    return dimension === 'likes' ? byNameThenId(a.row, b.row) : a.at - b.at;
  });
  return {ranked: ranked.map(item => item.row), unranked};
}
