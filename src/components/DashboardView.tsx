import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { STATUS_ACCENT, STATUS_OPTS } from '../app/constants.js';
import { useAppStore } from '../store/useAppStore.js';
import { useModals } from '../hooks/useModals.js';
import { apiFetch } from '../utils/api.js';
import {
  getFiltered, isFilterActive, fmtDate,
  getOwnerColor, getPK, normOwner
} from '../utils/itemUtils.js';
import type { Item, ChangeLogEntry, DashboardData, OwnerCounts, AppSettings } from '../types/index.js';

// #48C: insight 섹션을 groupProgress + ownersPanel 로 분리
const SECTION_DEFAULTS = ['stats', 'groupProgress', 'ownersPanel', 'heatmap', 'metrics'];
const SECTION_KEYS = new Set(SECTION_DEFAULTS);
const LEGEND_OPACITY = [0.06, 0.30, 0.55, 0.80, 1.00];

function isSectionVisible(visibility: Record<string, boolean> | undefined, section: string): boolean {
  return visibility?.[section] !== false;
}

function useCountUp(value: number, duration = 1000): number {
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
    const tick = (now: number) => {
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

interface CountUpNumberProps {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}

function CountUpNumber({ value, className = '', style }: CountUpNumberProps) {
  const displayValue = useCountUp(value);
  return (
    <div className={className} style={style}>
      {displayValue.toLocaleString()}
    </div>
  );
}

interface DailyMetric {
  date: string;
  changedItems?: number;
  activeItems?: number;
  totalItems?: number;
  deletedItems?: number;
  doneRatio?: number;
  doneItems?: number;
  statusCounts?: Record<string, number>;
}

export default function DashboardView() {
  const items      = useAppStore(s => s.items);
  const changeLog  = useAppStore(s => s.changeLog);
  const settings   = useAppStore(s => s.settings);
  const filters    = useAppStore(s => s.filters);
  const searchQ    = useAppStore(s => s.searchQ);
  const serverTs   = useAppStore(s => s.serverTs);
  const view       = useAppStore(s => s.view);
  const setFilters = useAppStore(s => s.setFilters);
  const setSearchQ = useAppStore(s => s.setSearchQ);
  const setView    = useAppStore(s => s.setView);
  const { openEditModal } = useModals();

  const containerRef = useRef<HTMLDivElement>(null);
  const [hmView, setHmView] = useState<'cat' | 'status'>('cat');
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [metricsStatus, setMetricsStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  // #48A: 대시보드 진입 시 최초 1회만 필터 패널 자동 숨김
  const autoHiddenRef = useRef(false);
  useEffect(() => {
    if (view === 'dashboard' && !autoHiddenRef.current) {
      autoHiddenRef.current = true;
      const { settings: s, setSettings } = useAppStore.getState();
      if (s.panelVisible) {
        setSettings({ ...s, panelVisible: false });
      }
    }
  }, [view]);

  const resetFilters = useCallback(() => {
    setFilters({
      priorities: [],
      statuses: [],
      showDeleted: false,
      importantOnly: false,
      owners: [],
    });
    setSearchQ('');
  }, [setFilters, setSearchQ]);

  const data = useMemo((): DashboardData => {
    const filterOn = isFilterActive(filters, searchQ);
    const all = filterOn ? getFiltered(items, filters, searchQ) : items.filter(it => it.isDelete !== 'Y');
    const total = all.length;
    const statusCount: Record<string, number> = Object.fromEntries(STATUS_OPTS.map((status: string) => [status, 0]));
    const ownerMap: Record<string, OwnerCounts> = {};
    let imp = 0;
    let done = 0;

    all.forEach((item: Item) => {
      if (item.isImportant === 'Y') imp += 1;
      if (item.status === 'done') done += 1;
      if (statusCount[item.status || ''] !== undefined) statusCount[item.status || ''] += 1;

      const owner = normOwner(item.owner);
      if (!ownerMap[owner]) {
        ownerMap[owner] = { total: 0, high: 0, mid: 0, low: 0, status: {} };
      }
      ownerMap[owner].total += 1;
      ownerMap[owner][getPK(item.priority || '')] += 1;
      if (item.status) ownerMap[owner].status[item.status] = (ownerMap[owner].status[item.status] || 0) + 1;
    });

    // #47A: 알파벳(한글) 순으로 정렬
    const groups = [...new Set(all.map((item: Item) => item.group).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b, 'ko')
    );
    const cats = [...new Set(all.map((item: Item) => item.category).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b, 'ko')
    );

    const configuredSections = (settings.dbSections || SECTION_DEFAULTS).filter((section: string) => SECTION_KEYS.has(section));
    const sections = [
      ...configuredSections,
      ...SECTION_DEFAULTS.filter(section => !configuredSections.includes(section)),
    ].filter(section => isSectionVisible(settings.dbSectionVisibility, section));
    const recent = (changeLog || []).slice().reverse().slice(0, settings.changeLogMax || 50);
    const owners = Object.entries(ownerMap)
      .sort((a, b) => {
        if (b[1].total !== a[1].total) return b[1].total - a[1].total;
        if (b[1].high !== a[1].high) return b[1].high - a[1].high;
        return (b[1].status.done || 0) - (a[1].status.done || 0);
      })
      .slice(0, 10) as [string, OwnerCounts][];

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
    let cancelled = false;
    if (settings.storageMode !== 'server') {
      setDailyMetrics([]);
      setMetricsStatus('loaded');
      return () => { cancelled = true; };
    }
    setMetricsStatus('loading');
    apiFetch('/api/metrics?days=30')
      .then((json: { metrics?: DailyMetric[] }) => {
        if (cancelled) return;
        setDailyMetrics(Array.isArray(json.metrics) ? json.metrics : []);
        setMetricsStatus('loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setDailyMetrics([]);
        setMetricsStatus('error');
      });
    return () => { cancelled = true; };
  }, [serverTs, settings.storageMode, settings.serverUrl]);

  // ResizeObserver 제거 — CSS grid align-items:stretch 로 대체 (#4 패널 수정)

  // 'recent' 섹션 표시 여부 (db-body-right 우측 컬럼 제어)
  const showRecentPanel = isSectionVisible(settings.dbSectionVisibility, 'recent');
  // 좌측 섹션 목록에서 'recent' 는 제외 (우측 패널로 별도 표시)
  const leftSections = data.sections.filter(s => s !== 'recent');

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

      <div className={`db-body${showRecentPanel ? '' : ' db-body--no-right'}`}>
        <div className="db-body-left">
          {leftSections.map(section => (
            <Section
              key={section}
              section={section}
              data={data}
              hmView={hmView}
              setHmView={setHmView}
              settings={settings}
              metrics={dailyMetrics}
              metricsStatus={metricsStatus}
            />
          ))}
        </div>

        {showRecentPanel && (
          <div className="db-body-right">
            <div className="db-panel db-timeline-panel">
              <div className="db-panel-hd">
                <div className="db-panel-title">최근 변경</div>
                <div className="db-panel-sub">추가·수정·삭제 기준</div>
              </div>
              <Timeline recent={data.recent} openEditModal={openEditModal} switchView={setView} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  section: string;
  data: DashboardData;
  hmView: 'cat' | 'status';
  setHmView: (v: 'cat' | 'status') => void;
  settings: AppSettings;
  metrics: DailyMetric[];
  metricsStatus: string;
}

function Section({ section, data, hmView, setHmView, settings, metrics, metricsStatus }: SectionProps) {
  if (section === 'stats')        return <StatsSection data={data} settings={settings} />;
  // #48C: groupProgress / ownersPanel 로 분리
  if (section === 'groupProgress') return <GroupProgressSection data={data} settings={settings} />;
  if (section === 'ownersPanel')   return <OwnersPanelSection data={data} settings={settings} />;
  if (section === 'heatmap')       return <HeatmapSection data={data} hmView={hmView} setHmView={setHmView} settings={settings} />;
  if (section === 'metrics')       return <MetricsTrendPanel metrics={metrics} status={metricsStatus} settings={settings} />;
  return null;
}

function StatsSection({ data, settings }: { data: DashboardData; settings: AppSettings }) {
  return (
    <div className="db-cards">
      <div className="db-card db-card--theme">
        <div className="db-card-label">전체 기능</div>
        <CountUpNumber className="db-card-value" value={data.total} />
        <div className="db-card-sub">중요 <strong>{data.imp}</strong>개 포함</div>
      </div>
      {(STATUS_OPTS as string[]).map(status => (
        <div className="db-card db-card--mini" key={status}>
          <div className="db-card-label">{settings.statusLabels?.[status] || status}</div>
          <CountUpNumber
            className="db-card-value db-card-value--mini"
            style={{ color: (STATUS_ACCENT as Record<string, string>)[status] }}
            value={data.statusCount[status]}
          />
          <div className="db-card-sub">{data.total > 0 ? Math.round(data.statusCount[status] / data.total * 100) : 0}%</div>
        </div>
      ))}
    </div>
  );
}

// #48C: GroupProgressSection — 그룹별 진척도 독립 섹션
function GroupProgressSection({ data, settings }: { data: DashboardData; settings: AppSettings }) {
  return (
    <div className="db-panel">
      <div className="db-panel-hd">
        <div className="db-panel-title">그룹별 진척도</div>
        <div className="db-panel-sub">대기 · 시작가능 · 진행중 · 검토중 · 완료 비율</div>
      </div>
      <GroupProgress data={data} settings={settings} />
    </div>
  );
}

// #48C: OwnersPanelSection — 담당별 기능 현황 독립 섹션
function OwnersPanelSection({ data, settings }: { data: DashboardData; settings: AppSettings }) {
  return (
    <div className="db-panel">
      <div className="db-panel-hd">
        <div className="db-panel-title">담당별 기능 현황</div>
      </div>
      <OwnersPanel owners={data.owners} settings={settings} />
    </div>
  );
}

function HeatmapSection({ data, hmView, setHmView, settings }: {
  data: DashboardData;
  hmView: 'cat' | 'status';
  setHmView: (v: 'cat' | 'status') => void;
  settings: AppSettings;
}) {
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

function MetricsTrendPanel({ metrics, status, settings }: {
  metrics: DailyMetric[];
  status: string;
  settings: AppSettings;
}) {
  const rows = (metrics || []).slice(-14);
  const latest = rows[rows.length - 1] || null;
  const previous = rows[rows.length - 2] || null;
  const maxChanged = Math.max(1, ...rows.map(m => m.changedItems || 0));
  const maxTotal = Math.max(1, ...rows.map(m => m.activeItems || m.totalItems || 0));
  const points = rows.map((m, index) => {
    const x = rows.length === 1 ? 100 : (index / (rows.length - 1)) * 200;
    const ratio = Math.max(0, Math.min(100, Number(m.doneRatio) || 0));
    const y = 70 - (ratio / 100) * 60;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const deltaChanged = latest && previous ? (latest.changedItems || 0) - (previous.changedItems || 0) : 0;
  const latestStatusCounts = latest?.statusCounts || {};

  return (
    <div className="db-panel db-metrics-panel">
      <div className="db-panel-hd">
        <div className="db-panel-title">일별 리포트</div>
        <div className="db-panel-sub">매일 0시 스냅샷 기준</div>
      </div>
      {status === 'loading' && <div className="db-empty">일별 지표를 불러오는 중입니다</div>}
      {status === 'error' && <div className="db-empty">일별 지표를 불러오지 못했습니다</div>}
      {status !== 'loading' && status !== 'error' && rows.length === 0 && (
        <div className="db-empty">아직 기록된 일별 지표가 없습니다</div>
      )}
      {rows.length > 0 && (
        <>
          <div className="db-metric-summary">
            <div>
              <span className="db-metric-label">최근 변경</span>
              <strong>{latest!.changedItems || 0}</strong>
              <span className={deltaChanged > 0 ? 'up' : deltaChanged < 0 ? 'down' : ''}>
                {deltaChanged === 0 ? '전일 동일' : `${deltaChanged > 0 ? '+' : ''}${deltaChanged}`}
              </span>
            </div>
            <div>
              <span className="db-metric-label">활성 기능</span>
              <strong>{latest!.activeItems ?? latest!.totalItems ?? 0}</strong>
              <span>삭제 {latest!.deletedItems || 0}</span>
            </div>
            <div>
              <span className="db-metric-label">완료율</span>
              <strong>{latest!.doneRatio || 0}%</strong>
              <span>{latest!.doneItems || 0}개 완료</span>
            </div>
          </div>

          <div className="db-trend-grid">
            <div className="db-trend-chart">
              <svg viewBox="0 0 200 78" role="img" aria-label="완료율 추이">
                <line x1="0" y1="70" x2="200" y2="70" />
                <polyline points={points} />
                {rows.map((m, index) => {
                  const [x, y] = points.split(' ')[index].split(',');
                  return <circle key={m.date} cx={x} cy={y} r="2.5" />;
                })}
              </svg>
              <div className="db-trend-caption">완료율 추이</div>
            </div>
            <div className="db-change-bars">
              {rows.map(m => {
                const height = Math.max(4, ((m.changedItems || 0) / maxChanged) * 100);
                const totalHeight = Math.max(8, (((m.activeItems || m.totalItems || 0) / maxTotal) * 100));
                return (
                  <div className="db-change-bar" key={m.date} title={`${m.date}: 변경 ${m.changedItems || 0}개`}>
                    <span className="db-change-total" style={{ height: `${totalHeight}%` }} />
                    <span className="db-change-fill" style={{ height: `${height}%` }} />
                    <em>{formatMetricDay(m.date)}</em>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="db-status-strip">
            {(STATUS_OPTS as string[]).map(statusKey => (
              <span key={statusKey}>
                <i style={{ background: (STATUS_ACCENT as Record<string, string>)[statusKey] }} />
                {settings.statusLabels?.[statusKey] || statusKey} {latestStatusCounts[statusKey] || 0}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function formatMetricDay(dateText: string): string {
  if (!dateText) return '';
  const parts = dateText.split('-');
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : dateText;
}

function GroupProgress({ data, settings }: { data: DashboardData; settings: AppSettings }) {
  if (data.groups.length === 0) return <div className="db-empty">그룹 데이터가 없습니다</div>;

  return (
    <div className="db-gp-list">
      {data.groups.map(group => {
        const groupItems = data.all.filter((item: Item) => item.group === group);
        const total = groupItems.length;
        if (total === 0) return null;

        const counts: Record<string, number> = Object.fromEntries((STATUS_OPTS as string[]).map(s => [s, 0]));
        groupItems.forEach((item: Item) => {
          if (counts[item.status || ''] !== undefined) counts[item.status || ''] += 1;
        });
        const donePct = Math.round((counts.done || 0) / total * 100);

        return (
          <div className="db-gp-row" key={group}>
            <div className="db-gp-info">
              <span className="db-gp-name" title={group}>{group}</span>
              <span className="db-gp-total">{total}개</span>
            </div>
            <div className="db-gp-bar-area">
              <div className="db-gp-bar-wrap">
                <div className="db-gp-track">
                  {(STATUS_OPTS as string[]).filter(s => counts[s] > 0).map(s => (
                    <div
                      className="db-gp-seg"
                      key={s}
                      style={{
                        width: `${(counts[s] / total * 100).toFixed(1)}%`,
                        background: (STATUS_ACCENT as Record<string, string>)[s],
                      }}
                      title={`${settings.statusLabels?.[s] || s} ${counts[s]}개 (${Math.round(counts[s] / total * 100)}%)`}
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

function OwnersPanel({ owners, settings }: { owners: [string, OwnerCounts][]; settings: AppSettings }) {
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
        ].filter(Boolean) as React.ReactNode[];

        return (
          <div className="db-owner-row-unified" key={owner}>
            <div className="db-owner-info">
              <span className="db-owner-dot" style={{ background: getOwnerColor(owner) }} />
              <span className="db-owner-name">{owner}</span>
              <span className="db-owner-total">{total}</span>
            </div>
            <div className="db-owner-bar-wrap" style={{ flex: 1 }}>
              <div className="db-bar-track">
                {(STATUS_OPTS as string[]).map(status => (
                  <div
                    className="db-owner-seg"
                    key={status}
                    style={{
                      width: `${total > 0 ? ((counts.status[status] || 0) / total * 100).toFixed(1) : 0}%`,
                      background: (STATUS_ACCENT as Record<string, string>)[status],
                    }}
                    title={`${settings.statusLabels?.[status] || status} ${counts.status[status] || 0}`}
                  />
                ))}
              </div>
              <StatusLegend counts={counts.status} statusLabels={settings.statusLabels} />
            </div>
            <div style={{ minWidth: '100px', textAlign: 'right', fontSize: '.7rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px', flexShrink: 0 }}>
              {prios.length ? prios.reduce((acc: React.ReactNode[], node, idx) => {
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

function HeatmapGrid({ data, hmView, settings }: {
  data: DashboardData;
  hmView: 'cat' | 'status';
  settings: AppSettings;
}) {
  const rows = hmView === 'cat' ? data.cats : (STATUS_OPTS as string[]);
  if (data.groups.length === 0 || rows.length === 0) return <div className="db-empty">데이터가 없습니다</div>;

  const heatmap: Record<string, number> = {};
  let max = 0;
  data.all.forEach((item: Item) => {
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
            <div
              className="db-hm-row-hd"
              title={row}
              style={hmView === 'status' ? { color: (STATUS_ACCENT as Record<string, string>)[row] || 'var(--text-3)', fontWeight: 700 } : undefined}
            >
              {hmView === 'status' ? (settings.statusLabels?.[row] || row) : row}
            </div>
            {data.groups.map(group => {
              const count = heatmap[`${group}||${row}`] || 0;
              const opacity = max > 0 ? (count === 0 ? 0.06 : 0.15 + count / max * 0.85) : 0.06;
              return (
                <div
                  className={`db-hm-cell${hmView === 'status' ? ` db-hm-cell--status-${row}` : ''}`}
                  style={{ '--op': opacity.toFixed(2) } as React.CSSProperties}
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
            <div className="db-hm-legend-seg" style={{ '--op': opacity } as React.CSSProperties} key={opacity} />
          ))}
        </div>
        <span className="db-hm-legend-lbl">높음</span>
      </div>
    </div>
  );
}

function Timeline({ recent, openEditModal, switchView }: {
  recent: ChangeLogEntry[];
  openEditModal: (key: string) => void;
  switchView: (v: string) => void;
}) {
  if (recent.length === 0) return <div className="db-empty">변경 기록이 없습니다</div>;

  return (
    <>
      <div className="db-timeline">
        {recent.map((entry, index) => {
          const actionColor = ({
            추가: 'var(--success)', 수정: 'var(--accent)', 삭제처리: 'var(--warning)',
            삭제복원: 'var(--text-3)', 완전삭제: 'var(--danger)', 상태변경: 'var(--accent)',
          } as Record<string, string>)[entry.action] || 'var(--text-3)';
          const isDeleted = entry.action === '완전삭제' || entry.action === '삭제처리';

          return (
            <div className="db-tl-item" style={{ '--stagger': index } as React.CSSProperties} key={`${entry.ts}:${entry.key}:${index}`}>
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
                  {(entry as ChangeLogEntry & { name?: string }).name || entry.key}
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

function StatusLegend({ counts, statusLabels }: {
  counts: Record<string, number>;
  statusLabels?: Record<string, string>;
}) {
  return (
    <div className="db-gp-legend">
      {(STATUS_OPTS as string[]).filter(status => counts[status] > 0).map(status => (
        <span className="db-gp-leg-item" key={status}>
          <span className="db-gp-leg-dot" style={{ background: (STATUS_ACCENT as Record<string, string>)[status] }} />
          {statusLabels?.[status] || status} {counts[status]}
        </span>
      ))}
    </div>
  );
}
