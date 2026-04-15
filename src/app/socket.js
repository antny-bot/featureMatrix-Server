/**
 * socket.js — Socket.IO 클라이언트 모듈
 *
 * 책임:
 *  - Socket.IO 싱글턴 인스턴스 관리
 *  - 서버 이벤트 수신 → Zustand store 업데이트
 *  - emit 함수 노출: emitLock, emitUnlock, emitPreview, emitSave
 *  - 연결/재연결/끊김 상태를 wsStatus로 관리
 *  - 연결 전 메시지 큐 버퍼링 (자동 재전송)
 */

import { io } from 'socket.io-client';
import { setStore, getStore } from '../store/useAppStore.js';
import { ADMIN_TOKEN_KEY, EDITOR_TOKEN_KEY } from './constants.js';

// ── 내부 상태 ──────────────────────────────────────────────────────────
let _socket = null;
let _pendingQueue = []; // 연결 전 대기 중인 emit { event, data }
const _recentLocalUnlocks = {};
const CLIENT_ID_KEY = 'fmClientId';

// ── 서버 URL 결정 ──────────────────────────────────────────────────────
function _getServerUrl() {
  const url = getStore().settings?.serverUrl || '';
  if (url) return url;
  // 현재 origin 기준 (같은 서버)
  return window.location.origin;
}

// ── Zustand editLocks 패치 헬퍼 ───────────────────────────────────────
function _addLock(key, lockedBy, lockedAt) {
  const releasedAt = _recentLocalUnlocks[key] || 0;
  if (lockedBy === _currentUserName() && releasedAt && Date.now() - releasedAt < 3000) {
    return;
  }
  const prev = getStore().editLocks || {};
  setStore({ editLocks: { ...prev, [key]: { user: lockedBy, ts: lockedAt } } });
}

function _removeLock(key) {
  const prev = { ...(getStore().editLocks || {}) };
  delete prev[key];
  setStore({ editLocks: prev });
}

function _setAllLocks(locks) {
  setStore({ editLocks: locks || {} });
}

function _setPreview(key, data) {
  const prev = getStore().previews || {};
  if (data === null) {
    const next = { ...prev };
    delete next[key];
    setStore({ previews: next });
  } else {
    setStore({ previews: { ...prev, [key]: data } });
  }
}

export function releaseLocalLock(key) {
  if (!key) return;
  _recentLocalUnlocks[key] = Date.now();
  setTimeout(() => {
    if (_recentLocalUnlocks[key] && Date.now() - _recentLocalUnlocks[key] >= 3000) {
      delete _recentLocalUnlocks[key];
    }
  }, 3500);
  _removeLock(key);
  _setPreview(key, null);
}

function _hasAuthToken() {
  return !!(sessionStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(EDITOR_TOKEN_KEY));
}

function _currentUserName() {
  if (!_hasAuthToken()) return '익명';
  return getStore().settings?.userName || '익명';
}

function _clientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return _socket?.id || '';
  }
}

function _syncActiveUser() {
  if (!_socket?.connected) return;
  _socket.emit('register_user', { user: _currentUserName(), clientId: _clientId() });
  _socket.emit('get_active_users');
}

function _setActiveUsers(users) {
  const ownSid = _socket?.id;
  const ownClientId = _clientId();
  const others = (users || []).filter(user => user.sid !== ownSid && user.clientId !== ownClientId);
  setStore({ activeUsers: others });
}

// ── 큐에 쌓인 메시지 재전송 ───────────────────────────────────────────
function _flushQueue() {
  if (!_socket?.connected) return;
  const q = _pendingQueue.splice(0);
  for (const { event, data } of q) {
    _socket.emit(event, data);
  }
}

