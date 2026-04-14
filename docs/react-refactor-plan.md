# React Refactor Plan

이 문서는 바닐라 JS에서 React로 전환하는 동안 남은 legacy bridge를 기능 단위로 줄이기 위한 작업 노트다.

## 현재 상태

- React 엔트리: `src/main.jsx`
- React 루트: `src/components/App.jsx`
- legacy 초기화: `App.jsx`에서 `src/app/main.js`를 동적 import
- 상태 공존:
  - legacy 상태: `src/app/state.js`의 `S`
  - React 상태: `src/store/useAppStore.js`의 Zustand store
- HTML 템플릿은 React 엔트리인 `main.jsx`를 가리킨다.

## 남은 legacy bridge 그룹

### 1. 전역 액션 바인딩

`src/app/main.js`의 `Object.assign(window, ...)`가 대부분의 사용자 액션을 전역 함수로 노출한다.

대표 예:

- view 전환: `switchView`
- modal 제어: `openModal`, `closeModal`, `openEditModal`
- item 저장: `saveItem`, `hardDelete`, `duplicateItem`
- import/export: `expTSV`, `expHTML`, `impMdFiles`
- board/matrix drag action

정리 방향: 기능 단위 service/action으로 이동하고 React 컴포넌트는 직접 import 또는 store action을 호출한다.

### 2. React callback bridge

legacy 모듈이 React 컴포넌트를 조작하기 위해 `window.__react...` 함수를 호출한다.

대표 예:

- `__reactOpenLoginModal`
- `__editModalBridge`
- `__reactOpenCtxMenu`
- `__reactAnalyzeCSV`
- `__showUpdateBanner`

정리 방향: modal/context/store action으로 통합한다.

### 3. CustomEvent bridge

선택/드래그 상태를 `window.dispatchEvent(new CustomEvent(...))`로 전달한다.

대표 예:

- `bulkSelChange`
- `mxSelChange`
- `mxDragState`
- `boardSelChange`
- `boardDragState`

정리 방향: Zustand store에 selection/drag state를 두고 컴포넌트가 구독한다.

### 4. DOM 직접 접근

legacy 모듈과 일부 React 컴포넌트가 `document.getElementById`, `querySelector`, `innerHTML`에 의존한다.

정리 방향:

- 단순 폼 값은 controlled component로 이동
- 화면 렌더링용 HTML 문자열은 React 컴포넌트 렌더링으로 이동
- 필요한 외부 라이브러리 DOM 조작은 작은 adapter로 격리

## 권장 진행 순서

1. 엔트리/빌드 혼선 정리
2. Header, Navigation, view 전환을 React/store 기반으로 이동
3. 검색/필터 액션을 React/store 기반으로 이동
4. BulkActionBar bridge 제거
5. Login/Auth modal bridge 제거
6. SettingsPanel action 정리
7. MatrixView, BoardView selection/drag state 이동
8. ItemModal 저장/markdown bridge 제거
9. import/export modal bridge 제거
10. `src/app/main.js`를 bootstrap 전용으로 축소하거나 제거

## 진행 현황

- 완료: HTML 템플릿 엔트리를 `main.jsx` 기준으로 정리
- 완료: Header, Navigation, Dashboard 일부 액션의 `window.*` 직접 호출 제거
- 완료: 검색/필터/패널 토글 공용 action을 `src/app/filterActions.js`로 분리
- 완료: BulkActionBar의 일괄 변경 action을 `src/app/bulkActions.js`로 분리
- 완료: ListView/BulkActionBar bulk selection 표시를 Zustand `bulkSelectionKeys` 구독으로 전환
- 완료: `bulkSelChange` / `__bulkBarRefresh` bridge 제거
- 완료: legacy `bulkSel` 객체 제거, bulk 선택 상태를 Zustand `bulkSelectionKeys`로 단일화
- 완료: ListView, DashboardView, FeatureCard의 `openEditModal` / `openMdModal` 전역 호출 제거
- 완료: FeatureCard tooltip/context/status/duplicate 전역 호출 제거
- 완료: DashboardView의 `setHmView` / `renderDashboard` bridge 제거
- 완료: unused legacy `src/app/dashboard.js` 제거
- 완료: legacy `src/build.js`와 `build:legacy` script 제거
- 완료: ListView `__listViewRefresh` bridge 제거
- 완료: BoardView selection/drag CustomEvent bridge 제거
- 완료: BoardView expand/collapse 및 board action 전역 호출 제거
- 완료: unused `window.renderBoard` 호출 제거
- 진행 예정: ItemModal/openModal bridge 정리

## 변경 원칙

- 한 번에 한 기능 그룹만 변경한다.
- 각 단계마다 `cd src && npm run build`를 실행한다.
- `featureMatrix-server/static/index.html`과 `src/dist/index.html`은 직접 수정하지 않는다.
- `S`에서 Zustand로 옮길 때는 서버 저장, localStorage 저장, socket 동기화 경로를 함께 확인한다.
