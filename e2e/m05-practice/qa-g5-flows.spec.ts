/**
 * QA G5 (Session 4, rows L14 / L17 / L21 / L22; user decision D21): one end-to-end flow per row plus
 * the acceptance criteria that the developer specs do not assert (unlock threshold, menus, SPM
 * targets, question-set run, mission coins). Runs on 375 / 768 / 1280.
 *
 * Quiz answers are picked blind ("A"), so scores are read back from the page and checked for
 * internal consistency (score text = number of green feedbacks = coins, review list = answers).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { waitForApp } from '../fixtures/mock-handle'
import { addInitSession } from '../fixtures/mock-page'
import {
  acceptNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  provisional,
} from '../support'

const NOT_FOUND = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'
const tid = (page: Page, id: string) => page.getByTestId(id)

test.describe.configure({ timeout: 180_000 })

/** Picks "A", checks, goes on through question `count`; returns which answers were right. */
async function answerAll(page: Page, count: number): Promise<boolean[]> {
  const right: boolean[] = []
  for (let i = 1; i <= count; i++) {
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

const num = (s: string | null | undefined): number => Number((s ?? '').replace(/[^\d.]/g, ''))

// ---------------------------------------------------------------------------------------------
// L21 Latih Tubi: S2 -> S3 -> Q1 -> results
// ---------------------------------------------------------------------------------------------
test.describe('QA-G5 L21 Latih Tubi flow', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test(
    'E2E-M05-16/17/21/23 S2 -> S3 (Darjah 1, 5 soalan) -> Q1 -> results -> "Ulang Lagi" -> back to S3',
    provisional('LS-1 / LS-2: the live random quiz and its results were never observed'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs('pelajarmaju@demo.test')
      await gotoApp('/practice')
      await expect(tid(page, 'subject-card-MATH')).toBeVisible()
      const cardCount = num(await tid(page, 'subject-card-MATH').getByTestId('subject-count').innerText())
      await tid(page, 'subject-card-MATH').getByTestId('subject-name').click()
      await expect(page).toHaveURL(/\/practice\/MATH$/)
      // S2 card = Q-ELIGIBLE (13,872); S3 "Semua Tahap" = Q-PRACTICE (6,538) (AC-36.1).
      expect(cardCount).toBe(13872)
      expect(num(await tid(page, 'summary-available').innerText())).toBe(6538)

      await tid(page, 'level-1').click()
      await tid(page, 'count-5').click()
      await expect(tid(page, 'config-start')).toHaveAttribute('href', '/practice/MATH/quiz?level=1&count=5')
      await tid(page, 'config-start').click()
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 5')
      await expectNoHorizontalScroll(page)

      const right = await answerAll(page, 5)
      const score = right.filter(Boolean).length
      await expect(tid(page, 'result-score')).toHaveText(`${score}/5`)
      await expect(tid(page, 'result-percent')).toHaveText(`${score * 20}%`)
      await expect(tid(page, 'reward-coins')).toHaveText(String(score))
      await expect(tid(page, 'result-back')).toHaveAttribute('href', '/practice/MATH')
      await expectNoHorizontalScroll(page)

      await tid(page, 'result-retry').click()
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 5')
      await page.goBack().catch(() => undefined)
    },
  )

  test('E2E-M05-19 the S3 summary link, the not-enough state and the trial gate are consistent for the trial pupil', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar2@demo.test')
    await gotoApp('/practice/MATH')
    await expect(tid(page, 'config-start')).toHaveAttribute('href', '/practice/MATH/quiz?count=10')
    // Trial notice shows the remaining free questions for a trial pupil (AC-14.3).
    await expect(page.getByText('Baki percubaan percuma: 50 soalan lagi.')).toBeVisible()
    // D9 dead link: /pricing (M19) is not routed, so the subscribe link is hidden.
    await expect(page.getByRole('link', { name: 'Langgan untuk akses tanpa had' })).toHaveCount(0)
  })

  test('E2E-M05-12 /practice?subject=BM replaces the URL; ?topic_id is not handled (M03-T1a not built)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajarmaju@demo.test')
    await gotoApp('/practice?subject=BM')
    await expect(page).toHaveURL(/\/practice\/BM$/)
    await gotoApp('/practice?subject=XYZ')
    await expect(page).toHaveURL(/\/practice(\?subject=XYZ)?$/)
    await expect(tid(page, 'subject-grid')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------------------------
// L14 Soalan by Chapter: S4 -> S5 -> Q2, unlock at 70 %, then S6 / S7 revision
// ---------------------------------------------------------------------------------------------
test.describe('QA-G5 L14 chapter flow', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test(
    'E2E-M05-24/25/28/29 S4 -> S5 -> Q2 (5 soalan) -> results -> S5 progress -> S6 -> S7',
    provisional('LS-3: the live chapter quiz was never observed'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs('pelajar2@demo.test')
      await gotoApp('/practice/chapter')
      await expect(tid(page, 'chapter-subject-grid')).toBeVisible()
      await tid(page, 'chapter-subject-name').filter({ hasText: 'Matematik' }).click()
      await expect(page).toHaveURL(/\/practice\/chapter\/MATH$/)
      await expect(tid(page, 'chapter-stats-1')).toHaveText('0/464 soalan unik · Skor 0% · 464 baki')
      await tid(page, 'chapter-count-1-5').click()
      await expect(page).toHaveURL(/\/practice\/chapter\/MATH\/1\/quiz\?count=5$/)
      await expectNoHorizontalScroll(page)

      const right = await answerAll(page, 5)
      const score = right.filter(Boolean).length
      const wrong = 5 - score
      await expect(tid(page, 'result-score')).toHaveText(`${score}/5`)
      await expectNoHorizontalScroll(page)

      await tid(page, 'result-back').click()
      await expect(page).toHaveURL(/\/practice\/chapter\/MATH\?level=1$/)
      await expect(tid(page, 'chapter-stats-1')).toContainText('5/464 soalan unik')
      // 5 of 464 answered: Bab 2 stays locked.
      await expect(tid(page, 'chapter-card-1')).toHaveAttribute('data-state', 'open')
      await expect(page.locator('[data-testid^=chapter-card-][data-state=locked]').first()).toBeVisible()

      // S6: every wrong answer is queued (BR-14); S7 serves them.
      await gotoApp('/practice/revision')
      await expect(tid(page, 'revision-total')).toContainText(`${wrong} soalan perlu diulang kaji`)
      if (wrong > 0) {
        await tid(page, 'revision-subject-MATH').click()
        await expect(tid(page, 'quiz-title')).toHaveText('Ulang Kaji — Matematik')
        await expect(tid(page, 'quiz-progress-text')).toHaveText(`Soalan 1 daripada ${wrong}`)
        await expectNoHorizontalScroll(page)
      }
    },
  )

  test(
    'E2E-M05-28 the 70 % unlock boundary: 69 % keeps Bab 2 locked, 70 % opens it',
    provisional('LS-3: the unlock after a completed chapter was never observed on live'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs('pelajar2@demo.test')
      await gotoApp('/practice/chapter/MATH')
      await expect(page.locator('[data-testid^=chapter-card-][data-state=locked]').first()).toBeVisible()
      const locked = await page
        .locator('[data-testid^=chapter-card-][data-state=locked]')
        .evaluateAll((els) => els.map((e) => (e.getAttribute('data-testid') ?? '').replace('chapter-card-', '')))
      const second = locked[0]!

      await mock.hook('answerChapter', 3, 1, { correctPct: 69 })
      await gotoApp('/practice/chapter/MATH')
      await expect(tid(page, 'chapter-stats-1')).toContainText('464/464 soalan unik')
      await expect(tid(page, 'chapter-stats-1')).toContainText('0 baki')
      await expect(tid(page, `chapter-card-${second}`)).toHaveAttribute('data-state', 'locked')
      await expect(tid(page, `chapter-card-${second}`).locator('a')).toHaveCount(0)
    },
  )

  test(
    'E2E-M05-28 at 70 % exactly (325 of 464) Bab 2 opens with 4 buttons; Bab 3 stays locked',
    provisional('LS-3: the unlock after a completed chapter was never observed on live'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs('pelajar2@demo.test')
      await gotoApp('/practice/chapter/MATH')
      await expect(page.locator('[data-testid^=chapter-card-][data-state=locked]').first()).toBeVisible()
      const locked = await page
        .locator('[data-testid^=chapter-card-][data-state=locked]')
        .evaluateAll((els) => els.map((e) => (e.getAttribute('data-testid') ?? '').replace('chapter-card-', '')))
      await mock.hook('answerChapter', 3, 1, { correctPct: 70 })
      await gotoApp('/practice/chapter/MATH')
      await expect(tid(page, 'chapter-card-1')).toBeVisible()
      await expect(tid(page, `chapter-card-${locked[0]!}`)).toHaveAttribute('data-state', 'open')
      await expect(tid(page, `chapter-card-${locked[0]!}`).locator('a')).toHaveCount(4)
      await expect(tid(page, `chapter-card-${locked[1]!}`)).toHaveAttribute('data-state', 'locked')
      await expectNoHorizontalScroll(page)
    },
  )

  test('E2E-M05-36 S4 "{n} soalan chapter" equals the sum of the S5 level options for every subject', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar2@demo.test')
    await gotoApp('/practice/chapter')
    const cards = page.locator('[data-testid=chapter-subject-name]')
    await expect(cards).toHaveCount(10)
    const totals = await page.locator('[data-testid=chapter-subject-questions]').allInnerTexts()
    const hrefs = await page
      .locator('[data-testid=chapter-subject-grid] a')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
    expect(hrefs).toHaveLength(10)
    for (const [i, href] of hrefs.slice(0, 3).entries()) {
      await gotoApp(href)
      await expect(page.locator('select option').first()).toBeAttached()
      const options = await page.locator('select option').allInnerTexts()
      const sum = options
        .map((o) => Number((o.split('—')[1] ?? '').replace(/[^\d]/g, '')))
        .reduce((a, b) => a + b, 0)
      expect(sum, href).toBe(num(totals[i]))
    }
  })

  test('E2E-M05-27 S5 ADDMATH shows the empty text and no level select (DV-M05-07)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar2@demo.test')
    await gotoApp('/practice/chapter/ADDMATH')
    await expect(page.getByText('Tiada bab tersedia untuk tahap ini.')).toBeVisible()
    await expect(page.locator('select')).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------------------------
// L17 Remedial: S13 -> Q4 as 3008, and the preview as guru
// ---------------------------------------------------------------------------------------------
test.describe('QA-G5 L17 remedial flow', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test(
    'E2E-M05-58 3008: S13 -> Q4 (5 questions) -> results with 1 coin per correct -> S13 shows "Selesai"',
    provisional('LS-12: the live remedial list and run were never observed'),
    async ({ page, gotoApp }) => {
      await addInitSession(page, 'murid3008@demo.test')
      await gotoApp('/remedial/saya')
      const card = tid(page, 'remedial-card-7601')
      await expect(card.getByTestId('remedial-subject')).toHaveText('Kimia')
      await expect(card.getByTestId('remedial-count')).toHaveText('5 soalan')
      await expect(card.getByTestId('remedial-start')).toHaveAttribute('href', '/remedial/7601')
      await expectNoHorizontalScroll(page)

      await card.getByTestId('remedial-start').click()
      await expect(page).toHaveURL(/\/remedial\/7601$/)
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 5')
      const right = await answerAll(page, 5)
      const score = right.filter(Boolean).length
      await expect(tid(page, 'result-score')).toHaveText(`${score}/5`)
      await expect(tid(page, 'reward-coins')).toHaveText(String(score))
      await expectNoHorizontalScroll(page)

      await tid(page, 'result-back').click()
      await expect(tid(page, 'remedial-card-7601').getByTestId('remedial-status')).toHaveText('Selesai')
      await expect(tid(page, 'remedial-card-7601').getByTestId('remedial-start')).toHaveCount(0)

      // A completed test cannot be run again: alert, back to S13.
      const dialog = acceptNextDialog(page, { type: 'alert' })
      await gotoApp('/remedial/7601')
      await dialog
      await expect(page).toHaveURL(/\/remedial\/saya$/)
    },
  )

  test(
    'E2E-M05-58 guru (teacher 5) previews 7601: read-only, correct option marked, nothing recorded',
    provisional('LS-12: the Q4 preview is PROPOSED (XL2-40)'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs('guru@demo.test')
      await gotoApp('/remedial/7601')
      await expect(tid(page, 'preview-banner')).toHaveText('Pratonton — jawapan tidak direkodkan.')
      for (let i = 1; i <= 5; i++) {
        await expect(page.locator(`[data-testid=preview-q-${i}] [data-correct=true]`)).toHaveCount(1)
      }
      await expect(page.locator('[data-testid=btn-check], [data-testid=option-A]')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
      const writes = (await mock.requests()).filter((r) => r.method !== 'GET')
      expect(writes.map((w) => `${w.method} ${w.path}`)).not.toContain('POST /api/practice/sessions')
    },
  )

  test(
    'E2E-M05-58 another teacher (guru2) gets the 404 page on 7601',
    provisional('LS-12: the Q4 preview is PROPOSED (XL2-40)'),
    async ({ page, gotoApp }) => {
      await addInitSession(page, 'guru2@demo.test')
      await gotoApp('/remedial/7601')
      await expectTabTitle(page, NOT_FOUND)
    },
  )

  test(
    'E2E-M05-58 3007 sees 7602 as "Selesai" with no start button',
    provisional('LS-12: the live remedial list was never observed'),
    async ({ page, gotoApp }) => {
      await addInitSession(page, 'murid3007@demo.test')
      await gotoApp('/remedial/saya')
      const card = tid(page, 'remedial-card-7602')
      await expect(card.getByTestId('remedial-status')).toHaveText('Selesai')
      await expect(card.getByTestId('remedial-start')).toHaveCount(0)
    },
  )

  test('E2E-M05-46 canonical pupils see the empty S13 and S14 states (FR-M05-115)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajarmaju@demo.test')
    await gotoApp('/remedial/saya')
    await expect(tid(page, 'remedial-empty')).toContainText('Tiada ujian remedial. Bagus — teruskan usaha!')
    await gotoApp('/misi-harian')
    await expect(tid(page, 'missions-empty')).toContainText('Tiada misi hari ini')
  })
})

// ---------------------------------------------------------------------------------------------
// L22 Soalan Berstruktur: S10 -> Q3 submit -> marks
// ---------------------------------------------------------------------------------------------
test.describe('QA-G5 L22 structured flow', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test(
    'E2E-M05-37/38 S10 -> "Mula" -> Q3 -> answer every sub-question -> "Hantar" -> total equals the sum of the marks',
    provisional('LS-7: the live answer page was never observed; copy is PROPOSED'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp('/latihan-berstruktur')
      const first = page.locator('[data-testid^=structured-card-]').first()
      await expect(first).toBeVisible()
      const href = await first.getByTestId('card-start').getAttribute('href')
      expect(href).toMatch(/^\/latihan-berstruktur\/\d+\/jawab$/)
      await first.getByTestId('card-start').click()
      await expect(page).toHaveURL(new RegExp(`${href}$`))

      const answers = page.getByTestId('sub-answer')
      const n = await answers.count()
      expect(n).toBeGreaterThan(0)
      const maxMarks = (await page.getByTestId('sub-marks').allInnerTexts()).map(num)
      expect(maxMarks).toHaveLength(n)
      for (let i = 0; i < n; i++) await answers.nth(i).fill(`Jawapan ${i + 1}`)
      await tid(page, 'answer-submit').click()

      const total = tid(page, 'answer-total')
      await expect(total).toHaveText(/Jumlah: \d+\/\d+ markah/)
      const [got, max] = (await total.innerText()).match(/(\d+)\/(\d+)/)!.slice(1).map(Number)
      const awarded = (await page.getByTestId('sub-awarded').allInnerTexts()).map(
        (t) => t.match(/(\d+)\/(\d+)/)!.slice(1).map(Number) as [number, number],
      )
      expect(awarded).toHaveLength(n)
      expect(awarded.map((a) => a[0]).reduce((a, b) => a + b, 0)).toBe(got)
      expect(awarded.map((a) => a[1]).reduce((a, b) => a + b, 0)).toBe(max)
      expect(awarded.map((a) => a[1])).toEqual(maxMarks)
      for (const [a, m] of awarded) expect(a).toBeLessThanOrEqual(m)
      await expect(page.getByText('Skema jawapan:').first()).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M05-38 submitting with every answer empty still returns marks (no crash)',
    provisional('LS-7: the live answer page was never observed'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp('/latihan-berstruktur/4454/jawab')
      await expect(tid(page, 'answer-stimulus')).toBeVisible()
      await tid(page, 'answer-submit').click()
      await expect(tid(page, 'answer-total')).toBeVisible()
    },
  )

  test('E2E-M05-55 S10 SPM and Tracking A variants keep scope/track/subject_id on "Cari" and "Mula"', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/latihan-berstruktur?subject_id=3&scope=spm')
    await expect(tid(page, 'structured-h1')).toHaveText('Subjektif SPM')
    await expect(tid(page, 'structured-back')).toHaveAttribute('href', '/spm/subjektif')
    await expect(tid(page, 'filter-subject').locator('option')).toHaveCount(16)
    await tid(page, 'filter-submit').click()
    await expect(page).toHaveURL(/scope=spm/)
    await expect(page.locator('[data-testid=card-start]').first()).toHaveAttribute('href', /\/jawab\?scope=spm$/)

    await gotoApp('/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa')
    await expect(tid(page, 'structured-h1')).toHaveText('Tracking A Bahasa')
    await expect(tid(page, 'structured-back')).toHaveAttribute('href', '/spm/ramalan')
    await expect(tid(page, 'filter-subject').locator('option')).toHaveCount(3)
    await expect(tid(page, 'structured-found')).toContainText('set ditemui')
    await expect(page.locator('[data-testid=card-start]').first()).toHaveAttribute(
      'href',
      /\/jawab\?scope=spm&track=bahasa$/,
    )

    await gotoApp('/latihan-berstruktur?subject_id=3&scope=spm&kbat_level=6')
    await expect(tid(page, 'structured-empty')).toContainText('Tiada soalan berstruktur buat masa ini')
  })
})

