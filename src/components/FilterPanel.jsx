import { STATUS_CHIP_COLORS, STATUS_OPTS } from '../app/constants.js';
import { getFiltered, getUniqSorted, isFilterActive } from '../app/render.js';
import { S, getOwnerColor, normOwner, save } from '../app/state.js';
import { getColors } from '../app/theme.js';
import { setStore, useAppStore } from '../store/useAppStore.js';

const PRIORITY_CHIPS = [
  { val: '상', pk: 'high' },
  { val: '중', pk: 'mid' },
  { val: '하', pk: 'low' },
];

function ToggleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
    </svg>
  );
}

function FilterSection({ title, children }) {
  return (
    <>
      <div className="fsec">
        <div className="fsec-ttl">{title}</div>
        <div className="fsec-body">{children}</div>
      </div>
      <div className="fsep" />
    </>
  );
}

function Toggle({ id, label, checked = false, onChange }) {
  return (
    <label className="tgl">
      <input id={id} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
      <span className="tgl-track" />
      <span className="tgl-lbl">{label}</span>
    </label>
  );
}

function syncFilters() {
  save();
  setStore({ filters: { ...S.filters } });
  window.renderAll?.(true);
}

function PriorityChips() {
  useAppStore(s => s.filters.priorities);
  useAppStore(s => s.settings.customColors);
  useAppStore(s => s.settings.themeId);

  const colors = getColors();

  return (
    <div className="pchips" id="prioChips">
      {PRIORITY_CHIPS.map(({ val, pk }) => {
        const checked = S.filters.priorities.includes(val);
        const key = pk[0].toUpperCase() + pk.slice(1);
        const col = colors[`p${key}`] || '#888';
        const bg = colors[`p${key}Bg`] || '#eee';
        const style = checked
          ? { color: col, background: bg, borderColor: col, borderWidth: '2px' }
          : { color: 'var(--text-2)', background: 'var(--surface-2)', borderColor: 'var(--border-2)' };

        return (
          <label className="pchip" style={style} key={val}>
            <input
              type="checkbox"
              value={val}
              checked={checked}
              onChange={e => {
                const idx = S.filters.priorities.indexOf(val);
                if (e.target.checked && idx === -1) S.filters.priorities.push(val);
                else if (!e.target.checked && idx !== -1) S.filters.priorities.splice(idx, 1);
                syncFilters();
              }}
            />
            {val}
          </label>
        );
      })}
    </div>
  );
}

