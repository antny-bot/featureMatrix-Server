import { useState, useCallback, useMemo } from 'react';
import { STATUS_CHIP_COLORS, STATUS_OPTS } from '../app/constants.js';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from '../hooks/useDBSync.js';
import { getColors } from '../app/theme.js';
import {
  getFiltered, getUniqSorted, isFilterActive,
  getOwnerColor, normOwner
} from '../utils/itemUtils.js';
import type { Filters, DisplaySettings } from '../types/index.js';

const PRIORITY_CHIPS = [
  { val: '상', pk: 'high' },
  { val: '중', pk: 'mid' },
  { val: '하', pk: 'low' },
];

function ToggleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.5" />
    </svg>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <div className={`fsec${collapsed ? ' sec-collapsed' : ''}`}>
        <div className="fsec-ttl" onClick={() => setCollapsed(v => !v)}>{title}</div>
        <div className="fsec-body">{children}</div>
      </div>
      <div className="fsep" />
    </>
  );
}

function Toggle({ id, label, checked = false, onChange }: {
  id?: string;
  label: string;
  checked?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="tgl">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="tgl-track" /><span className="tgl-lbl">{label}</span>
    </label>
  );
}

function PriorityChips({ onPersist }: { onPersist: () => void }) {
  const filters    = useAppStore(s => s.filters);
  const colors     = getColors() as Record<string, string>;
  const priorities = filters.priorities;

  const togglePrio = (val: string, checked: boolean) => {
    const { pushUndo, setFilters, filters: f } = useAppStore.getState();
    pushUndo();
    const next = checked ? [...f.priorities, val] : f.priorities.filter(v => v !== val);
    setFilters({ ...f, priorities: next });
    onPersist();
  };

  return (
    <div className="pchips">
      {PRIORITY_CHIPS.map(({ val, pk }) => {
        const checked = priorities.includes(val);
        const key = pk[0].toUpperCase() + pk.slice(1);
        const col = colors[`p${key}`] || '#888';
        const bg = colors[`p${key}Bg`] || '#eee';
        const style = checked
          ? { color: col, background: bg, borderColor: col, borderWidth: '2px' }
          : { color: 'var(--text-2)', background: 'var(--surface-2)', borderColor: 'var(--border-2)' };

        return (
          <label className="pchip" style={style} key={val}>
            <input type="checkbox" checked={checked} onChange={e => togglePrio(val, e.target.checked)} />
            {val}
          </label>
        );
      })}
    </div>
  );
}

function StatusChips({ onPersist }: { onPersist: () => void }) {
  const items        = useAppStore(s => s.items);
  const filters      = useAppStore(s => s.filters);
  const searchQ      = useAppStore(s => s.searchQ);
  const statusLabels = useAppStore(s => s.settings.statusLabels);
  const statuses     = filters.statuses || [];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    const countItems = isFilterActive(filters, searchQ)
      ? getFiltered(items, filters, searchQ)
      : items.filter(it => it.isDelete !== 'Y');
    countItems.forEach(it => { if (it.status) c[it.status] = (c[it.status] || 0) + 1; });
    return c;
  }, [items, filters, searchQ]);

  const toggleStatus = (status: string, checked: boolean) => {
    const { pushUndo, setFilters, filters: f } = useAppStore.getState();
    pushUndo();
    const next = checked ? [...(f.statuses || []), status] : (f.statuses || []).filter(s => s !== status);
    setFilters({ ...f, statuses: next });
    onPersist();
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
      {(STATUS_OPTS as string[]).map(status => {
        const checked = statuses.includes(status);
        const { col, bg } = (STATUS_CHIP_COLORS as Record<string, { col: string; bg: string }>)[status] || { col: '#888', bg: '#eee' };
        const style = checked
          ? { color: col, background: bg, borderColor: col, fontSize: '.7rem', cursor: 'pointer', marginBottom: '3px' }
          : { color: col, borderColor: 'var(--border-2)', fontSize: '.7rem', cursor: 'pointer', marginBottom: '3px' };

        return (
          <label className="pchip" style={style} key={status}>
            <input type="checkbox" checked={checked} style={{ display: 'none' }} onChange={e => toggleStatus(status, e.target.checked)} />
            {statusLabels?.[status] || status}{!!counts[status] && <span style={{ fontSize: '.6rem', opacity: .7, marginLeft: '3px' }}>{counts[status]}</span>}
          </label>
        );
      })}
    </div>
  );
}

function OwnerChips({ onPersist }: { onPersist: () => void }) {
  const filters   = useAppStore(s => s.filters);
  const items     = useAppStore(s => s.items);
  const owners    = filters.owners || [];
  const allOwners = getUniqSorted('owner', items);

  const toggleOwner = (owner: string, checked: boolean) => {
    const { pushUndo, setFilters, filters: f } = useAppStore.getState();
    pushUndo();
    const norm = normOwner(owner);
    const next = checked ? [...(f.owners || []), norm] : (f.owners || []).filter(o => o !== norm);
    setFilters({ ...f, owners: next });
    onPersist();
  };

  return (
    <div className="owner-chips">
      {allOwners.map(owner => {
        const normalized = normOwner(owner);
        const checked = owners.includes(normalized);
        const color = getOwnerColor(owner);
        const style = checked ? { borderColor: color, color, background: 'var(--surface)' } : undefined;
        return (
          <label className={`owner-chip${checked ? ' chip-on' : ''}`} style={style} key={owner}>
            <input type="checkbox" checked={checked} onChange={e => toggleOwner(owner, e.target.checked)} />
            <span style={{ background: color, width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 }} />
            {owner}
          </label>
        );
      })}
    </div>
  );
}

