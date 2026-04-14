import { useState } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from '../hooks/useDBSync.js';

const SECTION_LABELS = {
  stats: '스탯 카드 4개',
  insight: '그룹 진척도 · 담당자 · 타임라인',
  heatmap: '히트맵',
};

const DEFAULT_SECTIONS = ['stats', 'insight', 'heatmap'];

function moveItem(list, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex == null) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function DashboardSectionOrder() {
  const store = useAppStore();
  const sections = store.settings.dbSections || DEFAULT_SECTIONS;
  const { saveLocal, saveToServer, broadcastSharedData } = useDBSync();
  
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const persistSections = async (newSections) => {
    store.pushUndo();
    store.setSettings({ ...store.settings, dbSections: newSections });
    if (store.settings.storageMode === 'server') {
      const ok = await saveToServer();
      if (ok) broadcastSharedData();
    } else {
      saveLocal();
    }
  };

  const moveSection = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    persistSections(moveItem(sections, index, nextIndex));
  };

  const dropSection = toIndex => {
    if (dragIndex == null || dragIndex === toIndex) return;
    persistSections(moveItem(sections, dragIndex, toIndex));
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {sections.map((section, index) => (
        <div
          className="db-sec-row"
          draggable
          data-idx={index}
          key={section}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 10px',
            background: 'var(--surface-2)',
            borderRadius: '7px',
            border: '1px solid var(--border)',
            cursor: 'grab',
            transition: 'opacity .15s,box-shadow .15s',
            opacity: dragIndex === index ? 0.4 : undefined,
            boxShadow: dragOverIndex === index && dragIndex !== index
              ? (dragIndex < index ? '0 3px 0 var(--accent)' : '0 -3px 0 var(--accent)')
              : undefined,
          }}
          onDragStart={event => {
            setDragIndex(index);
            event.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDragOverIndex(index);
          }}
          onDragLeave={() => setDragOverIndex(null)}
          onDrop={event => {
            event.preventDefault();
            dropSection(index);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setDragOverIndex(null);
          }}
        >
          <span style={{ fontSize: '.85rem', color: 'var(--text-3)', cursor: 'grab', padding: '0 2px' }} title="드래그로 순서 변경">⠿</span>
          <span style={{ fontSize: '.75rem', color: 'var(--text-3)', fontWeight: 700, width: '16px' }}>{index + 1}</span>
          <span style={{ flex: 1, fontSize: '.8rem', fontWeight: 600, color: 'var(--text)' }}>{SECTION_LABELS[section] || section}</span>
          <button className="btn btn-g btn-sm" style={{ width: '24px', height: '24px', padding: 0, fontSize: '.7rem' }} disabled={index === 0} onClick={() => moveSection(index, -1)}>▲</button>
          <button className="btn btn-g btn-sm" style={{ width: '24px', height: '24px', padding: 0, fontSize: '.7rem' }} disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)}>▼</button>
        </div>
      ))}
    </div>
  );
}
