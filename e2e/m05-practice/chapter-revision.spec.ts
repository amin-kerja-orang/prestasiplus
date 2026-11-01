/**
 * M05-T5 scenario coverage of SRS M05 v1.19 §12 rows 24–35 (S4 chapter subjects, S5 chapter list, Q2
 * chapter quiz, S6 revision list, S7 revision quiz) and the S4–S7 part of row 54, at 375 / 768 / 1280.
 * No E2E ids in the titles on purpose (QA writes them at G5, as for the T4 specs). Q2 (row 28) is
 * provisional (LS-3): live never opened the chapter quiz. S7 is SOURCE-DERIVED (live starts a session
 * on load), so its tests assert the captured source and are not tagged provisional.
 *
 * REQ-C-023 refresh (v2 shells, D72/D86): the page title is printed by the v2 shell navbar (Portal
 * Pembelajaran for pupils and teachers, Portal Pentadbiran for the admin), which has no subtitle for
 * pupils; tab titles end "| PRESTASIPLUS". R1 is secondary only (D72, D86, Q4: Darjah hidden), so S5
 * offers Tingkatan 4 / 5 only. REQ-B-040 (DV-M04-19): the mock links fictitious Tingkatan 4 / 5 SPM-pool
 * questions to chapters (Matematik 91, 92, 220 at T4 and 228 at T5; Sains 322, 323, 324 at T4 and 362,
 * 363 at T5), so S4 lists Matematik and Sains, S5 lists those chapters (Bab 1 open, the rest locked) and
 * Q2 runs on them. The e2e build uses the full data profile, so every chapter has far more than 5 questions.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const PELAJAR2 = 'pelajar2@demo.test'
const PELAJARMAJU = 'pelajarmaju@demo.test'

const tid = (page: Page, id: string) => page.getByTestId(id)
const NOT_FOUND = 'Halaman Tidak Dijumpai | PRESTASIPLUS'

/** The title the v2 shell prints in its navbar (Pembelajaran: h1, or `shell-title` when the page owns the h1; Pentadbiran: h1). */
const shellTitle = (page: Page) =>
  page
    .locator('[data-testid=pembelajaran-header], [data-testid=pentadbiran-header]')
    .locator('h1, [data-testid=shell-title]')
    .first()

/** S5 with no chapter at an offered level (BR-15): the empty state. */
const NO_CHAPTER = 'Tiada bab tersedia untuk tahap ini.'

/** Number of tracks of a CSS grid container. */
const columnsOf = (page: Page, testId: string) =>
  tid(page, testId).evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length,
  )

