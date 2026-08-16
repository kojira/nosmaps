/* Concept D — feature-first static explorer. Tool records remain shared with A/B/C. */
(() => {
  'use strict';

  const {tools, nipCatalog, nipStatusJa} = window.NOSMAPS_DATA;
  const nipByNumber = Object.fromEntries(nipCatalog.map(nip => [nip.number, nip]));
  const categoryOptions = [...new Map(tools.map(tool => [tool.category, tool.categoryLabel])).entries()];

  const icon = paths => `<svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  const features = [
    {id: 'posts', name: '投稿・返信', scene: 'タイムラインで読み書きし、返信したい', icon: icon('<path d="M5 5h14v10H9l-4 4V5Z"/><path d="m15 9 2 2-2 2M17 11h-6"/>'), nips: ['01', '09', '25']},
    {id: 'dm', name: 'DM', aliases: '暗号化DM 暗号化メッセージ 個別メッセージ', scene: '暗号化した個別メッセージを送りたい', icon: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/><path d="M16 4V2m-2 2V2"/>'), nips: ['44']},
    {id: 'search', name: '検索', scene: '投稿や人、識別子を探したい', icon: icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'), nips: ['01', '19', '21']},
    {id: 'media', name: '画像・動画', aliases: 'メディア 画像投稿 動画投稿', scene: '画像や動画を見たり公開したい', icon: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/><path d="m15 8 3 2-3 2V8Z"/>'), nips: ['01', '19']},
    {id: 'notifications', name: '通知', scene: '返信・リアクション・zapに気づきたい', icon: icon('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>'), nips: ['25', '57']},
    {id: 'accounts', name: '複数アカウント', aliases: 'マルチアカウント', scene: '複数の鍵やプロフィールを切り替えたい', icon: icon('<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2"/><path d="M16 14c3 0 5 1.8 5 4"/>'), nips: ['19', '46']},
    {id: 'signing', name: '外部署名', aliases: '外部署名・リモート署名 リモート署名', scene: '秘密鍵をアプリから分離してリモート署名したい', icon: icon('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3M18 4h3m-1.5-1.5v3"/>'), nips: ['46']},
    {id: 'wallet', name: 'Wallet・Zap', scene: 'zapを送る、受け取る、ウォレット接続したい', aliases: 'zapを送りたい 支払いたい 投げ銭', icon: icon('<path d="M4 6h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M15 11h6v4h-6a2 2 0 0 1 0-4Z"/><path d="m9 7-2 4h3l-2 4"/>'), nips: ['47', '57']},
    {id: 'longform', name: '長文', aliases: '長文コンテンツ 記事', scene: '記事や長いコンテンツを書きたい', icon: icon('<path d="M5 3h10l4 4v14H5V3Z"/><path d="M14 3v5h5M8 12h8M8 16h8"/>'), nips: ['23']},
    {id: 'community', name: 'チャンネル', aliases: 'チャンネル・コミュニティ コミュニティ', scene: 'チャンネルやコミュニティで会話・運営したい', icon: icon('<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M2 20c0-4 2.7-6 6-6s6 2 6 6M15 15c3 0 6 1.5 6 5"/><path d="M5 4h6"/>'), nips: ['01', '42', '78']}
  ];

  const featureById = Object.fromEntries(features.map(feature => [feature.id, feature]));
  const state = {
    features: [],
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
    savedOnly: false,
    likes: {},
    bookmarks: {},
    reviews: {},
    reviewVotes: {},
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
    savedOnly: $('#saved-only'),
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
    reviewDialog: $('#review-dialog'),
    reviewContent: $('#review-content'),
    profileDialog: $('#profile-dialog'),
    profileContent: $('#profile-content'),
    galleryDialog: $('#gallery-dialog'),
    galleryContent: $('#gallery-content'),
    imageDialog: $('#image-dialog'),
    imageContent: $('#image-content'),
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

  function supportRecords(tool, feature) {
    if (!feature) return [];
    return feature.nips.map(number => tool.nips.find(record => record.nip === number)).filter(Boolean);
  }

  function featureSupport(tool, feature) {
    const records = supportRecords(tool, feature);
    if (!records.length) return null;
    const rank = {implemented: 4, partial: 3, planned: 2, unknown: 1};
    return records.map(record => record.status).sort((a, b) => rank[b] - rank[a])[0];
  }

  function toolAliases(tool) {
    const aliases = Array.isArray(tool.aliases) ? tool.aliases : tool.aliases ? [tool.aliases] : [];
    return [...aliases, ...tool.tags, ...tool.purposes, `${tool.name} app`, `${tool.categoryLabel}ツール`];
  }

  function selectedFeatures(source = state) {
    return source.features.map(id => featureById[id]).filter(Boolean);
  }

  function toolMatchesQuery(tool, source = state) {
    const query = source.query.trim().toLowerCase();
    const supportedFeatures = features.filter(feature => featureSupport(tool, feature));
    const nipTerms = tool.nips.flatMap(record => {
      const nip = nipByNumber[record.nip];
      return [`NIP-${record.nip}`, `NIP ${record.nip}`, record.nip, nip?.title || '', nip?.purpose || ''];
    });
    const haystack = [
      tool.name, tool.summary || tool.description, tool.description, tool.category, tool.categoryLabel, tool.platform, ...(tool.os || []), delivery(tool),
      ...toolAliases(tool), tool.license, isOss(tool) ? 'OSS open source オープンソース' : '',
      ...supportedFeatures.flatMap(feature => [feature.name, feature.scene, feature.aliases || '']), ...nipTerms
    ].join(' ').toLowerCase();
    return !query || haystack.includes(query);
  }

  function filteredTools(overrides = {}) {
    const source = {...state, ...overrides};
    const selected = selectedFeatures(source);
    const query = source.nipQuery.trim().toLowerCase().replace(/^nip[- ]?/, '');
    return tools.filter(tool => {
      const supports = selected.map(feature => featureSupport(tool, feature));
      if (supports.some(support => !support)) return false;
      const relevantRecords = selected.length
        ? selected.flatMap(feature => supportRecords(tool, feature))
        : tool.nips;
      const nipMatch = !query || relevantRecords.some(record => {
        const nip = nipByNumber[record.nip];
        return `${record.nip} NIP-${record.nip} ${nip.title} ${nip.purpose}`.toLowerCase().includes(query);
      });
      return toolMatchesQuery(tool, source) &&
        (source.includeDead || tool.status !== 'dead') &&
        (!source.savedOnly || Boolean(source.bookmarks[tool.id])) &&
        (source.platform === 'all' || tool.platform === source.platform || (tool.os || []).includes(source.platform)) &&
        (source.category === 'all' || tool.category === source.category) &&
        (source.toolStatus === 'all' || tool.status === source.toolStatus) &&
        (source.support === 'all' || (supports.length > 0 && supports.every(support => support === source.support))) &&
        (source.delivery === 'all' || delivery(tool) === source.delivery) &&
        (source.oss === 'all' || (source.oss === 'yes' ? isOss(tool) : !isOss(tool))) &&
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
    els.chips.innerHTML = features.map(feature => {
      const label = `${feature.name} — ${feature.scene}`;
      const selected = state.features.includes(feature.id);
      return `<button class="feature-chip" type="button" aria-pressed="${selected}" aria-label="${esc(label)}" title="${esc(label)}" data-select-feature="${feature.id}">${feature.icon}<span class="feature-chip-label">${esc(feature.name)}</span><span class="feature-description">${esc(feature.scene)}</span></button>`;
    }).join('');
  }

  function mockLinks(tool) {
    const slug = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const links = [
      ['site', '公式サイト', `https://${slug}.example.invalid/`],
      ['distribution', 'アプリ配布', `https://store.example.invalid/apps/${slug}`],
      ['docs', '公式Docs', `https://docs.${slug}.example.invalid/`]
    ];
    if (isOss(tool)) links.push(['source', 'ソース', `https://code.example.invalid/${slug}/source`]);
    return links;
  }

  function linkMarkup(tool) {
    return `<span class="safe-link-note">SAFE LINK PREVIEW · 外部遷移なし</span>${mockLinks(tool).map(([type, label]) => `<button class="resource-link" type="button" data-safe-link="${tool.id}" data-link-type="${type}" aria-label="${esc(label)}（安全プレビュー・外部遷移なし）">${esc(label)}<small>安全プレビュー</small></button>`).join('')}`;
  }

  const reviewerProfiles = {
    a: {name: 'Mina / relay walker', npub: 'npub1mina7q3fakereviewer9x2m0ck', bio: '複数OSでNostrクライアントの導線とアクセシビリティを試す架空レビュアー。', created: '2023-04（モック）', spread: '28か月・11カテゴリ・Web/Desktop/Mobile', posts: '月2〜9件。短文、画像、検証メモに分散', useful: 31, notUseful: 4},
    b: {name: 'Tao / quiet tester', npub: 'npub1tao8r5fakereviewer7k4m0ck', bio: '初見利用と比較検証を中心に記録する架空レビュアー。', created: '2024-11（モック）', spread: '9か月・6カテゴリ・Web中心', posts: '月1〜4件。比較レビューと返信に分散', useful: 18, notUseful: 3},
    local: {name: '未署名のあなた', npub: 'npub1unsignedpreview000000000mock', bio: 'この表示中だけ存在する未署名プロフィール。リロードで消えます。', created: '未作成', spread: 'このページ内の未送信プレビューのみ', posts: 'Nostr投稿履歴なし', useful: 0, notUseful: 0}
  };

  const screenshots = [
    {id: 'timeline', label: 'タイムライン画面', color: '#6752b8'},
    {id: 'composer', label: '投稿画面', color: '#247c79'},
    {id: 'settings', label: '設定画面', color: '#9a5d2e'}
  ];

  function reviewSeed(tool) {
    const number = tool.id.replace('tool-', '').padStart(2, '0');
    const reviews = [
      {id: `${tool.id}-a`, profile: 'a', author: reviewerProfiles.a.name, npub: reviewerProfiles.a.npub, date: '2026-08-14 12:20 UTC', body: '主要導線を短時間で確認できました。', os: tool.platform, version: `v${1 + Number(tool.id.replace('tool-', '')) % 4}.${Number(tool.id.replace('tool-', '')) % 10}`, rating: 4, use: '日常利用', helpful: 14 + Number(number), unhelpful: 2, image: Number(number) % 2 ? screenshots[0] : null},
      {id: `${tool.id}-b`, profile: 'b', author: reviewerProfiles.b.name, npub: reviewerProfiles.b.npub, date: '2026-08-12 07:45 UTC', body: '不明項目が明示され、判断材料を分けて読めます。', os: '未入力', version: '未入力', rating: null, use: '比較検証', helpful: 8 + Number(number), unhelpful: 1, image: Number(number) % 3 === 0 ? screenshots[2] : null}
    ];
    if (tool.id === 'tool-1') reviews.push(
      {id: `${tool.id}-c`, profile: 'a', author: reviewerProfiles.a.name, npub: reviewerProfiles.a.npub, date: '2026-08-10 18:05 UTC', body: '', os: 'Mobile', version: 'v2.4', rating: 4, use: '画像記録', helpful: 9, unhelpful: 1, image: screenshots[1]},
      {id: `${tool.id}-d`, profile: 'b', author: reviewerProfiles.b.name, npub: reviewerProfiles.b.npub, date: '2026-08-09 09:30 UTC', body: '設定画面の導線を確認しました。', os: 'Desktop', version: 'v2.4', rating: 3, use: '設定確認', helpful: 6, unhelpful: 0, image: screenshots[2]},
      {id: `${tool.id}-e`, profile: 'a', author: reviewerProfiles.a.name, npub: reviewerProfiles.a.npub, date: '2026-08-08 14:10 UTC', body: '投稿画面の余白を確認しました。', os: 'Web', version: 'v2.4', rating: 4, use: '投稿確認', helpful: 7, unhelpful: 1, image: screenshots[1]}
    );
    return reviews;
  }

  function allReviews(tool) {
    return [...reviewSeed(tool), ...(state.reviews[tool.id] || [])];
  }

  function screenshotMarkup(image, compact = false) {
    if (!image) return '';
    if (image.dataUrl) return `<div class="mock-shot local-shot ${compact ? 'compact' : ''}"><img src="${image.dataUrl}" alt="${esc(image.label)}"><span>端末内だけのプレビュー</span></div>`;
    return `<div class="mock-shot ${compact ? 'compact' : ''}" style="--shot:${esc(image.color)}" role="img" aria-label="${esc(image.label)}の架空スクリーンショット"><span>架空スクリーンショット</span><strong>${esc(image.label)}</strong><i aria-hidden="true"></i></div>`;
  }

  function voteCounts(review) {
    const vote = state.reviewVotes[review.id];
    return {helpful: review.helpful + (vote === 'helpful' ? 1 : 0), unhelpful: review.unhelpful + (vote === 'unhelpful' ? 1 : 0), vote};
  }

  function reviewMarkup(review, toolId) {
    const counts = voteCounts(review);
    return `<article class="review-item" id="review-${esc(review.id)}" data-review-id="${esc(review.id)}">
      <header class="review-author"><button type="button" class="reviewer-link" data-reviewer="${esc(review.profile)}"><strong>${esc(review.author)}</strong><small>${esc(review.npub)}</small></button><time>${esc(review.date)}</time></header>
      ${review.body ? `<p>${esc(review.body)}</p>` : '<p class="muted">本文なし（画像レビュー）</p>'}
      ${review.image ? `<button class="review-image-button" type="button" data-open-image="${esc(toolId)}" data-image-review="${esc(review.id)}">${screenshotMarkup(review.image, true)}<span>画像を拡大</span></button>` : ''}
      <dl><div><dt>対象OS</dt><dd>${esc(review.os || '未入力')}</dd></div><div><dt>アプリversion</dt><dd>${esc(review.version || '未入力')}</dd></div><div><dt>評価</dt><dd>${review.rating ? `${review.rating}/5` : '任意・未評価'}</dd></div><div><dt>用途</dt><dd>${esc(review.use || '未入力')}</dd></div></dl>
      <div class="helpful-actions" aria-label="レビューへの役立ち評価"><button type="button" data-review-vote="helpful" data-review-id="${esc(review.id)}" data-review-tool-id="${esc(toolId)}" aria-pressed="${counts.vote === 'helpful'}">役に立った ${counts.helpful}</button><button type="button" data-review-vote="unhelpful" data-review-id="${esc(review.id)}" data-review-tool-id="${esc(toolId)}" aria-pressed="${counts.vote === 'unhelpful'}">立たなかった ${counts.unhelpful}</button><button class="text-button" type="button" data-vote-basis="${esc(review.id)}">評価者${counts.helpful + counts.unhelpful}人・内訳</button></div>
      ${counts.vote ? '<p class="vote-preview-state">あなたの選択をローカル反映中（未署名・未送信・リロードで消去）</p>' : ''}
    </article>`;
  }

  function likeCount(tool) {
    return 12 + Number(tool.id.replace('tool-', '')) * 3 + (state.likes[tool.id] ? 1 : 0);
  }

  function cardReviewThumbnails(tool) {
    const images = allReviews(tool).filter(review => review.image);
    if (!images.length) return '';
    const shown = images.slice(0, 3);
    const remaining = images.length - shown.length;
    return `<div class="card-review-thumbnails" aria-label="レビュー添付画像 ${images.length}件">${shown.map(review => {
      const label = `${review.author}・${review.date}のレビュー画像を拡大`;
      return `<button type="button" class="card-review-thumbnail" data-open-image="${esc(tool.id)}" data-image-review="${esc(review.id)}" aria-label="${esc(label)}" title="${esc(label)}">${screenshotMarkup(review.image, true)}</button>`;
    }).join('')}${remaining ? `<button type="button" class="card-review-more" data-gallery-tool="${esc(tool.id)}" aria-label="残り${remaining}件を含む画像ギャラリーを開く" title="画像ギャラリーを開く">+${remaining}</button>` : ''}</div>`;
  }

  function featureCard(tool) {
    const selected = selectedFeatures();
    const supports = selected.map(feature => ({feature, support: featureSupport(tool, feature)}));
    const checked = state.compare.includes(tool.id);
    const dead = tool.status === 'dead';
    const records = [...new Map(selected.flatMap(feature => supportRecords(tool, feature)).map(record => [record.nip, record])).values()];
    const bookmark = state.bookmarks[tool.id];
    const reviewCount = reviewSeed(tool).length + (state.reviews[tool.id]?.length || 0);
    return `<article class="feature-tool-card ${dead ? 'dead-tool' : ''}" data-tool-id="${tool.id}">
      <div class="nip-card-top"><span class="tool-icon" aria-hidden="true">${tool.icon}</span><span class="status ${tool.status}">${tool.status}</span></div>
      <h2>${esc(tool.name)}</h2>
      <p>${esc(tool.description)}</p>
      <section class="card-layer fact-layer" aria-labelledby="facts-${tool.id}">
        <h3 id="facts-${tool.id}">事実・観測</h3>
        <div class="support-line">${supports.length ? supports.map(({feature, support}) => `<span class="feature-support-summary">${esc(feature.name)} ${supportBadge(support)}</span>`).join('') : '<span class="tag">機能条件なし</span>'}<span class="tag">${esc(tool.platform)}</span><span class="tag">${esc((tool.os || []).filter(os => os !== tool.platform).join(' / ') || delivery(tool))}</span></div>
        <dl class="tool-facts"><div><dt>カテゴリ</dt><dd>${esc(tool.categoryLabel)}</dd></div><div><dt>OSS</dt><dd>${esc(displayLicense(tool))}</dd></div><div><dt>最終観測</dt><dd>${esc(tool.observed.split(' ')[0])}</dd></div></dl>
        <nav class="resource-links" aria-label="${esc(tool.name)}の公式導線">${linkMarkup(tool)}</nav>
        ${records.length ? `<div class="basis-nips" aria-label="選択機能のNIP裏付け">${records.map(record => `<button type="button" class="nip-tag-button" data-evidence-tool="${tool.id}" data-evidence-nip="${record.nip}">NIP-${record.nip} · ${nipStatusJa[record.status]}</button>`).join('')}</div>` : ''}
      </section>
      <section class="card-layer evaluation-layer" aria-labelledby="ratings-${tool.id}">
        <h3 id="ratings-${tool.id}">利用者評価</h3>
        <p class="local-only">この端末の表示だけ更新・未署名・未送信</p>
        ${cardReviewThumbnails(tool)}
        <div class="evaluation-actions">
          <button type="button" class="like-button" data-like-tool="${tool.id}" aria-pressed="${Boolean(state.likes[tool.id])}">♥ ${likeCount(tool)}</button>
          <button type="button" data-bookmark-tool="${tool.id}" aria-pressed="${Boolean(bookmark)}">${bookmark ? 'ブックマーク済み' : '非公開でブックマーク'}</button>
          <button type="button" data-review-tool="${tool.id}">レビュー ${reviewCount}</button>
        </div>
        ${bookmark ? `<label class="public-toggle"><input type="checkbox" data-public-bookmark="${tool.id}" ${bookmark.public ? 'checked' : ''}> 公開へ切替（操作イメージ）</label><span class="privacy-state">${bookmark.public ? '公開プレビュー・未送信' : '非公開（既定）'}</span>` : '<span class="privacy-state">ブックマークは非公開が既定</span>'}
      </section>
      ${dead ? '<p class="replacement-note">終了／到達不能の記録。<button type="button" class="text-button" data-find-alternative>同じ機能の稼働候補へ戻る</button></p>' : ''}
      <div class="nip-card-actions"><label class="nip-compare-label"><input type="checkbox" data-compare-tool="${tool.id}" ${checked ? 'checked' : ''}> 比較に追加</label><button class="secondary" type="button" data-feature-detail="${tool.id}">詳細・根拠</button></div>
    </article>`;
  }

  function activeConditions() {
    const conditions = state.features.map(id => ({key: `feature:${id}`, label: `機能「${featureById[id].name}」`, overrides: {features: state.features.filter(item => item !== id)}}));
    if (state.query) conditions.push({key: 'query', label: `全文検索「${state.query}」`, overrides: {query: ''}});
    if (state.platform !== 'all') conditions.push({key: 'platform', label: `OS／環境「${state.platform}」`, overrides: {platform: 'all'}});
    if (state.category !== 'all') conditions.push({key: 'category', label: `カテゴリ「${categoryOptions.find(([value]) => value === state.category)?.[1] || state.category}」`, overrides: {category: 'all'}});
    if (state.toolStatus !== 'all') conditions.push({key: 'toolStatus', label: `更新状態「${state.toolStatus}」`, overrides: {toolStatus: 'all'}});
    if (state.support !== 'all') conditions.push({key: 'support', label: `機能対応「${statusLabel(state.support)}」`, overrides: {support: 'all'}});
    if (state.delivery !== 'all') conditions.push({key: 'delivery', label: `提供形態「${state.delivery}」`, overrides: {delivery: 'all'}});
    if (state.oss !== 'all') conditions.push({key: 'oss', label: `OSS「${state.oss === 'yes' ? 'OSS' : '不明'}」`, overrides: {oss: 'all'}});
    if (state.includeDead) conditions.push({key: 'includeDead', label: '終了／到達不能を含む', overrides: {includeDead: false}});
    if (state.savedOnly) conditions.push({key: 'savedOnly', label: 'ブックマーク済みだけ', overrides: {savedOnly: false}});
    if (state.nipQuery) conditions.push({key: 'nipQuery', label: `NIP「${state.nipQuery}」`, overrides: {nipQuery: ''}});
    return conditions;
  }

  function syncControls() {
    if (!state.features.length) state.support = 'all';
    els.query.value = state.query;
    els.platform.value = state.platform;
    els.category.value = state.category;
    els.toolStatus.value = state.toolStatus;
    els.support.value = state.support;
    els.support.disabled = state.features.length === 0;
    els.delivery.value = state.delivery;
    els.oss.value = state.oss;
    els.includeDead.checked = state.includeDead;
    els.savedOnly.checked = state.savedOnly;
    els.nipQuery.value = state.nipQuery;
  }

  function removeCondition(key) {
    const condition = activeConditions().find(item => item.key === key);
    if (!condition) return;
    Object.assign(state, condition.overrides);
    state.uiState = 'normal';
    els.offline.hidden = true;
    syncControls();
    renderAll();
  }

  function renderConditions() {
    const selected = selectedFeatures();
    const conditions = activeConditions();
    const detailedCount = conditions.filter(condition => !condition.key.startsWith('feature:') && condition.key !== 'query').length;
    els.activeFilterCount.textContent = detailedCount;
    els.selected.innerHTML = selected.length
      ? `<strong>機能条件（すべてAND）:</strong> ${selected.map(feature => `<button class="selected-condition" type="button" data-remove-condition="feature:${feature.id}" aria-label="${esc(feature.name)}条件を外す">${feature.icon}${esc(feature.name)} <span aria-hidden="true">×</span></button>`).join('<span class="and-mark">AND</span>')} <button class="text-button" type="button" data-show-feature-basis>NIPを見る</button>`
      : '<strong>機能は未選択：</strong> すべての候補を表示';
    els.condition.innerHTML = conditions.length
      ? `<span class="condition-logic">有効な条件（すべてAND）</span>${conditions.map(condition => `<button type="button" class="condition-pill" data-remove-condition="${esc(condition.key)}" aria-label="${esc(condition.label)}を外す">${esc(condition.label)} <span aria-hidden="true">×</span></button>`).join('')}`
      : '<span class="condition-logic">有効な追加条件なし（終了／到達不能は初期表示から除外）</span>';
  }

  function renderNips() {
    const selected = selectedFeatures();
    const numbers = [...new Set(selected.flatMap(feature => feature.nips))];
    const list = numbers.map(number => nipByNumber[number]).filter(Boolean);
    els.nipCount.textContent = `${list.length} NIPs`;
    els.nipList.innerHTML = list.length
      ? list.map(nip => `<article class="nip-reference-card" id="nip-${nip.number}"><strong>NIP-${nip.number}</strong><h3>${esc(nip.title)}</h3><p>${esc(nip.purpose)}</p><a href="${nip.source}" target="_blank" rel="noreferrer">公式一次資料</a></article>`).join('')
      : '<p class="feature-chip-empty">機能を選ぶと、関連するNIPの一次資料を表示します。</p>';
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
    if (list.length) {
      els.results.innerHTML = list.map(featureCard).join('');
      return;
    }
    const relaxations = activeConditions().map(condition => ({...condition, count: filteredTools(condition.overrides).length})).sort((a, b) => b.count - a.count);
    const suggestion = relaxations[0];
    els.results.innerHTML = `<div class="empty zero-results"><h2>条件に合う候補がありません</h2><p>有効な条件は上に個別表示されています。×で1件ずつ外せます。</p>${suggestion ? `<button class="secondary relaxation-suggestion" type="button" data-remove-condition="${esc(suggestion.key)}">「${esc(suggestion.label)}」を外すと ${suggestion.count}件</button>` : '<button class="secondary" type="button" data-reset-all>すべての条件をリセット</button>'}</div>`;
  }

  function stateMarkup(type) {
    if (type === 'loading') return '<div class="state-message"><div class="nip-skeleton" aria-label="読み込み中"><span></span><span></span><span></span></div><strong>機能対応情報を読み込み中…</strong></div>';
    if (type === 'empty') return '<div class="state-message"><div><strong>データが0件の状態</strong><p>選択した機能に候補がありません。別の条件を試してください。</p></div></div>';
    if (type === 'error') return '<div class="state-message error"><div><strong>対応情報を取得できませんでした</strong><p>再試行できます。</p><button class="secondary" type="button" data-ui-state="normal">再試行</button></div></div>';
    if (type === 'partial') return '<div class="state-message partial"><strong>一部データのみ（現在の候補カード）：</strong> 観測詳細が欠けている項目があります。「不明」を非対応と解釈しないでください。</div>';
    return '';
  }

  function renderAll() {
    syncControls();
    renderFeatures();
    renderResults();
  }

  function selectFeature(id) {
    if (!featureById[id]) return;
    state.features = state.features.includes(id) ? state.features.filter(item => item !== id) : [...state.features, id];
    state.uiState = 'normal';
    els.offline.hidden = true;
    renderAll();
    history.replaceState(null, '', state.features.length ? `#features-${state.features.join('-')}` : location.pathname);
  }

  function updateFilter(key, value) {
    state[key] = value;
    state.uiState = 'normal';
    els.offline.hidden = true;
    renderResults();
  }

  function resetFilters() {
    Object.assign(state, {features: [], query: '', platform: 'all', category: 'all', toolStatus: 'all', support: 'all', delivery: 'all', oss: 'all', includeDead: false, savedOnly: false, nipQuery: ''});
    syncControls();
    renderAll();
  }

  function setUiState(value) {
    state.uiState = value === 'offline' ? 'normal' : value;
    els.offline.hidden = value !== 'offline';
    renderResults();
    if (value === 'offline') els.uiState.innerHTML = '<div class="state-message partial"><strong>オフライン：</strong> 端末キャッシュ済みデータだけで表示しています。外部通信はありません。</div>';
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

  function syncComparisonCheckboxes() {
    document.querySelectorAll('[data-compare-tool]').forEach(checkbox => {
      checkbox.checked = state.compare.includes(checkbox.dataset.compareTool);
    });
  }

  function dialogHead(kicker, title, description = '') {
    return `<div class="dialog-head"><div><div class="dialog-kicker">${esc(kicker)}</div><h2 id="evidence-title">${title}</h2>${description ? `<p>${esc(description)}</p>` : ''}</div><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div>`;
  }

  function openEvidenceDialog() {
    openDialog(els.evidenceDialog);
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

  function showFeatureDetail(toolId, featureId = '') {
    const tool = tools.find(item => item.id === toolId);
    if (!tool) return;
    const detailFeatures = featureId ? [featureById[featureId]].filter(Boolean) : selectedFeatures();
    const records = detailFeatures.length
      ? [...new Map(detailFeatures.flatMap(feature => supportRecords(tool, feature)).map(record => [record.nip, record])).values()]
      : tool.nips;
    const featureLabel = detailFeatures.length ? detailFeatures.map(feature => feature.name).join(' AND ') : '全NIP記録';
    const description = detailFeatures.length ? '選択した機能条件はすべてANDです。' : '機能条件がないため、この候補の全NIP記録を表示します。';
    els.evidenceContent.innerHTML = `${dialogHead('Feature basis', `${esc(tool.name)}の「${esc(featureLabel)}」`, description)}
      <section class="dialog-layer fact-layer" aria-labelledby="detail-fact-title"><h3 id="detail-fact-title">事実・観測</h3><nav class="resource-links" aria-label="${esc(tool.name)}の公式導線">${linkMarkup(tool)}</nav><div class="feature-basis-list">${records.map(record => `<button class="basis-row" type="button" data-evidence-tool="${tool.id}" data-evidence-nip="${record.nip}"><span><strong>NIP-${record.nip}</strong> ${esc(nipByNumber[record.nip].title)}</span>${supportBadge(record.status)}<small>根拠・観測詳細へ</small></button>`).join('')}</div></section>
      <section class="dialog-layer evaluation-layer" aria-labelledby="detail-evaluation-title"><h3 id="detail-evaluation-title">利用者評価</h3><p class="local-only">いいね・保存・レビュー・添付画像はローカル操作モックです。事実・観測の根拠には含めません。</p><div class="evaluation-actions"><button type="button" data-review-tool="${tool.id}">レビューを見る</button><button type="button" data-gallery-tool="${tool.id}">レビュー画像ギャラリー</button></div></section>`;
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

  function showSafeLink(toolId, type) {
    const tool = tools.find(item => item.id === toolId);
    const item = tool && mockLinks(tool).find(([linkType]) => linkType === type);
    if (!tool || !item) return;
    const [, label, url] = item;
    history.replaceState(null, '', `#link-${type}-${tool.id}`);
    els.evidenceContent.innerHTML = `${dialogHead('Safe link preview', `${esc(tool.name)} — ${esc(label)}`)}
      <p class="unknown-note"><strong>ページ内安全モック。</strong> 架空データのため外部へ移動しません。</p>
      <dl class="nip-evidence-grid"><div><dt>リンク種別</dt><dd>${esc(label)}</dd></div><div><dt>表示URL</dt><dd><code>${esc(url)}</code></dd></div><div><dt>最終確認日時</dt><dd>${esc(tool.observed)}</dd></div><div><dt>動作</dt><dd>外部遷移なし・未送信</dd></div></dl>`;
    openEvidenceDialog();
  }

  function closeDialog(dialog) {
    if (dialog?.open) dialog.close();
  }

  const dialogOpeners = new WeakMap();
  let dialogOpenerCandidate = null;

  document.addEventListener('click', event => {
    dialogOpenerCandidate = event.target.closest('button, a[href], input, select, textarea, [tabindex]');
    setTimeout(() => { dialogOpenerCandidate = null; }, 0);
  }, true);

  function focusableElements(dialog) {
    return [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length > 0);
  }

  function openDialog(dialog) {
    if (dialog.open) return;
    dialogOpeners.set(dialog, dialogOpenerCandidate || document.activeElement);
    dialog.showModal();
    requestAnimationFrame(() => focusableElements(dialog)[0]?.focus());
  }

  function showReviewDialog(toolId, focusReviewId = '') {
    const tool = tools.find(item => item.id === toolId);
    if (!tool) return;
    const reviews = allReviews(tool);
    const imageOptions = screenshots.map((shot, index) => `<label class="shot-choice"><input type="radio" name="mockImage" value="${esc(shot.id)}"><span>${screenshotMarkup(shot, true)}${esc(shot.label)}</span></label>`).join('');
    els.reviewContent.innerHTML = `${dialogHead('Evaluation layer', `${esc(tool.name)}のレビュー`, '評価・プロフィール・画像は架空の操作モックです。事実・観測とは分離しています。')}
      <div class="review-toolbar"><button type="button" class="secondary" data-gallery-tool="${tool.id}">添付画像だけ見る</button><span>${reviews.filter(item => item.image).length}枚</span></div>
      <section class="review-list" aria-labelledby="review-list-title"><h3 id="review-list-title">レビュー一覧</h3>${reviews.map(review => reviewMarkup(review, tool.id)).join('')}</section>
      <form class="review-form" data-review-form="${tool.id}"><h3>レビュー投稿モック</h3>
        <p class="form-automation-note">署名者と投稿日時は送信時に自動付与する想定のため、入力欄はありません。ここでは署名も送信も行いません。</p>
        <label class="review-body">本文（任意）<textarea name="body" placeholder="本文なしで画像だけでも作成できます"></textarea></label>
        <label>対象OS（任意）<input name="os" placeholder="例: iOS / Android / Linux"></label>
        <label>アプリversion（任意）<input name="version" placeholder="例: v2.4.1"></label>
        <label>任意評価<select name="rating"><option value="">未評価</option><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select></label>
        <label>用途（任意）<input name="use" placeholder="例: 日常利用"></label>
        <fieldset class="image-picker"><legend>画像添付（任意・外部アップロードなし）</legend><div class="shot-choices">${imageOptions}</div><label class="local-file">または端末内画像を安全にプレビュー<input type="file" name="localImage" accept="image/*"><small>ブラウザ内だけで読み込み、送信・保存しません。</small></label><div class="local-image-preview" aria-live="polite"></div><button class="text-button" type="button" data-clear-image>画像選択を解除</button></fieldset>
        <button class="primary" type="submit">未送信プレビューを作る</button><div class="review-preview" aria-live="polite">本文のみ・画像のみ・本文＋画像に対応。未署名・未送信です。</div>
      </form>`;
    openDialog(els.reviewDialog);
    if (focusReviewId) requestAnimationFrame(() => {
      const review = document.getElementById(`review-${focusReviewId}`);
      review?.scrollIntoView({block: 'center'});
      review?.querySelector('button')?.focus({preventScroll: true});
    });
  }

  function findReview(reviewId) {
    for (const tool of tools) {
      const review = allReviews(tool).find(item => item.id === reviewId);
      if (review) return {tool, review};
    }
    return null;
  }

  function reviewsByProfile(profileId) {
    return tools.flatMap(tool => allReviews(tool).filter(review => review.profile === profileId).map(review => ({tool, review})));
  }

  function showReviewerProfile(profileId) {
    const profile = reviewerProfiles[profileId];
    if (!profile) return;
    const historyItems = reviewsByProfile(profileId);
    const helpful = profile.useful + historyItems.reduce((sum, item) => sum + (state.reviewVotes[item.review.id] === 'helpful' ? 1 : 0), 0);
    const notUseful = profile.notUseful + historyItems.reduce((sum, item) => sum + (state.reviewVotes[item.review.id] === 'unhelpful' ? 1 : 0), 0);
    els.profileContent.innerHTML = `${dialogHead('Reviewer profile mock', profile.name, '単一の信頼スコアでは断定せず、判断材料を並べます。')}
      <section class="profile-summary"><p class="profile-npub">${esc(profile.npub)}</p><p>${esc(profile.bio)}</p><dl class="profile-facts"><div><dt>レビュー件数</dt><dd>${historyItems.length}</dd></div><div><dt>役に立った</dt><dd>${helpful}</dd></div><div><dt>立たなかった</dt><dd>${notUseful}</dd></div><div><dt>作成時期</dt><dd>${esc(profile.created)}</dd></div></dl></section>
      <section class="profile-signals" aria-labelledby="profile-signals-title"><h3 id="profile-signals-title">botかどうかを考える材料</h3><dl><div><dt>投稿履歴の広がり</dt><dd>${esc(profile.spread)}</dd></div><div><dt>投稿頻度・種類</dt><dd>${esc(profile.posts)}</dd></div><div><dt>注意</dt><dd>すべて架空データ。自動判定や本人確認はしていません。</dd></div></dl></section>
      <section class="profile-history" aria-labelledby="profile-history-title"><h3 id="profile-history-title">過去レビューと役立ち内訳</h3>${historyItems.length ? historyItems.slice(0, 12).map(({tool, review}) => { const counts = voteCounts(review); return `<article><div><strong>${esc(tool.name)}</strong><span>${esc(review.date)}</span></div><p>${esc(review.body || '画像レビュー')}</p><span>役に立った ${counts.helpful} / 立たなかった ${counts.unhelpful}</span><button type="button" class="text-button" data-review-jump="${esc(review.id)}" data-review-tool="${esc(tool.id)}">対応レビューへ</button></article>`; }).join('') : '<p>未送信プレビュー以外の履歴はありません。</p>'}</section>`;
    openDialog(els.profileDialog);
  }

  function showVoteBasis(reviewId) {
    const found = findReview(reviewId);
    if (!found) return;
    const counts = voteCounts(found.review);
    els.evidenceContent.innerHTML = `${dialogHead('Helpfulness basis mock', '役立ち評価の内訳', '評価者の実在確認や署名検証は行わない静的モックです。')}
      <section class="dialog-layer evaluation-layer"><h3>利用者評価</h3><dl class="nip-evidence-grid"><div><dt>役に立った</dt><dd>${counts.helpful}人</dd></div><div><dt>立たなかった</dt><dd>${counts.unhelpful}人</dd></div><div><dt>評価者の広がり</dt><dd>架空npub ${counts.helpful + counts.unhelpful}件 / 作成時期3区分 / 投稿履歴5カテゴリ</dd></div><div><dt>あなたの操作</dt><dd>${counts.vote ? `${counts.vote === 'helpful' ? '役に立った' : '立たなかった'}（未署名・未送信）` : '未評価'}</dd></div></dl><button type="button" class="secondary" data-reviewer="${esc(found.review.profile)}">投稿者プロフィールを見る</button></section>`;
    openEvidenceDialog();
  }

  function showGallery(toolId) {
    const tool = tools.find(item => item.id === toolId);
    if (!tool) return;
    const images = allReviews(tool).filter(review => review.image);
    els.galleryContent.innerHTML = `${dialogHead('Evaluation image layer', `${esc(tool.name)}のレビュー画像`, 'レビュー添付だけを走査します。機能対応や観測根拠の画像ではありません。')}
      <section class="gallery-grid" aria-label="レビュー添付画像一覧">${images.length ? images.map(review => `<article class="gallery-card">${screenshotMarkup(review.image)}<dl><div><dt>投稿者</dt><dd><button class="reviewer-link compact-link" type="button" data-reviewer="${esc(review.profile)}">${esc(review.author)}</button></dd></div><div><dt>投稿日時</dt><dd>${esc(review.date)}</dd></div><div><dt>OS / version</dt><dd>${esc(review.os || '未入力')} / ${esc(review.version || '未入力')}</dd></div></dl><div><button type="button" class="primary" data-open-image="${esc(tool.id)}" data-image-review="${esc(review.id)}">拡大</button><button type="button" class="secondary" data-review-tool="${esc(tool.id)}" data-review-jump="${esc(review.id)}">元レビュー</button></div></article>`).join('') : '<p class="unknown-note">添付画像はまだありません。レビュー投稿モックで追加できます。</p>'}</section>`;
    openDialog(els.galleryDialog);
  }

  function showImage(toolId, reviewId) {
    const tool = tools.find(item => item.id === toolId);
    const review = tool && allReviews(tool).find(item => item.id === reviewId);
    if (!tool || !review?.image) return;
    els.imageContent.innerHTML = `${dialogHead('Image preview', review.image.label, 'Escapeキーでも閉じられます。外部画像アップロードはありません。')}<div class="image-stage">${screenshotMarkup(review.image)}</div><dl class="nip-evidence-grid"><div><dt>投稿者</dt><dd><button type="button" class="reviewer-link compact-link" data-reviewer="${esc(review.profile)}">${esc(review.author)}</button></dd></div><div><dt>投稿日時</dt><dd>${esc(review.date)}</dd></div><div><dt>OS / version</dt><dd>${esc(review.os || '未入力')} / ${esc(review.version || '未入力')}</dd></div></dl><button type="button" class="primary" data-review-tool="${esc(tool.id)}" data-review-jump="${esc(review.id)}">元レビューへ</button>`;
    openDialog(els.imageDialog);
  }

  function comparisonItem(label, values, contents, iconMarkup = '') {
    const different = new Set(values).size > 1;
    return `<section class="comparison-item ${different ? 'is-different' : 'is-identical'}" data-comparison-item data-difference="${different}">
      <div class="comparison-label">${iconMarkup}${esc(label)}</div>
      <div class="comparison-values">${contents.map(content => `<div class="comparison-value">${content}</div>`).join('')}</div>
    </section>`;
  }

  function showCompare() {
    if (state.compare.length < 1) return;
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
    const alternatives = filteredTools().filter(tool => !state.compare.includes(tool.id));
    els.compareContent.innerHTML = `<div class="dialog-head"><div><div class="dialog-kicker">Differences first</div><h2 id="compare-title">${count}件の機能比較</h2><p>差がある項目を先に表示します。</p></div><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div>
      <div class="comparison-edit" aria-label="比較候補を編集">
        <label>代替候補<select id="compare-alternative">${alternatives.map(tool => `<option value="${tool.id}">${esc(tool.name)}</option>`).join('')}</select></label>
        ${count >= 3 ? `<label>入れ替える候補<select id="compare-replace-target">${selected.map(tool => `<option value="${tool.id}">${esc(tool.name)}</option>`).join('')}</select></label>` : ''}
        <button class="secondary" type="button" data-compare-apply ${alternatives.length ? '' : 'disabled'}>${count >= 3 ? '選んだ候補と入れ替え' : '比較に追加'}</button>
      </div>
      <div class="comparison-body" style="--candidate-count:${count}">
        <div class="comparison-candidates" aria-label="比較候補">${selected.map(tool => `<div class="comparison-candidate"><strong>${esc(tool.name)}</strong><button type="button" data-compare-remove="${tool.id}" aria-label="${esc(tool.name)}を比較から外す">外す</button></div>`).join('')}</div>
        ${count < 2 ? '<p class="comparison-incomplete">比較を続けるには代替候補を1件追加してください。</p>' : ''}
        <section class="comparison-group" aria-labelledby="feature-comparison-title"><h3 class="comparison-group-title" id="feature-comparison-title">機能</h3>${featureRows.map(row => row.markup).join('')}</section>
        <section class="comparison-group" aria-labelledby="attribute-comparison-title"><h3 class="comparison-group-title" id="attribute-comparison-title">基本情報</h3>${factRows.map(row => row.markup).join('')}</section>
      </div>`;
    openDialog(els.compareDialog);
  }

  function showFeatureBasis() {
    $('#nip-reference').scrollIntoView({behavior: 'smooth'});
  }

  els.query.addEventListener('input', event => {
    state.query = event.target.value;
    renderResults();
  });

  [['platform', els.platform], ['category', els.category], ['toolStatus', els.toolStatus], ['support', els.support], ['delivery', els.delivery], ['oss', els.oss]].forEach(([key, element]) => {
    element.addEventListener('change', event => updateFilter(key, event.target.value));
  });

  els.includeDead.addEventListener('change', event => updateFilter('includeDead', event.target.checked));
  els.savedOnly.addEventListener('change', event => updateFilter('savedOnly', event.target.checked));
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
      showFeatureDetail(matrix.dataset.matrixBasis, matrix.dataset.matrixFeature);
      return;
    }
    const source = event.target.closest('[data-mock-source]');
    if (source) {
      showSourceInfo(source.dataset.mockSource);
      return;
    }
    const safeLink = event.target.closest('[data-safe-link]');
    if (safeLink) {
      showSafeLink(safeLink.dataset.safeLink, safeLink.dataset.linkType);
      return;
    }
    const like = event.target.closest('[data-like-tool]');
    if (like) {
      state.likes[like.dataset.likeTool] = !state.likes[like.dataset.likeTool];
      renderResults();
      toast('ローカル表示だけ更新しました（未署名・未送信）');
      return;
    }
    const bookmark = event.target.closest('[data-bookmark-tool]');
    if (bookmark) {
      const id = bookmark.dataset.bookmarkTool;
      state.bookmarks[id] = state.bookmarks[id] ? null : {public: false};
      renderResults();
      toast(state.bookmarks[id] ? '非公開でブックマークしました（この表示中のみ）' : 'ブックマークを解除しました');
      return;
    }
    const reviewer = event.target.closest('[data-reviewer]');
    if (reviewer) {
      showReviewerProfile(reviewer.dataset.reviewer);
      return;
    }
    const vote = event.target.closest('[data-review-vote]');
    if (vote) {
      const current = state.reviewVotes[vote.dataset.reviewId];
      state.reviewVotes[vote.dataset.reviewId] = current === vote.dataset.reviewVote ? null : vote.dataset.reviewVote;
      showReviewDialog(vote.dataset.reviewToolId, vote.dataset.reviewId);
      toast('ローカル評価を反映しました（未署名・未送信）');
      return;
    }
    const basis = event.target.closest('[data-vote-basis]');
    if (basis) {
      showVoteBasis(basis.dataset.voteBasis);
      return;
    }
    const gallery = event.target.closest('[data-gallery-tool]');
    if (gallery) {
      showGallery(gallery.dataset.galleryTool);
      return;
    }
    const image = event.target.closest('[data-open-image]');
    if (image) {
      showImage(image.dataset.openImage, image.dataset.imageReview);
      return;
    }
    const clearImage = event.target.closest('[data-clear-image]');
    if (clearImage) {
      const form = clearImage.closest('form');
      form.querySelectorAll('input[name="mockImage"]').forEach(input => { input.checked = false; });
      form.querySelector('input[name="localImage"]').value = '';
      form.dataset.localImage = '';
      form.querySelector('.local-image-preview').innerHTML = '';
      return;
    }
    const review = event.target.closest('[data-review-tool]');
    if (review) {
      const childDialog = review.closest('dialog');
      if (review.dataset.reviewJump && els.reviewDialog.open && childDialog !== els.reviewDialog) closeDialog(childDialog);
      showReviewDialog(review.dataset.reviewTool, review.dataset.reviewJump || '');
      return;
    }
    const close = event.target.closest('[data-close-dialog]');
    if (close) {
      close.closest('dialog').close();
      return;
    }
    const removeConditionButton = event.target.closest('[data-remove-condition]');
    if (removeConditionButton) {
      removeCondition(removeConditionButton.dataset.removeCondition);
      return;
    }
    if (event.target.closest('[data-reset-all]')) {
      resetFilters();
      return;
    }
    const compareRemove = event.target.closest('[data-compare-remove]');
    if (compareRemove) {
      state.compare = state.compare.filter(id => id !== compareRemove.dataset.compareRemove);
      renderCompareActions();
      syncComparisonCheckboxes();
      if (state.compare.length) showCompare();
      else closeDialog(els.compareDialog);
      return;
    }
    if (event.target.closest('[data-compare-apply]')) {
      const alternative = $('#compare-alternative')?.value;
      if (!alternative) return;
      if (state.compare.length >= 3) {
        const target = $('#compare-replace-target')?.value;
        state.compare = state.compare.map(id => id === target ? alternative : id);
      } else {
        state.compare.push(alternative);
      }
      renderCompareActions();
      syncComparisonCheckboxes();
      showCompare();
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
    if (event.target.matches('[data-public-bookmark]')) {
      const id = event.target.dataset.publicBookmark;
      if (state.bookmarks[id]) state.bookmarks[id].public = event.target.checked;
      renderResults();
      toast(event.target.checked ? '公開状態のプレビューです（未署名・未送信）' : '非公開へ戻しました');
    }
  });

  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-review-form]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const body = String(data.get('body') || '').trim();
    const selectedShot = screenshots.find(shot => shot.id === data.get('mockImage'));
    const localImage = form.dataset.localImage ? {id: 'local', label: '端末内画像（ローカル）', color: '#38425b', dataUrl: form.dataset.localImage} : null;
    const image = localImage || selectedShot || null;
    if (!body && !image) {
      form.querySelector('.review-preview').innerHTML = '<strong>本文か画像を選んでください。</strong><p>本文のみ、画像のみ、本文＋画像のいずれでも作成できます。</p>';
      return;
    }
    const id = form.dataset.reviewForm;
    const preview = {id: `${id}-local-${Date.now()}`, profile: 'local', author: reviewerProfiles.local.name, npub: reviewerProfiles.local.npub, date: '自動付与予定・未送信', body, os: String(data.get('os') || '').trim() || '未入力', version: String(data.get('version') || '').trim() || '未入力', rating: data.get('rating') ? Number(data.get('rating')) : null, use: String(data.get('use') || '').trim() || '未入力', helpful: 0, unhelpful: 0, image};
    state.reviews[id] = [...(state.reviews[id] || []), preview];
    form.querySelector('.review-preview').innerHTML = `<strong>未送信プレビューを作成しました</strong>${body ? `<p>${esc(body)}</p>` : '<p>本文なし（画像のみ）</p>'}${image ? screenshotMarkup(image, true) : ''}<p>対象OS: ${esc(preview.os)} / アプリversion: ${esc(preview.version)} / 評価: ${preview.rating || '任意・未評価'} / 用途: ${esc(preview.use)}</p><p>署名者・日時は自動付与予定。現在は未署名・未送信で、リロードすると消えます。</p>`;
  });

  document.addEventListener('change', event => {
    const fileInput = event.target.closest('input[name="localImage"]');
    if (!fileInput) return;
    const form = fileInput.closest('form');
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      form.querySelector('.local-image-preview').textContent = '画像ファイルを選択してください。';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      form.dataset.localImage = String(reader.result);
      form.querySelectorAll('input[name="mockImage"]').forEach(input => { input.checked = false; });
      form.querySelector('.local-image-preview').innerHTML = `<img src="${reader.result}" alt="端末内画像のローカルプレビュー"><span>外部アップロードなし・未送信</span>`;
    };
    reader.readAsDataURL(file);
  });

  [els.evidenceDialog, els.compareDialog, els.reviewDialog, els.profileDialog, els.galleryDialog, els.imageDialog].forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const focusable = focusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    dialog.addEventListener('close', () => {
      const opener = dialogOpeners.get(dialog);
      if (opener?.isConnected && (!opener.closest('dialog') || opener.closest('dialog').open)) setTimeout(() => opener.focus(), 0);
    });
  });

  window.addEventListener('offline', () => setUiState('offline'));
  window.addEventListener('online', () => setUiState('normal'));
  els.filterDetails.open = false;
  const legacyFeature = location.hash.match(/^#feature-([a-z]+)$/)?.[1];
  const initialFeatures = location.hash.match(/^#features-([a-z-]+)$/)?.[1]?.split('-') || [];
  if (legacyFeature && featureById[legacyFeature]) state.features = [legacyFeature];
  else state.features = initialFeatures.filter(id => featureById[id]);
  renderAll();
})();
