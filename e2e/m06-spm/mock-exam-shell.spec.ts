/**
 * M06-T4 E2E: shell, 404 and responsive checks of S11-S13 and Q4 (SRS M06 v1.4 §12: the S11-S13 part
 * of E2E-M06-04, the mock part of -06, and the S11-S13 + Q4 part of -39). Mobile 375, tablet 768,
 * desktop 1280. The Q4 visit is `@provisional` (L-8).
 */

import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { open } from './mock-exam-nav'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, provisional } from '../support'

const PELAJAR = 'pelajar@demo.test'
const ADMIN = 'admin@demo.test'
const tid = (page: Page, id: string) => page.getByTestId(id)

test.use({ mockInit: { latency: 0 } })

/** Visible text nodes inside `main` whose computed font-size is below 12px (DV-M06-17). */
async function smallText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const main = document.querySelector(
      '[data-testid=shell-admin-main], [data-testid=shell-user-main]',
    )
    if (!main) return ['no main']
    const out: string[] = []
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent ?? '').trim()
      const el = n.parentElement
      if (!text || !el) continue
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 1 || r.height <= 1)
        continue
      if (parseFloat(cs.fontSize) < 12) out.push(`${text.slice(0, 30)} ${cs.fontSize}`)
    }
    return out
  })
}

test.describe('M06 S11-S13 shell and layout', { tag: [moduleTag(6)] }, () => {
  test('E2E-M06-04 (S11-S13) admin shell with page titles and no subtitle; student user portal', async ({
    page,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const [path, title, tab] of [
      ['/spm-mock', 'SPM Mock Exam', 'SPM Mock Exam'],
      ['/spm-mock/16/result', 'Result Mock SPM — Bahasa Melayu', 'Result Mock SPM — Bahasa Melayu'],
      ['/pusat-ai/spm', 'SPM Walkthrough — Cikgu Alesa', 'SPM Walkthrough — Cikgu Alesa'],
    ] as const) {
      await open(page, path)
      await expectTabTitle(page, tab)
      await expect(tid(page, 'shell-admin-title')).toHaveText(title)
      await expect(page.getByTestId('shell-admin-subtitle')).toHaveCount(0)
      await expect(page.getByTestId('shell-user-header')).toHaveCount(0)
    }
  })

  test('E2E-M06-04 (S11 student) renders in the user portal with "SPM Mock Exam"', async ({
    page,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await open(page, '/spm-mock')
    await expect(tid(page, 'shell-user-title')).toHaveText('SPM Mock Exam')
    await expect(page.getByTestId('shell-admin-header')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M06-06 (mock) unknown or foreign mock id shows the 404 page with "Mula Latihan"', async ({
    page,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await open(page, '/spm-mock/99999/result')
    await expectTabTitle(page, 'Halaman Tidak Dijumpai | PRESTASIPLUS')
    await expect(page.getByRole('link', { name: 'Mula Latihan' })).toHaveAttribute(
      'href',
      '/practice',
    )
    // 16 belongs to the admin: foreign for the student.
    await open(page, '/spm-mock/16/result')
    await expectTabTitle(page, 'Halaman Tidak Dijumpai | PRESTASIPLUS')
    await open(page, '/spm-mock/99999')
    await expectTabTitle(page, 'Halaman Tidak Dijumpai | PRESTASIPLUS')
  })

  test('E2E-M06-06 (mock) an in-progress mock result goes to Q4 and a submitted Q4 goes to S12', async ({
    page,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await open(page, '/spm-mock/327/result')
    await expect(page).toHaveURL(/\/spm-mock\/327$/)
    await open(page, '/spm-mock/318')
    await expect(page).toHaveURL(/\/spm-mock\/318\/result$/)
    await expect(tid(page, 'result-grade')).toHaveText('A+')
  })

  test('E2E-M06-39 (S11, S12, S13) no horizontal scroll and no text below 12px', async ({
    page,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    for (const path of [
      '/spm-mock',
      '/spm-mock/318/result',
      '/spm-mock/322/result',
      '/pusat-ai/spm',
    ]) {
      await open(page, path)
      await expect(page.getByTestId('duta-card')).toBeVisible()
      await expectNoHorizontalScroll(page)
      expect(await smallText(page)).toEqual([])
    }
  })

  test(
    'E2E-M06-39 (Q4) no horizontal scroll and no text below 12px',
    provisional('L-8: Q4 in-exam UI is UNVERIFIED (URS OQ-M06-05)'),
    async ({ page, loginAs }) => {
      await loginAs(PELAJAR)
      await open(page, '/spm-mock/327')
      await expect(tid(page, 'run-title')).toHaveText('Bahasa Melayu · Paper 2')
      await expectNoHorizontalScroll(page)
      expect(await smallText(page)).toEqual([])
      await open(page, '/spm-mock/326')
      await expect(page).toHaveURL(/\/spm-mock\/326\/result$/)
    },
  )
})
