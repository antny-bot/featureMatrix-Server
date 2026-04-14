import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { SK, DEFAULT_LIST_COLS, DATA_VERSION, MIGRATIONS, UNDO_MAX } from '../app/constants.js';

/* ── 초기 상태 (state.js의 S와 동일한 구조) ── */
const initialState = {
  items: [],
  changeLog: [],
  view: 'matrix',
  searchQ: '',
  searchFocusNonce: 0,
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
    groupOrder: [],
    catOrder: [],
    dbHeroName: '',
    dbSections: ['stats', 'insight', 'heatmap'],
    changeLogMax: 50,
    boardFoldCount: 6,
    storageMode: 'server',
    serverUrl: '',
    pollInterval: 60,
    userName: '',
    statusLabels: {
      '대기': '대기',
      '시작가능': '시작가능',
      '진행중': '진행중',
      '검토중': '검토중',
      '완료': '완료',
    },
  },
  sort: { key: 'key', dir: 'asc' },
  mxSelectionKeys: [],
  bulkSelectionKeys: [],
  boardSelectionKeys: [],
  boardDragKeys: [],
  editKey: null,
  isDragging: false,
  dragKey: null,
  dragCell: null,
  undoStack: [],
  undoDepth: 0,
  // 서버 동기화 상태
  serverTs: 0,
  isLoading: false,
  serverStatus: 'idle', // 'idle' | 'ok' | 'error'
  // WebSocket 실시간 상태
  editLocks: {},    // { [key]: { user, ts } }
  previews:  {},    // { [key]: { user, preview } }
  wsStatus: 'idle', // 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
  activeUsers: [],  // [{ sid, user, joinTime }] 현재 사용자 제외
  // 글로벌 오버레이/UI 상태
  toast: { visible: false, message: '', type: false, timerId: null },
  contextMenu: null,
  statusMenu: null,
  tooltip: null, // { key, x, y }
  tooltipTimerId: null,
  activeModal: null, // 'loginModal', 'importModal', etc.
  banner: { visible: false, message: '' },
  editModal: { visible: false, mode: 'add', key: null, item: null, activeTab: 'info', mdMode: null },
  loginModal: { visible: false, role: 'editor', error: '', callback: null },
};

