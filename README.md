# featureMatrix-server

공유 데이터 서버 — 팀 전체가 같은 매트릭스를 봅니다.

## 폴더 구조

```
featureMatrix-server/
├── server.py          ← Flask 서버
├── config.json        ← API 키 (자동 생성)
├── data.json          ← 데이터 저장소 (자동 생성)
├── requirements.txt
├── README.md
└── static/
    └── index.html     ← node build.js 후 자동 복사
```

## 설치 및 실행

```bash
pip install flask

python server.py
# 또는 포트 지정
python server.py --port 8080 --host 0.0.0.0
```

최초 실행 시 `config.json`이 생성되고 API 키가 출력됩니다.

```
🚀 featureMatrix-server
   http://0.0.0.0:5000
   API Key: a1b2c3d4e5f6...
   데이터: /path/to/data.json
```

## 클라이언트 설정

1. 브라우저에서 `http://서버IP:5000` 접속
2. 설정(⚙) → **서버** 탭 진입
3. 서버 URL 입력 (같은 서버라면 비워두면 됨)
4. API Key 붙여넣기
5. **설정 저장** 클릭

## API

| Method | Path | 설명 |
|---|---|---|
| GET | /api/data | 전체 데이터 반환 |
| POST | /api/data | 저장 (충돌 감지 포함) |
| GET | /api/ping | 타임스탬프 폴링 |

모든 요청에 `X-API-Key` 헤더 필요.

## 충돌 감지

- 클라이언트가 저장 시 마지막으로 받은 `serverTs`를 함께 전송
- 서버의 현재 `serverTs`가 더 크면 → 409 Conflict 반환
- 클라이언트에서 **내 데이터 유지** / **서버 데이터 사용** 선택

## 폴링

- 기본 10초마다 서버 타임스탬프 확인
- 변경 감지 시 헤더에 업데이트 알림 배너 표시
- 설정에서 주기 변경 가능 (5~300초)

## 빌드 연동

`sobuk-v9/` 폴더에서 `node build.js` 실행 시  
`featureMatrix-server/static/index.html`에 자동 복사됩니다.
