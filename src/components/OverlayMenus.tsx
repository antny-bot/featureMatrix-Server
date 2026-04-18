import { useEffect } from 'react';
import { STATUS_OPTS } from '../app/constants.js';
import { useAppStore } from '../store/useAppStore.js';
import { useModals } from '../hooks/useModals.js';
import { findItem, normOwner } from '../utils/itemUtils.js';

export default function OverlayMenus() {
  const contextMenu    = useAppStore(s => s.contextMenu);
  const statusMenu     = useAppStore(s => s.statusMenu);
  const tooltip        = useAppStore(s => s.tooltip);
  const items          = useAppStore(s => s.items);
  const statusLabels   = useAppStore(s => s.settings.statusLabels);
  const setContextMenu = useAppStore(s => s.setContextMenu);
  const setStatusMenu  = useAppStore(s => s.setStatusMenu);
  const { openEditModal, openMdModal, duplicateItem, quickToggleDel, setItemStatus } = useModals();

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
  }, [contextMenu, statusMenu, setContextMenu, setStatusMenu]);

  const runContextAction = (action: () => void) => {
    setContextMenu(null);
    action();
  };

  return (
    <>
      {contextMenu && (
        <div className="ctx-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <button className="ctx-item" onClick={() => runContextAction(() => openEditModal(contextMenu.key))}>✏️ 편집</button>
          <button className="ctx-item" onClick={() => runContextAction(() => openMdModal(contextMenu.key))}>📝 마크다운 열기</button>
          <button className="ctx-item" onClick={() => runContextAction(() => duplicateItem(contextMenu.key))}>⧉ 복제</button>
          <div className="ctx-sep" />
          <button className="ctx-item danger" onClick={() => runContextAction(() => quickToggleDel(contextMenu.key))}>
            {contextMenu.isDeleted ? '↩ 삭제 복원' : '✕ 삭제 처리'}
          </button>
        </div>
      )}

      {statusMenu && (
        <div className="status-quick-menu" style={{ left: statusMenu.x, top: statusMenu.y }} onClick={e => e.stopPropagation()}>
          {([['', '— 없음'], ...STATUS_OPTS.map(s => [s, statusLabels?.[s] || s])] as [string, string][]).map(([value, label]) => (
            <button
              className={`status-quick-item${statusMenu.currentStatus === value ? ' on' : ''}`}
              key={value || 'none'}
              onClick={() => { setStatusMenu(null); setItemStatus(statusMenu.key, value); }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={`ftt${tooltip ? ' on' : ''}`} style={tooltip ? { left: tooltip.x, top: tooltip.y } : undefined}>
        {tooltip && (() => {
          const item = findItem(tooltip.key, items);
          if (!item) return null;
          return (
            <>
              <div className="tt-key">{item.key}</div>
              <div className="tt-name">{item.name}</div>
              {item.desc && <div style={{ whiteSpace: 'pre-line' }}>{item.desc}</div>}
              {item.owner && (
                <div style={{ marginTop: '4px', fontSize: '.69rem', color: 'var(--text-3)' }}>
                  담당: {normOwner(item.owner)}
                </div>
              )}
              {item.mdContent && (
                <div style={{ marginTop: '4px', fontSize: '.68rem', color: 'var(--accent)' }}>📄 MD — 클릭하면 열림</div>
              )}
            </>
          );
        })()}
      </div>
    </>
  );
}
