/* ══════════════════════════════════════════
   state.js — 전역 상태(S), 저장/로드 (서버/로컬), Undo
══════════════════════════════════════════ */

import { SK, UNDO_MAX, DEFAULT_LIST_COLS, ADMIN_TOKEN_KEY, EDITOR_TOKEN_KEY } from './constants.js';

/** 전역 상태 — 앱 전체에서 import해서 사용 */
export const S = {
  items: [],
  view: 'matrix',
  searchQ: '',
  expandedCells: new Set(),
  filters: { priorities:[], statuses:[], showDeleted:false, importantOnly:false, owners:[] },
  display: { showOwner:true, showStar:true, showNewBadge:true, showCellCount:true, showUpdated:false, showStatus:true, showMdBadge:true },
  settings: {
    baseFont:16, cardFont:12, cardRadius:6, cardGap:4,
    colW:130, catW:24, subCatW:72, cellFold:0,
    matrixWidth:'fluid', panelPos:'left', panelVisible:true,
    title:'소복 매트릭스', subtitle:'Function Matrix', themeId:'sobuk',
    priorityStyles: { high:'left-thick', mid:'left-thin', low:'none' },
    customColors: { light:{}, dark:{} },
    listColumns: JSON.parse(JSON.stringify(DEFAULT_LIST_COLS)),
    animations: { enabled:true, countUp:true, card:true, filter:true, shimmer:true, blur:false },
    groupOrder: [],
    catOrder: [],
    storageMode: 'server',
    serverUrl:   '',
    pollInterval: 10,
    userName:    '',       // 수정자 표시용 이름
  },
  sort: { key:'key', dir:'asc' },
  editKey: null,
  isDragging: false,
  dragKey: null,
  dragCell: null,
  ttTimer: null,
  importData: { headers:[], rows:[] },
};

export let lastServerTs = 0;
export function setLastServerTs(ts) { lastServerTs = ts; }

function apiBase() {
  const url = (S.settings.serverUrl || '').trim();
  return url || window.location.origin;
}
function apiHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const adminToken  = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const editorToken = sessionStorage.getItem(EDITOR_TOKEN_KEY);
  if (adminToken)  h['X-Admin-Token']  = adminToken;
  if (editorToken) h['X-Editor-Token'] = editorToken;
  return h;
}

/* ══════════════════════════════════════════
   공유 vs 개인 설정 분리

   ─ 서버(공유): items + shared settings
     · 제목/서브제목, 축 순서, 우선순위 스타일,
       커스텀 색상, 열 너비, 셀 접기, 매트릭스 폭

   ─ 로컬(개인): display, filters, 서버 연결,
     테마/폰트/애니메이션/패널 위치/리스트 컬럼
══════════════════════════════════════════ */

/* 서버에 저장할 settings 키 목록 */
const SHARED_SETTINGS = [
  'title','subtitle',
  'groupOrder','catOrder',
  'priorityStyles','customColors',
  'matrixWidth','cellFold',
  'colW','catW','subCatW',
  'cardRadius','cardGap',
];

/* 서버 전송 payload */
function buildServerPayload() {
  const shared = {};
  SHARED_SETTINGS.forEach(k => { shared[k] = S.settings[k]; });
  return { items: S.items, settings: shared };
}

/* 로컬 전용 payload (서버 연결 정보 포함) */
function buildLocalPayload() {
  return {
    items:    S.items,          // 오프라인 캐시용
    display:  S.display,
    filters:  S.filters,
    local: {  // 개인 설정만 묶음
      baseFont:     S.settings.baseFont,
      cardFont:     S.settings.cardFont,
      themeId:      S.settings.themeId,
      animations:   S.settings.animations,
      panelPos:     S.settings.panelPos,
      panelVisible: S.settings.panelVisible,
      listColumns:  S.settings.listColumns,
      storageMode:  S.settings.storageMode,
      serverUrl:    S.settings.serverUrl,
      pollInterval: S.settings.pollInterval,
      userName:     S.settings.userName,
    }
  };
}

