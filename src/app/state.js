/* ══════════════════════════════════════════
   state.js — 전역 상태(S), 저장/로드 (서버/로컬), Undo
══════════════════════════════════════════ */

import { SK, UNDO_MAX, DEFAULT_LIST_COLS, ADMIN_TOKEN_KEY, EDITOR_TOKEN_KEY, DATA_VERSION, MIGRATIONS } from './constants.js';
import { emitLock, emitUnlock, emitDataSave, isSocketConnected, releaseLocalLock } from './socket.js';
import { setStore } from '../store/useAppStore.js';

/** 전역 상태 — 앱 전체에서 import해서 사용 */
export const S = {
  items: [],
  changeLog: [],           // 변경 이력 (추가/수정/삭제 등)
  view: 'matrix',
  searchQ: '',
  filters: { priorities:[], statuses:[], showDeleted:false, importantOnly:false, owners:[] },
  display: { showOwner:true, showStar:true, showNewBadge:true, showCellCount:true, showUpdated:false, showStatus:true, showMdBadge:true, showQuickAdd:false },
  settings: {
    baseFont:16, cardFont:12, cardRadius:6, cardGap:4,
    colW:130, catW:52, subCatW:80, cellFold:0,
    matrixWidth:'fluid', panelPos:'left', panelVisible:true,
    title:'소복 매트릭스', subtitle:'Function Matrix', themeId:'sobuk',
    priorityStyles: { high:'left-thick', mid:'left-thin', low:'none' },
    customColors: { light:{}, dark:{} },
    listColumns: JSON.parse(JSON.stringify(DEFAULT_LIST_COLS)),
    animations: { enabled:true, countUp:true, card:true, filter:true, shimmer:true, blur:false },
    groupOrder: [],
    catOrder: [],
    dbHeroName: '',
    dbSections: ['stats', 'insight', 'heatmap'],
    changeLogMax: 50,      // 최근 변경 이력 최대 보관 개수
    boardFoldCount: 6,     // 보드 뷰 컬럼 기본 표시 카드 수
    storageMode: 'server',
    serverUrl:   '',
    pollInterval: 60,
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

/**
 * 아이템 배열에 스키마 마이그레이션을 순차 적용.
 * 저장된 데이터 버전(dataVersion)부터 DATA_VERSION까지 마이그레이션 함수를 실행.
 */
export function migrateItems(items, fromVersion = 1) {
  let result = items;
  for (let v = fromVersion; v < DATA_VERSION; v++) {
    const fn = MIGRATIONS[v];
    if (fn) result = result.map(fn);
  }
  return result;
}

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

/**
 * API fetch 유틸 — 인증 헤더 자동 주입, 상태 코드 에러 변환
 * @param {string} path  - apiBase() 기준 경로 (예: '/api/data')
 * @param {RequestInit} [options]
 * @returns {Promise<any>} 파싱된 JSON
 */
export async function apiFetch(path, options = {}) {
  const res = await fetch(apiBase() + path, {
    ...options,
    headers: { ...apiHeaders(), ...(options.headers || {}) }
  });
  if (!res.ok) {
    const err = new Error(res.statusText || String(res.status));
    err.status = res.status;
    throw err;
  }
  return res.json();
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
  'dbHeroName','dbSections',
  'priorityStyles','customColors',
  'matrixWidth','cellFold',
  'colW','catW','subCatW',
  'cardRadius','cardGap',
  'changeLogMax',
];

/* 서버 전송 payload */
function buildServerPayload() {
  const shared = {};
  SHARED_SETTINGS.forEach(k => { shared[k] = S.settings[k]; });
  return { items: S.items, changeLog: S.changeLog, settings: shared, dataVersion: DATA_VERSION };
}

/* 로컬 전용 payload (서버 연결 정보 포함) */
function buildLocalPayload() {
  return {
    items:     S.items,         // 오프라인 캐시용
    changeLog: S.changeLog,
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
  if (d.items) S.items = migrateItems(d.items, d.dataVersion || 1);
  if (Array.isArray(d.changeLog)) S.changeLog = d.changeLog;
  if (d.settings) {
    const ss = d.settings;
    SHARED_SETTINGS.forEach(k => {
      if (ss[k] === undefined) return;
      if (k === 'priorityStyles') { S.settings.priorityStyles = ss[k]; return; }
      if (k === 'customColors')   { S.settings.customColors   = ss[k]; return; }
      if (k === 'groupOrder')     { S.settings.groupOrder     = ss[k]; return; }
      if (k === 'catOrder')       { S.settings.catOrder       = ss[k]; return; }
      if (k === 'dbSections')     { S.settings.dbSections     = ss[k]; return; }
      S.settings[k] = ss[k];
    });
  }
}

/* 로컬 payload 적용 (개인 설정) */
function applyLocalPayload(d) {
  if (!d) return;
  if (d.items) S.items = migrateItems(d.items, d.dataVersion || 1); // 캐시 복원 + 마이그레이션
  if (Array.isArray(d.changeLog)) S.changeLog = d.changeLog;
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
  try {
    localStorage.setItem(SK, JSON.stringify(buildLocalPayload()));
  } catch(e) {
    if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
      notify('⚠ 로컬 저장소가 가득 찼습니다. 일부 데이터가 저장되지 않았을 수 있습니다.', 'warning');
    }
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(SK);
    if (raw) applyLocalPayload(JSON.parse(raw));
  } catch(e) {}
}

export async function saveToServer() {
  try {
    const json = await apiFetch('/api/data', {
      method: 'POST',
      body: JSON.stringify({ payload: buildServerPayload(), editor: S.settings.userName || '익명' })
    });
    if (!json.ok) { notify('서버 저장 실패: ' + json.error, 'error'); return false; }
    lastServerTs = json.serverTs;
    window.setServerStatus?.('ok');
    saveLocal();
    return true;
  } catch(e) {
    window.setServerStatus?.('error');
    notify('서버에 연결할 수 없습니다. 로컬에 임시 저장됩니다.', 'warning');
    saveLocal();
    return false;
  }
}

export function broadcastSharedData(serverTs = lastServerTs) {
  if (S.settings.storageMode !== 'server') return;
  emitDataSave(S.settings.userName || '익명', buildServerPayload(), serverTs);
}

export async function loadFromServer() {
  try {
    const json = await apiFetch('/api/data');
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
    if (e.status === 403) notify('편집 권한이 없습니다. 로그인하세요.', 'error');
    window.setServerStatus?.('error');
    notify('서버 연결 실패 — 로컬 캐시를 불러옵니다.', 'warning');
    return false;
  }
}

export async function pollServerTs() {
  try {
    const json = await apiFetch('/api/ping');
    return { serverTs: json.serverTs, lastEditor: json.lastEditor || '', lastEditTime: json.lastEditTime || 0, hasEditorPw: json.hasEditorPw ?? false, locks: json.locks || {} };
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
  notify('서버 데이터로 업데이트됐습니다.', 'success');
}

export function applyRemoteSharedData(payload, serverTs = lastServerTs) {
  if (serverTs && lastServerTs && serverTs <= lastServerTs) return false;
  applyServerPayload(payload);
  if (serverTs) lastServerTs = serverTs;
  saveLocal();
  return true;
}

const undoStack = [];

export function pushUndo() {
  undoStack.push(JSON.stringify(S.items));
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  updateUndoFab();
}

export async function doUndo() {
  if (!undoStack.length) return;
  S.items = JSON.parse(undoStack.pop());
  if (S.settings.storageMode === 'server') {
    const saved = await saveToServer();
    if (saved) broadcastSharedData(lastServerTs);
  } else {
    saveLocal();
  }
  window.__sobukRenderAll?.();
  updateUndoFab();
  logActivity('되돌리기', `${S.items.length}개 항목으로 복원`);
  notify('되돌렸습니다.', 'success');
}

export function getUndoHistory() { return undoStack.slice(); }

export function updateUndoFab() {
  setStore({ undoDepth: undoStack.length });
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
/** @param {string} msg @param {boolean|'success'|'warning'|'error'} [type] */
export const notify = (msg, type = false) => window.__sobukNotify?.(msg, type);

/* ══════════════════════════════════════════
   활동 로그
══════════════════════════════════════════ */
export async function logActivity(action, detail = '') {
  if (S.settings.storageMode !== 'server') return;
  try {
    await apiFetch('/api/log', {
      method: 'POST',
      body: JSON.stringify({ action, detail, user: S.settings.userName || '익명', ts: Date.now() })
    });
  } catch(e) {}
}

/**
 * 클라이언트 변경 이력 기록 — 서버/로컬 모드 모두 동작
 * @param {'추가'|'수정'|'삭제처리'|'삭제복원'|'완전삭제'|'상태변경'} action
 * @param {string} key
 * @param {string} name
 * @param {object} [extra]  - { status, owner } 등 추가 정보
 */
export function pushChangeLog(action, key, name, extra = {}) {
  const max = S.settings.changeLogMax || 50;
  S.changeLog.unshift({ action, key, name, ts: Date.now(), user: S.settings.userName || '', ...extra });
  if (S.changeLog.length > max) S.changeLog.length = max;
}

/* ── 편집 중 락 ── */
export const editLocks = {};  // { key: { user, ts } }  (레거시 참조 유지)

export function updateLocks(locks) {
  const prev = JSON.stringify(editLocks);
  Object.keys(editLocks).forEach(k => delete editLocks[k]);
  if (locks) Object.assign(editLocks, locks);
  // Zustand 동기화
  setStore({ editLocks: { ...(locks || {}) } });
  return JSON.stringify(editLocks) !== prev;
}

/* 락 TTL 타이머 맵: key → timerId (네트워크 단절 대비 fallback) */
const _lockTimers = {};
const LOCK_TTL = 5 * 60 * 1000; // 5분

export function lockItem(key) {
  if (S.settings.storageMode !== 'server' || !key) return;
  if (_lockTimers[key]) { clearTimeout(_lockTimers[key]); delete _lockTimers[key]; }
  const user = S.settings.userName || '익명';
  if (isSocketConnected()) {
    // WebSocket emit (응답은 item_locked / lock_denied 이벤트로 수신)
    emitLock(key, user);
  } else {
    // Polling 폴백: REST API
    apiFetch('/api/lock', {
      method: 'POST',
      body: JSON.stringify({ key, user })
    }).catch(() => {});
  }
  // 5분 TTL fallback (네트워크 단절 시 자동 해제)
  _lockTimers[key] = setTimeout(() => unlockItem(key), LOCK_TTL);
}

export function unlockItem(key) {
  if (S.settings.storageMode !== 'server' || !key) return;
  if (_lockTimers[key]) { clearTimeout(_lockTimers[key]); delete _lockTimers[key]; }
  releaseLocalLock(key);
  const user = S.settings.userName || '익명';
  if (isSocketConnected()) {
    emitUnlock(key, user);
  } else {
    apiFetch('/api/unlock', {
      method: 'POST',
      body: JSON.stringify({ key, user })
    }).catch(() => {});
  }
}
