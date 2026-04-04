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
│     └─ main.js
└─ featureMatrix-server/
   ├─ server.py
   ├─ config.json
   ├─ data.json
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

- `featureMatrix-server/server.py`는 `GET /api/data`, `POST /api/data`, `GET /api/ping`, `POST /api/auth`를 제공한다.
- `config.json`에 API key를 저장하고, `data.json`에 현재 공유 payload를 저장한다.
- 정적 파일은 `featureMatrix-server/static/index.html`에서 서빙한다.

### 빌드

- 개발 소스는 모듈형 JS다.
- `src/build.js`가 여러 JS 파일을 하나로 합쳐 `src/dist/index.html`을 만든다.
- 빌드 후 `featureMatrix-server/static/index.html`로 자동 복사한다.

---

## 주요 파일 역할

### `src/app/constants.js`

- 필드 목록 `FIELDS`
- 라벨 맵 `FLABELS`
- 상태값, 테마 정의, 데모 데이터
- 상태/우선순위의 허용값을 여기 기준으로 맞춘다

### `src/app/state.js`

- 전역 상태 `S`
- 로컬 저장/복원
- 서버 저장/복원
- undo stack
- 공통 유틸리티 (`esc`, `eattr`, `genKey`, `notify` 등)

주의:
- 저장 관련 동작의 중심 파일이라 기능 추가 시 가장 먼저 확인해야 한다.
- 공유 설정과 개인 설정을 분리해서 저장한다.

### `src/app/admin.js`

- 관리자 인증 토큰 처리
- 관리자 모달 열기/닫기
- 관리자 전용 UI 잠금 상태 업데이트

### `src/app/render.js`

- 매트릭스 뷰, 리스트 뷰 렌더링
- 필터 칩 렌더링
- bulk selection 상태 렌더링
- 화면에 뭔가 보이는 로직 대부분이 여기 있다

### `src/app/modal.js`

- 항목 추가/수정 모달
- markdown 편집 모드
- 컨텍스트 메뉴
- 드래그 앤 드롭 후처리

### `src/app/io.js`

- TSV/XLS/HTML/MD ZIP export
- CSV/TSV import
- markdown 파일 import

### `src/app/settings.js`

- 설정 모달 동기화
- 컬럼 순서/표시 여부
- 축 순서 편집
- 각종 UI 세팅 증감 로직

### `src/app/main.js`

- 초기 진입점
- 각 모듈의 함수를 `window`에 연결
- 키보드 단축키
- 서버 polling

### `featureMatrix-server/server.py`

- 공유 데이터 저장 API
- API key 검사
- 관리자 인증 엔드포인트
- 정적 파일 서빙

---

## 데이터 모델

각 feature item은 대체로 다음 필드를 가진다.

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

### 저장 정책

- `items`는 로컬과 서버 모두에 들어간다.
- 서버에는 일부 `settings`만 공유된다.
- 개인별 설정은 로컬 저장소에만 남는다.

`state.js` 기준 공유 설정:

- `title`
- `subtitle`
- `groupOrder`
- `catOrder`
- `priorityStyles`
- `customColors`
- `matrixWidth`
- `cellFold`
- `colW`
- `catW`
- `subCatW`
- `cardRadius`
- `cardGap`

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

## 현재 코드 리뷰 기준 주요 리스크

아래 항목은 후속 작업 전에 먼저 확인하는 것이 좋다.

### 1. `main.js`에서 미수입 식별자 사용

- `bulkSel`, `esc`, `notify`, `fmtAgo` 등이 로컬 import 없이 사용된다.
- 대표 위치:
  - `src/app/main.js`의 bulk 작업 구간
  - diff modal 구성 구간
  - polling 메시지 구간

영향:
- 관련 버튼이나 배너 로직 실행 시 `ReferenceError` 가능성이 높다.

### 2. `state.js`에 중복 함수와 잘못된 함수 호출 존재

- `resolveConflictUseServer`가 두 번 선언되어 있다.
- 두 번째 선언은 존재하지 않는 `applyPayload`를 호출한다.

영향:
- conflict 처리 경로가 실행되면 런타임 에러 또는 의도치 않은 동작 가능성이 있다.

### 3. 서버가 관리자 토큰을 실제 쓰기 권한에 사용하지 않음

- `server.py`에는 `check_admin_token()`이 있지만 `POST /api/data`에서 호출하지 않는다.
- 현재는 API key만 알면 누구나 전체 데이터를 수정할 수 있다.

영향:
- 클라이언트의 관리자 잠금 UI는 우회 가능하고, 서버 단에서는 권한 보호가 성립하지 않는다.

### 4. README와 실제 충돌 처리 구현이 다름

- README는 `serverTs` 기반 충돌 감지와 `409 Conflict`를 설명한다.
- 실제 서버 구현은 last-write-wins이며 409를 반환하지 않는다.

영향:
- 동시 편집 시 데이터 유실이 발생할 수 있고 문서 신뢰도도 떨어진다.

---

## 우선순위 높은 후속 작업 제안

1. `main.js` import 누락과 참조 오류부터 정리
2. `state.js`의 중복 함수 제거 및 conflict 로직 정리
3. 서버 write API에 관리자 토큰 강제 여부 결정
4. README와 실제 서버 동작을 일치시키기
5. 핵심 저장/불러오기 경로에 smoke test 추가

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
- 편집 모달 수정: `src/app/modal.js`
- import/export 수정: `src/app/io.js`
- 서버 저장 로직: `featureMatrix-server/server.py`

---

## 결론

이 프로젝트는 구조 자체는 단순하지만, 전역 상태와 `window` 바인딩에 많이 의존한다. 따라서 기능을 추가할 때는 한 파일만 수정해서 끝나는 경우가 드물다. 보통 상태, 렌더링, 저장, 빌드 결과를 함께 확인해야 안전하다.

특히 서버 동기화와 관리자 권한은 UI와 서버 구현이 완전히 일치하지 않는 부분이 있으므로, 후속 에이전트는 이 영역을 먼저 안정화한 뒤 기능 확장을 진행하는 편이 좋다.
