import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import type { KeyboardActions } from '../types/index.js';

export function useKeyboardShortcuts(actions: KeyboardActions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag     = (document.activeElement as HTMLElement)?.tagName || '';
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);

      if (e.key === 'Escape') {
        actions.onEscape?.();
        return;
      }

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        actions.onSearchFocus?.();
        return;
      }

      if (isInput) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'i' || e.key === 'I') { e.preventDefault(); actions.openModal?.('importModal');   return; }
        if (e.key === 'e' || e.key === 'E') { e.preventDefault(); actions.openModal?.('exportModal');   return; }
        if (e.key === ',')                  { e.preventDefault(); actions.openModal?.('settingsModal'); return; }
        return;
      }

      const { setView } = useAppStore.getState();
      switch (e.key.toLowerCase()) {
        case 'n': actions.openAddModal?.();              break;
        case 'f': actions.togglePanel?.();               break;
        case 'd': setView('dashboard');                  break;
        case 'm': setView('matrix');                     break;
        case 'b': setView('board');                      break;
        case 'l': setView('list');                       break;
        case 'z': actions.doUndo?.();                    break;
        case '?': actions.openModal?.('shortcutsModal'); break;
        default:  break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
