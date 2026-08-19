/* issue #18: several signers may hold a record under the same identifier.

   NIP-01 replaces on `kind:pubkey:d`, so two signers writing the same `d` are two
   addresses, not one. `selectSoftwareWinners` already groups by coordinate, so
   both survive selection; what was missing is any place that says the two are
   about the same identifier. This module is that place, and nothing more.

   D1 (design-multi-signer-corrections.md §M2.1): we do NOT pick a default. There
   is no `displayed`, no `primary`, no `default` field here, and there is no
   collector key baked in. `records[0]` is simply whatever the caller's own sort
   order put first — a position, not a verdict.

   M1.3: the only thing that puts two records in the same stack is byte equality
   of `d`. No name similarity, no homepage matching, no normalisation on read —
   the `d` in a signed event is never rewritten to make two records meet.

   `observed` is the number of records actually in hand, and `complete` says
   whether relay coverage was complete when they were collected. They are separate
   because "we saw 2" and "there are 2" are different statements (I8): a caller
   with `complete === false` may only say it observed 2, not that 2 exist.

   Pure domain layer: no DOM, no network, no window. */

export interface RecordStack<T> {
  /** The identifier every record in this stack carries, byte for byte. */
  readonly d: string;
  /** The records sharing that `d`, in the order the caller handed them over.
      Flat on purpose: no field of this type ranks one record above another. */
  readonly records: readonly T[];
  /** `records.length`. The count actually observed — never rounded up, never
      capped at how many a view chooses to draw. */
  readonly observed: number;
  /** Whether relay coverage was complete when these records were collected.
      False means `observed` is a floor, and the caller must say so rather than
      presenting it as a total. */
  readonly complete: boolean;
}

/** Groups `rows` by the identifier `keyOf` reads off them.

    Order is entirely the caller's: stacks come out in first-appearance order and
    the records inside a stack keep their incoming relative order. That is what
    makes the stack order follow the active sort key without this module knowing
    a thing about sort keys — and what keeps any particular signer from acquiring
    standing here.

    A row whose key is not a non-empty string is dropped rather than pooled under
    "", which would merge unrelated records into one stack. The input array is
    never mutated, and an empty stack is never produced. */
export function stackRecords<T>(
  rows: readonly T[],
  keyOf: (row: T) => string,
  complete: boolean
): readonly RecordStack<T>[] {
  const order: string[] = [];
  const buckets = new Map<string, T[]>();
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list) {
    const d = keyOf(row);
    if (typeof d !== 'string' || d.length === 0) continue;
    let bucket = buckets.get(d);
    if (!bucket) {
      bucket = [];
      buckets.set(d, bucket);
      order.push(d);
    }
    bucket.push(row);
  }
  const stacks: RecordStack<T>[] = [];
  for (const d of order) {
    const records = buckets.get(d);
    if (!records || records.length === 0) continue;
    stacks.push({d, records, observed: records.length, complete: complete === true});
  }
  return stacks;
}

/** How many cards a stacked view draws at once (M2.2-2). It is a drawing limit
    and nothing else: every record stays reachable, and the count shown to the
    reader is `observed`, never this. */
export const STACK_DRAWN_LIMIT = 3;

/** The records a view draws, capped at `STACK_DRAWN_LIMIT`. The rest are not
    discarded — `stack.records` still holds them, and callers are expected to keep
    them reachable. */
export function drawnRecords<T>(stack: RecordStack<T>): readonly T[] {
  return stack.records.slice(0, STACK_DRAWN_LIMIT);
}
