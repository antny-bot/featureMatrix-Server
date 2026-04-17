/* ══════════════════════════════════════════
   io.js — Import / Export (TSV · XLS · HTML · MD · ZIP)
══════════════════════════════════════════ */

import { FIELDS, FLABELS } from './constants.js';
import { useAppStore } from '../store/useAppStore.js';
import { getColors, getPresetCSS } from './theme.js';

const getStore = () => useAppStore.getState();
import { 
  esc, eattr, normOwner, getPK, today, 
  getFiltered, getOwnerColor, sanitizeFilename, dlBlob 
} from '../utils/itemUtils.js';
import { apiFetch } from '../utils/api.js';

const notify = (msg, type = 'success') => getStore().notify?.(msg, type);

function tsvEncode(val) {
  const s = String(val||'');
  if (s.includes('\t') || s.includes('\n') || s.includes('"'))
    return `"${s.replace(/"/g,'""')}"`;
  return s;
}

function parseTSVLine(line) {
  const fields = []; let cur = '', inQ = false, i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (inQ) {
      if (ch==='"' && line[i+1]==='"') { cur+='"'; i+=2; }
      else if (ch==='"')               { inQ=false; i++; }
      else                             { cur+=ch; i++; }
    } else {
      if (ch==='"')      { inQ=true; i++; }
      else if (ch==='\t') { fields.push(cur); cur=''; i++; }
      else                { cur+=ch; i++; }
    }
  }
  fields.push(cur);
  return fields;
}

export function parseTSVFull(raw) {
  const lines = raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  const rows = []; let cur = '', inQ = false;
  for (let i = 0; i <= lines.length; i++) {
    const ch = i < lines.length ? lines[i] : '';
    if (inQ) {
      if (ch==='"' && lines[i+1]==='"') { cur+='"'; i++; }
      else if (ch==='"')                 inQ = false;
      else                               cur += ch;
    } else {
      if (ch==='"')                      inQ = true;
      else if (ch==='\n' || i===lines.length) { rows.push(parseTSVLine(cur)); cur=''; }
      else                               cur += ch;
    }
  }
  return rows.filter(r => r.length > 0 && r.join('').trim() !== '');
}

function buildTSV() {
  const rows = [FIELDS.map(f => tsvEncode(FLABELS[f]||f)).join('\t')];
  getStore().items.forEach(it => { rows.push(FIELDS.map(f => tsvEncode(it[f]||'')).join('\t')); });
  return rows.join('\n');
}

/* ═══════════════════════════════
   Export
═══════════════════════════════ */
export function expClip() {
  const tsv = buildTSV();
  navigator.clipboard?.writeText(tsv)
    .then(() => notify('클립보드에 복사되었습니다.'))
    .catch(() => {
      const ta = Object.assign(document.createElement('textarea'), {value: tsv});
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      notify('클립보드에 복사되었습니다.');
    });
}

export function expTSV() {
  dlBlob('\uFEFF' + buildTSV(), `sobuk-${today()}.tsv`, 'text/tab-separated-values;charset=utf-8');
  notify('TSV 다운로드.');
}

export function expXLS() {
  let h = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';
  FIELDS.forEach(f => { h += `<th style="background:#EBF2FB;font-weight:bold;padding:5px 8px">${esc(FLABELS[f]||f)}</th>`; });
  h += '</tr></thead><tbody>';
  getStore().items.forEach(it => {
    h += '<tr>';
    FIELDS.forEach(f => {
      const v  = (it[f]||'').replace(/\n/g,' ');
      const cs = f==='priority' && it.priority==='상' ? 'padding:5px 8px;color:#C0312A;font-weight:bold' : 'padding:5px 8px';
      h += `<td style="${cs}">${esc(v)}</td>`;
    });
    h += '</tr>';
  });
  h += '</tbody></table></body></html>';
  dlBlob('\uFEFF' + h, `sobuk-${today()}.xls`, 'application/vnd.ms-excel;charset=utf-8');
  notify('엑셀 다운로드.');
}

function getExportCss() {
  const chunks = [];
  Array.from(document.styleSheets).forEach(sheet => {
    try {
      const rules = Array.from(sheet.cssRules || []).map(rule => rule.cssText).join('\n');
      if (rules) chunks.push(rules);
    } catch { }
  });
  const dyn = document.getElementById('dynStyle')?.textContent || '';
  if (dyn) chunks.push(dyn);
  return chunks.join('\n');
}