/* 서버 payload 적용 (공유 데이터만) */
function applyServerPayload(d) {
  if (!d) return;
  if (d.items) S.items = d.items;
  if (d.settings) {
    const ss = d.settings;
    SHARED_SETTINGS.forEach(k => {
      if (ss[k] === undefined) return;
      if (k === 'priorityStyles') { S.settings.priorityStyles = ss[k]; return; }
      if (k === 'customColors')   { S.settings.customColors   = ss[k]; return; }
      if (k === 'groupOrder')     { S.settings.groupOrder     = ss[k]; return; }
      if (k === 'catOrder')       { S.settings.catOrder       = ss[k]; return; }
      S.settings[k] = ss[k];
    });
  }
}

/* 로컬 payload 적용 (개인 설정) */
function applyLocalPayload(d) {
  if (!d) return;
  if (d.items) S.items = d.items; // 캐시 복원
  if (d.display) Object.keys(d.display).forEach(k => { if (k in S.display) S.display[k] = d.display[k]; });
  if (d.filters) Object.keys(d.filters).forEach(k => { if (k in S.filters) S.filters[k] = d.filters[k]; });
  if (d.local) {
    const l = d.local;
    ['baseFont','cardFont','themeId','panelPos','panelVisible',
     'storageMode','serverUrl','pollInterval','userName']
      .forEach(k => { if (l[k] !== undefined) S.settings[k] = l[k]; });
    if (l.animations)  Object.assign(S.settings.animations, l.animations);
    if (l.listColumns) S.settings.listColumns = l.listColumns;
  }
  // 구버전 로컬 포맷 호환 (settings 플랫 구조)
  if (d.settings && !d.local) {
    const ss = d.settings;
    ['baseFont','cardFont','themeId','panelPos','storageMode','serverUrl','pollInterval','userName']
      .forEach(k => { if (ss[k] !== undefined) S.settings[k] = ss[k]; });
    if (ss.panelVisible !== undefined) S.settings.panelVisible = ss.panelVisible;
    if (ss.animations)  Object.assign(S.settings.animations, ss.animations);
    if (ss.listColumns) S.settings.listColumns = ss.listColumns;
  }
}

function saveLocal() {
  try { localStorage.setItem(SK, JSON.stringify(buildLocalPayload())); } catch(e) {}
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(SK);
    if (raw) applyLocalPayload(JSON.parse(raw));
  } catch(e) {}
}

export async function saveToServer() {
  try {
    const res = await fetch(apiBase() + '/api/data', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ payload: buildServerPayload(), editor: S.settings.userName || '익명' })
    });
    const json = await res.json();
    if (!json.ok) { notify('서버 저장 실패: ' + json.error, true); return false; }
    lastServerTs = json.serverTs;
    window.setServerStatus?.('ok');
    saveLocal();
    return true;
  } catch(e) {
    window.setServerStatus?.('error');
    notify('서버에 연결할 수 없습니다. 로컬에 임시 저장됩니다.', true);
    saveLocal();
    return false;
  }
}

export async function loadFromServer() {
  try {
    const res = await fetch(apiBase() + '/api/data', { headers: apiHeaders() });
    if (!res.ok) {
      if (res.status === 403) notify('편집 권한이 없습니다. 로그인하세요.', true);
      throw new Error(res.status);
    }
    const json = await res.json();
    if (json.payload) {
      applyServerPayload(json.payload); // 공유 데이터 반영
      lastServerTs = json.serverTs;
      window.setServerStatus?.('ok');
      saveLocal();                      // 개인 설정 캐시 갱신
      return true;
    }
    // 서버에 데이터 없음 → 로컬 캐시 items 유지
    return false;
  } catch(e) {
    window.setServerStatus?.('error');
    notify('서버 연결 실패 — 로컬 캐시를 불러옵니다.', true);
    return false;
  }
}

export async function pollServerTs() {
  try {
    const res = await fetch(apiBase() + '/api/ping', { headers: apiHeaders() });
    if (!res.ok) return null;
    const json = await res.json();
    return { serverTs: json.serverTs, lastEditor: json.lastEditor || '', lastEditTime: json.lastEditTime || 0 };
  } catch(e) { return null; }
}

export function save() {
  if (S.settings.storageMode === 'server') {
    saveToServer();
  } else {
    saveLocal();
  }
}

export async function load() {
  loadLocal(); // ① 개인 설정(storageMode, apiKey, 테마 등) 먼저 복원
  if (S.settings.storageMode === 'server') {
    await loadFromServer(); // ② 서버에서 공유 데이터 덮어쓰기
  }
}

