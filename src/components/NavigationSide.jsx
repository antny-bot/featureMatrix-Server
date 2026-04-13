import { useAuth } from '../contexts/AuthContext.jsx';
import { useAppStore } from '../store/useAppStore.js';

function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function MatrixIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="9" x2="9" y2="21" />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="4" height="18" rx="1" />
      <rect x="10" y="3" width="4" height="18" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function EditorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function NavButton({ id, title, label, icon, active = false, onClick, className = '', style }) {
  return (
    <button
      className={`nav-item${active ? ' on' : ''}${className ? ` ${className}` : ''}`}
      id={id}
      onClick={onClick}
      title={title}
      style={style}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function NavigationSide() {
  const { isAdmin, isEditor, isServerMode } = useAuth();
  const view = useAppStore(s => s.view);
  const loginState = isAdmin
    ? { label: '관리자', icon: <AdminIcon />, active: true }
    : isEditor
      ? { label: '편집자', icon: <EditorIcon />, active: true }
      : { label: '로그인', icon: <LoginIcon />, active: false };

  return (
    <nav className="nav-side" id="navSide">
      <NavButton
        id="navD"
        title="대시보드"
        label="대시보드"
        icon={<DashboardIcon />}
        active={view === 'dashboard'}
        onClick={() => window.switchView?.('dashboard')}
      />
      <NavButton
        id="navM"
        title="매트릭스"
        label="매트릭스"
        icon={<MatrixIcon />}
        active={view === 'matrix'}
        onClick={() => window.switchView?.('matrix')}
      />
      <NavButton
        id="navB"
        title="보드"
        label="보드"
        icon={<BoardIcon />}
        active={view === 'board'}
        onClick={() => window.switchView?.('board')}
      />
      <NavButton
        id="navL"
        title="리스트"
        label="리스트"
        icon={<ListIcon />}
        active={view === 'list'}
        onClick={() => window.switchView?.('list')}
      />
      <div className="nav-spacer" />
      <NavButton
        id="navLogin"
        title="로그인"
        label={loginState.label}
        icon={loginState.icon}
        className={`nav-login${loginState.active ? ' nav-login--on' : ''}`}
        style={{ display: isServerMode ? '' : 'none' }}
        onClick={() => window.openLoginModal?.()}
      />
    </nav>
  );
}
