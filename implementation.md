# featureMatrix-ServerAdmin implementation guide

## 목적

이 문서는 `featureMatrix-ServerAdmin` 프로젝트를 처음 맡는 다른 에이전트가 빠르게 구조를 이해하고, 안전하게 수정하고, 빌드/배포까지 이어갈 수 있도록 만든 작업 가이드다.

이 저장소는 크게 두 부분으로 나뉜다.

1. `src/`
   브라우저에서 실행되는 관리자 UI 소스다. ES module 기반의 순수 JavaScript로 작성되어 있다.
2. `featureMatrix-server/`
   Flask 기반의 간단한 공유 저장 서버다. 빌드된 정적 HTML도 함께 서빙한다.

---

## 디렉터리 구조

```text
featureMatrix-ServerAdmin/
├─ src/
│  ├─ index.html
│  ├─ style.css
│  ├─ build.js
│  ├─ dist/
│  │  └─ index.html
│  └─ app/
│     ├─ constants.js
│     ├─ state.js
│     ├─ admin.js
│     ├─ theme.js
│     ├─ render.js
│     ├─ modal.js
│     ├─ io.js
│     ├─ settings.js
│     ├─ dashboard.js
│     └─ main.js
└─ featureMatrix-server/
   ├─ server.py
   ├─ config.json
   ├─ data.json
   ├─ activity.json
   ├─ tokens.json
   ├─ requirements.txt
   ├─ README.md
   └─ static/
      ├─ index.html
      └─ fonts/
```

---

## 전체 동작 방식

### 프런트엔드

- `src/index.html`이 기본 UI 뼈대와 모달 DOM을 가진다.
- 실제 로직은 `src/app/*.js`로 분리되어 있다.
- 브라우저 실행 시 `src/app/main.js`가 초기화와 `window` 바인딩을 담당한다.
- 데이터는 `state.js`의 전역 상태 객체 `S`에 모인다.
- 렌더링은 `render.js`가 담당하고, 이벤트 처리 후 보통 `save()`와 `renderAll()`로 마무리한다.

### 서버

- `featureMatrix-server/server.py`는 아래 엔드포인트를 제공한다.
  - `GET /api/data` — 인증 없이 읽기 허용
  - `POST /api/data` — 편집자/관리자 토큰 필요
  - `GET /api/ping` — 폴링 (serverTs, lastEditor, locks, hasEditorPw 반환)
  - `POST /api/auth` — 로그인 (role: 'editor' | 'admin')
  - `GET /api/log` — 활동 로그 조회 (관리자 전용)
  - `POST /api/log` — 활동 로그 기록 (편집자 이상)
  - `POST /api/lock` — 편집 락 설정 (편집자 이상)
  - `POST /api/unlock` — 편집 락 해제
  - `POST /api/set-editor-password` — 편집자 비번 변경 (관리자 전용)
- `config.json`에 allowed_origins, editor_password를 저장한다.
- `data.json`에 현재 공유 payload를 저장한다.
- `activity.json`에 활동 로그를 저장한다 (최대 500개).
- `tokens.json`에 관리자 토큰을 영속 저장한다 (편집자 토큰은 메모리만).
- 정적 파일은 `featureMatrix-server/static/index.html`에서 서빙한다.

### 빌드

- 개발 소스는 모듈형 JS다.
- `src/build.js`가 여러 JS 파일을 하나로 합쳐 `src/dist/index.html`을 만든다.
- 빌드 후 `featureMatrix-server/static/index.html`로 자동 복사한다.

---

## 주요 파일 역할

### `src/app/constants.js`

- 필드 목록 `FIELDS`, 라벨 맵 `FLABELS`
- 상태값(`STATUS_OPTS`, `STATUS_CLS`, `STATUS_LBL`), 테마 정의(`THEMES`), 데모 데이터(`DEMO`)
- 데이터 스키마 버전 `DATA_VERSION` 및 마이그레이션 맵 `MIGRATIONS`
- 기본 리스트 컬럼 `DEFAULT_LIST_COLS`

### `src/app/state.js`