export function resolveConflictKeepMine() {
  lastServerTs = 0; // baseTs=0 → 서버가 무조건 허용
  saveToServer();
}

export function resolveConflictUseServer(serverData) {
  applyServerPayload(serverData.payload || serverData);
  lastServerTs = serverData.serverTs || lastServerTs;
  saveLocal();
  window.__sobukRenderAll?.();
  notify('서버 데이터로 업데이트됐습니다.');
}

const undoStack = [];

export function pushUndo() {
  undoStack.push(JSON.stringify(S.items));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  updateUndoFab();
}

export function doUndo() {
  if (!undoStack.length) return;
  S.items = JSON.parse(undoStack.pop());
  save();
  window.__sobukRenderAll?.();
  updateUndoFab();
  logActivity('되돌리기', `${S.items.length}개 항목으로 복원`);
  notify('되돌렸습니다.');
}

export function getUndoHistory() { return undoStack.slice(); }

export function updateUndoFab() {
  const f = document.getElementById('undoFab');
  if (f) f.className = 'undo-fab' + (undoStack.length ? ' on' : '');
}

export const esc   = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export const eattr = s => String(s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export function genKey() {
  let max = 0;
  S.items.forEach(({key=''}) => {
    if (key.charAt(0) === 'N') {
      const n = parseInt(key.substring(1), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return 'N' + String(max + 1).padStart(4, '0');
}

export const findItem  = key => S.items.find(it => it.key === key) || null;
export const getPK     = pv  => pv === '상' ? 'high' : pv === '중' ? 'mid' : 'low';
export const normOwner = v   => (v||'').trim() || '(미분류)';

const OWNER_COLORS = ['#2563A8','#16A34A','#D97706','#9333EA','#0891B2','#BE185D','#059669','#DC2626','#7C3AED','#C2410C'];
const _ownerColorMap = {};

export function getOwnerColor(owner) {
  const k = normOwner(owner);
  if (k === '(미분류)') return 'var(--text-3)';
  if (!_ownerColorMap[k]) {
    const idx = Object.keys(_ownerColorMap).length % OWNER_COLORS.length;
    _ownerColorMap[k] = OWNER_COLORS[idx];
  }
  return _ownerColorMap[k];
}

export function fmtDate(ts) {
  if (!ts) return '';
  const d    = new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)     return '방금';
  if (diff < 3600)   return Math.floor(diff / 60) + '분 전';
  if (diff < 86400)  return Math.floor(diff / 3600) + '시간 전';
  if (diff < 604800) return Math.floor(diff / 86400) + '일 전';
  return d.toLocaleDateString('ko-KR', {month:'short', day:'numeric'});
}

export const today = () => new Date().toISOString().slice(0, 10);
export const notify = (msg, isErr=false) => window.__sobukNotify?.(msg, isErr);

/* ══════════════════════════════════════════
   활동 로그
══════════════════════════════════════════ */
export async function logActivity(action, detail = '') {
  if (S.settings.storageMode !== 'server') return;
  try {
    await fetch(apiBase() + '/api/log', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({
        action,
        detail,
        user:  S.settings.userName || '익명',
        ts:    Date.now()
      })
    });
  } catch(e) {}
}

/* ── 편집 중 락 ── */
export const editLocks = {};  // { key: { user, ts } }

export function updateLocks(locks) {
  Object.keys(editLocks).forEach(k => delete editLocks[k]);
  if (locks) Object.assign(editLocks, locks);
}

export async function lockItem(key) {
  if (S.settings.storageMode !== 'server' || !key) return null;
  try {
    const res = await fetch(apiBase() + '/api/lock', {
      method: 'POST', headers: apiHeaders(),
      body: JSON.stringify({ key, user: S.settings.userName || '익명' })
    });
    return await res.json();
  } catch(e) { return null; }
}

export async function unlockItem(key) {
  if (S.settings.storageMode !== 'server' || !key) return;
  try {
    await fetch(apiBase() + '/api/unlock', {
      method: 'POST', headers: apiHeaders(),
      body: JSON.stringify({ key, user: S.settings.userName || '익명' })
    });
  } catch(e) {}
}
