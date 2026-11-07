/**
 * M04-T7 developer smoke for S11 (build-plan M04-T7; QA writes the E2E ids at G5): the diagram audit
 * (stats, top-10 pills, filters, the MCQ and Struktur sections with their own pagers), upload and
 * dismiss, as the admin demo account at 375 / 768 / 1280. Flash copy and the upload / dismiss results
 * are UNVERIFIED or INFERRED (SRS §8), so those tests are `@provisional`.
 */

import type { Page } from '@playwright/test'

import {
  NEEDS_DIAGRAM,
  STRUCTURED_NEEDS_DIAGRAM,
} from '../../src/modules/m04-question-bank/mock/data/tables'
import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
  TAG,
  viewportWidth,
} from '../support'

import { openFilters } from './list-helpers'

const ADMIN = 'admin@demo.test'
/**
 * Figures read from the mock tables the audit is computed from (`m04 mock/data/tables.ts`): `NEEDS_DIAGRAM` is the
 * per-subject MCQ count (Biologi 11, Kimia 10, Fizik 9, Pendidikan Moral 7 = the 10th pill) and
 * `STRUCTURED_NEEDS_DIAGRAM` the Struktur count. The spec compares the page with them, it does not re-pin them.
 */
const STRUCT = STRUCTURED_NEEDS_DIAGRAM
const en = (n: number): string => n.toLocaleString('en-US')
const GURU = 'guru@demo.test'
const PATH = '/admin/soalan-gambar'
/** 1x1 transparent PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

function mcqCards(page: Page) {
  return page.locator('[data-testid="diagrams-mcq"] [data-testid="diagram-card"]')
}

function strCards(page: Page) {
  return page.locator('[data-testid="diagrams-structured"] [data-testid="diagram-card"]')
}

async function openAudit(page: Page, gotoApp: (path: string) => Promise<void>, path = PATH) {
  await gotoApp(path)
  await expect(page.getByTestId('diagrams-stat-mcq')).toContainText('MCQ Perlu Gambar')
}

/** The number on the first line of a stat tile. */
async function stat(page: Page, id: string): Promise<number> {
  return Number(((await page.getByTestId(id).innerText()).split('\n')[0] ?? '').replace(/\D/g, ''))
}

/** The apply button: in the sheet below 768 px, in the bar from 768 px. */
function applyButton(page: Page) {
  return viewportWidth(page) < 768
    ? page.locator('[data-ds="filter-sheet"]').getByRole('button').first()
    : page.getByTestId('diagrams-filter').locator('button[type=submit]')
}

