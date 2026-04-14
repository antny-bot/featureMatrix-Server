import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { STATUS_ACCENT, STATUS_OPTS } from '../app/constants.js';
import { useAppStore } from '../store/useAppStore.js';
import { useModals } from '../hooks/useModals.js';
import { 
  getFiltered, isFilterActive, fmtDate, 
  getOwnerColor, getPK, normOwner 
} from '../utils/itemUtils.js';

const SECTION_DEFAULTS = ['stats', 'insight', 'heatmap'];
const SECTION_KEYS = new Set(SECTION_DEFAULTS);
const LEGEND_OPACITY = [0.06, 0.30, 0.55, 0.80, 1.00];

function useCountUp(value, duration = 1000) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const startValue = displayValue;
    const diff = value - startValue;
    if (!diff) {
      setDisplayValue(value);
      return undefined;
    }

    const startedAt = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + diff * eased));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return displayValue;
}

function CountUpNumber({ value, className = '', style }) {
  const displayValue = useCountUp(value);
  return (
    <div className={className} style={style}>
      {displayValue.toLocaleString()}
    </div>
  );
}

export default function DashboardView() {
  const store = useAppStore();
  const { openEditModal } = useModals();
  const { items, changeLog, settings, filters, searchQ } = store;

  const containerRef = useRef(null);
  const [hmView, setHmView] = useState('cat');

  const resetFilters = useCallback(() => {
    store.setFilters({
      priorities: [],
      statuses: [],
      showDeleted: false,
      importantOnly: false,
      owners: [],
    });
    store.setSearchQ('');
  }, [store]);

  const data = useMemo(() => {
    const filterOn = isFilterActive(filters, searchQ);
    const all = filterOn ? getFiltered(items, filters, searchQ) : items.filter(it => it.isDelete !== 'Y');
    const total = all.length;
    const statusCount = Object.fromEntries(STATUS_OPTS.map(status => [status, 0]));
    const ownerMap = {};
    let imp = 0;
    let done = 0;

    all.forEach(item => {
      if (item.isImportant === 'Y') imp += 1;
      if (item.status === '완료') done += 1;
      if (statusCount[item.status] !== undefined) statusCount[item.status] += 1;

      const owner = normOwner(item.owner);
      if (!ownerMap[owner]) {
        ownerMap[owner] = { total: 0, high: 0, mid: 0, low: 0, status: {} };
      }
      ownerMap[owner].total += 1;
      ownerMap[owner][getPK(item.priority)] += 1;
      if (item.status) ownerMap[owner].status[item.status] = (ownerMap[owner].status[item.status] || 0) + 1;
    });

    const allGroups = [...new Set(all.map(item => item.group).filter(Boolean))];
    const allCats = [...new Set(all.map(item => item.category).filter(Boolean))];
    const orderedGroups = settings.groupOrder.filter(group => allGroups.includes(group));
    const groups = [...orderedGroups, ...allGroups.filter(group => !orderedGroups.includes(group))];
    const orderedCats = settings.catOrder.filter(cat => allCats.includes(cat));
    const cats = [...orderedCats, ...allCats.filter(cat => !orderedCats.includes(cat))];
    const sections = (settings.dbSections || SECTION_DEFAULTS).filter(section => SECTION_KEYS.has(section));
    const recent = (changeLog || []).slice().reverse().slice(0, settings.changeLogMax || 50);
    const owners = Object.entries(ownerMap)
      .sort((a, b) => {
        if (b[1].total !== a[1].total) return b[1].total - a[1].total;
        if (b[1].high !== a[1].high) return b[1].high - a[1].high;
        return (b[1].status['완료'] || 0) - (a[1].status['완료'] || 0);
      })
      .slice(0, 10);

    return {
      all,
      cats,
      done,
      filterOn,
      groups,
      heroName: settings.dbHeroName || '프로젝트 현황',
      imp,
      owners,
      recent,
      sections,
      statusCount,
      total,
    };
  }, [items, changeLog, settings, filters, searchQ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const bodyLeft = container.querySelector('.db-body-left');
    const bodyRight = container.querySelector('.db-body-right');
    if (!bodyLeft || !bodyRight) return;

    const ro = new ResizeObserver(() => {
      bodyRight.style.maxHeight = `${bodyLeft.offsetHeight}px`;
    });
    ro.observe(bodyLeft);

    return () => ro.disconnect();
  }, []);

  return (
    <div className="db-wrap" ref={containerRef}>
      <div className="db-hero">
        <div>
          <div className="db-eyebrow">Mission Control</div>
          <h2 className="db-title">{data.heroName}</h2>
          {data.filterOn && (
            <div style={{ marginTop: '8px', fontSize: '.75rem', background: 'var(--accent-l)', color: 'var(--accent)', borderRadius: '6px', padding: '4px 10px', display: 'inline-block' }}>
              🔍 필터 적용 중{' '}
              <button
                onClick={resetFilters}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit', padding: 0 }}
              >
                전체 보기
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="db-body">
        <div className="db-body-left">
          {data.sections.map(section => (
            <Section key={section} section={section} data={data} hmView={hmView} setHmView={setHmView} settings={settings} />
          ))}
        </div>

        <div className="db-body-right">
          <div className="db-panel db-timeline-panel">
            <div className="db-panel-hd">
              <div className="db-panel-title">최근 변경</div>
              <div className="db-panel-sub">추가·수정·삭제 기준</div>
            </div>
            <Timeline recent={data.recent} openEditModal={openEditModal} switchView={store.setView} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ section, data, hmView, setHmView, settings }) {
  if (section === 'stats') return <StatsSection data={data} settings={settings} />;
  if (section === 'insight') return <InsightSection data={data} settings={settings} />;
  if (section === 'heatmap') return <HeatmapSection data={data} hmView={hmView} setHmView={setHmView} settings={settings} />;
  return null;
}

function StatsSection({ data, settings }) {
  return (
    <div className="db-cards">
      <div className="db-card db-card--theme">
        <div className="db-card-label">전체 기능</div>
        <CountUpNumber className="db-card-value" value={data.total} />
        <div className="db-card-sub">중요 <strong>{data.imp}</strong>개 포함</div>
      </div>
      {STATUS_OPTS.map(status => (
        <div className="db-card db-card--mini" key={status}>
          <div className="db-card-label">{settings.statusLabels?.[status] || status}</div>
          <CountUpNumber className="db-card-value db-card-value--mini" style={{ color: STATUS_ACCENT[status] }} value={data.statusCount[status]} />
          <div className="db-card-sub">{data.total > 0 ? Math.round(data.statusCount[status] / data.total * 100) : 0}%</div>
        </div>
      ))}
    </div>
  );
}

function InsightSection({ data, settings }) {
  return (
    <>
      <div className="db-panel">
        <div className="db-panel-hd">
          <div className="db-panel-title">그룹별 진척도</div>
          <div className="db-panel-sub">대기 · 시작가능 · 진행중 · 검토중 · 완료 비율</div>
        </div>
        <GroupProgress data={data} settings={settings} />
      </div>
      <div className="db-panel">
        <div className="db-panel-hd">
          <div className="db-panel-title">담당별 기능 현황</div>
        </div>
        <OwnersPanel owners={data.owners} settings={settings} />
      </div>
    </>
  );
}

function HeatmapSection({ data, hmView, setHmView, settings }) {
  return (
    <div className="db-panel db-heatmap-panel">
      <div className="db-panel-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="db-panel-title">기능 분포 히트맵</div>
          <div className="db-panel-sub">{hmView === 'cat' ? '그룹 × 카테고리' : '그룹 × 상태'} 교차 밀도</div>
        </div>
        <div className="db-hm-tabs">
          <button className={`db-hm-tab${hmView === 'cat' ? ' on' : ''}`} onClick={() => setHmView('cat')}>그룹×카테고리</button>
          <button className={`db-hm-tab${hmView === 'status' ? ' on' : ''}`} onClick={() => setHmView('status')}>그룹×상태</button>
        </div>
      </div>
      <HeatmapGrid data={data} hmView={hmView} settings={settings} />
    </div>
  );
}

function GroupProgress({ data, settings }) {
  if (data.groups.length === 0) return <div className="db-empty">그룹 데이터가 없습니다</div>;

  return (
    <div className="db-gp-list">
      {data.groups.map(group => {
        const items = data.all.filter(item => item.group === group);
        const total = items.length;
        if (total === 0) return null;

        const counts = Object.fromEntries(STATUS_OPTS.map(status => [status, 0]));
        items.forEach(item => {
          if (counts[item.status] !== undefined) counts[item.status] += 1;
        });
        const donePct = Math.round((counts['완료'] || 0) / total * 100);

        return (
          <div className="db-gp-row" key={group}>
            <div className="db-gp-info">
              <span className="db-gp-name" title={group}>{group}</span>
              <span className="db-gp-total">{total}개</span>
            </div>
            <div className="db-gp-bar-area">
              <div className="db-gp-bar-wrap">
                <div className="db-gp-track">
                  {STATUS_OPTS.filter(status => counts[status] > 0).map(status => (
                    <div
                      className="db-gp-seg"
                      key={status}
                      style={{
                        width: `${(counts[status] / total * 100).toFixed(1)}%`,
                        background: STATUS_ACCENT[status],
                      }}
                      title={`${settings.statusLabels?.[status] || status} ${counts[status]}개 (${Math.round(counts[status] / total * 100)}%)`}
                    />
                  ))}
                </div>
                <span className="db-gp-pct" style={{ color: donePct >= 100 ? 'var(--success)' : 'var(--text-2)' }}>
                  {donePct}%
                </span>
              </div>
              <StatusLegend counts={counts} statusLabels={settings.statusLabels} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OwnersPanel({ owners, settings }) {
  if (owners.length === 0) return <div className="db-empty">담당자 정보가 없습니다</div>;

  return (
    <div className="db-owners-unified">
      <div className="db-owners-hdr">
        <div className="db-owner-info" />
        <div className="db-owners-bar-hdr" style={{ flex: 1 }}>진행상태</div>
        <div className="db-owners-bar-hdr" style={{ textAlign: 'right', minWidth: '100px' }}>우선순위</div>
      </div>
      {owners.map(([owner, counts]) => {
        const total = counts.total;
        const prios = [
          counts.high > 0 && <span key="high" style={{ color: 'var(--p-high,var(--danger))', fontWeight: 700 }}>상 {counts.high}</span>,
          counts.mid > 0 && <span key="mid" style={{ color: 'var(--p-mid,var(--accent))' }}>중 {counts.mid}</span>,
          counts.low > 0 && <span key="low" style={{ color: 'var(--text-3)' }}>하 {counts.low}</span>,
        ].filter(Boolean);

        return (
          <div className="db-owner-row-unified" key={owner}>
            <div className="db-owner-info">
              <span className="db-owner-dot" style={{ background: getOwnerColor(owner) }} />
              <span className="db-owner-name">{owner}</span>
              <span className="db-owner-total">{total}</span>
            </div>
            <div className="db-owner-bar-wrap" style={{ flex: 1 }}>
              <div className="db-bar-track">
                {STATUS_OPTS.map(status => (
                  <div
                    className="db-owner-seg"
                    key={status}
                    style={{
                      width: `${total > 0 ? ((counts.status[status] || 0) / total * 100).toFixed(1) : 0}%`,
                      background: STATUS_ACCENT[status],
                    }}
                    title={`${settings.statusLabels?.[status] || status} ${counts.status[status] || 0}`}
                  />
                ))}
              </div>
              <StatusLegend counts={counts.status} statusLabels={settings.statusLabels} />
            </div>
            <div style={{ minWidth: '100px', textAlign: 'right', fontSize: '.7rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px', flexShrink: 0 }}>
              {prios.length ? prios.reduce((acc, node, idx) => {
                if (idx > 0) acc.push(<span style={{ color: 'var(--border-2)', margin: '0 2px' }} key={`sep-${idx}`}>|</span>);
                acc.push(node);
                return acc;
              }, []) : <span style={{ color: 'var(--text-3)' }}>-</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HeatmapGrid({ data, hmView, settings }) {
  const rows = hmView === 'cat' ? data.cats : STATUS_OPTS;
  if (data.groups.length === 0 || rows.length === 0) return <div className="db-empty">데이터가 없습니다</div>;

  const heatmap = {};
  let max = 0;
  data.all.forEach(item => {
    const rowKey = hmView === 'cat' ? item.category : item.status;
    if (!item.group || !rowKey) return;
    const key = `${item.group}||${rowKey}`;
    heatmap[key] = (heatmap[key] || 0) + 1;
    if (heatmap[key] > max) max = heatmap[key];
  });

  return (
    <div className="db-hm-wrap">
      <div className="db-hm-grid" style={{ gridTemplateColumns: `auto repeat(${data.groups.length},1fr)` }}>
        <div className="db-hm-corner" />
        {data.groups.map(group => <div className="db-hm-col-hd" title={group} key={group}>{group}</div>)}
        {rows.map(row => (
          <div style={{ display: 'contents' }} key={row}>
            <div className="db-hm-row-hd" title={row} style={hmView === 'status' ? { color: STATUS_ACCENT[row] || 'var(--text-3)', fontWeight: 700 } : undefined}>
              {hmView === 'status' ? (settings.statusLabels?.[row] || row) : row}
            </div>
            {data.groups.map(group => {
              const count = heatmap[`${group}||${row}`] || 0;
              const opacity = max > 0 ? (count === 0 ? 0.06 : 0.15 + count / max * 0.85) : 0.06;
              return (
                <div
                  className={`db-hm-cell${hmView === 'status' ? ` db-hm-cell--status-${row}` : ''}`}
                  style={{ '--op': opacity.toFixed(2) }}
                  title={`${group} × ${hmView === 'status' ? (settings.statusLabels?.[row] || row) : row}: ${count}개`}
                  key={`${group}:${row}`}
                >
                  {count > 0 ? count : ''}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="db-hm-legend">
        <span className="db-hm-legend-lbl">밀도:</span>
        <div className="db-hm-legend-bar">
          {LEGEND_OPACITY.map(opacity => (
            <div className="db-hm-legend-seg" style={{ '--op': opacity }} key={opacity} />
          ))}
        </div>
        <span className="db-hm-legend-lbl">높음</span>
      </div>
    </div>
  );
}

function Timeline({ recent, openEditModal, switchView }) {
  if (recent.length === 0) return <div className="db-empty">변경 기록이 없습니다</div>;

  return (
    <>
      <div className="db-timeline">
        {recent.map((entry, index) => {
          const actionColor = {
            추가: 'var(--success)', 수정: 'var(--accent)', 삭제처리: 'var(--warning)', 
            삭제복원: 'var(--text-3)', 완전삭제: 'var(--danger)', 상태변경: 'var(--accent)',
          }[entry.action] || 'var(--text-3)';
          const isDeleted = entry.action === '완전삭제' || entry.action === '삭제처리';

          return (
          <div className="db-tl-item" style={{ '--stagger': index }} key={`${entry.ts}:${entry.key}:${index}`}>
              <div className="db-tl-line-wrap">
                <div className="db-tl-dot" style={{ background: actionColor }} />
                {index < recent.length - 1 && <div className="db-tl-line" />}
              </div>
              <div className="db-tl-body">
                <div className="db-tl-time">{fmtDate(entry.ts)}</div>
                <div
                  className={`db-tl-name${isDeleted ? ' db-tl-name--del' : ''}`}
                  onClick={isDeleted ? undefined : () => openEditModal(entry.key)}
                >
                  {entry.name || entry.key}
                </div>
                <div className="db-tl-meta">
                  <span className="db-tl-action" style={{ color: actionColor }}>{entry.action}</span>
                  {entry.owner && <span className="db-tl-owner" style={{ color: getOwnerColor(entry.owner) }}>{entry.owner}</span>}
                  {entry.user && <span className="db-tl-status">{entry.user}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button className="db-more-btn" onClick={() => switchView('list')}>전체 목록 보기 →</button>
    </>
  );
}

function StatusLegend({ counts, statusLabels }) {
  return (
    <div className="db-gp-legend">
      {STATUS_OPTS.filter(status => counts[status] > 0).map(status => (
        <span className="db-gp-leg-item" key={status}>
          <span className="db-gp-leg-dot" style={{ background: STATUS_ACCENT[status] }} />
          {statusLabels?.[status] || status} {counts[status]}
        </span>
      ))}
    </div>
  );
}
