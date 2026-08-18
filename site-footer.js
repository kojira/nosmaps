/* Shared site footer: one source link, rendered on every page and kept in the active language. */
(() => {
  'use strict';

  const i18n = window.NOSMAPS_I18N;
  const SOURCE_URL = 'https://github.com/kojira/nosmaps';
  const esc = value => String(value).replace(/[&<>'"]/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character]));

  function render() {
    const footer = document.querySelector('#site-footer');
    if (!footer) return;
    footer.innerHTML = `<div class="site-footer-inner"><a class="footer-source" href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer" aria-label="${esc(i18n.t('footer.sourceNewTab'))}">${esc(i18n.t('footer.source'))}</a></div>`;
  }

  i18n.onChange(render);
  render();
})();
