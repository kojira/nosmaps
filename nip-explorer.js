/* Concept D — feature-first static explorer. Tool records remain shared with A/B/C. */
(() => {
  'use strict';

  const {tools, nipCatalog, nipStatusJa} = window.NOSMAPS_DATA;
  const nipByNumber = Object.fromEntries(nipCatalog.map(nip => [nip.number, nip]));
  const categoryOptions = [...new Map(tools.map(tool => [tool.category, tool.categoryLabel])).entries()];

  const icon = paths => `<svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  const features = [
    {id: 'posts', name: '投稿・返信', scene: 'タイムラインで読み書きし、返信したい', icon: icon('<path d="M5 5h14v10H9l-4 4V5Z"/><path d="m15 9 2 2-2 2M17 11h-6"/>'), nips: ['01', '09', '25']},
    {id: 'dm', name: 'DM', scene: '暗号化した個別メッセージを送りたい', icon: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/><path d="M16 4V2m-2 2V2"/>'), nips: ['44']},
    {id: 'search', name: '検索', scene: '投稿や人、識別子を探したい', icon: icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'), nips: ['01', '19', '21']},
    {id: 'media', name: '画像・動画', aliases: 'メディア', scene: '画像や動画を見たり公開したい', icon: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/><path d="m15 8 3 2-3 2V8Z"/>'), nips: ['01', '19']},
    {id: 'notifications', name: '通知', scene: '返信・リアクション・zapに気づきたい', icon: icon('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>'), nips: ['25', '57']},
    {id: 'accounts', name: '複数アカウント', aliases: 'マルチアカウント', scene: '複数の鍵やプロフィールを切り替えたい', icon: icon('<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2"/><path d="M16 14c3 0 5 1.8 5 4"/>'), nips: ['19', '46']},
    {id: 'signing', name: '外部署名', aliases: '外部署名・リモート署名 リモート署名', scene: '秘密鍵をアプリから分離してリモート署名したい', icon: icon('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3M18 4h3m-1.5-1.5v3"/>'), nips: ['46']},
    {id: 'wallet', name: 'Wallet・Zap', scene: 'zapを送る、受け取る、ウォレット接続したい', aliases: 'zapを送りたい 支払いたい 投げ銭', icon: icon('<path d="M4 6h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M15 11h6v4h-6a2 2 0 0 1 0-4Z"/><path d="m9 7-2 4h3l-2 4"/>'), nips: ['47', '57']},
    {id: 'longform', name: '長文', aliases: '長文コンテンツ 記事', scene: '記事や長いコンテンツを書きたい', icon: icon('<path d="M5 3h10l4 4v14H5V3Z"/><path d="M14 3v5h5M8 12h8M8 16h8"/>'), nips: ['23']},
    {id: 'community', name: 'チャンネル', aliases: 'チャンネル・コミュニティ コミュニティ', scene: 'チャンネルやコミュニティで会話・運営したい', icon: icon('<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M2 20c0-4 2.7-6 6-6s6 2 6 6M15 15c3 0 6 1.5 6 5"/><path d="M5 4h6"/>'), nips: ['01', '42', '78']}
  ];

  const featureById = Object.fromEntries(features.map(feature => [feature.id, feature]));
  const state = {
    feature: 'posts',
    query: '',
    platform: 'all',
    category: 'all',
    toolStatus: 'all',
    support: 'all',
    delivery: 'all',
    oss: 'all',
    includeDead: false,
    nipQuery: '',
    compare: [],
    uiState: 'normal'
  };

  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>'"]/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character]));
  const els = {
    query: $('#feature-query'),
    chips: $('#feature-chips'),
    category: $('#category-filter'),
    platform: $('#platform-filter'),
    toolStatus: $('#tool-status-filter'),
    support: $('#support-filter'),
    delivery: $('#delivery-filter'),
    oss: $('#oss-filter'),
    includeDead: $('#include-dead'),
    nipQuery: $('#nip-query'),
    results: $('#tool-results'),
    resultCount: $('#result-count'),
    selected: $('#selected-feature-summary'),
    condition: $('#condition-summary'),
    activeFilterCount: $('#active-filter-count'),
    uiState: $('#ui-state-view'),
    offline: $('#offline-banner'),
    compareActions: $('#compare-actions'),
    compareSummary: $('#compare-summary'),
    openCompare: $('#open-compare'),
    evidenceDialog: $('#evidence-dialog'),
    evidenceContent: $('#evidence-content'),
    compareDialog: $('#compare-dialog'),
    compareContent: $('#compare-content'),
    toast: $('#toast'),
    filterDetails: $('#filter-details'),
    nipList: $('#nip-list'),
    nipCount: $('#nip-count')
  };

  categoryOptions.forEach(([value, label]) => {
    els.category.insertAdjacentHTML('beforeend', `<option value="${esc(value)}">${esc(label)}</option>`);
  });

  function delivery(tool) {
    return tool.platform === 'Web' ? 'Webアプリ' : tool.platform === 'Mobile' ? 'モバイルアプリ' : 'インストール型';
  }

  function isOss(tool) {
    return !tool.license.startsWith('不明');
  }

  function displayLicense(tool) {
    return isOss(tool) ? tool.license : '不明';
  }

  function cleanEvidence(value) {
    return String(value)
      .replace(/架空/g, '')
      .replace(/モック/g, '')
      .replace(/\bmock\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function observerLabel(value) {
    if (value.includes('crawler')) return 'Nosmaps観測';
    if (value.includes('community')) return 'コミュニティレビュー';
    if (value.includes('maintainer')) return 'メンテナー申告';
    return cleanEvidence(value);
  }

  function supportRecords(tool, feature = featureById[state.feature]) {
    return feature.nips.map(number => tool.nips.find(record => record.nip === number)).filter(Boolean);
  }

  function featureSupport(tool, feature = featureById[state.feature]) {
    const records = supportRecords(tool, feature);
    if (!records.length) return null;
    const rank = {implemented: 4, partial: 3, planned: 2, unknown: 1};
    return records.map(record => record.status).sort((a, b) => rank[b] - rank[a])[0];
  }

  function featureMatchesQuery(feature) {
    const query = state.query.trim().toLowerCase();
    const haystack = `${feature.name} ${feature.scene} ${feature.aliases || ''} ${feature.nips.join(' ')}`.toLowerCase();
    return !query || haystack.includes(query);
  }

  function filteredTools() {
    const feature = featureById[state.feature];
    const query = state.nipQuery.trim().toLowerCase().replace(/^nip[- ]?/, '');
    return tools.filter(tool => {
      const support = featureSupport(tool, feature);
      if (!support) return false;
      const nipMatch = !query || supportRecords(tool, feature).some(record => {
        const nip = nipByNumber[record.nip];
        return `${record.nip} ${nip.title} ${nip.purpose}`.toLowerCase().includes(query);
      });
      return (state.includeDead || tool.status !== 'dead') &&
        (state.platform === 'all' || tool.platform === state.platform) &&
        (state.category === 'all' || tool.category === state.category) &&
        (state.toolStatus === 'all' || tool.status === state.toolStatus) &&
        (state.support === 'all' || support === state.support) &&
        (state.delivery === 'all' || delivery(tool) === state.delivery) &&
        (state.oss === 'all' || (state.oss === 'yes' ? isOss(tool) : !isOss(tool))) &&
        nipMatch;
    });
  }

  function statusLabel(status) {
    return {implemented: '対応', partial: '部分対応', planned: '予定', unknown: '不明'}[status];
  }

  function supportBadge(status) {
    return `<span class="support-badge ${status}">${statusLabel(status)}</span>`;
  }

  function renderFeatures() {
    const visible = features.filter(featureMatchesQuery);
    els.chips.innerHTML = visible.length ? visible.map(feature => {
      const label = `${feature.name} — ${feature.scene}`;
      return `<button class="feature-chip" type="button" role="option" aria-selected="${feature.id === state.feature}" aria-label="${esc(label)}" title="${esc(label)}" data-select-feature="${feature.id}">${feature.icon}<span class="feature-chip-label">${esc(feature.name)}</span></button>`;
    }).join('') : '<div class="feature-chip-empty">一致する機能がありません。検索語を短くしてください。</div>';
  }

  function featureCard(tool) {
    const feature = featureById[state.feature];
    const support = featureSupport(tool, feature);
    const checked = state.compare.includes(tool.id);
    const dead = tool.status === 'dead';
    const records = supportRecords(tool, feature);
    return `<article class="feature-tool-card ${dead ? 'dead-tool' : ''}" data-tool-id="${tool.id}">
      <div class="nip-card-top"><span class="tool-icon" aria-hidden="true">${tool.icon}</span><span class="status ${tool.status}">${tool.status}</span></div>
      <h2>${esc(tool.name)}</h2>
      <p>${esc(tool.description)}</p>
      <div class="support-line">${supportBadge(support)}<span class="tag">${esc(tool.platform)}</span><span class="tag">${esc(delivery(tool))}</span></div>
      <dl class="tool-facts">
        <div><dt>カテゴリ</dt><dd>${esc(tool.categoryLabel)}</dd></div>
        <div><dt>OSS</dt><dd>${isOss(tool) ? `<button class="source-info-link" type="button" data-mock-source="${tool.id}">${esc(displayLicense(tool))} · ソース情報</button>` : '不明（材料不足）'}</dd></div>
        <div><dt>最終観測</dt><dd>${esc(tool.observed.split(' ')[0])}</dd></div>
      </dl>
      <div class="basis-nips" aria-label="この機能のNIP裏付け">${records.map(record => `<button type="button" class="nip-tag-button" data-evidence-tool="${tool.id}" data-evidence-nip="${record.nip}">NIP-${record.nip} · ${nipStatusJa[record.status]}</button>`).join('')}</div>
      ${dead ? '<p class="replacement-note">終了／到達不能の記録。<button type="button" class="text-button" data-find-alternative>同じ機能の稼働候補へ戻る</button></p>' : ''}
      <div class="nip-card-actions">
        <label class="nip-compare-label"><input type="checkbox" data-compare-tool="${tool.id}" ${checked ? 'checked' : ''}> 比較に追加</label>
        <button class="secondary" type="button" data-feature-detail="${tool.id}">機能の根拠詳細</button>
      </div>
    </article>`;
  }

  function renderConditions() {
    const feature = featureById[state.feature];
    const active = [state.platform, state.category, state.toolStatus, state.support, state.delivery, state.oss].filter(value => value !== 'all').length + (state.includeDead ? 1 : 0) + (state.nipQuery ? 1 : 0);
    els.activeFilterCount.textContent = active;
    els.selected.innerHTML = `<strong>${feature.icon}${esc(feature.name)}</strong> <button class="text-button" type="button" data-show-feature-basis>NIPを見る</button>`;
    const category = categoryOptions.find(([value]) => value === state.category)?.[1] || '全カテゴリ';
    const parts = [feature.name, state.platform === 'all' ? '全OS' : state.platform, state.category === 'all' ? '全カテゴリ' : category, state.includeDead ? '終了分を含む' : '終了分を除外'];
    els.condition.textContent = `${parts.join(' / ')}${active ? ` / 詳細${active}件` : ''}`;
  }

  function renderNips() {
    const feature = featureById[state.feature];
    const list = feature.nips.map(number => nipByNumber[number]).filter(Boolean);
    els.nipCount.textContent = `${list.length} NIPs`;
    els.nipList.innerHTML = list.map(nip => `<article class="nip-reference-card" id="nip-${nip.number}"><strong>NIP-${nip.number}</strong><h3>${esc(nip.title)}</h3><p>${esc(nip.purpose)}</p><a href="${nip.source}" target="_blank" rel="noreferrer">公式一次資料</a></article>`).join('');
  }

  function renderCompareActions() {
    state.compare = state.compare.filter(id => tools.some(tool => tool.id === id));
    els.compareActions.hidden = state.compare.length === 0;
    els.compareSummary.textContent = `${state.compare.length}件を選択（最大3件）`;
    els.openCompare.disabled = state.compare.length < 2;
  }

  function renderResults() {
    renderConditions();
    renderNips();
    renderCompareActions();
    if (state.uiState !== 'normal' && state.uiState !== 'partial') {
      els.results.hidden = true;
      els.resultCount.textContent = '表示状態を確認中';
      els.uiState.innerHTML = stateMarkup(state.uiState);
      return;
    }
    els.results.hidden = false;
    els.uiState.innerHTML = state.uiState === 'partial' ? stateMarkup('partial') : '';
    const list = filteredTools();
    els.resultCount.textContent = `${list.length}件`;
    els.results.innerHTML = list.length ? list.map(featureCard).join('') : '<div class="empty">条件に合う候補がありません。条件を緩めるか、別の機能を選んでください。</div>';
  }

  function stateMarkup(type) {
    if (type === 'loading') return '<div class="state-message"><div class="nip-skeleton" aria-label="読み込み中"><span></span><span></span><span></span></div><strong>機能対応情報を読み込み中…</strong></div>';
    if (type === 'empty') return '<div class="state-message"><div><strong>データが0件の状態</strong><p>選択した機能に候補がありません。別の条件を試してください。</p></div></div>';
    if (type === 'error') return '<div class="state-message error"><div><strong>対応情報を取得できませんでした</strong><p>再試行できます。</p><button class="secondary" type="button" data-ui-state="normal">再試行</button></div></div>';
    if (type === 'partial') return '<div class="state-message partial"><strong>一部データのみ：</strong> 観測詳細が欠けている項目があります。「不明」を非対応と解釈しないでください。</div>';
    return '';
  }

  function renderAll() {
    renderFeatures();
    renderResults();
  }

  function selectFeature(id) {
    if (!featureById[id]) return;
    state.feature = id;
    state.uiState = 'normal';
    els.offline.hidden = true;
    renderAll();
    history.replaceState(null, '', `#feature-${id}`);
  }

  function updateFilter(key, value) {
    state[key] = value;
    state.uiState = 'normal';
    els.offline.hidden = true;
    renderResults();
  }

  function resetFilters() {
    Object.assign(state, {platform: 'all', category: 'all', toolStatus: 'all', support: 'all', delivery: 'all', oss: 'all', includeDead: false, nipQuery: ''});
    [els.platform, els.category, els.toolStatus, els.support, els.delivery, els.oss].forEach(element => { element.value = 'all'; });
    els.includeDead.checked = false;
    els.nipQuery.value = '';
    renderResults();
  }

  function setUiState(value) {
    state.uiState = value === 'offline' ? 'normal' : value;
    els.offline.hidden = value !== 'offline';
    renderResults();
    if (value === 'offline') els.uiState.innerHTML = '<div class="state-message partial"><strong>オフライン：</strong> 保存済みデータだけで表示しています。外部通信はありません。</div>';
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  function toggleCompare(id, checked) {
    if (checked && !state.compare.includes(id)) {
      if (state.compare.length >= 3) {
        toast('比較は最大3件です。');
        const checkbox = $(`[data-compare-tool="${id}"]`);
        if (checkbox) checkbox.checked = false;
        return;
      }
      state.compare.push(id);
    } else if (!checked) {
      state.compare = state.compare.filter(item => item !== id);
    }
    renderCompareActions();
  }

  function dialogHead(kicker, title, description = '') {
    return `<div class="dialog-head"><div><div class="dialog-kicker">${esc(kicker)}</div><h2 id="evidence-title">${title}</h2>${description ? `<p>${esc(description)}</p>` : ''}</div><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div>`;
  }

  function openEvidenceDialog() {
    if (!els.evidenceDialog.open) els.evidenceDialog.showModal();
  }

  function showEvidence(toolId, nipNumber) {
    const tool = tools.find(item => item.id === toolId);
    const support = tool?.nips.find(record => record.nip === nipNumber);
    const nip = nipByNumber[nipNumber];
    if (!tool || !support || !nip) return;
    els.evidenceContent.innerHTML = `${dialogHead('Evidence', `${esc(tool.name)} × NIP-${nip.number}`)}
      <div class="support-line">${supportBadge(support.status)}<strong>${esc(nip.title)}</strong></div>
      <dl class="nip-evidence-grid">
        <div><dt>根拠</dt><dd>${esc(cleanEvidence(support.evidence))}</dd></div>
        <div><dt>観測日時</dt><dd>${esc(support.observed)}</dd></div>
        <div><dt>観測主体</dt><dd>${esc(observerLabel(support.observer))}</dd></div>
        <div><dt>NIPの用途</dt><dd>${esc(nip.purpose)}</dd></div>
      </dl>
      ${support.status === 'unknown' ? '<p class="unknown-note"><strong>不明 ≠ 非対応。</strong> 材料不足による保留です。</p>' : ''}
      <p><a class="secondary nav-link" href="${nip.source}" target="_blank" rel="noreferrer">公式NIP一次資料を開く</a></p>`;
    openEvidenceDialog();
  }

  function showFeatureDetail(toolId) {
    const tool = tools.find(item => item.id === toolId);
    const feature = featureById[state.feature];
    if (!tool) return;
    const records = supportRecords(tool, feature);
    els.evidenceContent.innerHTML = `${dialogHead('Feature basis', `${esc(tool.name)}の「${esc(feature.name)}」`, feature.scene)}
      <div class="feature-basis-list">${records.map(record => `<button class="basis-row" type="button" data-evidence-tool="${tool.id}" data-evidence-nip="${record.nip}"><span><strong>NIP-${record.nip}</strong> ${esc(nipByNumber[record.nip].title)}</span>${supportBadge(record.status)}<small>根拠・観測詳細へ</small></button>`).join('')}</div>`;
    openEvidenceDialog();
  }

  function showSourceInfo(toolId) {
    const tool = tools.find(item => item.id === toolId);
    if (!tool) return;
    history.replaceState(null, '', `#source-info-${tool.id}`);
    els.evidenceContent.innerHTML = `${dialogHead('Source information', `${esc(tool.name)}のソース情報`)}
      <p class="unknown-note"><strong>外部リポジトリへの移動は行いません。</strong> この操作は、ソース参照導線の安全な確認用です。</p>
      <dl class="nip-evidence-grid"><div><dt>ライセンス表示</dt><dd>${esc(displayLicense(tool))}</dd></div><div><dt>ページ内の参照先</dt><dd><code>#source-info-${esc(tool.id)}</code></dd></div></dl>`;
    openEvidenceDialog();
  }

  function comparisonItem(label, values, contents, iconMarkup = '') {
    const different = new Set(values).size > 1;
    return `<section class="comparison-item ${different ? 'is-different' : 'is-identical'}" data-comparison-item data-difference="${different}">
      <div class="comparison-label">${iconMarkup}${esc(label)}</div>
      <div class="comparison-values">${contents.map(content => `<div class="comparison-value">${content}</div>`).join('')}</div>
    </section>`;
  }

  function showCompare() {
    if (state.compare.length < 2) return;
    const selected = state.compare.map(id => tools.find(tool => tool.id === id)).filter(Boolean);
    const featureRows = features
      .map(feature => {
        const supports = selected.map(tool => featureSupport(tool, feature));
        const values = supports.map(support => support || 'none');
        const contents = selected.map((tool, index) => supports[index]
          ? `${supportBadge(supports[index])}<button class="comparison-evidence" type="button" data-matrix-basis="${tool.id}" data-matrix-feature="${feature.id}">NIP裏付け</button>`
          : '<span aria-label="対応記録なし">—</span>');
        return {different: new Set(values).size > 1, markup: comparisonItem(feature.name, values, contents, feature.icon)};
      })
      .sort((a, b) => Number(b.different) - Number(a.different));

    const factDefinitions = [
      ['OS', tool => tool.platform],
      ['提供形態', tool => delivery(tool)],
      ['OSS', tool => displayLicense(tool)],
      ['更新状態', tool => tool.status],
      ['カテゴリ', tool => tool.categoryLabel],
      ['最終観測', tool => tool.observed.split(' ')[0]]
    ];
    const factRows = factDefinitions.map(([label, getValue]) => {
      const values = selected.map(getValue);
      return {different: new Set(values).size > 1, markup: comparisonItem(label, values, values.map(value => esc(value)))};
    }).sort((a, b) => Number(b.different) - Number(a.different));

    const count = selected.length;
    els.compareContent.innerHTML = `<div class="dialog-head"><div><div class="dialog-kicker">Differences first</div><h2 id="compare-title">${count}件の機能比較</h2><p>差がある項目を先に表示します。</p></div><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div>
      <div class="comparison-body" style="--candidate-count:${count}">
        <div class="comparison-candidates" aria-label="比較候補">${selected.map(tool => `<div class="comparison-candidate">${esc(tool.name)}</div>`).join('')}</div>
        <section class="comparison-group" aria-labelledby="feature-comparison-title"><h3 class="comparison-group-title" id="feature-comparison-title">機能</h3>${featureRows.map(row => row.markup).join('')}</section>
        <section class="comparison-group" aria-labelledby="attribute-comparison-title"><h3 class="comparison-group-title" id="attribute-comparison-title">基本情報</h3>${factRows.map(row => row.markup).join('')}</section>
      </div>`;
    els.compareDialog.showModal();
  }

  function showFeatureBasis() {
    $('#nip-reference').scrollIntoView({behavior: 'smooth'});
  }

  els.query.addEventListener('input', event => {
    state.query = event.target.value;
    renderFeatures();
  });

  [['platform', els.platform], ['category', els.category], ['toolStatus', els.toolStatus], ['support', els.support], ['delivery', els.delivery], ['oss', els.oss]].forEach(([key, element]) => {
    element.addEventListener('change', event => updateFilter(key, event.target.value));
  });

  els.includeDead.addEventListener('change', event => updateFilter('includeDead', event.target.checked));
  els.nipQuery.addEventListener('input', event => updateFilter('nipQuery', event.target.value));
  $('#clear-filters').addEventListener('click', resetFilters);
  $('#clear-compare').addEventListener('click', () => {
    state.compare = [];
    document.querySelectorAll('[data-compare-tool]').forEach(checkbox => { checkbox.checked = false; });
    renderCompareActions();
  });
  els.openCompare.addEventListener('click', showCompare);

  document.addEventListener('click', event => {
    const feature = event.target.closest('[data-select-feature]');
    if (feature) {
      selectFeature(feature.dataset.selectFeature);
      return;
    }
    const evidence = event.target.closest('[data-evidence-tool]');
    if (evidence) {
      showEvidence(evidence.dataset.evidenceTool, evidence.dataset.evidenceNip);
      return;
    }
    const detail = event.target.closest('[data-feature-detail]');
    if (detail) {
      showFeatureDetail(detail.dataset.featureDetail);
      return;
    }
    const matrix = event.target.closest('[data-matrix-basis]');
    if (matrix) {
      els.compareDialog.close();
      state.feature = matrix.dataset.matrixFeature;
      showFeatureDetail(matrix.dataset.matrixBasis);
      return;
    }
    const source = event.target.closest('[data-mock-source]');
    if (source) {
      showSourceInfo(source.dataset.mockSource);
      return;
    }
    const close = event.target.closest('[data-close-dialog]');
    if (close) {
      close.closest('dialog').close();
      return;
    }
    const uiState = event.target.closest('[data-ui-state]');
    if (uiState) {
      setUiState(uiState.dataset.uiState);
      return;
    }
    if (event.target.closest('[data-find-alternative]')) {
      state.includeDead = false;
      els.includeDead.checked = false;
      renderResults();
      return;
    }
    if (event.target.closest('[data-show-feature-basis]')) showFeatureBasis();
  });

  document.addEventListener('change', event => {
    if (event.target.matches('[data-compare-tool]')) toggleCompare(event.target.dataset.compareTool, event.target.checked);
  });

  [els.evidenceDialog, els.compareDialog].forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  });

  window.addEventListener('offline', () => setUiState('offline'));
  window.addEventListener('online', () => setUiState('normal'));
  els.filterDetails.open = false;
  const initialFeature = location.hash.match(/^#feature-([a-z]+)$/)?.[1];
  if (initialFeature && featureById[initialFeature]) state.feature = initialFeature;
  renderAll();
})();
