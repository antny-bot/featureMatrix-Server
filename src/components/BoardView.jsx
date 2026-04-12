/* ══════════════════════════════════════════
   BoardView.jsx — 보드(칸반) React 컴포넌트

   높이 수정: portal root = .board-cols (wrapper div 없음)
              → .bwrap flex 체인 유지 → 컬럼이 화면 끝까지 뻗음

   아코디언: FOLD_COUNT 초과 시 "더 보기" 버튼 표시
             컬럼별 expanded Set으로 상태 관리
══════════════════════════════════════════ */

import { createPortal } from 'react-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { STATUS_OPTS, STATUS_LBL, STATUS_ACCENT } from '../app/constants.js';
import { getFiltered, isFilterActive, renderCard } from '../app/render.js';
import { getColors } from '../app/theme.js';
import { S, esc, eattr } from '../app/state.js';

/* foldCount는 useAppStore(s => s.settings.boardFoldCount) 로 읽음 */

/* ── 메인 컴포넌트 ── */
export default function BoardView() {
  const items    = useAppStore(s => s.items);   // 데이터 변경 시 리렌더 트리거
  const boardSel = useAppStore(s => s.boardSel);

  /* portal containers: dangerouslySetInnerHTML 마운트 후 존재 */
  const [boardContainer, setBoardContainer] = useState(null);
  const [barContainer,   setBarContainer]   = useState(null);

  /* 컬럼별 펼침 상태 */
  const [expanded, setExpanded] = useState(new Set());
  const foldCount = useAppStore(s => s.settings.boardFoldCount ?? 6);

  useEffect(() => {
    setBoardContainer(document.getElementById('boardView'));
    setBarContainer(document.getElementById('boardActionBar'));
  }, []);

  const toggleExpand = useCallback((colKey) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(colKey)) next.delete(colKey); else next.add(colKey);
      return next;
    });
  }, []);

  const selSet = useMemo(() => new Set(boardSel), [boardSel]);

  if (!boardContainer || !barContainer) return null;

  /* ── 컬럼 데이터 계산 ── */
  const filteredItems = isFilterActive()
    ? getFiltered()
    : S.items.filter(it => it.isDelete !== 'Y');
  const c = getColors();

  const byCol = Object.fromEntries(STATUS_OPTS.map(k => [k, []]));
  filteredItems.forEach(it => {
    if (byCol[it.status]) byCol[it.status].push(it);
    else byCol['대기'].push(it);
  });

  /* ── 보드 컬럼 포털 (.board-cols 자체를 portal root로 → wrapper div 없음) ── */
  const boardPortal = createPortal(
    <div className="board-cols">
      {STATUS_OPTS.map(colKey => {
        const colItems  = byCol[colKey];
        const isExp     = expanded.has(colKey);
        const overLimit = colItems.length > foldCount;
        const visible   = isExp ? colItems : colItems.slice(0, foldCount);
        const hidden    = colItems.length - foldCount;

        const cardsHtml = visible.map(it => renderCard(it, c, -1, {
          id:          `bcard-${it.key}`,
          extraClass:  selSet.has(it.key) ? 'board-selected' : '',
          onclick:     `boardCardClick(event,'${eattr(it.key)}')`,
          ondblclick:  `boardCardDblClick('${eattr(it.key)}')`,
          ondragstart: `boardCardDragStart(event,'${eattr(it.key)}')`,
          ondragend:   'boardCardDragEnd()',
        })).join('');

        return (
          <div key={colKey} className="board-col">
            {/* 컬럼 헤더 */}
            <div className="board-col-hd" style={{ borderTop: `3px solid ${STATUS_ACCENT[colKey]}` }}>
              <span>
                {esc(colKey)}
                <span className="board-col-cnt">{colItems.length}</span>
              </span>
            </div>

            {/* 카드 영역: dangerouslySetInnerHTML + React drag 이벤트 공존 가능 */}
            <div
              className={`board-col-body${isExp ? ' board-col-body--expanded' : ''}`}
              id={`bbody-${colKey}`}
              onDragOver={e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                e.currentTarget.classList.add('drag-over');
              }}
              onDragLeave={e => {
                /* 자식 요소로 이동할 때는 무시 */
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  e.currentTarget.classList.remove('drag-over');
                }
              }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                window.boardDrop?.(e, colKey);
              }}
              dangerouslySetInnerHTML={{ __html: cardsHtml }}
            />

            {/* 더 보기 / 접기 버튼 */}
            {overLimit && !isExp && (
              <button
                className="board-more-btn"
                onClick={() => toggleExpand(colKey)}
              >
                더 보기 ({hidden}개)
              </button>
            )}
            {overLimit && isExp && (
              <button
                className="board-more-btn board-more-btn--fold"
                onClick={() => toggleExpand(colKey)}
              >
                접기
              </button>
            )}
          </div>
        );
      })}
    </div>,
    boardContainer
  );

  /* ── 액션바 포털 ── */
  const barPortal = createPortal(
    <BoardActionBar boardSel={boardSel} container={barContainer} />,
    barContainer
  );

  return <>{boardPortal}{barPortal}</>;
}

/* ── 액션바 ── */
function BoardActionBar({ boardSel, container }) {
  useEffect(() => {
    container.classList.toggle('on', boardSel.length > 0);
  }, [boardSel.length, container]);

  if (boardSel.length === 0) return null;

  return (
    <>
      <span>{boardSel.length}개 선택</span>
      {STATUS_OPTS.map(st => (
        <button key={st} onClick={() => window.boardMoveSelected?.(st)}>
          {STATUS_LBL[st]}
        </button>
      ))}
      <button className="bar-close" onClick={() => window.boardClearSel?.()}>✕</button>
    </>
  );
}
