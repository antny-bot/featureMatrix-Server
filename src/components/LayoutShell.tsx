import NavigationSide from './NavigationSide.js';
import FilterPanel from './FilterPanel.js';
import BulkActionBar from './BulkActionBar.jsx';
import DashboardView from './DashboardView.js';
import MatrixView from './MatrixView.jsx';
import BoardView from './BoardView.jsx';
import ListView from './ListView.jsx';
import AdminView from './AdminView.js';
import ErrorBoundary from './ErrorBoundary.jsx';
import { useAppStore } from '../store/useAppStore.js';

export default function LayoutShell() {
  const panelPos = useAppStore(s => s.settings.panelPos);
  const view = useAppStore(s => s.view);

  return (
    <div className={`layout${panelPos === 'right' ? ' pr' : ''}`} id="layout">
      <NavigationSide />
      <main className="content" id="contentArea" style={{ overflowY: view === 'board' ? 'hidden' : undefined }}>

        <div id="adminView" className="view-pane" style={{ display: view === 'admin' ? '' : 'none' }}>
          <ErrorBoundary level="view" label="관리자">
            <AdminView />
          </ErrorBoundary>
        </div>

        <div id="dashboardView" className="view-pane" style={{ display: view === 'dashboard' ? '' : 'none' }}>
          <ErrorBoundary level="view" label="대시보드">
            <DashboardView />
          </ErrorBoundary>
        </div>

        <div id="matrixView" className="view-pane mwrap fluid" style={{ display: view === 'matrix' ? '' : 'none' }}>
          <ErrorBoundary level="view" label="매트릭스 뷰">
            <MatrixView />
          </ErrorBoundary>
        </div>

        <BulkActionBar />

        <div id="boardView" className="view-pane bwrap" style={{ display: view === 'board' ? '' : 'none' }}>
          <ErrorBoundary level="view" label="보드 뷰">
            <BoardView />
          </ErrorBoundary>
        </div>

        <div id="listView" className="view-pane lwrap" style={{ display: view === 'list' ? '' : 'none' }}>
          <ErrorBoundary level="view" label="리스트 뷰">
            <ListView />
          </ErrorBoundary>
        </div>

      </main>
      {view !== 'admin' && <FilterPanel />}
    </div>
  );
}
