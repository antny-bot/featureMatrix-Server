/* ══════════════════════════════════════════
   main.js — 초기화, 키보드, 필터 이벤트, window 바인딩
══════════════════════════════════════════ */

import 'drag-drop-touch'; // 터치 디바이스 드래그앤드롭 폴리필
import { DEMO } from './constants.js';
import { renderDashboard, setHmView } from './dashboard.js';
import { S, save, load, doUndo, updateUndoFab, getUndoHistory, pushUndo, genKey,
         pollServerTs, lastServerTs, resolveConflictKeepMine, resolveConflictUseServer,
         loadFromServer, saveToServer, logActivity, notify, apiFetch, fmtDate,
         lockItem, unlockItem, updateLocks, editLocks } from './state.js';
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
         onAnimTgl, syncAnimUI, renderColEditor, toggleColVisible,
         colDragStart, colDragOver, colDragLeave, colDrop, colDragEnd, resetListCols,
         renderAxisEditor, axisDragStart, axisDragOver, axisDragLeave, axisDrop, axisDragEnd, resetAxisOrder,
         expSettJSON, impSettJSON, resetData, resetSettings } from './settings.js';

/* ── window 바인딩 ── */
Object.assign(window, {
  renderDashboard, setHmView,
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
  document.getElementById('searchClear').className = 'search-clear' + (S.searchQ ? ' on' : '');
  S.expandedCells = new Set();
  renderAll(true);
};
window.clearSearch = () => { document.getElementById('searchInp').value = ''; window.onSearch(''); };

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
  S.filters.showDeleted   = document.getElementById('togDel').checked;
  S.filters.importantOnly = document.getElementById('togImp').checked;
  save(); renderAll(true);
};

window.resetFilters = () => {
  S.filters = {priorities:[], statuses:[], showDeleted:false, importantOnly:false, owners:[]};
  document.getElementById('togDel').checked = false;
  document.getElementById('togImp').checked = false;
  save(); renderAll(true);
};

