/* ══════════════════════════════════════════
   render.js — 매트릭스·리스트 렌더, 통계, 필터 UI
══════════════════════════════════════════ */

import { STATUS_CLS, STATUS_LBL, STATUS_OPTS, STATUS_CHIP_COLORS, FLABELS } from './constants.js';
import { S, save, pushUndo, esc, eattr, normOwner, getPK, getOwnerColor, fmtDate, editLocks } from './state.js';
import { getColors, getPresetCSS, renderPrioStyleRows } from './theme.js';
import { isAdmin, isEditor } from './admin.js';
import { setStore } from '../store/useAppStore.js';

/* ── Zustand 동기화: renderAll() 후 React 컴포넌트에 S 상태 반영 ── */
function syncToStore() {
  setStore({
    items:    S.items,
    view:     S.view,
    searchQ:  S.searchQ,
    filters:  { ...S.filters },
    display:  { ...S.display },
    settings: { ...S.settings },
    sort:     { ...S.sort },
    editKey:  S.editKey,
  });
}

/* ── 애니메이션 유틸 ── */
const prefersReduced = window.matchMedia?.('(prefers-reduced-motion:reduce)').matches ?? false;
export function animOk(k) {
  if (prefersReduced) return false;
  const a = S.settings.animations;
  return a.enabled && (k ? !!a[k] : true);
}

/* 카드 등장 애니메이션은 의도적 진입(초기 로드·항목 추가)에만 허용 */
let _cardAnimEnabled = false;
export function scheduleCardAnim() { _cardAnimEnabled = true; }

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
}

