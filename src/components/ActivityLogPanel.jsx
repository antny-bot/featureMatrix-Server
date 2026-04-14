import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import { updateAdminUI } from '../contexts/AuthContext.jsx';

const ACTION_COLORS = {
  접속: 'var(--accent)',
  추가: 'var(--success)',
  수정: 'var(--text)',
  삭제: 'var(--warning)',
  완전삭제: 'var(--danger)',
  이동: 'var(--text-2)',
  되돌리기: 'var(--text-3)',
  일괄변경: 'var(--accent)',
};

function formatLogTime(ts) {
  const date = new Date(ts);
  return `${date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export default function ActivityLogPanel({ changeLogMax, onChangeLogMax }) {
  const [limit, setLimit] = useState(100);
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('탭을 열면 자동으로 불러옵니다.');

  const loadLog = useCallback(async () => {
    setStatus('loading');
    setMessage('불러오는 중...');

    try {
      const json = await apiFetch(`/api/log?limit=${limit}`);
      const nextEntries = json.entries || [];
      setEntries(nextEntries);
      setStatus(nextEntries.length ? 'loaded' : 'empty');
      setMessage(nextEntries.length ? '' : '로그가 없습니다.');
    } catch (err) {
      setEntries([]);
      setStatus('error');
      if (err.status === 403) {
        sessionStorage.removeItem('fmAdminToken');
        updateAdminUI();
        setMessage('세션이 만료됐습니다. 관리자 재인증이 필요합니다.');
      } else {
        setMessage('서버에 연결할 수 없습니다.');
      }
    }
  }, [limit]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  return (
    <div>
      <div className="srow">
        <div>
          <div className="slbl">최근 변경 이력 보관 수</div>
          <div className="ssub">10~500개, 초과분은 자동 삭제</div>
        </div>
        <div className="stepper">
          <button className="stepbtn" onClick={() => onChangeLogMax(-10)}>−</button>
          <span>{changeLogMax ?? 50}</span>
          <button className="stepbtn" onClick={() => onChangeLogMax(10)}>+</button>
        </div>
      </div>
      <div className="sec-ttl" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>활동 로그</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '.7rem', color: 'var(--text-3)' }}>최근</span>
          <input
            type="number"
            value={limit}
            min="10"
            max="1000"
            onChange={event => setLimit(parseInt(event.target.value || '100', 10) || 100)}
            style={{ width: '50px', height: '22px', fontSize: '.72rem', textAlign: 'center', padding: '0 4px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface-2)', color: 'var(--text)' }}
          />
          <span style={{ fontSize: '.7rem', color: 'var(--text-3)' }}>개</span>
          <button className="btn btn-g btn-sm" style={{ fontSize: '.68rem' }} onClick={loadLog}>새로고침</button>
        </div>
      </div>
      <div style={{ height: '320px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '.78rem' }}>
        {status !== 'loaded' ? (
          <div style={{ padding: '16px', textAlign: 'center', color: status === 'error' ? 'var(--danger)' : 'var(--text-3)' }}>
            {message}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--surface)' }}>
                <th style={{ padding: '6px 10px', fontSize: '.68rem', color: 'var(--text-3)', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }}>시각</th>
                <th style={{ padding: '6px 10px', fontSize: '.68rem', color: 'var(--text-3)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>사용자</th>
                <th style={{ padding: '6px 10px', fontSize: '.68rem', color: 'var(--text-3)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>액션</th>
                <th style={{ padding: '6px 10px', fontSize: '.68rem', color: 'var(--text-3)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>내용</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr style={{ borderBottom: '1px solid var(--border)' }} key={`${entry.ts}:${index}`}>
                  <td style={{ padding: '5px 10px', fontSize: '.7rem', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{formatLogTime(entry.ts)}</td>
                  <td style={{ padding: '5px 10px', fontSize: '.75rem', fontWeight: 600 }}>
                    {entry.user || '익명'}
                    {entry.ip && <span style={{ fontSize: '.65rem', fontWeight: 400, color: 'var(--text-3)', marginLeft: '4px' }}>({entry.ip})</span>}
                  </td>
                  <td style={{ padding: '5px 10px', fontSize: '.72rem', fontWeight: 700, color: ACTION_COLORS[entry.action] || 'var(--text)', whiteSpace: 'nowrap' }}>{entry.action}</td>
                  <td style={{ padding: '5px 10px', fontSize: '.72rem', color: 'var(--text-2)' }}>{entry.detail || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