/** Ids of the locked chapter cards on S5, in order. */
async function lockedIds(page: Page): Promise<string[]> {
  await expect(page.locator('[data-testid^=chapter-card-][data-state=open]').first()).toBeVisible()
  const ids = await page
    .locator('[data-testid^=chapter-card-][data-state=locked]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''))
  return ids.map((x) => x.replace('chapter-card-', ''))
}

/** Picks "A", checks and goes on through question `count`; returns which answers were right. */
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

test.describe('M05 S4 chapter subjects', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('header, hero, "Latih Tubi Rawak" and the subject cards (Matematik and Sains)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/practice/chapter')
    await expectTabTitle(page, 'Soalan by Chapter | PRESTASIPLUS')
    // The shell prints the only h1; the subtitle reads "Pelajar jawab bab demi bab." (UX-67). The
    // admin's Portal Pentadbiran shows it under the shell title, the pupil's page shows it in the body.
    await expect(shellTitle(page)).toHaveText('Soalan by Chapter')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(['Soalan by Chapter'])
    await expect(
      page.getByText('Pelajar jawab bab demi bab.', { exact: true }).filter({ visible: true }),
    ).toHaveCount(1)
    const eyebrow = tid(page, 'chapter-index-page').getByText('Mode Sistematik', { exact: true })
    // The v2 `text-overline` style has no uppercase transform (D28-D32 theme), so only the copy is checked.
    await expect(eyebrow).toBeVisible()
    await expect(tid(page, 'chapter-random')).toHaveText('Latih Tubi Rawak')
    await expect(tid(page, 'chapter-random')).toHaveAttribute('href', '/practice')

    // D72/D86: the ten live (Darjah) subject cards are gone; BR-15 lists the subjects that have a
    // Tingkatan 4/5 chapter question: the mock links Matematik and Sains (REQ-B-040).
    await expect(tid(page, 'chapter-subjects-empty')).toHaveCount(0)
    await expect(tid(page, 'chapter-subject-grid').locator('li')).toHaveCount(2)
    await expect(tid(page, 'chapter-subject-MATH')).toContainText('Matematik')
    await expect(tid(page, 'chapter-subject-MATH')).toContainText('4 bab tersedia')
    await expect(tid(page, 'chapter-subject-SCI')).toContainText('Sains')
    await expect(tid(page, 'chapter-subject-SCI')).toContainText('5 bab tersedia')
    await expect(tid(page, 'chapter-subject-MATH')).toHaveAttribute(
      'href',
      '/practice/chapter/MATH',
    )
    await expectNoHorizontalScroll(page)
  })

  test('the teacher opens S4', async ({ page, loginAs, gotoApp }) => {
    await loginAs('guru@demo.test')
    await gotoApp('/practice/chapter')
    await expect(shellTitle(page)).toHaveText('Soalan by Chapter')
    await expect(tid(page, 'chapter-random')).toBeVisible()
    await expect(tid(page, 'chapter-subject-MATH')).toBeVisible()
    await expect(tid(page, 'chapter-subject-SCI')).toBeVisible()
  })

  test('the S2 banner leads to S4', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/practice')
    await tid(page, 'chapter-banner').click()
    await expect(page).toHaveURL(/\/practice\/chapter$/)
    await expect(shellTitle(page)).toHaveText('Soalan by Chapter')
    await expect(tid(page, 'chapter-subject-MATH')).toBeVisible()
    await tid(page, 'chapter-subject-MATH').click()
    await expect(page).toHaveURL(/\/practice\/chapter\/MATH$/)
  })

  test('"Latih Tubi Rawak" is a 44 px touch target below lg', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/practice/chapter')
    if (!isDesktopShell(page)) await expectTouchTarget(tid(page, 'chapter-random'))
    await tid(page, 'chapter-random').click()
    await expect(page).toHaveURL(/\/practice$/)
  })
})

