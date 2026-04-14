#!/usr/bin/env python3
"""
featureMatrix-server
Flask 기반 공유 데이터 서버
실행: python server.py [--port 5000] [--host 0.0.0.0] [--admin-password 1234] [--editor-password 5678]
"""

import json, os, time, argparse, secrets, threading
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_socketio import SocketIO, emit, disconnect as sio_disconnect

BASE_DIR       = Path(__file__).parent
STATIC_DIR     = BASE_DIR / 'static'
DATA_DIR       = Path(os.environ.get('FEATURE_MATRIX_DATA_DIR', str(BASE_DIR))).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATA_FILE      = DATA_DIR / 'data.json'
CONFIG_FILE    = DATA_DIR / 'config.json'
ACTIVITY_FILE  = DATA_DIR / 'activity.json'
TOKENS_FILE    = DATA_DIR / 'tokens.json'

TOKEN_TTL_MS   = 24 * 60 * 60 * 1000  # 24시간

app = Flask(__name__, static_folder=str(STATIC_DIR))

# SocketIO는 CONFIG 로드 후 초기화 (CORS 설정 반영)
socketio: SocketIO = None  # type: ignore  # _init_socketio()에서 설정

# ── 런타임 설정 ───────────────────────────────────────────
RUNTIME = {'admin_password': None, 'editor_password': None}

# ── 세션 토큰 저장소 ──────────────────────────────────────
admin_tokens: dict  = {}   # { token: expire_ts }
editor_tokens: dict = {}   # { token: expire_ts }

# ── 편집 락 저장소 (메모리) ───────────────────────────────
edit_locks = {}  # { key: { user, ts } }

# ── Socket.IO 클라이언트-사용자 매핑 ─────────────────────
socket_users = {}  # { sid: user }
active_users = {}  # { sid: { user, joinTime } }
active_users_lock = threading.Lock()

# ── 토큰 파일 저장/로드 (관리자 토큰만 영속) ──────────────
def load_tokens():
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
    try:
        with open(TOKENS_FILE, 'w', encoding='utf-8') as f:
            json.dump(admin_tokens, f, separators=(',', ':'))
    except Exception:
        pass

def purge_expired_tokens():
    now = int(time.time() * 1000)
    for store in (admin_tokens, editor_tokens):
        expired = [t for t, exp in store.items() if exp <= now]
        for t in expired:
            del store[t]

# ── config.json 로드 ──────────────────────────────────────
def load_config():
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
        changed = False
        if 'allowed_origins' not in cfg:
            cfg['allowed_origins'] = []
            changed = True
        if 'editor_password' not in cfg:
            cfg['editor_password'] = ''
            changed = True
        if changed:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(cfg, f, indent=2, ensure_ascii=False)
        return cfg
    cfg = {'allowed_origins': [], 'editor_password': ''}
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    print(f'\n[ok] config.json 생성됨\n')
    return cfg

CONFIG = load_config()
load_tokens()

def _init_socketio():
    global socketio
    allowed = CONFIG.get('allowed_origins') or []
    cors = allowed if allowed else '*'
    socketio = SocketIO(app, cors_allowed_origins=cors, async_mode='threading',
                        logger=False, engineio_logger=False)
    _register_socketio_events()
    _start_lock_timeout_task()

LOCK_TIMEOUT_MS = 5 * 60 * 1000  # 5분

# editor_password: CLI 우선, 없으면 config.json
def get_editor_password():
    return RUNTIME['editor_password'] or CONFIG.get('editor_password', '')

# ── 데이터 파일 ───────────────────────────────────────────
def read_data():
    if not DATA_FILE.exists():
        return {'serverTs': 0, 'payload': None, 'lastEditor': '', 'lastEditTime': 0}
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        d = json.load(f)
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

# ── 인증 헬퍼 ─────────────────────────────────────────────
def check_admin_token():
    """관리자 토큰 유효성 확인"""
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

def check_editor_token():
    """편집자 또는 관리자 토큰 유효성 확인"""
    now = int(time.time() * 1000)
    # 관리자 토큰도 편집 권한 포함
    admin_token = request.headers.get('X-Admin-Token', '')
    if admin_token and admin_tokens.get(admin_token, 0) > now:
        return True
    # 편집자 토큰
    editor_token = request.headers.get('X-Editor-Token', '')
    if editor_token and editor_tokens.get(editor_token, 0) > now:
        return True
    return False

