import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from './useDBSync.js';

export function useListActions() {
  const store = useAppStore();
  const { saveLocal, saveToServer, logActivity } = useDBSync();

  const handleSave = useCallback(async () => {
    if (store.settings.storageMode === 'server') await saveToServer();
    else saveLocal();
  }, [store.settings.storageMode, saveLocal, saveToServer]);

  const bulkToggle = useCallback((key) => {
    const prev = new Set(store.bulkSelectionKeys);
    if (prev.has(key)) prev.delete(key);
    else prev.add(key);
    store.setBulkSelectionKeys([...prev]);
  }, [store]);

  const bulkToggleAll = useCallback((checked, filteredItems) => {
    if (checked) {
      store.setBulkSelectionKeys(filteredItems.map(it => it.key));
    } else {
      store.setBulkSelectionKeys([]);
    }
  }, [store]);

  const bulkClearSelection = useCallback(() => {
    store.setBulkSelectionKeys([]);
  }, [store]);

  const toggleSort = useCallback((key) => {
    const s = { ...store.sort };
    if (s.key === key) {
      s.dir = s.dir === 'asc' ? 'desc' : 'asc';
    } else {
      s.key = key;
      s.dir = 'asc';
    }
    store.setState({ sort: s });
  }, [store]);

  const setBulkPriority = useCallback(async (priority) => {
    const keys = store.bulkSelectionKeys;
    if (!keys.length) return;

    store.pushUndo();
    const nextItems = store.items.map(it => {
      if (keys.includes(it.key)) return { ...it, priority };
      return it;
    });
    store.setItems(nextItems);
    
    await logActivity('일괄변경', `우선순위→${priority} (${keys.join(', ')})`);
    await handleSave();
  }, [store, logActivity, handleSave]);

  const setBulkOwner = useCallback(async (owner) => {
    const nextOwner = String(owner || '').trim();
    const keys = store.bulkSelectionKeys;
    if (!nextOwner || !keys.length) return;

    store.pushUndo();
    const nextItems = store.items.map(it => {
      if (keys.includes(it.key)) return { ...it, owner: nextOwner };
      return it;
    });
    store.setItems(nextItems);

    await logActivity('일괄변경', `담당→${nextOwner} (${keys.join(', ')})`);
    await handleSave();
  }, [store, logActivity, handleSave]);

  return {
    bulkToggle,
    bulkToggleAll,
    bulkClearSelection,
    toggleSort,
    setBulkPriority,
    setBulkOwner
  };
}
