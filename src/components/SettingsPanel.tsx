import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useDBSync } from '../hooks/useDBSync.js';
import { useModals } from '../hooks/useModals.js';
import { applyVars } from '../app/theme.js';
import { DEMO, DEFAULT_LIST_COLS, STATUS_OPTS } from '../app/constants.js';
import { migrateSettings } from '../utils/itemUtils.js';
import ActivityLogPanel from './ActivityLogPanel.jsx';
import DashboardSectionOrder from './DashboardSectionOrder.jsx';
import SettingsColumnsPanel from './SettingsColumnsPanel.jsx';
import SettingsDesignPanel from './SettingsDesignPanel.jsx';
import { expClip, expTSV, expXLS, expHTML, expMdZip } from '../app/io.js';

// ── Icon helpers ─────────────────────────────────────────────────────────────
function ClipIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>; }
function TsvIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>; }
function XlsIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>; }
function HtmlIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>; }
function ZipIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>; }

// ── Sub-component types ───────────────────────────────────────────────────────
interface TabProps {
  id: string;
  active: string;
  setActive: (id: string) => void;
  children: React.ReactNode;
}

interface StepperProps {
  label: string;
  sub?: string;
  value: string | number;
  onMinus: () => void;
  onPlus: () => void;
}

interface ServerSettingsPanelProps {
  settings: ReturnType<typeof useAppStore.getState>['settings'];
  onSave: (s: ReturnType<typeof useAppStore.getState>['settings']) => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SettingsPanel() {
  const settings    = useAppStore(s => s.settings);
  const activeModal = useAppStore(s => s.activeModal);
  const { isAdmin, isEditor } = useAuth();
  const { saveLocal, saveToServer, broadcastSharedData } = useDBSync();
  const { closeModal, openModal } = useModals();
  const [activeTab, setActiveTab] = useState('display');
  const settingsFileRef = useRef<HTMLInputElement>(null);

  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  const buildId    = typeof __BUILD_ID__    !== 'undefined' ? __BUILD_ID__    : 'local';

  const persistSettings = useCallback(async (
    nextSettings = useAppStore.getState().settings,
  ) => {
    if (nextSettings.storageMode === 'server') await saveToServer();
    else saveLocal();
  }, [saveLocal, saveToServer]);

  const persistData = useCallback(async () => {
    const s = useAppStore.getState();
    if (s.settings.storageMode === 'server') {
      const ok = await saveToServer();
      if (ok) broadcastSharedData();
    } else {
      saveLocal();
    }
  }, [saveLocal, saveToServer, broadcastSharedData]);

  const updateSetting = async (key: string, value: unknown, { apply = false } = {}) => {
    const { setSettings, settings: s } = useAppStore.getState();
    const nextSettings = { ...s, [key]: value };
    setSettings(nextSettings);
    if (apply) applyVars();
    await persistSettings(nextSettings);
  };

  const adjSetting = (key: string, delta: number, min: number, max: number, stepApply = true) => {
    const current = useAppStore.getState().settings;
    const nextValue = Math.max(min, Math.min(max, ((current as Record<string, number>)[key] ?? 0) + delta));
    updateSetting(key, nextValue, { apply: stepApply });
  };

  const exportSettings = () => {
    const { settings: s, display } = useAppStore.getState();
    const blob = new Blob([JSON.stringify({ settings: s, display }, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), {
      href: url,
      download: `featurematrix-settings-${new Date().toISOString().slice(0, 10)}.json`,
    }).click();
    URL.revokeObjectURL(url);
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const { setSettings, setDisplay, notify, settings: s, display } = useAppStore.getState();
        if (data.settings) setSettings(migrateSettings({ ...s, ...data.settings }));
        if (data.display)   setDisplay({ ...display, ...data.display });
        applyVars();
        persistSettings();
        notify('설정을 불러왔습니다.', 'success');
      } catch {
        useAppStore.getState().notify('설정 JSON을 읽을 수 없습니다.', 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
  };

  const resetSettings = () => {
    if (!confirm('개인 설정을 기본값으로 초기화할까요?')) return;
    const { setSettings, settings: s } = useAppStore.getState();
    const nextSettings = {
      ...s,
      baseFont: 16, cardFont: 12, cardRadius: 6, cardGap: 4,
      colW: 130, catW: 52, subCatW: 80, cellFold: 0, boardFoldCount: 6,
      matrixWidth: 'fluid', panelPos: 'left', panelVisible: true,
      themeId: 'sobuk',
      priorityStyles: { high: 'left-thick', mid: 'left-thin', low: 'none' },
      customColors: { light: {}, dark: {} },
      listColumns: JSON.parse(JSON.stringify(DEFAULT_LIST_COLS)),
    };
    setSettings(nextSettings);
    applyVars();
    persistSettings(nextSettings);
  };

  const resetData = async () => {
    if (!confirm('현재 데이터를 데모 데이터로 초기화할까요?')) return;
    const { pushUndo, setItems, setChangeLog, notify } = useAppStore.getState();
    pushUndo();
    setItems(JSON.parse(JSON.stringify(DEMO)));
    setChangeLog([]);
    await persistData();
    notify('데이터를 초기화했습니다.', 'success');
  };

  if (activeModal !== 'settingsModal') return null;

  return (
    <div className="ov on" id="settingsModal">
      <div className="mbox" style={{ width: '760px' }}>
        <div className="mhd">
          <span className="mtitle">환경 설정</span>
          <button className="mclose" onClick={() => closeModal('settingsModal')}>x</button>
        </div>

        {/* ── 4-tab navigation ── */}
        <div className="stab-row">
          <Tab id="display" active={activeTab} setActive={setActiveTab}>디스플레이</Tab>
          <Tab id="layout"  active={activeTab} setActive={setActiveTab}>레이아웃</Tab>
          {isEditor && <Tab id="data"   active={activeTab} setActive={setActiveTab}>데이터 관리</Tab>}
          {isAdmin  && <Tab id="system" active={activeTab} setActive={setActiveTab}>시스템 설정</Tab>}
        </div>

        <div className="mbody" style={{ padding: '14px 20px' }}>

          {/* ── 탭 1: 디스플레이 설정 (전체) ── */}
          {activeTab === 'display' && (
            <div>
              <div className="sec-ttl">폰트 & 카드</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Stepper label="기본 폰트"   value={`${settings.baseFont}px`}   onMinus={() => adjSetting('baseFont',   -1, 12, 22)} onPlus={() => adjSetting('baseFont',   1, 12, 22)} />
                <Stepper label="카드 폰트"   value={`${settings.cardFont}px`}   onMinus={() => adjSetting('cardFont',   -1, 9, 18)}  onPlus={() => adjSetting('cardFont',   1, 9, 18)} />
                <Stepper label="카드 모서리" value={`${settings.cardRadius}px`} onMinus={() => adjSetting('cardRadius', -1, 0, 14)}  onPlus={() => adjSetting('cardRadius', 1, 0, 14)} />
                <Stepper label="카드 간격"   value={`${settings.cardGap}px`}    onMinus={() => adjSetting('cardGap',    -1, 0, 20)}  onPlus={() => adjSetting('cardGap',    1, 0, 20)} />
              </div>
              <div style={{ marginTop: '16px' }}>
                <SettingsDesignPanel />
              </div>
            </div>
          )}

          {/* ── 탭 2: 레이아웃 설정 (전체) ── */}
          {activeTab === 'layout' && (
            <div>
              <div className="sec-ttl">매트릭스 레이아웃</div>
              <Stepper label="그룹 열 폭" value={`${settings.colW}px`} onMinus={() => adjSetting('colW', -10, 80, 300)} onPlus={() => adjSetting('colW', 10, 80, 300)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Stepper label="카테고리 폭"       value={`${settings.catW}px`}    onMinus={() => adjSetting('catW',         -5,  40, 120)} onPlus={() => adjSetting('catW',         5,  40, 120)} />
                <Stepper label="서브카테고리 폭"   value={`${settings.subCatW}px`} onMinus={() => adjSetting('subCatW',     -10,  40, 240)} onPlus={() => adjSetting('subCatW',     10,  40, 240)} />
                <Stepper label="매트릭스 접기 기준" value={settings.cellFold === 0 ? '항상 펼침' : settings.cellFold}  onMinus={() => adjSetting('cellFold',     -1,  0,  20, false)} onPlus={() => adjSetting('cellFold',     1,  0,  20, false)} />
                <Stepper label="보드 접기 기준"    value={settings.boardFoldCount === 0 ? '항상 펼침' : settings.boardFoldCount} onMinus={() => adjSetting('boardFoldCount', -1, 0, 30, false)} onPlus={() => adjSetting('boardFoldCount', 1, 0, 30, false)} />
              </div>
              <div style={{ marginTop: '16px' }}>
                <SettingsColumnsPanel />
              </div>
            </div>
          )}

          {/* ── 탭 3: 데이터 관리 (편집자+) ── */}
          {activeTab === 'data' && isEditor && (
            <div>
              <div className="sec-ttl">내보내기</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                <button className="btn btn-s btn-sm" onClick={() => expClip()}><ClipIcon /> 클립보드</button>
                <button className="btn btn-s btn-sm" onClick={() => expTSV()}><TsvIcon /> TSV</button>
                <button className="btn btn-s btn-sm" onClick={() => expXLS()}><XlsIcon /> Excel</button>
                <button className="btn btn-s btn-sm" onClick={() => expHTML({ fluid: settings.matrixWidth === 'fluid' })}><HtmlIcon /> HTML</button>
                <button className="btn btn-s btn-sm" onClick={() => expMdZip()}><ZipIcon /> MD ZIP</button>
              </div>

              <div className="sec-ttl" style={{ marginTop: '12px' }}>설정 파일</div>
              <div className="srow">
                <div><div className="slbl">설정 JSON</div></div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn btn-s btn-sm" onClick={exportSettings}>저장</button>
                  <button className="btn btn-s btn-sm" onClick={() => settingsFileRef.current?.click()}>불러오기</button>
                  <button className="btn btn-d btn-sm" onClick={resetSettings}>설정 초기화</button>
                  <input ref={settingsFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importSettings} />
                </div>
              </div>
            </div>
          )}

          {/* ── 탭 4: 시스템 설정 (관리자) ── */}
          {activeTab === 'system' && isAdmin && (
            <div>
              {/* 저장소 */}
              <ServerSettingsPanel settings={settings} onSave={persistSettings} />

              {/* 데이터 관리 */}
              <div className="sec-ttl" style={{ marginTop: '16px' }}>데이터 관리</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <button className="btn btn-s btn-sm" onClick={() => openModal('importModal')}><TsvIcon /> 가져오기</button>
                <button className="btn btn-d btn-sm" onClick={resetData}>데이터 초기화</button>
              </div>

              {/* 서버 공통 설정 */}
              <div className="sec-ttl" style={{ marginTop: '16px' }}>서버 공통 설정</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 8px' }}>
                <div className="srow-v">
                  <div className="slbl">타이틀</div>
                  <input className="inp" value={settings.title || ''} onChange={e => updateSetting('title', e.target.value)} />
                </div>
                <div className="srow-v">
                  <div className="slbl">서브타이틀</div>
                  <input className="inp" value={settings.subtitle || ''} onChange={e => updateSetting('subtitle', e.target.value)} />
                </div>
              </div>
              <div className="srow-v" style={{ marginTop: '8px' }}>
                <div className="slbl">대시보드 히어로 제목</div>
                <input className="inp" value={settings.dbHeroName || ''} onChange={e => updateSetting('dbHeroName', e.target.value)} />
              </div>

              {/* 진행상태 명칭 */}
              <div className="sec-ttl" style={{ marginTop: '16px' }}>진행상태 명칭 설정</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: '12px' }}>
                {(STATUS_OPTS as string[]).map(key => (
                  <div key={key} className="srow-v">
                    <div className="slbl" style={{ opacity: 0.6 }}>{key} (내부키)</div>
                    <input
                      className="inp"
                      value={(settings.statusLabels as Record<string, string>)?.[key] || key}
                      onChange={e => {
                        const nextLabels = { ...(settings.statusLabels || {}), [key]: e.target.value };
                        updateSetting('statusLabels', nextLabels);
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* 대시보드 섹션 순서 */}
              <div className="sec-ttl" style={{ marginTop: '16px' }}>대시보드 섹션 순서</div>
              <div style={{ fontSize: '.77rem', color: 'var(--text-3)', marginBottom: '10px' }}>
                드래그하거나 ▲▼ 버튼으로 순서를 변경하세요
              </div>
              <DashboardSectionOrder />

              {/* 활동 로그 */}
              <div style={{ marginTop: '16px' }}>
                <ActivityLogPanel
                  changeLogMax={settings.changeLogMax}
                  onChangeLogMax={delta => adjSetting('changeLogMax', delta, 10, 500, false)}
                />
              </div>

              {/* 빌드 정보 */}
              <div className="sec-ttl" style={{ marginTop: '16px' }}>빌드 정보</div>
              <div className="srow">
                <div><div className="slbl">버전 정보</div></div>
                <span style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text-2)' }}>
                  {`v${appVersion} (build ${buildId})`}
                </span>
              </div>
            </div>
          )}

        </div>

        <div className="mfoot">
          <button className="btn btn-p btn-sm" onClick={() => closeModal('settingsModal')}>닫기</button>
        </div>
      </div>
    </div>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────
function Tab({ id, active, setActive, children }: TabProps) {
  return (
    <button className={`stab${active === id ? ' on' : ''}`} onClick={() => setActive(id)}>
      {children}
    </button>
  );
}

function Stepper({ label, sub, value, onMinus, onPlus }: StepperProps) {
  return (
    <div className="srow">
      <div>
        <div className="slbl">{label}</div>
        {sub && <div className="ssub">{sub}</div>}
      </div>
      <div className="stepper">
        <button className="stepbtn" onClick={onMinus}>-</button>
        <span>{value}</span>
        <button className="stepbtn" onClick={onPlus}>+</button>
      </div>
    </div>
  );
}

function ServerSettingsPanel({ settings, onSave }: ServerSettingsPanelProps) {
  const setSettings = useAppStore(s => s.setSettings);
  const [form, setForm] = useState({
    storageMode: settings.storageMode || 'server',
    userName:    settings.userName    || '',
  });

  const save = () => {
    const nextSettings = { ...settings, ...form };
    setSettings(nextSettings);
    onSave(nextSettings);
  };

  const radioStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '.84rem', color: 'var(--text)', fontWeight: 600,
  };

  return (
    <div>
      <div className="sec-ttl">데이터 소스</div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <label className="radio-lbl" style={radioStyle}>
          <input type="radio" checked={form.storageMode === 'server'} onChange={() => setForm({ ...form, storageMode: 'server' })} />
          서버 저장(공유)
        </label>
        <label className="radio-lbl" style={radioStyle}>
          <input type="radio" checked={form.storageMode === 'local'}  onChange={() => setForm({ ...form, storageMode: 'local' })} />
          브라우저 저장(개인)
        </label>
      </div>
      <div className="srow-v">
        <div className="slbl">표시 이름</div>
        <input className="inp" value={form.userName} onChange={e => setForm({ ...form, userName: e.target.value })} placeholder="익명" />
      </div>
      <div style={{ marginTop: '14px' }}>
        <button className="btn btn-p btn-sm" onClick={save}>저장 및 적용</button>
      </div>
    </div>
  );
}
