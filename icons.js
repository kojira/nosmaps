/* Local Material Design-style SVG icons shared by all public pages. */
(() => {
  'use strict';

  const paths = {
    apps: 'M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z',
    tag: 'M21.4 11.6l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .5.2 1 .6 1.4l9 9c.4.4.9.6 1.4.6s1-.2 1.4-.6l7-7c.4-.4.6-.9.6-1.4s-.2-1-.6-1.4zM6.5 8A1.5 1.5 0 1 1 6.5 5a1.5 1.5 0 0 1 0 3z',
    smartphone: 'M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14zm-6 3h2v-1h-2v1z',
    dns: 'M20 13H4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zM6 18.5A1.5 1.5 0 1 1 6 15a1.5 1.5 0 0 1 0 3.5zM20 3H4c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM6 8.5A1.5 1.5 0 1 1 6 5a1.5 1.5 0 0 1 0 3.5z',
    key: 'M7 14a5 5 0 1 1 4.9-6H22v4h-2v2h-2v2h-6.1A5 5 0 0 1 7 14zm0-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    movie: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zM4 10h16v9H4v-9z',
    analytics: 'M5 9.2h3V19H5V9.2zM10.5 5h3v14h-3V5zM16 12h3v7h-3v-7z',
    code: 'M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
    edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    mail: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z',
    search: 'M9.5 3a6.5 6.5 0 1 0 3.98 11.64L19.85 21 21 19.85l-6.36-6.37A6.5 6.5 0 0 0 9.5 3zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z',
    image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 11.5 11 14.51 14.5 10l4.5 6H5l3.5-4.5z',
    notifications: 'M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
    account: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    wallet: 'M21 7V5c0-1.1-.9-2-2-2H5C3.34 3 2 4.34 2 6v12c0 1.66 1.34 3 3 3h16V9h-4c-1.1 0-2-.9-2-2H5a1 1 0 0 1 0-2h14v2h2zm-4 4h2v4h-2v-4z',
    article: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-8v-2h8v2zm0-4h-8v-2h8v2zm0-4h-8V7h8v2z',
    groups: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3a3 3 0 0 0 0 6zM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z'
  };

  function svg(name, className = 'material-icon') {
    const path = paths[name] || paths.apps;
    return `<svg class="${className}" viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="${path}"></path></svg>`;
  }

  /* ---------------------------------------------------------------------- */
  /* issue #3 — the entry's own icon.                                        */
  /*                                                                         */
  /* One box for every entry, at one size (.entity-icon in styles.css), so a */
  /* third-party image that is slow or that never arrives cannot move the    */
  /* row it sits in. What goes in the box is decided by the record and by    */
  /* nothing else: `tool.icon.url` is a URL that was requested and answered  */
  /* with an image (the probe in icons-probe.md, stored with the markup that */
  /* declared it in tools/build-data.mjs). A record with `icon: null` gets   */
  /* the initial-letter placeholder — no favicon is guessed from a homepage, */
  /* no URL is derived by convention. Absent stays absent.                   */
  /* ---------------------------------------------------------------------- */

  /** @param {unknown} value */
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Code-point aware, so a name that starts outside the BMP yields its whole
     first character. An empty or missing name yields "": the box then says
     nothing, rather than saying "undefined". */
  /** @param {NosmapsTool | null | undefined} tool */
  function initialOf(tool) {
    const name = typeof (tool && tool.name) === 'string' ? String(tool && tool.name).trim() : '';
    const first = [...name][0];
    return first ? first.toLocaleUpperCase() : '';
  }

  /** @param {string} initial */
  function placeholderMarkup(initial) {
    /* The letter is painted by CSS (::before content:attr(data-entity-initial)),
       so it stands in for a logo without joining the card's text. */
    return `<span class="entity-icon is-placeholder" data-entity-initial="${esc(initial)}" aria-hidden="true"></span>`;
  }

  /** @param {string} initial */
  function placeholderElement(initial) {
    const span = document.createElement('span');
    span.className = 'entity-icon is-placeholder';
    span.setAttribute('data-entity-initial', initial);
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  /** @param {NosmapsTool | null | undefined} tool */
  function entity(tool) {
    const initial = initialOf(tool);
    const icon = tool ? tool.icon : null;
    const url = icon && typeof icon.url === 'string' ? icon.url : '';
    if (!url) return placeholderMarkup(initial);
    /* The name is right next to it, so the image is decorative: empty alt and
       aria-hidden keep it from being read twice. It carries the initial too,
       because that is what it degrades to if the host fails. */
    return `<img class="entity-icon" src="${esc(url)}" data-entity-initial="${esc(initial)}" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
  }

  /* A third-party host that fails is not a broken page and must not be a broken
     image: the <img> is replaced by the same-size letter box it would have had
     if no URL had ever been recorded. `error` does not bubble from an image, so
     this listens in the capture phase, once, for every icon on every page —
     including the ones re-rendered into the DOM later. */
  document.addEventListener('error', event => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement) || !target.classList.contains('entity-icon')) return;
    target.replaceWith(placeholderElement(target.getAttribute('data-entity-initial') || ''));
  }, true);

  window.NOSMAPS_ICONS = Object.freeze({svg, entity, names: Object.freeze(Object.keys(paths))});
})();
