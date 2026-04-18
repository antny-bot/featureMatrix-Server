import { forwardRef } from 'react';
import type { Item, EditLock, ThemeColorSet } from '../types/index.js';
import { STATUS_CLS } from '../app/constants.js';
import { fmtDate, getOwnerColor, getPK, normOwner } from '../utils/itemUtils.js';
import { getPresetCSS } from '../app/theme.js';
import { useAppStore, getStore } from '../store/useAppStore.js';
import { useModals } from '../hooks/useModals.js';
import { useAuth } from '../contexts/AuthContext.jsx';

function highlightText(value: unknown, query: string): React.ReactNode {
  const text = String(value || '');
  if (!query || !text) return text;

  try {
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.split(re).map((part, index) => (
      part.toLowerCase() === query.toLowerCase()
        ? <mark className="search-hl" key={`${part}:${index}`}>{part}</mark>
        : part
    ));
  } catch {
    return text;
  }
}

function cssTextToStyle(cssText: string): React.CSSProperties {
  if (!cssText) return {};

  return cssText
    .split(';')
    .map(rule => rule.trim())
    .filter(Boolean)
    .reduce<React.CSSProperties>((style, rule) => {
      const separatorIndex = rule.indexOf(':');
      if (separatorIndex === -1) return style;

      const property = rule
        .slice(0, separatorIndex)
        .trim()
        .replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
      const value = rule.slice(separatorIndex + 1).trim();

      if (property && value) {
        (style as Record<string, string>)[property] = value;
      }
      return style;
    }, {});
}

interface PreviewOverlayProps {
  item: Item;
  lockInfo: EditLock | undefined;
  previewData: { user: string; preview: Record<string, unknown> } | null | undefined;
}

function PreviewOverlay({ item, lockInfo, previewData }: PreviewOverlayProps) {
  if (!previewData || !lockInfo) return null;
  const preview = previewData.preview || {};
  const rows: [string, unknown, unknown][] = [
    ['기능명', preview.name, item.name],
    ['우선순위', preview.priority, item.priority],
    ['상태', preview.status, item.status],
    ['담당자', preview.owner, item.owner],
    ['그룹', preview.group, item.group],
    ['서브그룹', preview.subGroup, item.subGroup],
    ['카테고리', preview.category, item.category],
    ['서브카테고리', preview.subCategory, item.subCategory],
  ].filter(([, next, current]) => next && next !== current) as [string, unknown, unknown][];

  if (!rows.length) return null;

  return (
    <div className="edit-preview-overlay">
      <div style={{ fontWeight: 700, marginBottom: '4px' }}>✏ {lockInfo.user} 편집 중</div>
      {rows.map(([label, value]) => (
        <div key={label}>{label}: <b>{String(value)}</b></div>
      ))}
    </div>
  );
}

export interface FeatureCardProps {
  item: Item;
  colors: ThemeColorSet;
  id?: string;
  extraClass?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
  [key: string]: unknown;
}

