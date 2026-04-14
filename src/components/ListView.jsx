import { useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { FLABELS, STATUS_CLS } from '../app/constants.js';
import { getFiltered, getVisibleCols, normOwner } from '../utils/itemUtils.js';
import { useListActions } from '../hooks/useListActions.js';
import { useModals } from '../hooks/useModals.js';

function highlightText(value, query) {
  const text = String(value || '');
  if (!query || !text) return text;

  try {
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.split(re).map((part, index) => (
      part.toLowerCase() === query.toLowerCase()
        ? <mark className="search-hl" key={`${part}:${index}`}>{part}</mark>
        : part
    ));
  } catch {
    return text;
  }
}

function PriorityPill({ priority }) {
  const cls = priority === '상' ? 'h' : priority === '중' ? 'm' : 'l';
  return <span className={`pp ${cls}`}>{priority}</span>;
}

function StatusBadge({ status, labels }) {
  if (!status) return null;
  return <span className={`status-badge ${STATUS_CLS[status] || ''}`}>{labels?.[status] || status}</span>;
}

function TextCell({ value, query, className, title }) {
  return <td className={className} title={title}>{highlightText(value, query)}</td>;
}

function ListCell({ item, columnKey, query }) {
  switch (columnKey) {
    case 'key':
      return <TextCell className="ck" value={item.key} query={query} />;
    case 'name':
      return <TextCell className="cn" value={item.name} query={query} />;
    case 'priority':
      return <td key="priority"><PriorityPill priority={item.priority} /></td>;
    case 'status': {
      const settings = useAppStore.getState().settings;
      return <td key="status"><StatusBadge status={item.status} labels={settings.statusLabels} /></td>;
    }
    case 'isImportant':
      return <td key="isImportant" style={{ textAlign: 'center' }}>{item.isImportant === 'Y' && <span style={{ color: 'var(--accent)' }}>★</span>}</td>;
    case 'isDelete':
      return <td key="isDelete" style={{ textAlign: 'center' }}>{item.isDelete === 'Y' && <span style={{ color: 'var(--danger)', fontSize: '.7rem', fontWeight: 700 }}>삭제</span>}</td>;
    case 'owner': {
      const owner = normOwner(item.owner);
      return <TextCell key="owner" value={owner} query={query} />;
    }
    case 'desc':
    case 'memo': {
      const raw = item[columnKey] || '';
      const text = raw.replace(/\n/g, ' ');
      const display = text.length > 60 ? `${text.slice(0, 60)}…` : text;
      return <TextCell key={columnKey} className="desc-cell" title={raw} value={display} query={query} />;
    }
    default:
      return <TextCell key={columnKey} value={item[columnKey] || ''} query={query} />;
  }
}

export default function ListView() {
  const store = useAppStore();
  const items = store.items;
  const settings = store.settings;
  const filters = store.filters;
  const searchQ = store.searchQ;
  const sort = store.sort;
  const bulkSelectionKeys = store.bulkSelectionKeys;
  
  const { bulkToggle, bulkToggleAll, bulkClearSelection } = useListActions();
  const { openEditModal, openMdModal } = useModals();

  const selectedKeySet = useMemo(() => new Set(bulkSelectionKeys), [bulkSelectionKeys]);

  const visibleColumns = useMemo(
    () => getVisibleCols(settings.columns),
    [settings.columns]
  );

  const rows = useMemo(() => {
    const filtered = getFiltered(items, filters, searchQ);
    return filtered.slice().sort((a, b) => {
      const va = a[sort.key] || '';
      const vb = b[sort.key] || '';
      const result = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === 'asc' ? result : -result;
    });
  }, [items, filters, searchQ, sort]);

  useEffect(() => {
    if (rows.length === 0 && bulkSelectionKeys.length > 0) {
      bulkClearSelection();
    }
  }, [bulkSelectionKeys.length, rows.length, bulkClearSelection]);

  if (!rows.length) {
    return (
      <div className="empty"><div style={{ fontSize: '.875rem' }}>표시할 기능이 없습니다.</div></div>
    );
  }

  const allChecked = rows.length > 0 && rows.every(item => selectedKeySet.has(item.key));

  const toggleSort = (key) => {
    const s = { ...store.sort };
    if (s.key === key) {
      s.dir = s.dir === 'asc' ? 'desc' : 'asc';
    } else {
      s.key = key;
      s.dir = 'asc';
    }
    store.setState({ sort: s });
  };

  return (
    <div className="ltbl-wrap">
      <div className="ltbl-scroll">
        <table className="ltbl">
          <thead>
            <tr>
              <th style={{ width: '32px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={event => bulkToggleAll(event.target.checked, rows)}
                  title="전체 선택"
                />
              </th>
              {visibleColumns.map(column => {
                const sortClass = sort.key === column.key ? (sort.dir === 'asc' ? 'sa' : 'sd') : '';
                return (
                  <th className={sortClass} onClick={() => toggleSort(column.key)} key={column.key}>
                    {FLABELS[column.key]}
                  </th>
                );
              })}
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(item => {
              const checked = selectedKeySet.has(item.key);
              const rowClass = [
                item.isDelete === 'Y' ? 'rdel' : '',
                checked ? 'bulk-selected' : '',
              ].filter(Boolean).join(' ');

              return (
                <tr className={rowClass} key={item.key}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => bulkToggle(item.key)}
                    />
                  </td>
                  {visibleColumns.map(column => (
                    <ListCell item={item} columnKey={column.key} query={searchQ} key={column.key} />
                  ))}
                  <td>
                    <button className="btn btn-g btn-sm" onClick={() => openEditModal(item.key)}>편집</button>
                    {item.mdContent && (
                      <button
                        className="btn btn-g btn-sm"
                        onClick={() => openMdModal(item.key)}
                        style={{ marginLeft: '3px' }}
                      >
                        MD
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
