import NavigationSide from './NavigationSide.jsx';
import FilterPanel from './FilterPanel.jsx';
import BulkActionBar from './BulkActionBar.jsx';
import { useAppStore } from '../store/useAppStore.js';

export default function LayoutShell() {
  const panelPos = useAppStore(s => s.settings.panelPos);
  const view = useAppStore(s => s.view);

  return (
    <div className={`layout${panelPos === 'right' ? ' pr' : ''}`} id="layout">
      <NavigationSide />
      <main className="content" id="contentArea" style={{ overflowY: view === 'board' ? 'hidden' : undefined }}>
        <div id="dashboardView" style={{ display: view === 'dashboard' ? '' : 'none' }} />
        <div id="matrixView" className="mwrap fluid" style={{ display: view === 'matrix' ? '' : 'none' }} />
        <BulkActionBar />
        <div id="boardView" className="bwrap" style={{ display: view === 'board' ? '' : 'none' }} />
        <div id="listView" className="lwrap" style={{ display: view === 'list' ? '' : 'none' }} />
      </main>
      <FilterPanel />
    </div>
  );
}