window.onDispTgl = () => {
  S.display.showOwner     = document.getElementById('togOwner').checked;
  S.display.showStar      = document.getElementById('togStar').checked;
  S.display.showNewBadge  = document.getElementById('togNew').checked;
  S.display.showCellCount = document.getElementById('togCnt').checked;
  S.display.showUpdated   = document.getElementById('togUpd').checked;
  S.display.showStatus    = document.getElementById('togStatus').checked;
  S.display.showMdBadge   = document.getElementById('togMd').checked;
  S.display.showQuickAdd  = document.getElementById('togQuickAdd')?.checked ?? false;
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
  const stack = getUndoHistory();
  const el = document.getElementById('diffModal');
  if (!el) return;
  const body = document.getElementById('diffBody');
  if (!stack.length) {
    body.innerHTML = '<div style="color:var(--text-3);font-size:.85rem;text-align:center;padding:20px">변경 이력이 없습니다.</div>';
    el.classList.add('on'); return;
  }
  const prev = JSON.parse(stack[stack.length - 1]);
  const cur  = S.items;
  const curMap  = {}; cur.forEach(i  => curMap[i.key]  = i);
  const prevMap = {}; prev.forEach(i => prevMap[i.key] = i);
  const rows = [];
  cur.forEach(it => {
    const old = prevMap[it.key];
    if (!old) { rows.push(`<tr><td class="dk">${esc(it.key)}</td><td colspan="3" style="color:var(--success);font-size:.78rem">신규 추가</td></tr>`); return; }
    const diffs = [];
    ['name','priority','status','owner','group','category'].forEach(f => {
      if ((old[f]||'') !== (it[f]||'')) diffs.push(`<span style="color:var(--text-3)">${f}:</span> <s style="color:var(--danger)">${esc(old[f]||'—')}</s> → <b style="color:var(--success)">${esc(it[f]||'—')}</b>`);
    });
    if (diffs.length) rows.push(`<tr><td class="dk" style="vertical-align:top">${esc(it.key)}</td><td style="font-size:.78rem;line-height:1.8">${diffs.join('<br>')}</td></tr>`);
  });
  prev.forEach(it => { if (!curMap[it.key]) rows.push(`<tr><td class="dk">${esc(it.key)}</td><td colspan="3" style="color:var(--danger);font-size:.78rem">삭제됨 (${esc(it.name)})</td></tr>`); });
  body.innerHTML = rows.length
    ? `<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:5px 8px;font-size:.72rem;color:var(--text-3);border-bottom:1px solid var(--border)">Key</th><th style="text-align:left;padding:5px 8px;font-size:.72rem;color:var(--text-3);border-bottom:1px solid var(--border)">변경 내용</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
    : '<div style="color:var(--text-3);font-size:.85rem;text-align:center;padding:20px">마지막 저장 이후 변경 없음</div>';
  el.classList.add('on');
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
  document.getElementById('fpanel').classList.toggle('collapsed', !S.settings.panelVisible);
  save();
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
  if (e.key === '/' && !isInput) { e.preventDefault(); document.getElementById('searchInp').focus(); return; }
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
      const name = document.getElementById('fName')?.value.trim();
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

/* ── 폴링: 다른 사용자 변경 감지 ── */
let _pollTimer = null;
window.addEventListener('beforeunload', () => { if (_pollTimer) clearInterval(_pollTimer); });
function startPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  const interval = (S.settings.pollInterval || 60) * 1000;
  if (S.settings.storageMode !== 'server') return;
  _pollTimer = setInterval(async () => {
    const result = await pollServerTs();
    if (result !== null) {
      setServerStatus('ok');
      // locks 업데이트
      if (result.locks) { const changed = updateLocks(result.locks); if (changed && S.view !== 'dashboard') renderAll(); }
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
window.saveServerSettings = async () => {
  const mode = document.querySelector('input[name="storageMode"]:checked')?.value || 'local';
  S.settings.storageMode  = mode;
  S.settings.serverUrl    = document.getElementById('sServerUrl')?.value.trim() || '';
  S.settings.pollInterval = parseInt(document.getElementById('sPollInterval')?.value || '10', 10) || 10;
  S.settings.userName     = document.getElementById('sUserName')?.value.trim() || '';

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
    save(); // 로컬 모드 전환
    notify('로컬 모드로 설정됐습니다.');
  }

  startPolling();
  syncServerSettingsUI();
};

/* ── 사용자 이름 팝업 ── */
function showUserNamePopup() {
  if (S.settings.storageMode !== 'server') return;
  if (S.settings.userName) return; // 이미 이름 있으면 생략
  const modal = document.getElementById('userNameModal');
  if (modal) {
    document.getElementById('userNamePopupInp').value = '';
    modal.classList.add('on');
    setTimeout(() => document.getElementById('userNamePopupInp').focus(), 120);
  }
}

window.syncEditorPwStatus = async () => {
  const inp = document.getElementById('editorPwInp');
  if (!inp || S.settings.storageMode !== 'server') return;
  try {
    const result = await pollServerTs();
    if (result && result.hasEditorPw) {
      inp.placeholder = '새 비밀번호 (비워두면 제거) — 현재 설정됨 ****';
    } else {
      inp.placeholder = '새 비밀번호 (비워두면 비번 없이 편집 가능)';
    }
  } catch(e) {}
};

window.loadInlineActivityLog = async () => {
  const body = document.getElementById('inlineLogBody');
  if (!body) return;
  body.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-3)">불러오는 중...</div>';
  try {
    const limit = parseInt(document.getElementById('logLimitInp')?.value || '100', 10) || 100;
    const json = await apiFetch(`/api/log?limit=${limit}`);
    if (!json.entries?.length) { body.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-3)">로그가 없습니다.</div>'; return; }
    const actionColor = { '접속':'var(--accent)','추가':'var(--success)','수정':'var(--text)','삭제':'var(--warning)','완전삭제':'var(--danger)','이동':'var(--text-2)','되돌리기':'var(--text-3)','일괄변경':'var(--accent)' };
    body.innerHTML = '<table style="width:100%;border-collapse:collapse">' +
      '<thead><tr style="position:sticky;top:0;background:var(--surface)">' +
      '<th style="padding:6px 10px;font-size:.68rem;color:var(--text-3);border-bottom:1px solid var(--border);text-align:left;white-space:nowrap">시각</th>' +
      '<th style="padding:6px 10px;font-size:.68rem;color:var(--text-3);border-bottom:1px solid var(--border);text-align:left">사용자</th>' +
      '<th style="padding:6px 10px;font-size:.68rem;color:var(--text-3);border-bottom:1px solid var(--border);text-align:left">액션</th>' +
      '<th style="padding:6px 10px;font-size:.68rem;color:var(--text-3);border-bottom:1px solid var(--border);text-align:left">내용</th>' +
      '</tr></thead><tbody>' +
      json.entries.map(e => {
        const d = new Date(e.ts);
        const timeStr = d.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'}) + ' ' + d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
        const col = actionColor[e.action] || 'var(--text)';
        return `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:5px 10px;font-size:.7rem;color:var(--text-3);white-space:nowrap">${timeStr}</td>
          <td style="padding:5px 10px;font-size:.75rem;font-weight:600">${e.user||'익명'}${e.ip ? `<span style="font-size:.65rem;font-weight:400;color:var(--text-3);margin-left:4px">(${e.ip})</span>` : ''}</td>
          <td style="padding:5px 10px;font-size:.72rem;font-weight:700;color:${col};white-space:nowrap">${e.action}</td>
          <td style="padding:5px 10px;font-size:.72rem;color:var(--text-2)">${e.detail||''}</td>
        </tr>`;
      }).join('') + '</tbody></table>';
  } catch(err) {
    if (err.status === 403) {
      sessionStorage.removeItem('fmAdminToken');
      updateAdminUI();
      body.innerHTML = '<div style="padding:16px;color:var(--danger)">세션이 만료됐습니다. 관리자 재인증이 필요합니다.</div>';
    } else {
      body.innerHTML = '<div style="padding:16px;color:var(--danger)">서버에 연결할 수 없습니다.</div>';
    }
  }
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
  ['modeServer','modeLocal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = (id === 'modeServer') ? mode === 'server' : mode === 'local';
  });
  const urlEl  = document.getElementById('sServerUrl');
  if (urlEl)  urlEl.value  = S.settings.serverUrl  || '';
  const pollEl = document.getElementById('sPollInterval');
  if (pollEl) pollEl.value = S.settings.pollInterval || 60;
  const nameEl = document.getElementById('sUserName');
  if (nameEl) nameEl.value = S.settings.userName    || '';
  const badge  = document.getElementById('storageModeBadge');
  const label  = document.getElementById('serverStatusLabel');
  if (label) label.textContent = mode === 'server' ? '🌐' : '💾';
  if (badge) badge.style.color = mode === 'server' ? 'var(--accent)' : 'var(--text-3)';
  setServerStatus(mode === 'server' ? 'ok' : 'off');
}

/* ── 대시보드 설정 저장/UI 동기화 ── */
const DB_SECTION_LABELS = { stats: '스탯 카드 4개', insight: '그룹 진척도 · 담당자 · 타임라인', heatmap: '히트맵' };

window.saveDbSettings = () => {
  S.settings.dbHeroName = document.getElementById('dbHeroName')?.value || '';
  save();
  if (S.view === 'dashboard' && window.renderDashboard) window.renderDashboard();
};

window.dbSectionMove = (idx, dir) => {
  const secs = [...(S.settings.dbSections || ['stats', 'insight', 'heatmap'])];
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= secs.length) return;
  [secs[idx], secs[newIdx]] = [secs[newIdx], secs[idx]];
  S.settings.dbSections = secs;
  renderDbSectionOrder();
  save();
  if (S.view === 'dashboard' && window.renderDashboard) window.renderDashboard();
};

/* ── 섹션 순서 드래그 상태 ── */
let _dbDragIdx = null;

function renderDbSectionOrder() {
  const el = document.getElementById('dbSectionOrder');
  if (!el) return;
  const secs = S.settings.dbSections || ['stats', 'insight', 'heatmap'];
  el.innerHTML = secs.map((s, i) => `
    <div class="db-sec-row" draggable="true" data-idx="${i}"
      style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface-2);border-radius:7px;border:1px solid var(--border);cursor:grab;transition:opacity .15s,box-shadow .15s"
      ondragstart="dbSecDragStart(event,${i})"
      ondragover="dbSecDragOver(event,${i})"
      ondragleave="dbSecDragLeave(event)"
      ondrop="dbSecDrop(event,${i})"
      ondragend="dbSecDragEnd()">
      <span style="font-size:.85rem;color:var(--text-3);cursor:grab;padding:0 2px" title="드래그로 순서 변경">⠿</span>
      <span style="font-size:.75rem;color:var(--text-3);font-weight:700;width:16px">${i + 1}</span>
      <span style="flex:1;font-size:.8rem;font-weight:600;color:var(--text)">${DB_SECTION_LABELS[s] || s}</span>
      <button class="btn btn-g btn-sm" style="width:24px;height:24px;padding:0;font-size:.7rem" onclick="dbSectionMove(${i}, -1)" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button class="btn btn-g btn-sm" style="width:24px;height:24px;padding:0;font-size:.7rem" onclick="dbSectionMove(${i}, 1)" ${i === secs.length - 1 ? 'disabled' : ''}>▼</button>
    </div>`).join('');
}
window.renderDbSectionOrder = renderDbSectionOrder;

window.dbSecDragStart = (e, idx) => {
  _dbDragIdx = idx;
  e.currentTarget.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
};
window.dbSecDragOver = (e, idx) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (idx === _dbDragIdx) return;
  e.currentTarget.style.boxShadow = _dbDragIdx < idx
    ? '0 3px 0 var(--accent)' : '0 -3px 0 var(--accent)';
};
window.dbSecDragLeave = e => { e.currentTarget.style.boxShadow = ''; };
window.dbSecDrop = (e, toIdx) => {
  e.preventDefault();
  if (_dbDragIdx === null || _dbDragIdx === toIdx) return;
  const secs = [...(S.settings.dbSections || ['stats', 'insight', 'heatmap'])];
  const [moved] = secs.splice(_dbDragIdx, 1);
  secs.splice(toIdx, 0, moved);
  S.settings.dbSections = secs;
  save();
  if (S.view === 'dashboard' && window.renderDashboard) window.renderDashboard();
  renderDbSectionOrder();
};
window.dbSecDragEnd = () => {
  _dbDragIdx = null;
  document.querySelectorAll('.db-sec-row').forEach(r => {
    r.style.opacity = '';
    r.style.boxShadow = '';
  });
};

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
    setTimeout(() => openModal('userNameModal'), 600);
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
    const name = document.getElementById('userNamePopupInp')?.value.trim();
    if (name) {
      S.settings.userName = name;
      save();
      syncServerSettingsUI();
    }
  }
  closeModal('userNameModal');
};
