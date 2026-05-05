import { defineConfig, devices } from '@playwright/test';

const PORT = 18345;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['manual/**'],
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html']] : 'html',
  use: {
    baseURL: BASE_URL,
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: [
    {
      command: `npx http-server src -p ${PORT} -c-1`,
      url: BASE_URL,
      reuseExistingServer: true,
    },
    {
      command: 'node scripts/local-mock-server.mjs',
      url: 'http://127.0.0.1:18765',
      reuseExistingServer: true,
      timeout: 10000,
    },
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    {
      name: 'mock',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:18765',
        serviceWorkers: 'block',
      },
    },
  ]
});
