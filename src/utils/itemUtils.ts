import {
  MIGRATIONS, DATA_VERSION, FLABELS, DEFAULT_LIST_COLS,
  STATUS_KEY_MAP, STATUS_LBL, STATUS_OPTS
} from '../app/constants.js';
import { getStore } from '../store/useAppStore.js';
import type { Item, ChangeLogEntry, AppSettings, Filters, ColumnConfig, SectionKey } from '../types/index.js';
import katex from 'katex';

/**
 * 아이템 배열에 스키마 마이그레이션을 순차 적용.
 */
export function migrateItems(items: Item[], fromVersion = 1): Item[] {
  let result = items;
  for (let v = fromVersion; v < DATA_VERSION; v++) {
    const fn = (MIGRATIONS as Record<number, (item: Item) => Item>)[v];
    if (fn) result = result.map(fn);
  }
  return result;
}

export function migrateStatusValue(value: string): string {
  return (STATUS_KEY_MAP as Record<string, string>)[value] || value || '';
}

export function migrateStatusLabels(labels: Record<string, string> = {}): Record<string, string> {
  const source = labels || {};
  return (STATUS_OPTS as string[]).reduce((next: Record<string, string>, key: string) => {
    const legacyKey = Object.keys(STATUS_KEY_MAP as Record<string, string>).find(
      oldKey => (STATUS_KEY_MAP as Record<string, string>)[oldKey] === key
    );
    next[key] = source[key] ?? (legacyKey ? source[legacyKey] : undefined) ?? (STATUS_LBL as Record<string, string>)[key];
    return next;
  }, {});
}

export function migrateFilters(filters: Partial<Filters> = {}): Filters {
  const sourceStatuses = Array.isArray(filters.statuses) ? filters.statuses : [];
  return {
    priorities: filters.priorities || [],
    statuses: sourceStatuses.map(migrateStatusValue).filter(Boolean),
    showDeleted: filters.showDeleted || false,
    importantOnly: filters.importantOnly || false,
    owners: filters.owners || [],
  };
}

const NEW_SECTION_KEYS: SectionKey[] = ['stats', 'groupProgress', 'ownersPanel', 'heatmap', 'metrics', 'recent'];

export function migrateSettings(settings: Partial<AppSettings> = {}): AppSettings {
  const sourceSections = Array.isArray(settings.dbSections) ? settings.dbSections : [];

  // insight → groupProgress + ownersPanel 마이그레이션
  const expandedSections: SectionKey[] = [];
  for (const section of sourceSections) {
    if (section === 'insight') {
      if (!expandedSections.includes('groupProgress')) expandedSections.push('groupProgress');
      if (!expandedSections.includes('ownersPanel')) expandedSections.push('ownersPanel');
    } else if (NEW_SECTION_KEYS.includes(section as SectionKey)) {
      expandedSections.push(section as SectionKey);
    }
  }
  const dbSections: SectionKey[] = [
    ...expandedSections,
    ...NEW_SECTION_KEYS.filter(s => !expandedSections.includes(s)),
  ];

  const sourceVisibility = settings.dbSectionVisibility || {};
  const insightVisible = sourceVisibility['insight'] !== false;
  const dbSectionVisibility: Record<string, boolean> = NEW_SECTION_KEYS.reduce(
    (next: Record<string, boolean>, section: string) => {
      if (section === 'groupProgress' && sourceVisibility['groupProgress'] === undefined) {
        next[section] = insightVisible;
      } else if (section === 'ownersPanel' && sourceVisibility['ownersPanel'] === undefined) {
        next[section] = insightVisible;
      } else {
        next[section] = sourceVisibility[section] !== false;
      }
      return next;
    },
    {}
  );

  return {
    baseFont: 16, cardFont: 12, cardRadius: 6, cardGap: 4,
    colW: 130, catW: 52, subCatW: 80, cellFold: 0,
    matrixWidth: 'fluid', panelPos: 'left', panelVisible: true,
    title: '소복 매트릭스', subtitle: 'Function Matrix', themeId: 'sobuk',
    priorityStyles: { high: 'left-thick', mid: 'left-thin', low: 'none' },
    customColors: { light: {}, dark: {} },
    listColumns: JSON.parse(JSON.stringify(DEFAULT_LIST_COLS)),
    dbHeroName: '',
    changeLogMax: 50,
    boardFoldCount: 6,
    storageMode: 'server',
    serverUrl: '',
    pollInterval: 60,
    userName: '',
    ...settings,
    dbSections,
    dbSectionVisibility,
    statusLabels: migrateStatusLabels(settings.statusLabels),
  };
}

