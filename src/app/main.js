/* ══════════════════════════════════════════
   main.js — 초기화, 키보드, 필터 이벤트, window 바인딩
══════════════════════════════════════════ */

import 'drag-drop-touch'; // 터치 디바이스 드래그앤드롭 폴리필
import { DEMO } from './constants.js';
import { S, save, load, doUndo, updateUndoFab, pushUndo, genKey,
         pollServerTs, lastServerTs, resolveConflictKeepMine, resolveConflictUseServer,
         loadFromServer, saveToServer, logActivity, notify, fmtDate,
         lockItem, unlockItem, updateLocks, editLocks } from './state.js';
import { initSocket, disconnectSocket, isSocketConnected } from './socket.js';
import { setStore } from '../store/useAppStore.js';
import { isAdmin, isEditor, requireAdmin, requireEditor,
         openLoginModal, closeLoginModal, submitLogin,
         adminLogout, logout, updateAdminUI, getAdminToken, getEditorToken,
         setEditorPassword } from './admin.js';
import { applyVars, applyBlurSetting, toggleTheme, applyTheme,
         renderThemeGrid, renderPrioStyleRows, renderPreviewCards,
         updateDesignContent, setPreset, setCustomColor,
         onCP, onHex, onHexKey, adjBW } from './theme.js';
import { renderAll, renderStats, renderMatrix, renderList,
         renderOwnerChips, renderPrioChips, renderStatusChips,
         switchView, sortL, expandCell, collapseCell,
         bulkToggle, bulkToggleAll, bulkClear, renderBulkBar, bulkSel,
         scheduleCardAnim, mxCardClick, mxClearSel } from './render.js';
import { openModal, closeModal, openEditModal, openAddModal, openAddInCell,
         saveItem, hardDelete, duplicateItem, quickToggleDel,
         openEditOrMd, openMdModal, copyPath,
         switchEditTab, switchMdView, onMdInput, expSingleMd, impSingleMd,
         startTT, clearTT, onDS, onDEnd, onDE, onDO, onDL, onDrop,
         openCtxMenu, openStatusMenu, setItemStatus,
         mdInsert, mdInsertLine } from './modal.js';
import { expClip, expTSV, expXLS, expHTML, expMdZip, impMdFiles,
         dzOver, dzLeave, dzDrop, csvFileSel, analyzeCSV, backToStep1, doImport,
         expFullJSON, impFullJSON } from './io.js';
import { boardCardClick, boardCardDblClick,
         boardMoveSelected, hideBoardActionBar, boardClearSel,
         boardCardDragStart, boardCardDragEnd,
         boardDragOver, boardDragLeave, boardDrop } from './board.js';
import { sstab, syncSettingsUI, previewTitle, setMW, setPPos,
         adjFont, adjCardFont, adjRadius, adjGap, adjColW, adjCatW, adjSubCatW, adjCellFold,
         adjChangeLogMax, adjBoardFoldCount,
         onAnimTgl, syncAnimUI, renderColEditor, toggleColVisible,
         colDragStart, colDragOver, colDragLeave, colDrop, colDragEnd, resetListCols,
         renderAxisEditor, axisDragStart, axisDragOver, axisDragLeave, axisDrop, axisDragEnd, resetAxisOrder,
         expSettJSON, impSettJSON, resetData, resetSettings } from './settings.js';

