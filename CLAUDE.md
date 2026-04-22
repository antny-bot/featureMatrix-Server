# Project Rules: Flask & HTML Web Application

## Core Collaboration Principles
1. **Consult Before Major Changes**: If a request requires extensive modifications or refactoring across multiple files, stop and ask for my confirmation before proceeding.
2. **Modular Architecture**: Never put all code into a single file (e.g., avoid a massive `app.py`). Follow a modular approach:
   - Use **Flask Blueprints** to separate features/routes.
   - Keep business logic, database models, and utility functions in separate modules.
   - Follow the "Separation of Concerns" principle.
3. **Clarify Before Execution**: If my request is ambiguous or lacks detail, do not infer or guess my intent. Instead, explain how you interpreted the request and ask for my confirmation before implementation.

## GitHub Issue Workflow
- **Status Filter**: When fetching or referencing issues from GitHub, **only process issues that have the project status set to 'ready'**. Ignore all other statuses unless explicitly instructed otherwise.

## Tech Stack & Style
- **Framework**: Flask (Python)
- **Frontend**: React + TypeScript (`src/` 디렉토리), CSS 변수 기반 자체 스타일 시스템 (`src/style.css`)
- **Tailwind CSS 정책**:
  - 기존 컴포넌트 스타일은 `style.css`의 CSS 변수/클래스 체계를 그대로 유지한다 (전면 교체 금지)
  - **신규 추가 컴포넌트** 또는 **기존 컴포넌트의 신규 UI 영역**에만 Tailwind 유틸리티 클래스를 점진적으로 적용한다
  - Tailwind 클래스와 기존 CSS 클래스를 같은 요소에 혼용할 때는 충돌 여부를 확인할 것
- **Code Style**:
  - Use clear, descriptive function and variable names.
  - Follow PEP 8 guidelines for Python code.
  - Keep templates clean and use 'extends'/'include' for reusability.

## Frontend Build System
- **절대로 `featureMatrix-server/static/index.html`을 직접 수정하지 말 것** — 이 파일은 빌드 결과물이다.
- 프론트엔드 소스는 `src/` 디렉토리에 있다:
  - TS/TSX 모듈: `src/app/*.ts`, `src/components/*.tsx`, `src/hooks/*.ts` 등
  - CSS: `src/style.css`
  - HTML 템플릿: `src/index.html`
- 빌드 명령: `cd src && npm run build`
  - 빌드 결과는 `src/dist/index.html`에 생성되고, `featureMatrix-server/static/index.html`로 자동 복사된다.
- 프론트엔드 변경 시 항상 소스 파일(`src/`)을 수정한 후 빌드를 실행할 것.

## Do Not Read (불필요한 토큰 낭비 방지)
다음 파일들은 읽지 말 것 — 빌드 결과물, 바이너리, 런타임 데이터이므로 코드 작업과 무관하다:

| 파일 | 이유 |
|------|------|
| `featureMatrix-server/static/index.html` | 빌드 결과물 (소스: `src/index.html`) |
| `src/dist/index.html` | 빌드 중간 결과물 |
| `featureMatrix-server/__pycache__/*.pyc` | Python 컴파일 캐시 |
| `featureMatrix-server/static/fonts/*.woff2` | 바이너리 폰트 파일 |
| `src/package-lock.json` | 자동 생성 의존성 잠금 파일 |
| `featureMatrix-server/activity.json` | 런타임 활동 로그 데이터 |
| `featureMatrix-server/tokens.json` | 런타임 인증 토큰 데이터 |

Additional agent-ignore targets:

| Path | Reason |
|------|--------|
| `.git/` | VCS metadata; use Git commands instead of reading internals |
| `.github/` | GitHub workflow metadata; read only when working on CI/release configuration |
| `.claude/` | Local agent metadata |
| `node_modules/`, `src/node_modules/` | Installed dependencies |
| `implementation.md`, `docs/*plan*.md` | Agent planning/reference notes, not application source |
| `scratch*.js`, `*_migration.js` | Temporary scratch/migration scripts |

## Commands
- Run App: `python app.py` or `flask run`
- Install Dependencies: `pip install -r requirements.txt`
- Build Frontend: `cd src && npm run build`