/* ── Zustand 스토어 ── */
export const useAppStore = create(
  devtools(
    (set, get) => ({
  ...initialState,

  /* ── 기본 setter들 ── */
  setItems: (items) => set({ items }),
  setView: (view) => set({ view }),
  setSearchQ: (searchQ) => set({ searchQ }),
  requestSearchFocus: () => set(s => ({ searchFocusNonce: s.searchFocusNonce + 1 })),
  setMxSelectionKeys: (mxSelectionKeys) => set({ mxSelectionKeys: mxSelectionKeys || [] }),
  setBulkSelectionKeys: (bulkSelectionKeys) => set({ bulkSelectionKeys: bulkSelectionKeys || [] }),
  setBoardSelectionKeys: (boardSelectionKeys) => set({ boardSelectionKeys: boardSelectionKeys || [] }),
  setBoardDragKeys: (boardDragKeys) => set({ boardDragKeys: boardDragKeys || [] }),
  setEditKey: (editKey) => set({ editKey }),
  setIsDragging: (isDragging) => set({ isDragging }),
  setUndoDepth: (undoDepth) => set({ undoDepth }),
  setServerStatus: (serverStatus) => set({ serverStatus }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setServerTs: (serverTs) => set({ serverTs }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setActiveUsers: (activeUsers) => set({ activeUsers: activeUsers || [] }),

  /* ── WebSocket Lock/Preview 업데이트 ── */
  updateLocks: (locks) => set({ editLocks: locks || {} }),
  updatePreview: (key, data) =>
    set(s => {
      const next = { ...s.previews };
      if (data === null) delete next[key];
      else next[key] = data;
      return { previews: next };
    }),

  /* ── 글로벌 오버레이/UI 업데이트 ── */
  setContextMenu: (contextMenu) => set({ contextMenu }),
  setStatusMenu: (statusMenu) => set({ statusMenu }),
  setActiveModal: (activeModal) => set({ activeModal }),
  setBanner: (visible, message = '') => set({ banner: { visible, message } }),
  openEditModal: (mode, key, item, activeTab = 'info', mdMode = null) => set({
    editModal: { visible: true, mode, key, item, activeTab, mdMode },
    activeModal: 'editModal'
  }),
  closeEditModal: () => set(s => ({
    editModal: { ...s.editModal, visible: false },
    activeModal: s.activeModal === 'editModal' ? null : s.activeModal
  })),
  setEditModalTab: (activeTab, mdMode = null) => set(s => ({
    editModal: { ...s.editModal, activeTab, mdMode }
  })),
  openLoginModal: (role, callback) => set({
    loginModal: { visible: true, role, error: '', callback },
    activeModal: 'loginModal'
  }),
  closeLoginModal: () => set(s => ({
    loginModal: { ...s.loginModal, visible: false },
    activeModal: s.activeModal === 'loginModal' ? null : s.activeModal
  })),
  setLoginError: (error) => set(s => ({
    loginModal: { ...s.loginModal, error }
  })),
  startTooltip: (key, x, y) => {
    const s = get();
    if (s.tooltipTimerId) clearTimeout(s.tooltipTimerId);
    if (!key) {
      set({ tooltip: null, tooltipTimerId: null });
      return;
    }
    const timerId = setTimeout(() => {
      set({ tooltip: { key, x, y }, tooltipTimerId: null });
    }, 900);
    set({ tooltipTimerId: timerId });
  },
  clearTooltip: () => {
    const s = get();
    if (s.tooltipTimerId) clearTimeout(s.tooltipTimerId);
    set({ tooltip: null, tooltipTimerId: null });
  },
  notify: (message, type = false) => {
    const s = get();
    if (s.toast.timerId) clearTimeout(s.toast.timerId);
    const timerId = setTimeout(() => {
      set({ toast: { ...get().toast, visible: false, timerId: null } });
    }, 2400);
    set({ toast: { visible: true, message, type, timerId } });
  },

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

  /* ── Undo 기능 추가 ── */
  pushUndo: () => {
    const { items, settings, undoStack } = get();
    const snapshot = {
      items: JSON.parse(JSON.stringify(items)),
      groupOrder: [...(settings.groupOrder || [])],
      catOrder: [...(settings.catOrder || [])],
      dbSections: [...(settings.dbSections || [])],
      listColumns: JSON.parse(JSON.stringify(settings.listColumns || [])),
    };
    const next = [...undoStack, JSON.stringify(snapshot)];
    if (next.length > UNDO_MAX) next.shift();
    set({ undoStack: next, undoDepth: next.length });
  },
  
  doUndo: () => {
    const { undoStack, settings } = get();
    if (!undoStack.length) return null;
    const nextStack = [...undoStack];
    const snapshotJson = nextStack.pop();
    const snapshot = JSON.parse(snapshotJson);
    
    const nextSettings = { 
      ...settings, 
      groupOrder: snapshot.groupOrder,
      catOrder: snapshot.catOrder,
      dbSections: snapshot.dbSections,
      listColumns: snapshot.listColumns,
    };

    set({ 
      items: snapshot.items, 
      settings: nextSettings,
      undoStack: nextStack, 
      undoDepth: nextStack.length 
    });
    return snapshot.items;
  },

  setUndoStack: (undoStack) => set({ undoStack, undoDepth: undoStack.length }),
}),
    {
      name: 'featureMatrix',
      enabled: typeof process !== 'undefined'
        ? process.env.NODE_ENV !== 'production'
        : true,
    }
  )
);

/* ── 스냅샷 헬퍼 (React 외부에서 사용) ── */
export const getStore = () => useAppStore.getState();
export const setStore = (patch) => useAppStore.setState(patch);
