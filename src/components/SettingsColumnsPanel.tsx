import { useState, useCallback } from 'react';
import { DEFAULT_LIST_COLS, FLABELS } from '../app/constants.js';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from '../hooks/useDBSync.js';

interface DragState {
  index: number;
}

function moveItem<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex == null) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function SettingsColumnsPanel() {
  const settings = useAppStore(s => s.settings);
  const { saveLocal, saveToServer, broadcastSharedData } = useDBSync();

  const [drag, setDrag]         = useState<DragState | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleSave = useCallback(async () => {
    if (settings.storageMode === 'server') {
      const ok = await saveToServer();
      if (ok) broadcastSharedData();
    } else {
      saveLocal();
    }
  }, [settings.storageMode, saveLocal, saveToServer, broadcastSharedData]);

  const toggleColumn = (index: number, visible: boolean) => {
    const { pushUndo, setSettings, settings: s } = useAppStore.getState();
    pushUndo();
    const nextCols = s.listColumns.map((column, columnIndex) =>
      columnIndex === index ? { ...column, visible } : column
    );
    setSettings({ ...s, listColumns: nextCols });
    handleSave();
  };

  const dropColumn = (toIndex: number) => {
    if (!drag) return;
    const { pushUndo, setSettings, settings: s } = useAppStore.getState();
    pushUndo();
    const nextCols = moveItem(s.listColumns, drag.index, toIndex);
    setSettings({ ...s, listColumns: nextCols });
    handleSave();
    setDrag(null);
    setDragOver(null);
  };

  const resetColumns = () => {
    if (!confirm('리스트 컬럼을 초기화하시겠습니까?')) return;
    const { pushUndo, setSettings, notify, settings: s } = useAppStore.getState();
    pushUndo();
    setSettings({ ...s, listColumns: JSON.parse(JSON.stringify(DEFAULT_LIST_COLS)) });
    handleSave();
    notify('리스트 컬럼을 기본값으로 복원했습니다.', 'success');
  };

  const dragClass = (index: number) => [
    'col-row',
    drag?.index === index ? 'dragging-col' : '',
    dragOver === index ? 'drag-over-col' : '',
  ].filter(Boolean).join(' ');

  return (
    <div>
      <div className="sec-ttl">리스트 컬럼</div>
      <div style={{ fontSize: '.77rem', color: 'var(--text-3)', marginBottom: '10px' }}>
        체크: 표시 여부 &nbsp;|&nbsp; ⠿ 드래그: 순서 변경
      </div>
      <div className="col-editor">
        {settings.listColumns.map((column, index) => (
          <div
            className={dragClass(index)}
            draggable
            data-idx={index}
            key={column.key}
            onDragStart={event => {
              setDrag({ index });
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={event => {
              event.preventDefault();
              setDragOver(index);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={event => {
              event.preventDefault();
              dropColumn(index);
            }}
            onDragEnd={() => {
              setDrag(null);
              setDragOver(null);
            }}
          >
            <span className="col-handle" title="드래그하여 순서 변경">⠿</span>
            <label className="tgl" style={{ gap: '6px' }}>
              <input type="checkbox" checked={column.visible} onChange={event => toggleColumn(index, event.target.checked)} />
              <span className="tgl-track" />
            </label>
            <span className="col-name">{(FLABELS as Record<string, string>)[column.key] || column.key}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '10px' }}>
        <button className="btn btn-s btn-sm" onClick={resetColumns}>기본값 복원</button>
      </div>
    </div>
  );
}
