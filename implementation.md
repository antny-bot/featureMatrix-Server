---
version: 3.2.0
---

# featureMatrix-ServerAdmin Implementation Guide

이 문서는 개발자용 구조 문서다. 현재 코드 기준으로 프런트엔드, 서버, 저장 방식, 빌드 흐름을 빠르게 파악할 수 있도록 정리한다.

## 문서 역할

- `README.md`: 사용자와 운영자 관점의 설치, 실행, 기능 소개
- `implementation.md`: 개발자 관점의 구조, 상태 흐름, 수정 포인트

## 저장소 구성

```text
featureMatrix-ServerAdmin/
├─ src/
│  ├─ main.tsx               # React 진입점
│  ├─ index.html
│  ├─ style.css
│  ├─ build-esbuild.js
│  ├─ package.json
│  ├─ tsconfig.json
│  ├─ app/
│  │  ├─ constants.ts        # 상수, 스키마, 마이그레이션
│  │  ├─ io.ts               # CSV/JSON/MD import/export
│  │  ├─ socket.ts           # Socket.IO 클라이언트
│  │  └─ theme.ts            # 테마 색상 계산
│  ├─ components/
│  │  ├─ App.tsx             # React 루트
│  │  ├─ Header.tsx
│  │  ├─ LayoutShell.tsx     # 레이아웃 + 뷰 전환 컨테이너
│  │  ├─ DashboardView.tsx
│  │  ├─ MatrixView.tsx
│  │  ├─ ListView.tsx
│  │  ├─ BoardView.tsx
│  │  ├─ ItemModal.tsx
│  │  ├─ FilterPanel.tsx
│  │  ├─ SettingsPanel.tsx
│  │  ├─ SettingsDesignPanel.tsx
│  │  ├─ SettingsColumnsPanel.tsx
│  │  ├─ LoginModal.tsx
│  │  ├─ AdminView.tsx
│  │  ├─ ActivityLogPanel.tsx
│  │  ├─ ImportModal.tsx
│  │  ├─ ExportModal.tsx
│  │  ├─ DiffModal.tsx
│  │  ├─ ErrorBoundary.tsx
│  │  ├─ AppOverlays.tsx
│  │  ├─ OverlayMenus.tsx
│  │  ├─ UpdateBanner.tsx
│  │  ├─ BulkActionBar.tsx
│  │  ├─ NavigationSide.tsx
│  │  ├─ DashboardSectionOrder.tsx
│  │  ├─ FeatureCard.tsx
│  │  └─ ShortcutsModal.tsx
│  ├─ store/
│  │  └─ useAppStore.ts      # Zustand 전역 상태
│  ├─ hooks/
│  │  ├─ useDBSync.ts        # 서버 동기화, 로컬 저장
│  │  ├─ useModals.ts        # 모달 제어, CRUD
│  │  ├─ useBoardActions.ts  # 보드 뷰 액션
│  │  ├─ useListActions.ts   # 리스트 뷰 액션
│  │  ├─ useMatrixActions.ts # 매트릭스 뷰 액션
│  │  ├─ useKeyboardShortcuts.ts
│  │  ├─ usePersistItems.ts  # 저장 트리거
│  │  └─ useSelectionHandler.ts
│  ├─ contexts/
│  │  ├─ AuthContext.tsx     # 인증 상태, 로그인/로그아웃
│  │  └─ ThemeContext.tsx    # 테마 컨텍스트
│  ├─ types/
│  │  └─ index.ts            # 공통 TypeScript 타입
│  └─ utils/
│     ├─ api.ts              # apiFetch (인증 헤더 자동 주입)
│     └─ itemUtils.ts        # 아이템 유틸, 마이그레이션
├─ featureMatrix-server/
│  ├─ server.py
│  ├─ requirements.txt
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

- **React 19 + TypeScript + Zustand v5** 기반이다.
- `src/main.tsx`가 진입점이다. `#root` 컨테이너에 `App`을 마운트한다.
- `src/components/App.tsx`가 React 루트 컴포넌트다. 초기화 로직을 담당한다.
- 앱 상태는 `src/store/useAppStore.ts`의 Zustand 스토어 하나로 관리한다.
- 레이아웃은 `LayoutShell.tsx`가 담당한다. 뷰 전환은 CSS `display` show/hide 방식이다 (`createPortal` 없음).
- 서버 연동은 `useDBSync` 훅이 담당한다.
- 인증은 `AuthContext.tsx`가 담당한다.

