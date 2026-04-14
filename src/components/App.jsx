import { useEffect, useMemo } from 'react';
import Header from './Header.jsx';
import LayoutShell from './LayoutShell.jsx';
import UpdateBanner from './UpdateBanner.jsx';
import AppOverlays from './AppOverlays.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { AuthProvider } from '../contexts/AuthContext.jsx';
import { ThemeProvider } from '../contexts/ThemeContext.jsx';
import { useDBSync } from '../hooks/useDBSync.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { getStore, useAppStore } from '../store/useAppStore.js';
import { useModals } from '../hooks/useModals.js';
import { DEMO, SK } from '../app/constants.js';
import { applyVars } from '../app/theme.js';

export default function App() {
  const store = useAppStore();
  const { loadFromServer, saveLocal, logActivity, unlockItem, saveToServer, broadcastSharedData } = useDBSync();
  const { closeModal, closeEditModal, openModal, openAddModal } = useModals();

  // 단축키 액션 정의
  const keyboardActions = useMemo(() => ({
    onEscape: () => {
      closeEditModal();
      closeModal('importModal');
      closeModal('settingsModal');
      closeModal('shortcutsModal');
      getStore().setContextMenu(null);
      getStore().setStatusMenu(null);
    },
    onSearchFocus: () => getStore().requestSearchFocus(),
    openModal: (name) => openModal(name),
    openAddModal: () => openAddModal(),
    togglePanel: () => store.setSettings({ ...store.settings, panelVisible: !store.settings.panelVisible }),
    doUndo: async () => {
      const prevItems = store.doUndo();
      if (prevItems) {
        if (store.settings.storageMode === 'server') {
          const ok = await saveToServer();
          if (ok) broadcastSharedData();
        } else {
          saveLocal();
        }
        logActivity('실행 취소', '상태가 이전으로 되돌려졌습니다.');
      }
    },
  }), [store, closeEditModal, closeModal, openModal, openAddModal]);

  useKeyboardShortcuts(keyboardActions);

  // 초기화 전담 Effect
  useEffect(() => {
    async function initApp() {
      // 1. 로컬 데이터 로드 (storageMode 등 확인)
      const raw = localStorage.getItem(SK);
      let initialSettings = getStore().settings;
      if (raw) {
        try {
          const d = JSON.parse(raw);
          if (d.local) {
            const nextSettings = { 
              ...initialSettings,
              storageMode: d.local.storageMode,
              serverUrl: d.local.serverUrl,
              userName: d.local.userName,
              themeId: d.local.themeId || initialSettings.themeId,
            };
            store.setSettings(nextSettings);
            initialSettings = nextSettings;
          }
        } catch (e) {}
      }

      // 2. 서버 또는 데모 데이터 로드
      if (initialSettings.storageMode === 'server') {
        await loadFromServer();
      } else if (getStore().items.length === 0) {
        store.setItems(JSON.parse(JSON.stringify(DEMO)));
      }

      // 3. 테마 초기 적용
      applyVars();

      // 4. 초기화 로그
      logActivity('접속', `${getStore().items.length}개 항목 확인`);

    }

    initApp();

    // 윈도우 종료 시 정리 (필요 시)
    return () => {
      if (store.editKey) unlockItem(store.editKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    document.title = store.settings.title || 'featureMATRIX';
  }, [store.settings.title]);

  return (
    <ErrorBoundary level="app" label="앱">
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary level="view" label="헤더">
            <Header />
          </ErrorBoundary>
          <UpdateBanner />
          <LayoutShell />

          <AppOverlays />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
