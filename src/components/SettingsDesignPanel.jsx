import { useCallback } from 'react';
import { THEMES, PRESETS } from '../app/constants.js';
import { useAppStore } from '../store/useAppStore.js';
import { useDBSync } from '../hooks/useDBSync.js';
import { applyVars, getColors, getPresetCSS, setCustomColor } from '../app/theme.js';

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

      if (property && value) style[property] = value;
      return style;
    }, {});
}

function ColorInput({ colorKey, label, value, onChange }) {
  return (
    <div className="crow">
      <span className="crow-lbl">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <input
          type="color"
          value={value}
          className="cpick"
          onChange={event => onChange(colorKey, event.target.value)}
        />
        <input
          type="text"
          value={value}
          className="hexinp"
          maxLength={7}
          onChange={event => onChange(colorKey, event.target.value.trim())}
          placeholder="#RRGGBB"
        />
      </div>
    </div>
  );
}

function PriorityStyleEditor({ priorityKey, label, colors, settings, onSetPreset, onSetColor }) {
  const selectedPreset = settings.priorityStyles[priorityKey];
  const colorKeyPrefix = priorityKey[0].toUpperCase() + priorityKey.slice(1);
  const lineColorKey = `p${colorKeyPrefix}`;
  const bgColorKey = `p${colorKeyPrefix}Bg`;
  const lineColor = colors[lineColorKey] || '#888888';
  const bgColor = colors[bgColorKey] || '#eeeeee';

  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '5px' }}>
        {label} 우선순위
      </div>
      <div className="preset-grid">
        {PRESETS.map(preset => (
          <button
            type="button"
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
            <input type="color" value={lineColor} className="cpick" onChange={event => onSetColor(lineColorKey, event.target.value)} />
            <input type="text" value={lineColor} className="hexinp" maxLength={7} onChange={event => onSetColor(lineColorKey, event.target.value.trim())} placeholder="#RRGGBB" />
          </div>
        </div>
        <div>
          <div style={{ fontSize: '.72rem', color: 'var(--text-3)', marginBottom: '3px' }}>배경 색상</div>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <input type="color" value={bgColor} className="cpick" onChange={event => onSetColor(bgColorKey, event.target.value)} />
            <input type="text" value={bgColor} className="hexinp" maxLength={7} onChange={event => onSetColor(bgColorKey, event.target.value.trim())} placeholder="#RRGGBB" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewCards({ colors, settings }) {
  const items = [
    { pk: 'high', name: '결제 처리', key: 'N0011' },
    { pk: 'mid', name: '알림 발송', key: 'N0014' },
    { pk: 'low', name: '구버전 API', key: 'N0013' },
  ];

  return (
    <div className="preview-cards">
      {items.map(item => {
        const colorKey = item.pk[0].toUpperCase() + item.pk.slice(1);
        const pHex = colors[`p${colorKey}`] || '#888';
        const pBg = colors[`p${colorKey}Bg`] || '#eee';
        const style = {
          ...cssTextToStyle(getPresetCSS(settings.priorityStyles[item.pk], pHex, pBg)),
          borderRadius: `${settings.cardRadius}px`,
          padding: '5px 7px',
          flex: 1,
        };

        return (
          <div style={style} key={item.key}>
            <div style={{ fontSize: '.6rem', color: 'var(--text-3)', marginBottom: '2px' }}>{item.key}</div>
            <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
            <div style={{ fontSize: '.66rem', color: 'var(--text-3)' }}>담당자</div>
          </div>
        );
      })}
    </div>
  );
}

export default function SettingsDesignPanel() {
  const store = useAppStore();
  const settings = store.settings;
  const colors = getColors();
  const { saveLocal, saveToServer } = useDBSync();

  const handleSave = useCallback(async () => {
    if (settings.storageMode === 'server') await saveToServer();
    else saveLocal();
  }, [settings.storageMode, saveLocal, saveToServer]);

  const applyThemeReact = (themeId) => {
    if (!THEMES[themeId]) return;
    const nextSettings = { 
      ...settings, 
      themeId, 
      customColors: { light: {}, dark: {} } 
    };
    store.setSettings(nextSettings);
    handleSave();
    setTimeout(() => {
      applyVars();
      store.notify(`테마 적용: ${THEMES[themeId].name}`, 'success');
    }, 0);
  };

  const setPresetReact = (priorityKey, presetId) => {
    const nextStyles = { ...settings.priorityStyles, [priorityKey]: presetId };
    store.setSettings({ ...settings, priorityStyles: nextStyles });
    handleSave();
  };

  const setColorReact = (colorKey, value) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return;
    setCustomColor(colorKey, value); // Local direct DOM update (legacy bridge)
    handleSave();
  };

  const adjustBorderWidth = (delta) => {
    const next = Math.max(1, Math.min(4, (colors.mxBW || 1) + delta));
    setCustomColor('mxBW', next);
    handleSave();
  };

  const mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const colorGroups = [
    { title: '보더', items: [{ id: 'mxBorder', label: '보더 색상' }] },
    { title: 'X축 헤더 (그룹)', items: [{ id: 'mxGBg', label: '배경색' }, { id: 'mxGC', label: '텍스트색' }] },
    { title: 'X축 서브헤더 (서브그룹)', items: [{ id: 'mxSgBg', label: '배경색' }, { id: 'mxSgC', label: '텍스트색' }] },
    { title: 'Y축 헤더·서브헤더 (카테고리)', items: [{ id: 'mxCBg', label: '배경색' }, { id: 'mxCC', label: '텍스트색' }] },
  ];

  return (
    <div>
      <div className="sec-ttl">테마</div>
      <div style={{ fontSize: '.77rem', color: 'var(--text-3)', marginBottom: '10px' }}>
        테마 선택 시 색상이 자동 업데이트됩니다.
      </div>
      <div className="theme-grid">
        {Object.entries(THEMES).map(([themeId, theme]) => {
          const themeColors = theme[mode];
          return (
            <button
              type="button"
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
          <PriorityStyleEditor priorityKey="mid" label="중간" colors={colors} settings={settings} onSetPreset={setPresetReact} onSetColor={setColorReact} />
          <PriorityStyleEditor priorityKey="low" label="낮음" colors={colors} settings={settings} onSetPreset={setPresetReact} onSetColor={setColorReact} />
        </div>
        <div>
          <div className="sec-ttl">포인트·배경 색상</div>
          <div className="crow" style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
            <span style={{ fontSize: '.8125rem', fontWeight: 500, color: 'var(--text)' }}>보더 두께</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button className="stepbtn" onClick={() => adjustBorderWidth(-1)}>−</button>
              <span style={{ fontSize: '.8125rem', fontWeight: 600, minWidth: '32px', textAlign: 'center' }}>
                {colors.mxBW}px
              </span>
              <button className="stepbtn" onClick={() => adjustBorderWidth(1)}>+</button>
            </div>
          </div>
          {colorGroups.map(group => (
            <div key={group.title}>
              <div className="sec-ttl">{group.title}</div>
              {group.items.map(item => (
                <ColorInput
                  colorKey={item.id}
                  label={item.label}
                  value={colors[item.id] || '#888888'}
                  key={item.id}
                  onChange={setColorReact}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="sec-ttl" style={{ marginTop: '12px' }}>카드 미리보기</div>
      <PreviewCards colors={colors} settings={settings} />
    </div>
  );
}
