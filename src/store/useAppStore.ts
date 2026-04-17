import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { DEFAULT_LIST_COLS, STATUS_LBL, UNDO_MAX } from '../app/constants.js';
import type {
  Item, ChangeLogEntry, AppSettings, Filters, DisplaySettings,
  EditLock, ActiveUser, Toast, EditModal, LoginModal,
  ViewType, ServerStatus, WsStatus, SectionKey, UndoSnapshot
} from '../types/index.js';

/* ── 초기 상태 ── */
const initialState = {
  items: [] as Item[],
  changeLog: [] as ChangeLogEntry[],
  view: 'matrix' as ViewType,
  searchQ: '',
  searchFocusNonce: 0,
  filters: {
    priorities: [],
    statuses: [],
    showDeleted: false,
    importantOnly: false,
    owners: [],
  } as Filters,
  display: {
    showOwner: true,
    showStar: false,
    showNewBadge: false,
    showCellCount: false,
    showUpdated: false,
    showStatus: true,
    showMdBadge: false,
    showQuickAdd: false,
  } as DisplaySettings,
  settings: {
    baseFont: 16, cardFont: 12, cardRadius: 6, cardGap: 4,
    colW: 130, catW: 52, subCatW: 80, cellFold: 0,
    matrixWidth: 'fluid', panelPos: 'left', panelVisible: true,
    title: '소복 매트릭스', subtitle: 'Function Matrix', themeId: 'sobuk',
    priorityStyles: { high: 'left-thick', mid: 'left-thin', low: 'none' },
    customColors: { light: {}, dark: {} },
    listColumns: JSON.parse(JSON.stringify(DEFAULT_LIST_COLS)),
    dbHeroName: '',
    // #48E: insight → groupProgress + ownersPanel 분리 / recent 섹션 추가
    dbSections: ['stats', 'groupProgress', 'ownersPanel', 'heatmap', 'metrics', 'recent'] as SectionKey[],
    dbSectionVisibility: { stats: true, groupProgress: true, ownersPanel: true, heatmap: true, metrics: true, recent: true } as Record<string, boolean>,
    changeLogMax: 50,
    boardFoldCount: 6,
    storageMode: 'server' as 'server' | 'local',
    serverUrl: '',
    pollInterval: 60,
    userName: '',
    statusLabels: { ...STATUS_LBL } as Record<string, string>,
  } as AppSettings,
  sort: { key: 'key', dir: 'asc' as 'asc' | 'desc' },
  mxSelectionKeys: [] as string[],
  bulkSelectionKeys: [] as string[],
  boardSelectionKeys: [] as string[],
  boardDragKeys: [] as string[],
  editKey: null as string | null,
  isDragging: false,
  dragKey: null as string | null,
  dragCell: null as unknown,
  undoStack: [] as string[],
  undoDepth: 0,
  serverTs: 0,
  isLoading: false,
  serverStatus: 'idle' as ServerStatus,
  editLocks: {} as Record<string, EditLock>,
  previews: {} as Record<string, { user: string; preview: unknown }>,
  wsStatus: 'idle' as WsStatus,
  activeUsers: [] as ActiveUser[],
  toast: { visible: false, message: '', type: false, timerId: null } as Toast,
  contextMenu: null as unknown,
  statusMenu: null as unknown,
  tooltip: null as { key: string; x: number; y: number } | null,
  tooltipTimerId: null as ReturnType<typeof setTimeout> | null,
  activeModal: null as string | null,
  banner: { visible: false, message: '' },
  hasPendingLocalSave: false,
  editModal: { visible: false, mode: 'add', key: null, item: null, activeTab: 'info', mdMode: null } as EditModal,
  loginModal: { visible: false, role: 'editor', error: '', callback: null } as LoginModal,
};

type AppState = typeof initialState;

