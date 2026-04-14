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
│  ├─ build-esbuild.js
│  ├─ package.json
│  ├─ dist/
│  │  └─ index.html
│  ├─ app/
│  │  ├─ admin.js
│  │  ├─ board.js
│  │  ├─ constants.js
│  │  ├─ io.js
│  │  ├─ main.js
│  │  ├─ modal.js
│  │  ├─ render.js
│  │  ├─ settings.js
│  │  ├─ state.js
│  │  └─ theme.js
│  ├─ components/
│  │  ├─ App.jsx
│  │  ├─ Header.jsx
│  │  ├─ DashboardView.jsx
│  │  ├─ SettingsPanel.jsx
│  │  ├─ BoardView.jsx
│  │  ├─ MatrixView.jsx
│  │  ├─ ListView.jsx
│  │  └─ ItemModal.jsx
│  └─ store/
│     └─ useAppStore.js
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

- **React 19 + Zustand v5** 중심 구조다. DOM 접근은 브라우저 API/외부 렌더(KaTeX 등)에 한정한다.
- `src/app/main.js`가 런타임 진입점이다.
- `src/components/App.jsx`가 React 루트 컴포넌트다. `index.html`의 `#app` 컨테이너에 마운트된다.
- 앱 상태는 두 군데에 존재한다.
  - `src/app/state.js`의 전역 객체 `S`: 바닐라 JS 레거시 상태
  - `src/store/useAppStore.js`의 Zustand 스토어: React 컴포넌트가 구독하는 상태
- `syncToStore()`가 `S` → Zustand 방향으로 동기화한다. 반대 방향 동기화는 없다.
- 대부분의 UI 이벤트는 React 이벤트로 처리하며, 레거시 로직은 `window` 브릿지로 최소화했다.
- 빌드 결과는 단일 HTML 파일이다.

### React 포털 전략

React 컴포넌트 중 일부는 기존 DOM 컨테이너에 `createPortal`로 주입된다. 레이아웃은 유지하면서 해당 영역만 React로 렌더링한다.

| 컴포넌트 | 포털 대상 |
|----------|-----------|
| `Header.jsx` | `#header` |
| `DashboardView.jsx` | `.dbwrap` |
| `SettingsPanel.jsx` | `.settings-body` |
| `BoardView.jsx` | `.bwrap` |
| `MatrixView.jsx` | `#matrixView` |
| `ListView.jsx` | `#listView` |
| `ItemModal.jsx` | `#editModal` |

### 브릿지 패턴 (최소 유지)

바닐라 JS 모듈이 React 상태를 조작해야 할 때는 `window.__xxx` 함수 또는 CustomEvent를 통해 간접 호출한다.

대표적인 브릿지:

- `window.__editModalBridge(mode, key)` — 편집 모달 열기
- `window.expandCell(e, ck)` / `window.collapseCell(e, ck)` — 매트릭스 셀 펼침/접기
- `window.__listViewRefresh()` — 리스트 뷰 강제 리렌더 (bulkSel 변경 시)
- `boardSelChange` / `mxSelChange` / `mxDragState` — 선택/드래그 상태 동기화

### 서버

- `featureMatrix-server/server.py` 하나로 구성된 단순 Flask 서버다.
- 정적 파일 서빙과 JSON API를 함께 처리한다.
- 인증은 관리자/편집자 토큰 기반이다.
- 편집 락은 메모리에서 관리하고, 데이터와 로그는 JSON 파일로 저장한다.

## 상태 관리 구조

### `src/app/state.js` — 전역 객체 `S`

바닐라 JS 레거시 상태 중심 파일이다. 대부분의 데이터 조작은 아직 이 파일을 통해 이루어진다.

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

`S.expandedCells`는 제거됨. 매트릭스 셀 펼침 상태는 `MatrixView.jsx`의 `useState`로 관리한다.

### `src/store/useAppStore.js` — Zustand 스토어

React 컴포넌트가 구독하는 상태 스토어다. `S`와 같은 구조를 유지한다.

- `syncToStore()`를 통해 `S` → Zustand 방향으로 동기화된다.
- `setStore(patch)` / `getStore()`로 React 외부에서도 접근 가능하다.
- `syncFromS(S)` 브릿지로 `S` 전체를 한 번에 동기화할 수 있다.

