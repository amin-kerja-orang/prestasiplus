import { defineConfig } from '@playwright/test'

/**
 * E2E config for the prototype-scope smoke (TRACKER D43; port 5190, never the shared 4173 / 5173).
 * The e2e build turns the scope off (`.env.e2e`), so this build switches it back on with the
 * process env, which wins over the `.env` files.
 *
 *   npx playwright test -c playwright.scope.config.mjs
 */
process.env.E2E_PROTOTYPE_SCOPE = 'on' // read by the spec (it skips itself otherwise)

const PORT = 5191
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/bijak-spm.spec.ts',
  fullyParallel: true,
  workers: 2,
  timeout: 120_000,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results-bijak',
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
    command: process.env.BIJAK_DEV
      ? `npx vite --mode e2e --port ${PORT} --strictPort`
      : `npx vite build --mode e2e --outDir dist-e2e-bijak && npx vite preview --mode e2e --outDir dist-e2e-bijak --port ${PORT} --strictPort`,
    env: { VITE_PROTOTYPE_SCOPE: 'on' },
    url: baseURL,
    reuseExistingServer: !!process.env.BIJAK_REUSE,
    timeout: 900_000,
  },
})
