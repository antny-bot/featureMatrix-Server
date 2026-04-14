/* ══════════════════════════════════════════
   ItemModal.jsx — 기능 추가/편집 모달 React 컴포넌트

   전략:
   - #editModal .ov 컨테이너에 createPortal
   - 열기/닫기: 기존 openModal/closeModal (DOM classList) 그대로 유지
   - React 관리: title, showHardDel, activeTab, mdMode, mdPreview, mdStats, form
   - 브릿지: window.__editModalBridge (열림 알림)
             window.switchEditTab, window.switchMdView (탭/뷰 전환)
             window.onMdInput, window.syncMdPreview, window.updateMdStat (MD 상태)
   - 폼 입력은 controlled, modal.js는 form bridge로 읽고 씀
══════════════════════════════════════════ */

import { createPortal } from 'react-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { parseMd } from '../app/modal.js';
import { STATUS_OPTS } from '../app/constants.js';
import { getUniqSorted } from '../app/render.js';
import { emitUnlock, emitPreview, isSocketConnected } from '../app/socket.js';
import { getStore, useAppStore } from '../store/useAppStore.js';

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
  const [container,      setContainer]      = useState(null);
  const [activeTab,      setActiveTab]      = useState('info');
  const [mdMode,         setMdMode]         = useState('edit');
  const [mdPreview,      setMdPreview]      = useState('');
  const [mdStats,        setMdStats]        = useState({ chars: '0자', lines: '0줄', words: '0단어' });
  const [title,          setTitle]          = useState('기능 추가');
  const [showHardDel,    setShowHardDel]    = useState(false);
  const [modalMode,      setModalMode]      = useState('add');
  const [form,           setForm]           = useState(EMPTY_FORM);
  const items = useAppStore(s => s.items);
  const previewRef      = useRef(null);
  const mdFileRef       = useRef(null);
  const currentKeyRef   = useRef(null);   // 현재 편집 중인 item key
  const previewTimerRef = useRef(null);   // 미리보기 디바운스 타이머
  const formRef         = useRef(EMPTY_FORM);
  const modalModeRef    = useRef('add');

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

  /* 편집 미리보기 전송 (300ms 디바운스) */
  const schedulePreview = useCallback(() => {
    if (!isSocketConnected() || !currentKeyRef.current) return;
    clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      const key  = currentKeyRef.current;
      const user = getStore().settings?.userName || '익명';
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
  }, []);

  const detachInputListeners = useCallback(() => {
    clearTimeout(previewTimerRef.current);
  }, []);

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

  useEffect(() => {
    setContainer(document.getElementById('editModal'));
  }, []);

  /* KaTeX 렌더링 — mdPreview 변경 후 DOM 반영 */
  useEffect(() => {
    if (!previewRef.current || !window.katex) return;
    // LEGACY-DOM: KaTeX 렌더는 DOM 주입이 필요.
    previewRef.current.querySelectorAll('[data-math]').forEach(el => {
      try {
        el.innerHTML = window.katex.renderToString(el.dataset.math, {
          displayMode: !!el.dataset.disp, throwOnError: false
        });
      } catch(e) { el.textContent = el.dataset.math; }
    });
  }, [mdPreview]);

  /* 브릿지: modal.js → React 상태 동기화 */
  useEffect(() => {
    /* 모달 열림 알림: title/showHardDel/탭/뷰 초기화 + Lock 획득 */
    window.__editModalBridge = (mode, key, nextForm = {}) => {
      const mergedForm = { ...EMPTY_FORM, ...nextForm };
      modalModeRef.current = mode;
      setModalMode(mode);
      setTitle(mode === 'add' ? '기능 추가' : mode === 'detail' ? `기능 상세 - ${key}` : `기능 수정 - ${key}`);
      setShowHardDel(mode === 'edit');
      setActiveTab('info');
      setMdMode(mode === 'detail' ? 'preview' : 'edit');
      setForm(mergedForm);
      formRef.current = mergedForm;
      setMdPreview(parseMd(mergedForm.mdContent || ''));
      updateMdStats(mergedForm.mdContent || '');
      // WebSocket Lock 획득 (편집 모드일 때만)
      if (mode === 'edit' && key) {
        currentKeyRef.current = key;
      } else {
        currentKeyRef.current = null;
      }
    };

    const interval = setInterval(() => {
      if (!window.__modalState?.editModal && currentKeyRef.current) {
        const key  = currentKeyRef.current;
        const user = getStore().settings?.userName || '익명';
        emitUnlock(key, user);
        currentKeyRef.current = null;
        detachInputListeners();
      }
    }, 250);

    /* 탭 전환: info / md */
    window.__editModalSwitchEditTab = (tab) => {
      setActiveTab(tab);
      if (tab === 'md') {
        updateMdStats(formRef.current.mdContent || '');
        if (modalModeRef.current !== 'add') {
          setMdMode('preview');
          setMdPreview(parseMd(formRef.current.mdContent || ''));
        }
      }
    };

    /* MD 뷰 전환: edit / preview / split */
    window.__editModalSwitchMdView = (mode) => {
      if (modalModeRef.current === 'detail' && mode !== 'preview') {
        setMdMode('preview');
        setMdPreview(parseMd(formRef.current.mdContent || ''));
        return;
      }
      setMdMode(mode);
      if (mode !== 'edit') {
        setMdPreview(parseMd(formRef.current.mdContent || ''));
      }
    };

    /* MD 입력 이벤트: 통계 + 프리뷰 갱신 */
    window.__editModalOnMdInput = () => {
      const v = formRef.current.mdContent || '';
      updateMdStats(v);
      setMdPreview(parseMd(v));
    };

    window.__editModalSyncMdPreview = () => {
      setMdPreview(parseMd(formRef.current.mdContent || ''));
    };

    window.__editModalUpdateMdStat = () => {
      updateMdStats(formRef.current.mdContent || '');
    };

    window.__editModalGetForm = () => ({ ...formRef.current });

    window.__editModalSetMdContent = (value) => {
      updateField('mdContent', value || '');
    };

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
      clearInterval(interval);
      detachInputListeners();
      delete window.__editModalBridge;
      delete window.__editModalSwitchEditTab;
      delete window.__editModalSwitchMdView;
      delete window.__editModalOnMdInput;
      delete window.__editModalSyncMdPreview;
      delete window.__editModalUpdateMdStat;
      delete window.__editModalGetForm;
      delete window.__editModalSetMdContent;
      delete window.__editModalApplyMdEdit;
    };
  }, [detachInputListeners, updateField, updateMdStats]);

  if (!container) return null;

  const dataLists = {
    group: getUniqSorted('group', items),
    subGroup: getUniqSorted('subGroup', items),
    category: getUniqSorted('category', items),
    subCategory: getUniqSorted('subCategory', items),
    owner: getUniqSorted('owner', items),
  };

  const infoVisible = activeTab === 'info';
  const isReadOnly = modalMode === 'detail';
  const canEditMd = !isReadOnly;
  const taStyle  = { display: mdMode === 'preview' ? 'none' : '', flex: mdMode !== 'preview' ? '1' : '' };
  const pvStyle  = { display: mdMode === 'edit'    ? 'none' : '', flex: mdMode !== 'edit'    ? '1' : '' };

  return createPortal(
    <div className="mbox" style={{ width: '760px', maxHeight: '92vh' }}>

      {/* 헤더 */}
      <div className="mhd" style={{ paddingBottom: 0, borderBottom: 'none' }}>
        <span className="mtitle">{title}</span>
        <button className="mclose" onClick={() => window.closeModal?.('editModal')}>✕</button>
      </div>

      {/* 탭 버튼 */}
      <div className="stab-row" style={{ padding: '0 20px' }}>
        <button className={`stab${activeTab === 'info' ? ' on' : ''}`} onClick={() => window.__editModalSwitchEditTab?.('info')}>📋 기본 정보</button>
        <button className={`stab${activeTab === 'md'   ? ' on' : ''}`} onClick={() => window.__editModalSwitchEditTab?.('md')}>📝 기능정의요구서</button>
      </div>

      {/* ── 기본 정보 탭 ── */}
      <div className="mbody" style={{ padding: '16px 20px', display: infoVisible ? '' : 'none' }}>
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
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
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

      {/* ── 마크다운 탭 ── */}
      <div className="mbody" style={{ display: !infoVisible ? 'flex' : 'none', padding: '10px 16px', flexDirection: 'column', gap: '8px' }}>

        {/* MD 툴바 */}
        <div style={{ display: canEditMd ? 'flex' : 'none', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
          {/* 1행: 서식 + 구조 + 수식 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsert?.('**','**')}         title="굵게" style={{ width: '26px', padding: 0 }}><b>B</b></button>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsert?.('*','*')}           title="기울임" style={{ width: '26px', padding: 0 }}><i>I</i></button>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsert?.('~~','~~')}         title="취소선" style={{ width: '26px', padding: 0 }}><s style={{ fontSize: '.75rem' }}>S</s></button>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsert?.('[','](url)')}      title="링크" style={{ width: '26px', padding: 0 }}>🔗</button>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsert?.('`','`')}           title="인라인 코드" style={{ width: '26px', padding: 0, fontFamily: 'monospace', fontSize: '.7rem' }}>`</button>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsert?.('```\n','\n```')}   title="코드 블록" style={{ width: '26px', padding: 0 }}>⬛</button>
            </div>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: '2px' }}>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsertLine?.('# ')}   title="H1" style={{ width: '26px', padding: 0, fontSize: '.7rem', fontWeight: 700 }}>H1</button>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsertLine?.('## ')}  title="H2" style={{ width: '26px', padding: 0, fontSize: '.7rem', fontWeight: 700 }}>H2</button>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsertLine?.('### ')} title="H3" style={{ width: '26px', padding: 0, fontSize: '.7rem', fontWeight: 700 }}>H3</button>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsertLine?.('- ')}   title="글머리 목록" style={{ width: '26px', padding: 0 }}>•</button>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsertLine?.('1. ')}  title="순서 목록" style={{ width: '26px', padding: 0, fontSize: '.7rem' }}>1.</button>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsertLine?.('> ')}   title="인용" style={{ width: '26px', padding: 0 }}>❝</button>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsert?.('\n---\n','')} title="수평선" style={{ width: '26px', padding: 0, fontSize: '.8rem' }}>—</button>
            </div>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: '2px' }}>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsert?.('$','$')}        title="인라인 수식" style={{ width: '26px', padding: 0 }}>∑</button>
              <button className="btn btn-g btn-sm" onClick={() => window.mdInsert?.('$$\n','\n$$')} title="블록 수식"   style={{ width: '26px', padding: 0 }}>∫</button>
            </div>
          </div>
          {/* 2행: 뷰 전환 + 파일 + 통계 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', borderRadius: '6px', padding: '2px' }}>
              <button className={`vtab${mdMode === 'preview' ? ' on' : ''}`} onClick={() => window.__editModalSwitchMdView?.('preview')} style={{ height: '22px', padding: '0 9px', fontSize: '.7rem' }}>👁 보기</button>
              <button className={`vtab${mdMode === 'edit'    ? ' on' : ''}`} onClick={() => window.__editModalSwitchMdView?.('edit')}    style={{ height: '22px', padding: '0 9px', fontSize: '.7rem' }}>✏ 편집</button>
              <button className={`vtab${mdMode === 'split'   ? ' on' : ''}`} onClick={() => window.__editModalSwitchMdView?.('split')}   style={{ height: '22px', padding: '0 9px', fontSize: '.7rem' }}>⬜ 분할</button>
            </div>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)', flexShrink: 0 }} />
            <button className="btn btn-s btn-sm" onClick={() => mdFileRef.current?.click()} style={{ gap: '4px' }}>📂 열기</button>
            <input type="file" id="mdFileInp" ref={mdFileRef} accept=".md,.txt" style={{ display: 'none' }} onChange={(e) => window.impSingleMd?.(e)} />
            <button className="btn btn-s btn-sm" onClick={() => window.expSingleMd?.()} style={{ gap: '4px' }}>⬇ 저장</button>
            <div style={{ marginLeft: 'auto', fontSize: '.69rem', color: 'var(--text-3)', display: 'flex', gap: '10px' }}>
              <span>{mdStats.chars}</span><span>{mdStats.lines}</span><span>{mdStats.words}</span>
            </div>
          </div>
        </div>

        {/* 에디터 / 프리뷰 */}
        <div style={{ display: 'flex', gap: '8px', flex: 1, minHeight: 0 }}>
          <textarea
            id="fMdContent"
            value={form.mdContent}
            readOnly={!canEditMd}
            style={{
              ...taStyle,
              minHeight: '300px',
              fontFamily: "'SFMono-Regular',Consolas,monospace",
              fontSize: '.78rem', lineHeight: '1.7', resize: 'vertical',
              padding: '10px 12px',
              border: '1px solid var(--border)', borderRadius: '8px',
              background: 'var(--surface-2)', color: 'var(--text)', outline: 'none',
            }}
            placeholder={"# 기능 제목\n\n## 개요\n마크다운으로 작성\n\n| 컬럼1 | 컬럼2 |\n|-------|-------|\n| 값1   | 값2   |\n\n수식: $E=mc^2$"}
            onChange={event => canEditMd && updateField('mdContent', event.target.value)}
          />
          <div
            ref={previewRef}
            className="md-viewer"
            style={{
              ...pvStyle,
              minHeight: '300px', overflowY: 'auto',
              padding: '10px 14px',
              border: '1px solid var(--border)', borderRadius: '8px',
              background: 'var(--surface)',
            }}
            dangerouslySetInnerHTML={{ __html: mdPreview }}
          />
        </div>
      </div>

      {/* 푸터 */}
      <div className="mfoot">
        {isReadOnly ? (
          <button className="btn btn-p btn-sm" onClick={() => window.closeModal?.('editModal')}>닫기</button>
        ) : (
          <>
        {showHardDel && (
          <button className="btn btn-d btn-sm" onClick={() => window.hardDelete?.()} style={{ marginRight: 'auto' }}>완전 삭제</button>
        )}
        <button className="btn btn-g btn-sm" onClick={() => window.closeModal?.('editModal')}>취소</button>
        <button className="btn btn-p btn-sm" onClick={() => window.saveItem?.()}>저장</button>
          </>
        )}
      </div>

    </div>,
    container
  );
}
