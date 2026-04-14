import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.js';

export function useKeyboardShortcuts(actions) {
  const store = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName || '';
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);

      if (e.key === 'Escape') {
        if (actions.onEscape) actions.onEscape();
        return;
      }

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        if (actions.onSearchFocus) actions.onSearchFocus();
        return;
      }

      if (isInput) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'i' || e.key === 'I') { e.preventDefault(); actions.openModal?.('importModal'); return; }
        if (e.key === 'e' || e.key === 'E') { e.preventDefault(); actions.openModal?.('exportModal'); return; }
        if (e.key === ',') { e.preventDefault(); actions.openModal?.('settingsModal'); return; }
        return;
      }

      const key = e.key.toLowerCase();
      switch (key) {
        case 'n': actions.openAddModal?.(); break;
        case 'f': actions.togglePanel?.(); break;
        case 'd': store.setView('dashboard'); break;
        case 'm': store.setView('matrix'); break;
        case 'b': store.setView('board'); break;
        case 'l': store.setView('list'); break;
        case 'z': actions.doUndo?.(); break;
        case '?': actions.openModal?.('shortcutsModal'); break;
        default: break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [actions, store]);
}
