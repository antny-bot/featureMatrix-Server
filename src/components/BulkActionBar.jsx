import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useAppStore } from '../store/useAppStore.js';
import { useListActions } from '../hooks/useListActions.js';

export default function BulkActionBar() {
  const view = useAppStore(s => s.view);
  const selectedKeys = useAppStore(s => s.bulkSelectionKeys);
  const { isAdmin: adminOk } = useAuth();
  const { setBulkPriority, setBulkOwner, bulkClearSelection } = useListActions();
  
  const [owner, setOwner] = useState('');

  const updateOwner = async () => {
    if (!owner.trim()) return;
    await setBulkOwner(owner);
    setOwner('');
  };

  const visible = view === 'list' && selectedKeys.length > 0;
  const lockStyle = adminOk ? undefined : { opacity: .45, pointerEvents: 'none' };
  const lockTitle = adminOk ? undefined : '관리자 전용';

  return (
    <div id="bulkBar" className="bulk-bar" style={{ display: visible ? 'flex' : 'none' }}>
      <span style={{ fontSize: '.8rem', fontWeight: 600 }}>{selectedKeys.length}개 선택됨</span>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginLeft: '8px', ...lockStyle }}>
        <span style={{ fontSize: '.75rem', color: 'var(--text-2)' }}>우선순위:</span>
        <button className="rbtn" onClick={() => setBulkPriority('상')} title={lockTitle}>상</button>
        <button className="rbtn" onClick={() => setBulkPriority('중')} title={lockTitle}>중</button>
        <button className="rbtn" onClick={() => setBulkPriority('하')} title={lockTitle}>하</button>
        
        <span style={{ fontSize: '.75rem', color: 'var(--text-2)', marginLeft: '6px' }}>담당:</span>
        <input
          id="bulkOwnerInp"
          className="inp"
          style={{ width: '90px', height: '27px', padding: '0 7px', fontSize: '.78rem' }}
          placeholder="이름 입력"
          value={owner}
          onChange={e => setOwner(e.target.value)}
          disabled={!adminOk}
        />
        <button className="rbtn" onClick={updateOwner} title={lockTitle}>일괄변경</button>
      </div>
      
      <button
        className="rbtn"
        style={{ marginLeft: '8px', color: 'var(--danger)' }}
        onClick={() => bulkClearSelection()}
      >
        선택 해제
      </button>
    </div>
  );
}
