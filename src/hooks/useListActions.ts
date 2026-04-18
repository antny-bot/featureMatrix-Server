import { useCallback } from 'react';
import type { Item } from '../types/index.js';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from './useDBSync.js';
import { usePersistItems } from './usePersistItems.js';

export function useListActions() {
  const setBulkSelectionKeys = useAppStore(s => s.setBulkSelectionKeys);
  const { logActivity } = useDBSync();
  const { persistItems } = usePersistItems();

  const bulkToggle = useCallback((key: string) => {
    const prev = new Set(useAppStore.getState().bulkSelectionKeys);
    if (prev.has(key)) prev.delete(key);
    else prev.add(key);
    setBulkSelectionKeys([...prev]);
  }, [setBulkSelectionKeys]);

  const bulkToggleAll = useCallback((checked: boolean, filteredItems: Item[]) => {
    setBulkSelectionKeys(checked ? filteredItems.map(it => it.key) : []);
  }, [setBulkSelectionKeys]);

  const bulkClearSelection = useCallback(() => {
    setBulkSelectionKeys([]);
  }, [setBulkSelectionKeys]);

  const toggleSort = useCallback((key: string) => {
    const s = { ...useAppStore.getState().sort };
    s.dir = s.key === key ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc';
    s.key = key;
    useAppStore.setState({ sort: s });
  }, []);

  const setBulkPriority = useCallback(async (priority: string) => {
    const { bulkSelectionKeys, pushUndo, items, setItems } = useAppStore.getState();
    if (!bulkSelectionKeys.length) return;

    pushUndo();
    setItems(items.map(it =>
      bulkSelectionKeys.includes(it.key) ? { ...it, priority } : it
    ));

    await logActivity('일괄변경', `우선순위→${priority} (${bulkSelectionKeys.join(', ')})`);
    await persistItems();
  }, [logActivity, persistItems]);

  const setBulkOwner = useCallback(async (owner: string) => {
    const nextOwner = String(owner || '').trim();
    const { bulkSelectionKeys, pushUndo, items, setItems } = useAppStore.getState();
    if (!nextOwner || !bulkSelectionKeys.length) return;

    pushUndo();
    setItems(items.map(it =>
      bulkSelectionKeys.includes(it.key) ? { ...it, owner: nextOwner } : it
    ));

    await logActivity('일괄변경', `담당→${nextOwner} (${bulkSelectionKeys.join(', ')})`);
    await persistItems();
  }, [logActivity, persistItems]);

  return {
    bulkToggle,
    bulkToggleAll,
    bulkClearSelection,
    toggleSort,
    setBulkPriority,
    setBulkOwner,
  };
}