export function mxClearSel() {
  mxSel.forEach(k => _mxCards(k).forEach(c => c.classList.remove('mxsel')));
  mxSel.clear();
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

function hlSearch(text, q) {
  if (!q || !text) return esc(text);
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return esc(text).replace(re, '<mark class="search-hl">$1</mark>');
}

function sortCell(arr) {
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

function buildStruct(items) {
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

/* ── nav-side / fpanel 상태 동기화 ── */
function syncLayout() {
  const v = S.view;
  const navMap = { dashboard: 'navD', matrix: 'navM', board: 'navB', list: 'navL' };
  ['navD', 'navM', 'navB', 'navL'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = 'nav-item' + (navMap[v] === id ? ' on' : '');
  });
  ['dashboardView', 'matrixView', 'boardView', 'listView'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === v + 'View' ? '' : 'none';
  });
  if (v !== 'board' && window.hideBoardActionBar) window.hideBoardActionBar();
  const fp = document.getElementById('fpanel');
  if (fp) fp.classList.toggle('fp-hide', v === 'dashboard');
  const hs = document.getElementById('hdrSearchWrap');
  if (hs) hs.style.display = v === 'dashboard' ? 'none' : 'flex';
  const contentEl = document.getElementById('contentArea');
  if (contentEl) contentEl.style.overflowY = v === 'board' ? 'hidden' : '';
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
  const cb = document.getElementById('hdrCountBadge');
  if (cb) cb.textContent = items.length ? `${items.length}개` : '';
  const fb = document.getElementById('fbadge');
  if (fb) fb.className = 'fbadge' + (isFilterActive() ? ' on' : '');
}

/* ── 매트릭스 ── */
export function renderMatrix() {
  const items = getFiltered();
  const el    = document.getElementById('matrixView');
  el.className = 'mwrap' + (S.settings.matrixWidth === 'fluid' ? ' fluid' : '');
  if (!items.length) {
    const emptyMsg = S.settings.storageMode === 'server'
      ? '<div class="empty"><div style="font-size:2rem;opacity:.3">🌐</div><div style="font-size:.875rem;text-align:center">서버에 데이터가 없거나 연결을 확인해주세요.<br><span style="font-size:.75rem;color:var(--text-3)">관리자에게 문의하거나 로그인 후 다시 시도하세요.</span></div></div>'
      : '<div class="empty"><div style="font-size:2rem;opacity:.3">📋</div><div style="font-size:.875rem;text-align:center">표시할 기능이 없습니다.</div></div>';
    el.innerHTML = emptyMsg;
    return;
  }
  const st = buildStruct(items);
  const cm  = {};
  items.forEach(it => {
    const ck = `${it.group||'(미분류)'}|||${it.subGroup||''}|||${it.category||'(미분류)'}|||${it.subCategory||''}`;
    if (!cm[ck]) cm[ck] = [];
    cm[ck].push(it);
  });
  Object.keys(cm).forEach(k => { cm[k] = sortCell(cm[k]); });

  const c = getColors();
  const showCnt = S.display.showCellCount;

  /* 카운트 집계 */
  const gCnt = {}, sgCnt = {}, catCnt = {}, scCnt = {};
  items.forEach(it => {
    const g   = it.group||'(미분류)', sg = `${g}|||${it.subGroup||''}`;
    const cat = it.category||'(미분류)', sc = `${cat}|||${it.subCategory||''}`;
    gCnt[g]    = (gCnt[g]   ||0)+1;
    sgCnt[sg]  = (sgCnt[sg] ||0)+1;
    catCnt[cat]= (catCnt[cat]||0)+1;
    scCnt[sc]  = (scCnt[sc] ||0)+1;
  });
  const badge = n => `<span class="gcnt">${n}</span>`;

  /* 최소 테이블 폭 계산: 행 헤더(카테고리+서브카테고리) + 각 서브그룹 컬럼 * colW
     → table-layout:fixed 가 컨테이너에 맞춰 축소하지 못하도록 min-width 고정 */
  const ss = S.settings;
  const totalSubCols = st.groups.reduce((acc, gn) => acc + st.gsubs[gn].length, 0);
  const tableMinW = (ss.catW || 12) + (ss.subCatW || 72) + totalSubCols * (ss.colW || 130);

  const catW = ss.catW || 12, subCatW = ss.subCatW || 72;
  let h = `<div class="mscroll"><table class="mtable" style="min-width:${tableMinW}px"><thead class="mx-thead-sticky"><tr>`;
  h += `<th class="m-corner" rowspan="2" style="width:${catW}px;min-width:${catW}px;max-width:${catW}px"></th><th class="m-corner" rowspan="2" style="width:${subCatW}px;min-width:${subCatW}px;max-width:${subCatW}px"></th>`;
  st.groups.forEach(gn => {
    h += `<th class="m-ghd" colspan="${st.gsubs[gn].length}">${esc(gn)}${showCnt ? badge(gCnt[gn]||0) : ''}</th>`;
  });
  h += '</tr><tr>';
  st.groups.forEach(gn => {
    st.gsubs[gn].forEach(sg => {
      const sgKey = `${gn}|||${sg}`;
      h += `<th class="m-sghd">${esc(sg||'—')}${showCnt ? badge(sgCnt[sgKey]||0) : ''}</th>`;
    });
  });
  h += '</tr></thead><tbody>';

  st.cats.forEach(cn => {
    const scA = st.csubs[cn];
    scA.forEach((scn, sci) => {
      h += '<tr>';
      if (sci === 0) {
        h += `<td class="m-cathd" rowspan="${scA.length}" style="width:${catW}px;min-width:${catW}px;max-width:${catW}px">${esc(cn)}${showCnt ? badge(catCnt[cn]||0) : ''}</td>`;
      }
      const scKey = `${cn}|||${scn}`;
      h += `<td class="m-subcat" style="width:${subCatW}px;min-width:${subCatW}px;max-width:${subCatW}px">${esc(scn||'—')}${showCnt ? badge(scCnt[scKey]||0) : ''}</td>`;

      st.groups.forEach(gn => {
        st.gsubs[gn].forEach(sg => {
          const ck    = `${gn}|||${sg}|||${cn}|||${scn}`;
          const ci    = cm[ck] || [];
          const fold  = S.settings.cellFold;
          const isExp = S.expandedCells.has(ck) || !!S.searchQ || fold === 0;
          const show  = isExp ? ci : ci.slice(0, fold);
          const hidden = ci.length - show.length;
          const doCardAnim = animOk('card') && _cardAnimEnabled;
          h += `<td class="m-cell${doCardAnim ? ' anim-card-entrance' : ''}" style="background:var(--bg)"
            data-g="${eattr(gn)}" data-sg="${eattr(sg)}" data-c="${eattr(cn)}" data-sc="${eattr(scn)}"
            ondragenter="onDE(event)" ondragover="onDO(event)" ondragleave="onDL(event)" ondrop="onDrop(event)">`;
          show.forEach((it, ii) => { h += renderCard(it, c, doCardAnim ? ii : -1, { onclick: `mxCardClick(event,'${eattr(it.key)}')`, ondblclick: `openEditOrMd('${eattr(it.key)}')`, extraClass: mxSel.has(it.key) ? 'mxsel' : '' }); });
          if (hidden > 0)
            h += `<button class="cell-more-btn" onclick="expandCell(event,'${eattr(ck)}')">▼ ${hidden}개 더보기</button>`;
          if (isExp && ci.length > fold && fold > 0)
            h += `<button class="cell-more-btn" onclick="collapseCell(event,'${eattr(ck)}')">▲ 접기</button>`;
          
          if (isEditor() && S.display.showQuickAdd) {
            h += `<button class="cell-quick-add-btn" onclick="event.stopPropagation();openAddInCell('${eattr(gn)}','${eattr(sg)}','${eattr(cn)}','${eattr(scn)}')">+ 추가</button>`;
          }
          h += '</td>';
        });
      });
      h += '</tr>';
    });
  });
  h += '</tbody></table></div>';
  el.innerHTML = h;
  _cardAnimEnabled = false;
}

export function expandCell(e, ck)   { e.stopPropagation(); S.expandedCells.add(ck);    renderMatrix(); }
export function collapseCell(e, ck) { e.stopPropagation(); S.expandedCells.delete(ck); renderMatrix(); }

/* ── 카드 HTML ── */
export function renderCard(item, c, si = -1, overrides = {}) {
  const pk    = getPK(item.priority), pkC = pk[0].toUpperCase() + pk.slice(1);
  const pHex  = c[`p${pkC}`]   || '#888';
  const pBg   = c[`p${pkC}Bg`] || '#eee';
  const css   = `${getPresetCSS(S.settings.priorityStyles[pk], pHex, pBg)};border-radius:${S.settings.cardRadius}px;margin-bottom:${S.settings.cardGap}px;`;
  const isNew = item.key?.charAt(0) === 'N';
  const isDel = item.isDelete === 'Y';
  const delay = si >= 0 ? `animation-delay:${si * 40}ms;` : '';
  const delStyle   = isDel ? 'text-decoration:line-through;color:var(--text-3);' : '';
  const ownerColor = getOwnerColor(item.owner);
  const nameHl     = S.searchQ ? hlSearch(item.name, S.searchQ) : esc(item.name);
  /* C - 상태 뱃지 클릭으로 빠른 상태 변경 */
  const statusHtml = S.display.showStatus
    ? (item.status
      ? `<span class="status-badge ${STATUS_CLS[item.status]||''}" onclick="event.stopPropagation();openStatusMenu(event,'${eattr(item.key)}')">${STATUS_LBL[item.status]||esc(item.status)}</span>`
      : `<span class="status-badge" style="background:var(--surface-3);color:var(--text-3);opacity:.6" onclick="event.stopPropagation();openStatusMenu(event,'${eattr(item.key)}')">—</span>`)
    : '';
  const mdBadge = (S.display.showMdBadge && item.mdContent)
    ? `<span class="md-badge" onclick="event.stopPropagation();openMdModal('${eattr(item.key)}')" title="마크다운 보기" style="cursor:pointer">MD</span>`
    : '';
  const updatedHtml = S.display.showUpdated && item.updatedAt ? `<div class="item-updated">${fmtDate(item.updatedAt)}</div>` : '';
  const ownerHtml   = S.display.showOwner ? `<div class="item-owner"><span class="owner-dot" style="background:${ownerColor}"></span>${esc(normOwner(item.owner))}</div>` : '';
  /* 편집 중 락 배지 */
  const lockInfo  = editLocks[item.key];
  const myName    = S.settings.userName || '익명';
  const lockBadge = lockInfo && lockInfo.user !== myName
    ? `<div style="position:absolute;top:0;left:0;right:0;background:rgba(0,0,0,.55);color:#fff;font-size:.65rem;font-weight:700;padding:2px 6px;border-radius:6px 6px 0 0;pointer-events:none">🖊 ${esc(lockInfo.user)} 편집 중</div>`
    : '';

  const actions = `<div class="card-actions" onclick="event.stopPropagation()">
    <button class="card-act-btn" title="편집"    onclick="openEditModal('${eattr(item.key)}')">✏</button>
    <button class="card-act-btn" title="복제"    onclick="duplicateItem('${eattr(item.key)}')">⧉</button>
  </div>`;
  const extraClass   = overrides.extraClass  ? ' ' + overrides.extraClass : '';
  const idAttr       = overrides.id          ? ` id="${overrides.id}"` : '';
  const dragStart    = overrides.ondragstart ?? `onDS(event,'${eattr(item.key)}')`;
  const dragEnd      = overrides.ondragend   ?? 'onDEnd(event)';
  const clickHandler = overrides.onclick     ?? `openEditOrMd('${eattr(item.key)}')`;
  const dblClick     = overrides.ondblclick  ? ` ondblclick="${overrides.ondblclick}"` : '';
  const canDrag = isEditor();
  return `<div class="mitem${isDel?' item-del':''}${lockInfo && lockInfo.user !== myName ? ' item-locked' : ''}${extraClass}" draggable="${canDrag}" data-key="${eattr(item.key)}"${idAttr}
    style="${css}${delay}"
    ondragstart="${canDrag ? dragStart : ''}" ondragend="${canDrag ? dragEnd : ''}"
    onmouseover="startTT(event,'${eattr(item.key)}')" onmouseout="clearTT()"
    onclick="${clickHandler}"${dblClick}
    oncontextmenu="openCtxMenu(event,'${eattr(item.key)}')">${lockBadge}${actions}
  <div class="item-hd">
    <span class="item-key">${esc(item.key)}</span>
    ${item.isImportant==='Y'&&S.display.showStar ? '<span class="item-star">★</span>' : ''}
    ${isNew&&S.display.showNewBadge ? '<span class="item-nbadge">N</span>' : ''}
    ${mdBadge}${statusHtml}
  </div>
  <div class="item-name" style="${delStyle}">${nameHl}</div>
  ${ownerHtml}${updatedHtml}
</div>`;
}

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
  const bar = document.getElementById('bulkBar');
  if (!bar) return;
  const n = bulkSel.keys.size;
  if (n === 0) { bar.style.display = 'none'; return; }
  const adminOk = typeof isAdmin === 'function' ? isAdmin() : true;
  const lockStyle = adminOk ? '' : 'opacity:.45;pointer-events:none;';
  const lockTip   = adminOk ? '' : ' title="관리자 전용"';
  bar.style.display = 'flex';
  bar.innerHTML = `<span style="font-size:.8rem;font-weight:600">${n}개 선택됨</span>
    <div style="display:flex;gap:5px;align-items:center;margin-left:8px;${lockStyle}">
      <span style="font-size:.75rem;color:var(--text-2)">우선순위:</span>
      <button class="rbtn" onclick="bulkSetPrio('상')"${lockTip}>상</button>
      <button class="rbtn" onclick="bulkSetPrio('중')"${lockTip}>중</button>
      <button class="rbtn" onclick="bulkSetPrio('하')"${lockTip}>하</button>
      <span style="font-size:.75rem;color:var(--text-2);margin-left:6px">담당:</span>
      <input id="bulkOwnerInp" class="inp" style="width:90px;height:27px;padding:0 7px;font-size:.78rem" placeholder="이름 입력"${adminOk ? '' : ' disabled'}>
      <button class="rbtn" onclick="bulkSetOwner()"${lockTip}>일괄변경</button>
    </div>
    <button class="rbtn" style="margin-left:8px;color:var(--danger)" onclick="bulkClear()">선택 해제</button>`;
}
export function bulkClear() { bulkSel.keys.clear(); renderBulkBar(); renderList(); }

