/* ══════════════════════════════════════════
   theme.js — 색상 계산, CSS 변수 주입, 테마 전환
══════════════════════════════════════════ */

import { THEMES } from './constants.js';
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
  const next   = !isDark;
  html.setAttribute('data-theme', next ? 'dark' : 'light');
  applyVars();
  window.__sobukRenderAll?.();
  /* React ThemeContext 동기화 (Header.jsx 아이콘 전환) */
  window.__themeRefresh?.(next);
}

export function applyTheme(tid) {
  if (!THEMES[tid]) return;
  S.settings.themeId = tid;
  S.settings.customColors = { light:{}, dark:{} };
  save();
  applyVars();
  window.__sobukRenderAll?.();
  notify(`테마 적용: ${THEMES[tid].name}`);
}

export function renderThemeGrid() {
  // React SettingsDesignPanel renders the theme grid.
}

export function setCustomColor(k, v) {
  const mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  if (!S.settings.customColors[mode]) S.settings.customColors[mode] = {};
  S.settings.customColors[mode][k] = v;
  save();
  applyVars();
}

export function updateDesignContent() {
  // React SettingsDesignPanel renders design color controls.
}

export function getPresetCSS(pid, pHex, pBg) {
  switch(pid) {
    case 'left-thin':  return `border:1px solid var(--border);border-left:2px solid ${pHex};background:var(--surface)`;
    case 'left-thick': return `border:1px solid var(--border);border-left:4px solid ${pHex};background:var(--surface)`;
    case 'all-thin':   return `border:1.5px solid ${pHex};background:var(--surface)`;
    case 'all-thick':  return `border:2.5px solid ${pHex};background:var(--surface)`;
    case 'dashed':     return `border:1.5px dashed ${pHex};background:var(--surface)`;
    case 'bg-fill':    return `border:1px solid ${pHex};background:${pBg}`;
    case 'none':       return `border:1px solid var(--border);background:var(--surface)`;
    default:           return `border:1px solid var(--border);border-left:4px solid ${pHex};background:var(--surface)`;
  }
}

export function renderPrioStyleRows() {
  // React SettingsDesignPanel renders priority style rows.
}

export function renderPreviewCards() {
  // React SettingsDesignPanel renders preview cards.
}

export function setPreset(pk, pid) {
  S.settings.priorityStyles[pk] = pid;
  save();
  window.__sobukRenderAll?.();
}

export function onCP(inp, ckey)    { setCustomColor(ckey, inp.value); }
export function onHex(inp, ckey)   { const v = inp.value.trim(); if (/^#[0-9A-Fa-f]{6}$/.test(v)) setCustomColor(ckey, v); }
export function onHexKey(inp, ckey){ if (/^#[0-9A-Fa-f]{6}$/.test(inp.value.trim())) onHex(inp, ckey); }
export function adjBW(d)           { const c = getColors(); const next = Math.max(1, Math.min(4, (c.mxBW||1) + d)); setCustomColor('mxBW', next); }

export function applyBlurSetting() {
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion:reduce)').matches ?? false;
  window.__applyOverlayBlur?.(!prefersReduced && S.settings.animations?.blur);
}
