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
        <div className="error-boundary">
          <h2 className="error-boundary__title">应用出现异常</h2>
          <p className="error-boundary__message">
            {this.state.error?.message || '未知错误，请尝试重启应用'}
          </p>
          <button
            type="button"
            className="btn-filled error-boundary__retry"
            onClick={this.handleReset}
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