# ── CORS ──────────────────────────────────────────────────
@app.after_request
def add_cors(response):
    allowed_origins = CONFIG.get('allowed_origins') or []
    if allowed_origins:
        origin = request.headers.get('Origin', '')
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Vary'] = 'Origin'
    else:
        response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Admin-Token, X-Editor-Token'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response

@app.route('/api/data', methods=['OPTIONS'])
@app.route('/api/auth', methods=['OPTIONS'])
@app.route('/api/log', methods=['OPTIONS'])
@app.route('/api/lock', methods=['OPTIONS'])
@app.route('/api/unlock', methods=['OPTIONS'])
@app.route('/api/set-editor-password', methods=['OPTIONS'])
def options_handler():
    return '', 204

# ── POST /api/auth ─── 로그인 (편집자/관리자) ─────────────
@app.route('/api/auth', methods=['POST'])
def auth():
    body     = request.get_json(silent=True) or {}
    password = body.get('password', '')
    role     = body.get('role', 'admin')  # 'editor' | 'admin'

    purge_expired_tokens()

    if role == 'editor':
        editor_pw = get_editor_password()
        # 편집자 비번 미설정 시 → 비번 없이 허용
        if not editor_pw or password == editor_pw:
            token = secrets.token_hex(16)
            editor_tokens[token] = int(time.time() * 1000) + TOKEN_TTL_MS
            return jsonify({'ok': True, 'token': token, 'role': 'editor'})
        return jsonify({'ok': False, 'error': '비밀번호가 올바르지 않습니다.'}), 401

    else:  # admin
        admin_pw = RUNTIME['admin_password']
        if not admin_pw or password == admin_pw:
            token = secrets.token_hex(16)
            admin_tokens[token] = int(time.time() * 1000) + TOKEN_TTL_MS
            save_tokens()
            return jsonify({'ok': True, 'token': token, 'role': 'admin'})
        return jsonify({'ok': False, 'error': '비밀번호가 올바르지 않습니다.'}), 401

# ── GET /api/data ─── 인증 없이 읽기 허용 ────────────────
@app.route('/api/data', methods=['GET'])
def get_data():
    store = read_data()
    return jsonify({'ok': True, 'serverTs': store['serverTs'],
                    'payload': store['payload']})

# ── POST /api/data ─── 편집자/관리자 토큰 필요 ───────────
@app.route('/api/data', methods=['POST'])
def post_data():
    if not check_editor_token():
        return jsonify({'ok': False, 'error': '편집 권한이 없습니다. 로그인 후 이용하세요.'}), 403
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

# ── GET /api/ping ─── 인증 없이 폴링 허용 ────────────────
@app.route('/api/ping', methods=['GET'])
def ping():
    store = read_data()
    now   = int(time.time() * 1000)
    stale = [k for k, v in edit_locks.items() if now - v['ts'] > 60000]
    for k in stale:
        del edit_locks[k]
    return jsonify({'ok': True, 'serverTs': store['serverTs'],
                    'lastEditor': store['lastEditor'],
                    'lastEditTime': store['lastEditTime'],
                    'locks': edit_locks,
                    'hasEditorPw': bool(get_editor_password())})

# ── GET /api/log ─── 활동 로그 조회 (관리자 전용) ─────────
@app.route('/api/log', methods=['GET'])
def get_log():
    if not check_admin_token():
        return jsonify({'ok': False, 'error': '관리자 권한이 필요합니다.'}), 403
    entries = read_activity()
    try:
        limit = int(request.args.get('limit', 100))
        limit = max(10, min(1000, limit))
    except (ValueError, TypeError):
        limit = 100
    return jsonify({'ok': True, 'entries': list(reversed(entries))[:limit]})

# ── IP 마스킹 헬퍼 ─────────────────────────────────────────
def mask_ip(ip: str) -> str:
    """IPv4: 앞 두 옥텟 마스킹 후 반환 (*.*.x.y). 그 외: 빈 문자열."""
    if not ip:
        return ''
    parts = ip.split('.')
    if len(parts) == 4:
        return f'*.*.{parts[2]}.{parts[3]}'
    return ''

