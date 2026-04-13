/* ══════════════════════════════════════════
   render.js — 매트릭스·리스트 렌더, 통계, 필터 UI
══════════════════════════════════════════ */

import { S, normOwner } from './state.js';
import { renderPrioStyleRows } from './theme.js';
import { setStore } from '../store/useAppStore.js';

/* ── Zustand 동기화: renderAll() 후 React 컴포넌트에 S 상태 반영 ── */
function syncToStore() {
  setStore({
    items:     S.items,
    changeLog: S.changeLog,
    view:      S.view,
    searchQ:   S.searchQ,
    filters:   { ...S.filters },
    display:   { ...S.display },
    settings:  { ...S.settings },
    sort:      { ...S.sort },
    editKey:   S.editKey,
  });
}

/* ── 애니메이션 유틸 ── */
const prefersReduced = window.matchMedia?.('(prefers-reduced-motion:reduce)').matches ?? false;
export function animOk(k) {
  if (prefersReduced) return false;
  const a = S.settings.animations;
  return a.enabled && (k ? !!a[k] : true);
}

export function scheduleCardAnim() {
  setStore({ items: [...S.items] });
}

/* ── CountUp ── */
const _cu = {};
export function countUp(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!animOk('countUp')) { el.textContent = target; return; }
  const start = parseInt(el.textContent, 10) || 0;
  if (start === target) return;
  if (_cu[id]) cancelAnimationFrame(_cu[id]);
  const dur = 500, t0 = performance.now();
  function step(now) {
    const t = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - t, 4);
    el.textContent = Math.round(start + (target - start) * e);
    if (t < 1) { _cu[id] = requestAnimationFrame(step); }
    else { el.textContent = target; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }
  _cu[id] = requestAnimationFrame(step);
}

/* ── 필터링 ── */
export function getFiltered() {
  const { priorities, statuses, showDeleted, importantOnly, owners } = S.filters;
  return S.items.filter(it => {
    if (!showDeleted && it.isDelete === 'Y')                                               return false;
    if (importantOnly && it.isImportant !== 'Y')                                          return false;
    if (priorities.length > 0 && !priorities.includes(it.priority))                      return false;
    if (owners.length > 0 && !owners.includes(normOwner(it.owner)))                      return false;
    if (statuses && statuses.length > 0 && it.status && !statuses.includes(it.status))   return false;
    if (S.searchQ && !matchesSearch(it, S.searchQ))                                       return false;
    return true;
  });
}

export const isFilterActive = () => {
  const f = S.filters;
  return f.priorities.length > 0 || (f.statuses && f.statuses.length > 0) ||
         f.importantOnly || f.owners.length > 0 || f.showDeleted || !!S.searchQ;
};

/* 벌크 선택 상태 */
export const bulkSel = { active: false, keys: new Set() };

/* 매트릭스 선택 상태 */
export const mxSel = new Set();

function _mxCards(key) {
  return document.querySelectorAll(`.mitem[data-key="${key.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"]`);
}

export function mxCardClick(e, key) {
  if (e.shiftKey) {
    if (mxSel.has(key)) { mxSel.delete(key); _mxCards(key).forEach(c => c.classList.remove('mxsel')); }
    else                { mxSel.add(key);    _mxCards(key).forEach(c => c.classList.add('mxsel'));    }
  } else {
    mxSel.forEach(k => _mxCards(k).forEach(c => c.classList.remove('mxsel')));
    mxSel.clear();
    mxSel.add(key);
    _mxCards(key).forEach(c => c.classList.add('mxsel'));
  }
  window.dispatchEvent(new CustomEvent('mxSelChange', { detail: { sel: [...mxSel] } }));
}

export function mxClearSel() {
  mxSel.forEach(k => _mxCards(k).forEach(c => c.classList.remove('mxsel')));
  mxSel.clear();
  window.dispatchEvent(new CustomEvent('mxSelChange', { detail: { sel: [] } }));
}

/* 필드 별칭 → 아이템 키 매핑 */
const SEARCH_FIELD_MAP = {
  owner: 'owner', 담당: 'owner',
  status: 'status', 상태: 'status',
  group: 'group', 그룹: 'group',
  category: 'category', cat: 'category', 카테고리: 'category',
  priority: 'priority', 우선순위: 'priority',
  key: 'key',
};

/**
 * 검색어 매칭. `field:value` 문법 지원.
 * 예: "owner:홍길동", "status:완료 group:인증"
 */
function matchesSearch(it, q) {
  const tokens = q.trim().split(/\s+/);
  return tokens.every(tok => {
    const colon = tok.indexOf(':');
    if (colon > 0) {
      const alias = tok.slice(0, colon).toLowerCase();
      const val   = tok.slice(colon + 1).toLowerCase();
      const field = SEARCH_FIELD_MAP[alias];
      if (field) return (it[field] || '').toLowerCase().includes(val);
    }
    // 일반 전문 검색
    const lq = tok.toLowerCase();
    return [it.key, it.name, it.owner, it.path, it.desc, it.group, it.subGroup, it.category, it.subCategory]
      .some(v => (v||'').toLowerCase().includes(lq));
  });
}

export function sortCell(arr) {
  const po = {'상':0,'중':1,'하':2};
  return arr.slice().sort((a,b) => {
    const pa = po[a.priority]??3, pb = po[b.priority]??3;
    if (pa !== pb) return pa - pb;
    if (a.isDelete !== b.isDelete) return a.isDelete === 'Y' ? 1 : -1;
    return 0;
  });
}

