import { useCallback } from 'react';
import { THEMES, PRESETS, STATUS_OPTS } from '../app/constants.js';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from '../hooks/useDBSync.js';
import { applyVars, getColors, getPresetCSS, setCustomColor } from '../app/theme.js';
import type { AppSettings } from '../types/index.js';

// ── helpers ───────────────────────────────────────────────────────────────────
function cssTextToStyle(cssText: string): React.CSSProperties {
  if (!cssText) return {};
  return cssText
    .split(';')
    .map(r => r.trim())
    .filter(Boolean)
    .reduce<React.CSSProperties>((style, rule) => {
      const sep = rule.indexOf(':');
      if (sep === -1) return style;
      const prop = rule.slice(0, sep).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      const val  = rule.slice(sep + 1).trim();
      if (prop && val) (style as Record<string, string>)[prop] = val;
      return style;
    }, {});
}

// ── Sub-components ────────────────────────────────────────────────────────────
interface ColorInputProps {
  colorKey: string;
  label: string;
  value: string;
  onChange: (key: string, value: string) => void;
}

function ColorInput({ colorKey, label, value, onChange }: ColorInputProps) {
  return (
    <div className="crow">
      <span className="crow-lbl">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <input type="color" value={value} className="cpick"
          onChange={e => onChange(colorKey, e.target.value)} />
        <input type="text" value={value} className="hexinp" maxLength={7}
          onChange={e => onChange(colorKey, e.target.value.trim())} placeholder="#RRGGBB" />
      </div>
    </div>
  );
}

interface PriorityStyleEditorProps {
  priorityKey: string;
  label: string;
  colors: Record<string, unknown>;
  settings: AppSettings;
  onSetPreset: (key: string, presetId: string) => void;
  onSetColor: (colorKey: string, value: string) => void;
}

