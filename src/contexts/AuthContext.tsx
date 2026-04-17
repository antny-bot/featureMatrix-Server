import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ADMIN_TOKEN_KEY, EDITOR_TOKEN_KEY, SK } from '../app/constants.js';
import { registerActiveUser, unregisterActiveUser } from '../app/socket.js';
import { getStore, setStore, useAppStore } from '../store/useAppStore.js';
import { apiFetch } from '../utils/api.js';

let authRefresh: (() => void) | null = null;
let _tokenExpiresAt = 0;

interface AuthState {
  isAdmin: boolean;
  isEditor: boolean;
  isServerMode: boolean;
  tokenExpiresAt: number;
}

interface AuthContextValue extends AuthState {
  refresh: () => void;
  logout: () => void;
  openLoginModal: (role?: string) => void;
  getSessionTimeRemaining: () => number;
}

const notify = (message: string, type: string | boolean = false) => {
  useAppStore.getState().notify(message, type);
};

function readAuth(): { adminFlag: boolean; editorFlag: boolean; serverMode: boolean } {
  const adminToken  = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const editorToken = sessionStorage.getItem(EDITOR_TOKEN_KEY);
  const storageMode = getStore().settings?.storageMode ?? 'server';
  const serverMode  = storageMode === 'server';
  const adminFlag   = !serverMode || !!adminToken;
  const editorFlag  = !serverMode || !!(editorToken || adminToken);
  return { adminFlag, editorFlag, serverMode };
}

function hasStoredAuth(): boolean {
  return !!(sessionStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(EDITOR_TOKEN_KEY));
}

const AuthContext = createContext<AuthContextValue>({
  isAdmin:      false,
  isEditor:     false,
  isServerMode: true,
  tokenExpiresAt: 0,
  refresh:      () => {},
  logout:       () => {},
  openLoginModal: () => {},
  getSessionTimeRemaining: () => 0,
});

export function isAdmin(): boolean {
  const { adminFlag } = readAuth();
  return adminFlag;
}

export function isEditor(): boolean {
  const { editorFlag } = readAuth();
  return editorFlag;
}

export function getAdminToken(): string {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

export function getEditorToken(): string {
  return sessionStorage.getItem(EDITOR_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

export function updateAdminUI(): void {
  authRefresh?.();
}

function clearAuthSession(notifyUser = false): void {
  const hadAuth = hasStoredAuth();
  unregisterActiveUser();
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(EDITOR_TOKEN_KEY);
  _tokenExpiresAt = 0;
  updateAdminUI();
  registerActiveUser();
  if (notifyUser && hadAuth) {
    notify('세션이 만료되었습니다. 다시 로그인해 주세요.', 'warning');
  }
}

export function getSessionTimeRemaining(): number {
  if (_tokenExpiresAt === 0) return 0;
  return Math.max(0, _tokenExpiresAt - Date.now());
}

interface AuthStatusResponse {
  authenticated: boolean;
  role: string;
  expiresAt: number;
}

export async function validateAuthSession({ notifyUser = false } = {}): Promise<boolean> {
  if (!hasStoredAuth()) return true;

  try {
    const json = await apiFetch('/api/auth/status') as AuthStatusResponse;
    if (!json.authenticated) {
      clearAuthSession(notifyUser);
      return false;
    }

    _tokenExpiresAt = json.expiresAt ?? 0;
    authRefresh?.();

    const adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (adminToken && json.role !== 'admin') {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      updateAdminUI();
    }
    return true;
  } catch {
    return true;
  }
}

export function openLoginModal(role = 'editor', callback: (() => void) | null = null): void {
  const store = getStore();
  store.openLoginModal(role, callback);
}

export function closeLoginModal(): void {
  const store = getStore();
  store.closeLoginModal();
}

export async function submitLogin(): Promise<void> {
  const store = getStore();
  const { role, password, name, callback: loginCallback } = store.loginModal;
  const trimmedName = (name || '').trim();

  store.setLoginError('');

  try {
    const json = await apiFetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ password, role, name: trimmedName }),
    }) as { ok: boolean; token: string; error?: string };

    if (!json.ok) {
      store.setLoginError(json.error || '비밀번호가 올바르지 않습니다.');
      return;
    }

    if (role === 'admin') {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, json.token);
    } else {
      sessionStorage.setItem(EDITOR_TOKEN_KEY, json.token);
    }

    if (trimmedName) {
      setStore({ settings: { ...store.settings, userName: trimmedName } });
      // localStorage에 즉시 저장하여 새로고침 후에도 유지
      try {
        const raw = localStorage.getItem(SK as string);
        const blob = raw ? JSON.parse(raw) : {};
        blob.local = { ...(blob.local || {}), userName: trimmedName };
        localStorage.setItem(SK as string, JSON.stringify(blob));
      } catch { /* ignore */ }
    }

    // 로그인 직후 만료 시간 설정 (서버 TTL 24시간 기준)
    _tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000;

    store.closeLoginModal();
    updateAdminUI();
    registerActiveUser();
    notify(role === 'admin' ? '관리자로 로그인됐습니다.' : '편집자로 로그인됐습니다.', 'success');
    loginCallback?.();
  } catch (e: unknown) {
    const err = e as { payload?: { error?: string }; message?: string };
    store.setLoginError(err.payload?.error || err.message || '서버에 연결할 수 없습니다.');
  }
}

