import { useState } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useModals } from '../hooks/useModals.js';
import { expClip, expTSV, expXLS, expHTML, expMdZip } from '../app/io.js';

export default function ExportModal() {
  const activeModal = useAppStore(s => s.activeModal);
  const { closeModal } = useModals();
  const [htmlWidth, setHtmlWidth] = useState<'fluid' | 'fixed'>('fluid');

  if (activeModal !== 'exportModal') return null;

  return (
    <div className="ov on" id="exportModal">
      <div className="mbox" style={{ width: '460px' }}>
        <div className="mhd">
          <span className="mtitle">📤 데이터 내보내기</span>
          <button className="mclose" onClick={() => closeModal('exportModal')}>✕</button>
        </div>
        <div className="mbody">
          <div style={{ marginBottom: '14px' }}>
            <div className="exp-sec-ttl">CSV / TSV</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-s btn-sm" onClick={() => expClip()}>📋 클립보드</button>
              <button className="btn btn-s btn-sm" onClick={() => expTSV()}>⬇ TSV</button>
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <div className="exp-sec-ttl">Excel</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-s btn-sm" onClick={() => expXLS()}>📊 .xls 다운로드</button>
            </div>
          </div>
          <div>
            <div className="exp-sec-ttl">HTML 매트릭스</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.8rem', cursor: 'pointer' }}>
                <input type="radio" name="htmlW" value="fluid" checked={htmlWidth === 'fluid'} onChange={() => setHtmlWidth('fluid')} /> 가변폭
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '.8rem', cursor: 'pointer' }}>
                <input type="radio" name="htmlW" value="fixed" checked={htmlWidth === 'fixed'} onChange={() => setHtmlWidth('fixed')} /> 고정폭
              </label>
            </div>
            <button className="btn btn-s btn-sm" onClick={() => expHTML({ fluid: htmlWidth === 'fluid' })}>🌐 HTML 내보내기</button>
          </div>
          <div style={{ marginTop: '14px' }}>
            <div className="exp-sec-ttl">마크다운 일괄</div>
            <div style={{ fontSize: '.74rem', color: 'var(--text-3)', marginBottom: '6px' }}>
              MD 내용이 작성된 항목만 포함됩니다.
            </div>
            <button className="btn btn-s btn-sm" onClick={() => expMdZip()}>📦 MD ZIP 내보내기</button>
          </div>
        </div>
      </div>
    </div>
  );
}
