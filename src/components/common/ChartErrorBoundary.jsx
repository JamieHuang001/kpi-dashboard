import { Component } from 'react';

export default class ChartErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.warn('Chart rendering error caught:', error.message);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: 20, textAlign: 'center',
                    color: 'var(--color-text-secondary)',
                    background: 'var(--color-surface-alt)',
                    borderRadius: 'var(--radius)',
                    border: '1px dashed var(--color-border)',
                    fontSize: '0.85rem',
                }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⚠️</div>
                    <div style={{ fontWeight: 600 }}>圖表渲染失敗</div>
                    <div style={{ fontSize: '0.75rem', marginTop: 4, color: 'var(--color-danger)' }}>
                        {this.state.error?.message || '未知錯誤'}
                    </div>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            marginTop: 10, padding: '6px 14px', border: '1px solid var(--color-border)',
                            borderRadius: 6, background: 'var(--color-surface)', cursor: 'pointer',
                            color: 'var(--color-text)', fontSize: '0.8rem',
                        }}
                    >
                        重試
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
