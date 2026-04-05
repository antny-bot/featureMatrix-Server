/* ══════════════════════════════════════════
   theme.js — 색상 계산, CSS 변수 주입, 테마 전환
══════════════════════════════════════════ */

import { THEMES, PRESETS } from './constants.js';
import { S, save, notify }  from './state.js';

export function getColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const base   = (THEMES[S.settings.themeId] || THEMES.sobuk)[isDark ? 'dark' : 'light'];
  const custom = S.settings.customColors[isDark ? 'dark' : 'light'] || {};
  return Object.assign({}, base, ...Object.entries(custom).filter(([,v]) => v).map(([k,v]) => ({[k]:v})));
}

export function applyVars() {
  const c  = getColors();
  const ss = S.settings;
  let css = `html{font-size:${ss.baseFont}px !important}\n`;
  css += `:root{--p-high:${c.pHigh};--p-high-bg:${c.pHighBg};--p-mid:${c.pMid};--p-mid-bg:${c.pMidBg};--p-low:${c.pLow};--p-low-bg:${c.pLowBg};--db-theme-c:${c.mxGC};--db-theme-bg:${c.mxGBg}}\n`;
  css += `.mtable,.mtable th,.mtable td{border:${c.mxBW}px solid ${c.mxBorder}}\n`;
  /* X축 헤더: background를 dynStyle로 주입 → sticky 배경도 정확히 반영 */
  css += `.m-ghd{background:${c.mxGBg};color:${c.mxGC}}\n`;
  css += `.m-sghd{background:${c.mxSgBg};color:${c.mxSgC||'var(--text-3)'};width:${ss.colW}px;min-width:${ss.colW}px}\n`;
  css += `.m-subcat{width:${ss.subCatW}px;min-width:${ss.subCatW}px;color:${c.mxCC||'var(--text-3)'}}\n`;
  css += `.m-cathd{width:${ss.catW}px;min-width:${ss.catW}px;color:${c.mxCC||'var(--text-2)'}}\n`;
  css += `.m-corner{width:${ss.catW + ss.subCatW}px}\n`;
  css += `.m-subcat,.m-cathd,.m-corner{background:${c.mxCBg}}\n`;
  css += `.m-cell.dov{background:${c.mxGBg} !important}\n`;
  css += `.cell-cnt{background:${c.mxCBg};color:${c.mxGC}}\n`;
  css += `.mitem{margin-bottom:${ss.cardGap}px;border-radius:${ss.cardRadius}px}\n`;
  css += `.item-name{font-size:${ss.cardFont}px}\n`;
  document.getElementById('dynStyle').textContent = css;
}

export function toggleTheme() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeBtn').textContent = isDark ? '🌙' : '☀️';
  applyVars();
  window.__sobukRenderAll?.();
}

export function applyTheme(tid) {
  if (!THEMES[tid]) return;
  S.settings.themeId = tid;
  S.settings.customColors = { light:{}, dark:{} };
  save();
  applyVars();
  window.__sobukRenderAll?.();
  renderThemeGrid();
  updateDesignContent();
  notify(`테마 적용: ${THEMES[tid].name}`);
}

export function renderThemeGrid() {
  const el   = document.getElementById('themeGrid');
  if (!el) return;
  const mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  el.innerHTML = Object.entries(THEMES).map(([tid, th]) => {
    const tc = th[mode], on = tid === S.settings.themeId;
    return `<div class="theme-card${on?' on':''}" onclick="applyTheme('${tid}')">
      <div class="theme-swatches">
        <div class="theme-swatch" style="background:${tc.pHigh}"></div>
        <div class="theme-swatch" style="background:${tc.pMid}"></div>
        <div class="theme-swatch" style="background:${tc.mxGBg}"></div>
      </div>
      <div class="theme-name">${th.name}</div>
    </div>`;
  }).join('');
}

