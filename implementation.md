# featureMatrix-ServerAdmin Implementation Guide

이 문서는 개발자용 구조 문서다. 현재 코드 기준으로 프런트엔드, 서버, 저장 방식, 빌드 흐름을 빠르게 파악할 수 있도록 정리한다.

## 문서 역할

- `README.md`: 사용자와 운영자 관점의 설치, 실행, 기능 소개
- `implementation.md`: 개발자 관점의 구조, 상태 흐름, 수정 포인트

## 저장소 구성

```text
featureMatrix-ServerAdmin/
├─ src/
│  ├─ index.html
│  ├─ style.css
│  ├─ build.js
│  ├─ build-esbuild.js
│  ├─ package.json
│  ├─ dist/
│  │  └─ index.html
│  └─ app/
│     ├─ admin.js
│     ├─ board.js
│     ├─ constants.js
│     ├─ dashboard.js
│     ├─ io.js
│     ├─ main.js
│     ├─ modal.js
│     ├─ render.js
│     ├─ settings.js
│     ├─ state.js
│     └─ theme.js
├─ featureMatrix-server/
│  ├─ server.py
│  ├─ requirements.txt
│  ├─ config.json
│  ├─ data.json
│  ├─ activity.json
│  ├─ tokens.json
│  └─ static/
│     └─ index.html
├─ Dockerfile
├─ docker-compose.yml
├─ VERSION
├─ release.js
├─ README.md
└─ implementation.md
```

## 아키텍처 개요

### 프런트엔드

- 순수 HTML/CSS/JavaScript 기반이다.
- `src/app/main.js`가 런타임 진입점이다.
- 앱 상태는 `src/app/state.js`의 전역 객체 `S`에 모인다.
- 대부분의 UI 이벤트는 인라인 HTML 이벤트와 `window` 바인딩을 통해 호출된다.
- 빌드 결과는 단일 HTML 파일이다.

### 서버

- `featureMatrix-server/server.py` 하나로 구성된 단순 Flask 서버다.
- 정적 파일 서빙과 JSON API를 함께 처리한다.
- 인증은 관리자/편집자 토큰 기반이다.
- 편집 락은 메모리에서 관리하고, 데이터와 로그는 JSON 파일로 저장한다.

## 프런트엔드 모듈 책임

### `src/app/constants.js`

- 데이터 스키마 버전 `DATA_VERSION`
- 마이그레이션 맵 `MIGRATIONS`
- 상태값, 테마, 기본 컬럼 정의
- 데모 데이터 `DEMO`

현재 기준 상태 옵션:

- `대기`
- `시작가능`
- `진행중`
- `검토중`
- `완료`

### `src/app/state.js`

핵심 상태와 저장 로직이 모여 있는 중심 파일이다.

주요 책임:

- 전역 상태 `S`
- 로컬 저장과 복원
- 서버 저장, 로드, 폴링
- 공유 설정과 개인 설정 분리
- Undo stack
- 활동 로그 전송
- 편집 락 동기화
- 공통 유틸리티 (`apiFetch`, `notify`, `fmtDate`, `genKey` 등)

#### 전역 상태 `S`

대표 필드:

- `items`
- `changeLog`
- `view`
- `filters`
- `display`
- `settings`
- `sort`
- `editKey`
- `importData`

#### 저장 정책

`state.js`는 서버와 로컬 저장소의 역할을 분리한다.

서버에 저장되는 공유 데이터:

- `items`
- `changeLog`
- `settings` 중 `SHARED_SETTINGS` 목록
- `dataVersion`

브라우저 로컬에 저장되는 개인 데이터:

- `display`
- `filters`
- `settings` 중 개인 설정
- 서버 연결 정보
- 사용자 이름
- 오프라인 캐시용 `items`, `changeLog`

#### 공유 설정 목록

현재 `SHARED_SETTINGS`:

- `title`
- `subtitle`
- `groupOrder`
- `catOrder`
- `dbHeroName`
- `dbSections`
- `priorityStyles`
- `customColors`
- `matrixWidth`
- `cellFold`
- `colW`
- `catW`
- `subCatW`
- `cardRadius`
- `cardGap`
- `changeLogMax`

#### 서버/로컬 로드 순서

`load()` 동작 순서:

1. `loadLocal()`로 개인 설정 복원
2. `storageMode === 'server'`이면 `loadFromServer()` 실행
3. 서버 데이터가 있으면 공유 데이터로 덮어씀

