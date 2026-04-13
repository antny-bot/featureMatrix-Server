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
  return (
    <nav className="nav-side" id="navSide">
      <NavButton
        id="navD"
        title="대시보드"
        label="대시보드"
        icon={<DashboardIcon />}
        onClick={() => window.switchView?.('dashboard')}
      />
      <NavButton
        id="navM"
        title="매트릭스"
        label="매트릭스"
        icon={<MatrixIcon />}
        active
        onClick={() => window.switchView?.('matrix')}
      />
      <NavButton
        id="navB"
        title="보드"
        label="보드"
        icon={<BoardIcon />}
        onClick={() => window.switchView?.('board')}
      />
      <NavButton
        id="navL"
        title="리스트"
        label="리스트"
        icon={<ListIcon />}
        onClick={() => window.switchView?.('list')}
      />
      <div className="nav-spacer" />
      <NavButton
        id="navLogin"
        title="로그인"
        label="로그인"
        icon={<LoginIcon />}
        className="nav-login"
        style={{ display: 'none' }}
        onClick={() => window.openLoginModal?.()}
      />
    </nav>
  );
}
