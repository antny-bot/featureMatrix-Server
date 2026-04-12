/* ══════════════════════════════════════════
   Header.jsx — 앱 헤더 React 컴포넌트 (Phase 4)

   반응형 요소:
   - adminBadge: useAuth().isAdmin + isServerMode
   - adminLogoutBtn: useAuth().(isAdmin||isEditor) + isServerMode
   - hdrSearchWrap: 기존 vanilla JS syncLayout()이 계속 제어 (id 유지)

   나머지 버튼들(설정, 단축키, 테마 등)은 vanilla JS onclick 유지.
══════════════════════════════════════════ */

import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

/* ── SVG 아이콘 상수 ── */
const ICON_SERVER = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="8" rx="2"/>
    <rect x="2" y="14" width="20" height="8" rx="2"/>
    <line x1="6" y1="6" x2="6.01" y2="6"/>
    <line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
);
const ICON_SETTINGS = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const ICON_SHORTCUTS = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>
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

export default function Header() {
  const { isAdmin, isEditor, isServerMode } = useAuth();
  const { isDark } = useTheme();

  const showAdminBadge  = isAdmin  && isServerMode;
  const showLogoutBtn   = (isAdmin || isEditor) && isServerMode;
  const logoutTitle     = isAdmin ? '관리자 로그아웃' : '편집자 로그아웃';

  return (
    <header className="hdr">
      <div className="hdr-left">
        <div>
          <div className="logo-kr" id="dTitle">featureMATRIX</div>
          <div className="logo-sub" id="dSub">기능정의 툴</div>
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
        {/* hdrSearchWrap: vanilla JS syncLayout()이 display 제어 (id 유지) */}
        <div id="hdrSearchWrap" style={{display:'none', alignItems:'center', gap:'8px', flex:1, minWidth:0}}>
          <div className="search-wrap">
            <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="search-inp"
              id="searchInp"
              placeholder="검색 (기능명·Key·담당·경로)"
              onInput={(e) => window.onSearch?.(e.target.value)}
            />
            <button className="search-clear" id="searchClear" onClick={() => window.clearSearch?.()}>✕</button>
          </div>
          <span className="hdr-count-badge" id="hdrCountBadge"></span>
        </div>
      </div>

      <div className="hdr-actions">
        {/* 관리자 배지: React 제어 */}
        {showAdminBadge && (
          <span
            id="adminBadge"
            style={{fontSize:'.68rem', fontWeight:700, padding:'2px 7px', borderRadius:'5px', background:'var(--warning-bg)', color:'var(--warning)', border:'1px solid var(--warning)'}}
            title="관리자 모드"
          >🔑</span>
        )}

        {/* 로그아웃 버튼: React 제어 */}
        {showLogoutBtn && (
          <button
            id="adminLogoutBtn"
            className="btn btn-g btn-sm"
            onClick={() => window.logout?.()}
            style={{width:'27px', padding:0, fontSize:'.82rem'}}
            title={logoutTitle}
          >🔒</button>
        )}

        {/* 서버 상태 버튼: vanilla JS가 serverStatusDot / serverStatusLabel 제어 */}
        <button className="btn btn-g btn-sm hdr-btn" id="serverStatusBtn" title="서버 상태">
          <span id="serverStatusDot" style={{width:'7px', height:'7px', borderRadius:'50%', background:'#aaa', flexShrink:0, display:'none', transition:'background .3s'}}></span>
          {ICON_SERVER}
          <span id="serverStatusLabel">서버</span>
        </button>

        <span id="storageModeBadge" style={{display:'none'}}></span>

        <button className="btn btn-g btn-sm hdr-btn" onClick={() => window.openModal?.('settingsModal')} title="환경 설정 (Ctrl+,)">
          {ICON_SETTINGS}
          <span>설정</span>
        </button>
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
