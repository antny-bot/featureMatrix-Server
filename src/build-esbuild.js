#!/usr/bin/env node
/* ══════════════════════════════════════════
   build-esbuild.js — esbuild 기반 번들러
   사용법: npm run build  (또는 node build-esbuild.js)
   결과:  dist/index.html (서버 없이 더블클릭 실행 가능)

   기존 build.js 와의 차이점:
   - esbuild 가 ES Module import/export 를 올바르게 처리
   - 정규표현식 문자열 치환이 아니라 실제 번들링
   - 의존성 순서를 수동으로 지정할 필요 없음
   - Tree-shaking 으로 미사용 코드 자동 제거
══════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

async function build() {
  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch(e) {
    console.error('❌ esbuild 가 설치되지 않았습니다. 먼저 실행하세요:');
    console.error('   cd src && npm install');
    console.error('\n기존 번들러(build.js)로 대신 빌드합니다...\n');
    require('./build.js');
    return;
  }

  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

  /* ── 1. esbuild 로 JS 번들 생성 ── */
  const bundleResult = await esbuild.build({
    entryPoints: [path.join(ROOT, 'app/main.js')],
    bundle: true,
    write: false,          // 메모리에서 결과 받기
    format: 'iife',        // 즉시실행함수 래핑 → 전역 오염 없음
    target: ['es2020'],
    treeShaking: true,
    logLevel: 'info',
    define: {
      // window 브릿지 → 직접 호출 (번들 내부에서는 같은 스코프)
    },
    plugins: [],
  });

  if (bundleResult.errors.length) {
    console.error('❌ 번들링 오류:', bundleResult.errors);
    process.exit(1);
  }

  let jsBundle = bundleResult.outputFiles[0].text;

  /* ── 2. window 브릿지 → 직접 호출 교체 ── */
  jsBundle = jsBundle
    .replace(/window\.__sobukRenderAll\?\.\(\)/g, 'renderAll()')
    .replace(/window\.__sobukNotify\?\.\(([^)]*)\)/g, '__inlineNotify($1)');

  /* ── 3. notify 브릿지 → 인라인 notify ── */
  jsBundle = jsBundle.replace(
    /const notify\s*=\s*\([^)]*\)\s*=>\s*window\.__sobukNotify\?\.\([^)]*\)/,
    'const notify = (msg, type = false) => __inlineNotify(msg, type)'
  );

  /* ── 4. window 브릿지 등록 제거 ── */
  jsBundle = jsBundle
    .replace(/window\.__sobukRenderAll\s*=\s*\(\)\s*=>\s*renderAll\(\)\s*;/g, '')
    .replace(/window\.__sobukNotify\s*=[\s\S]*?setTimeout[\s\S]*?2400\)\s*;\s*\};/, '');

  /* ── 5. </script> 이스케이프 ── */
  const safeScript = jsBundle.replace(/<\/script>/gi, '<\\/script>');

  /* ── 6. 인라인 notify 함수 prepend ── */
  const notifyInline = `
/* ── 인라인 notify (번들 전용) ── */
function __inlineNotify(msg, type) {
  var bgMap = { error: 'var(--danger)', warning: 'var(--warning, #D97706)', success: 'var(--success, #16A34A)' };
  var el = document.getElementById('notif');
  if (!el) return;
  el.textContent = msg;
  var key = type === true ? 'error' : type;
  el.style.background = bgMap[key] || 'var(--text)';
  el.classList.add('on');
  setTimeout(function() { el.classList.remove('on'); }, 2400);
}
`;

  const fullScript = notifyInline + '\n' + safeScript;

  /* ── 7. HTML 읽기 & 치환 ── */
  const css  = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
  let html   = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  html = html.replace(
    /<link\s+rel="stylesheet"\s+href="style\.css"[^>]*>/,
    () => `<style>\n${css}\n</style>`
  );
  html = html.replace(
    /<script\s+type="module"\s+src="app\/main\.js"><\/script>/,
    () => `<script>\n'use strict';\n${fullScript}\n</script>`
  );

  /* ── 8. 출력 ── */
  const outPath = path.join(DIST, 'index.html');
  fs.writeFileSync(outPath, html, 'utf8');

  const bundleKB = Math.round(fs.statSync(outPath).size / 1024);
  console.log('✅ 빌드 완료! (esbuild)');
  console.log(`   출력: dist/index.html (${bundleKB}KB)`);
  console.log(`   서버 없이 더블클릭으로 실행 가능`);

  /* ── 9. 서버 static 자동 복사 ── */
  const serverStatic = path.join(ROOT, '..', 'featureMatrix-server', 'static');
  if (fs.existsSync(serverStatic)) {
    const dest = path.join(serverStatic, 'index.html');
    fs.copyFileSync(outPath, dest);
    console.log(`   서버 복사: featureMatrix-server/static/index.html`);
  }
}

build().catch(e => { console.error(e); process.exit(1); });