export function logout(): void {
  clearAuthSession(false);
  notify('로그아웃됐습니다.', 'success');
}

export function adminLogout(): void {
  logout();
}

export function requireAdmin(callback: () => void): void {
  if (isAdmin()) {
    callback();
    return;
  }
  openLoginModal('admin', callback);
}

export function requireEditor(callback: () => void): void {
  if (isEditor()) {
    callback();
    return;
  }
  openLoginModal('editor', callback);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const { adminFlag, editorFlag, serverMode } = readAuth();
    return { isAdmin: adminFlag, isEditor: editorFlag, isServerMode: serverMode, tokenExpiresAt: _tokenExpiresAt };
  });

  const refresh = useCallback(() => {
    const { adminFlag, editorFlag, serverMode } = readAuth();
    setAuth({ isAdmin: adminFlag, isEditor: editorFlag, isServerMode: serverMode, tokenExpiresAt: _tokenExpiresAt });
  }, []);

  useEffect(() => {
    authRefresh = refresh;
    return () => {
      if (authRefresh === refresh) authRefresh = null;
    };
  }, [refresh]);

  useEffect(() => {
    if (!auth.isServerMode) return undefined;

    validateAuthSession({ notifyUser: true });
    const intervalId = setInterval(() => {
      validateAuthSession({ notifyUser: true });
    }, 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        validateAuthSession({ notifyUser: true });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [auth.isServerMode]);

  /* 세션 만료 5분 전 경고 및 만료 시 자동 로그아웃 */
  useEffect(() => {
    if (!auth.isServerMode || (!auth.isAdmin && !auth.isEditor)) return;
    if (auth.tokenExpiresAt <= 0) return;

    const now = Date.now();
    const msLeft = auth.tokenExpiresAt - now;
    if (msLeft <= 0) return;

    const WARN_MS = 5 * 60 * 1000;
    let warnId: ReturnType<typeof setTimeout> | undefined;

    if (msLeft - WARN_MS > 0) {
      warnId = setTimeout(() => {
        notify('세션이 5분 후 만료됩니다. 저장 후 다시 로그인해 주세요.', 'warning');
      }, msLeft - WARN_MS);
    }

    const expId = setTimeout(() => {
      clearAuthSession(false);
      notify('세션이 만료되었습니다. 다시 로그인해 주세요.', 'warning');
      openLoginModal();
    }, msLeft);

    return () => {
      if (warnId) clearTimeout(warnId);
      clearTimeout(expId);
    };
  }, [auth.tokenExpiresAt, auth.isAdmin, auth.isEditor, auth.isServerMode]);

  const contextValue: AuthContextValue = {
    ...auth,
    refresh,
    logout,
    openLoginModal,
    getSessionTimeRemaining,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
