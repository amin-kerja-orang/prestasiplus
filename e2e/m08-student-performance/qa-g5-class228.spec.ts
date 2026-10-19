/**
 * M08 G5 QA: AC-M08-13.2a / CH-M08-01. Class 228 "Perlu Perhatian": the total 57 and the first three rows
 * (3 sesi 48.3%, 2 sesi 45%, 5 sesi 44.6%) are OBSERVED; the 11 / 46 split is INFERRED and is not asserted.
 */

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag } from '../support'

test.describe('M08 G5 class 228 attention list', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('AC-13.2a (57) and the first three observed rows', async ({ page, gotoApp, loginAs }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/prestasi/kelas/228')
    await expect(page.getByTestId('prestasi-kelas-detail-page')).toBeVisible()
    await expect(page.getByTestId('attention-count')).toHaveText('(57)')
    const box = page
      .getByTestId('attention-count')
      .locator('xpath=ancestor::*[self::section or self::div][.//text()[contains(., "sesi")]][1]')
    const text = await box.innerText()
    const i1 = text.indexOf('3 sesi · 48.3% ketepatan')
    const i2 = text.indexOf('2 sesi · 45% ketepatan')
    const i3 = text.indexOf('5 sesi · 44.6% ketepatan')
    expect(i1, text.slice(0, 400)).toBeGreaterThanOrEqual(0)
    expect(i2).toBeGreaterThan(i1)
    expect(i3).toBeGreaterThan(i2)
    await expectNoHorizontalScroll(page)
  })
})
