/* ══════════════════════════════════════════
   AuthContext.jsx — 인증 상태 React Context

   admin.js의 sessionStorage 기반 토큰을 React 상태로 래핑.
   vanilla JS의 updateAdminUI()가 호출될 때마다
   window.__authRefresh() 를 통해 이 Context를 재평가.

   사용 예:
     const { isAdmin, isEditor, isServerMode } = useAuth();
══════════════════════════════════════════ */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ADMIN_TOKEN_KEY, EDITOR_TOKEN_KEY } from '../app/constants.js';
import { registerActiveUser, unregisterActiveUser } from '../app/socket.js';
import { getStore, setStore, useAppStore } from '../store/useAppStore.js';
import { apiFetch } from '../utils/api.js';

let loginCallback = null;

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
  const admin = isAdmin();
  const editor = isEditor();

  document.querySelectorAll('[data-admin]').forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      el.disabled = !admin;
    } else {
      el.classList.toggle('admin-locked', !admin);
    }
  });

  document.querySelectorAll('[data-editor]').forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      el.disabled = !editor;
    } else {
      el.classList.toggle('admin-locked', !editor);
    }
  });

  window.__authRefresh?.();
}

export function openLoginModal(role = 'editor', callback = null) {
  loginCallback = callback;
  if (!window.__reactOpenLoginModal) {
    if (callback) callback();
    return;
  }

  const userName = getStore().settings?.userName || '';
  window.__reactOpenLoginModal({ role, name: userName });
}

export function closeLoginModal() {
  window.__reactCloseLoginModal?.();
  loginCallback = null;
}

export async function submitLogin() {
  const form = window.__reactGetLoginForm?.() || {};
  const name = (form.name || '').trim();
  const password = form.password || '';
  const role = form.role || 'editor';

  window.__reactSetLoginError?.('');

  try {
    const json = await apiFetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ password, role, name }),
    });

    if (!json.ok) {
      window.__reactSetLoginError?.(json.error || '비밀번호가 올바르지 않습니다.');
      return;
    }

    if (role === 'admin') {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, json.token);
    } else {
      sessionStorage.setItem(EDITOR_TOKEN_KEY, json.token);
    }

    if (name) {
      const store = getStore();
      setStore({ settings: { ...store.settings, userName: name } });
    }

    const callback = loginCallback;
    closeLoginModal();
    updateAdminUI();
    registerActiveUser();
    notify(role === 'admin' ? '관리자로 로그인됐습니다.' : '편집자로 로그인됐습니다.', 'success');
    loginCallback = null;
    callback?.();
  } catch (e) {
    window.__reactSetLoginError?.('서버에 연결할 수 없습니다.');
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
    // vanilla JS의 updateAdminUI()가 호출될 때 React 상태도 갱신
    window.__authRefresh = refresh;
    return () => { delete window.__authRefresh; };
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
