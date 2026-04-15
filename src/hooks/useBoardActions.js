import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from './useDBSync.js';
import { usePersistItems } from './usePersistItems.js';
import { useSelectionHandler } from './useSelectionHandler.js';
import { pushChangeLog } from '../utils/itemUtils.js';
import { isEditor } from '../contexts/AuthContext.jsx';

export function useBoardActions() {
  const setBoardSelectionKeys = useAppStore(s => s.setBoardSelectionKeys);
  const setIsDragging         = useAppStore(s => s.setIsDragging);
  const notify                = useAppStore(s => s.notify);
  const { lockItem, unlockItem, logActivity } = useDBSync();
  const { persistItems } = usePersistItems();
  const { handleCardClick, clearSelection } = useSelectionHandler(
    () => useAppStore.getState().boardSelectionKeys,
    setBoardSelectionKeys
  );

  const moveItems = useCallback(async (keys, toStatus) => {
    if (!isEditor()) {
      notify('편집 권한이 없습니다.', 'error');
      return;
    }

    const { pushUndo, items: currentItems, setItems, settings } = useAppStore.getState();
    pushUndo();
    const items = [...currentItems];
    const movedItems = [];
    const keysArray = Array.from(keys);

    keysArray.forEach(k => {
      const idx = items.findIndex(it => it.key === k);
      if (idx === -1) return;

      const item = { ...items[idx] };
      const fromStatus = item.status || '';
      if (fromStatus !== toStatus) {
        item.status    = toStatus;
        item.updatedAt = Date.now();
        pushChangeLog('상태변경', item.key, item.name, { status: toStatus, owner: item.owner });

        const labels  = settings.statusLabels || {};
        const fromLbl = fromStatus ? (labels[fromStatus] || fromStatus) : '상태없음';
        const toLbl   = toStatus   ? (labels[toStatus]   || toStatus)   : '상태없음';
        logActivity('이동', `${item.key} ${item.name}: ${fromLbl} → ${toLbl}`);

        items[idx] = item;
        movedItems.push(item);
      }
    });

    setItems(items);
    setBoardSelectionKeys([]);
    setIsDragging(false);

    await persistItems(movedItems.map(item => item.key));

    notify(movedItems.length > 1 ? `${movedItems.length}개 이동 완료.` : '이동 완료.', 'success');
  }, [setBoardSelectionKeys, setIsDragging, notify, persistItems, logActivity]);

  return {
    handleCardClick,
    clearSelection,
    moveItems,
    lockKeys:   (keys) => keys.forEach(k => lockItem(k)),
    unlockKeys: (keys) => keys.forEach(k => unlockItem(k)),
  };
}
