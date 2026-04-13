export default function LoginModal() {
  return (
    <div className="ov" id="loginModal">
      <div className="mbox" style={{ width: '360px' }}>
        <div className="mhd">
          <span className="mtitle">🔐 로그인</span>
          <button className="mclose" onClick={() => window.closeLoginModal?.()}>✕</button>
        </div>
        <div className="mbody">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>역할</label>
              <select className="inp" id="loginRoleSelect" style={{ height: '38px', fontSize: '.82rem', paddingTop: 0, paddingBottom: 0 }}>
                <option value="editor">편집자</option>
                <option value="admin">관리자</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>이름</label>
              <input
                className="inp"
                id="loginNameInp"
                placeholder="닉네임"
                style={{ height: '32px', fontSize: '.82rem' }}
                onKeyDown={e => { if (e.key === 'Enter') document.getElementById('loginPwInp')?.focus(); }}
              />
            </div>
            <div>
              <label style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>비밀번호</label>
              <input
                className="inp"
                id="loginPwInp"
                type="password"
                placeholder="비밀번호"
                style={{ height: '32px', fontSize: '.82rem' }}
                onKeyDown={e => { if (e.key === 'Enter') window.submitLogin?.(); }}
              />
            </div>
            <div id="loginErr" style={{ color: 'var(--danger)', fontSize: '.78rem', minHeight: '16px' }} />
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-g btn-sm" onClick={() => window.closeLoginModal?.()}>취소</button>
          <button className="btn btn-p btn-sm" onClick={() => window.submitLogin?.()}>로그인</button>
        </div>
      </div>
    </div>
  );
}
