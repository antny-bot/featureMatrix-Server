/* ══════════════════════════════════════════
   dashboard.js — 대시보드 뷰 렌더링 (B 레이아웃)
   상단: 히어로 + 섹션 순서 기반 렌더
   섹션: stats / insight(그룹진척+담당자+타임라인) / heatmap
══════════════════════════════════════════ */

import { S, esc, normOwner, getOwnerColor, getPK, fmtDate } from './state.js';
import { STATUS_OPTS, STATUS_ACCENT } from './constants.js';
import { getFiltered, isFilterActive } from './render.js';

/* ── 히트맵 HTML ── */
function buildHeatmap(all, groups, cats, hmView) {
  const STATUSES = STATUS_OPTS;

  if (hmView === 'cat') {
    if (groups.length === 0 || cats.length === 0)
      return `<div class="db-empty">데이터가 없습니다</div>`;
    const hmData = {};
    let hmMax = 0;
    all.forEach(it => {
      if (!it.group || !it.category) return;
      const k = `${it.group}||${it.category}`;
      hmData[k] = (hmData[k] || 0) + 1;
      if (hmData[k] > hmMax) hmMax = hmData[k];
    });
    return `<div class="db-hm-wrap">
      <div class="db-hm-grid" style="grid-template-columns:auto repeat(${groups.length},1fr)">
        <div class="db-hm-corner"></div>
        ${groups.map(g => `<div class="db-hm-col-hd" title="${esc(g)}">${esc(g)}</div>`).join('')}
        ${cats.map(c => `
          <div class="db-hm-row-hd" title="${esc(c)}">${esc(c)}</div>
          ${groups.map(g => {
            const cnt = hmData[`${g}||${c}`] || 0;
            const op  = hmMax > 0 ? (cnt === 0 ? 0.06 : 0.15 + cnt/hmMax * 0.85) : 0.06;
            return `<div class="db-hm-cell" style="--op:${op.toFixed(2)}" title="${esc(g)} × ${esc(c)}: ${cnt}개">${cnt > 0 ? cnt : ''}</div>`;
          }).join('')}
        `).join('')}
      </div>
      <div class="db-hm-legend">
        <span class="db-hm-legend-lbl">밀도:</span>
        <div class="db-hm-legend-bar">
          ${[0.06,0.30,0.55,0.80,1.00].map(op => `<div class="db-hm-legend-seg" style="--op:${op}"></div>`).join('')}
        </div>
        <span class="db-hm-legend-lbl">높음</span>
      </div>
    </div>`;
  } else { // hmView === 'status'
    if (groups.length === 0)
      return `<div class="db-empty">데이터가 없습니다</div>`;
    const hmData = {};
    let hmMax = 0;
    all.forEach(it => {
      if (!it.group || !it.status) return;
      const k = `${it.group}||${it.status}`;
      hmData[k] = (hmData[k] || 0) + 1;
      if (hmData[k] > hmMax) hmMax = hmData[k];
    });
    return `<div class="db-hm-wrap">
      <div class="db-hm-grid" style="grid-template-columns:auto repeat(${groups.length},1fr)">
        <div class="db-hm-corner"></div>
        ${groups.map(g => `<div class="db-hm-col-hd" title="${esc(g)}">${esc(g)}</div>`).join('')}
        ${STATUSES.map(st => `
          <div class="db-hm-row-hd" title="${esc(st)}" style="color:${STATUS_ACCENT[st]||'var(--text-3)'};font-weight:700">${esc(st)}</div>
          ${groups.map(g => {
            const cnt = hmData[`${g}||${st}`] || 0;
            const op  = hmMax > 0 ? (cnt === 0 ? 0.06 : 0.15 + cnt/hmMax * 0.85) : 0.06;
            return `<div class="db-hm-cell db-hm-cell--status-${st}" style="--op:${op.toFixed(2)}" title="${esc(g)} × ${esc(st)}: ${cnt}개">${cnt > 0 ? cnt : ''}</div>`;
          }).join('')}
        `).join('')}
      </div>
      <div class="db-hm-legend">
        <span class="db-hm-legend-lbl">밀도:</span>
        <div class="db-hm-legend-bar">
          ${[0.06,0.30,0.55,0.80,1.00].map(op => `<div class="db-hm-legend-seg" style="--op:${op}"></div>`).join('')}
        </div>
        <span class="db-hm-legend-lbl">높음</span>
      </div>
    </div>`;
  }
}

