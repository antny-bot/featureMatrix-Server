import { useEffect } from 'react';
import Header from './Header.jsx';
import BoardView from './BoardView.jsx';
import DashboardView from './DashboardView.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import ItemModal from './ItemModal.jsx';
import MatrixView from './MatrixView.jsx';
import ListView from './ListView.jsx';
import LayoutShell from './LayoutShell.jsx';
import UpdateBanner from './UpdateBanner.jsx';
import AppOverlays from './AppOverlays.jsx';
import { AuthProvider } from '../contexts/AuthContext.jsx';
import { ThemeProvider } from '../contexts/ThemeContext.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

const LEGACY_PORTAL_ROOTS = `
<div class="ov" id="editModal"></div>
<div class="ov" id="settingsModal"></div>
`;

export default function App() {
  useEffect(() => {
    import('../app/main.js').catch(err => {
      console.error('[App] failed to initialize legacy bridge:', err);
    });
  }, []);

  return (
    <ErrorBoundary level="app" label="앱">
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary level="view" label="헤더">
            <Header />
          </ErrorBoundary>
          <UpdateBanner />
          <LayoutShell />
          <div dangerouslySetInnerHTML={{ __html: LEGACY_PORTAL_ROOTS }} />
          <AppOverlays />
          <ErrorBoundary level="view" label="보드 뷰">
            <BoardView />
          </ErrorBoundary>
          <ErrorBoundary level="view" label="대시보드">
            <DashboardView />
          </ErrorBoundary>
          <ErrorBoundary level="modal" label="설정">
            <SettingsPanel />
          </ErrorBoundary>
          <ErrorBoundary level="modal" label="편집 모달">
            <ItemModal />
          </ErrorBoundary>
          <ErrorBoundary level="view" label="매트릭스 뷰">
            <MatrixView />
          </ErrorBoundary>
          <ErrorBoundary level="view" label="리스트 뷰">
            <ListView />
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
