import { defineConfig } from '@playwright/test'

/** Dedicated E2E config for M27-S0 (port 5024; never the shared 4173 / 5173). */
const PORT = 5024
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  workers: 2,
  timeout: 120_000,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results-5024',
  use: { baseURL, locale: 'ms-MY', timezoneId: 'Asia/Kuala_Lumpur', trace: 'retain-on-failure' },
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
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 }, hasTouch: false },
    },
  ],
  webServer: {
    command: `npx vite build --mode e2e --outDir dist-e2e-5024 && npx vite preview --mode e2e --outDir dist-e2e-5024 --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 600_000,
  },
})
