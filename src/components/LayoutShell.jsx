import NavigationSide from './NavigationSide.jsx';
import FilterPanel from './FilterPanel.jsx';
import BulkActionBar from './BulkActionBar.jsx';
import DashboardView from './DashboardView.jsx';
import MatrixView from './MatrixView.jsx';
import BoardView from './BoardView.jsx';
import ListView from './ListView.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { useAppStore } from '../store/useAppStore.js';

export default function LayoutShell() {
  const panelPos = useAppStore(s => s.settings.panelPos);
  const view = useAppStore(s => s.view);

  return (
    <div className={`layout${panelPos === 'right' ? ' pr' : ''}`} id="layout">
      <NavigationSide />
      <main className="content" id="contentArea" style={{ overflowY: view === 'board' ? 'hidden' : undefined }}>
        <div id="dashboardView" style={{ display: view === 'dashboard' ? '' : 'none' }}>
          <ErrorBoundary level="view" label="대시보드">
            <DashboardView />
          </ErrorBoundary>
        </div>
        
        <div id="matrixView" className="mwrap fluid" style={{ display: view === 'matrix' ? '' : 'none' }}>
          <ErrorBoundary level="view" label="매트릭스 뷰">
            <MatrixView />
          </ErrorBoundary>
        </div>

        <BulkActionBar />
        
        <div id="boardView" className="bwrap" style={{ display: view === 'board' ? '' : 'none' }}>
          <ErrorBoundary level="view" label="보드 뷰">
            <BoardView />
          </ErrorBoundary>
        </div>
        
        <div id="listView" className="lwrap" style={{ display: view === 'list' ? '' : 'none' }}>
          <ErrorBoundary level="view" label="리스트 뷰">
            <ListView />
          </ErrorBoundary>
        </div>
      </main>
      <FilterPanel />
    </div>
  );
}
