import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from './useDBSync.js';
import { findItem, pushChangeLog } from '../utils/itemUtils.js';

export function useMatrixActions() {
  const store = useAppStore();
  const { saveToServer, saveLocal, lockItem, unlockItem, logActivity, broadcastSharedData } = useDBSync();

  const handleCardClick = useCallback((e, key) => {
    const prev = new Set(store.mxSelectionKeys);
    if (e.shiftKey) {
      if (prev.has(key)) prev.delete(key);
      else prev.add(key);
    } else {
      prev.clear();
      prev.add(key);
    }
    store.setMxSelectionKeys([...prev]);
  }, [store]);

  const clearSelection = useCallback(() => {
    store.setMxSelectionKeys([]);
  }, [store]);

  const moveItems = useCallback(async (keys, target) => {
    const { g, sg, c, sc } = target;
    store.pushUndo();

    const items = [...store.items];
    const movedKeys = Array.from(keys);
    
    movedKeys.forEach(k => {
      const idx = items.findIndex(it => it.key === k);
      if (idx === -1) return;
      
      const item = { ...items[idx] };
      const from = `${item.group || '(미분류)'}/${item.category || '(미분류)'}`;
      
      item.group = g === '(미분류)' ? '' : g;
      item.subGroup = sg;
      item.category = c === '(미분류)' ? '' : c;
      item.subCategory = sc;
      
      const to = `${item.group || '(미분류)'}/${item.category || '(미분류)'}`;
      items[idx] = item;
      pushChangeLog('이동', item.key, item.name, { status: item.status, owner: item.owner });
      
      logActivity('이동', `${item.key} ${item.name}: ${from} → ${to}`);
    });

    store.setItems(items);
    store.setMxSelectionKeys([]);
    store.setIsDragging(false);
    
    // 서버 환경이면 저장 및 브로드캐스트
    if (store.settings.storageMode === 'server') {
      const ok = await saveToServer();
      if (ok) {
        movedKeys.forEach(k => unlockItem(k));
        broadcastSharedData();
      }
    } else {
      saveLocal();
    }
    
    window.__sobukNotify?.(movedKeys.length > 1 ? `${movedKeys.length}개 이동 완료.` : '이동 완료.', 'success');
  }, [store, logActivity, saveToServer, saveLocal, unlockItem, broadcastSharedData]);

  return {
    handleCardClick,
    clearSelection,
    moveItems,
    lockKeys: (keys) => keys.forEach(k => lockItem(k)),
    unlockKeys: (keys) => keys.forEach(k => unlockItem(k)),
  };
}
