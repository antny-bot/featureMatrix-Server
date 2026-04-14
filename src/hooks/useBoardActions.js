import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from './useDBSync.js';
import { pushChangeLog } from '../utils/itemUtils.js';
import { isEditor } from '../contexts/AuthContext.jsx';

export function useBoardActions() {
  const store = useAppStore();
  const { saveToServer, saveLocal, lockItem, unlockItem, logActivity, broadcastSharedData } = useDBSync();

  const handleCardClick = useCallback((e, key) => {
    const prev = new Set(store.boardSelectionKeys);
    if (e.shiftKey) {
      if (prev.has(key)) prev.delete(key);
      else prev.add(key);
    } else {
      prev.clear();
      prev.add(key);
    }
    store.setBoardSelectionKeys([...prev]);
  }, [store]);

  const clearSelection = useCallback(() => {
    store.setBoardSelectionKeys([]);
  }, [store]);

  const moveItems = useCallback(async (keys, toStatus) => {
    if (!isEditor()) {
      store.notify('편집 권한이 없습니다.', 'error');
      return;
    }
    
    store.pushUndo();
    const items = [...store.items];
    const movedItems = [];
    const keysArray = Array.from(keys);

    keysArray.forEach(k => {
      const idx = items.findIndex(it => it.key === k);
      if (idx === -1) return;
      
      const item = { ...items[idx] };
      const fromStatus = item.status || '';
      if (fromStatus !== toStatus) {
        item.status = toStatus;
        item.updatedAt = Date.now();
        pushChangeLog('상태변경', item.key, item.name, { status: toStatus, owner: item.owner });
        
        const labels = store.settings.statusLabels || {};
        const fromLbl = fromStatus ? (labels[fromStatus] || fromStatus) : '상태없음';
        const toLbl = toStatus ? (labels[toStatus] || toStatus) : '상태없음';
        logActivity('이동', `${item.key} ${item.name}: ${fromLbl} → ${toLbl}`);
        
        items[idx] = item;
        movedItems.push(item);
      }
    });

    store.setItems(items);
    store.setBoardSelectionKeys([]);
    store.setIsDragging(false);

    if (store.settings.storageMode === 'server') {
      const ok = await saveToServer();
      if (ok) {
        broadcastSharedData();
        movedItems.forEach(item => {
          unlockItem(item.key);
        });
      }
    } else {
      saveLocal();
    }
    
    store.notify(movedItems.length > 1 ? `${movedItems.length}개 이동 완료.` : '이동 완료.', 'success');
  }, [store, logActivity, saveToServer, saveLocal, unlockItem, broadcastSharedData]);

  return {
    handleCardClick,
    clearSelection,
    moveItems,
    lockKeys: (keys) => keys.forEach(k => lockItem(k)),
    unlockKeys: (keys) => keys.forEach(k => unlockItem(k)),
  };
}
