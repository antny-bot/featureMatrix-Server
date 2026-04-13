/* ══════════════════════════════════════════
   modal.js — 편집·추가 모달, MD 에디터, 드래그앤드롭, 툴팁
            + A 우클릭 컨텍스트 메뉴
            + C 빠른 상태 변경
            + E MD 툴바
            + #5 표·수식 파서
══════════════════════════════════════════ */

import { S, save, pushUndo, genKey, findItem, esc, eattr, notify, logActivity, pushChangeLog, lockItem, unlockItem } from './state.js';
import { renderAll, scheduleCardAnim, mxSel } from './render.js';
import { STATUS_CLS, STATUS_LBL } from './constants.js';
import { requireAdmin, requireEditor, isEditor } from './admin.js';
import { setStore, getStore } from '../store/useAppStore.js';
import { emitSave } from './socket.js';

function broadcastItemSaved(item) {
  if (S.settings.storageMode !== 'server' || !item) return;
  emitSave(item.key, S.settings.userName || 'anonymous', { ...item });
}

function currentUser() {
  return S.settings.userName || 'anonymous';
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

export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  document.querySelectorAll('.ov.on').forEach(m => { m.style.zIndex = '1000'; });
  el.style.zIndex = '1010';
  el.classList.add('on');
}
export const closeModal = id => document.getElementById(id)?.classList.remove('on');

/* ── 편집 탭 전환 — ItemModal.jsx 브릿지로 위임 ── */
export function switchEditTab(tab) { window.__editModalSwitchEditTab?.(tab); }

/* ── MD 뷰 모드 — ItemModal.jsx 브릿지로 위임 ── */
export function switchMdView(mode) { window.__editModalSwitchMdView?.(mode); }

export function syncMdPreview() { window.__editModalSyncMdPreview?.(); }

export function onMdInput() { window.__editModalOnMdInput?.(); }

export function updateMdStat() { window.__editModalUpdateMdStat?.(); }

/* E - MD 툴바 삽입 헬퍼 */
export function mdInsert(before, after) {
  const ta = document.getElementById('fMdContent');
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.substring(s, e);
  const rep = before + (sel || '텍스트') + (after||'');
  ta.value = ta.value.substring(0, s) + rep + ta.value.substring(e);
  ta.focus();
  ta.selectionStart = s + before.length;
  ta.selectionEnd   = s + before.length + (sel||'텍스트').length;
  onMdInput();
}
export function mdInsertLine(prefix) {
  const ta = document.getElementById('fMdContent');
  const s = ta.selectionStart;
  const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
  ta.value = ta.value.substring(0, lineStart) + prefix + ta.value.substring(lineStart);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = lineStart + prefix.length;
  onMdInput();
}