test.describe('M05 S5 chapter list', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('Matematik as pelajar2: hero, Tingkatan 4/5 level options, Bab 1 open and the others locked', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/practice/chapter/MATH')
    await expectTabTitle(page, 'Chapter Matematik | PRESTASIPLUS')
    // Pupil shell: no subtitle; the subject is the page heading.
    await expect(shellTitle(page)).toHaveText('Soalan by Chapter')
    await expect(tid(page, 'chapter-all-subjects')).toHaveAttribute('href', '/practice/chapter')
    await expect(tid(page, 'chapter-all-subjects')).toHaveText('Semua Subjek')
    await expect(tid(page, 'chapter-subject-name')).toHaveText('Matematik')

    // D72 AC-02.1: only Tingkatan 4 and 5 are offered; the first one is selected.
    const select = tid(page, 'chapter-level-select')
    await expect(select).toHaveText(/^Tingkatan 4 — \d+ soalan$/)
    await select.click()
    await expect(page.getByRole('option')).toHaveText([
      /^Tingkatan 4 — \d+ soalan$/,
      /^Tingkatan 5 — \d+ soalan$/,
    ])
    await page.keyboard.press('Escape')

    // REQ-B-040: three linked chapters at T4; Bab 1 is open, the next two are locked (BR-16).
    await expect(page.locator('[data-testid^=chapter-card-]')).toHaveCount(3)
    await expect(tid(page, 'chapter-card-91')).toHaveAttribute('data-state', 'open')
    await expect(tid(page, 'chapter-card-92')).toHaveAttribute('data-state', 'locked')
    await expect(tid(page, 'chapter-card-220')).toHaveAttribute('data-state', 'locked')
    await expect(tid(page, 'chapter-empty')).toHaveCount(0)
    // UX-67: "Progressive Unlock" and the 70% rule show while a chapter is locked.
    await expect(tid(page, 'chapter-subject-hero')).toContainText('Progressive Unlock')
    await expect(tid(page, 'chapter-unlock-rule')).toBeVisible()
    await expectNoHorizontalScroll(page)

    await select.click()
    await page.getByRole('option', { name: /^Tingkatan 5 — \d+ soalan$/ }).click()
    await expect(page).toHaveURL(/\/practice\/chapter\/MATH\?level=11$/)
    await expect(select).toHaveText(/^Tingkatan 5 — \d+ soalan$/)
    // One linked chapter at T5: open, nothing locked, so no unlock rule.
    await expect(page.locator('[data-testid^=chapter-card-]')).toHaveCount(1)
    await expect(tid(page, 'chapter-card-228')).toHaveAttribute('data-state', 'open')
    await expect(tid(page, 'chapter-unlock-rule')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('a pupil with no answers sees 0 answered on the open and locked cards (pelajar2 Matematik)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/practice/chapter/MATH')
    await expect(tid(page, 'chapter-card-91')).toHaveAttribute('data-state', 'open')
    const stats = /^0\/\d+ soalan unik · Skor 0% · \d+ baki$/
    for (const id of ['91', '92', '220']) {
      await expect(tid(page, `chapter-stats-${id}`)).toHaveText(stats)
    }
    await expect(tid(page, 'chapter-bar-91')).toHaveAttribute('aria-label', 'Kemajuan bab 0%')
    expect(await lockedIds(page)).toEqual(['92', '220'])
  })

  test('admin Sains: Bab 1 open, Bab 2 and 3 locked; Bahasa Melayu has no chapter question', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/practice/chapter/SCI')
    await expect(page.locator('[data-testid^=chapter-card-][data-state=open]')).toHaveCount(1)
    await expect(tid(page, 'chapter-card-322')).toHaveAttribute('data-state', 'open')
    await expect(tid(page, 'chapter-card-322').getByRole('heading')).toContainText('Bab 1:')
    await expect(tid(page, 'chapter-card-323')).toHaveAttribute('data-state', 'locked')
    await expect(tid(page, 'chapter-card-324')).toHaveAttribute('data-state', 'locked')
    await gotoApp('/practice/chapter/BM')
    await expect(tid(page, 'chapter-empty')).toHaveText(NO_CHAPTER)
  })

  test('a subject with no Tingkatan 4/5 level (Jawi) has no chapter and no level select', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    // DV-M05-07 was Matematik Tambahan on live (no Darjah level). With Tingkatan 4/5 offered (D72)
    // Matematik Tambahan now has levels, so the Darjah-only Jawi is the subject with no offered level.
    await loginAs(PELAJAR2)
    await gotoApp('/practice/chapter/JAWI')
    await expect(tid(page, 'chapter-empty')).toHaveText(NO_CHAPTER)
    await expect(tid(page, 'chapter-level-select')).toHaveCount(0)
    await expect(tid(page, 'chapter-subject-name')).toHaveText('Jawi')
  })

  test('an unknown code is the 404 page', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/practice/chapter/XYZ')
    await expectTabTitle(page, NOT_FOUND)
  })

  test('titles wrap and the count links stay inside the card (no ellipsis)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/practice/chapter/MATH')
    const titles = page.locator('[data-testid^=chapter-title-]')
    await expect(titles.first()).toBeVisible()
    const n = await titles.count()
    expect(n).toBeGreaterThan(1)
    for (let i = 0; i < n; i++) {
      const style = await titles.nth(i).evaluate((el) => ({
        overflow: getComputedStyle(el).textOverflow,
        fits: el.scrollWidth <= el.clientWidth,
      }))
      expect(style.overflow).not.toBe('ellipsis')
      expect(style.fits).toBe(true)
    }
    if (isMobileWidth(page)) {
      // The four links wrap inside the card and each is a 44 px touch target below lg.
      const links = tid(page, 'chapter-card-91').locator('a')
      for (let i = 0; i < 4; i++) await expectTouchTarget(links.nth(i))
      await expectTouchTarget(tid(page, 'chapter-all-subjects'))
    }
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M05 Q2 chapter quiz', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test(
    'a chapter session serves unanswered chapter questions and the header and tab follow S5',
    provisional('LS-3: the live chapter quiz was never opened; the S7 source is the pattern'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR2)
      await gotoApp('/practice/chapter/MATH')
      await tid(page, 'chapter-count-91-5').click()
      await expect(page).toHaveURL(/\/practice\/chapter\/MATH\/91\/quiz\?count=5$/)
      await expect(tid(page, 'quiz-title')).toHaveText('Bab 1: Fungsi dan Persamaan Kuadratik')
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 5')
      await expectTabTitle(page, 'Chapter Matematik | PRESTASIPLUS')
      await expect(shellTitle(page)).toHaveText('Soalan by Chapter')
      await expect(tid(page, 'chip-revision')).toHaveCount(0)
      await expect(tid(page, 'pill-wrong-times')).toHaveCount(0)
      await expectNoHorizontalScroll(page)

      const right = await answerAll(page, 5)
      const score = right.filter(Boolean).length
      await expect(tid(page, 'result-title')).toHaveText('Kuiz Selesai!')
      await expect(tid(page, 'result-score')).toHaveText(`${score}/5`)
      await expectNoHorizontalScroll(page)

      // S5 shows the five new unique answers (FR-M05-67).
      await expect(tid(page, 'result-back')).toHaveAttribute(
        'href',
        '/practice/chapter/MATH?level=10',
      )
      await tid(page, 'result-back').click()
      await expect(tid(page, 'chapter-stats-91')).toContainText(/^5\/\d+ soalan unik/)
    },
  )

  test(
    'a locked chapter goes back to S5 without a session',
    provisional('LS-3: the unlock after a completed chapter was never observed on live'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(PELAJAR2)
      // A locked chapter (Bab 2): no session, back to S5 of its level (FR-M05-66).
      await gotoApp('/practice/chapter/MATH/92/quiz?count=5')
      await expect(page).toHaveURL(/\/practice\/chapter\/MATH\?level=10$/)
      const posts = (await mock.requests('/api/practice/sessions')).filter(
        (r) => r.method === 'POST',
      )
      expect(posts.map((p) => p.status)).toEqual([409])
      await expect(page.getByTestId('quiz-runner')).toHaveCount(0)
      await expect(tid(page, 'chapter-card-92')).toHaveAttribute('data-state', 'locked')
    },
  )

  test(
    'completing a chapter with 90 % opens the next one',
    provisional('LS-3: the unlock after a completed chapter was never observed on live'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(PELAJAR2)
      await gotoApp('/practice/chapter/MATH')
      await expect(tid(page, 'chapter-card-92')).toHaveAttribute('data-state', 'locked')
      // pelajar2 is user 3; MATH chapter 91 is Bab 1.
      await mock.hook('answerChapter', 3, 91, { correctPct: 90 })
      await gotoApp('/practice/chapter/MATH')
      await expect(tid(page, 'chapter-card-91')).toHaveAttribute('data-state', 'open')
      await expect(tid(page, 'chapter-card-92')).toHaveAttribute('data-state', 'open')
      await expect(tid(page, 'chapter-card-220')).toHaveAttribute('data-state', 'locked')
    },
  )

  test('an unknown code is the 404 page', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/chapter/XYZ/1/quiz?count=5')
    await expectTabTitle(page, NOT_FOUND)
  })

  test("a chapter that is not the subject's is the 404 page", async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/chapter/MATH/999999/quiz?count=5')
    await expectTabTitle(page, NOT_FOUND)
  })
})

