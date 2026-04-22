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

async function runBuild() {
  const isWatch = process.argv.includes('--watch');
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

  const entryJsx = path.join(ROOT, 'main.tsx');
  if (!fs.existsSync(entryJsx)) {
    console.error('React entry not found: src/main.tsx');
    process.exit(1);
  }

  const buildOptions = {
    entryPoints: [entryJsx],
    bundle: true,
    write: false,
    format: 'iife',
    target: ['es2020'],
    treeShaking: true,
    logLevel: 'info',
    jsx: 'automatic',
    jsxImportSource: 'react',
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __BUILD_ID__:    JSON.stringify(buildId),
      __GIT_HASH__:    JSON.stringify(gitHash),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || (isWatch ? 'development' : 'production')),
    },
    plugins: [
      tsJsResolvePlugin,
      {
        name: 'post-build-plugin',
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length > 0) return;
            
            try {
              const jsBundle = result.outputFiles[0].text;
              const safeScript = jsBundle.replace(/<\/script>/gi, '<\\/script>');

              const katexCss = fs.readFileSync(require.resolve('katex/dist/katex.min.css'), 'utf8');
              const css  = `${katexCss}\n${fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8')}`;
              let html   = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

              html = html.replace(
                /<link\s+rel="stylesheet"\s+href="style\.css"[^>]*>/,
                () => `<style>\n${css}\n</style>`
              );
              html = html.replace(
                /<script\s+type="module"\s+src="(?:main\.jsx|app\/main\.js)"><\/script>/,
                () => `<script>\n'use strict';\n${safeScript}\n</script>`
              );

              const outPath = path.join(DIST, 'index.html');
              fs.writeFileSync(outPath, html, 'utf8');

              const serverStatic = path.join(ROOT, '..', 'featureMatrix-server', 'static');
              if (fs.existsSync(serverStatic)) {
                fs.copyFileSync(outPath, path.join(serverStatic, 'index.html'));
              }
              
              console.log(`✅ [${new Date().toLocaleTimeString()}] 빌드 완료 및 복사 성공`);
            } catch (err) {
              console.error('❌ 포스트 빌드 처리 중 오류 발생:', err);
            }
          });
        },
      },
    ],
  };

  if (isWatch) {
    console.log('🚀 Watch 모드 시작... 파일 수정 시 자동으로 빌드됩니다.');
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
  } else {
    await esbuild.build(buildOptions);
    console.log('✅ 단일 빌드 완료.');
  }
}

runBuild().catch(e => { console.error(e); process.exit(1); });
