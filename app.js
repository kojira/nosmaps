(() => {
  'use strict';

  const {tools, statuses} = window.NOSMAPS_DATA;
  const i18n = window.NOSMAPS_I18N;
  const icons = window.NOSMAPS_ICONS;
  const t = (key, variables) => i18n.t(key, variables);
  const iconSvg = name => icons.svg(name);
  const categories = ['clients', 'relay', 'identity', 'media', 'analytics', 'dev'];
  const state = {
    screen: location.hash.startsWith('#concept-') ? 'app' : 'home',
    mode: (location.hash.match(/^#concept-([abc])$/i)?.[1] || 'A').toUpperCase(),
    query: '', category: 'all', status: 'all', platform: 'all', purpose: '', compare: [], sort: 'name',
    uiState: new URLSearchParams(location.search).get('state') || 'normal',
    dialogs: {detail: null, contribution: null}, contributionDrafts: {}
  };
  const main = document.querySelector('#main');
  const detailDialog = document.querySelector('#detail-dialog');
  const contributionDialog = document.querySelector('#contribute-dialog');
  const dialogOpeners = new WeakMap();
  let lastInteractive = null;

  const esc = value => String(value).replace(/[&<>'"]/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character]));
  const category = id => i18n.value(`categories.${id}`);
  const purposeList = () => i18n.value('purposes');
  const toolDescription = tool => category(tool.category).description;
  const metadataValues = value => value == null ? [] : Array.isArray(value) ? value.flatMap(metadataValues) : typeof value === 'object' ? Object.values(value).flatMap(metadataValues) : [String(value)];
  const toolSearchText = tool => [
    tool.name, tool.platform, ...metadataValues(tool.description), ...metadataValues(tool.tags), ...metadataValues(tool.summary),
    ...metadataValues(tool.aliases), ...metadataValues(tool.purposes), ...metadataValues(tool.categoryLabel),
    ...['ja', 'en'].flatMap(language => {
      const item = i18n.value(`categories.${tool.category}`, language);
      return item ? [item.name, item.description] : [];
    })
  ].join(' ').toLowerCase();
  const license = tool => /^(MIT|AGPL)/.test(tool.license) ? tool.license : t('unknown');
  const languageControl = compact => `<div class="language-switch${compact ? ' compact' : ''}" role="group" aria-label="${esc(t('language'))}"><button type="button" data-language="ja" aria-pressed="${i18n.language === 'ja'}">日本語</button><button type="button" data-language="en" aria-pressed="${i18n.language === 'en'}">English</button></div>`;

  function routeHash() {
    history.replaceState(null, '', state.screen === 'home' ? '#home' : `#concept-${state.mode.toLowerCase()}`);
  }

  function renderChrome() {
    document.title = t('title');
    document.querySelector('meta[name="description"]').content = t('description');
    document.querySelector('#skip-link').textContent = t('skip');
    document.querySelector('#site-header').innerHTML = `<a class="brand" href="#home" data-action="home" aria-label="nosmaps · ${esc(t('nav.home'))}"><span class="brand-mark" aria-hidden="true">N</span><span>nosmaps</span></a><nav aria-label="${esc(t('nav.home'))}"><button class="ghost" data-action="home">${esc(t('nav.home'))}</button><a class="ghost nav-link" href="nip-explorer.html">${esc(t('nav.explorer'))}</a><button class="ghost" data-action="open-contribution" data-kind="submit">${esc(t('nav.submit'))}</button><button class="ghost" data-action="open-contribution" data-kind="curate">${esc(t('nav.curate'))}</button><button class="ghost" data-action="open-contribution" data-kind="correction">${esc(t('nav.correction'))}</button></nav>${languageControl(false)}`;
    const banner = document.querySelector('#offline-banner');
    banner.textContent = t('explorer.offlineBanner');
    banner.hidden = state.uiState !== 'offline';
  }

  function conceptCard(letter) {
    const item = i18n.value(`concepts.${letter}`);
    const action = letter === 'D'
      ? `<a class="primary link-button" href="nip-explorer.html">${esc(t('concepts.open', {letter}))}</a>`
      : `<button class="primary" data-action="open-mode" data-mode="${letter}">${esc(t('concepts.open', {letter}))}</button>`;
    return `<article class="concept-card concept-card-${letter.toLowerCase()}"><span class="letter" aria-hidden="true">${letter}</span><h2>${esc(item.title)}</h2><p><strong>${esc(t('concepts.target'))}:</strong> ${esc(item.target)}</p><p>${esc(item.summary)}</p><ul>${item.points.map(point => `<li>${esc(point)}</li>`).join('')}</ul>${action}</article>`;
  }

  function renderHome() {
    state.screen = 'home';
    routeHash();
    const title = t('concepts.heroTitle').split('\n').map(esc).join('<br>');
    main.innerHTML = `<section class="hero"><div class="eyebrow">${esc(t('concepts.heroKicker'))}</div><h1>${title}</h1><p class="lead">${esc(t('concepts.heroLead'))}</p></section><section class="concept-grid" aria-label="${esc(t('concepts.gridLabel'))}">${['A', 'B', 'C', 'D'].map(conceptCard).join('')}</section><section class="principles">${i18n.value('concepts.principles').map(item => `<div class="principle"><strong>${esc(item.title)}</strong><br><span>${esc(item.text)}</span></div>`).join('')}</section>`;
  }

  function categoryButtons() {
    const button = (id, iconName, name, description) => {
      const selected = state.category === id;
      const accessibleName = `${name}: ${description}`;
      return `<button class="category-icon ${selected ? 'selected' : ''}" data-action="category" data-category="${id}" aria-pressed="${selected}" aria-label="${esc(accessibleName)}" title="${esc(accessibleName)}"><span class="category-symbol" aria-hidden="true">${iconSvg(iconName)}</span><span class="category-copy"><span class="category-title">${esc(name)}</span><span class="category-description">${esc(description)}</span></span></button>`;
    };
    return `<div class="category-icon-group" role="group" aria-label="${esc(t('concepts.categoryFilter'))}">${button('all', 'apps', t('all'), t('concepts.allCategoriesDescription'))}${categories.map(id => { const item = category(id); return button(id, item.icon, item.name, item.description); }).join('')}</div>`;
  }

  function purposeMatches(tool) {
    if (!state.purpose) return true;
    return ({read: ['clients'], talk: ['clients'], publish: ['media'], community: ['relay', 'analytics'], keys: ['identity'], relay: ['relay'], observe: ['analytics', 'dev'], build: ['dev']}[state.purpose] || []).includes(tool.category);
  }

  function filtered() {
    const query = state.query.toLowerCase();
    const list = tools.filter(tool => (state.category === 'all' || tool.category === state.category) && (state.status === 'all' || tool.status === state.status) && (state.platform === 'all' || tool.platform === state.platform) && purposeMatches(tool) && (!query || toolSearchText(tool).includes(query)));
    return list.sort((a, b) => state.sort === 'status' ? statuses.indexOf(a.status) - statuses.indexOf(b.status) : a.name.localeCompare(b.name));
  }

  function purposePanel() {
    return `<section class="purpose-panel"><h2>${esc(t('concepts.purposeTitle'))}</h2><p>${esc(t('concepts.purposeHelp'))}</p><div class="purpose-grid">${purposeList().map(item => `<button class="chip ${state.purpose === item.id ? 'selected' : ''}" data-action="purpose" data-purpose="${item.id}" aria-pressed="${state.purpose === item.id}">${esc(item.label)}</button>`).join('')}<button class="chip ${!state.purpose ? 'selected' : ''}" data-action="purpose" data-purpose="" aria-pressed="${!state.purpose}">${esc(t('concepts.allPurposes'))}</button></div></section>`;
  }

  function toolbar(includeCategories = true) {
    return `<section class="toolbar"><div class="field"><label for="search">${esc(t('concepts.search'))}</label><input id="search" type="search" value="${esc(state.query)}" placeholder="${esc(t('concepts.searchPlaceholder'))}"></div>${includeCategories ? categoryButtons() : ''}<div class="field"><label for="status">${esc(t('concepts.status'))}</label><select id="status"><option value="all">${esc(t('all'))}</option>${statuses.map(value => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${esc(t(`statuses.${value}`))}</option>`).join('')}</select></div><div class="field"><label for="platform">${esc(t('concepts.platform'))}</label><select id="platform"><option value="all">${esc(t('all'))}</option>${['Web', 'Desktop', 'Mobile'].map(value => `<option ${state.platform === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div></section>`;
  }

  function statusBadge(tool) { return `<span class="status ${tool.status}">${esc(t(`statuses.${tool.status}`))}</span>`; }

  function toolCard(tool) {
    const checked = state.compare.includes(tool.id);
    return `<article class="tool-card" data-tool-id="${tool.id}"><div class="card-top"><span class="tool-icon" aria-hidden="true">${iconSvg(category(tool.category).icon)}</span>${statusBadge(tool)}</div><h3>${esc(tool.name)}</h3><p>${esc(toolDescription(tool))}</p><div class="tags"><span class="tag">${esc(category(tool.category).name)}</span><span class="tag">${tool.platform}</span></div><p class="status-line"><small>${esc(t('concepts.observed', {date: tool.observed.split(' ')[0]}))}</small></p><div class="card-actions"><button class="secondary" data-action="detail" data-id="${tool.id}">${esc(t('concepts.detail'))}</button><label class="compare-check"><input type="checkbox" data-action="compare" data-id="${tool.id}" ${checked ? 'checked' : ''}> ${esc(t('concepts.compare'))}</label></div></article>`;
  }

  function stateView() {
    if (state.uiState === 'loading') return `<div class="skeleton" aria-label="${esc(t('explorer.loading'))}"><span></span><span></span><span></span></div>`;
    if (state.uiState === 'empty') return `<div class="empty"><h2>${esc(t('explorer.emptyState'))}</h2></div>`;
    if (state.uiState === 'error') return `<div class="empty"><h2>${esc(t('explorer.errorState'))}</h2><button class="secondary" data-action="set-state" data-state="normal">${esc(t('explorer.retry'))}</button></div>`;
    return '';
  }

  function results() {
    const special = stateView();
    if (special) return special;
    const list = filtered();
    const partial = state.uiState === 'partial' ? `<div class="partial-note" role="status">${esc(t('explorer.partialState'))}</div>` : '';
    if (!list.length) return `<div class="empty"><h2>${esc(t('concepts.noResults'))}</h2><p>${esc(t('concepts.noResultsHelp'))}</p><button class="secondary" data-action="reset">${esc(t('reset'))}</button></div>`;
    return `${partial}<div class="results">${list.map(toolCard).join('')}</div>`;
  }

  function renderCompareDock() {
    document.querySelector('.compare-dock')?.remove();
    if (!state.compare.length || state.screen !== 'app') return;
    document.body.insertAdjacentHTML('beforeend', `<div class="compare-dock"><span><strong>${esc(t('concepts.selected', {count: state.compare.length}))}</strong> <small>${esc(t('concepts.compareRecommended'))}</small></span><button class="primary" data-action="show-compare" ${state.compare.length < 2 ? 'disabled' : ''}>${esc(t('concepts.compareOpen'))}</button><button class="ghost danger" data-action="clear-compare">${esc(t('concepts.clear'))}</button></div>`);
  }

  function renderApp() {
    state.screen = 'app';
    routeHash();
    const meta = i18n.value(`concepts.${state.mode}`);
    main.innerHTML = `<header class="app-head"><div><div class="eyebrow">${esc(t('concepts.mode', {letter: state.mode}))}</div><h1>${esc(meta.title)}</h1><p class="hypothesis">${esc(meta.summary)}</p></div><div class="mode-switch" aria-label="${esc(t('concepts.switchMode'))}">${['A', 'B', 'C'].map(letter => `<button data-action="open-mode" data-mode="${letter}" aria-current="${state.mode === letter}">${letter}</button>`).join('')}</div></header>${state.mode === 'A' ? purposePanel() : ''}${state.mode === 'C' ? `<div class="category-layout"><aside class="category-tree">${categoryButtons()}</aside><section><div class="breadcrumb"><span>${esc(t('concepts.categoryTrail'))}</span><span aria-hidden="true">›</span><strong>${esc(state.category === 'all' ? t('concepts.discoveryFeed') : category(state.category).name)}</strong></div>${toolbar(false)}<div class="results-meta"><strong>${esc(t('concepts.exploring', {count: filtered().length}))}</strong></div>${results()}</section></div>` : `${toolbar()}<div class="results-meta"><strong>${esc(t('concepts.results', {count: filtered().length}))}</strong><label>${esc(t('concepts.sort'))} <select id="sort"><option value="name" ${state.sort === 'name' ? 'selected' : ''}>${esc(t('concepts.name'))}</option><option value="status" ${state.sort === 'status' ? 'selected' : ''}>${esc(t('concepts.status'))}</option></select></label></div>${results()}`}`;
    renderCompareDock();
  }

  function dialogHeader(title, kicker = '') {
    return `<div class="dialog-head"><div>${kicker ? `<div class="eyebrow">${esc(kicker)}</div>` : ''}<h2>${esc(title)}</h2></div><div class="dialog-tools">${languageControl(true)}<button class="icon-btn" type="button" data-action="close-dialog" aria-label="${esc(t('close'))}" title="${esc(t('close'))}">×</button></div></div>`;
  }

  function focusable(dialog) { return [...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length); }
  function openDialog(dialog, opener) { if (!dialog.open) { dialogOpeners.set(dialog, opener || lastInteractive || document.activeElement); dialog.showModal(); focusable(dialog)[0]?.focus(); } }

  function renderDetail(id, shouldOpen = true) {
    const tool = tools.find(item => item.id === id);
    if (!tool) return;
    state.dialogs.detail = {type: 'detail', id};
    detailDialog.setAttribute('aria-label', tool.name);
    document.querySelector('#detail-content').innerHTML = `${dialogHeader(tool.name, category(tool.category).name)}<p>${esc(toolDescription(tool))}</p><p>${statusBadge(tool)}</p><section class="evidence"><div><span class="label">${esc(t('concepts.observedAt'))}</span><br><strong>${esc(tool.observed)}</strong></div><div><span class="label">${esc(t('concepts.basis'))}</span><br>${esc(tool.basis)}</div><div><span class="label">${esc(t('concepts.platformLabel'))}</span><br>${tool.platform}</div><div><span class="label">${esc(t('concepts.license'))}</span><br>${esc(license(tool))}</div></section><div class="card-actions"><button class="primary" data-action="add-and-compare" data-id="${tool.id}">${esc(t('concepts.compareAdd'))}</button><button class="secondary" data-action="open-contribution" data-kind="correction" data-id="${tool.id}">${esc(t('nav.correction'))}</button></div>`;
    if (shouldOpen) openDialog(detailDialog);
  }

  function renderComparison(shouldOpen = true) {
    const selected = state.compare.map(id => tools.find(tool => tool.id === id)).filter(Boolean);
    state.dialogs.detail = {type: 'compare'};
    detailDialog.setAttribute('aria-label', t('concepts.compare'));
    document.querySelector('#detail-content').innerHTML = `${dialogHeader(t('concepts.selected', {count: selected.length}), t('concepts.compare'))}<div class="compare-table"><table><thead><tr><th>${esc(t('concepts.item'))}</th>${selected.map(tool => `<th>${esc(tool.name)}</th>`).join('')}</tr></thead><tbody><tr><th>${esc(t('concepts.status'))}</th>${selected.map(tool => `<td>${statusBadge(tool)}</td>`).join('')}</tr><tr><th>${esc(t('concepts.basis'))}</th>${selected.map(tool => `<td>${esc(tool.basis)}</td>`).join('')}</tr><tr><th>${esc(t('concepts.observedAt'))}</th>${selected.map(tool => `<td>${esc(tool.observed)}</td>`).join('')}</tr><tr><th>${esc(t('concepts.categoryFilter'))}</th>${selected.map(tool => `<td>${esc(category(tool.category).name)}</td>`).join('')}</tr><tr><th>${esc(t('concepts.platform'))}</th>${selected.map(tool => `<td>${tool.platform}</td>`).join('')}</tr></tbody></table></div>`;
    if (shouldOpen) openDialog(detailDialog);
  }

  function renderContribution(kind, id = '', shouldOpen = true) {
    const content = i18n.value(`concepts.contribution.${kind}`) || i18n.value('concepts.contribution.submit');
    const tool = tools.find(item => item.id === id);
    const draftKey = `${kind}:${id}`;
    const draft = state.contributionDrafts[draftKey] || {};
    state.dialogs.contribution = {type: 'contribution', kind, id};
    contributionDialog.setAttribute('aria-label', content[0]);
    document.querySelector('#contribute-content').innerHTML = `${dialogHeader(content[0], content[1])}<form id="contribution-form" data-draft-key="${esc(draftKey)}"><div class="form-grid"><div class="field"><label for="con-name">${esc(t('concepts.contribution.name'))}</label><input id="con-name" name="name" required value="${esc(draft.name ?? tool?.name ?? '')}" placeholder="${esc(t('concepts.contribution.namePlaceholder'))}"></div><div class="field"><label for="con-category">${esc(t('concepts.contribution.category'))}</label><select id="con-category" name="category">${categories.map(value => `<option value="${value}" ${draft.category === value ? 'selected' : ''}>${esc(category(value).name)}</option>`).join('')}</select></div><div class="field full"><label for="con-note">${esc(t('concepts.contribution.note'))}</label><textarea id="con-note" name="note" rows="4" required placeholder="${esc(t('concepts.contribution.notePlaceholder'))}">${esc(draft.note || '')}</textarea></div><label class="full compare-check"><input id="con-author" name="author" type="checkbox" ${draft.author ? 'checked' : ''}> ${esc(t('concepts.contribution.author'))}</label></div><button class="primary" type="submit">${esc(t('concepts.contribution.review'))}</button></form>`;
    if (shouldOpen) openDialog(contributionDialog);
  }

  function captureContributionDraft() {
    const form = document.querySelector('#contribution-form');
    if (!form?.dataset.draftKey) return;
    state.contributionDrafts[form.dataset.draftKey] = {
      name: form.elements.name.value, category: form.elements.category.value, note: form.elements.note.value, author: form.elements.author.checked
    };
  }

  function renderCurrentDialogs() {
    const detail = state.dialogs.detail;
    const contribution = state.dialogs.contribution;
    if (detail?.type === 'detail') renderDetail(detail.id, false);
    if (detail?.type === 'compare') renderComparison(false);
    if (contribution) renderContribution(contribution.kind, contribution.id, false);
  }

  function renderAll() { renderChrome(); state.screen === 'home' ? renderHome() : renderApp(); renderCurrentDialogs(); }
  function toast(message) { const element = document.querySelector('#toast'); element.textContent = message; element.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 1800); }

  document.addEventListener('pointerdown', event => { lastInteractive = event.target.closest('button,a,input,select,textarea,[tabindex]'); }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const dialog = [detailDialog, contributionDialog].filter(item => item.open).at(-1);
    if (!dialog) return;
    const items = focusable(dialog);
    if (!items.length) { event.preventDefault(); dialog.focus(); return; }
    const index = items.indexOf(document.activeElement);
    if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === items.length - 1)) {
      event.preventDefault();
      items[event.shiftKey ? items.length - 1 : 0].focus();
    }
  }, true);
  document.addEventListener('click', event => {
    const language = event.target.closest('[data-language]');
    if (language) {
      captureContributionDraft();
      const openerSelectors = [detailDialog, contributionDialog].map(dialog => {
        const opener = dialogOpeners.get(dialog);
        if (!dialog.open || !opener) return null;
        if (opener.dataset.kind) return `[data-action="open-contribution"][data-kind="${opener.dataset.kind}"]`;
        if (opener.dataset.id) return `[data-action="${opener.dataset.action}"][data-id="${opener.dataset.id}"]`;
        return opener.dataset.action ? `[data-action="${opener.dataset.action}"]` : null;
      });
      i18n.set(language.dataset.language);
      [detailDialog, contributionDialog].forEach((dialog, index) => { const replacement = openerSelectors[index] && document.querySelector(openerSelectors[index]); if (replacement) dialogOpeners.set(dialog, replacement); });
      return;
    }
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const action = control.dataset.action;
    if (action === 'home') { state.screen = 'home'; renderAll(); }
    if (action === 'open-mode') { state.mode = control.dataset.mode; state.category = 'all'; state.purpose = ''; state.screen = 'app'; renderAll(); }
    if (action === 'purpose') { state.purpose = control.dataset.purpose; renderApp(); }
    if (action === 'category') { state.category = control.dataset.category; renderApp(); }
    if (action === 'detail') renderDetail(control.dataset.id);
    if (action === 'show-compare') renderComparison();
    if (action === 'clear-compare') { state.compare = []; renderCompareDock(); document.querySelectorAll('[data-action="compare"]').forEach(input => { input.checked = false; }); }
    if (action === 'open-contribution') renderContribution(control.dataset.kind, control.dataset.id);
    if (action === 'close-dialog') control.closest('dialog').close();
    if (action === 'add-and-compare') { if (!state.compare.includes(control.dataset.id) && state.compare.length < 3) state.compare.push(control.dataset.id); detailDialog.close(); renderApp(); toast(t('concepts.toastAdded')); }
    if (action === 'reset') { Object.assign(state, {query: '', category: 'all', status: 'all', platform: 'all', purpose: '', uiState: 'normal'}); renderApp(); }
    if (action === 'set-state') { state.uiState = control.dataset.state; renderAll(); }
  });

  document.addEventListener('input', event => { if (event.target.id === 'search') { state.query = event.target.value; renderApp(); requestAnimationFrame(() => { const input = document.querySelector('#search'); input?.focus(); input?.setSelectionRange(state.query.length, state.query.length); }); } });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-action="compare"]')) { const id = event.target.dataset.id; if (event.target.checked && state.compare.length >= 3) { event.target.checked = false; toast(t('concepts.compareLimit')); return; } state.compare = event.target.checked ? [...state.compare, id] : state.compare.filter(value => value !== id); renderCompareDock(); }
    if (event.target.id === 'status') { state.status = event.target.value; renderApp(); }
    if (event.target.id === 'platform') { state.platform = event.target.value; renderApp(); }
    if (event.target.id === 'sort') { state.sort = event.target.value; renderApp(); }
  });
  document.addEventListener('submit', event => { if (event.target.id !== 'contribution-form') return; event.preventDefault(); contributionDialog.close(); toast(t('concepts.contribution.confirmed')); });

  [detailDialog, contributionDialog].forEach(dialog => {
    dialog.addEventListener('close', () => { const opener = dialogOpeners.get(dialog); if (dialog === detailDialog) state.dialogs.detail = null; else state.dialogs.contribution = null; if (opener?.isConnected && (!opener.closest('dialog') || opener.closest('dialog').open)) setTimeout(() => opener.focus(), 0); });
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  });

  i18n.onChange(() => renderAll());
  window.__NOSMAPS_SET_STATE__ = next => { state.uiState = next; renderAll(); };
  renderAll();
})();
