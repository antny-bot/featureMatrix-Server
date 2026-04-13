/* ══════════════════════════════════════════
   DashboardView.jsx — 대시보드 React 포털 컴포넌트

   portal root: #dashboardView (vanilla JS가 생성한 컨테이너)
   hmView 상태: React useState, window.setHmView 브릿지로 업데이트
   애니메이션 + 높이 동기화: useEffect (매 렌더 후 실행)
══════════════════════════════════════════ */

import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { buildDashboardHtml } from '../app/dashboard.js';
import { animOk } from '../app/render.js';

export default function DashboardView() {
  const items    = useAppStore(s => s.items);   // 데이터 변경 시 리렌더 트리거
  const settings = useAppStore(s => s.settings); // settings 변경 시 리렌더 트리거

  const [container, setContainer] = useState(null);
  const [hmView, setHmView]       = useState('cat');

  useEffect(() => {
    setContainer(document.getElementById('dashboardView'));
  }, []);

  /* onclick="setHmView('cat')" 브릿지 */
  useEffect(() => {
    window.setHmView = (v) => setHmView(v);
    return () => { delete window.setHmView; };
  }, []);

  /* 렌더 후: 섹션 fade-in 애니메이션 + 우측 패널 높이 동기화 */
  useEffect(() => {
    if (!container) return;

    if (animOk()) {
      container.querySelectorAll('[data-anim-idx]').forEach(sec => {
        const idx = parseInt(sec.dataset.animIdx, 10);
        sec.style.opacity    = '0';
        sec.style.transform  = 'translateY(12px)';
        sec.style.transition = 'none';
        requestAnimationFrame(() => {
          setTimeout(() => {
            sec.style.transition = 'opacity .32s ease, transform .32s ease';
            sec.style.opacity    = '1';
            sec.style.transform  = 'translateY(0)';
          }, idx * 80);
        });
      });
    }

    requestAnimationFrame(() => {
      const bodyLeft  = container.querySelector('.db-body-left');
      const bodyRight = container.querySelector('.db-body-right');
      if (bodyLeft && bodyRight) {
        bodyRight.style.maxHeight = bodyLeft.offsetHeight + 'px';
      }
    });
  }); // 의존성 없음 — 매 렌더마다 실행

  if (!container) return null;

  const html = buildDashboardHtml(hmView);

  return createPortal(
    <div dangerouslySetInnerHTML={{ __html: html }} />,
    container
  );
}