/* ── Zustand 스토어 ── */
export const useAppStore = create(
  devtools(
    (set: (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void, get: () => AppState) => ({
      ...initialState,

      /* ── 기본 setter들 ── */
      setItems: (items: Item[]) => set({ items }),
      setView: (view: ViewType) => set({ view }),
      setSearchQ: (searchQ: string) => set({ searchQ }),
      requestSearchFocus: () => set((s: AppState) => ({ searchFocusNonce: s.searchFocusNonce + 1 })),
      setMxSelectionKeys: (mxSelectionKeys: string[]) => set({ mxSelectionKeys: mxSelectionKeys || [] }),
      setBulkSelectionKeys: (bulkSelectionKeys: string[]) => set({ bulkSelectionKeys: bulkSelectionKeys || [] }),
      setBoardSelectionKeys: (boardSelectionKeys: string[]) => set({ boardSelectionKeys: boardSelectionKeys || [] }),
      setBoardDragKeys: (boardDragKeys: string[]) => set({ boardDragKeys: boardDragKeys || [] }),
      setEditKey: (editKey: string | null) => set({ editKey }),
      setIsDragging: (isDragging: boolean) => set({ isDragging }),
      setUndoDepth: (undoDepth: number) => set({ undoDepth }),
      setServerStatus: (serverStatus: ServerStatus) => set({ serverStatus }),
      setIsLoading: (isLoading: boolean) => set({ isLoading }),
      setServerTs: (serverTs: number) => set({ serverTs }),
      setWsStatus: (wsStatus: WsStatus) => set({ wsStatus }),
      setActiveUsers: (activeUsers: ActiveUser[]) => set({ activeUsers: activeUsers || [] }),

      /* ── WebSocket Lock/Preview 업데이트 ── */
      updateLocks: (locks: Record<string, EditLock>) => set({ editLocks: locks || {} }),
      updatePreview: (key: string, data: { user: string; preview: unknown } | null) =>
        set((s: AppState) => {
          const next = { ...s.previews };
          if (data === null) delete next[key];
          else next[key] = data;
          return { previews: next };
        }),

      /* ── 글로벌 오버레이/UI 업데이트 ── */
      setContextMenu: (contextMenu: unknown) => set({ contextMenu }),
      setStatusMenu: (statusMenu: unknown) => set({ statusMenu }),
      setActiveModal: (activeModal: string | null) => set({ activeModal }),
      setBanner: (visible: boolean, message = '') => set({ banner: { visible, message } }),
      setHasPendingLocalSave: (hasPendingLocalSave: boolean) => set({ hasPendingLocalSave }),
      openEditModal: (mode: 'add' | 'edit', key: string | null, item: Item | null, activeTab = 'info', mdMode: string | null = null) => set({
        editModal: { visible: true, mode, key, item, activeTab, mdMode },
        activeModal: 'editModal'
      }),
      closeEditModal: () => set((s: AppState) => ({
        editModal: { ...s.editModal, visible: false },
        activeModal: s.activeModal === 'editModal' ? null : s.activeModal
      })),
      setEditModalTab: (activeTab: string, mdMode: string | null = null) => set((s: AppState) => ({
        editModal: { ...s.editModal, activeTab, mdMode }
      })),
      openLoginModal: (role: 'editor' | 'viewer', callback: (success: boolean) => void) => set({
        loginModal: { visible: true, role, error: '', callback },
        activeModal: 'loginModal'
      }),
      closeLoginModal: () => set((s: AppState) => ({
        loginModal: { ...s.loginModal, visible: false },
        activeModal: s.activeModal === 'loginModal' ? null : s.activeModal
      })),
      setLoginError: (error: string) => set((s: AppState) => ({
        loginModal: { ...s.loginModal, error }
      })),
      startTooltip: (key: string | null, x?: number, y?: number) => {
        const s = get();
        if (s.tooltipTimerId) clearTimeout(s.tooltipTimerId);
        if (!key) {
          set({ tooltip: null, tooltipTimerId: null });
          return;
        }
        const timerId = setTimeout(() => {
          set({ tooltip: { key: key!, x: x ?? 0, y: y ?? 0 }, tooltipTimerId: null });
        }, 900);
        set({ tooltipTimerId: timerId });
      },
      clearTooltip: () => {
        const s = get();
        if (s.tooltipTimerId) clearTimeout(s.tooltipTimerId);
        set({ tooltip: null, tooltipTimerId: null });
      },
      notify: (message: string, type: string | boolean = false) => {
        const s = get();
        if (s.toast.timerId) clearTimeout(s.toast.timerId);
        const timerId = setTimeout(() => {
          set({ toast: { ...get().toast, visible: false, timerId: null } });
        }, 2400);
        set({ toast: { visible: true, message, type, timerId } });
      },

      /* ── 필터 업데이트 ── */
      setFilters: (filters: Filters) => set({ filters }),
      updateFilter: (key: string, value: unknown) =>
        set((s: AppState) => ({ filters: { ...s.filters, [key]: value } })),

      /* ── 표시 설정 업데이트 ── */
      setDisplay: (display: DisplaySettings) => set({ display }),
      updateDisplay: (key: string, value: unknown) =>
        set((s: AppState) => ({ display: { ...s.display, [key]: value } })),

      /* ── 설정 업데이트 ── */
      setSettings: (settings: AppSettings) => set({ settings }),
      updateSetting: (key: string, value: unknown) =>
        set((s: AppState) => ({ settings: { ...s.settings, [key]: value } })),

      /* ── 아이템 CRUD ── */
      addItem: (item: Item) =>
        set((s: AppState) => ({ items: [...s.items, item] })),
      updateItem: (key: string, patch: Partial<Item>) =>
        set((s: AppState) => ({
          items: s.items.map(it => it.key === key ? { ...it, ...patch } : it)
        })),
      removeItem: (key: string) =>
        set((s: AppState) => ({ items: s.items.filter(it => it.key !== key) })),

      /* ── Undo/Redo: changeLog 기반 ── */
      setChangeLog: (changeLog: ChangeLogEntry[]) => set({ changeLog }),
      pushChangeLog: (entry: ChangeLogEntry) =>
        set((s: AppState) => {
          const max = s.settings.changeLogMax || 50;
          const next = [entry, ...s.changeLog].slice(0, max);
          return { changeLog: next };
        }),

      /* ── Undo 기능 ── */
      pushUndo: () => {
        const { items, settings, undoStack } = get();
        const snapshot: UndoSnapshot = {
          items: JSON.parse(JSON.stringify(items)),
          dbSections: [...(settings.dbSections || [])],
          dbSectionVisibility: { ...(settings.dbSectionVisibility || {}) },
          listColumns: JSON.parse(JSON.stringify(settings.listColumns || [])),
        };
        const next = [...undoStack, JSON.stringify(snapshot)];
        if (next.length > UNDO_MAX) next.shift();
        set({ undoStack: next, undoDepth: next.length });
      },

      doUndo: (): Item[] | null => {
        const { undoStack, settings } = get();
        if (!undoStack.length) return null;
        const nextStack = [...undoStack];
        const snapshotJson = nextStack.pop()!;
        const snapshot: UndoSnapshot = JSON.parse(snapshotJson);

        const nextSettings: AppSettings = {
          ...settings,
          dbSections: snapshot.dbSections,
          dbSectionVisibility: snapshot.dbSectionVisibility || settings.dbSectionVisibility,
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

      setUndoStack: (undoStack: string[]) => set({ undoStack, undoDepth: undoStack.length }),
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
export const setStore = (patch: Partial<AppState>) => useAppStore.setState(patch);
