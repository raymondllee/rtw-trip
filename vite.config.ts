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
        summaryViewer: resolve(__dirname, 'web', 'summary-viewer.html'),
        bulkEdit: resolve(__dirname, 'web', 'bulk-edit.html'),
        curriculumTest: resolve(__dirname, 'web', 'curriculum-test.html'),
        migrationTool: resolve(__dirname, 'web', 'migration-tool.html'),
        migrationPreview: resolve(__dirname, 'web', 'migration-preview-tool.html'),
        placeIdMigration: resolve(__dirname, 'web', 'place-id-migration-tool.html'),
        placeIdMigrationStandalone: resolve(__dirname, 'web', 'place-id-migration-standalone.html'),
        runValidation: resolve(__dirname, 'web', 'run-validation.html'),
        validationStandalone: resolve(__dirname, 'web', 'validation-standalone.html')
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
