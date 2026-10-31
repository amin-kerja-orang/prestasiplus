/**
 * REQ-B-011: the Peta Belajar Tingkatan chips (D54) keep R1's mobile layout: `grid grid-cols-2` below
 * 640 px (two equal chips filling the row), a flex row from `sm`. Checked at 375 / 768 / 1280 with no
 * horizontal page scroll.
 */
import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag, viewportWidth } from '../support'

test.describe('Peta Belajar grade chips (REQ-B-011) @m03', () => {
  test('two Tingkatan chips, a 2-column grid at 375, no horizontal scroll', { tag: [moduleTag(3)] }, async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/peta-belajar?grade=TINGKATAN_4')
    await expect(page.getByTestId('map-hero')).toBeVisible()
    const chips = page.getByTestId('map-grade-chip')
    await expect(chips).toHaveCount(2)
    await expect(chips.nth(0)).toHaveText('Tingkatan 4')
    await expect(chips.nth(1)).toHaveText('Tingkatan 5')
    const box = await page.getByTestId('map-grade-chips').evaluate((el) => {
      const cs = getComputedStyle(el)
      const rects = [...el.children].map((c) => c.getBoundingClientRect())
      return { display: cs.display, cols: cs.gridTemplateColumns.trim().split(/\s+/).length, tops: rects.map((r) => Math.round(r.top)), widths: rects.map((r) => Math.round(r.width)), parent: el.getBoundingClientRect().width }
    })
    expect(new Set(box.tops).size).toBe(1) // one row
    if (viewportWidth(page) < 640) {
      expect(box.display).toBe('grid')
      expect(box.cols).toBe(2)
      // each chip is half of the row: both fill it, none is squeezed to its text
      expect(Math.abs(box.widths[0]! - box.widths[1]!)).toBeLessThanOrEqual(2)
      expect(box.widths[0]! + box.widths[1]!).toBeGreaterThan(box.parent - 12)
    } else {
      expect(box.display).toBe('flex')
    }
    await expectNoHorizontalScroll(page)
    await page.screenshot({ path: `/home/claude/scratch/c1/shots/map-chips-${String(viewportWidth(page))}.png` })
  })
})
