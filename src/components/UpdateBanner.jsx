import { useAppStore } from '../store/useAppStore.js';

export default function UpdateBanner() {
  const store = useAppStore();
  const banner = store.banner;

  if (!banner.visible) return null;

  return (
    <div
      id="updateBanner"
      className="on"
      style={{
        display: 'flex',
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
      <span id="updateBannerMsg">{banner.message}</span>
      <button
        id="reloadBtn"
        className="btn btn-s btn-sm"
        onClick={() => window.location.reload()}
        style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
      >
        지금 새로고침
      </button>
      <button
        className="btn btn-g btn-sm"
        onClick={() => store.setBanner(false)}
      >
        나중에
      </button>
    </div>
  );
}
