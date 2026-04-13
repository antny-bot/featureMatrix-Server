import { useMemo, useState } from 'react';
import { DEFAULT_LIST_COLS, FLABELS } from '../app/constants.js';
import { S, notify, save } from '../app/state.js';
import { renderList, renderMatrix } from '../app/render.js';
import { setStore, useAppStore } from '../store/useAppStore.js';

function syncSettings() {
  setStore({ settings: { ...S.settings } });
}

function getAxisValues(items, settings, orderKey, field) {
  const inData = Array.from(new Set(items.map(item => item[field] || '(미분류)'))).sort((a, b) => a.localeCompare(b, 'ko'));
  const order = settings[orderKey] || [];
  return [...order.filter(value => inData.includes(value)), ...inData.filter(value => !order.includes(value))];
}

function moveItem(list, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex == null) return list;
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function SettingsColumnsPanel() {
  const settings = useAppStore(state => state.settings);
  const items = useAppStore(state => state.items);
  const [drag, setDrag] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const groupAxis = useMemo(
    () => getAxisValues(items, settings, 'groupOrder', 'group'),
    [items, settings],
  );
  const categoryAxis = useMemo(
    () => getAxisValues(items, settings, 'catOrder', 'category'),
    [items, settings],
  );

  const toggleColumn = (index, visible) => {
    S.settings.listColumns = settings.listColumns.map((column, columnIndex) => (
      columnIndex === index ? { ...column, visible } : column
    ));
    save();
    syncSettings();
    if (S.view === 'list') renderList();
  };

  const dropColumn = toIndex => {
    if (!drag || drag.type !== 'column') return;
    S.settings.listColumns = moveItem(settings.listColumns, drag.index, toIndex);
    save();
    syncSettings();
    setDrag(null);
    setDragOver(null);
    if (S.view === 'list') renderList();
  };

  const resetColumns = () => {
    S.settings.listColumns = JSON.parse(JSON.stringify(DEFAULT_LIST_COLS));
    save();
    syncSettings();
    if (S.view === 'list') renderList();
    notify('리스트 컬럼을 기본값으로 복원했습니다.');
  };

  const dropAxis = (field, orderKey, values, toIndex) => {
    if (!drag || drag.type !== 'axis' || drag.field !== field) return;
    S.settings[orderKey] = moveItem(values, drag.index, toIndex);
    save();
    syncSettings();
    setDrag(null);
    setDragOver(null);
    if (S.view === 'matrix') renderMatrix();
  };

  const resetAxis = () => {
    S.settings.groupOrder = [];
    S.settings.catOrder = [];
    save();
    syncSettings();
    if (S.view === 'matrix') renderMatrix();
    notify('축 순서를 자동 정렬로 초기화했습니다.');
  };

  const dragClass = (type, key, index) => [
    'col-row',
    drag?.type === type && drag?.key === key && drag.index === index ? 'dragging-col' : '',
    dragOver?.type === type && dragOver?.key === key && dragOver.index === index ? 'drag-over-col' : '',
  ].filter(Boolean).join(' ');

  const renderAxis = (title, field, orderKey, values) => (
    <>
      <div className="sec-ttl" style={{ fontSize: '.62rem' }}>{title}</div>
      <div className="col-editor">
        {values.map((value, index) => (
          <div
            className={dragClass('axis', field, index)}
            draggable
            data-val={value}
            data-field={field}
            key={value}
            onDragStart={event => {
              setDrag({ type: 'axis', field, key: field, index });
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={event => {
              event.preventDefault();
              setDragOver({ type: 'axis', key: field, index });
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={event => {
              event.preventDefault();
              dropAxis(field, orderKey, values, index);
            }}
            onDragEnd={() => {
              setDrag(null);
              setDragOver(null);
            }}
          >
            <span className="col-handle" title="드래그하여 순서 변경">⠿</span>
            <span style={{ fontSize: '.82rem', color: 'var(--text)' }}>{value}</span>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div>
      <div className="sec-ttl">리스트 컬럼</div>
      <div style={{ fontSize: '.77rem', color: 'var(--text-3)', marginBottom: '10px' }}>
        체크: 표시 여부 &nbsp;|&nbsp; ⠿ 드래그: 순서 변경
      </div>
      <div className="col-editor">
        {settings.listColumns.map((column, index) => (
          <div
            className={dragClass('column', 'list', index)}
            draggable
            data-idx={index}
            key={column.key}
            onDragStart={event => {
              setDrag({ type: 'column', key: 'list', index });
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={event => {
              event.preventDefault();
              setDragOver({ type: 'column', key: 'list', index });
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={event => {
              event.preventDefault();
              dropColumn(index);
            }}
            onDragEnd={() => {
              setDrag(null);
              setDragOver(null);
            }}
          >
            <span className="col-handle" title="드래그하여 순서 변경">⠿</span>
            <label className="tgl" style={{ gap: '6px' }}>
              <input type="checkbox" checked={column.visible} onChange={event => toggleColumn(index, event.target.checked)} />
              <span className="tgl-track" />
            </label>
            <span className="col-name">{FLABELS[column.key] || column.key}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '10px' }}>
        <button className="btn btn-s btn-sm" onClick={resetColumns}>기본값 복원</button>
      </div>

      <div className="sec-ttl" style={{ marginTop: '16px' }}>축 순서</div>
      <div style={{ fontSize: '.77rem', color: 'var(--text-3)', marginBottom: '10px' }}>
        ⠿ 드래그로 X축(그룹)·Y축(카테고리) 순서를 재정렬합니다.
      </div>
      {renderAxis('그룹 (X축)', 'group', 'groupOrder', groupAxis)}
      <div style={{ marginTop: '12px' }}>
        {renderAxis('카테고리 (Y축)', 'category', 'catOrder', categoryAxis)}
      </div>
      <div style={{ marginTop: '10px' }}>
        <button className="btn btn-s btn-sm" onClick={resetAxis}>자동 정렬 초기화</button>
      </div>
    </div>
  );
}