function StatusChips() {
  useAppStore(s => s.items);
  useAppStore(s => s.filters);

  const counts = {};
  const countItems = isFilterActive() ? getFiltered() : S.items.filter(it => it.isDelete !== 'Y');
  countItems.forEach(it => {
    if (it.status) counts[it.status] = (counts[it.status] || 0) + 1;
  });

  return (
    <div id="statusChips" style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
      {STATUS_OPTS.map(status => {
        const checked = (S.filters.statuses || []).includes(status);
        const { col, bg } = STATUS_CHIP_COLORS[status] || { col: '#888', bg: '#eee' };
        const style = checked
          ? { color: col, background: bg, borderColor: col, fontSize: '.7rem', cursor: 'pointer', marginBottom: '3px' }
          : { color: col, borderColor: 'var(--border-2)', fontSize: '.7rem', cursor: 'pointer', marginBottom: '3px' };

        return (
          <label className="pchip" style={style} key={status}>
            <input
              type="checkbox"
              value={status}
              checked={checked}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              onChange={e => {
                if (!S.filters.statuses) S.filters.statuses = [];
                const idx = S.filters.statuses.indexOf(status);
                if (e.target.checked && idx === -1) S.filters.statuses.push(status);
                else if (!e.target.checked && idx !== -1) S.filters.statuses.splice(idx, 1);
                syncFilters();
              }}
            />
            {status}
            {!!counts[status] && (
              <span style={{ fontSize: '.6rem', opacity: .7, marginLeft: '3px' }}>{counts[status]}</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

function OwnerChips() {
  useAppStore(s => s.items);
  useAppStore(s => s.filters.owners);

  return (
    <div className="owner-chips" id="ownerChips">
      {getUniqSorted('owner', S.items).map(owner => {
        const normalized = normOwner(owner);
        const checked = S.filters.owners.includes(normalized);
        const color = getOwnerColor(owner);
        const chipStyle = checked
          ? { borderColor: color, color, background: 'var(--surface)' }
          : undefined;

        return (
          <label className={`owner-chip${checked ? ' chip-on' : ''}`} style={chipStyle} key={owner}>
            <input
              type="checkbox"
              value={owner}
              checked={checked}
              onChange={e => {
                const idx = S.filters.owners.indexOf(normalized);
                if (e.target.checked && idx === -1) S.filters.owners.push(normalized);
                else if (!e.target.checked && idx !== -1) S.filters.owners.splice(idx, 1);
                syncFilters();
              }}
            />
            <span
              style={{
                background: color,
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            {owner}
          </label>
        );
      })}
    </div>
  );
}

export default function FilterPanel() {
  const filters = useAppStore(s => s.filters);
  const display = useAppStore(s => s.display);
  const panelVisible = useAppStore(s => s.settings.panelVisible);
  const view = useAppStore(s => s.view);
  const panelClassName = [
    'fpanel',
    !panelVisible ? 'collapsed' : '',
    view === 'dashboard' ? 'fp-hide' : '',
  ].filter(Boolean).join(' ');

  const setFilter = (key, value) => {
    S.filters[key] = value;
    syncFilters();
  };

  const setDisplay = (key, value) => {
    S.display[key] = value;
    save();
    setStore({ display: { ...S.display } });
    window.renderAll?.();
  };

  return (
    <aside className={panelClassName} id="fpanel">
      <button
        className="fpanel-toggle"
        id="fpanelToggle"
        onClick={() => window.togglePanel?.()}
        title="필터 패널 (F)"
      >
        <ToggleIcon />
      </button>
      <div className="fpinner">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span
            style={{
              fontSize: '.64rem',
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
            }}
          >
            필터
          </span>
          <button
            className="btn btn-g btn-sm"
            onClick={() => window.resetFilters?.()}
            style={{ height: '20px', padding: '0 6px', fontSize: '.65rem' }}
          >
            초기화
          </button>
        </div>

        <FilterSection title="우선순위">
          <PriorityChips />
        </FilterSection>

        <FilterSection title="진행상태">
          <StatusChips />
        </FilterSection>

        <FilterSection title="담당">
          <OwnerChips />
        </FilterSection>

        <FilterSection title="표시 조건">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <Toggle id="togDel" label="삭제 포함" checked={filters.showDeleted} onChange={value => setFilter('showDeleted', value)} />
            <Toggle id="togImp" label="중요만 보기" checked={filters.importantOnly} onChange={value => setFilter('importantOnly', value)} />
          </div>
        </FilterSection>

        <FilterSection title="카드 표시">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div
              style={{
                fontSize: '.62rem',
                fontWeight: 700,
                letterSpacing: '.04em',
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                margin: '4px 0 2px',
              }}
            >
              식별
            </div>
            <Toggle id="togOwner" label="담당" checked={display.showOwner} onChange={value => setDisplay('showOwner', value)} />
            <Toggle id="togStar" label="★ 중요" checked={display.showStar} onChange={value => setDisplay('showStar', value)} />
            <Toggle id="togNew" label="N 신규 배지" checked={display.showNewBadge} onChange={value => setDisplay('showNewBadge', value)} />
            <div
              style={{
                fontSize: '.62rem',
                fontWeight: 700,
                letterSpacing: '.04em',
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                margin: '6px 0 2px',
              }}
            >
              상태
            </div>
            <Toggle id="togStatus" label="진행상태 뱃지" checked={display.showStatus} onChange={value => setDisplay('showStatus', value)} />
            <Toggle id="togMd" label="MD 뱃지" checked={display.showMdBadge} onChange={value => setDisplay('showMdBadge', value)} />
            <div
              style={{
                fontSize: '.62rem',
                fontWeight: 700,
                letterSpacing: '.04em',
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                margin: '6px 0 2px',
              }}
            >
              보조
            </div>
            <Toggle id="togCnt" label="셀 카운터" checked={display.showCellCount} onChange={value => setDisplay('showCellCount', value)} />
            <Toggle id="togUpd" label="수정일" checked={display.showUpdated} onChange={value => setDisplay('showUpdated', value)} />
            <Toggle id="togQuickAdd" label="빠른 추가 버튼" checked={display.showQuickAdd} onChange={value => setDisplay('showQuickAdd', value)} />
          </div>
        </FilterSection>

        <div className="undo-fab" id="undoFab">
          <button
            className="btn btn-s"
            onClick={() => window.doUndo?.()}
            title="실행 취소 (Z)"
            style={{ gap: '6px', width: '100%' }}
          >
            <UndoIcon />
            되돌리기
          </button>
        </div>
      </div>
    </aside>
  );
}
