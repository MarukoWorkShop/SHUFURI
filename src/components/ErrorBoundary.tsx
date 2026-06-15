import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 全局错误边界 — 捕获 React 渲染树中的未处理异常
 * 防止单个组件崩溃导致整个 App 白屏
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '24px',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          color: 'var(--ui-fg, #333)',
          background: 'var(--ui-bg, #fff)',
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
            应用出现异常
          </h2>
          <p style={{ fontSize: 14, color: 'var(--ui-fg-secondary, #666)', marginBottom: 20, maxWidth: 320 }}>
            {this.state.error?.message || '未知错误，请尝试重启应用'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 28px',
              border: 'none',
              borderRadius: 8,
              background: 'var(--ui-fg-primary, #1a1a1a)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
