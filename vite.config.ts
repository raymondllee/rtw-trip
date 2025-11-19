/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'web'),
  base: '/',
  server: {
    port: 5173
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
        student_dashboard: resolve(__dirname, 'web', 'student-dashboard.html')
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
