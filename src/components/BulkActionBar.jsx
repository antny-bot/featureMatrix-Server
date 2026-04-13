import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { bulkClear, bulkSel } from '../app/render.js';
import { useAppStore } from '../store/useAppStore.js';

function getSnapshot() {
  return {
    count: bulkSel.keys.size,
  };
}

export default function BulkActionBar() {
  const view = useAppStore(s => s.view);
  const { isAdmin: adminOk } = useAuth();
  const [snapshot, setSnapshot] = useState(getSnapshot);
  const [owner, setOwner] = useState('');

  useEffect(() => {
    const refresh = () => setSnapshot(getSnapshot());
    window.__bulkBarRefresh = refresh;
    window.__bulkOwnerValue = () => owner.trim();
    window.__bulkOwnerClear = () => setOwner('');
    window.addEventListener('bulkSelChange', refresh);
    refresh();
    return () => {
      window.removeEventListener('bulkSelChange', refresh);
      delete window.__bulkBarRefresh;
      delete window.__bulkOwnerValue;
      delete window.__bulkOwnerClear;
    };
  }, [owner]);

  const visible = view === 'list' && snapshot.count > 0;
  const lockStyle = adminOk ? undefined : { opacity: .45, pointerEvents: 'none' };
  const lockTitle = adminOk ? undefined : '관리자 전용';

  return (
    <div id="bulkBar" className="bulk-bar" style={{ display: visible ? 'flex' : 'none' }}>
      <span style={{ fontSize: '.8rem', fontWeight: 600 }}>{snapshot.count}개 선택됨</span>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginLeft: '8px', ...lockStyle }}>
        <span style={{ fontSize: '.75rem', color: 'var(--text-2)' }}>우선순위:</span>
        <button className="rbtn" onClick={() => window.bulkSetPrio?.('상')} title={lockTitle}>상</button>
        <button className="rbtn" onClick={() => window.bulkSetPrio?.('중')} title={lockTitle}>중</button>
        <button className="rbtn" onClick={() => window.bulkSetPrio?.('하')} title={lockTitle}>하</button>
        <span style={{ fontSize: '.75rem', color: 'var(--text-2)', marginLeft: '6px' }}>담당:</span>
        <input
          id="bulkOwnerInp"
          className="inp"
          style={{ width: '90px', height: '27px', padding: '0 7px', fontSize: '.78rem' }}
          placeholder="이름 입력"
          value={owner}
          onChange={event => setOwner(event.target.value)}
          disabled={!adminOk}
        />
        <button className="rbtn" onClick={() => window.bulkSetOwner?.()} title={lockTitle}>일괄변경</button>
      </div>
      <button
        className="rbtn"
        style={{ marginLeft: '8px', color: 'var(--danger)' }}
        onClick={() => bulkClear()}
      >
        선택 해제
      </button>
    </div>
  );
}
