// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Mobile UI accessibility test matrix.
 * Covers the phone size spectrum: 320px (smallest still in use), 360px
 * (common Android), 375px (small iPhone), 393-412px (modern phones),
 * 430px (large iPhone), plus one landscape profile for the timer screen.
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'small-320',
      use: {
        ...devices['Galaxy S8'],
        viewport: { width: 320, height: 568 },
      },
      testIgnore: /landscape/,
    },
    {
      name: 'galaxy-s8-360',
      use: { ...devices['Galaxy S8'] },
      testIgnore: /landscape/,
    },
    {
      name: 'iphone-se-375',
      use: { ...devices['iPhone SE'] },
      testIgnore: /landscape/,
    },
    {
      name: 'pixel-7-412',
      use: { ...devices['Pixel 7'] },
      testIgnore: /landscape/,
    },
    {
      name: 'iphone-14-390',
      use: { ...devices['iPhone 14'] },
      testIgnore: /landscape/,
    },
    {
      name: 'iphone-14-pro-max-430',
      use: { ...devices['iPhone 14 Pro Max'] },
      testIgnore: /landscape/,
    },
    {
      name: 'iphone-se-landscape',
      use: { ...devices['iPhone SE landscape'] },
      testMatch: /landscape/,
    },
  ],
  webServer: {
    command: 'npx http-server -p 4173 -c-1 --silent .',
    url: 'http://127.0.0.1:4173/10-20-30_rowing_timer.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
