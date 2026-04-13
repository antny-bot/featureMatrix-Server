import ExportModal from './ExportModal.jsx';
import ImportModal from './ImportModal.jsx';
import LoginModal from './LoginModal.jsx';
import ShortcutsModal from './ShortcutsModal.jsx';
import DiffModal from './DiffModal.jsx';
import OverlayMenus from './OverlayMenus.jsx';
import { useEffect, useRef, useState } from 'react';

function NotificationToast() {
  const [toast, setToast] = useState({ visible: false, message: '', type: false });
  const timerRef = useRef(null);

  useEffect(() => {
    const showToast = (message, type = false) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ visible: true, message, type });
      timerRef.current = setTimeout(() => {
        setToast(current => ({ ...current, visible: false }));
        timerRef.current = null;
      }, 2400);
    };
    window.__sobukNotify = showToast;
    if (window.__pendingNotify) {
      showToast(window.__pendingNotify.msg, window.__pendingNotify.type);
      delete window.__pendingNotify;
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      delete window.__sobukNotify;
    };
  }, []);

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
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    window.__reactOpenUserNameModal = () => {
      setName('');
      window.openModal?.('userNameModal');
      setTimeout(() => inputRef.current?.focus(), 120);
    };
    window.__reactGetUserNamePopup = () => name.trim();
    return () => {
      delete window.__reactOpenUserNameModal;
      delete window.__reactGetUserNamePopup;
    };
  }, [name]);

  return (
    <div className="ov" id="userNameModal">
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
            onKeyDown={e => { if (e.key === 'Enter') window.saveUserNamePopup?.(); }}
          />
        </div>
        <div className="mfoot">
          <button className="btn btn-g btn-sm" onClick={() => window.saveUserNamePopup?.(true)}>나중에</button>
          <button className="btn btn-p btn-sm" onClick={() => window.saveUserNamePopup?.()}>확인</button>
        </div>
      </div>
    </div>
  );
}

export default function AppOverlays() {
  useEffect(() => {
    window.__applyOverlayBlur = enabled => {
      const overlays = document.querySelectorAll('.ov');
      overlays.forEach(el => {
        if (enabled) el.classList.add('blur-bg');
        else el.classList.remove('blur-bg');
      });
    };
    return () => { delete window.__applyOverlayBlur; };
  }, []);

  return (
    <>
      <ImportModal />
      <ExportModal />
      <ShortcutsModal />
      <UserNameModal />
      <LoginModal />
      <div className="ov" id="adminAuthModal" style={{ display: 'none' }} />
      <DiffModal />
      <OverlayMenus />
      <NotificationToast />
    </>
  );
}
