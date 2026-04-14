/* ══════════════════════════════════════════
   Header.jsx — 앱 헤더 React 컴포넌트 (Phase 4)

   반응형 요소:
   - activeUsers / currentUser / role state: useAuth() + Zustand
   - adminLogoutBtn: useAuth().(isAdmin||isEditor) + isServerMode
   - hdrSearchWrap/searchInp/searchClear/hdrCountBadge: React 상태로 제어 (id 유지)

   나머지 버튼들(설정, 단축키, 테마 등)은 vanilla JS onclick 유지.
══════════════════════════════════════════ */

import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { getFiltered } from '../app/render.js';
import { S } from '../app/state.js';
import { useAppStore } from '../store/useAppStore.js';

/* ── SVG 아이콘 상수 ── */
const ICON_SERVER = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="8" rx="2"/>
    <rect x="2" y="14" width="20" height="8" rx="2"/>
    <line x1="6" y1="6" x2="6.01" y2="6"/>
    <line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
);
const ICON_SHORTCUTS = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>
  </svg>
);
const ICON_LOGIN = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const ICON_ADMIN = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const ICON_EDITOR = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const ICON_LOGOUT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
/* 테마 아이콘: isDark에 따라 달라짐 (Header 함수 내에서 생성) */
function IconSun() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" id="themeBtnIcon">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function IconMoon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" id="themeBtnIcon">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

/* wsStatus → 점 색상/툴팁 매핑 */
const WS_STATUS_MAP = {
  connected:    { bg: '#16a34a', title: 'WebSocket 연결됨 (실시간)' },
  reconnecting: { bg: '#d97706', title: '재연결 중...' },
  disconnected: { bg: '#dc2626', title: 'WebSocket 연결 끊김 (폴링 모드)' },
  connecting:   { bg: '#d97706', title: 'WebSocket 연결 중...' },
  idle:         { bg: '#aaa',    title: '서버' },
};

function getUserInitial(name = '') {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /^[a-z0-9]/i.test(parts[0]) && /^[a-z0-9]/i.test(parts[1])) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return Array.from(trimmed)[0].toUpperCase();
}

function getAvatarTone(name = '') {
  const tones = ['teal', 'rose', 'amber', 'blue', 'green'];
  const sum = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tones[sum % tones.length];
}

function ActiveUserAvatars({ users }) {
  if (!users.length) return null;

  const visible = users.slice(0, 5);
  const extra = users.length - visible.length;

  return (
    <div className="active-users" title={`동시 접속자 ${users.length}명`}>
      {visible.map(user => (
        <span
          key={user.sid || `${user.user}-${user.joinTime}`}
          className={`active-avatar active-avatar--${getAvatarTone(user.user)}`}
          title={user.user}
        >
          {getUserInitial(user.user)}
        </span>
      ))}
      {extra > 0 && (
        <span className="active-avatar active-avatar--more" title={`외 ${extra}명`}>
          +{extra}
        </span>
      )}
    </div>
  );
}

function OwnUserBadge({ name }) {
  return (
    <div className="own-user" title={`본인: ${name}`}>
      <span className={`active-avatar active-avatar--${getAvatarTone(name)}`}>
        {getUserInitial(name)}
      </span>
      <span className="own-user-name">{name}</span>
    </div>
  );
}

