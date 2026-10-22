import { defineConfig } from '@playwright/test'

import base from '../../playwright.config.ts'

/**
 * Runs the M18 specs against an already served e2e build (no web server of its own):
 *   M18_PORT=4836 npx playwright test -c e2e/m18-amaran/playwright.m18.config.mjs --workers=1
 */
const baseURL = `http://localhost:${process.env.M18_PORT ?? 4836}`

export default defineConfig({
  ...base,
  testDir: '.',
  outputDir: '../../test-results-m18',
  use: { ...base.use, baseURL },
  webServer: undefined,
})
