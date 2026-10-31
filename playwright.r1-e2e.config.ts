import { defineConfig } from '@playwright/test'

import base from './playwright.http.config'

/**
 * R1 end-to-end acceptance (CLOUD-HANDOFF §7(i), T23): admin uploads -> approves -> builds a paper ->
 * Terbit -> pupil sits it, self-marks, Cuba Lagi -> Databank / Latih Tubi SPM / Bab receive the
 * admin question. Real stack only (http mode), three viewports, one worker, steps in file order.
 *
 *   BASE_URL=http://localhost:5192 npx playwright test -c playwright.r1-e2e.config.ts
 *
 * - The spec is stateful across its steps: each step writes what it created to a per-project state
 *   file (`test-results-r1-e2e/state/`), so a failing step does not lose the ids of earlier steps.
 * - `R1_E2E_RUN` tags every record this run creates (question text, paper title). Set once here so
 *   the workers inherit the same value.
 * - `PW_CHROMIUM_PATH` points at a pre-installed Chromium when the bundled one is absent (cloud
 *   container: the Playwright build expects a newer Chromium than the one installed).
 * - WRITES REAL DATA into the target database. Run it only against a local or disposable stack.
 */
process.env.R1_E2E_RUN ??= `r${Date.now().toString(36)}`

const executablePath = process.env.PW_CHROMIUM_PATH || undefined

export default defineConfig({
  ...base,
  testMatch: ['**/api/r1-e2e-baseline.spec.ts'],
  grep: /@r1e2e/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results-r1-e2e/artifacts',
  reporter: [['list'], ['json', { outputFile: 'test-results-r1-e2e/results.json' }]],
  use: {
    ...base.use,
    screenshot: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: undefined,
})
