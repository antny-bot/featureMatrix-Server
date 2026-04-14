import { useEffect, useRef, useState, useMemo } from 'react';
import { STATUS_OPTS } from '../app/constants.js';
import { useAppStore } from '../store/useAppStore.js';
import { useModals } from '../hooks/useModals.js';
import { findItem, normOwner } from '../utils/itemUtils.js';

export default function OverlayMenus() {
  const store = useAppStore();
  const { openEditModal, duplicateItem, quickToggleDel, setItemStatus } = useModals();
  const contextMenu = store.contextMenu;
  const statusMenu = store.statusMenu;
  const tooltip = store.tooltip;

  // 툴팁 등은 store에서 관리되므로, 여기서는 그저 렌더링과 닫힘만 관리해주면 됨.
  // 단, hover tooltip의 타이머 로직이 완전히 스토어로 넘어가진 않았으므로 로컬에서 클리어만 해줌.

  useEffect(() => {
    if (!contextMenu && !statusMenu) return undefined;
    const closeMenus = () => {
      store.setContextMenu(null);
      store.setStatusMenu(null);
    };
    const timer = setTimeout(() => document.addEventListener('click', closeMenus, { once: true }), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', closeMenus);
    };
  }, [contextMenu, statusMenu, store]);

  const runContextAction = action => {
    store.setContextMenu(null);
    action();
  };

  const openMd = (key) => {
    window.__editModalSwitchEditTab?.('md');
    openEditModal(key);
  };

  return (
    <>
      {contextMenu && (
        <div className="ctx-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          <button className="ctx-item" onClick={() => runContextAction(() => openEditModal(contextMenu.key))}>✏️ 편집</button>
          <button className="ctx-item" onClick={() => runContextAction(() => openMd(contextMenu.key))}>📝 마크다운 열기</button>
          <button className="ctx-item" onClick={() => runContextAction(() => duplicateItem(contextMenu.key))}>⧉ 복제</button>
          <div className="ctx-sep" />
          <button className="ctx-item danger" onClick={() => runContextAction(() => quickToggleDel(contextMenu.key))}>
            {contextMenu.isDeleted ? '↩ 삭제 복원' : '✕ 삭제 처리'}
          </button>
        </div>
      )}

      {statusMenu && (
        <div className="status-quick-menu" style={{ left: statusMenu.x, top: statusMenu.y }} onClick={e => e.stopPropagation()}>
          {[['', '— 없음'], ...STATUS_OPTS.map(s => [s, s])].map(([value, label]) => (
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
          const item = findItem(store.items, tooltip.key);
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
