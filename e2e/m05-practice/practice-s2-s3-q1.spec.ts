/**
 * M05-T4 scenario coverage of SRS M05 v1.19 §12 rows 14 (without `?topic_id=7`: the M03 student
 * endpoint `GET /api/topics/:id` is not built yet), 16–23 and the S2 / S3 / Q1 part of 54, at
 * 375 / 768 / 1280. No E2E ids in the titles on purpose: `scripts/check-e2e-trace.mjs` (T3) wants every
 * approved id of a module with a traced id covered, and QA writes those ids at G5. Rows 21–23 are
 * provisional (LS-1/2/8): the live quiz was never opened.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const PELAJAR = 'pelajar@demo.test'
const PELAJARMAJU = 'pelajarmaju@demo.test'
const ADMIN = 'admin@demo.test'

const tid = (page: Page, id: string) => page.getByTestId(id)
const NOT_FOUND = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'

/** Number of tracks of a CSS grid container. */
const columnsOf = (page: Page, testId: string) =>
  tid(page, testId).evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length,
  )

/** Picks "A", checks and goes on from question `from` through `upTo` of `count`; returns which were right. */
async function answerFrom(
  page: Page,
  from: number,
  count: number,
  upTo = count,
): Promise<boolean[]> {
  const right: boolean[] = []
  for (let i = from; i <= upTo; i++) {
    await expect(tid(page, 'quiz-progress-text')).toHaveText(`Soalan ${i} daripada ${count}`)
    await tid(page, 'option-A').click()
    await tid(page, 'btn-check').click()
    const feedback = tid(page, 'quiz-feedback')
    await expect(feedback).toBeVisible()
    right.push((await feedback.getAttribute('data-correct')) === 'true')
    await tid(page, 'btn-next').click()
  }
  return right
}

test.describe('M05 S2 subject list', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('header, hero, banner, 31 cards, separators, core badges and columns', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/practice')
    await expectTabTitle(page, 'Latih Tubi - PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Latih Tubi')
    if (isDesktopShell(page)) {
      await expect(tid(page, 'shell-user-subtitle')).toHaveText('Pilih subjek dan mula berlatih')
    }
    await expect(tid(page, 'practice-title')).toHaveText('Latih Tubi 🎯')
    await expect(page.getByText('Pilih subjek dan mula berlatih!')).toBeVisible()
    await expect(page.locator('[data-testid=practice-circles] > div')).toHaveCount(4)

    const banner = tid(page, 'chapter-banner')
    await expect(banner).toHaveAttribute('href', '/practice/chapter')
    await expect(banner.getByText('Mode Baru')).toHaveCSS('text-transform', 'uppercase')
    await expect(banner).toContainText('Soalan by Chapter')
    await expect(banner).toContainText('Mula')

    const cards = page.locator('[data-testid^=subject-card-]')
    await expect(cards).toHaveCount(31)
    const hrefs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    expect(hrefs[0]).toBe('/practice/BM')
    expect(hrefs[1]).toBe('/practice/BI')
    expect(hrefs[2]).toBe('/practice/MATH')
    expect(new Set(hrefs).size).toBe(31)

    // Counts use ms-MY separators (Matematik 13,872) and the badge shows on the 7 core subjects.
    await expect(tid(page, 'subject-card-MATH').getByTestId('subject-count')).toHaveText(
      '13,872 soalan',
    )
    await expect(page.getByTestId('subject-core')).toHaveCount(7)
    // Every subject icon tile shows a glyph (DV-M05-02).
    const empty = await page
      .getByTestId('subject-icon')
      .evaluateAll(
        (els) => els.filter((e) => e.querySelector('svg') === null && !e.textContent.trim()).length,
      )
    expect(empty).toBe(0)

    const width = viewportWidth(page)
    const columns = await columnsOf(page, 'subject-grid')
    expect(columns).toBe(width >= 1024 ? 3 : width >= 768 ? 2 : 1)
    await expectNoHorizontalScroll(page)
  })

  test('a click on the card name and on "Mula Latihan" both open the subject', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/practice')
    await tid(page, 'subject-card-SCI').getByTestId('subject-name').click()
    await expect(page).toHaveURL(/\/practice\/SCI$/)
    await page.goBack()
    await expect(tid(page, 'practice-title')).toBeVisible()
    await tid(page, 'subject-card-SCI').getByTestId('subject-start').click()
    await expect(page).toHaveURL(/\/practice\/SCI$/)
    await expect(tid(page, 'config-name')).toBeVisible()
  })

  test('entry parameters: ?subject= redirects, unknown values and ?level= keep the list', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/practice?subject=BM')
    await expect(page).toHaveURL(/\/practice\/BM$/)
    await expect(tid(page, 'config-name')).toHaveText('Bahasa Melayu')

    for (const url of ['/practice?subject=XYZ', '/practice?level=D3', '/practice?topic_id=99999']) {
      await gotoApp(url)
      await expect(tid(page, 'practice-title')).toBeVisible()
      await expect(page.locator('[data-testid^=subject-card-]')).toHaveCount(31)
      expect(new URL(page.url()).pathname).toBe('/practice')
    }
    // ?level= is ignored: the card links are unchanged and S3 opens with "Semua Tahap".
    await gotoApp('/practice?level=D3')
    await expect(tid(page, 'subject-card-MATH')).toHaveAttribute('href', '/practice/MATH')
    await tid(page, 'subject-card-MATH').click()
    await expect(tid(page, 'level-all')).toHaveAttribute('data-selected', 'true')
  })
})