export default function Header() {
  const { isAdmin, isEditor, isServerMode } = useAuth();
  const { isDark } = useTheme();
  const title    = useAppStore(s => s.settings.title    || 'featureMATRIX');
  const subtitle = useAppStore(s => s.settings.subtitle || '기능정의 툴');
  const storageMode = useAppStore(s => s.settings.storageMode || 'server');
  const serverStatus = useAppStore(s => s.serverStatus);
  const wsStatus = useAppStore(s => s.wsStatus);
  const activeUsers = useAppStore(s => s.activeUsers || []);
  const userName = useAppStore(s => s.settings.userName || '익명');
  const view = useAppStore(s => s.view);
  const searchQ = useAppStore(s => s.searchQ);
  useAppStore(s => s.items);
  useAppStore(s => s.filters);

  const searchRef = useRef(null);
  const showSearch = view !== 'dashboard';
  const filteredCount = getFiltered().length;

  const showLogoutBtn   = (isAdmin || isEditor) && isServerMode;
  const logoutTitle     = isAdmin ? '관리자 로그아웃' : '편집자 로그아웃';
  const loginState = isAdmin
    ? { label: '관리자', icon: ICON_ADMIN, active: true }
    : isEditor
      ? { label: '편집자', icon: ICON_EDITOR, active: true }
      : { label: '로그인', icon: ICON_LOGIN, active: false };

  // 서버 연결 상태: WebSocket 상태가 있으면 우선 표시하고, 없으면 REST/polling 상태를 표시한다.
  const restDot = serverStatus === 'ok'
    ? { bg: '#16a34a', title: '서버 연결됨' }
    : serverStatus === 'error'
      ? { bg: '#dc2626', title: '서버 연결 오류' }
      : { bg: '#aaa', title: '서버 상태' };
  const wsDot = WS_STATUS_MAP[wsStatus] || WS_STATUS_MAP.idle;
  const showWsDot = storageMode === 'server' && wsStatus !== 'idle';
  const statusDot = showWsDot ? wsDot : restDot;
  const showStatusDot = storageMode === 'server';
  const serverLabel = showWsDot
    ? (wsStatus === 'reconnecting' ? '재연결 중...' : wsStatus === 'connected' ? '실시간' : '서버')
    : (storageMode === 'server' ? '🌐' : '💾');

  useEffect(() => {
    window.__focusSearch = () => searchRef.current?.focus();
    return () => {
      if (window.__focusSearch) delete window.__focusSearch;
    };
  }, []);

  const updateSearch = value => {
    S.searchQ = value.trim();
    useAppStore.getState().setSearchQ(S.searchQ);
    window.renderAll?.(true);
  };

  return (
    <header className="hdr">
      <div className="hdr-left">
        <div>
          <div className="logo-kr" id="dTitle">{title}</div>
          <div className="logo-sub" id="dSub">{subtitle}</div>
        </div>
      </div>

      {/* stats: 대시보드로 이동 (DOM id 유지 → countUp 호환) */}
      <span id="stTotal" style={{display:'none'}}>0</span>
      <span id="stHigh"  style={{display:'none'}}>0</span>
      <span id="stMid"   style={{display:'none'}}>0</span>
      <span id="stLow"   style={{display:'none'}}>0</span>
      <span id="stImp"   style={{display:'none'}}>0</span>
      <span id="stNew"   style={{display:'none'}}>0</span>

      <div className="hdr-mid">
        <div id="hdrSearchWrap" style={{display: showSearch ? 'flex' : 'none', alignItems:'center', gap:'8px', flex:1, minWidth:0}}>
          <div className="search-wrap">
            <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchRef}
              className="search-inp"
              id="searchInp"
              placeholder="검색 (기능명·Key·담당·경로)"
              value={searchQ}
              onChange={(e) => updateSearch(e.target.value)}
            />
            <button className={`search-clear${searchQ ? ' on' : ''}`} id="searchClear" onClick={() => updateSearch('')}>✕</button>
          </div>
          <span className="hdr-count-badge" id="hdrCountBadge">{filteredCount ? `${filteredCount}개` : ''}</span>
        </div>
      </div>

      <div className="hdr-actions">
        <ActiveUserAvatars users={activeUsers} />
        {showLogoutBtn && activeUsers.length > 0 && <span className="hdr-user-sep" aria-hidden="true" />}
        {showLogoutBtn && <OwnUserBadge name={userName} />}

        {showLogoutBtn && (
          <button
            type="button"
            className="btn btn-g btn-sm hdr-btn hdr-role"
            title={loginState.label}
          >
            {loginState.icon}
            <span>{loginState.label}</span>
          </button>
        )}

        {/* 로그아웃 버튼: React 제어 */}
        {showLogoutBtn && (
          <button
            id="adminLogoutBtn"
            className="btn btn-g btn-sm hdr-btn hdr-logout"
            onClick={() => window.logout?.()}
            title={logoutTitle}
          >
            {ICON_LOGOUT}
            <span>로그아웃</span>
          </button>
        )}

        {/* 서버 상태 버튼 */}
        <button className="btn btn-g btn-sm hdr-btn" id="serverStatusBtn"
          title={statusDot.title}
          onClick={() => window.openModal?.('settingsModal')}>
          {showStatusDot && (
            <span id="serverStatusDot" style={{width:'7px', height:'7px', borderRadius:'50%', background: statusDot.bg,
                          flexShrink:0, display:'inline-block', transition:'background .3s'}}></span>
          )}
          {ICON_SERVER}
          <span id="serverStatusLabel">{serverLabel}</span>
        </button>

        {isServerMode && !showLogoutBtn && (
          <button
            className={`btn btn-g btn-sm hdr-btn hdr-login${loginState.active ? ' hdr-login--on' : ''}`}
            onClick={() => window.openLoginModal?.()}
            title="로그인"
          >
            {loginState.icon}
            <span>{loginState.label}</span>
          </button>
        )}
        <button className="btn btn-g btn-sm hdr-btn" onClick={() => window.openModal?.('shortcutsModal')} title="단축키 (?)">
          {ICON_SHORTCUTS}
          <span>단축키</span>
        </button>
        <button className="btn btn-g btn-sm hdr-btn" onClick={() => window.toggleTheme?.()} id="themeBtn" title="테마">
          {isDark ? <IconSun /> : <IconMoon />}
          <span>{isDark ? '라이트' : '다크'}</span>
        </button>
      </div>
    </header>
  );
}
