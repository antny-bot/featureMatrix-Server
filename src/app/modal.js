/* ══════════════════════════════════════════
   modal.js — 편집·추가 모달, MD 에디터, 드래그앤드롭, 툴팁
            + A 우클릭 컨텍스트 메뉴
            + C 빠른 상태 변경
            + E MD 툴바
            + #5 표·수식 파서
══════════════════════════════════════════ */

import { S, save, pushUndo, genKey, findItem, esc, eattr, normOwner, notify, logActivity, lockItem, unlockItem } from './state.js';
import { renderAll, scheduleCardAnim } from './render.js';
import { STATUS_CLS, STATUS_LBL, STATUS_OPTS } from './constants.js';
import { requireAdmin, requireEditor, isEditor } from './admin.js';

export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  document.querySelectorAll('.ov.on').forEach(m => { m.style.zIndex = '1000'; });
  el.style.zIndex = '1010';
  el.classList.add('on');
}
export const closeModal = id => document.getElementById(id)?.classList.remove('on');

/* ── 편집 탭 전환 ── */
export function switchEditTab(tab) {
  ['info','md'].forEach(t => {
    document.getElementById(`etab-${t}`)?.classList.toggle('on', t === tab);
    const pane = document.getElementById(`epane-${t}`);
    if (pane) pane.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'md') { updateMdStat(); syncMdPreview(); switchMdView('preview'); }
}

/* ── MD 뷰 모드 ── */
export function switchMdView(mode) {
  const ta = document.getElementById('fMdContent');
  const pv = document.getElementById('mdPreviewPane');
  const modeIdMap = { edit:'mdTabEdit', preview:'mdTabPrev', split:'mdTabSplit' };
  ['mdTabEdit','mdTabPrev','mdTabSplit'].forEach(id => document.getElementById(id)?.classList.remove('on'));
  document.getElementById(modeIdMap[mode])?.classList.add('on');
  if (mode === 'edit') {
    ta.style.display=''; ta.style.flex='1'; pv.style.display='none';
  } else if (mode === 'preview') {
    ta.style.display='none'; pv.style.display=''; pv.style.flex='1'; syncMdPreview();
  } else {
    ta.style.display=''; ta.style.flex='1'; pv.style.display=''; pv.style.flex='1'; syncMdPreview();
  }
}

export function syncMdPreview() {
  const pv = document.getElementById('mdPreviewPane');
  if (pv && pv.style.display !== 'none') {
    pv.innerHTML = parseMd(document.getElementById('fMdContent').value);
    /* KaTeX 렌더링 */
    if (window.katex) renderKatex(pv);
  }
}

export function onMdInput() { updateMdStat(); syncMdPreview(); }

export function updateMdStat() {
  const v = document.getElementById('fMdContent').value;
  document.getElementById('mdStatChars').textContent = v.length + '자';
  document.getElementById('mdStatLines').textContent = (v ? v.split('\n').length : 0) + '줄';
  document.getElementById('mdStatWords').textContent = (v.trim() ? v.trim().split(/\s+/).length : 0) + '단어';
}

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
  const item = findItem(key);
  if (!item) return;
  document.getElementById('editTitle').textContent = `기능 수정 — ${item.key}`;
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
  document.getElementById('btnHardDel').style.display = 'inline-flex';
  switchEditTab('info'); switchMdView('edit'); updateMdStat();
  // 편집 중 락 등록 (서버 모드)
  lockItem(key).then(res => {
    if (res?.locked && res?.lockedBy) {
      notify(`⚠ ${res.lockedBy}님이 편집 중입니다.`, true);
    }
  });
  openModal('editModal');
}