/* ── #5 MD 파서 (표 + 수식 + 헤딩 버그 수정) ── */
export function parseMd(md) {
  if (!md) return '';
  let h = esc(md);

  /* 코드 블록 보호 */
  const blocks = [];
  h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_, lang, code) {
    var cls = lang ? ' class="language-' + esc(lang) + '"' : '';
    blocks.push('<pre><code' + cls + '>' + code + '</code></pre>');
    return '\x00B' + (blocks.length-1) + '\x00';
  });
  h = h.replace(/`([^`]+)`/g, function(_, code) {
    blocks.push('<code>' + code + '</code>');
    return '\x00B' + (blocks.length-1) + '\x00';
  });

  /* 수식 보호 */
  h = h.replace(/\$\$([\s\S]*?)\$\$/g, function(_, f) { blocks.push('\x00MATH_D' + f + '\x00'); return '\x00B' + (blocks.length-1) + '\x00'; });
  h = h.replace(/\$([^\n$]+?)\$/g,      function(_, f) { blocks.push('\x00MATH_I' + f + '\x00'); return '\x00B' + (blocks.length-1) + '\x00'; });

  /* 수평선 */
  h = h.replace(/^(?:---|\*\*\*|___)\s*$/gm, '<hr>');

  /* 헤딩 H1~H6 */
  h = h.replace(/^#{6} (.+)$/gm, '<h6>$1</h6>');
  h = h.replace(/^#{5} (.+)$/gm, '<h5>$1</h5>');
  h = h.replace(/^#{4} (.+)$/gm, '<h4>$1</h4>');
  h = h.replace(/^### (.+)$/gm,  '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm,   '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm,    '<h1>$1</h1>');

  /* 인라인 서식: 취소선, bold, italic */
  h = h.replace(/~~(.+?)~~/g,     '<s>$1</s>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/__(.+?)__/g,     '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g,     '<em>$1</em>');
  h = h.replace(/_(.+?)_/g,       '<em>$1</em>');

  /* 이미지 (링크보다 먼저) */
  h = h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt, src) {
    return '<img src="' + esc(src) + '" alt="' + alt + '" style="max-width:100%;border-radius:4px">';
  });
  /* 링크 */
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, text, href) {
    return '<a href="' + esc(href) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + text + '</a>';
  });

  /* blockquote */
  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  /* 중첩 목록 처리 */
  function buildList(lines) {
    if (!lines.length) return '';
    var tag = /^\s*\d+\./.test(lines[0]) ? 'ol' : 'ul';
    var out = '<' + tag + '>';
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      var indent = (line.match(/^(\s*)/) || ['',''])[1].length;
      var content = line.replace(/^\s*(?:\d+\.|-|\*)\s+/, '');
      var subLines = [];
      i++;
      while (i < lines.length) {
        var nextIndent = (lines[i].match(/^(\s*)/) || ['',''])[1].length;
        if (nextIndent <= indent) break;
        subLines.push(lines[i]); i++;
      }
      out += '<li>' + content + (subLines.length ? buildList(subLines) : '') + '</li>';
    }
    return out + '</' + tag + '>';
  }
  h = h.replace(/((?:^[ \t]*(?:\d+\.|-|\*) .+\n?)+)/gm, function(block) {
    var lines = block.split('\n').filter(function(l) { return l.trim(); });
    var built = buildList(lines);
    blocks.push(built);
    return '\x00B' + (blocks.length-1) + '\x00';
  });

  /* 테이블 파싱 */
  h = h.replace(/((?:^[|].+[|]\n)+)/gm, function(tableBlock) {
    var rows = tableBlock.trim().split('\n').filter(function(r) { return r.trim(); });
    if (rows.length < 2) return tableBlock;
    var isSep = function(r) { return /^\|[\s\-|:]+\|$/.test(r); };
    var sepIdx = rows.findIndex(isSep);
    if (sepIdx < 1) return tableBlock;
    var parseRow = function(r, tag) {
      return '<tr>' + r.replace(/^\||\\|$/g,'').split('|').map(function(cell) {
        return '<' + tag + '>' + cell.trim() + '</' + tag + '>';
      }).join('') + '</tr>';
    };
    var head = rows.slice(0, sepIdx).map(function(r) { return parseRow(r, 'th'); }).join('');
    var body = rows.slice(sepIdx+1).map(function(r) { return parseRow(r, 'td'); }).join('');
    return '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  });

  /* 단락 처리 */
  var BLOCK = /^(<h[1-6]|<ul|<ol|<li|<pre|<blockquote|<table|<hr|\x00B)/;
  h = h.split(/\n\n+/).map(function(para) {
    var t = para.trim();
    if (!t) return '';
    if (BLOCK.test(t)) return t;
    return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');

  /* 블록/수식 복원 */
  h = h.replace(/\x00B(\d+)\x00/g, function(_, idx) {
    var raw = blocks[+idx];
    if (raw.startsWith('\x00MATH_D')) return '<span class="katex-display" data-math="' + eattr(raw.slice(7,-2)) + '" data-disp="1"></span>';
    if (raw.startsWith('\x00MATH_I')) return '<span data-math="' + eattr(raw.slice(7,-2)) + '"></span>';
    return raw;
  });
  return h;
}

/* KaTeX 렌더링 */
function renderKatex(container) {
  container.querySelectorAll('[data-math]').forEach(el => {
    try {
      const disp = !!el.dataset.disp;
      el.innerHTML = window.katex.renderToString(el.dataset.math, { displayMode: disp, throwOnError: false });
    } catch(e) { el.textContent = el.dataset.math; }
  });
}

/* ── 모달 열기: 편집 ── */
export function openEditModal(key) {
  S.editKey = key;
  setStore({ editKey: key });
  const item = findItem(key);
  if (!item) return;
  const fm = {
    fKey:'key', fPri:'priority', fName:'name', fDesc:'desc', fPath:'path',
    fGroup:'group', fSubGroup:'subGroup', fCat:'category', fSubCat:'subCategory',
    fOwner:'owner', fStatus:'status', fRel:'relSystem', fMemo:'memo', fMdContent:'mdContent'
  };
  Object.entries(fm).forEach(([id, prop]) => {
    const el = document.getElementById(id); if (el) el.value = item[prop] || '';
  });
  document.getElementById('fIsImp').checked = item.isImportant === 'Y';
  document.getElementById('fIsDel').checked = item.isDelete    === 'Y';
  window.__editModalBridge?.('edit', key);
  // 편집 중 락 등록 (서버 모드) — 충돌 알림은 lock_denied 이벤트로 처리
  lockItem(key);
  openModal('editModal');
}

export function openAddModal() {
  if (!isEditor()) { requireEditor(openAddModal); return; }
  S.editKey = null;
  setStore({ editKey: null });
  ['fName','fDesc','fPath','fGroup','fSubGroup','fCat','fSubCat','fOwner','fRel','fMemo','fMdContent']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('fStatus').value  = '';
  document.getElementById('fPri').value     = '중';
  document.getElementById('fIsImp').checked = false;
  document.getElementById('fIsDel').checked = false;
  document.getElementById('fKey').value = genKey();
  window.__editModalBridge?.('add', null);
  openModal('editModal');
}

export function openAddInCell(g, sg, c, sc) {
  openAddModal();
  document.getElementById('fGroup').value    = g;
  document.getElementById('fSubGroup').value = sg;
  document.getElementById('fCat').value      = c;
  document.getElementById('fSubCat').value   = sc;
}

export function openEditOrMd(key) {
  const it = findItem(key); if (!it) return;
  openEditModal(key);
  switchEditTab('info');
}

export function openMdModal(key) {
  const it = findItem(key); if (!it) return;
  openEditModal(key);
  switchEditTab('md');
  if (it.mdContent && it.mdContent.trim()) {
    switchMdView('preview');
  } else {
    switchMdView('edit');
  }
}

/* ── 저장 ── */
export function saveItem() {
  if (!isEditor()) { requireEditor(saveItem); return; }
  const name = document.getElementById('fName').value.trim();
  if (!name) { notify('기능명을 입력해주세요.', true); return; }
  const ni = {
    key:         document.getElementById('fKey').value,
    name,
    desc:        document.getElementById('fDesc').value,
    path:        document.getElementById('fPath').value.trim(),
    group:       document.getElementById('fGroup').value.trim(),
    subGroup:    document.getElementById('fSubGroup').value.trim(),
    category:    document.getElementById('fCat').value.trim(),
    subCategory: document.getElementById('fSubCat').value.trim(),
    priority:    document.getElementById('fPri').value,
    owner:       document.getElementById('fOwner').value.trim(),
    isImportant: document.getElementById('fIsImp').checked ? 'Y' : 'N',
    isDelete:    document.getElementById('fIsDel').checked ? 'Y' : 'N',
    relSystem:   document.getElementById('fRel').value.trim(),
    memo:        document.getElementById('fMemo').value,
    status:      document.getElementById('fStatus').value,
    mdPath:      S.editKey ? (findItem(S.editKey)||{}).mdPath||'' : '',
    mdContent:   document.getElementById('fMdContent').value,
    updatedAt:   Date.now()
  };
  pushUndo();
  if (S.editKey) {
    const idx = S.items.findIndex(it => it.key === S.editKey);
    if (idx !== -1) {
      // 변경 필드 추적
      const old = S.items[idx];
      const changed = ['name','priority','status','owner','group','subGroup','category','subCategory']
        .filter(k => old[k] !== ni[k])
        .map(k => `${k}: ${old[k]||'—'}→${ni[k]||'—'}`);
      S.items[idx] = ni;
      logActivity('수정', `${ni.key} ${ni.name}${changed.length ? ' ['+changed.join(', ')+']' : ''}`);
      pushChangeLog('수정', ni.key, ni.name, { status: ni.status, owner: ni.owner });
    }
    notify('저장되었습니다.');
  } else {
    S.items.push(ni);
    logActivity('추가', `${ni.key} ${ni.name}`);
    pushChangeLog('추가', ni.key, ni.name, { status: ni.status, owner: ni.owner });
    notify('기능이 추가되었습니다.');
    scheduleCardAnim();
  }
  closeModal('editModal'); unlockItem(S.editKey); setStore({ editKey: null }); S.editKey = null; save(); broadcastItemSaved(ni); renderAll();
}

export function hardDelete() {
  if (!S.editKey) return;
  requireAdmin(() => {
    const it = findItem(S.editKey);
    if (!confirm(`${S.editKey} 항목을 완전히 삭제하시겠습니까?`)) return;
    pushUndo();
    logActivity('완전삭제', `${S.editKey} ${it?.name||''}`);
    pushChangeLog('완전삭제', S.editKey, it?.name || S.editKey);
    S.items = S.items.filter(it => it.key !== S.editKey);
    closeModal('editModal'); unlockItem(S.editKey); setStore({ editKey: null }); S.editKey = null; save(); renderAll(); notify('완전 삭제되었습니다.');
  });
}

export function duplicateItem(key) {
  const src = findItem(key); if (!src) return;
  pushUndo();
  S.items.push(Object.assign({}, src, {key: genKey(), updatedAt: Date.now()}));
  save(); renderAll(); notify(`${src.key} 복제 완료`);
}

export function quickToggleDel(key) {
  const it = findItem(key); if (!it) return;
  pushUndo();
  it.isDelete = it.isDelete === 'Y' ? 'N' : 'Y';
  it.updatedAt = Date.now();
  const action = it.isDelete === 'Y' ? '삭제처리' : '삭제복원';
  pushChangeLog(action, it.key, it.name, { status: it.status, owner: it.owner });
  save(); renderAll(); notify(it.isDelete === 'Y' ? '삭제 처리됨.' : '삭제 복원됨.');
}

/* ── A - 우클릭 컨텍스트 메뉴 ── */
function closeCtxMenu() { window.__reactCloseCtxMenu?.(); }

export function openCtxMenu(e, key) {
  window.__reactOpenCtxMenu?.(e, key);
}
window.closeCtxMenu = closeCtxMenu;

/* ── C - 빠른 상태 변경 ── */
function closeStatusMenu() { window.__reactCloseStatusMenu?.(); }

export function openStatusMenu(e, key) {
  window.__reactOpenStatusMenu?.(e, key);
}
window.openStatusMenu = openStatusMenu;

export function setItemStatus(key, status) {
  closeStatusMenu();
  const it = findItem(key); if (!it) return;
  pushUndo();
  it.status = status; it.updatedAt = Date.now();
  pushChangeLog('상태변경', it.key, it.name, { status, owner: it.owner });
  save(); renderAll(); notify('진행상태 변경됨.');
}
window.setItemStatus = setItemStatus;

/* ── MD 파일 Import/Export ── */
export function impSingleMd(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    document.getElementById('fMdContent').value = ev.target.result;
    onMdInput(); notify('MD 파일 불러왔습니다: ' + file.name);
    switchMdView('preview');
  };
  r.readAsText(file, 'UTF-8'); e.target.value = '';
}

export function expSingleMd() {
  const content = document.getElementById('fMdContent').value;
  if (!content.trim()) { notify('MD 내용이 없습니다.', true); return; }
  const key  = document.getElementById('fKey').value  || 'unknown';
  const name = sanitizeFilename(document.getElementById('fName').value) || 'untitled';
  dlBlob(content, key + '_' + name + '.md', 'text/markdown;charset=utf-8');
  notify('MD 파일 저장됨.');
}

/* ── 드래그 & 드롭 ── */
export function onDS(e, key) {
  S.isDragging=true; setStore({ isDragging: true }); clearTT(); S.dragKey=key; e.dataTransfer.effectAllowed='move';
  if (mxSel.size > 0 && !mxSel.has(key)) {
    mxSel.forEach(k => document.querySelectorAll(`.mitem[data-key="${k.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"]`).forEach(c => c.classList.remove('mxsel')));
    mxSel.clear();
    mxSel.add(key);
    setTimeout(() => document.querySelectorAll(`.mitem[data-key="${key.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"]`).forEach(c => { c.classList.add('mxsel'); c.classList.add('dragging'); }), 0);
  } else {
    if (mxSel.size === 0) mxSel.add(key);
    setTimeout(() => mxSel.forEach(k => document.querySelectorAll(`.mitem[data-key="${k.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"]`).forEach(c => c.classList.add('dragging'))), 0);
  }
  const lockedKeys = getLockedByOther(mxSel);
  if (lockedKeys.length) {
    const locks = getStore().editLocks || {};
    const lockedBy = locks[lockedKeys[0]]?.user || '다른 사용자';
    notify(`${lockedBy}님이 편집 중인 항목은 이동할 수 없습니다.`, 'warning');
    S.isDragging=false; setStore({ isDragging: false }); S.dragKey=null;
    e.preventDefault();
    return;
  }
  lockKeys(mxSel);
}
export function onDEnd(e) {
  const keys = mxSel.size > 0 ? new Set(mxSel) : (S.dragKey ? new Set([S.dragKey]) : new Set());
  unlockKeys(keys);
  S.isDragging=false; setStore({ isDragging: false });
  S.dragKey=null;
  document.querySelectorAll('.mitem.dragging').forEach(c => c.classList.remove('dragging'));
  if(S.dragCell){S.dragCell.classList.remove('dov');S.dragCell=null;}
}
export function onDE(e)       { e.preventDefault(); if(S.dragCell&&S.dragCell!==e.currentTarget)S.dragCell.classList.remove('dov'); S.dragCell=e.currentTarget; e.currentTarget.classList.add('dov'); }
export function onDO(e)       { e.preventDefault(); e.dataTransfer.dropEffect='move'; }
export function onDL(e)       { const rel=e.relatedTarget; if(rel&&e.currentTarget.contains(rel))return; if(e.currentTarget===S.dragCell){e.currentTarget.classList.remove('dov');S.dragCell=null;} }
export function onDrop(e) {
  e.preventDefault();
  const cell = e.currentTarget;
  cell.classList.remove('dov'); S.dragCell=null;
  if (!S.dragKey) return;
  const keysToMove = mxSel.size > 0 ? new Set(mxSel) : new Set([S.dragKey]);
  const g  = cell.getAttribute('data-g')==='(미분류)' ? '' : cell.getAttribute('data-g');
  const sg = cell.getAttribute('data-sg');
  const c  = cell.getAttribute('data-c')==='(미분류)' ? '' : cell.getAttribute('data-c');
  const sc = cell.getAttribute('data-sc');
  pushUndo();
  keysToMove.forEach(k => {
    const item = findItem(k); if (!item) return;
    const from = `${item.group||'(미분류)'}/${item.category||'(미분류)'}`;
    item.group = g; item.subGroup = sg; item.category = c; item.subCategory = sc;
    const to = `${item.group||'(미분류)'}/${item.category||'(미분류)'}`;
    logActivity('이동', `${item.key} ${item.name}: ${from} → ${to}`);
  });
  mxSel.clear();
  S.dragKey=null; save();
  keysToMove.forEach(k => {
    broadcastItemSaved(findItem(k));
    unlockItem(k);
  });
  renderAll(); notify(keysToMove.size > 1 ? `${keysToMove.size}개 이동 완료.` : '이동 완료.');
}

/* ── 툴팁 ── */
export function startTT(e, key) {
  window.__reactStartTT?.(e, key);
}
export function clearTT() { window.__reactClearTT?.(); }
export function copyPath(p) { navigator.clipboard?.writeText(p).then(()=>notify('경로 복사됨.')).catch(()=>notify('복사 실패',true)); }

function sanitizeFilename(str) { return (str||'').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,'_').slice(0,80); }
function dlBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content],{type}));
  Object.assign(document.createElement('a'),{href:url,download:filename}).click();
  URL.revokeObjectURL(url);
}
