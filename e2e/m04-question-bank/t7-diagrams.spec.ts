/**
 * M04-T7 developer smoke for S11 (build-plan M04-T7; QA writes the E2E ids at G5): the diagram audit
 * (stats, top-10 pills, filters, the MCQ and Struktur sections with their own pagers), upload and
 * dismiss, as the admin demo account at 375 / 768 / 1280. Flash copy and the upload / dismiss results
 * are UNVERIFIED or INFERRED (SRS §8), so those tests are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isMobileWidth,
  moduleTag,
  provisional,
  TAG,
} from '../support'

const ADMIN = 'admin@demo.test'
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
  await expect(page.getByTestId('diagrams-stat-mcq-value')).toBeVisible()
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
    await expectTabTitle(page, 'Soalan Perlu Gambar Rajah - Admin')
    await expect(page.getByTestId('shell-admin-title')).toHaveText('Soalan Perlu Gambar Rajah')
    await expect(page.getByTestId('shell-admin-subtitle')).toHaveText(
      'Audit soalan yang memerlukan gambar rajah dilengkapkan',
    )

    await expect(page.getByTestId('diagrams-stat-mcq-value')).toHaveText('6,144')
    await expect(page.getByTestId('diagrams-stat-structured-value')).toHaveText('522')
    await expect(page.getByTestId('diagrams-stat-total-value')).toHaveText('6,666')
    // Labels are upper case by CSS.
    const label = page.getByTestId('diagrams-stat-mcq').locator('p')
    expect(await label.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase')

    const pills = page.getByTestId('diagrams-pill')
    await expect(pills).toHaveCount(10)
    await expect(pills.first()).toHaveText('Biologi: 1,587')
    await expect(pills.nth(1)).toHaveText('Kimia: 1,077')
    await expect(pills.nth(9)).toHaveText('Pendidikan Moral: 60')

    await expect(page.getByTestId('diagrams-subject').locator('option')).toHaveCount(32)
    await expect(page.getByTestId('diagrams-school').locator('option')).toHaveCount(10221)
    await expect(page.getByTestId('diagrams-filter-submit')).toHaveText('Tapis')

    await expect(page.getByTestId('diagrams-mcq').locator('h2')).toHaveText('MCQ (6144)')
    await expect(mcqCards(page)).toHaveCount(20)
    await expect(page.getByTestId('diagrams-structured').locator('h2')).toHaveText('Struktur (522)')
    await expect(strCards(page)).toHaveCount(20)
    const card = mcqCards(page).first()
    await expect(card.getByTestId('diagram-file')).toHaveAttribute('accept', 'image/*')
    await expect(card.getByTestId('diagram-dismiss')).toHaveText('Abaikan')
    await expectTouchTarget(card.getByTestId('diagram-upload'))
    await expectTouchTarget(card.getByTestId('diagram-dismiss'), 44)

    if (isMobileWidth(page)) {
      await expect(
        page.getByTestId('diagrams-mcq-pager').getByRole('navigation').getByText('Next »'),
      ).toBeVisible()
    } else {
      await expect(page.getByTestId('diagrams-mcq-pager')).toContainText(
        'Showing 1 to 20 of 6144 results',
      )
      await expect(page.getByTestId('diagrams-structured-pager')).toContainText(
        'Showing 1 to 20 of 522 results',
      )
    }
    await expectNoHorizontalScroll(page)
  })

  test('the subject filter narrows both lists and the stat cards; pills stay global; pager links keep the filter', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openAudit(page, gotoApp)
    await page.getByTestId('diagrams-subject').selectOption({ label: 'Fizik' })
    await page.getByTestId('diagrams-filter-submit').click()
    await expect(page).toHaveURL(/subject_id=9/)
    await expect(page.getByTestId('diagrams-stat-mcq-value')).toHaveText('718')
    // DV-M04-11: the cards follow the filter, "Jumlah" is their sum.
    const mcq = Number(
      (await page.getByTestId('diagrams-stat-mcq-value').innerText()).replace(/,/g, ''),
    )
    const str = Number(
      (await page.getByTestId('diagrams-stat-structured-value').innerText()).replace(/,/g, ''),
    )
    const total = Number(
      (await page.getByTestId('diagrams-stat-total-value').innerText()).replace(/,/g, ''),
    )
    expect(total).toBe(mcq + str)
    // The pills are global (as live).
    await expect(page.getByTestId('diagrams-pill').first()).toHaveText('Biologi: 1,587')

    // DV-M04-16: the MCQ pager keeps subject_id, uses mcq_page and never carries str_page.
    if (!isMobileWidth(page)) {
      const link = page
        .getByTestId('diagrams-mcq-pager')
        .getByRole('link', { name: 'Go to page 2' })
      await expect(link).toHaveAttribute(
        'href',
        /^\/admin\/soalan-gambar\?subject_id=9&mcq_page=2$/,
      )
      await link.click()
      await expect(page).toHaveURL(/subject_id=9&mcq_page=2$/)
      await expect(page.getByTestId('diagrams-stat-mcq-value')).toHaveText('718')
    }
    await expectNoHorizontalScroll(page)
  })

  test('the school filter applies to the MCQ list only (school 380 has no MCQ)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openAudit(page, gotoApp)
    await page.getByTestId('diagrams-school').selectOption('380')
    await page.getByTestId('diagrams-filter-submit').click()
    await expect(page).toHaveURL(/school_id=380/)
    await expect(page.getByTestId('diagrams-mcq')).toHaveCount(0)
    await expect(page.getByTestId('diagrams-structured').locator('h2')).toHaveText('Struktur (522)')
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
    'Abaikan removes the question and flashes the API text',
    provisional('the dismiss result and the flash copy are INFERRED / UNVERIFIED (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openAudit(page, gotoApp)
      const card = mcqCards(page).first()
      const id = await card.getAttribute('data-question-id')
      await card.getByTestId('diagram-dismiss').click()
      await expect(page.getByText('Soalan telah dikeluarkan daripada senarai audit.')).toBeVisible()
      await expect(page.getByTestId('diagrams-stat-mcq-value')).toHaveText('6,143')
      await expect(page.getByTestId('diagrams-stat-total-value')).toHaveText('6,665')
      await expect(page.getByTestId('diagrams-mcq').locator('h2')).toHaveText('MCQ (6143)')
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
      const card = strCards(page).first()
      const id = await card.getAttribute('data-question-id')

      // Without a file the native required check stops the submit.
      await card.getByTestId('diagram-upload').click()
      await expect(page.getByTestId('diagrams-stat-structured-value')).toHaveText('522')
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
      await expect(page.getByTestId('diagrams-stat-structured-value')).toHaveText('521')
      await expect(page.getByTestId('diagrams-stat-mcq-value')).toHaveText('6,144')
      await expect(page.getByTestId('diagrams-structured').locator('h2')).toHaveText(
        'Struktur (521)',
      )
      await expect(page.locator(`[data-question-id="${id}"][data-kind="structured"]`)).toHaveCount(
        0,
      )
      await expectNoHorizontalScroll(page)
    },
  )
})
