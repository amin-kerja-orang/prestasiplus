/**
 * R1-GUR-44b teacher submit form of Soalan Berstruktur at 375 / 768 / 1280 (S6-T17): no horizontal scroll,
 * usable controls (>= 44 px), a 2-part question submitted with "Hantar untuk Semakan" and then listed under
 * the Status filter "Menunggu Semakan". Teacher `guru@demo.test` (two seeded own submissions).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTouchTarget, moduleTag } from '../support'

const GURU = 'guru@demo.test'
const LIST = '/guru/soalan-berstruktur'

test.use({ mockInit: { latency: 0 } })

/** Subjek + Tingkatan, then whatever D112 asks for once the lookups have loaded. */
async function fillTags(page: Page): Promise<void> {
  await page.getByTestId('s-level').selectOption({ label: 'Tingkatan 5' })
  await page.getByTestId('s-subject').selectOption({ label: 'Bahasa Melayu' })
  // "Hantar" stays disabled until the Bab / SP lookups of the pair have loaded.
  await expect(page.getByTestId('form-submit')).toBeEnabled()
  if (await page.getByTestId('s-chapter').isEnabled()) {
    await page.getByTestId('s-chapter').selectOption({ index: 1 })
  }
  if (await page.getByTestId('s-sp').isEnabled()) {
    await page.getByTestId('s-sp').selectOption({ index: 1 })
    await page.getByTestId('s-tp').selectOption({ label: '3' })
    await page.getByTestId('s-aras').selectOption({ label: 'Memahami' })
  }
  await page.getByTestId('s-difficulty').selectOption({ label: 'Sederhana' })
}

test.describe('Soalan Berstruktur submit form', { tag: [moduleTag(10)] }, () => {
  test('fits the screen and its controls are 44 px', async ({ page, loginAs, gotoApp }) => {
    await loginAs(GURU)
    await gotoApp(`${LIST}/cipta`)
    await expect(page.getByTestId('structured-form')).toBeVisible()
    await expectNoHorizontalScroll(page)
    for (const id of ['form-submit', 'form-cancel', 's-part-add', 's-part-remove']) {
      await expectTouchTarget(page.getByTestId(id))
    }
    await page.getByTestId('s-part-add').click()
    await expect(page.getByTestId('s-part')).toHaveCount(2)
    await expectNoHorizontalScroll(page)
  })

  test('a 2-part question is submitted and then listed as Menunggu Semakan', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(GURU)
    await gotoApp(`${LIST}/cipta`)
    await fillTags(page)
    await page.getByTestId('s-stimulus').fill('Petikan pendek untuk dua sub-soalan.')
    await page.getByTestId('s-part-add').click()
    const parts = page.getByTestId('s-part')
    await expect(parts).toHaveCount(2)
    for (const [i, marks] of ['3', '5'].entries()) {
      const part = parts.nth(i)
      await part.getByTestId('s-part-text').fill(`Soalan ${String(i + 1)}`)
      await part.getByTestId('s-part-marks').fill(marks)
      await part.getByTestId('s-part-scheme').fill(`Skema ${String(i + 1)}`)
    }
    await expect(page.getByTestId('s-total')).toHaveText('Jumlah markah: 8')
    await expectNoHorizontalScroll(page)
    await page.getByTestId('form-submit').click()

    await expect(page).toHaveURL(new RegExp(`${LIST}$`))
    await expect(page.getByText('Soalan berstruktur dihantar untuk semakan.')).toBeVisible()
    await gotoApp(`${LIST}?status=review`)
    // Two seeded own submissions plus the new one; the newest is first.
    await expect(page.getByTestId('structured-status-chip')).toHaveCount(3)
    await expect(page.getByTestId('structured-status-chip').first()).toHaveText('Menunggu Semakan')
    await expect(page.getByTestId('structured-view').first()).toHaveAttribute(
      'href',
      new RegExp(`${LIST}/g\\d+$`),
    )
    await expectNoHorizontalScroll(page)
  })
})
