/* Concept D — pure static NIP explorer. Tool support/evidence/observations are fictional mock data. */
(() => {
  'use strict';
  const {categories, tools, nipCatalog, nipStatusJa} = window.NOSMAPS_DATA;
  const nipByNumber = Object.fromEntries(nipCatalog.map(n => [n.number, n]));
  const state = {nip:'57', query:'', platform:'all', category:'all', toolStatus:'all', support:'all', compare:[], uiState:'normal'};
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const els = {
    query:$('#nip-query'), nipList:$('#nip-list'), nipCount:$('#nip-count'), category:$('#category-filter'), platform:$('#platform-filter'),
    toolStatus:$('#tool-status-filter'), support:$('#support-filter'), results:$('#tool-results'), resultCount:$('#result-count'), selected:$('#selected-nip-summary'),
    condition:$('#condition-summary'), activeFilterCount:$('#active-filter-count'), uiState:$('#ui-state-view'), offline:$('#offline-banner'), compareDock:$('#compare-dock'),
    compareSummary:$('#compare-summary'), openCompare:$('#open-compare'), evidenceDialog:$('#evidence-dialog'), evidenceContent:$('#evidence-content'),
    compareDialog:$('#compare-dialog'), compareContent:$('#compare-content'), toast:$('#toast'), filterDetails:$('#filter-details'), preview:$('#result-preview')
  };

  categories.forEach(([value,label]) => els.category.insertAdjacentHTML('beforeend', `<option value="${value}">${label}</option>`));

  function supportFor(tool, nip = state.nip){ return tool.nips.find(item => item.nip === nip); }
  function searchedNips(){
    const q=state.query.trim().toLowerCase().replace(/^nip[- ]?/,'');
    return nipCatalog.filter(n => !q || `${n.number} ${n.title} ${n.purpose}`.toLowerCase().includes(q));
  }
  function filteredTools(){
    return tools.filter(tool => {
      const support=supportFor(tool);
      return support && (state.platform==='all'||tool.platform===state.platform) && (state.category==='all'||tool.category===state.category) &&
        (state.toolStatus==='all'||tool.status===state.toolStatus) && (state.support==='all'||support.status===state.support);
    });
  }
  function renderNips(){
    const matches=searchedNips();
    els.nipCount.textContent=`${matches.length} / ${nipCatalog.length} NIPs`;
    els.nipList.innerHTML=matches.length ? matches.map(n=>`<button class="nip-choice" type="button" role="option" aria-selected="${n.number===state.nip}" data-select-nip="${n.number}"><strong>NIP-${n.number}</strong><span>${esc(n.title)}</span><small>${esc(n.purpose)}</small></button>`).join('') : '<div class="empty">一致するNIPがありません。番号・英語名称・日本語用途を変えてください。</div>';
  }
  function supportBadge(s){ return `<span class="support-badge ${s.status}">${nipStatusJa[s.status]}</span>`; }
  function toolCard(tool){
    const support=supportFor(tool); const checked=state.compare.includes(tool.id);
    return `<article class="nip-tool-card" data-tool-id="${tool.id}">
      <div class="nip-card-top"><span class="tool-icon" aria-hidden="true">${tool.icon}</span><span class="status ${tool.status}">${tool.status}</span></div>
      <h3>${esc(tool.name)}</h3><p>${esc(tool.description)}</p>
      <div class="support-line"><strong>NIP-${state.nip}</strong>${supportBadge(support)}<span class="tag">${esc(tool.platform)}</span></div>
      <div class="nip-tags" aria-label="使用NIP一覧">${tool.nips.map(s=>`<button type="button" class="nip-tag-button" data-select-nip="${s.nip}" title="${esc(nipByNumber[s.nip].title)}">NIP-${s.nip} · ${nipStatusJa[s.status]}</button>`).join('')}</div>
      <div class="nip-card-actions"><label class="nip-compare-label"><input type="checkbox" data-compare-tool="${tool.id}" ${checked?'checked':''}> 比較に追加</label><button class="secondary" type="button" data-evidence-tool="${tool.id}" data-evidence-nip="${state.nip}">根拠・観測詳細</button></div>
    </article>`;
  }
  function renderConditions(){
    const active=[state.platform,state.category,state.toolStatus,state.support].filter(v=>v!=='all').length;
    els.activeFilterCount.textContent=active;
    const nip=nipByNumber[state.nip];
    els.selected.innerHTML=`選択中: <strong>NIP-${nip.number} ${esc(nip.title)}</strong> — ${esc(nip.purpose)}`;
    const previewCount=tools.filter(tool=>supportFor(tool)).length;
    els.preview.innerHTML=`<span><strong>NIP-${nip.number}</strong> の架空対応ツール ${previewCount}件</span><a href="#results">逆引き結果を見る</a>`;
    const parts=[`NIP-${state.nip}`, state.platform==='all'?'全OS':state.platform, state.category==='all'?'全カテゴリ':categories.find(x=>x[0]===state.category)[1], state.toolStatus==='all'?'全状態':state.toolStatus, state.support==='all'?'全対応状況':nipStatusJa[state.support]];
    els.condition.textContent=`選択条件: ${parts.join(' / ')}`;
  }
  function renderResults(){
    renderConditions();
    if(state.uiState!=='normal' && state.uiState!=='partial'){
      els.results.hidden=true; els.resultCount.textContent='状態モックを表示中'; els.uiState.innerHTML=stateMarkup(state.uiState); return;
    }
    els.results.hidden=false;
    els.uiState.innerHTML=state.uiState==='partial' ? stateMarkup('partial') : '';
    const list=filteredTools();
    els.resultCount.textContent=`${list.length}件の架空ツール`;
    els.results.innerHTML=list.length ? list.map(toolCard).join('') : '<div class="empty">条件に合う架空ツールがありません。詳細フィルターを緩めるか、別のNIPを選択してください。</div>';
    renderCompareDock();
  }
  function stateMarkup(type){
    if(type==='loading') return '<div class="state-message"><div class="nip-skeleton" aria-label="読み込み中"><span></span><span></span><span></span></div><strong>対応情報を読み込み中…（表示モック）</strong></div>';
    if(type==='empty') return '<div class="state-message"><div><strong>データが0件の状態</strong><p>選択したNIPに対応情報がありません。別の条件を試してください。</p></div></div>';
    if(type==='error') return '<div class="state-message error"><div><strong>対応情報を取得できませんでした（表示モック）</strong><p>この静的サイトは実際の通信をしていません。再試行導線の確認用です。</p><button class="secondary" type="button" data-ui-state="normal">再試行</button></div></div>';
    if(type==='partial') return '<div class="state-message partial"><strong>partial モック：</strong> 一部の観測詳細が欠けた想定です。確認できた架空データだけを表示しています。「不明」を非対応と解釈しないでください。</div>';
    return '';
  }
  function renderCompareDock(){
    state.compare=state.compare.filter(id=>tools.some(t=>t.id===id));
    els.compareDock.hidden=state.compare.length===0;
    els.compareSummary.textContent=`${state.compare.length}件を選択（2〜3件）`;
    els.openCompare.disabled=state.compare.length<2;
  }
  function renderAll(){ renderNips(); renderResults(); }
  function selectNip(number){
    const changed=number!==state.nip; state.nip=number; state.uiState='normal'; els.offline.hidden=true; renderAll();
    if(changed) history.replaceState(null,'',`#nip-${number}`);
  }
  function updateFilter(key,value){ state[key]=value; state.uiState='normal'; els.offline.hidden=true; renderResults(); }
  function setUiState(value){ state.uiState=value; els.offline.hidden=value!=='offline'; if(value==='offline') state.uiState='normal'; renderResults(); if(value==='offline') els.uiState.innerHTML='<div class="state-message partial"><strong>offline モック：</strong> 同梱済みの架空データだけで表示しています。外部通信はありません。</div>'; }
  function toast(message){ els.toast.textContent=message; els.toast.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>els.toast.classList.remove('show'),2200); }
  function toggleCompare(id,checked){
    if(checked && !state.compare.includes(id)){
      if(state.compare.length>=3){ toast('比較は最大3件です。'); const box=document.querySelector(`[data-compare-tool="${id}"]`); if(box) box.checked=false; return; }
      state.compare.push(id);
    } else if(!checked) state.compare=state.compare.filter(x=>x!==id);
    renderCompareDock();
  }
  function showEvidence(toolId,nipNumber){
    const tool=tools.find(t=>t.id===toolId), support=tool?.nips.find(s=>s.nip===nipNumber), nip=nipByNumber[nipNumber]; if(!tool||!support)return;
    els.evidenceContent.innerHTML=`<div class="dialog-head"><div><div class="eyebrow">FICTIONAL MOCK EVIDENCE</div><h2 id="evidence-title">${esc(tool.name)} × NIP-${nip.number}</h2></div><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div>
      <p class="mock-note">⚠ 以下の対応状況・根拠・観測はすべて架空です。実在ツールの評価ではありません。</p>
      <div class="support-line">${supportBadge(support)}<strong>${esc(nip.title)}</strong></div>
      <dl class="nip-evidence-grid"><div><dt>モック根拠</dt><dd>${esc(support.evidence)}</dd></div><div><dt>モック観測日時</dt><dd>${esc(support.observed)}</dd></div><div><dt>モック観測主体</dt><dd>${esc(support.observer)}</dd></div><div><dt>用途（公式見出しからの短い説明）</dt><dd>${esc(nip.purpose)}</dd></div></dl>
      ${support.status==='unknown'?'<p class="unknown-note"><strong>不明 ≠ 非対応。</strong> 確認材料不足による保留で、否定評価ではありません。</p>':''}
      <p><a class="secondary nav-link" href="${nip.source}" target="_blank" rel="noreferrer">公式NIP一次資料を開く</a></p>`;
    els.evidenceDialog.showModal();
  }
  function showCompare(){
    if(state.compare.length<2)return;
    const selected=state.compare.map(id=>tools.find(t=>t.id===id));
    const nipNumbers=[...new Set(selected.flatMap(t=>t.nips.map(s=>s.nip)))].sort();
    els.compareContent.innerHTML=`<div class="dialog-head"><div><div class="eyebrow">NIP MATRIX · FICTIONAL MOCK</div><h2 id="compare-title">${selected.length}件のNIP対応比較</h2><p>対応状況・根拠はすべて架空。セルの「詳細」で観測情報を確認できます。</p></div><button class="icon-btn" type="button" data-close-dialog aria-label="閉じる">×</button></div>
      <div class="nip-matrix-wrap"><table class="nip-matrix"><thead><tr><th scope="col">NIP</th>${selected.map(t=>`<th scope="col" class="matrix-tool-name">${esc(t.name)}<br><small>${esc(t.platform)} / ${esc(t.categoryLabel)}</small></th>`).join('')}</tr></thead><tbody>${nipNumbers.map(num=>`<tr><th scope="row">NIP-${num}<br><small>${esc(nipByNumber[num].title)}</small></th>${selected.map(t=>{const s=t.nips.find(x=>x.nip===num); return `<td>${s?`${supportBadge(s)}<button class="matrix-evidence" type="button" data-evidence-tool="${t.id}" data-evidence-nip="${num}">根拠・観測詳細</button>`:'<span aria-label="対応情報なし">—</span>'}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`;
    els.compareDialog.showModal();
  }
  function resetFilters(){
    state.platform=state.category=state.toolStatus=state.support='all';
    els.platform.value=els.category.value=els.toolStatus.value=els.support.value='all'; renderResults();
  }

  els.query.addEventListener('input',e=>{state.query=e.target.value;renderNips()});
  els.platform.addEventListener('change',e=>updateFilter('platform',e.target.value)); els.category.addEventListener('change',e=>updateFilter('category',e.target.value));
  els.toolStatus.addEventListener('change',e=>updateFilter('toolStatus',e.target.value)); els.support.addEventListener('change',e=>updateFilter('support',e.target.value));
  $('#clear-filters').addEventListener('click',resetFilters); els.openCompare.addEventListener('click',showCompare);
  $('#open-state-lab').addEventListener('click',()=>$('#state-lab').scrollIntoView({behavior:'smooth'}));
  document.addEventListener('click',e=>{
    const nip=e.target.closest('[data-select-nip]'); if(nip){selectNip(nip.dataset.selectNip);return;}
    const evidence=e.target.closest('[data-evidence-tool]'); if(evidence){showEvidence(evidence.dataset.evidenceTool,evidence.dataset.evidenceNip);return;}
    const close=e.target.closest('[data-close-dialog]'); if(close){close.closest('dialog').close();return;}
    const ui=e.target.closest('[data-ui-state]'); if(ui){setUiState(ui.dataset.uiState);return;}
  });
  document.addEventListener('change',e=>{if(e.target.matches('[data-compare-tool]'))toggleCompare(e.target.dataset.compareTool,e.target.checked)});
  [els.evidenceDialog,els.compareDialog].forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()}));
  window.addEventListener('offline',()=>setUiState('offline')); window.addEventListener('online',()=>setUiState('normal'));
  els.filterDetails.open=matchMedia('(min-width:581px)').matches;
  const initialNip=location.hash.match(/^#nip-(\d{2})$/)?.[1]; if(initialNip && nipByNumber[initialNip]) state.nip=initialNip;
  renderAll();
})();
