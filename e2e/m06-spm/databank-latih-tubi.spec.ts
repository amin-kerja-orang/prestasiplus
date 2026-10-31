/**
 * M06-T2 S2 databank + Q1, S3/S4 latih tubi + Q2 (SRS M06 v1.4 §12: E2E-M06-03, -07 … -14, -41, and the
 * S2–S4/Q1/Q2 part of -04, -06, -39, -40). Every test runs on the three viewport projects.
 * Provisional: the quiz pages Q1/Q2 were never opened live (L-1, L-3), and the S4 seed split is PROPOSED
 * (DV-M06-01).
 */

import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
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
import {
  answerFrom,
  columnsOf,
  DATABANK,
  NOT_FOUND,
  PELAJAR,
  smallTexts,
  tabCount,
  tid,
} from './support'

test.describe('M06 S2 databank', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M06-07 header, 18 cards in order, BM card, 5/10/20 links, plain "Mula", no year select, query ignored', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/tahun-lepas')
    await expectTabTitle(page, 'Databank Soalan SPM | PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Databank Soalan SPM')
    if (isDesktopShell(page)) {
      await expect(tid(page, 'shell-user-subtitle')).toHaveText('Selamat datang kembali')
    }
    await expect(tid(page, 'spm-back')).toHaveText('Kembali ke Mod SPM')
    await expect(tid(page, 'spm-back')).toHaveAttribute('href', '/spm')
    await expect(tid(page, 'spm-heading')).toHaveText('Databank Soalan SPM')
    await expect(tid(page, 'spm-sub')).toHaveText('Pilih subjek dan mula jawab dari bank soalan')

    const cards = page.locator('[data-testid^=databank-card-]')
    await expect(cards).toHaveCount(18)
    await expect(
      cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid'))),
    ).resolves.toEqual(DATABANK.map(([code]) => `databank-card-${code}`))
    for (const [code, name, count] of DATABANK) {
      const card = tid(page, `databank-card-${code}`)
      await expect(card.getByTestId('databank-name')).toHaveText(name)
      await expect(card.getByTestId('databank-count')).toHaveText(`${count} soalan dalam databank`)
    }
    const bm = tid(page, 'databank-card-BM')
    await expect(bm.getByTestId('databank-name-en')).toHaveText('Malay Language')
    await expect(bm).toContainText('Pilih set:')
    const links = bm.locator('a')
    await expect(links).toHaveText(['5', '10', '20'])
    await expect(links.nth(1)).toHaveAttribute('href', '/spm/tahun-lepas/BM/quiz?count=10')
    // "Mula" is plain text (D-5), not a link; the cards are not links.
    const mula = bm.getByTestId('databank-mula')
    await expect(mula).toHaveText('Mula')
    expect(await mula.evaluate((el) => el.closest('a'))).toBeNull()
    expect(await cards.first().evaluate((el) => el.tagName)).toBe('DIV')
    await expect(page.locator('select')).toHaveCount(0)
    // Every icon tile shows a glyph (DV-M06-03).
    const blank = await page
      .getByTestId('databank-icon')
      .evaluateAll(
        (els) => els.filter((e) => e.querySelector('svg') === null && !e.textContent.trim()).length,
      )
    expect(blank).toBe(0)

    const width = viewportWidth(page)
    expect(await columnsOf(page, 'databank-grid')).toBe(width >= 1024 ? 3 : width >= 768 ? 2 : 1)
    await expectTouchTarget(links.first())
    await expectNoHorizontalScroll(page)

    await gotoApp('/spm/tahun-lepas?subject=MATH')
    await expect(page.locator('[data-testid^=databank-card-]')).toHaveCount(18)
  })

  test('E2E-M06-39 S2 has no text below 12px', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/tahun-lepas')
    await expect(tid(page, 'databank-grid')).toBeVisible()
    expect(await smallTexts(page)).toEqual([])
  })

  test(
    'E2E-M06-08 Q1: click "10" on BM, answer all, finish; S10 and S1 show the session',
    provisional(
      'L-1/L-2: the live databank quiz was never opened; the quiz page is the M05 component',
    ),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(PELAJAR)
      await gotoApp('/spm/tahun-lepas')
      await tid(page, 'databank-set-BM-10').click()
      await expect(page).toHaveURL(/\/spm\/tahun-lepas\/BM\/quiz\?count=10$/)
      await expect(tid(page, 'quiz-title')).toHaveText('Bahasa Melayu')
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 10')
      await expect(tid(page, 'shell-user-title')).toHaveText('Databank Soalan SPM')

      const posts = (await mock.requests('/api/practice/sessions')).filter(
        (r) => r.method === 'POST',
      )
      expect(posts).toHaveLength(1)
      expect(posts[0]?.body).toMatchObject({ mode: 'past_year', subjectCode: 'BM', count: 10 })

      await expectNoHorizontalScroll(page)
      await tid(page, 'option-A').click()
      await tid(page, 'btn-check').click()
      await tid(page, 'btn-report').click()
      await expect(tid(page, 'report-modal')).toBeVisible()
      await page.keyboard.press('Escape')
      await tid(page, 'btn-next').click()

      const rest = await answerFrom(page, 2, 10)
      await expect(tid(page, 'quiz-results')).toBeVisible()
      const total = rest.filter(Boolean).length
      await expect(tid(page, 'result-score')).toContainText('/10')
      await expectNoHorizontalScroll(page)

      await gotoApp('/spm/history')
      const first = page.getByTestId('history-row').first()
      await expect(first.getByTestId('row-badge')).toHaveText('Tahun Lepas')
      await expect(first.getByTestId('row-correct')).toHaveText(/^\d+\/10 betul\s*$/)
      await expect(first.getByTestId('row-coins')).toHaveText(/^\s*\+\d+ 🪙\s*$/)
      expect(total).toBeGreaterThanOrEqual(0)
      await gotoApp('/spm')
      await expect(
        page.locator('[data-testid=spm-mine-sessions] [data-testid=mine-value]'),
      ).toHaveText('5')
    },
  )

  test(
    'Q1 refuses a count outside 5/10/20 and goes back to S2',
    provisional('BR-M06-13: client-side count rule is INFERRED'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR)
      page.on('dialog', (d) => void d.dismiss())
      await gotoApp('/spm/tahun-lepas/BM/quiz?count=7')
      await expect(page).toHaveURL(/\/spm\/tahun-lepas$/)
      await expect(tid(page, 'databank-grid')).toBeVisible()
    },
  )
})

