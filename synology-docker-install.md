# Synology에서 featureMatrix-Server 실행하기

GitHub Container Registry(GHCR)에서 이미지를 자동으로 받아오는 방식으로, 소스코드 복사 없이 설치할 수 있습니다.

---

## 설치 방법 (권장 — GHCR 이미지 사용)

### 1단계: Synology에 폴더 및 파일 준비

SSH로 Synology에 접속하거나 File Station에서 아래 폴더를 생성합니다.

```
/volume1/docker/featureMatrix/
```

해당 폴더 안에 아래 두 파일을 생성합니다.

---

#### `docker-compose.yml`

```yaml
services:
  feature-matrix:
    image: ghcr.io/antny-bot/featurematrix-server:latest
    ports:
      - "${PORT:-5000}:5000"
    environment:
      HOST: 0.0.0.0
      PORT: 5000
      FEATURE_MATRIX_DATA_DIR: /app/data
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:?ADMIN_PASSWORD를 .env 파일에 설정하세요}
      EDITOR_PASSWORD: ${EDITOR_PASSWORD:-}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

---

#### `.env`

```
ADMIN_PASSWORD=여기에관리자비밀번호입력
EDITOR_PASSWORD=여기에편집자비밀번호입력
PORT=5000
```

---

### 2단계: data 폴더 생성

```bash
mkdir -p /volume1/docker/featureMatrix/data
```

---

### 3단계: 실행

```bash
cd /volume1/docker/featureMatrix
docker compose up -d
```

> 처음 실행 시 GHCR에서 이미지를 다운로드합니다 (약 1~2분 소요).  
> 소스코드 빌드가 없으므로 이전보다 훨씬 빠릅니다.

---

### 4단계: 접속 확인

```
http://[Synology_IP]:5000
```

---

## 업데이트 방법

### 방법 1: Synology Container Manager에서 업데이트 버튼 클릭 (권장)

1. DSM → **Container Manager** 실행
2. 좌측 **프로젝트** 메뉴 선택
3. `featurematrix` 프로젝트에 **업데이트 가능** 배지가 표시되면 클릭
4. 자동으로 새 이미지 다운로드 후 컨테이너 재시작

> 새 버전이 GHCR에 배포되면 Container Manager가 자동으로 감지합니다.

---

### 방법 2: SSH 명령어로 수동 업데이트

```bash
cd /volume1/docker/featureMatrix
docker compose pull
docker compose up -d
```

---

### 방법 3: Watchtower로 완전 자동 업데이트 (선택사항)

`docker-compose.yml`에 아래 서비스를 추가하면 주기적으로 새 이미지를 확인하고 자동으로 업데이트합니다.

```yaml
services:
  feature-matrix:
    image: ghcr.io/antny-bot/featurematrix-server:latest
    # ... (기존 설정 유지)

  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 3600 --cleanup
    restart: unless-stopped
```

> `--interval 3600` = 1시간마다 업데이트 확인

---

## 특정 버전 고정 사용

최신 버전 대신 특정 버전을 사용하려면 `docker-compose.yml`의 이미지 태그를 변경합니다.

```yaml
# 최신 버전 (자동 업데이트됨)
image: ghcr.io/antny-bot/featurematrix-server:latest

# 특정 버전 고정 (안정적이지만 수동 업데이트 필요)
image: ghcr.io/antny-bot/featurematrix-server:1.2.3
```

---

## 유지관리 명령어

| 작업 | 명령어 |
|------|--------|
| 로그 확인 | `docker compose logs -f` |
| 재시작 | `docker compose restart` |
| 중지 | `docker compose down` |
| 이미지 업데이트 | `docker compose pull && docker compose up -d` |
| 이미지 정리 | `docker image prune -f` |

---

## 주의사항

- **데이터 영속성**: `data.json`, `config.json` 등은 `/volume1/docker/featureMatrix/data/` 폴더에 저장됩니다. 업데이트해도 데이터는 유지됩니다.
- **DSM 7.x 이상**: Container Manager 앱에서 Compose 파일을 직접 불러올 수 있습니다 (프로젝트 → 가져오기).
- **SSH 활성화**: DSM → 제어판 → 터미널 및 SNMP → SSH 서비스 활성화

---

## 로컬 개발 환경 (개발자용)

소스코드에서 직접 빌드하려면 `docker-compose.dev.yml`을 사용합니다.

```bash
git clone https://github.com/antny-bot/featureMatrix-Server
cd featureMatrix-Server
cp .env.example .env  # .env 파일 편집
docker compose -f docker-compose.dev.yml up -d --build
```