export function renderList() {
  const items = getFiltered(), el = document.getElementById('listView');
  if (!items.length) { el.innerHTML = '<div class="empty"><div style="font-size:.875rem">표시할 기능이 없습니다.</div></div>'; bulkSel.keys.clear(); renderBulkBar(); return; }
  const vcols    = getVisibleCols();
  const sorted   = items.slice().sort((a,b) => { const va=a[S.sort.key]||'', vb=b[S.sort.key]||''; const r=va<vb?-1:va>vb?1:0; return S.sort.dir==='asc'?r:-r; });
  const useShimmer = animOk('shimmer'), useRow = animOk('card') && _cardAnimEnabled;
  const allChecked = sorted.length > 0 && sorted.every(it => bulkSel.keys.has(it.key));
  let h = '<div class="ltbl-wrap"><div class="ltbl-scroll"><table class="ltbl"><thead><tr>';
  h += `<th style="width:32px;text-align:center"><input type="checkbox" ${allChecked?'checked':''} onchange="bulkToggleAll(this.checked)" title="전체 선택"></th>`;
  vcols.forEach(col => {
    const sc = S.sort.key===col.key ? (S.sort.dir==='asc'?' sa':' sd') : '';
    h += `<th class="${sc.trim()}" onclick="sortL('${col.key}')">${FLABELS[col.key]}</th>`;
  });
  h += `<th>작업</th></tr></thead><tbody${useRow?' class="anim-list-row"':''}>`;
  sorted.forEach((it, ri) => {
    const rc      = it.isDelete==='Y' ? ' rdel' : '';
    const shimCls = useShimmer ? ' shimmer-row' : '';
    const delay   = useRow ? `style="animation-delay:${ri*18}ms"` : '';
    const chk     = bulkSel.keys.has(it.key);
    h += `<tr class="${rc.trim()}${shimCls}${chk?' bulk-selected':''}" ${delay}>`;
    h += `<td style="text-align:center"><input type="checkbox" ${chk?'checked':''} onchange="bulkToggle('${eattr(it.key)}');renderList()"></td>`;
    vcols.forEach(col => { h += renderListCell(it, col.key); });
    h += `<td>
      <button class="btn btn-g btn-sm" onclick="openEditModal('${eattr(it.key)}')">편집</button>
      ${it.mdContent ? `<button class="btn btn-g btn-sm" onclick="openMdModal('${eattr(it.key)}')" style="margin-left:3px">MD</button>` : ''}
    </td>`;
    h += '</tr>';
  });
  h += '</tbody></table></div></div>';
  el.innerHTML = h;
  _cardAnimEnabled = false;
}

