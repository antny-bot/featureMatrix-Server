# 빌드번호 및 버전 관리 체계

## 문제점 (개선 전)

| 항목 | 기존 상태 | 문제 |
|------|-----------|------|
| 빌드번호 생성 | 브라우저 런타임, `new Date()` 기반 | 새로고침마다 바뀜, 빌드와 무관 |
| 버전 진실 원천 | 없음 (여러 곳에 분산) | `package.json`, `constants.js`, `settings.version` 불일치 가능 |
| Docker 태그 | main → latest, git tag → semver | 빌드번호가 이미지에 포함 안 됨 |
| CI 빌드번호 | GitHub Actions run number 미활용 | 추적 불가 |

---

## 설계 원칙

```
진실 원천: VERSION 파일 (단일)
    ↓
빌드 시점 주입 (build-esbuild.js → esbuild define)
    ↓
번들에 상수로 고정 (__APP_VERSION__, __BUILD_ID__, __GIT_HASH__)
    ↓
Docker 이미지 레이블 + 태그로 전파
```

---

## 버전 포맷

| 상황 | 형식 | 예시 |
|------|------|------|
| `VERSION` 파일 | `MAJOR.MINOR.PATCH` | `1.0.2` |
| UI 표시 | `vMAJOR.MINOR.PATCH (build YYYYMMDD.N)` | `v1.0.2 (build 20260411.47)` |
| Docker 릴리즈 태그 | `1.0.2`, `1.0`, `1`, `latest` | git tag `v1.0.2` push 시 |
| Docker 스냅샷 태그 | `edge`, `sha-abc1234` | main 브랜치 push 시 |

- `YYYYMMDD` = **빌드 날짜** (런타임 아님, 빌드 시 고정)
- `N` = `GITHUB_RUN_NUMBER` (로컬 빌드는 `local`)

---

## 파일 역할

| 파일 | 역할 |
|------|------|
| `VERSION` | 단일 진실 원천. 릴리즈 시 이 파일만 수정 |
| `src/package.json` | `version` 필드를 `VERSION`과 동기화 유지 |
| `src/build-esbuild.js` | 빌드 시 VERSION 읽어서 esbuild `define`으로 번들에 주입 |
| `src/app/main.js` | `__APP_VERSION__`, `__BUILD_ID__` 상수 사용 (런타임 생성 없음) |
| `.github/workflows/docker-publish.yml` | VERSION 파일과 git tag 일치 검증 후 GHCR 배포 |

---

## 번들 주입 상수

`build-esbuild.js`가 esbuild `define`으로 주입하는 전역 상수:

| 상수 | 값 | 예시 |
|------|-----|------|
| `__APP_VERSION__` | `VERSION` 파일 내용 | `"1.0.2"` |
| `__BUILD_ID__` | `YYYYMMDD.GITHUB_RUN_NUMBER` | `"20260411.47"` (로컬: `"20260411.local"`) |
| `__GIT_HASH__` | `git rev-parse --short HEAD` | `"abc1234"` |

---

## GitHub Actions 릴리즈 플로우

### main 브랜치 push (스냅샷)
```
git push origin main
    ↓
GitHub Actions 트리거
    ↓
Docker 빌드 + GHCR push
    ghcr.io/antny-bot/featurematrix-server:edge
    ghcr.io/antny-bot/featurematrix-server:sha-{short_sha}
```

### git tag push (정식 릴리즈)
```
git tag v1.0.2 && git push origin v1.0.2
    ↓
GitHub Actions 트리거
    ↓
VERSION 파일 vs 태그 일치 검증 (불일치 시 빌드 실패)
    ↓
Docker 빌드 + GHCR push
    ghcr.io/antny-bot/featurematrix-server:1.0.2
    ghcr.io/antny-bot/featurematrix-server:1.0
    ghcr.io/antny-bot/featurematrix-server:1
    ghcr.io/antny-bot/featurematrix-server:latest
```

---

## 릴리즈 절차 (개발자 워크플로우)

```bash
# 1. VERSION 파일 올리기
echo "1.0.2" > VERSION

# 2. package.json 동기화
# src/package.json의 "version" 필드도 동일하게 수정

# 3. 커밋
git add VERSION src/package.json
git commit -m "chore: bump version to 1.0.2"

# 4. 태그 push → GitHub Actions가 Docker 릴리즈 자동 실행
git tag v1.0.2
git push origin main --tags
```

> **주의**: git tag의 `v` 접두사를 제거한 값이 `VERSION` 파일 내용과 일치해야 합니다.  
> 불일치 시 GitHub Actions에서 빌드가 실패합니다.

---

## 로컬 개발 빌드

```bash
cd src
npm run build
# → dist/index.html에 __APP_VERSION__, __BUILD_ID__=YYYYMMDD.local 주입됨
# → featureMatrix-server/static/index.html 자동 복사
```

UI 표시 예시: `v1.0.2 (build 20260411.local)`