test.describe('M05 S6 revision list', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('admin: header, banner, two subject cards, tips and back link', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/practice/revision')
    await expectTabTitle(page, 'Soalan Aku Salah | PRESTASIPLUS')
    // The shell prints the only h1; the admin's Portal Pentadbiran shows the lead under it.
    await expect(shellTitle(page)).toHaveText('Soalan Aku Salah')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(['Soalan Aku Salah'])
    await expect(
      page
        .getByText('Ulang kaji soalan yang pernah dijawab salah', { exact: true })
        .filter({ visible: true }),
    ).toHaveCount(1)
    await expect(tid(page, 'revision-total')).toHaveText('72 soalan perlu diulang kaji')

    const cards = tid(page, 'revision-grid').locator('a')
    await expect(cards).toHaveCount(2)
    await expect(cards.nth(0)).toHaveAttribute('href', '/practice/revision/BM')
    await expect(cards.nth(0).getByTestId('revision-subject-name')).toHaveText('Bahasa Melayu')
    await expect(cards.nth(0)).toContainText('Malay Language')
    await expect(cards.nth(0).getByTestId('revision-subject-count')).toHaveText('46 soalan salah')
    await expect(cards.nth(1)).toHaveAttribute('href', '/practice/revision/SEJ')
    await expect(cards.nth(1)).toContainText('History')
    await expect(cards.nth(1).getByTestId('revision-subject-count')).toHaveText('26 soalan salah')
    await expect(
      cards.nth(0).getByTestId('revision-subject-icon').locator('svg, span').first(),
    ).toBeVisible()

    await expect(tid(page, 'revision-tips')).toContainText('Tips Ulang Kaji')
    await expect(tid(page, 'revision-tips').locator('li')).toHaveText([
      'Soalan yang paling kerap dijawab salah akan dipaparkan dahulu',
      'Apabila anda jawab betul, soalan itu akan dikeluarkan dari senarai ini',
      'Anda tetap mendapat syiling dan coin seperti latihan biasa',
    ])
    await expect(tid(page, 'revision-back')).toHaveAttribute('href', '/practice')
    await expect(tid(page, 'revision-back')).toHaveText('Kembali ke Latihan')
    if (!isDesktopShell(page)) await expectTouchTarget(tid(page, 'revision-back'))
    const width = viewportWidth(page)
    expect(await columnsOf(page, 'revision-grid')).toBe(width >= 1024 ? 3 : width >= 640 ? 2 : 1)
    await expectNoHorizontalScroll(page)
  })

  test('a subject with no wrong answer goes back to S6 with a one-time flash', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/practice/revision/MATH')
    await expect(page).toHaveURL(/\/practice\/revision$/)
    await expect(tid(page, 'revision-flash')).toHaveText(
      'Tiada soalan salah untuk subjek ini. Tahniah!',
    )
    // The flash sits between the banner and the cards, as on live.
    const order = await page.evaluate(() => {
      const b = document.querySelector('[data-testid=revision-list-page]')!
      const f = document.querySelector('[data-testid=revision-flash]')!
      const g = document.querySelector('[data-testid=revision-grid]')!
      return [b.compareDocumentPosition(f), f.compareDocumentPosition(g)].map(
        (p) => (p & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      )
    })
    expect(order).toEqual([true, true])
    await expectNoHorizontalScroll(page)
    // A reload (a fresh boot) drops the flash.
    await gotoApp('/practice/revision')
    await expect(tid(page, 'revision-total')).toBeVisible()
    await expect(tid(page, 'revision-flash')).toHaveCount(0)
  })

  test('an unknown subject code is the 404 page', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/practice/revision/XYZ')
    await expectTabTitle(page, NOT_FOUND)
  })

  test('with no wrong answer at all S6 shows the banner at 0, no card, the tips and the link', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/practice/revision')
    await expect(tid(page, 'revision-total')).toHaveText('0 soalan perlu diulang kaji')
    await expect(tid(page, 'revision-grid')).toHaveCount(0)
    await expect(tid(page, 'revision-tips')).toBeVisible()
    await expect(tid(page, 'revision-back')).toBeVisible()
  })
})