function renderListCell(it, key) {
  const q = S.searchQ;
  const ppill = p => `<span class="pp ${p==='상'?'h':p==='중'?'m':'l'}">${esc(p)}</span>`;
  switch(key) {
    case 'key':        return `<td class="ck">${q?hlSearch(it.key,q):esc(it.key)}</td>`;
    case 'name':       return `<td class="cn">${q?hlSearch(it.name,q):esc(it.name)}</td>`;
    case 'priority':   return `<td>${ppill(it.priority)}</td>`;
    case 'status':     return `<td>${it.status?`<span class="status-badge ${STATUS_CLS[it.status]||''}">${STATUS_LBL[it.status]||esc(it.status)}</span>`:''}</td>`;
    case 'isImportant':return `<td style="text-align:center">${it.isImportant==='Y'?'<span style="color:var(--accent)">★</span>':''}</td>`;
    case 'isDelete':   return `<td style="text-align:center">${it.isDelete==='Y'?'<span style="color:var(--danger);font-size:.7rem;font-weight:700">삭제</span>':''}</td>`;
    case 'owner':      return `<td>${q ? hlSearch(normOwner(it.owner), q) : esc(normOwner(it.owner))}</td>`;
    case 'desc': case 'memo': {
      const txt = (it[key]||'').replace(/\n/g,' ');
      const disp = txt.length > 60 ? txt.slice(0,60) + '…' : txt;
      return `<td class="desc-cell" title="${eattr(it[key]||'')}">${q ? hlSearch(disp, q) : esc(disp)}</td>`;
    }
    default: return `<td>${q ? hlSearch(it[key]||'', q) : esc(it[key]||'')}</td>`;
  }
}