test.describe('M04 S11 diagram audit', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('header, stat cards, top-10 pills, filters and both sections at every width', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openAudit(page, gotoApp)
    await expectTabTitle(page, 'Soalan Perlu Gambar Rajah | PRESTASIPLUS')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Soalan Perlu Gambar Rajah')
    await expect(page.getByTestId('pentadbiran-subtitle')).toHaveText(
      'Audit soalan yang memerlukan gambar rajah dilengkapkan',
    )

    // No MCQ figure is pinned: the admin reads hide Darjah (D72, D96), so it is below Q-FLAGGED-MCQ of SRS 4.1.
    const mcqTotal = await stat(page, 'diagrams-stat-mcq')
    expect(mcqTotal).toBeGreaterThan(0)
    await expect(page.getByTestId('diagrams-stat-structured')).toContainText(en(STRUCT))
    expect(await stat(page, 'diagrams-stat-total')).toBe(mcqTotal + STRUCT)

    const pills = page.getByTestId('diagrams-pill')
    await expect(pills).toHaveCount(10)
    await expect(pills.first()).toHaveText(`Biologi: ${en(NEEDS_DIAGRAM[11] ?? 0)}`)
    await expect(pills.nth(1)).toHaveText(`Kimia: ${en(NEEDS_DIAGRAM[10] ?? 0)}`)
    await expect(pills.nth(9)).toHaveText(`Pendidikan Moral: ${en(NEEDS_DIAGRAM[7] ?? 0)}`)

    await openFilters(page)
    await expect(page.getByTestId('diagrams-subject').locator('option')).toHaveCount(32)
    await expect(page.getByTestId('diagrams-school').locator('option').first()).toHaveText(
      'Semua Sekolah',
    )
    await expect(applyButton(page)).toBeVisible()
    if (viewportWidth(page) < 768) await page.keyboard.press('Escape')

    await expect(page.getByTestId('diagrams-mcq').locator('h2')).toHaveText(
      `MCQ (${String(mcqTotal)})`,
    )
    await expect(mcqCards(page)).toHaveCount(20)
    await expect(page.getByTestId('diagrams-structured').locator('h2')).toHaveText(
      `Struktur (${en(STRUCT)})`,
    )
    await expect(strCards(page)).toHaveCount(20)
    const card = mcqCards(page).first()
    await expect(card.getByTestId('diagram-file')).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp',
    )
    await expect(card.getByTestId('diagram-dismiss')).toHaveText('Dismiss')
    await expectTouchTarget(card.getByTestId('diagram-upload'))
    await expectTouchTarget(card.getByTestId('diagram-dismiss'), 44)

    await expect(page.getByTestId('diagrams-mcq-pager')).toBeVisible()
    await expect(page.getByTestId('diagrams-structured-pager')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('a teacher sees the audit with upload but without Dismiss or the school filter', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(GURU)
    await openAudit(page, gotoApp)
    await expect(page.getByTestId('diagrams-stat-mcq')).toBeVisible()
    await expect(page.getByTestId('diagrams-stat-structured')).toBeVisible()
    await expect(page.getByTestId('diagrams-stat-total')).toBeVisible()
    await expect(page.getByTestId('diagram-dismiss')).toHaveCount(0)
    await expect(page.getByTestId('diagrams-school')).toHaveCount(0)
    await expect(page.getByTestId('diagram-upload').first()).toBeVisible()
    await expect(page.getByTestId('diagram-file').first()).toBeAttached()
    await expectTouchTarget(page.getByTestId('diagram-upload').first())
    await openFilters(page)
    await expectTouchTarget(applyButton(page), 44)
    if (viewportWidth(page) < 768) await page.keyboard.press('Escape')
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await expectNoHorizontalScroll(page)
  })

  test('the subject filter narrows both lists and the stat cards; pills stay global; pager links keep the filter', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openAudit(page, gotoApp)
    await openFilters(page)
    await page.getByTestId('diagrams-subject').selectOption({ label: 'Fizik' })
    await applyButton(page).click()
    await expect(page).toHaveURL(/subject_id=9/)
    await expect(page.getByTestId('diagrams-stat-mcq')).toContainText(en(NEEDS_DIAGRAM[9] ?? 0))
    // DV-M04-11: the cards follow the filter, "Jumlah" is their sum.
    expect(await stat(page, 'diagrams-stat-total')).toBe(
      (await stat(page, 'diagrams-stat-mcq')) + (await stat(page, 'diagrams-stat-structured')),
    )
    // The pills are global (as live).
    await expect(page.getByTestId('diagrams-pill').first()).toHaveText(
      `Biologi: ${en(NEEDS_DIAGRAM[11] ?? 0)}`,
    )

    // DV-M04-16: the MCQ pager keeps subject_id, uses mcq_page and never carries str_page.
    await page.getByTestId('diagrams-mcq-pager').getByRole('button', { name: 'Seterusnya' }).click()
    await expect(page).toHaveURL(/subject_id=9&mcq_page=2$/)
    await expect(page.getByTestId('diagrams-stat-mcq')).toContainText(en(NEEDS_DIAGRAM[9] ?? 0))
    await expectNoHorizontalScroll(page)
  })

  test('the school filter applies to the MCQ list only (the first school has no MCQ)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openAudit(page, gotoApp)
    await openFilters(page)
    await page.getByTestId('diagrams-school').selectOption({ index: 1 })
    await applyButton(page).click()
    await expect(page).toHaveURL(/school_id=\d+/)
    await expect(page.getByTestId('diagrams-mcq')).toHaveCount(0)
    await expect(page.getByTestId('diagrams-structured').locator('h2')).toHaveText(
      `Struktur (${en(STRUCT)})`,
    )
    await expect(page.getByTestId('diagrams-empty')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('both lists empty shows the all-done message', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp(`${PATH}?subject_id=19`)
    await expect(page.getByTestId('diagrams-empty')).toHaveText(
      'Semua soalan sudah lengkap dengan gambar rajah!',
    )
    await expect(page.getByTestId('diagrams-mcq')).toHaveCount(0)
    await expect(page.getByTestId('diagrams-structured')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test(
    'Dismiss removes the question and flashes the API text',
    provisional('the dismiss result and the flash copy are INFERRED / UNVERIFIED (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openAudit(page, gotoApp)
      const mcqBefore = await stat(page, 'diagrams-stat-mcq')
      const totalBefore = await stat(page, 'diagrams-stat-total')
      const card = mcqCards(page).first()
      const id = await card.getAttribute('data-question-id')
      await card.getByTestId('diagram-dismiss').click()
      await expect(page.getByText('Soalan telah dikeluarkan daripada senarai audit.')).toBeVisible()
      await expect.poll(() => stat(page, 'diagrams-stat-mcq')).toBe(mcqBefore - 1)
      expect(await stat(page, 'diagrams-stat-total')).toBe(totalBefore - 1)
      await expect(page.getByTestId('diagrams-mcq').locator('h2')).toHaveText(
        `MCQ (${String(mcqBefore - 1)})`,
      )
      await expect(page.locator(`[data-question-id="${id}"][data-kind="mcq"]`)).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'Upload needs a file, then clears the flag and flashes the API text',
    provisional('the upload result and the flash copy are INFERRED / UNVERIFIED (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openAudit(page, gotoApp)
      const mcqBefore = await stat(page, 'diagrams-stat-mcq')
      const card = strCards(page).first()
      const id = await card.getAttribute('data-question-id')

      // Without a file the native required check stops the submit.
      await card.getByTestId('diagram-upload').click()
      await expect(page.getByTestId('diagrams-stat-structured')).toContainText(en(STRUCT))
      expect(
        await card
          .getByTestId('diagram-file')
          .evaluate((el) => (el as HTMLInputElement).validity.valueMissing),
      ).toBe(true)

      await card.getByTestId('diagram-file').setInputFiles({
        name: 'rajah.png',
        mimeType: 'image/png',
        buffer: PNG,
      })
      await card.getByTestId('diagram-upload').click()
      await expect(page.getByText('Gambar rajah berjaya dimuat naik.')).toBeVisible()
      await expect(page.getByTestId('diagrams-stat-structured')).toContainText('521')
      expect(await stat(page, 'diagrams-stat-mcq')).toBe(mcqBefore)
      await expect(page.getByTestId('diagrams-structured').locator('h2')).toHaveText(
        'Struktur (521)',
      )
      await expect(page.locator(`[data-question-id="${id}"][data-kind="structured"]`)).toHaveCount(
        0,
      )
      await expectNoHorizontalScroll(page)
    },
  )

  test('a teacher upload goes to review: toast, chip, the card stays and the stat is unchanged', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(GURU)
    await openAudit(page, gotoApp)
    const mcqBefore = await stat(page, 'diagrams-stat-mcq')
    const card = mcqCards(page).first()
    const id = await card.getAttribute('data-question-id')
    await card.getByTestId('diagram-file').setInputFiles({
      name: 'rajah.png',
      mimeType: 'image/png',
      buffer: PNG,
    })
    await card.getByTestId('diagram-upload').click()
    await expect(page.getByText('Gambar dihantar untuk semakan.')).toBeVisible()
    const same = page.locator(`[data-question-id="${id}"][data-kind="mcq"]`)
    await expect(same).toHaveCount(1)
    await expect(same.getByTestId('diagram-pending')).toHaveText('Menunggu Semakan')
    await expect(same.getByTestId('diagram-upload')).toHaveCount(0)
    expect(await stat(page, 'diagrams-stat-mcq')).toBe(mcqBefore)
    await expectNoHorizontalScroll(page)
  })
})
