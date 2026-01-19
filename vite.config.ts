import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import vercel from 'vite-plugin-vercel'

// CSPヘッダー設定（セキュリティ強化）
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Vite開発サーバー用
  "style-src 'self' 'unsafe-inline'", // MUI用
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.sentry.io", // Sentry用
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), vercel()],
  server: {
    port: 3247,
    strictPort: true,
    headers: {
      // CSPヘッダー
      'Content-Security-Policy': cspDirectives,
      // その他のセキュリティヘッダー
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // React関連
          'vendor-react': ['react', 'react-dom'],
          // MUI関連
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          // グラフ・データ処理
          'vendor-charts': ['recharts'],
          // Excel処理
          'vendor-xlsx': ['xlsx'],
          // 状態管理
          'vendor-zustand': ['zustand'],
          // CSV処理
          'vendor-csv': ['papaparse'],
        },
      },
    },
    chunkSizeWarningLimit: 300,
  },
})
