/* ══════════════════════════════════════════
   BoardView.jsx — 보드(칸반) React 컴포넌트 (Phase 4)

   전략:
   - createPortal 두 개: #boardView(컬럼), #boardActionBar(액션바)
   - 카드 HTML은 renderCard() 재사용 → dangerouslySetInnerHTML
   - 선택 상태: Zustand store.boardSel (board.js → setStore 호출)
   - 드래그 이벤트: inline 핸들러로 window.boardCard* 함수 호출 (board.js에서 Zustand 업데이트)
   - useAppStore(items) 구독 → items 변경 시 자동 리렌더
══════════════════════════════════════════ */

import { createPortal } from 'react-dom';
import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { STATUS_OPTS, STATUS_LBL, STATUS_ACCENT } from '../app/constants.js';
import { getFiltered, isFilterActive, renderCard } from '../app/render.js';
import { getColors } from '../app/theme.js';
import { S, esc, eattr } from '../app/state.js';

/* ── 보드 컬럼 HTML 생성 (renderBoard 로직과 동일) ── */
function buildBoardHtml(selSet) {
  const items = isFilterActive() ? getFiltered() : S.items.filter(it => it.isDelete !== 'Y');
  const c     = getColors();

  const byCol = Object.fromEntries(STATUS_OPTS.map(k => [k, []]));
  items.forEach(it => {
    if (byCol[it.status]) byCol[it.status].push(it);
    else byCol['대기'].push(it);
  });

  return `<div class="board-cols">${
    STATUS_OPTS.map(colKey => `
      <div class="board-col">
        <div class="board-col-hd" style="border-top:3px solid ${STATUS_ACCENT[colKey]}">
          <span>${esc(colKey)}<span class="board-col-cnt">${byCol[colKey].length}</span></span>
        </div>
        <div class="board-col-body"
          id="bbody-${eattr(colKey)}"
          ondragover="boardDragOver(event,'${eattr(colKey)}')"
          ondragleave="boardDragLeave(event,'${eattr(colKey)}')"
          ondrop="boardDrop(event,'${eattr(colKey)}')">
          ${byCol[colKey].map(it => renderCard(it, c, -1, {
            id:          `bcard-${it.key}`,
            extraClass:  selSet.has(it.key) ? 'board-selected' : '',
            onclick:     `boardCardClick(event,'${eattr(it.key)}')`,
            ondblclick:  `boardCardDblClick('${eattr(it.key)}')`,
            ondragstart: `boardCardDragStart(event,'${eattr(it.key)}')`,
            ondragend:   'boardCardDragEnd()',
          })).join('')}
        </div>
      </div>`
    ).join('')
  }</div>`;
}

/* ── 보드 컬럼 포털 ── */
function BoardColumns({ container, selSet, items }) {
  const html = useMemo(
    () => buildBoardHtml(selSet),
    // items 배열 참조 + selSet 크기/내용 변경 시 재계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, selSet]
  );

  return createPortal(
    <div dangerouslySetInnerHTML={{ __html: html }} />,
    container
  );
}

/* ── 액션바 포털 ── */
function BoardActionBar({ container, boardSel }) {
  /* on 클래스 토글: portal이 container 자체의 class를 제어 못하므로 imperative */
  useEffect(() => {
    container.classList.toggle('on', boardSel.length > 0);
  }, [boardSel.length, container]);

  if (boardSel.length === 0) return createPortal(<></>, container);

  return createPortal(
    <>
      <span>{boardSel.length}개 선택</span>
      {STATUS_OPTS.map(st => (
        <button key={st} onClick={() => window.boardMoveSelected?.(st)}>
          {STATUS_LBL[st]}
        </button>
      ))}
      <button className="bar-close" onClick={() => window.boardClearSel?.()}>✕</button>
    </>,
    container
  );
}

/* ── 메인 컴포넌트 ── */
export default function BoardView() {
  const items    = useAppStore(s => s.items);    // items 변경 시 리렌더 트리거
  const boardSel = useAppStore(s => s.boardSel);

  /* portal container는 dangerouslySetInnerHTML 마운트 후에 존재 → useEffect로 확보 */
  const [boardContainer, setBoardContainer] = useState(null);
  const [barContainer,   setBarContainer]   = useState(null);

  useEffect(() => {
    setBoardContainer(document.getElementById('boardView'));
    setBarContainer(document.getElementById('boardActionBar'));
  }, []);

  const selSet = useMemo(() => new Set(boardSel), [boardSel]);

  if (!boardContainer || !barContainer) return null;

  return (
    <>
      <BoardColumns container={boardContainer} selSet={selSet} items={items} />
      <BoardActionBar container={barContainer} boardSel={boardSel} />
    </>
  );
}
