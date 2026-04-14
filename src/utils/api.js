import { ADMIN_TOKEN_KEY, EDITOR_TOKEN_KEY } from '../app/constants.js';
import { getStore } from '../store/useAppStore.js';

function apiBase() {
  const url = (getStore().settings.serverUrl || '').trim();
  return url || window.location.origin;
}

function apiHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const adminToken  = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const editorToken = sessionStorage.getItem(EDITOR_TOKEN_KEY);
  if (adminToken)  h['X-Admin-Token']  = adminToken;
  if (editorToken) h['X-Editor-Token'] = editorToken;
  return h;
}

/**
 * API fetch 유틸 — 인증 헤더 자동 주입, 상태 코드 에러 변환
 */
export async function apiFetch(path, options = {}) {
  const res = await fetch(apiBase() + path, {
    ...options,
    headers: { ...apiHeaders(), ...(options.headers || {}) }
  });
  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await res.json()
    : null;

  if (!res.ok) {
    const err = new Error(payload?.error || res.statusText || String(res.status));
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}
