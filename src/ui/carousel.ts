/* Landing page: headline, sample carousel, and the entry point to the feature
   explorer. UI layer: renders markup and binds DOM events. */

import type {Data, Tool} from '../domain/entry.ts';
import {i18n, type I18nVariables, type Language} from './i18n.ts';
import {icons} from './icons.ts';

const ROTATION_MS = 2500;

function esc(value: unknown): string {
  return String(value).replace(/[&<>'"]/g, character => (
    {'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character] ?? character
  ));
}

const t = (key: string, variables?: I18nVariables): string => i18n.t(key, variables);

/** A slot in the track: a real entry, or a padding copy of one. */
interface Slot {
  readonly tool: Tool;
  readonly index: number;
  readonly clone: boolean;
}

export function mountLanding(data: Data): void {
  const entries: readonly Tool[] = data.tools.filter(tool => tool && tool.name);
  /* The track is padded with a copy of the last PAD entries in front and the first PAD entries
     behind, so stepping past either end keeps sliding into identical-looking content instead of
     snapping back. One step can overshoot by one slot and the centre slide needs one neighbour
     on each side, so two copies per side is the smallest padding that covers every painted slot. */
  const PAD = entries.length > 2 ? 2 : 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  /* index is the current entry; position is the same slide expressed as a track slot and is
     allowed to sit one step outside [0, entries.length) until the slide settles. */
  const state = {index: 0, position: 0, paused: false};
  let timer: ReturnType<typeof setInterval> | null = null;
  let track: HTMLElement | null = null;
  let viewport: HTMLElement | null = null;

  const wrap = (position: number): number => {
    const total = entries.length;
    return total ? ((position % total) + total) % total : 0;
  };
  /* §21.6: topics are a set and the vocabulary is open. A seed topic has a translated label; a
     free topic renders as the string the record published, never as "uncategorised". */
  const seedTopics: readonly string[] = data.seedTopics ?? [];

  function languageControl(): string {
    return `<div class="language-switch" role="group" aria-label="${esc(t('language'))}"><button type="button" data-language="ja" aria-pressed="${i18n.language === 'ja'}">日本語</button><button type="button" data-language="en" aria-pressed="${i18n.language === 'en'}">English</button></div>`;
  }

  function fact(label: string, value: string): string {
    return `<div class="slide-fact"><span class="slide-fact-label">${esc(label)}</span><span class="slide-fact-value">${esc(value)}</span></div>`;
  }

  /* Track slots: the padding copies carry no data-slide-index and stay hidden from assistive
     technology, so a screen reader never meets the same entry twice. */
  function slots(): readonly Slot[] {
    const items: Slot[] = entries.map((tool, index) => ({tool, index, clone: false}));
    if (!PAD) return items;
    const before = items.slice(-PAD).map(item => ({...item, clone: true}));
    const after = items.slice(0, PAD).map(item => ({...item, clone: true}));
    return [...before, ...items, ...after];
  }

  /** The label for a topic: a seed topic is translated, a free topic is printed
      as the record published it. */
  function topicLabel(topic: string): string {
    if (!seedTopics.includes(topic)) return topic;
    const node = i18n.value(`categories.${topic}`);
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      const name = (node as {readonly name?: unknown}).name;
      if (typeof name === 'string') return name;
    }
    return topic;
  }

  function slide(item: Slot, slot: number): string {
    const tool = item.tool;
    const label = (tool.topics ?? []).map(topicLabel).join(' / ');
    /* 一次情報が対応環境を明言したエントリだけが platform を持つ。無い欄は行ごと出さない。 */
    const facts = [
      label ? fact(t('landing.category'), label) : '',
      tool.platformText ? fact(t('landing.platform'), tool.platformText) : ''
    ].filter(Boolean);
    const accessibleName = t('landing.slideLabel', {
      name: tool.name, index: item.index + 1, total: entries.length
    });
    const identity = item.clone ? 'data-clone="true"' : `data-slide-index="${item.index}"`;
    /* issue #2: a slide is the entry, so the whole slide is one link into the explorer opened on
       that entry. `tabindex` starts at -1 on every slide including the padding copies: only the
       centred slide is exposed to assistive technology, and paint() hands it the tab stop. */
    const href = `nip-explorer.html?tool=${encodeURIComponent(tool.id)}`;
    /* issue #3: the slot that used to hold a generic category glyph now holds the entry's own
       icon, or its initial-letter box where no icon was verified. The category is already stated
       in words in the fact row below, so the glyph was saying nothing the slide did not say. */
    const body = `<div class="slide-identity">${icons.entity(tool)}<h3 class="slide-name">${esc(tool.name)}</h3></div><p class="slide-description${tool.summaryAbsent ? ' is-unknown' : ''}">${esc(tool.summaryAbsent ? t('explorer.summaryAbsent') : tool.summary)}</p>${facts.length ? `<div class="slide-facts">${facts.join('')}</div>` : ''}`;
    return `<article class="carousel-slide" role="group" aria-label="${esc(accessibleName)}" aria-hidden="true" data-slot-index="${slot}" ${identity}><a class="slide-link" href="${esc(href)}" data-slide-link="${esc(tool.id)}" aria-label="${esc(t('landing.openEntry', {name: tool.name}))}" tabindex="-1">${body}</a></article>`;
  }

  function position(): string {
    return t('landing.position', {index: state.index + 1, total: entries.length});
  }

  function carousel(): string {
    return `<section class="carousel" id="carousel" aria-label="${esc(t('landing.carouselLabel'))}"><div class="carousel-head"><h2>${esc(t('landing.carouselTitle'))}</h2></div><div class="carousel-viewport" id="carousel-viewport"><div class="carousel-track" id="carousel-track">${slots().map(slide).join('')}</div></div><div class="carousel-controls"><button class="carousel-nav" type="button" data-carousel-step="-1" aria-controls="carousel-track" aria-label="${esc(t('landing.previous'))}" title="${esc(t('landing.previous'))}">‹</button><span class="carousel-position" id="carousel-position">${esc(position())}</span><button class="carousel-nav" type="button" data-carousel-step="1" aria-controls="carousel-track" aria-label="${esc(t('landing.next'))}" title="${esc(t('landing.next'))}">›</button></div></section>`;
  }

  /* Measured from layout offsets rather than the declared gap, so the step stays correct
     whatever unit the stylesheet uses for the gap and whatever scale a slide is drawn at. */
  function step(): number {
    if (!track) return 0;
    const slides = track.querySelectorAll<HTMLElement>('.carousel-slide');
    const first = slides[0];
    const second = slides[1];
    if (slides.length < 2 || !second) return first ? first.offsetWidth : 0;
    return second.offsetLeft - (first?.offsetLeft ?? 0);
  }

  function offset(): number {
    if (!track || !viewport) return 0;
    const first = track.querySelector<HTMLElement>('.carousel-slide');
    if (!first) return 0;
    return (state.position + PAD) * step() - (viewport.clientWidth - first.offsetWidth) / 2;
  }

  function applyTransform(animate: boolean): void {
    if (!track) return;
    if (!animate) track.style.transition = 'none';
    track.style.transform = `translate3d(${-Math.round(offset())}px, 0, 0)`;
    if (!animate) {
      void track.offsetWidth;
      track.style.transition = '';
    }
  }

  /* Bring position back inside the real range. The slot we land on holds the same entry with the
     same neighbours, so the correcting jump is invisible and the wrap reads as continuous. */
  function normalise(): void {
    const wrapped = wrap(state.position);
    if (wrapped === state.position) return;
    state.position = wrapped;
    applyTransform(false);
  }

  function paint(): void {
    if (!track) return;
    const centre = state.position + PAD;
    track.querySelectorAll<HTMLElement>('.carousel-slide').forEach(element => {
      const distance = Number(element.dataset['slotIndex']) - centre;
      element.classList.toggle('is-current', distance === 0);
      element.classList.toggle('is-side', Math.abs(distance) === 1);
      const exposed = !element.dataset['clone']
        && Number(element.dataset['slideIndex']) === state.index;
      if (exposed) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', 'true');
      /* Only the exposed slide's link is a tab stop. A focusable link inside an aria-hidden
         slide would be reachable by Tab and invisible to a screen reader at the same time. */
      const link = element.querySelector('.slide-link');
      if (link instanceof HTMLAnchorElement) link.tabIndex = exposed ? 0 : -1;
    });
    const indicator = document.querySelector('#carousel-position');
    if (indicator) indicator.textContent = position();
  }

  function show(delta: number): void {
    if (!entries.length) return;
    normalise();
    state.position += delta;
    state.index = wrap(state.position);
    applyTransform(true);
    if (reducedMotion.matches) normalise();
    paint();
  }

  function stopRotation(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function startRotation(): void {
    stopRotation();
    if (reducedMotion.matches || state.paused || entries.length < 2) return;
    timer = setInterval(() => show(1), ROTATION_MS);
  }

  function setPaused(paused: boolean): void {
    state.paused = paused;
    if (paused) stopRotation();
    else startRotation();
  }

  function bindCarousel(): void {
    const element = document.querySelector('#carousel');
    track = document.querySelector<HTMLElement>('#carousel-track');
    viewport = document.querySelector<HTMLElement>('#carousel-viewport');
    if (!element || !track) return;
    element.addEventListener('mouseenter', () => setPaused(true));
    element.addEventListener('mouseleave', () => setPaused(false));
    element.addEventListener('focusin', () => setPaused(true));
    element.addEventListener('focusout', event => {
      const related = event instanceof FocusEvent ? event.relatedTarget : null;
      if (!(related instanceof Node) || !element.contains(related)) setPaused(false);
    });
    track.addEventListener('transitionend', event => {
      if (event.target !== track || event.propertyName !== 'transform') return;
      normalise();
      paint();
    });
    state.position = state.index;
    applyTransform(false);
    paint();
  }

  function render(): void {
    document.title = t('title');
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = t('description');
    const skip = document.querySelector('#skip-link');
    if (skip) skip.textContent = t('skip');
    const header = document.querySelector('#site-header');
    if (header) {
      header.innerHTML = `<a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">N</span><span>nosmaps</span></a>${languageControl()}`;
    }
    const main = document.querySelector('#main');
    if (main) {
      main.innerHTML = `<section class="hero"><h1>${esc(t('landing.headline'))}</h1><p class="lead">${esc(t('landing.lead'))}</p><p class="hero-actions"><a class="primary link-button" href="nip-explorer.html">${esc(t('landing.explorerCta'))}</a></p><p class="hero-help">${esc(t('landing.explorerHelp'))}</p></section>${carousel()}`;
    }
    bindCarousel();
    startRotation();
  }

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const language = target.closest<HTMLElement>('[data-language]');
    if (language) {
      const next: string | undefined = language.dataset['language'];
      if (next !== undefined) i18n.set(next as Language);
      return;
    }
    const control = target.closest<HTMLElement>('[data-carousel-step]');
    if (control) {
      show(Number(control.dataset['carouselStep']));
      startRotation();
    }
  });

  window.addEventListener('resize', () => applyTransform(false));
  reducedMotion.addEventListener('change', () => {
    applyTransform(false);
    startRotation();
  });
  i18n.onChange(render);
  render();
}
