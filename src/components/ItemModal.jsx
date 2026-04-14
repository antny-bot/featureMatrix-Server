import { useState, useEffect, useRef, useCallback } from 'react';
import { STATUS_OPTS } from '../app/constants.js';
import { getUniqSorted, parseMd } from '../utils/itemUtils.js';
import { emitUnlock, emitPreview, isSocketConnected } from '../app/socket.js';
import { useAppStore } from '../store/useAppStore.js';
import { useModals } from '../hooks/useModals.js';
import katex from 'katex';

const EMPTY_FORM = {
  key: '',
  priority: '중',
  name: '',
  desc: '',
  path: '',
  group: '',
  subGroup: '',
  category: '',
  subCategory: '',
  owner: '',
  status: '',
  relSystem: '',
  memo: '',
  mdContent: '',
  isImportant: 'N',
  isDelete: 'N',
};

export default function ItemModal() {
  const store = useAppStore();
  const { closeEditModal, saveItem, hardDelete, expSingleMd } = useModals();

  const [activeTab,      setActiveTab]      = useState('info');
  const [mdMode,         setMdMode]         = useState('edit');
  const [mdPreview,      setMdPreview]      = useState('');
  const [mdStats,        setMdStats]        = useState({ chars: '0자', lines: '0줄', words: '0단어' });
  const [title,          setTitle]          = useState('기능 추가');
  const [showHardDel,    setShowHardDel]    = useState(false);
  const [modalMode,      setModalMode]      = useState('add');
  const [form,           setForm]           = useState(EMPTY_FORM);
  
  const previewRef      = useRef(null);
  const mdFileRef       = useRef(null);
  const previewTimerRef = useRef(null);
  const formRef         = useRef(EMPTY_FORM);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const updateMdStats = useCallback(value => {
    setMdStats({
      chars: `${value.length}자`,
      lines: `${value ? value.split('\n').length : 0}줄`,
      words: `${value.trim() ? value.trim().split(/\s+/).length : 0}단어`,
    });
  }, []);

  const schedulePreview = useCallback(() => {
    if (!isSocketConnected() || !store.editKey) return;
    clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      const key  = store.editKey;
      const user = store.settings?.userName || '익명';
      const current = formRef.current;
      const preview = {
        name: current.name || '',
        priority: current.priority || '',
        status: current.status || '',
        owner: current.owner || '',
        desc: current.desc || '',
        group: current.group || '',
        subGroup: current.subGroup || '',
        category: current.category || '',
        subCategory: current.subCategory || '',
      };
      emitPreview(key, user, preview);
    }, 300);
  }, [store.editKey, store.settings?.userName]);

  const updateField = useCallback((field, value) => {
    setForm(current => {
      const next = { ...current, [field]: value };
      formRef.current = next;
      return next;
    });
    if (field === 'mdContent') {
      updateMdStats(value);
      setMdPreview(parseMd(value));
    }
    schedulePreview();
  }, [schedulePreview, updateMdStats]);

  const switchMdMode = useCallback((nextMode) => {
    const content = formRef.current.mdContent || '';
    if (nextMode !== 'edit') {
      setMdPreview(parseMd(content));
    }
    setMdMode(nextMode);
    if (nextMode === 'edit') {
      requestAnimationFrame(() => document.getElementById('fMdContent')?.focus());
    }
  }, []);

  const openMdTab = useCallback(() => {
    const content = formRef.current.mdContent || '';
    setActiveTab('md');
    setMdPreview(parseMd(content));
  }, []);

  /* KaTeX 렌더링 — mdPreview 변경 후 DOM 반영 */
  useEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.querySelectorAll('[data-math]').forEach(el => {
      try {
        el.innerHTML = katex.renderToString(el.dataset.math, {
          displayMode: !!el.dataset.disp, throwOnError: false
        });
      } catch(e) { el.textContent = el.dataset.math; }
    });
  }, [mdPreview]);

  /* 브릿지: useModals (or Legacy) → React 상태 동기화 */
  useEffect(() => {
    window.__editModalBridge = (mode, key, nextForm = {}) => {
      const mergedForm = { ...EMPTY_FORM, ...nextForm };
      setModalMode(mode);
      setTitle(mode === 'add' ? '기능 추가' : mode === 'detail' ? `기능 상세 - ${key}` : `기능 수정 - ${key}`);
      setShowHardDel(mode === 'edit');
      setActiveTab('info');
      setMdMode(mode === 'detail' ? 'preview' : 'edit');
      setForm(mergedForm);
      formRef.current = mergedForm;
      setMdPreview(parseMd(mergedForm.mdContent || ''));
      updateMdStats(mergedForm.mdContent || '');
    };

    window.__editModalSwitchEditTab = (tab) => {
      if (tab === 'md') {
        openMdTab();
      } else {
        setActiveTab(tab);
      }
      if (tab === 'md') {
        const v = formRef.current.mdContent || '';
        if (modalMode !== 'add') {
          setMdMode('preview');
          setMdPreview(parseMd(v));
        }
      }
    };
    window.__editModalSwitchMdView = mode => switchMdMode(mode);

    window.__editModalApplyMdEdit = (editor) => {
      const textarea = document.getElementById('fMdContent');
      const current = formRef.current.mdContent || '';
      const selectionStart = textarea?.selectionStart ?? current.length;
      const selectionEnd = textarea?.selectionEnd ?? current.length;
      const result = editor(current, selectionStart, selectionEnd);
      updateField('mdContent', result.value);
      requestAnimationFrame(() => {
        const nextTextarea = document.getElementById('fMdContent');
        if (!nextTextarea) return;
        nextTextarea.focus();
        nextTextarea.selectionStart = result.selectionStart;
        nextTextarea.selectionEnd = result.selectionEnd;
      });
    };

    return () => {
      delete window.__editModalBridge;
      delete window.__editModalSwitchEditTab;
      delete window.__editModalSwitchMdView;
      delete window.__editModalApplyMdEdit;
    };
  }, [modalMode, openMdTab, switchMdMode, updateField]);

  const insertMd = useCallback((before, after = '') => {
    window.__editModalApplyMdEdit?.((value, start, end) => {
      const selected = value.substring(start, end);
      const fallback = selected || '텍스트';
      return {
        value: value.substring(0, start) + before + fallback + after + value.substring(end),
        selectionStart: start + before.length,
        selectionEnd: start + before.length + fallback.length,
      };
    });
  }, []);

  const insertMdLine = useCallback((prefix) => {
    window.__editModalApplyMdEdit?.((value, start) => {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      return {
        value: value.substring(0, lineStart) + prefix + value.substring(lineStart),
        selectionStart: start + prefix.length,
        selectionEnd: start + prefix.length,
      };
    });
  }, []);

  const insertMdBlock = useCallback((block) => {
    window.__editModalApplyMdEdit?.((value, start, end) => {
      const selected = value.substring(start, end);
      const content = selected || block;
      const needsBefore = start > 0 && value[start - 1] !== '\n';
      const before = needsBefore ? '\n' : '';
      const after = value[end] && value[end] !== '\n' ? '\n' : '';
      return {
        value: value.substring(0, start) + before + content + after + value.substring(end),
        selectionStart: start + before.length,
        selectionEnd: start + before.length + content.length,
      };
    });
  }, []);

  const onImpMd = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      updateField('mdContent', ev.target.result);
      window.__sobukNotify?.('MD 파일 불러왔습니다: ' + file.name, 'success');
      setMdMode('preview');
    };
    r.readAsText(file, 'UTF-8'); e.target.value = '';
  };

  const dataLists = {
    group: getUniqSorted('group', store.items),
    subGroup: getUniqSorted('subGroup', store.items),
    category: getUniqSorted('category', store.items),
    subCategory: getUniqSorted('subCategory', store.items),
    owner: getUniqSorted('owner', store.items),
  };

  const isReadOnly = modalMode === 'detail';
  const showEditor = mdMode === 'edit' || mdMode === 'split';
  const showPreview = mdMode === 'preview' || mdMode === 'split';
  const taStyle  = { display: showEditor ? 'block' : 'none', flex: showEditor ? '1 1 0' : undefined, width: showEditor ? '100%' : undefined };
  const pvStyle  = { display: showPreview ? 'block' : 'none', flex: showPreview ? '1 1 0' : undefined, width: showPreview ? '100%' : undefined };

  return (
    <div className="ov" id="editModal">
      <div className="mbox" style={{ width: '760px', maxHeight: '92vh' }}>

      <div className="mhd" style={{ paddingBottom: 0, borderBottom: 'none' }}>
        <span className="mtitle">{title}</span>
        <button className="mclose" onClick={closeEditModal}>✕</button>
      </div>

      <div className="stab-row" style={{ padding: '0 20px' }}>
        <button className={`stab${activeTab === 'info' ? ' on' : ''}`} onClick={() => setActiveTab('info')}>📋 기본 정보</button>
        <button className={`stab${activeTab === 'md'   ? ' on' : ''}`} onClick={openMdTab}>📝 기능정의요구서</button>
      </div>

      {activeTab === 'info' ? (
        <div className="mbody" style={{ padding: '16px 20px' }}>
          <fieldset className="modal-view-fieldset" disabled={isReadOnly}>
          <div className="mg">
            <div className="field">
              <label className="lbl">Key</label>
              <input className="inp" id="fKey" value={form.key} readOnly tabIndex={-1} style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }} />
            </div>
            <div className="field">
              <label className="lbl">우선순위</label>
              <select className="sel" id="fPri" value={form.priority} onChange={event => updateField('priority', event.target.value)}>
                <option value="상">상</option><option value="중">중</option><option value="하">하</option>
              </select>
            </div>
            <div className="field s2">
              <label className="lbl">기능명 <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="inp" id="fName" value={form.name} onChange={event => updateField('name', event.target.value)} placeholder="기능명" />
            </div>
            <div className="field s2">
              <label className="lbl">설명</label>
              <textarea className="txta" id="fDesc" value={form.desc} onChange={event => updateField('desc', event.target.value)} style={{ minHeight: '105px', resize: 'vertical' }} />
            </div>
            <div className="field s2">
              <label className="lbl">메모</label>
              <textarea className="txta" id="fMemo" value={form.memo} onChange={event => updateField('memo', event.target.value)} style={{ minHeight: '105px', resize: 'vertical' }} />
            </div>
            <div className="field s2">
              <label className="lbl">경로</label>
              <input className="inp" id="fPath" value={form.path} onChange={event => updateField('path', event.target.value)} placeholder="/path/to/feature" />
            </div>
            <div className="field">
              <label className="lbl">그룹 (X축)</label>
              <input className="inp" id="fGroup" value={form.group} onChange={event => updateField('group', event.target.value)} list="dlGroup" />
              <datalist id="dlGroup">{dataLists.group.map(value => <option value={value} key={value} />)}</datalist>
            </div>
            <div className="field">
              <label className="lbl">서브그룹</label>
              <input className="inp" id="fSubGroup" value={form.subGroup} onChange={event => updateField('subGroup', event.target.value)} list="dlSubGroup" />
              <datalist id="dlSubGroup">{dataLists.subGroup.map(value => <option value={value} key={value} />)}</datalist>
            </div>
            <div className="field">
              <label className="lbl">카테고리 (Y축)</label>
              <input className="inp" id="fCat" value={form.category} onChange={event => updateField('category', event.target.value)} list="dlCat" />
              <datalist id="dlCat">{dataLists.category.map(value => <option value={value} key={value} />)}</datalist>
            </div>
            <div className="field">
              <label className="lbl">서브카테고리</label>
              <input className="inp" id="fSubCat" value={form.subCategory} onChange={event => updateField('subCategory', event.target.value)} list="dlSubCat" />
              <datalist id="dlSubCat">{dataLists.subCategory.map(value => <option value={value} key={value} />)}</datalist>
            </div>
            <div className="field">
              <label className="lbl">담당</label>
              <input className="inp" id="fOwner" value={form.owner} onChange={event => updateField('owner', event.target.value)} list="dlOwner" />
              <datalist id="dlOwner">{dataLists.owner.map(value => <option value={value} key={value} />)}</datalist>
            </div>
            <div className="field">
              <label className="lbl">진행상태</label>
              <select className="sel" id="fStatus" value={form.status} onChange={event => updateField('status', event.target.value)}>
                <option value="">—</option>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{store.settings.statusLabels?.[s] || s}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="lbl">연관 시스템</label>
              <input className="inp" id="fRel" value={form.relSystem} onChange={event => updateField('relSystem', event.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '18px', alignItems: 'center', paddingTop: '2px' }}>
              <label className="tgl"><input type="checkbox" id="fIsImp" checked={form.isImportant === 'Y'} onChange={event => updateField('isImportant', event.target.checked ? 'Y' : 'N')} /><span className="tgl-track" /><span className="tgl-lbl">★ 중요</span></label>
              <label className="tgl"><input type="checkbox" id="fIsDel" checked={form.isDelete === 'Y'} onChange={event => updateField('isDelete', event.target.checked ? 'Y' : 'N')} /><span className="tgl-track" /><span className="tgl-lbl">삭제 처리</span></label>
            </div>
          </div>
          </fieldset>
        </div>
      ) : (
        <div className="mbody" style={{ padding: '10px 16px', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: !isReadOnly ? 'flex' : 'none', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
              <button className="btn btn-g btn-sm" onClick={() => insertMd('**', '**')}><b>B</b></button>
              <button className="btn btn-g btn-sm" onClick={() => insertMd('*', '*')}><i>I</i></button>
              <button className="btn btn-g btn-sm" onClick={() => insertMd('`', '`')}>Code</button>
              <button className="btn btn-g btn-sm" onClick={() => insertMdLine('# ')}>H1</button>
              <button className="btn btn-g btn-sm" onClick={() => insertMdLine('## ')}>H2</button>
              <button className="btn btn-g btn-sm" onClick={() => insertMdLine('- ')}>List</button>
              <button className="btn btn-g btn-sm" onClick={() => insertMdLine('- [ ] ')}>Task</button>
              <button className="btn btn-g btn-sm" onClick={() => insertMdLine('> ')}>Quote</button>
              <button className="btn btn-g btn-sm" onClick={() => insertMd('[', '](https://)')}>Link</button>
              <button className="btn btn-g btn-sm" onClick={() => insertMdBlock('```\n코드\n```\n')}>Block</button>
              <button className="btn btn-g btn-sm" onClick={() => insertMdBlock('| 항목 | 내용 |\n|---|---|\n|  |  |\n')}>Table</button>
              <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
              <button className="btn btn-s btn-sm" onClick={() => mdFileRef.current?.click()}>📂 열기</button>
              <input type="file" ref={mdFileRef} accept=".md,.txt" style={{ display: 'none' }} onChange={onImpMd} />
              <button className="btn btn-s btn-sm" onClick={() => expSingleMd(form)}>⬇ 저장</button>
              <div style={{ marginLeft: 'auto', fontSize: '.69rem', color: 'var(--text-3)', display: 'flex', gap: '10px' }}>
                <span>{mdStats.chars}</span><span>{mdStats.lines}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', borderRadius: '6px', padding: '2px' }}>
                <button className={`vtab${mdMode === 'preview' ? ' on' : ''}`} onClick={() => switchMdMode('preview')}>👁 보기</button>
                <button className={`vtab${mdMode === 'edit'    ? ' on' : ''}`} onClick={() => switchMdMode('edit')}>✏ 편집</button>
                <button className={`vtab${mdMode === 'split'   ? ' on' : ''}`} onClick={() => switchMdMode('split')}>⬜ 분할</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flex: 1, minHeight: 0 }}>
            <textarea
              id="fMdContent"
              value={form.mdContent}
              readOnly={isReadOnly}
              placeholder="기능정의요구서를 Markdown으로 작성하세요."
              style={{
                ...taStyle,
                minHeight: '300px',
                fontFamily: "monospace", fontSize: '.78rem', padding: '10px 12px',
                border: '1px solid var(--border)', borderRadius: '8px',
                background: 'var(--surface-2)', color: 'var(--text)', outline: 'none',
              }}
              onChange={event => !isReadOnly && updateField('mdContent', event.target.value)}
            />
            <div
              ref={previewRef}
              className="md-viewer"
              style={{
                ...pvStyle,
                minHeight: '300px', overflowY: 'auto', padding: '10px 14px',
                border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)',
              }}
            >
              {mdPreview ? (
                <div dangerouslySetInnerHTML={{ __html: mdPreview }} />
              ) : (
                <div style={{ color: 'var(--text-3)', fontSize: '.82rem' }}>작성된 기능정의요구서가 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mfoot">
        {isReadOnly ? (
          <button className="btn btn-p btn-sm" onClick={closeEditModal}>닫기</button>
        ) : (
          <>
            {showHardDel && (
              <button className="btn btn-d btn-sm" onClick={() => hardDelete(form.key)} style={{ marginRight: 'auto' }}>완전 삭제</button>
            )}
            <button className="btn btn-g btn-sm" onClick={closeEditModal}>취소</button>
            <button className="btn btn-p btn-sm" onClick={() => saveItem(form)}>저장</button>
          </>
        )}
      </div>

      </div>
    </div>
  );
}
