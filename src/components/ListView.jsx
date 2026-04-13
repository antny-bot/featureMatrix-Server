/* ══════════════════════════════════════════
   ListView.jsx — 리스트 뷰 React 컴포넌트

   전략:
   - #listView 컨테이너에 createPortal
   - Zustand items/settings/display/filters/searchQ/sort 변경 시 자동 리렌더
   - renderList() 직접 호출 시(bulkSel 변경 등): window.__listViewRefresh 브릿지 → tick++
   - 리스트 HTML: buildListHtml() 순수 함수 → dangerouslySetInnerHTML
══════════════════════════════════════════ */

import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { buildListHtml } from '../app/render.js';

export default function ListView() {
  /* Zustand 구독: 데이터/설정/정렬/필터 변경 시 리렌더 트리거 */
  const items    = useAppStore(s => s.items);    // eslint-disable-line no-unused-vars
  const settings = useAppStore(s => s.settings); // eslint-disable-line no-unused-vars
  const display  = useAppStore(s => s.display);  // eslint-disable-line no-unused-vars
  const filters  = useAppStore(s => s.filters);  // eslint-disable-line no-unused-vars
  const searchQ  = useAppStore(s => s.searchQ);  // eslint-disable-line no-unused-vars
  const sort     = useAppStore(s => s.sort);      // eslint-disable-line no-unused-vars

  const [container, setContainer] = useState(null);
  /* bulkSel 변경 등 Zustand 외 re-render 트리거 */
  const [tick,      setTick]      = useState(0);  // eslint-disable-line no-unused-vars

  useEffect(() => {
    setContainer(document.getElementById('listView'));
  }, []);

  /* 브릿지: renderList() → React re-render 강제 (bulkSel 변경용) */
  useEffect(() => {
    window.__listViewRefresh = () => setTick(t => t + 1);
    return () => { delete window.__listViewRefresh; };
  }, []);

  if (!container) return null;

  const html = buildListHtml();

  return createPortal(
    <div dangerouslySetInnerHTML={{ __html: html }} />,
    container
  );
}