- 전역 상태 `S`
- 로컬 저장(`saveLocal`) / 복원(`loadLocal`)
- 서버 저장(`saveToServer`) / 복원(`loadFromServer`) / 폴링(`pollServerTs`)
- Undo stack (`pushUndo`, `doUndo`, `getUndoHistory`)
- 공통 유틸리티: `esc`, `eattr`, `genKey`, `notify`, `fmtDate`, `getPK`, `normOwner`, `getOwnerColor`, `findItem`, `apiFetch`
- 편집 락: `editLocks`, `lockItem`, `unlockItem`, `updateLocks`
- 활동 로그: `logActivity` (서버), `pushChangeLog` (클라이언트)

주의:
- 저장 관련 동작의 중심 파일이라 기능 추가 시 가장 먼저 확인해야 한다.
- 공유 설정(`SHARED_SETTINGS`)과 개인 설정(`local` 블록)을 분리해서 저장한다.
- `apiFetch`는 HTTP 비-2xx 응답 시 `err.status`가 담긴 Error를 throw한다.

### `src/app/admin.js`

- 편집자/관리자 역할별 토큰 발급 및 검사 (`isAdmin`, `isEditor`)
- 로그인 모달 흐름 (`openLoginModal`, `closeLoginModal`, `submitLogin`)
- 로그아웃 (`logout`, `adminLogout` — 동일 함수의 별칭)
- 관리자 전용 UI 잠금 상태 업데이트 (`updateAdminUI`)
- 편집자 비번 변경 (`setEditorPassword`)
- 로컬 모드에서는 isAdmin/isEditor가 항상 true 반환

### `src/app/render.js`

- 매트릭스 뷰, 리스트 뷰 렌더링
- 필터 칩 렌더링 (`renderOwnerChips`, `renderPrioChips`, `renderStatusChips`)
- 필터링 로직 (`getFiltered`, `isFilterActive`) — `field:value` 검색 구문 지원
- bulk selection 상태 (`bulkSel`, `bulkToggle`, `bulkToggleAll`, `bulkClear`, `renderBulkBar`)
- CountUp 애니메이션 (`countUp`)
- 통계 (`renderStats`)

### `src/app/dashboard.js`

- 대시보드 뷰 렌더링
- 섹션: stats(스탯카드) / insight(그룹 진척도·담당자·타임라인) / heatmap
- 섹션 순서는 `S.settings.dbSections` 배열로 제어
- 히트맵 뷰 모드 상태: `_hmView` ('cat' | 'status'), `setHmView()`

### `src/app/modal.js`

- 항목 추가/수정 모달 (`openAddModal`, `openEditModal`, `saveItem`, `hardDelete`)
- markdown 편집 모드 (`openMdModal`, `switchMdView`, `onMdInput`, `parseMd`)
- 드래그앤드롭 후처리 (`onDS`, `onDEnd`, `onDE`, `onDO`, `onDL`, `onDrop`)
- 컨텍스트 메뉴 (`openCtxMenu`, `openStatusMenu`, `setItemStatus`)
- MD 툴바 (`mdInsert`, `mdInsertLine`)

### `src/app/io.js`

- TSV/XLS/HTML/MD ZIP export
- CSV/TSV import (2단계 마법사)
- markdown 파일 import (`impMdFiles`)
- 전체 JSON export/import (`expFullJSON`, `impFullJSON`)

### `src/app/settings.js`

- 설정 모달 동기화 (`syncSettingsUI`)
- 컬럼 순서/표시 여부 (`renderColEditor`, `toggleColVisible`)
- 축 순서 편집 (`renderAxisEditor`)
- 각종 UI 세팅 증감 로직 (`adjFont`, `adjCardFont`, `adjRadius`, `adjGap`, etc.)

### `src/app/main.js`

- 초기 진입점 (`init`)
- 각 모듈의 함수를 `window`에 연결
- 키보드 단축키 (`/`, `n`, `m`, `l`, `z`, `?`, `Ctrl+i/e/,/s`)
- 서버 polling (`startPolling`, `setServerStatus`)
- 검색/필터 이벤트 핸들러
- 대시보드 섹션 순서 드래그 (`dbSecDragStart` 등)

