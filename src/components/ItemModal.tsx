import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { STATUS_OPTS } from '../app/constants.js';
import { getUniqSorted, parseMd } from '../utils/itemUtils.js';
import { emitUnlock, emitPreview, isSocketConnected } from '../app/socket.js';
import { useAppStore } from '../store/useAppStore.js';
import { useModals } from '../hooks/useModals.js';
import katex from 'katex';

interface ItemForm {
  key: string;
  priority: string;
  name: string;
  desc: string;
  path: string;
  group: string;
  subGroup: string;
  category: string;
  subCategory: string;
  owner: string;
  status: string;
  relSystem: string;
  memo: string;
  mdContent: string;
  isImportant: 'Y' | 'N';
  isDelete: 'Y' | 'N';
}

interface MdStats {
  chars: string;
  lines: string;
  words: string;
}

interface EditorResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

const EMPTY_FORM: ItemForm = {
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
  const editKey      = useAppStore(s => s.editKey);
  const settings     = useAppStore(s => s.settings);
  const editModal    = useAppStore(s => s.editModal);
  const storeNotify  = useAppStore(s => s.notify);
  const items        = useAppStore(s => s.items);
  const { closeEditModal, saveItem, hardDelete, expSingleMd } = useModals();

  const [activeTab,      setActiveTab]      = useState<string>('info');
  const [mdMode,         setMdMode]         = useState<string>('edit');
  const [mdPreview,      setMdPreview]      = useState<string>('');
  const [mdStats,        setMdStats]        = useState<MdStats>({ chars: '0자', lines: '0줄', words: '0단어' });
  const [title,          setTitle]          = useState<string>('기능 추가');
  const [showHardDel,    setShowHardDel]    = useState<boolean>(false);
  const [modalMode,      setModalMode]      = useState<string>('add');
  const [form,           setForm]           = useState<ItemForm>(EMPTY_FORM);

  const previewRef      = useRef<HTMLDivElement>(null);
  const mdFileRef       = useRef<HTMLInputElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef         = useRef<ItemForm>(EMPTY_FORM);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const updateMdStats = useCallback((value: string) => {
    setMdStats({
      chars: `${value.length}자`,
      lines: `${value ? value.split('\n').length : 0}줄`,
      words: `${value.trim() ? value.trim().split(/\s+/).length : 0}단어`,
    });
  }, []);

  const schedulePreview = useCallback(() => {
    if (!isSocketConnected() || !editKey) return;
    clearTimeout(previewTimerRef.current ?? undefined);
    previewTimerRef.current = setTimeout(() => {
      const key  = editKey;
      const user = settings?.userName || '익명';
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
  }, [editKey, settings]);

  const updateField = useCallback((field: keyof ItemForm, value: string) => {
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

  const switchMdMode = useCallback((nextMode: string) => {
    const content = formRef.current.mdContent || '';
    if (nextMode !== 'edit') {
      setMdPreview(parseMd(content));
    }
    setMdMode(nextMode);
    if (nextMode === 'edit') {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, []);

  const openMdTab = useCallback(() => {
    const content = formRef.current.mdContent || '';
    setActiveTab('md');
    setMdPreview(parseMd(content));
    setMdMode(content.trim() ? 'preview' : 'edit');
  }, []);

  /* KaTeX 렌더링 — paint 이전 실행으로 dangerouslySetInnerHTML 업데이트와 타이밍 충돌 방지 */
  useLayoutEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.querySelectorAll<HTMLElement>('[data-math]').forEach(el => {
      try {
        el.innerHTML = katex.renderToString(el.dataset['math'] ?? '', {
          displayMode: el.dataset['disp'] !== undefined,
          throwOnError: false,
        });
      } catch {
        el.textContent = el.dataset['math'] ?? '';
      }
    });
  }, [mdPreview]);

  /* 전역 스토어 상태 동기화 */
  useEffect(() => {
    const { visible, mode, key, item, activeTab, mdMode } = editModal;
    if (!visible) return;

    const mergedForm: ItemForm = { ...EMPTY_FORM, ...(item || {}) } as ItemForm;
    setModalMode(mode);
    setTitle(mode === 'add' ? '기능 추가' : mode === 'detail' ? `기능 상세 - ${key}` : `기능 수정 - ${key}`);
    setShowHardDel(mode === 'edit');
    setActiveTab(activeTab || 'info');
    setMdMode(mdMode || (mode === 'detail' ? 'preview' : 'edit'));
    setForm(mergedForm);
    formRef.current = mergedForm;
    setMdPreview(parseMd(mergedForm.mdContent || ''));
    updateMdStats(mergedForm.mdContent || '');
  }, [editModal]);

  const applyMdEdit = useCallback((editor: (value: string, start: number, end: number) => EditorResult) => {
    const textarea = textareaRef.current;
    const current = formRef.current.mdContent || '';
    const selectionStart = textarea?.selectionStart ?? current.length;
    const selectionEnd = textarea?.selectionEnd ?? current.length;
    const result = editor(current, selectionStart, selectionEnd);
    updateField('mdContent', result.value);
    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }, [updateField]);

  const insertMd = useCallback((before: string, after = '') => {
    applyMdEdit((value, start, end) => {
      const selected = value.substring(start, end);
      const fallback = selected || '텍스트';
      return {
        value: value.substring(0, start) + before + fallback + after + value.substring(end),
        selectionStart: start + before.length,
        selectionEnd: start + before.length + fallback.length,
      };
    });
  }, [applyMdEdit]);

  const insertMdLine = useCallback((prefix: string) => {
    applyMdEdit((value, start) => {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      return {
        value: value.substring(0, lineStart) + prefix + value.substring(lineStart),
        selectionStart: start + prefix.length,
        selectionEnd: start + prefix.length,
      };
    });
  }, [applyMdEdit]);

  const insertMdBlock = useCallback((block: string) => {
    applyMdEdit((value, start, end) => {
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
  }, [applyMdEdit]);

  const onImpMd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      updateField('mdContent', (ev.target as FileReader).result as string);
      storeNotify('MD 파일 불러왔습니다: ' + file.name, 'success');
      setMdMode('preview');
    };
    r.readAsText(file, 'UTF-8'); e.target.value = '';
  };

  const dataLists = {
    group: getUniqSorted('group', items),
    subGroup: getUniqSorted('subGroup', items),
    category: getUniqSorted('category', items),
    subCategory: getUniqSorted('subCategory', items),
    owner: getUniqSorted('owner', items),
  };

  const isReadOnly = modalMode === 'detail';
  const showEditor = mdMode === 'edit' || mdMode === 'split';
  const showPreview = mdMode === 'preview' || mdMode === 'split';
  const taStyle: React.CSSProperties = { display: showEditor ? 'block' : 'none', flex: showEditor ? '1 1 0' : undefined, width: showEditor ? '100%' : undefined };
  const pvStyle: React.CSSProperties = { display: showPreview ? 'block' : 'none', flex: showPreview ? '1 1 0' : undefined, width: showPreview ? '100%' : undefined };

  if (!editModal.visible) return null;

  return (
    <div className="ov on" id="editModal">
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
              <select className="sel" id="fPri" value={form.priority} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateField('priority', e.target.value)}>
                <option value="상">상</option><option value="중">중</option><option value="하">하</option>
              </select>
            </div>
            <div className="field s2">
              <label className="lbl">기능명 <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="inp" id="fName" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('name', e.target.value)} placeholder="기능명" />
            </div>
            <div className="field s2">
              <label className="lbl">설명</label>
              <textarea className="txta" id="fDesc" value={form.desc} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('desc', e.target.value)} style={{ minHeight: '105px', resize: 'vertical' }} />
            </div>
            <div className="field s2">
              <label className="lbl">메모</label>
              <textarea className="txta" id="fMemo" value={form.memo} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('memo', e.target.value)} style={{ minHeight: '105px', resize: 'vertical' }} />
            </div>
            <div className="field s2">
              <label className="lbl">경로</label>
              <input className="inp" id="fPath" value={form.path} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('path', e.target.value)} placeholder="/path/to/feature" />
            </div>
            <div className="field">
              <label className="lbl">그룹 (X축)</label>
              <input className="inp" id="fGroup" value={form.group} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('group', e.target.value)} list="dlGroup" />
              <datalist id="dlGroup">{dataLists.group.map(value => <option value={value} key={value} />)}</datalist>
            </div>
            <div className="field">
              <label className="lbl">서브그룹</label>
              <input className="inp" id="fSubGroup" value={form.subGroup} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('subGroup', e.target.value)} list="dlSubGroup" />
              <datalist id="dlSubGroup">{dataLists.subGroup.map(value => <option value={value} key={value} />)}</datalist>
            </div>
            <div className="field">
              <label className="lbl">카테고리 (Y축)</label>
              <input className="inp" id="fCat" value={form.category} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('category', e.target.value)} list="dlCat" />
              <datalist id="dlCat">{dataLists.category.map(value => <option value={value} key={value} />)}</datalist>
            </div>
            <div className="field">
              <label className="lbl">서브카테고리</label>
              <input className="inp" id="fSubCat" value={form.subCategory} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('subCategory', e.target.value)} list="dlSubCat" />
              <datalist id="dlSubCat">{dataLists.subCategory.map(value => <option value={value} key={value} />)}</datalist>
            </div>
            <div className="field">
              <label className="lbl">담당</label>
              <input className="inp" id="fOwner" value={form.owner} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('owner', e.target.value)} list="dlOwner" />
              <datalist id="dlOwner">{dataLists.owner.map(value => <option value={value} key={value} />)}</datalist>
            </div>
            <div className="field">
              <label className="lbl">진행상태</label>
              <select className="sel" id="fStatus" value={form.status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateField('status', e.target.value)}>
                <option value="">—</option>
                {(STATUS_OPTS as string[]).map(s => <option key={s} value={s}>{settings.statusLabels?.[s] || s}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="lbl">연관 시스템</label>
              <input className="inp" id="fRel" value={form.relSystem} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('relSystem', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '18px', alignItems: 'center', paddingTop: '2px' }}>
              <label className="tgl"><input type="checkbox" id="fIsImp" checked={form.isImportant === 'Y'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('isImportant', e.target.checked ? 'Y' : 'N')} /><span className="tgl-track" /><span className="tgl-lbl">★ 중요</span></label>
              <label className="tgl"><input type="checkbox" id="fIsDel" checked={form.isDelete === 'Y'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('isDelete', e.target.checked ? 'Y' : 'N')} /><span className="tgl-track" /><span className="tgl-lbl">삭제 처리</span></label>
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
              ref={textareaRef}
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
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => !isReadOnly && updateField('mdContent', e.target.value)}
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
