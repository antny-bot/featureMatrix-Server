import { useEffect, useMemo, useState } from 'react';
import { FIELDS, FLABELS } from '../app/constants.js';
import { parseTSVFull } from '../app/io.js';
import { closeModal } from '../app/modal.js';
import { findItem, notify, pushUndo, S, save } from '../app/state.js';
import { requireAdmin } from '../app/admin.js';
import { setStore } from '../store/useAppStore.js';

const IMPORT_REQUIRED = ['key', 'name'];

function buildDefaultMapping(headers) {
  return Object.fromEntries(FIELDS.map(field => {
    const index = headers.findIndex(header => (
      header.trim().toLowerCase() === field.toLowerCase()
      || (FLABELS[field] && header.trim() === FLABELS[field])
    ));
    return [field, index];
  }));
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve(event.target.result);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

export default function ImportModal() {
  const [raw, setRaw] = useState('');
  const [step, setStep] = useState(1);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [isDragOver, setIsDragOver] = useState(false);

  const statusText = useMemo(() => `${rows.length}개 행 감지됨, 컬럼 ${headers.length}개`, [headers.length, rows.length]);

  const analyzeText = (value = raw) => {
    const text = value.trim();
    if (!text) {
      notify('데이터를 입력해주세요.', true);
      return;
    }

    const allRows = parseTSVFull(text);
    if (allRows.length < 2) {
      notify('헤더와 데이터 행이 필요합니다.', true);
      return;
    }

    const nextHeaders = allRows[0];
    const nextRows = allRows.slice(1);
    S.importData.headers = nextHeaders;
    S.importData.rows = nextRows;
    setHeaders(nextHeaders);
    setRows(nextRows);
    setMapping(buildDefaultMapping(nextHeaders));
    setStep(2);
  };

  const loadFile = async file => {
    if (!file) return;
    const text = await readTextFile(file);
    setRaw(text);
    analyzeText(text);
  };

  const doImport = append => {
    requireAdmin(() => {
      const unmapped = IMPORT_REQUIRED.filter(field => (mapping[field] ?? -1) < 0);
      if (unmapped.length) {
        notify(`필수 필드 매핑이 없습니다: ${unmapped.map(field => FLABELS[field] || field).join(', ')}`, 'error');
        return;
      }

      const items = rows
        .map(row => Object.fromEntries(FIELDS.map(field => {
          const columnIndex = mapping[field] ?? -1;
          return [field, columnIndex >= 0 && columnIndex < row.length ? (row[columnIndex] || '') : ''];
        })))
        .filter(item => item.key && item.name);

      if (!items.length) {
        notify('가져올 데이터가 없습니다.', true);
        return;
      }

      const existingKeys = new Set(S.items.map(item => item.key));
      const duplicates = items.filter(item => existingKeys.has(item.key)).map(item => item.key);

      if (!append && duplicates.length > 0) {
        const sample = `${duplicates.slice(0, 5).join(', ')}${duplicates.length > 5 ? '…' : ''}`;
        if (!confirm(`중복 Key ${duplicates.length}개:\n${sample}\n덮어쓰기?`)) return;
      }

      pushUndo();
      if (!append) {
        if (!confirm(`${items.length}개 항목으로 교체?`)) return;
        S.items = items;
        notify(`${items.length}개 항목을 가져왔습니다.`);
      } else {
        let added = 0;
        items.forEach(item => {
          const existing = findItem(item.key);
          if (existing) Object.assign(existing, item);
          else {
            S.items.push(item);
            added++;
          }
        });
        notify(`${items.length}개 처리 (신규 ${added}개).`);
      }

      save();
      setStore({ items: S.items });
      closeModal('importModal');
      window.__sobukRenderAll?.();
    });
  };

  useEffect(() => {
    window.__reactAnalyzeCSV = () => analyzeText();
    window.__reactShowImportStep2 = () => setStep(2);
    window.__reactImportBackToStep1 = () => setStep(1);
    window.__reactDoImport = doImport;
    return () => {
      delete window.__reactAnalyzeCSV;
      delete window.__reactShowImportStep2;
      delete window.__reactImportBackToStep1;
      delete window.__reactDoImport;
    };
  });

  return (
    <div className="ov" id="importModal">
      <div className="mbox" style={{ width: '600px' }}>
        <div className="mhd">
          <span className="mtitle">📥 데이터 가져오기</span>
          <button className="mclose" onClick={() => window.closeModal?.('importModal')}>✕</button>
        </div>
        <div className="mbody">
          {step === 1 && (
            <div>
              <div
                className={`drop-zone${isDragOver ? ' da' : ''}`}
                id="dropZone"
                onClick={event => {
                  if (event.target.id !== 'csvFile') document.getElementById('csvFile')?.click();
                }}
                onDragOver={event => {
                  event.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={event => {
                  event.preventDefault();
                  setIsDragOver(false);
                  loadFile(event.dataTransfer.files[0]);
                }}
              >
                <input
                  type="file"
                  id="csvFile"
                  accept=".csv,.tsv,.txt"
                  onClick={event => event.stopPropagation()}
                  onChange={event => {
                    loadFile(event.target.files[0]);
                    event.target.value = '';
                  }}
                />
                <div style={{ fontSize: '1.3rem', marginBottom: '5px' }}>📂</div>
                <div>파일 드래그 또는 클릭</div>
                <div style={{ fontSize: '.7rem', marginTop: '2px', color: 'var(--text-3)' }}>
                  .csv / .tsv · Tab 구분자
                </div>
              </div>
              <div style={{ marginTop: '8px', fontSize: '.74rem', color: 'var(--text-3)' }}>또는 붙여넣기:</div>
              <textarea
                className="txta"
                id="csvPaste"
                value={raw}
                onChange={event => setRaw(event.target.value)}
                placeholder="헤더 포함 Tab-separated 데이터"
                style={{ marginTop: '5px', minHeight: '80px', fontFamily: 'monospace', fontSize: '.7rem' }}
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '7px' }}>
                <button className="btn btn-p btn-sm" onClick={() => analyzeText()}>🔍 분석하기</button>
              </div>
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <div className="exp-sec-ttl">MD 파일 일괄 가져오기</div>
                <div style={{ fontSize: '.74rem', color: 'var(--text-3)', marginBottom: '8px' }}>
                  <code style={{ fontFamily: 'monospace', background: 'var(--surface-2)', padding: '1px 4px', borderRadius: '3px' }}>
                    {'{key}_{기능명}.md'}
                  </code>
                  {' 파일을 복수 선택하면 key로 자동 매핑'}
                </div>
                <button className="btn btn-s btn-sm" onClick={() => document.getElementById('mdImpInp')?.click()}>
                  📂 MD 파일 선택
                </button>
                <input
                  type="file"
                  id="mdImpInp"
                  accept=".md"
                  multiple
                  style={{ display: 'none' }}
                  onChange={event => window.impMdFiles?.(event)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text)' }}>컬럼 매핑 확인</span>
                <button className="btn btn-g btn-sm" onClick={() => setStep(1)}>← 뒤로</button>
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--text-2)', marginBottom: '8px', padding: '7px 10px', background: 'var(--accent-l)', borderRadius: '7px', borderLeft: '3px solid var(--accent)' }}>
                {statusText}
              </div>
              <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '7px', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                  <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', minWidth: '110px' }}>소복 필드</span>
                  <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', flex: 1 }}>CSV 컬럼</span>
                  <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', minWidth: '100px' }}>미리보기</span>
                </div>
                {FIELDS.map(field => {
                  const selectedIndex = mapping[field] ?? -1;
                  const preview = selectedIndex !== -1 && rows.length > 0
                    ? (rows[0][selectedIndex] || '').replace(/\n/g, '↵').slice(0, 40)
                    : '';
                  const required = IMPORT_REQUIRED.includes(field);
                  return (
                    <div className="map-row" key={field}>
                      <span className="map-lbl" style={required ? { fontWeight: 700, color: 'var(--text)' } : undefined}>
                        {FLABELS[field] || field}{required ? ' *' : ''}
                      </span>
                      <select
                        className="map-sel"
                        value={selectedIndex}
                        onChange={event => setMapping(current => ({ ...current, [field]: parseInt(event.target.value, 10) }))}
                      >
                        <option value={-1}>(매핑 안 함)</option>
                        {headers.map((header, index) => (
                          <option value={index} key={`${header}:${index}`}>{header}</option>
                        ))}
                      </select>
                      <span className="map-prev">{preview}</span>
                    </div>
                  );
                })}
                <div style={{ fontSize: '.7rem', color: 'var(--text-3)', marginTop: '6px' }}>* 필수 필드</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <button className="btn btn-p btn-sm" onClick={() => doImport(false)}>⬇ 가져오기</button>
                <button className="btn btn-s btn-sm" onClick={() => doImport(true)}>병합 추가</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
