/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'web'),
  base: '/',
  server: {
    port: parseInt(process.env.VITE_PORT || '5173'),
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:5001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: resolve(__dirname, 'web', 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'web', 'index.html'),
        summary: resolve(__dirname, 'web', 'summary-viewer.html'),
        costManager: resolve(__dirname, 'web', 'cost-manager.html'),
        bulkEdit: resolve(__dirname, 'web', 'bulk-edit.html'),
        education: resolve(__dirname, 'web', 'education-dashboard.html'),
        student_dashboard: resolve(__dirname, 'web', 'student-dashboard.html'),
        wellness: resolve(__dirname, 'web', 'wellness-dashboard.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'web', 'src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: resolve(__dirname, 'web', 'tests', 'setup.ts')
  }
});
