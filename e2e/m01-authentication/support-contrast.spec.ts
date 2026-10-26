/**
 * Unit-level proof of the `expectContrast` helper (e2e/support/contrast.ts): modern colour formats
 * are normalised by the browser, alpha is composited, and unreadable backgrounds throw.
 */

import { expect, test } from '@playwright/test'

import { expectContrast, moduleTag } from '../support'

test.describe('support: expectContrast colour parsing', { tag: [moduleTag(1)] }, () => {
  const html = (style: string): string =>
    `<div style="background:#fff"><p id="t" style="${style}">x</p></div>`

  test('oklch and color() text are resolved to sRGB', async ({ page }) => {
    await page.setContent(html('color: oklch(0.2 0 0)'))
    await expectContrast(page.locator('#t'), 4.5)
    await page.setContent(html('color: color(display-p3 0 0 0)'))
    await expectContrast(page.locator('#t'), 4.5)
    // a light oklch grey on white must FAIL (not be misread as black)
    await page.setContent(html('color: oklch(0.92 0 0)'))
    await expect(expectContrast(page.locator('#t'), 4.5)).rejects.toThrow()
  })

  test('alpha on the text and on the background is composited', async ({ page }) => {
    await page.setContent(html('color: rgb(0 0 0 / 0.1)'))
    await expect(expectContrast(page.locator('#t'), 4.5)).rejects.toThrow()
    await page.setContent(
      '<div style="background:#000"><div style="background:oklch(1 0 0 / 0.5)"><p id="t" style="color:#fff">x</p></div></div>',
    )
    // white text on 50% white over black (grey ~ 128): ratio ~ 3.9, passes 3 and fails 4.5
    await expectContrast(page.locator('#t'), 3)
    await expect(expectContrast(page.locator('#t'), 4.5)).rejects.toThrow()
  })

  test('an oklch gradient is read stop by stop', async ({ page }) => {
    await page.setContent(
      '<div style="background-image:linear-gradient(90deg, oklch(0.3 0 0), oklch(0.95 0 0))"><p id="t" style="color:#fff">x</p></div>',
    )
    await expect(expectContrast(page.locator('#t'), 3)).rejects.toThrow()
  })

  test('a background image without colour stops throws a clear error', async ({ page }) => {
    await page.setContent(
      '<div style="background-image:url(data:image/gif;base64,R0lGODlhAQABAAAAACw=)"><p id="t">x</p></div>',
    )
    await expect(expectContrast(page.locator('#t'))).rejects.toThrow(/cannot read colour stops/)
  })
})
