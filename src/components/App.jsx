/* ══════════════════════════════════════════
   App.jsx — React 진입점 컴포넌트 (Phase 2 브릿지)

   전략: dangerouslySetInnerHTML 브릿지
   - 기존 index.html body 구조를 그대로 이관
   - 기존 vanilla JS 모듈(main.js)은 useEffect 후 동적 import
   - Phase 4에서 섹션별로 실제 React 컴포넌트로 교체 예정
══════════════════════════════════════════ */

import { useEffect } from 'react';
import Header from './Header.jsx';
import BoardView from './BoardView.jsx';
import DashboardView from './DashboardView.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { AuthProvider } from '../contexts/AuthContext.jsx';
import { ThemeProvider } from '../contexts/ThemeContext.jsx';

/* ── 앱 HTML 템플릿 (헤더 제외 — Header.jsx로 분리됨) ── */
const APP_TEMPLATE = `
<div id="updateBanner" style="display:none;align-items:center;justify-content:center;gap:10px;padding:7px 16px;background:var(--warning-bg);border-bottom:1px solid var(--warning);font-size:.8rem;color:var(--warning)">
  <span id="updateBannerMsg">⚠ 다른 사용자가 데이터를 변경했습니다.</span>
  <button class="btn btn-s btn-sm" onclick="reloadFromServer()" style="border-color:var(--warning);color:var(--warning)">지금 새로고침</button>
  <button class="btn btn-g btn-sm" onclick="document.getElementById('updateBanner').classList.remove('on')">나중에</button>
</div>

<div class="layout" id="layout">
  <!-- 왼쪽 네비게이션 사이드바 -->
  <nav class="nav-side" id="navSide">
    <button class="nav-item" id="navD" onclick="switchView('dashboard')" title="대시보드">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      <span>대시보드</span>
    </button>
    <button class="nav-item on" id="navM" onclick="switchView('matrix')" title="매트릭스">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/></svg>
      <span>매트릭스</span>
    </button>
    <button class="nav-item" id="navB" onclick="switchView('board')" title="보드">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="3" width="4" height="18" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>
      <span>보드</span>
    </button>
    <button class="nav-item" id="navL" onclick="switchView('list')" title="리스트">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1.2" fill="currentColor"/><circle cx="4" cy="12" r="1.2" fill="currentColor"/><circle cx="4" cy="18" r="1.2" fill="currentColor"/></svg>
      <span>리스트</span>
    </button>
    <div class="nav-spacer"></div>
    <button class="nav-item nav-login" id="navLogin" onclick="openLoginModal()" title="로그인" style="display:none">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <span>로그인</span>
    </button>
  </nav>
  <main class="content" id="contentArea">
    <div id="dashboardView" style="display:none"></div>
    <div id="matrixView" class="mwrap fluid"></div>
    <div id="bulkBar" class="bulk-bar" style="display:none"></div>
    <div id="boardView"  class="bwrap" style="display:none"></div>
    <div id="listView"   class="lwrap" style="display:none"></div>
  </main>
  <!-- 오른쪽 필터 패널 (매트릭스·리스트에서만 표시) -->
  <aside class="fpanel" id="fpanel">
    <!-- 삼선 토글 버튼 (항상 표시) -->
    <button class="fpanel-toggle" id="fpanelToggle" onclick="togglePanel()" title="필터 패널 (F)">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <div class="fpinner">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-size:.64rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3)">필터</span>
        <button class="btn btn-g btn-sm" onclick="resetFilters()" style="height:20px;padding:0 6px;font-size:.65rem">초기화</button>
      </div>
      <div class="fsec"><div class="fsec-ttl">우선순위</div><div class="fsec-body"><div class="pchips" id="prioChips"></div></div></div>
      <div class="fsep"></div>
      <div class="fsec">
        <div class="fsec-ttl">진행상태</div>
        <div class="fsec-body"><div id="statusChips" style="display:flex;flex-wrap:wrap;gap:3px"></div></div>
      </div>
      <div class="fsep"></div>
      <div class="fsec">
        <div class="fsec-ttl">담당</div>
        <div class="fsec-body"><div class="owner-chips" id="ownerChips"></div></div>
      </div>
      <div class="fsep"></div>
      <div class="fsec">
        <div class="fsec-ttl">표시 조건</div>
        <div class="fsec-body" style="display:flex;flex-direction:column;gap:7px">
          <label class="tgl"><input type="checkbox" id="togDel" onchange="applyFilters()"><span class="tgl-track"></span><span class="tgl-lbl">삭제 포함</span></label>
          <label class="tgl"><input type="checkbox" id="togImp" onchange="applyFilters()"><span class="tgl-track"></span><span class="tgl-lbl">중요만 보기</span></label>
        </div>
      </div>
      <div class="fsep"></div>
      <div class="fsec">
        <div class="fsec-ttl">카드 표시</div>
        <div class="fsec-body" style="display:flex;flex-direction:column;gap:3px">
          <div style="font-size:.62rem;font-weight:700;letter-spacing:.04em;color:var(--text-3);text-transform:uppercase;margin:4px 0 2px">식별</div>
          <label class="tgl"><input type="checkbox" id="togOwner" checked onchange="onDispTgl()"><span class="tgl-track"></span><span class="tgl-lbl">담당</span></label>
          <label class="tgl"><input type="checkbox" id="togStar"  checked onchange="onDispTgl()"><span class="tgl-track"></span><span class="tgl-lbl">★ 중요</span></label>
          <label class="tgl"><input type="checkbox" id="togNew"   checked onchange="onDispTgl()"><span class="tgl-track"></span><span class="tgl-lbl">N 신규 배지</span></label>
          <div style="font-size:.62rem;font-weight:700;letter-spacing:.04em;color:var(--text-3);text-transform:uppercase;margin:6px 0 2px">상태</div>
          <label class="tgl"><input type="checkbox" id="togStatus" checked onchange="onDispTgl()"><span class="tgl-track"></span><span class="tgl-lbl">진행상태 뱃지</span></label>
          <label class="tgl"><input type="checkbox" id="togMd"     checked onchange="onDispTgl()"><span class="tgl-track"></span><span class="tgl-lbl">MD 뱃지</span></label>
          <div style="font-size:.62rem;font-weight:700;letter-spacing:.04em;color:var(--text-3);text-transform:uppercase;margin:6px 0 2px">보조</div>
          <label class="tgl"><input type="checkbox" id="togCnt"      checked onchange="onDispTgl()"><span class="tgl-track"></span><span class="tgl-lbl">셀 카운터</span></label>
          <label class="tgl"><input type="checkbox" id="togUpd"            onchange="onDispTgl()"><span class="tgl-track"></span><span class="tgl-lbl">수정일</span></label>
          <label class="tgl"><input type="checkbox" id="togQuickAdd"       onchange="onDispTgl()"><span class="tgl-track"></span><span class="tgl-lbl">빠른 추가 버튼</span></label>
        </div>
      </div>
      <div class="fsep"></div>
      <div class="undo-fab" id="undoFab">
        <button class="btn btn-s" onclick="doUndo()" title="실행 취소 (Z)" style="gap:6px;width:100%">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
          되돌리기
        </button>
      </div>
    </div>
  </aside>
</div>

<!-- 편집 모달 -->
<div class="ov" id="editModal">
  <div class="mbox" style="width:760px;max-height:92vh">
    <div class="mhd" style="padding-bottom:0;border-bottom:none">
      <span class="mtitle" id="editTitle">기능 추가</span>
      <button class="mclose" onclick="closeModal('editModal')">✕</button>
    </div>
    <div class="stab-row" style="padding:0 20px">
      <button class="stab on" id="etab-info" onclick="switchEditTab('info')">📋 기본 정보</button>
      <button class="stab"    id="etab-md"   onclick="switchEditTab('md')">📝 기능정의요구서</button>
    </div>
    <div class="mbody" id="epane-info" style="padding:16px 20px">
      <div class="mg">
        <div class="field"><label class="lbl">Key</label><input class="inp" id="fKey" readonly tabindex="-1" style="background:var(--surface-2);color:var(--text-3)"></div>
        <div class="field"><label class="lbl">우선순위</label><select class="sel" id="fPri"><option value="상">상</option><option value="중" selected>중</option><option value="하">하</option></select></div>
        <div class="field s2"><label class="lbl">기능명 <span style="color:var(--danger)">*</span></label><input class="inp" id="fName" placeholder="기능명"></div>
        <div class="field s2"><label class="lbl">설명</label><textarea class="txta" id="fDesc" style="min-height:105px;resize:vertical"></textarea></div>
        <div class="field s2"><label class="lbl">메모</label><textarea class="txta" id="fMemo" style="min-height:105px;resize:vertical"></textarea></div>
        <div class="field s2"><label class="lbl">경로</label><input class="inp" id="fPath" placeholder="/path/to/feature"></div>
        <div class="field"><label class="lbl">그룹 (X축)</label><input class="inp" id="fGroup" list="dlGroup"><datalist id="dlGroup"></datalist></div>
        <div class="field"><label class="lbl">서브그룹</label><input class="inp" id="fSubGroup" list="dlSubGroup"><datalist id="dlSubGroup"></datalist></div>
        <div class="field"><label class="lbl">카테고리 (Y축)</label><input class="inp" id="fCat" list="dlCat"><datalist id="dlCat"></datalist></div>
        <div class="field"><label class="lbl">서브카테고리</label><input class="inp" id="fSubCat" list="dlSubCat"><datalist id="dlSubCat"></datalist></div>
        <div class="field"><label class="lbl">담당</label><input class="inp" id="fOwner" list="dlOwner"><datalist id="dlOwner"></datalist></div>
        <div class="field"><label class="lbl">진행상태</label><select class="sel" id="fStatus"><option value="">—</option><option value="기획">기획</option><option value="개발중">개발중</option><option value="완료">완료</option><option value="보류">보류</option></select></div>
        <div class="field"><label class="lbl">연관 시스템</label><input class="inp" id="fRel"></div>
        <div style="display:flex;gap:18px;align-items:center;padding-top:2px">
          <label class="tgl"><input type="checkbox" id="fIsImp"><span class="tgl-track"></span><span class="tgl-lbl">★ 중요</span></label>
          <label class="tgl"><input type="checkbox" id="fIsDel"><span class="tgl-track"></span><span class="tgl-lbl">삭제 처리</span></label>
        </div>
      </div>
    </div>
    <!-- 마크다운 탭 -->
    <div class="mbody" id="epane-md" style="display:none;padding:10px 16px;flex-direction:column;gap:8px">
      <!-- MD 툴바: 2행 레이아웃 -->
      <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
        <!-- 1행: 서식 + 구조 + 수식 -->
        <div style="display:flex;align-items:center;gap:3px;flex-wrap:wrap">
          <div style="display:flex;gap:2px">
            <button class="btn btn-g btn-sm" onclick="mdInsert('**','**')" title="굵게 (Ctrl+B)" style="width:26px;padding:0"><b>B</b></button>
            <button class="btn btn-g btn-sm" onclick="mdInsert('*','*')"   title="기울임" style="width:26px;padding:0"><i>I</i></button>
            <button class="btn btn-g btn-sm" onclick="mdInsert('~~','~~')" title="취소선" style="width:26px;padding:0"><s style="font-size:.75rem">S</s></button>
            <button class="btn btn-g btn-sm" onclick="mdInsert('[','](url)')" title="링크" style="width:26px;padding:0">🔗</button>
            <button class="btn btn-g btn-sm" onclick="mdInsert('\`','\`')"  title="인라인 코드" style="width:26px;padding:0;font-family:monospace;font-size:.7rem">\`</button>
            <button class="btn btn-g btn-sm" onclick="mdInsert('\`\`\`\n','\n\`\`\`')" title="코드 블록" style="width:26px;padding:0">⬛</button>
          </div>
          <div style="width:1px;height:16px;background:var(--border);flex-shrink:0"></div>
          <div style="display:flex;gap:2px">
            <button class="btn btn-g btn-sm" onclick="mdInsertLine('# ')"   title="H1" style="width:26px;padding:0;font-size:.7rem;font-weight:700">H1</button>
            <button class="btn btn-g btn-sm" onclick="mdInsertLine('## ')"  title="H2" style="width:26px;padding:0;font-size:.7rem;font-weight:700">H2</button>
            <button class="btn btn-g btn-sm" onclick="mdInsertLine('### ')" title="H3" style="width:26px;padding:0;font-size:.7rem;font-weight:700">H3</button>
            <button class="btn btn-g btn-sm" onclick="mdInsertLine('- ')"   title="글머리 목록" style="width:26px;padding:0">•</button>
            <button class="btn btn-g btn-sm" onclick="mdInsertLine('1. ')"  title="순서 목록" style="width:26px;padding:0;font-size:.7rem">1.</button>
            <button class="btn btn-g btn-sm" onclick="mdInsertLine('> ')"   title="인용" style="width:26px;padding:0">❝</button>
            <button class="btn btn-g btn-sm" onclick="mdInsert('\n---\n','')" title="수평선" style="width:26px;padding:0;font-size:.8rem">—</button>
          </div>
          <div style="width:1px;height:16px;background:var(--border);flex-shrink:0"></div>
          <div style="display:flex;gap:2px">
            <button class="btn btn-g btn-sm" onclick="mdInsert('$','$')"        title="인라인 수식" style="width:26px;padding:0">∑</button>
            <button class="btn btn-g btn-sm" onclick="mdInsert('$$\n','\n$$')" title="블록 수식"   style="width:26px;padding:0">∫</button>
          </div>
        </div>
        <!-- 2행: 뷰 전환 + 파일 -->
        <div style="display:flex;align-items:center;gap:5px">
          <div style="display:flex;gap:2px;background:var(--surface-2);border-radius:6px;padding:2px">
            <button class="vtab on" id="mdTabPrev"  onclick="switchMdView('preview')" style="height:22px;padding:0 9px;font-size:.7rem">👁 보기</button>
            <button class="vtab"    id="mdTabEdit"  onclick="switchMdView('edit')"    style="height:22px;padding:0 9px;font-size:.7rem">✏ 편집</button>
            <button class="vtab"    id="mdTabSplit" onclick="switchMdView('split')"   style="height:22px;padding:0 9px;font-size:.7rem">⬜ 분할</button>
          </div>
          <div style="width:1px;height:16px;background:var(--border);flex-shrink:0"></div>
          <button class="btn btn-s btn-sm" onclick="document.getElementById('mdFileInp').click()" title="MD 파일 열기" style="gap:4px">📂 열기</button>
          <input type="file" id="mdFileInp" accept=".md,.txt" style="display:none" onchange="impSingleMd(event)">
          <button class="btn btn-s btn-sm" onclick="expSingleMd()" title="MD 파일 저장" style="gap:4px">⬇ 저장</button>
          <div style="margin-left:auto;font-size:.69rem;color:var(--text-3);display:flex;gap:10px">
            <span id="mdStatChars">0자</span><span id="mdStatLines">0줄</span><span id="mdStatWords">0단어</span>
          </div>
        </div>
      </div>
      <div id="mdWorkArea" style="display:flex;gap:8px;flex:1;min-height:0">
        <textarea id="fMdContent"
          style="flex:1;min-height:300px;font-family:'SFMono-Regular',Consolas,monospace;font-size:.78rem;line-height:1.7;resize:vertical;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);color:var(--text);outline:none"
          placeholder="# 기능 제목&#10;&#10;## 개요&#10;마크다운으로 작성&#10;&#10;| 컬럼1 | 컬럼2 |&#10;|-------|-------|&#10;| 값1   | 값2   |&#10;&#10;수식: $E=mc^2$"
          oninput="onMdInput()"></textarea>
        <div id="mdPreviewPane" style="display:none;flex:1;min-height:300px;overflow-y:auto;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--surface)" class="md-viewer"></div>
      </div>
    </div>
    <div class="mfoot">
      <button class="btn btn-d btn-sm" id="btnHardDel" onclick="hardDelete()" style="display:none;margin-right:auto">완전 삭제</button>
      <button class="btn btn-g btn-sm" onclick="closeModal('editModal')">취소</button>
      <button class="btn btn-p btn-sm" onclick="saveItem()">저장</button>
    </div>
  </div>
</div>

<!-- Import 모달 -->
<div class="ov" id="importModal">
  <div class="mbox" style="width:600px">
    <div class="mhd"><span class="mtitle">📥 데이터 가져오기</span><button class="mclose" onclick="closeModal('importModal')">✕</button></div>
    <div class="mbody">
      <div id="impStep1">
        <div class="drop-zone" id="dropZone" onclick="document.getElementById('csvFile').click()" ondragover="dzOver(event)" ondragleave="dzLeave(event)" ondrop="dzDrop(event)">
          <input type="file" id="csvFile" accept=".csv,.tsv,.txt" onchange="csvFileSel(event)">
          <div style="font-size:1.3rem;margin-bottom:5px">📂</div>
          <div>파일 드래그 또는 클릭</div>
          <div style="font-size:.7rem;margin-top:2px;color:var(--text-3)">.csv / .tsv · Tab 구분자</div>
        </div>
        <div style="margin-top:8px;font-size:.74rem;color:var(--text-3)">또는 붙여넣기:</div>
        <textarea class="txta" id="csvPaste" placeholder="헤더 포함 Tab-separated 데이터" style="margin-top:5px;min-height:80px;font-family:monospace;font-size:.7rem"></textarea>
        <div style="display:flex;gap:6px;margin-top:7px"><button class="btn btn-p btn-sm" onclick="analyzeCSV()">🔍 분석하기</button></div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
          <div class="exp-sec-ttl">MD 파일 일괄 가져오기</div>
          <div style="font-size:.74rem;color:var(--text-3);margin-bottom:8px"><code style="font-family:monospace;background:var(--surface-2);padding:1px 4px;border-radius:3px">{key}_{기능명}.md</code> 파일을 복수 선택하면 key로 자동 매핑</div>
          <button class="btn btn-s btn-sm" onclick="document.getElementById('mdImpInp').click()">📂 MD 파일 선택</button>
          <input type="file" id="mdImpInp" accept=".md" multiple style="display:none" onchange="impMdFiles(event)">
        </div>
      </div>
      <div id="impStep2" style="display:none">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:.82rem;font-weight:600;color:var(--text)">컬럼 매핑 확인</span>
          <button class="btn btn-g btn-sm" onclick="backToStep1()">← 뒤로</button>
        </div>
        <div id="mapStatus" style="font-size:.78rem;color:var(--text-2);margin-bottom:8px;padding:7px 10px;background:var(--accent-l);border-radius:7px;border-left:3px solid var(--accent)"></div>
        <div style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:7px;background:var(--surface)">
          <div style="display:flex;align-items:center;padding:5px 8px;background:var(--surface-2);border-bottom:2px solid var(--border)">
            <span style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--text-3);min-width:110px">소복 필드</span>
            <span style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--text-3);flex:1">CSV 컬럼</span>
            <span style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--text-3);min-width:100px">미리보기</span>
          </div>
          <div id="mapRows"></div>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn btn-p btn-sm" onclick="doImport(false)">⬇ 가져오기</button>
          <button class="btn btn-s btn-sm" onclick="doImport(true)">병합 추가</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Export 모달 -->
<div class="ov" id="exportModal">
  <div class="mbox" style="width:460px">
    <div class="mhd"><span class="mtitle">📤 데이터 내보내기</span><button class="mclose" onclick="closeModal('exportModal')">✕</button></div>
    <div class="mbody">
      <div style="margin-bottom:14px"><div class="exp-sec-ttl">CSV / TSV</div><div style="display:flex;gap:6px"><button class="btn btn-s btn-sm" onclick="expClip()">📋 클립보드</button><button class="btn btn-s btn-sm" onclick="expTSV()">⬇ TSV</button></div></div>
      <div style="margin-bottom:14px"><div class="exp-sec-ttl">Excel</div><div style="display:flex;gap:6px"><button class="btn btn-s btn-sm" onclick="expXLS()">📊 .xls 다운로드</button></div></div>
      <div>
        <div class="exp-sec-ttl">HTML 매트릭스</div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer"><input type="radio" name="htmlW" value="fluid" checked> 가변폭</label>
          <label style="display:flex;align-items:center;gap:5px;font-size:.8rem;cursor:pointer"><input type="radio" name="htmlW" value="fixed"> 고정폭</label>
        </div>
        <button class="btn btn-s btn-sm" onclick="expHTML()">🌐 HTML 내보내기</button>
      </div>
      <div style="margin-top:14px">
        <div class="exp-sec-ttl">마크다운 일괄</div>
        <div style="font-size:.74rem;color:var(--text-3);margin-bottom:6px">MD 내용이 작성된 항목만 포함됩니다.</div>
        <button class="btn btn-s btn-sm" onclick="expMdZip()">📦 MD ZIP 내보내기</button>
      </div>
    </div>
  </div>
</div>

<!-- 설정 모달 -->
<div class="ov" id="settingsModal"></div>

<!-- 단축키 모달 -->
<div class="ov" id="shortcutsModal">
  <div class="mbox" style="width:400px">
    <div class="mhd"><span class="mtitle">⌨ 단축키</span><button class="mclose" onclick="closeModal('shortcutsModal')">✕</button></div>
    <div class="mbody">
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">N</span></div><span style="font-size:.8125rem;color:var(--text-2)">기능 추가</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">F</span></div><span style="font-size:.8125rem;color:var(--text-2)">필터 패널 토글</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">/</span></div><span style="font-size:.8125rem;color:var(--text-2)">검색 포커스</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">D</span></div><span style="font-size:.8125rem;color:var(--text-2)">대시보드 뷰</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">M</span></div><span style="font-size:.8125rem;color:var(--text-2)">매트릭스 뷰</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">B</span></div><span style="font-size:.8125rem;color:var(--text-2)">보드 뷰</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">L</span></div><span style="font-size:.8125rem;color:var(--text-2)">리스트 뷰</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">Z</span></div><span style="font-size:.8125rem;color:var(--text-2)">실행 취소</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">우클릭</span></div><span style="font-size:.8125rem;color:var(--text-2)">카드 컨텍스트 메뉴</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">상태뱃지 클릭</span></div><span style="font-size:.8125rem;color:var(--text-2)">빠른 상태 변경</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">Ctrl</span><span class="kbd">I</span></div><span style="font-size:.8125rem;color:var(--text-2)">CSV/TSV 가져오기</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">Ctrl</span><span class="kbd">E</span></div><span style="font-size:.8125rem;color:var(--text-2)">데이터 내보내기</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">Ctrl</span><span class="kbd">,</span></div><span style="font-size:.8125rem;color:var(--text-2)">환경 설정</span></div>
      <div class="sc-row"><div style="display:flex;gap:3px"><span class="kbd">Esc</span></div><span style="font-size:.8125rem;color:var(--text-2)">창 닫기</span></div>
    </div>
    <div class="mfoot"><button class="btn btn-p btn-sm" onclick="closeModal('shortcutsModal')">닫기</button></div>
  </div>
</div>

<div class="ftt" id="ftt"></div>
<div class="notif" id="notif"></div>

<!-- 사용자 이름 입력 팝업 -->
<div class="ov" id="userNameModal">
  <div class="mbox" style="width:380px">
    <div class="mhd"><span class="mtitle">👤 이름을 알려주세요</span></div>
    <div class="mbody">
      <p style="font-size:.85rem;color:var(--text-2);margin-bottom:14px;line-height:1.7">다른 팀원에게 누가 수정했는지 표시됩니다.<br><span style="color:var(--text-3);font-size:.78rem">설정 &gt; 서버 탭에서 언제든 변경할 수 있어요.</span></p>
      <input class="inp" id="userNamePopupInp" placeholder="이름 입력 (예: 홍길동)" style="margin-bottom:6px"
        onkeydown="if(event.key==='Enter')saveUserNamePopup()">
    </div>
    <div class="mfoot">
      <button class="btn btn-g btn-sm" onclick="saveUserNamePopup(true)">나중에</button>
      <button class="btn btn-p btn-sm" onclick="saveUserNamePopup()">확인</button>
    </div>
  </div>
</div>

<!-- 로그인 모달 -->
<div class="ov" id="loginModal">
  <div class="mbox" style="width:360px">
    <div class="mhd"><span class="mtitle">🔑 로그인</span><button class="mclose" onclick="closeLoginModal()">✕</button></div>
    <div class="mbody">
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <label style="font-size:.78rem;font-weight:600;color:var(--text-2);display:block;margin-bottom:4px">역할</label>
          <select class="inp" id="loginRoleSelect" style="height:38px;font-size:.82rem;padding-top:0;padding-bottom:0">
            <option value="editor">편집자</option>
            <option value="admin">관리자</option>
          </select>
        </div>
        <div>
          <label style="font-size:.78rem;font-weight:600;color:var(--text-2);display:block;margin-bottom:4px">이름</label>
          <input class="inp" id="loginNameInp" placeholder="홍길동" style="height:32px;font-size:.82rem"
            onkeydown="if(event.key==='Enter')document.getElementById('loginPwInp').focus()">
        </div>
        <div>
          <label style="font-size:.78rem;font-weight:600;color:var(--text-2);display:block;margin-bottom:4px">비밀번호</label>
          <input class="inp" id="loginPwInp" type="password" placeholder="비밀번호 (미설정 시 비워두세요)"
            style="height:32px;font-size:.82rem"
            onkeydown="if(event.key==='Enter')submitLogin()">
        </div>
        <div id="loginErr" style="color:var(--danger);font-size:.78rem;min-height:16px"></div>
      </div>
    </div>
    <div class="mfoot">
      <button class="btn btn-g btn-sm" onclick="closeLoginModal()">취소</button>
      <button class="btn btn-p btn-sm" onclick="submitLogin()">로그인</button>
    </div>
  </div>
</div>

<!-- 관리자 인증 모달 (하위 호환 — loginModal로 대체됨, DOM 유지) -->
<div class="ov" id="adminAuthModal" style="display:none!important"></div>

<!-- Diff 뷰 모달 -->
<div class="ov" id="diffModal">
  <div class="mbox" style="width:640px">
    <div class="mhd"><span class="mtitle">변경 이력 (마지막 Undo 기준)</span><button class="mclose" onclick="closeModal('diffModal')">✕</button></div>
    <div class="mbody" id="diffBody" style="font-size:.82rem"></div>
    <div class="mfoot">
      <button class="btn btn-s" onclick="closeModal('diffModal')">닫기</button>
    </div>
  </div>
</div>
<div id="boardActionBar" class="board-action-bar"></div>
`;

/* ── React App 컴포넌트 ── */
export default function App() {
  useEffect(() => {
    // React DOM 렌더링 완료 후 기존 vanilla JS 초기화 실행
    // dangerouslySetInnerHTML로 삽입된 DOM 요소들이 준비된 상태
    import('../app/main.js').catch(err => {
      console.error('[App] main.js 초기화 실패:', err);
    });
  }, []); // 마운트 시 1회만 실행

  return (
    <ThemeProvider>
      <AuthProvider>
        <Header />
        <div dangerouslySetInnerHTML={{ __html: APP_TEMPLATE }} />
        <BoardView />
        <DashboardView />
        <SettingsPanel />
      </AuthProvider>
    </ThemeProvider>
  );
}