/* ── window 바인딩 ── */
Object.assign(window, {
  doUndo,
  toggleTheme, applyTheme, setPreset, setCustomColor, onCP, onHex, onHexKey, adjBW,
  renderPrioStyleRows, renderPreviewCards, updateDesignContent, renderThemeGrid,
  renderAll, switchView, sortL, expandCell, collapseCell,
  mxCardClick, mxClearSel,
  bulkToggle, bulkToggleAll, bulkClear, renderBulkBar,
  openModal, closeModal, openEditModal, openAddModal, openAddInCell,
  saveItem, hardDelete, duplicateItem, quickToggleDel,
  openEditOrMd, openMdModal, copyPath,
  switchEditTab, switchMdView, onMdInput, expSingleMd, impSingleMd,
  startTT, clearTT,
  onDS, onDEnd, onDE, onDO, onDL, onDrop,
  openCtxMenu, openStatusMenu, setItemStatus,
  mdInsert, mdInsertLine,
  expClip, expTSV, expXLS, expHTML, expMdZip, impMdFiles,
  dzOver, dzLeave, dzDrop, csvFileSel, analyzeCSV, backToStep1, doImport,
  expFullJSON, impFullJSON,
  sstab, syncSettingsUI, previewTitle, setMW, setPPos,
  adjFont, adjCardFont, adjRadius, adjGap, adjColW, adjCatW, adjSubCatW, adjCellFold,
  adjChangeLogMax, adjBoardFoldCount,
  onAnimTgl, syncAnimUI, renderColEditor, toggleColVisible,
  colDragStart, colDragOver, colDragLeave, colDrop, colDragEnd, resetListCols,
  renderAxisEditor, axisDragStart, axisDragOver, axisDragLeave, axisDrop, axisDragEnd, resetAxisOrder,
  expSettJSON, impSettJSON, resetData, resetSettings,
  boardCardClick, boardCardDblClick,
  boardMoveSelected, hideBoardActionBar, boardClearSel,
  boardCardDragStart, boardCardDragEnd,
  boardDragOver, boardDragLeave, boardDrop,
  isAdmin, isEditor, requireAdmin, requireEditor,
  openLoginModal, closeLoginModal, submitLogin,
  adminLogout, logout, updateAdminUI, getAdminToken, getEditorToken,
  setEditorPassword,
});

/* ── AuthContext용 S 브릿지 ── */
window.__S = S;

/* ── notify 인라인 ── */
window.__sobukRenderAll = () => renderAll();
/** @param {string} msg @param {boolean|'success'|'warning'|'error'} type */
window.__sobukNotify = (msg, type = false) => {
  const el = document.getElementById('notif');
  if (!el) return;
  el.textContent = msg;
  const bgMap = {
    error:   'var(--danger)',
    warning: 'var(--warning, #D97706)',
    success: 'var(--success, #16A34A)',
  };
  // 하위 호환: true → error
  const key = type === true ? 'error' : type;
  el.style.background = bgMap[key] || 'var(--text)';
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), 2400);
};

/* ── 검색 ── */
window.onSearch = q => {
  S.searchQ = q.trim();
  setStore({ searchQ: S.searchQ });
  renderAll(true);
};
window.clearSearch = () => window.onSearch('');

/* ── 필터 이벤트 ── */
window.onPrioChip = inp => {
  const val = inp.value, idx = S.filters.priorities.indexOf(val);
  if (inp.checked && idx === -1) S.filters.priorities.push(val);
  else if (!inp.checked && idx !== -1) S.filters.priorities.splice(idx, 1);
  save(); renderAll(true);
};

window.onStatusChipCb = inp => {
  if (!S.filters.statuses) S.filters.statuses = [];
  const val = inp.value, idx = S.filters.statuses.indexOf(val);
  if (inp.checked && idx === -1) S.filters.statuses.push(val);
  else if (!inp.checked && idx !== -1) S.filters.statuses.splice(idx, 1);
  save(); renderAll(true);
};

window.onOwnerChip = inp => {
  const val = inp.value, idx = S.filters.owners.indexOf(val);
  if (inp.checked && idx === -1) S.filters.owners.push(val);
  else if (!inp.checked && idx !== -1) S.filters.owners.splice(idx, 1);
  save(); renderAll(true);
};

window.applyFilters = () => {
  save(); renderAll(true);
};

window.resetFilters = () => {
  S.filters = {priorities:[], statuses:[], showDeleted:false, importantOnly:false, owners:[]};
  save(); renderAll(true);
};

window.onDispTgl = () => {
  save(); renderAll();
};

window.bulkSetPrio = val => {
  if (!bulkSel.keys.size) return;
  requireAdmin(() => {
    pushUndo();
    const keys = [...bulkSel.keys];
    keys.forEach(k => { const it = S.items.find(i => i.key === k); if (it) it.priority = val; });
    logActivity('일괄변경', `우선순위→${val} (${keys.join(', ')})`);
    save(); renderList(); renderBulkBar();
  });
};

