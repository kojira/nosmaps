(() => {
  'use strict';

  const {tools, nipCatalog} = window.NOSMAPS_DATA;
  const i18n = window.NOSMAPS_I18N;
  const icons = window.NOSMAPS_ICONS;
  const t = (key, variables) => i18n.t(key, variables);
  const iconSvg = name => icons.svg(name);
  const categories = ['clients', 'relay', 'identity', 'media', 'analytics', 'dev'];
  const nipByNumber = Object.fromEntries(nipCatalog.map(nip => [nip.number, nip]));
  const featureDefinitions = [
    ['posts', 'edit', ['01', '09', '25']], ['dm', 'mail', ['44']], ['search', 'search', ['01', '19', '21']], ['media', 'image', ['01', '19']],
    ['notifications', 'notifications', ['25', '57']], ['accounts', 'account', ['19', '46']], ['signing', 'key', ['46']], ['wallet', 'wallet', ['47', '57']],
    ['longform', 'article', ['23']], ['community', 'groups', ['01', '42', '78']]
  ].map(([id, icon, nips]) => ({id, icon, nips}));
  const featureById = Object.fromEntries(featureDefinitions.map(feature => [feature.id, feature]));
  const validStates = ['normal', 'loading', 'empty', 'error', 'partial', 'offline', 'stale', 'incomplete', 'unavailable'];
  const params = new URLSearchParams(location.search);
  const requestedState = params.get('state');
  const relayRequested = params.get('relay') === '1';
  let relayState = null;
  const state = {
    features: [], query: '', platform: 'all', category: 'all', toolStatus: 'all', support: 'all', delivery: 'all', oss: 'all',
    includeDead: false, savedOnly: false, nipQuery: '', compare: [], likes: {}, bookmarks: {}, reviews: {}, reviewVotes: {}, reviewDrafts: {},
    uiState: validStates.includes(requestedState) ? requestedState : 'normal'
  };

  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>'"]/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character]));
  const category = id => i18n.value(`categories.${id}`);
  const localizedFeature = (id, language = i18n.language) => {
    const values = i18n.value(`explorer.features.${id}`, language);
    return {...featureById[id], name: values[0], scene: values[1], aliases: values[2]};
  };
  const featureList = language => featureDefinitions.map(feature => localizedFeature(feature.id, language));
  const toolDescription = (tool, language = i18n.language) => i18n.value(`categories.${tool.category}.description`, language);
  const metadataValues = value => value == null ? [] : Array.isArray(value) ? value.flatMap(metadataValues) : typeof value === 'object' ? Object.values(value).flatMap(metadataValues) : [String(value)];
  const displayLicense = tool => /^(MIT|AGPL)/.test(tool.license) ? tool.license : t('unknown');
  const isOss = tool => /^(MIT|AGPL)/.test(tool.license);
  const delivery = tool => tool.platform === 'Web' ? 'web' : tool.platform === 'Mobile' ? 'mobile' : 'installed';
  const deliveryLabel = value => ({web: t('explorer.webApp'), mobile: t('explorer.mobileApp'), installed: t('explorer.installed')}[value]);
  const statusLabel = status => t(`support.${status}`);
  const els = {
    query: $('#feature-query'), chips: $('#feature-chips'), results: $('#tool-results'), resultCount: $('#result-count'), selected: $('#selected-feature-summary'),
    condition: $('#condition-summary'), activeFilterCount: $('#active-filter-count'), uiState: $('#ui-state-view'), offline: $('#offline-banner'),
    compareActions: $('#compare-actions'), compareSummary: $('#compare-summary'), openCompare: $('#open-compare'), filterDetails: $('#filter-details'),
    nipList: $('#nip-list'), nipCount: $('#nip-count'), evidenceDialog: $('#evidence-dialog'), evidenceContent: $('#evidence-content'),
    compareDialog: $('#compare-dialog'), compareContent: $('#compare-content'), reviewDialog: $('#review-dialog'), reviewContent: $('#review-content'),
    profileDialog: $('#profile-dialog'), profileContent: $('#profile-content'), galleryDialog: $('#gallery-dialog'), galleryContent: $('#gallery-content'),
    imageDialog: $('#image-dialog'), imageContent: $('#image-content'), toast: $('#toast')
  };
  const dialogs = [els.evidenceDialog, els.compareDialog, els.reviewDialog, els.profileDialog, els.galleryDialog, els.imageDialog];
  const dialogOpeners = new WeakMap();
  const dialogContexts = new WeakMap();
  let lastInteractive = null;

  function languageControl(compact = false) {
    return `<div class="language-switch${compact ? ' compact' : ''}" role="group" aria-label="${esc(t('language'))}"><button type="button" data-language="ja" aria-pressed="${i18n.language === 'ja'}">日本語</button><button type="button" data-language="en" aria-pressed="${i18n.language === 'en'}">English</button></div>`;
  }

  function featureName(id) { return localizedFeature(id).name; }
  function supportRecords(tool, feature) { return feature.nips.map(number => tool.nips.find(record => record.nip === number)).filter(Boolean); }
  function featureSupportRecord(tool, feature) {
    const records = supportRecords(tool, feature);
    if (!records.length) return null;
    const rank = {implemented: 4, partial: 3, planned: 2, unknown: 1};
    return records.reduce((best, record) => rank[record.status] > rank[best.status] ? record : best);
  }
  function featureSupport(tool, feature) { return featureSupportRecord(tool, feature)?.status || null; }
  function selectedFeatures(source = state) { return source.features.map(id => localizedFeature(id)).filter(Boolean); }
  function observerLabel(value) { return value.includes('community') ? t('observers.community') : value.includes('maintainer') ? t('observers.maintainer') : t('observers.crawler'); }
  function evidenceText(status) { return t(`evidence.${status}`); }
  function nipPurpose(number) { return t(`explorer.nipPurposes.${number}`); }

  function toolMatchesQuery(tool, source = state) {
    const query = source.query.trim().toLowerCase();
    if (!query) return true;
    const featureTerms = ['ja', 'en'].flatMap(language => featureList(language).filter(feature => featureSupport(tool, feature)).flatMap(feature => [feature.name, feature.scene, feature.aliases]));
    const categoryTerms = ['ja', 'en'].flatMap(language => [i18n.value(`categories.${tool.category}.name`, language), toolDescription(tool, language)]);
    const deliveryTerms = ['ja', 'en'].map(language => i18n.t(`explorer.${{web: 'webApp', mobile: 'mobileApp', installed: 'installed'}[delivery(tool)]}`, undefined, language));
    const nipTerms = tool.nips.flatMap(record => { const nip = nipByNumber[record.nip]; return [`NIP-${record.nip}`, `NIP ${record.nip}`, record.nip, nip?.title || '', nip?.purpose || '']; });
    const terms = [tool.name, tool.platform, ...(tool.os || []), ...deliveryTerms, displayLicense(tool), isOss(tool) ? 'OSS open source オープンソース' : '',
      ...metadataValues(tool.description), ...metadataValues(tool.tags), ...metadataValues(tool.summary), ...metadataValues(tool.aliases), ...metadataValues(tool.purposes), ...metadataValues(tool.categoryLabel),
      ...categoryTerms, ...featureTerms, ...nipTerms];
    return terms.join(' ').toLowerCase().includes(query);
  }

  function filteredTools(overrides = {}) {
    const source = {...state, ...overrides};
    const selected = source.features.map(id => featureById[id]).filter(Boolean);
    const nipQuery = source.nipQuery.trim().toLowerCase().replace(/^nip[- ]?/, '');
    return tools.filter(tool => {
      const supports = selected.map(feature => featureSupport(tool, feature));
      const relevant = selected.length ? selected.flatMap(feature => supportRecords(tool, feature)) : tool.nips;
      const nipMatch = !nipQuery || relevant.some(record => { const nip = nipByNumber[record.nip]; return `${record.nip} NIP-${record.nip} ${nip?.title || ''} ${nip?.purpose || ''}`.toLowerCase().includes(nipQuery); });
      return supports.every(Boolean) && toolMatchesQuery(tool, source) && (source.includeDead || tool.status !== 'dead') && (!source.savedOnly || Boolean(source.bookmarks[tool.id])) &&
        (source.platform === 'all' || tool.platform === source.platform || (tool.os || []).includes(source.platform)) && (source.category === 'all' || tool.category === source.category) &&
        (source.toolStatus === 'all' || tool.status === source.toolStatus) && (source.support === 'all' || (supports.length && supports.every(value => value === source.support))) &&
        (source.delivery === 'all' || delivery(tool) === source.delivery) && (source.oss === 'all' || (source.oss === 'yes' ? isOss(tool) : !isOss(tool))) && nipMatch;
    });
  }

  function renderIdentity() {
    document.title = t('explorer.pageTitle');
    $('meta[name="description"]').content = t('explorer.pageDescription');
    $('#skip-link').textContent = t('skip');
    $('#compact-identity').innerHTML = `<a href="index.html" aria-label="${esc(t('explorer.back'))}"><span class="identity-mark" aria-hidden="true">N</span><span>nosmaps</span></a><span aria-hidden="true">/</span><span>${esc(t('explorer.location'))}</span>${languageControl(false)}`;
    $('#search-title').textContent = t('explorer.search');
    els.query.placeholder = t('explorer.searchPlaceholder');
    els.chips.setAttribute('aria-label', t('explorer.featureGroup'));
    $('#results-title').textContent = t('explorer.candidates');
    $('#settings-label').textContent = t('explorer.settings');
    els.openCompare.textContent = t('explorer.compareByFeature');
    $('#clear-compare').textContent = t('explorer.clearSelection');
    $('#nip-reference-title').textContent = t('explorer.evidenceTitle');
    els.offline.textContent = t('explorer.offlineBanner');
  }

  function renderFeatures() {
    els.chips.innerHTML = featureDefinitions.map(definition => {
      const feature = localizedFeature(definition.id);
      const label = `${feature.name} — ${feature.scene}`;
      return `<button class="feature-chip" type="button" aria-pressed="${state.features.includes(feature.id)}" aria-label="${esc(label)}" title="${esc(label)}" data-select-feature="${feature.id}"><span class="feature-symbol" aria-hidden="true">${iconSvg(feature.icon)}</span><span class="feature-chip-label">${esc(feature.name)}</span></button>`;
    }).join('');
  }

  function option(value, label, selected) { return `<option value="${esc(value)}" ${selected === value ? 'selected' : ''}>${esc(label)}</option>`; }
  function categoryFilterButton(id, iconName, name, description) {
    const selected = state.category === id;
    const accessibleName = `${name}: ${description}`;
    return `<button type="button" class="category-icon ${selected ? 'selected' : ''}" data-category-filter="${id}" aria-pressed="${selected}" aria-label="${esc(accessibleName)}" title="${esc(accessibleName)}"><span class="category-symbol" aria-hidden="true">${iconSvg(iconName)}</span><span class="category-copy"><span class="category-title">${esc(name)}</span><span class="category-description">${esc(description)}</span></span></button>`;
  }
  function renderFilterPanel() {
    const wasOpen = els.filterDetails.open;
    $('#feature-filter-grid').innerHTML = `<label class="field">${esc(t('explorer.platform'))}<select id="platform-filter">${option('all', t('all'), state.platform)}${['Web', 'Desktop', 'Mobile', 'Android', 'iOS'].map(value => option(value, value, state.platform)).join('')}</select></label>
      <fieldset class="category-filter"><legend>${esc(t('explorer.categoryGroup'))}</legend><div class="category-icon-group" role="group" aria-label="${esc(t('explorer.categoryGroup'))}">${categoryFilterButton('all', 'apps', t('all'), t('explorer.allCategoriesDescription'))}${categories.map(id => { const item = category(id); return categoryFilterButton(id, item.icon, item.name, item.description); }).join('')}</div></fieldset>
      <label class="field">${esc(t('explorer.updateStatus'))}<select id="tool-status-filter">${option('all', t('explorer.activeStatus'), state.toolStatus)}${['active', 'stale', 'unknown'].map(value => option(value, t(`statuses.${value}`), state.toolStatus)).join('')}</select></label>
      <label class="field">${esc(t('explorer.support'))}<select id="support-filter" aria-describedby="support-filter-help" ${state.features.length ? '' : 'disabled'}>${option('all', t('all'), state.support)}${['implemented', 'partial', 'planned', 'unknown'].map(value => option(value, statusLabel(value), state.support)).join('')}</select><small id="support-filter-help" class="filter-prerequisite">${esc(t('explorer.featureNeeded'))}</small></label>
      <label class="field">${esc(t('explorer.delivery'))}<select id="delivery-filter">${option('all', t('all'), state.delivery)}${['web', 'installed', 'mobile'].map(value => option(value, deliveryLabel(value), state.delivery)).join('')}</select></label>
      <label class="field">${esc(t('explorer.oss'))}<select id="oss-filter">${option('all', t('all'), state.oss)}${option('yes', 'OSS', state.oss)}${option('unknown', t('unknown'), state.oss)}</select></label>
      <label class="include-dead"><input id="include-dead" type="checkbox" ${state.includeDead ? 'checked' : ''}> ${esc(t('explorer.includeDead'))}</label><label class="include-dead"><input id="saved-only" type="checkbox" ${state.savedOnly ? 'checked' : ''}> ${esc(t('explorer.savedOnly'))}</label>
      <label class="field advanced-nip">${esc(t('explorer.nipSearch'))}<input id="nip-query" type="search" value="${esc(state.nipQuery)}" placeholder="46 / remote signing"></label>
      <div class="filter-help"><details><summary>${esc(t('explorer.unknownInfo'))}</summary><p>${esc(t('explorer.unknownHelp'))}</p></details><button class="text-button" type="button" data-reset-all>${esc(t('reset'))}</button></div>`;
    els.filterDetails.open = wasOpen;
  }

  function supportBadge(status) { return `<span class="support-badge ${status}">${esc(statusLabel(status))}</span>`; }
  function resourceLinks(tool) {
    const links = [['site', t('explorer.site')], ['distribution', t('explorer.distribution')], ['docs', t('explorer.docs')]];
    if (isOss(tool)) links.push(['source', t('explorer.source')]);
    return links.map(([type, label]) => `<button class="resource-link" type="button" data-resource-tool="${tool.id}" data-resource-type="${type}">${esc(label)}</button>`).join('');
  }

  const profiles = {
    a: {name: 'Mina / relay walker', npub: 'npub1mina7q3f4k8reva2x90cx', joined: '2023-04', useful: 31, notUseful: 4},
    b: {name: 'Tao / quiet tester', npub: 'npub1tao8r5f7k4review2p9cx', joined: '2024-11', useful: 18, notUseful: 3},
    local: {name: '', npub: 'npub1currentviewer8q4k2p7cx', joined: '2026-08', useful: 0, notUseful: 0}
  };

  const shotPalette = ['#5a46b8', '#08745e', '#a34c62', '#3f668c'];
  function imageData(label, color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${color}"/><rect x="36" y="35" width="328" height="230" rx="18" fill="none" stroke="white" stroke-opacity=".7" stroke-width="4"/><circle cx="88" cy="90" r="22" fill="white" fill-opacity=".8"/><path d="M70 220l75-72 55 48 52-63 78 87" fill="none" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><text x="200" y="105" fill="white" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="700">${esc(label)}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  function seedReviews(tool) {
    const seed = i18n.value('explorer.reviewsSeed');
    const bodies = [seed.aBody, seed.bBody, seed.cBody, seed.aBody];
    const labels = [seed.screenTimeline, seed.screenSettings, seed.screenMedia, seed.screenTimeline];
    return bodies.map((body, index) => ({
      id: `${tool.id}-r${index + 1}`, profile: index % 2 ? 'b' : 'a', author: index % 2 ? profiles.b.name : profiles.a.name,
      date: `2026-08-${String(12 - index).padStart(2, '0')}`, body, os: index % 2 ? 'Web' : 'Android', version: `2.${index + 1}`, use: category(tool.category).name,
      rating: index === 1 ? 4 : 5, helpful: 7 + index * 2, unhelpful: index % 2, image: {label: labels[index], src: imageData(labels[index], shotPalette[index])}
    }));
  }
  // リレー由来のエントリはレビューを観測していないので、data.js 前提の seed を混ぜない。
  function allReviews(tool) { if (!tool) return []; return [...(tool.provenance === 'relay' ? [] : seedReviews(tool)), ...(state.reviews[tool.id] || [])]; }
  function reviewCounts(review) {
    const vote = state.reviewVotes[review.id];
    return {helpful: review.helpful + (vote === 'helpful' ? 1 : 0), unhelpful: review.unhelpful + (vote === 'unhelpful' ? 1 : 0), vote};
  }
  function screenshotMarkup(image, compact = false, alt = '') { return `<img class="review-shot${compact ? ' compact' : ''}" src="${image.src}" alt="${esc(alt || image.label)}">`; }

  function reviewItem(tool, review) {
    const counts = reviewCounts(review);
    return `<article class="review-item" data-review-id="${esc(review.id)}"><div class="review-author"><button type="button" class="reviewer-link" data-reviewer="${review.profile}"><strong>${esc(review.author)}</strong><small>${esc(profiles[review.profile]?.npub || '')}</small></button><time>${esc(review.date)}</time></div><p>${esc(review.body || t('explorer.imageOnly'))}</p>${review.image ? `<button type="button" class="review-image-button" data-open-image="${tool.id}" data-image-review="${review.id}">${screenshotMarkup(review.image, true, t('explorer.imageAlt', {author: review.author, date: review.date}))}<span>${esc(t('explorer.enlarge'))}</span></button>` : ''}<dl><div><dt>${esc(t('explorer.os'))}</dt><dd>${esc(review.os || t('explorer.notEntered'))}</dd></div><div><dt>${esc(t('explorer.appVersion'))}</dt><dd>${esc(review.version || t('explorer.notEntered'))}</dd></div><div><dt>${esc(t('explorer.rating'))}</dt><dd>${review.rating || t('explorer.notEntered')}</dd></div><div><dt>${esc(t('explorer.use'))}</dt><dd>${esc(review.use || t('explorer.notEntered'))}</dd></div></dl><div class="helpful-actions"><button type="button" data-review-vote="helpful" data-review-id="${review.id}" data-review-tool-id="${tool.id}" aria-pressed="${counts.vote === 'helpful'}">${esc(t('explorer.helpful', {count: counts.helpful}))}</button><button type="button" data-review-vote="unhelpful" data-review-id="${review.id}" data-review-tool-id="${tool.id}" aria-pressed="${counts.vote === 'unhelpful'}">${esc(t('explorer.unhelpful', {count: counts.unhelpful}))}</button><button class="text-button" type="button" data-vote-basis="${review.id}" data-vote-tool="${tool.id}">${esc(t('explorer.voters', {count: counts.helpful + counts.unhelpful}))}</button></div></article>`;
  }

  function cardReviewThumbnails(tool) {
    const images = allReviews(tool).filter(review => review.image);
    if (!images.length) return '';
    const shown = images.slice(0, 3);
    const remaining = images.length - shown.length;
    return `<div class="card-review-thumbnails" aria-label="${esc(t('explorer.openGallery'))}">${shown.map(review => { const label = t('explorer.imageAlt', {author: review.author, date: review.date}); return `<button type="button" class="card-review-thumbnail" data-open-image="${tool.id}" data-image-review="${review.id}" aria-label="${esc(label)}" title="${esc(label)}">${screenshotMarkup(review.image, true, '')}</button>`; }).join('')}${remaining ? `<button type="button" class="card-review-more" data-gallery-tool="${tool.id}" aria-label="${esc(t('explorer.remainingGallery', {count: remaining}))}" title="${esc(t('explorer.openGallery'))}">+${remaining}</button>` : ''}</div>`;
  }

  // data.js の id は tool-<n> で、いいね数はその連番から作るサンプル値。リレー由来の id からは数を作らず、観測がないことを null で返す。
  function likeCount(tool) { if (relayEntry(tool)) return null; const serial = Number(String(tool.id).replace('tool-', '')); return 12 + (Number.isFinite(serial) ? serial * 3 : 0) + (state.likes[tool.id] ? 1 : 0); }
  // 観測値がないときは比較ダイアログと同じ「—（不明）」マーカーで出す。数字を捏造しない。
  function likeCountMarkup(tool) { const count = likeCount(tool); return count === null ? `<span class="no-support-record" aria-label="${esc(t('unknown'))}" title="${esc(t('unknown'))}">—</span>` : String(count); }
  function provenanceBadge(tool) {
    const verified = tool && tool.provenance === 'relay';
    return `<span class="provenance-badge ${verified ? 'relay' : 'sample'}">${esc(t(verified ? 'explorer.relayVerified' : 'explorer.sampleData'))}</span>`;
  }
  const unknownMarker = () => `<span class="no-support-record" aria-label="${esc(t('unknown'))}" title="${esc(t('unknown'))}">—</span>`;
  // 観測していない欄は data.js 由来の語彙で埋めず、既存の「不明」語彙で出す。
  function categoryText(tool) { return relayEntry(tool) && !tool.categoryObserved ? t('unknown') : category(tool.category).name; }
  function osText(tool) { const list = (tool.os || []).filter(Boolean); if (list.length) return list.join(' / '); return tool.platform || t('unknown'); }
  function platformTags(tool) {
    // 32267 は OS / 配布形態を観測しない。data.js サンプルだけが実データを持つ。
    if (relayEntry(tool) && !(tool.os || []).length && !tool.platform) return `<span class="tag">${esc(t('explorer.os'))}: ${esc(t('unknown'))}</span>`;
    return `<span class="tag">${esc(tool.platform)}</span><span class="tag">${esc((tool.os || []).filter(value => value !== tool.platform).join(' / ') || deliveryLabel(delivery(tool)))}</span>`;
  }
  // §6.4: 推薦数はビューアのフォローグラフから数えた「distinct pubkey 数」。
  // グラフが無いときは unknown で、0 とは別の見た目にし、並び順にも 0 として入れない (I8)。
  function recommendationMarkup(tool) {
    if (!relayEntry(tool)) return '';
    const count = tool.recommendations;
    if (count === null || count === undefined) {
      return `<p class="recommendation-count is-unknown" data-recommendations="unknown">${esc(t('explorer.recommendationsUnknown'))} ${unknownMarker()}</p>`;
    }
    return `<p class="recommendation-count" data-recommendations="${esc(String(count))}">${esc(t('explorer.recommendations', {count}))}</p>`;
  }
  function featureCard(tool) {
    const selected = state.features.map(id => localizedFeature(id));
    const supports = selected.map(feature => ({feature, support: featureSupport(tool, feature)}));
    const records = [...new Map(selected.flatMap(feature => supportRecords(tool, feature)).map(record => [record.nip, record])).values()];
    const bookmark = state.bookmarks[tool.id];
    return `<article class="feature-tool-card ${tool.status === 'dead' ? 'dead-tool' : ''}" data-tool-id="${tool.id}"><div class="nip-card-top"><span class="tool-icon" aria-hidden="true">${iconSvg(category(tool.category).icon)}</span><span class="card-top-meta">${provenanceBadge(tool)}<span class="status ${tool.status}">${esc(t(`statuses.${tool.status}`))}</span></span></div><h2>${esc(tool.name)}</h2><p>${esc(toolDescription(tool))}</p>
      <section class="card-layer fact-layer"><h3>${esc(t('explorer.facts'))}</h3><div class="support-line">${supports.length ? supports.map(item => `<span class="feature-support-summary">${esc(item.feature.name)} ${supportBadge(item.support)}</span>`).join('') : `<span class="tag">${esc(t('explorer.noFeatureCondition'))}</span>`}${platformTags(tool)}</div><dl class="tool-facts"><div><dt>${esc(t('explorer.category'))}</dt><dd>${esc(categoryText(tool))}</dd></div><div><dt>OSS</dt><dd>${esc(displayLicense(tool))}</dd></div><div><dt>${esc(t('explorer.observed'))}</dt><dd>${esc(observedText(tool).split(' ')[0])}</dd></div></dl><nav class="resource-links" aria-label="${esc(t('explorer.officialLinks', {name: tool.name}))}">${resourceLinks(tool)}</nav>${records.length ? `<div class="basis-nips">${records.map(record => `<button type="button" class="nip-tag-button" data-evidence-tool="${tool.id}" data-evidence-nip="${record.nip}">NIP-${record.nip} · ${esc(statusLabel(record.status))}</button>`).join('')}</div>` : ''}</section>
      <section class="card-layer evaluation-layer"><h3>${esc(t('explorer.evaluations'))}</h3>${recommendationMarkup(tool)}${cardReviewThumbnails(tool)}<div class="evaluation-actions"><button type="button" class="like-button" data-like-tool="${tool.id}" aria-pressed="${Boolean(state.likes[tool.id])}">♥ ${likeCountMarkup(tool)}</button><button type="button" data-bookmark-tool="${tool.id}" aria-pressed="${Boolean(bookmark)}">${esc(t(bookmark ? 'explorer.bookmarked' : 'explorer.bookmark'))}</button><button type="button" data-review-tool="${tool.id}">${esc(t('explorer.reviews', {count: allReviews(tool).length}))}</button></div>${bookmark ? `<label class="public-toggle"><input type="checkbox" data-public-bookmark="${tool.id}" ${bookmark.public ? 'checked' : ''}> ${esc(t('explorer.publicToggle'))}</label><span class="privacy-state">${esc(t(bookmark.public ? 'explorer.public' : 'explorer.privateDefault'))}</span>` : `<span class="privacy-state">${esc(t('explorer.privateDefault'))}</span>`}</section>
      ${tool.status === 'dead' ? `<p class="replacement-note">${esc(t('explorer.endedRecord'))} <button type="button" class="text-button" data-find-alternative>${esc(t('explorer.alternatives'))}</button></p>` : ''}<div class="nip-card-actions"><label class="nip-compare-label"><input type="checkbox" data-compare-tool="${tool.id}" ${state.compare.includes(tool.id) ? 'checked' : ''}> ${esc(t('explorer.compareAdd'))}</label><button class="secondary" type="button" data-feature-detail="${tool.id}">${esc(t('explorer.details'))}</button></div></article>`;
  }

  function activeConditions() {
    const conditions = state.features.map(id => ({key: `feature:${id}`, label: t('explorer.conditionFeature', {value: featureName(id)}), overrides: {features: state.features.filter(value => value !== id)}}));
    if (state.query) conditions.push({key: 'query', label: t('explorer.conditionQuery', {value: state.query}), overrides: {query: ''}});
    if (state.platform !== 'all') conditions.push({key: 'platform', label: t('explorer.conditionPlatform', {value: state.platform}), overrides: {platform: 'all'}});
    if (state.category !== 'all') conditions.push({key: 'category', label: t('explorer.conditionCategory', {value: category(state.category).name}), overrides: {category: 'all'}});
    if (state.toolStatus !== 'all') conditions.push({key: 'toolStatus', label: t('explorer.conditionStatus', {value: t(`statuses.${state.toolStatus}`)}), overrides: {toolStatus: 'all'}});
    if (state.support !== 'all') conditions.push({key: 'support', label: t('explorer.conditionSupport', {value: statusLabel(state.support)}), overrides: {support: 'all'}});
    if (state.delivery !== 'all') conditions.push({key: 'delivery', label: t('explorer.conditionDelivery', {value: deliveryLabel(state.delivery)}), overrides: {delivery: 'all'}});
    if (state.oss !== 'all') conditions.push({key: 'oss', label: t('explorer.conditionOss', {value: state.oss === 'yes' ? 'OSS' : t('unknown')}), overrides: {oss: 'all'}});
    if (state.includeDead) conditions.push({key: 'includeDead', label: t('explorer.conditionDead'), overrides: {includeDead: false}});
    if (state.savedOnly) conditions.push({key: 'savedOnly', label: t('explorer.conditionSaved'), overrides: {savedOnly: false}});
    if (state.nipQuery) conditions.push({key: 'nipQuery', label: t('explorer.conditionNip', {value: state.nipQuery}), overrides: {nipQuery: ''}});
    return conditions;
  }

  function renderConditions() {
    const selected = selectedFeatures();
    const conditions = activeConditions();
    els.activeFilterCount.textContent = conditions.filter(item => !item.key.startsWith('feature:') && item.key !== 'query').length;
    els.selected.innerHTML = selected.length ? `<strong>${esc(t('explorer.featureAnd'))}:</strong> ${selected.map(feature => `<button class="selected-condition" type="button" data-remove-condition="feature:${feature.id}" aria-label="${esc(t('explorer.conditionRemove', {label: feature.name}))}"><span class="feature-symbol" aria-hidden="true">${iconSvg(feature.icon)}</span><span class="visually-hidden">${esc(feature.name)}</span><span aria-hidden="true">×</span></button>`).join('<span class="and-mark">AND</span>')} <button class="text-button" type="button" data-show-feature-basis>${esc(t('explorer.viewNips'))}</button>` : `<strong>${esc(t('explorer.noFeature'))}</strong>`;
    els.condition.innerHTML = conditions.length ? `<span class="condition-logic">${esc(t('explorer.activeAnd'))}</span>${conditions.map(item => `<button type="button" class="condition-pill" data-remove-condition="${esc(item.key)}" aria-label="${esc(t('explorer.conditionRemove', {label: item.label}))}">${esc(item.label)} <span aria-hidden="true">×</span></button>`).join('')}` : `<span class="condition-logic">${esc(t('explorer.noExtra'))}</span>`;
  }

  function renderNips() {
    const numbers = [...new Set(state.features.flatMap(id => featureById[id].nips))];
    const list = numbers.map(number => nipByNumber[number]).filter(Boolean);
    els.nipCount.textContent = `${list.length} NIPs`;
    els.nipList.innerHTML = list.length ? list.map(nip => `<article class="nip-reference-card" id="nip-${nip.number}"><strong>NIP-${nip.number}</strong><h3>${esc(nip.title)}</h3><p>${esc(nipPurpose(nip.number))}</p><a href="${nip.source}" target="_blank" rel="noreferrer">${esc(t('explorer.primarySource'))}</a></article>`).join('') : `<p class="feature-chip-empty">${esc(t('explorer.chooseForNips'))}</p>`;
  }

  function renderCompareActions() {
    // 比較対象は data.js サンプルとリレー由来エントリの両方。tools だけで絞ると relay:<coordinate> が毎回落ちる。
    state.compare = state.compare.filter(id => Boolean(findTool(id)));
    els.compareActions.hidden = !state.compare.length;
    els.compareSummary.textContent = t('explorer.selectedCount', {count: state.compare.length});
    els.openCompare.disabled = state.compare.length < 2;
  }
  function stateMarkup(type) {
    if (type === 'loading') return `<div class="state-message"><div class="nip-skeleton" aria-label="${esc(t('explorer.loading'))}"><span></span><span></span><span></span></div><strong>${esc(t('explorer.loading'))}</strong></div>`;
    if (type === 'empty') return `<div class="state-message"><strong>${esc(t('explorer.emptyState'))}</strong></div>`;
    if (type === 'error') return `<div class="state-message error"><div><strong>${esc(t('explorer.errorState'))}</strong><p><button class="secondary" type="button" data-set-state="normal">${esc(t('explorer.retry'))}</button></p></div></div>`;
    if (type === 'partial') return `<div class="state-message partial"><strong>${esc(t('explorer.partialState'))}</strong></div>`;
    if (type === 'offline') return `<div class="state-message partial"><strong>${esc(t('explorer.offlineState'))}</strong></div>`;
    if (type === 'stale') return `<div class="state-message partial stale"><strong>${esc(t('explorer.staleState'))}</strong></div>`;
    if (type === 'incomplete') return `<div class="state-message partial incomplete"><strong>${esc(t('explorer.incompleteState'))}</strong></div>`;
    if (type === 'unavailable') return `<div class="state-message error unavailable"><div><strong>${esc(t('explorer.unavailableState'))}</strong><p><button class="secondary" type="button" data-relay-action="reload">${esc(t('explorer.relayReload'))}</button></p></div></div>`;
    return '';
  }
  // data.js の observed は "YYYY-MM-DD HH:MM UTC" 形式の文字列。リレー由来の asOf は Date.now() のミリ秒なので、境界でこの形式に揃える。
  function formatObserved(value) {
    if (typeof value === 'string') return value;
    const ms = Number(value);
    if (!Number.isFinite(ms) || ms <= 0) return '';
    return `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  }
  function relayCoverageLabel(value) { const key = value && typeof value === 'object' ? value.status : value; const label = i18n.value(`explorer.coverage.${key}`); return typeof label === 'string' ? label : String(key); }
  // kind 32267 の v1 content にカテゴリ・OS・ライセンスの欄はない。`t` トピックが
  // UI のカテゴリ id と一致したときだけ観測値として使い、それ以外は不明のまま出す。
  function categoryFromTopics(topics) { return (Array.isArray(topics) ? topics.find(value => categories.includes(value)) : null) || null; }
  function relayEntryToTool(entry, asOf) {
    const fields = (entry && entry.fields) || {};
    const observedCategory = categoryFromTopics(entry && entry.topics);
    const stale = Boolean(entry && entry.stale === true);
    return {
      id: `relay:${(entry && entry.coordinate) || ''}`, name: fields.name || (entry && entry.coordinate) || '—',
      // category はアイコン表示用のフォールバック。観測できたかは categoryObserved で持ち、表示語彙はそちらで決める。
      category: observedCategory || 'clients', categoryObserved: Boolean(observedCategory),
      status: stale ? 'stale' : 'active', platform: '', os: [], license: '', observed: formatObserved(asOf), nips: [], provenance: 'relay',
      coordinate: (entry && entry.coordinate) || '', summary: fields.summary || '', homepage: (fields.homepage) || null,
      recommendations: entry && 'recommendations' in entry ? entry.recommendations : null,
      recommenders: (entry && entry.recommenders) || [], quarantinedNewer: (entry && entry.quarantinedNewer) || null
    };
  }
  // カード一覧に出る候補は data.js のサンプルとリレー由来エントリの両方。ダイアログの参照もこの両方を辿る。
  function relayEntries() { return relayState && Array.isArray(relayState.entries) ? relayState.entries : []; }
  function findTool(id) { return tools.find(item => item.id === id) || relayEntries().find(item => item.id === id) || null; }
  function relayEntry(tool) { return Boolean(tool) && tool.provenance === 'relay'; }
  function observedText(tool) { return formatObserved(tool.observed) || t('unknown'); }
  function shortKey(value) { return typeof value === 'string' && value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-8)}` : String(value || ''); }
  function relayDiagnosticsMarkup(result) {
    const summary = `<summary>${esc(t('explorer.relayDiagnostics'))}</summary>`;
    const reload = `<p><button class="secondary" type="button" data-relay-action="reload">${esc(t('explorer.relayReload'))}</button></p>`;
    if (!result) return `<details id="relay-diagnostics" class="relay-diagnostics">${summary}<p>${esc(t('explorer.relayNoData'))}</p>${reload}</details>`;
    const coverage = result.coverage || {};
    const relayUrls = Object.keys(coverage);
    const graph = result.graph || {};
    const curation = result.curation || {};
    const curators = Array.isArray(curation.curators) ? curation.curators : [];
    const manual = Array.isArray(curation.manual) ? curation.manual : [];
    const rounds = Array.isArray(result.rounds) ? result.rounds : [];
    const quarantined = Array.isArray(result.quarantined) ? result.quarantined : [];
    const unresolved = Array.isArray(result.unresolved) ? result.unresolved : [];
    const slugs = Array.isArray(result.diagnostics) ? result.diagnostics : [];
    const stats = result.stats || {};
    const field = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value == null || value === '' ? t('none') : value)}</dd></div>`;
    const relayRows = relayUrls.length ? relayUrls.map(url => `<li><code>${esc(url)}</code> — ${esc(relayCoverageLabel(coverage[url]))}</li>`).join('') : `<li>${esc(t('none'))}</li>`;
    // §6.2/§3: グラフの状態とカバレッジは数のそばに必ず出す。none は 0 ではなく不明。
    const graphRow = `<dl class="relay-diagnostics-grid">${field(t('explorer.relayGraphState'), t(`explorer.graphStates.${graph.state || 'none'}`))}${field(t('explorer.relayGraphCoverage'), t(`explorer.graphCoverage.${graph.coverage || 'unknown'}`))}${field(t('explorer.relayGraphFollows'), graph.state === 'tier1' ? t('explorer.relayGraphFollowsValue', {used: graph.followsUsed, total: graph.followsTotal}) : t('none'))}${field(t('explorer.relayGraphMalformed'), graph.malformedPTags)}${field(t('explorer.relayViewer'), graph.viewerPubkey ? shortKey(graph.viewerPubkey) : t('none'))}${field(t('explorer.relayViewerSource'), result.viewerSource || 'none')}</dl>`;
    // §6.4: 数の裏にいる pubkey は必ず辿れるようにする。それが唯一の信頼調整手段。
    const curatorRow = item => `<li><code>${esc(shortKey(item.curator))}</code><dl class="relay-diagnostics-grid">${field(t('explorer.relayCuratorSets'), t('explorer.relayCuratorSetsValue', {used: item.setsUsed, observed: item.setsObserved}))}${field(t('explorer.relayCuratorMembers'), item.memberCount)}${item.truncated ? field(t('explorer.relayReason'), 'sets-truncated') : ''}</dl></li>`;
    const curatorRows = curators.length ? curators.map(curatorRow).join('') : `<li>${esc(t('explorer.relayNoCuration'))}</li>`;
    const manualRows = manual.length ? `<h4>${esc(t('explorer.relayManualCurators'))}</h4><ul class="relay-diagnostics-list">${manual.map(curatorRow).join('')}</ul>` : '';
    const roundRows = rounds.length ? rounds.map(round => `<li><code>${esc(round.label)}</code><dl class="relay-diagnostics-grid">${field(t('explorer.relayLogical'), round.logicalReqs)}${field(t('explorer.relayPhysical'), round.physicalReqs)}${field(t('explorer.relayChunks'), round.chunks)}${round.reason ? field(t('explorer.relayReason'), round.reason) : ''}</dl></li>`).join('') : `<li>${esc(t('none'))}</li>`;
    const statsRow = `<dl class="relay-diagnostics-grid">${field(t('explorer.relayAsOf'), formatObserved(result.asOf))}${field(t('explorer.relayLogical'), stats.logicalReqs)}${field(t('explorer.relayPhysical'), stats.physicalReqs)}${field(t('explorer.relayHttp'), stats.httpAttempts)}${field(t('explorer.relayCache'), stats.cacheHits)}</dl>`;
    // §4.2 / §3: quarantine は理由付きで残し、「存在しない」とは絶対に言わない。
    const quarantineRows = quarantined.length ? quarantined.map(item => `<li><code>${esc(item.coordinate || t('none'))}</code> — ${esc(item.reason)}${item.eventId ? ` <small>${esc(shortKey(item.eventId))}</small>` : ''}</li>`).join('') : `<li>${esc(t('none'))}</li>`;
    // §5.4: 推薦されたが観測できなかった座標。行を捏造せずここにだけ出す。
    const unresolvedRows = unresolved.length ? unresolved.map(coord => `<li><code>${esc(coord)}</code></li>`).join('') : `<li>${esc(t('none'))}</li>`;
    const slugRow = `<p class="relay-diagnostics-slugs">${slugs.length ? slugs.map(slug => `<code>${esc(slug)}</code>`).join(' ') : esc(t('none'))}</p>`;
    return `<details id="relay-diagnostics" class="relay-diagnostics">${summary}<div class="relay-diagnostics-body">`
      + `<section><h3>${esc(t('explorer.relayRelays'))}</h3><ul class="relay-diagnostics-list">${relayRows}</ul></section>`
      + `<section><h3>${esc(t('explorer.relayGraph'))}</h3>${graphRow}</section>`
      + `<section><h3>${esc(t('explorer.relayCurators'))}</h3><ul class="relay-diagnostics-list">${curatorRows}</ul>${manualRows}</section>`
      + `<section><h3>${esc(t('explorer.relayRounds'))}</h3><ul class="relay-diagnostics-list">${roundRows}</ul></section>`
      + `<section><h3>${esc(t('explorer.relayReqs'))}</h3>${statsRow}</section>`
      + `<section><h3>${esc(t('explorer.relayQuarantined'))}</h3><ul class="relay-diagnostics-list">${quarantineRows}</ul></section>`
      + `<section><h3>${esc(t('explorer.relayUnresolved'))}</h3><ul class="relay-diagnostics-list">${unresolvedRows}</ul></section>`
      + `<section><h3>${esc(t('explorer.relaySlugs'))}</h3>${slugRow}</section>${reload}</div></details>`;
  }
  // §5.1 rule 5 / D10: 発見はトピック opt-in なので必ず「全部」ではないと明示する。
  function discoveryScopeMarkup(result) {
    const topics = (result && Array.isArray(result.topics) ? result.topics : []).join(', ');
    if (!topics) return '';
    return `<p class="discovery-scope" data-discovery-scope>${esc(t('explorer.discoveryScope', {topics}))}</p>`;
  }
  // §6.5.4: グラフが無いときは黙って空にせず、状況と二つの解決手段を出す。
  function graphBannerMarkup(result) {
    const graph = (result && result.graph) || null;
    if (!graph) return '';
    if (graph.state !== 'none') {
      const label = graph.state === 'tier1'
        ? t('explorer.graphStateLine', {state: t(`explorer.graphStates.${graph.state}`), coverage: t(`explorer.graphCoverage.${graph.coverage || 'unknown'}`), used: graph.followsUsed, total: graph.followsTotal})
        : t('explorer.graphStateLineShort', {state: t(`explorer.graphStates.${graph.state}`), coverage: t(`explorer.graphCoverage.${graph.coverage || 'unknown'}`)});
      return `<p class="graph-state" data-graph-state="${esc(graph.state)}">${esc(label)}</p>`;
    }
    return `<div class="graph-banner" data-graph-state="none"><p>${esc(t('explorer.graphNoneBanner'))}</p>`
      + `<div class="graph-banner-actions"><button class="secondary" type="button" data-graph-connect>${esc(t('explorer.graphConnect'))}</button>`
      + `<label class="graph-npub-field">${esc(t('explorer.graphPasteLabel'))}<input id="graph-npub" type="text" inputmode="text" autocomplete="off" placeholder="npub1…" value="${esc(relayViewer.viewerPubkey)}"></label>`
      + `<button class="secondary" type="button" data-graph-apply>${esc(t('explorer.graphApply'))}</button></div></div>`;
  }
  function applyRelayResult(result) {
    if (!result) { relayState = {active: true, result: null, entries: []}; state.uiState = 'unavailable'; renderResults(); return; }
    const asOf = result.asOf || '';
    const entries = Array.isArray(result.entries) ? result.entries.map(entry => relayEntryToTool(entry, asOf)) : [];
    relayState = {active: true, result, entries};
    const hasEntries = entries.length > 0;
    let ui;
    if (result.status === 'incomplete') ui = 'incomplete';
    else if (result.status === 'stale') ui = hasEntries ? 'stale' : 'unavailable';
    else if (result.status === 'fresh') ui = hasEntries ? 'normal' : 'unavailable';
    else ui = 'unavailable';
    state.uiState = ui;
    renderResults();
  }
  // §6.5.4 の二つの手段（NIP-07 接続 / npub 貼り付け）はここで保持する。既定は空で、
  // アプリが既定のキュレーターを持つことはない (§6.5.5)。
  const relayViewer = {viewerPubkey: (params.get('viewer') || '').trim(), useNip07: false};
  async function loadRelayCatalog(override) {
    const next = override && typeof override === 'object' && !(override instanceof Event) ? override : {};
    if ('viewerPubkey' in next) relayViewer.viewerPubkey = String(next.viewerPubkey || '').trim();
    if ('useNip07' in next) relayViewer.useNip07 = Boolean(next.useNip07);
    try {
      const catalog = window.NOSMAPS_CATALOG;
      if (!catalog || typeof catalog.loadCatalog !== 'function') return null;
      const relayOverride = params.get('relays');
      // §17.2 / §6.5.6: `?curators=` は掲載ゲートではなく、手動の「これも数える」リスト。
      // 出荷時は空で、行の集合には一切影響しない。
      const manualOverride = params.get('curators');
      const topicOverride = params.get('topics');
      const relays = relayOverride ? relayOverride.split(',').map(value => value.trim()).filter(Boolean) : ((catalog.POLICY && catalog.POLICY.DEFAULT_RELAYS) || []);
      const options = {relays};
      if (manualOverride) options.manualCounted = manualOverride.split(',').map(value => value.trim()).filter(Boolean);
      if (topicOverride) options.topics = topicOverride.split(',').map(value => value.trim()).filter(Boolean);
      if (relayViewer.viewerPubkey) options.viewerPubkey = relayViewer.viewerPubkey;
      if (relayViewer.useNip07) options.useNip07 = true;
      state.uiState = 'loading'; renderResults();
      const result = await catalog.loadCatalog(options);
      window.__NOSMAPS_RELAY_RESULT__ = result;
      applyRelayResult(result);
      return result;
    } catch (error) {
      console.error('[nosmaps] relay catalog load failed', error);
      window.__NOSMAPS_RELAY_RESULT__ = null;
      applyRelayResult(null);
      return null;
    }
  }
  function renderResults() {
    renderConditions(); renderNips(); renderCompareActions();
    els.offline.hidden = state.uiState !== 'offline';
    const relayActive = Boolean(relayState && relayState.active);
    // グラフの状態バナーと発見スコープの但し書きは、結果が空でも必ず出す。
    const relayContext = relayActive ? graphBannerMarkup(relayState.result) + discoveryScopeMarkup(relayState.result) : '';
    const diagnostics = relayActive ? relayDiagnosticsMarkup(relayState.result) : '';
    if (['loading', 'empty', 'error', 'unavailable'].includes(state.uiState)) { els.results.hidden = true; els.resultCount.textContent = t('explorer.count', {count: 0}); els.uiState.innerHTML = stateMarkup(state.uiState) + relayContext + diagnostics; return; }
    els.results.hidden = false;
    els.uiState.innerHTML = (['partial', 'offline', 'stale', 'incomplete'].includes(state.uiState) ? stateMarkup(state.uiState) : '') + relayContext + diagnostics;
    let list = relayActive ? relayState.entries : filteredTools();
    if (!relayActive && state.uiState === 'partial') list = list.slice(0, 7);
    els.resultCount.textContent = t('explorer.count', {count: list.length});
    if (list.length) { els.results.innerHTML = list.map(featureCard).join(''); return; }
    if (relayActive) { els.results.innerHTML = `<div class="empty zero-results"><h2>${esc(t('explorer.relayEmptyTitle'))}</h2><p>${esc(t('explorer.relayEmpty'))}</p></div>`; return; }
    const relaxations = activeConditions().map(item => ({...item, count: filteredTools(item.overrides).length})).sort((a, b) => b.count - a.count);
    const suggestion = relaxations[0];
    els.results.innerHTML = `<div class="empty zero-results"><h2>${esc(t('explorer.noMatch'))}</h2><p>${esc(t('explorer.noMatchHelp'))}</p>${suggestion ? `<button class="secondary relaxation-suggestion" type="button" data-remove-condition="${esc(suggestion.key)}">${esc(t('explorer.removeGets', {label: suggestion.label, count: suggestion.count}))}</button>` : `<button class="secondary" type="button" data-reset-all>${esc(t('explorer.resetAll'))}</button>`}</div>`;
  }

  function renderAll() { renderIdentity(); renderFeatures(); renderFilterPanel(); els.query.value = state.query; renderResults(); rerenderOpenDialogs(); }
  function focusableElements(dialog) { return [...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length); }
  function focusKey(element) {
    if (!element) return null;
    if (element.id) return `#${CSS.escape(element.id)}`;
    for (const name of ['selectFeature', 'language', 'evidenceTool', 'evidenceNip', 'featureDetail', 'reviewTool', 'reviewer', 'openImage', 'imageReview', 'galleryTool', 'compareRemove']) if (element.dataset[name] !== undefined) return `[data-${name.replace(/[A-Z]/g, value => `-${value.toLowerCase()}`)}="${CSS.escape(element.dataset[name])}"]`;
    return null;
  }
  function restoreFocus(key, root = document) { if (key) requestAnimationFrame(() => root.querySelector(key)?.focus()); }
  function openDialog(dialog, context, opener = lastInteractive || document.activeElement) {
    dialogContexts.set(dialog, context);
    dialogOpeners.set(dialog, opener);
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => focusableElements(dialog)[0]?.focus());
  }
  function dialogHead(kicker, title) { return `<div class="dialog-head"><div><div class="dialog-kicker">${esc(kicker)}</div><h2>${esc(title)}</h2></div><div class="dialog-tools">${languageControl(true)}<button class="icon-btn" type="button" data-close-dialog aria-label="${esc(t('close'))}" title="${esc(t('close'))}">×</button></div></div>`; }

  function renderEvidence(context, shouldOpen = true) {
    const tool = findTool(context.toolId);
    const record = (tool?.nips || []).find(item => item.nip === context.nip);
    const nip = record ? nipByNumber[record.nip] : null;
    if (!tool || !record || !nip) return;
    els.evidenceDialog.setAttribute('aria-label', `${tool.name} · NIP-${record.nip}`);
    els.evidenceContent.innerHTML = `${dialogHead(t('explorer.detailKicker'), `${tool.name} · NIP-${record.nip}`)}<p>${esc(t('explorer.supportFor', {feature: context.featureId ? featureName(context.featureId) : nip.title}))} ${supportBadge(record.status)}</p><section class="dialog-layer fact-layer"><h3>${esc(t('explorer.facts'))}</h3><p>${esc(evidenceText(record.status))}</p><dl class="nip-evidence-grid"><div><dt>${esc(t('explorer.observed'))}</dt><dd>${esc(record.observed)}</dd></div><div><dt>${esc(t('explorer.observer'))}</dt><dd>${esc(observerLabel(record.observer))}</dd></div><div><dt>${esc(t('explorer.nipPurpose'))}</dt><dd>${esc(nipPurpose(record.nip))}</dd></div><div><dt>${esc(t('explorer.state'))}</dt><dd>${esc(statusLabel(record.status))}</dd></div></dl><a href="${nip.source}" target="_blank" rel="noreferrer">${esc(t('explorer.primarySource'))}</a></section>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }
  function renderToolDetail(context, shouldOpen = true) {
    const tool = findTool(context.toolId);
    if (!tool) return;
    // リレー由来の説明文は 32267 の署名済み content の summary だけ。NIP・レビューは観測していないので埋め合わせない。
    const description = relayEntry(tool) ? (tool.summary || t('unknown')) : toolDescription(tool);
    const records = (tool.nips || []).slice(0, 7);
    const reviews = allReviews(tool);
    const basisList = records.length
      ? records.map(record => `<button class="basis-row" type="button" data-evidence-tool="${tool.id}" data-evidence-nip="${record.nip}"><strong>NIP-${record.nip}</strong>${supportBadge(record.status)}<small>${esc(evidenceText(record.status))}</small></button>`).join('')
      : `<p class="no-support-record">${esc(t('none'))}</p>`;
    els.evidenceDialog.setAttribute('aria-label', tool.name);
    els.evidenceContent.innerHTML = `${dialogHead(t('explorer.details'), tool.name)}<p>${esc(description)}</p><section class="dialog-layer fact-layer"><h3>${esc(t('explorer.facts'))}</h3><dl class="nip-evidence-grid"><div><dt>${esc(t('explorer.state'))}</dt><dd>${esc(t(`statuses.${tool.status}`))}</dd></div><div><dt>${esc(t('explorer.observed'))}</dt><dd>${esc(observedText(tool))}</dd></div><div><dt>${esc(t('explorer.os'))}</dt><dd>${esc((tool.os || [tool.platform]).filter(Boolean).join(' / ') || t('unknown'))}</dd></div><div><dt>${esc(t('explorer.license'))}</dt><dd>${esc(displayLicense(tool))}</dd></div></dl><div class="feature-basis-list">${basisList}</div></section><section class="dialog-layer evaluation-layer"><h3>${esc(t('explorer.evaluations'))}</h3>${reviews.length ? `<button type="button" class="secondary" data-review-tool="${tool.id}">${esc(t('explorer.reviews', {count: reviews.length}))}</button>` : `<p class="no-support-record">${esc(t('none'))}</p>`}</section>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }
  function resourceUrl(tool, type) { const slug = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'); return ({site: `https://${slug}.example.invalid/`, distribution: `https://store.example.invalid/apps/${slug}`, docs: `https://docs.${slug}.example.invalid/`, source: `https://code.example.invalid/${slug}/source`}[type]); }
  function renderResource(context, shouldOpen = true) {
    const tool = findTool(context.toolId);
    if (!tool) return;
    const typeLabel = t(`explorer.${context.resourceType}`);
    // resourceUrl は data.js サンプル用の生成 URL。リレー由来で観測できる URL は
    // 32267 content の homepage だけなので、site 以外は出さない。
    const url = relayEntry(tool) ? (context.resourceType === 'site' ? (tool.homepage || '') : '') : resourceUrl(tool, context.resourceType);
    els.evidenceDialog.setAttribute('aria-label', t('explorer.linkDetails', {type: typeLabel}));
    els.evidenceContent.innerHTML = `${dialogHead(t('explorer.linkDetails', {type: typeLabel}), tool.name)}<dl class="nip-evidence-grid"><div><dt>${esc(t('explorer.displayUrl'))}</dt><dd>${esc(url || t('unknown'))}</dd></div><div><dt>${esc(t('explorer.checkedAt'))}</dt><dd>${esc(observedText(tool))}</dd></div></dl>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }
  function renderFeatureBasis(context = {type: 'featureBasis'}, shouldOpen = true) {
    const selected = selectedFeatures();
    els.evidenceDialog.setAttribute('aria-label', t('explorer.evidenceTitle'));
    els.evidenceContent.innerHTML = `${dialogHead('NIP', t('explorer.evidenceTitle'))}<div class="feature-basis-list">${selected.flatMap(feature => feature.nips.map(number => nipByNumber[number]).filter(Boolean).map(nip => `<article class="nip-reference-card"><strong>${esc(feature.name)} · NIP-${nip.number}</strong><h3>${esc(nip.title)}</h3><p>${esc(nipPurpose(nip.number))}</p><a href="${nip.source}" target="_blank" rel="noreferrer">${esc(t('explorer.primarySource'))}</a></article>`)).join('')}</div>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }

  function comparisonItem(label, values, contents, icon = '') {
    const different = new Set(values).size > 1;
    return {different, markup: `<section class="comparison-item ${different ? 'is-different' : 'is-identical'}" data-difference="${different}"><div class="comparison-label">${icon}<span>${esc(label)}</span></div><div class="comparison-values">${contents.join('')}</div></section>`};
  }
  function renderCompare(context = {type: 'compare'}, shouldOpen = true) {
    const selected = state.compare.map(id => findTool(id)).filter(Boolean);
    const alternatives = filteredTools().filter(tool => !state.compare.includes(tool.id));
    const items = featureDefinitions.map(definition => {
      const records = selected.map(tool => featureSupportRecord(tool, definition));
      const values = records.map(record => record?.status || null);
      return comparisonItem(featureName(definition.id), values, selected.map((tool, index) => {
        const record = records[index];
        return `<div class="comparison-value">${record ? `${supportBadge(record.status)}<button class="comparison-evidence" type="button" data-evidence-tool="${tool.id}" data-evidence-nip="${record.nip}" data-evidence-feature="${definition.id}">${esc(t('explorer.nipEvidence'))}</button>` : `<span class="no-support-record" aria-label="${esc(t('none'))}" title="${esc(t('none'))}">—</span>`}</div>`;
      }), `<span class="feature-symbol" aria-hidden="true">${iconSvg(definition.icon)}</span>`);
    });
    const basics = [
      // OS / カテゴリも observedText と同じ扱い: 観測がない欄は「不明」語彙で埋め、空欄にも捏造にもしない。
      comparisonItem(t('explorer.os'), selected.map(tool => osText(tool)), selected.map(tool => `<div class="comparison-value">${esc(osText(tool))}</div>`)),
      comparisonItem(t('explorer.category'), selected.map(tool => categoryText(tool)), selected.map(tool => `<div class="comparison-value">${esc(categoryText(tool))}</div>`)),
      comparisonItem('OSS', selected.map(tool => displayLicense(tool)), selected.map(tool => `<div class="comparison-value">${esc(displayLicense(tool))}</div>`)),
      // observed が空のリレー由来エントリでも空欄にせず、observedText の「不明」語彙で出す。
      comparisonItem(t('explorer.observed'), selected.map(tool => observedText(tool)), selected.map(tool => `<div class="comparison-value">${esc(observedText(tool).split(' ')[0])}</div>`))
    ];
    const orderedFeatures = [...items].sort((a, b) => Number(b.different) - Number(a.different));
    const orderedBasics = [...basics].sort((a, b) => Number(b.different) - Number(a.different));
    const actionLabel = state.compare.length >= 3 ? t('explorer.replaceComparison') : t('explorer.addComparison');
    els.compareDialog.setAttribute('aria-label', t('explorer.compareTitle', {count: selected.length}));
    els.compareContent.innerHTML = `${dialogHead(t('explorer.differencesFirst'), t('explorer.compareTitle', {count: selected.length}))}<div class="comparison-edit"><label>${esc(t('explorer.alternative'))}<select id="compare-alternative">${alternatives.map(tool => `<option value="${tool.id}">${esc(tool.name)}</option>`).join('')}</select></label>${state.compare.length >= 3 ? `<label>${esc(t('explorer.replaceTarget'))}<select id="compare-replace-target">${selected.map(tool => `<option value="${tool.id}">${esc(tool.name)}</option>`).join('')}</select></label>` : '<span></span>'}<button class="secondary" type="button" data-compare-apply ${alternatives.length ? '' : 'disabled'}>${esc(actionLabel)}</button></div>${selected.length < 2 ? `<p class="comparison-incomplete">${esc(t('explorer.needTwo'))}</p>` : ''}<div class="comparison-body" style="--candidate-count:${Math.max(selected.length, 1)}"><div class="comparison-candidates">${selected.map(tool => `<div class="comparison-candidate"><strong>${esc(tool.name)}</strong><button type="button" data-compare-remove="${tool.id}" aria-label="${esc(t('explorer.removeCandidate', {name: tool.name}))}">${esc(t('explorer.removeShort'))}</button></div>`).join('')}</div><section class="comparison-group"><h3 class="comparison-group-title">${esc(t('explorer.featuresSection'))}</h3>${orderedFeatures.map(item => item.markup).join('')}</section><section class="comparison-group"><h3 class="comparison-group-title">${esc(t('explorer.basicsSection'))}</h3>${orderedBasics.map(item => item.markup).join('')}</section></div>`;
    if (shouldOpen) openDialog(els.compareDialog, context);
  }

  function reviewForm(tool) {
    // seed 画像は data.js サンプル用。リレー由来のエントリでは選択肢に出さない（送信時の seed 参照も走らない）。
    const seeds = relayEntry(tool) ? [] : seedReviews(tool).slice(0, 3);
    const draft = state.reviewDrafts[tool.id] || {};
    const localPreview = draft.localImage ? `<img src="${esc(draft.localImage)}" alt="${esc(t('explorer.imageTitle'))}">${draft.localFilename ? `<small>${esc(draft.localFilename)}</small>` : ''}` : '';
    return `<form class="review-form" data-review-form="${tool.id}" data-local-image="${esc(draft.localImage || '')}" data-local-filename="${esc(draft.localFilename || '')}"><h3>${esc(t('explorer.writeReview'))}</h3><label class="review-body">${esc(t('explorer.body'))}<textarea name="body" placeholder="${esc(t('explorer.bodyPlaceholder'))}">${esc(draft.body || '')}</textarea></label><fieldset class="image-picker"><legend>${esc(t('explorer.chooseImage'))}</legend><div class="shot-choices">${seeds.map((review, index) => `<label class="shot-choice"><input type="radio" name="imageChoice" value="${index}" ${String(draft.imageChoice) === String(index) ? 'checked' : ''}><span>${screenshotMarkup(review.image, true, review.image.label)}</span></label>`).join('')}</div><label class="local-file">${esc(t('explorer.deviceImage'))}<input type="file" name="deviceImage" accept="image/*"></label><div class="local-image-preview">${localPreview}</div></fieldset><label>${esc(t('explorer.osOptional'))}<input name="os" value="${esc(draft.os || '')}"></label><label>${esc(t('explorer.versionOptional'))}<input name="version" value="${esc(draft.version || '')}"></label><label>${esc(t('explorer.useOptional'))}<input name="use" value="${esc(draft.use || '')}"></label><label>${esc(t('explorer.ratingOptional'))}<select name="rating"><option value="">${esc(t('optional'))}</option>${[5, 4, 3, 2, 1].map(value => `<option ${String(draft.rating) === String(value) ? 'selected' : ''}>${value}</option>`).join('')}</select></label><div class="review-preview" aria-live="polite"></div><button class="primary" type="submit">${esc(t('explorer.createReview'))}</button></form>`;
  }
  function captureReviewDraft() {
    const form = els.reviewDialog.querySelector('[data-review-form]');
    if (!form) return;
    const toolId = form.dataset.reviewForm;
    state.reviewDrafts[toolId] = {
      body: form.elements.body.value, imageChoice: form.querySelector('input[name="imageChoice"]:checked')?.value ?? '',
      localImage: form.dataset.localImage || '', localFilename: form.dataset.localFilename || '', os: form.elements.os.value,
      version: form.elements.version.value, use: form.elements.use.value, rating: form.elements.rating.value
    };
  }
  function renderReview(context, shouldOpen = true) {
    if (!context.clearDraft) captureReviewDraft();
    const tool = findTool(context.toolId);
    if (!tool) return;
    const reviews = allReviews(tool);
    els.reviewDialog.setAttribute('aria-label', t('explorer.reviewTitle', {name: tool.name}));
    els.reviewContent.innerHTML = `${dialogHead(t('explorer.reviewCount', {count: reviews.length}), t('explorer.reviewTitle', {name: tool.name}))}<div class="review-toolbar"><button class="secondary" type="button" data-gallery-tool="${tool.id}">${esc(t('explorer.openGallery'))}</button></div><section class="review-list">${reviews.map(review => reviewItem(tool, review)).join('')}</section>${reviewForm(tool)}`;
    if (shouldOpen) openDialog(els.reviewDialog, context);
    if (context.reviewId) restoreFocus(`[data-review-id="${CSS.escape(context.reviewId)}"] button`, els.reviewDialog);
  }
  function profileDetails(id) {
    const seed = i18n.value('explorer.reviewsSeed');
    if (id === 'local') return {...profiles.local, name: seed.localName, bio: seed.localBio, spread: t('explorer.notEntered'), posts: t('explorer.notEntered')};
    return {...profiles[id], bio: id === 'a' ? seed.aBio : seed.bBio, spread: id === 'a' ? seed.aSpread : seed.bSpread, posts: id === 'a' ? seed.aPosts : seed.bPosts};
  }
  function profileHistory(profileId) {
    return tools.flatMap(tool => allReviews(tool).filter(review => review.profile === profileId).map(review => ({tool, review}))).slice(0, 4);
  }
  function renderProfile(context, shouldOpen = true) {
    const profile = profileDetails(context.profileId);
    const history = profileHistory(context.profileId);
    els.profileDialog.setAttribute('aria-label', t('explorer.profileTitle'));
    els.profileContent.innerHTML = `${dialogHead(t('explorer.profileTitle'), profile.name)}<p class="profile-npub">${esc(profile.npub)}</p><p>${esc(profile.bio)}</p><dl class="profile-facts"><div><dt>${esc(t('explorer.joined'))}</dt><dd>${esc(profile.joined)}</dd></div><div><dt>${esc(t('explorer.activity'))}</dt><dd>${esc(profile.spread)}</dd></div><div><dt>${esc(t('explorer.posting'))}</dt><dd>${esc(profile.posts)}</dd></div><div><dt>${esc(t('explorer.voteHistory'))}</dt><dd>${profile.useful} / ${profile.notUseful}</dd></div></dl><section class="profile-history"><h3>${esc(t('explorer.history'))}</h3>${history.map(({tool, review}) => `<article><div><strong>${esc(tool.name)}</strong><span>${esc(review.date)}</span></div><p>${esc(review.body)}</p><button class="secondary" type="button" data-review-tool="${tool.id}" data-review-jump="${review.id}">${esc(t('explorer.originalReview'))}</button></article>`).join('')}</section>`;
    if (shouldOpen) openDialog(els.profileDialog, context);
  }
  function renderGallery(context, shouldOpen = true) {
    const tool = findTool(context.toolId);
    if (!tool) return;
    const reviews = allReviews(tool).filter(review => review.image);
    els.galleryDialog.setAttribute('aria-label', t('explorer.galleryTitle', {name: tool.name}));
    els.galleryContent.innerHTML = `${dialogHead(t('explorer.openGallery'), t('explorer.galleryTitle', {name: tool.name}))}<section class="gallery-grid">${reviews.length ? reviews.map(review => `<article class="gallery-card">${screenshotMarkup(review.image, false, t('explorer.imageAlt', {author: review.author, date: review.date}))}<dl><div><dt>${esc(t('explorer.reviewer'))}</dt><dd><button type="button" class="reviewer-link compact-link" data-reviewer="${review.profile}">${esc(review.author)}</button></dd></div><div><dt>${esc(t('explorer.postedAt'))}</dt><dd>${esc(review.date)}</dd></div><div><dt>OS / version</dt><dd>${esc(review.os || t('explorer.notEntered'))} / ${esc(review.version || t('explorer.notEntered'))}</dd></div></dl><div><button type="button" class="primary" data-open-image="${tool.id}" data-image-review="${review.id}">${esc(t('explorer.enlarge'))}</button><button type="button" class="secondary" data-review-tool="${tool.id}" data-review-jump="${review.id}">${esc(t('explorer.originalReview'))}</button></div></article>`).join('') : `<p>${esc(t('explorer.galleryEmpty'))}</p>`}</section>`;
    if (shouldOpen) openDialog(els.galleryDialog, context);
  }
  function renderImage(context, shouldOpen = true) {
    const tool = findTool(context.toolId);
    const review = tool && allReviews(tool).find(item => item.id === context.reviewId);
    if (!review?.image) return;
    els.imageDialog.setAttribute('aria-label', t('explorer.imageTitle'));
    els.imageContent.innerHTML = `${dialogHead(t('explorer.imageTitle'), review.image.label)}<div class="image-stage">${screenshotMarkup(review.image, false, t('explorer.imageAlt', {author: review.author, date: review.date}))}</div><dl class="nip-evidence-grid"><div><dt>${esc(t('explorer.reviewer'))}</dt><dd><button type="button" class="reviewer-link compact-link" data-reviewer="${review.profile}">${esc(review.author)}</button></dd></div><div><dt>${esc(t('explorer.postedAt'))}</dt><dd>${esc(review.date)}</dd></div></dl><button type="button" class="primary" data-review-tool="${tool.id}" data-review-jump="${review.id}">${esc(t('explorer.originalReview'))}</button>`;
    if (shouldOpen) openDialog(els.imageDialog, context);
  }
  function renderVoteBasis(context, shouldOpen = true) {
    const tool = findTool(context.toolId);
    const review = allReviews(tool).find(item => item.id === context.reviewId);
    if (!review) return;
    const counts = reviewCounts(review);
    els.evidenceDialog.setAttribute('aria-label', t('explorer.voteBreakdown'));
    els.evidenceContent.innerHTML = `${dialogHead(t('explorer.communityVotes'), t('explorer.voteBreakdown'))}<dl class="nip-evidence-grid"><div><dt>${esc(t('explorer.helpfulVotes'))}</dt><dd>${counts.helpful}</dd></div><div><dt>${esc(t('explorer.unhelpfulVotes'))}</dt><dd>${counts.unhelpful}</dd></div></dl>`;
    if (shouldOpen) openDialog(els.evidenceDialog, context);
  }
  function rerenderOpenDialogs() {
    for (const dialog of dialogs) {
      if (!dialog.open) continue;
      const context = dialogContexts.get(dialog);
      if (!context) continue;
      if (context.type === 'evidence') renderEvidence(context, false);
      if (context.type === 'toolDetail') renderToolDetail(context, false);
      if (context.type === 'resource') renderResource(context, false);
      if (context.type === 'featureBasis') renderFeatureBasis(context, false);
      if (context.type === 'compare') renderCompare(context, false);
      if (context.type === 'review') renderReview(context, false);
      if (context.type === 'profile') renderProfile(context, false);
      if (context.type === 'gallery') renderGallery(context, false);
      if (context.type === 'image') renderImage(context, false);
      if (context.type === 'voteBasis') renderVoteBasis(context, false);
    }
  }

  function toast(message) { els.toast.textContent = message; els.toast.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => els.toast.classList.remove('show'), 1800); }
  function resetFilters() { Object.assign(state, {features: [], query: '', platform: 'all', category: 'all', toolStatus: 'all', support: 'all', delivery: 'all', oss: 'all', includeDead: false, savedOnly: false, nipQuery: '', uiState: 'normal'}); renderAll(); }
  function removeCondition(key) { const item = activeConditions().find(condition => condition.key === key); if (!item) return; Object.assign(state, item.overrides); if (!state.features.length) state.support = 'all'; state.uiState = 'normal'; renderAll(); }
  function toggleCompare(id, checked) { if (checked && state.compare.length >= 3) { document.querySelector(`[data-compare-tool="${CSS.escape(id)}"]`).checked = false; toast(t('explorer.compareLimit')); return; } state.compare = checked ? [...state.compare, id] : state.compare.filter(value => value !== id); renderCompareActions(); }
  function syncComparisonCheckboxes() { document.querySelectorAll('[data-compare-tool]').forEach(input => { input.checked = state.compare.includes(input.dataset.compareTool); }); }

  document.addEventListener('pointerdown', event => { lastInteractive = event.target.closest('button,a,input,select,textarea,[tabindex]'); }, true);
  document.addEventListener('click', event => {
    const language = event.target.closest('[data-language]');
    if (language) {
      captureReviewDraft();
      const key = focusKey(language);
      const openerKeys = dialogs.map(dialog => dialog.open ? focusKey(dialogOpeners.get(dialog)) : null);
      i18n.set(language.dataset.language);
      dialogs.forEach((dialog, index) => { const replacement = openerKeys[index] && document.querySelector(openerKeys[index]); if (replacement) dialogOpeners.set(dialog, replacement); });
      restoreFocus(key, dialogs.filter(dialog => dialog.open).at(-1) || document);
      return;
    }
    const feature = event.target.closest('[data-select-feature]');
    if (feature) { const id = feature.dataset.selectFeature; state.features = state.features.includes(id) ? state.features.filter(value => value !== id) : [...state.features, id]; if (!state.features.length) state.support = 'all'; state.uiState = 'normal'; renderAll(); restoreFocus(`[data-select-feature="${id}"]`); return; }
    const categoryButton = event.target.closest('[data-category-filter]');
    if (categoryButton) { state.category = categoryButton.dataset.categoryFilter; renderAll(); restoreFocus(`[data-category-filter="${state.category}"]`); return; }
    const detail = event.target.closest('[data-feature-detail]'); if (detail) { renderToolDetail({type: 'toolDetail', toolId: detail.dataset.featureDetail}); return; }
    const evidence = event.target.closest('[data-evidence-tool]'); if (evidence) { renderEvidence({type: 'evidence', toolId: evidence.dataset.evidenceTool, nip: evidence.dataset.evidenceNip, featureId: evidence.dataset.evidenceFeature}); return; }
    const resource = event.target.closest('[data-resource-tool]'); if (resource) { renderResource({type: 'resource', toolId: resource.dataset.resourceTool, resourceType: resource.dataset.resourceType}); return; }
    const like = event.target.closest('[data-like-tool]'); if (like) { state.likes[like.dataset.likeTool] = !state.likes[like.dataset.likeTool]; renderResults(); toast(t('explorer.toastLiked')); return; }
    const bookmark = event.target.closest('[data-bookmark-tool]'); if (bookmark) { const id = bookmark.dataset.bookmarkTool; state.bookmarks[id] = state.bookmarks[id] ? null : {public: false}; renderResults(); toast(t('explorer.toastBookmarked')); return; }
    const reviewer = event.target.closest('[data-reviewer]'); if (reviewer) { renderProfile({type: 'profile', profileId: reviewer.dataset.reviewer}); return; }
    const vote = event.target.closest('[data-review-vote]'); if (vote) { const current = state.reviewVotes[vote.dataset.reviewId]; state.reviewVotes[vote.dataset.reviewId] = current === vote.dataset.reviewVote ? null : vote.dataset.reviewVote; renderReview({type: 'review', toolId: vote.dataset.reviewToolId, reviewId: vote.dataset.reviewId}, false); toast(t('explorer.toastVoted')); return; }
    const basis = event.target.closest('[data-vote-basis]'); if (basis) { renderVoteBasis({type: 'voteBasis', toolId: basis.dataset.voteTool, reviewId: basis.dataset.voteBasis}); return; }
    const gallery = event.target.closest('[data-gallery-tool]'); if (gallery) { renderGallery({type: 'gallery', toolId: gallery.dataset.galleryTool}); return; }
    const image = event.target.closest('[data-open-image]'); if (image) { renderImage({type: 'image', toolId: image.dataset.openImage, reviewId: image.dataset.imageReview}); return; }
    const review = event.target.closest('[data-review-tool]'); if (review) { const child = review.closest('dialog'); if (review.dataset.reviewJump && child && child !== els.reviewDialog) child.close(); renderReview({type: 'review', toolId: review.dataset.reviewTool, reviewId: review.dataset.reviewJump || ''}, !els.reviewDialog.open); return; }
    const close = event.target.closest('[data-close-dialog]'); if (close) { close.closest('dialog').close(); return; }
    const remove = event.target.closest('[data-remove-condition]'); if (remove) { removeCondition(remove.dataset.removeCondition); return; }
    if (event.target.closest('[data-reset-all]')) { resetFilters(); return; }
    const compareRemove = event.target.closest('[data-compare-remove]'); if (compareRemove) { state.compare = state.compare.filter(id => id !== compareRemove.dataset.compareRemove); renderCompareActions(); syncComparisonCheckboxes(); if (state.compare.length) renderCompare({type: 'compare'}, false); else els.compareDialog.close(); return; }
    if (event.target.closest('[data-compare-apply]')) { const alternative = $('#compare-alternative')?.value; if (!alternative) return; if (state.compare.length >= 3) { const target = $('#compare-replace-target')?.value; state.compare = state.compare.map(id => id === target ? alternative : id); } else state.compare.push(alternative); renderCompareActions(); syncComparisonCheckboxes(); renderCompare({type: 'compare'}, false); return; }
    if (event.target.closest('[data-find-alternative]')) { state.includeDead = false; renderAll(); return; }
    if (event.target.closest('[data-show-feature-basis]')) { renderFeatureBasis(); return; }
    const relayAction = event.target.closest('[data-relay-action]'); if (relayAction) { if (relayAction.dataset.relayAction === 'reload') loadRelayCatalog(); return; }
    // §6.5.4 の二つの手段。どちらも並び順と推薦数にしか効かず、行の集合は動かない (I7)。
    if (event.target.closest('[data-graph-connect]')) { loadRelayCatalog({useNip07: true}); return; }
    if (event.target.closest('[data-graph-apply]')) { loadRelayCatalog({viewerPubkey: $('#graph-npub')?.value || '', useNip07: false}); return; }
    const setState = event.target.closest('[data-set-state]'); if (setState) { state.uiState = setState.dataset.setState; renderAll(); }
  });

  els.query.addEventListener('input', event => { state.query = event.target.value; state.uiState = 'normal'; renderResults(); });
  $('#open-compare').addEventListener('click', () => renderCompare());
  $('#clear-compare').addEventListener('click', () => { state.compare = []; renderCompareActions(); syncComparisonCheckboxes(); });
  document.addEventListener('change', event => {
    const mapping = {'platform-filter': 'platform', 'tool-status-filter': 'toolStatus', 'support-filter': 'support', 'delivery-filter': 'delivery', 'oss-filter': 'oss'};
    if (mapping[event.target.id]) { state[mapping[event.target.id]] = event.target.value; state.uiState = 'normal'; renderAll(); return; }
    if (event.target.id === 'include-dead') { state.includeDead = event.target.checked; renderAll(); return; }
    if (event.target.id === 'saved-only') { state.savedOnly = event.target.checked; renderAll(); return; }
    if (event.target.matches('[data-compare-tool]')) { toggleCompare(event.target.dataset.compareTool, event.target.checked); return; }
    if (event.target.matches('[data-public-bookmark]')) { const bookmark = state.bookmarks[event.target.dataset.publicBookmark]; if (bookmark) bookmark.public = event.target.checked; renderResults(); toast(t('explorer.toastPublic')); return; }
    if (event.target.matches('input[name="imageChoice"]')) {
      const form = event.target.closest('[data-review-form]');
      captureReviewDraft();
      form.dataset.localImage = '';
      form.dataset.localFilename = '';
      form.elements.deviceImage.value = '';
      form.querySelector('.local-image-preview').replaceChildren();
      Object.assign(state.reviewDrafts[form.dataset.reviewForm], {localImage: '', localFilename: '', imageChoice: event.target.value});
      return;
    }
    const file = event.target.closest('input[name="deviceImage"]');
    if (file) { const form = file.closest('form'); const selected = file.files?.[0]; if (!selected?.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = () => { const image = String(reader.result); form.dataset.localImage = image; form.dataset.localFilename = selected.name; form.querySelectorAll('input[name="imageChoice"]').forEach(input => { input.checked = false; }); form.querySelector('.local-image-preview').innerHTML = `<img src="${esc(image)}" alt="${esc(t('explorer.imageTitle'))}"><small>${esc(selected.name)}</small>`; captureReviewDraft(); }; reader.readAsDataURL(selected); }
  });
  document.addEventListener('input', event => { if (event.target.id === 'nip-query') { state.nipQuery = event.target.value; renderResults(); } });
  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-review-form]'); if (!form) return; event.preventDefault();
    const data = new FormData(form); const body = String(data.get('body') || '').trim(); const selectedIndex = data.get('imageChoice');
    const seedImage = selectedIndex === null ? null : seedReviews(tools.find(tool => tool.id === form.dataset.reviewForm))[Number(selectedIndex)]?.image;
    const image = form.dataset.localImage ? {label: form.dataset.localFilename || t('explorer.imageTitle'), src: form.dataset.localImage} : seedImage;
    const preview = form.querySelector('.review-preview');
    if (!body && !image) { preview.textContent = t('explorer.chooseBodyOrImage'); return; }
    const toolId = form.dataset.reviewForm; const seed = i18n.value('explorer.reviewsSeed');
    const review = {id: `${toolId}-current-${Date.now()}`, profile: 'local', author: seed.localName, date: new Date().toISOString().slice(0, 10), body, os: String(data.get('os') || ''), version: String(data.get('version') || ''), use: String(data.get('use') || ''), rating: data.get('rating') ? Number(data.get('rating')) : null, helpful: 0, unhelpful: 0, image};
    state.reviews[toolId] = [...(state.reviews[toolId] || []), review];
    delete state.reviewDrafts[toolId];
    renderReview({type: 'review', toolId, reviewId: review.id, clearDraft: true}, false);
    const nextPreview = els.reviewDialog.querySelector('.review-preview'); if (nextPreview) nextPreview.textContent = t('explorer.addedReview');
  });

  dialogs.forEach(dialog => {
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', event => { if (event.key !== 'Tab') return; const items = focusableElements(dialog); if (!items.length) return; const first = items[0], last = items.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } });
    dialog.addEventListener('close', () => { const opener = dialogOpeners.get(dialog); if (opener?.isConnected && (!opener.closest('dialog') || opener.closest('dialog').open)) setTimeout(() => opener.focus(), 0); });
  });
  i18n.onChange(() => renderAll());
  window.addEventListener('offline', () => { state.uiState = 'offline'; renderAll(); });
  window.addEventListener('online', () => { state.uiState = 'normal'; renderAll(); });
  window.__NOSMAPS_SET_STATE__ = next => { if (validStates.includes(next)) { state.uiState = next; renderAll(); } };
  const legacy = location.hash.match(/^#feature-([a-z]+)$/)?.[1];
  const initial = location.hash.match(/^#features-([a-z-]+)$/)?.[1]?.split('-') || [];
  state.features = legacy && featureById[legacy] ? [legacy] : initial.filter(id => featureById[id]);
  renderAll();
  window.__NOSMAPS_RELAY_LOAD__ = loadRelayCatalog;
  if (relayRequested) {
    window.addEventListener('unhandledrejection', event => { event.preventDefault(); });
    requestAnimationFrame(() => { loadRelayCatalog(); });
  }
})();
