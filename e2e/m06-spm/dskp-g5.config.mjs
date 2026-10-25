import { defineConfig } from '@playwright/test'

/**
 * G5 config of v2-dskp-integration (FB-026): the dskp-g5 specs on the three sizes, against the
 * scope-ON e2e build (same as `playwright.bijak.config.mjs`, its own port).
 *
 *   E2E_BOOT_TIMEOUT_MS=90000 BIJAK_DEV=1 npx playwright test -c e2e/m06-spm/dskp-g5.config.mjs
 *
 * DSKP_PORT (default 5391) picks the port; DSKP_REUSE=1 reuses a server already running there
 * (`VITE_PROTOTYPE_SCOPE=on npx vite --mode e2e --port 5391`); DSKP_SHOTS=<dir> writes screenshots.
 * Run from the repository root.
 */
process.env.E2E_PROTOTYPE_SCOPE = 'on' // read by the specs (they skip themselves otherwise)

const PORT = Number(process.env.DSKP_PORT ?? 5391)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: '.',
  testMatch: 'dskp-g5*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  retries: 0,
  reporter: 'list',
  // Not under a folder Vite watches: a trace file written there makes the dev server reload every open
  // page ("element was detached"). `test-results/` is on Vite's default ignore list and in .gitignore.
  outputDir: process.env.DSKP_RESULTS ?? '../../test-results/dskp-g5',
  use: {
    baseURL,
    locale: 'ms-MY',
    timezoneId: 'Asia/Kuala_Lumpur',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'tablet',
      use: {
        browserName: 'chromium',
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
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
      : `npx vite build --mode e2e --outDir dist-e2e-dskp && npx vite preview --mode e2e --outDir dist-e2e-dskp --port ${PORT} --strictPort`,
    // Playwright runs the command from the config's folder by default; Vite needs the repository root.
    cwd: '../..',
    env: { VITE_PROTOTYPE_SCOPE: 'on' },
    url: baseURL,
    reuseExistingServer: !!process.env.DSKP_REUSE,
    timeout: 900_000,
  },
})
