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
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = {index: 0, paused: false};
  let timer = null;

  const category = tool => (tool.category ? i18n.value(`categories.${tool.category}`) : null) || null;

  function languageControl() {
    return `<div class="language-switch" role="group" aria-label="${esc(t('language'))}"><button type="button" data-language="ja" aria-pressed="${i18n.language === 'ja'}">日本語</button><button type="button" data-language="en" aria-pressed="${i18n.language === 'en'}">English</button></div>`;
  }

  function fact(label, value) {
    return `<div class="slide-fact"><span class="slide-fact-label">${esc(label)}</span><span class="slide-fact-value">${esc(value)}</span></div>`;
  }

  function slide(tool, index) {
    const item = category(tool);
    const label = item?.name || tool.categoryLabel || '';
    const facts = [label ? fact(t('landing.category'), label) : '', tool.platform ? fact(t('landing.platform'), tool.platform) : ''].filter(Boolean);
    const accessibleName = t('landing.slideLabel', {name: tool.name, index: index + 1, total: entries.length});
    return `<article class="carousel-slide" role="group" aria-label="${esc(accessibleName)}" data-slide-index="${index}" ${index === state.index ? '' : 'hidden'}>${item?.icon ? `<span class="slide-icon" aria-hidden="true">${icons.svg(item.icon)}</span>` : ''}<h3 class="slide-name">${esc(tool.name)}</h3>${tool.description ? `<p class="slide-description">${esc(tool.description)}</p>` : ''}${facts.length ? `<div class="slide-facts">${facts.join('')}</div>` : ''}</article>`;
  }

  function carousel() {
    return `<section class="carousel" id="carousel" aria-label="${esc(t('landing.carouselLabel'))}"><div class="carousel-head"><h2>${esc(t('landing.carouselTitle'))}</h2><p class="carousel-sample" id="carousel-sample">${esc(t('landing.sampleNotice'))}</p></div><div class="carousel-viewport" id="carousel-viewport">${entries.map(slide).join('')}</div><div class="carousel-controls"><button class="carousel-nav" type="button" data-carousel-step="-1" aria-controls="carousel-viewport" aria-label="${esc(t('landing.previous'))}" title="${esc(t('landing.previous'))}">‹</button><span class="carousel-position" id="carousel-position">${esc(position())}</span><button class="carousel-nav" type="button" data-carousel-step="1" aria-controls="carousel-viewport" aria-label="${esc(t('landing.next'))}" title="${esc(t('landing.next'))}">›</button></div></section>`;
  }

  function position() {
    return t('landing.position', {index: state.index + 1, total: entries.length});
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

  function show(next) {
    const total = entries.length;
    if (!total) return;
    state.index = ((next % total) + total) % total;
    document.querySelectorAll('.carousel-slide').forEach(element => { element.hidden = Number(element.dataset.slideIndex) !== state.index; });
    const indicator = document.querySelector('#carousel-position');
    if (indicator) indicator.textContent = position();
  }

  function stopRotation() {
    if (timer !== null) { clearInterval(timer); timer = null; }
  }

  function startRotation() {
    stopRotation();
    if (reducedMotion.matches || state.paused || entries.length < 2) return;
    timer = setInterval(() => show(state.index + 1), ROTATION_MS);
  }

  function setPaused(paused) {
    state.paused = paused;
    paused ? stopRotation() : startRotation();
  }

  function bindCarousel() {
    const element = document.querySelector('#carousel');
    if (!element) return;
    element.addEventListener('mouseenter', () => setPaused(true));
    element.addEventListener('mouseleave', () => setPaused(false));
    element.addEventListener('focusin', () => setPaused(true));
    element.addEventListener('focusout', event => { if (!element.contains(event.relatedTarget)) setPaused(false); });
  }

  document.addEventListener('click', event => {
    const language = event.target.closest('[data-language]');
    if (language) { i18n.set(language.dataset.language); return; }
    const step = event.target.closest('[data-carousel-step]');
    if (step) { show(state.index + Number(step.dataset.carouselStep)); startRotation(); }
  });

  reducedMotion.addEventListener('change', startRotation);
  i18n.onChange(render);
  render();
})();