function PriorityStyleEditor({ priorityKey, label, colors, settings, onSetPreset, onSetColor }: PriorityStyleEditorProps) {
  const selectedPreset  = (settings.priorityStyles as Record<string, string>)[priorityKey];
  const colorKeyPrefix  = priorityKey[0].toUpperCase() + priorityKey.slice(1);
  const lineColorKey    = `p${colorKeyPrefix}`;
  const bgColorKey      = `p${colorKeyPrefix}Bg`;
  const lineColor       = (colors[lineColorKey] as string) || '#888888';
  const bgColor         = (colors[bgColorKey]   as string) || '#eeeeee';

  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '5px' }}>
        {label} 우선순위
      </div>
      <div className="preset-grid">
        {(PRESETS as { id: string; label: string }[]).map(preset => (
          <button type="button"
            className={`preset-btn${selectedPreset === preset.id ? ' on' : ''}`}
            key={preset.id}
            onClick={() => onSetPreset(priorityKey, preset.id)}
          >
            <div className="preset-prev" style={cssTextToStyle(getPresetCSS(preset.id, lineColor, bgColor))} />
            <div className="preset-lbl">{preset.label}</div>
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
        <div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-3)', marginBottom: '3px' }}>라인 색상</div>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <input type="color" value={lineColor} className="cpick" onChange={e => onSetColor(lineColorKey, e.target.value)} />
            <input type="text" value={lineColor} className="hexinp" maxLength={7} onChange={e => onSetColor(lineColorKey, e.target.value.trim())} placeholder="#RRGGBB" />
          </div>
        </div>
        <div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-3)', marginBottom: '3px' }}>배경 색상</div>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <input type="color" value={bgColor} className="cpick" onChange={e => onSetColor(bgColorKey, e.target.value)} />
            <input type="text" value={bgColor} className="hexinp" maxLength={7} onChange={e => onSetColor(bgColorKey, e.target.value.trim())} placeholder="#RRGGBB" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface PreviewCardsProps {
  colors: Record<string, unknown>;
  settings: AppSettings;
}

function PreviewCards({ colors, settings }: PreviewCardsProps) {
  const items = [
    { pk: 'high', name: '결제 처리',  key: 'N0011' },
    { pk: 'mid',  name: '알림 발송',  key: 'N0014' },
    { pk: 'low',  name: '구버전 API', key: 'N0013' },
  ];

  return (
    <div className="preview-cards">
      {items.map(item => {
        const colorKey = item.pk[0].toUpperCase() + item.pk.slice(1);
        const pHex = (colors[`p${colorKey}`] as string) || '#888';
        const pBg  = (colors[`p${colorKey}Bg`] as string) || '#eee';
        const style: React.CSSProperties = {
          ...cssTextToStyle(getPresetCSS((settings.priorityStyles as Record<string, string>)[item.pk], pHex, pBg)),
          borderRadius: `${settings.cardRadius}px`,
          padding: '5px 7px',
          flex: 1,
        };
        return (
          <div style={style} key={item.key}>
            <div style={{ fontSize: '.6rem',  color: 'var(--text-3)', marginBottom: '2px' }}>{item.key}</div>
            <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
            <div style={{ fontSize: '.66rem', color: 'var(--text-3)' }}>담당자</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SettingsDesignPanel() {
  const settings = useAppStore(s => s.settings);
  const colors   = getColors() as Record<string, unknown>;
  const { saveLocal, saveToServer } = useDBSync();

  const handleSave = useCallback(async () => {
    if (settings.storageMode === 'server') await saveToServer();
    else saveLocal();
  }, [settings.storageMode, saveLocal, saveToServer]);

  const applyThemeReact = (themeId: string) => {
    if (!(THEMES as Record<string, unknown>)[themeId]) return;
    const { setSettings, notify, settings: s } = useAppStore.getState();
    setSettings({ ...s, themeId, customColors: { light: {}, dark: {} } });
    handleSave();
    setTimeout(() => {
      applyVars();
      notify(`테마 적용: ${(THEMES as Record<string, { name: string }>)[themeId].name}`, 'success');
    }, 0);
  };

  const setPresetReact = (priorityKey: string, presetId: string) => {
    const { setSettings, settings: s } = useAppStore.getState();
    setSettings({ ...s, priorityStyles: { ...s.priorityStyles, [priorityKey]: presetId } });
    handleSave();
  };

  const setColorReact = (colorKey: string, value: string) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return;
    setCustomColor(colorKey, value);
    handleSave();
  };

  const setStatusColor = (status: string, field: 'bg' | 'col', value: string) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return;
    const { setSettings, settings: s } = useAppStore.getState();
    const prev = s.statusColors?.[status] || { bg: '#eeeeee', col: '#333333' };
    setSettings({ ...s, statusColors: { ...s.statusColors, [status]: { ...prev, [field]: value } } });
    handleSave();
  };

  const resetStatusColor = (status: string) => {
    const { setSettings, settings: s } = useAppStore.getState();
    const next = { ...s.statusColors };
    delete next[status];
    setSettings({ ...s, statusColors: next });
    handleSave();
  };

  const adjustBorderWidth = (delta: number) => {
    const next = Math.max(1, Math.min(4, ((colors.mxBW as number) || 1) + delta));
    setCustomColor('mxBW', next);
    handleSave();
  };

  const mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

  const colorGroups = [
    { title: '보더',                       items: [{ id: 'mxBorder', label: '보더 색상' }] },
    { title: 'X축 헤더 (그룹)',             items: [{ id: 'mxGBg',   label: '배경색' },   { id: 'mxGC',  label: '텍스트색' }] },
    { title: 'X축 서브헤더 (서브그룹)',     items: [{ id: 'mxSgBg',  label: '배경색' },   { id: 'mxSgC', label: '텍스트색' }] },
    { title: 'Y축 헤더·서브헤더 (카테고리)', items: [{ id: 'mxCBg',   label: '배경색' },   { id: 'mxCC',  label: '텍스트색' }] },
  ];

  return (
    <div>
      {/* #3: 카드 미리보기 최상단 */}
      <div className="sec-ttl">카드 미리보기</div>
      <PreviewCards colors={colors} settings={settings} />

      <div className="sec-ttl" style={{ marginTop: '16px' }}>테마</div>
      <div style={{ fontSize: '.77rem', color: 'var(--text-3)', marginBottom: '10px' }}>
        테마 선택 시 색상이 자동 업데이트됩니다.
      </div>
      <div className="theme-grid">
        {Object.entries(THEMES as Record<string, { name: string; light: Record<string, string>; dark: Record<string, string> }>).map(([themeId, theme]) => {
          const themeColors = theme[mode];
          return (
            <button type="button"
              className={`theme-card${themeId === settings.themeId ? ' on' : ''}`}
              key={themeId}
              onClick={() => applyThemeReact(themeId)}
            >
              <div className="theme-swatches">
                <div className="theme-swatch" style={{ background: themeColors.pHigh }} />
                <div className="theme-swatch" style={{ background: themeColors.pMid }} />
                <div className="theme-swatch" style={{ background: themeColors.mxGBg }} />
              </div>
              <div className="theme-name">{theme.name}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px', marginTop: '16px' }}>
        <div>
          <div className="sec-ttl">카드 스타일</div>
          <PriorityStyleEditor priorityKey="high" label="높음" colors={colors} settings={settings} onSetPreset={setPresetReact} onSetColor={setColorReact} />
          <PriorityStyleEditor priorityKey="mid"  label="중간" colors={colors} settings={settings} onSetPreset={setPresetReact} onSetColor={setColorReact} />
          <PriorityStyleEditor priorityKey="low"  label="낮음" colors={colors} settings={settings} onSetPreset={setPresetReact} onSetColor={setColorReact} />
        </div>
        <div>
          <div className="sec-ttl">포인트·배경 색상</div>
          <div className="crow" style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
            <span style={{ fontSize: '.8125rem', fontWeight: 500, color: 'var(--text)' }}>보더 두께</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button className="stepbtn" onClick={() => adjustBorderWidth(-1)}>−</button>
              <span style={{ fontSize: '.8125rem', fontWeight: 600, minWidth: '32px', textAlign: 'center' }}>
                {colors.mxBW as number}px
              </span>
              <button className="stepbtn" onClick={() => adjustBorderWidth(1)}>+</button>
            </div>
          </div>
          {colorGroups.map(group => (
            <div key={group.title}>
              <div className="sec-ttl">{group.title}</div>
              {group.items.map(item => (
                <ColorInput
                  key={item.id}
                  colorKey={item.id}
                  label={item.label}
                  value={(colors[item.id] as string) || '#888888'}
                  onChange={setColorReact}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="sec-ttl" style={{ marginTop: '16px' }}>상태 배지 색상</div>
      <div style={{ fontSize: '.72rem', color: 'var(--text-3)', marginBottom: '8px' }}>
        비워두면 기본 색상을 사용합니다.
      </div>
      {(STATUS_OPTS as string[]).map(st => {
        const custom = settings.statusColors?.[st];
        const label  = settings.statusLabels?.[st] || st;
        return (
          <div key={st} className="crow" style={{ alignItems: 'center', gap: '8px' }}>
            <span className="crow-lbl" style={{ minWidth: '60px' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="color"
                className="cpick"
                value={custom?.bg || '#eeeeee'}
                title="배경색"
                onChange={e => setStatusColor(st, 'bg', e.target.value)}
              />
              <input type="color"
                className="cpick"
                value={custom?.col || '#333333'}
                title="텍스트색"
                onChange={e => setStatusColor(st, 'col', e.target.value)}
              />
              {custom && (
                <button className="btn btn-g btn-sm" onClick={() => resetStatusColor(st)} title="초기화">↺</button>
              )}
              {custom && (
                <span
                  className="status-badge"
                  style={{ background: custom.bg, color: custom.col, marginLeft: '4px' }}
                >
                  {label}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
