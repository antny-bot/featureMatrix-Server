import { useEffect, useState } from 'react';

export default function UpdateBanner() {
  const [banner, setBanner] = useState({ visible: false, message: '다른 사용자가 데이터를 변경했습니다.' });

  useEffect(() => {
    window.__showUpdateBanner = message => setBanner({ visible: true, message: message || '다른 사용자가 데이터를 변경했습니다.' });
    window.__hideUpdateBanner = () => setBanner(current => ({ ...current, visible: false }));
    return () => {
      delete window.__showUpdateBanner;
      delete window.__hideUpdateBanner;
    };
  }, []);

  return (
    <div
      id="updateBanner"
      className={banner.visible ? 'on' : ''}
      style={{
        display: banner.visible ? 'flex' : 'none',
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
        className="btn btn-s btn-sm"
        onClick={() => window.reloadFromServer?.()}
        style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
      >
        지금 새로고침
      </button>
      <button
        className="btn btn-g btn-sm"
        onClick={() => window.__hideUpdateBanner?.()}
      >
        나중에
      </button>
    </div>
  );
}