test.describe('M05 S7 revision quiz', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('loading, header card, chips and the question card for pelajarmaju Matematik', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/revision')
    await mock.setLatency(1500, '/api/practice/sessions')
    await tid(page, 'revision-subject-MATH').click()
    await expect(page).toHaveURL(/\/practice\/revision\/MATH$/)
    await expect(tid(page, 'quiz-loading')).toContainText('Memuat Soalan Ulang Kaji...')
    await expect(tid(page, 'quiz-loading')).toContainText(
      'Menyediakan soalan yang pernah dijawab salah',
    )
    await expectNoHorizontalScroll(page)

    await expect(tid(page, 'quiz-title')).toHaveText('Ulang Kaji — Matematik')
    await expectTabTitle(page, 'Ulang Kaji — Matematik | PRESTASIPLUS')
    await expect(shellTitle(page)).toHaveText('Soalan Aku Salah')
    await expect(tid(page, 'quiz-progress-text')).toContainText(/Soalan 1 daripada \d+/)
    await expect(tid(page, 'chip-revision')).toHaveText(
      'Mode Ulang Kaji — soalan ini pernah dijawab salah',
    )
    await expect(tid(page, 'chip-revision-meta')).toContainText('soalan salah')
    await expect(tid(page, 'pill-wrong-times')).toContainText('Salah 2x')
    await expectNoHorizontalScroll(page)
  })

  test('a start error shows the alert with the message and returns to S6; a failed check marks the answer', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/revision')
    await mock.failNext('/api/practice/sessions', {
      status: 422,
      code: 'NOT_ENOUGH_QUESTIONS',
      message: 'Maaf, terdapat masalah memuatkan kuiz ulang kaji.',
    })
    const dialog = acceptNextDialog(page, {
      type: 'alert',
      message: 'Maaf, terdapat masalah memuatkan kuiz ulang kaji.',
    })
    await tid(page, 'revision-subject-MATH').click()
    await dialog
    await expect(page).toHaveURL(/\/practice\/revision$/)

    await tid(page, 'revision-subject-MATH').click()
    await expect(tid(page, 'quiz-title')).toBeVisible()
    await mock.failNext('/api/practice/sessions/*/check-answer', {
      status: 500,
      code: 'SERVER_ERROR',
      message: 'x',
    })
    await tid(page, 'option-A').click()
    await tid(page, 'btn-check').click()
    await expect(tid(page, 'feedback-title')).toHaveText('Masih belum tepat')
    await expect(tid(page, 'btn-report')).toBeVisible()
  })

  test('a run to the results: S7 bands copy, corrected line, rewards, review and the updated S6', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/revision')
    const before = Number(
      (
        (await tid(page, 'revision-subject-MATH')
          .getByTestId('revision-subject-count')
          .textContent()) ?? ''
      ).match(/\d+/)?.[0],
    )
    await tid(page, 'revision-subject-MATH').click()
    const total = Number(
      ((await tid(page, 'quiz-progress-text').textContent()) ?? '').match(/daripada (\d+)/)?.[1],
    )
    const right = await answerAll(page, total)
    const score = right.filter(Boolean).length
    const percent = Math.round((score / total) * 100)

    await expect(tid(page, 'result-title')).toHaveText('Keputusan Ulang Kaji')
    await expect(tid(page, 'result-subject')).toHaveText('Matematik')
    await expect(tid(page, 'result-score')).toHaveText(`${score}/${total}`)
    await expect(tid(page, 'result-percent')).toHaveText(`${percent}%`)
    const message =
      percent === 100
        ? 'Sempurna! Semua soalan salah berjaya diperbetulkan!'
        : percent >= 80
          ? 'Cemerlang! Hampir semua berjaya diperbetulkan!'
          : percent >= 50
            ? 'Bagus! Teruskan ulang kaji!'
            : 'Jangan putus asa! Cuba ulang kaji lagi!'
    await expect(tid(page, 'result-message')).toHaveText(message)
    if (percent >= 50) {
      await expect(tid(page, 'result-corrected')).toHaveText(
        `${score} soalan salah berjaya diperbetulkan!`,
      )
    } else {
      await expect(tid(page, 'result-corrected')).toHaveCount(0)
    }
    await expect(tid(page, 'result-rewards')).toBeVisible()
    await expect(tid(page, 'result-back')).toHaveAttribute('href', '/practice/revision')
    await expect(tid(page, 'result-back')).toHaveText('Senarai Subjek')
    await expect(tid(page, 'result-retry')).toHaveText('Ulang Kaji Lagi')
    await expect(tid(page, 'review-list')).toBeHidden()
    await tid(page, 'review-toggle').click()
    await expect(page.getByTestId('review-item')).toHaveCount(total)
    await expectNoHorizontalScroll(page)

    // Correct answers leave the queue (BR-14): S6 counts fewer wrong questions.
    await tid(page, 'result-back').click()
    const after = Number(
      (
        (await tid(page, 'revision-subject-MATH')
          .getByTestId('revision-subject-count')
          .textContent()) ?? ''
      ).match(/\d+/)?.[0] ?? '0',
    )
    expect(after).toBe(before - score)
  })

  test('"Lapor Soalan" opens the report modal with the revision source', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/revision/MATH')
    await tid(page, 'option-A').click()
    await tid(page, 'btn-check').click()
    await expectTouchTarget(tid(page, 'btn-report'))
    await tid(page, 'btn-report').click()
    await expect(tid(page, 'report-modal')).toBeVisible()
    await expect(tid(page, 'report-modal')).toContainText('Lapor Soalan')
    await page.keyboard.press('Escape')
    await expect(tid(page, 'report-modal')).toHaveCount(0)
  })
})
