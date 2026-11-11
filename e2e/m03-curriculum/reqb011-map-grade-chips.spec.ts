/**
 * REQ-B-011: the Peta Belajar Tingkatan chips (D54) keep R1's mobile layout: `grid grid-cols-2` below
 * 640 px (equal chips filling each row), a flex row from `sm`. D101: five chips, Tingkatan 1 to 5 (LearningMapPage.vue:112-126,
 * MAP_GRADES). Checked at 375 / 768 / 1280 with no horizontal page scroll.
 */
import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag, viewportWidth } from '../support'

test.describe('Peta Belajar grade chips (REQ-B-011) @m03', () => {
  test('five Tingkatan chips (T1-T5, D101): 2-column grid below 640 px, one flex row above, no horizontal scroll', { tag: [moduleTag(3)] }, async ({
    page,
    loginAs,
    gotoApp,
  }, testInfo) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/peta-belajar?grade=TINGKATAN_4')
    await expect(page.getByTestId('map-hero')).toBeVisible()
    const chips = page.getByTestId('map-grade-chip')
    await expect(chips).toHaveCount(5)
    for (const n of [1, 2, 3, 4, 5]) await expect(chips.nth(n - 1)).toHaveText(`Tingkatan ${String(n)}`)
    const box = await page.getByTestId('map-grade-chips').evaluate((el) => {
      const cs = getComputedStyle(el)
      const rects = [...el.children].map((c) => c.getBoundingClientRect())
      return { display: cs.display, cols: cs.gridTemplateColumns.trim().split(/\s+/).length, tops: rects.map((r) => Math.round(r.top)), widths: rects.map((r) => Math.round(r.width)), parent: el.getBoundingClientRect().width }
    })
    if (viewportWidth(page) < 640) {
      expect(box.display).toBe('grid')
      expect(box.cols).toBe(2)
      // 5 chips in 2 columns = 3 rows; each full row is two equal chips filling it, none squeezed to its text
      expect(new Set(box.tops).size).toBe(3)
      expect(Math.abs(box.widths[0]! - box.widths[1]!)).toBeLessThanOrEqual(2)
      expect(box.widths[0]! + box.widths[1]!).toBeGreaterThan(box.parent - 12)
      expect(box.tops[0]).toBe(box.tops[1])
    } else {
      expect(box.display).toBe('flex')
      expect(new Set(box.tops).size).toBe(1) // one row
    }
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: testInfo.outputPath(`map-chips-${String(viewportWidth(page))}.png`) })
  })
})