// ---------------------------------------------------------------------------------------------
// S14 / Q5 mission coins, Q6 question set, S15 targets
// ---------------------------------------------------------------------------------------------
test.describe('QA-G5 missions and sets', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0, now: '2026-09-22T10:00:00+08:00' } })

  test(
    'E2E-M05-59 mission 7101 as 3001: coins are 3 per correct answer, the card turns "Selesai", a second start is refused',
    provisional('LS-12: the live mission run was never observed'),
    async ({ page, gotoApp }) => {
      await addInitSession(page, 'murid3001@demo.test')
      await gotoApp('/misi-harian')
      // 7102 is dated another day and is not listed.
      await expect(tid(page, 'mission-card-7102')).toHaveCount(0)
      await tid(page, 'mission-card-7101').getByTestId('mission-start').click()
      const total = Number(((await tid(page, 'quiz-progress-text').textContent()) ?? '').match(/daripada (\d+)/)?.[1])
      const right = await answerAll(page, total)
      const score = right.filter(Boolean).length
      await expect(tid(page, 'reward-coins')).toHaveText(String(score * 3))
      await tid(page, 'result-back').click()
      await expect(tid(page, 'mission-card-7101').getByTestId('mission-done')).toHaveText('Selesai ✓')
    },
  )

  test(
    'E2E-M05-60 Q6 as 3001: set 7402 serves its 10 questions; after submit a second start says no attempts left',
    provisional('LS-12: the live question-set run was never observed'),
    async ({ page, gotoApp }) => {
      await addInitSession(page, 'murid3001@demo.test')
      await gotoApp('/set-soalan-saya/7402/jawab')
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 10')
      await expect(tid(page, 'shell-user-title')).toHaveText('Set Soalan Guru')
      await expectNoHorizontalScroll(page)
      const right = await answerAll(page, 10)
      await expect(tid(page, 'result-score')).toHaveText(`${right.filter(Boolean).length}/10`)
      await expectNoHorizontalScroll(page)

      const dialog = acceptNextDialog(page, { type: 'alert', message: 'Tiada percubaan lagi untuk set ini.' })
      await gotoApp('/set-soalan-saya/7402/jawab')
      await dialog
      await expect(page).toHaveURL(/\/set-soalan-saya$/)
    },
  )
})