React 컴포넌트 사용 예:

```js
const items    = useAppStore(s => s.items);
const settings = useAppStore(s => s.settings);
const setView  = useAppStore(s => s.setView);
```

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

위 [상태 관리 구조](#상태-관리-구조) 참조.

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

- `buildMatrixHtml(expandedCells)` — 순수 함수, `MatrixView.jsx`에서 호출
- `buildListHtml()` — 순수 함수, `ListView.jsx`에서 호출
- `renderMatrix()` — `syncToStore()` 호출 후 React 리렌더에 위임
- `renderList()` — `syncToStore()` + `window.__listViewRefresh?.()` 호출
- 필터 적용 (`getFilteredItems`)
- 카드 렌더링 (`renderCard`)
- 일괄 선택 UI

검색은 단순 텍스트와 `field:value` 문법을 함께 처리한다.

### `src/app/board.js`

- 상태별 보드 뷰 렌더링 (카드 HTML 생성)
- `_boardSel` 모듈 변수로 선택 상태 관리 (Zustand 외부 — DOM classList 직접 조작)
- `boardSelChange` CustomEvent로 `BoardView.jsx`에 선택 상태 통지
- 드래그 앤 드롭 기반 상태 변경
- 상태 이동 액션 바

보드 컬럼은 `STATUS_OPTS`를 그대로 사용한다.

### `src/app/modal.js`

- 편집 모달 열기 (`openEditModal`, `openAddModal`) → `window.__editModalBridge` 호출
- Markdown 편집 브릿지 → `window.switchMdView`, `window.onMdInput` 등 위임
- 삭제, 복제, 상태 변경
- 컨텍스트 메뉴
- 드래그 후처리

실제 모달 UI는 `ItemModal.jsx`가 담당한다.

### `src/app/io.js`

- CSV/TSV 가져오기
- 전체 JSON 백업 가져오기 / 내보내기
- TSV/XLS/HTML/MD ZIP 내보내기
- Markdown 파일 가져오기

### `src/app/settings.js`

- 설정 조정 함수들 (`adjCellFold`, `adjColW` 등) — `setStore` 호출로 Zustand 즉시 반영
- 축 순서 편집
- 리스트 컬럼 표시/순서 제어

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

## React 컴포넌트 책임

### `src/components/App.jsx`

- React 루트 컴포넌트
- `ThemeContext` 제공
- `AuthContext` 제공
- 모든 자식 컴포넌트 마운트

### `src/components/Header.jsx`

- 상단 헤더 영역 (`#header` 포털)
- 뷰 전환 탭, 검색창, 필터 버튼
- 서버 연결 상태 배지
- Zustand `view`, `searchQ`, `serverStatus` 구독

### `src/components/DashboardView.jsx`

- 대시보드 컨테이너 (`.dbwrap` 포털)
- React 컴포넌트에서 stats / insight / heatmap 섹션을 직접 렌더링
- Zustand 변경 시 자동 리렌더

### `src/components/SettingsPanel.jsx`

- 설정 패널 (`.settings-body` 포털)
- 폰트, 간격, 카드, 매트릭스, 보드 관련 Stepper UI
- 리스트 컬럼 표시/순서 편집
- Zustand `settings`, `display` 구독

### `src/components/BoardView.jsx`

- 보드 컨테이너 (`.bwrap` 포털)
- 컬럼별 카드 HTML을 `dangerouslySetInnerHTML`로 렌더링
- `boardSelChange` CustomEvent로 선택 상태 수신
- `foldCount === 0`이면 항상 펼침 (더 보기 버튼 없음)
- 더 보기/접기 버튼은 `cell-more-btn` 클래스로 카드 목록 내부에 인라인 렌더링
- Zustand `settings.boardFoldCount` 변경 시 자동 리렌더

### `src/components/MatrixView.jsx`

- 매트릭스 컨테이너 (`#matrixView` 포털)
- `expandedCells` Set을 `useState`로 로컬 관리
- `buildMatrixHtml(expandedCells)` 순수 함수 호출 → `dangerouslySetInnerHTML`
- 필터/검색/`cellFold` 변경 시 `expandedCells` 자동 초기화
- `window.expandCell` / `window.collapseCell` 브릿지 노출 (클릭 시 React 상태 세터 호출)

### `src/components/ListView.jsx`

- 리스트 컨테이너 (`#listView` 포털)
- `buildListHtml()` 순수 함수 호출 → `dangerouslySetInnerHTML`
- `window.__listViewRefresh` 브릿지로 외부 강제 리렌더 가능 (bulkSel 변경 시)

### `src/components/ItemModal.jsx`

- 항목 추가/편집 모달 (`#editModal` 포털)
- 탭 전환, Markdown 편집/미리보기, 통계를 React 상태로 관리
- 폼 입력 필드는 uncontrolled (`id="fKey"`, `id="fName"` 등) — 바닐라 JS `saveItem()`이 `document.getElementById`로 읽음
- `window.__editModalBridge(mode, key)` 브릿지로 모달 초기화

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
- `src/app/modal.js` + `src/components/ItemModal.jsx`
- `src/app/render.js`
- `src/app/io.js`
- 데모 데이터나 초기화 로직

## 빌드 파이프라인

### 권장 빌드: `src/build-esbuild.js`

역할:

- `main.js`를 엔트리로 ES module 번들링 (JSX 포함)
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

1. 상태가 `S`에 있는지 Zustand에 있는지 확인
2. `save()` 호출이 필요한지 확인
3. `syncToStore()` 또는 `setStore()`로 Zustand 동기화 필요 여부 확인
4. 어느 뷰를 다시 그려야 하는지 확인
5. HTML 인라인 이벤트가 쓰이면 `window` 바인딩 필요 여부 확인
6. 서버 모드와 로컬 모드 둘 다 깨지지 않는지 확인
7. `cd src && npm run build` 실행

### React 컴포넌트 수정

- Zustand 상태를 추가하려면 `useAppStore.js` `initialState`와 `S` 둘 다 수정해야 한다.
- 바닐라 JS → React 방향 호출은 반드시 `window.__xxx` 브릿지나 CustomEvent를 통한다.
- `dangerouslySetInnerHTML`로 렌더링된 DOM 내 이벤트는 인라인 `onclick="..."` 형태로 `window` 바인딩 함수를 직접 호출한다.

### 서버 응답 변경

1. `featureMatrix-server/server.py` 수정
2. `src/app/state.js`의 `loadFromServer`, `saveToServer`, `pollServerTs` 점검
3. 필요하면 `src/app/main.js`의 폴링/배너/UI 동기화 로직 점검

### 새 필드 추가

1. 스키마와 마이그레이션 정의
2. `ItemModal.jsx` 편집 UI 반영
3. 렌더링 반영 (`render.js`, `board.js` 등)
4. import/export 반영 (`io.js`)
5. 데모 데이터와 기본값 검토

## 추천 진입 파일

- 전체 흐름: `src/app/main.js`
- 상태/저장: `src/app/state.js`
- Zustand 스토어: `src/store/useAppStore.js`
- React 루트: `src/components/App.jsx`
- 인증: `src/app/admin.js`
- 매트릭스/리스트 렌더링: `src/app/render.js` + `src/components/MatrixView.jsx` / `ListView.jsx`
- 보드 뷰: `src/app/board.js` + `src/components/BoardView.jsx`
- 대시보드: `src/components/DashboardView.jsx`
- 편집 모달: `src/app/modal.js` + `src/components/ItemModal.jsx`
- 설정 패널: `src/app/settings.js` + `src/components/SettingsPanel.jsx`
- 가져오기/내보내기: `src/app/io.js`
- 서버 API: `featureMatrix-server/server.py`

## 요약

이 프로젝트의 핵심은 다음 세 가지다.

1. `state.js`의 `S`와 Zustand 스토어가 `syncToStore()`로 단방향 동기화되는 상태 관리
2. 바닐라 JS DOM 구조를 유지하면서 `createPortal`로 React를 주입하는 점진적 전환 전략
3. 서버 공유 데이터와 로컬 개인 설정의 분리

변경 범위가 조금만 넓어져도 저장, 렌더링, 권한, 빌드 결과가 함께 얽히므로 한 파일만 보고 수정하면 놓치기 쉽다. 특히 `S`를 수정했는데 React 컴포넌트가 반응하지 않는다면 `syncToStore()` 또는 `setStore()` 호출이 빠진 것을 먼저 확인한다.