export function openAddModal() {
  if (!isEditor()) { requireEditor(openAddModal); return; }
  S.editKey = null;
  ['fName','fDesc','fPath','fGroup','fSubGroup','fCat','fSubCat','fOwner','fRel','fMemo','fMdContent']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('fStatus').value  = '';
  document.getElementById('fPri').value     = '중';
  document.getElementById('fIsImp').checked = false;
  document.getElementById('fIsDel').checked = false;
  document.getElementById('editTitle').textContent    = '기능 추가';
  document.getElementById('fKey').value               = genKey();
  document.getElementById('btnHardDel').style.display = 'none';
  switchEditTab('info'); switchMdView('edit'); updateMdStat();
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
    }
    notify('저장되었습니다.');
  } else {
    S.items.push(ni);
    logActivity('추가', `${ni.key} ${ni.name}`);
    notify('기능이 추가되었습니다.');
    scheduleCardAnim();
  }
  closeModal('editModal'); unlockItem(S.editKey); save(); renderAll();
}

export function hardDelete() {
  if (!S.editKey) return;
  requireAdmin(() => {
    const it = findItem(S.editKey);
    if (!confirm(`${S.editKey} 항목을 완전히 삭제하시겠습니까?`)) return;
    pushUndo();
    logActivity('완전삭제', `${S.editKey} ${it?.name||''}`);
    S.items = S.items.filter(it => it.key !== S.editKey);
    closeModal('editModal'); unlockItem(S.editKey); save(); renderAll(); notify('완전 삭제되었습니다.');
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
  save(); renderAll(); notify(it.isDelete === 'Y' ? '삭제 처리됨.' : '삭제 복원됨.');
}

/* ── A - 우클릭 컨텍스트 메뉴 ── */
let _ctxMenu = null;
function closeCtxMenu() { _ctxMenu?.remove(); _ctxMenu = null; }

export function openCtxMenu(e, key) {
  e.preventDefault(); e.stopPropagation();
  closeCtxMenu();
  const it = findItem(key); if (!it) return;
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.innerHTML = `
    <button class="ctx-item" onclick="closeCtxMenu();openEditModal('${eattr(key)}')">✏️ 편집</button>
    <button class="ctx-item" onclick="closeCtxMenu();openEditOrMd('${eattr(key)}')">📝 마크다운 열기</button>
    <button class="ctx-item" onclick="closeCtxMenu();duplicateItem('${eattr(key)}')">⧉ 복제</button>
    <div class="ctx-sep"></div>
    <button class="ctx-item danger" onclick="closeCtxMenu();quickToggleDel('${eattr(key)}')">${it.isDelete==='Y'?'↩ 삭제 복원':'✕ 삭제 처리'}</button>
  `;
  const x = Math.min(e.clientX, window.innerWidth  - 160);
  const y = Math.min(e.clientY, window.innerHeight - 180);
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  document.body.appendChild(menu);
  _ctxMenu = menu;
  setTimeout(() => document.addEventListener('click', closeCtxMenu, {once:true}), 0);
}
window.closeCtxMenu = closeCtxMenu;

/* ── C - 빠른 상태 변경 ── */
let _statusMenu = null;
function closeStatusMenu() { _statusMenu?.remove(); _statusMenu = null; }

export function openStatusMenu(e, key) {
  e.stopPropagation();
  closeStatusMenu(); closeCtxMenu();
  const it = findItem(key); if (!it) return;
  const menu = document.createElement('div');
  menu.className = 'status-quick-menu';
  const opts = [['', '— 없음'], ...STATUS_OPTS.map(s => [s, s])];
  menu.innerHTML = opts.map(([v, lbl]) =>
    `<button class="status-quick-item${it.status===v?' on':''}" onclick="setItemStatus('${eattr(key)}','${v}')">${lbl}</button>`
  ).join('');
  const x = Math.min(e.clientX, window.innerWidth  - 120);
  const y = Math.min(e.clientY + 4, window.innerHeight - 160);
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  document.body.appendChild(menu);
  _statusMenu = menu;
  setTimeout(() => document.addEventListener('click', closeStatusMenu, {once:true}), 0);
}
window.openStatusMenu = openStatusMenu;

export function setItemStatus(key, status) {
  closeStatusMenu();
  const it = findItem(key); if (!it) return;
  pushUndo();
  it.status = status; it.updatedAt = Date.now();
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
export function onDS(e, key)  { S.isDragging=true; clearTT(); S.dragKey=key; e.dataTransfer.effectAllowed='move'; setTimeout(()=>e.currentTarget.classList.add('dragging'),0); }
export function onDEnd(e)     { S.isDragging=false; e.currentTarget.classList.remove('dragging'); if(S.dragCell){S.dragCell.classList.remove('dov');S.dragCell=null;} }
export function onDE(e)       { e.preventDefault(); if(S.dragCell&&S.dragCell!==e.currentTarget)S.dragCell.classList.remove('dov'); S.dragCell=e.currentTarget; e.currentTarget.classList.add('dov'); }
export function onDO(e)       { e.preventDefault(); e.dataTransfer.dropEffect='move'; }
export function onDL(e)       { const rel=e.relatedTarget; if(rel&&e.currentTarget.contains(rel))return; if(e.currentTarget===S.dragCell){e.currentTarget.classList.remove('dov');S.dragCell=null;} }
export function onDrop(e) {
  e.preventDefault();
  const cell = e.currentTarget;
  cell.classList.remove('dov'); S.dragCell=null;
  if (!S.dragKey) return;
  const item = findItem(S.dragKey); if (!item) return;
  pushUndo();
  const from = `${item.group||'(미분류)'}/${item.category||'(미분류)'}`;
  item.group       = cell.getAttribute('data-g')==='(미분류)' ? '' : cell.getAttribute('data-g');
  item.subGroup    = cell.getAttribute('data-sg');
  item.category    = cell.getAttribute('data-c')==='(미분류)' ? '' : cell.getAttribute('data-c');
  item.subCategory = cell.getAttribute('data-sc');
  const to = `${item.group||'(미분류)'}/${item.category||'(미분류)'}`;
  logActivity('이동', `${item.key} ${item.name}: ${from} → ${to}`);
  S.dragKey=null; save(); renderAll(); notify('이동 완료.');
}

/* ── 툴팁 ── */
export function startTT(e, key) {
  if (S.isDragging) return; clearTT();
  const item = findItem(key);
  if (!item || (!item.desc && !item.mdContent)) return;
  const mx = e.clientX, my = e.clientY;
  S.ttTimer = setTimeout(() => {
    if (S.isDragging) return;
    const tt = document.getElementById('ftt');
    tt.innerHTML = `<div class="tt-key">${esc(item.key)}</div><div class="tt-name">${esc(item.name)}</div>${(item.desc||'').replace(/\n/g,'<br>')}
      ${item.owner ? `<div style="margin-top:4px;font-size:.69rem;color:var(--text-3)">담당: ${esc(normOwner(item.owner))}</div>` : ''}
      ${item.mdContent ? '<div style="margin-top:4px;font-size:.68rem;color:var(--accent)">📄 MD — 클릭하면 열림</div>' : ''}`;
    tt.style.left = `${Math.min(mx+14,window.innerWidth-300)}px`;
    tt.style.top  = `${Math.min(my+14,window.innerHeight-150)}px`;
    tt.classList.add('on');
  }, 900);
}
export function clearTT() { if(S.ttTimer){clearTimeout(S.ttTimer);S.ttTimer=null;} document.getElementById('ftt')?.classList.remove('on'); }
export function copyPath(p) { navigator.clipboard?.writeText(p).then(()=>notify('경로 복사됨.')).catch(()=>notify('복사 실패',true)); }

function sanitizeFilename(str) { return (str||'').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,'_').slice(0,80); }
function dlBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content],{type}));
  Object.assign(document.createElement('a'),{href:url,download:filename}).click();
  URL.revokeObjectURL(url);
}
