import { useCallback } from 'react';

/**
 * 공통 카드 선택 훅 — useMatrixActions, useBoardActions의 handleCardClick/clearSelection 중복 추출.
 *
 * @param {() => string[]} getKeys - 현재 선택 키 목록을 반환하는 함수 (useAppStore.getState() 기반)
 * @param {(keys: string[]) => void} setKeys - 선택 키 목록을 업데이트하는 setter
 */
export function useSelectionHandler(getKeys, setKeys) {
  const handleCardClick = useCallback((e, key) => {
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