window.bulkSetOwner = () => {
  const inp = document.getElementById('bulkOwnerInp');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;
  requireAdmin(() => {
    const keys = [...bulkSel.keys];
    keys.forEach(k => { const it = S.items.find(i => i.key === k); if (it) it.owner = val; });
    logActivity('일괄변경', `담당→${val} (${keys.join(', ')})`);
    save(); renderList(); renderBulkBar();
  });
};

window.openDiffModal = () => {
  window.__reactOpenDiffModal?.();
};

window.quickCellAdd = (g, sg, cat, sc, input) => {
  const name = input.value.trim();
  if (!name) { input.value = ''; return; }
  pushUndo();
  const newIt = {
    key: genKey(), name, desc: '', path: '',
    group: g, subGroup: sg, category: cat, subCategory: sc,
    priority: '중', owner: '', isDelete: 'N', isImportant: 'N',
    status: '', relSystem: '', memo: '', mdContent: '', mdPath: '', updatedAt: Date.now()
  };
  S.items.push(newIt);
  save(); input.value = ''; renderMatrix();
};

window.togglePanel = () => {
  S.settings.panelVisible = !S.settings.panelVisible;
  save();
  setStore({ settings: { ...S.settings } });
};

/* ── 키보드 단축키 ── */
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName || '';
  const isInput = ['INPUT','TEXTAREA','SELECT'].includes(tag);

  if (e.key === 'Escape') {
    if (document.getElementById('editModal')?.classList.contains('on')) {
      unlockItem(S.editKey);
    }
    ['editModal','importModal','settingsModal','shortcutsModal','userNameModal','adminAuthModal','diffModal'].forEach(closeModal);
    clearTT(); window.closeCtxMenu?.(); mxClearSel(); return;
  }
  if (e.key === '/' && !isInput) { e.preventDefault(); window.__focusSearch?.(); return; }
  if (isInput) return;

  if (e.ctrlKey || e.metaKey) {
    if (e.key==='i'||e.key==='I') { e.preventDefault(); openModal('importModal'); return; }
    if (e.key==='e'||e.key==='E') { e.preventDefault(); openModal('exportModal'); return; }
    if (e.key===',')              { e.preventDefault(); openModal('settingsModal'); syncSettingsUI(); return; }
    if (e.key==='s'||e.key==='S') { e.preventDefault(); expSettJSON(); return; }
    return;
  }
  if (e.key==='n'||e.key==='N') openAddModal();
  if (e.key==='f'||e.key==='F') window.togglePanel();
  if (e.key==='d'||e.key==='D') switchView('dashboard');
  if (e.key==='m'||e.key==='M') switchView('matrix');
  if (e.key==='b'||e.key==='B') switchView('board');
  if (e.key==='l'||e.key==='L') switchView('list');
  if (e.key==='z'||e.key==='Z') doUndo();
  if (e.key==='?')              openModal('shortcutsModal');
});

document.querySelectorAll('.ov').forEach(ov => {
  ov.addEventListener('click', e => {
    if (e.target !== ov) return;
    if (ov.id === 'editModal') {
      // 편집 모달 외부 클릭 → 자동 저장
      const name = window.__editModalGetForm?.().name?.trim();
      if (name) {
        saveItem(); // 기능명 있으면 저장 후 닫힘
      } else {
        unlockItem(S.editKey);
        ov.classList.remove('on');
      }
    } else {
      ov.classList.remove('on');
    }
  });
});

/* ── WebSocket 브릿지 콜백 ── */
// socket.js에서 서버 이벤트 수신 시 호출됨
window.__onLocksChanged = () => {
  if (S.view !== 'dashboard') renderAll();
};
window.__onLockDenied = (key, lockedBy) => {
  notify(`🔒 ${lockedBy}님이 편집 중입니다. 잠시 후 다시 시도하세요.`, 'warning');
};
window.__onItemSaved = (key, user, item) => {
  if (item && key) {
    const idx = S.items.findIndex(it => it.key === key);
    if (idx === -1) S.items.push(item);
    else S.items[idx] = { ...S.items[idx], ...item };
    setStore({ items: S.items });
  }
  renderAll();
};
window.__onPreviewChanged = () => {
  // 미리보기 변경 시 카드 re-render (렌더 비용 최소화 위해 debounce 없이 직접)
  if (S.view !== 'dashboard') renderAll();
};

