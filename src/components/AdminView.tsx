import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useDBSync } from '../hooks/useDBSync.js';
import { useModals } from '../hooks/useModals.js';
import { DEMO, STATUS_OPTS } from '../app/constants.js';
import ActivityLogPanel from './ActivityLogPanel.jsx';
import DashboardSectionOrder from './DashboardSectionOrder.jsx';

type AdminTab = 'server' | 'status' | 'dashboard' | 'data' | 'log';

// ── Icons ─────────────────────────────────────────────────────────────────────
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

// ── Inset tab ─────────────────────────────────────────────────────────────────
function InsetTab({ id, active, setActive, children }: {
  id: AdminTab;
  active: AdminTab;
  setActive: (id: AdminTab) => void;
  children: React.ReactNode;
}) {
  const isActive = active === id;
  return (
    <button
      onClick={() => setActive(id)}
      style={{
        padding: '6px 15px',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '.81rem',
        fontWeight: isActive ? 700 : 500,
        background: isActive ? 'var(--surface)' : 'transparent',
        color: isActive ? 'var(--text)' : 'var(--text-3)',
        boxShadow: isActive ? '0 1px 4px rgba(0,0,0,.13)' : 'none',
        transition: 'all .13s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminView() {
  const settings = useAppStore(s => s.settings);
  const { isAdmin } = useAuth();
  const { saveLocal, saveToServer, broadcastSharedData } = useDBSync();
  const { openModal } = useModals();
  const [activeTab, setActiveTab] = useState<AdminTab>('server');
  const [form, setForm] = useState({
    storageMode: (settings.storageMode || 'server') as 'server' | 'local',
    userName: settings.userName || '',
  });

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

  const updateSetting = useCallback(async (key: string, value: unknown) => {
    const { setSettings, settings: s } = useAppStore.getState();
    const nextSettings = { ...s, [key]: value };
    setSettings(nextSettings);
    await persistSettings(nextSettings);
  }, [persistSettings]);

  const adjSetting = useCallback((key: string, delta: number, min: number, max: number) => {
    const current = useAppStore.getState().settings;
    const nextValue = Math.max(min, Math.min(max, ((current as Record<string, number>)[key] ?? 0) + delta));
    updateSetting(key, nextValue);
  }, [updateSetting]);

  const saveDataSource = useCallback(() => {
    const { setSettings, settings: s } = useAppStore.getState();
    const nextSettings = { ...s, ...form };
    setSettings(nextSettings);
    persistSettings(nextSettings);
  }, [form, persistSettings]);

  const resetData = useCallback(async () => {
    if (!confirm('현재 데이터를 데모 데이터로 초기화할까요?')) return;
    const { pushUndo, setItems, setChangeLog, notify } = useAppStore.getState();
    pushUndo();
    setItems(JSON.parse(JSON.stringify(DEMO)));
    setChangeLog([]);
    await persistData();
    notify('데이터를 초기화했습니다.', 'success');
  }, [persistData]);

  if (!isAdmin) return null;

  const radioLblStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '.84rem', color: 'var(--text)', fontWeight: 600,
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '860px' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: 'var(--text)' }}>
        <ShieldIcon />
        <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>관리자</span>
      </div>

      {/* Inset tab bar */}
      <div style={{
        background: 'var(--surface-2)',
        borderRadius: '8px',
        padding: '3px',
        display: 'inline-flex',
        gap: '2px',
        marginBottom: '8px',
      }}>
        <InsetTab id="server"    active={activeTab} setActive={setActiveTab}>서버 설정</InsetTab>
        <InsetTab id="status"    active={activeTab} setActive={setActiveTab}>상태 관리</InsetTab>
        <InsetTab id="dashboard" active={activeTab} setActive={setActiveTab}>대시보드</InsetTab>
        <InsetTab id="data"      active={activeTab} setActive={setActiveTab}>데이터</InsetTab>
        <InsetTab id="log"       active={activeTab} setActive={setActiveTab}>활동 로그</InsetTab>
      </div>

      {/* Tab content panel */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-2)',
        borderRadius: '8px',
        padding: '22px 26px',
        minHeight: '360px',
      }}>

        {/* ── 서버 설정 ── */}
        {activeTab === 'server' && (
          <div>
            <div className="sec-ttl">데이터 소스</div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <label className="radio-lbl" style={radioLblStyle}>
                <input type="radio" checked={form.storageMode === 'server'} onChange={() => setForm(f => ({ ...f, storageMode: 'server' }))} />
                서버 저장(공유)
              </label>
              <label className="radio-lbl" style={radioLblStyle}>
                <input type="radio" checked={form.storageMode === 'local'} onChange={() => setForm(f => ({ ...f, storageMode: 'local' }))} />
                브라우저 저장(개인)
              </label>
            </div>
            <div className="srow-v">
              <div className="slbl">표시 이름</div>
              <input className="inp" value={form.userName} onChange={e => setForm(f => ({ ...f, userName: e.target.value }))} placeholder="익명" />
            </div>
            <div style={{ marginTop: '12px' }}>
              <button className="btn btn-p btn-sm" onClick={saveDataSource}>저장 및 적용</button>
            </div>

            <div className="sec-ttl" style={{ marginTop: '22px' }}>서버 공통 설정</div>
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
          </div>
        )}

        {/* ── 상태 관리 ── */}
        {activeTab === 'status' && (
          <div>
            <div className="sec-ttl">진행상태 명칭 설정</div>
            <div style={{ fontSize: '.77rem', color: 'var(--text-3)', marginBottom: '12px' }}>
              각 상태의 표시 이름을 변경할 수 있습니다. 내부 키는 변경되지 않습니다.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
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
          </div>
        )}

        {/* ── 대시보드 ── */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="sec-ttl">대시보드 섹션 순서</div>
            <div style={{ fontSize: '.77rem', color: 'var(--text-3)', marginBottom: '10px' }}>
              드래그하거나 ▲▼ 버튼으로 순서를 변경하세요
            </div>
            <DashboardSectionOrder />
          </div>
        )}

        {/* ── 데이터 ── */}
        {activeTab === 'data' && (
          <div>
            <div className="sec-ttl">데이터 관리</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-s btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => openModal('importModal')}>
                <FileIcon /> 가져오기
              </button>
              <button className="btn btn-d btn-sm" onClick={resetData}>데이터 초기화</button>
            </div>
            <div style={{ fontSize: '.77rem', color: 'var(--text-3)', marginTop: '10px' }}>
              데이터 초기화 시 현재 데이터가 데모 데이터로 대체됩니다.
            </div>
          </div>
        )}

        {/* ── 활동 로그 ── */}
        {activeTab === 'log' && (
          <ActivityLogPanel
            changeLogMax={settings.changeLogMax}
            onChangeLogMax={delta => adjSetting('changeLogMax', delta, 10, 500)}
          />
        )}

      </div>
    </div>
  );
}
