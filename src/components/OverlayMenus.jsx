import { useEffect, useRef, useState } from 'react';
import { STATUS_OPTS } from '../app/constants.js';
import { openEditModal, openEditOrMd, duplicateItem, quickToggleDel, setItemStatus } from '../app/modal.js';
import { findItem, normOwner, S } from '../app/state.js';

export default function OverlayMenus() {
  const [contextMenu, setContextMenu] = useState(null);
  const [statusMenu, setStatusMenu] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const tooltipTimer = useRef(null);

  const clearTooltip = () => {
    if (tooltipTimer.current) {
      clearTimeout(tooltipTimer.current);
      tooltipTimer.current = null;
    }
    setTooltip(null);
  };

  useEffect(() => {
    window.__reactOpenCtxMenu = (event, key) => {
      event.preventDefault();
      event.stopPropagation();
      const item = findItem(key);
      if (!item) return;

      setStatusMenu(null);
      setContextMenu({
        key,
        isDeleted: item.isDelete === 'Y',
        x: Math.min(event.clientX, window.innerWidth - 160),
        y: Math.min(event.clientY, window.innerHeight - 180),
      });
    };
    window.__reactCloseCtxMenu = () => setContextMenu(null);

    window.__reactOpenStatusMenu = (event, key) => {
      event.stopPropagation();
      const item = findItem(key);
      if (!item) return;

      setContextMenu(null);
      setStatusMenu({
        key,
        currentStatus: item.status || '',
        x: Math.min(event.clientX, window.innerWidth - 120),
        y: Math.min(event.clientY + 4, window.innerHeight - 160),
      });
    };
    window.__reactCloseStatusMenu = () => setStatusMenu(null);

    window.__reactStartTT = (event, key) => {
      if (S.isDragging) return;
      clearTooltip();

      const item = findItem(key);
      if (!item || (!item.desc && !item.mdContent)) return;
      const x = Math.min(event.clientX + 14, window.innerWidth - 300);
      const y = Math.min(event.clientY + 14, window.innerHeight - 150);

      tooltipTimer.current = setTimeout(() => {
        if (S.isDragging) return;
        setTooltip({ item, x, y });
      }, 900);
    };
    window.__reactClearTT = clearTooltip;

    return () => {
      delete window.__reactOpenCtxMenu;
      delete window.__reactCloseCtxMenu;
      delete window.__reactOpenStatusMenu;
      delete window.__reactCloseStatusMenu;
      delete window.__reactStartTT;
      delete window.__reactClearTT;
      clearTooltip();
    };
  }, []);

  useEffect(() => {
    if (!contextMenu && !statusMenu) return undefined;
    const closeMenus = () => {
      setContextMenu(null);
      setStatusMenu(null);
    };
    const timer = setTimeout(() => document.addEventListener('click', closeMenus, { once: true }), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', closeMenus);
    };
  }, [contextMenu, statusMenu]);

  const runContextAction = action => {
    setContextMenu(null);
    action();
  };

  return (
    <>
      {contextMenu && (
        <div className="ctx-menu" style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }} onClick={event => event.stopPropagation()}>
          <button className="ctx-item" onClick={() => runContextAction(() => openEditModal(contextMenu.key))}>✏️ 편집</button>
          <button className="ctx-item" onClick={() => runContextAction(() => openEditOrMd(contextMenu.key))}>📝 마크다운 열기</button>
          <button className="ctx-item" onClick={() => runContextAction(() => duplicateItem(contextMenu.key))}>⧉ 복제</button>
          <div className="ctx-sep" />
          <button className="ctx-item danger" onClick={() => runContextAction(() => quickToggleDel(contextMenu.key))}>
            {contextMenu.isDeleted ? '↩ 삭제 복원' : '✕ 삭제 처리'}
          </button>
        </div>
      )}

      {statusMenu && (
        <div className="status-quick-menu" style={{ left: `${statusMenu.x}px`, top: `${statusMenu.y}px` }} onClick={event => event.stopPropagation()}>
          {[['', '— 없음'], ...STATUS_OPTS.map(status => [status, status])].map(([value, label]) => (
            <button
              className={`status-quick-item${statusMenu.currentStatus === value ? ' on' : ''}`}
              key={value || 'none'}
              onClick={() => {
                setStatusMenu(null);
                setItemStatus(statusMenu.key, value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div
        className={`ftt${tooltip ? ' on' : ''}`}
        id="ftt"
        style={tooltip ? { left: `${tooltip.x}px`, top: `${tooltip.y}px` } : undefined}
      >
        {tooltip && (
          <>
            <div className="tt-key">{tooltip.item.key}</div>
            <div className="tt-name">{tooltip.item.name}</div>
            {tooltip.item.desc && <div style={{ whiteSpace: 'pre-line' }}>{tooltip.item.desc}</div>}
            {tooltip.item.owner && (
              <div style={{ marginTop: '4px', fontSize: '.69rem', color: 'var(--text-3)' }}>
                담당: {normOwner(tooltip.item.owner)}
              </div>
            )}
            {tooltip.item.mdContent && (
              <div style={{ marginTop: '4px', fontSize: '.68rem', color: 'var(--accent)' }}>📄 MD — 클릭하면 열림</div>
            )}
          </>
        )}
      </div>
    </>
  );
}
