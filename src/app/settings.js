/* ══════════════════════════════════════════
   settings.js — 설정 모달 UI 동기화, 컬럼 편집기, 애니메이션
══════════════════════════════════════════ */

import { DEFAULT_LIST_COLS } from './constants.js';
import { S, save, notify, today } from './state.js';
import { applyVars, applyBlurSetting } from './theme.js';
import { renderAll, renderList, renderMatrix } from './render.js';
import { dlBlob } from './io.js';
import { DEMO } from './constants.js';
import { isAdmin, updateAdminUI } from './admin.js';
import { setStore } from '../store/useAppStore.js';

/* ── 설정 탭 전환 ── */
export function sstab(btn, paneId) {
  if (paneId === 'sserv')   window.syncServerSettingsUI?.();
  if (paneId === 'slog')    { window.loadInlineActivityLog?.(); }
  if (paneId === 'sadmin')  { window.renderDbSectionOrder?.(); window.syncEditorPwStatus?.(); }
}

/* ── 설정 UI 전체 동기화 — React(Zustand)가 읽어서 렌더링 ── */
export function syncSettingsUI() {
  /* SettingsPanel.jsx가 Zustand에서 직접 읽으므로 store 동기화만 수행 */
  setStore({ settings: { ...S.settings }, display: { ...S.display }, filters: { ...S.filters } });
  document.title = S.settings.title || 'featureMATRIX';
  updateAdminUI();
}

/* ── 타이틀 미리보기 ── */
export function previewTitle(next = {}) {
  if (next.title !== undefined) S.settings.title = next.title;
  if (next.subtitle !== undefined) S.settings.subtitle = next.subtitle;
  document.title = S.settings.title || 'featureMATRIX';
  save();
  setStore({ settings: { ...S.settings } }); // Header.jsx가 Zustand에서 title 읽음
}

/* ── 레이아웃 ── */
export function setMW(v)   { S.settings.matrixWidth=v; save(); setStore({ settings: { ...S.settings } }); if(S.view==='matrix')renderMatrix(); }
export function setPPos(v) { S.settings.panelPos=v; save(); setStore({ settings: { ...S.settings } }); }

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
export function renderColEditor() {
  // React SettingsColumnsPanel renders the list column editor.
}

export function toggleColVisible(idx, checked) { S.settings.listColumns[idx].visible = checked; save(); setStore({ settings: { ...S.settings } }); if (S.view==='list') renderList(); }
export function colDragStart()        {}
export function colDragOver(e)        { e.preventDefault(); }
export function colDragLeave()        {}
export function colDrop(e)            { e.preventDefault(); }
export function colDragEnd()          {}
export function resetListCols()       { S.settings.listColumns=JSON.parse(JSON.stringify(DEFAULT_LIST_COLS)); save(); setStore({ settings: { ...S.settings } }); renderColEditor(); if(S.view==='list')renderList(); notify('리스트 컬럼을 기본값으로 복원했습니다.'); }

/* ── 그룹/카테고리 순서 관리 ── */
export function renderAxisEditor() {
  // React SettingsColumnsPanel renders the axis editors.
}

export function axisDragStart() {}
export function axisDragOver(e) { e.preventDefault(); }
export function axisDragLeave() {}
export function axisDrop(e)     { e.preventDefault(); }
export function axisDragEnd()   {}
export function resetAxisOrder() { S.settings.groupOrder=[]; S.settings.catOrder=[]; save(); setStore({ settings: { ...S.settings } }); renderAxisEditor(); if(S.view==='matrix')renderMatrix(); notify('축 순서를 자동 정렬로 초기화했습니다.'); }

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