/* ── 폴링: 다른 사용자 변경 감지 (WebSocket 폴백) ── */
let _pollTimer = null;
window.addEventListener('beforeunload', () => { if (_pollTimer) clearInterval(_pollTimer); });
function startPolling() {
  // WebSocket 초기화 (서버 모드일 때)
  if (S.settings.storageMode === 'server') {
    initSocket();
  } else {
    disconnectSocket();
  }

  if (_pollTimer) clearInterval(_pollTimer);
  if (S.settings.storageMode !== 'server') return;

  // 폴링은 데이터 변경 감지(업데이트 배너) + WebSocket 폴백용 — 60초 고정
  const interval = 60 * 1000;
  _pollTimer = setInterval(async () => {
    const result = await pollServerTs();
    if (result !== null) {
      setServerStatus('ok');
      // WebSocket이 없을 때만 locks를 polling으로 업데이트
      if (!isSocketConnected() && result.locks) {
        const changed = updateLocks(result.locks);
        if (changed && S.view !== 'dashboard') renderAll();
      }
      if (result.serverTs > lastServerTs) {
        const banner = document.getElementById('updateBanner');
        if (banner) {
          const editor = result.lastEditor || '누군가';
          const ago    = result.lastEditTime ? fmtDate(result.lastEditTime) : '';
          const msgEl  = document.getElementById('updateBannerMsg');
          if (msgEl) msgEl.textContent = `⚠ ${editor}${ago ? ('이' === editor.slice(-1) ? '가' : '이') + ' ' + ago + '에' : '가'} 데이터를 변경했습니다.`;
          banner.classList.add('on');
        }
      }
    } else {
      setServerStatus('error');
    }
  }, interval);
}


window.reloadFromServer = async () => {
  await loadFromServer();
  document.getElementById('updateBanner')?.classList.remove('on');
  S.items.forEach(it => {
    if (it.mdContent === undefined) it.mdContent = '';
    if (it.status    === undefined) it.status    = '';
    if (it.updatedAt === undefined) it.updatedAt = 0;
  });
  applyVars(); applyBlurSetting(); syncSettingsUI(); renderAll();
};

/* ── 서버 설정 저장 ── */
window.saveServerSettings = async (nextSettings = null) => {
  const mode = nextSettings?.storageMode || S.settings.storageMode || 'local';
  S.settings.storageMode  = mode;
  S.settings.serverUrl    = nextSettings?.serverUrl?.trim() || '';
  S.settings.userName     = nextSettings?.userName?.trim() || '';

  if (mode === 'server') {
    notify('서버에 연결 중...');
    // 서버에서 먼저 로드 — 빈 items로 덮어쓰기 방지
    const ok = await loadFromServer();
    if (ok) {
      S.items.forEach(it => {
        if (it.mdContent === undefined) it.mdContent = '';
        if (it.status    === undefined) it.status    = '';
        if (it.updatedAt === undefined) it.updatedAt = 0;
      });
      applyVars(); applyBlurSetting(); syncSettingsUI(); renderAll();
      notify('서버에 연결됐습니다. 데이터를 불러왔습니다.');
    } else {
      // 연결 실패 시 개인 설정만 로컬 저장 (items 서버 전송 안 함)
      notify('서버 연결 실패. URL을 확인하세요.', true);
    }
  } else {
    disconnectSocket(); // 로컬 모드 전환 시 WebSocket 해제
    save();
    notify('로컬 모드로 설정됐습니다.');
  }

  startPolling();
  syncServerSettingsUI();
};

/* ── 사용자 이름 팝업 ── */
function showUserNamePopup() {
  if (S.settings.storageMode !== 'server') return;
  if (S.settings.userName) return; // 이미 이름 있으면 생략
  window.__reactOpenUserNameModal?.();
}

window.syncEditorPwStatus = async () => {
  if (S.settings.storageMode !== 'server') return;
  try {
    const result = await pollServerTs();
    if (result && result.hasEditorPw) {
      window.__reactSetEditorPwPlaceholder?.('새 비밀번호 (비워두면 제거) — 현재 설정됨 ****');
    } else {
      window.__reactSetEditorPwPlaceholder?.('새 비밀번호 (비워두면 비번 없이 편집 가능)');
    }
  } catch(e) {}
};

