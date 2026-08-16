const {defineConfig, devices} = require('@playwright/test');

const configuredBaseURL = process.env.NOSMAPS_BASE_URL || 'http://127.0.0.1:4173/';
const baseURL = configuredBaseURL.endsWith('/') ? configuredBaseURL : `${configuredBaseURL}/`;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {timeout: 5_000},
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    locale: 'en-US',
    viewport: {width: 1280, height: 900},
    trace: 'retain-on-failure'
  },
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
    {name: 'webkit', use: {...devices['Desktop Safari']}}
  ],
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true
  }
});
