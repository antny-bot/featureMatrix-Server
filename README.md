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
|   |-- build.js
|   |-- app/
|   |   |-- constants.js
|   |   |-- state.js
|   |   |-- admin.js
|   |   |-- theme.js
|   |   |-- render.js
|   |   |-- modal.js
|   |   |-- io.js
|   |   |-- settings.js
|   |   `-- main.js
|   `-- dist/
|       `-- index.html
|-- featureMatrix-server/
|   |-- server.py
|   |-- config.json
|   |-- data.json
|   |-- activity.json
|   |-- requirements.txt
|   `-- static/
|       |-- index.html
|       `-- fonts/
|-- implementation.md
`-- README.md
```

## 주요 동작

- `src/app/*.js`는 ES module 형태의 프런트엔드 코드입니다.
- `node src/build.js`를 실행하면 단일 파일 번들인 `src/dist/index.html`이 생성됩니다.
- 빌드가 끝나면 결과물이 `featureMatrix-server/static/index.html`로 자동 복사됩니다.
- `featureMatrix-server/server.py`는 정적 HTML을 서빙하고, 공유 데이터용 API를 제공합니다.
- 서버 데이터는 `featureMatrix-server/data.json`에 저장되고, 활동 로그는 `featureMatrix-server/activity.json`에 저장됩니다.

## 개발 및 실행

### 1. Python 의존성 설치

```bash
pip install -r requirements.txt
```

또는 서버 폴더 기준으로:

```bash
pip install -r featureMatrix-server/requirements.txt
```

### 2. 프런트엔드 빌드

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

## 서버 API

모든 API 요청에는 `X-API-Key` 헤더가 필요합니다.

### 인증

- `POST /api/auth`
  - 관리자 비밀번호를 사용해 관리자 토큰을 발급받습니다.
  - 서버가 `--admin-password` 없이 실행된 경우, 인증 없이 관리자 토큰이 발급됩니다.

요청 예시:

```json
{
  "password": "1234"
}
```

### 데이터

- `GET /api/data`
  - 현재 저장된 공유 데이터를 반환합니다.
- `POST /api/data`
  - 공유 데이터를 저장합니다.
  - 현재 서버 구현은 `serverTs` 충돌 검사를 하지 않고 마지막 저장값으로 덮어쓰는 방식입니다.

요청 예시:

```json
{
  "payload": {},
  "editor": "heedo"
}
```

### 상태 확인

- `GET /api/ping`
  - 현재 `serverTs`, 마지막 수정자, 마지막 수정 시각, 편집 잠금 정보를 반환합니다.

### 활동 로그

- `GET /api/log`
  - 관리자 토큰이 있어야 조회할 수 있습니다.
- `POST /api/log`
  - 활동 로그를 기록합니다.

### 편집 잠금

- `POST /api/lock`
  - 특정 항목의 편집 잠금을 요청합니다.
- `POST /api/unlock`
  - 본인이 잡은 잠금을 해제합니다.

## 작업 흐름

프런트엔드 기능을 수정할 때는 보통 아래 순서로 작업하면 됩니다.

1. `src/app/` 안에서 관련 모듈 수정
2. `node src/build.js` 실행
3. `featureMatrix-server/static/index.html` 반영 확인
4. `python featureMatrix-server/server.py`로 로컬 서버 실행
5. 브라우저에서 동작 확인

## 참고 문서

- [implementation.md](/e:/apps/featureMatrix-ServerAdmin/implementation.md): 코드 구조와 수정 포인트 정리
- [featureMatrix-server/README.md](/e:/apps/featureMatrix-ServerAdmin/featureMatrix-server/README.md): 서버 폴더의 별도 문서

## 주의사항

- 저장소 안 일부 한글 텍스트는 현재 인코딩이 깨져 보이는 파일이 있습니다.
- 기존 문서에는 충돌 처리(`409 Conflict`) 설명이 있었지만, 현재 `server.py` 구현은 해당 방식이 아닙니다.
- `featureMatrix-server/activity.json`은 실행 중 변경될 수 있는 데이터 파일이므로 문서 수정과 별개로 다루는 것이 좋습니다.