test.describe('M06 S3 latih tubi', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M06-09 header, sections with counts, order, counts equal S2, target chips', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/latih-tubi')
    await expectTabTitle(page, 'Latih Tubi SPM | PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Latih Tubi SPM')
    await expect(tid(page, 'spm-back')).toHaveText('Kembali ke Mod SPM')
    await expect(tid(page, 'spm-heading')).toHaveText('Latih Tubi SPM')
    await expect(tid(page, 'spm-sub')).toHaveText(
      'Pilih subjek untuk mula berlatih',
    )
    await expect(page.getByTestId('section-heading')).toHaveText([
      'Subjek Teras (7)',
      'Subjek Elektif (12)',
    ])

    const order = await page
      .locator('[data-testid^=latih-tubi-card-]')
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute('data-testid')?.replace('latih-tubi-card-', '')),
      )
    expect(order).toEqual([
      'BM',
      'BI',
      'MATH',
      'SCI',
      'SEJ',
      'PI',
      'PM',
      'GEO',
      'BIO',
      'CHEM',
      'PHY',
      'PERNIAGA',
      'AKAUN',
      'EKON',
      'ADDMATH',
      'PSV',
      'BA',
      'TI',
      'PSI',
    ])
    for (const [code, , count] of DATABANK) {
      await expect(tid(page, `latih-tubi-card-${code}`).getByTestId('latih-tubi-count')).toHaveText(
        `${count} soalan`,
      )
    }
    await expect(tid(page, 'latih-tubi-card-BA').getByTestId('latih-tubi-count')).toHaveText(
      '0 soalan',
    )
    const targets: Record<string, string | null> = {
      BM: 'Target Custom: 34',
      BI: 'Target Custom: 36',
      MATH: 'Target SPM: 40',
      SCI: 'Target SPM: 40',
      SEJ: 'Target SPM: 40',
      GEO: 'Target SPM: 40',
      BIO: 'Target SPM: 40',
      CHEM: 'Target SPM: 40',
      PHY: 'Target SPM: 40',
      PI: 'Target Latihan: 40',
      PM: 'Target Latihan: 40',
      EKON: 'Target Latihan: 40',
      BA: 'Target Latihan: 40',
      PSI: 'Target Latihan: 40',
      ADDMATH: 'Target Latihan: 20',
      PERNIAGA: null,
      AKAUN: null,
      PSV: null,
      TI: null,
    }
    for (const [code, text] of Object.entries(targets)) {
      const chip = tid(page, `latih-tubi-card-${code}`).getByTestId('latih-tubi-target')
      if (text === null) await expect(chip).toHaveCount(0)
      else await expect(chip).toHaveText(text)
    }
    await expect(tid(page, 'latih-tubi-card-MATH')).toHaveAttribute('href', '/spm/latih-tubi/MATH')
    const width = viewportWidth(page)
    const cols = await page
      .locator('[data-testid=latih-tubi-section-teras] .grid')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(cols).toBe(width >= 1024 ? 3 : width >= 768 ? 2 : 1)
    await expectNoHorizontalScroll(page)
    expect(await smallTexts(page)).toEqual([])
  })

  test('E2E-M06-10 Bahasa Arab is the locked card; S4 stays reachable with all counts 0', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/latih-tubi')
    const ba = tid(page, 'latih-tubi-card-BA')
    await expect(ba).toHaveClass(/border-amber-300/)
    await expect(ba).toHaveClass(/pointer-events-none/)
    await expect(ba).toHaveAttribute('href', 'javascript:void(0)')
    await expect(ba.getByTestId('latih-tubi-count')).toHaveText('0 soalan')
    await expect(ba.getByTestId('latih-tubi-locked')).toHaveText('Locked: 0/40')
    await expect(ba.locator('svg').last()).toBeVisible()
    await ba.click({ force: true })
    await expect(page).toHaveURL(/\/spm\/latih-tubi$/)

    await gotoApp('/spm/latih-tubi/BA')
    await expect(tid(page, 'config-sub')).toContainText('0 soalan tersedia')
    await expect(tid(page, 'level-10').getByTestId('level-count')).toHaveText('0 soalan')
    await expect(tid(page, 'level-11').getByTestId('level-count')).toHaveText('0 soalan')
    await expect(page.getByTestId('difficulty-count')).toHaveText(Array(5).fill('0 soalan'))
  })
})