export function setCustomColor(k, v) {
  const mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  if (!S.settings.customColors[mode]) S.settings.customColors[mode] = {};
  S.settings.customColors[mode][k] = v;
  save();
  applyVars();
  updateDesignContent();
  if (document.getElementById('scs')?.classList.contains('on')) {
    renderPrioStyleRows();
    renderPreviewCards();
  }
}

export function updateDesignContent() {
  const el = document.getElementById('designContent');
  if (!el) return;
  const c = getColors();
  const grps = [
    { ttl:'보더', items:[{id:'mxBorder', lbl:'보더 색상'}] },
    { ttl:'X축 헤더 (그룹)', items:[
      {id:'mxGBg', lbl:'배경색'}, {id:'mxGC', lbl:'텍스트 색'}
    ]},
    { ttl:'X축 서브헤더 (서브그룹)', items:[
      {id:'mxSgBg', lbl:'배경색'}, {id:'mxSgC', lbl:'텍스트 색'}
    ]},
    { ttl:'Y축 헤더·서브헤더 (카테고리)', items:[
      {id:'mxCBg', lbl:'배경색'}, {id:'mxCC', lbl:'텍스트 색'}
    ]}
  ];
  const colorRow = (id, lbl) => {
    const val = c[id] || '#888888';
    return `<div class="crow">
      <span class="crow-lbl">${lbl}</span>
      <div style="display:flex;align-items:center;gap:5px">
        <input type="color" value="${val}" class="cpick" onchange="onCP(this,'${id}')">
        <input type="text" value="${val}" class="hexinp" maxlength="7" onchange="onHex(this,'${id}')" onkeyup="onHexKey(this,'${id}')" placeholder="#RRGGBB">
      </div>
    </div>`;
  };
  let h = `<div class="crow" style="border-bottom:1px solid var(--border);padding:8px 0">
    <span style="font-size:.8125rem;font-weight:500;color:var(--text)">보더 두께</span>
    <div style="display:flex;align-items:center;gap:5px">
      <button class="stepbtn" onclick="adjBW(-1)">−</button>
      <span id="dBW" style="font-size:.8125rem;font-weight:600;min-width:32px;text-align:center">${c.mxBW}px</span>
      <button class="stepbtn" onclick="adjBW(1)">+</button>
    </div>
  </div>`;
  grps.forEach(grp => {
    h += `<div class="sec-ttl">${grp.ttl}</div>`;
    grp.items.forEach(item => { h += colorRow(item.id, item.lbl); });
  });
  el.innerHTML = h;
}

export function getPresetCSS(pid, pHex, pBg) {
  switch(pid) {
    case 'left-thin':  return `border:1px solid #E4E2DE;border-left:2px solid ${pHex};background:var(--surface)`;
    case 'left-thick': return `border:1px solid #E4E2DE;border-left:4px solid ${pHex};background:var(--surface)`;
    case 'all-thin':   return `border:1.5px solid ${pHex};background:var(--surface)`;
    case 'all-thick':  return `border:2.5px solid ${pHex};background:var(--surface)`;
    case 'dashed':     return `border:1.5px dashed ${pHex};background:var(--surface)`;
    case 'bg-fill':    return `border:1px solid ${pHex};background:${pBg}`;
    case 'none':       return `border:1px solid #E4E2DE;background:var(--surface)`;
    default:           return `border:1px solid #E4E2DE;border-left:4px solid ${pHex};background:var(--surface)`;
  }
}