이 구조 때문에 서버 모드에서도 개인 설정은 브라우저별로 유지된다.

### `src/app/admin.js`

- 서버 모드 인증 처리
- 관리자/편집자 역할 판별
- 로그인 모달 제어
- 로그아웃
- 관리자 전용 UI 상태 동기화
- 편집자 비밀번호 변경

권한 규칙:

- 로컬 모드에서는 관리자와 편집자가 모두 true
- 서버 모드에서는 세션 스토리지의 토큰 존재 여부로 판별

### `src/app/render.js`

- 매트릭스 뷰 렌더링
- 리스트 뷰 렌더링
- 필터 적용
- 카드 렌더링
- 일괄 선택과 일괄 변경 UI
- 통계 카드 일부 렌더링

검색은 단순 텍스트와 `field:value` 문법을 함께 처리한다.

### `src/app/dashboard.js`

- 대시보드 화면 렌더링
- stats / insight / heatmap 섹션 출력
- `S.settings.dbSections` 순서 반영
- 히트맵 모드 전환

### `src/app/board.js`

- 상태별 보드 뷰 렌더링
- 카드 다중 선택
- 드래그 앤 드롭 기반 상태 변경
- 상태 이동 액션 바

보드 컬럼은 `STATUS_OPTS`를 그대로 사용한다.

### `src/app/modal.js`

- 항목 추가/수정 모달
- Markdown 편집
- 삭제, 복제, 상태 변경
- 컨텍스트 메뉴
- 드래그 후처리

아이템 필드가 늘어나면 이 파일 수정 영향이 크다.

### `src/app/io.js`

- CSV/TSV 가져오기
- 전체 JSON 백업 가져오기 / 내보내기
- TSV/XLS/HTML/MD ZIP 내보내기
- Markdown 파일 가져오기

### `src/app/settings.js`

- 설정 모달의 각 섹션 동기화
- 축 순서 편집
- 리스트 컬럼 표시/순서 제어
- 폰트, 간격, 카드, 매트릭스 폭 관련 설정 조정

### `src/app/theme.js`

- 테마 색상 계산
- 프리셋 적용
- 커스텀 색상 반영
- 디자인 미리보기 갱신

### `src/app/main.js`

런타임 오케스트레이션 파일이다.

주요 책임:

- 초기화 `init()`
- 모듈 함수의 `window` 바인딩
- 검색/필터 핸들러
- 키보드 단축키
- 서버 폴링 시작
- 서버 설정 저장
- 사용자 이름 팝업
- 대시보드 섹션 순서 드래그

새 기능을 추가할 때 실제 로직은 다른 파일에 넣고, 이 파일에는 연결만 두는 편이 안전하다.

## 서버 구현

### `featureMatrix-server/server.py`

하나의 Flask 앱으로 아래 기능을 제공한다.

- 정적 `index.html` 서빙
- 로그인 API
- 공유 데이터 조회/저장
- 폴링용 상태 조회
- 활동 로그 기록/조회
- 편집 락 설정/해제
- 편집자 비밀번호 변경

### 런타임 파일

- `config.json`: `allowed_origins`, `editor_password`
- `data.json`: 현재 공유 데이터
- `activity.json`: 활동 로그
- `tokens.json`: 관리자 토큰 영속 저장

데이터 저장 위치는 기본적으로 `featureMatrix-server/` 내부지만, `FEATURE_MATRIX_DATA_DIR` 환경변수로 바꿀 수 있다.

### 인증 구조

- 관리자 토큰: `X-Admin-Token`
- 편집자 토큰: `X-Editor-Token`
- 관리자 토큰은 편집 권한도 포함
- 편집자 토큰은 메모리에만 저장
- 관리자 토큰은 파일에 저장되어 재시작 후에도 일부 유지

중요한 구현 특성:

- `--admin-password`가 비어 있으면 누구나 관리자 로그인 가능
- 편집자 비밀번호가 비어 있으면 편집자 로그인은 비밀번호 없이 허용

### API 요약

- `POST /api/auth`
- `GET /api/data`
- `POST /api/data`
- `GET /api/ping`
- `GET /api/log`
- `POST /api/log`
- `POST /api/lock`
- `POST /api/unlock`
- `POST /api/set-editor-password`

### 편집 락 동작

편집 락은 서버 메모리와 클라이언트 타이머가 함께 관여한다.

- 클라이언트 자동 언락 타이머: 5분
- 서버 stale lock 정리 기준: 60초

