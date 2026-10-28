import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:18431',
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  webServer: {
    command: 'npm run build:e2e && npm run preview',
    url: 'http://127.0.0.1:18431',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
