#!/usr/bin/env python3
"""
featureMatrix-server
Flask 기반 공유 데이터 서버
실행: python server.py [--port 5000] [--host 0.0.0.0] [--admin-password 1234]
"""

import json, os, time, argparse, secrets
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, abort

BASE_DIR       = Path(__file__).parent
STATIC_DIR     = BASE_DIR / 'static'
DATA_FILE      = BASE_DIR / 'data.json'
CONFIG_FILE    = BASE_DIR / 'config.json'
ACTIVITY_FILE  = BASE_DIR / 'activity.json'
TOKENS_FILE    = BASE_DIR / 'tokens.json'

TOKEN_TTL_MS   = 24 * 60 * 60 * 1000  # 24시간

app = Flask(__name__, static_folder=str(STATIC_DIR))

# ── 런타임 설정 (argparse 결과 저장) ──────────────────────
RUNTIME = {'admin_password': None}

# ── 세션 토큰 저장소 { token: expire_ts } ────────────────
admin_tokens: dict = {}

# ── 편집 락 저장소 (메모리) ───────────────────────────────
edit_locks = {}  # { key: { user, ts } }

# ── 토큰 파일 저장/로드 ───────────────────────────────────
def load_tokens():
    """서버 시작 시 토큰 파일을 읽어 만료되지 않은 토큰만 복원."""
    global admin_tokens
    if not TOKENS_FILE.exists():
        return
    try:
        with open(TOKENS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        now = int(time.time() * 1000)
        admin_tokens = {t: exp for t, exp in data.items() if exp > now}
    except Exception:
        admin_tokens = {}

def save_tokens():
    """현재 유효 토큰을 파일에 저장."""
    try:
        with open(TOKENS_FILE, 'w', encoding='utf-8') as f:
            json.dump(admin_tokens, f, separators=(',', ':'))
    except Exception:
        pass

def purge_expired_tokens():
    """만료 토큰 정리."""
    now = int(time.time() * 1000)
    expired = [t for t, exp in admin_tokens.items() if exp <= now]
    for t in expired:
        del admin_tokens[t]

# ── config.json 로드 ──────────────────────────────────────
def load_config():
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
        # 구버전 config에 allowed_origins 없으면 추가
        if 'allowed_origins' not in cfg:
            cfg['allowed_origins'] = []
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(cfg, f, indent=2, ensure_ascii=False)
        return cfg
    cfg = {'api_key': secrets.token_hex(16), 'allowed_origins': []}
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    print(f'\n✅ config.json 생성됨')
    print(f'   API Key: {cfg["api_key"]}')
    print(f'   이 키를 클라이언트 설정에 입력하세요.\n')
    return cfg

CONFIG = load_config()
load_tokens()

# ── 데이터 파일 ───────────────────────────────────────────
def read_data():
    if not DATA_FILE.exists():
        return {'serverTs': 0, 'payload': None, 'lastEditor': '', 'lastEditTime': 0}
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        d = json.load(f)
    # 구버전 호환
    d.setdefault('lastEditor', '')
    d.setdefault('lastEditTime', 0)
    return d

def write_data(payload, server_ts, editor=''):
    obj = {'serverTs': server_ts, 'payload': payload,
           'lastEditor': editor, 'lastEditTime': server_ts}
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))

