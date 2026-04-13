import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { buildStruct, getFiltered, mxSel, sortCell } from '../app/render.js';
import { getColors } from '../app/theme.js';
import { S } from '../app/state.js';
import { isEditor } from '../app/admin.js';
import FeatureCard from './FeatureCard.jsx';

function CountBadge({ value }) {
  return <span className="gcnt">{value}</span>;
}

function EmptyState() {
  if (S.settings.storageMode === 'server') {
    return (
      <div className="empty">
        <div style={{ fontSize: '2rem', opacity: .3 }}>🌐</div>
        <div style={{ fontSize: '.875rem', textAlign: 'center' }}>
          서버에 데이터가 없거나 연결을 확인해주세요.
          <br />
          <span style={{ fontSize: '.75rem', color: 'var(--text-3)' }}>관리자에게 문의하거나 로그인 후 다시 시도하세요.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="empty">
      <div style={{ fontSize: '2rem', opacity: .3 }}>📋</div>
      <div style={{ fontSize: '.875rem', textAlign: 'center' }}>표시할 기능이 없습니다.</div>
    </div>
  );
}

function getMatrixData(items) {
  const structure = buildStruct(items);
  const cellMap = {};
  const counts = {
    groups: {},
    subGroups: {},
    categories: {},
    subCategories: {},
  };

  items.forEach(item => {
    const group = item.group || '(미분류)';
    const subGroup = item.subGroup || '';
    const category = item.category || '(미분류)';
    const subCategory = item.subCategory || '';
    const cellKey = `${group}|||${subGroup}|||${category}|||${subCategory}`;
    if (!cellMap[cellKey]) cellMap[cellKey] = [];
    cellMap[cellKey].push(item);

    counts.groups[group] = (counts.groups[group] || 0) + 1;
    counts.subGroups[`${group}|||${subGroup}`] = (counts.subGroups[`${group}|||${subGroup}`] || 0) + 1;
    counts.categories[category] = (counts.categories[category] || 0) + 1;
    counts.subCategories[`${category}|||${subCategory}`] = (counts.subCategories[`${category}|||${subCategory}`] || 0) + 1;
  });

  Object.keys(cellMap).forEach(key => {
    cellMap[key] = sortCell(cellMap[key]);
  });

  return { cellMap, counts, structure };
}

export default function MatrixView() {
  const items = useAppStore(s => s.items);
  const editLocks = useAppStore(s => s.editLocks);
  const previews = useAppStore(s => s.previews);
  const settings = useAppStore(s => s.settings);
  const display = useAppStore(s => s.display);
  const filters = useAppStore(s => s.filters);
  const searchQ = useAppStore(s => s.searchQ);
  const cellFold = useAppStore(s => s.settings.cellFold);

  const [container, setContainer] = useState(null);
  const [expandedCells, setExpandedCells] = useState(new Set());
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(mxSel));
  const [dragKeys, setDragKeys] = useState(() => new Set());

  useEffect(() => {
    setContainer(document.getElementById('matrixView'));
  }, []);

  useEffect(() => {
    setExpandedCells(new Set());
  }, [filters, searchQ, cellFold]);

  useEffect(() => {
    if (container) {
      container.className = `mwrap${settings.matrixWidth === 'fluid' ? ' fluid' : ''}`;
    }
  }, [container, settings.matrixWidth]);

  useEffect(() => {
    window.expandCell = (event, cellKey) => {
      event.stopPropagation();
      setExpandedCells(prev => {
        const next = new Set(prev);
        next.add(cellKey);
        return next;
      });
    };
    window.collapseCell = (event, cellKey) => {
      event.stopPropagation();
      setExpandedCells(prev => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    };
    return () => {
      delete window.expandCell;
      delete window.collapseCell;
    };
  }, []);

  useEffect(() => {
    const handler = event => setSelectedKeys(new Set(event.detail.sel));
    window.addEventListener('mxSelChange', handler);
    return () => window.removeEventListener('mxSelChange', handler);
  }, []);

  useEffect(() => {
    const handler = event => setDragKeys(new Set(event.detail.keys || []));
    window.addEventListener('mxDragState', handler);
    return () => window.removeEventListener('mxDragState', handler);
  }, []);

  const filteredItems = useMemo(() => getFiltered(), [items, filters, searchQ, settings, display, editLocks, previews]);
  const matrix = useMemo(() => getMatrixData(filteredItems), [filteredItems]);
  const colors = getColors();

  if (!container) return null;

  if (!filteredItems.length) {
    return createPortal(<EmptyState />, container);
  }

  const { structure, cellMap, counts } = matrix;
  const showCount = display.showCellCount;
  const totalSubCols = structure.groups.reduce((acc, group) => acc + structure.gsubs[group].length, 0);
  const catW = settings.catW || 12;
  const subCatW = settings.subCatW || 72;
  const tableMinW = catW + subCatW + totalSubCols * (settings.colW || 130);

  return createPortal(
    <div className="mscroll">
      <table className="mtable" style={{ minWidth: `${tableMinW}px` }}>
        <thead className="mx-thead-sticky">
          <tr>
            <th className="m-corner" rowSpan="2" style={{ width: `${catW}px`, minWidth: `${catW}px`, maxWidth: `${catW}px` }} />
            <th className="m-corner" rowSpan="2" style={{ width: `${subCatW}px`, minWidth: `${subCatW}px`, maxWidth: `${subCatW}px` }} />
            {structure.groups.map(group => (
              <th className="m-ghd" colSpan={structure.gsubs[group].length} key={group}>
                {group}
                {showCount && <CountBadge value={counts.groups[group] || 0} />}
              </th>
            ))}
          </tr>
          <tr>
            {structure.groups.flatMap(group => (
              structure.gsubs[group].map(subGroup => (
                <th className="m-sghd" key={`${group}:${subGroup}`}>
                  {subGroup || '—'}
                  {showCount && <CountBadge value={counts.subGroups[`${group}|||${subGroup}`] || 0} />}
                </th>
              ))
            ))}
          </tr>
        </thead>
        <tbody>
          {structure.cats.flatMap(category => (
            structure.csubs[category].map((subCategory, subCategoryIndex) => {
              const subCategoryKey = `${category}|||${subCategory}`;
              return (
                <tr key={`${category}:${subCategory}`}>
                  {subCategoryIndex === 0 && (
                    <td
                      className="m-cathd"
                      rowSpan={structure.csubs[category].length}
                      style={{ width: `${catW}px`, minWidth: `${catW}px`, maxWidth: `${catW}px` }}
                    >
                      {category}
                      {showCount && <CountBadge value={counts.categories[category] || 0} />}
                    </td>
                  )}
                  <td className="m-subcat" style={{ width: `${subCatW}px`, minWidth: `${subCatW}px`, maxWidth: `${subCatW}px` }}>
                    {subCategory || '—'}
                    {showCount && <CountBadge value={counts.subCategories[subCategoryKey] || 0} />}
                  </td>
                  {structure.groups.flatMap(group => (
                    structure.gsubs[group].map(subGroup => {
                      const cellKey = `${group}|||${subGroup}|||${category}|||${subCategory}`;
                      const cellItems = cellMap[cellKey] || [];
                      const fold = settings.cellFold;
                      const isExpanded = expandedCells.has(cellKey) || !!searchQ || fold === 0;
                      const visible = isExpanded ? cellItems : cellItems.slice(0, fold);
                      const hidden = cellItems.length - visible.length;
                      const canQuickAdd = isEditor() && display.showQuickAdd;

                      return (
                        <td
                          className="m-cell"
                          style={{ background: 'var(--bg)' }}
                          data-g={group}
                          data-sg={subGroup}
                          data-c={category}
                          data-sc={subCategory}
                          key={cellKey}
                          onDragEnter={event => window.onDE?.(event)}
                          onDragOver={event => window.onDO?.(event)}
                          onDragLeave={event => window.onDL?.(event)}
                          onDrop={event => window.onDrop?.(event)}
                        >
                          {visible.map(item => (
                            <FeatureCard
                              key={item.key}
                              item={item}
                              colors={colors}
                              animationIndex={-1}
                              extraClass={[
                                selectedKeys.has(item.key) ? 'mxsel' : '',
                                dragKeys.has(item.key) ? 'dragging' : '',
                              ].filter(Boolean).join(' ')}
                              onClick={event => {
                                window.mxCardClick?.(event, item.key);
                                setSelectedKeys(new Set(mxSel));
                              }}
                              onDoubleClick={() => window.openEditOrMd?.(item.key)}
                              onDragStart={event => window.onDS?.(event, item.key)}
                              onDragEnd={event => window.onDEnd?.(event)}
                            />
                          ))}
                          {hidden > 0 && (
                            <button className="cell-more-btn" onClick={event => window.expandCell?.(event, cellKey)}>
                              ▼ {hidden}개 더보기
                            </button>
                          )}
                          {isExpanded && cellItems.length > fold && fold > 0 && (
                            <button className="cell-more-btn" onClick={event => window.collapseCell?.(event, cellKey)}>
                              ▲ 접기
                            </button>
                          )}
                          {canQuickAdd && (
                            <button
                              className="cell-quick-add-btn"
                              onClick={event => {
                                event.stopPropagation();
                                window.openAddInCell?.(group, subGroup, category, subCategory);
                              }}
                            >
                              + 추가
                            </button>
                          )}
                        </td>
                      );
                    })
                  ))}
                </tr>
              );
            })
          ))}
        </tbody>
      </table>
    </div>,
    container
  );
}