export default function FilterPanel() {
  const filters     = useAppStore(s => s.filters);
  const display     = useAppStore(s => s.display);
  const undoDepth   = useAppStore(s => s.undoDepth);
  const settings    = useAppStore(s => s.settings);
  const setFilters  = useAppStore(s => s.setFilters);
  const setDisplay  = useAppStore(s => s.setDisplay);
  const setSettings = useAppStore(s => s.setSettings);
  const setSearchQ  = useAppStore(s => s.setSearchQ);
  const { saveLocal, saveToServer, broadcastSharedData, logActivity } = useDBSync();

  const handleUndo = async () => {
    const { doUndo } = useAppStore.getState();
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
  };

  const panelVisible = settings.panelVisible;
  // #48B: fp-hide 제거 — dashboard 에서도 F키로 패널 토글 가능
  const panelClassName = ['fpanel', !panelVisible ? 'collapsed' : ''].filter(Boolean).join(' ');

  const togglePanel = useCallback(() => {
    const next = { ...settings, panelVisible: !panelVisible };
    setSettings(next);
    saveLocal();
  }, [settings, panelVisible, setSettings, saveLocal]);

  const resetFiltersAction = useCallback(() => {
    const { pushUndo } = useAppStore.getState();
    pushUndo();
    setFilters({ priorities: [], statuses: [], showDeleted: false, importantOnly: false, owners: [] });
    setSearchQ('');
    saveLocal();
  }, [setFilters, setSearchQ, saveLocal]);

  const updateFilter = (key: keyof Filters, val: unknown) => {
    const { pushUndo } = useAppStore.getState();
    pushUndo();
    setFilters({ ...filters, [key]: val });
    saveLocal();
  };

  const updateDisplay = (key: keyof DisplaySettings, val: unknown) => {
    setDisplay({ ...display, [key]: val });
    saveLocal();
  };

  return (
    <aside className={panelClassName} id="fpanel">
      <button className="fpanel-toggle" onClick={togglePanel} title="필터 패널 (F)"><ToggleIcon /></button>
      <div className="fpinner">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '.64rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>필터</span>
          <button className="btn btn-g btn-sm" onClick={resetFiltersAction} style={{ height: '20px', padding: '0 6px', fontSize: '.65rem' }}>초기화</button>
        </div>

        <FilterSection title="우선순위"><PriorityChips onPersist={saveLocal} /></FilterSection>
        <FilterSection title="진행상태"><StatusChips onPersist={saveLocal} /></FilterSection>
        <FilterSection title="담당"><OwnerChips onPersist={saveLocal} /></FilterSection>

        <FilterSection title="표시 조건">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <Toggle label="삭제 포함" checked={filters.showDeleted} onChange={v => updateFilter('showDeleted', v)} />
            <Toggle label="중요만 보기" checked={filters.importantOnly} onChange={v => updateFilter('importantOnly', v)} />
          </div>
        </FilterSection>

        <FilterSection title="카드 표시">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div className="fsec-sub">식별</div>
            <Toggle label="담당" checked={display.showOwner} onChange={v => updateDisplay('showOwner', v)} />
            <Toggle label="★ 중요" checked={display.showStar} onChange={v => updateDisplay('showStar', v)} />
            <Toggle label="N 신규 배지" checked={display.showNewBadge} onChange={v => updateDisplay('showNewBadge', v)} />
            <div className="fsec-sub">상태</div>
            <Toggle label="진행상태 뱃지" checked={display.showStatus} onChange={v => updateDisplay('showStatus', v)} />
            <Toggle label="MD 뱃지" checked={display.showMdBadge} onChange={v => updateDisplay('showMdBadge', v)} />
            <div className="fsec-sub">보조</div>
            <Toggle label="셀 카운터" checked={display.showCellCount} onChange={v => updateDisplay('showCellCount', v)} />
            <Toggle label="수정일" checked={display.showUpdated} onChange={v => updateDisplay('showUpdated', v)} />
            <Toggle label="빠른 추가 버튼" checked={display.showQuickAdd} onChange={v => updateDisplay('showQuickAdd', v)} />
          </div>
        </FilterSection>

        <div className={`undo-fab${undoDepth ? ' on' : ''}`}>
          <button className="btn btn-s" onClick={handleUndo} title="실행 취소 (Z)" style={{ gap: '6px', width: '100%' }}>
            <UndoIcon />되돌리기
          </button>
        </div>
      </div>
    </aside>
  );
}