def get_client_ip() -> str:
    """X-Forwarded-For 우선, 없으면 remote_addr 사용."""
    forwarded = request.headers.get('X-Forwarded-For', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr or ''

# ── POST /api/log ─── 활동 로그 기록 (편집자 이상) ────────
@app.route('/api/log', methods=['POST'])
def post_log():
    if not check_editor_token():
        return jsonify({'ok': False, 'error': '편집 권한이 없습니다.'}), 403
    body = request.get_json(silent=True) or {}
    entry = {
        'action': body.get('action', ''),
        'detail': body.get('detail', ''),
        'user':   body.get('user', '익명'),
        'ip':     mask_ip(get_client_ip()),
        'ts':     body.get('ts', int(time.time() * 1000))
    }
    entries = read_activity()
    entries.append(entry)
    if len(entries) > 500:
        entries = entries[-500:]
    write_activity(entries)
    return jsonify({'ok': True})

# ── POST /api/lock ─── 편집 락 (편집자 이상) ──────────────
@app.route('/api/lock', methods=['POST'])
def lock_item():
    if not check_editor_token():
        return jsonify({'ok': True, 'locks': edit_locks})  # 비인증 시 락 무시
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
    body = request.get_json(silent=True) or {}
    key  = body.get('key', '')
    user = body.get('user', '익명')
    if key in edit_locks and edit_locks[key]['user'] == user:
        del edit_locks[key]
    return jsonify({'ok': True, 'locks': edit_locks})

# ── POST /api/set-editor-password ─── 편집자 비번 변경 (관리자 전용) ──
@app.route('/api/set-editor-password', methods=['POST'])
def set_editor_password():
    if not check_admin_token():
        return jsonify({'ok': False, 'error': '관리자 권한이 필요합니다.'}), 403
    body   = request.get_json(silent=True) or {}
    new_pw = body.get('password', '')
    CONFIG['editor_password'] = new_pw
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(CONFIG, f, indent=2, ensure_ascii=False)
    # 기존 편집자 토큰 무효화
    editor_tokens.clear()
    return jsonify({'ok': True})

# ── Socket.IO 이벤트 핸들러 등록 ────────────────────────────
def _register_socketio_events():

    @socketio.on('connect')
    def on_connect():
        """새 클라이언트 연결 시 현재 락 상태 전송"""
        emit('locks_sync', {'locks': edit_locks})

    @socketio.on('disconnect')
    def on_disconnect():
        """연결 끊김 시 해당 사용자의 모든 락 자동 해제 및 접속자 목록 갱신"""
        from flask import request as req
        sid  = req.sid
        user = socket_users.pop(sid, None)
        removed = False
        with active_users_lock:
            removed = active_users.pop(sid, None) is not None
        if user:
            released = [k for k, v in list(edit_locks.items()) if v['user'] == user]
            for k in released:
                del edit_locks[k]
                socketio.emit('item_unlocked', {'key': k})
        if removed:
            broadcast_user_list()

    @socketio.on('register_user')
    def on_register_user(data):
        """클라이언트가 자신의 사용자명을 등록"""
        from flask import request as req
        user = ((data or {}).get('user') or '익명').strip() or '익명'
        socket_users[req.sid] = user
        with active_users_lock:
            active_users[req.sid] = {'user': user, 'joinTime': int(time.time() * 1000)}
        broadcast_user_list()

    @socketio.on('unregister_user')
    def on_unregister_user():
        """로그아웃 시 현재 소켓을 접속자 목록에서 제거"""
        from flask import request as req
        sid = req.sid
        removed = False
        with active_users_lock:
            removed = active_users.pop(sid, None) is not None
        if removed:
            broadcast_user_list()

    @socketio.on('get_active_users')
    def on_get_active_users():
        """현재 접속 중인 사용자 목록 조회"""
        emit('user_list_updated', {'users': get_active_user_list()})

    @socketio.on('lock_item')
    def on_lock_item(data):
        """항목 Lock 요청 처리"""
        data = data or {}
        key  = data.get('key', '')
        user = data.get('user', '익명')
        if not key:
            return
        now      = int(time.time() * 1000)
        existing = edit_locks.get(key)
        if existing and existing['user'] != user and (now - existing['ts']) < LOCK_TIMEOUT_MS:
            emit('lock_denied', {'key': key, 'lockedBy': existing['user']})
            return
        edit_locks[key] = {'user': user, 'ts': now}
        socketio.emit('item_locked', {'key': key, 'lockedBy': user, 'lockedAt': now})

    @socketio.on('unlock_item')
    def on_unlock_item(data):
        """항목 Lock 해제"""
        data = data or {}
        key  = data.get('key', '')
        user = data.get('user', '익명')
        if key in edit_locks and edit_locks[key]['user'] == user:
            del edit_locks[key]
            socketio.emit('item_unlocked', {'key': key})

    @socketio.on('force_unlock')
    def on_force_unlock(data):
        """관리자 강제 Lock 해제"""
        data        = data or {}
        key         = data.get('key', '')
        admin_token = data.get('adminToken', '')
        now = int(time.time() * 1000)
        valid = admin_token and admin_tokens.get(admin_token, 0) > now
        if not valid:
            emit('lock_denied', {'key': key, 'lockedBy': '', 'error': '관리자 권한 필요'})
            return
        if key in edit_locks:
            del edit_locks[key]
            socketio.emit('item_unlocked', {'key': key})

    @socketio.on('editing_preview')
    def on_editing_preview(data):
        """편집 미리보기 전체 브로드캐스트 (발신자 포함)"""
        from flask import request as req
        socketio.emit('editing_preview', data, skip_sid=req.sid)

    @socketio.on('save_item')
    def on_save_item(data):
        """항목 저장 완료 브로드캐스트 + Lock 해제"""
        data = data or {}
        key  = data.get('key', '')
        user = data.get('user', '익명')
        if key in edit_locks and edit_locks[key]['user'] == user:
            del edit_locks[key]
        socketio.emit('item_saved', data)

    @socketio.on('save_data')
    def on_save_data(data):
        from flask import request as req
        socketio.emit('data_saved', data or {}, skip_sid=req.sid)


def _start_lock_timeout_task():
    """5분 비활성 Lock 자동 해제 백그라운드 태스크"""
    def _task():
        while True:
            time.sleep(30)
            now    = int(time.time() * 1000)
            stale  = [k for k, v in list(edit_locks.items())
                      if now - v['ts'] > LOCK_TIMEOUT_MS]
            for k in stale:
                del edit_locks[k]
                socketio.emit('item_unlocked', {'key': k})
    t = threading.Thread(target=_task, daemon=True)
    t.start()


def get_active_user_list():
    """최근 접속자 순으로 정렬된 현재 로그인 사용자 목록."""
    with active_users_lock:
        users = [
            {'sid': sid, 'user': info.get('user', '익명'), 'joinTime': info.get('joinTime', 0)}
            for sid, info in active_users.items()
        ]
    users.sort(key=lambda item: item.get('joinTime', 0), reverse=True)
    return users


def broadcast_user_list():
    """현재 로그인 사용자 목록을 전체 클라이언트에 브로드캐스트."""
    socketio.emit('user_list_updated', {'users': get_active_user_list()})


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
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', 5000)))
    parser.add_argument('--host', default=os.environ.get('HOST', '0.0.0.0'))
    parser.add_argument('--debug', action='store_true', default=os.environ.get('FLASK_DEBUG', '').lower() in ('1', 'true', 'yes'))
    parser.add_argument('--admin-password',  default=os.environ.get('ADMIN_PASSWORD', ''), help='관리자 비밀번호')
    parser.add_argument('--editor-password', default=os.environ.get('EDITOR_PASSWORD', ''), help='편집자 비밀번호 (미설정 시 비번 없음)')
    args = parser.parse_args()

    RUNTIME['admin_password']  = args.admin_password
    RUNTIME['editor_password'] = args.editor_password

    _init_socketio()

    print(f'[start] featureMatrix-server (WebSocket 지원)')
    print(f'   http://{args.host}:{args.port}')
    print(f'   관리자: {"비밀번호 설정됨" if args.admin_password else "미설정 (모든 사용자 관리자)"}')
    print(f'   편집자: {"비밀번호 설정됨" if get_editor_password() else "미설정 (로그인 없이 편집 가능)"}')
    print(f'   데이터: {DATA_DIR}')
    print(f'   정적파일: {STATIC_DIR}\n')

    socketio.run(app, host=args.host, port=args.port, debug=args.debug,
                 allow_unsafe_werkzeug=True)
