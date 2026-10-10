import { defineConfig, devices } from '@playwright/test';

const mode = process.env.PLAYWRIGHT_MODE ?? 'development';
const production = mode === 'production' || mode === 'pages';
const channel =
  process.env.PLAYWRIGHT_CHANNEL ?? (process.env.CI ? 'chromium' : 'chrome');

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: process.env.CI ? 1 : 3,
  testIgnore: production ? ['**/*performance.spec.ts'] : [],
  ...(production ? { grepInvert: /memory engines benchmark/ } : {}),
  ...(mode === 'pages' ? { testMatch: '**/hosting.spec.ts' } : {}),
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'compact',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 900 },
        channel,
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 900 },
        channel,
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        channel,
      },
    },
    {
      name: 'narrow',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        channel,
      },
    },
  ],
  webServer: {
    command: production
      ? 'npm run preview -- --port 4173 --strictPort'
      : 'npm run dev -- --port 4173 --strictPort',
    url:
      mode === 'pages'
        ? 'http://127.0.0.1:4173/os_simulator/'
        : 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI && !process.env.PLAYWRIGHT_MODE,
  },
});