test.describe('QA-G5 S15 SPM targets', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M05-47 admin: 20 rows from "Bahasa Arab" to "Tasawwur Islam", all "Belum mula", 10 grade options each', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/target-spm')
    await expect(page.locator('[data-testid=target-name]')).toHaveCount(20)
    const names = await page.locator('[data-testid=target-name]').allInnerTexts()
    expect(names).toHaveLength(20)
    expect(names[0]).toBe('Bahasa Arab')
    expect(names[19]).toBe('Tasawwur Islam')
    const status = await page.locator('[data-testid=target-status]').allInnerTexts()
    expect(new Set(status)).toEqual(new Set(['Belum mula']))
    const options = await page.locator('[data-testid=target-select]').first().locator('option').allInnerTexts()
    expect(options).toEqual(['Target', 'A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E'])
    await expect(page.getByText('50-69% (Perlu Usaha)')).toBeVisible()
    await expect(page.getByText('<50% (Perlu Fokus)')).toBeVisible()
    await expect(page.getByText('Tip: Jawab lebih banyak soalan untuk ramalan gred yang lebih tepat')).toBeVisible()
  })

  test('E2E-M05-47/48 pelajar: saved targets A / B+ / A- are selected; saving A+ for Fizik and clearing BM persists', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/target-spm')
    await expect(page.locator('[data-testid=target-name]')).toHaveCount(20)
    const rowFor = (name: string) =>
      page
        .locator('[data-testid^=target-row-]')
        .filter({ has: page.locator('[data-testid=target-name]', { hasText: new RegExp(`^${name}$`) }) })
    await expect(rowFor('Bahasa Melayu').getByTestId('target-select')).toHaveValue('A')
    await expect(rowFor('Matematik').getByTestId('target-select')).toHaveValue('B+')
    await expect(rowFor('Sejarah').getByTestId('target-select')).toHaveValue('A-')
    await rowFor('Fizik').getByTestId('target-select').selectOption('A+')
    await rowFor('Bahasa Melayu').getByTestId('target-select').selectOption('')
    await tid(page, 'targets-save').click()
    await expect(tid(page, 'targets-success')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-testid=target-name]')).toHaveCount(20, { timeout: 20_000 })
    await expect(rowFor('Fizik').getByTestId('target-select')).toHaveValue('A+')
    await expect(rowFor('Bahasa Melayu').getByTestId('target-select')).toHaveValue('')
    await gotoApp('/target-spm')
    await expect(page.locator('[data-testid=target-name]')).toHaveCount(20)
    await expect(rowFor('Fizik').getByTestId('target-select')).toHaveValue('A+')
  })
})

