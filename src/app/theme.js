/* ══════════════════════════════════════════
   theme.js — 색상 계산, CSS 변수 주입, 테마 전환
══════════════════════════════════════════ */

import { THEMES } from './constants.js';
import { useAppStore } from '../store/useAppStore.js';

const getStore = () => useAppStore.getState();
const notify = (msg, type = 'success') => getStore().notify?.(msg, type);

export function getColors() {
  const ss = getStore().settings;
  const tid = ss.themeId || 'sobuk';
  const mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const base = (THEMES[tid] && THEMES[tid][mode]) ? THEMES[tid][mode] : THEMES.sobuk[mode];
  const custom = (ss.customColors && ss.customColors[mode]) ? ss.customColors[mode] : {};
  return { ...base, ...custom };
}

export function applyVars() {
  const c  = getColors();
  const ss = getStore().settings;
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
  const el = document.getElementById('dynStyle');
  if (el) el.textContent = css;
}

export function toggleTheme() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const next   = !isDark;
  html.setAttribute('data-theme', next ? 'dark' : 'light');
  applyVars();
  return next;
}

export function setCustomColor(k, v) {
  const mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const ss = getStore().settings;
  const customColors = {
    ...(ss.customColors || {}),
    [mode]: {
      ...((ss.customColors && ss.customColors[mode]) || {}),
      [k]: v,
    },
  };
  useAppStore.setState({ settings: { ...ss, customColors } });
  applyVars();
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
