import { defineConfig } from '@playwright/test'
import base from './playwright.config'

const PORT = 4722
export default defineConfig({
  ...base,
  outputDir: 'test-results-s2-qa45',
  reporter: 'list',
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: undefined,
})
