#!/usr/bin/env node
/* React/esbuild single-file bundle.
   Usage: npm run build
   Output: dist/index.html, then copied to featureMatrix-server/static/index.html.
*/

const fs     = require('fs');
const path   = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

/* ── 버전 정보 수집 ── */
function getBuildMeta() {
  // VERSION 파일 (단일 진실 원천)
  const versionFile = path.join(ROOT, '..', 'VERSION');
  const version = fs.existsSync(versionFile)
    ? fs.readFileSync(versionFile, 'utf8').trim()
    : require('./package.json').version;

  // git 커밋 해시
  let gitHash = 'unknown';
  try {
    gitHash = execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] })
      .toString().trim();
  } catch (_) {}

  // 빌드 날짜 + CI 런 번호
  const now = new Date();
  const buildDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const runNumber = process.env.GITHUB_RUN_NUMBER || 'local';
  const buildId = `${buildDate}.${runNumber}`;

  return { version, gitHash, buildId };
}

/* ── TypeScript resolve plugin: .js/.jsx 임포트를 .ts/.tsx로 fallback ── */
const tsJsResolvePlugin = {
  name: 'ts-js-resolve',
  setup(build) {
    build.onResolve({ filter: /\.(js|jsx)$/ }, args => {
      if (!args.resolveDir) return undefined;
      const base = path.resolve(args.resolveDir, args.path).replace(/\.(js|jsx)$/, '');
      for (const ext of ['.tsx', '.ts']) {
        if (fs.existsSync(base + ext)) return { path: base + ext };
      }
      return undefined;
    });
  },
};

async function build() {
  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch(e) {
    console.error('❌ esbuild 가 설치되지 않았습니다. 먼저 실행하세요:');
    console.error('   cd src && npm install');
    process.exit(1);
  }

  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

  const { version, gitHash, buildId } = getBuildMeta();
  console.log(`📦 버전: v${version}  빌드: ${buildId}  커밋: ${gitHash}`);

  /* ── 1. esbuild 로 JS 번들 생성 ── */
  const entryJsx = path.join(ROOT, 'main.tsx');
  if (!fs.existsSync(entryJsx)) {
    console.error('React entry not found: src/main.tsx');
    process.exit(1);
  }

  const bundleResult = await esbuild.build({
    entryPoints: [entryJsx],
    bundle: true,
    write: false,          // 메모리에서 결과 받기
    format: 'iife',        // 즉시실행함수 래핑 → 전역 오염 없음
    target: ['es2020'],
    treeShaking: true,
    logLevel: 'info',
    jsx: 'automatic',            // React 17+ 자동 runtime (import 불필요)
    jsxImportSource: 'react',
    define: {
      // 빌드 시점 버전 정보 주입 (런타임에서 new Date() 사용 금지)
      __APP_VERSION__: JSON.stringify(version),
      __BUILD_ID__:    JSON.stringify(buildId),
      __GIT_HASH__:    JSON.stringify(gitHash),
      // Zustand devtools 프로덕션 비활성화
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    },
    plugins: [tsJsResolvePlugin],
  });

  if (bundleResult.errors.length) {
    console.error('❌ 번들링 오류:', bundleResult.errors);
    process.exit(1);
  }

  let jsBundle = bundleResult.outputFiles[0].text;

  /* ── 2. </script> 이스케이프 ── */
  const safeScript = jsBundle.replace(/<\/script>/gi, '<\\/script>');

  const fullScript = safeScript;

  /* ── 3. HTML 읽기 & 치환 ── */
  const katexCss = fs.readFileSync(require.resolve('katex/dist/katex.min.css'), 'utf8');
  const css  = `${katexCss}\n${fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8')}`;
  let html   = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  html = html.replace(
    /<link\s+rel="stylesheet"\s+href="style\.css"[^>]*>/,
    () => `<style>\n${css}\n</style>`
  );
  // main.jsx(React) 또는 기존 main.js 플레이스홀더를 번들로 교체
  html = html.replace(
    /<script\s+type="module"\s+src="(?:main\.jsx|app\/main\.js)"><\/script>/,
    () => `<script>\n'use strict';\n${fullScript}\n</script>`
  );

  /* ── 4. 출력 ── */
  const outPath = path.join(DIST, 'index.html');
  fs.writeFileSync(outPath, html, 'utf8');

  const bundleKB = Math.round(fs.statSync(outPath).size / 1024);
  console.log('✅ 빌드 완료! (esbuild)');
  console.log(`   출력: dist/index.html (${bundleKB}KB)`);
  console.log(`   버전: v${version} (build ${buildId})`);
  console.log(`   서버 없이 더블클릭으로 실행 가능`);

  /* ── 5. 서버 static 자동 복사 ── */
  const serverStatic = path.join(ROOT, '..', 'featureMatrix-server', 'static');
  if (fs.existsSync(serverStatic)) {
    const dest = path.join(serverStatic, 'index.html');
    fs.copyFileSync(outPath, dest);
    console.log(`   서버 복사: featureMatrix-server/static/index.html`);
  }
}

build().catch(e => { console.error(e); process.exit(1); });
