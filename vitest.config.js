import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/helpers/test-env.js'],
    include: ['tests/unit/**/*.test.js'],
    restoreMocks: true,
    clearMocks: true,
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/js/**/*.js'],
      exclude: [
        'src/js/vendor/**',
        'scripts/**',
        'src/js/firebase/**',
        '**/*.test.js',
      ],
      thresholds: {
        lines: 45,
        branches: 50,
        functions: 45,
        statements: 45,
      },
    },
  },
});
