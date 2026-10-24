/**
 * QA BUG-C1: the fixed Pembelajaran bottom nav (visible below `lg`, 1024px) must never cover page content.
 * `sm:py-6` on `<main>` used to override `pb-32` from 640px, so at 768 the last button ("Cetak / PDF" of
 * Laporan Bulanan) sat under the bar. Checked at the edges 640 / 768 / 1023 (bar shown) and 1024 (bar hidden).
 * Needs the prototype scope on (Pembelajaran layout); with it off the legacy shell has no such bar and the test skips.
 */

import { expect, test } from '../fixtures/test'

test.use({ mockInit: { latency: 0 } })

for (const width of [640, 768, 1023, 1024]) {
  test(`content clears the bottom nav at ${width}px`, async ({ page, loginAs, gotoApp }) => {
    await page.setViewportSize({ width, height: 800 })
    await loginAs('adminsekolah@demo.test')
    await gotoApp('/admin-sekolah/laporan-bulanan')
    const print = page.getByTestId('lb-print')
    await expect(print).toBeVisible()
    const nav = page.getByTestId('pembelajaran-bottom-nav')
    test.skip((await nav.count()) === 0 && width < 1024, 'legacy shell: no Pembelajaran bottom nav')

    const lastBottom = await page.getByTestId('pembelajaran-main').evaluate(async (m) => {
      // The layout scrolls inside its own panel, not the window: scroll every scrollable ancestor to its end.
      for (let el: HTMLElement | null = m; el; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight
      }
      await new Promise((r) => setTimeout(r, 300))
      const kids = [...m.children].filter((e) => e.getBoundingClientRect().height > 0)
      return Math.max(...kids.map((e) => e.getBoundingClientRect().bottom))
    })
    if (width < 1024) {
      await expect(nav).toBeVisible()
      const navTop = (await nav.boundingBox())!.y
      expect(lastBottom, 'last content element is above the bar').toBeLessThanOrEqual(navTop)
      const pb = (await print.boundingBox())!
      expect(pb.y + pb.height, 'print button is above the bar').toBeLessThanOrEqual(navTop)
    } else {
      await expect(nav).toBeHidden()
    }
  })
}
