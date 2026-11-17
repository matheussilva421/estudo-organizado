import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /f7-isolated-pilot\.spec\.ts$/,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: 'line',
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