// ---------------------------------------------------------------------------------------------
// Menus (AC-35.1 .. 35.3)
// ---------------------------------------------------------------------------------------------
test.describe('QA-G5 menus', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  // /practice can take > 15 s to boot on a saturated machine: 90 s boot budget for these tests.
  const open = async (page: Page, path: string) => {
    await page.goto(path)
    await waitForApp(page, 90_000)
  }

  test('E2E-M05-50 sidebar (>= 1024) / drawer (< 1024): M05 items, hrefs and the active item', async ({
    page,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    await open(page, '/practice')
    await expect(tid(page, 'practice-title')).toBeVisible()
    const desktop = isDesktopShell(page)
    if (!desktop) {
      await expect(
        tid(page, 'shell-user-bottom-nav').getByRole('link', { name: 'Home' }),
      ).toHaveAttribute('href', '/dashboard')
      await tid(page, 'shell-user-hamburger').click()
    }
    const nav = desktop ? tid(page, 'shell-user-sidebar') : tid(page, 'shell-user-drawer')
    const hrefOf = async (name: string) =>
      nav.getByRole('link', { name, exact: true }).first().getAttribute('href')
    expect(await hrefOf('Latih Tubi')).toBe('/practice')
    expect(await hrefOf('Soalan by Chapter')).toBe('/practice/chapter')
    expect(await hrefOf('Soalan Berstruktur')).toBe('/latihan-berstruktur')
    expect(await hrefOf('Dashboard')).toBe('/dashboard')
    expect(await hrefOf('Pembetulan')).toBe('/pembetulan')
    expect(await hrefOf('Penguasaan')).toBe('/penguasaan')
    const extras = ['Target SPM', 'Misi Harian', 'Remedial']
    for (const name of extras) {
      const count = await nav.getByRole('link', { name, exact: true }).count()
      if (desktop) {
        expect(await hrefOf(name)).toBe(
          { 'Target SPM': '/target-spm', 'Misi Harian': '/misi-harian', Remedial: '/remedial/saya' }[name],
        )
      } else {
        expect(count, `${name} is not in the drawer`).toBe(0)
      }
    }
    if (desktop) {
      await expect(nav.locator('a.active')).toHaveCount(1)
      await expect(nav.locator('a.active')).toContainText('Latih Tubi')
    }
  })

  test('E2E-M05-50 the active sidebar item follows S4, S10, S13, S14 and S15 (desktop)', async ({
    page,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    test.skip(!isDesktopShell(page), 'the sidebar exists from 1024 px')
    // AC-35.3 / FN-M05-9.1.6: exactly one active item per page; none on S6 / S7.
    const expected: Array<[string, string, string[]]> = [
      ['/practice', 'practice-title', ['Latih Tubi']],
      ['/practice/MATH', 'config-name', ['Latih Tubi']],
      ['/practice/chapter', 'chapter-subject-grid', ['Soalan by Chapter']],
      ['/practice/chapter/MATH', 'chapter-card-1', ['Soalan by Chapter']],
      ['/practice/revision', 'revision-list-page', []],
      ['/latihan-berstruktur', 'structured-h1', ['Soalan Berstruktur']],
      ['/remedial/saya', 'remedial-h1', ['Remedial']],
      ['/misi-harian', 'missions-page', ['Misi Harian']],
      ['/target-spm', 'targets-page', ['Target SPM']],
    ]
    for (const [path, ready, labels] of expected) {
      await open(page, path)
      await expect(tid(page, ready)).toBeVisible()
      const active = (
        await tid(page, 'shell-user-sidebar').locator('a.active').allInnerTexts()
      ).map((t) => t.trim().replace(/\s+/g, ' '))
      expect(active, `active sidebar items on ${path}`).toEqual(labels)
    }
  })
})
