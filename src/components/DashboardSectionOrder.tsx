import { useState } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from '../hooks/useDBSync.js';
import type { SectionKey } from '../types/index.js';

const SECTION_LABELS: Record<SectionKey, string> = {
  stats: '스탯 카드',
  groupProgress: '그룹별 진척도',
  ownersPanel: '담당별 기능 현황',
  heatmap: '기능 분포 히트맵',
  metrics: '일별 리포트',
  recent: '최근 변경',
};

const DEFAULT_SECTIONS: SectionKey[] = ['stats', 'groupProgress', 'ownersPanel', 'heatmap', 'metrics', 'recent'];

function normalizeSections(sections: unknown): SectionKey[] {
  const source = Array.isArray(sections) ? sections as string[] : [];
  const known = source.filter(s => DEFAULT_SECTIONS.includes(s as SectionKey)) as SectionKey[];
  return [
    ...known,
    ...DEFAULT_SECTIONS.filter(s => !known.includes(s)),
  ];
}

function isSectionVisible(visibility: Record<string, boolean>, section: string): boolean {
  return visibility?.[section] !== false;
}

function moveItem<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex == null) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function DashboardSectionOrder() {
  const settings   = useAppStore(s => s.settings);
  const sections   = normalizeSections(settings.dbSections);
  const visibility = (settings.dbSectionVisibility || {}) as Record<string, boolean>;
  const { saveLocal, saveToServer, broadcastSharedData } = useDBSync();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const persistSettings = async (patch: Record<string, unknown>) => {
    const { pushUndo, setSettings, settings: s } = useAppStore.getState();
    const nextSettings = { ...s, ...patch };
    pushUndo();
    setSettings(nextSettings);
    if (s.storageMode === 'server') {
      const ok = await saveToServer();
      if (ok) broadcastSharedData();
    } else {
      saveLocal();
    }
  };

  const moveSection = (index: number, direction: number) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= sections.length) return;
    persistSettings({ dbSections: moveItem(sections, index, nextIndex) });
  };

  const toggleSection = (section: SectionKey) => {
    persistSettings({
      dbSections: sections,
      dbSectionVisibility: {
        ...visibility,
        [section]: !isSectionVisible(visibility, section),
      },
    });
  };

  const dropSection = (toIndex: number) => {
    if (dragIndex == null || dragIndex === toIndex) return;
    persistSettings({ dbSections: moveItem(sections, dragIndex, toIndex) });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {sections.map((section, index) => {
        const visible = isSectionVisible(visibility, section);
        return (
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
              opacity: dragIndex === index ? 0.4 : visible ? undefined : 0.58,
              boxShadow: dragOverIndex === index && dragIndex !== index
                ? (dragIndex !== null && dragIndex < index ? '0 3px 0 var(--accent)' : '0 -3px 0 var(--accent)')
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
            <input
              type="checkbox"
              checked={visible}
              aria-label={`${SECTION_LABELS[section] || section} 표시`}
              onChange={() => toggleSection(section)}
              onClick={event => event.stopPropagation()}
              onPointerDown={event => event.stopPropagation()}
            />
            <span style={{ fontSize: '.85rem', color: 'var(--text-3)', cursor: 'grab', padding: '0 2px' }} title="드래그로 순서 변경">☰</span>
            <span style={{ fontSize: '.75rem', color: 'var(--text-3)', fontWeight: 700, width: '16px' }}>{index + 1}</span>
            <span style={{ flex: 1, fontSize: '.8rem', fontWeight: 600, color: 'var(--text)' }}>{SECTION_LABELS[section] || section}</span>
            <span style={{ fontSize: '.68rem', color: visible ? 'var(--success)' : 'var(--text-3)', minWidth: '34px', textAlign: 'right' }}>
              {visible ? '표시' : '숨김'}
            </span>
            <button className="btn btn-g btn-sm" style={{ width: '24px', height: '24px', padding: 0, fontSize: '.7rem' }} disabled={index === 0} onClick={() => moveSection(index, -1)}>↑</button>
            <button className="btn btn-g btn-sm" style={{ width: '24px', height: '24px', padding: 0, fontSize: '.7rem' }} disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)}>↓</button>
          </div>
        );
      })}
    </div>
  );
}
