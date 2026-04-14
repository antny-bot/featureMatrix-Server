/* ══════════════════════════════════════════
   AuthContext.jsx — 인증 상태 React Context

   admin.js의 sessionStorage 기반 토큰을 React 상태로 래핑.
   인증 변경 시 Context를 재평가.

   사용 예:
     const { isAdmin, isEditor, isServerMode } = useAuth();
══════════════════════════════════════════ */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ADMIN_TOKEN_KEY, EDITOR_TOKEN_KEY } from '../app/constants.js';
import { registerActiveUser, unregisterActiveUser } from '../app/socket.js';
import { getStore, setStore, useAppStore } from '../store/useAppStore.js';
import { apiFetch } from '../utils/api.js';

let authRefresh = null;

const notify = (message, type = false) => {
  useAppStore.getState().notify(message, type);
};

function readAuth() {
  const adminToken  = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const editorToken = sessionStorage.getItem(EDITOR_TOKEN_KEY);
  const storageMode = getStore().settings?.storageMode ?? 'server';
  const serverMode  = storageMode === 'server';
  const adminFlag   = !serverMode || !!adminToken;
  const editorFlag  = !serverMode || !!(editorToken || adminToken);
  return { adminFlag, editorFlag, serverMode };
}

const AuthContext = createContext({
  isAdmin:      false,
  isEditor:     false,
  isServerMode: true,
  refresh:      () => {},
  logout:       () => {},
  openLoginModal: () => {},
});

export function isAdmin() {
  const { adminFlag } = readAuth();
  return adminFlag;
}

export function isEditor() {
  const { editorFlag } = readAuth();
  return editorFlag;
}

export function getAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

export function getEditorToken() {
  return sessionStorage.getItem(EDITOR_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

export function updateAdminUI() {
  authRefresh?.();
}

export function openLoginModal(role = 'editor', callback = null) {
  const store = getStore();
  store.openLoginModal(role, callback);
}

export function closeLoginModal() {
  const store = getStore();
  store.closeLoginModal();
}

export async function submitLogin() {
  const store = getStore();
  const { role, password, name, callback: loginCallback } = store.loginModal;
  const trimmedName = (name || '').trim();

  store.setLoginError('');

  try {
    const json = await apiFetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ password, role, name: trimmedName }),
    });

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
    }

    store.closeLoginModal();
    updateAdminUI();
    registerActiveUser();
    notify(role === 'admin' ? '관리자로 로그인됐습니다.' : '편집자로 로그인됐습니다.', 'success');
    loginCallback?.();
  } catch (e) {
    store.setLoginError(e.payload?.error || e.message || '서버에 연결할 수 없습니다.');
  }
}

export function logout() {
  unregisterActiveUser();
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(EDITOR_TOKEN_KEY);
  updateAdminUI();
  notify('로그아웃됐습니다.', 'success');
}

export function adminLogout() {
  logout();
}

export function requireAdmin(callback) {
  if (isAdmin()) {
    callback();
    return;
  }
  openLoginModal('admin', callback);
}

export function requireEditor(callback) {
  if (isEditor()) {
    callback();
    return;
  }
  openLoginModal('editor', callback);
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const { adminFlag, editorFlag, serverMode } = readAuth();
    return { isAdmin: adminFlag, isEditor: editorFlag, isServerMode: serverMode };
  });

  const refresh = useCallback(() => {
    const { adminFlag, editorFlag, serverMode } = readAuth();
    setAuth({ isAdmin: adminFlag, isEditor: editorFlag, isServerMode: serverMode });
  }, []);

  useEffect(() => {
    authRefresh = refresh;
    return () => {
      if (authRefresh === refresh) authRefresh = null;
    };
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ ...auth, refresh, logout, openLoginModal }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
