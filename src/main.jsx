/* ══════════════════════════════════════════
   main.jsx — React 진입점 (Phase 2~)

   React 18 createRoot로 App 컴포넌트를 마운트.
   App 내부에서 기존 vanilla JS(app/main.js)를 동적 import.
══════════════════════════════════════════ */

import { createRoot } from 'react-dom/client';
import App from './components/App.jsx';

const rootEl = document.getElementById('root');
createRoot(rootEl).render(<App />);