export function expHTML({ fluid = false } = {}) {
  const isFluid = !!fluid;
  const store = getStore();
  const items = getFiltered(store.items, store.filters, store.searchQ);
  const isDark  = document.documentElement.getAttribute('data-theme') === 'dark';
  const ss      = store.settings;
  const c       = getColors();

  const gm = {}, cm2 = {};
  items.forEach(it => {
    const g=it.group||'(미분류)', sg=it.subGroup||'', cat=it.category||'(미분류)', sc=it.subCategory||'';
    if (!gm[g]) gm[g]={}; gm[g][sg]=true;
    if (!cm2[cat]) cm2[cat]={}; cm2[cat][sc]=true;
  });
  const sk = (a,b) => { try { return a.localeCompare(b,'ko'); } catch { return a<b?-1:1; } };
  const uniqSorted = (field, arr) => {
    const seen=new Set(), r=[];
    arr.forEach(it => { const v=it[field]||'(미분류)'; if(!seen.has(v)){seen.add(v);r.push(v);} });
    return r.sort(sk);
  };
  const groups = uniqSorted('group', store.items).filter(g=>!!gm[g]);
  const cats   = uniqSorted('category', store.items).filter(cat=>!!cm2[cat]);
  const gsubs={}, csubs={};
  for (const g in gm)    gsubs[g]   = Object.keys(gm[g]).sort(sk);
  for (const cat in cm2) csubs[cat] = Object.keys(cm2[cat]).sort(sk);

  const cellMap = {};
  items.forEach(it => {
    const ck = `${it.group||'(미분류)'}|||${it.subGroup||''}|||${it.category||'(미분류)'}|||${it.subCategory||''}`;
    if (!cellMap[ck]) cellMap[ck] = [];
    cellMap[ck].push(it);
  });
  const gCnt = {}, prioCount = {high:0,mid:0,low:0};
  items.forEach(it => { const g=it.group||'(미분류)'; gCnt[g]=(gCnt[g]||0)+1; prioCount[getPK(it.priority)]++; });
  const impCount = items.filter(it=>it.isImportant==='Y').length;

  let css = getExportCss();
  if (isFluid) css += '.mtable{width:100%}';

  const exportDate = new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});
  const filterInfo = [];
  const filters = store.filters;
  if (filters.priorities.length) filterInfo.push('우선순위: ' + filters.priorities.join('·'));
  if ((filters.statuses||[]).length) filterInfo.push('상태: ' + filters.statuses.join('·'));
  if (filters.owners.length) filterInfo.push('담당: ' + filters.owners.join('·'));
  if (filters.importantOnly) filterInfo.push('중요만');
  if (filters.showDeleted) filterInfo.push('삭제 포함');
  const filterStr = filterInfo.length ? filterInfo.join(' / ') : '전체';

  let doc = `<!DOCTYPE html><html lang="ko" data-theme="${isDark?'dark':'light'}"><head><meta charset="UTF-8"><title>${esc(ss.title)}</title><style>${css}
.exp-hdr{padding:16px 20px 14px;border-bottom:2px solid var(--border);margin-bottom:16px}
.exp-hdr-title{font-family:'Noto Serif KR',Georgia,serif;font-size:1.4rem;font-weight:700;color:var(--text);letter-spacing:-.02em}
.exp-hdr-sub{font-size:.8rem;color:var(--text-3);margin-top:2px}
.exp-hdr-stats{display:flex;gap:12px;margin-top:10px;flex-wrap:wrap}
.exp-stat{display:flex;flex-direction:column;align-items:center;background:var(--surface-2);border-radius:8px;padding:6px 14px;min-width:52px}
.exp-stat-val{font-size:1.05rem;font-weight:700;color:var(--text);line-height:1.2}
.exp-stat-lbl{font-size:.6rem;color:var(--text-3);font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin-top:1px}
.exp-filter{font-size:.72rem;color:var(--text-2);background:var(--accent-l);border-radius:5px;padding:3px 8px;display:inline-block;margin-top:8px}
</style></head><body style="padding:20px;background:var(--bg)">`;

  doc += `<div class="exp-hdr">
  <div class="exp-hdr-title">${esc(ss.title)}</div>
  <div class="exp-hdr-sub">${esc(ss.subtitle)} &nbsp;·&nbsp; 출력일 ${exportDate}</div>
  <div class="exp-hdr-stats">
    <div class="exp-stat"><span class="exp-stat-val">${items.length}</span><span class="exp-stat-lbl">전체</span></div>
    <div class="exp-stat"><span class="exp-stat-val" style="color:var(--p-high,#C0312A)">${prioCount.high}</span><span class="exp-stat-lbl">상</span></div>
    <div class="exp-stat"><span class="exp-stat-val" style="color:var(--p-mid,#9A6200)">${prioCount.mid}</span><span class="exp-stat-lbl">중</span></div>
    <div class="exp-stat"><span class="exp-stat-val" style="color:var(--text-3)">${prioCount.low}</span><span class="exp-stat-lbl">하</span></div>
    ${impCount?`<div class="exp-stat"><span class="exp-stat-val" style="color:var(--accent)">${impCount}</span><span class="exp-stat-lbl">중요</span></div>`:''}
    <div class="exp-stat"><span class="exp-stat-val">${groups.length}</span><span class="exp-stat-lbl">그룹</span></div>
    <div class="exp-stat"><span class="exp-stat-val">${cats.length}</span><span class="exp-stat-lbl">카테고리</span></div>
  </div>
  <div class="exp-filter">🔍 ${esc(filterStr)}</div>
</div>`;

  doc += '<table class="mtable"><thead><tr>';
  doc += `<th class="m-corner" rowspan="2"></th><th class="m-corner" rowspan="2"></th>`;
  groups.forEach(gn => { doc += `<th class="m-ghd" colspan="${gsubs[gn].length}">${esc(gn)}<span class="gcnt">${gCnt[gn]||0}</span></th>`; });
  doc += '</tr><tr>';
  groups.forEach(gn => { gsubs[gn].forEach(sg => { doc += `<th class="m-sghd">${esc(sg||'—')}</th>`; }); });
  doc += '</tr></thead><tbody>';
  cats.forEach(cn => {
    csubs[cn].forEach((scn, sci) => {
      doc += '<tr>';
      if (sci===0) doc += `<td class="m-cathd" rowspan="${csubs[cn].length}">${esc(cn)}</td>`;
      doc += `<td class="m-subcat">${esc(scn||'—')}</td>`;
      groups.forEach(gn => { gsubs[gn].forEach(sg => {
        const ck = `${gn}|||${sg}|||${cn}|||${scn}`, ci = cellMap[ck] || [];
        doc += `<td class="m-cell" style="background:var(--bg)">`;
        ci.forEach(itm => {
          const pk=getPK(itm.priority), pkC=pk[0].toUpperCase()+pk.slice(1);
          const pHex=c[`p${pkC}`]||'#888', pBg=c[`p${pkC}Bg`]||'#eee';
          const cs2=`${getPresetCSS(ss.priorityStyles[pk],pHex,pBg)};border-radius:${ss.cardRadius}px;margin-bottom:${ss.cardGap}px;padding:5px 7px`;
          const di=store.display;
          const ownerColor=getOwnerColor(itm.owner);
          const ownerHt=di.showOwner?`<div style="font-size:.65rem;color:var(--text-3);display:flex;align-items:center;gap:3px;margin-top:2px"><span style="width:6px;height:6px;border-radius:50%;background:${ownerColor};display:inline-block"></span>${esc(normOwner(itm.owner))}</div>`:'';
          const statusHt=di.showStatus&&itm.status?`<span style="font-size:.55rem;font-weight:700;padding:1px 4px;border-radius:3px;margin-left:2px;background:var(--surface-2);color:var(--text-2)">${esc(itm.status)}</span>`:'';
          const mdHt=di.showMdBadge&&itm.mdContent?`<span style="font-size:.52rem;font-weight:700;background:var(--accent-l);color:var(--accent);border-radius:3px;padding:1px 3px;margin-left:2px">MD</span>`:'';
          const starHt=di.showStar&&itm.isImportant==='Y'?`<span style="color:var(--accent);font-size:.65rem">★</span>`:'';
          const newHt=di.showNewBadge&&itm.key?.charAt(0)==='N'?`<span style="font-size:.56rem;font-weight:800;background:var(--success);color:#fff;border-radius:3px;padding:1px 3px;margin-left:2px">N</span>`:'';
          doc += `<div style="${cs2}" title="${eattr(itm.desc)}">
            <div style="font-size:.6rem;color:var(--text-3);margin-bottom:2px">${esc(itm.key)}${starHt}${newHt}${mdHt}${statusHt}</div>
            <div style="font-size:${ss.cardFont}px;font-weight:600;color:var(--text)${itm.isDelete==='Y'?';text-decoration:line-through':''}">${esc(itm.name)}</div>
            ${ownerHt}
          </div>`;
        });
        doc += '</td>';
      }); });
      doc += '</tr>';
    });
  });
  doc += '</tbody></table></body></html>';
  dlBlob(doc, `sobuk-${today()}.html`, 'text/html;charset=utf-8');
  notify('HTML 내보내기 완료.');
}

