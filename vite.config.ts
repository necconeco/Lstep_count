import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3247,
    strictPort: true,
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
