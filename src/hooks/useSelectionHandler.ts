import { useCallback } from 'react';

export function useSelectionHandler(
  getKeys: () => string[],
  setKeys: (keys: string[]) => void
) {
  const handleCardClick = useCallback((e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    const prev = new Set(getKeys());
    if (e.shiftKey) {
      if (prev.has(key)) prev.delete(key);
      else prev.add(key);
    } else {
      prev.clear();
      prev.add(key);
    }
    setKeys([...prev]);
  }, [getKeys, setKeys]);

  const clearSelection = useCallback(() => setKeys([]), [setKeys]);

  return { handleCardClick, clearSelection };
}