test.describe('M06 S4 settings and Q2', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  const diff = async (page: Page) => page.getByTestId('difficulty-count').allInnerTexts()

  test(
    'E2E-M06-11 MATH settings: header, tab title, level and difficulty counts, select/clear, SCI formats',
    provisional('DV-M06-01: the S4 seed split is PROPOSED (live counts differ from S3)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR)
      await gotoApp('/spm/latih-tubi/MATH')
      await expectTabTitle(page, 'Latih Tubi SPM — Matematik')
      await expect(tid(page, 'shell-user-title')).toHaveText('Latih Tubi SPM — Matematik')
      await expect(tid(page, 'shell-user-subtitle')).toHaveCount(0)
      await expect(tid(page, 'spm-back')).toHaveText('Kembali ke Senarai Subjek')
      await expect(tid(page, 'spm-back')).toHaveAttribute('href', '/spm/latih-tubi')
      await expect(tid(page, 'config-title')).toHaveText('Matematik')
      await expect(tid(page, 'config-sub')).toHaveText(
        /1,681 soalan tersedia\s*· Target SPM set: 40 soalan/,
      )
      await expect(tid(page, 'config-icon').locator('svg')).toBeVisible()

      expect(await tabCount(page, 'level-10')).toBe('976 soalan')
      expect(await tabCount(page, 'level-11')).toBe('705 soalan')
      expect(await diff(page)).toEqual(['514 soalan', '577 soalan', '85 soalan', '0 soalan'])
      await expect(page.getByText('Biarkan kosong untuk campuran semua tahap')).toBeVisible()

      await tid(page, 'level-10').click()
      await expect(tid(page, 'level-10')).toHaveClass(/border-blue-500/)
      await expect(tid(page, 'level-10')).toHaveClass(/bg-blue-50/)
      expect(await diff(page)).toEqual(['309 soalan', '410 soalan', '58 soalan', '0 soalan'])
      await tid(page, 'level-11').click()
      expect(await diff(page)).toEqual(['205 soalan', '167 soalan', '27 soalan', '0 soalan'])
      await tid(page, 'level-11').click()
      await expect(tid(page, 'level-11')).not.toHaveClass(/border-blue-500/)
      expect(await diff(page)).toEqual(['514 soalan', '577 soalan', '85 soalan', '0 soalan'])

      await tid(page, 'difficulty-2').click()
      await expect(tid(page, 'difficulty-2')).toHaveClass(/border-green-500/)
      await tid(page, 'difficulty-3').click()
      await expect(tid(page, 'difficulty-3')).toHaveClass(/border-yellow-500/)
      await expect(tid(page, 'difficulty-2')).not.toHaveClass(/border-green-500/)
      await tid(page, 'difficulty-4').click()
      await expect(tid(page, 'difficulty-4')).toHaveClass(/border-orange-500/)
      await tid(page, 'difficulty-5').click()
      await expect(tid(page, 'difficulty-5')).toHaveClass(/border-red-500/)
      await tid(page, 'difficulty-5').click()
      await expect(tid(page, 'difficulty-5')).not.toHaveClass(/border-red-500/)

      // Unformatted difficulty counts vs separated level counts (D-6, replicated).
      await gotoApp('/spm/latih-tubi/SCI')
      await expect(tid(page, 'difficulty-2').getByTestId('difficulty-count')).toHaveText(
        '1299 soalan',
      )
      await expect(tid(page, 'level-10').getByTestId('level-count')).toHaveText('1,172 soalan')
      await expect(tid(page, 'difficulty-5').getByTestId('difficulty-count')).toHaveText('0 soalan')
      await expectNoHorizontalScroll(page)
    },
  )

  test('E2E-M06-12 count options, helpers and the "Mula Kuiz" href', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/latih-tubi/MATH')
    await expect(page.locator('[data-testid^=count-]')).toHaveText(['40 (Target SPM)'])
    await expect(tid(page, 'count-40')).toHaveClass(/bg-blue-500/)
    await expect(tid(page, 'config-helper')).toHaveText(
      'Set penuh target spm untuk Matematik disasar pada 40 soalan.',
    )
    await expect(tid(page, 'config-start')).toHaveText('Mula Kuiz')
    await expect(tid(page, 'config-start')).toHaveAttribute(
      'href',
      '/spm/latih-tubi/MATH/quiz?count=40',
    )
    await tid(page, 'level-10').click()
    await expect(tid(page, 'config-start')).toHaveAttribute(
      'href',
      '/spm/latih-tubi/MATH/quiz?count=40&level=10',
    )
    await tid(page, 'level-11').click()
    await tid(page, 'difficulty-4').click()
    await expect(tid(page, 'config-start')).toHaveAttribute(
      'href',
      '/spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=4',
    )
    await expectTouchTarget(tid(page, 'config-start'))

    await gotoApp('/spm/latih-tubi/BM')
    await expect(tid(page, 'config-helper')).toHaveText(
      'Set penuh target custom untuk Bahasa Melayu disasar pada 34 soalan.',
    )
    await expect(tid(page, 'count-34')).toHaveText('34 (Target Custom)')
    await gotoApp('/spm/latih-tubi/ADDMATH')
    await expect(tid(page, 'config-helper')).toHaveText(
      'Set penuh target latihan untuk Matematik Tambahan disasar pada 20 soalan.',
    )

    await gotoApp('/spm/latih-tubi/PERNIAGA')
    await expect(page.locator('[data-testid^=count-]')).toHaveText([
      '5',
      '10',
      '20',
      '30',
      '40',
      '50',
      '60',
    ])
    await expect(tid(page, 'count-10')).toHaveClass(/bg-blue-500/)
    await expect(tid(page, 'config-helper')).toHaveText(
      'Pilih bilangan soalan ikut keperluan latihan anda.',
    )
    await tid(page, 'count-30').click()
    await expect(tid(page, 'config-start')).toHaveAttribute(
      'href',
      '/spm/latih-tubi/PERNIAGA/quiz?count=30',
    )
  })

  test('E2E-M06-40 S4 difficulty is 2 per row at 375 and 4 per row from 640; "Pertengahan" stays inside', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/latih-tubi/MATH')
    expect(await columnsOf(page, 'config-difficulties')).toBe(isMobileWidth(page) ? 2 : 4)
    const inside = await tid(page, 'difficulty-3').evaluate(
      (el) => el.scrollWidth <= el.clientWidth,
    )
    expect(inside).toBe(true)
    await expectNoHorizontalScroll(page)
    expect(await smallTexts(page)).toEqual([])
    if (isMobileWidth(page)) {
      for (const id of ['level-10', 'difficulty-2', 'count-40']) {
        await expectTouchTarget(tid(page, id))
      }
    }
  })

  test(
    'E2E-M06-13 Q2: MATH count=40 level=11 difficulty=4 starts the filtered session and S10 lists it',
    provisional('L-3/L-4: the live quiz was never opened; the seed split (27) is PROPOSED'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(PELAJAR)
      await gotoApp('/spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=4')
      await expect(tid(page, 'quiz-title')).toHaveText('Matematik')
      await expect(tid(page, 'shell-user-title')).toHaveText('Latih Tubi SPM')
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 27')
      const posts = (await mock.requests('/api/practice/sessions')).filter(
        (r) => r.method === 'POST',
      )
      expect(posts[0]?.body).toMatchObject({
        mode: 'latih_tubi',
        subjectCode: 'MATH',
        count: 40,
        levelId: 11,
        difficulty: 4,
      })
      await tid(page, 'option-A').click()
      await tid(page, 'btn-check').click()
      await expect(tid(page, 'btn-report')).toBeVisible()
      await tid(page, 'btn-next').click()
      const rest = await answerFrom(page, 2, 27)
      await expect(tid(page, 'quiz-results')).toBeVisible()
      expect(rest).toHaveLength(26)

      await gotoApp('/spm/history?type=latih_tubi')
      const rows = page.getByTestId('history-row')
      await expect(rows).toHaveCount(2)
      await expect(rows.first().getByTestId('row-correct')).toHaveText(/^\d+\/27 betul\s*$/)
      await expect(rows.first().getByTestId('row-badge')).toHaveText('Latih Tubi')
    },
  )

  test(
    'E2E-M06-41 single-question form: an active SPM question starts; an inactive or foreign one goes back to S4',
    provisional('FR-M06-87: the refusal path is INFERRED (L-3)'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(PELAJAR)
      await gotoApp('/spm/latih-tubi/MATH/quiz?question_id=570024&count=1')
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 1')
      const posts = (await mock.requests('/api/practice/sessions')).filter(
        (r) => r.method === 'POST',
      )
      expect(posts[0]?.body).toMatchObject({
        mode: 'latih_tubi',
        count: 1,
        targetQuestionId: 570024,
      })
      expect(posts[0]?.status).toBe(201)

      for (const id of [136891, 564159]) {
        await gotoApp(`/spm/latih-tubi/MATH/quiz?question_id=${String(id)}&count=1`)
        await expect(page).toHaveURL(/\/spm\/latih-tubi\/MATH$/)
        await expect(tid(page, 'config-title')).toHaveText('Matematik')
        await expect(page.getByTestId('quiz-runner')).toHaveCount(0)
      }
    },
  )

  test('E2E-M06-06 an unknown subject on S4 is the 404 page with "Mula Latihan"', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/latih-tubi/XYZ')
    await expectTabTitle(page, NOT_FOUND)
    await expect(page.getByRole('link', { name: 'Mula Latihan' })).toHaveAttribute(
      'href',
      '/practice',
    )
  })
})

