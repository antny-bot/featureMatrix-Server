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
import { migrateChangeLog, migrateFilters, migrateItems, migrateSettings } from '../utils/itemUtils.js';
import type { KeyboardActions } from '../types/index.js';

export default function App() {
  const settingsTitle = useAppStore(s => s.settings.title);
  const { loadFromServer, saveLocal, logActivity, unlockItem, saveToServer, broadcastSharedData } = useDBSync({ enableConnection: true });
  const { closeModal, closeEditModal, openModal, openAddModal } = useModals();

  // 단축키 액션 정의
  const keyboardActions = useMemo<KeyboardActions>(() => ({
    onEscape: () => {
      closeEditModal();
      closeModal('importModal');
      closeModal('settingsModal');
      closeModal('shortcutsModal');
      getStore().setContextMenu(null);
      getStore().setStatusMenu(null);
    },
    onSearchFocus: () => getStore().requestSearchFocus(),
    openModal: (name: string) => openModal(name),
    openAddModal: () => openAddModal(),
    togglePanel: () => {
      const { settings, setSettings } = useAppStore.getState();
      const next = { ...settings, panelVisible: !settings.panelVisible };
      setSettings(next);
      // 패널 토글 상태 즉시 저장
      saveLocal();
    },
    doUndo: async () => {
      const { doUndo, settings } = useAppStore.getState();
      const prevItems = doUndo();
      if (prevItems) {
        if (settings.storageMode === 'server') {
          const ok = await saveToServer();
          if (ok) broadcastSharedData();
        } else {
          saveLocal();
        }
        logActivity('실행 취소', '상태가 이전으로 되돌려졌습니다.');
      }
    },
  }), [closeEditModal, closeModal, openModal, openAddModal, saveToServer, broadcastSharedData, saveLocal, logActivity]);

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
          const { setItems, setChangeLog, setFilters, setDisplay, setSettings } = useAppStore.getState();
          if (d.items) setItems(migrateItems(d.items, d.dataVersion || 1));
          if (Array.isArray(d.changeLog)) setChangeLog(migrateChangeLog(d.changeLog));
          if (d.filters) setFilters(migrateFilters({ ...getStore().filters, ...d.filters }));
          if (d.display) setDisplay({ ...getStore().display, ...d.display });
          if (d.local) {
            const loc = d.local;
            const nextSettings = {
              ...initialSettings,
              // 기본 표시
              baseFont:        loc.baseFont        ?? initialSettings.baseFont,
              cardFont:        loc.cardFont        ?? initialSettings.cardFont,
              cardRadius:      loc.cardRadius      ?? initialSettings.cardRadius,
              cardGap:         loc.cardGap         ?? initialSettings.cardGap,
              // 레이아웃
              colW:            loc.colW            ?? initialSettings.colW,
              catW:            loc.catW            ?? initialSettings.catW,
              subCatW:         loc.subCatW         ?? initialSettings.subCatW,
              cellFold:        loc.cellFold        ?? initialSettings.cellFold,
              boardFoldCount:  loc.boardFoldCount  ?? initialSettings.boardFoldCount,
              matrixWidth:     loc.matrixWidth     || initialSettings.matrixWidth,
              // 패널
              panelPos:        loc.panelPos        || initialSettings.panelPos,
              panelVisible:    loc.panelVisible    ?? initialSettings.panelVisible,
              // 테마·디자인
              themeId:         loc.themeId         || initialSettings.themeId,
              priorityStyles:  loc.priorityStyles  || initialSettings.priorityStyles,
              customColors:    loc.customColors    || initialSettings.customColors,
              // 컬럼/섹션
              listColumns:     loc.listColumns     || initialSettings.listColumns,
              dbSections:      loc.dbSections      || initialSettings.dbSections,
              dbSectionVisibility: loc.dbSectionVisibility || initialSettings.dbSectionVisibility,
              // 서버/접속
              storageMode:     loc.storageMode     || initialSettings.storageMode,
              serverUrl:       loc.serverUrl       || initialSettings.serverUrl,
              pollInterval:    loc.pollInterval    ?? initialSettings.pollInterval,
              userName:        loc.userName        || initialSettings.userName,
              // 기타
              changeLogMax:    loc.changeLogMax    ?? initialSettings.changeLogMax,
            };
            const migratedSettings = migrateSettings(nextSettings);
            setSettings(migratedSettings);
            initialSettings = migratedSettings;
          }
        } catch { /* parse error — ignore */ }
      }

      // 2. 서버 또는 데모 데이터 로드
      if (initialSettings.storageMode === 'server') {
        await loadFromServer();
      } else if (getStore().items.length === 0) {
        useAppStore.getState().setItems(JSON.parse(JSON.stringify(DEMO)));
      }

      // 3. 테마 초기 적용
      applyVars();

      // 4. 초기화 로그
      logActivity('접속', `${getStore().items.length}개 항목 확인`);
    }

    initApp();

    return () => {
      const { editKey } = useAppStore.getState();
      if (editKey) unlockItem(editKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = settingsTitle || 'featureMATRIX';
  }, [settingsTitle]);

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