/* ═══════════════════════════════
   MD ZIP
═══════════════════════════════ */
export function expMdZip() {
  const store = getStore();
  const mdItems = store.items.filter(it => it.mdContent && it.mdContent.trim());
  if (!mdItems.length) { notify('MD 내용이 있는 항목이 없습니다.', true); return; }
  const files = mdItems.map(it => ({
    name:    (it.key || 'unknown') + '.md',
    content: it.mdContent
  }));
  const zipBytes = buildZip(files);
  const blob = new Blob([zipBytes], {type:'application/zip'});
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), {href:url, download:`sobuk-md-${today()}.zip`}).click();
  URL.revokeObjectURL(url);
  notify(`MD ZIP 내보내기 완료 (${files.length}개).`);
}

export function impMdFiles(e) {
  const fileList = e.target.files; if (!fileList || !fileList.length) return;
  const total = fileList.length; let done = 0, updated = 0, notFound = 0;
  const store = getStore();
  for (let i = 0; i < fileList.length; i++) {
    (file => {
      const r = new FileReader();
      r.onload = ev => {
        const content = ev.target.result;
        const rawName = file.name.replace(/\.md$/i,'');
        const key = rawName.split('_')[0];
        const it  = store.items.find(candidate => candidate.key === key);
        if (it) { it.mdContent = content; updated++; } else notFound++;
        done++;
        if (done === total) {
          useAppStore.getState().setItems([...store.items]);
          notify(`MD 가져오기 완료: 업데이트 ${updated}개${notFound?' / 미매핑 '+notFound+'개':''}.`, 'success');
          e.target.value = '';
        }
      };
      r.readAsText(file, 'UTF-8');
    })(fileList[i]);
  }
}

