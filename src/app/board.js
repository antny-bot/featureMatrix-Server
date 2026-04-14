/* ══════════════════════════════════════════
   board.js — 보드(칸반) 뷰

   Phase 4: 선택 상태(_boardSel) → Zustand store(boardSel)로 전환.
   renderBoard / renderBoardActionBar → BoardView.jsx React 포털로 이관.
   드래그 상태(_dragKey)는 모듈 변수로 유지 (드래그 중 re-render 방지).
══════════════════════════════════════════ */

import { S, save, pushUndo, pushChangeLog, lockItem, unlockItem, logActivity, notify } from './state.js';
import { STATUS_OPTS } from './constants.js';
import { renderAll } from './render.js';
import { emitSave } from './socket.js';
import { getStore } from '../store/useAppStore.js';

/* ── 드래그/선택 상태 (모듈 스코프 — Zustand 리렌더 없이 드래그 이벤트 체인 유지) ── */
let _dragKey  = null;
let _boardSel = new Set();

function notifySel() {
  window.dispatchEvent(new CustomEvent('boardSelChange', { detail: { sel: [..._boardSel] } }));
}

function notifyDrag(keys = []) {
  window.dispatchEvent(new CustomEvent('boardDragState', { detail: { keys: [...keys] } }));
}


function currentUser() {
  return S.settings.userName || '익명';
}

function getLockedByOther(keys) {
  const locks = getStore().editLocks || {};
  const user = currentUser();
  return [...keys].filter(key => locks[key] && locks[key].user !== user);
}

function lockKeys(keys) {
  if (S.settings.storageMode !== 'server') return;
  keys.forEach(key => lockItem(key));
}

function unlockKeys(keys) {
  if (S.settings.storageMode !== 'server') return;
  keys.forEach(key => unlockItem(key));
}

function broadcastItemSaved(item) {
  if (S.settings.storageMode !== 'server' || !item) return;
  emitSave(item.key, currentUser(), { ...item });
}

/* ── 선택: Shift → 다중 토글, 일반 클릭 → 단일 선택 ── */
/* mxCardClick 패턴과 동일: _boardSel 모듈 변수 업데이트 + notifySel().
   BoardView.jsx가 selSet으로 extraClass를 적용하므로 DOM classList 조작 불필요. */
export function boardCardClick(e, key) {
  if (e.shiftKey) {
    if (_boardSel.has(key)) _boardSel.delete(key);
    else                    _boardSel.add(key);
  } else {
    _boardSel.clear();
    _boardSel.add(key);
  }
  notifySel();
}

export function boardCardDblClick(key) {
  _boardSel.clear();
  notifySel();
  window.openEditModal?.(key);
}

/* ── 카드 이동 공통 ── */
function _moveItems(keys, toStatus, { lockBeforeMove = true } = {}) {
  if (!window.isEditor?.()) { window.__sobukNotify?.('편집 권한이 없습니다.', true); return; }
  const lockedKeys = getLockedByOther(keys);
  if (lockedKeys.length) {
    const locks = getStore().editLocks || {};
    const lockedBy = locks[lockedKeys[0]]?.user || '다른 사용자';
    notify(`${lockedBy}님이 편집 중인 항목은 이동할 수 없습니다.`, 'warning');
    return;
  }
  if (lockBeforeMove) lockKeys(keys);
  pushUndo();
  const movedItems = [];
  S.items.forEach(it => {
    if (keys.has(it.key)) {
      const fromStatus = it.status || '';
      it.status = toStatus;
      if (fromStatus !== toStatus) {
        pushChangeLog('상태변경', it.key, it.name, { status: toStatus, owner: it.owner });
        logActivity('이동', `${it.key} ${it.name}: ${fromStatus || '상태없음'} → ${toStatus || '상태없음'}`);
      }
      movedItems.push(it);
    }
  });
  _boardSel.clear();
  notifySel();
  _dragKey = null;
  notifyDrag();
  save();
  movedItems.forEach(item => {
    broadcastItemSaved(item);
    unlockItem(item.key);
  });
  renderAll();
}

export function boardMoveSelected(toStatus) {
  if (_boardSel.size === 0) return;
  _moveItems(new Set(_boardSel), toStatus);
}

/* ── 선택 초기화 ── */
export function hideBoardActionBar() { _boardSel.clear(); notifySel(); }
export function boardClearSel()      { _boardSel.clear(); notifySel(); }

/* ── 드래그 앤 드롭 ── */
export function boardCardDragStart(e, key) {
  _dragKey = key;
  e.dataTransfer.effectAllowed = 'move';
  if (_boardSel.size > 0 && !_boardSel.has(key)) {
    _boardSel.clear();
    _boardSel.add(key);
    notifySel();
  } else if (_boardSel.size === 0) {
    _boardSel.add(key);
    notifySel();
  }
  const lockedKeys = getLockedByOther(_boardSel);
  if (lockedKeys.length) {
    const locks = getStore().editLocks || {};
    const lockedBy = locks[lockedKeys[0]]?.user || '다른 사용자';
    notify(`${lockedBy}님이 편집 중인 항목은 이동할 수 없습니다.`, 'warning');
    e.preventDefault();
    _dragKey = null;
    return;
  }
  lockKeys(_boardSel);
  notifyDrag(_boardSel);
}

export function boardCardDragEnd() {
  const keys = _boardSel.size > 0 ? new Set(_boardSel) : (_dragKey ? new Set([_dragKey]) : new Set());
  unlockKeys(keys);
  _dragKey = null;
  notifyDrag();
}

export function boardDragOver(e, colKey) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

export function boardDragLeave(_e, colKey) {
}

export function boardDrop(e, colKey) {
  e.preventDefault();
  if (!_dragKey) { notifyDrag(); return; }
  _moveItems(_boardSel.size > 0 ? new Set(_boardSel) : new Set([_dragKey]), colKey, { lockBeforeMove: false });
}
