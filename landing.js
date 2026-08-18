/* Landing page: headline, sample carousel, and the entry point to the feature explorer. */
(() => {
  'use strict';

  const {tools} = window.NOSMAPS_DATA;
  const i18n = window.NOSMAPS_I18N;
  const icons = window.NOSMAPS_ICONS;
  const t = (key, variables) => i18n.t(key, variables);
  const esc = value => String(value).replace(/[&<>'"]/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character]));

  const ROTATION_MS = 2500;
  const entries = tools.filter(tool => tool && tool.name);
  /* The track is padded with a copy of the last PAD entries in front and the first PAD entries
     behind, so stepping past either end keeps sliding into identical-looking content instead of
     snapping back. One step can overshoot by one slot and the centre slide needs one neighbour
     on each side, so two copies per side is the smallest padding that covers every painted slot. */
  const PAD = entries.length > 2 ? 2 : 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /* index is the current entry; position is the same slide expressed as a track slot and is
     allowed to sit one step outside [0, entries.length) until the slide settles. */
  const state = {index: 0, position: 0, paused: false};
  let timer = null;
  let track = null;
  let viewport = null;

  const wrap = position => { const total = entries.length; return total ? ((position % total) + total) % total : 0; };
  /* §21.6: topics are a set and the vocabulary is open. A seed topic has a translated label and an
     icon; a free topic renders as the string the record published, never as "uncategorised". */
  const seedTopics = window.NOSMAPS_DATA.seedTopics || [];
  const primaryTopic = tool => (tool.topics || []).find(topic => seedTopics.includes(topic)) || (tool.topics || [])[0] || null;
  const category = tool => { const topic = primaryTopic(tool); return topic && seedTopics.includes(topic) ? i18n.value(`categories.${topic}`) : topic ? {name: topic, icon: null} : null; };

  function languageControl() {
    return `<div class="language-switch" role="group" aria-label="${esc(t('language'))}"><button type="button" data-language="ja" aria-pressed="${i18n.language === 'ja'}">日本語</button><button type="button" data-language="en" aria-pressed="${i18n.language === 'en'}">English</button></div>`;
  }

  function fact(label, value) {
    return `<div class="slide-fact"><span class="slide-fact-label">${esc(label)}</span><span class="slide-fact-value">${esc(value)}</span></div>`;
  }

  /* Track slots: the padding copies carry no data-slide-index and stay hidden from assistive
     technology, so a screen reader never meets the same entry twice. */
  function slots() {
    const items = entries.map((tool, index) => ({tool, index, clone: false}));
    if (!PAD) return items;
    const before = items.slice(-PAD).map(item => ({...item, clone: true}));
    const after = items.slice(0, PAD).map(item => ({...item, clone: true}));
    return [...before, ...items, ...after];
  }

  function slide(item, slot) {
    const tool = item.tool;
    const record = category(tool);
    const label = (tool.topics || []).map(topic => seedTopics.includes(topic) ? i18n.value(`categories.${topic}`).name : topic).join(' / ');
    /* 一次情報が対応環境を明言したエントリだけが platform を持つ。無い欄は行ごと出さない。 */
    const facts = [label ? fact(t('landing.category'), label) : '', tool.platformText ? fact(t('landing.platform'), tool.platformText) : ''].filter(Boolean);
    const accessibleName = t('landing.slideLabel', {name: tool.name, index: item.index + 1, total: entries.length});
    const identity = item.clone ? 'data-clone="true"' : `data-slide-index="${item.index}"`;
    return `<article class="carousel-slide" role="group" aria-label="${esc(accessibleName)}" aria-hidden="true" data-slot-index="${slot}" ${identity}>${record?.icon ? `<span class="slide-icon" aria-hidden="true">${icons.svg(record.icon)}</span>` : ''}<h3 class="slide-name">${esc(tool.name)}</h3><p class="slide-description${tool.summaryAbsent ? ' is-unknown' : ''}">${esc(tool.summaryAbsent ? t('explorer.summaryAbsent') : tool.summary)}</p>${facts.length ? `<div class="slide-facts">${facts.join('')}</div>` : ''}</article>`;
  }

  function carousel() {
    return `<section class="carousel" id="carousel" aria-label="${esc(t('landing.carouselLabel'))}"><div class="carousel-head"><h2>${esc(t('landing.carouselTitle'))}</h2></div><div class="carousel-viewport" id="carousel-viewport"><div class="carousel-track" id="carousel-track">${slots().map(slide).join('')}</div></div><div class="carousel-controls"><button class="carousel-nav" type="button" data-carousel-step="-1" aria-controls="carousel-track" aria-label="${esc(t('landing.previous'))}" title="${esc(t('landing.previous'))}">‹</button><span class="carousel-position" id="carousel-position">${esc(position())}</span><button class="carousel-nav" type="button" data-carousel-step="1" aria-controls="carousel-track" aria-label="${esc(t('landing.next'))}" title="${esc(t('landing.next'))}">›</button></div></section>`;
  }

  function position() {
    return t('landing.position', {index: state.index + 1, total: entries.length});
  }

  /* Measured from layout offsets rather than the declared gap, so the step stays correct
     whatever unit the stylesheet uses for the gap and whatever scale a slide is drawn at. */
  function step() {
    if (!track) return 0;
    const slides = track.querySelectorAll('.carousel-slide');
    if (slides.length < 2) return slides.length ? slides[0].offsetWidth : 0;
    return slides[1].offsetLeft - slides[0].offsetLeft;
  }

  function offset() {
    if (!track || !viewport) return 0;
    const first = track.querySelector('.carousel-slide');
    if (!first) return 0;
    return (state.position + PAD) * step() - (viewport.clientWidth - first.offsetWidth) / 2;
  }

  function applyTransform(animate) {
    if (!track) return;
    if (!animate) track.style.transition = 'none';
    track.style.transform = `translate3d(${-Math.round(offset())}px, 0, 0)`;
    if (!animate) { void track.offsetWidth; track.style.transition = ''; }
  }

  /* Bring position back inside the real range. The slot we land on holds the same entry with the
     same neighbours, so the correcting jump is invisible and the wrap reads as continuous. */
  function normalise() {
    const wrapped = wrap(state.position);
    if (wrapped === state.position) return;
    state.position = wrapped;
    applyTransform(false);
  }

  function paint() {
    if (!track) return;
    const centre = state.position + PAD;
    track.querySelectorAll('.carousel-slide').forEach(element => {
      const distance = Number(element.dataset.slotIndex) - centre;
      element.classList.toggle('is-current', distance === 0);
      element.classList.toggle('is-side', Math.abs(distance) === 1);
      if (!element.dataset.clone && Number(element.dataset.slideIndex) === state.index) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', 'true');
    });
    const indicator = document.querySelector('#carousel-position');
    if (indicator) indicator.textContent = position();
  }

  function show(delta) {
    if (!entries.length) return;
    normalise();
    state.position += delta;
    state.index = wrap(state.position);
    applyTransform(true);
    if (reducedMotion.matches) normalise();
    paint();
  }

  function stopRotation() {
    if (timer !== null) { clearInterval(timer); timer = null; }
  }

  function startRotation() {
    stopRotation();
    if (reducedMotion.matches || state.paused || entries.length < 2) return;
    timer = setInterval(() => show(1), ROTATION_MS);
  }

  function setPaused(paused) {
    state.paused = paused;
    paused ? stopRotation() : startRotation();
  }

  function bindCarousel() {
    const element = document.querySelector('#carousel');
    track = document.querySelector('#carousel-track');
    viewport = document.querySelector('#carousel-viewport');
    if (!element || !track) return;
    element.addEventListener('mouseenter', () => setPaused(true));
    element.addEventListener('mouseleave', () => setPaused(false));
    element.addEventListener('focusin', () => setPaused(true));
    element.addEventListener('focusout', event => { if (!element.contains(event.relatedTarget)) setPaused(false); });
    track.addEventListener('transitionend', event => {
      if (event.target !== track || event.propertyName !== 'transform') return;
      normalise();
      paint();
    });
    state.position = state.index;
    applyTransform(false);
    paint();
  }

  function render() {
    document.title = t('title');
    document.querySelector('meta[name="description"]').content = t('description');
    document.querySelector('#skip-link').textContent = t('skip');
    document.querySelector('#site-header').innerHTML = `<a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">N</span><span>nosmaps</span></a>${languageControl()}`;
    document.querySelector('#main').innerHTML = `<section class="hero"><h1>${esc(t('landing.headline'))}</h1><p class="lead">${esc(t('landing.lead'))}</p><p class="hero-actions"><a class="primary link-button" href="nip-explorer.html">${esc(t('landing.explorerCta'))}</a></p><p class="hero-help">${esc(t('landing.explorerHelp'))}</p></section>${carousel()}`;
    bindCarousel();
    startRotation();
  }

  document.addEventListener('click', event => {
    const language = event.target.closest('[data-language]');
    if (language) { i18n.set(language.dataset.language); return; }
    const control = event.target.closest('[data-carousel-step]');
    if (control) { show(Number(control.dataset.carouselStep)); startRotation(); }
  });

  window.addEventListener('resize', () => applyTransform(false));
  reducedMotion.addEventListener('change', () => { applyTransform(false); startRotation(); });
  i18n.onChange(render);
  render();
})();