/* ═══════════════════════════════
   ZIP 빌더 (비압축, 순수 JS)
═══════════════════════════════ */
function buildZip(files) {
  const enc = str => {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if      (c < 0x80)    bytes.push(c);
      else if (c < 0x800)   bytes.push(0xC0|(c>>6), 0x80|(c&0x3F));
      else if (c < 0x10000) bytes.push(0xE0|(c>>12), 0x80|((c>>6)&0x3F), 0x80|(c&0x3F));
      else                  bytes.push(0xF0|(c>>18), 0x80|((c>>12)&0x3F), 0x80|((c>>6)&0x3F), 0x80|(c&0x3F));
    }
    return bytes;
  };
  const crc32 = data => {
    const tbl = Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?(0xEDB88320^(c>>>1)):c>>>1;return c;});
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) crc = tbl[(crc^data[i])&0xFF] ^ (crc>>>8);
    return (crc^0xFFFFFFFF)>>>0;
  };
  const u16le = v => [v&0xFF,(v>>8)&0xFF];
  const u32le = v => [v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>24)&0xFF];
  const concat = arrs => { let len=0; arrs.forEach(a=>len+=a.length); const out=new Uint8Array(len); let off=0; arrs.forEach(a=>{out.set(a,off);off+=a.length}); return out; };

  const localHeaders = [], centralDirs = [];
  let offset = 0;

  files.forEach(f => {
    const nameBytes = new Uint8Array(enc(f.name));
    const dataBytes = new Uint8Array(enc(f.content));
    const crc = crc32(dataBytes), sz = dataBytes.length;
    /* flags=0x0800: UTF-8 파일명, compression=0x0000: store */
    const lh = new Uint8Array([
      0x50,0x4B,0x03,0x04, /* signature */
      0x14,0x00,           /* version needed: 2.0 */
      0x00,0x08,           /* flags: bit11=UTF-8 */
      0x00,0x00,           /* compression: store */
      0x00,0x00,           /* mod time */
      0x00,0x00            /* mod date */
    ].concat(u32le(crc)).concat(u32le(sz)).concat(u32le(sz))
     .concat(u16le(nameBytes.length)).concat([0x00,0x00]));
    const localEntry = concat([lh, nameBytes, dataBytes]);
    localHeaders.push(localEntry);
    const cd = new Uint8Array([
      0x50,0x4B,0x01,0x02, /* signature */
      0x14,0x00,           /* version made by: 2.0 */
      0x14,0x00,           /* version needed: 2.0 */
      0x00,0x08,           /* flags: UTF-8 */
      0x00,0x00,           /* compression: store */
      0x00,0x00,           /* mod time */
      0x00,0x00            /* mod date */
    ].concat(u32le(crc)).concat(u32le(sz)).concat(u32le(sz))
     .concat(u16le(nameBytes.length))
     .concat([0x00,0x00,  /* extra field length */
              0x00,0x00,  /* file comment length */
              0x00,0x00,  /* disk number start */
              0x00,0x00,  /* internal attributes */
              0x00,0x00,0x00,0x00]) /* external attributes (4 bytes) */
     .concat(u32le(offset)));
    centralDirs.push(concat([cd, nameBytes]));
    offset += localEntry.length;
  });

  const cdStart = offset;
  let cdSize = 0; centralDirs.forEach(cd => { cdSize += cd.length; });
  const eocd = new Uint8Array([0x50,0x4B,0x05,0x06,0x00,0x00,0x00,0x00].concat(u16le(files.length)).concat(u16le(files.length)).concat(u32le(cdSize)).concat(u32le(cdStart)).concat([0x00,0x00]));

  return concat([...localHeaders, ...centralDirs, eocd]);
}
