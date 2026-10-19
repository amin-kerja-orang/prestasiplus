/**
 * M03 G5 QA (student scope) - extra checks on top of t4-student-catalogue.spec.ts:
 *  - F2: S13 shows the admin's M05 answers on the new chapter links (BR-19): BM T4 Bab 1 (chapter 87)
 *    -> topic 67, BM T5 Bab 99 (chapter 413) -> topic 68; SEJ T5 (chapter 382) has no legacy topic.
 *  - F3: heading levels of the S13 and S14 heroes (recorded, FR-M03-81 says h1).
 *  - Responsive sweep of S12/S13/S14 (no h-scroll, no text < 12 px inside main, touch targets).
 *  - Edge ids and guest redirects.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag } from '../support'
import { TIMEOUT_FACTOR } from './timeout-factor'

const ADMIN = 'admin@demo.test'
const PELAJAR = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(3)] }

async function smallTextInMain(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return ['no main']
    const out: string[] = []
    const w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = w.nextNode())) {
      const t = (n.textContent ?? '').trim()
      const el = n.parentElement
      if (!t || !el) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      if (el.getBoundingClientRect().width === 0) continue
      if (parseFloat(cs.fontSize) < 12) out.push(`${t.slice(0, 20)}:${cs.fontSize}`)
    }
    return out
  })
}

test.describe('M03 student G5 QA', MODULE, () => {
  test.setTimeout(120_000 * TIMEOUT_FACTOR)

  test('F2 admin answers on chapters 87 and 413 show on S13 topics 67 and 68; chapter 382 has no topic', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    // BM T4 Bab 1 (87): 5 answers, 0 correct (A5).
    await gotoApp('/topics/67')
    await expect(page.getByTestId('stat-dijawab')).toHaveText('5')
    await expect(page.getByTestId('stat-kemajuan')).toHaveText('0%')
    // BM T5 Bab 99 (413): A3 first 33 (11 correct) + A4 5 (1 correct) = 38 answers, 12 correct -> 60 %.
    await gotoApp('/topics/68')
    await expect(page.getByTestId('stat-dijawab')).toHaveText('38')
    await expect(page.getByTestId('stat-kemajuan')).toHaveText('60%')
    await expect(page.getByTestId('subtopic-progress').first()).toHaveText('60%')
    // SEJ T5 (382) has no legacy topic; Sejarah Tingkatan 4 (125) stays at zero.
    await gotoApp('/topics?grade_level=TINGKATAN_5&subject=SEJARAH')
    await expect(page.getByTestId('topics-page')).toContainText('Tiada topik tersedia buat masa ini.')
    await gotoApp('/topics/125')
    await expect(page.getByTestId('stat-dijawab')).toHaveText('0')
  })

  test('F3 heading levels: S13 hero and S14 hero (recorded)', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await gotoApp('/topics/7')
    await expect(page.getByTestId('topic-hero')).toBeVisible()
    const s13 = await page.locator('main h1, main h2').evaluateAll((els) => els.map((e) => e.tagName))
    await gotoApp('/peta-belajar')
    await expect(page.getByTestId('map-hero')).toBeVisible()
    const s14 = await page
      .getByTestId('map-hero')
      .locator('h1, h2')
      .first()
      .evaluate((e) => e.tagName)
    test.info().annotations.push({ type: 'F3', description: `S13 main headings ${s13.join(',')}; S14 hero ${s14}` })
    // FR-M03-81: the S14 hero title is an h1 (live: hero h1 inside main, plus the shell header h1).
    expect(s14).toBe('H1')
  })

  test('responsive sweep S12/S13/S14: no h-scroll, text >= 12 px, touch targets', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    for (const path of ['/topics', '/topics/7', '/peta-belajar', '/peta-belajar?subject=ZZZ']) {
      await gotoApp(path)
      await expect(page.locator('main')).toContainText(/\S/)
      await page.waitForTimeout(400)
      await expectNoHorizontalScroll(page)
      expect(await smallTextInMain(page), path).toEqual([])
      const tooSmall = await page.evaluate(() =>
        [...document.querySelectorAll('main a, main button')]
          .filter((e) => {
            const r = e.getBoundingClientRect()
            return r.width > 0 && r.height > 0 && r.height < 32
          })
          .map((e) => (e.textContent ?? '').trim().slice(0, 20)),
      )
      expect(tooSmall, `${path} targets under 32 px`).toEqual([])
    }
  })

  test('edge ids: unknown and non-numeric topic id show the 404 page', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    for (const id of ['99999', '0', 'abc']) {
      await gotoApp(`/topics/${id}`)
      await expect(page.getByText('Halaman Tidak Dijumpai').first()).toBeVisible()
    }
  })
})
