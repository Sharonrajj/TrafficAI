// playwright.config.js
// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,          // 30s per test
  expect: { timeout: 8000 },   // 8s for assertions
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results-e2e.xml' }]
  ],
  use: {
    baseURL:       process.env.BASE_URL || 'http://127.0.0.1:8080',
    trace:         'on-first-retry',
    screenshot:    'only-on-failure',
    video:         'retain-on-failure',
    headless:      true,
    locale:        'en-US',
    timezoneId:    'America/Los_Angeles',
    actionTimeout: 10000
  },
  projects: [
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] }
    },
    {
      name:  'Mobile Chrome',
      use:   { ...devices['Pixel 5'] }
    }
  ],
  webServer: {
    command:   'node server.js',
    url:       'http://127.0.0.1:8080',
    reuseExistingServer: !process.env.CI,
    timeout:   8000
  }
});
