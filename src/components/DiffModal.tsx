import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { useModals } from '../hooks/useModals.js';

const DIFF_FIELDS = ['name', 'priority', 'status', 'owner', 'group', 'category'];

interface DiffChange {
  field: string;
  before: string;
  after: string;
}

interface DiffRow {
  key: string;
  type: 'added' | 'deleted' | 'changed';
  diffs?: DiffChange[];
  name?: string;
}

interface DiffContent {
  empty: string;
  rows: DiffRow[];
}

export default function DiffModal() {
  const undoStack    = useAppStore(s => s.undoStack);
  const items        = useAppStore(s => s.items);
  const statusLabels = useAppStore(s => s.settings.statusLabels);
  const activeModal  = useAppStore(s => s.activeModal);
  const { closeModal } = useModals();

  const buildDiffRows = useMemo((): DiffContent => {
    const stack = undoStack || [];
    if (!stack.length) return { empty: '변경 이력이 없습니다.', rows: [] };

    const data = JSON.parse(stack[stack.length - 1] as string) as unknown;
    const prev = Array.isArray(data) ? data : ((data as Record<string, unknown>).items || []) as typeof items;
    const cur = items;

    const curMap = Object.fromEntries(cur.map(item => [item.key, item]));
    const prevMap = Object.fromEntries(prev.map(item => [item.key, item]));
    const rows: DiffRow[] = [];

    cur.forEach(item => {
      const old = prevMap[item.key];
      if (!old) {
        rows.push({ key: item.key, type: 'added' });
        return;
      }

      const itemR = item as Record<string, unknown>;
      const oldR  = old  as Record<string, unknown>;
      const diffs = DIFF_FIELDS
        .filter(field => (oldR[field] || '') !== (itemR[field] || ''))
        .map(field => ({
          field,
          before: String(oldR[field] || '—'),
          after:  String(itemR[field] || '—'),
        }));

      if (diffs.length) rows.push({ key: item.key, type: 'changed', diffs });
    });

    prev.forEach(item => {
      if (!curMap[item.key]) rows.push({ key: item.key, type: 'deleted', name: item.name });
    });

    return { empty: rows.length ? '' : '마지막 저장 이후 변경 없음', rows };
  }, [items, undoStack]);

  const content = useMemo((): DiffContent => {
    if (activeModal !== 'diffModal') return { empty: '', rows: [] };
    return buildDiffRows;
  }, [activeModal, buildDiffRows]);

  if (activeModal !== 'diffModal') return null;

  return (
    <div className="ov on" id="diffModal">
      <div className="mbox" style={{ width: '640px' }}>
        <div className="mhd">
          <span className="mtitle">변경 이력 (마지막 Undo 기준)</span>
          <button className="mclose" onClick={() => closeModal('diffModal')}>✕</button>
        </div>
        <div className="mbody" style={{ fontSize: '.82rem', padding: '20px' }}>
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
                    <td className="dk" style={{ verticalAlign: 'top', padding: '8px' }}>{row.key}</td>
                    <td style={{ fontSize: '.78rem', lineHeight: 1.8, padding: '8px' }}>
                      {row.type === 'added' && <span style={{ color: 'var(--success)', fontWeight: 600 }}>신규 추가</span>}
                      {row.type === 'deleted' && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>삭제됨 ({row.name})</span>}
                      {row.type === 'changed' && row.diffs?.map(diff => {
                        const isStatus = diff.field === 'status';
                        const labels = statusLabels || {};
                        const beforeLbl = isStatus ? (labels[diff.before] || diff.before) : diff.before;
                        const afterLbl  = isStatus ? (labels[diff.after]  || diff.after)  : diff.after;
                        return (
                          <div key={diff.field}>
                            <span style={{ color: 'var(--text-3)' }}>{diff.field}:</span>{' '}
                            <s style={{ color: 'var(--p-high,#C0312A)' }}>{beforeLbl}</s>{' '}
                            <span>→</span>{' '}
                            <b style={{ color: 'var(--success)' }}>{afterLbl}</b>
                          </div>
                        );
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="mfoot">
          <button className="btn btn-s btn-sm" onClick={() => closeModal('diffModal')}>닫기</button>
        </div>
      </div>
    </div>
  );
}