export function renderPrioStyleRows() {
  const el = document.getElementById('prioStyleRows');
  if (!el) return;
  const c     = getColors();
  const pDefs = [{val:'상',pk:'high'},{val:'중',pk:'mid'},{val:'하',pk:'low'}];
  el.innerHTML = pDefs.map(pd => {
    const pid  = S.settings.priorityStyles[pd.pk];
    const pkC  = pd.pk[0].toUpperCase() + pd.pk.slice(1);
    const pHex = c[`p${pkC}`]   || '#888888';
    const pBg  = c[`p${pkC}Bg`] || '#eeeeee';
    const presetBtns = PRESETS.map(pr =>
      `<div class="preset-btn${pid===pr.id?' on':''}" onclick="setPreset('${pd.pk}','${pr.id}')">
         <div class="preset-prev" style="${getPresetCSS(pr.id,pHex,pBg)}"></div>
         <div class="preset-lbl">${pr.label}</div>
       </div>`
    ).join('');
    return `<div style="padding:7px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:.8rem;font-weight:600;color:var(--text);margin-bottom:5px">${pd.val} 우선순위</div>
      <div class="preset-grid">${presetBtns}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
        <div>
          <div style="font-size:.72rem;color:var(--text-3);margin-bottom:3px">포인트 색상</div>
          <div style="display:flex;gap:5px;align-items:center">
            <input type="color" value="${pHex}" class="cpick" onchange="onCP(this,'p${pkC}')">
            <input type="text" value="${pHex}" class="hexinp" maxlength="7" onchange="onHex(this,'p${pkC}')" onkeyup="onHexKey(this,'p${pkC}')" placeholder="#RRGGBB">
          </div>
        </div>
        <div>
          <div style="font-size:.72rem;color:var(--text-3);margin-bottom:3px">배경 색상</div>
          <div style="display:flex;gap:5px;align-items:center">
            <input type="color" value="${pBg}" class="cpick" onchange="onCP(this,'p${pkC}Bg')">
            <input type="text" value="${pBg}" class="hexinp" maxlength="7" onchange="onHex(this,'p${pkC}Bg')" onkeyup="onHexKey(this,'p${pkC}Bg')" placeholder="#RRGGBB">
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

export function renderPreviewCards() {
  const el = document.getElementById('previewCards');
  if (!el) return;
  const c     = getColors();
  const items = [{pk:'high',name:'결제 처리',key:'N0011'},{pk:'mid',name:'알림 발송',key:'N0014'},{pk:'low',name:'구버전 API',key:'N0013'}];
  el.innerHTML = items.map(pd => {
    const pkC  = pd.pk[0].toUpperCase() + pd.pk.slice(1);
    const pHex = c[`p${pkC}`]   || '#888';
    const pBg  = c[`p${pkC}Bg`] || '#eee';
    const cs   = `${getPresetCSS(S.settings.priorityStyles[pd.pk],pHex,pBg)};border-radius:${S.settings.cardRadius}px;padding:5px 7px;flex:1`;
    return `<div style="${cs}">
      <div style="font-size:.6rem;color:var(--text-3);margin-bottom:2px">${pd.key}</div>
      <div style="font-size:.78rem;font-weight:600;color:var(--text)">${pd.name}</div>
      <div style="font-size:.66rem;color:var(--text-3)">홍길동</div>
    </div>`;
  }).join('');
}

export function setPreset(pk, pid) {
  S.settings.priorityStyles[pk] = pid;
  save();
  window.__sobukRenderAll?.();
  renderPrioStyleRows();
  renderPreviewCards();
}

export function onCP(inp, ckey)    { inp.parentNode.querySelector('.hexinp').value = inp.value; setCustomColor(ckey, inp.value); }
export function onHex(inp, ckey)   { const v = inp.value.trim(); if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return; inp.parentNode.querySelector('.cpick').value = v; setCustomColor(ckey, v); }
export function onHexKey(inp, ckey){ if (/^#[0-9A-Fa-f]{6}$/.test(inp.value.trim())) onHex(inp, ckey); }
export function adjBW(d)           { const c = getColors(); const next = Math.max(1, Math.min(4, (c.mxBW||1) + d)); setCustomColor('mxBW', next); const el = document.getElementById('dBW'); if (el) el.textContent = `${next}px`; }

export function applyBlurSetting() {
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion:reduce)').matches ?? false;
  document.querySelectorAll('.ov').forEach(el => {
    if (!prefersReduced && S.settings.animations?.blur) el.classList.add('blur-bg');
    else el.classList.remove('blur-bg');
  });
}
