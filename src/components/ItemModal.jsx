/* ══════════════════════════════════════════
   ItemModal.jsx — 기능 추가/편집 모달 React 컴포넌트

   전략:
   - #editModal .ov 컨테이너에 createPortal
   - 열기/닫기: 기존 openModal/closeModal (DOM classList) 그대로 유지
   - React 관리: title, showHardDel, activeTab, mdMode, mdPreview, mdStats
   - 브릿지: window.__editModalBridge (열림 알림)
             window.switchEditTab, window.switchMdView (탭/뷰 전환)
             window.onMdInput, window.syncMdPreview, window.updateMdStat (MD 상태)
   - 폼 입력은 uncontrolled (id 유지) → modal.js saveItem()이 DOM으로 직접 읽음
══════════════════════════════════════════ */

import { createPortal } from 'react-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { parseMd } from '../app/modal.js';
import { STATUS_OPTS } from '../app/constants.js';
import { emitLock, emitUnlock, emitPreview, isSocketConnected } from '../app/socket.js';
import { getStore } from '../store/useAppStore.js';

export default function ItemModal() {
  const [container,      setContainer]      = useState(null);
  const [activeTab,      setActiveTab]      = useState('info');
  const [mdMode,         setMdMode]         = useState('edit');
  const [mdPreview,      setMdPreview]      = useState('');
  const [mdStats,        setMdStats]        = useState({ chars: '0자', lines: '0줄', words: '0단어' });
  const [title,          setTitle]          = useState('기능 추가');
  const [showHardDel,    setShowHardDel]    = useState(false);
  const previewRef      = useRef(null);
  const currentKeyRef   = useRef(null);   // 현재 편집 중인 item key
  const previewTimerRef = useRef(null);   // 미리보기 디바운스 타이머
  const inputListeners  = useRef([]);     // attach된 input 리스너 정리용

  /* 편집 미리보기 전송 (300ms 디바운스) */
  const schedulePreview = useCallback(() => {
    if (!isSocketConnected() || !currentKeyRef.current) return;
    clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      const key  = currentKeyRef.current;
      const user = getStore().settings?.userName || '익명';
      const preview = {
        name:     document.getElementById('fName')?.value     || '',
        priority: document.getElementById('fPriority')?.value || '',
        status:   document.getElementById('fStatus')?.value   || '',
        owner:    document.getElementById('fOwner')?.value    || '',
        desc:     document.getElementById('fDesc')?.value     || '',
      };
      emitPreview(key, user, preview);
    }, 300);
  }, []);

  /* 모달 내 입력 필드에 리스너 attach */
  const attachInputListeners = useCallback(() => {
    const ids = ['fName', 'fPriority', 'fStatus', 'fOwner', 'fDesc', 'fMdContent'];
    inputListeners.current.forEach(({ el, fn }) => el.removeEventListener('input', fn));
    inputListeners.current = [];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', schedulePreview);
        inputListeners.current.push({ el, fn: schedulePreview });
      }
    });
  }, [schedulePreview]);

  /* 입력 리스너 정리 */
  const detachInputListeners = useCallback(() => {
    inputListeners.current.forEach(({ el, fn }) => el.removeEventListener('input', fn));
    inputListeners.current = [];
    clearTimeout(previewTimerRef.current);
  }, []);

  useEffect(() => {
    setContainer(document.getElementById('editModal'));
  }, []);

  /* KaTeX 렌더링 — mdPreview 변경 후 DOM 반영 */
  useEffect(() => {
    if (!previewRef.current || !window.katex) return;
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
    window.__editModalBridge = (mode, key) => {
      setTitle(mode === 'add' ? '기능 추가' : `기능 수정 — ${key}`);
      setShowHardDel(mode === 'edit');
      setActiveTab('info');
      setMdMode('edit');
      setMdPreview('');
      setMdStats({ chars: '0자', lines: '0줄', words: '0단어' });
      // WebSocket Lock 획득 (편집 모드일 때만)
      if (mode === 'edit' && key) {
        currentKeyRef.current = key;
        const user = getStore().settings?.userName || '익명';
        emitLock(key, user);
        // 입력 리스너 약간 지연 후 attach (DOM 렌더 완료 후)
        setTimeout(attachInputListeners, 100);
      }
    };

    /* 모달 닫힘 감지: #editModal 클래스 변화 관찰 → emitUnlock */
    const modalEl = document.getElementById('editModal');
    let observer = null;
    if (modalEl) {
      observer = new MutationObserver(() => {
        if (!modalEl.classList.contains('on') && currentKeyRef.current) {
          const key  = currentKeyRef.current;
          const user = getStore().settings?.userName || '익명';
          emitUnlock(key, user);
          currentKeyRef.current = null;
          detachInputListeners();
        }
      });
      observer.observe(modalEl, { attributes: true, attributeFilter: ['class'] });
    }

    /* 탭 전환: info / md */
    window.switchEditTab = (tab) => {
      setActiveTab(tab);
      if (tab === 'md') {
        const ta = document.getElementById('fMdContent');
        if (!ta) return;
        const v = ta.value;
        setMdStats({
          chars: `${v.length}자`,
          lines: `${v ? v.split('\n').length : 0}줄`,
          words: `${v.trim() ? v.trim().split(/\s+/).length : 0}단어`,
        });
      }
    };

    /* MD 뷰 전환: edit / preview / split */
    window.switchMdView = (mode) => {
      setMdMode(mode);
      if (mode !== 'edit') {
        const ta = document.getElementById('fMdContent');
        if (ta) setMdPreview(parseMd(ta.value));
      }
    };

    /* MD 입력 이벤트: 통계 + 프리뷰 갱신 */
    window.onMdInput = () => {
      const ta = document.getElementById('fMdContent');
      if (!ta) return;
      const v = ta.value;
      setMdStats({
        chars: `${v.length}자`,
        lines: `${v ? v.split('\n').length : 0}줄`,
        words: `${v.trim() ? v.trim().split(/\s+/).length : 0}단어`,
      });
      setMdPreview(parseMd(v));
    };

    window.syncMdPreview = () => {
      const ta = document.getElementById('fMdContent');
      if (ta) setMdPreview(parseMd(ta.value));
    };

    window.updateMdStat = () => {
      const ta = document.getElementById('fMdContent');
      if (!ta) return;
      const v = ta.value;
      setMdStats({
        chars: `${v.length}자`,
        lines: `${v ? v.split('\n').length : 0}줄`,
        words: `${v.trim() ? v.trim().split(/\s+/).length : 0}단어`,
      });
    };

    return () => {
      observer?.disconnect();
      detachInputListeners();
      delete window.__editModalBridge;
      delete window.switchEditTab;
      delete window.switchMdView;
      delete window.onMdInput;
      delete window.syncMdPreview;
      delete window.updateMdStat;
    };
  }, [attachInputListeners, detachInputListeners]);

  if (!container) return null;

  const infoVisible = activeTab === 'info';
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
        <button className={`stab${activeTab === 'info' ? ' on' : ''}`} onClick={() => window.switchEditTab?.('info')}>📋 기본 정보</button>
        <button className={`stab${activeTab === 'md'   ? ' on' : ''}`} onClick={() => window.switchEditTab?.('md')}>📝 기능정의요구서</button>
      </div>

      {/* ── 기본 정보 탭 ── */}
      <div className="mbody" style={{ padding: '16px 20px', display: infoVisible ? '' : 'none' }}>
        <div className="mg">
          <div className="field">
            <label className="lbl">Key</label>
            <input className="inp" id="fKey" readOnly tabIndex={-1} style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }} />
          </div>
          <div className="field">
            <label className="lbl">우선순위</label>
            <select className="sel" id="fPri">
              <option value="상">상</option><option value="중">중</option><option value="하">하</option>
            </select>
          </div>
          <div className="field s2">
            <label className="lbl">기능명 <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input className="inp" id="fName" placeholder="기능명" />
          </div>
          <div className="field s2">
            <label className="lbl">설명</label>
            <textarea className="txta" id="fDesc" style={{ minHeight: '105px', resize: 'vertical' }} />
          </div>
          <div className="field s2">
            <label className="lbl">메모</label>
            <textarea className="txta" id="fMemo" style={{ minHeight: '105px', resize: 'vertical' }} />
          </div>
          <div className="field s2">
            <label className="lbl">경로</label>
            <input className="inp" id="fPath" placeholder="/path/to/feature" />
          </div>
          <div className="field">
            <label className="lbl">그룹 (X축)</label>
            <input className="inp" id="fGroup" list="dlGroup" /><datalist id="dlGroup" />
          </div>
          <div className="field">
            <label className="lbl">서브그룹</label>
            <input className="inp" id="fSubGroup" list="dlSubGroup" /><datalist id="dlSubGroup" />
          </div>
          <div className="field">
            <label className="lbl">카테고리 (Y축)</label>
            <input className="inp" id="fCat" list="dlCat" /><datalist id="dlCat" />
          </div>
          <div className="field">
            <label className="lbl">서브카테고리</label>
            <input className="inp" id="fSubCat" list="dlSubCat" /><datalist id="dlSubCat" />
          </div>
          <div className="field">
            <label className="lbl">담당</label>
            <input className="inp" id="fOwner" list="dlOwner" /><datalist id="dlOwner" />
          </div>
          <div className="field">
            <label className="lbl">진행상태</label>
            <select className="sel" id="fStatus">
              <option value="">—</option>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="lbl">연관 시스템</label>
            <input className="inp" id="fRel" />
          </div>
          <div style={{ display: 'flex', gap: '18px', alignItems: 'center', paddingTop: '2px' }}>
            <label className="tgl"><input type="checkbox" id="fIsImp" /><span className="tgl-track" /><span className="tgl-lbl">★ 중요</span></label>
            <label className="tgl"><input type="checkbox" id="fIsDel" /><span className="tgl-track" /><span className="tgl-lbl">삭제 처리</span></label>
          </div>
        </div>
      </div>

      {/* ── 마크다운 탭 ── */}
      <div className="mbody" style={{ display: !infoVisible ? 'flex' : 'none', padding: '10px 16px', flexDirection: 'column', gap: '8px' }}>

        {/* MD 툴바 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
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
              <button className={`vtab${mdMode === 'preview' ? ' on' : ''}`} onClick={() => window.switchMdView?.('preview')} style={{ height: '22px', padding: '0 9px', fontSize: '.7rem' }}>👁 보기</button>
              <button className={`vtab${mdMode === 'edit'    ? ' on' : ''}`} onClick={() => window.switchMdView?.('edit')}    style={{ height: '22px', padding: '0 9px', fontSize: '.7rem' }}>✏ 편집</button>
              <button className={`vtab${mdMode === 'split'   ? ' on' : ''}`} onClick={() => window.switchMdView?.('split')}   style={{ height: '22px', padding: '0 9px', fontSize: '.7rem' }}>⬜ 분할</button>
            </div>
            <div style={{ width: '1px', height: '16px', background: 'var(--border)', flexShrink: 0 }} />
            <button className="btn btn-s btn-sm" onClick={() => document.getElementById('mdFileInp')?.click()} style={{ gap: '4px' }}>📂 열기</button>
            <input type="file" id="mdFileInp" accept=".md,.txt" style={{ display: 'none' }} onChange={(e) => window.impSingleMd?.(e)} />
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
            onInput={() => window.onMdInput?.()}
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
        {showHardDel && (
          <button className="btn btn-d btn-sm" onClick={() => window.hardDelete?.()} style={{ marginRight: 'auto' }}>완전 삭제</button>
        )}
        <button className="btn btn-g btn-sm" onClick={() => window.closeModal?.('editModal')}>취소</button>
        <button className="btn btn-p btn-sm" onClick={() => window.saveItem?.()}>저장</button>
      </div>

    </div>,
    container
  );
}
