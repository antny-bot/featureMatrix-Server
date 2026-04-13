const SHORTCUTS = [
  { keys: ['N'], label: '기능 추가' },
  { keys: ['F'], label: '필터 패널 토글' },
  { keys: ['/'], label: '검색 포커스' },
  { keys: ['D'], label: '대시보드 뷰' },
  { keys: ['M'], label: '매트릭스 뷰' },
  { keys: ['B'], label: '보드 뷰' },
  { keys: ['L'], label: '리스트 뷰' },
  { keys: ['Z'], label: '실행 취소' },
  { keys: ['우클릭'], label: '카드 컨텍스트 메뉴' },
  { keys: ['상태뱃지 클릭'], label: '빠른 상태 변경' },
  { keys: ['Ctrl', 'I'], label: 'CSV/TSV 가져오기' },
  { keys: ['Ctrl', 'E'], label: '데이터 내보내기' },
  { keys: ['Ctrl', ','], label: '환경 설정' },
  { keys: ['Esc'], label: '창 닫기' },
];

export default function ShortcutsModal() {
  return (
    <div className="ov" id="shortcutsModal">
      <div className="mbox" style={{ width: '400px' }}>
        <div className="mhd">
          <span className="mtitle">⌨ 단축키</span>
          <button className="mclose" onClick={() => window.closeModal?.('shortcutsModal')}>✕</button>
        </div>
        <div className="mbody">
          {SHORTCUTS.map(({ keys, label }) => (
            <div className="sc-row" key={`${keys.join('+')}:${label}`}>
              <div style={{ display: 'flex', gap: '3px' }}>
                {keys.map(key => <span className="kbd" key={key}>{key}</span>)}
              </div>
              <span style={{ fontSize: '.8125rem', color: 'var(--text-2)' }}>{label}</span>
            </div>
          ))}
        </div>
        <div className="mfoot">
          <button className="btn btn-p btn-sm" onClick={() => window.closeModal?.('shortcutsModal')}>닫기</button>
        </div>
      </div>
    </div>
  );
}