export function migrateChangeLog(changeLog: ChangeLogEntry[] = []): ChangeLogEntry[] {
  return changeLog.map(entry => ({
    ...entry,
    status: migrateStatusValue(entry.status || ''),
  }));
}

export function genKey(): string {
  let max = 0;
  getStore().items.forEach(({ key = '' }: { key?: string }) => {
    if (key.charAt(0) === 'N') {
      const n = parseInt(key.substring(1), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return 'N' + String(max + 1).padStart(4, '0');
}

export const findItem = (key: string, items?: Item[]): Item | null =>
  (items || getStore().items).find((it: Item) => it.key === key) || null;

export const getPK = (pv: string): 'high' | 'mid' | 'low' =>
  pv === '상' ? 'high' : pv === '중' ? 'mid' : 'low';

export const normOwner = (v: string | undefined): string => (v || '').trim() || '(미분류)';

const OWNER_COLORS = ['#2563A8','#16A34A','#D97706','#9333EA','#0891B2','#BE185D','#059669','#DC2626','#7C3AED','#C2410C'];
const _ownerColorMap: Record<string, string> = {};

export function getOwnerColor(owner: string): string {
  const k = normOwner(owner);
  if (k === '(미분류)') return 'var(--text-3)';
  if (!_ownerColorMap[k]) {
    const idx = Object.keys(_ownerColorMap).length % OWNER_COLORS.length;
    _ownerColorMap[k] = OWNER_COLORS[idx];
  }
  return _ownerColorMap[k];
}

export function fmtDate(ts: number): string {
  if (!ts) return '';
  const d    = new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)     return '방금';
  if (diff < 3600)   return Math.floor(diff / 60) + '분 전';
  if (diff < 84600)  return Math.floor(diff / 3600) + '시간 전';
  if (diff < 604800) return Math.floor(diff / 86400) + '일 전';
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export const today = (): string => new Date().toISOString().slice(0, 10);

export const esc = (s: unknown): string =>
  s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export const eattr = (s: unknown): string =>
  String(s || '').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export function pushChangeLog(action: string, key: string, name: string, detail?: { status?: string; owner?: string }): void {
  const entry: ChangeLogEntry = {
    action,
    key,
    name,
    status: detail?.status || '',
    owner: detail?.owner || '',
    ts: Date.now(),
  };
  getStore().pushChangeLog(entry);
}

export function sanitizeFilename(str: string): string {
  return (str || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 80);
}

export function dlBlob(content: string | Uint8Array, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── #5 MD 파서 (표 + 수식 + 헤딩) ── */
export function parseMd(md: string): string {
  if (!md) return '';
  let h = esc(md);

  const blocks: string[] = [];
  h = h.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_, lang: string, code: string) {
    const cls = lang ? ' class="language-' + esc(lang) + '"' : '';
    blocks.push('<pre><code' + cls + '>' + code + '</code></pre>');
    return '\x00B' + (blocks.length - 1) + '\x00';
  });
  h = h.replace(/`([^`]+)`/g, function(_, code: string) {
    blocks.push('<code>' + code + '</code>');
    return '\x00B' + (blocks.length - 1) + '\x00';
  });

  h = h.replace(/\$\$([\s\S]*?)\$\$/g, function(_, f: string) { blocks.push('\x00MATH_D' + f + '\x00'); return '\x00B' + (blocks.length - 1) + '\x00'; });
  h = h.replace(/\$([^\n$]+?)\$/g, function(_, f: string) { blocks.push('\x00MATH_I' + f + '\x00'); return '\x00B' + (blocks.length - 1) + '\x00'; });

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

  h = h.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt: string, src: string) {
    return '<img src="' + esc(src) + '" alt="' + alt + '" style="max-width:100%;border-radius:4px">';
  });
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, text: string, href: string) {
    return '<a href="' + esc(href) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + text + '</a>';
  });

  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  function buildList(lines: string[]): string {
    if (!lines.length) return '';
    const tag = /^\s*\d+\./.test(lines[0]) ? 'ol' : 'ul';
    let out = '<' + tag + '>';
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const indent = (line.match(/^(\s*)/) || ['', ''])[1].length;
      const content = line.replace(/^\s*(?:\d+\.|-|\*)\s+/, '');
      const subLines: string[] = [];
      i++;
      while (i < lines.length) {
        const nextIndent = (lines[i].match(/^(\s*)/) || ['', ''])[1].length;
        if (nextIndent <= indent) break;
        subLines.push(lines[i]); i++;
      }
      out += '<li>' + content + (subLines.length ? buildList(subLines) : '') + '</li>';
    }
    return out + '</' + tag + '>';
  }
  h = h.replace(/((?:^[ \t]*(?:\d+\.|-|\*) .+\n?)+)/gm, function(block: string) {
    const lines = block.split('\n').filter(l => l.trim());
    return buildList(lines);
  });

  h = h.replace(/((?:^[|].+[|]\n)+)/gm, function(tableBlock: string) {
    const rows = tableBlock.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return tableBlock;
    const isSep = (r: string) => /^\|[\s\-|:]+\|$/.test(r);
    const sepIdx = rows.findIndex(isSep);
    if (sepIdx < 1) return tableBlock;
    const parseRow = (r: string, tag: string) =>
      '<tr>' + r.replace(/^\||\\|$/g, '').split('|').map(cell =>
        '<' + tag + '>' + cell.trim() + '</' + tag + '>'
      ).join('') + '</tr>';
    const head = rows.slice(0, sepIdx).map(r => parseRow(r, 'th')).join('');
    const body = rows.slice(sepIdx + 1).map(r => parseRow(r, 'td')).join('');
    return '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  });

  const BLOCK = /^(<h[1-6]|<ul|<ol|<li|<pre|<blockquote|<table|<hr|\x00B)/;
  h = h.split(/\n\n+/).map(para => {
    const t = para.trim();
    if (!t) return '';
    if (BLOCK.test(t)) return t;
    return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');

  h = h.replace(/\x00B(\d+)\x00/g, function(_, idx: string) {
    const raw = blocks[+idx];
    if (raw.startsWith('\x00MATH_D')) return '<span class="katex-display" data-math="' + eattr(raw.slice(7, -2)) + '" data-disp="1"></span>';
    if (raw.startsWith('\x00MATH_I')) return '<span data-math="' + eattr(raw.slice(7, -2)) + '"></span>';
    return raw;
  });
  return h;
}

/* ── 필터링 & 정렬 & 매트릭스 엔진 ── */

const SEARCH_FIELD_MAP: Record<string, string> = {
  owner: 'owner', 담당: 'owner',
  status: 'status', 상태: 'status',
  group: 'group', 그룹: 'group',
  category: 'category', cat: 'category', 카테고리: 'category',
  priority: 'priority', 우선순위: 'priority',
  key: 'key',
};

function matchesSearch(it: Item, q: string): boolean {
  if (!q) return true;
  const tokens = q.trim().split(/\s+/);
  return tokens.every(tok => {
    const colon = tok.indexOf(':');
    if (colon > 0) {
      const alias = tok.slice(0, colon).toLowerCase();
      const val   = tok.slice(colon + 1).toLowerCase();
      const field = SEARCH_FIELD_MAP[alias];
      if (field) return ((it as Record<string, unknown>)[field] as string || '').toLowerCase().includes(val);
    }
    const lq = tok.toLowerCase();
    return [it.key, it.name, it.owner, it.path, it.desc, it.group, it.subGroup, it.category, it.subCategory]
      .some(v => (v || '').toLowerCase().includes(lq));
  });
}

export function getFiltered(items: Item[], filters: Filters, searchQ: string): Item[] {
  const { priorities, statuses, showDeleted, importantOnly, owners } = filters;
  return (items || getStore().items).filter((it: Item) => {
    if (!showDeleted && it.isDelete === 'Y')                                               return false;
    if (importantOnly && it.isImportant !== 'Y')                                          return false;
    if (priorities.length > 0 && !priorities.includes(it.priority || ''))                return false;
    if (owners.length > 0 && !owners.includes(normOwner(it.owner)))                      return false;
    if (statuses && statuses.length > 0 && it.status && !statuses.includes(it.status))   return false;
    if (searchQ && !matchesSearch(it, searchQ))                                           return false;
    return true;
  });
}

export const isFilterActive = (filters: Filters, searchQ: string): boolean => {
  return filters.priorities.length > 0 || (filters.statuses && filters.statuses.length > 0) ||
         filters.importantOnly || filters.owners.length > 0 || filters.showDeleted || !!searchQ;
};

export function sortCell(arr: Item[]): Item[] {
  const po: Record<string, number> = { '상': 0, '중': 1, '하': 2 };
  return arr.slice().sort((a, b) => {
    const pa = po[a.priority || ''] ?? 3, pb = po[b.priority || ''] ?? 3;
    if (pa !== pb) return pa - pb;
    if (a.isDelete !== b.isDelete) return a.isDelete === 'Y' ? 1 : -1;
    return 0;
  });
}

export function getUniqSorted(field: string, items?: Item[]): string[] {
  const seen = new Set<string>(), res: string[] = [];
  (items || getStore().items).forEach((it: Item) => {
    const v = field === 'owner'
      ? normOwner((it as Record<string, unknown>)[field] as string)
      : ((it as Record<string, unknown>)[field] as string || '(미분류)');
    if (!seen.has(v)) { seen.add(v); res.push(v); }
  });
  return res.sort((a, b) => { try { return a.localeCompare(b, 'ko'); } catch { return a < b ? -1 : 1; } });
}

interface Struct {
  groups: string[];
  gsubs: Record<string, string[]>;
  cats: string[];
  csubs: Record<string, string[]>;
}

export function buildStruct(items?: Item[], settings?: Partial<AppSettings>): Struct {
  const store = getStore();
  const targetItems = items || store.items;
  const targetSettings = settings || store.settings;

  const gm: Record<string, Record<string, boolean>> = {};
  const cm: Record<string, Record<string, boolean>> = {};
  targetItems.forEach((it: Item) => {
    const g = it.group || '(미분류)', sg = it.subGroup || '', c = it.category || '(미분류)', sc = it.subCategory || '';
    if (!gm[g]) gm[g] = {}; gm[g][sg] = true;
    if (!cm[c]) cm[c] = {}; cm[c][sc] = true;
  });
  const sk = (a: string, b: string) => { try { return a.localeCompare(b, 'ko'); } catch { return a < b ? -1 : 1; } };

  const groups = getUniqSorted('group', targetItems).filter(g => !!gm[g]);
  const cats   = getUniqSorted('category', targetItems).filter(c => !!cm[c]);

  const gsubs: Record<string, string[]> = {};
  const csubs: Record<string, string[]> = {};
  for (const g in gm) gsubs[g] = Object.keys(gm[g]).sort(sk);
  for (const c in cm) csubs[c] = Object.keys(cm[c]).sort(sk);
  return { groups, gsubs, cats, csubs };
}

/* ── 리스트 전용 ── */
export function getVisibleCols(userCols?: ColumnConfig[]): ColumnConfig[] {
  const cols = userCols || getStore().settings.listColumns || (DEFAULT_LIST_COLS as ColumnConfig[]);
  return cols.filter((c: ColumnConfig) => c.visible);
}

export function renderKatex(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('[data-math]').forEach(el => {
    try {
      el.innerHTML = katex.renderToString(el.dataset['math'] ?? '', {
        displayMode: el.dataset['disp'] !== undefined,
        throwOnError: false,
      });
    } catch {
      el.textContent = el.dataset['math'] ?? '';
    }
  });
}
