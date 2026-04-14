import { STATUS_CLS, STATUS_LBL } from '../app/constants.js';
import { isEditor } from '../app/admin.js';
import { fmtDate, getOwnerColor, getPK, normOwner } from '../app/state.js';
import { getPresetCSS } from '../app/theme.js';
import { useAppStore } from '../store/useAppStore.js';

function highlightText(value, query) {
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

function cssTextToStyle(cssText) {
  if (!cssText) return {};

  return cssText
    .split(';')
    .map(rule => rule.trim())
    .filter(Boolean)
    .reduce((style, rule) => {
      const separatorIndex = rule.indexOf(':');
      if (separatorIndex === -1) return style;

      const property = rule
        .slice(0, separatorIndex)
        .trim()
        .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      const value = rule.slice(separatorIndex + 1).trim();

      if (property && value) {
        style[property] = value;
      }
      return style;
    }, {});
}

function PreviewOverlay({ item, lockInfo, previewData }) {
  if (!previewData) return null;
  const preview = previewData.preview || {};
  const rows = [
    ['기능명', preview.name, item.name],
    ['우선순위', preview.priority, item.priority],
    ['상태', preview.status, item.status],
    ['담당자', preview.owner, item.owner],
    ['그룹', preview.group, item.group],
    ['서브그룹', preview.subGroup, item.subGroup],
    ['카테고리', preview.category, item.category],
    ['서브카테고리', preview.subCategory, item.subCategory],
  ].filter(([, next, current]) => next && next !== current);

  if (!rows.length) return null;

  return (
    <div className="edit-preview-overlay">
      <div style={{ fontWeight: 700, marginBottom: '4px' }}>✏ {lockInfo.user} 편집 중</div>
      {rows.map(([label, value]) => (
        <div key={label}>{label}: <b>{value}</b></div>
      ))}
    </div>
  );
}

export default function FeatureCard({
  item,
  colors,
  id,
  extraClass = '',
  animationIndex = -1,
  onClick,
  onDoubleClick,
  onDragStart,
  onDragEnd,
  onContextMenu,
}) {
  const display = useAppStore(s => s.display);
  const settings = useAppStore(s => s.settings);
  const searchQ = useAppStore(s => s.searchQ);
  const editLocks = useAppStore(s => s.editLocks);
  const previews = useAppStore(s => s.previews);

  const pk = getPK(item.priority);
  const pkColorKey = pk[0].toUpperCase() + pk.slice(1);
  const pHex = colors[`p${pkColorKey}`] || '#888';
  const pBg = colors[`p${pkColorKey}Bg`] || '#eee';
  const priorityStyle = cssTextToStyle(getPresetCSS(settings.priorityStyles[pk], pHex, pBg));
  const isNew = item.key?.charAt(0) === 'N';
  const isDeleted = item.isDelete === 'Y';
  const ownerColor = getOwnerColor(item.owner);
  const lockInfo = editLocks[item.key];
  const myName = settings.userName || '익명';
  const isLockedByOther = lockInfo && lockInfo.user !== myName;
  const previewData = isLockedByOther ? previews[item.key] : null;
  const canDrag = isEditor();

  return (
    <div
      className={[
        'mitem',
        isDeleted ? 'item-del' : '',
        isLockedByOther ? 'item-locked' : '',
        extraClass,
      ].filter(Boolean).join(' ')}
      draggable={canDrag}
      data-key={item.key}
      id={id}
      style={{
        ...priorityStyle,
        borderRadius: `${settings.cardRadius}px`,
        marginBottom: `${settings.cardGap}px`,
        animationDelay: animationIndex >= 0 ? `${animationIndex * 40}ms` : undefined,
      }}
      onDragStart={canDrag ? onDragStart : undefined}
      onDragEnd={canDrag ? onDragEnd : undefined}
      onMouseOver={event => window.startTT?.(event, item.key)}
      onMouseOut={() => window.clearTT?.()}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu || (event => window.openCtxMenu?.(event, item.key))}
    >
      {isLockedByOther && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: '.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '6px 6px 0 0', pointerEvents: 'none' }}>
          🔒 {lockInfo.user} 편집 중
        </div>
      )}
      <PreviewOverlay item={item} lockInfo={lockInfo} previewData={previewData} />
      {canDrag && (
        <div className="card-actions" onClick={event => event.stopPropagation()}>
          <button className="card-act-btn" title="편집" onClick={() => window.openEditModal?.(item.key)}>✏</button>
          <button className="card-act-btn" title="복제" onClick={() => window.duplicateItem?.(item.key)}>⧉</button>
        </div>
      )}
      <div className="item-hd">
        <span className="item-key">{item.key}</span>
        {item.isImportant === 'Y' && display.showStar && <span className="item-star">★</span>}
        {isNew && display.showNewBadge && <span className="item-nbadge">N</span>}
        {display.showMdBadge && item.mdContent && (
          <span
            className="md-badge"
            onClick={event => {
              event.stopPropagation();
              window.openMdModal?.(item.key);
            }}
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
              onClick={event => {
                event.stopPropagation();
                window.openStatusMenu?.(event, item.key);
              }}
            >
              {STATUS_LBL[item.status] || item.status}
            </span>
          ) : (
            <span
              className="status-badge"
              style={{ background: 'var(--surface-3)', color: 'var(--text-3)', opacity: .6 }}
              onClick={event => {
                event.stopPropagation();
                window.openStatusMenu?.(event, item.key);
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
}