window.loadInlineActivityLog = async () => {
  await window.__reactLoadInlineActivityLog?.();
};
function setServerStatus(status) {
  const dot   = document.getElementById('serverStatusDot');
  const badge = document.getElementById('storageModeBadge');
  if (!dot) return;
  if (S.settings.storageMode !== 'server') { dot.style.display = 'none'; return; }
  dot.style.display = 'inline-block';
  if (status === 'ok') {
    dot.style.background = '#16a34a';
    dot.title = '서버 연결됨';
    if (badge) badge.style.opacity = '1';
  } else {
    dot.style.background = '#dc2626';
    dot.title = '서버 연결 오류';
    if (badge) badge.style.opacity = '0.7';
  }
}
window.setServerStatus = setServerStatus;

function syncServerSettingsUI() {
  const mode = S.settings.storageMode || 'server';
  const badge  = document.getElementById('storageModeBadge');
  const label  = document.getElementById('serverStatusLabel');
  if (label) label.textContent = mode === 'server' ? '🌐' : '💾';
  if (badge) badge.style.color = mode === 'server' ? 'var(--accent)' : 'var(--text-3)';
  setServerStatus(mode === 'server' ? 'ok' : 'off');
}

/* ── 대시보드 설정 저장/UI 동기화 ── */
window.saveDbSettings = () => {
  S.settings.dbHeroName = document.getElementById('dbHeroName')?.value || '';
  save();
  setStore({ settings: { ...S.settings } });
  if (S.view === 'dashboard' && window.renderDashboard) window.renderDashboard();
};

window.dbSectionMove = (idx, dir) => {
  const secs = [...(S.settings.dbSections || ['stats', 'insight', 'heatmap'])];
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= secs.length) return;
  [secs[idx], secs[newIdx]] = [secs[newIdx], secs[idx]];
  S.settings.dbSections = secs;
  save();
  setStore({ settings: { ...S.settings } });
  if (S.view === 'dashboard' && window.renderDashboard) window.renderDashboard();
};

function renderDbSectionOrder() {
  // React DashboardSectionOrder renders the section list.
}
window.renderDbSectionOrder = renderDbSectionOrder;

/* ── 초기화 ── */
async function init() {
  await load();

  if (!S.items.length && S.settings.storageMode !== 'server') {
    S.items = JSON.parse(JSON.stringify(DEMO));
  }

  S.items.forEach(it => {
    if (it.mdContent  === undefined) it.mdContent  = '';
    if (it.status     === undefined) it.status     = '';
    if (it.updatedAt  === undefined) it.updatedAt  = 0;
  });
  applyVars();
  applyBlurSetting();
  syncSettingsUI();
  syncServerSettingsUI();
  updateAdminUI();
  scheduleCardAnim();
  // 빌드번호 표시 (빌드 시점에 주입된 상수 사용, 런타임 생성 금지)
  (() => {
    const ver = (typeof __APP_VERSION__ !== 'undefined') ? __APP_VERSION__ : 'dev';
    const bid = (typeof __BUILD_ID__    !== 'undefined') ? __BUILD_ID__    : 'local';
    const el = document.getElementById('buildNumberDisplay');
    if (el) el.textContent = `v${ver} (build ${bid})`;
  })();
  S.view = 'dashboard';
  renderAll();
  updateUndoFab();
  startPolling();
  logActivity('접속', `${S.items.length}개 항목`);

  // 서버 모드에서 이름 없으면 팝업
  if (S.settings.storageMode === 'server' && !S.settings.userName) {
    setTimeout(() => window.__reactOpenUserNameModal?.(), 600);
  }

  // 필터 패널 섹션 접기/펼치기
  document.querySelectorAll('#fpanel .fsec-ttl').forEach(ttl => {
    ttl.addEventListener('click', () => ttl.closest('.fsec').classList.toggle('sec-collapsed'));
  });
}
init();

/* ── 사용자 이름 팝업 저장 ── */
window.saveUserNamePopup = (skip = false) => {
  if (!skip) {
    const name = window.__reactGetUserNamePopup?.() || '';
    if (name) {
      S.settings.userName = name;
      save();
      syncServerSettingsUI();
      setStore({ settings: { ...S.settings } });
    }
  }
  closeModal('userNameModal');
};
