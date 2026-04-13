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
  const modal = document.getElementById('loginModal');
  if (!modal) { if (callback) callback(); return; }
  const roleSelect = document.getElementById('loginRoleSelect');
  if (roleSelect) roleSelect.value = role;
  const nameInp = document.getElementById('loginNameInp');
  if (nameInp) nameInp.value = S.settings.userName || '';
  const pwInp = document.getElementById('loginPwInp');
  if (pwInp) pwInp.value = '';
  const errEl = document.getElementById('loginErr');
  if (errEl) errEl.textContent = '';
  document.querySelectorAll('.ov.on').forEach(m => { m.style.zIndex = '1000'; });
  modal.style.zIndex = '1010';
  modal.classList.add('on');
  setTimeout(() => pwInp?.focus(), 100);
}

export function closeLoginModal() {
  document.getElementById('loginModal')?.classList.remove('on');
  _loginCallback = null;
}

export async function submitLogin() {
  const name   = document.getElementById('loginNameInp')?.value.trim() || '';
  const pw     = document.getElementById('loginPwInp')?.value || '';
  const role   = document.getElementById('loginRoleSelect')?.value || 'editor';
  const errEl  = document.getElementById('loginErr');
  if (errEl) errEl.textContent = '';

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
      if (errEl) errEl.textContent = json.error || '비밀번호가 올바르지 않습니다.';
    }
  } catch(e) {
    if (errEl) errEl.textContent = '서버에 연결할 수 없습니다.';
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
export async function setEditorPassword() {
  const inp  = document.getElementById('editorPwInp');
  const errEl = document.getElementById('editorPwErr');
  if (!inp) return;
  const newPw = inp.value;
  if (errEl) errEl.textContent = '';
  try {
    const json = await apiFetch('/api/set-editor-password', {
      method: 'POST',
      body: JSON.stringify({ password: newPw })
    });
    if (json.ok) {
      inp.value = '';
      notify(newPw ? '편집자 비밀번호가 변경됐습니다.' : '편집자 비밀번호가 제거됐습니다.');
    } else {
      if (errEl) errEl.textContent = json.error || '변경 실패';
    }
  } catch(e) {
    if (errEl) errEl.textContent = '서버에 연결할 수 없습니다.';
  }
}

/* ── UI 상태 동기화 ── */
export function updateAdminUI() {
  const admin      = isAdmin();
  const editor     = isEditor();
  const serverMode = isServerMode();

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

  /* 관리자 탭 표시 여부 */
  const sadminTab = document.getElementById('sadminTab');
  if (sadminTab) {
    sadminTab.style.display = admin ? '' : 'none';
    if (!admin && document.getElementById('sadmin')?.classList.contains('on')) {
      document.querySelectorAll('.stab').forEach(t => t.classList.remove('on'));
      document.querySelectorAll('.spane').forEach(p => p.classList.remove('on'));
      document.querySelector('.stab:not(#sadminTab)')?.classList.add('on');
      document.getElementById('sg')?.classList.add('on');
    }
  }

  /* 사이드바 로그인 버튼 */
  _updateNavLogin(admin, editor, serverMode);

  /* React AuthContext 동기화 */
  window.__authRefresh?.();
}

function _updateNavLogin(admin, editor, serverMode) {
  const btn = document.getElementById('navLogin');
  if (!btn) return;
  btn.style.display = serverMode ? '' : 'none';
  if (!serverMode) return;

  const lockIcon  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const adminIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  const editIcon  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

  if (admin) {
    btn.innerHTML = `${adminIcon}<span>관리자</span>`;
    btn.classList.add('nav-login--on');
  } else if (editor) {
    btn.innerHTML = `${editIcon}<span>편집자</span>`;
    btn.classList.add('nav-login--on');
  } else {
    btn.innerHTML = `${lockIcon}<span>로그인</span>`;
    btn.classList.remove('nav-login--on');
  }
}

