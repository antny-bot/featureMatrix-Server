import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from './useDBSync.js';

/**
 * 공통 저장 훅 — storageMode에 따라 서버/로컬 저장 + 브로드캐스트 처리.
 * useMatrixActions, useBoardActions, useListActions, useModals의 중복 저장 패턴 추출.
 */
export function usePersistItems() {
  const { saveToServer, saveLocal, unlockItem, broadcastSharedData } = useDBSync();

  /**
   * @param {string[]} keysToUnlock - 저장 성공 후 락 해제할 key 목록
   * @returns {Promise<boolean>} 저장 성공 여부
   */
  const persistItems = useCallback(async (keysToUnlock = []) => {
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
