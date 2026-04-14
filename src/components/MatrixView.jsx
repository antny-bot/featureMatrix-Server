import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { buildStruct, getFiltered, sortCell } from '../utils/itemUtils.js';
import { getColors } from '../app/theme.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import FeatureCard from './FeatureCard.jsx';
import { useMatrixActions } from '../hooks/useMatrixActions.js';
import { useDBSync } from '../hooks/useDBSync.js';
import { useModals } from '../hooks/useModals.js';

function CountBadge({ value }) {
  return <span className="gcnt">{value}</span>;
}

function EmptyState() {
  const storageMode = useAppStore(s => s.settings.storageMode);
  if (storageMode === 'server') {
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
  const store = useAppStore();
  const items = store.items;
  const editLocks = store.editLocks;
  const previews = store.previews;
  const settings = store.settings;
  const display = store.display;
  const filters = store.filters;
  const searchQ = store.searchQ;
  const cellFold = store.settings.cellFold;
  const selectedKeys = store.mxSelectionKeys;
  const isDragging = store.isDragging;
  const dragKey = store.dragKey;

  const { handleCardClick, clearSelection, moveItems, lockKeys, unlockKeys } = useMatrixActions();
  const { lockItem, unlockItem } = useDBSync();
  const { openEditModal, openAddInCell } = useModals();
  const { isEditor: editorOk } = useAuth();

  const [expandedCells, setExpandedCells] = useState(new Set());
  const [dropCellKey, setDropCellKey] = useState(null);

  useEffect(() => {
    setExpandedCells(new Set());
  }, [filters, searchQ, settings.cellFold]);

  const toggleExpand = useCallback((e, cellKey, expand) => {
    e.stopPropagation();
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (expand) next.add(cellKey);
      else next.delete(cellKey);
      return next;
    });
  }, []);

  const filteredItems = useMemo(() => getFiltered(items, filters, searchQ), [items, filters, searchQ]);
  const matrix = useMemo(() => getMatrixData(filteredItems), [filteredItems]);
  const colors = getColors();

  // 드래그 핸들러
  const onDragStart = useCallback((e, key) => {
    store.setIsDragging(true);
    store.setMxSelectionKeys(selectedKeys.includes(key) ? selectedKeys : [key]);
    
    // 타 사용자 락 확인
    const keysToMove = selectedKeys.includes(key) ? selectedKeys : [key];
    const lockedOther = keysToMove.filter(k => editLocks[k] && editLocks[k].user !== (settings.userName || '익명'));
    if (lockedOther.length) {
      store.notify(`${editLocks[lockedOther[0]].user}님이 편집 중인 항목은 이동할 수 없습니다.`, 'warning');
      store.setIsDragging(false);
      e.preventDefault();
      return;
    }
    
    lockKeys(keysToMove);
    e.dataTransfer.effectAllowed = 'move';
  }, [store, selectedKeys, editLocks, settings.userName, lockKeys]);

  const onDragEnd = useCallback(() => {
    const keys = store.mxSelectionKeys;
    unlockKeys(keys);
    store.setIsDragging(false);
    setDropCellKey(null);
  }, [store, unlockKeys]);

  const onDrop = useCallback((e, target) => {
    e.preventDefault();
    setDropCellKey(null);
    if (!store.isDragging) return;
    moveItems(store.mxSelectionKeys, target);
  }, [store, moveItems]);

  const handleCanvasClick = useCallback(() => {
    if (store.mxSelectionKeys.length > 0) clearSelection();
  }, [store.mxSelectionKeys.length, clearSelection]);

  if (!filteredItems.length) {
    return <EmptyState />;
  }

  const { structure, cellMap, counts } = matrix;
  const showCount = display.showCellCount;
  const totalSubCols = structure.groups.reduce((acc, group) => acc + structure.gsubs[group].length, 0);
  const catW = settings.catW || 12;
  const subCatW = settings.subCatW || 72;
  const tableMinW = catW + subCatW + totalSubCols * (settings.colW || 130);

  return (
    <div className="mscroll" onClick={handleCanvasClick}>
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
                      const canQuickAdd = editorOk && display.showQuickAdd;

                      return (
                        <td
                          className={`m-cell${dropCellKey === cellKey ? ' dov' : ''}`}
                          style={{ background: 'var(--bg)' }}
                          key={cellKey}
                          onDragEnter={() => setDropCellKey(cellKey)}
                          onDragOver={e => e.preventDefault()}
                          onDragLeave={e => {
                            if (!e.currentTarget.contains(e.relatedTarget)) setDropCellKey(null);
                          }}
                          onDrop={e => onDrop(e, { g: group, sg: subGroup, c: category, sc: subCategory })}
                        >
                          {visible.map(item => (
                            <FeatureCard
                              key={item.key}
                              item={item}
                              colors={colors}
                              extraClass={[
                                selectedKeys.includes(item.key) ? 'mxsel' : '',
                                isDragging && selectedKeys.includes(item.key) ? 'dragging' : '',
                              ].filter(Boolean).join(' ')}
                              onClick={event => handleCardClick(event, item.key)}
                              onDoubleClick={() => openEditModal(item.key)}
                              onDragStart={event => onDragStart(event, item.key)}
                              onDragEnd={onDragEnd}
                            />
                          ))}
                          {hidden > 0 && (
                            <button className="cell-more-btn" onClick={event => toggleExpand(event, cellKey, true)}>
                              ▼ {hidden}개 더보기
                            </button>
                          )}
                          {isExpanded && cellItems.length > fold && fold > 0 && (
                            <button className="cell-more-btn" onClick={event => toggleExpand(event, cellKey, false)}>
                              ▲ 접기
                            </button>
                          )}
                          {canQuickAdd && (
                            <button
                              className="cell-quick-add-btn"
                              onClick={event => {
                                event.stopPropagation();
                                openAddInCell(group, subGroup, category, subCategory);
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
    </div>
  );
}
