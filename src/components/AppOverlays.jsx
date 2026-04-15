import ExportModal from './ExportModal.jsx';
import ImportModal from './ImportModal.jsx';
import LoginModal from './LoginModal.jsx';
import ShortcutsModal from './ShortcutsModal.jsx';
import DiffModal from './DiffModal.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import ItemModal from './ItemModal.jsx';
import OverlayMenus from './OverlayMenus.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useModals } from '../hooks/useModals.js';
import { useDBSync } from '../hooks/useDBSync.js';

function NotificationToast() {
  const toast = useAppStore(s => s.toast);
  const key = toast.type === true ? 'error' : toast.type;
  const background = {
    error: 'var(--danger)',
    warning: 'var(--warning, #D97706)',
    success: 'var(--success, #16A34A)',
  }[key] || 'var(--text)';

  return (
    <div
      className={`notif${toast.visible ? ' on' : ''}`}
      id="notif"
      style={{ background }}
    >
      {toast.message}
    </div>
  );
}

function UserNameModal() {
  const activeModal  = useAppStore(s => s.activeModal);
  const settings     = useAppStore(s => s.settings);
  const setSettings  = useAppStore(s => s.setSettings);
  const { closeModal } = useModals();
  const { saveLocal } = useDBSync();
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  const saveUserNamePopup = (skip = false) => {
    if (!skip) {
      const trimmed = name.trim();
      if (trimmed) {
        setSettings({ ...settings, userName: trimmed });
        saveLocal();
      }
    }
    closeModal('userNameModal');
  };

  if (activeModal !== 'userNameModal') return null;

  return (
    <div className="ov on" id="userNameModal">
      <div className="mbox" style={{ width: '380px' }}>
        <div className="mhd"><span className="mtitle">👋 이름을 알려주세요</span></div>
        <div className="mbody">
          <p style={{ fontSize: '.85rem', color: 'var(--text-2)', marginBottom: '14px', lineHeight: 1.7 }}>
            다른 사용자에게 누가 수정했는지 표시합니다.
            <br />
            <span style={{ color: 'var(--text-3)', fontSize: '.78rem' }}>설정 &gt; 서버 탭에서 언제든 변경할 수 있어요.</span>
          </p>
          <input
            className="inp"
            id="userNamePopupInp"
            ref={inputRef}
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="이름 입력"
            style={{ marginBottom: '6px' }}
            onKeyDown={e => { if (e.key === 'Enter') saveUserNamePopup(); }}
          />
        </div>
        <div className="mfoot">
          <button className="btn btn-g btn-sm" onClick={() => saveUserNamePopup(true)}>나중에</button>
          <button className="btn btn-p btn-sm" onClick={() => saveUserNamePopup()}>확인</button>
        </div>
      </div>
    </div>
  );
}

export default function AppOverlays() {
  return (
    <>
      <ImportModal />
      <ExportModal />
      <ShortcutsModal />
      <UserNameModal />
      <LoginModal />
      <div className="ov" id="adminAuthModal" style={{ display: 'none' }} />
      <DiffModal />
      <ErrorBoundary level="modal" label="설정">
        <SettingsPanel />
      </ErrorBoundary>
      <ErrorBoundary level="modal" label="편집 모달">
        <ItemModal />
      </ErrorBoundary>
      <OverlayMenus />
      <NotificationToast />
    </>
  );
}
