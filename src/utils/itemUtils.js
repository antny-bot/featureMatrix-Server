import { MIGRATIONS, DATA_VERSION, FLABELS, DEFAULT_LIST_COLS } from '../app/constants.js';
import { getStore } from '../store/useAppStore.js';

/**
 * 아이템 배열에 스키마 마이그레이션을 순차 적용.
 */
export function migrateItems(items, fromVersion = 1) {
  let result = items;
  for (let v = fromVersion; v < DATA_VERSION; v++) {
    const fn = MIGRATIONS[v];
    if (fn) result = result.map(fn);
  }
  return result;
}

export function genKey() {
  let max = 0;
  getStore().items.forEach(({key=''}) => {
    if (key.charAt(0) === 'N') {
      const n = parseInt(key.substring(1), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return 'N' + String(max + 1).padStart(4, '0');
}

export const findItem  = (key, items) => (items || getStore().items).find(it => it.key === key) || null;
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
  if (diff < 84600)  return Math.floor(diff / 3600) + '시간 전';
  if (diff < 604800) return Math.floor(diff / 86400) + '일 전';
  return d.toLocaleDateString('ko-KR', {month:'short', day:'numeric'});
}

export const today = () => new Date().toISOString().slice(0, 10);

export const esc   = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export const eattr = s => String(s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export function pushChangeLog(action, key, name, detail) {
  const entry = {
    action,
    key,
    name,
    status: detail?.status || '',
    owner: detail?.owner || '',
    ts: Date.now()
  };
  getStore().pushChangeLog(entry);
}

export function sanitizeFilename(str) { 
  return (str||'').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,'_').slice(0,80); 
}

export function dlBlob(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── #5 MD 파서 (표 + 수식 + 헤딩) ── */
export function parseMd(md) {
  if (!md) return '';
  let h = esc(md);

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

  h = h.replace(/\$\$([\s\S]*?)\$\$/g, function(_, f) { blocks.push('\x00MATH_D' + f + '\x00'); return '\x00B' + (blocks.length-1) + '\x00'; });
  h = h.replace(/\$([^\n$]+?)\$/g,      function(_, f) { blocks.push('\x00MATH_I' + f + '\x00'); return '\x00B' + (blocks.length-1) + '\x00'; });

  h = h.replace(/^(?:---|\*\*\*|___)\s*$/gm, '<hr>');

  h = h.replace(/^#{6} (.+)$/gm, '<h6>$1</h6>');
  h = h.replace(/^#{5} (.+)$/gm, '<h5>$1</h5>');
  h = h.replace(/^#{4} (.+)$/gm, '<h4>$1</h4>');
  h = h.replace(/^### (.+)$/gm,  '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm,   '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm,    '<h1>$1</h1>');

  h = h.replace(/~~(.+?)~~/g,     '<s>$1</s>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/__(.+?)__/g,     '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g,     '<em>$1</em>');
  h = h.replace(/_(.+?)_/g,       '<em>$1</em>');

  h = h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt, src) {
    return '<img src="' + esc(src) + '" alt="' + alt + '" style="max-width:100%;border-radius:4px">';
  });
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, text, href) {
    return '<a href="' + esc(href) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + text + '</a>';
  });

  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

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
    return buildList(lines);
  });

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

  var BLOCK = /^(<h[1-6]|<ul|<ol|<li|<pre|<blockquote|<table|<hr|\x00B)/;
  h = h.split(/\n\n+/).map(function(para) {
    var t = para.trim();
    if (!t) return '';
    if (BLOCK.test(t)) return t;
    return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');

  h = h.replace(/\x00B(\d+)\x00/g, function(_, idx) {
    var raw = blocks[+idx];
    if (raw.startsWith('\x00MATH_D')) return '<span class="katex-display" data-math="' + eattr(raw.slice(7,-2)) + '" data-disp="1"></span>';
    if (raw.startsWith('\x00MATH_I')) return '<span data-math="' + eattr(raw.slice(7,-2)) + '"></span>';
    return raw;
  });
  return h;
}

/* ── 필터링 & 정렬 & 매트릭스 엔진 ── */

const SEARCH_FIELD_MAP = {
  owner: 'owner', 담당: 'owner',
  status: 'status', 상태: 'status',
  group: 'group', 그룹: 'group',
  category: 'category', cat: 'category', 카테고리: 'category',
  priority: 'priority', 우선순위: 'priority',
  key: 'key',
};

function matchesSearch(it, q) {
  if (!q) return true;
  const tokens = q.trim().split(/\s+/);
  return tokens.every(tok => {
    const colon = tok.indexOf(':');
    if (colon > 0) {
      const alias = tok.slice(0, colon).toLowerCase();
      const val   = tok.slice(colon + 1).toLowerCase();
      const field = SEARCH_FIELD_MAP[alias];
      if (field) return (it[field] || '').toLowerCase().includes(val);
    }
    const lq = tok.toLowerCase();
    return [it.key, it.name, it.owner, it.path, it.desc, it.group, it.subGroup, it.category, it.subCategory]
      .some(v => (v||'').toLowerCase().includes(lq));
  });
}

export function getFiltered(items, filters, searchQ) {
  const { priorities, statuses, showDeleted, importantOnly, owners } = filters;
  return (items || getStore().items).filter(it => {
    if (!showDeleted && it.isDelete === 'Y')                                               return false;
    if (importantOnly && it.isImportant !== 'Y')                                          return false;
    if (priorities.length > 0 && !priorities.includes(it.priority))                      return false;
    if (owners.length > 0 && !owners.includes(normOwner(it.owner)))                      return false;
    if (statuses && statuses.length > 0 && it.status && !statuses.includes(it.status))   return false;
    if (searchQ && !matchesSearch(it, searchQ))                                          return false;
    return true;
  });
}

export const isFilterActive = (filters, searchQ) => {
  return filters.priorities.length > 0 || (filters.statuses && filters.statuses.length > 0) ||
         filters.importantOnly || filters.owners.length > 0 || filters.showDeleted || !!searchQ;
};

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
  (items || getStore().items).forEach(it => {
    const v = field === 'owner' ? normOwner(it[field]) : (it[field] || '(미분류)');
    if (!seen.has(v)) { seen.add(v); res.push(v); }
  });
  return res.sort((a,b) => { try { return a.localeCompare(b,'ko'); } catch { return a < b ? -1 : 1; } });
}


export function buildStruct(items, settings) {
  const store = getStore();
  const targetItems = items || store.items;
  const targetSettings = settings || store.settings;
  
  const gm = {}, cm = {};
  targetItems.forEach(it => {
    const g = it.group||'(미분류)', sg = it.subGroup||'', c = it.category||'(미분류)', sc = it.subCategory||'';
    if (!gm[g]) gm[g] = {}; gm[g][sg] = true;
    if (!cm[c]) cm[c] = {}; cm[c][sc] = true;
  });
  const sk = (a,b) => { try { return a.localeCompare(b,'ko'); } catch { return a < b ? -1 : 1; } };

  const applyOrder = (autoList, orderArr) => {
    if (!orderArr || !orderArr.length) return autoList;
    const set = new Set(autoList);
    const ordered = orderArr.filter(v => set.has(v));
    const rest = autoList.filter(v => !ordered.includes(v));
    return [...ordered, ...rest];
  };

  const autoGroups = getUniqSorted('group', targetItems).filter(g => !!gm[g]);
  const autoCats   = getUniqSorted('category', targetItems).filter(c => !!cm[c]);
  const groups = applyOrder(autoGroups, targetSettings.groupOrder);
  const cats   = applyOrder(autoCats,   targetSettings.catOrder);

  const gsubs = {}, csubs = {};
  for (const g in gm) gsubs[g] = Object.keys(gm[g]).sort(sk);
  for (const c in cm) csubs[c] = Object.keys(cm[c]).sort(sk);
  return { groups, gsubs, cats, csubs };
}

/* ── 리스트 전용 ── */
export function getVisibleCols(userCols) {
  const cols = userCols || getStore().settings.columns || DEFAULT_LIST_COLS;
  return cols.filter(c => c.visible);
}
