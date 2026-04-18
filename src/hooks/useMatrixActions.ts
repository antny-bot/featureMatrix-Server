import { useCallback } from 'react';
import type { MatrixTarget } from '../types/index.js';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from './useDBSync.js';
import { usePersistItems } from './usePersistItems.js';
import { useSelectionHandler } from './useSelectionHandler.js';
import { pushChangeLog } from '../utils/itemUtils.js';

export function useMatrixActions() {
  const setMxSelectionKeys = useAppStore(s => s.setMxSelectionKeys);
  const setIsDragging      = useAppStore(s => s.setIsDragging);
  const notify             = useAppStore(s => s.notify);
  const { lockItem, unlockItem, logActivity } = useDBSync();
  const { persistItems } = usePersistItems();
  const { handleCardClick, clearSelection } = useSelectionHandler(
    () => useAppStore.getState().mxSelectionKeys,
    setMxSelectionKeys
  );

  const moveItems = useCallback(async (keys: Set<string>, target: MatrixTarget) => {
    const { g, sg, c, sc } = target;
    const { pushUndo, items: currentItems, setItems } = useAppStore.getState();
    pushUndo();

    const items = [...currentItems];
    const movedKeys = Array.from(keys);

    movedKeys.forEach(k => {
      const idx = items.findIndex(it => it.key === k);
      if (idx === -1) return;

      const item = { ...items[idx] };
      const from = `${item.group || '(미분류)'}/${item.category || '(미분류)'}`;

      item.group       = g === '(미분류)' ? '' : g;
      item.subGroup    = sg;
      item.category    = c === '(미분류)' ? '' : c;
      item.subCategory = sc;

      const to = `${item.group || '(미분류)'}/${item.category || '(미분류)'}`;
      items[idx] = item;
      pushChangeLog('이동', item.key, item.name, { status: item.status, owner: item.owner });
      logActivity('이동', `${item.key} ${item.name}: ${from} → ${to}`);
    });

    setItems(items);
    setMxSelectionKeys([]);
    setIsDragging(false);

    await persistItems(movedKeys);

    notify(movedKeys.length > 1 ? `${movedKeys.length}개 이동 완료.` : '이동 완료.', 'success');
  }, [setMxSelectionKeys, setIsDragging, notify, persistItems, logActivity]);

  return {
    handleCardClick,
    clearSelection,
    moveItems,
    lockKeys:   (keys: string[]) => keys.forEach(k => lockItem(k)),
    unlockKeys: (keys: string[]) => keys.forEach(k => unlockItem(k)),
  };
}
