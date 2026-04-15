#!/usr/bin/env node
/**
 * release.js — 버전 올리기 + git tag + push 자동화
 *
 * 사용법: node release.js <version>
 * 예시:   node release.js 1.0.2
 *
 * ─────────────────────────────────────────────────
 *  버전 번호 규칙 (Semantic Versioning)
 * ─────────────────────────────────────────────────
 *  v  MAJOR . MINOR . PATCH
 *       │       │       └─ 버그 수정, 오타 수정
 *       │       └───────── 기능 추가 (기존 기능 유지)
 *       └─────────────────  대규모 변경 (기존과 크게 달라짐)
 *
 *  언제 뭘 올리나?
 *  ┌─────────────────────────────┬──────────────────────┐
 *  │ 상황                        │ 버전 변화             │
 *  ├─────────────────────────────┼──────────────────────┤
 *  │ 버그 수정, 오타 수정        │ 1.0.1 → 1.0.2        │
 *  │ 기능 추가 (기존 기능 유지)  │ 1.0.1 → 1.1.0        │
 *  │ 전면 개편, 하위 비호환 변경 │ 1.x.x → 2.0.0        │
 *  └─────────────────────────────┴──────────────────────┘
 *
 *  규칙: 올린 자리 아래는 항상 0으로 초기화
 *    MINOR 올리면 → PATCH 0으로  (1.0.1 → 1.1.0)
 *    MAJOR 올리면 → MINOR, PATCH 모두 0으로  (1.3.2 → 2.0.0)
 *
 * ─────────────────────────────────────────────────
 *  실행 시 자동 처리 순서
 * ─────────────────────────────────────────────────
 *  1. 버전 형식 검증 (x.y.z 형태인지)
 *  2. main 브랜치 여부 확인
 *  3. 커밋 안 된 변경사항 있으면 차단
 *  4. 현재 VERSION 확인
 *  5. 태그 중복 확인
 *  6. VERSION 파일 수정
 *  7. README.md, implementation.md 버전 정보 동기화
 *  8. git commit + push
 *  9. git tag v{version} + push → GitHub Actions 트리거
 *     ├─ Docker 이미지 빌드 → GHCR (latest, x.y.z, x.y, x)
 *     └─ GitHub Releases 페이지 자동 생성
 * ─────────────────────────────────────────────────
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

function syncMarkdownFrontMatterVersion(filePath, version) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';
  const versionLine = `version: ${version}`;
  let updated;

  if (content.startsWith(`---${lineBreak}`)) {
    const closingMarker = `${lineBreak}---${lineBreak}`;
    const closingIndex = content.indexOf(closingMarker, lineBreak.length);

    if (closingIndex === -1) {
      fail(`${path.basename(filePath)}의 front matter 닫힘 표시를 찾지 못했습니다.`);
    }

    const frontMatter = content.slice(0, closingIndex);
    const body = content.slice(closingIndex);
    const nextFrontMatter = /^version:\s*\d+\.\d+\.\d+$/m.test(frontMatter)
      ? frontMatter.replace(/^version:\s*\d+\.\d+\.\d+$/m, versionLine)
      : `${frontMatter}${lineBreak}${versionLine}`;

    updated = `${nextFrontMatter}${body}`;
  } else {
    updated = `---${lineBreak}${versionLine}${lineBreak}---${lineBreak}${lineBreak}${content}`;
  }

  fs.writeFileSync(filePath, updated, 'utf8');
}

/* ── 1. 버전 인자 검증 ── */
const newVersion = process.argv[2];
if (!newVersion) fail('버전을 입력해주세요.\n   사용법: node release.js 1.0.2');
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) fail(`버전 형식이 잘못됐습니다: "${newVersion}"\n   올바른 형식: 1.0.2`);

/* ── 2. 현재 브랜치 확인 ── */
const branch = run('git rev-parse --abbrev-ref HEAD', true).trim();
if (branch !== 'main') fail(`main 브랜치에서만 릴리즈할 수 있습니다. (현재: ${branch})`);

/* ── 3. 워킹트리 클린 확인 (untracked 파일은 무시, staged/modified만 체크) ── */
const dirty = run('git status --porcelain', true)
  .split('\n')
  .filter(line => line && !line.startsWith('??'))  // ??=untracked 제외
  .join('\n').trim();
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

/* ── 7. 문서 버전 정보 동기화 ── */
console.log('📝 README.md, implementation.md 버전 정보 동기화...');
syncMarkdownFrontMatterVersion(path.join(__dirname, 'README.md'), newVersion);
syncMarkdownFrontMatterVersion(path.join(__dirname, 'implementation.md'), newVersion);

/* ── 8. git commit + push ── */
console.log('\n📦 커밋 및 push...');
run(`git add VERSION README.md implementation.md`);
run(`git commit -m "chore: bump version to ${newVersion}"`);
run(`git push origin main`);

/* ── 9. git tag + push → GitHub Actions 트리거 ── */
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
