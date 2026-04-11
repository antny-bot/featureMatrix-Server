# featureMatrix-ServerAdmin

기능 매트릭스 데이터를 브라우저에서 관리하고, Flask 서버를 통해 여러 사용자가 같은 데이터를 공유할 수 있게 만든 관리자 도구입니다.

이 저장소는 두 부분으로 나뉩니다.

- `src/`: 관리자 UI 소스
- `featureMatrix-server/`: 정적 파일 서빙 + 공유 데이터 API 서버

## 프로젝트 구조

```text
featureMatrix-ServerAdmin/
|-- src/
|   |-- index.html
|   |-- style.css
|   |-- build.js            # 레거시 번들러 (정규식 기반)
|   |-- build-esbuild.js    # esbuild 기반 번들러 (권장)
|   |-- package.json
|   |-- app/
|   |   |-- constants.js    # 상수, DATA_VERSION, 마이그레이션 정의
|   |   |-- state.js        # 전역 상태, 저장/로드, apiFetch 유틸
|   |   |-- admin.js        # 인증 (관리자/편집자)
|   |   |-- theme.js        # 테마/색상
|   |   |-- render.js       # 매트릭스·리스트 렌더, 고급 검색
|   |   |-- modal.js        # 편집 모달
|   |   |-- io.js           # Import/Export (TSV·XLS·HTML·MD·ZIP·JSON 백업)
|   |   |-- settings.js     # 설정 UI
|   |   |-- dashboard.js    # 대시보드 뷰
|   |   `-- main.js         # 초기화, 이벤트, 폴링
|   `-- dist/
|       `-- index.html      # 빌드 결과물
|-- featureMatrix-server/
|   |-- server.py
|   |-- config.json
|   |-- data.json
|   |-- activity.json
|   |-- requirements.txt
|   `-- static/
|       |-- index.html
|       `-- fonts/
|-- Dockerfile              # 멀티스테이지 빌드 (Node.js → Python)
|-- docker-compose.yml
|-- .dockerignore
|-- .env.example
|-- implementation.md
`-- README.md
```

## 주요 동작

- `src/app/*.js`는 ES module 형태의 프런트엔드 코드입니다.
- 빌드하면 단일 파일 번들인 `src/dist/index.html`이 생성되고 `featureMatrix-server/static/`으로 자동 복사됩니다.
- `featureMatrix-server/server.py`는 정적 HTML을 서빙하고, 공유 데이터용 API를 제공합니다.
- 서버 데이터는 `featureMatrix-server/data.json`에 저장되고, 활동 로그는 `featureMatrix-server/activity.json`에 저장됩니다.

## 개발 및 실행

### 1. Python 의존성 설치

```bash
pip install -r featureMatrix-server/requirements.txt
```

### 2. 프런트엔드 빌드

**권장 — esbuild 번들러** (ES Module을 올바르게 처리, tree-shaking 지원):

```bash
cd src
npm install
npm run build
```

**레거시 — 정규식 기반 번들러** (Node.js 외 추가 의존성 없음):

```bash
node src/build.js
```

빌드 결과:

- `src/dist/index.html`
- `featureMatrix-server/static/index.html` 자동 갱신

### 3. 서버 실행

```bash
python featureMatrix-server/server.py
```

옵션 예시:

```bash
python featureMatrix-server/server.py --host 0.0.0.0 --port 5000
python featureMatrix-server/server.py --host 0.0.0.0 --port 5000 --admin-password 1234
```

첫 실행 시 `featureMatrix-server/config.json`이 생성되며 API 키가 발급됩니다.

## 주요 기능

### 데이터 관리
- 기능 항목 CRUD (Key·이름·그룹·카테고리·우선순위·상태·담당자 등)
- Undo / 변경 이력 조회
- 전체 백업 JSON 내보내기 / 가져오기 (`expFullJSON` / `impFullJSON`)
- TSV·XLS·HTML·MD ZIP 내보내기 및 CSV 가져오기
- CSV/TSV 가져오기 시 필수 필드(`key`, `name`) 매핑 검증

### 검색 / 필터
- 일반 텍스트 전문 검색
- 필드 지정 검색 문법: `owner:홍길동`, `status:완료`, `group:인증`, `priority:상` 등
- 우선순위·상태·담당자·중요 여부 필터 패널
- 필터 상태가 대시보드에도 반영됨

### 협업 (서버 모드)
- 다른 사용자 변경 감지 폴링 (간격 설정 가능)
- 항목별 편집 락 (5분 TTL — 편집창 비정상 종료 시 자동 해제)
- 활동 로그 (관리자 전용)

### UI / 알림
- 알림 타입: 기본·`success`·`warning`·`error` (색상 구분)
- 대시보드: 히트맵, 그룹별 진척도, 담당자 현황, 최근 변경 타임라인