export function sortL(k) {
  if (S.sort.key === k) S.sort.dir = S.sort.dir === 'asc' ? 'desc' : 'asc';
  else { S.sort.key = k; S.sort.dir = 'asc'; }
  renderList();
}

export function switchView(v) {
  if (v !== 'matrix') mxClearSel();
  S.view = v;
  syncLayout();
  if (v === 'matrix') { document.getElementById('bulkBar').style.display = 'none'; renderMatrix(); }
  else if (v === 'list') renderList();
  else if (v === 'board') { document.getElementById('bulkBar').style.display = 'none'; if (window.renderBoard) window.renderBoard(); }
  else { document.getElementById('bulkBar').style.display = 'none'; if (window.renderDashboard) window.renderDashboard(); }
}

/* ── 필터 UI ── */
export function renderPrioChips() {
  const el = document.getElementById('prioChips');
  if (!el) return;
  const c = getColors();
  el.innerHTML = [{val:'상',pk:'high'},{val:'중',pk:'mid'},{val:'하',pk:'low'}].map(pd => {
    const ck  = S.filters.priorities.includes(pd.val);
    const pkC = pd.pk[0].toUpperCase() + pd.pk.slice(1);
    const col = c[`p${pkC}`]   || '#888';
    const bg  = c[`p${pkC}Bg`] || '#eee';
    const style = ck
      ? `color:${col};background:${bg};border-color:${col};border-width:2px;`
      : `color:var(--text-2);background:var(--surface-2);border-color:var(--border-2);`;
    return `<label class="pchip" style="${style}"><input type="checkbox" value="${pd.val}" ${ck?'checked':''} onchange="onPrioChip(this)">${pd.val}</label>`;
  }).join('');
}

