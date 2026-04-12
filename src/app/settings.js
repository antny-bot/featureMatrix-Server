/* ══════════════════════════════════════════
   settings.js — 설정 모달 UI 동기화, 컬럼 편집기, 애니메이션
══════════════════════════════════════════ */

import { DEFAULT_LIST_COLS } from './constants.js';
import { S, save, notify, today, esc } from './state.js';
import { applyVars, applyBlurSetting, updateDesignContent, renderThemeGrid, renderPrioStyleRows, renderPreviewCards } from './theme.js';
import { renderAll, renderList, renderMatrix } from './render.js';
import { dlBlob } from './io.js';
import { DEMO } from './constants.js';
import { isAdmin, updateAdminUI } from './admin.js';
import { setStore } from '../store/useAppStore.js';

/* ── 설정 탭 전환 ── */
export function sstab(btn, paneId) {
  document.querySelectorAll('.stab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.spane').forEach(p => p.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById(paneId)?.classList.add('on');
  if (paneId === 'sdesign') { renderPrioStyleRows(); renderPreviewCards(); updateDesignContent(); renderThemeGrid(); syncAnimUI(); }
  if (paneId === 'scola')   { renderColEditor(); renderAxisEditor(); }
  if (paneId === 'sserv')   window.syncServerSettingsUI?.();
  if (paneId === 'slog')    { window.loadInlineActivityLog?.(); }
  if (paneId === 'sadmin')  { window.renderDbSectionOrder?.(); window.syncEditorPwStatus?.(); }
}

/* ── 설정 UI 전체 동기화 — React(Zustand)가 읽어서 렌더링 ── */
export function syncSettingsUI() {
  /* SettingsPanel.jsx가 Zustand에서 직접 읽으므로 store 동기화만 수행 */
  setStore({ settings: { ...S.settings }, display: { ...S.display }, filters: { ...S.filters } });
  /* 레이아웃 관련 DOM (설정 모달 외부) */
  document.getElementById('layout')?.classList.toggle('pr', S.settings.panelPos === 'right');
  document.getElementById('fpanel')?.classList.toggle('collapsed', !S.settings.panelVisible);
  document.title = S.settings.title || 'featureMATRIX';
  updateAdminUI();
}

/* ── 타이틀 미리보기 ── */
export function previewTitle() {
  S.settings.title    = document.getElementById('sTitle')?.value ?? S.settings.title;
  S.settings.subtitle = document.getElementById('sSub')?.value   ?? S.settings.subtitle;
  document.title = S.settings.title;
  save();
  setStore({ settings: { ...S.settings } }); // Header.jsx가 Zustand에서 title 읽음
}

/* ── 레이아웃 ── */
export function setMW(v)   { S.settings.matrixWidth=v; document.getElementById('mwF').className='rbtn'+(v==='fluid'?' on':''); document.getElementById('mwX').className='rbtn'+(v==='fixed'?' on':''); save(); if(S.view==='matrix')renderMatrix(); }
export function setPPos(v) { S.settings.panelPos=v; document.getElementById('layout').classList.toggle('pr',v==='right'); document.getElementById('ppL').className='rbtn'+(v==='left'?' on':''); document.getElementById('ppR').className='rbtn'+(v==='right'?' on':''); save(); }

/* ── Stepper 설정값 조절 ── */
/* adj* 함수: S.settings 업데이트 → save() → setStore() → React 자동 반영 */
export function adjFont(d)     { S.settings.baseFont   = Math.max(12,Math.min(22, S.settings.baseFont+d));   save(); applyVars(); setStore({ settings: { ...S.settings } }); }
export function adjCardFont(d) { S.settings.cardFont   = Math.max(9, Math.min(18, S.settings.cardFont+d));   save(); applyVars(); setStore({ settings: { ...S.settings } }); if(S.view==='matrix')renderMatrix(); }
export function adjRadius(d)   { S.settings.cardRadius = Math.max(0, Math.min(14, S.settings.cardRadius+d)); save(); applyVars(); setStore({ settings: { ...S.settings } }); if(S.view==='matrix')renderMatrix(); }
export function adjGap(d)      { S.settings.cardGap    = Math.max(0, Math.min(20, S.settings.cardGap+d));    save(); applyVars(); setStore({ settings: { ...S.settings } }); if(S.view==='matrix')renderMatrix(); }
export function adjColW(d)     { S.settings.colW       = Math.max(80,Math.min(300,S.settings.colW+d));       save(); applyVars(); setStore({ settings: { ...S.settings } }); if(S.view==='matrix')renderMatrix(); }
export function adjCatW(d)     { S.settings.catW       = Math.max(40,Math.min(80, S.settings.catW+d));       save(); applyVars(); setStore({ settings: { ...S.settings } }); if(S.view==='matrix')renderMatrix(); }
export function adjSubCatW(d)  { S.settings.subCatW    = Math.max(40,Math.min(200,S.settings.subCatW+d));    save(); applyVars(); setStore({ settings: { ...S.settings } }); if(S.view==='matrix')renderMatrix(); }
export function adjCellFold(d) { S.settings.cellFold   = Math.max(0, Math.min(20, S.settings.cellFold+d));   save(); setStore({ settings: { ...S.settings } }); if(S.view==='matrix')renderMatrix(); }
export function adjChangeLogMax(d) { S.settings.changeLogMax = Math.max(10,Math.min(500,S.settings.changeLogMax+d)); save(); setStore({ settings: { ...S.settings } }); }
export function adjBoardFoldCount(d) {
  S.settings.boardFoldCount = Math.max(0, Math.min(30, (S.settings.boardFoldCount??6)+d));
  const v = S.settings.boardFoldCount;
  document.getElementById('dBoardFoldCount').textContent = v === 0 ? '∞' : v;
  save();
  setStore({ settings: { ...S.settings } });
}

/* ── 애니메이션 — SettingsPanel.jsx에서 직접 처리, 하위 호환용으로 유지 ── */
export function onAnimTgl() {
  /* SettingsPanel.jsx의 AnimToggle onChange에서 직접 S.settings.animations를 업데이트함 */
  save(); applyBlurSetting(); setStore({ settings: { ...S.settings } }); renderAll();
}

/* ── 애니메이션 UI 동기화 — SettingsPanel.jsx가 Zustand에서 직접 읽으므로 no-op ── */
export function syncAnimUI() {
  /* SettingsPanel.jsx의 AnimToggle 컴포넌트가 checked={settings.animations.*} 로 자동 반영 */
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
    colW:130, catW:52, subCatW:80, cellFold:3, boardFoldCount:6,
    matrixWidth:'fluid', panelPos:'left', themeId:'sobuk',
    priorityStyles:{high:'left-thick',mid:'left-thin',low:'none'},
    customColors:{light:{},dark:{}},
    listColumns:JSON.parse(JSON.stringify(DEFAULT_LIST_COLS)),
    animations:{enabled:true,countUp:true,card:true,filter:true,shimmer:true,blur:false}
  });
  save(); applyVars(); applyBlurSetting(); syncSettingsUI(); renderAll();
  notify('설정이 초기화되었습니다.');
}
