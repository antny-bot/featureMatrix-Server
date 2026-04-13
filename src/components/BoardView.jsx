/* ══════════════════════════════════════════
   BoardView.jsx — 보드(칸반) React 컴포넌트

   높이 수정: portal root = .board-cols (wrapper div 없음)
              → .bwrap flex 체인 유지 → 컬럼이 화면 끝까지 뻗음

   더 보기: foldCount 기준 초과 시 카드 목록 내부에 cell-more-btn 스타일 버튼
            foldCount = 0 이면 항상 펼침 (버튼 없음)
            boardExpandCol / boardCollapseCol window 브릿지로 expanded 상태 제어

   선택/드래그: board.js의 _boardSel 모듈 변수로 관리 → DOM classList 직접 조작
               CustomEvent(boardSelChange) → useState(boardSel)로 ActionBar 알림
══════════════════════════════════════════ */

import { createPortal } from 'react-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { STATUS_OPTS, STATUS_LBL, STATUS_ACCENT } from '../app/constants.js';
import { getFiltered, isFilterActive, renderCard } from '../app/render.js';
import { getColors } from '../app/theme.js';
import { S, esc, eattr } from '../app/state.js';

/* ── 메인 컴포넌트 ── */
export default function BoardView() {
  const items    = useAppStore(s => s.items);   // 데이터 변경 시 리렌더 트리거
  const foldCount = useAppStore(s => s.settings.boardFoldCount ?? 6);

  /* portal containers: dangerouslySetInnerHTML 마운트 후 존재 */
  const [boardContainer, setBoardContainer] = useState(null);
  const [barContainer,   setBarContainer]   = useState(null);

  /* 컬럼별 펼침 상태 */
  const [expanded, setExpanded] = useState(new Set());

  /* 선택 상태: board.js CustomEvent로 수신 */
  const [boardSel, setBoardSel] = useState([]);

  useEffect(() => {
    setBoardContainer(document.getElementById('boardView'));
    setBarContainer(document.getElementById('boardActionBar'));
  }, []);

  /* boardSelChange 이벤트 수신 */
  useEffect(() => {
    const handler = (e) => setBoardSel(e.detail.sel);
    window.addEventListener('boardSelChange', handler);
    return () => window.removeEventListener('boardSelChange', handler);
  }, []);

  /* 컬럼 펼침/접기 브릿지 (onclick="boardExpandCol('...')" 에서 호출) */
  useEffect(() => {
    window.boardExpandCol   = (colKey) => setExpanded(prev => { const n = new Set(prev); n.add(colKey);    return n; });
    window.boardCollapseCol = (colKey) => setExpanded(prev => { const n = new Set(prev); n.delete(colKey); return n; });
    return () => { delete window.boardExpandCol; delete window.boardCollapseCol; };
  }, []);

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

  /* 선택 Set — renderCard extraClass 적용 (mxSel 패턴과 동일) */
  const selSet = new Set(boardSel);

  /* ── 보드 컬럼 포털 (.board-cols 자체를 portal root로 → wrapper div 없음) ── */
  const boardPortal = createPortal(
    <div className="board-cols">
      {STATUS_OPTS.map(colKey => {
        const colItems      = byCol[colKey];
        const alwaysExpanded = foldCount === 0;
        const isExp          = expanded.has(colKey) || alwaysExpanded;
        const overLimit      = !alwaysExpanded && colItems.length > foldCount;
        const visible        = isExp ? colItems : colItems.slice(0, foldCount);
        const hidden         = colItems.length - foldCount;

        const cardsHtml = visible.map(it => renderCard(it, c, -1, {
          id:          `bcard-${it.key}`,
          extraClass:  selSet.has(it.key) ? 'board-selected' : '',  // mxSel 패턴과 동일
          onclick:     `boardCardClick(event,'${eattr(it.key)}')`,
          ondblclick:  `boardCardDblClick('${eattr(it.key)}')`,
          ondragstart: `boardCardDragStart(event,'${eattr(it.key)}')`,
          ondragend:   'boardCardDragEnd()',
        })).join('');

        /* 더 보기 / 접기 버튼 — dangerouslySetInnerHTML 내부에 포함 */
        const moreHtml = overLimit && !isExp
          ? `<button class="cell-more-btn" onclick="boardExpandCol('${eattr(colKey)}')">▼ ${hidden}개 더보기</button>`
          : overLimit && isExp
          ? `<button class="cell-more-btn" onclick="boardCollapseCol('${eattr(colKey)}')">▲ 접기</button>`
          : '';

        return (
          <div key={colKey} className="board-col">
            {/* 컬럼 헤더 */}
            <div className="board-col-hd" style={{ borderTop: `3px solid ${STATUS_ACCENT[colKey]}` }}>
              <span>
                {esc(colKey)}
                <span className="board-col-cnt">{colItems.length}</span>
              </span>
            </div>

            {/* 카드 영역: dangerouslySetInnerHTML + React drag 이벤트 공존 */}
            <div
              className={`board-col-body${isExp ? ' board-col-body--expanded' : ''}`}
              id={`bbody-${colKey}`}
              onDragOver={e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                e.currentTarget.classList.add('drag-over');
              }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  e.currentTarget.classList.remove('drag-over');
                }
              }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                window.boardDrop?.(e, colKey);
              }}
              dangerouslySetInnerHTML={{ __html: cardsHtml + moreHtml }}
            />
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
