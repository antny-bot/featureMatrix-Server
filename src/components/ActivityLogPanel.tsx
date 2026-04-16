import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAppStore } from '../store/useAppStore.js';
import { ADMIN_TOKEN_KEY } from '../app/constants.js';
import { updateAdminUI } from '../contexts/AuthContext.jsx';

interface LogEntry {
  ts: number;
  user?: string;
  ip?: string;
  action: string;
  detail?: string;
}

interface ActivityLogPanelProps {
  changeLogMax: number;
  onChangeLogMax: (delta: number) => void;
}

const ACTION_COLORS: Record<string, string> = {
  접속: 'var(--accent)',
  추가: 'var(--success)',
  수정: 'var(--text)',
  삭제: 'var(--warning)',
  완전삭제: 'var(--danger)',
  이동: 'var(--text-2)',
  되돌리기: 'var(--text-3)',
  일괄변경: 'var(--accent)',
};

function formatLogTime(ts: number): string {
  const date = new Date(ts);
  return `${date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export default function ActivityLogPanel({ changeLogMax, onChangeLogMax }: ActivityLogPanelProps) {
  const storageMode = useAppStore(s => s.settings.storageMode);
  const [limit, setLimit]     = useState(100);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [status, setStatus]   = useState<'idle' | 'loading' | 'loaded' | 'empty' | 'error'>('idle');
  const [message, setMessage] = useState('탭을 열면 자동으로 불러옵니다.');

  const loadLog = useCallback(async () => {
    // 서버 모드가 아니면 로그 조회 불가
    if (storageMode !== 'server') {
      setStatus('error');
      setMessage('서버 모드에서만 활동 로그를 사용할 수 있습니다.');
      return;
    }

    setStatus('loading');
    setMessage('불러오는 중...');

    try {
      const json = await apiFetch(`/api/log?limit=${limit}`) as { entries?: LogEntry[] };
      const nextEntries = json.entries || [];
      setEntries(nextEntries);
      setStatus(nextEntries.length ? 'loaded' : 'empty');
      setMessage(nextEntries.length ? '' : '로그가 없습니다.');
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      setEntries([]);
      setStatus('error');
      if (e.status === 403) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        updateAdminUI();
        setMessage('세션이 만료됐습니다. 관리자 재인증이 필요합니다.');
      } else if (e.status) {
        setMessage(`서버 오류 (${e.status}): ${e.message || '알 수 없는 오류'}`);
      } else {
        setMessage('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
      }
    }
  }, [limit, storageMode]);

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

      {storageMode !== 'server' ? (
        <div style={{ marginTop: '16px', padding: '14px', background: 'var(--surface-2)', borderRadius: '8px', fontSize: '.8rem', color: 'var(--text-3)', textAlign: 'center' }}>
          서버 모드에서만 활동 로그를 사용할 수 있습니다.
        </div>
      ) : (
        <>
          <div className="sec-ttl" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>활동 로그</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '.7rem', color: 'var(--text-3)' }}>최근</span>
              <input
                type="number"
                value={limit}
                min="10"
                max="1000"
                onChange={e => setLimit(parseInt(e.target.value || '100', 10) || 100)}
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
        </>
      )}
    </div>
  );
}
