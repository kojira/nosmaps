/* Concept D — feature-first static explorer. All tool/feature/OSS/evidence records are fictional mock data. */
(() => {
  'use strict';
  const {categories, tools, nipCatalog, nipStatusJa} = window.NOSMAPS_DATA;
  const nipByNumber = Object.fromEntries(nipCatalog.map(n => [n.number, n]));
  const features = [
    {id:'posts',name:'投稿・返信',scene:'タイムラインで読み書きし、返信したい',icon:'💬',nips:['01','09','25']},
    {id:'dm',name:'DM',scene:'暗号化した個別メッセージを送りたい',icon:'✉️',nips:['44']},
    {id:'search',name:'検索',scene:'投稿や人、識別子を探したい',icon:'🔎',nips:['01','19','21']},
    {id:'media',name:'画像・動画',scene:'画像や動画を見たり公開したい',icon:'🎞️',nips:['01','19']},
    {id:'notifications',name:'通知',scene:'返信・リアクション・zapに気づきたい',icon:'🔔',nips:['25','57']},
    {id:'accounts',name:'マルチアカウント',scene:'複数の鍵やプロフィールを切り替えたい',icon:'👥',nips:['19','46']},
    {id:'signing',name:'外部署名・リモート署名',scene:'秘密鍵をアプリから分離して署名したい',icon:'🔐',nips:['46']},
    {id:'wallet',name:'Wallet・Zap',scene:'zapを送る、受け取る、ウォレット接続したい',aliases:'zapを送りたい 支払いたい 投げ銭',icon:'⚡',nips:['47','57']},
    {id:'longform',name:'長文',scene:'記事や長いコンテンツを書きたい',icon:'📝',nips:['23']},
    {id:'community',name:'チャンネル・コミュニティ',scene:'グループで会話や運営をしたい',icon:'🏘️',nips:['01','42','78']}
  ];
  const featureById = Object.fromEntries(features.map(f => [f.id, f]));
  const state = {feature:'posts', query:'', platform:'all', category:'all', toolStatus:'all', support:'all', delivery:'all', oss:'all', includeDead:false, nipQuery:'', compare:[], uiState:'normal'};
  const $ = s => document.querySelector(s);
  const esc = v => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const els = {query:$('#feature-query'),chips:$('#feature-chips'),preview:$('#feature-preview'),category:$('#category-filter'),platform:$('#platform-filter'),toolStatus:$('#tool-status-filter'),support:$('#support-filter'),delivery:$('#delivery-filter'),oss:$('#oss-filter'),includeDead:$('#include-dead'),nipQuery:$('#nip-query'),results:$('#tool-results'),resultCount:$('#result-count'),selected:$('#selected-feature-summary'),condition:$('#condition-summary'),activeFilterCount:$('#active-filter-count'),uiState:$('#ui-state-view'),offline:$('#offline-banner'),compareDock:$('#compare-dock'),compareSummary:$('#compare-summary'),openCompare:$('#open-compare'),evidenceDialog:$('#evidence-dialog'),evidenceContent:$('#evidence-content'),compareDialog:$('#compare-dialog'),compareContent:$('#compare-content'),toast:$('#toast'),filterDetails:$('#filter-details'),nipList:$('#nip-list'),nipCount:$('#nip-count')};
  categories.forEach(([value,label]) => els.category.insertAdjacentHTML('beforeend', `<option value="${value}">${label}</option>`));

  function delivery(tool){ return tool.platform==='Web'?'Webアプリ':tool.platform==='Mobile'?'モバイルアプリ':'インストール型'; }
  function isOss(tool){ return tool.license!=='不明（モック）'; }
  function supportRecords(tool, feature=featureById[state.feature]){ return feature.nips.map(n => tool.nips.find(s=>s.nip===n)).filter(Boolean); }
  function featureSupport(tool, feature=featureById[state.feature]){
    const records=supportRecords(tool,feature); if(!records.length) return null;
    const statuses=records.map(r=>r.status);
    const rank={implemented:4,partial:3,planned:2,unknown:1};
    return statuses.sort((a,b)=>rank[b]-rank[a])[0];
  }
  function featureMatchesQuery(feature){ const q=state.query.trim().toLowerCase(); return !q || `${feature.name} ${feature.scene} ${feature.aliases||''} ${feature.nips.join(' ')}`.toLowerCase().includes(q); }
  function visibleFeatures(){ return features.filter(featureMatchesQuery); }
  function filteredTools(){
    const f=featureById[state.feature]; const q=state.nipQuery.trim().toLowerCase().replace(/^nip[- ]?/,'');
    return tools.filter(tool=>{
      const fs=featureSupport(tool,f); if(!fs) return false;
      const nipMatch=!q || supportRecords(tool,f).some(s=>`${s.nip} ${nipByNumber[s.nip].title} ${nipByNumber[s.nip].purpose}`.toLowerCase().includes(q));
      return (state.includeDead||tool.status!=='dead') && (state.platform==='all'||tool.platform===state.platform) && (state.category==='all'||tool.category===state.category) && (state.toolStatus==='all'||tool.status===state.toolStatus) && (state.support==='all'||fs===state.support) && (state.delivery==='all'||delivery(tool)===state.delivery) && (state.oss==='all'||(state.oss==='yes'?isOss(tool):!isOss(tool))) && nipMatch;
    });
  }
  function statusLabel(status){ return ({implemented:'対応',partial:'部分対応',planned:'予定',unknown:'不明'})[status]; }
  function supportBadge(status){ return `<span class="support-badge ${status}">${statusLabel(status)}</span>`; }
  function renderFeatures(){
    const list=visibleFeatures();
    els.chips.innerHTML=list.length?list.map(f=>`<button class="feature-chip" type="button" role="option" aria-selected="${f.id===state.feature}" data-select-feature="${f.id}"><span>${f.icon}</span><strong>${esc(f.name)}</strong><small>${esc(f.scene)}</small></button>`).join(''):'<div class="empty">一致する機能がありません。利用場面を短く変えてください。</div>';
  }
  function featureCard(tool){
    const f=featureById[state.feature], status=featureSupport(tool,f), checked=state.compare.includes(tool.id), dead=tool.status==='dead';
    const nips=supportRecords(tool,f);
    return `<article class="feature-tool-card ${dead?'dead-tool':''}" data-tool-id="${tool.id}">
      <div class="nip-card-top"><span class="tool-icon" aria-hidden="true">${tool.icon}</span><span class="status ${tool.status}">${tool.status}</span></div>
      <h3>${esc(tool.name)}</h3><p>${esc(tool.description)}</p>
      <div class="support-line">${supportBadge(status)}<span class="tag">${esc(tool.platform)}</span><span class="tag">${esc(delivery(tool))}</span></div>
      <dl class="tool-facts"><div><dt>カテゴリ</dt><dd>${esc(tool.categoryLabel)}</dd></div><div><dt>OSS</dt><dd>${isOss(tool)?`<button class="mock-source-link" type="button" data-mock-source="${tool.id}">${esc(tool.license)} · 架空ソース</button>`:'不明（材料不足）'}</dd></div><div><dt>最終観測</dt><dd>${esc(tool.observed.split(' ')[0])}</dd></div></dl>
      <div class="basis-nips" aria-label="この機能のNIP裏付け">${nips.map(s=>`<button type="button" class="nip-tag-button" data-evidence-tool="${tool.id}" data-evidence-nip="${s.nip}">NIP-${s.nip} · ${nipStatusJa[s.status]}</button>`).join('')}</div>
      ${dead?'<p class="replacement-note">終了／到達不能の架空記録。<button type="button" class="text-button" data-find-alternative>同じ機能の稼働候補へ戻る</button></p>':''}
      <div class="nip-card-actions"><label class="nip-compare-label"><input type="checkbox" data-compare-tool="${tool.id}" ${checked?'checked':''}> 比較に追加</label><button class="secondary" type="button" data-feature-detail="${tool.id}">機能の根拠詳細</button></div>
    </article>`;
  }
  function renderConditions(){
    const f=featureById[state.feature]; const active=[state.platform,state.category,state.toolStatus,state.support,state.delivery,state.oss].filter(v=>v!=='all').length+(state.includeDead?1:0)+(state.nipQuery?1:0);
    els.activeFilterCount.textContent=active;
    els.selected.innerHTML=`<strong>${f.icon} ${esc(f.name)}</strong> — ${esc(f.scene)} <button class="text-button" type="button" data-show-feature-basis>関連NIPを見る</button>`;
    const base=tools.filter(t=>t.status!=='dead'&&featureSupport(t,f)).length;
    els.preview.innerHTML=`<strong>${f.icon} ${esc(f.name)}</strong><span>初期候補 ${base}件（dead除外）</span><a href="#results">候補を見る</a>`;
    const parts=[f.name,state.platform==='all'?'全OS':state.platform,state.category==='all'?'全カテゴリ':categories.find(x=>x[0]===state.category)[1],state.includeDead?'dead含む':'dead除外'];
    els.condition.textContent=`選択条件: ${parts.join(' / ')}${active?` / 詳細${active}件`:''}`;
  }
  function renderNips(){
    const f=featureById[state.feature]; const list=f.nips.map(n=>nipByNumber[n]).filter(Boolean);
    els.nipCount.textContent=`${list.length} NIPs`;
    els.nipList.innerHTML=list.map(n=>`<article class="nip-reference-card" id="nip-${n.number}"><strong>NIP-${n.number}</strong><h3>${esc(n.title)}</h3><p>${esc(n.purpose)}</p><a href="${n.source}" target="_blank" rel="noreferrer">公式一次資料</a></article>`).join('');
  }
  function renderResults(){
    renderConditions(); renderNips();
    if(state.uiState!=='normal'&&state.uiState!=='partial'){ els.results.hidden=true; els.resultCount.textContent='状態モックを表示中'; els.uiState.innerHTML=stateMarkup(state.uiState); return; }
    els.results.hidden=false; els.uiState.innerHTML=state.uiState==='partial'?stateMarkup('partial'):'';
    const list=filteredTools(); els.resultCount.textContent=`${list.length}件の架空ツール`;
    els.results.innerHTML=list.length?list.map(featureCard).join(''):'<div class="empty">条件に合う架空ツールがありません。詳細条件を緩めるか、別の機能を選んでください。</div>';
    renderCompareDock();
  }
  function stateMarkup(type){
    if(type==='loading')return '<div class="state-message"><div class="nip-skeleton" aria-label="読み込み中"><span></span><span></span><span></span></div><strong>機能対応情報を読み込み中…（表示モック）</strong></div>';
    if(type==='empty')return '<div class="state-message"><div><strong>データが0件の状態</strong><p>選択した機能に候補がありません。別の条件を試してください。</p></div></div>';
    if(type==='error')return '<div class="state-message error"><div><strong>対応情報を取得できませんでした（表示モック）</strong><p>実通信はしていません。再試行導線の確認用です。</p><button class="secondary" type="button" data-ui-state="normal">再試行</button></div></div>';
    if(type==='partial')return '<div class="state-message partial"><strong>partial モック：</strong> 一部の観測詳細が欠けた想定です。「不明」を非対応と解釈しないでください。</div>';
    return '';
  }
  function renderCompareDock(){ state.compare=state.compare.filter(id=>tools.some(t=>t.id===id)); els.compareDock.hidden=!state.compare.length; els.compareSummary.textContent=`${state.compare.length}件を選択（最大3件）`; els.openCompare.disabled=state.compare.length<2; }
  function renderAll(){ renderFeatures(); renderResults(); }
  function selectFeature(id){ if(!featureById[id])return; state.feature=id; state.uiState='normal'; els.offline.hidden=true; renderAll(); history.replaceState(null,'',`#feature-${id}`); }
  function updateFilter(key,value){ state[key]=value; state.uiState='normal'; els.offline.hidden=true; renderResults(); }
  function resetFilters(){ Object.assign(state,{platform:'all',category:'all',toolStatus:'all',support:'all',delivery:'all',oss:'all',includeDead:false,nipQuery:''}); [els.platform,els.category,els.toolStatus,els.support,els.delivery,els.oss].forEach(e=>e.value='all'); els.includeDead.checked=false; els.nipQuery.value=''; renderResults(); }
  function setUiState(value){ state.uiState=value; els.offline.hidden=value!=='offline'; if(value==='offline')state.uiState='normal'; renderResults(); if(value==='offline')els.uiState.innerHTML='<div class="state-message partial"><strong>offline モック：</strong> 同梱済みの架空データだけで表示しています。外部通信はありません。</div>'; }
  function toast(message){ els.toast.textContent=message; els.toast.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>els.toast.classList.remove('show'),2200); }
  function toggleCompare(id,checked){ if(checked&&!state.compare.includes(id)){ if(state.compare.length>=3){toast('比較は最大3件です。'); const box=$(`[data-compare-tool="${id}"]`); if(box)box.checked=false; return;} state.compare.push(id); } else if(!checked)state.compare=state.compare.filter(x=>x!==id); renderCompareDock(); }
  function showEvidence(toolId,nipNumber){
    const tool=tools.find(t=>t.id===toolId),support=tool?.nips.find(s=>s.nip===nipNumber),nip=nipByNumber[nipNumber]; if(!tool||!support||!nip)return;
    els.evidenceContent.innerHTML=`<div class="dialog-head"><div><div class="eyebrow">FICTIONAL MOCK EVIDENCE</div><h2 id="evidence-title">${esc(tool.name)} × NIP-${nip.number}</h2></div><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div><p class="mock-note">⚠ 対応状況・根拠・観測はすべて架空です。</p><div class="support-line">${supportBadge(support.status)}<strong>${esc(nip.title)}</strong></div><dl class="nip-evidence-grid"><div><dt>モック根拠</dt><dd>${esc(support.evidence)}</dd></div><div><dt>モック観測日時</dt><dd>${esc(support.observed)}</dd></div><div><dt>モック観測主体</dt><dd>${esc(support.observer)}</dd></div><div><dt>NIPの用途</dt><dd>${esc(nip.purpose)}</dd></div></dl>${support.status==='unknown'?'<p class="unknown-note"><strong>不明 ≠ 非対応。</strong> 材料不足による保留です。</p>':''}<p><a class="secondary nav-link" href="${nip.source}" target="_blank" rel="noreferrer">公式NIP一次資料を開く</a></p>`;
    els.evidenceDialog.showModal();
  }
  function showFeatureDetail(toolId){
    const tool=tools.find(t=>t.id===toolId),f=featureById[state.feature]; if(!tool)return; const records=supportRecords(tool,f);
    els.evidenceContent.innerHTML=`<div class="dialog-head"><div><div class="eyebrow">FEATURE BASIS · FICTIONAL MOCK</div><h2 id="evidence-title">${esc(tool.name)}の「${esc(f.name)}」</h2></div><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div><p>${esc(f.scene)}</p><p class="mock-note">⚠ 機能対応の集約判定も、各NIP対応記録も架空です。</p><div class="feature-basis-list">${records.map(s=>`<button class="basis-row" type="button" data-evidence-tool="${tool.id}" data-evidence-nip="${s.nip}"><span><strong>NIP-${s.nip}</strong> ${esc(nipByNumber[s.nip].title)}</span>${supportBadge(s.status)}<small>根拠・観測詳細へ</small></button>`).join('')}</div>`;
    els.evidenceDialog.showModal();
  }
  function showMockSource(toolId){ const tool=tools.find(t=>t.id===toolId); if(!tool)return; history.replaceState(null,'',`#mock-source-${tool.id}`); els.evidenceContent.innerHTML=`<div class="dialog-head"><div><div class="eyebrow">FICTIONAL SOURCE URL</div><h2 id="evidence-title">${esc(tool.name)}の架空ソース</h2></div><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div><p class="mock-note">これはOSS導線のUI確認用です。実在リポジトリへは移動しません。</p><dl class="nip-evidence-grid"><div><dt>架空ライセンス表示</dt><dd>${esc(tool.license)}</dd></div><div><dt>安全なモック先</dt><dd><code>#mock-source-${esc(tool.id)}</code></dd></div></dl>`; els.evidenceDialog.showModal(); }
  function supportForFeature(tool,f){ return featureSupport(tool,f); }
  function showCompare(){
    if(state.compare.length<2)return; const selected=state.compare.map(id=>tools.find(t=>t.id===id));
    const featureRows=features.filter(f=>selected.some(t=>supportForFeature(t,f)));
    const factRows=[['OS',t=>t.platform],['カテゴリ',t=>t.categoryLabel],['更新状態',t=>t.status],['提供形態',t=>delivery(t)],['OSS',t=>isOss(t)?`${t.license}（架空）`:'不明'],['最終観測',t=>`${t.observed.split(' ')[0]}（架空）`]];
    els.compareContent.innerHTML=`<div class="dialog-head"><div><div class="eyebrow">FEATURE MATRIX · FICTIONAL MOCK</div><h2 id="compare-title">${selected.length}件の機能比較</h2><p>機能差を主役にし、NIPは各セルの裏付けから確認できます。</p></div><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div><div class="nip-matrix-wrap"><table class="nip-matrix feature-matrix"><thead><tr><th scope="col">比較項目</th>${selected.map(t=>`<th scope="col" class="matrix-tool-name">${esc(t.name)}</th>`).join('')}</tr></thead><tbody>${featureRows.map(f=>`<tr><th scope="row">${f.icon} ${esc(f.name)}</th>${selected.map(t=>{const s=supportForFeature(t,f);return `<td>${s?`${supportBadge(s)}<button class="matrix-evidence" type="button" data-matrix-basis="${t.id}" data-matrix-feature="${f.id}">NIP裏付け</button>`:'—'}</td>`}).join('')}</tr>`).join('')}<tr class="matrix-divider"><th colspan="${selected.length+1}">基本情報</th></tr>${factRows.map(([label,get])=>`<tr><th scope="row">${label}</th>${selected.map(t=>`<td>${esc(get(t))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    els.compareDialog.showModal();
  }
  function showFeatureBasis(){ $('#nip-reference').scrollIntoView({behavior:'smooth'}); }

  els.query.addEventListener('input',e=>{state.query=e.target.value;renderFeatures();});
  [['platform',els.platform],['category',els.category],['toolStatus',els.toolStatus],['support',els.support],['delivery',els.delivery],['oss',els.oss]].forEach(([key,el])=>el.addEventListener('change',e=>updateFilter(key,e.target.value)));
  els.includeDead.addEventListener('change',e=>updateFilter('includeDead',e.target.checked)); els.nipQuery.addEventListener('input',e=>updateFilter('nipQuery',e.target.value));
  $('#clear-filters').addEventListener('click',resetFilters); els.openCompare.addEventListener('click',showCompare); $('#open-state-lab').addEventListener('click',()=>$('#state-lab').scrollIntoView({behavior:'smooth'}));
  document.addEventListener('click',e=>{ const feature=e.target.closest('[data-select-feature]'); if(feature){selectFeature(feature.dataset.selectFeature);return;} const evidence=e.target.closest('[data-evidence-tool]'); if(evidence){showEvidence(evidence.dataset.evidenceTool,evidence.dataset.evidenceNip);return;} const detail=e.target.closest('[data-feature-detail]'); if(detail){showFeatureDetail(detail.dataset.featureDetail);return;} const matrix=e.target.closest('[data-matrix-basis]'); if(matrix){els.compareDialog.close(); state.feature=matrix.dataset.matrixFeature; showFeatureDetail(matrix.dataset.matrixBasis);return;} const source=e.target.closest('[data-mock-source]'); if(source){showMockSource(source.dataset.mockSource);return;} const close=e.target.closest('[data-close-dialog]'); if(close){close.closest('dialog').close();return;} const ui=e.target.closest('[data-ui-state]'); if(ui){setUiState(ui.dataset.uiState);return;} if(e.target.closest('[data-find-alternative]')){state.includeDead=false;els.includeDead.checked=false;renderResults();return;} if(e.target.closest('[data-show-feature-basis]')){showFeatureBasis();return;} });
  document.addEventListener('change',e=>{if(e.target.matches('[data-compare-tool]'))toggleCompare(e.target.dataset.compareTool,e.target.checked)});
  [els.evidenceDialog,els.compareDialog].forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()}));
  window.addEventListener('offline',()=>setUiState('offline')); window.addEventListener('online',()=>setUiState('normal')); els.filterDetails.open=matchMedia('(min-width:581px)').matches;
  const initial=location.hash.match(/^#feature-([a-z]+)$/)?.[1]; if(initial&&featureById[initial])state.feature=initial; renderAll();
})();
