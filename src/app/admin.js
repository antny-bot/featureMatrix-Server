/* ══════════════════════════════════════════
   admin.js — 인증 모듈 (편집자 / 관리자)
   - 서버 모드: POST /api/auth 로 역할별 토큰 발급
   - 로컬 단독 모드: 항상 editor = admin = true
══════════════════════════════════════════ */

import { S, notify, apiFetch } from './state.js';
import { ADMIN_TOKEN_KEY, EDITOR_TOKEN_KEY } from './constants.js';

/* ── 서버 모드 여부 ── */
function isServerMode() {
  return S.settings.storageMode === 'server';
}

/* ── 역할 확인 ── */
export function isAdmin() {
  if (!isServerMode()) return true;
  return !!sessionStorage.getItem(ADMIN_TOKEN_KEY);
}
export function isEditor() {
  if (!isServerMode()) return true;
  return !!(sessionStorage.getItem(EDITOR_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY));
}
export function getAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}
export function getEditorToken() {
  return sessionStorage.getItem(EDITOR_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

/* ── 권한 요구 (콜백 패턴) ── */
export function requireAdmin(callback) {
  if (isAdmin()) { callback(); return; }
  openLoginModal('admin', callback);
}
export function requireEditor(callback) {
  if (isEditor()) { callback(); return; }
  openLoginModal('editor', callback);
}

/* ── 로그인 모달 ── */
let _loginCallback = null;

export function openLoginModal(role = 'editor', callback = null) {
  _loginCallback = callback;
  if (!window.__reactOpenLoginModal) { if (callback) callback(); return; }
  window.__reactOpenLoginModal({ role, name: S.settings.userName || '' });
}

export function closeLoginModal() {
  window.__reactCloseLoginModal?.();
  _loginCallback = null;
}

export async function submitLogin() {
  const form = window.__reactGetLoginForm?.() || {};
  const name = (form.name || '').trim();
  const pw = form.password || '';
  const role = form.role || 'editor';
  window.__reactSetLoginError?.('');

  try {
    const json = await apiFetch('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ password: pw, role, name })
    });
    if (json.ok) {
      if (role === 'admin') {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, json.token);
      } else {
        sessionStorage.setItem(EDITOR_TOKEN_KEY, json.token);
      }
      if (name) { S.settings.userName = name; }
      closeLoginModal();
      updateAdminUI();
      notify(role === 'admin' ? '관리자로 로그인됐습니다.' : '편집자로 로그인됐습니다.');
      const cb = _loginCallback;
      _loginCallback = null;
      if (cb) cb();
    } else {
      window.__reactSetLoginError?.(json.error || '비밀번호가 올바르지 않습니다.');
    }
  } catch(e) {
    window.__reactSetLoginError?.('서버에 연결할 수 없습니다.');
  }
}

/* ── 로그아웃 ── */
export function logout() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(EDITOR_TOKEN_KEY);
  updateAdminUI();
  notify('로그아웃됐습니다.');
}

/* ── 하위 호환: adminLogout → logout ── */
export function adminLogout() { logout(); }

/* ── 편집자 비밀번호 변경 (관리자 전용) ── */
export async function setEditorPassword(password = '') {
  const newPw = password || '';
  window.__reactSetEditorPwError?.('');
  try {
    const json = await apiFetch('/api/set-editor-password', {
      method: 'POST',
      body: JSON.stringify({ password: newPw })
    });
    if (json.ok) {
      notify(newPw ? '편집자 비밀번호가 변경됐습니다.' : '편집자 비밀번호가 제거됐습니다.');
      return true;
    } else {
      window.__reactSetEditorPwError?.(json.error || '변경 실패');
    }
  } catch(e) {
    window.__reactSetEditorPwError?.('서버에 연결할 수 없습니다.');
  }
  return false;
}

/* ── UI 상태 동기화 ── */
export function updateAdminUI() {
  const admin      = isAdmin();
  const editor     = isEditor();

  /* 관리자 전용 요소 (data-admin) */
  document.querySelectorAll('[data-admin]').forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      el.disabled = !admin;
    } else {
      el.classList.toggle('admin-locked', !admin);
    }
  });

  /* 편집자 이상 요소 (data-editor) */
  document.querySelectorAll('[data-editor]').forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      el.disabled = !editor;
    } else {
      el.classList.toggle('admin-locked', !editor);
    }
  });

  /* 관리자 배지 / 로그아웃 버튼: Header.jsx(React)가 제어 → DOM 직접 조작 제거 */

  /* React AuthContext 동기화 */
  window.__authRefresh?.();
}

