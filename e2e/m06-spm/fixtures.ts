/**
 * The M06 specs' `test`: the project fixtures with `gotoApp` taking its boot budget from
 * `E2E_BOOT_MS` (default: the project's 15 s). On a machine under heavy load the mock boot (the
 * 466k-question dataset) can take much longer than 15 s; nothing else changes.
 */

import { expect, test as base } from '../fixtures/test'
import { APP_BOOT_TIMEOUT_MS, waitForApp } from '../fixtures/mock-handle'

const BOOT_MS = Number(process.env.E2E_BOOT_MS ?? process.env.M06_BOOT_MS ?? APP_BOOT_TIMEOUT_MS)

export const test = base.extend({
  gotoApp: async ({ page }, use) => {
    await use(async (path: string) => {
      await page.goto(path)
      await waitForApp(page, BOOT_MS)
    })
  },
})

export { expect }
