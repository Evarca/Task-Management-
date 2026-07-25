import { defineConfig } from 'vite';

export default defineConfig({
  // Classic-script style app: modules attach their globals to window and resolve
  // cross-file references at call time. Nothing here may change runtime semantics.
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/_env.js'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // the app modules share one window; run test files sequentially in one thread
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } }
  }
});
