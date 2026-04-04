/* ══════════════════════════════════════════
   admin.js — 관리자 인증 모듈
   - 서버 모드: POST /api/auth 로 비번 검증 → sessionStorage 토큰
   - 로컬 단독 모드: 항상 admin = true
══════════════════════════════════════════ */

import { S, notify } from './state.js';

const ADMIN_TOKEN_KEY = 'fmAdminToken';

/* ── 서버 모드 여부 ── */
function isServerMode() {
  return S.settings.storageMode === 'server';
}

function apiBase() {
  return (S.settings.serverUrl || '').trim() || window.location.origin;
}
function apiHeaders() {
  return { 'Content-Type': 'application/json', 'X-API-Key': S.settings.apiKey || '' };
}

/* ── 관리자 여부 확인 ── */
export function isAdmin() {
  if (!isServerMode()) return true; // 로컬 단독 모드 → 항상 관리자
  return !!sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function getAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

/* ── 관리자 인증 요청 ── */
// callback: 인증 성공 후 실행할 함수
export function requireAdmin(callback) {
  if (isAdmin()) { callback(); return; }

  // 비번 모달 표시
  const modal = document.getElementById('adminAuthModal');
  if (!modal) { callback(); return; } // 모달 없으면 그냥 실행
  document.getElementById('adminPwInp').value = '';
  document.getElementById('adminAuthErr').textContent = '';
  // 이미 열린 모달보다 위에 표시
  document.querySelectorAll('.ov.on').forEach(m => { m.style.zIndex = '1000'; });
  modal.style.zIndex = '1010';
  modal.classList.add('on');
  modal._callback = callback;
  setTimeout(() => document.getElementById('adminPwInp').focus(), 100);
}

/* ── 비번 제출 (모달에서 호출) ── */
export async function submitAdminAuth() {
  const pw    = document.getElementById('adminPwInp').value;
  const errEl = document.getElementById('adminAuthErr');
  errEl.textContent = '';

  try {
    const res = await fetch(apiBase() + '/api/auth', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ password: pw })
    });
    const json = await res.json();
    if (json.ok) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, json.token);
      closeAdminModal();
      updateAdminUI();
      const modal = document.getElementById('adminAuthModal');
      if (modal?._callback) { modal._callback(); modal._callback = null; }
    } else {
      errEl.textContent = json.error || '비밀번호가 올바르지 않습니다.';
    }
  } catch(e) {
    errEl.textContent = '서버에 연결할 수 없습니다.';
  }
}

export function closeAdminModal() {
  document.getElementById('adminAuthModal')?.classList.remove('on');
}

/* ── 관리자 로그아웃 ── */
export function adminLogout() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  updateAdminUI();
  notify('관리자 권한이 해제됐습니다.');
}

/* ── 관리자 UI 상태 갱신 ── */
export function updateAdminUI() {
  const admin = isAdmin();
  // 관리자 전용 버튼/필드 활성화/비활성화
  document.querySelectorAll('[data-admin]').forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      el.disabled = !admin;
    } else {
      el.classList.toggle('admin-locked', !admin);
    }
  });
  // 관리자 배지 표시
  const badge = document.getElementById('adminBadge');
  if (badge) {
    badge.style.display = admin && isServerMode() ? 'inline' : 'none';
  }
  // 로그아웃 버튼
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.style.display = admin && isServerMode() ? 'inline-flex' : 'none';
  }
}

/* ── 관리자 전용 클릭 핸들러 ── */
// 잠긴 요소 클릭 시 비번 요청
export function handleLockedClick(e, callback) {
  if (!isAdmin()) {
    e.stopPropagation();
    requireAdmin(callback);
  }
}