test.describe('M06 Q2 no matching question', { tag: [moduleTag(6)] }, () => {
  test.use({
    mockInit: { latency: 0, overrides: { questionStore: { spmPool: { MATH: { 11: { 4: 3 } } } } } },
  })

  test(
    'E2E-M06-14 a thin pool serves what matches; difficulty 5 shows the message with "Kembali" to S4',
    provisional('FR-M06-33: the zero-question message is PROPOSED COPY (L-3)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR)
      await gotoApp('/spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=4')
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 3')

      await gotoApp('/spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=5')
      await expect(tid(page, 'spm-no-questions')).toContainText(
        'Tiada soalan untuk pilihan ini.',
      )
      await expectNoHorizontalScroll(page)
      await tid(page, 'spm-no-questions-back').click()
      await expect(page).toHaveURL(/\/spm\/latih-tubi\/MATH$/)
      await expect(tid(page, 'config-title')).toHaveText('Matematik')
    },
  )
})

test.describe('M06 count consistency', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M06-03 S2 = S3 = S4 total, T4 + T5 = total for every subject; hub chips stay below the total', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/tahun-lepas')
    const s2 = new Map<string, string>()
    for (const [code] of DATABANK) {
      s2.set(
        code,
        (
          await tid(page, `databank-card-${code}`).getByTestId('databank-count').innerText()
        ).replace(' soalan dalam databank', ''),
      )
    }
    await gotoApp('/spm/latih-tubi')
    const num = (s: string) => Number(s.replace(/[^\d]/g, ''))
    for (const [code, count] of s2) {
      const s3 = (
        await tid(page, `latih-tubi-card-${code}`).getByTestId('latih-tubi-count').innerText()
      ).replace(' soalan', '')
      expect(s3, `S3 ${code}`).toBe(count)
    }
    // S4 for every subject, reached in the app (history back keeps the session and the boot).
    for (const code of [...s2.keys(), 'BA']) {
      if (code === 'BA') await gotoApp('/spm/latih-tubi/BA')
      else await tid(page, `latih-tubi-card-${code}`).click()
      await expect(tid(page, 'config-title')).toBeVisible()
      const total = num((await tid(page, 'config-sub').innerText()).split('soalan')[0] ?? '')
      expect(total, `S4 ${code} total`).toBe(code === 'BA' ? 0 : num(s2.get(code) ?? '0'))
      const t4 = num(await tabCount(page, 'level-10'))
      const t5 = num(await tabCount(page, 'level-11'))
      expect(t4 + t5, `S4 ${code} T4 + T5`).toBe(total)
      if (code !== 'BA') {
        await page.goBack()
        await expect(tid(page, 'latih-tubi-card-MATH')).toBeVisible()
      }
    }

    await gotoApp('/spm')
    const total = num(
      await page.locator('[data-testid=spm-stat-total] [data-testid=stat-value]').innerText(),
    )
    for (const chip of await page.getByTestId('module-chip').allInnerTexts()) {
      if (/soalan$/.test(chip)) expect(num(chip)).toBeLessThanOrEqual(total)
    }
  })
})
