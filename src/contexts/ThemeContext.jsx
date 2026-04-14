/* ══════════════════════════════════════════
   ThemeContext.jsx — 다크/라이트 모드 React Context

   vanilla JS toggleTheme()이 data-theme 속성을 변경한 뒤
   window.__themeRefresh(isDark) 를 호출해 React 상태 동기화.

   사용 예:
     const { isDark } = useTheme();
══════════════════════════════════════════ */

import { createContext, useContext, useState, useEffect } from 'react';
import { toggleTheme } from '../app/theme.js';

const ThemeContext = createContext({ isDark: false, toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  );

  useEffect(() => {
    // vanilla JS toggleTheme() / applyTheme() 호출 후 React 상태 동기화
    window.__themeRefresh = (dark) => setIsDark(!!dark);
    return () => { delete window.__themeRefresh; };
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
