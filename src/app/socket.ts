import { io, Socket } from 'socket.io-client';
import { setStore, getStore } from '../store/useAppStore.js';
import { ADMIN_TOKEN_KEY, EDITOR_TOKEN_KEY } from './constants.js';
import type { Item } from '../types/index.js';

interface PendingMessage {
  event: string;
  data: unknown;
}

let _socket: Socket | null = null;
let _pendingQueue: PendingMessage[] = [];
const _recentLocalUnlocks: Record<string, number> = {};
const CLIENT_ID_KEY = 'fmClientId';

function _getServerUrl(): string {
  const url = getStore().settings?.serverUrl || '';
  if (url) return url;
  return window.location.origin;
}

function _addLock(key: string, lockedBy: string, lockedAt: number): void {
  const releasedAt = _recentLocalUnlocks[key] || 0;
  if (lockedBy === _currentUserName() && releasedAt && Date.now() - releasedAt < 3000) {
    return;
  }
  const prev = getStore().editLocks || {};
  setStore({ editLocks: { ...prev, [key]: { user: lockedBy, ts: lockedAt } } });
}

function _removeLock(key: string): void {
  const prev = { ...(getStore().editLocks || {}) };
  delete prev[key];
  setStore({ editLocks: prev });
}

function _setAllLocks(locks: Record<string, { user: string; ts: number }>): void {
  setStore({ editLocks: locks || {} });
}

function _setPreview(key: string, data: { user: string; preview: Record<string, unknown> } | null): void {
  const prev = getStore().previews || {};
  if (data === null) {
    const next = { ...prev };
    delete next[key];
    setStore({ previews: next });
  } else {
    setStore({ previews: { ...prev, [key]: data } });
  }
}

export function releaseLocalLock(key: string): void {
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

function _hasAuthToken(): boolean {
  return !!(sessionStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(EDITOR_TOKEN_KEY));
}

function _currentUserName(): string {
  if (!_hasAuthToken()) return '익명';
  return getStore().settings?.userName || '익명';
}

function _clientId(): string {
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

function _syncActiveUser(): void {
  if (!_socket?.connected) return;
  _socket.emit('register_user', { user: _currentUserName(), clientId: _clientId() });
  _socket.emit('get_active_users');
}

function _setActiveUsers(users: Array<{ sid: string; clientId?: string; user: string; joinTime: number }>): void {
  const ownSid = _socket?.id;
  const ownClientId = _clientId();
  const others = (users || []).filter(user => user.sid !== ownSid && user.clientId !== ownClientId);
  setStore({ activeUsers: others });
}

function _flushQueue(): void {
  if (!_socket?.connected) return;
  const q = _pendingQueue.splice(0);
  for (const { event, data } of q) {
    _socket.emit(event, data);
  }
}

function _registerListeners(): void {
  if (!_socket) return;

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

  _socket.io.on('reconnect', () => {
    setStore({ wsStatus: 'connected' });
    _syncActiveUser();
    _flushQueue();
  });

  _socket.on('locks_sync', ({ locks }: { locks: Record<string, { user: string; ts: number }> }) => {
    _setAllLocks(locks);
  });

  _socket.on('item_locked', ({ key, lockedBy, lockedAt }: { key: string; lockedBy: string; lockedAt?: number }) => {
    _addLock(key, lockedBy, lockedAt || Date.now());
  });

  _socket.on('item_unlocked', ({ key }: { key: string }) => {
    _removeLock(key);
    _setPreview(key, null);
  });

  _socket.on('lock_denied', ({ lockedBy }: { key: string; lockedBy: string }) => {
    getStore().notify(`${lockedBy}님이 편집 중입니다. 잠시 후 다시 시도하세요.`, 'warning');
  });

  _socket.on('editing_preview', ({ key, user, preview }: { key: string; user: string; preview: Record<string, unknown> }) => {
    _setPreview(key, { user, preview });
  });

  _socket.on('item_saved', ({ key, user: _user, item }: { key: string; user: string; item: Item }) => {
    _removeLock(key);
    _setPreview(key, null);

    const store = getStore();
    const idx = store.items.findIndex(it => it.key === key);
    const items = idx === -1
      ? [...store.items, item]
      : store.items.map(it => it.key === key ? { ...it, ...item } : it);
    setStore({ items, serverStatus: 'ok' });
  });

  _socket.on('data_saved', ({ user, payload, serverTs }: { user: string; payload: { items?: Item[]; settings?: Record<string, unknown> } | null; serverTs: number }) => {
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

  _socket.on('user_list_updated', ({ users }: { users: Array<{ sid: string; clientId?: string; user: string; joinTime: number }> }) => {
    _setActiveUsers(users);
  });
}

export function initSocket(): void {
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

export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
  _pendingQueue = [];
  setStore({ wsStatus: 'idle', editLocks: {}, previews: {}, activeUsers: [] });
}

export function isSocketConnected(): boolean {
  return !!_socket?.connected;
}

export function registerActiveUser(): void {
  _syncActiveUser();
}

export function unregisterActiveUser(): void {
  if (_socket?.connected) {
    _socket.emit('unregister_user', { clientId: _clientId() });
  }
  setStore({ activeUsers: [] });
}

function _emit(event: string, data: unknown): void {
  if (_socket?.connected) {
    _socket.emit(event, data);
  } else {
    _pendingQueue.push({ event, data });
  }
}

export function emitLock(key: string, user: string): void {
  _emit('lock_item', { key, user });
}

export function emitUnlock(key: string, user: string): void {
  _emit('unlock_item', { key, user });
}

export function emitRequestUnlock(key: string, user: string): void {
  _emit('request_unlock', { key, user });
}

export function emitPreview(key: string, user: string, preview: Record<string, unknown>): void {
  _emit('editing_preview', { key, user, preview });
}

export function emitSave(key: string, user: string, item: Item): void {
  _emit('save_item', { key, user, item });
}

export function emitDataSave(user: string, payload: unknown, serverTs: number): void {
  _emit('save_data', { user, payload, serverTs });
}
