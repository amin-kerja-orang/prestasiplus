/**
 * Navigation helper of the `mock-exam-*` specs: `page.goto` + the app boot wait, like the shared
 * `gotoApp` fixture, but with a boot budget that can be raised on a loaded machine
 * (`M06_BOOT_MS`, default the fixture's 15 s).
 */

import type { Page } from '@playwright/test'

import { APP_BOOT_TIMEOUT_MS, waitForApp } from '../fixtures/test'

const BOOT_MS = Number(process.env.M06_BOOT_MS ?? APP_BOOT_TIMEOUT_MS)

export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await waitForApp(page, BOOT_MS)
}
