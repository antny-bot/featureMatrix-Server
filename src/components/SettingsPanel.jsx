/* ══════════════════════════════════════════
   SettingsPanel.jsx — 환경 설정 모달 React 컴포넌트

   portal root: #settingsModal (App.jsx의 빈 컨테이너)
   탭 상태: React useState (activeTab)
   설정값: Zustand store에서 직접 읽음 → syncSettingsUI() 불필요
   복잡한 서브에디터(colEditor, themeGrid 등): React 하위 컴포넌트가 직접 렌더링
══════════════════════════════════════════ */

import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { S, save } from '../app/state.js';
import { setStore } from '../store/useAppStore.js';
import { applyVars } from '../app/theme.js';
import ActivityLogPanel from './ActivityLogPanel.jsx';
import DashboardSectionOrder from './DashboardSectionOrder.jsx';
import SettingsColumnsPanel from './SettingsColumnsPanel.jsx';
import SettingsDesignPanel from './SettingsDesignPanel.jsx';

/* ── S.settings 변경 + Zustand 동기화 헬퍼 ── */
function syncSettings() { setStore({ settings: { ...S.settings } }); }
function syncDisplay()  { setStore({ display:  { ...S.display  } }); }
function syncFilters()  { setStore({ filters:  { ...S.filters  } }); }

