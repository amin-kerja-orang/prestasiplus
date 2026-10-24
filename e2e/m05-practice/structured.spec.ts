/**
 * M05-T7 scenario coverage of SRS M05 v1.19 §12 rows 36–38 and 55–56 (S10 structured list, its SPM
 * variants `scope=spm` / `track=bahasa`, and Q3 the structured answer page) at 375 / 768 / 1280.
 * No E2E ids in the titles on purpose: QA writes them at G5. The Q3 rows are provisional (LS-7: live
 * never opened the answer page).
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
const NOT_FOUND = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'

const tid = (page: Page, id: string) => page.getByTestId(id)

// Several full page loads per test: give the shared build server room when workers compete.
test.describe.configure({ timeout: 120_000 })

const columnsOf = (page: Page, testId: string) =>
  tid(page, testId).evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length,
  )

test.describe('M05 S10 structured list', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('header, heading, filter options and cards', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await gotoApp('/latihan-berstruktur')
    await expectTabTitle(page, 'Soalan Berstruktur - PRESTASIPLUS')
    // DV-M05-01: no subtitle in the shell header.
    await expect(tid(page, 'shell-user-title')).toHaveText('Soalan Berstruktur')
    await expect(tid(page, 'structured-h1')).toHaveText('Soalan Berstruktur')
    await expect(tid(page, 'structured-sub')).toHaveText(
      'Latih tubi format Kertas 2 — jawab & semak secara automatik',
    )
    // "Semua Subjek" + the 31 subjects; "Semua" + KBAT 1–6.
    await expect(page.locator('[data-testid=filter-subject] option')).toHaveCount(32)
    await expect(page.locator('[data-testid=filter-kbat] option')).toHaveCount(7)
    await expect(page.locator('[data-testid=filter-kbat] option').nth(1)).toHaveText('1. Mengingat')
    await expect(page.locator('[data-testid=filter-kbat] option').nth(6)).toHaveText('6. Mencipta')

    const cards = page.locator('[data-testid^=structured-card-]')
    await expect(cards).toHaveCount(20)
    const card = cards.first()
    await expect(card.getByTestId('card-subject')).not.toBeEmpty()
    await expect(card.getByTestId('card-minutes')).toHaveText(/^\d+m$/)
    await expect(card.getByTestId('card-footer')).toContainText(/\d+ soalan · /)
    await expect(card.getByTestId('card-start')).toHaveAttribute(
      'href',
      /^\/latihan-berstruktur\/\d+\/jawab$/,
    )
    await expectTouchTarget(card.getByTestId('card-start'))
    await expectTouchTarget(tid(page, 'filter-submit'))
    // Plain list: no variant-only lines.
    await expect(page.getByTestId('card-parts')).toHaveCount(0)
    await expect(page.getByTestId('card-level-chip')).toHaveCount(0)

    // 1 / `sm` 2 / `xl` 3 columns.
    const w = viewportWidth(page)
    expect(await columnsOf(page, 'structured-grid')).toBe(w >= 1280 ? 3 : w >= 640 ? 2 : 1)
    await expectNoHorizontalScroll(page)
  })

  test('the pager is simple below 640 px and numbered from 640 px, and keeps the filter', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/latihan-berstruktur?kbat_level=3')
    const pager = tid(page, 'structured-pager')
    await expect(pager).toBeVisible()
    if (isMobileWidth(page)) {
      await expect(pager.getByText('Next »')).toBeVisible()
      await expect(pager.getByText(/Showing 1 to/)).toBeHidden()
    } else {
      await expect(pager).toContainText(/Showing 1 to \d+ of [\d,]+ results/)
    }
    await pager.getByRole('link', { name: /Next/ }).first().click()
    await expect(page).toHaveURL(/kbat_level=3/)
    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('[data-testid^=structured-card-]').first()).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('KBAT badges: 1-2 LOTS green, 3 MOTS amber, 4-6 HOTS red', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    const expected: [number, string, RegExp][] = [
      [1, 'LOTS 1', /bg-green-100/],
      [2, 'LOTS 2', /bg-green-100/],
      [3, 'MOTS 3', /bg-amber-100/],
      [4, 'HOTS 4', /bg-red-100/],
      [5, 'HOTS 5', /bg-red-100/],
      [6, 'HOTS 6', /bg-red-100/],
    ]
    await gotoApp('/latihan-berstruktur')
    for (const [level, label, cls] of expected) {
      // In-page navigation through the filter: one page load for all six levels.
      await tid(page, 'filter-kbat').selectOption(String(level))
      await tid(page, 'filter-submit').click()
      await expect(page).toHaveURL(new RegExp(`kbat_level=${String(level)}$`))
      const badge = page.locator('[data-testid^=structured-card-]').first().getByTestId('card-kbat')
      await expect(badge).toHaveText(label)
      await expect(badge).toHaveClass(cls)
    }
  })

  test('the filter navigates with both parameters, keeps the selection; an empty subject shows the empty state', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/latihan-berstruktur')
    await tid(page, 'filter-subject').selectOption({ label: 'Matematik' })
    await tid(page, 'filter-submit').click()
    await expect(page).toHaveURL(/subject_id=\d+&kbat_level=(&|$)/)
    await expect(tid(page, 'filter-subject').locator('option:checked')).toHaveText('Matematik')
    await expect(page.locator('[data-testid=card-subject]').first()).toHaveText('Matematik')

    await tid(page, 'filter-subject').selectOption({ label: 'Sains Sukan' })
    await tid(page, 'filter-submit').click()
    await expect(tid(page, 'structured-empty')).toContainText(
      'Tiada soalan berstruktur buat masa ini',
    )
    await expect(tid(page, 'structured-empty')).toContainText(
      'Soalan akan ditambah oleh guru dan admin',
    )
    await expect(page.getByTestId('structured-pager')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test(
    'Subjektif SPM variant: heading, back link, 16 subject options, extra card lines, "Mula" keeps scope',
    provisional('FT-M05-5.3 variants are documented from M06 inventory; Mula target unobserved'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR)
      await gotoApp('/latihan-berstruktur?scope=spm')
      await expectTabTitle(page, 'Soalan Berstruktur - PRESTASIPLUS')
      await expect(tid(page, 'shell-user-title')).toHaveText('Subjektif SPM')
      await expect(tid(page, 'structured-h1')).toHaveText('Subjektif SPM')
      await expect(tid(page, 'structured-sub')).toHaveText(
        'Pilih set struktur dan esei Tingkatan 4 atau 5 mengikut subjek semasa',
      )
      await expect(tid(page, 'structured-back')).toHaveText('Kembali ke Subjektif SPM')
      await expect(tid(page, 'structured-back')).toHaveAttribute('href', '/spm/subjektif')
      await expect(page.locator('[data-testid=filter-subject] option')).toHaveCount(16)
      await expect(page.locator('[data-testid=filter-subject] option').nth(1)).toHaveText(
        'Bahasa Melayu',
      )
      const card = page.locator('[data-testid^=structured-card-]').first()
      await expect(card.getByTestId('card-level-chip')).toHaveText(/^Tingkatan [45]$/)
      await expect(card.getByTestId('card-parts')).toContainText(/\d+ bahagian · \d+ markah/)
      await expect(card.getByTestId('card-start')).toHaveAttribute(
        'href',
        /^\/latihan-berstruktur\/\d+\/jawab\?scope=spm$/,
      )
      // The filter keeps `scope`.
      await tid(page, 'filter-kbat').selectOption('4')
      await tid(page, 'filter-submit').click()
      await expect(page).toHaveURL(/scope=spm/)
      await expect(page).toHaveURL(/kbat_level=4/)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'Tracking A Bahasa variant: pill, info card, BM / BI options, "Mula" keeps scope and track',
    provisional('FT-M05-5.3 variants are documented from M06 inventory; Mula target unobserved'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR)
      await gotoApp('/latihan-berstruktur?scope=spm&track=bahasa')
      await expect(tid(page, 'shell-user-title')).toHaveText('Tracking A Bahasa')
      await expect(tid(page, 'structured-h1')).toHaveText('Tracking A Bahasa')
      await expect(tid(page, 'structured-pill')).toHaveText('Tracking A Bahasa')
      await expect(tid(page, 'structured-back')).toHaveText('Kembali ke Tracking A SPM')
      await expect(tid(page, 'structured-back')).toHaveAttribute('href', '/spm/ramalan')
      await expect(tid(page, 'structured-info')).toContainText('BM dahulu, BI kemudian')
      await expect(tid(page, 'structured-info')).toContainText('Penjejakan berasaskan kertas')
      await expect(tid(page, 'structured-found')).toHaveText(/\d+ set ditemui/)
      await expect(page.locator('[data-testid=filter-subject] option')).toHaveText([
        'Semua Subjek',
        'Bahasa Melayu',
        'Bahasa Inggeris',
      ])
      await expect(
        page.locator('[data-testid^=structured-card-]').first().getByTestId('card-start'),
      ).toHaveAttribute('href', /\?scope=spm&track=bahasa$/)
      await expectNoHorizontalScroll(page)
    },
  )

  test('an unknown filter value is an empty list, not an error', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/latihan-berstruktur?subject_id=99999')
    await expect(tid(page, 'structured-empty')).toBeVisible()
    await expect(tid(page, 'structured-error')).toHaveCount(0)
  })

  test('a guest is sent to /login', async ({ page, gotoApp }) => {
    await gotoApp('/latihan-berstruktur')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('M05 Q3 structured answer', { tag: [moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test(
    '"Mula" opens the set: stimulus, sub-questions with marks, hint, "Lapor", then "Hantar" shows the marks',
    provisional('LS-7: live never opened the answer page; copy is PROPOSED'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(PELAJAR)
      await gotoApp('/latihan-berstruktur')
      await page
        .locator('[data-testid^=structured-card-]')
        .first()
        .getByTestId('card-start')
        .click()
      await expect(page).toHaveURL(/\/latihan-berstruktur\/\d+\/jawab$/)
      await expectTabTitle(page, 'Soalan Berstruktur - PRESTASIPLUS')
      await expect(tid(page, 'shell-user-title')).toHaveText('Soalan Berstruktur')
      await expect(tid(page, 'answer-stimulus')).not.toBeEmpty()
      expect(await page.getByTestId('sub-answer').count()).toBeGreaterThan(0)
      await expect(page.getByTestId('sub-marks').first()).toHaveText(/^\[\d+ markah\]$/)
      await expect(tid(page, 'answer-hint')).toContainText(
        'Jawab semua sub-soalan, kemudian klik Hantar.',
      )
      await expectTouchTarget(tid(page, 'answer-report'))
      await expectTouchTarget(tid(page, 'answer-submit'))
      await expectNoHorizontalScroll(page)

      // "Lapor" opens the M04 structured report modal.
      await tid(page, 'answer-report').click()
      await expect(page.getByText('Sebab Laporan')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByText('Sebab Laporan')).toHaveCount(0)

      await page.getByTestId('sub-answer').first().fill('Jawapan saya')
      await tid(page, 'answer-submit').click()
      await expect(tid(page, 'answer-total')).toHaveText(/Jumlah: \d+\/\d+ markah/)
      await expect(page.getByTestId('sub-awarded').first()).toHaveText(/\d+\/\d+ markah/)
      await expect(page.getByText('Skema jawapan:').first()).toBeVisible()
      await expect(tid(page, 'answer-submit')).toHaveCount(0)
      await expectNoHorizontalScroll(page)

      const req = await mock.lastRequest('/api/practice/structured/*/attempts')
      expect(req?.method).toBe('POST')
      expect(req?.status).toBe(201)
    },
  )

  test(
    'with scope=spm the back link is the SPM list and the attempt is posted with scope',
    provisional('LS-7: live never opened the answer page'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(PELAJAR)
      await gotoApp('/latihan-berstruktur/4454/jawab?scope=spm')
      await expect(tid(page, 'answer-stimulus')).toBeVisible()
      await expect(tid(page, 'answer-back')).toHaveAttribute(
        'href',
        /^\/latihan-berstruktur\?subject_id=\d+&scope=spm$/,
      )
      await tid(page, 'answer-submit').click()
      await expect(tid(page, 'answer-total')).toBeVisible()
      const req = await mock.lastRequest('/api/practice/structured/*/attempts')
      expect((req?.body as { scope?: string }).scope).toBe('spm')
    },
  )

  test(
    'with track=bahasa the back link is the Tracking A list',
    provisional('LS-7: live never opened the answer page'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR)
      await gotoApp('/latihan-berstruktur?scope=spm&track=bahasa&subject_id=1')
      await page
        .locator('[data-testid^=structured-card-]')
        .first()
        .getByTestId('card-start')
        .click()
      await expect(page).toHaveURL(/\/jawab\?scope=spm&track=bahasa$/)
      await expect(tid(page, 'answer-back')).toHaveAttribute('href', /scope=spm&track=bahasa$/)
    },
  )

  test('an unknown or non-numeric id is the global 404 page', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/latihan-berstruktur/99999999/jawab')
    await expectTabTitle(page, NOT_FOUND)
    await gotoApp('/latihan-berstruktur/abc/jawab')
    await expectTabTitle(page, NOT_FOUND)
  })

  test('the answer page stays inside the viewport on every width', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/latihan-berstruktur/4454/jawab')
    await expect(tid(page, 'answer-stimulus')).toBeVisible()
    await expectNoHorizontalScroll(page)
    // Sidebar from 1024 px, drawer below (shell sanity).
    expect(isDesktopShell(page)).toBe(viewportWidth(page) >= 1024)
  })
})
