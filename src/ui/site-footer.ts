/* Shared site footer: one source link, rendered on every page and kept in the
   active language. UI layer. */

import {i18n} from './i18n.ts';

const SOURCE_URL = 'https://github.com/kojira/nosmaps';

function esc(value: unknown): string {
  return String(value).replace(/[&<>'"]/g, character => (
    {'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character] ?? character
  ));
}

function render(): void {
  const footer = document.querySelector('#site-footer');
  if (!footer) return;
  footer.innerHTML = `<div class="site-footer-inner"><a class="footer-source" href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer" aria-label="${esc(i18n.t('footer.sourceNewTab'))}">${esc(i18n.t('footer.source'))}</a></div>`;
}

/** Mount the footer and keep it in the active language. */
export function mountSiteFooter(): void {
  i18n.onChange(render);
  render();
}