/* ── 그룹별 진척도 섹션 ── */
function buildGroupProgress(all, groups) {
  if (groups.length === 0) return `<div class="db-empty">그룹 데이터가 없습니다</div>`;

  return groups.map(g => {
    const items = all.filter(it => it.group === g);
    const total = items.length;
    if (total === 0) return '';
    const sc = Object.fromEntries(STATUS_OPTS.map(st => [st, 0]));
    items.forEach(it => { if (sc[it.status] !== undefined) sc[it.status]++; });
    const donePct = Math.round((sc['완료'] || 0) / total * 100);

    const segments = STATUS_OPTS.filter(s => sc[s] > 0).map(s =>
      `<div class="db-gp-seg" style="width:${(sc[s]/total*100).toFixed(1)}%;background:${STATUS_ACCENT[s]}"
        title="${s} ${sc[s]}개 (${Math.round(sc[s]/total*100)}%)"></div>`
    ).join('');

    const legend = STATUS_OPTS.filter(s => sc[s] > 0).map(s =>
      `<span class="db-gp-leg-item"><span class="db-gp-leg-dot" style="background:${STATUS_ACCENT[s]}"></span>${s} ${sc[s]}</span>`
    ).join('');

    return `
    <div class="db-gp-row">
      <div class="db-gp-info">
        <span class="db-gp-name" title="${esc(g)}">${esc(g)}</span>
        <span class="db-gp-total">${total}개</span>
      </div>
      <div class="db-gp-bar-area">
        <div class="db-gp-bar-wrap">
          <div class="db-gp-track">${segments}</div>
          <span class="db-gp-pct" style="color:${donePct >= 100 ? 'var(--success)' : 'var(--text-2)'}">${donePct}%</span>
        </div>
        <div class="db-gp-legend">${legend}</div>
      </div>
    </div>`;
  }).filter(Boolean).join('');
}

