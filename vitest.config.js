import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/helpers/test-env.js'],
    include: ['tests/unit/**/*.test.js'],
    restoreMocks: true,
    clearMocks: true
  }
});
