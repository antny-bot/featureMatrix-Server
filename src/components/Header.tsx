import { useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useAppStore } from '../store/useAppStore.js';
import { useModals } from '../hooks/useModals.js';
import { getFiltered } from '../utils/itemUtils.js';

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

const WS_STATUS_MAP: Record<string, { bg: string; title: string }> = {
  connected:    { bg: '#16a34a', title: 'WebSocket connected' },
  reconnecting: { bg: '#d97706', title: 'Reconnecting...' },
  disconnected: { bg: '#dc2626', title: 'WebSocket disconnected' },
  connecting:   { bg: '#d97706', title: 'Connecting...' },
  idle:         { bg: '#aaa',    title: 'Server' },
};

function getUserInitial(name = ''): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /^[a-z0-9]/i.test(parts[0]) && /^[a-z0-9]/i.test(parts[1])) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return Array.from(trimmed)[0].toUpperCase();
}

function getAvatarTone(name = ''): string {
  const tones = ['teal', 'rose', 'amber', 'blue', 'green'];
  const sum = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tones[sum % tones.length];
}

function formatSessionRemaining(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return '1분 미만';
  if (totalMin < 60) return `${totalMin}분`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

interface ActiveUser {
  sid?: string;
  user: string;
  joinTime: number;
}

function ActiveUserAvatars({ users }: { users: ActiveUser[] }) {
  if (!users.length) return null;
  const visible = users.slice(0, 5);
  const extra = users.length - visible.length;
  return (
    <div className="active-users" title={`${users.length} active users`}>
      {visible.map(user => (
        <span key={user.sid || `${user.user}-${user.joinTime}`} className={`active-avatar active-avatar--${getAvatarTone(user.user)}`} title={user.user}>
          {getUserInitial(user.user)}
        </span>
      ))}
      {extra > 0 && <span className="active-avatar active-avatar--more" title={`${extra} users`}>+{extra}</span>}
    </div>
  );
}

function OwnUserBadge({ name }: { name: string }) {
  return (
    <div className="own-user" title={`User: ${name}`}>
      <span className={`active-avatar active-avatar--${getAvatarTone(name)}`}>{getUserInitial(name)}</span>
      <span className="own-user-name">{name}</span>
    </div>
  );
}

export default function Header() {
  const { isAdmin, isEditor, isServerMode, logout, openLoginModal, getSessionTimeRemaining } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { openModal } = useModals();

  const settings         = useAppStore(s => s.settings);
  const serverStatus     = useAppStore(s => s.serverStatus);
  const wsStatus         = useAppStore(s => s.wsStatus);
  const activeUsers      = useAppStore(s => s.activeUsers);
  const view             = useAppStore(s => s.view);
  const searchQ          = useAppStore(s => s.searchQ);
  const filters          = useAppStore(s => s.filters);
  const items            = useAppStore(s => s.items);
  const searchFocusNonce = useAppStore(s => s.searchFocusNonce);
  const setSearchQ       = useAppStore(s => s.setSearchQ);

  const title       = settings.title       || 'featureMATRIX';
  const subtitle    = settings.subtitle    || 'Function Matrix';
  const storageMode = settings.storageMode || 'server';
  const userName    = settings.userName    || 'Anonymous';

  const searchRef = useRef<HTMLInputElement>(null);
  const showSearch = view !== 'dashboard';

  const filteredCount = useMemo(() => getFiltered(items, filters, searchQ).length, [items, filters, searchQ]);

  const showLogoutBtn   = (isAdmin || isEditor) && isServerMode;
  const logoutTitle     = 'Logout';
  const loginState = isAdmin
    ? { label: 'Admin', icon: ICON_ADMIN, active: true }
    : isEditor
      ? { label: 'Editor', icon: ICON_EDITOR, active: true }
      : { label: 'Login', icon: ICON_LOGIN, active: false };

  // 세션 만료 시간 표시
  const sessionMs = (isAdmin || isEditor) ? getSessionTimeRemaining() : 0;
  const sessionLabel = sessionMs > 0 ? `세션 만료까지 ${formatSessionRemaining(sessionMs)} 남음` : '';
  const sessionWarn  = sessionMs > 0 && sessionMs <= 600_000; // 10분 이하

  // 서버 상태 표시
  const isOfflineMode = storageMode === 'local';
  const isServerDown  = storageMode === 'server' && serverStatus === 'error' && wsStatus === 'disconnected';

  const restDot = serverStatus === 'ok'
    ? { bg: '#16a34a', title: 'Server connected' }
    : serverStatus === 'error'
      ? { bg: '#dc2626', title: 'Server error' }
      : { bg: '#aaa', title: 'Server status' };
  const wsDot = WS_STATUS_MAP[wsStatus] || WS_STATUS_MAP['idle'];
  const showWsDot = storageMode === 'server' && wsStatus !== 'idle';

  const statusDot = isOfflineMode
    ? { bg: '#64748b', title: '오프라인 (로컬) 모드' }
    : isServerDown
      ? { bg: '#dc2626', title: '서버 연결 오류' }
      : showWsDot ? wsDot : restDot;

  const serverLabel = isOfflineMode
    ? '오프라인'
    : isServerDown
      ? '서버 오류'
      : showWsDot
        ? (wsStatus === 'reconnecting' ? '재연결 중' : wsStatus === 'connected' ? '실시간' : '연결끊김')
        : '서버';

  const showStatusDot = storageMode === 'server' || isOfflineMode;

  useEffect(() => {
    if (searchFocusNonce > 0) searchRef.current?.focus();
  }, [searchFocusNonce]);

  return (
    <header className="hdr">
      <div className="hdr-left">
        <div>
          <div className="logo-kr">{title}</div>
          <div className="logo-sub">{subtitle}</div>
        </div>
      </div>

      <div className="hdr-mid">
        <div id="hdrSearchWrap" style={{display: showSearch ? 'flex' : 'none', alignItems:'center', gap:'8px', flex:1, minWidth:0}}>
          <div className="search-wrap">
            <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchRef}
              className="search-inp"
              placeholder="Search (name / key / owner / path)"
              value={searchQ}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQ(e.target.value)}
            />
            <button className={`search-clear${searchQ ? ' on' : ''}`} onClick={() => setSearchQ('')}>x</button>
          </div>
          <span className="hdr-count-badge">{filteredCount ? `${filteredCount}` : ''}</span>
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
            title={sessionLabel || loginState.label}
            style={sessionWarn ? { color: '#d97706' } : undefined}
          >
            {loginState.icon}<span>{loginState.label}</span>
          </button>
        )}

        {showLogoutBtn && (
          <button className="btn btn-g btn-sm hdr-btn hdr-logout" onClick={() => logout()} title={logoutTitle}>
            {ICON_LOGOUT}<span>Logout</span>
          </button>
        )}

        <button
          className="btn btn-g btn-sm hdr-btn"
          title={statusDot.title}
          style={isServerDown ? { outline: '1px solid #dc2626', opacity: 0.85 } : undefined}
        >
          {showStatusDot && <span style={{width:'7px', height:'7px', borderRadius:'50%', background: statusDot.bg, flexShrink:0, display:'inline-block', transition:'background .3s'}}></span>}
          {ICON_SERVER}<span>{serverLabel}</span>
        </button>

        {isServerMode && !showLogoutBtn && (
          <button className={`btn btn-g btn-sm hdr-btn hdr-login${loginState.active ? ' hdr-login--on' : ''}`} onClick={() => openLoginModal()} title="Login">
            {loginState.icon}<span>{loginState.label}</span>
          </button>
        )}
        <button className="btn btn-g btn-sm hdr-btn" onClick={() => openModal('shortcutsModal')} title="Keyboard shortcuts (?)">
          {ICON_SHORTCUTS}<span>Keys</span>
        </button>
        <button className="btn btn-g btn-sm hdr-btn" onClick={() => toggleTheme()} title="Theme">
          {isDark ? <IconSun /> : <IconMoon />}<span>{isDark ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </header>
  );
}