const FeatureCard = forwardRef<HTMLDivElement, FeatureCardProps>(function FeatureCard({
  item,
  colors,
  id,
  extraClass = '',
  onClick,
  onDoubleClick,
  onDragStart,
  onDragEnd,
  onContextMenu,
  style,
  ...props
}, ref) {
  const display   = useAppStore(s => s.display);
  const settings  = useAppStore(s => s.settings);
  const searchQ   = useAppStore(s => s.searchQ);
  const editLocks = useAppStore(s => s.editLocks);
  const previews  = useAppStore(s => s.previews);
  const { openEditModal, openMdModal, duplicateItem } = useModals();
  const { isEditor: editorOk } = useAuth();

  const pk = getPK(item.priority);
  const pkColorKey = pk[0].toUpperCase() + pk.slice(1);
  const colorsMap = colors as unknown as Record<string, string>;
  const pHex = colorsMap[`p${pkColorKey}`] || '#888';
  const pBg  = colorsMap[`p${pkColorKey}Bg`] || '#eee';
  const priorityStyle = cssTextToStyle(getPresetCSS(settings.priorityStyles[pk as keyof typeof settings.priorityStyles], pHex, pBg));
  const isNew = item.key?.charAt(0) === 'N';
  const isDeleted = item.isDelete === 'Y';
  const ownerColor = getOwnerColor(item.owner);
  const lockInfo = editLocks[item.key];
  const myName = settings.userName || '익명';
  const isLockedByOther = lockInfo && lockInfo.user !== myName;
  const previewData = isLockedByOther ? previews[item.key] : null;
  const canDrag = editorOk;

  const restProps = props as React.HTMLAttributes<HTMLDivElement>;

  return (
    <div
      className={[
        'mitem',
        isDeleted ? 'item-del' : '',
        isLockedByOther ? 'item-locked' : '',
        extraClass,
      ].filter(Boolean).join(' ')}
      draggable={canDrag}
      ref={ref}
      data-key={item.key}
      id={id}
      style={{
        ...priorityStyle,
        borderRadius: `${settings.cardRadius}px`,
        marginBottom: `${settings.cardGap}px`,
        ...style,
      }}
      {...restProps}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onMouseOver={e => {
        if (getStore().isDragging) return;
        getStore().startTooltip(item.key, e.clientX + 14, e.clientY + 14);
      }}
      onMouseOut={() => getStore().clearTooltip()}
      onClick={onClick}
      onDoubleClick={onDoubleClick || (() => openEditModal(item.key))}
      onContextMenu={onContextMenu || (e => {
        e.preventDefault();
        e.stopPropagation();
        getStore().setContextMenu({
          key: item.key,
          isDeleted: item.isDelete === 'Y',
          x: Math.min(e.clientX, window.innerWidth - 160),
          y: Math.min(e.clientY, window.innerHeight - 180),
        });
      })}
    >
      {isLockedByOther && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: '.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '6px 6px 0 0', pointerEvents: 'none' }}>
          🔒 {lockInfo?.user} 편집 중
        </div>
      )}
      <PreviewOverlay item={item} lockInfo={lockInfo} previewData={previewData} />
      {canDrag && (
        <div className="card-actions" onClick={e => e.stopPropagation()}>
          <button className="card-act-btn" title="편집" onClick={() => openEditModal(item.key)}>✏</button>
          <button className="card-act-btn" title="복제" onClick={() => duplicateItem(item.key)}>⧉</button>
        </div>
      )}
      <div className="item-hd">
        <span className="item-key">{item.key}</span>
        {item.isImportant === 'Y' && display.showStar && <span className="item-star">★</span>}
        {isNew && display.showNewBadge && <span className="item-nbadge">N</span>}
        {display.showMdBadge && item.mdContent && (
          <span
            className="md-badge"
            onClick={e => { e.stopPropagation(); openMdModal(item.key); }}
            title="마크다운 보기"
            style={{ cursor: 'pointer' }}
          >
            MD
          </span>
        )}
        {display.showStatus && (
          item.status ? (
            <span
              className={`status-badge ${STATUS_CLS[item.status] || ''}`}
              onClick={e => {
                e.stopPropagation();
                getStore().setStatusMenu({
                  key: item.key,
                  currentStatus: item.status || '',
                  x: Math.min(e.clientX, window.innerWidth - 120),
                  y: Math.min(e.clientY + 4, window.innerHeight - 160),
                });
              }}
            >
              {settings.statusLabels?.[item.status] || item.status}
            </span>
          ) : (
            <span
              className="status-badge"
              style={{ background: 'var(--surface-3)', color: 'var(--text-3)', opacity: 0.6 }}
              onClick={e => {
                e.stopPropagation();
                getStore().setStatusMenu({
                  key: item.key,
                  currentStatus: '',
                  x: Math.min(e.clientX, window.innerWidth - 120),
                  y: Math.min(e.clientY + 4, window.innerHeight - 160),
                });
              }}
            >
              —
            </span>
          )
        )}
      </div>
      <div className="item-name" style={isDeleted ? { textDecoration: 'line-through', color: 'var(--text-3)' } : undefined}>
        {highlightText(item.name, searchQ)}
      </div>
      {display.showOwner && (
        <div className="item-owner">
          <span className="owner-dot" style={{ background: ownerColor }} />
          {normOwner(item.owner)}
        </div>
      )}
      {display.showUpdated && item.updatedAt && <div className="item-updated">{fmtDate(item.updatedAt)}</div>}
    </div>
  );
});

export default FeatureCard;
