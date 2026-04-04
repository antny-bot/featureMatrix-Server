/* ══════════════════════════════════════════
   dashboard.js — 대시보드 뷰 렌더링
══════════════════════════════════════════ */

import { S, esc, normOwner, getOwnerColor, getPK } from './state.js';
import { animOk } from './render.js';

/* ── 시간 포매팅 ── */
function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

/* ── 상태 색상 ── */
function statusColor(status) {
  const map = { '기획': 'var(--text-3)', '개발중': 'var(--accent)', '완료': 'var(--success)', '보류': 'var(--warning)' };
  return map[status] || 'var(--text-3)';
}

/* ── 히트맵 뷰 상태 (그룹×카테고리 | 그룹×상태) ── */
let _hmView = 'cat';  // 'cat' | 'status'
export function setHmView(v) { _hmView = v; renderDashboard(); }

/* ── 히트맵 HTML 생성 ── */
function buildHeatmap(all, groups, cats) {
  const STATUSES = ['기획', '개발중', '완료', '보류'];

  if (_hmView === 'cat') {
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
        ${cats.map(cat => `
          <div class="db-hm-row-hd" title="${esc(cat)}">${esc(cat)}</div>
          ${groups.map(g => {
            const cnt = hmData[`${g}||${cat}`] || 0;
            const op  = hmMax > 0 ? (cnt === 0 ? 0.06 : 0.15 + cnt/hmMax * 0.85) : 0.06;
            return `<div class="db-hm-cell" style="--op:${op.toFixed(2)}" title="${esc(g)} × ${esc(cat)}: ${cnt}개">${cnt > 0 ? cnt : ''}</div>`;
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
  } else {
    /* 그룹 × 상태 뷰 */
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
          <div class="db-hm-row-hd" title="${esc(st)}" style="color:${statusColor(st)};font-weight:700">${esc(st)}</div>
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

/* ── renderDashboard ── */
export function renderDashboard() {
  const el = document.getElementById('dashboardView');
  if (!el) return;

  const all = S.items.filter(it => it.isDelete !== 'Y');
  const total = all.length;

  /* 통계 계산 */
  let high = 0, mid = 0, low = 0, imp = 0, done = 0;
  const statusCount = { '기획': 0, '개발중': 0, '완료': 0, '보류': 0 };
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

  /* 히트맵 데이터 */
  /* groupOrder/catOrder 기준이되, 실제 데이터에 있는 항목은 항상 포함 */
  const allGroups = [...new Set(all.map(it => it.group).filter(Boolean))];
  const allCats   = [...new Set(all.map(it => it.category).filter(Boolean))];
  const orderG    = S.settings.groupOrder.filter(g => allGroups.includes(g));
  const extraG    = allGroups.filter(g => !orderG.includes(g));
  const groups    = [...orderG, ...extraG];
  const orderC    = S.settings.catOrder.filter(c => allCats.includes(c));
  const extraC    = allCats.filter(c => !orderC.includes(c));
  const cats      = [...orderC, ...extraC];

  const hmData = {};
  let hmMax = 0;
  all.forEach(it => {
    if (!it.group || !it.category) return;
    const k = `${it.group}||${it.category}`;
    hmData[k] = (hmData[k] || 0) + 1;
    if (hmData[k] > hmMax) hmMax = hmData[k];
  });

  /* 최근 변경 (updatedAt 기준 top 8) */
  const recent = [...all]
    .filter(it => it.updatedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);

  /* 담당별 정렬 */
  const owners = Object.entries(ownerMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);

  /* ── HTML 구성 ── */
  el.innerHTML = `
<div class="db-wrap">

  <!-- 헤더 -->
  <div class="db-hero" data-anim-idx="0">
    <div>
      <div class="db-eyebrow">Mission Control</div>
      <h2 class="db-title">프로젝트 현황</h2>
    </div>
  </div>

  <!-- 요약 통계 카드 -->
  <section class="db-cards" data-anim-idx="1">
    <!-- 전체 기능 -->
    <div class="db-card db-card--primary">
      <div class="db-card-label">전체 기능</div>
      <div class="db-card-value">${total.toLocaleString()}</div>
      <div class="db-card-sub">중요 <strong>${imp}</strong>개 포함</div>
    </div>

    <!-- 우선순위 분포 -->
    <div class="db-card">
      <div class="db-card-label">우선순위 분포</div>
      <div class="db-prio-bars">
        <div class="db-prio-row">
          <span class="db-prio-lbl sv-h">상</span>
          <div class="db-bar-track"><div class="db-bar-fill db-bar--high" style="width:${total > 0 ? Math.round(high/total*100) : 0}%"></div></div>
          <span class="db-prio-cnt">${high}</span>
        </div>
        <div class="db-prio-row">
          <span class="db-prio-lbl sv-m">중</span>
          <div class="db-bar-track"><div class="db-bar-fill db-bar--mid" style="width:${total > 0 ? Math.round(mid/total*100) : 0}%"></div></div>
          <span class="db-prio-cnt">${mid}</span>
        </div>
        <div class="db-prio-row">
          <span class="db-prio-lbl sv-l">하</span>
          <div class="db-bar-track"><div class="db-bar-fill db-bar--low" style="width:${total > 0 ? Math.round(low/total*100) : 0}%"></div></div>
          <span class="db-prio-cnt">${low}</span>
        </div>
      </div>
    </div>

    <!-- 완료율 -->
    <div class="db-card">
      <div class="db-card-label">완료율</div>
      <div class="db-pct-wrap">
        <div class="db-pct-num">${pct}<span class="db-pct-sign">%</span></div>
        <div class="db-pct-sub">${done} / ${total} 완료</div>
      </div>
      <div class="db-bar-track" style="margin-top:12px">
        <div class="db-bar-fill db-bar--done" style="width:${pct}%"></div>
      </div>
    </div>

    <!-- 상태별 분포 -->
    <div class="db-card">
      <div class="db-card-label">진행 상태</div>
      <div class="db-status-grid">
        ${['기획','개발중','완료','보류'].map(s => `
          <div class="db-status-item">
            <div class="db-status-dot" style="background:${statusColor(s)}"></div>
            <span class="db-status-name">${s}</span>
            <span class="db-status-cnt">${statusCount[s]}</span>
          </div>
        `).join('')}
      </div>
    </div>
  </section>

  <!-- 히트맵 + 타임라인 -->
  <section class="db-mid" data-anim-idx="2">

    <!-- 기능 분포 히트맵 -->
    <div class="db-panel db-heatmap-panel">
      <div class="db-panel-hd">
        <div>
          <div class="db-panel-title">기능 분포 히트맵</div>
          <div class="db-panel-sub">${_hmView === 'cat' ? '그룹 × 카테고리' : '그룹 × 상태'} 교차 밀도</div>
        </div>
        <div class="db-hm-tabs">
          <button class="db-hm-tab${_hmView === 'cat' ? ' on' : ''}" onclick="setHmView('cat')">그룹×카테고리</button>
          <button class="db-hm-tab${_hmView === 'status' ? ' on' : ''}" onclick="setHmView('status')">그룹×상태</button>
        </div>
      </div>
      ${buildHeatmap(all, groups, cats)}
    </div>

    <!-- 최근 변경 타임라인 -->
    <div class="db-panel db-timeline-panel">
      <div class="db-panel-hd">
        <div class="db-panel-title">최근 변경</div>
        <div class="db-panel-sub">수정일 기준</div>
      </div>
      ${recent.length === 0
        ? `<div class="db-empty">변경 기록이 없습니다</div>`
        : `<div class="db-timeline">
            ${recent.map((it, i) => `
              <div class="db-tl-item">
                <div class="db-tl-line-wrap">
                  <div class="db-tl-dot" style="background:${statusColor(it.status)}"></div>
                  ${i < recent.length - 1 ? '<div class="db-tl-line"></div>' : ''}
                </div>
                <div class="db-tl-body">
                  <div class="db-tl-time">${timeAgo(it.updatedAt)}</div>
                  <div class="db-tl-name" onclick="openEditModal('${esc(it.key)}')">${esc(it.name || it.key)}</div>
                  <div class="db-tl-meta">
                    ${it.owner ? `<span class="db-tl-owner" style="color:${getOwnerColor(it.owner)}">${esc(it.owner)}</span>` : ''}
                    ${it.status ? `<span class="db-tl-status">${esc(it.status)}</span>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <button class="db-more-btn" onclick="switchView('list')">전체 목록 보기 →</button>`
      }
    </div>
  </section>

  <!-- 담당별 분포 -->
  <section class="db-panel db-owners-panel" data-anim-idx="3">
    <div class="db-panel-hd">
      <div class="db-panel-title">담당별 기능 현황</div>
    </div>
    ${owners.length === 0
      ? `<div class="db-empty">담당자 정보가 없습니다</div>`
      : `<div class="db-owners-grid">
          <!-- 좌: 담당자 × 우선순위 -->
          <div>
            <div class="db-owners-col-title">우선순위</div>
            <div class="db-owners-list">
              ${owners.map(([owner, cnt]) => `
                <div class="db-owner-row">
                  <div class="db-owner-info">
                    <span class="db-owner-dot" style="background:${getOwnerColor(owner)}"></span>
                    <span class="db-owner-name">${esc(owner)}</span>
                    <span class="db-owner-total">${cnt.total}</span>
                  </div>
                  <div class="db-owner-bar-wrap">
                    <div class="db-bar-track">
                      <div class="db-owner-seg db-bar--high" style="width:${cnt.total > 0 ? (cnt.high/cnt.total*100).toFixed(1) : 0}%" title="상 ${cnt.high}"></div>
                      <div class="db-owner-seg db-bar--mid"  style="width:${cnt.total > 0 ? (cnt.mid/cnt.total*100).toFixed(1) : 0}%"  title="중 ${cnt.mid}"></div>
                      <div class="db-owner-seg db-bar--low"  style="width:${cnt.total > 0 ? (cnt.low/cnt.total*100).toFixed(1) : 0}%"  title="하 ${cnt.low}"></div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <!-- 우: 담당자 × 진행상태 (이름은 좌측과 중복이므로 생략) -->
          <div>
            <div class="db-owners-col-title">진행상태</div>
            <div class="db-owners-list">
              ${owners.map(([owner, cnt]) => `
                <div class="db-owner-row">
                  <div class="db-owner-bar-wrap" style="flex:1">
                    <div class="db-bar-track">
                      <div class="db-owner-seg" style="width:${cnt.total > 0 ? ((cnt.status['기획']||0)/cnt.total*100).toFixed(1) : 0}%;background:var(--text-3)" title="기획 ${cnt.status['기획']||0}"></div>
                      <div class="db-owner-seg" style="width:${cnt.total > 0 ? ((cnt.status['개발중']||0)/cnt.total*100).toFixed(1) : 0}%;background:var(--accent)" title="개발중 ${cnt.status['개발중']||0}"></div>
                      <div class="db-owner-seg" style="width:${cnt.total > 0 ? ((cnt.status['완료']||0)/cnt.total*100).toFixed(1) : 0}%;background:var(--success)" title="완료 ${cnt.status['완료']||0}"></div>
                      <div class="db-owner-seg" style="width:${cnt.total > 0 ? ((cnt.status['보류']||0)/cnt.total*100).toFixed(1) : 0}%;background:var(--warning)" title="보류 ${cnt.status['보류']||0}"></div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>`
    }
  </section>

</div>
`;

  /* 섹션별 순차 fade-in */
  if (animOk()) {
    el.querySelectorAll('[data-anim-idx]').forEach(sec => {
      const idx = parseInt(sec.dataset.animIdx, 10);
      sec.style.opacity = '0';
      sec.style.transform = 'translateY(12px)';
      sec.style.transition = 'none';
      requestAnimationFrame(() => {
        setTimeout(() => {
          sec.style.transition = 'opacity .32s ease, transform .32s ease';
          sec.style.opacity = '1';
          sec.style.transform = 'translateY(0)';
        }, idx * 80);
      });
    });
  }
}
