import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { FIELDS, FLABELS } from '../app/constants.js';
import { parseTSVFull, impMdFiles } from '../app/io.js';
import { useAppStore } from '../store/useAppStore.js';
import { requireAdmin } from '../contexts/AuthContext.jsx';
import { useDBSync } from '../hooks/useDBSync.js';
import { useModals } from '../hooks/useModals.js';
import { findItem } from '../utils/itemUtils.js';
import type { Item } from '../types/index.js';

const IMPORT_REQUIRED = ['key', 'name'];

function buildDefaultMapping(headers: string[]): Record<string, number> {
  return Object.fromEntries(FIELDS.map(field => {
    const index = headers.findIndex(header => (
      header.trim().toLowerCase() === field.toLowerCase()
      || (FLABELS[field] && header.trim() === FLABELS[field])
    ));
    return [field, index];
  }));
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

export default function ImportModal() {
  const activeModal  = useAppStore(s => s.activeModal);
  const storeNotify  = useAppStore(s => s.notify);
  const { saveLocal, saveToServer, logActivity } = useDBSync();
  const { closeModal } = useModals();

  const csvFileRef = useRef<HTMLInputElement>(null);
  const mdImpRef   = useRef<HTMLInputElement>(null);
  const [raw, setRaw]           = useState('');
  const [step, setStep]         = useState(1);
  const [headers, setHeaders]   = useState<string[]>([]);
  const [rows, setRows]         = useState<string[][]>([]);
  const [mapping, setMapping]   = useState<Record<string, number>>({});
  const [isDragOver, setIsDragOver] = useState(false);

  const notify = useCallback((msg: string, isErr?: boolean) => storeNotify(msg, isErr ? 'error' : 'success'), [storeNotify]);

  const statusText = useMemo(() => `${rows.length}개 행 감지됨, 컬럼 ${headers.length}개`, [headers.length, rows.length]);

  const analyzeText = useCallback((value = raw) => {
    const text = value.trim();
    if (!text) { notify('데이터를 입력해주세요.', true); return; }

    const allRows = parseTSVFull(text);
    if (allRows.length < 2) { notify('헤더와 데이터 행이 필요합니다.', true); return; }

    const nextHeaders = allRows[0];
    const nextRows = allRows.slice(1);

    setHeaders(nextHeaders);
    setRows(nextRows);
    setMapping(buildDefaultMapping(nextHeaders));
    setStep(2);
  }, [raw, notify]);

  const loadFile = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const text = await readTextFile(file);
      setRaw(text);
      analyzeText(text);
    } catch { notify('파일 읽기 오류', true); }
  };

  const doImport = async (append: boolean) => {
    const unmapped = IMPORT_REQUIRED.filter(field => (mapping[field] ?? -1) < 0);
    if (unmapped.length) {
      notify(`필수 필드 매핑이 없습니다: ${unmapped.map(field => FLABELS[field] || field).join(', ')}`, true);
      return;
    }

    const importedItems = rows
      .map(row => Object.fromEntries(FIELDS.map(field => {
        const columnIndex = mapping[field] ?? -1;
        return [field, columnIndex >= 0 && columnIndex < row.length ? (row[columnIndex] || '') : ''];
      })) as Record<string, string>)
      .filter(item => item.key && item.name)
      .map(item => ({ ...item, updatedAt: Date.now() })) as Item[];

    if (!importedItems.length) { notify('가져올 데이터가 없습니다.', true); return; }

    const { items: curItems, pushUndo, setItems, settings } = useAppStore.getState();
    const existingKeys = new Set(curItems.map(it => it.key));
    const duplicates = importedItems.filter(it => existingKeys.has(it.key)).map(it => it.key);

    if (!append && duplicates.length > 0) {
      const sample = `${duplicates.slice(0, 5).join(', ')}${duplicates.length > 5 ? '…' : ''}`;
      if (!window.confirm(`중복 Key ${duplicates.length}개:\n${sample}\n덮어쓰기?`)) return;
    }

    pushUndo();
    let nextItems: Item[] = [];
    let logMsg = '';

    if (!append) {
      if (!window.confirm(`${importedItems.length}개 항목으로 교체하시겠습니까?`)) return;
      nextItems = importedItems;
      logMsg = `전체 교체 (${importedItems.length}개)`;
    } else {
      const itemsMap = new Map(curItems.map(it => [it.key, it]));
      let added = 0;
      importedItems.forEach(it => {
        const existing = itemsMap.get(it.key);
        if (existing) {
          itemsMap.set(it.key, { ...existing, ...it });
        } else {
          itemsMap.set(it.key, it);
          added++;
        }
      });
      nextItems = Array.from(itemsMap.values());
      logMsg = `병합 추가 (신규 ${added}개 / 총 ${importedItems.length}개)`;
    }

    setItems(nextItems);
    await logActivity('가져오기', logMsg);

    if (settings.storageMode === 'server') await saveToServer();
    else saveLocal();

    notify('성공적으로 가져왔습니다.');
    closeModal('importModal');
  };

  if (activeModal !== 'importModal') return null;

  return (
    <div className="ov on" id="importModal">
      <div className="mbox" style={{ width: '600px' }}>
        <div className="mhd">
          <span className="mtitle">📥 데이터 가져오기</span>
          <button className="mclose" onClick={() => closeModal('importModal')}>✕</button>
        </div>
        <div className="mbody" style={{ padding: '20px' }}>
          {step === 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                className={`drop-zone${isDragOver ? ' da' : ''}`}
                onClick={() => csvFileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={e => { e.preventDefault(); setIsDragOver(false); loadFile(e.dataTransfer.files[0]); }}
                style={{ cursor: 'pointer', padding: '30px', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: '12px', background: 'var(--surface-2)' }}
              >
                <input type="file" ref={csvFileRef} accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={e => { loadFile(e.target.files?.[0]); e.target.value = ''; }} />
                <div style={{ fontSize: '1.8rem' }}>📂</div>
                <div style={{ fontWeight: 600, marginTop: '8px' }}>파일 드래그 또는 클릭</div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-3)' }}>.csv / .tsv / .txt (Tab 구분자)</div>
              </div>

              <div style={{ marginTop: '4px' }}>
                <span style={{ fontSize: '.75rem', color: 'var(--text-3)' }}>직접 붙여넣기:</span>
                <textarea
                  className="txta"
                  value={raw}
                  onChange={e => setRaw(e.target.value)}
                  placeholder="헤더 포함 Tab-separated 데이터..."
                  style={{ marginTop: '6px', minHeight: '100px', fontFamily: 'monospace', fontSize: '.72rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-p btn-sm" onClick={() => analyzeText()}>분석하기</button>
              </div>

              <div style={{ marginTop: '10px', paddingTop: '15px', borderTop: '1px solid var(--border)' }}>
                <div className="sec-ttl" style={{ marginBottom: '8px' }}>MD 파일 일괄 가져오기</div>
                <button className="btn btn-s btn-sm" onClick={() => mdImpRef.current?.click()}>MD 파일 선택 (복수)</button>
                <input
                  type="file" ref={mdImpRef} accept=".md" multiple style={{ display: 'none' }}
                  onChange={e => requireAdmin(() => {
                    impMdFiles(e as unknown as Event);
                    closeModal('importModal');
                  })}
                />
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontWeight: 600 }}>컬럼 매핑</span>
                <button className="btn btn-g btn-sm" onClick={() => setStep(1)}>뒤로</button>
              </div>
              <div style={{ fontSize: '.75rem', padding: '8px 12px', background: 'var(--accent-l)', color: 'var(--accent)', borderRadius: '8px', marginBottom: '12px' }}>
                {statusText}
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                {FIELDS.map(f => {
                  const idx = mapping[f] ?? -1;
                  const preview = (idx !== -1 && rows.length > 0) ? (rows[0][idx] || '').slice(0, 30) : '';
                  const required = IMPORT_REQUIRED.includes(f);
                  return (
                    <div className="map-row" key={f} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ width: '100px', fontSize: '.72rem', fontWeight: required ? 700 : 400 }}>{FLABELS[f] || f}{required && '*'}</span>
                      <select className="sel" value={idx} onChange={e => setMapping({ ...mapping, [f]: parseInt(e.target.value) })} style={{ flex: 1, height: '28px', fontSize: '.72rem' }}>
                        <option value={-1}>(매핑 안 함)</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                      <span style={{ width: '120px', fontSize: '.68rem', color: 'var(--text-3)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="btn btn-p btn-sm" onClick={() => doImport(false)}>전체 교체</button>
                <button className="btn btn-s btn-sm" onClick={() => doImport(true)}>병합 추가</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