### 서버

- `featureMatrix-server/server.py` 하나로 구성된 단순 Flask 서버다.
- 정적 파일 서빙과 JSON API를 함께 처리한다.
- 인증은 관리자/편집자 토큰 기반이다.
- 편집 락은 메모리에서 관리하고, 데이터와 로그는 JSON 파일로 저장한다.
- Socket.IO를 통해 실시간 락/데이터 브로드캐스트를 지원한다.

## 상태 관리 구조

### `src/store/useAppStore.ts` — Zustand 스토어

앱 상태의 유일한 소스다. 모든 React 컴포넌트와 훅이 이 스토어를 구독한다.

주요 상태 영역:

- `items` / `changeLog` — 기능 데이터
- `view` — 현재 뷰 (`matrix` / `list` / `board` / `dashboard` / `admin`)
- `searchQ` / `filters` / `display` — 검색·표시 옵션
- `settings` — 공유 설정과 개인 설정 혼합
- `editModal` / `loginModal` / `activeModal` — 모달 상태
- `editLocks` / `previews` — 편집 락, 실시간 미리보기
- `wsStatus` / `serverStatus` / `activeUsers` — 연결 상태
- `undoStack` / `undoDepth` — Undo 기능
- `toast` / `banner` / `contextMenu` / `tooltip` — UI 피드백

React 컴포넌트 사용 예:

```ts
const items    = useAppStore(s => s.items);
const settings = useAppStore(s => s.settings);
const setView  = useAppStore(s => s.setView);
```

React 외부에서 스냅샷 접근:

```ts
import { getStore, setStore } from '../store/useAppStore.js';
const current = getStore();
setStore({ items: nextItems });
```

### 저장 정책

`useDBSync` 훅이 서버와 로컬 저장소의 역할을 분리한다.

서버에 저장되는 공유 데이터 (`SHARED_SETTINGS`):

- `items`, `changeLog`
- `title`, `subtitle`, `dbHeroName`, `dbSections`, `dbSectionVisibility`
- `priorityStyles`, `customColors`
- `matrixWidth`, `cellFold`, `colW`, `catW`, `subCatW`, `cardRadius`, `cardGap`
- `changeLogMax`, `statusLabels`, `boardFoldCount`

브라우저 로컬에 저장되는 개인 데이터:

- `display`, `filters`
- `baseFont`, `cardFont`, `themeId`
- `panelPos`, `panelVisible`
- `listColumns`, `dbSections`, `dbSectionVisibility` (개인 오버라이드)
- `storageMode`, `serverUrl`, `pollInterval`, `userName`

#### 서버/로컬 로드 순서

`App.tsx`의 초기화 Effect:

1. `localStorage`에서 개인 설정 복원
2. `storageMode === 'server'`이면 `loadFromServer()` 실행
3. 서버 데이터로 공유 설정 덮어씀
4. `applyVars()`로 테마 CSS 변수 적용
5. 접속 활동 로그 전송

이 구조 때문에 서버 모드에서도 개인 설정은 브라우저별로 유지된다.

## 프런트엔드 모듈 책임

### `src/app/constants.ts`

- 데이터 스키마 버전 `DATA_VERSION`
- 마이그레이션 맵 `MIGRATIONS`
- 상태값(`STATUS_OPTS`, `STATUS_LBL`), 테마 프리셋, 기본 컬럼 정의
- 스토리지 키 상수 (`SK`, `ADMIN_TOKEN_KEY`, `EDITOR_TOKEN_KEY`)
- 데모 데이터 `DEMO`

### `src/app/io.ts`

- CSV/TSV 가져오기
- 전체 JSON 백업 가져오기 / 내보내기
- TSV/XLS/HTML/MD ZIP 내보내기
- Markdown 파일 가져오기

### `src/app/socket.ts`

Socket.IO 클라이언트 모듈이다.

주요 기능:

