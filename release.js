#!/usr/bin/env node
/**
 * release.js — 버전 올리기 + git tag + push 자동화
 * 사용법: node release.js <version>
 * 예시:   node release.js 1.0.2
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/* ── 유틸 ── */
function run(cmd, silent = false) {
  if (!silent) console.log(`  $ ${cmd}`);
  return execSync(cmd, { stdio: silent ? ['pipe', 'pipe', 'pipe'] : 'inherit', encoding: 'utf8' });
}

function fail(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

/* ── 1. 버전 인자 검증 ── */
const newVersion = process.argv[2];
if (!newVersion) fail('버전을 입력해주세요.\n   사용법: node release.js 1.0.2');
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) fail(`버전 형식이 잘못됐습니다: "${newVersion}"\n   올바른 형식: 1.0.2`);

/* ── 2. 현재 브랜치 확인 ── */
const branch = run('git rev-parse --abbrev-ref HEAD', true).trim();
if (branch !== 'main') fail(`main 브랜치에서만 릴리즈할 수 있습니다. (현재: ${branch})`);

/* ── 3. 워킹트리 클린 확인 ── */
const dirty = run('git status --porcelain', true).trim();
if (dirty) fail(`커밋되지 않은 변경사항이 있습니다. 먼저 커밋해주세요.\n${dirty}`);

/* ── 4. 현재 VERSION 확인 ── */
const versionFile = path.join(__dirname, 'VERSION');
const currentVersion = fs.readFileSync(versionFile, 'utf8').trim();
if (currentVersion === newVersion) fail(`이미 ${newVersion} 버전입니다.`);

/* ── 5. 태그 중복 확인 ── */
const existingTags = run('git tag', true).trim().split('\n');
if (existingTags.includes(`v${newVersion}`)) fail(`태그 v${newVersion} 이 이미 존재합니다.`);

/* ── 실행 확인 ── */
console.log(`
🚀 릴리즈 준비
   현재 버전: v${currentVersion}
   새 버전:   v${newVersion}
   브랜치:    ${branch}
`);

/* ── 6. VERSION 파일 업데이트 ── */
console.log('📝 VERSION 파일 업데이트...');
fs.writeFileSync(versionFile, `${newVersion}\n`, 'utf8');

/* ── 7. git commit + push ── */
console.log('\n📦 커밋 및 push...');
run(`git add VERSION`);
run(`git commit -m "chore: bump version to ${newVersion}"`);
run(`git push origin main`);

/* ── 8. git tag + push → GitHub Actions 트리거 ── */
console.log('\n🏷️  태그 생성 및 push...');
run(`git tag v${newVersion}`);
run(`git push origin v${newVersion}`);

console.log(`
✅ 완료! v${newVersion} 릴리즈 시작됨

GitHub Actions가 자동으로 처리합니다:
  - Docker 이미지 빌드 → ghcr.io (latest, ${newVersion}, ...)
  - GitHub Releases 페이지 생성

진행 상황 확인:
  https://github.com/antny-bot/featureMatrix-Server/actions
`);
