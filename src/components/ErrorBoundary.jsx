/* ══════════════════════════════════════════
   ErrorBoundary.jsx — React 에러 경계 컴포넌트

   적용 계층:
   - 최상위(App): 치명적 에러 포착 → 전체 앱 복구 UI
   - 뷰(Header/Dashboard/Matrix/Board/List): 해당 뷰만 격리
   - 모달(ItemModal/SettingsPanel): 모달 오류 격리
══════════════════════════════════════════ */

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const label = this.props.label || '컴포넌트';
    console.error(`[ErrorBoundary:${label}]`, error, info.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { level = 'view', label = '영역' } = this.props;

    /* 최상위 에러 — 앱 전체 크래시 */
    if (level === 'app') {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: '16px', padding: '32px', background: 'var(--bg)', color: 'var(--text)',
        }}>
          <div style={{ fontSize: '2rem' }}>⚠</div>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>앱을 불러오는 중 오류가 발생했습니다</div>
          <div style={{ fontSize: '.8rem', color: 'var(--text-3)', maxWidth: '400px', textAlign: 'center' }}>
            {this.state.error?.message || '알 수 없는 오류'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => this.handleReset()}
              style={{ padding: '7px 16px', borderRadius: '7px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '.82rem' }}
            >
              다시 시도
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '7px 16px', borderRadius: '7px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '.82rem' }}
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }

    /* 뷰/모달 에러 — 해당 영역만 격리 */
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '10px', padding: '24px', minHeight: '80px',
        color: 'var(--text-3)', fontSize: '.8rem', textAlign: 'center',
      }}>
        <div style={{ fontSize: '1.2rem' }}>⚠</div>
        <div>{label} 렌더링 중 오류가 발생했습니다</div>
        <button
          onClick={() => this.handleReset()}
          style={{ padding: '4px 12px', borderRadius: '6px', background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '.78rem' }}
        >
          다시 시도
        </button>
      </div>
    );
  }
}