/* ── buildDashboardHtml(hmView) — HTML 문자열 반환 (순수 함수) ── */
export function buildDashboardHtml(hmView = 'cat') {
  /* 필터가 활성화된 경우 필터 결과를 사용, 아닌 경우 삭제 항목 제외 전체 */
  const filterOn = isFilterActive();
  const all      = filterOn ? getFiltered() : S.items.filter(it => it.isDelete !== 'Y');
  const total    = all.length;

  /* 통계 계산 */
  let high = 0, mid = 0, low = 0, imp = 0, done = 0;
  const statusCount = Object.fromEntries(STATUS_OPTS.map(st => [st, 0]));
  const ownerMap = {};

  all.forEach(it => {
    if (it.priority === '상') high++;
    else if (it.priority === '중') mid++;
    else low++;
    if (it.isImportant === 'Y') imp++;
    if (it.status === '완료') done++;
    if (statusCount[it.status] !== undefined) statusCount[it.status]++;
    const o = normOwner(it.owner);
    if (!ownerMap[o]) ownerMap[o] = { total: 0, high: 0, mid: 0, low: 0, status: {} };
    ownerMap[o].total++;
    ownerMap[o][getPK(it.priority)]++;
    if (it.status) ownerMap[o].status[it.status] = (ownerMap[o].status[it.status] || 0) + 1;
  });

  const pct = total > 0 ? Math.round(done / total * 100) : 0;

  /* 그룹·카테고리 목록 */
  const allGroups = [...new Set(all.map(it => it.group).filter(Boolean))];
  const allCats   = [...new Set(all.map(it => it.category).filter(Boolean))];
  const orderG    = S.settings.groupOrder.filter(g => allGroups.includes(g));
  const extraG    = allGroups.filter(g => !orderG.includes(g));
  const groups    = [...orderG, ...extraG];
  const orderC    = S.settings.catOrder.filter(c => allCats.includes(c));
  const extraC    = allCats.filter(c => !orderC.includes(c));
  const cats      = [...orderC, ...extraC];

  /* 최근 변경 — S.changeLog 기반 (삭제된 항목 포함) */
  const recentMax = S.settings.changeLogMax || 50;
  const recent = (S.changeLog || []).slice(0, recentMax);

  /* 담당별 정렬: 총개수 → 상 우선순위 → 완료 순 */
  const owners = Object.entries(ownerMap)
    .sort((a, b) => {
      if (b[1].total !== a[1].total) return b[1].total - a[1].total;
      if (b[1].high  !== a[1].high)  return b[1].high  - a[1].high;
      return (b[1].status['완료']||0) - (a[1].status['완료']||0);
    })
    .slice(0, 10);

  /* 섹션 순서 */
  const sections = (S.settings.dbSections || ['stats', 'insight', 'heatmap'])
    .filter(s => ['stats','insight','heatmap'].includes(s));

  /* ── 히어로 섹션 ── */
  const heroName = S.settings.dbHeroName || '프로젝트 현황';

  /* ── 섹션 HTML 빌더 ── */

  const buildStatsSection = () => `
    <div class="db-cards">
      <div class="db-card db-card--theme">
        <div class="db-card-label">전체 기능</div>
        <div class="db-card-value">${total.toLocaleString()}</div>
        <div class="db-card-sub">중요 <strong>${imp}</strong>개 포함</div>
      </div>
      ${STATUS_OPTS.map(st => `
      <div class="db-card db-card--mini">
        <div class="db-card-label">${esc(st)}</div>
        <div class="db-card-value db-card-value--mini" style="color:${STATUS_ACCENT[st]}">${statusCount[st]}</div>
        <div class="db-card-sub">${total > 0 ? Math.round(statusCount[st]/total*100) : 0}%</div>
      </div>`).join('')}
    </div>`;

  const buildInsightSection = () => `
    <div class="db-panel">
      <div class="db-panel-hd">
        <div class="db-panel-title">그룹별 진척도</div>
        <div class="db-panel-sub">대기 · 시작가능 · 진행중 · 검토중 · 완료 비율</div>
      </div>
      <div class="db-gp-list">${buildGroupProgress(all, groups)}</div>
    </div>
    <div class="db-panel">
      <div class="db-panel-hd">
        <div class="db-panel-title">담당별 기능 현황</div>
      </div>
      ${owners.length === 0
        ? `<div class="db-empty">담당자 정보가 없습니다</div>`
        : `<div class="db-owners-unified">
            <div class="db-owners-hdr">
              <div class="db-owner-info"></div>
              <div class="db-owners-bar-hdr" style="flex:1">진행상태</div>
              <div class="db-owners-bar-hdr" style="text-align:right;min-width:100px">우선순위</div>
            </div>
            ${owners.map(([owner, cnt]) => {
              const t = cnt.total;
              const stLeg = STATUS_OPTS
                .filter(s => cnt.status[s] > 0)
                .map(s => `<span class="db-gp-leg-item"><span class="db-gp-leg-dot" style="background:${STATUS_ACCENT[s]}"></span>${s} ${cnt.status[s]}</span>`)
                .join('');
              const prioText = [
                cnt.high > 0 ? `<span style="color:var(--p-high,var(--danger));font-weight:700">상 ${cnt.high}</span>` : '',
                cnt.mid  > 0 ? `<span style="color:var(--p-mid,var(--accent))">중 ${cnt.mid}</span>` : '',
                cnt.low  > 0 ? `<span style="color:var(--text-3)">하 ${cnt.low}</span>` : '',
              ].filter(Boolean).join('<span style="color:var(--border-2);margin:0 2px">|</span>');
              return `
              <div class="db-owner-row-unified">
                <div class="db-owner-info">
                  <span class="db-owner-dot" style="background:${getOwnerColor(owner)}"></span>
                  <span class="db-owner-name">${esc(owner)}</span>
                  <span class="db-owner-total">${t}</span>
                </div>
                <div class="db-owner-bar-wrap" style="flex:1">
                  <div class="db-bar-track">
                    ${STATUS_OPTS.map(s => `<div class="db-owner-seg" style="width:${t > 0 ? ((cnt.status[s]||0)/t*100).toFixed(1) : 0}%;background:${STATUS_ACCENT[s]}" title="${s} ${cnt.status[s]||0}"></div>`).join('')}
                  </div>
                  ${stLeg ? `<div class="db-gp-legend db-owner-legend">${stLeg}</div>` : ''}
                </div>
                <div style="min-width:100px;text-align:right;font-size:.7rem;display:flex;align-items:center;justify-content:flex-end;gap:3px;flex-shrink:0">${prioText || '<span style="color:var(--text-3)">-</span>'}</div>
              </div>`;
            }).join('')}
          </div>`
      }
    </div>`;

  const buildHeatmapSection = () => `
    <div class="db-panel db-heatmap-panel">
      <div class="db-panel-hd" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div class="db-panel-title">기능 분포 히트맵</div>
          <div class="db-panel-sub">${hmView === 'cat' ? '그룹 × 카테고리' : '그룹 × 상태'} 교차 밀도</div>
        </div>
        <div class="db-hm-tabs">
          <button class="db-hm-tab${hmView === 'cat' ? ' on' : ''}" onclick="setHmView('cat')">그룹×카테고리</button>
          <button class="db-hm-tab${hmView === 'status' ? ' on' : ''}" onclick="setHmView('status')">그룹×상태</button>
        </div>
      </div>
      ${buildHeatmap(all, groups, cats, hmView)}
    </div>`;

  const sectionBuilders = { stats: buildStatsSection, insight: buildInsightSection, heatmap: buildHeatmapSection };

  const bodySection = `
  <div class="db-body" data-anim-idx="1">
    <div class="db-body-left">
      ${sections.map(s => sectionBuilders[s] ? sectionBuilders[s]() : '').join('')}
    </div>

    <div class="db-body-right">
      <div class="db-panel db-timeline-panel">
        <div class="db-panel-hd">
          <div class="db-panel-title">최근 변경</div>
          <div class="db-panel-sub">추가·수정·삭제 기준</div>
        </div>
        ${recent.length === 0
          ? `<div class="db-empty">변경 기록이 없습니다</div>`
          : `<div class="db-timeline">
              ${recent.map((it, i) => {
                const actionColor = { '추가':'var(--success)', '수정':'var(--accent)', '삭제처리':'var(--warning)', '삭제복원':'var(--text-3)', '완전삭제':'var(--danger)', '상태변경':'var(--accent)' }[it.action] || 'var(--text-3)';
                const isDeleted = it.action === '완전삭제' || it.action === '삭제처리';
                return `
                <div class="db-tl-item">
                  <div class="db-tl-line-wrap">
                    <div class="db-tl-dot" style="background:${actionColor}"></div>
                    ${i < recent.length - 1 ? '<div class="db-tl-line"></div>' : ''}
                  </div>
                  <div class="db-tl-body">
                    <div class="db-tl-time">${fmtDate(it.ts)}</div>
                    <div class="db-tl-name${isDeleted ? ' db-tl-name--del' : ''}" ${isDeleted ? '' : `onclick="openEditModal('${esc(it.key)}')"`}>${esc(it.name || it.key)}</div>
                    <div class="db-tl-meta">
                      <span class="db-tl-action" style="color:${actionColor}">${esc(it.action)}</span>
                      ${it.owner ? `<span class="db-tl-owner" style="color:${getOwnerColor(it.owner)}">${esc(it.owner)}</span>` : ''}
                      ${it.user ? `<span class="db-tl-status">${esc(it.user)}</span>` : ''}
                    </div>
                  </div>
                </div>`;
              }).join('')}
            </div>
            <button class="db-more-btn" onclick="switchView('list')">전체 목록 보기 →</button>`
        }
      </div>
    </div>
  </div>`;

  const filterBanner = filterOn
    ? `<div style="margin-top:8px;font-size:.75rem;background:var(--accent-l);color:var(--accent);border-radius:6px;padding:4px 10px;display:inline-block">
        🔍 필터 적용됨 — <button onclick="resetFilters()" style="background:none;border:none;color:inherit;cursor:pointer;text-decoration:underline;font-size:inherit;padding:0">전체 보기</button>
       </div>`
    : '';

  return `
<div class="db-wrap">
  <div class="db-hero" data-anim-idx="0">
    <div>
      <div class="db-eyebrow">Mission Control</div>
      <h2 class="db-title">${esc(heroName)}</h2>
      ${filterBanner}
    </div>
  </div>
  ${bodySection}
</div>`;
}
