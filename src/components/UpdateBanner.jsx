export default function UpdateBanner() {
  return (
    <div
      id="updateBanner"
      style={{
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '7px 16px',
        background: 'var(--warning-bg)',
        borderBottom: '1px solid var(--warning)',
        fontSize: '.8rem',
        color: 'var(--warning)',
      }}
    >
      <span id="updateBannerMsg">다른 사용자가 데이터를 변경했습니다.</span>
      <button
        className="btn btn-s btn-sm"
        onClick={() => window.reloadFromServer?.()}
        style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
      >
        지금 새로고침
      </button>
      <button
        className="btn btn-g btn-sm"
        onClick={() => document.getElementById('updateBanner')?.classList.remove('on')}
      >
        나중에
      </button>
    </div>
  );
}
