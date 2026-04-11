FROM node:22-alpine AS frontend-builder
WORKDIR /app

# VERSION 파일을 먼저 복사 (빌드 시 버전 주입에 필요)
COPY VERSION ./VERSION

WORKDIR /app/src
COPY src/package*.json ./
RUN npm ci

COPY src/ ./

# GITHUB_RUN_NUMBER를 빌드 arg로 받아서 환경변수로 전달
ARG GITHUB_RUN_NUMBER=local
ENV GITHUB_RUN_NUMBER=${GITHUB_RUN_NUMBER}

RUN npm run build
# 빌드 결과: /app/src/dist/index.html

FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=5000
ENV FEATURE_MATRIX_DATA_DIR=/app/data

COPY featureMatrix-server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY featureMatrix-server/ ./featureMatrix-server/
RUN mkdir -p /app/featureMatrix-server/static /app/data
COPY --from=frontend-builder /app/src/dist/index.html /app/featureMatrix-server/static/index.html

EXPOSE 5000

CMD ["python", "featureMatrix-server/server.py"]
