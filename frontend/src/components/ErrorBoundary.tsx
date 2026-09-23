import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, one throwing component unmounts the whole tree and the visitor
 * gets a blank white page with no clue what happened.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lỗi render:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🌱</div>
        <h1 style={{ marginBottom: 8 }}>Trang này gặp lỗi</h1>
        <p style={{ color: 'var(--ink-4)', marginBottom: 20 }}>
          Đã có lỗi khi hiển thị nội dung. Vui lòng tải lại trang.
        </p>
        <pre
          style={{
            textAlign: 'left',
            maxWidth: 720,
            margin: '0 auto 20px',
            padding: 16,
            background: 'var(--cream-2)',
            border: '1px solid var(--parchment)',
            borderRadius: 'var(--r-md)',
            fontSize: '.78rem',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {error.message}
        </pre>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Tải lại trang
        </button>
      </div>
    );
  }
}