### `featureMatrix-server/server.py`

- 공유 데이터 저장 API
- 편집자/관리자 이중 역할 인증
- 편집 락 (메모리, TTL 60초 자동 만료)
- 활동 로그 기록/조회
- 정적 파일 서빙

---

## 데이터 모델

각 feature item은 대체로 다음 필드를 가진다.

```js
{
  key,          // 'N0001' 형식
  name,
  desc,
  path,
  group,
  subGroup,
  category,
  subCategory,
  priority,     // '상' | '중' | '하'
  status,       // '' | '기획' | '개발중' | '완료' | '보류'
  owner,
  isDelete,     // 'N' | 'Y'
  isImportant,  // 'N' | 'Y'
  relSystem,
  memo,
  mdPath,
  mdContent,
  updatedAt     // timestamp (ms)
}
```

### 저장 정책

- `items`는 로컬과 서버 모두에 들어간다.
- 서버에는 일부 `settings`만 공유된다 (`SHARED_SETTINGS`).
- 개인별 설정은 로컬 저장소에만 남는다.

`state.js` 기준 공유 설정 (`SHARED_SETTINGS`):

- `title`, `subtitle`
- `groupOrder`, `catOrder`
- `dbHeroName`, `dbSections`
- `priorityStyles`, `customColors`
- `matrixWidth`, `cellFold`
- `colW`, `catW`, `subCatW`
- `cardRadius`, `cardGap`
- `changeLogMax`

---

## 에이전트 작업 원칙

### 프런트 기능 수정 시

1. `main.js`에서 해당 함수가 `window`에 노출되는지 확인한다.
2. 상태 변경이 있으면 `save()` 호출 여부를 본다.
3. 화면 갱신이 필요하면 `renderAll()`, `renderMatrix()`, `renderList()` 중 적절한 것을 호출한다.
4. 새 필드를 추가하면 최소한 아래를 같이 수정한다.
   - `constants.js`
   - `modal.js`
   - `render.js`
   - `io.js`
   - 데모/초기화 로직

### 서버 수정 시

1. `server.py`와 `src/app/state.js`를 같이 본다.
2. 응답 JSON shape가 바뀌면 `loadFromServer`, `saveToServer`, `pollServerTs`도 함께 맞춘다.
3. 인증/권한 관련 로직은 클라이언트와 서버를 동시에 검증한다.

### 빌드 확인

프런트 수정 후 최소 확인 순서:

1. `node src/build.js`
2. `src/dist/index.html` 생성 확인
3. `featureMatrix-server/static/index.html` 반영 확인

서버 확인 순서:

1. `pip install -r requirements.txt`
2. `python server.py --port 5000`
3. 브라우저에서 UI 접속 후 저장/불러오기 확인

---

## 현재 코드 리뷰 기준 버그/리스크

### 1. `pollServerTs()`가 `locks` 필드를 반환하지 않음 ★ 버그

- 서버 `/api/ping`은 `locks` 객체를 반환한다.
- `state.js`의 `pollServerTs()`는 `{ serverTs, lastEditor, lastEditTime, hasEditorPw }`만 반환한다.
- `main.js`의 `startPolling()`에서 `result.locks` 를 체크하지만 항상 `undefined`가 된다.
- 결과: 다른 사용자가 아이템 편집 중일 때 락 UI(노란 점선 테두리)가 갱신되지 않는다.

수정 위치: `src/app/state.js` → `pollServerTs()` 반환 객체에 `locks: json.locks` 추가.

### 2. `main.js`에서 `saveUserNamePopup` 이중 정의

- line 364: `window.saveUserNamePopup`이 정의된 뒤 `window`에 바인딩된다.
- line 592: `init()` 이후 동일 이름으로 재정의되어 덮어쓴다.
- 두 번째 정의가 최종 적용되므로 첫 번째 정의(line 364~374)는 dead code다.

수정 위치: `src/app/main.js` line 364~374 제거.

### 3. `loadInlineActivityLog`에서 미정의 변수 `res` 참조

