import NavigationSide from './NavigationSide.jsx';
import FilterPanel from './FilterPanel.jsx';
import BulkActionBar from './BulkActionBar.jsx';
import { useAppStore } from '../store/useAppStore.js';

export default function LayoutShell() {
  const panelPos = useAppStore(s => s.settings.panelPos);

  return (
    <div className={`layout${panelPos === 'right' ? ' pr' : ''}`} id="layout">
      <NavigationSide />
      <main className="content" id="contentArea">
        <div id="dashboardView" style={{ display: 'none' }} />
        <div id="matrixView" className="mwrap fluid" />
        <BulkActionBar />
        <div id="boardView" className="bwrap" style={{ display: 'none' }} />
        <div id="listView" className="lwrap" style={{ display: 'none' }} />
      </main>
      <FilterPanel />
    </div>
  );
}
