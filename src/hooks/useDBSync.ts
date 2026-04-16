import { useEffect, useRef, useCallback } from 'react';
import { useAppStore, getStore } from '../store/useAppStore.js';
import { apiFetch } from '../utils/api.js';
import { migrateChangeLog, migrateItems, migrateSettings } from '../utils/itemUtils.js';
import { ADMIN_TOKEN_KEY, EDITOR_TOKEN_KEY, SK, DATA_VERSION } from '../app/constants.js';
import { initSocket, disconnectSocket, isSocketConnected, emitDataSave, emitLock, emitUnlock, releaseLocalLock } from '../app/socket.js';
import type { AppSettings } from '../types/index.js';

interface UseDBSyncOptions {
  enableConnection?: boolean;
}

/* 서버에 저장할 settings 키 목록 (groupOrder/catOrder 제거) */
const SHARED_SETTINGS: (keyof AppSettings)[] = [
  'title', 'subtitle', 'dbHeroName', 'dbSections', 'dbSectionVisibility',
  'priorityStyles', 'customColors', 'matrixWidth', 'cellFold',
  'colW', 'catW', 'subCatW', 'cardRadius', 'cardGap', 'changeLogMax',
  'statusLabels', 'boardFoldCount',
];

export function useDBSync(options: UseDBSyncOptions = {}) {
  const { enableConnection = false } = options;
  const store = useAppStore();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buildServerPayload = useCallback(() => {
    const current = getStore();
    const shared: Record<string, unknown> = {};
    SHARED_SETTINGS.forEach(k => { shared[k as string] = current.settings[k as string]; });
    return { items: current.items, changeLog: current.changeLog, settings: shared, dataVersion: DATA_VERSION };
  }, []);

  const buildLocalPayload = useCallback(() => {
    const s = getStore().settings;
    const current = getStore();
    return {
      items: current.items,
      changeLog: current.changeLog,
      display: current.display,
      filters: current.filters,
      dataVersion: DATA_VERSION,
      local: {
        // 기본 표시 설정
        baseFont: s.baseFont,
        cardFont: s.cardFont,
        cardRadius: s.cardRadius,
        cardGap: s.cardGap,
        // 레이아웃
        colW: s.colW,
        catW: s.catW,
        subCatW: s.subCatW,
        cellFold: s.cellFold,
        boardFoldCount: s.boardFoldCount,
        matrixWidth: s.matrixWidth,
        // 패널
        panelPos: s.panelPos,
        panelVisible: s.panelVisible,
        // 테마·디자인
        themeId: s.themeId,
        priorityStyles: s.priorityStyles,
        customColors: s.customColors,
        // 컬럼/섹션
        listColumns: s.listColumns,
        dbSections: s.dbSections,
        dbSectionVisibility: s.dbSectionVisibility,
        // 서버/접속
        storageMode: s.storageMode,
        serverUrl: s.serverUrl,
        pollInterval: s.pollInterval,
        userName: s.userName,
        // 기타
        changeLogMax: s.changeLogMax,
      },
    };
  }, []);

  const saveLocal = useCallback(() => {
    try {
      localStorage.setItem(SK, JSON.stringify(buildLocalPayload()));
    } catch (e: unknown) {
      const err = e as { name?: string; code?: number };
      if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
        store.notify('⚠ 로컬 저장소가 가득 찼습니다.', 'warning');
      }
    }
  }, [buildLocalPayload, store]);

  const applyServerPayload = useCallback((d: Record<string, unknown> | null) => {
    if (!d) return;
    const current = getStore();
    if (d.items) store.setItems(migrateItems(d.items as unknown[], (d.dataVersion as number) || 1));
    if (Array.isArray(d.changeLog)) store.setChangeLog(migrateChangeLog(d.changeLog));
    if (d.settings) {
      const nextSettings = { ...current.settings };
      const migratedSettings = migrateSettings(d.settings as Partial<AppSettings>);
      SHARED_SETTINGS.forEach(k => {
        if ((migratedSettings as Record<string, unknown>)[k as string] !== undefined) {
          (nextSettings as Record<string, unknown>)[k as string] = (migratedSettings as Record<string, unknown>)[k as string];
        }
      });
      store.setSettings(nextSettings);
    }
  }, [store]);

  const saveToServer = useCallback(async (): Promise<boolean> => {
    try {
      const json = await apiFetch('/api/data', {
        method: 'POST',
        body: JSON.stringify({ payload: buildServerPayload(), editor: store.settings.userName || '익명' }),
      }) as { ok: boolean; error?: string; serverTs?: number };
      if (!json.ok) {
        store.notify('서버 저장 실패: ' + json.error, 'error');
        return false;
      }
      store.setServerTs(json.serverTs ?? 0);
      store.setServerStatus('ok');
      saveLocal();
      return true;
    } catch {
      store.setServerStatus('error');
      store.notify('서버에 연결할 수 없습니다. 로컬에 임시 저장됩니다.', 'warning');
      saveLocal();
      return false;
    }
  }, [buildServerPayload, store, saveLocal]);

  const loadFromServer = useCallback(async (): Promise<boolean> => {
    try {
      store.setIsLoading(true);
      const json = await apiFetch('/api/data') as { payload?: Record<string, unknown>; serverTs?: number };
      if (json.payload) {
        applyServerPayload(json.payload);
        store.setServerTs(json.serverTs ?? 0);
        store.setServerStatus('ok');
        saveLocal();
        return true;
      }
      return false;
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err.status === 403) store.notify('편집 권한이 없습니다.', 'error');
      store.setServerStatus('error');
      return false;
    } finally {
      store.setIsLoading(false);
    }
  }, [store, saveLocal, applyServerPayload]);

  const pollServer = useCallback(async () => {
    const current = getStore();
    try {
      const json = await apiFetch('/api/ping') as {
        locks?: Record<string, unknown>;
        serverTs?: number;
        lastEditor?: string;
      };
      current.setServerStatus('ok');

      if (!isSocketConnected() && json.locks) {
        current.updateLocks(json.locks as Record<string, import('../types/index.js').EditLock>);
      }
      if (!isSocketConnected() && (json.serverTs ?? 0) > current.serverTs) {
        const editor = json.lastEditor || '누군가';
        current.setBanner(true, `⚠ ${editor}님이 데이터를 변경했습니다.`);
      }
      return json;
    } catch {
      current.setServerStatus('error');
      return null;
    }
  }, []);

  const lockItem = useCallback((key: string) => {
    if (store.settings.storageMode !== 'server' || !key) return;
    const user = store.settings.userName || '익명';
    if (isSocketConnected()) {
      emitLock(key, user);
    } else {
      apiFetch('/api/lock', { method: 'POST', body: JSON.stringify({ key, user }) }).catch(() => {});
    }
  }, [store.settings.storageMode, store.settings.userName]);

  const unlockItem = useCallback((key: string) => {
    if (store.settings.storageMode !== 'server' || !key) return;
    releaseLocalLock(key);
    const user = store.settings.userName || '익명';
    if (isSocketConnected()) {
      emitUnlock(key, user);
    } else {
      apiFetch('/api/unlock', { method: 'POST', body: JSON.stringify({ key, user }) }).catch(() => {});
    }
  }, [store.settings.storageMode, store.settings.userName]);

  const logActivity = useCallback(async (action: string, detail = '') => {
    if (store.settings.storageMode !== 'server') return;
    if (!sessionStorage.getItem(ADMIN_TOKEN_KEY) && !sessionStorage.getItem(EDITOR_TOKEN_KEY)) return;
    try {
      await apiFetch('/api/log', {
        method: 'POST',
        body: JSON.stringify({ action, detail, user: store.settings.userName || '익명', ts: Date.now() }),
      });
    } catch { /* ignore */ }
  }, [store.settings.storageMode, store.settings.userName]);

  useEffect(() => {
    if (!enableConnection) return undefined;

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
  }, [enableConnection, store.settings.storageMode, store.settings.pollInterval, pollServer]);

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
    resolveConflictUseServer: (serverData: { payload?: Record<string, unknown>; serverTs?: number }) => {
      applyServerPayload(serverData.payload ?? (serverData as unknown as Record<string, unknown>));
      store.setServerTs(serverData.serverTs ?? store.serverTs);
      saveLocal();
      store.notify('서버 데이터로 업데이트됐습니다.', 'success');
    },
    broadcastSharedData: (serverTs = getStore().serverTs) => {
      const current = getStore();
      if (current.settings.storageMode !== 'server') return;
      emitDataSave(current.settings.userName || '익명', buildServerPayload(), serverTs);
    },
  };
}
