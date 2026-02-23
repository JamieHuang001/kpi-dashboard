import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './hooks/useTheme'
import App from './App.jsx'
import './styles/index.css'

class GlobalErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, info: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { this.setState({ info }); console.error(error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, margin: 20, background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 8, color: '#7f1d1d', overflow: 'auto' }}>
          <h2>🚨 系統發生崩潰 (白屏防護)</h2>
          <p>請截圖此畫面給開發者，幫助我們快速修復：</p>
          <pre style={{ background: '#fff', padding: 10, borderRadius: 4, border: '1px solid #fca5a5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error?.toString()}
            {"\n\n=== STACK TRACE ===\n"}
            {this.state.error?.stack}
            {"\n\n=== COMPONENT TRACE ===\n"}
            {this.state.info?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <GlobalErrorBoundary>
        <App />
      </GlobalErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
)
