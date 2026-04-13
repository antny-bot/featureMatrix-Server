import { useEffect, useState } from 'react';
import { getUndoHistory, S } from '../app/state.js';

const DIFF_FIELDS = ['name', 'priority', 'status', 'owner', 'group', 'category'];

function buildDiffRows() {
  const stack = getUndoHistory();
  if (!stack.length) return { empty: '변경 이력이 없습니다.', rows: [] };

  const prev = JSON.parse(stack[stack.length - 1]);
  const cur = S.items;
  const curMap = Object.fromEntries(cur.map(item => [item.key, item]));
  const prevMap = Object.fromEntries(prev.map(item => [item.key, item]));
  const rows = [];

  cur.forEach(item => {
    const old = prevMap[item.key];
    if (!old) {
      rows.push({ key: item.key, type: 'added' });
      return;
    }

    const diffs = DIFF_FIELDS
      .filter(field => (old[field] || '') !== (item[field] || ''))
      .map(field => ({
        field,
        before: old[field] || '—',
        after: item[field] || '—',
      }));

    if (diffs.length) rows.push({ key: item.key, type: 'changed', diffs });
  });

  prev.forEach(item => {
    if (!curMap[item.key]) rows.push({ key: item.key, type: 'deleted', name: item.name });
  });

  return {
    empty: rows.length ? '' : '마지막 저장 이후 변경 없음',
    rows,
  };
}

export default function DiffModal() {
  const [content, setContent] = useState({ empty: '', rows: [] });

  useEffect(() => {
    window.__reactOpenDiffModal = () => {
      setContent(buildDiffRows());
      window.openModal?.('diffModal');
    };
    return () => { delete window.__reactOpenDiffModal; };
  }, []);

  return (
    <div className="ov" id="diffModal">
      <div className="mbox" style={{ width: '640px' }}>
        <div className="mhd">
          <span className="mtitle">변경 이력 (마지막 Undo 기준)</span>
          <button className="mclose" onClick={() => window.closeModal?.('diffModal')}>✕</button>
        </div>
        <div className="mbody" style={{ fontSize: '.82rem' }}>
          {content.empty ? (
            <div style={{ color: 'var(--text-3)', fontSize: '.85rem', textAlign: 'center', padding: '20px' }}>
              {content.empty}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: '.72rem', color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>Key</th>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: '.72rem', color: 'var(--text-3)', borderBottom: '1px solid var(--border)' }}>변경 내용</th>
                </tr>
              </thead>
              <tbody>
                {content.rows.map(row => (
                  <tr key={`${row.type}:${row.key}`}>
                    <td className="dk" style={{ verticalAlign: 'top' }}>{row.key}</td>
                    <td style={{ fontSize: '.78rem', lineHeight: 1.8 }}>
                      {row.type === 'added' && <span style={{ color: 'var(--success)' }}>신규 추가</span>}
                      {row.type === 'deleted' && <span style={{ color: 'var(--danger)' }}>삭제됨 ({row.name})</span>}
                      {row.type === 'changed' && row.diffs.map(diff => (
                        <div key={diff.field}>
                          <span style={{ color: 'var(--text-3)' }}>{diff.field}:</span>{' '}
                          <s style={{ color: 'var(--danger)' }}>{diff.before}</s>{' '}
                          <span>→</span>{' '}
                          <b style={{ color: 'var(--success)' }}>{diff.after}</b>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mfoot">
          <button className="btn btn-s" onClick={() => window.closeModal?.('diffModal')}>닫기</button>
        </div>
      </div>
    </div>
  );
}
