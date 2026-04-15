import { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { STATUS_OPTS, STATUS_ACCENT } from '../app/constants.js';
import { getFiltered, isFilterActive } from '../utils/itemUtils.js';
import { getColors } from '../app/theme.js';
import FeatureCard from './FeatureCard.jsx';
import { useBoardActions } from '../hooks/useBoardActions.js';
import { useModals } from '../hooks/useModals.js';

/* ── 액션바 ── */
function BoardActionBar({ boardSel, onMove, onClear }) {
  if (boardSel.length === 0) return null;

  return (
    <div id="boardActionBar" className="board-action-bar on" onClick={event => event.stopPropagation()}>
      <span>{boardSel.length}개 선택</span>
      {STATUS_OPTS.map(st => (
        <button key={st} onClick={() => onMove(st)}>
          {onMove.labels?.[st] || st}
        </button>
      ))}
      <button className="bar-close" onClick={onClear}>✕</button>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
export default function BoardView() {
  const store = useAppStore();
  const items = store.items;
  const editLocks = store.editLocks;
  const previews = store.previews;
  const filters = store.filters;
  const searchQ = store.searchQ;
  const boardSel = store.boardSelectionKeys || [];
  const foldCount = store.settings.boardFoldCount ?? 6;
  const { handleCardClick, clearSelection, moveItems, lockKeys, unlockKeys } = useBoardActions();
  const { openMdModal } = useModals();

  const [expanded, setExpanded] = useState(new Set());
  const [dragOverCol, setDragOverCol] = useState(null);

  /* ── 컬럼 데이터 계산 ── */
  const filteredItems = useMemo(
    () => (
      isFilterActive(filters, searchQ)
        ? getFiltered(items, filters, searchQ)
        : items.filter(it => it.isDelete !== 'Y')
    ),
    [items, filters, searchQ]
  );
  
  const colors = getColors();

  const byCol = useMemo(() => {
    const map = Object.fromEntries(STATUS_OPTS.map(k => [k, []]));
    filteredItems.forEach(it => {
      const st = it.status || 'backlog';
      if (map[st]) map[st].push(it);
      else map.backlog.push(it);
    });
    return map;
  }, [filteredItems]);

  const onDragStart = useCallback((e, key) => {
    store.setIsDragging(true);
    const keysToMove = boardSel.includes(key) ? boardSel : [key];
    store.setBoardSelectionKeys(keysToMove);
    
    // 타 사용자 락 확인 로직 (MatrixView와 동일하게 추가 가능)
    lockKeys(new Set(keysToMove));
    e.dataTransfer.effectAllowed = 'move';
  }, [store, boardSel, lockKeys]);

  const onDragEnd = useCallback(() => {
    unlockKeys(new Set(store.boardSelectionKeys));
    store.setIsDragging(false);
    setDragOverCol(null);
  }, [store, unlockKeys]);

  const onDrop = useCallback((e, colKey) => {
    e.preventDefault();
    setDragOverCol(null);
    moveItems(new Set(store.boardSelectionKeys), colKey);
  }, [store, moveItems]);

  const handleBoardClick = useCallback(() => {
    if (store.boardSelectionKeys.length > 0) clearSelection();
  }, [store.boardSelectionKeys.length, clearSelection]);

  return (
    <>
      <div className="board-cols" onClick={handleBoardClick}>
        {STATUS_OPTS.map(colKey => {
          const colItems      = byCol[colKey] || [];
          const alwaysExpanded = foldCount === 0;
          const isExp          = expanded.has(colKey) || alwaysExpanded;
          const overLimit      = !alwaysExpanded && colItems.length > foldCount;
          const visible        = isExp ? colItems : colItems.slice(0, foldCount);
          const hidden         = colItems.length - foldCount;

          return (
            <div key={colKey} className="board-col">
              <div className="board-col-hd" style={{ borderTop: `3px solid ${STATUS_ACCENT[colKey]}` }}>
                <span>
                  {store.settings.statusLabels?.[colKey] || colKey}
                  <span className="board-col-cnt">{colItems.length}</span>
                </span>
              </div>

              <div
                className={[
                  'board-col-body',
                  isExp ? 'board-col-body--expanded' : '',
                  dragOverCol === colKey ? 'drag-over' : '',
                ].filter(Boolean).join(' ')}
                onDragOver={e => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverCol(colKey);
                }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setDragOverCol(null);
                  }
                }}
                onDrop={e => onDrop(e, colKey)}
              >
                {visible.map(item => (
                  <FeatureCard
                    key={item.key}
                    item={item}
                    colors={colors}
                    extraClass={[
                      boardSel.includes(item.key) ? 'board-selected' : '',
                      store.isDragging && boardSel.includes(item.key) ? 'dragging' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={event => handleCardClick(event, item.key)}
                    onDoubleClick={() => openMdModal(item.key)}
                    onDragStart={event => onDragStart(event, item.key)}
                    onDragEnd={onDragEnd}
                  />
                ))}
                {overLimit && !isExp && (
                  <button className="cell-more-btn" onClick={() => setExpanded(p => new Set(p).add(colKey))}>▼ {hidden}개 더보기</button>
                )}
                {overLimit && isExp && (
                  <button className="cell-more-btn" onClick={() => setExpanded(p => { const next = new Set(p); next.delete(colKey); return next; })}>▲ 접기</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <BoardActionBar 
        boardSel={boardSel} 
        onMove={Object.assign((st) => moveItems(new Set(boardSel), st), { labels: store.settings.statusLabels })}
        onClear={clearSelection}
      />
    </>
  );
}
