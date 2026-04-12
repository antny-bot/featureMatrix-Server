/* ══════════════════════════════════════════
   AuthContext.jsx — 인증 상태 React Context

   admin.js의 sessionStorage 기반 토큰을 React 상태로 래핑.
   vanilla JS의 updateAdminUI()가 호출될 때마다
   window.__authRefresh() 를 통해 이 Context를 재평가.

   사용 예:
     const { isAdmin, isEditor, isServerMode } = useAuth();
══════════════════════════════════════════ */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ADMIN_TOKEN_KEY  = 'fmAdminToken';
const EDITOR_TOKEN_KEY = 'fmEditorToken';

function readAuth() {
  const adminToken  = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const editorToken = sessionStorage.getItem(EDITOR_TOKEN_KEY);
  // storageMode는 Zustand store에서 읽는 것이 이상적이나,
  // 초기 마운트 시 store가 없을 수 있으므로 window.__S를 fallback으로 사용
  const storageMode = window.__S?.settings?.storageMode ?? 'server';
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
});

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
    <AuthContext.Provider value={{ ...auth, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
