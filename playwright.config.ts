import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: (process.env.PLAYWRIGHT_CHANNEL
    ? [process.env.PLAYWRIGHT_CHANNEL]
    : ['chrome', 'msedge']
  ).map((channel) => ({
    name: channel,
    use: {
      ...devices['Desktop Chrome'],
      channel: channel === 'chromium' ? undefined : channel,
      viewport: { width: 1440, height: 1100 },
    },
  })),
  webServer: {
    command: 'npm run build && npm run start:lan',
    url: 'http://127.0.0.1:4174',
    env: { PORT: '4174' },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
