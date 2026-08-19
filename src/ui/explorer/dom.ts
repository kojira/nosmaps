/* The explorer's DOM primitives. Lifted out of nip-explorer.js unchanged in
   behaviour; typed so that "the element might not be there" is a value the caller
   has to handle rather than a crash at render time. */

/** Escape for interpolation into markup. Identical to the original `esc`. */
export function esc(value: unknown): string {
  const map: Readonly<Record<string, string>> = {'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'};
  return String(value).replace(/[&<>'"]/g, character => map[character] ?? character);
}

/** `document.querySelector`, typed. Returns null when absent — the original
    `$` did too; the difference is that the type now says so. */
export function $(selector: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(selector);
}

export function requireElement(selector: string): HTMLElement {
  const element = $(selector);
  if (!element) throw new Error(`nosmaps: ${selector} is missing from the page`);
  return element;
}

export const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function focusableElements(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
}