export function getUniqSorted(field, items) {
  const seen = new Set(), res = [];
  items.forEach(it => {
    const v = field === 'owner' ? normOwner(it[field]) : (it[field] || '(미분류)');
    if (!seen.has(v)) { seen.add(v); res.push(v); }
  });
  return res.sort((a,b) => { try { return a.localeCompare(b,'ko'); } catch { return a < b ? -1 : 1; } });
}

export function buildStruct(items) {
  const gm = {}, cm = {};
  items.forEach(it => {
    const g = it.group||'(미분류)', sg = it.subGroup||'', c = it.category||'(미분류)', sc = it.subCategory||'';
    if (!gm[g]) gm[g] = {}; gm[g][sg] = true;
    if (!cm[c]) cm[c] = {}; cm[c][sc] = true;
  });
  const sk = (a,b) => { try { return a.localeCompare(b,'ko'); } catch { return a < b ? -1 : 1; } };

  /* 사용자 지정 순서 적용 (groupOrder/catOrder) */
  const applyOrder = (autoList, orderArr) => {
    if (!orderArr || !orderArr.length) return autoList;
    const set = new Set(autoList);
    const ordered = orderArr.filter(v => set.has(v));
    const rest = autoList.filter(v => !ordered.includes(v));
    return [...ordered, ...rest];
  };

  const autoGroups = getUniqSorted('group', S.items).filter(g => !!gm[g]);
  const autoCats   = getUniqSorted('category', S.items).filter(c => !!cm[c]);
  const groups = applyOrder(autoGroups, S.settings.groupOrder);
  const cats   = applyOrder(autoCats,   S.settings.catOrder);

  const gsubs = {}, csubs = {};
  for (const g in gm) gsubs[g] = Object.keys(gm[g]).sort(sk);
  for (const c in cm) csubs[c] = Object.keys(cm[c]).sort(sk);
  return { groups, gsubs, cats, csubs };
}

/* ── legacy layout side effects ── */
function syncLayout() {
  const v = S.view;
  if (v !== 'board' && window.hideBoardActionBar) window.hideBoardActionBar();
}

/* ── 전체 렌더 ── */
export function renderAll(withFade = false) {
  syncLayout();
  const doRender = () => {
    renderStats();
    if (S.view === 'matrix') renderMatrix();
    else if (S.view === 'list') renderList();
    else if (S.view === 'board' && window.renderBoard) window.renderBoard();
    else if (S.view === 'dashboard' && window.renderDashboard) window.renderDashboard();
    updateDL();
    renderOwnerChips();
    renderPrioChips();
    renderStatusChips();
    syncToStore();
  };
  if (withFade && animOk('filter')) {
    const area = document.getElementById('contentArea');
    area.classList.add('fading');
    setTimeout(() => {
      doRender();
      area.classList.remove('fading');
      area.classList.add('fading-in');
      setTimeout(() => area.classList.remove('fading-in'), 200);
    }, 150);
  } else { doRender(); }
}

/* ── 통계 ── */
export function renderStats() {
  const items = getFiltered();
  let h = 0, m = 0, l = 0, imp = 0, nw = 0, done = 0;
  items.forEach(it => {
    if (it.priority === '상') h++; else if (it.priority === '중') m++; else l++;
    if (it.isImportant === 'Y') imp++;
    if (it.key?.charAt(0) === 'N') nw++;
    if (it.status === '완료') done++;
  });
  countUp('stTotal', items.length);
  countUp('stHigh', h); countUp('stMid', m); countUp('stLow', l);
  countUp('stImp', imp); countUp('stNew', nw);
}

/* ── 매트릭스 렌더 — MatrixView.jsx React 포털로 위임, syncToStore()만 호출 ── */
export function renderMatrix() { syncToStore(); }

export function expandCell(e, ck)   { e.stopPropagation(); syncToStore(); }
export function collapseCell(e, ck) { e.stopPropagation(); syncToStore(); }

/* ── 리스트 뷰 ── */
export function getVisibleCols() { return S.settings.listColumns.filter(c => c.visible); }

/* 벌크 선택 토글 */
export function bulkToggle(key) {
  if (bulkSel.keys.has(key)) bulkSel.keys.delete(key);
  else bulkSel.keys.add(key);
  renderBulkBar();
}
export function bulkToggleAll(checked) {
  const items = getFiltered();
  if (checked) items.forEach(it => bulkSel.keys.add(it.key));
  else bulkSel.keys.clear();
  renderBulkBar();
  renderList();
}
export function renderBulkBar() {
  window.__bulkBarRefresh?.();
  window.dispatchEvent(new CustomEvent('bulkSelChange', { detail: { keys: [...bulkSel.keys] } }));
}
export function bulkClear() { bulkSel.keys.clear(); renderBulkBar(); renderList(); }

/* ── 리스트 렌더 — ListView.jsx React 포털로 위임 ── */
export function renderList() {
  syncToStore();
  window.__listViewRefresh?.();
}

export function sortL(k) {
  if (S.sort.key === k) S.sort.dir = S.sort.dir === 'asc' ? 'desc' : 'asc';
  else { S.sort.key = k; S.sort.dir = 'asc'; }
  renderList();
}

export function switchView(v) {
  if (v !== 'matrix') mxClearSel();
  S.view = v;
  setStore({ view: S.view });
  syncLayout();
  renderBulkBar();
  if (v === 'matrix') renderMatrix();
  else if (v === 'list') renderList();
  else if (v === 'board') { if (window.renderBoard) window.renderBoard(); }
  else { if (window.renderDashboard) window.renderDashboard(); }
}

/* ── 필터 UI ── */
export function renderPrioChips() {
  syncToStore();
}

export function renderStatusChips() {
  syncToStore();
}

export function renderOwnerChips() {
  syncToStore();
}

export function updateDL() {
  // ItemModal renders datalist options from Zustand items.
}
