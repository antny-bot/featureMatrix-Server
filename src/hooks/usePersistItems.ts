import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from './useDBSync.js';

export function usePersistItems() {
  const { saveToServer, saveLocal, unlockItem, broadcastSharedData } = useDBSync();

  const persistItems = useCallback(async (keysToUnlock: string[] = []): Promise<boolean> => {
    const { settings } = useAppStore.getState();
    if (settings.storageMode === 'server') {
      const ok = await saveToServer();
      if (ok) {
        keysToUnlock.forEach(k => unlockItem(k));
        broadcastSharedData();
      }
      return ok ?? false;
    } else {
      saveLocal();
      return true;
    }
  }, [saveToServer, saveLocal, unlockItem, broadcastSharedData]);

  return { persistItems };
}