test.describe('M05 S3 configuration', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('Matematik opens with every default, the levels D1–D4 and the tips', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/MATH')
    await expectTabTitle(page, 'Matematik - Latihan')
    await expect(tid(page, 'shell-user-title')).toHaveText('Latih Tubi')
    await expect(tid(page, 'shell-user-subtitle')).toHaveCount(0)
    await expect(tid(page, 'config-back')).toHaveAttribute('href', '/practice')
    await expect(tid(page, 'config-back')).toHaveText('Kembali ke Senarai Subjek')
    await expect(tid(page, 'config-name')).toHaveText('Matematik')
    await expect(tid(page, 'config-total')).toContainText('soalan tersedia')

    const levels = page.locator('[data-testid=config-levels] button')
    await expect(levels).toHaveCount(5)
    await expect(tid(page, 'level-all')).toHaveAttribute('data-selected', 'true')
    for (const [i, code] of ['D1', 'D2', 'D3', 'D4'].entries()) {
      await expect(levels.nth(i + 1)).toContainText(code)
    }
    await expect(page.locator('[data-testid=config-counts] button')).toHaveText([
      /5\s*soalan/,
      /10\s*soalan/,
      /15\s*soalan/,
      /20\s*soalan/,
    ])
    await expect(tid(page, 'count-10')).toHaveAttribute('data-selected', 'true')
    await expect(tid(page, 'difficulty-all')).toHaveAttribute('data-selected', 'true')
    await expect(tid(page, 'config-tips').locator('li')).toHaveCount(4)
    await expectNoHorizontalScroll(page)
  })

  test('levels follow the subject: SK offers only D4, ADDMATH none', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/SK')
    await expect(page.locator('[data-testid=config-levels] button')).toHaveCount(2)
    await expect(tid(page, 'level-4')).toContainText('D4')
    await expect(tid(page, 'level-4')).toContainText('0 soalan')
    await gotoApp('/practice/ADDMATH')
    await expect(page.locator('[data-testid=config-levels] button')).toHaveCount(1)
    await expect(tid(page, 'level-all')).toContainText('0 soalan')
    await expect(tid(page, 'config-insufficient')).toBeVisible()
  })

  test('selections restyle the buttons and update the summary and every count', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/MATH')
    const subjectTotal = (await tid(page, 'summary-available').innerText()).trim()

    await tid(page, 'level-2').click()
    await expect(tid(page, 'level-2')).toHaveAttribute('data-selected', 'true')
    await expect(tid(page, 'level-2')).toHaveClass(/bg-indigo-600/)
    await expect(tid(page, 'level-2')).toHaveClass(/ring-indigo-300/)
    await expect(tid(page, 'level-all')).toHaveAttribute('data-selected', 'false')
    await expect(tid(page, 'summary-level')).toHaveText('Darjah 2')
    const level2 = (await tid(page, 'summary-available').innerText()).trim()
    expect(level2).not.toBe(subjectTotal)
    // "Semua" shows the level total; the five cells sum to it.
    await expect(tid(page, 'difficulty-all').getByTestId('difficulty-count')).toHaveText(level2)
    const cells = await page
      .locator(
        '[data-testid^=difficulty-]:not([data-testid=difficulty-all]):not([data-testid=difficulty-count])',
      )
      .getByTestId('difficulty-count')
      .allInnerTexts()
    expect(cells).toHaveLength(5)
    const sum = cells.map((c) => Number(c.replace(/[^\d]/g, ''))).reduce((a, b) => a + b, 0)
    expect(String(sum)).toBe(level2.replace(/[^\d]/g, ''))

    await tid(page, 'difficulty-3').click()
    await tid(page, 'count-20').click()
    await expect(tid(page, 'difficulty-3')).toHaveClass(/bg-yellow-500/)
    await expect(tid(page, 'summary-difficulty')).toHaveText('Sederhana')
    await expect(tid(page, 'summary-count')).toHaveText('20')
    const cell = (
      await tid(page, 'difficulty-3').getByTestId('difficulty-count').innerText()
    ).trim()
    await expect(tid(page, 'summary-available')).toHaveText(cell)

    // Difficulty without a level: the subject-wide count of that difficulty.
    await tid(page, 'level-all').click()
    await expect(tid(page, 'summary-level')).toHaveText('Semua Tahap')
    const wide = (
      await tid(page, 'difficulty-3').getByTestId('difficulty-count').innerText()
    ).trim()
    await expect(tid(page, 'summary-available')).toHaveText(wide)
  })

  test('start link, ready pill, not-enough box and trial notice', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/MATH')
    await expect(tid(page, 'config-start')).toHaveAttribute('href', '/practice/MATH/quiz?count=10')
    await expect(tid(page, 'config-ready')).toContainText('Bersedia untuk bermula!')
    await expect(tid(page, 'config-trial')).toHaveCount(0)
    await expectTouchTarget(tid(page, 'config-start'))

    await tid(page, 'level-2').click()
    await tid(page, 'difficulty-3').click()
    await tid(page, 'count-20').click()
    await expect(tid(page, 'config-start')).toHaveAttribute(
      'href',
      '/practice/MATH/quiz?level=2&difficulty=3&count=20',
    )

    // "Sgt Sukar" has no questions: amber box, grey button, a click stays on the page.
    await tid(page, 'difficulty-5').click()
    await expect(tid(page, 'config-insufficient')).toContainText('Soalan Tidak Mencukupi')
    await expect(tid(page, 'config-insufficient')).toContainText(
      'Kurangkan bilangan soalan atau tukar tetapan penapisan.',
    )
    await expect(tid(page, 'config-ready')).toHaveCount(0)
    await expect(tid(page, 'config-start')).toHaveClass(/bg-slate-300/)
    await expect(tid(page, 'config-start')).toHaveClass(/cursor-not-allowed/)
    await tid(page, 'config-start').click()
    await expect(page).toHaveURL(/\/practice\/MATH$/)
    await expectNoHorizontalScroll(page)
  })

  test('the admin sees the trial notice with the pricing link', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/practice/MATH')
    const notice = tid(page, 'config-trial')
    await expect(notice).toContainText('Baki percubaan percuma: 0 soalan lagi.')
    await expect(
      notice.getByRole('link', { name: 'Langgan untuk akses tanpa had' }),
    ).toHaveAttribute('href', '/pricing')
  })

  test('the subjective link needs a level with a count (fixture) and /subjektif is the 404 page', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/MATH')
    await tid(page, 'level-1').click()
    await expect(tid(page, 'config-subjective')).toHaveCount(0)

    await mock.hook('setSubjectiveCounts', 'MATH', { '1': 4 })
    await gotoApp('/practice/MATH')
    await expect(tid(page, 'config-subjective')).toHaveCount(0)
    await tid(page, 'level-1').click()
    await expect(tid(page, 'config-subjective')).toContainText('Latihan Subjektif (4 soalan)')
    await expect(tid(page, 'config-subjective')).toHaveAttribute('href', '/practice/MATH/subjektif')
    await tid(page, 'level-all').click()
    await expect(tid(page, 'config-subjective')).toHaveCount(0)

    await gotoApp('/practice/MATH/subjektif')
    await expectTabTitle(page, NOT_FOUND)
  })

  test('an unknown code is the global 404 page', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await gotoApp('/practice/XYZ')
    await expectTabTitle(page, NOT_FOUND)
  })
})

