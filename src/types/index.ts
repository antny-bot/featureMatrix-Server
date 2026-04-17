/* ── 공통 타입 정의 ── */

export interface Item {
  key: string;
  name: string;
  desc?: string;
  path?: string;
  group?: string;
  subGroup?: string;
  category?: string;
  subCategory?: string;
  priority?: string;
  status?: string;
  owner?: string;
  isDelete?: string;
  isImportant?: string;
  relSystem?: string;
  memo?: string;
  mdPath?: string;
  mdContent?: string;
  updatedAt?: number;
}

export interface ChangeLogEntry {
  ts: number;
  action: string;
  key: string;
  name?: string;
  status?: string;
  owner?: string;
  user?: string;
}

export interface OwnerCounts {
  total: number;
  high: number;
  mid: number;
  low: number;
  status: Record<string, number>;
}

export interface DashboardData {
  all: Item[];
  cats: string[];
  done: number;
  filterOn: boolean;
  groups: string[];
  heroName: string;
  imp: number;
  owners: [string, OwnerCounts][];
  recent: ChangeLogEntry[];
  sections: string[];
  statusCount: Record<string, number>;
  total: number;
}

export type SectionKey = 'stats' | 'groupProgress' | 'ownersPanel' | 'heatmap' | 'metrics' | 'recent';

export interface SectionVisibility extends Record<string, boolean> {}

export interface ColumnConfig {
  key: string;
  visible: boolean;
}

export interface PriorityStyles {
  high: string;
  mid: string;
  low: string;
}

export interface CustomColors {
  light: Record<string, string>;
  dark: Record<string, string>;
}

export interface AppSettings {
  baseFont: number;
  cardFont: number;
  cardRadius: number;
  cardGap: number;
  colW: number;
  catW: number;
  subCatW: number;
  cellFold: number;
  matrixWidth: 'fluid' | 'fixed';
  panelPos: 'left' | 'right';
  panelVisible: boolean;
  title: string;
  subtitle: string;
  dbHeroName: string;
  themeId: string;
  priorityStyles: PriorityStyles;
  customColors: CustomColors;
  listColumns: ColumnConfig[];
  dbSections: SectionKey[];
  dbSectionVisibility: SectionVisibility;
  changeLogMax: number;
  boardFoldCount: number;
  storageMode: 'server' | 'local';
  serverUrl: string;
  pollInterval: number;
  userName: string;
  statusLabels: Record<string, string>;
  [key: string]: unknown;
}

export interface Filters {
  priorities: string[];
  statuses: string[];
  showDeleted: boolean;
  importantOnly: boolean;
  owners: string[];
}

export interface DisplaySettings {
  showOwner: boolean;
  showStar: boolean;
  showNewBadge: boolean;
  showCellCount: boolean;
  showUpdated: boolean;
  showStatus: boolean;
  showMdBadge: boolean;
  showQuickAdd: boolean;
}

export interface UndoSnapshot {
  items: Item[];
  dbSections: SectionKey[];
  dbSectionVisibility: SectionVisibility;
  listColumns: ColumnConfig[];
}

export interface EditLock {
  user: string;
  ts: number;
}

export interface ActiveUser {
  sid: string;
  user: string;
  joinTime: number;
}

export interface Toast {
  visible: boolean;
  message: string;
  type: string | boolean;
  timerId: ReturnType<typeof setTimeout> | null;
}

export interface EditModal {
  visible: boolean;
  mode: 'add' | 'edit';
  key: string | null;
  item: Item | null;
  activeTab: string;
  mdMode: string | null;
}

export interface LoginModal {
  visible: boolean;
  role: 'editor' | 'viewer';
  error: string;
  callback: ((success: boolean) => void) | null;
}

export interface KeyboardActions {
  onEscape?(): void;
  onSearchFocus?(): void;
  openModal?(name: string): void;
  openAddModal?(): void;
  togglePanel?(): void;
  doUndo?(): void;
}

export type ViewType = 'matrix' | 'dashboard' | 'board' | 'list' | 'admin';
export type ServerStatus = 'idle' | 'ok' | 'error';
export type WsStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
