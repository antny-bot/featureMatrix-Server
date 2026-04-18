import { useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { STATUS_OPTS, STATUS_ACCENT } from '../app/constants.js';
import { getFiltered, isFilterActive } from '../utils/itemUtils.js';
import { getColors } from '../app/theme.js';
import FeatureCard from './FeatureCard.jsx';
import { useBoardActions } from '../hooks/useBoardActions.js';
import { useModals } from '../hooks/useModals.js';

interface OnMoveWithLabels {
  (st: string): void;
  labels?: Record<string, string>;
}

interface BoardActionBarProps {
  boardSel: string[];
  onMove: OnMoveWithLabels;
  onClear: () => void;
}

function BoardActionBar({ boardSel, onMove, onClear }: BoardActionBarProps) {
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

export default function BoardView() {
  const items        = useAppStore(s => s.items);
  const filters      = useAppStore(s => s.filters);
  const searchQ      = useAppStore(s => s.searchQ);
  const boardSel     = useAppStore(s => s.boardSelectionKeys || []);
  const foldCount    = useAppStore(s => s.settings.boardFoldCount ?? 6);
  const isDragging   = useAppStore(s => s.isDragging);
  const statusLabels = useAppStore(s => s.settings.statusLabels);
  const { handleCardClick, clearSelection, moveItems, lockKeys, unlockKeys } = useBoardActions();
  const { openMdModal } = useModals();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

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
    const map = Object.fromEntries(STATUS_OPTS.map(k => [k, [] as typeof items]));
    filteredItems.forEach(it => {
      const st = it.status || 'backlog';
      if (map[st]) map[st].push(it);
      else map.backlog.push(it);
    });
    return map;
  }, [filteredItems]);

  const onDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, key: string) => {
    const { setIsDragging, setBoardSelectionKeys, boardSelectionKeys } = useAppStore.getState();
    setIsDragging(true);
    const keysToMove = boardSelectionKeys.includes(key) ? boardSelectionKeys : [key];
    setBoardSelectionKeys(keysToMove);
    lockKeys(keysToMove);
    e.dataTransfer.effectAllowed = 'move';
  }, [lockKeys]);

  const onDragEnd = useCallback(() => {
    const { boardSelectionKeys, setIsDragging } = useAppStore.getState();
    unlockKeys(boardSelectionKeys);
    setIsDragging(false);
    setDragOverCol(null);
  }, [unlockKeys]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>, colKey: string) => {
    e.preventDefault();
    setDragOverCol(null);
    moveItems(new Set(useAppStore.getState().boardSelectionKeys), colKey);
  }, [moveItems]);

  const handleBoardClick = useCallback(() => {
    if (useAppStore.getState().boardSelectionKeys.length > 0) clearSelection();
  }, [clearSelection]);

  return (
    <>
      <div className="board-cols" onClick={handleBoardClick}>
        {STATUS_OPTS.map(colKey => {
          const colItems       = byCol[colKey] || [];
          const alwaysExpanded = foldCount === 0;
          const isExp          = expanded.has(colKey) || alwaysExpanded;
          const overLimit      = !alwaysExpanded && colItems.length > foldCount;
          const visible        = isExp ? colItems : colItems.slice(0, foldCount);
          const hidden         = colItems.length - foldCount;

          return (
            <div key={colKey} className="board-col">
              <div className="board-col-hd" style={{ borderTop: `3px solid ${(STATUS_ACCENT as Record<string, string>)[colKey]}` }}>
                <span>
                  {statusLabels?.[colKey] || colKey}
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
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
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
                      isDragging && boardSel.includes(item.key) ? 'dragging' : '',
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
        onMove={Object.assign((st: string) => moveItems(new Set(boardSel), st), { labels: statusLabels })}
        onClear={clearSelection}
      />
    </>
  );
}