- 서버 연결/해제 (`initSocket`, `disconnectSocket`, `isSocketConnected`)
- 편집 락 이벤트 (`emitLock`, `emitUnlock`, `releaseLocalLock`, `emitRequestUnlock`)
- 데이터 브로드캐스트 (`emitDataSave`)
- 활성 사용자 등록/해제 (`registerActiveUser`, `unregisterActiveUser`)
- Zustand 스토어에 직접 상태 반영 (`wsStatus`, `activeUsers`, `editLocks`, `previews`)

### `src/app/theme.ts`

- CSS 변수 계산 및 적용 (`applyVars`)
- 테마 프리셋 적용
- 커스텀 색상 반영

### `src/store/useAppStore.ts`

위 [상태 관리 구조](#상태-관리-구조) 참조.

### `src/hooks/useDBSync.ts`

서버 모드 데이터 동기화를 담당한다.

반환 함수들:

- `saveToServer()` — 공유 데이터를 서버에 저장
- `loadFromServer()` — 서버에서 공유 데이터 로드
- `saveLocal()` — 개인 데이터를 로컬스토리지에 저장
- `pollServer()` — `/api/ping`으로 서버 변경 감지
- `lockItem(key)` / `unlockItem(key)` — 편집 락 설정/해제 (소켓 우선, REST 폴백)
- `logActivity(action, detail)` — 서버 활동 로그 전송
- `resolveConflictKeepMine()` / `resolveConflictUseServer(data)` — 충돌 해결
- `broadcastSharedData()` — 소켓으로 변경 사항 브로드캐스트

`enableConnection: true`를 전달하면 Socket.IO 연결을 시작하고 폴링 타이머를 등록한다.
`App.tsx`만 이 옵션을 사용한다.

### `src/hooks/useModals.ts`

모달 제어와 아이템 CRUD를 담당한다.

반환 함수들:

- `openModal(id)` / `closeModal(id)` — 일반 모달 열기/닫기
- `openEditModal(key)` / `closeEditModal()` — 편집 모달 (락 포함)
- `openAddModal(defaults?)` / `openAddInCell(...)` — 추가 모달
- `openMdModal(key)` — MD 탭으로 편집 모달 열기
- `saveItem(form)` — 아이템 저장 (추가/수정)
- `hardDelete(key)` / `duplicateItem(key)` — 완전 삭제, 복제
- `quickToggleDel(key)` / `setItemStatus(key, status)` — 빠른 상태 변경

### `src/hooks/usePersistItems.ts`

`persistItems()` 함수를 제공한다. 서버 모드면 `saveToServer` + `broadcastSharedData`, 로컬 모드면 `saveLocal`을 호출한다.

### `src/hooks/useBoardActions.ts`

보드 뷰의 드래그 앤 드롭, 상태 변경, 선택 처리를 담당한다.

### `src/hooks/useListActions.ts`

리스트 뷰의 정렬, 일괄 선택, 컬럼 표시 제어를 담당한다.

### `src/hooks/useMatrixActions.ts`

매트릭스 뷰의 셀 펼침/접기, 선택 처리, 컨텍스트 메뉴를 담당한다.

### `src/hooks/useKeyboardShortcuts.ts`

전역 키보드 단축키를 등록한다. `App.tsx`에서 액션 맵을 전달받아 처리한다.

### `src/hooks/useSelectionHandler.ts`

아이템 선택 상태 관리 (단일 클릭, Shift/Ctrl 다중 선택).

### `src/contexts/AuthContext.tsx`

인증 상태를 관리하며, 로그인/로그아웃 함수를 React 외부에도 export한다.

주요 export 함수들:

- `isAdmin()` / `isEditor()` — 현재 권한 확인
- `getAdminToken()` / `getEditorToken()` — 토큰 가져오기
- `openLoginModal(role, callback)` / `closeLoginModal()` — 로그인 모달 제어
- `submitLogin()` — 로그인 처리 (토큰 저장, 소켓 등록)
- `logout()` / `adminLogout()` — 로그아웃
- `requireAdmin(callback)` / `requireEditor(callback)` — 권한 확인 후 콜백
- `validateAuthSession()` — 서버에서 세션 유효성 검사
- `updateAdminUI()` — AuthContext 강제 리렌더

권한 규칙:

- 로컬 모드에서는 관리자와 편집자가 모두 true
- 서버 모드에서는 sessionStorage의 토큰 존재 여부로 판별

### `src/contexts/ThemeContext.tsx`

CSS 변수 기반 테마를 제공한다. Zustand `settings.themeId` / `customColors` 변경 시 자동으로 `applyVars()`를 호출한다.

### `src/utils/api.ts`

`apiFetch(path, options)` 함수를 제공한다. 요청마다 `X-Admin-Token` / `X-Editor-Token` 헤더를 자동으로 주입한다.

### `src/utils/itemUtils.ts`

아이템 관련 순수 유틸리티 함수들이다.

- `genKey()` — 고유 키 생성
- `findItem(key, items)` — 아이템 조회
- `pushChangeLog(action, key, name, meta?)` — 변경 로그 스토어에 추가
- `migrateItems(items, fromVersion)` — 스키마 마이그레이션
- `migrateSettings(settings)` / `migrateFilters(filters)` / `migrateChangeLog(log)`
- `sanitizeFilename(name)` — 파일명 정리
- `dlBlob(content, filename, mimeType)` — 파일 다운로드

### `src/types/index.ts`

공통 TypeScript 타입 정의 파일이다. `Item`, `AppSettings`, `Filters`, `DisplaySettings`, `EditModal`, `LoginModal`, `ViewType`, `ServerStatus`, `WsStatus` 등을 export한다.

## React 컴포넌트 책임

### `src/components/App.tsx`

- React 루트 컴포넌트
- `ThemeProvider` / `AuthProvider` / `ErrorBoundary` 제공
- 앱 초기화 Effect (로컬 로드 → 서버 로드 → 테마 적용 → 접속 로그)
- `useDBSync({ enableConnection: true })` — 서버 연결 및 폴링 시작
- `useKeyboardShortcuts(actions)` — 전역 단축키 등록

### `src/components/Header.tsx`

- 상단 헤더 영역
- 뷰 전환 탭, 검색창, 필터 버튼
- 서버 연결 상태 배지, 활성 사용자 표시
- Zustand `view`, `searchQ`, `serverStatus`, `wsStatus` 구독

### `src/components/LayoutShell.tsx`

- 전체 레이아웃 컨테이너
- `NavigationSide` + `main` 영역 구성
- 뷰 전환: `view` 상태에 따라 각 뷰 패널을 CSS `display`로 show/hide
- 포함 컴포넌트: `NavigationSide`, `FilterPanel`, `BulkActionBar`, `AdminView`, `DashboardView`, `MatrixView`, `BoardView`, `ListView`

### `src/components/NavigationSide.tsx`

- 좌/우 사이드 패널
- 설정, 필터, 뷰 전환, 빠른 추가 버튼

### `src/components/DashboardView.tsx`

- 대시보드 뷰
- stats / groupProgress / ownersPanel / heatmap / metrics / recent 섹션
- `DashboardSectionOrder.tsx`로 섹션 드래그 순서 변경

### `src/components/MatrixView.tsx`

- 매트릭스 뷰
- `expandedCells` Set을 `useState`로 로컬 관리
- 셀 펼침/접기, 인라인 추가, 드래그 처리
- `useMatrixActions` 훅 사용

### `src/components/ListView.tsx`

- 리스트(테이블) 뷰
- 컬럼 정렬, 일괄 선택, 컬럼 너비 조정
- `useListActions` 훅 사용

### `src/components/BoardView.tsx`

- 칸반 보드 뷰
- `@dnd-kit` 기반 드래그 앤 드롭
- 상태별 컬럼, 카드 접기/펼치기
- `useBoardActions` 훅 사용

### `src/components/ItemModal.tsx`

- 항목 추가/편집 모달
- 탭: 기본 정보, Markdown, 통계
- Markdown 편집/미리보기 (KaTeX 렌더링 포함)
- `useModals().saveItem(form)` 으로 저장

### `src/components/FilterPanel.tsx`

- 필터 패널 (우선순위, 상태, 담당자, 중요 여부, 삭제 여부)
- Zustand `filters` 구독 및 업데이트

### `src/components/SettingsPanel.tsx`

- 설정 패널 진입 컨테이너
- `SettingsDesignPanel` (폰트, 테마, 카드, 매트릭스, 보드 설정)
- `SettingsColumnsPanel` (리스트 컬럼 표시/순서)

### `src/components/AdminView.tsx`

- 관리자 전용 뷰 (관리자 로그인 필요)
- 활동 로그, 편집자 비밀번호 변경, 연결 설정

### `src/components/ActivityLogPanel.tsx`

- 활동 로그 목록 표시
- 관리자 토큰 필요

### `src/components/LoginModal.tsx`

- 로그인 모달 (관리자/편집자 전환)
- 세션 정보 표시 (남은 시간, 역할)

### `src/components/AppOverlays.tsx`

- 모든 오버레이 컴포넌트 모음
- `ItemModal`, `ImportModal`, `ExportModal`, `DiffModal`, `SettingsPanel`, `ShortcutsModal`, `LoginModal`

### `src/components/OverlayMenus.tsx`

- 컨텍스트 메뉴, 상태 변경 메뉴, 툴팁

### `src/components/ImportModal.tsx` / `ExportModal.tsx`

- 가져오기/내보내기 모달
- `src/app/io.ts` 함수를 호출한다

### `src/components/DiffModal.tsx`

- 서버 데이터와 로컬 데이터 충돌 시 비교 및 해결 UI

### `src/components/BulkActionBar.tsx`

- 일괄 선택 시 하단에 표시되는 액션 바
- 상태 변경, 삭제처리, 완전 삭제

### `src/components/UpdateBanner.tsx`

- 다른 사용자가 데이터를 변경했을 때 상단 배너 표시

### `src/components/ErrorBoundary.tsx`

- React 렌더링 에러를 뷰별로 격리

## 서버 구현

### `featureMatrix-server/server.py`

하나의 Flask 앱으로 아래 기능을 제공한다.

- 정적 `index.html` 서빙
- 로그인 API 및 세션 검증
- 공유 데이터 조회/저장
- 폴링용 상태 조회
- 활동 로그 기록/조회
- 편집 락 설정/해제
- 편집자 비밀번호 변경
- Socket.IO 실시간 이벤트

### 런타임 파일

- `config.json`: `allowed_origins`, `editor_password`
- `data.json`: 현재 공유 데이터
- `activity.json`: 활동 로그
- `tokens.json`: 관리자 토큰 영속 저장

데이터 저장 위치는 기본적으로 `featureMatrix-server/` 내부지만, `FEATURE_MATRIX_DATA_DIR` 환경변수로 바꿀 수 있다.

### 인증 구조

- 관리자 토큰: `X-Admin-Token` (파일 저장, 재시작 후 유지)
- 편집자 토큰: `X-Editor-Token` (메모리만)
- 관리자 토큰은 편집 권한도 포함
- 토큰 TTL: 24시간

중요한 구현 특성:

- `--admin-password`가 비어 있으면 누구나 관리자 로그인 가능
- 편집자 비밀번호가 비어 있으면 편집자 로그인은 비밀번호 없이 허용

### API 요약

- `POST /api/auth`
- `GET  /api/auth/status`
- `GET  /api/data`
- `POST /api/data`
- `GET  /api/ping`
- `GET  /api/log`
- `POST /api/log`
- `POST /api/lock`
- `POST /api/unlock`
- `POST /api/set-editor-password`

### 편집 락 동작

편집 락은 서버 메모리와 클라이언트 타이머가 함께 관여한다.

- 소켓 연결 시: `emitLock` / `emitUnlock` 이벤트로 실시간 처리
- 소켓 미연결 시: REST `/api/lock` / `/api/unlock` 폴백
- 서버 stale lock 정리 기준: 60초

락 관련 수정 시 `src/app/socket.ts`, `src/hooks/useDBSync.ts`, `featureMatrix-server/server.py`를 함께 봐야 한다.

## 데이터 모델

아이템은 대체로 아래 필드를 가진다.

```ts
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

```ts
export const DATA_VERSION = 2;
```

로드 시 `migrateItems(items, fromVersion)` (`src/utils/itemUtils.ts`)이 `MIGRATIONS`를 순차 적용한다.

새 필드를 추가할 때는 보통 함께 봐야 한다.

- `src/app/constants.ts`
- `src/utils/itemUtils.ts` (마이그레이션 추가)
- `src/components/ItemModal.tsx` (편집 UI)
- `src/app/io.ts` (가져오기/내보내기)
- 데모 데이터나 기본값 초기화 로직

## 빌드 파이프라인

### 권장 빌드: `src/build-esbuild.js`

역할:

- `main.tsx`를 엔트리로 ES module 번들링 (TSX 포함)
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

1. 상태가 어느 Zustand 필드에 있는지 확인
2. `persistItems()` 호출이 필요한지 확인 (서버/로컬 자동 분기)
3. 어느 컴포넌트 또는 훅에서 처리하는지 확인
4. 서버 모드와 로컬 모드 둘 다 깨지지 않는지 확인
5. `cd src && npm run build` 실행

### React 컴포넌트 수정

- Zustand 상태를 추가하려면 `useAppStore.ts`의 `initialState`와 액션을 함께 추가한다.
- 새 모달은 `AppOverlays.tsx`에 등록하고, `useModals` 또는 `useAppStore.setActiveModal`로 제어한다.
- 뷰 패널을 추가하려면 `LayoutShell.tsx`에 등록하고, `ViewType` 타입에 추가한다.

### 서버 응답 변경

1. `featureMatrix-server/server.py` 수정
2. `src/hooks/useDBSync.ts`의 `loadFromServer`, `saveToServer`, `pollServer` 점검
3. `src/utils/api.ts`의 헤더/에러 처리 점검

### 새 필드 추가

1. `src/types/index.ts`에 타입 추가
2. `src/app/constants.ts`에 스키마와 마이그레이션 정의
3. `src/utils/itemUtils.ts`에 마이그레이션 로직 추가
4. `src/components/ItemModal.tsx` 편집 UI 반영
5. `src/app/io.ts` import/export 반영
6. 데모 데이터와 기본값 검토

## 추천 진입 파일

- 전체 흐름: `src/components/App.tsx`
- 상태: `src/store/useAppStore.ts`
- 서버 동기화: `src/hooks/useDBSync.ts`
- 인증: `src/contexts/AuthContext.tsx`
- CRUD/모달: `src/hooks/useModals.ts`
- 저장 트리거: `src/hooks/usePersistItems.ts`
- 매트릭스 뷰: `src/components/MatrixView.tsx` + `src/hooks/useMatrixActions.ts`
- 리스트 뷰: `src/components/ListView.tsx` + `src/hooks/useListActions.ts`
- 보드 뷰: `src/components/BoardView.tsx` + `src/hooks/useBoardActions.ts`
- 대시보드: `src/components/DashboardView.tsx`
- 편집 모달: `src/components/ItemModal.tsx`
- 설정 패널: `src/components/SettingsPanel.tsx`, `SettingsDesignPanel.tsx`, `SettingsColumnsPanel.tsx`
- 가져오기/내보내기: `src/app/io.ts` + `src/components/ImportModal.tsx`, `ExportModal.tsx`
- 소켓 연결: `src/app/socket.ts`
- 서버 API: `featureMatrix-server/server.py`
- TypeScript 타입: `src/types/index.ts`

## 요약

이 프로젝트의 핵심은 다음 세 가지다.

1. **Zustand 단일 상태 스토어** — 이전의 전역 `S` 객체와 단방향 동기화 패턴을 제거하고, `useAppStore.ts` 하나로 통합
2. **훅 기반 비즈니스 로직** — `useDBSync`, `useModals`, `useBoardActions`, `useListActions`, `useMatrixActions` 등으로 역할 분리
3. **서버 공유 데이터와 로컬 개인 설정의 분리** — `useDBSync.ts`의 `SHARED_SETTINGS`가 기준

변경 범위가 조금만 넓어져도 저장, 렌더링, 권한, 빌드 결과가 함께 얽히므로 한 파일만 보고 수정하면 놓치기 쉽다. 특히 Zustand 상태를 수정했는데 뷰가 반응하지 않는다면 해당 훅이 `useAppStore`를 올바르게 구독하고 있는지 먼저 확인한다.
