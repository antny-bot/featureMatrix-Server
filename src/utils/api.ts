import { ADMIN_TOKEN_KEY, EDITOR_TOKEN_KEY } from '../app/constants.js';
import { getStore } from '../store/useAppStore.js';

function apiBase(): string {
  const url = (getStore().settings.serverUrl || '').trim();
  return url || window.location.origin;
}

function apiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const adminToken  = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const editorToken = sessionStorage.getItem(EDITOR_TOKEN_KEY);
  if (adminToken)  h['X-Admin-Token']  = adminToken;
  if (editorToken) h['X-Editor-Token'] = editorToken;
  return h;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(apiBase() + path, {
    ...options,
    headers: { ...apiHeaders(), ...(options.headers as Record<string, string> | undefined || {}) }
  });
  const contentType = res.headers.get('content-type') || '';
  const payload: unknown = contentType.includes('application/json')
    ? await res.json()
    : null;

  if (!res.ok) {
    const errMsg = (payload && typeof payload === 'object' && 'error' in payload)
      ? String((payload as { error: unknown }).error)
      : res.statusText || String(res.status);
    throw Object.assign(new Error(errMsg), { status: res.status, payload });
  }
  return payload;
}