// ── 이벤트 리스너 등록 ────────────────────────────────────────────────
function _registerListeners() {
  _socket.on('connect', () => {
    setStore({ wsStatus: 'connected' });
    _syncActiveUser();
    _flushQueue();
  });

  _socket.on('disconnect', () => {
    setStore({ wsStatus: 'disconnected', activeUsers: [] });
  });

  _socket.on('connect_error', () => {
    setStore({ wsStatus: 'disconnected' });
  });

  _socket.io.on('reconnect_attempt', () => {
    setStore({ wsStatus: 'reconnecting' });
  });


  _socket.on('connect_error', () => {
    setStore({ wsStatus: 'disconnected' });
  });

  _socket.io.on('reconnect_attempt', () => {
    setStore({ wsStatus: 'reconnecting' });
  });

  _socket.io.on('reconnect', () => {
    setStore({ wsStatus: 'connected' });
    _syncActiveUser();
    _flushQueue();
  });

  // 서버 → 클라이언트 이벤트
  _socket.on('locks_sync', ({ locks }) => {
    _setAllLocks(locks);
  });

  _socket.on('item_locked', ({ key, lockedBy, lockedAt }) => {
    _addLock(key, lockedBy, lockedAt || Date.now());
  });

  _socket.on('item_unlocked', ({ key }) => {
    _removeLock(key);
    _setPreview(key, null);
  });

  _socket.on('lock_denied', ({ key, lockedBy }) => {
    getStore().notify(`${lockedBy}님이 편집 중입니다. 잠시 후 다시 시도하세요.`, 'warning');
  });

  _socket.on('editing_preview', ({ key, user, preview }) => {
    _setPreview(key, { user, preview });
  });

  _socket.on('item_saved', ({ key, user, item }) => {
    _removeLock(key);
    _setPreview(key, null);

    const store = getStore();
    const idx = store.items.findIndex(it => it.key === key);
    const items = idx === -1
      ? [...store.items, item]
      : store.items.map(it => it.key === key ? { ...it, ...item } : it);
    setStore({ items, serverStatus: 'ok' });
  });

  _socket.on('data_saved', ({ user, payload, serverTs }) => {
    if (!payload) return;
    const store = getStore();
    setStore({
      items: payload.items || store.items,
      settings: payload.settings ? { ...store.settings, ...payload.settings } : store.settings,
      serverTs: serverTs || store.serverTs,
      serverStatus: 'ok'
    });
    store.notify(`${user || '다른 사용자'}님의 변경사항이 반영되었습니다.`, 'success');
  });

  _socket.on('user_list_updated', ({ users }) => {
    _setActiveUsers(users);
  });
}

// ── 공개 API ──────────────────────────────────────────────────────────

/**
 * WebSocket 초기화. storageMode === 'server' 일 때 main.js에서 호출.
 * 이미 연결된 경우 중복 초기화 방지.
 */
export function initSocket() {
  if (_socket) return;

  setStore({ wsStatus: 'connecting' });
  const url = _getServerUrl();

  _socket = io(url, {
    transports: ['polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  _registerListeners();
}

/**
 * 소켓 연결 해제 (로컬 모드 전환 등)
 */
export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
  _pendingQueue = [];
  setStore({ wsStatus: 'idle', editLocks: {}, previews: {}, activeUsers: [] });
}

/**
 * 현재 연결 상태 확인
 */
export function isSocketConnected() {
  return !!_socket?.connected;
}

export function registerActiveUser() {
  _syncActiveUser();
}

export function unregisterActiveUser() {
  if (_socket?.connected) {
    _socket.emit('unregister_user', { clientId: _clientId() });
  }
  setStore({ activeUsers: [] });
}

/**
 * 내부 emit 헬퍼 — 연결 전이면 큐에 저장
 */
function _emit(event, data) {
  if (_socket?.connected) {
    _socket.emit(event, data);
  } else {
    _pendingQueue.push({ event, data });
  }
}

/**
 * 항목 Lock 요청
 * @param {string} key
 * @param {string} user
 */
export function emitLock(key, user) {
  _emit('lock_item', { key, user });
}

/**
 * 항목 Lock 해제
 * @param {string} key
 * @param {string} user
 */
export function emitUnlock(key, user) {
  _emit('unlock_item', { key, user });
}

/**
 * 편집 미리보기 전송 (300ms 디바운스는 호출 측에서 처리)
 * @param {string} key
 * @param {string} user
 * @param {object} preview  — { name, priority, status, owner, desc, ... }
 */
export function emitPreview(key, user, preview) {
  _emit('editing_preview', { key, user, preview });
}

/**
 * 항목 저장 완료 알림
 * @param {string} key
 * @param {string} user
 * @param {object} item
 */
export function emitSave(key, user, item) {
  _emit('save_item', { key, user, item });
}

export function emitDataSave(user, payload, serverTs) {
  _emit('save_data', { user, payload, serverTs });
}
