import ExportModal from './ExportModal.jsx';
import ImportModal from './ImportModal.jsx';
import LoginModal from './LoginModal.jsx';
import ShortcutsModal from './ShortcutsModal.jsx';

function UserNameModal() {
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

function DiffModal() {
  return (
    <div className="ov" id="diffModal">
      <div className="mbox" style={{ width: '640px' }}>
        <div className="mhd">
          <span className="mtitle">변경 이력 (마지막 Undo 기준)</span>
          <button className="mclose" onClick={() => window.closeModal?.('diffModal')}>✕</button>
        </div>
        <div className="mbody" id="diffBody" style={{ fontSize: '.82rem' }} />
        <div className="mfoot">
          <button className="btn btn-s" onClick={() => window.closeModal?.('diffModal')}>닫기</button>
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
      <div className="ftt" id="ftt" />
      <div className="notif" id="notif" />
      <div id="boardActionBar" className="board-action-bar" />
    </>
  );
}
