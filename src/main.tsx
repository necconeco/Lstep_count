import React from 'react';
import ReactDOM from 'react-dom/client';
// 新設計版を使用（旧版は App.tsx として残っています）
import App from './AppV3.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { PasswordGate } from './components/PasswordGate.tsx';
import { initSentry } from './utils/sentry';
import { registerServiceWorker } from './utils/serviceWorker';
import './index.css';

// Sentryエラートラッキングを初期化
initSentry();

// Service Worker登録（PWA対応）
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PasswordGate>
        <App />
      </PasswordGate>
    </ErrorBoundary>
  </React.StrictMode>
);
