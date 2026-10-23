/**
 * @api `/login` hero re-measure on real API stats (AZ-21a, BE-32 row 7): for 3 s after the stat chip
 * is visible (so the entry animation `animate-ds-stamp` is included) the page must not overflow
 * horizontally and no chip may extend past the viewport. Runs in the mobile/tablet/desktop projects
 * plus an explicit 320px phone.
 */

import { expect, test } from '@playwright/test'

const WINDOW_MS = 3000
const GAP_MS = 100

async function measureLoginHero(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login')
  await page.locator('[data-testid="login-stats"] [data-ds="sticker"]').first().waitFor()
  const start = Date.now()
  const worst = { overflow: -Infinity, chip: -Infinity }
  let n = 0
  do {
    const r = await page.evaluate(() => {
      const el = document.documentElement
      const chips = [...document.querySelectorAll('[data-testid="login-stats"] [data-ds="sticker"]')]
      return {
        overflow: el.scrollWidth - el.clientWidth,
        chip: Math.max(...chips.map((c) => c.getBoundingClientRect().right)) - window.innerWidth,
      }
    })
    worst.overflow = Math.max(worst.overflow, r.overflow)
    worst.chip = Math.max(worst.chip, r.chip)
    n++
    await page.waitForTimeout(GAP_MS)
  } while (Date.now() - start < WINDOW_MS)
  expect(n).toBeGreaterThanOrEqual(10)
  expect(worst.overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0)
  expect(worst.chip, 'stat chip right edge minus viewport width').toBeLessThanOrEqual(0)
}

test.describe('@api /login hero stays inside the viewport', () => {
  test('current project viewport', async ({ page }) => {
    await measureLoginHero(page)
  })

  test.describe('320px phone', () => {
    test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true })
    test('320px', async ({ page }) => {
      expect(page.viewportSize()?.width).toBe(320)
      await measureLoginHero(page)
    })
  })
})
