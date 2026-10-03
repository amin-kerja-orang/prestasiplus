import { defineConfig } from '@playwright/test'

const PORT = 4817
const baseURL = `http://localhost:${PORT}`

/**
 * E2E config (overview §12.2, ADR-0011).
 * - Every spec runs on all three projects; branch on viewport helpers, never on project name.
 * - Tag tests over unobserved/UNVERIFIED behaviour with `@provisional`
 *   (`npm run test:e2e:observed` excludes them).
 * - Navigate by URL with the `gotoApp` fixture: it waits for the app boot (mock boot ~1.5 s alone,
 *   up to ~6 s with every worker booting at once) with its own 15 s budget, so `expect` keeps the
 *   5 s default.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false, workers: 1, timeout: 300_000, expect: { timeout: 20_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results-m11m12qa-b',
  use: {
    baseURL,
    locale: 'ms-MY',
    timezoneId: 'Asia/Kuala_Lumpur',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'tablet',
      use: {
        browserName: 'chromium',
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
        hasTouch: false,
      },
    },
  ],
  webServer: {
    command: `npx vite build --mode e2e --outDir dist-e2e-4817 && npx vite preview --mode e2e --outDir dist-e2e-4817 --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  },
})
