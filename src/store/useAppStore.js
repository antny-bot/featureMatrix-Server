/* ══════════════════════════════════════════
   useAppStore.js — Zustand 전역 상태 스토어

   Phase 3: state.js의 S 객체와 동일한 구조를 Zustand로 정의.
   Phase 4에서 컴포넌트별 전환 시 이 스토어를 직접 사용.
   전환 완료 후 state.js의 S 객체 제거 예정.

   사용 예:
     const items = useAppStore(s => s.items);
     const setView = useAppStore(s => s.setView);
══════════════════════════════════════════ */

import { create } from 'zustand';
import { SK, DEFAULT_LIST_COLS, DATA_VERSION, MIGRATIONS } from '../app/constants.js';
import { apiFetch } from '../app/state.js';  // Phase 4 전까지 API 함수 재사용

/* ── 초기 상태 (state.js의 S와 동일한 구조) ── */
const initialState = {
  items: [],
  changeLog: [],
  view: 'matrix',
  searchQ: '',
  expandedCells: new Set(),
  filters: {
    priorities: [],
    statuses: [],
    showDeleted: false,
    importantOnly: false,
    owners: [],
  },
  display: {
    showOwner: true,
    showStar: true,
    showNewBadge: true,
    showCellCount: true,
    showUpdated: false,
    showStatus: true,
    showMdBadge: true,
    showQuickAdd: false,
  },
  settings: {
    baseFont: 16, cardFont: 12, cardRadius: 6, cardGap: 4,
    colW: 130, catW: 52, subCatW: 80, cellFold: 0,
    matrixWidth: 'fluid', panelPos: 'left', panelVisible: true,
    title: '소복 매트릭스', subtitle: 'Function Matrix', themeId: 'sobuk',
    priorityStyles: { high: 'left-thick', mid: 'left-thin', low: 'none' },
    customColors: { light: {}, dark: {} },
    listColumns: JSON.parse(JSON.stringify(DEFAULT_LIST_COLS)),
    animations: { enabled: true, countUp: true, card: true, filter: true, shimmer: true, blur: false },
    groupOrder: [],
    catOrder: [],
    dbHeroName: '',
    dbSections: ['stats', 'insight', 'heatmap'],
    changeLogMax: 50,
    storageMode: 'server',
    serverUrl: '',
    pollInterval: 60,
    userName: '',
  },
  sort: { key: 'key', dir: 'asc' },
  editKey: null,
  isDragging: false,
  dragKey: null,
  dragCell: null,
  // 서버 동기화 상태
  serverTs: 0,
  isLoading: false,
  serverStatus: 'idle', // 'idle' | 'ok' | 'error'
};

/* ── Zustand 스토어 ── */
export const useAppStore = create((set, get) => ({
  ...initialState,

  /* ── 기본 setter들 ── */
  setItems: (items) => set({ items }),
  setView: (view) => set({ view }),
  setSearchQ: (searchQ) => set({ searchQ }),
  setExpandedCells: (expandedCells) => set({ expandedCells }),
  setEditKey: (editKey) => set({ editKey }),
  setIsDragging: (isDragging) => set({ isDragging }),
  setServerStatus: (serverStatus) => set({ serverStatus }),
  setIsLoading: (isLoading) => set({ isLoading }),

  /* ── 필터 업데이트 ── */
  setFilters: (filters) => set({ filters }),
  updateFilter: (key, value) =>
    set(s => ({ filters: { ...s.filters, [key]: value } })),

  /* ── 표시 설정 업데이트 ── */
  setDisplay: (display) => set({ display }),
  updateDisplay: (key, value) =>
    set(s => ({ display: { ...s.display, [key]: value } })),

  /* ── 설정 업데이트 ── */
  setSettings: (settings) => set({ settings }),
  updateSetting: (key, value) =>
    set(s => ({ settings: { ...s.settings, [key]: value } })),
  updateAnimations: (animations) =>
    set(s => ({ settings: { ...s.settings, animations: { ...s.settings.animations, ...animations } } })),

  /* ── 아이템 CRUD ── */
  addItem: (item) =>
    set(s => ({ items: [...s.items, item] })),
  updateItem: (key, patch) =>
    set(s => ({
      items: s.items.map(it => it.key === key ? { ...it, ...patch } : it)
    })),
  removeItem: (key) =>
    set(s => ({ items: s.items.filter(it => it.key !== key) })),

  /* ── Undo/Redo: changeLog 기반 ── */
  setChangeLog: (changeLog) => set({ changeLog }),
  pushChangeLog: (entry) =>
    set(s => {
      const max = s.settings.changeLogMax || 50;
      const next = [entry, ...s.changeLog].slice(0, max);
      return { changeLog: next };
    }),

  /* ── state.js의 S로부터 전체 상태 동기화 (Phase 4 전환기 브릿지) ── */
  syncFromS: (S) => {
    set({
      items:      S.items,
      changeLog:  S.changeLog,
      view:       S.view,
      searchQ:    S.searchQ,
      filters:    { ...S.filters },
      display:    { ...S.display },
      settings:   { ...S.settings },
      sort:       { ...S.sort },
      editKey:    S.editKey,
    });
  },
}));

/* ── 스냅샷 헬퍼 (React 외부에서 사용) ── */
export const getStore = () => useAppStore.getState();
export const setStore = (patch) => useAppStore.setState(patch);
