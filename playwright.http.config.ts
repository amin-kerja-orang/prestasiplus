import { defineConfig } from '@playwright/test'

/**
 * E2E against the REAL stack (BE-32): nginx + SPA built with VITE_API_MODE=http + api + db.
 *
 *   npm run stack:up                              # compose.yaml + compose.http.yaml, migrated and seeded
 *   npm run test:e2e:http -- --grep @api          # this file
 *   npm run stack:down
 *
 * - Runs only tests whose title or `tag` carries `@api`. Specs that need the in-browser mock
 *   (`mock-handle`, `window.__mock`, fault injection, the Playwright clock bridge, `loginAs`,
 *   `gotoApp`) are never tagged `@api`; they stay in the mock suite (`playwright.config.ts`).
 *   Tag selection only: no spec is edited or deleted.
 * - An `@api` spec must NOT import `e2e/fixtures/test`: that `test` installs the mock clock and
 *   `gotoApp` waits for `window.__mock.ready`, which does not exist in http mode. Import `test` and
 *   `expect` from `@playwright/test` (or a lead-owned `e2e/fixtures/api.ts`) and navigate with `page.goto`.
 * - Base URL: `BASE_URL`, else `http://localhost:${FRONTEND_PORT ?? 5192}` (the compose default).
 * - `E2E_HTTP_START_STACK=1` lets Playwright run `docker compose up --build` itself and wait for
 *   `/healthz`; otherwise the stack must already be up (CI starts it in an earlier step).
 * - Demo accounts come from the BE-07 seed (poc profile, password `Demo1234`). Same three viewports
 *   as the mock suite; branch on viewport helpers, never on the project name.
 * - `E2E_HTTP_TEST_DIR` (default `e2e`) lets a harness check point the run at another folder.
 */
const port = process.env.FRONTEND_PORT || '5192'
// BASE_URL (BE-32), else BIJAK_API_BASE (the Bijak go/no-go flag), else the compose default port.
const baseURL = process.env.BASE_URL || process.env.BIJAK_API_BASE || `http://localhost:${port}`

export default defineConfig({
  testDir: process.env.E2E_HTTP_TEST_DIR || 'e2e',
  // Only the http specs: e2e/api/** and the Bijak *-http specs. The mock specs are never loaded.
  testMatch: ['**/api/**/*.spec.ts', '**/bijak/*-http.spec.ts', '**/bijak/http-*.spec.ts'],
  grep: /@api/,
  // The seeded database is shared by every worker and project: keep one worker so a spec that
  // changes data (profile, password) cannot race another. Raise it only for read-only specs.
  fullyParallel: false,
  workers: Number(process.env.E2E_HTTP_WORKERS) || 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-http' }]]
    : 'list',
  outputDir: 'test-results-http',
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
  webServer: process.env.E2E_HTTP_START_STACK
    ? {
        command: 'docker compose -f compose.yaml -f compose.http.yaml up --build',
        url: `${baseURL}/healthz`,
        reuseExistingServer: true,
        timeout: 600_000,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 30_000 },
      }
    : undefined,
})
