# featureMatrix-ServerAdmin

브라우저에서 기능 매트릭스를 관리하고, Flask 서버를 통해 여러 사용자가 같은 데이터를 공유할 수 있게 만든 관리자 도구입니다.

이 저장소는 두 부분으로 나뉩니다.

- `src/`: 프런트엔드 소스
- `featureMatrix-server/`: 정적 파일 서빙과 공유 데이터 API를 담당하는 Flask 서버

## 주요 특징

- 기능 항목 CRUD
- 매트릭스, 리스트, 대시보드, 보드(칸반) 뷰
- 텍스트 검색과 필드 기반 검색 (`owner:홍길동`, `status:완료`)
- 서버 모드와 로컬 모드 지원
- 항목 편집 락, 활동 로그, 관리자/편집자 권한 분리
- JSON 백업, CSV/TSV 가져오기, TSV/XLS/HTML/MD ZIP 내보내기
- 단일 HTML 번들 빌드

## 프로젝트 구조

```text
featureMatrix-ServerAdmin/
|-- src/
|   |-- index.html
|   |-- style.css
|   |-- build.js
|   |-- build-esbuild.js
|   |-- package.json
|   |-- app/
|   |   |-- admin.js
|   |   |-- board.js
|   |   |-- constants.js
|   |   |-- dashboard.js
|   |   |-- io.js
|   |   |-- main.js
|   |   |-- modal.js
|   |   |-- render.js
|   |   |-- settings.js
|   |   |-- state.js
|   |   `-- theme.js
|   `-- dist/
|       `-- index.html
|-- featureMatrix-server/
|   |-- server.py
|   |-- requirements.txt
|   `-- static/
|       `-- index.html
|-- Dockerfile
|-- docker-compose.yml
|-- VERSION
|-- implementation.md
`-- README.md
```

## 동작 방식

- 프런트엔드 코드는 `src/app/*.js`에 ES module 형태로 나뉘어 있습니다.
- `npm run build`를 실행하면 `src/dist/index.html`이 생성되고, 자동으로 `featureMatrix-server/static/index.html`에 복사됩니다.
- 서버는 `featureMatrix-server/server.py`에서 실행되며, 정적 HTML과 API를 함께 제공합니다.
- 공유 데이터는 `data.json`, 활동 로그는 `activity.json`, 관리자 토큰은 `tokens.json`에 저장됩니다.

## 빠른 시작

### 1. Python 의존성 설치

```bash
pip install -r featureMatrix-server/requirements.txt
```

### 2. 프런트엔드 의존성 설치 및 빌드

```bash
cd src
npm install
npm run build
```

대체 빌드:

```bash
cd src
npm run build:legacy
```

빌드 결과:

- `src/dist/index.html`
- `featureMatrix-server/static/index.html` 자동 갱신

### 3. 서버 실행

```bash
python featureMatrix-server/server.py
```

예시:

```bash
python featureMatrix-server/server.py --host 0.0.0.0 --port 5000
python featureMatrix-server/server.py --host 0.0.0.0 --port 5000 --admin-password 1234
python featureMatrix-server/server.py --host 0.0.0.0 --port 5000 --admin-password 1234 --editor-password 5678
```

실행 후 기본 접속 주소:

- [http://localhost:5000](http://localhost:5000)

## 사용 모드

### 서버 모드

- 여러 사용자가 같은 데이터를 공유합니다.
- 관리자와 편집자 권한을 구분합니다.
- 서버 폴링으로 다른 사용자의 변경 사항을 감지합니다.
- 활동 로그와 편집 락을 사용합니다.

### 로컬 모드

- 브라우저 `localStorage`에만 저장합니다.
- 단독 사용이나 임시 편집에 적합합니다.
- 서버 권한과 활동 로그는 사용하지 않습니다.

## 주요 기능

### 데이터 관리

- 기능 항목 추가, 수정, 삭제 처리, 완전 삭제
- 우선순위, 상태, 담당자, 중요 여부 관리
- Undo와 최근 변경 이력
- 항목별 Markdown 내용 저장

### 화면 구성

- `Dashboard`: 통계, 그룹 진척도, 담당자 현황, 최근 변경 이력, 히트맵
- `Matrix`: 그룹/카테고리 기반 매트릭스 뷰
- `Board`: 상태별 칸반 보드
- `List`: 정렬과 일괄 변경이 가능한 테이블 뷰

### 검색과 필터

- 전체 텍스트 검색
- 필드 기반 검색 구문
- 우선순위, 상태, 담당자, 중요 여부, 삭제 여부 필터
- 필터 상태를 대시보드와 다른 뷰에 함께 반영

### 가져오기 / 내보내기

- CSV/TSV 가져오기
- 전체 JSON 백업 가져오기 / 내보내기
- TSV, XLS, HTML, Markdown ZIP 내보내기

## 저장 구조

서버 모드에서는 모든 설정이 공유되지 않습니다.

- 서버에 저장되는 것: `items`, `changeLog`, 일부 공유 설정
- 브라우저 로컬에 저장되는 것: 표시 옵션, 필터, 테마, 서버 연결 정보, 사용자 이름 등 개인 설정

서버 연결에 실패하면 로컬 캐시를 유지하면서 경고를 표시합니다.

## 서버 API

### 인증

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/auth` | 관리자 또는 편집자 토큰 발급 |

요청 예시:

```json
{ "password": "1234", "role": "admin", "name": "홍길동" }
```

### 데이터

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET`  | `/api/data` | 공유 데이터 조회 |
| `POST` | `/api/data` | 공유 데이터 저장 |
| `GET`  | `/api/ping` | `serverTs`, `lastEditor`, `lastEditTime`, `locks`, `hasEditorPw` 조회 |

### 활동 로그

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET`  | `/api/log?limit=N` | 활동 로그 조회, 관리자 토큰 필요 |
| `POST` | `/api/log` | 활동 로그 기록, 편집 권한 필요 |

### 편집 락

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/lock` | 항목 편집 락 요청 |
| `POST` | `/api/unlock` | 항목 편집 락 해제 |

### 관리자 설정

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/set-editor-password` | 편집자 비밀번호 변경 |

## Docker

루트의 `docker-compose.yml`은 로컬 빌드 대신 배포 이미지를 사용합니다.

### 빠른 시작

```bash
copy .env.example .env
docker compose up -d
```

`.env`에서 최소한 `ADMIN_PASSWORD`는 수정해야 합니다.

### 환경변수

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `ADMIN_PASSWORD` | 필수 | 없음 | 관리자 비밀번호 |
| `EDITOR_PASSWORD` | 선택 | 빈 값 | 편집자 비밀번호 |
| `PORT` | 선택 | `5000` | 호스트 포트 |

### 데이터 위치

컨테이너 내부 데이터 경로:

- `/app/data`

기본 compose 설정에서는 로컬 `./data` 폴더가 여기에 마운트됩니다.

### 로컬에서 이미지 직접 빌드

```bash
docker build -t feature-matrix-admin .
docker run -d -p 5000:5000 -e ADMIN_PASSWORD=1234 -e EDITOR_PASSWORD= -e FEATURE_MATRIX_DATA_DIR=/app/data -v "$(pwd)/data:/app/data" --name feature-matrix-admin feature-matrix-admin
```

## 버전과 릴리스

- 현재 앱 버전은 루트의 `VERSION` 파일을 기준으로 합니다.
- 프런트 빌드 시 버전과 빌드 번호가 화면에 주입됩니다.
- `release.js`는 버전 업데이트와 git tag/push 자동화를 위한 스크립트입니다.

## 개발 메모

- 프런트엔드 소스는 항상 `src/` 아래를 수정해야 합니다.
- `featureMatrix-server/static/index.html`은 빌드 결과물이므로 직접 수정하지 않습니다.
- 내부 구조와 모듈 책임은 [implementation.md](implementation.md)를 참고하세요.