test.describe('M05 Q1 random quiz', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test(
    'loading, header card, timer, pick, check, feedback, report modal and the last button',
    provisional('LS-1: the live random quiz was never opened; the S7 source is the pattern'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(PELAJARMAJU)
      await gotoApp('/practice/MATH/quiz?level=1&count=5')
      await expect(tid(page, 'quiz-title')).toHaveText('Matematik')
      await expectTabTitle(page, 'Matematik - Latihan')
      await expect(tid(page, 'shell-user-title')).toHaveText('Latih Tubi')

      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 5')
      await expect(tid(page, 'quiz-progress-bar')).toHaveAttribute('style', /width: 20%/)
      await expect(tid(page, 'quiz-timer')).toHaveText(/^00:0\d$/)
      // No revision chips and no "Salah {n}x" on Q1 (FR-M05-52).
      await expect(tid(page, 'chip-revision')).toHaveCount(0)
      await expect(tid(page, 'pill-wrong-times')).toHaveCount(0)
      await mock.advanceTime(65_000)
      await expect(tid(page, 'quiz-timer')).toHaveText(/^01:\d\d$/)

      await expect(tid(page, 'btn-check')).toHaveCount(0)
      await tid(page, 'option-B').click()
      await expect(tid(page, 'option-B')).toHaveAttribute('data-state', 'selected')
      await expect(tid(page, 'option-B')).toHaveClass(/ring-orange-200/)
      await tid(page, 'btn-check').click()
      await expect(tid(page, 'quiz-feedback')).toBeVisible()
      await expect(tid(page, 'option-B')).toBeDisabled()
      // One option is green; a wrong pick is red; the rest are dimmed.
      await expect(page.locator('[data-state=correct]')).toHaveCount(1)
      const correct = (await tid(page, 'quiz-feedback').getAttribute('data-correct')) === 'true'
      await expect(page.locator('[data-state=wrong]')).toHaveCount(correct ? 0 : 1)
      await expect(tid(page, 'feedback-title')).toHaveText(correct ? 'Betul!' : 'Salah')
      // "Lapor Soalan" sits between the question card and the feedback card.
      const order = await page.evaluate(() => {
        const q = document.querySelector('[data-testid=quiz-question]')!
        const r = document.querySelector('[data-testid=btn-report]')!
        const f = document.querySelector('[data-testid=quiz-feedback]')!
        const pos = (a: Element, b: Element) => a.compareDocumentPosition(b)
        return [pos(q, r), pos(r, f)].map((p) => (p & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)
      })
      expect(order).toEqual([true, true])
      await expectNoHorizontalScroll(page)

      await tid(page, 'btn-report').click()
      await expect(tid(page, 'report-modal')).toBeVisible()
      await expect(tid(page, 'report-modal')).toContainText('Lapor Soalan')
      await page.keyboard.press('Escape')
      await expect(tid(page, 'report-modal')).toHaveCount(0)

      await expect(tid(page, 'btn-next')).toContainText('Soalan Seterusnya')
      await tid(page, 'btn-next').click()
      await answerFrom(page, 2, 5, 4)
      await tid(page, 'option-A').click()
      await tid(page, 'btn-check').click()
      await expect(tid(page, 'btn-next')).toContainText('Lihat Keputusan')
    },
  )

  test(
    'the loading state shows the Q1 copy while the session starts',
    provisional('LS-1: the live random quiz was never opened; the S7 source is the pattern'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(PELAJARMAJU)
      await gotoApp('/practice/MATH')
      await mock.setLatency(1500, '/api/practice/sessions')
      await tid(page, 'config-start').click()
      await expect(tid(page, 'quiz-loading')).toContainText('Memuat Soalan...')
      await expect(tid(page, 'quiz-loading')).toContainText('Menyediakan soalan latihan')
      await expectNoHorizontalScroll(page)
      await expect(tid(page, 'quiz-title')).toHaveText('Matematik')
    },
  )

  test(
    'the trial gate: an admin with no free questions goes to /pricing and no session is stored',
    provisional('LS-8: the trial-exhausted start was never observed on live'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/practice/MATH')
      await tid(page, 'config-start').click()
      await expect(page).toHaveURL(/\/pricing$/)
      const starts = await mock.requests('/api/practice/sessions')
      const posts = starts.filter((r) => r.method === 'POST')
      expect(posts).toHaveLength(1)
      expect(posts[0]?.status).toBe(402)
      await expect(page.getByTestId('quiz-runner')).toHaveCount(0)
    },
  )

  test(
    'results: score, band, time, rewards and the review agree with the answers; "Ulang Lagi"',
    provisional(
      'LS-2: the live random results were never opened; S7 source and §8.3 PROPOSED COPY',
    ),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJARMAJU)
      await gotoApp('/practice/MATH/quiz?level=1&count=10')
      const right = await answerFrom(page, 1, 10)
      const score = right.filter(Boolean).length
      const percent = score * 10

      await expect(tid(page, 'result-title')).toHaveText('Keputusan Latihan')
      await expect(tid(page, 'result-subject')).toHaveText('Matematik')
      await expect(tid(page, 'result-score')).toHaveText(`${score}/10`)
      await expect(tid(page, 'result-percent')).toHaveText(`${percent}%`)
      await expect(tid(page, 'result-percent')).toHaveAttribute(
        'data-band',
        percent >= 80 ? 'high' : percent >= 50 ? 'mid' : 'low',
      )
      await expect(tid(page, 'result-time')).toContainText('Masa diambil: 00:')
      // No "berjaya diperbetulkan" line on Q1 (FR-M05-52).
      await expect(tid(page, 'result-corrected')).toHaveCount(0)
      await expect(tid(page, 'result-bar')).toHaveAttribute(
        'style',
        new RegExp(`width: ${percent}%`),
      )
      await expect(tid(page, 'result-rewards')).toBeVisible()
      // One coin per correct answer (BR-09) and 10 points each (the animation total).
      await expect(tid(page, 'reward-coins')).toHaveText(String(score))
      await expect(tid(page, 'reward-points')).toHaveText(String(score * 10))
      await expectNoHorizontalScroll(page)

      // The review is closed first, then lists the 10 answers with the right colours.
      await expect(tid(page, 'review-list')).toBeHidden()
      await tid(page, 'review-toggle').click()
      const items = page.getByTestId('review-item')
      await expect(items).toHaveCount(10)
      const flags = await items.evaluateAll((els) =>
        els.map((e) => e.getAttribute('data-correct') === 'true'),
      )
      expect(flags).toEqual(right)
      await expectTouchTarget(page.getByTestId('review-report').first())
      await expectNoHorizontalScroll(page)

      await expect(tid(page, 'result-back')).toHaveAttribute('href', '/practice/MATH')
      await tid(page, 'result-retry').click()
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 10')
    },
  )

  test('a quiz request keeps level, difficulty and count; an invalid count falls back to 10', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/MATH/quiz?level=2&difficulty=3&count=15')
    await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 15')
    const last = await mock.lastRequest('/api/practice/sessions')
    expect(last?.body).toMatchObject({
      mode: 'random',
      subjectCode: 'MATH',
      levelId: 2,
      difficulty: 3,
      count: 15,
    })
    await gotoApp('/practice/MATH/quiz?count=7')
    await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 10')
  })
})