즉, 문서상 개념은 "편집 중 락"이지만 실제 구현은 클라이언트와 서버의 TTL 기준이 일치하지 않는다. 락 관련 수정 시 `src/app/state.js`와 `featureMatrix-server/server.py`를 함께 봐야 한다.

## 데이터 모델

아이템은 대체로 아래 필드를 가진다.

```js
{
  key,
  name,
  desc,
  path,
  group,
  subGroup,
  category,
  subCategory,
  priority,
  status,
  owner,
  isDelete,
  isImportant,
  relSystem,
  memo,
  mdPath,
  mdContent,
  updatedAt
}
```

### 스키마 마이그레이션

현재 버전:

```js
export const DATA_VERSION = 2;
```

로드 시 `migrateItems(items, fromVersion)`이 `MIGRATIONS`를 순차 적용한다.

새 필드를 추가할 때는 보통 함께 봐야 한다.

- `src/app/constants.js`
- `src/app/modal.js`
- `src/app/render.js`
- `src/app/io.js`
- 데모 데이터나 초기화 로직

## 빌드 파이프라인

### 권장 빌드: `src/build-esbuild.js`

역할:

- `main.js`를 엔트리로 ES module 번들링
- `style.css`를 HTML에 인라인 삽입
- 버전 정보 주입
- 결과를 `src/dist/index.html`에 기록
- `featureMatrix-server/static/index.html`로 자동 복사

주입 상수:

- `__APP_VERSION__`
- `__BUILD_ID__`
- `__GIT_HASH__`

버전 정보 출처:

- 우선 `../VERSION`
- 없으면 `src/package.json`

### 레거시 빌드: `src/build.js`

- 정규식 기반 문자열 치환 방식
- ES module 문법을 제거해 단일 HTML로 합침
- `board.js`는 포함하지 않으므로 현재 구조 기준으로 최신 기능 빌드에는 적합하지 않다

실사용 빌드는 `npm run build` 기준으로 맞추는 편이 안전하다.

## 배포 구조

### `Dockerfile`

멀티 스테이지 빌드다.

1. Node 이미지에서 프런트엔드 빌드
2. Python 이미지에서 Flask 서버 실행
3. 빌드된 `index.html`을 서버 static 디렉터리로 복사

### `docker-compose.yml`

- 로컬 Dockerfile 빌드가 아니라 `ghcr.io/antny-bot/featurematrix-server:latest` 이미지를 사용
- `./data`를 `/app/data`에 마운트
- `ADMIN_PASSWORD`, `EDITOR_PASSWORD`, `PORT`를 환경변수로 전달

## 수정 시 체크포인트

### 프런트엔드 기능 수정

1. 상태가 바뀌는지 확인
2. `save()` 호출이 필요한지 확인
3. 어느 뷰를 다시 그려야 하는지 확인
4. HTML 인라인 이벤트가 쓰이면 `window` 바인딩 필요 여부 확인
5. 서버 모드와 로컬 모드 둘 다 깨지지 않는지 확인
6. `cd src && npm run build` 실행

### 서버 응답 변경

1. `featureMatrix-server/server.py` 수정
2. `src/app/state.js`의 `loadFromServer`, `saveToServer`, `pollServerTs` 점검
3. 필요하면 `src/app/main.js`의 폴링/배너/UI 동기화 로직 점검

### 새 필드 추가

1. 스키마와 마이그레이션 정의
2. 편집 UI 반영
3. 렌더링 반영
4. import/export 반영
5. 데모 데이터와 기본값 검토

## 추천 진입 파일

- 전체 흐름: `src/app/main.js`
- 상태/저장: `src/app/state.js`
- 인증: `src/app/admin.js`
- 매트릭스/리스트 렌더링: `src/app/render.js`
- 보드 뷰: `src/app/board.js`
- 대시보드: `src/app/dashboard.js`
- 편집 모달: `src/app/modal.js`
- 가져오기/내보내기: `src/app/io.js`
- 서버 API: `featureMatrix-server/server.py`

## 요약

이 프로젝트의 핵심은 다음 세 가지다.

1. `state.js` 중심의 전역 상태 관리
2. `main.js`를 통한 화면 연결과 `window` 바인딩
3. 서버 공유 데이터와 로컬 개인 설정의 분리

변경 범위가 조금만 넓어져도 저장, 렌더링, 권한, 빌드 결과가 함께 얽히므로 한 파일만 보고 수정하면 놓치기 쉽다.