def read_activity():
    if not ACTIVITY_FILE.exists():
        return []
    with open(ACTIVITY_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def write_activity(entries):
    with open(ACTIVITY_FILE, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, separators=(',', ':'))

# ── 인증 ──────────────────────────────────────────────────
def check_auth():
    key = request.headers.get('X-API-Key', '')
    if key != CONFIG['api_key']:
        abort(401, description='Invalid API key')

def check_admin_token():
    token = request.headers.get('X-Admin-Token', '')
    if not token:
        return False
    exp = admin_tokens.get(token)
    if exp is None:
        return False
    if int(time.time() * 1000) > exp:
        del admin_tokens[token]
        save_tokens()
        return False
    return True

# ── CORS ──────────────────────────────────────────────────
@app.after_request
def add_cors(response):
    allowed_origins = CONFIG.get('allowed_origins') or []
    if allowed_origins:
        origin = request.headers.get('Origin', '')
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Vary'] = 'Origin'
        # 허용 목록에 없는 Origin은 헤더 미포함 → 브라우저가 차단
    else:
        # allowed_origins 미설정 시 제한 없음 (하위 호환)
        response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key, X-Admin-Token'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response

@app.route('/api/data', methods=['OPTIONS'])
@app.route('/api/auth', methods=['OPTIONS'])
@app.route('/api/log', methods=['OPTIONS'])
@app.route('/api/lock', methods=['OPTIONS'])
@app.route('/api/unlock', methods=['OPTIONS'])
def options_handler():
    return '', 204

# ── POST /api/auth ─── 관리자 인증 ───────────────────────
@app.route('/api/auth', methods=['POST'])
def auth():
    check_auth()
    body = request.get_json(silent=True) or {}
    password = body.get('password', '')
    admin_pw = RUNTIME['admin_password']

    # 서버에 admin_password 미설정 시 → 인증 없이 허용
    if not admin_pw:
        purge_expired_tokens()
        token = secrets.token_hex(16)
        admin_tokens[token] = int(time.time() * 1000) + TOKEN_TTL_MS
        save_tokens()
        return jsonify({'ok': True, 'token': token, 'noPassword': True})

    if password == admin_pw:
        purge_expired_tokens()
        token = secrets.token_hex(16)
        admin_tokens[token] = int(time.time() * 1000) + TOKEN_TTL_MS
        save_tokens()
        return jsonify({'ok': True, 'token': token})
    return jsonify({'ok': False, 'error': '비밀번호가 올바르지 않습니다.'}), 401

# ── GET /api/data ─────────────────────────────────────────
@app.route('/api/data', methods=['GET'])
def get_data():
    check_auth()
    store = read_data()
    return jsonify({'ok': True, 'serverTs': store['serverTs'],
                    'payload': store['payload']})

# ── POST /api/data ─── Last-Write-Wins ───────────────────
@app.route('/api/data', methods=['POST'])
def post_data():
    check_auth()
    body = request.get_json(silent=True)
    if not body:
        return jsonify({'ok': False, 'error': 'Invalid JSON'}), 400
    payload = body.get('payload')
    if payload is None:
        return jsonify({'ok': False, 'error': 'Missing payload'}), 400
    editor  = body.get('editor', '')
    new_ts  = int(time.time() * 1000)
    write_data(payload, new_ts, editor)
    return jsonify({'ok': True, 'serverTs': new_ts})

# ── GET /api/ping ─── 폴링 (lastEditor, locks 포함) ──────
@app.route('/api/ping', methods=['GET'])
def ping():
    check_auth()
    store = read_data()
    now   = int(time.time() * 1000)
    stale = [k for k, v in edit_locks.items() if now - v['ts'] > 60000]
    for k in stale:
        del edit_locks[k]
    return jsonify({'ok': True, 'serverTs': store['serverTs'],
                    'lastEditor': store['lastEditor'],
                    'lastEditTime': store['lastEditTime'],
                    'locks': edit_locks})

# ── GET /api/log ─── 활동 로그 조회 (관리자 전용) ─────────
@app.route('/api/log', methods=['GET'])
def get_log():
    check_auth()
    if not check_admin_token():
        return jsonify({'ok': False, 'error': '관리자 권한이 필요합니다.'}), 403
    entries = read_activity()
    return jsonify({'ok': True, 'entries': list(reversed(entries))})

# ── POST /api/log ─── 활동 로그 기록 ─────────────────────
@app.route('/api/log', methods=['POST'])
def post_log():
    check_auth()
    body = request.get_json(silent=True) or {}
    entry = {
        'action': body.get('action', ''),
        'detail': body.get('detail', ''),
        'user':   body.get('user', '익명'),
        'ts':     body.get('ts', int(time.time() * 1000))
    }
    entries = read_activity()
    entries.append(entry)
    if len(entries) > 500:
        entries = entries[-500:]
    write_activity(entries)
    return jsonify({'ok': True})

# ── POST /api/lock ─── 편집 락 등록 ───────────────────────
@app.route('/api/lock', methods=['POST'])
def lock_item():
    check_auth()
    body = request.get_json(silent=True) or {}
    key  = body.get('key', '')
    user = body.get('user', '익명')
    if not key:
        return jsonify({'ok': False, 'error': 'Missing key'}), 400
    now      = int(time.time() * 1000)
    existing = edit_locks.get(key)
    if existing and existing['user'] != user and (now - existing['ts']) < 60000:
        return jsonify({'ok': False, 'lockedBy': existing['user']})
    edit_locks[key] = {'user': user, 'ts': now}
    return jsonify({'ok': True, 'locks': edit_locks})

# ── POST /api/unlock ─── 편집 락 해제 ─────────────────────
@app.route('/api/unlock', methods=['POST'])
def unlock_item():
    check_auth()
    body = request.get_json(silent=True) or {}
    key  = body.get('key', '')
    user = body.get('user', '익명')
    if key in edit_locks and edit_locks[key]['user'] == user:
        del edit_locks[key]
    return jsonify({'ok': True, 'locks': edit_locks})

# ── 정적 파일 서빙 ────────────────────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path and (STATIC_DIR / path).exists():
        return send_from_directory(str(STATIC_DIR), path)
    index = STATIC_DIR / 'index.html'
    if index.exists():
        return send_from_directory(str(STATIC_DIR), 'index.html')
    return ('static/index.html 없음. node build.js 후 static/ 폴더에 복사하세요.', 404)

# ── 에러 핸들러 ───────────────────────────────────────────
@app.errorhandler(401)
def unauthorized(e):
    return jsonify({'ok': False, 'error': str(e)}), 401

@app.errorhandler(404)
def not_found(e):
    return jsonify({'ok': False, 'error': 'Not found'}), 404

# ── 실행 ──────────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5000)
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--debug', action='store_true')
    parser.add_argument('--admin-password', default='', help='관리자 비밀번호')
    args = parser.parse_args()

    RUNTIME['admin_password'] = args.admin_password

    print(f'🚀 featureMatrix-server')
    print(f'   http://{args.host}:{args.port}')
    print(f'   API Key: {CONFIG["api_key"]}')
    print(f'   관리자: {"비밀번호 설정됨" if args.admin_password else "미설정 (모든 사용자 관리자)"}')
    print(f'   데이터: {DATA_FILE}')
    print(f'   정적파일: {STATIC_DIR}\n')

    app.run(host=args.host, port=args.port, debug=args.debug)
