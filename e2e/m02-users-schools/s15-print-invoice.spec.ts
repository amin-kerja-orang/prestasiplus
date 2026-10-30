/**
 * M02 S15 `/admin/school-subscriptions/:id/renewal-invoice` print check (pre-existing High bug: "Cetak
 * Invoice" printed a blank page because `ds-extras.css` hides everything but `[data-ds='print-sheet']`
 * under `@media print`). Emulates print at 375 / 768 / 1280 (the three projects): the invoice text is
 * visible, the print bar is not rendered, and the printed PDF is not blank.
 */

import type { Locator } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { moduleTag, TAG } from '../support'

const ADMIN = 'admin@demo.test'

/** An empty Chromium A4 PDF (two blank pages) is about 1.4 kB; the printed invoice is far larger. */
const BLANK_PDF_MAX_BYTES = 5_000

const computedVisibility = (locator: Locator) =>
  locator.evaluate((el) => getComputedStyle(el).visibility)

test.describe('M02 S15 renewal invoice print', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('the invoice is visible under print emulation and the PDF is not blank', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/10/renewal-invoice')
    await expect(page.getByTestId('invoice-row').first()).toBeVisible()

    await page.emulateMedia({ media: 'print' })

    for (const id of ['invoice-school', 'invoice-list-title', 'invoice-total']) {
      expect(await computedVisibility(page.getByTestId(id)), id).toBe('visible')
    }
    expect(
      await computedVisibility(page.getByTestId('invoice-row').first().locator('td').nth(1)),
      'student row',
    ).toBe('visible')
    await expect(page.getByTestId('invoice-toolbar')).toBeHidden()

    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    expect(pdf.length).toBeGreaterThan(BLANK_PDF_MAX_BYTES)
  })
})
