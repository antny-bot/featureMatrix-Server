/* ══════════════════════════════════════════
   board.js — 보드(칸반) 뷰

   Phase 4: 선택 상태(_boardSel) → Zustand store(boardSel)로 전환.
   renderBoard / renderBoardActionBar → BoardView.jsx React 포털로 이관.
   드래그 상태(_dragKey)는 모듈 변수로 유지 (드래그 중 re-render 방지).
══════════════════════════════════════════ */

import { S, esc, eattr, save, pushUndo, pushChangeLog } from './state.js';
import { STATUS_OPTS, STATUS_LBL } from './constants.js';
import { renderAll } from './render.js';
import { setStore, getStore } from '../store/useAppStore.js';

/* ── 드래그 상태 (모듈 스코프 유지) ── */
let _dragKey = null;

/* ── boardSel 헬퍼 ── */
function getSel()       { return new Set(getStore().boardSel ?? []); }
function setSel(newSet) { setStore({ boardSel: [...newSet] }); }

/* ── 선택: Shift → 다중 토글, 일반 클릭 → 단일 선택 ── */
export function boardCardClick(e, key) {
  const sel = getSel();
  if (e.shiftKey) {
    if (sel.has(key)) sel.delete(key); else sel.add(key);
  } else {
    sel.clear();
    sel.add(key);
  }
  setSel(sel);
}

export function boardCardDblClick(key) {
  setSel(new Set());
  window.openEditModal?.(key);
}

/* ── 카드 이동 공통 ── */
function _moveItems(keys, toStatus) {
  if (!window.isEditor?.()) { window.__sobukNotify?.('편집 권한이 없습니다.', true); return; }
  pushUndo();
  S.items.forEach(it => {
    if (keys.has(it.key)) {
      it.status = toStatus;
      pushChangeLog('상태변경', it.key, it.name, { status: toStatus, owner: it.owner });
    }
  });
  setSel(new Set());
  save();
  renderAll();
}

export function boardMoveSelected(toStatus) {
  const sel = getSel();
  if (sel.size === 0) return;
  _moveItems(sel, toStatus);
}

/* ── 선택 초기화 ── */
export function hideBoardActionBar() { setSel(new Set()); }
export function boardClearSel()      { setSel(new Set()); }

/* ── 드래그 앤 드롭 ── */
export function boardCardDragStart(e, key) {
  _dragKey = key;
  e.dataTransfer.effectAllowed = 'move';
  const sel = getSel();
  if (sel.size > 0 && !sel.has(key)) {
    sel.clear();
    sel.add(key);
    setSel(sel);
  } else if (sel.size === 0) {
    sel.add(key);
    setSel(sel);
  }
  /* dragging 클래스: React re-render 이후에 붙여야 유지됨 */
  setTimeout(() => {
    const latest = getSel();
    latest.forEach(k => document.getElementById('bcard-' + k)?.classList.add('dragging'));
  }, 30);
}

export function boardCardDragEnd() {
  _dragKey = null;
  document.querySelectorAll('.board-card.dragging, .mitem.dragging')
    .forEach(el => el.classList.remove('dragging'));
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
  const sel = getSel();
  _moveItems(sel.size > 0 ? sel : new Set([_dragKey]), colKey);
}
