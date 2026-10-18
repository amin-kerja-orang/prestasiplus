/**
 * M05-T5 scenario coverage of SRS M05 v1.19 §12 rows 24–35 (S4 chapter subjects, S5 chapter list, Q2
 * chapter quiz, S6 revision list, S7 revision quiz) and the S4–S7 part of row 54, at 375 / 768 / 1280.
 * No E2E ids in the titles on purpose (QA writes them at G5, as for the T4 specs). Q2 (row 28) is
 * provisional (LS-3): live never opened the chapter quiz. S7 is SOURCE-DERIVED (live starts a session
 * on load), so its tests assert the captured source and are not tagged provisional.
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
const NOT_FOUND = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'

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

  test('header, hero and the 10 subject cards with their counts and links', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/practice/chapter')
    await expectTabTitle(page, 'Soalan by Chapter - PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Soalan by Chapter')
    if (isDesktopShell(page) || viewportWidth(page) >= 640) {
      await expect(tid(page, 'shell-user-subtitle')).toHaveText(
        'Latihan tersusun ikut bab buku teks dan DSKP',
      )
    }
    await expect(tid(page, 'chapter-index-page')).toContainText('Mode Sistematik')
    const eyebrow = tid(page, 'chapter-index-page').locator('p').first()
    expect(await eyebrow.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase')
    await expect(tid(page, 'chapter-index-page').getByRole('heading', { level: 1 })).toHaveText(
      'Soalan by Chapter',
    )
    await expect(tid(page, 'chapter-index-page')).toContainText(
      'Pelajar jawab bab demi bab. Bab seterusnya hanya terbuka selepas bab sebelumnya lengkap dan mencapai sekurang-kurangnya 70%.',
    )
    await expect(tid(page, 'chapter-random')).toHaveText('Latih Tubi Rawak')
    await expect(tid(page, 'chapter-random')).toHaveAttribute('href', '/practice')

    const expected: [string, string, string, string][] = [
      ['BM', 'Bahasa Melayu', '18', '4,833'],
      ['BI', 'Bahasa Inggeris', '14', '3,521'],
      ['MATH', 'Matematik', '25', '6,538'],
      ['SCI', 'Sains', '18', '4,903'],
      ['SEJ', 'Sejarah', '8', '1,931'],
      ['PI', 'Pendidikan Islam', '14', '3,371'],
      ['PM', 'Pendidikan Moral', '14', '3,307'],
      ['GEO', 'Geografi', '8', '800'],
      ['BA', 'Bahasa Arab', '17', '1,700'],
      ['JAWI', 'Jawi', '13', '1,300'],
    ]
    const cards = tid(page, 'chapter-subject-grid').locator('> a')
    await expect(cards).toHaveCount(10)
    for (const [i, [code, name, chapters, questions]] of expected.entries()) {
      const card = cards.nth(i)
      await expect(card).toHaveAttribute('href', `/practice/chapter/${code}`)
      await expect(card.getByTestId('chapter-subject-name')).toHaveText(name)
      await expect(card.getByTestId('chapter-subject-chapters')).toHaveText(
        `${chapters} bab tersedia`,
      )
      await expect(card.getByTestId('chapter-subject-questions')).toHaveText(
        `${questions} soalan chapter`,
      )
      await expect(
        card.getByTestId('chapter-subject-icon').locator('svg, span').first(),
      ).toBeVisible()
    }
    // Grid 1 / sm 2 / xl 3 columns.
    const width = viewportWidth(page)
    expect(await columnsOf(page, 'chapter-subject-grid')).toBe(
      width >= 1280 ? 3 : width >= 640 ? 2 : 1,
    )
    await expectNoHorizontalScroll(page)
  })

  test('the teacher opens S4', async ({ page, loginAs, gotoApp }) => {
    await loginAs('guru@demo.test')
    await gotoApp('/practice/chapter')
    await expect(tid(page, 'chapter-subject-grid').locator('> a')).toHaveCount(10)
    await expect(tid(page, 'shell-user-title')).toHaveText('Soalan by Chapter')
  })

  test('the S2 banner leads to S4', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/practice')
    await tid(page, 'chapter-banner').click()
    await expect(page).toHaveURL(/\/practice\/chapter$/)
    await expect(tid(page, 'chapter-subject-grid').locator('> a')).toHaveCount(10)
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

  test('Matematik as pelajar2: hero, level options, an open chapter and seven locked ones', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/practice/chapter/MATH')
    await expectTabTitle(page, 'Chapter Matematik - PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Soalan by Chapter')
    if (viewportWidth(page) >= 640) {
      await expect(tid(page, 'shell-user-subtitle')).toHaveText('Matematik')
    }
    await expect(tid(page, 'chapter-all-subjects')).toHaveAttribute('href', '/practice/chapter')
    await expect(tid(page, 'chapter-all-subjects')).toHaveText('Semua Subjek')
    const hero = tid(page, 'chapter-subject-hero')
    await expect(hero).toContainText('Progressive Unlock')
    expect(
      await hero
        .locator('p')
        .first()
        .evaluate((el) => getComputedStyle(el).textTransform),
    ).toBe('uppercase')
    await expect(tid(page, 'chapter-subject-name')).toHaveText('Matematik')
    await expect(hero).toContainText(
      'Lengkapkan semua soalan bab semasa dan capai 70% untuk buka bab seterusnya.',
    )

    const options = tid(page, 'chapter-level-select').locator('option')
    await expect(options).toHaveText([
      'Darjah 1 — 2,734 soalan',
      'Darjah 2 — 2,129 soalan',
      'Darjah 3 — 682 soalan',
      'Darjah 4 — 993 soalan',
    ])
    await expect(tid(page, 'chapter-level-select')).toHaveValue('1')

    const open = page.locator('[data-testid^=chapter-card-][data-state=open]')
    await expect(open).toHaveCount(1)
    await expect(tid(page, 'chapter-title-1')).toHaveText('Bab 1: Nombor Bulat hingga 100')
    await expect(tid(page, 'chapter-stats-1')).toHaveText('0/464 soalan unik · Skor 0% · 464 baki')
    await expect(tid(page, 'chapter-tile-1')).toHaveText('1')
    const links = tid(page, 'chapter-card-1').locator('a')
    await expect(links).toHaveText(['5 soalan', '10 soalan', '15 soalan', '20 soalan'])
    for (const [i, n] of [5, 10, 15, 20].entries()) {
      await expect(links.nth(i)).toHaveAttribute(
        'href',
        `/practice/chapter/MATH/1/quiz?count=${String(n)}`,
      )
    }
    const locked = page.locator('[data-testid^=chapter-card-][data-state=locked]')
    await expect(locked).toHaveCount(7)
    await expect(locked.first().getByText('Kunci bab sebelumnya')).toBeVisible()
    await expect(locked.first().locator('a')).toHaveCount(0)
    await expect(locked.first().locator('svg').first()).toBeVisible()
    await expectNoHorizontalScroll(page)

    await tid(page, 'chapter-level-select').selectOption('2')
    await expect(page).toHaveURL(/\/practice\/chapter\/MATH\?level=2$/)
    await expect(tid(page, 'chapter-level-select')).toHaveValue('2')
    await expect(page.locator('[data-testid^=chapter-card-][data-state=open]')).toHaveCount(1)
  })

  test('stored progress shows on open and locked cards: pelajarmaju Matematik and admin Bahasa Melayu', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJARMAJU)
    await gotoApp('/practice/chapter/MATH')
    await expect(tid(page, 'chapter-stats-1')).toHaveText(
      '20/464 soalan unik · Skor 95% · 444 baki',
    )
    const second = (await lockedIds(page))[0] ?? ''
    const third = (await lockedIds(page))[1] ?? ''
    await expect(tid(page, `chapter-stats-${second}`)).toHaveText(
      '5/302 soalan unik · Skor 60% · 297 baki',
    )
    await expect(tid(page, `chapter-stats-${third}`)).toHaveText(
      '5/316 soalan unik · Skor 80% · 311 baki',
    )
    await expect(tid(page, 'chapter-card-1')).toHaveAttribute('data-state', 'open')
    // The bar is answered ÷ total.
    await expect(tid(page, 'chapter-bar-1')).toHaveAttribute('style', /width: 4\.31\d*%/)
  })

  test('admin Bahasa Melayu: Bab 1 open, Bab 2 and 3 locked with their scores, as live', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/practice/chapter/BM')
    await expect(page.locator('[data-testid^=chapter-card-][data-state=open]')).toHaveCount(1)
    const open = page.locator('[data-testid^=chapter-card-][data-state=open]')
    await expect(open.getByRole('heading')).toContainText('Bab 1:')
    await expect(open.locator('p')).toHaveText('18/320 soalan unik · Skor 44.4% · 302 baki')
    const locked = page.locator('[data-testid^=chapter-card-][data-state=locked]')
    await expect(locked.nth(0).locator('p')).toHaveText('5/317 soalan unik · Skor 60% · 312 baki')
    await expect(locked.nth(1).locator('p')).toHaveText('10/321 soalan unik · Skor 80% · 311 baki')
  })

  test('Matematik Tambahan has no chapter and no level select', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/practice/chapter/ADDMATH')
    await expect(tid(page, 'chapter-empty')).toHaveText('Tiada bab tersedia untuk tahap ini.')
    await expect(tid(page, 'chapter-level-select')).toHaveCount(0)
    await expect(tid(page, 'chapter-subject-name')).toHaveText('Matematik Tambahan')
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
      const links = tid(page, 'chapter-card-1').locator('a')
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
      await loginAs(PELAJARMAJU)
      await gotoApp('/practice/chapter/MATH')
      await tid(page, 'chapter-count-1-5').click()
      await expect(page).toHaveURL(/\/practice\/chapter\/MATH\/1\/quiz\?count=5$/)
      await expect(tid(page, 'quiz-title')).toHaveText('Bab 1: Nombor Bulat hingga 100')
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 5')
      await expectTabTitle(page, 'Chapter Matematik - PRESTASIPLUS')
      await expect(tid(page, 'shell-user-title')).toHaveText('Soalan by Chapter')
      await expect(tid(page, 'chip-revision')).toHaveCount(0)
      await expect(tid(page, 'pill-wrong-times')).toHaveCount(0)
      await expectNoHorizontalScroll(page)

      const right = await answerAll(page, 5)
      const score = right.filter(Boolean).length
      await expect(tid(page, 'result-title')).toHaveText('Keputusan Latihan')
      await expect(tid(page, 'result-score')).toHaveText(`${score}/5`)
      await expect(tid(page, 'result-corrected')).toHaveCount(0)
      await expect(tid(page, 'result-back')).toHaveAttribute(
        'href',
        '/practice/chapter/MATH?level=1',
      )
      await expectNoHorizontalScroll(page)

      // S5 shows the five new unique answers (FR-M05-67): 20 + 5 answered.
      await tid(page, 'result-back').click()
      await expect(tid(page, 'chapter-stats-1')).toContainText('25/464 soalan unik')
    },
  )

  test(
    'completing a chapter with 90 % opens the next one; a locked chapter goes back to S5 without a session',
    provisional('LS-3: the unlock after a completed chapter was never observed on live'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(PELAJARMAJU)
      await gotoApp('/practice/chapter/MATH')
      const [second, third, fourth] = await lockedIds(page)
      expect(second).toBeTruthy()

      // A locked chapter: no session, back to S5 of its level (FR-M05-66).
      await gotoApp(`/practice/chapter/MATH/${fourth ?? ''}/quiz?count=5`)
      await expect(page).toHaveURL(/\/practice\/chapter\/MATH\?level=1$/)
      const posts = (await mock.requests('/api/practice/sessions')).filter(
        (r) => r.method === 'POST',
      )
      expect(posts.map((p) => p.status)).toEqual([409])
      await expect(page.getByTestId('quiz-runner')).toHaveCount(0)

      await mock.hook('answerChapter', 4, 1, { correctPct: 90 })
      await gotoApp('/practice/chapter/MATH')
      await expect(tid(page, 'chapter-stats-1')).toHaveText(
        '464/464 soalan unik · Skor 90.1% · 0 baki',
      )
      await expect(tid(page, 'chapter-card-1')).toHaveAttribute('data-state', 'open')
      await expect(tid(page, `chapter-card-${second ?? ''}`)).toHaveAttribute('data-state', 'open')
      await expect(tid(page, `chapter-card-${second ?? ''}`).locator('a')).toHaveCount(4)
      await expect(tid(page, `chapter-card-${third ?? ''}`)).toHaveAttribute('data-state', 'locked')
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
    await expectTabTitle(page, 'Soalan Aku Salah — PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Soalan Aku Salah')
    await expect(tid(page, 'shell-user-subtitle')).toHaveCount(0)
    await expect(tid(page, 'revision-list-page').getByRole('heading', { level: 1 })).toHaveText(
      'Soalan Aku Salah',
    )
    await expect(tid(page, 'revision-list-page')).toContainText(
      'Ulang kaji soalan yang pernah dijawab salah',
    )
    await expect(tid(page, 'revision-total')).toHaveText('72 soalan perlu diulang kaji')

    const cards = tid(page, 'revision-grid').locator('> a')
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
    await expectTabTitle(page, 'Ulang Kaji — Matematik')
    await expect(tid(page, 'shell-user-title')).toHaveText('Soalan Aku Salah')
    await expect(tid(page, 'shell-user-subtitle')).toHaveCount(0)
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