export default function SettingsPanel() {
  const settings = useAppStore(s => s.settings);
  const display  = useAppStore(s => s.display);
  const filters  = useAppStore(s => s.filters);
  const { isAdmin } = useAuth();
  const appVersion = (typeof __APP_VERSION__ !== 'undefined') ? __APP_VERSION__ : 'dev';
  const buildId = (typeof __BUILD_ID__ !== 'undefined') ? __BUILD_ID__ : 'local';

  const [container, setContainer] = useState(null);
  const [activeTab, setActiveTab] = useState('sg');

  useEffect(() => {
    setContainer(document.getElementById('settingsModal'));
  }, []);

  /* 탭 전환 시 서브에디터 초기화 */
  useEffect(() => {
    if (activeTab === 'sserv') window.syncServerSettingsUI?.();
    if (activeTab === 'slog')  window.loadInlineActivityLog?.();
    if (activeTab === 'sadmin') {
      window.syncEditorPwStatus?.();
    }
  }, [activeTab]);

  /* 설정 모달이 열릴 때마다 activeTab을 'sg'로 초기화하는 브릿지 */
  useEffect(() => {
    window.__settingsPanelOpen = () => setActiveTab('sg');
    return () => { delete window.__settingsPanelOpen; };
  }, []);

  if (!container) return null;

  /* ── 탭 클릭 핸들러 ── */
  const switchTab = (tab) => setActiveTab(tab);

  return createPortal(
    <div className="mbox" style={{ width: '760px' }}>
      <div className="mhd">
        <span className="mtitle">⚙ 환경 설정</span>
        <button className="mclose" onClick={() => window.closeModal?.('settingsModal')}>✕</button>
      </div>

      {/* ── 탭 목록 ── */}
      <div className="stab-row">
        <button className={`stab${activeTab === 'sg'      ? ' on' : ''}`} onClick={() => switchTab('sg')}>일반</button>
        <button className={`stab${activeTab === 'sdesign' ? ' on' : ''}`} onClick={() => switchTab('sdesign')}>디자인</button>
        <button className={`stab${activeTab === 'scola'   ? ' on' : ''}`} onClick={() => switchTab('scola')}>컬럼·축</button>
        <button className={`stab${activeTab === 'sdat'    ? ' on' : ''}`} onClick={() => switchTab('sdat')}>데이터</button>
        <button className={`stab${activeTab === 'sserv'   ? ' on' : ''}`} onClick={() => switchTab('sserv')}>서버</button>
        <button className={`stab${activeTab === 'slog'    ? ' on' : ''}`} id="slogTab" onClick={() => switchTab('slog')}>로그</button>
        {isAdmin && (
          <button className={`stab${activeTab === 'sadmin' ? ' on' : ''}`} id="sadminTab" onClick={() => switchTab('sadmin')}>🔑 관리자</button>
        )}
      </div>

      <div className="mbody" style={{ padding: '14px 20px' }}>

        {/* ── 일반 탭 ── */}
        {activeTab === 'sg' && (
          <div>
            <div className="sec-ttl">폰트 &amp; 카드</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Stepper label="기준 폰트"       value={`${settings.baseFont}px`}   onMinus={() => { S.settings.baseFont    = Math.max(12,Math.min(22,settings.baseFont-1));    save(); applyVars(); syncSettings(); }} onPlus={() => { S.settings.baseFont    = Math.max(12,Math.min(22,settings.baseFont+1));    save(); applyVars(); syncSettings(); }} />
              <Stepper label="카드 폰트"       value={`${settings.cardFont}px`}   onMinus={() => { S.settings.cardFont    = Math.max(9, Math.min(18,settings.cardFont-1));    save(); applyVars(); syncSettings(); window.renderAll?.(); }} onPlus={() => { S.settings.cardFont    = Math.max(9, Math.min(18,settings.cardFont+1));    save(); applyVars(); syncSettings(); window.renderAll?.(); }} />
              <Stepper label="모서리 반경"     value={`${settings.cardRadius}px`} onMinus={() => { S.settings.cardRadius  = Math.max(0, Math.min(14,settings.cardRadius-1));  save(); applyVars(); syncSettings(); window.renderAll?.(); }} onPlus={() => { S.settings.cardRadius  = Math.max(0, Math.min(14,settings.cardRadius+1));  save(); applyVars(); syncSettings(); window.renderAll?.(); }} />
              <Stepper label="카드 간격"       value={`${settings.cardGap}px`}    onMinus={() => { S.settings.cardGap     = Math.max(0, Math.min(20,settings.cardGap-1));     save(); applyVars(); syncSettings(); window.renderAll?.(); }} onPlus={() => { S.settings.cardGap     = Math.max(0, Math.min(20,settings.cardGap+1));     save(); applyVars(); syncSettings(); window.renderAll?.(); }} />
            </div>
            <div className="sec-ttl" style={{ marginTop: '12px' }}>매트릭스 열 너비</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Stepper label="그룹 열 폭"          value={`${settings.colW}px`}                                     onMinus={() => { S.settings.colW   = Math.max(80, Math.min(300,settings.colW-10));    save(); applyVars(); syncSettings(); window.renderAll?.(); }} onPlus={() => { S.settings.colW   = Math.max(80, Math.min(300,settings.colW+10));    save(); applyVars(); syncSettings(); window.renderAll?.(); }} step={10} />
              <Stepper label="셀 접기 기준"        value={settings.cellFold === 0 ? '∞' : settings.cellFold}       sub="0=항상 펼침" onMinus={() => { S.settings.cellFold = Math.max(0,Math.min(20,settings.cellFold-1)); save(); syncSettings(); window.renderAll?.(); }} onPlus={() => { S.settings.cellFold = Math.max(0,Math.min(20,settings.cellFold+1)); save(); syncSettings(); window.renderAll?.(); }} />
              <Stepper label="보드 셀 접기 기준"   value={settings.boardFoldCount === 0 ? '∞' : settings.boardFoldCount} sub="0=항상 펼침" onMinus={() => { S.settings.boardFoldCount = Math.max(0,Math.min(30,(settings.boardFoldCount??6)-1)); save(); syncSettings(); }} onPlus={() => { S.settings.boardFoldCount = Math.max(0,Math.min(30,(settings.boardFoldCount??6)+1)); save(); syncSettings(); }} />
              <Stepper label="카테고리 폭"         value={`${settings.catW}px`}                                     onMinus={() => { S.settings.catW   = Math.max(40, Math.min(80, settings.catW-4));    save(); applyVars(); syncSettings(); window.renderAll?.(); }} onPlus={() => { S.settings.catW   = Math.max(40, Math.min(80, settings.catW+4));    save(); applyVars(); syncSettings(); window.renderAll?.(); }} step={4} />
              <Stepper label="서브카테고리 폭"     value={`${settings.subCatW}px`}                                  onMinus={() => { S.settings.subCatW= Math.max(40, Math.min(200,settings.subCatW-4));  save(); applyVars(); syncSettings(); window.renderAll?.(); }} onPlus={() => { S.settings.subCatW= Math.max(40, Math.min(200,settings.subCatW+4));  save(); applyVars(); syncSettings(); window.renderAll?.(); }} step={4} />
            </div>
            {/* 숨김 DOM — vanilla JS 호환용 */}
            <span id="mwF" style={{ display: 'none' }}></span>
            <span id="mwX" style={{ display: 'none' }}></span>
            <span id="ppL" style={{ display: 'none' }}></span>
            <span id="ppR" style={{ display: 'none' }}></span>
            <div className="sec-ttl" style={{ marginTop: '12px' }}>빌드 정보</div>
            <div className="srow">
              <div><div className="slbl">빌드 넘버</div></div>
              <span id="buildNumberDisplay" style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text-2)', fontFamily: 'monospace' }}>{`v${appVersion} (build ${buildId})`}</span>
            </div>
          </div>
        )}

        {/* ── 디자인 탭 ── */}
        {activeTab === 'sdesign' && (
          <SettingsDesignPanel />
        )}

        {/* ── 컬럼·축 탭 ── */}
        {activeTab === 'scola' && (
          <SettingsColumnsPanel />
        )}

        {/* ── 데이터 탭 ── */}
        {activeTab === 'sdat' && (
          <div>
            <div className="sec-ttl">내보내기</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
              <button className="btn btn-s btn-sm" onClick={() => window.expClip?.()}>📋 클립보드</button>
              <button className="btn btn-s btn-sm" onClick={() => window.expTSV?.()}>⬇ TSV</button>
              <button className="btn btn-s btn-sm" onClick={() => window.expXLS?.()}>📊 Excel</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><input type="radio" name="htmlW" value="fluid" defaultChecked /> 가변폭</label>
                <label style={{ fontSize: '.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><input type="radio" name="htmlW" value="fixed" /> 고정폭</label>
              </div>
              <button className="btn btn-s btn-sm" onClick={() => window.expHTML?.()}>🌐 HTML</button>
              <button className="btn btn-s btn-sm" onClick={() => window.expMdZip?.()}>📦 MD ZIP</button>
            </div>
            <div className="sec-ttl" style={{ marginTop: '12px' }}>설정 파일</div>
            <div className="srow">
              <div><div className="slbl">설정 초기화</div><div className="ssub">개인 설정만 기본값으로</div></div>
              <button className="btn btn-s btn-sm" onClick={() => window.resetSettings?.()}>설정만 초기화</button>
            </div>
            <div className="srow">
              <div><div className="slbl">설정 JSON 저장</div></div>
              <button className="btn btn-s btn-sm" onClick={() => window.expSettJSON?.()}>⬇ 저장</button>
            </div>
            <div className="srow">
              <div><div className="slbl">설정 JSON 불러오기</div></div>
              <div>
                <button className="btn btn-s btn-sm" onClick={() => document.getElementById('settFile')?.click()}>↑ 불러오기</button>
                <input type="file" id="settFile" accept=".json" style={{ display: 'none' }} onChange={e => window.impSettJSON?.(e)} />
              </div>
            </div>
          </div>
        )}

        {/* ── 서버 탭 ── */}
        {activeTab === 'sserv' && (
          <ServerSettingsPanel settings={settings} />
        )}

        {/* ── 로그 탭 ── */}
        {activeTab === 'slog' && (
          <ActivityLogPanel
            changeLogMax={settings.changeLogMax}
            onChangeLogMax={delta => {
              S.settings.changeLogMax = Math.max(10, Math.min(500, (settings.changeLogMax ?? 50) + delta));
              save();
              syncSettings();
            }}
          />
        )}

        {/* ── 관리자 탭 ── */}
        {activeTab === 'sadmin' && isAdmin && (
          <div>
            <div className="sec-ttl">공유 콘텐츠 설정</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div className="srow" style={{ borderBottom: 'none', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '8px', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                <div className="slbl">헤더 타이틀</div>
                <input className="inp" id="sTitle" style={{ height: '28px', fontSize: '.8rem' }} onInput={() => window.previewTitle?.()} />
              </div>
              <div className="srow" style={{ borderBottom: 'none', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '8px', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                <div className="slbl">서브 타이틀</div>
                <input className="inp" id="sSub" style={{ height: '28px', fontSize: '.8rem' }} onInput={() => window.previewTitle?.()} />
              </div>
            </div>
            <div className="srow" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
              <div><div className="slbl">대시보드 히어로 제목</div><div className="ssub">대시보드 상단에 표시할 프로젝트명</div></div>
              <input className="inp" id="dbHeroName" placeholder="프로젝트 현황" style={{ height: '28px', fontSize: '.82rem' }} onInput={() => window.saveDbSettings?.()} />
            </div>
            <div className="srow" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
              <div><div className="slbl">대시보드 섹션 순서</div><div className="ssub">드래그하거나 ▲▼ 버튼으로 순서를 변경하세요</div></div>
              <DashboardSectionOrder />
            </div>
            <div className="sec-ttl" style={{ marginTop: '16px' }}>데이터 관리</div>
            <div className="srow">
              <div><div className="slbl">가져오기</div><div className="ssub">기존 데이터가 덮어씌워집니다. 관리자 전용.</div></div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button className="btn btn-s btn-sm" onClick={() => window.requireAdmin?.(() => window.openModal?.('importModal'))}>📥 CSV/TSV</button>
                <button className="btn btn-s btn-sm" onClick={() => window.requireAdmin?.(() => document.getElementById('mdImpInpAdmin')?.click())}>📂 MD ZIP</button>
                <input type="file" id="mdImpInpAdmin" accept=".md" multiple style={{ display: 'none' }} onChange={e => window.impMdFiles?.(e)} />
              </div>
            </div>
            <div className="srow">
              <div><div className="slbl" style={{ color: 'var(--danger)' }}>데이터 초기화</div><div className="ssub">샘플 데이터로 전체 복원</div></div>
              <button className="btn btn-d btn-sm" onClick={() => window.resetData?.()}>초기화</button>
            </div>
            <div className="sec-ttl" style={{ marginTop: '16px' }}>접근 제어</div>
            <EditorPasswordControl />
          </div>
        )}

      </div>
      <div className="mfoot">
        <button className="btn btn-p btn-sm" onClick={() => window.closeModal?.('settingsModal')}>닫기</button>
      </div>
    </div>,
    container
  );
}

/* ── Stepper 서브컴포넌트 ── */
function Stepper({ label, sub, value, onMinus, onPlus }) {
  return (
    <div className="srow">
      <div>
        <div className="slbl">{label}</div>
        {sub && <div className="ssub">{sub}</div>}
      </div>
      <div className="stepper">
        <button className="stepbtn" onClick={onMinus}>−</button>
        <span>{value}</span>
        <button className="stepbtn" onClick={onPlus}>+</button>
      </div>
    </div>
  );
}

function ServerSettingsPanel({ settings }) {
  const [form, setForm] = useState({
    storageMode: settings.storageMode || 'server',
    serverUrl: settings.serverUrl || '',
    userName: settings.userName || '',
  });

  useEffect(() => {
    setForm({
      storageMode: settings.storageMode || 'server',
      serverUrl: settings.serverUrl || '',
      userName: settings.userName || '',
    });
  }, [settings.storageMode, settings.serverUrl, settings.userName]);

  const saveServerSettings = (nextForm = form) => {
    window.saveServerSettings?.(nextForm);
  };

  const setMode = storageMode => {
    const next = { ...form, storageMode };
    setForm(next);
    saveServerSettings(next);
  };

  return (
    <div>
      <div className="sec-ttl">스토리지 모드</div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.82rem', cursor: 'pointer' }}>
          <input
            type="radio"
            name="storageMode"
            id="modeServer"
            value="server"
            checked={form.storageMode === 'server'}
            onChange={() => setMode('server')}
          />
          🌐 서버 (공유, 기본)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.82rem', cursor: 'pointer' }}>
          <input
            type="radio"
            name="storageMode"
            id="modeLocal"
            value="local"
            checked={form.storageMode === 'local'}
            onChange={() => setMode('local')}
          />
          💾 로컬 (개인)
        </label>
      </div>
      <div className="sec-ttl">연결 설정</div>
      <div className="srow" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
        <div className="slbl">사용자 이름</div>
        <div className="ssub">변경 이력 및 활동 로그에 표시되는 이름</div>
        <input
          className="inp"
          id="sUserName"
          value={form.userName}
          onChange={event => setForm(current => ({ ...current, userName: event.target.value }))}
          placeholder="홍길동"
          style={{ height: '28px', fontSize: '.8rem' }}
          onKeyDown={event => { if (event.key === 'Enter') saveServerSettings(); }}
        />
      </div>
      <div className="srow" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '5px', marginTop: '4px' }}>
        <div className="slbl">서버 URL</div>
        <div className="ssub">비워두면 현재 도메인 사용</div>
        <input
          className="inp"
          id="sServerUrl"
          value={form.serverUrl}
          onChange={event => setForm(current => ({ ...current, serverUrl: event.target.value }))}
          placeholder="http://서버IP:5000"
          style={{ height: '28px', fontSize: '.8rem', fontFamily: 'monospace' }}
          onKeyDown={event => { if (event.key === 'Enter') saveServerSettings(); }}
        />
      </div>
      <div style={{ marginTop: '14px' }}>
        <button className="btn btn-p btn-sm" onClick={() => saveServerSettings()}>저장</button>
      </div>
    </div>
  );
}

function EditorPasswordControl() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [placeholder, setPlaceholder] = useState('새 비밀번호 (비우면 제거)');

  useEffect(() => {
    window.__reactSetEditorPwError = message => setError(message || '');
    window.__reactSetEditorPwPlaceholder = value => setPlaceholder(value || '새 비밀번호 (비우면 제거)');
    return () => {
      delete window.__reactSetEditorPwError;
      delete window.__reactSetEditorPwPlaceholder;
    };
  }, []);

  const submit = async () => {
    const ok = await window.setEditorPassword?.(password);
    if (ok) setPassword('');
  };

  return (
    <div className="srow" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
      <div><div className="slbl">편집자 비밀번호</div><div className="ssub">비워두면 비번 없이 편집 가능</div></div>
      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
        <input
          className="inp"
          id="editorPwInp"
          type="password"
          value={password}
          placeholder={placeholder}
          onChange={event => {
            setPassword(event.target.value);
            setError('');
          }}
          style={{ flex: 1, height: '28px', fontSize: '.82rem' }}
          onKeyDown={event => { if (event.key === 'Enter') submit(); }}
        />
        <button className="btn btn-s btn-sm" onClick={submit}>변경</button>
      </div>
      <div id="editorPwErr" style={{ color: 'var(--danger)', fontSize: '.78rem', minHeight: '14px' }}>{error}</div>
    </div>
  );
}

