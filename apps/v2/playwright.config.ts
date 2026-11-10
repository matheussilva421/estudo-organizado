import { defineConfig, devices } from '@playwright/test';

// The port is normally fixed; local environments with a stuck preview server
// can move it without editing the config.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 18431);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  webServer: {
    command: `npm run build:e2e && npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
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