export function renderStatusChips() {
  const el = document.getElementById('statusChips');
  if (!el) return;
  const counts = {};
  S.items.forEach(it => {
    if (it.status) counts[it.status] = (counts[it.status] || 0) + 1;
  });
  el.innerHTML = STATUS_OPTS.map(st => {
    const on  = (S.filters.statuses||[]).includes(st);
    const { col, bg } = STATUS_CHIP_COLORS[st] || { col:'#888', bg:'#eee' };
    const style = on
      ? `color:${col};background:${bg};border-color:${col};`
      : `color:${col};border-color:var(--border-2);`;
    const cnt = counts[st] || 0;
    return `<label class="pchip" style="${style}font-size:.7rem;cursor:pointer;margin-bottom:3px">
      <input type="checkbox" value="${st}" ${on?'checked':''} style="position:absolute;opacity:0;width:0;height:0" onchange="onStatusChipCb(this)">
      ${st}${cnt ? `<span style="font-size:.6rem;opacity:.7;margin-left:3px">${cnt}</span>` : ''}
    </label>`;
  }).join('');
}

export function renderOwnerChips() {
  const el = document.getElementById('ownerChips');
  if (!el) return;
  el.innerHTML = getUniqSorted('owner', S.items).map(o => {
    const on    = S.filters.owners.includes(o);
    const color = getOwnerColor(o);
    const dotStyle = `background:${color};width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0`;
    const chipStyle = on
      ? `border-color:${color};color:${color};background:var(--surface);`
      : '';
    return `<label class="owner-chip${on?' chip-on':''}" style="${chipStyle}"><input type="checkbox" value="${eattr(o)}" ${on?'checked':''} onchange="onOwnerChip(this)"><span style="${dotStyle}"></span>${esc(o)}</label>`;
  }).join('');
}

export function updateDL() {
  const setDL = (id, vals) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = vals.map(v => `<option value="${eattr(v)}">`).join('');
  };
  setDL('dlGroup',    getUniqSorted('group',        S.items));
  setDL('dlSubGroup', getUniqSorted('subGroup',     S.items));
  setDL('dlCat',      getUniqSorted('category',     S.items));
  setDL('dlSubCat',   getUniqSorted('subCategory',  S.items));
  setDL('dlOwner',    getUniqSorted('owner',        S.items));
}
