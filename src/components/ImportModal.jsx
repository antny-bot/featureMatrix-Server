export default function ImportModal() {
  return (
    <div className="ov" id="importModal">
      <div className="mbox" style={{ width: '600px' }}>
        <div className="mhd">
          <span className="mtitle">📥 데이터 가져오기</span>
          <button className="mclose" onClick={() => window.closeModal?.('importModal')}>✕</button>
        </div>
        <div className="mbody">
          <div id="impStep1">
            <div
              className="drop-zone"
              id="dropZone"
              onClick={e => {
                if (e.target.id !== 'csvFile') document.getElementById('csvFile')?.click();
              }}
              onDragOver={e => window.dzOver?.(e)}
              onDragLeave={() => window.dzLeave?.()}
              onDrop={e => window.dzDrop?.(e)}
            >
              <input
                type="file"
                id="csvFile"
                accept=".csv,.tsv,.txt"
                onClick={e => e.stopPropagation()}
                onChange={e => window.csvFileSel?.(e)}
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
              placeholder="헤더 포함 Tab-separated 데이터"
              style={{
                marginTop: '5px',
                minHeight: '80px',
                fontFamily: 'monospace',
                fontSize: '.7rem',
              }}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '7px' }}>
              <button className="btn btn-p btn-sm" onClick={() => window.analyzeCSV?.()}>🔍 분석하기</button>
            </div>
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <div className="exp-sec-ttl">MD 파일 일괄 가져오기</div>
              <div style={{ fontSize: '.74rem', color: 'var(--text-3)', marginBottom: '8px' }}>
                <code
                  style={{
                    fontFamily: 'monospace',
                    background: 'var(--surface-2)',
                    padding: '1px 4px',
                    borderRadius: '3px',
                  }}
                >
                  {'{key}_{기능명}.md'}
                </code>
                {' 파일을 복수 선택하면 key로 자동 매핑'}
              </div>
              <button
                className="btn btn-s btn-sm"
                onClick={() => document.getElementById('mdImpInp')?.click()}
              >
                📂 MD 파일 선택
              </button>
              <input
                type="file"
                id="mdImpInp"
                accept=".md"
                multiple
                style={{ display: 'none' }}
                onChange={e => window.impMdFiles?.(e)}
              />
            </div>
          </div>

          <div id="impStep2" style={{ display: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text)' }}>컬럼 매핑 확인</span>
              <button className="btn btn-g btn-sm" onClick={() => window.backToStep1?.()}>← 뒤로</button>
            </div>
            <div
              id="mapStatus"
              style={{
                fontSize: '.78rem',
                color: 'var(--text-2)',
                marginBottom: '8px',
                padding: '7px 10px',
                background: 'var(--accent-l)',
                borderRadius: '7px',
                borderLeft: '3px solid var(--accent)',
              }}
            />
            <div
              style={{
                maxHeight: '260px',
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: '7px',
                background: 'var(--surface)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '5px 8px',
                  background: 'var(--surface-2)',
                  borderBottom: '2px solid var(--border)',
                }}
              >
                <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', minWidth: '110px' }}>소복 필드</span>
                <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', flex: 1 }}>CSV 컬럼</span>
                <span style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3)', minWidth: '100px' }}>미리보기</span>
              </div>
              <div id="mapRows" />
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
              <button className="btn btn-p btn-sm" onClick={() => window.doImport?.(false)}>⬇ 가져오기</button>
              <button className="btn btn-s btn-sm" onClick={() => window.doImport?.(true)}>병합 추가</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
