import { useRef } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { submitLogin, closeLoginModal } from '../contexts/AuthContext.jsx';

export default function LoginModal() {
  const store = useAppStore();
  const { visible, role, name, password, error } = store.loginModal;
  const passwordRef = useRef(null);

  if (!visible) return null;

  const updateField = (field, value) => {
    useAppStore.setState({
      loginModal: { ...store.loginModal, [field]: value }
    });
  };

  return (
    <div className="ov on" id="loginModal">
      <div className="mbox" style={{ width: '360px' }}>
        <div className="mhd">
          <span className="mtitle">🔐 로그인</span>
          <button className="mclose" onClick={() => closeLoginModal()}>✕</button>
        </div>
        <div className="mbody">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>역할</label>
              <select
                className="inp"
                id="loginRoleSelect"
                value={role}
                onChange={event => updateField('role', event.target.value)}
                style={{ height: '38px', fontSize: '.82rem', paddingTop: 0, paddingBottom: 0 }}
              >
                <option value="editor">편집자</option>
                <option value="admin">관리자</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>이름</label>
              <input
                className="inp"
                id="loginNameInp"
                value={name || ''}
                onChange={event => updateField('name', event.target.value)}
                placeholder="닉네임"
                style={{ height: '32px', fontSize: '.82rem' }}
                onKeyDown={event => { if (event.key === 'Enter') passwordRef.current?.focus(); }}
              />
            </div>
            <div>
              <label style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>비밀번호</label>
              <input
                className="inp"
                id="loginPwInp"
                ref={passwordRef}
                type="password"
                value={password || ''}
                onChange={event => updateField('password', event.target.value)}
                placeholder="비밀번호"
                style={{ height: '32px', fontSize: '.82rem' }}
                onKeyDown={event => { if (event.key === 'Enter') submitLogin(); }}
              />
            </div>
            <div id="loginErr" style={{ color: 'var(--danger)', fontSize: '.78rem', minHeight: '16px' }}>{error}</div>
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-g btn-sm" onClick={() => closeLoginModal()}>취소</button>
          <button className="btn btn-p btn-sm" onClick={() => submitLogin()}>로그인</button>
        </div>
      </div>
    </div>
  );
}
