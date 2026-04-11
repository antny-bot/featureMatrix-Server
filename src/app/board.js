/* ══════════════════════════════════════════
   board.js — 보드(칸반) 뷰
══════════════════════════════════════════ */

import { S, esc, eattr, normOwner, getOwnerColor, save, pushUndo } from './state.js';
import { STATUS_OPTS, STATUS_LBL, STATUS_ACCENT } from './constants.js';
import { openEditModal } from './modal.js';
import { renderAll, getFiltered, isFilterActive } from './render.js';

let _boardSel = new Set();
let _dragKey  = null;

/* ── 보드 렌더링 ── */
export function renderBoard() {
  const el = document.getElementById('boardView');
  if (!el) return;

  const items = isFilterActive() ? getFiltered() : S.items.filter(it => it.isDelete !== 'Y');

  const byCol = Object.fromEntries(STATUS_OPTS.map(k => [k, []]));
  items.forEach(it => {
    if (byCol[it.status]) byCol[it.status].push(it);
    else byCol['대기'].push(it);
  });

  el.innerHTML = `
    <div class="board-cols">
      ${STATUS_OPTS.map(colKey => `
        <div class="board-col">
          <div class="board-col-hd" style="border-top:3px solid ${STATUS_ACCENT[colKey]}">
            <span>${esc(colKey)}<span class="board-col-cnt">${byCol[colKey].length}</span></span>
          </div>
          <div class="board-col-body"
            id="bbody-${eattr(colKey)}"
            ondragover="boardDragOver(event,'${eattr(colKey)}')"
            ondragleave="boardDragLeave(event,'${eattr(colKey)}')"
            ondrop="boardDrop(event,'${eattr(colKey)}')">
            ${byCol[colKey].map(it => renderBoardCard(it)).join('')}
          </div>
        </div>
      `).join('')}
    </div>`;

  renderBoardActionBar();
}

function renderBoardCard(it) {
  const sel   = _boardSel.has(it.key);
  const owner = normOwner(it.owner);
  const ownerHtml = owner
    ? `<span class="owner-dot" style="background:${getOwnerColor(owner)}"></span><span style="font-size:.6rem;color:var(--text-3)">${esc(owner)}</span>`
    : '';
  const pColor = { '상':'var(--p-high,var(--danger))', '중':'var(--p-mid,var(--accent))', '하':'var(--text-3)' }[it.priority] || 'var(--text-3)';
  const metaHtml = (it.group || ownerHtml)
    ? `<div class="board-card-meta">
        ${it.group ? `<span class="board-card-group">${esc(it.group)}${it.subGroup ? ' / ' + esc(it.subGroup) : ''}</span>` : ''}
        ${ownerHtml}
       </div>`
    : '';
  return `
    <div class="board-card${sel ? ' selected' : ''}"
      id="bcard-${eattr(it.key)}"
      draggable="true"
      onclick="boardCardClick(event,'${eattr(it.key)}')"
      ondblclick="boardCardDblClick('${eattr(it.key)}')"
      ondragstart="boardCardDragStart(event,'${eattr(it.key)}')"
      ondragend="boardCardDragEnd(event)">
      <div class="board-card-key">${esc(it.key)}${it.priority ? `<span style="color:${pColor};font-weight:700;margin-left:4px">${esc(it.priority)}</span>` : ''}</div>
      <div class="board-card-name">${esc(it.name)}</div>
      ${metaHtml}
    </div>`;
}

/* ── 선택: Shift → 다중, 일반 클릭 → 토글 단일 ── */
export function boardCardClick(e, key) {
  if (e.shiftKey) {
    const card = document.getElementById('bcard-' + key);
    if (_boardSel.has(key)) { _boardSel.delete(key); card?.classList.remove('selected'); }
    else                    { _boardSel.add(key);    card?.classList.add('selected');    }
  } else {
    _boardSel.forEach(k => document.getElementById('bcard-' + k)?.classList.remove('selected'));
    _boardSel.clear();
    if (!e.defaultPrevented) {
      _boardSel.add(key);
      document.getElementById('bcard-' + key)?.classList.add('selected');
    }
  }
  renderBoardActionBar();
}

export function boardCardDblClick(key) {
  _boardSel.clear();
  openEditModal(key);
}

/* ── 카드 이동 공통 ── */
function _moveItems(keys, toStatus) {
  pushUndo();
  S.items.forEach(it => { if (keys.has(it.key)) it.status = toStatus; });
  _boardSel.clear();
  save();
  renderAll();
}

export function boardMoveSelected(toStatus) {
  if (_boardSel.size === 0) return;
  _moveItems(_boardSel, toStatus);
}

/* ── 하단 액션 바 ── */
export function renderBoardActionBar() {
  const bar = document.getElementById('boardActionBar');
  if (!bar) return;
  if (_boardSel.size === 0) {
    bar.classList.remove('on');
    bar.innerHTML = '';
    return;
  }
  bar.classList.add('on');
  bar.innerHTML = `
    <span>${_boardSel.size}개 선택</span>
    ${STATUS_OPTS.map(st => `<button onclick="boardMoveSelected('${eattr(st)}')">${esc(STATUS_LBL[st])}</button>`).join('')}
    <button class="bar-close" onclick="boardClearSel()">✕</button>`;
}

export function hideBoardActionBar() {
  _boardSel.clear();
  const bar = document.getElementById('boardActionBar');
  if (bar) { bar.classList.remove('on'); bar.innerHTML = ''; }
}

export function boardClearSel() {
  _boardSel.forEach(k => document.getElementById('bcard-' + k)?.classList.remove('selected'));
  _boardSel.clear();
  renderBoardActionBar();
}

/* ── 드래그 앤 드롭 ── */
export function boardCardDragStart(e, key) {
  _dragKey = key;
  e.dataTransfer.effectAllowed = 'move';
  if (_boardSel.size > 0 && !_boardSel.has(key)) {
    _boardSel.forEach(k => document.getElementById('bcard-' + k)?.classList.remove('selected'));
    _boardSel.clear();
    _boardSel.add(key);
    document.getElementById('bcard-' + key)?.classList.add('selected');
  } else if (_boardSel.size === 0) {
    _boardSel.add(key);
  }
  setTimeout(() => {
    _boardSel.forEach(k => document.getElementById('bcard-' + k)?.classList.add('dragging'));
  }, 0);
}

export function boardCardDragEnd() {
  _dragKey = null;
  document.querySelectorAll('.board-card.dragging').forEach(c => c.classList.remove('dragging'));
}

export function boardDragOver(e, colKey) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.getElementById('bbody-' + colKey)?.classList.add('drag-over');
}

export function boardDragLeave(_e, colKey) {
  document.getElementById('bbody-' + colKey)?.classList.remove('drag-over');
}

export function boardDrop(e, colKey) {
  e.preventDefault();
  document.getElementById('bbody-' + colKey)?.classList.remove('drag-over');
  if (!_dragKey) return;
  _moveItems(_boardSel.size > 0 ? _boardSel : new Set([_dragKey]), colKey);
}
