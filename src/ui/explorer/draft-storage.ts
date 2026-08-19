/* §W1.4: keeping what the user typed.

   publish can fail for reasons entirely outside the user's reach (§W8), so the
   typed characters are not thrown away with the failure. Exactly five fields are
   held — no key, no signature, nothing derived — as one entry in localStorage.

   The stored draft is cleared ONLY when the publication was actually observed.
   A failure, a refusal or an undetermined outcome all keep it, because none of
   those is evidence that the record is out there.

   Every access is guarded: a browser that refuses storage (private mode) still
   renders and still publishes; it just does not remember. */

export const DRAFT_STORAGE_KEY = 'nosmaps.publish.draft';

export interface PublishDraftFields {
  dLocal: string;
  name: string;
  summary: string;
  homepage: string;
  topics: string;
}

export const DRAFT_FIELDS = ['dLocal', 'name', 'summary', 'homepage', 'topics'] as const;

export type DraftField = (typeof DRAFT_FIELDS)[number];

export function saveDraft(draft: PublishDraftFields): void {
  try {
    const stored: Record<string, string> = {};
    for (const field of DRAFT_FIELDS) stored[field] = draft[field];
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(stored));
  } catch { /* storage refused; the form still works, it just is not remembered */ }
}

export function clearStoredDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch { /* nothing to clear if nothing could be stored */ }
}

/** Copy whatever was stored back onto the live draft. Only string fields are
    taken: a stored value of the wrong shape is ignored rather than coerced, so a
    corrupted entry can never put a non-string into the form. */
export function restoreDraft(draft: PublishDraftFields): void {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return;
  }
  if (!stored || typeof stored !== 'object') return;
  const record = stored as Partial<Record<DraftField, unknown>>;
  for (const field of DRAFT_FIELDS) {
    const value = record[field];
    if (typeof value === 'string') draft[field] = value;
  }
}
