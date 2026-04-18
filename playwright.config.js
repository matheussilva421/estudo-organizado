import { defineConfig } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: BASE_URL,
    serviceWorkers: 'block',
    trace: 'on-first-retry'
  },
  webServer: {
    command: `npx http-server src -p ${PORT} -c-1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI
  }
});
