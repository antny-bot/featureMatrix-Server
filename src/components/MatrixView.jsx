/* ══════════════════════════════════════════
   MatrixView.jsx — 매트릭스(칸반 테이블) React 컴포넌트

   전략:
   - #matrixView 컨테이너에 createPortal
   - Zustand items/settings/display/filters/searchQ 변경 시 자동 리렌더
   - expandedCells: React useState로 관리 (S.expandedCells 대신)
   - 브릿지: window.expandCell / window.collapseCell → React 상태 세터 오버라이드
   - 셀 HTML: buildMatrixHtml(expandedCells) 순수 함수 호출 → dangerouslySetInnerHTML
   - mxSel (매트릭스 선택): render.js 모듈 변수 → DOM classList 직접 조작 (리렌더 불필요)
══════════════════════════════════════════ */

import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { buildMatrixHtml } from '../app/render.js';

export default function MatrixView() {
  /* Zustand 구독: 데이터/설정/표시 변경 시 리렌더 트리거 */
  const items    = useAppStore(s => s.items);     // eslint-disable-line no-unused-vars
  const settings = useAppStore(s => s.settings);  // eslint-disable-line no-unused-vars
  const display  = useAppStore(s => s.display);   // eslint-disable-line no-unused-vars
  const filters  = useAppStore(s => s.filters);
  const searchQ  = useAppStore(s => s.searchQ);
  const cellFold = useAppStore(s => s.settings.cellFold);

  const [container,     setContainer]     = useState(null);
  const [expandedCells, setExpandedCells] = useState(new Set());

  useEffect(() => {
    setContainer(document.getElementById('matrixView'));
  }, []);

  /* 필터/검색/셀접기기준 변경 시 펼침 셀 초기화 */
  useEffect(() => {
    setExpandedCells(new Set());
  }, [filters, searchQ, cellFold]);

  /* 컨테이너 className 동기화 (fluid/fixed) */
  useEffect(() => {
    if (container) {
      container.className = `mwrap${settings.matrixWidth === 'fluid' ? ' fluid' : ''}`;
    }
  }, [container, settings.matrixWidth]);

  /* 브릿지: render.js expandCell/collapseCell → React 상태 세터 오버라이드 */
  useEffect(() => {
    window.expandCell = (e, ck) => {
      e.stopPropagation();
      setExpandedCells(prev => { const n = new Set(prev); n.add(ck); return n; });
    };
    window.collapseCell = (e, ck) => {
      e.stopPropagation();
      setExpandedCells(prev => { const n = new Set(prev); n.delete(ck); return n; });
    };
    return () => { delete window.expandCell; delete window.collapseCell; };
  }, []);

  if (!container) return null;

  const html = buildMatrixHtml(expandedCells);

  return createPortal(
    <div dangerouslySetInnerHTML={{ __html: html }} />,
    container
  );
}