test.describe('M05 S2 / S3 / Q1 responsive sweep', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('no horizontal scroll, no text under 12 px on S3, options at 44 px', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJARMAJU)
    for (const url of ['/practice', '/practice/MATH', '/practice/MATH/quiz?level=1&count=5']) {
      await gotoApp(url)
      await expect(
        page.locator(
          '[data-testid=practice-title], [data-testid=config-name], [data-testid=quiz-title]',
        ),
      ).toBeVisible()
      await expectNoHorizontalScroll(page)
    }

    // S3: no text node inside main below 12 px (DV-M05-11), at every width.
    await gotoApp('/practice/MATH')
    await expect(tid(page, 'config-name')).toBeVisible()
    const small = await page.locator('main').evaluate((main) => {
      const bad: string[] = []
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim()
        if (!text || /^\p{Extended_Pictographic}+$/u.test(text)) continue
        const el = node.parentElement
        if (!el) continue
        const size = Number.parseFloat(getComputedStyle(el).fontSize)
        if (size < 12) bad.push(`${text.slice(0, 30)} (${size}px)`)
      }
      return bad
    })
    expect(small).toEqual([])

    // Level, difficulty and count buttons are touch targets at 375.
    if (isMobileWidth(page)) {
      for (const id of ['level-1', 'difficulty-3', 'count-5', 'config-start']) {
        await expectTouchTarget(tid(page, id))
      }
    }

    await gotoApp('/practice/MATH/quiz?level=1&count=5')
    await expect(tid(page, 'quiz-title')).toBeVisible()
    for (const id of ['option-A', 'option-B']) await expectTouchTarget(tid(page, id))
  })
})
