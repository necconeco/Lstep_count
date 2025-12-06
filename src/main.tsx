import React from 'react'
import ReactDOM from 'react-dom/client'
// 新設計版を使用（旧版は App.tsx として残っています）
import App from './AppV3.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
