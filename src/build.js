#!/usr/bin/env node
/* ══════════════════════════════════════════
   build.js — 소복 매트릭스 번들러
   사용법: node build.js
   결과:  dist/index.html (서버 없이 더블클릭 실행 가능)
══════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

/* ── JS 파일 순서 (의존성 순) ── */
const JS_ORDER = [
  'app/constants.js',
  'app/state.js',
  'app/admin.js',
  'app/theme.js',
  'app/render.js',
  'app/modal.js',
  'app/io.js',
  'app/settings.js',
  'app/dashboard.js',
  'app/main.js',
];

/* ── ES Module 문법 제거 ── */
function stripModuleSyntax(code) {
  // 멀티라인 import { ... } from '...' 제거
  code = code.replace(/^import\s*\{[^}]*\}\s*from\s*['"][^'"]*['"]\s*;?/gms, '');
  // 싱글라인 import
  code = code.replace(/^\s*import\s+.*?from\s*['"][^'"]*['"]\s*;?\s*$/gm, '');
  // import '...'
  code = code.replace(/^\s*import\s+['"][^'"]*['"]\s*;?\s*$/gm, '');
  // export default
  code = code.replace(/^\s*export\s+default\s+/gm, '');
  // export const/let/function/class → export 키워드만 제거
  code = code.replace(/^\s*export\s+(const|let|var|function|class|async\s+function)\s+/gm, '$1 ');
  // export { a, b }
  code = code.replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
  return code;
}

/* ── window.* 바인딩 제거 (번들에선 전역 스코프라 불필요) ── */
function removeWindowBindings(code) {
  return code.replace(/Object\.assign\(window\s*,\s*\{[\s\S]*?\}\s*\)\s*;/g,
    '/* window bindings: 번들에서는 불필요 */');
}

/* ── window 브릿지 → 직접 호출로 교체 ── */
function fixWindowBridge(code) {
  return code
    .replace(/window\.__sobukRenderAll\?\.\(\)/g, 'renderAll()')
    .replace(/window\.__sobukNotify\?\.\(([^)]*)\)/g, '__inlineNotify($1)');
}

/* ── state.js의 notify 위임 → 인라인 notify로 교체 ── */
function fixNotifyBridge(code) {
  return code.replace(
    /const notify\s*=\s*\(msg,\s*isErr=false\)\s*=>\s*window\.__sobukNotify\?\.\(msg,\s*isErr\)/,
    'const notify = (msg, isErr=false) => __inlineNotify(msg, isErr)'
  );
}

/* ── 빌드 실행 ── */
function build() {
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

  // CSS 읽기
  const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');

  // JS 파일들 합치기
  let jsBundle = JS_ORDER.map(relPath => {
    let code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    code = stripModuleSyntax(code);
    code = fixWindowBridge(code);
    if (relPath === 'app/state.js') code = fixNotifyBridge(code);
    if (relPath === 'app/main.js')  code = removeWindowBindings(code);
    return `\n/* ── ${relPath} ── */\n${code}`;
  }).join('\n');

  // window 브릿지 등록 코드 제거 (main.js 안에 있는 것)
  jsBundle = jsBundle.replace(
    /window\.__sobukRenderAll\s*=\s*\(\)\s*=>\s*renderAll\(\)\s*;/g,
    '/* __sobukRenderAll: 번들에서는 직접 호출 */'
  );
  jsBundle = jsBundle.replace(
    /window\.__sobukNotify\s*=[\s\S]*?setTimeout[\s\S]*?2400\)\s*;\s*\};/,
    '/* __sobukNotify: 번들에서는 __inlineNotify 사용 */'
  );

  // 인라인 notify 함수
  const notifyInline = `
/* ── 인라인 notify (번들 전용) ── */
function __inlineNotify(msg, isErr) {
  var el = document.getElementById('notif');
  if (!el) return;
  el.textContent = msg;
  el.style.background = isErr ? 'var(--danger)' : 'var(--text)';
  el.classList.add('on');
  setTimeout(function() { el.classList.remove('on'); }, 2400);
}
`;

  // 전체 스크립트 합치기
  const fullScript = notifyInline + '\n' + jsBundle;

  // ★ 핵심 수정: JS 안에 </script> 문자열이 있으면 HTML 파서가 오작동
  //   → <\/script> 로 이스케이프
  const safeScript = fullScript.replace(/<\/script>/gi, '<\\/script>');

  // HTML 읽기
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  // style.css → 인라인 <style>
  // ★ fonts/noto-sans-kr.css 는 로컬 폰트 링크이므로 그대로 유지
  // ★ 오직 href="style.css" 링크만 인라인으로 치환
  html = html.replace(
    /<link\s+rel="stylesheet"\s+href="style\.css"[^>]*>/,
    () => `<style>\n${css}\n</style>`
  );

  // <script type="module"> → 인라인 <script>
  // ★ 핵심 수정: replacement를 함수로 전달
  html = html.replace(
    /<script\s+type="module"\s+src="app\/main\.js"><\/script>/,
    () => `<script>\n'use strict';\n${safeScript}\n</script>`
  );

  const outPath = path.join(DIST, 'index.html');
  fs.writeFileSync(outPath, html, 'utf8');

  const bundleKB = Math.round(fs.statSync(outPath).size / 1024);
  console.log('✅ 빌드 완료!');
  console.log(`   출력: dist/index.html (${bundleKB}KB)`);
  console.log(`   서버 없이 더블클릭으로 실행 가능`);

  // featureMatrix-server/static/ 에도 자동 복사
  const serverStatic = path.join(ROOT, '..', 'featureMatrix-server', 'static');
  if (fs.existsSync(serverStatic)) {
    const dest = path.join(serverStatic, 'index.html');
    fs.copyFileSync(outPath, dest);
    console.log(`   서버 복사: featureMatrix-server/static/index.html`);
  }
}

build();
