/** Shared helpers of the M06 specs (M06-T2). */

import type { Page } from '@playwright/test'

import { expect } from './fixtures'

export const PELAJAR = 'pelajar@demo.test'
export const PELAJAR2 = 'pelajar2@demo.test'
export const ADMIN = 'admin@demo.test'
export const NOT_FOUND = 'Halaman Tidak Dijumpai | PRESTASIPLUS'

export const tid = (page: Page, id: string) => page.getByTestId(id)

/** Number of tracks of a CSS grid container. */
export const columnsOf = (page: Page, testId: string) =>
  tid(page, testId).evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length,
  )

/** The 18 databank subjects in S2 order (BR-M06-06) with the observed counts. */
export const DATABANK: readonly [string, string, string][] = [
  ['BM', 'Bahasa Melayu', '514'],
  ['BI', 'Bahasa Inggeris', '1,114'],
  ['MATH', 'Matematik', '1,681'],
  ['SCI', 'Sains', '2,076'],
  ['SEJ', 'Sejarah', '1,539'],
  ['BIO', 'Biologi', '1,999'],
  ['EKON', 'Ekonomi', '1,986'],
  ['PHY', 'Fizik', '1,261'],
  ['GEO', 'Geografi', '1,228'],
  ['CHEM', 'Kimia', '1,009'],
  ['ADDMATH', 'Matematik Tambahan', '501'],
  ['PI', 'Pendidikan Islam', '483'],
  ['PM', 'Pendidikan Moral', '1,353'],
  ['PSV', 'Pendidikan Seni Visual', '545'],
  ['PSI', 'Pendidikan Syariah Islamiah', '510'],
  ['PERNIAGA', 'Perniagaan', '934'],
  ['AKAUN', 'Prinsip Perakaunan', '1,770'],
  ['TI', 'Tasawwur Islam', '530'],
]

/** Picks "A", checks and goes on from question `from` through `upTo` of `count`; returns which were right. */
export async function answerFrom(
  page: Page,
  from: number,
  count: number,
  upTo = count,
): Promise<boolean[]> {
  const right: boolean[] = []
  for (let i = from; i <= upTo; i++) {
    await expect(tid(page, 'quiz-progress-text')).toHaveText(
      `Soalan ${String(i)} daripada ${String(count)}`,
    )
    await tid(page, 'option-A').click()
    await tid(page, 'btn-check').click()
    const feedback = tid(page, 'quiz-feedback')
    await expect(feedback).toBeVisible()
    right.push((await feedback.getAttribute('data-correct')) === 'true')
    await tid(page, 'btn-next').click()
  }
  return right
}

/** Text nodes inside `main` rendered below 12 px (DV-M06-17); emoji-only nodes are skipped. */
export function smallTexts(page: Page): Promise<string[]> {
  return page.locator('main').evaluate((main) => {
    const bad: string[] = []
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim()
      if (!text || /^\p{Extended_Pictographic}+$/u.test(text)) continue
      const el = node.parentElement
      if (!el || el.closest('[aria-hidden=true]')) continue
      const size = Number.parseFloat(getComputedStyle(el).fontSize)
      if (size < 12) bad.push(`${text.slice(0, 30)} (${String(size)}px)`)
    }
    return bad
  })
}

/** "{n} soalan" of an S4 level button, trimmed. */
export const tabCount = async (page: Page, id: string) =>
  (await tid(page, id).getByTestId('level-count').innerText()).trim()
