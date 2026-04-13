import NavigationSide from './NavigationSide.jsx';
import FilterPanel from './FilterPanel.jsx';
import BulkActionBar from './BulkActionBar.jsx';

export default function LayoutShell() {
  return (
    <div className="layout" id="layout">
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