- `apiFetch`는 HTTP 비-2xx 응답을 `throw`하므로 `try` 블록 안에서 `json.ok === false`인 경우는 
  이론상 발생하지 않는다.
- 그러나 코드 내 `if (!json.ok) { if (res.status === 403) ... }` 형태로 `res`를 참조하고 있어,
  만약 실행된다면 `ReferenceError`가 발생한다.
- 현재는 dead code이지만 `apiFetch` 구현이 바뀌면 런타임 에러로 터질 수 있다.

수정 위치: `src/app/main.js` `loadInlineActivityLog` 내 `if (!json.ok)` 블록 정리.

### 4. 시간 포매팅 함수 3중 중복

- `state.js`: `fmtDate(ts)` — export됨, 분/시간/일 전 포맷
- `main.js`: `fmtAgo(ts)` — 로컬 함수, 거의 동일한 로직
- `dashboard.js`: `timeAgo(ts)` — 로컬 함수, 비슷한 로직

`main.js`의 `fmtAgo`와 `dashboard.js`의 `timeAgo`는 `state.js`의 `fmtDate`를 import해서 대체할 수 있다.

### 5. `handleLockedClick`이 window에 미노출

- `admin.js`에서 export되지만 `main.js`의 `Object.assign(window, ...)` 블록에 포함되지 않는다.
- HTML에서 인라인 이벤트로 호출 시 `ReferenceError` 발생.
- 현재 HTML에서 실제 사용 여부 확인 후 바인딩 또는 제거 결정 필요.

---

## 우선순위 높은 후속 작업

1. `pollServerTs()`에 `locks` 필드 추가 (실시간 편집 락 UI 복구)
2. `main.js`의 중복 `saveUserNamePopup` 제거
3. `loadInlineActivityLog`의 `res` 미정의 참조 정리
4. `fmtAgo` / `timeAgo` → `fmtDate` 통합
5. `handleLockedClick` window 바인딩 추가 또는 사용처 삭제

---

## 권장 개발 흐름

### UI 기능 추가

1. 요구사항이 상태 변경인지, 단순 렌더링인지 구분한다.
2. 필요한 상태 필드를 `state.js` 또는 item schema에 정의한다.
3. 입력 UI는 `index.html` 또는 `modal.js` 관련 DOM을 수정한다.
4. 표시 UI는 `render.js`에 반영한다.
5. 저장/불러오기와 export/import 영향 범위를 점검한다.
6. `build.js`로 번들 결과까지 확인한다.

### 서버 동기화 기능 추가

1. 서버 payload 스키마를 먼저 설계한다.
2. `server.py` 응답 구조를 바꾼다.
3. `state.js`의 load/save/poll 코드를 동기화한다.
4. polling 배너나 conflict UI가 필요한지 `main.js`를 검토한다.

---

## 빠른 변경 체크리스트

- 새 함수가 HTML 인라인 이벤트에서 호출되는가
- 그러면 `window` 바인딩이 필요한가
- 상태 변경 뒤 `save()`가 호출되는가
- 화면 갱신이 필요한가
- 서버 모드와 로컬 모드 둘 다 깨지지 않는가
- `src/build.js` 결과가 정상인가
- `featureMatrix-server/static/index.html`까지 반영됐는가

---

## 추천 진입 파일

작업 목적별로 먼저 읽으면 좋은 파일은 아래와 같다.

- 전체 흐름 파악: `src/app/main.js`
- 데이터/저장 구조: `src/app/state.js`
- 화면 표시 수정: `src/app/render.js`
- 대시보드 수정: `src/app/dashboard.js`
- 편집 모달 수정: `src/app/modal.js`
- import/export 수정: `src/app/io.js`
- 서버 저장 로직: `featureMatrix-server/server.py`

---

## 결론

이 프로젝트는 구조 자체는 단순하지만, 전역 상태와 `window` 바인딩에 많이 의존한다. 따라서 기능을 추가할 때는 한 파일만 수정해서 끝나는 경우가 드물다. 보통 상태, 렌더링, 저장, 빌드 결과를 함께 확인해야 안전하다.
