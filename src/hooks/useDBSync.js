import { useEffect, useRef, useCallback } from 'react';
import { useAppStore, getStore } from '../store/useAppStore.js';
import { apiFetch } from '../utils/api.js';
import { migrateItems } from '../utils/itemUtils.js';
import { ADMIN_TOKEN_KEY, EDITOR_TOKEN_KEY, SK, DATA_VERSION } from '../app/constants.js';
import { initSocket, disconnectSocket, isSocketConnected, emitDataSave, emitLock, emitUnlock, releaseLocalLock } from '../app/socket.js';

/* 서버에 저장할 settings 키 목록 */
const SHARED_SETTINGS = [
  'title','subtitle','groupOrder','catOrder','dbHeroName','dbSections',
  'priorityStyles','customColors','matrixWidth','cellFold',
  'colW','catW','subCatW','cardRadius','cardGap','changeLogMax',
  'statusLabels',
];

export function useDBSync() {
  const store = useAppStore();
  const pollTimerRef = useRef(null);

  const buildServerPayload = useCallback(() => {
    const current = getStore();
    const shared = {};
    SHARED_SETTINGS.forEach(k => { shared[k] = current.settings[k]; });
    return { items: current.items, changeLog: current.changeLog, settings: shared, dataVersion: DATA_VERSION };
  }, []);

  const buildLocalPayload = useCallback(() => {
    const current = getStore();
    return {
      items: current.items,
      changeLog: current.changeLog,
      display: current.display,
      filters: current.filters,
      local: {
        baseFont: current.settings.baseFont,
        cardFont: current.settings.cardFont,
        themeId: current.settings.themeId,
        panelPos: current.settings.panelPos,
        panelVisible: current.settings.panelVisible,
        listColumns: current.settings.listColumns,
        storageMode: current.settings.storageMode,
        serverUrl: current.settings.serverUrl,
        pollInterval: current.settings.pollInterval,
        userName: current.settings.userName,
      }
    };
  }, []);

  const saveLocal = useCallback(() => {
    try {
      localStorage.setItem(SK, JSON.stringify(buildLocalPayload()));
    } catch(e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
        store.notify('⚠ 로컬 저장소가 가득 찼습니다.', 'warning');
      }
    }
  }, [buildLocalPayload]);

  const applyServerPayload = useCallback((d) => {
    if (!d) return;
    const current = getStore();
    if (d.items) store.setItems(migrateItems(d.items, d.dataVersion || 1));
    if (Array.isArray(d.changeLog)) store.setChangeLog(d.changeLog);
    if (d.settings) {
      const nextSettings = { ...current.settings };
      SHARED_SETTINGS.forEach(k => {
        if (d.settings[k] !== undefined) nextSettings[k] = d.settings[k];
      });
      store.setSettings(nextSettings);
    }
  }, [store]);

  const saveToServer = useCallback(async () => {
    try {
      const json = await apiFetch('/api/data', {
        method: 'POST',
        body: JSON.stringify({ payload: buildServerPayload(), editor: store.settings.userName || '익명' })
      });
      if (!json.ok) {
        store.notify('서버 저장 실패: ' + json.error, 'error');
        return false;
      }
      store.setServerTs(json.serverTs);
      store.setServerStatus('ok');
      saveLocal();
      return true;
    } catch(e) {
      store.setServerStatus('error');
      store.notify('서버에 연결할 수 없습니다. 로컬에 임시 저장됩니다.', 'warning');
      saveLocal();
      return false;
    }
  }, [buildServerPayload, store, saveLocal]);

  const loadFromServer = useCallback(async () => {
    try {
      store.setIsLoading(true);
      const json = await apiFetch('/api/data');
      if (json.payload) {
        applyServerPayload(json.payload);
        store.setServerTs(json.serverTs);
        store.setServerStatus('ok');
        saveLocal();
        return true;
      }
      return false;
    } catch(e) {
      if (e.status === 403) store.notify('편집 권한이 없습니다.', 'error');
      store.setServerStatus('error');
      return false;
    } finally {
      store.setIsLoading(false);
    }
  }, [store, saveLocal, applyServerPayload]);

  const pollServer = useCallback(async () => {
    try {
      const json = await apiFetch('/api/ping');
      store.setServerStatus('ok');
      
      if (!isSocketConnected() && json.locks) {
        store.updateLocks(json.locks);
      }

      if (!isSocketConnected() && json.serverTs > store.serverTs) {
        const editor = json.lastEditor || '누군가';
        store.setBanner(true, `⚠ ${editor}님이 데이터를 변경했습니다.`);
      }
      return json;
    } catch(e) {
      store.setServerStatus('error');
      return null;
    }
  }, [store, isSocketConnected]);

  const lockItem = useCallback((key) => {
    if (store.settings.storageMode !== 'server' || !key) return;
    const user = store.settings.userName || '익명';
    if (isSocketConnected()) {
      emitLock(key, user);
    } else {
      apiFetch('/api/lock', { method: 'POST', body: JSON.stringify({ key, user }) }).catch(() => {});
    }
  }, [store.settings.storageMode, store.settings.userName]);

  const unlockItem = useCallback((key) => {
    if (store.settings.storageMode !== 'server' || !key) return;
    releaseLocalLock(key);
    const user = store.settings.userName || '익명';
    if (isSocketConnected()) {
      emitUnlock(key, user);
    } else {
      apiFetch('/api/unlock', { method: 'POST', body: JSON.stringify({ key, user }) }).catch(() => {});
    }
  }, [store.settings.storageMode, store.settings.userName]);

  const logActivity = useCallback(async (action, detail = '') => {
    if (store.settings.storageMode !== 'server') return;
    if (!sessionStorage.getItem(ADMIN_TOKEN_KEY) && !sessionStorage.getItem(EDITOR_TOKEN_KEY)) return;
    try {
      await apiFetch('/api/log', {
        method: 'POST',
        body: JSON.stringify({ action, detail, user: store.settings.userName || '익명', ts: Date.now() })
      });
    } catch(e) {}
  }, [store.settings.storageMode, store.settings.userName]);

  useEffect(() => {
    if (store.settings.storageMode === 'server') {
      initSocket();
    } else {
      disconnectSocket();
    }

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (store.settings.storageMode === 'server') {
      const pollMs = Math.max(10, Number(store.settings.pollInterval) || 60) * 1000;
      pollTimerRef.current = setInterval(pollServer, pollMs);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [store.settings.storageMode, store.settings.pollInterval, pollServer]);



  return {
    saveToServer,
    loadFromServer,
    saveLocal,
    pollServer,
    lockItem,
    unlockItem,
    logActivity,
    resolveConflictKeepMine: () => {
      store.setServerTs(0);
      saveToServer();
    },
    resolveConflictUseServer: (serverData) => {
      applyServerPayload(serverData.payload || serverData);
      store.setServerTs(serverData.serverTs || store.serverTs);
      saveLocal();
      store.notify('서버 데이터로 업데이트됐습니다.', 'success');
    },
    broadcastSharedData: (serverTs = getStore().serverTs) => {
      const current = getStore();
      if (current.settings.storageMode !== 'server') return;
      emitDataSave(current.settings.userName || '익명', buildServerPayload(), serverTs);
    }
  };
}
