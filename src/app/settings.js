/* ══════════════════════════════════════════
   settings.js — 설정 모달 UI 동기화, 컬럼 편집기, 애니메이션
══════════════════════════════════════════ */

import { DEFAULT_LIST_COLS } from './constants.js';
import { S, save, notify, today } from './state.js';
import { applyVars, applyBlurSetting, updateDesignContent, renderThemeGrid, renderPrioStyleRows, renderPreviewCards } from './theme.js';
import { renderAll, renderList, renderMatrix } from './render.js';
import { dlBlob } from './io.js';
import { DEMO } from './constants.js';
import { isAdmin, updateAdminUI } from './admin.js';

/* ── 설정 탭 전환 ── */
export function sstab(btn, paneId) {
  document.querySelectorAll('.stab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.spane').forEach(p => p.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById(paneId)?.classList.add('on');
  if (paneId === 'sd')   updateDesignContent();
  if (paneId === 'sth')  renderThemeGrid();
  if (paneId === 'scol') renderColEditor();
  if (paneId === 'saxis') renderAxisEditor();
  if (paneId === 'sanim') syncAnimUI();
  if (paneId === 'scs')  { renderPrioStyleRows(); renderPreviewCards(); }
  if (paneId === 'ssrv')   window.syncServerSettingsUI?.();
  if (paneId === 'sadmin') window.loadInlineActivityLog?.();
}

/* ── 설정 UI 전체 동기화 ── */
export function syncSettingsUI() {
  const ss = S.settings;
  const admin = isAdmin();
  const titleEl = document.getElementById('sTitle');
  const subEl   = document.getElementById('sSub');
  if (titleEl) { titleEl.value = ss.title; titleEl.disabled = !admin; }
  if (subEl)   { subEl.value   = ss.subtitle; subEl.disabled = !admin; }
  // 헤더 DOM도 즉시 반영
  const dTitleEl = document.getElementById('dTitle');
  const dSubEl   = document.getElementById('dSub');
  if (dTitleEl) dTitleEl.textContent = ss.title || 'featureMATRIX';
  if (dSubEl)   dSubEl.textContent   = ss.subtitle || '기능정의 툴';
  document.title = ss.title || 'featureMATRIX';
  document.getElementById('dBaseFont').textContent  = ss.baseFont  + 'px';
  document.getElementById('dCardFont').textContent  = ss.cardFont  + 'px';
  document.getElementById('dRadius').textContent    = ss.cardRadius + 'px';
  document.getElementById('dGap').textContent       = ss.cardGap   + 'px';
  document.getElementById('dColW').textContent      = ss.colW      + 'px';
  document.getElementById('dCatW').textContent      = ss.catW      + 'px';
  document.getElementById('dSubCatW').textContent   = ss.subCatW   + 'px';
  document.getElementById('dCellFold').textContent  = ss.cellFold  === 0 ? '∞' : ss.cellFold;
  document.getElementById('mwF').className = 'rbtn' + (ss.matrixWidth === 'fluid' ? ' on' : '');
  document.getElementById('mwX').className = 'rbtn' + (ss.matrixWidth === 'fixed'  ? ' on' : '');
  document.getElementById('ppL').className = 'rbtn' + (ss.panelPos   === 'left'  ? ' on' : '');
  document.getElementById('ppR').className = 'rbtn' + (ss.panelPos   === 'right' ? ' on' : '');
  document.getElementById('layout').classList.toggle('pr', ss.panelPos === 'right');
  document.getElementById('fpanel').classList.toggle('collapsed', !ss.panelVisible);
  const di = S.display;
  document.getElementById('togOwner').checked  = di.showOwner;
  document.getElementById('togStar').checked   = di.showStar;
  document.getElementById('togNew').checked    = di.showNewBadge;
  document.getElementById('togCnt').checked    = di.showCellCount;
  document.getElementById('togUpd').checked    = !!di.showUpdated;
  document.getElementById('togStatus').checked = di.showStatus !== false;
  document.getElementById('togMd').checked     = di.showMdBadge !== false;
  document.getElementById('togDel').checked    = S.filters.showDeleted;
  document.getElementById('togImp').checked    = S.filters.importantOnly;
  syncAnimUI();
  updateAdminUI();
}

/* ── 타이틀 미리보기 ── */
export function previewTitle() {
  S.settings.title    = document.getElementById('sTitle').value;
  S.settings.subtitle = document.getElementById('sSub').value;
  document.getElementById('dTitle').textContent = S.settings.title;
  document.getElementById('dSub').textContent   = S.settings.subtitle;
  document.title = S.settings.title;
  save();
}

/* ── 레이아웃 ── */
export function setMW(v)   { S.settings.matrixWidth=v; document.getElementById('mwF').className='rbtn'+(v==='fluid'?' on':''); document.getElementById('mwX').className='rbtn'+(v==='fixed'?' on':''); save(); if(S.view==='matrix')renderMatrix(); }
export function setPPos(v) { S.settings.panelPos=v; document.getElementById('layout').classList.toggle('pr',v==='right'); document.getElementById('ppL').className='rbtn'+(v==='left'?' on':''); document.getElementById('ppR').className='rbtn'+(v==='right'?' on':''); save(); }

/* ── Stepper 설정값 조절 ── */
export function adjFont(d)     { S.settings.baseFont    = Math.max(12,Math.min(22,S.settings.baseFont+d));    document.getElementById('dBaseFont').textContent =S.settings.baseFont+'px';    save(); applyVars(); }
export function adjCardFont(d) { S.settings.cardFont    = Math.max(9, Math.min(18,S.settings.cardFont+d));    document.getElementById('dCardFont').textContent =S.settings.cardFont+'px';    save(); applyVars(); if(S.view==='matrix')renderMatrix(); }
export function adjRadius(d)   { S.settings.cardRadius  = Math.max(0, Math.min(14,S.settings.cardRadius+d));  document.getElementById('dRadius').textContent   =S.settings.cardRadius+'px';  save(); applyVars(); if(S.view==='matrix')renderMatrix(); }
export function adjGap(d)      { S.settings.cardGap     = Math.max(0, Math.min(20,S.settings.cardGap+d));     document.getElementById('dGap').textContent      =S.settings.cardGap+'px';     save(); applyVars(); if(S.view==='matrix')renderMatrix(); }
export function adjColW(d)     { S.settings.colW        = Math.max(80,Math.min(300,S.settings.colW+d));       document.getElementById('dColW').textContent     =S.settings.colW+'px';       save(); applyVars(); if(S.view==='matrix')renderMatrix(); }
export function adjCatW(d)     { S.settings.catW        = Math.max(16,Math.min(80,S.settings.catW+d));        document.getElementById('dCatW').textContent     =S.settings.catW+'px';        save(); applyVars(); if(S.view==='matrix')renderMatrix(); }
export function adjSubCatW(d)  { S.settings.subCatW     = Math.max(40,Math.min(200,S.settings.subCatW+d));    document.getElementById('dSubCatW').textContent  =S.settings.subCatW+'px';     save(); applyVars(); if(S.view==='matrix')renderMatrix(); }
export function adjCellFold(d) { S.settings.cellFold    = Math.max(0, Math.min(20,S.settings.cellFold+d));    document.getElementById('dCellFold').textContent =S.settings.cellFold===0?'∞':S.settings.cellFold; save(); S.expandedCells=new Set(); if(S.view==='matrix')renderMatrix(); }

/* ── 애니메이션 ── */
export function onAnimTgl() {
  const a = S.settings.animations;
  a.enabled  = document.getElementById('animEnabled').checked;
  a.countUp  = document.getElementById('animCountUp').checked;
  a.card     = document.getElementById('animCard').checked;
  a.filter   = document.getElementById('animFilter').checked;
  a.shimmer  = document.getElementById('animShimmer').checked;
  a.blur     = document.getElementById('animBlur').checked;
  save(); applyBlurSetting(); renderAll();
}

export function syncAnimUI() {
  const a = S.settings.animations;
  document.getElementById('animEnabled').checked = a.enabled;
  document.getElementById('animCountUp').checked = a.countUp;
  document.getElementById('animCard').checked    = a.card;
  document.getElementById('animFilter').checked  = a.filter;
  document.getElementById('animShimmer').checked = a.shimmer;
  document.getElementById('animBlur').checked    = a.blur;
}

/* ── 리스트 컬럼 편집기 ── */
let _colDragIdx = null;

export function renderColEditor() {
  const el = document.getElementById('colEditor');
  if (!el) return;
  const FLABELS_LOCAL = {key:'Key',name:'기능명',desc:'설명',path:'경로',group:'그룹',subGroup:'서브그룹',category:'카테고리',subCategory:'서브카테고리',priority:'우선순위',status:'진행상태',owner:'담당',isDelete:'삭제여부',isImportant:'중요여부',relSystem:'연관시스템',memo:'메모',mdPath:'MD경로',mdContent:'MD내용'};
  el.innerHTML = S.settings.listColumns.map((col, i) => `
    <div class="col-row" draggable="true" data-idx="${i}"
      ondragstart="colDragStart(event,${i})" ondragover="colDragOver(event,${i})"
      ondragleave="colDragLeave(event)" ondrop="colDrop(event,${i})" ondragend="colDragEnd()">
      <span class="col-handle" title="드래그하여 순서 변경">⠿</span>
      <label class="tgl" style="gap:6px">
        <input type="checkbox" ${col.visible?'checked':''} onchange="toggleColVisible(${i},this.checked)">
        <span class="tgl-track"></span>
      </label>
      <span class="col-name">${FLABELS_LOCAL[col.key]||col.key}</span>
    </div>`
  ).join('');
}

export function toggleColVisible(idx, checked) { S.settings.listColumns[idx].visible = checked; save(); if (S.view==='list') renderList(); }
export function colDragStart(e, idx)  { _colDragIdx=idx; e.currentTarget.classList.add('dragging-col'); e.dataTransfer.effectAllowed='move'; }
export function colDragOver(e, idx)   { e.preventDefault(); if(idx===_colDragIdx)return; document.querySelectorAll('.col-row').forEach(r=>r.classList.remove('drag-over-col')); e.currentTarget.classList.add('drag-over-col'); }
export function colDragLeave(e)       { e.currentTarget.classList.remove('drag-over-col'); }
export function colDrop(e, toIdx)     { e.preventDefault(); if(_colDragIdx===null||_colDragIdx===toIdx)return; const cols=[...S.settings.listColumns]; const[moved]=cols.splice(_colDragIdx,1); cols.splice(toIdx,0,moved); S.settings.listColumns=cols; save(); renderColEditor(); if(S.view==='list')renderList(); }
export function colDragEnd()          { _colDragIdx=null; document.querySelectorAll('.col-row').forEach(r=>r.classList.remove('dragging-col','drag-over-col')); }
export function resetListCols()       { S.settings.listColumns=JSON.parse(JSON.stringify(DEFAULT_LIST_COLS)); save(); renderColEditor(); if(S.view==='list')renderList(); notify('리스트 컬럼을 기본값으로 복원했습니다.'); }

/* ── 그룹/카테고리 순서 관리 ── */
let _axisDragIdx = null, _axisField = null;

export function renderAxisEditor() {
  renderSingleAxis('groupOrder', 'group',    'groupAxisList', '그룹 (X축)');
  renderSingleAxis('catOrder',   'category', 'catAxisList',   '카테고리 (Y축)');
}

function renderSingleAxis(orderKey, field, listId, label) {
  const el = document.getElementById(listId);
  if (!el) return;
  // 현재 데이터에서 실제 값 목록
  const inData = Array.from(new Set(S.items.map(it => it[field]||'(미분류)'))).sort((a,b)=>a.localeCompare(b,'ko'));
  const order  = S.settings[orderKey] || [];
  // 순서 적용: order 먼저, 나머지 append
  const merged = [...order.filter(v => inData.includes(v)), ...inData.filter(v => !order.includes(v))];
  el.innerHTML = merged.map((val, i) => `
    <div class="col-row" draggable="true" data-val="${val}" data-field="${field}"
      ondragstart="axisDragStart(event,'${field}',${i})" ondragover="axisDragOver(event,${i})"
      ondragleave="axisDragLeave(event)" ondrop="axisDrop(event,'${field}',${i})" ondragend="axisDragEnd()">
      <span class="col-handle" title="드래그하여 순서 변경">⠿</span>
      <span style="font-size:.82rem;color:var(--text)">${esc(val)}</span>
    </div>`).join('');
  // 순서 저장
  S.settings[orderKey] = merged;
}

export function axisDragStart(e, field, idx) { _axisDragIdx=idx; _axisField=field; e.currentTarget.classList.add('dragging-col'); e.dataTransfer.effectAllowed='move'; }
export function axisDragOver(e, idx)  { e.preventDefault(); document.querySelectorAll('.col-row').forEach(r=>r.classList.remove('drag-over-col')); e.currentTarget.classList.add('drag-over-col'); }
export function axisDragLeave(e)      { e.currentTarget.classList.remove('drag-over-col'); }
export function axisDrop(e, field, toIdx) {
  e.preventDefault();
  if (_axisDragIdx === null || _axisDragIdx === toIdx) return;
  const orderKey = field === 'group' ? 'groupOrder' : 'catOrder';
  const listId   = field === 'group' ? 'groupAxisList' : 'catAxisList';
  const list = Array.from(document.querySelectorAll(`#${listId} .col-row`)).map(r=>r.dataset.val);
  const [moved] = list.splice(_axisDragIdx, 1);
  list.splice(toIdx, 0, moved);
  S.settings[orderKey] = list;
  save();
  renderAxisEditor();
  if (S.view === 'matrix') renderMatrix();
}
export function axisDragEnd() { _axisDragIdx=null; _axisField=null; document.querySelectorAll('.col-row').forEach(r=>r.classList.remove('dragging-col','drag-over-col')); }
export function resetAxisOrder() { S.settings.groupOrder=[]; S.settings.catOrder=[]; save(); renderAxisEditor(); if(S.view==='matrix')renderMatrix(); notify('축 순서를 자동 정렬로 초기화했습니다.'); }

/* ── 설정 JSON Import / Export ── */
export function expSettJSON() {
  dlBlob(JSON.stringify({settings:S.settings, display:S.display},null,2), `sobuk-settings-${today()}.json`, 'application/json');
  notify('설정이 JSON 파일로 저장되었습니다.');
}

export function impSettJSON(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (d.settings) Object.keys(d.settings).forEach(k => { if (k in S.settings) S.settings[k] = d.settings[k]; });
      if (d.display)  Object.keys(d.display).forEach(k  => { if (k in S.display)  S.display[k]  = d.display[k]; });
      save(); applyVars(); applyBlurSetting(); syncSettingsUI(); renderAll();
      notify('설정을 불러왔습니다.');
    } catch { notify('JSON 파일 오류입니다.', true); }
  };
  reader.readAsText(file); event.target.value = '';
}

/* ── 초기화 ── */
export function resetData() {
  if (!confirm('모든 데이터를 초기화하겠습니까?')) return;
  S.items = JSON.parse(JSON.stringify(DEMO));
  save(); renderAll();
  document.getElementById('settingsModal')?.classList.remove('on');
  notify('데이터가 초기화되었습니다.');
}

export function resetSettings() {
  if (!confirm('설정을 기본값으로 초기화하겠습니까?')) return;
  Object.assign(S.settings, {
    baseFont:16, cardFont:12, cardRadius:6, cardGap:4,
    colW:130, catW:24, subCatW:72, cellFold:3,
    matrixWidth:'fluid', panelPos:'left', themeId:'sobuk',
    priorityStyles:{high:'left-thick',mid:'left-thin',low:'none'},
    customColors:{light:{},dark:{}},
    listColumns:JSON.parse(JSON.stringify(DEFAULT_LIST_COLS)),
    animations:{enabled:true,countUp:true,card:true,filter:true,shimmer:true,blur:false}
  });
  save(); applyVars(); applyBlurSetting(); syncSettingsUI(); renderAll();
  notify('설정이 초기화되었습니다.');
}