### 데이터 안전성
- `localStorage` 용량 초과 시 `warning` 알림
- 스키마 버전(`DATA_VERSION`) 관리 — 로드 시 마이그레이션 자동 적용

## 서버 API

### 인증

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/auth` | 역할별 토큰 발급 (`role: "admin"` 또는 `"editor"`) |

요청 예시:

```json
{ "password": "1234", "role": "admin", "name": "홍길동" }
```

### 데이터

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET`  | `/api/data` | 공유 데이터 조회 |
| `POST` | `/api/data` | 공유 데이터 저장 (`payload`, `editor`, `dataVersion` 포함) |
| `GET`  | `/api/ping` | `serverTs`, 마지막 수정자, 편집 락 목록 반환 |

### 활동 로그

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET`  | `/api/log?limit=N` | 로그 조회 (관리자 토큰 필요) |
| `POST` | `/api/log` | 로그 기록 |

### 편집 락

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/lock`   | 항목 락 요청 |
| `POST` | `/api/unlock` | 락 해제 |

> 클라이언트는 락 후 5분이 지나면 자동으로 언락을 요청합니다.

### 관리자 설정

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/set-editor-password` | 편집자 비밀번호 변경 (관리자 전용) |

## 작업 흐름

프런트엔드 기능을 수정할 때는 보통 아래 순서로 작업하면 됩니다.

1. `src/app/` 안에서 관련 모듈 수정
2. `cd src && npm run build` (또는 `node src/build.js`)
3. `featureMatrix-server/static/index.html` 반영 확인
4. `python featureMatrix-server/server.py`로 로컬 서버 실행
5. 브라우저에서 동작 확인

## 스키마 마이그레이션

아이템 필드가 추가·변경될 때는 `src/app/constants.js`를 수정합니다.

```js
// 버전 번호 올리기
export const DATA_VERSION = 3;

// 이전 버전 → 다음 버전 변환 함수 추가
export const MIGRATIONS = {
  1: item => ({ ...item, status: item.status ?? '', updatedAt: item.updatedAt ?? 0 }),
  2: item => ({ ...item, newField: item.newField ?? '기본값' }),
};
```

로드 시 저장된 버전부터 `DATA_VERSION`까지 마이그레이션이 자동 적용됩니다.

## 참고 문서

- [implementation.md](implementation.md): 코드 구조와 수정 포인트 정리

## 주의사항

- `featureMatrix-server/activity.json`은 실행 중 변경되는 데이터 파일입니다.
- 현재 서버는 `serverTs` 충돌 감지 후 클라이언트에서 선택(내 것 유지 / 서버 것 적용)하는 방식입니다.
- esbuild 번들러는 `cd src && npm install` 이후에 사용 가능합니다. 설치하지 않은 경우 `build-esbuild.js`가 자동으로 레거시 번들러(`build.js`)로 폴백합니다.

## Docker

루트에 멀티스테이지 `Dockerfile`과 `docker-compose.yml`이 포함되어 있습니다.

### 빠른 시작

```bash
# 1. 환경변수 파일 준비
copy .env.example .env    # Windows CMD
# cp .env.example .env    # bash / macOS / Linux

# 2. .env 파일에서 ADMIN_PASSWORD 수정 (필수)

# 3. 실행
docker compose up --build -d
```

접속: `http://localhost:5000`

데이터는 `./data` 폴더에 영속적으로 저장됩니다.

### 환경변수 (.env)

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `ADMIN_PASSWORD` | 필수 | — | 관리자 비밀번호 |
| `EDITOR_PASSWORD` | 선택 | (없음) | 편집자 비밀번호 (미설정 시 편집자 모드 비활성) |
| `PORT` | 선택 | `5000` | 호스트 포트 |

### 직접 실행 (docker run)

```bash
docker build -t feature-matrix-admin .
docker run -d \
  -p 5000:5000 \
  -e ADMIN_PASSWORD=1234 \
  -e EDITOR_PASSWORD= \
  -e FEATURE_MATRIX_DATA_DIR=/app/data \
  -v "$(pwd)/data:/app/data" \
  --name feature-matrix-admin \
  feature-matrix-admin
```

### 유용한 명령

```bash
docker compose logs -f    # 로그 확인
docker compose down       # 중지 (데이터 유지)
docker compose down -v    # 중지 + 볼륨 삭제
```

### Docker Desktop 설치 확인

Windows에서 Docker로 실행하려면 먼저 Docker Desktop이 정상 설치 및 실행 중이어야 합니다.

1. Docker Desktop을 설치하고 실행합니다.
2. 새 터미널을 열고 아래 명령이 동작하는지 확인합니다.

```bash
docker --version
docker compose version
```

3. 엔진이 살아있는지 확인합니다.

```bash
docker ps
```

위 명령이 정상 동작하면 현재 프로젝트도 Docker로 실행할 준비가 된 상태입니다.
