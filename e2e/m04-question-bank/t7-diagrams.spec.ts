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
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  provisional,
  TAG,
} from '../support'

const ADMIN = 'admin@demo.test'
const GURU = 'guru@demo.test'
const PATH = '/admin/soalan-gambar'
/** 1x1 transparent PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

/** DsStatRow tile value (the tile carries the testid; its value span has the .tabular class). */
function statValue(page: Page, key: 'mcq' | 'structured' | 'total') {
  return page.getByTestId(`diagrams-stat-${key}`).locator('.tabular')
}

function mcqCards(page: Page) {
  return page.locator('[data-testid="diagrams-mcq"] [data-testid="diagram-card"]')
}

function strCards(page: Page) {
  return page.locator('[data-testid="diagrams-structured"] [data-testid="diagram-card"]')
}

async function openAudit(page: Page, gotoApp: (path: string) => Promise<void>, path = PATH) {
  await gotoApp(path)
  await expect(page.getByTestId('diagrams-stat-mcq')).toContainText('MCQ Perlu Gambar')
  await expect(statValue(page, 'mcq')).toBeVisible()
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
    await expect(page.getByTestId('pentadbiran-header').getByRole('heading', { level: 1 })).toHaveText('Soalan Perlu Gambar Rajah')
    await expect(page.getByTestId('pentadbiran-subtitle')).toHaveText(
      'Audit soalan yang memerlukan gambar rajah dilengkapkan',
    )

    await expect(statValue(page, 'mcq')).toHaveText('6,144')
    await expect(statValue(page, 'structured')).toHaveText('522')
    await expect(statValue(page, 'total')).toHaveText('6,666')
    // Labels are upper case by CSS.
    const label = page.getByTestId('diagrams-stat-mcq').getByText('MCQ Perlu Gambar')
    expect(await label.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase')

    const pills = page.getByTestId('diagrams-pill')
    await expect(pills).toHaveCount(10)
    await expect(pills.first()).toHaveText('Biologi: 1,587')
    await expect(pills.nth(1)).toHaveText('Kimia: 1,077')
    await expect(pills.nth(9)).toHaveText('Pendidikan Moral: 60')

    await expect(page.getByTestId('diagrams-subject').locator('option')).toHaveCount(32)
    // D72 hides primary schools: GET /api/schools?all=1 lists the secondary schools only (SMK 2,441, mock/datasets/schools-spec.ts:10;
    // schoolsRepo.options(), mock/repository/schools.ts:266-275) plus the 'Semua Sekolah' placeholder option. Live 10,221 = SK 7,779 + SMK 2,441 + 1.
    await expect(page.getByTestId('diagrams-school').locator('option')).toHaveCount(2441 + 1)
    await expect(page.getByTestId('diagrams-filter').getByRole('button', { name: 'Tapis' })).toHaveText('Tapis')

    await expect(page.getByTestId('diagrams-mcq').locator('h2')).toHaveText('MCQ (6144)')
    await expect(mcqCards(page)).toHaveCount(20)
    await expect(page.getByTestId('diagrams-structured').locator('h2')).toHaveText('Struktur (522)')
    await expect(strCards(page)).toHaveCount(20)
    const card = mcqCards(page).first()
    await expect(card.getByTestId('diagram-file')).toHaveAttribute('accept', 'image/*')
    await expect(card.getByTestId('diagram-dismiss')).toHaveText('Dismiss')
    if (!isDesktopShell(page)) {
      await expectTouchTarget(card.getByTestId('diagram-upload'))
      await expectTouchTarget(card.getByTestId('diagram-dismiss'), 44)
    }

    // UPagination (no Laravel "Showing x to y" text): page 1 is current, the last page is ceil(total / 20):
    // 6144 MCQ (anchor, discovery M04:529) -> 308, 522 structured -> 27. Red while the mock computes 5,652 (data deferred).
    const pageBtn = (testid: string, n: number) =>
      page.getByTestId(testid).getByRole('button', { name: new RegExp('^(Page |Halaman )?' + String(n) + '$') })
    await expect(pageBtn('diagrams-mcq-pager', 1)).toHaveAttribute('aria-current', 'page')
    await expect(pageBtn('diagrams-mcq-pager', 308)).toBeVisible()
    await expect(pageBtn('diagrams-structured-pager', 1)).toHaveAttribute('aria-current', 'page')
    await expect(pageBtn('diagrams-structured-pager', 27)).toBeVisible()
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
    // Touch targets >= 44 px are asserted on the touch projects only (staff controls are 40 px from lg).
    if (!isDesktopShell(page)) {
      await expectTouchTarget(page.getByTestId('diagram-upload').first())
      await expectTouchTarget(page.getByTestId('diagrams-filter').getByRole('button', { name: 'Tapis' }), 44)
    }
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
    await page.getByTestId('diagrams-subject').selectOption({ label: 'Fizik' })
    await page.getByTestId('diagrams-filter').getByRole('button', { name: 'Tapis' }).click()
    await expect(page).toHaveURL(/subject_id=9/)
    await expect(statValue(page, 'mcq')).toHaveText('718')
    // DV-M04-11: the cards follow the filter, "Jumlah" is their sum.
    const mcq = Number(
      (await statValue(page, 'mcq').innerText()).replace(/,/g, ''),
    )
    const str = Number(
      (await statValue(page, 'structured').innerText()).replace(/,/g, ''),
    )
    const total = Number(
      (await statValue(page, 'total').innerText()).replace(/,/g, ''),
    )
    expect(total).toBe(mcq + str)
    // The pills are global (as live).
    await expect(page.getByTestId('diagrams-pill').first()).toHaveText('Biologi: 1,587')

    // DV-M04-16: the MCQ pager keeps subject_id, uses mcq_page and never carries str_page.
    if (!isMobileWidth(page)) {
      // The pager and the school filter are V3 additions with no V2 source (V2 lists 30 rows, no pager). UPagination
      // renders buttons, not links, so the check is the URL after the click (DiagramAuditPage.vue goToPage:145).
      const link = page
        .getByTestId('diagrams-mcq-pager')
        .getByRole('button', { name: /^(Page |Halaman )?2$/ })
      await link.click()
      await expect(page).toHaveURL(/subject_id=9&mcq_page=2$/)
      await expect(statValue(page, 'mcq')).toHaveText('718')
    }
    await expectNoHorizontalScroll(page)
  })

  // V3 addition, no V2 source (V2 has no school filter).
  test('the school filter applies to the MCQ list only (school 8300 has no MCQ)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openAudit(page, gotoApp)
    // The school select has 10,221 native options: selectOption times out under load (test technique, the control
    // works for users), so the value is set directly and a change event is dispatched.
    // The school options load after the page (async lookup): wait for the option before setting the value.
    await expect(page.locator('[data-testid="diagrams-school"] option[value="8300"]')).toBeAttached({
      timeout: 30_000,
    })
    await page.getByTestId('diagrams-school').evaluate((el: HTMLSelectElement) => {
      el.value = '8300'
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await expect(page.getByTestId('diagrams-school')).toHaveValue('8300')
    await page.getByTestId('diagrams-filter').getByRole('button', { name: 'Tapis' }).click()
    await expect(page).toHaveURL(/school_id=8300/)
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
    'Dismiss removes the question and flashes the API text',
    provisional('the dismiss result and the flash copy are INFERRED / UNVERIFIED (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openAudit(page, gotoApp)
      const card = mcqCards(page).first()
      const id = await card.getAttribute('data-question-id')
      await card.getByTestId('diagram-dismiss').click()
      await expect(page.getByText('Soalan telah dikeluarkan daripada senarai audit.')).toBeVisible()
      await expect(statValue(page, 'mcq')).toHaveText('6,143')
      await expect(statValue(page, 'total')).toHaveText('6,665')
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
      await expect(statValue(page, 'structured')).toHaveText('522')
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
      await expect(statValue(page, 'structured')).toHaveText('521')
      await expect(statValue(page, 'mcq')).toHaveText('6,144')
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
    await expect(statValue(page, 'mcq')).toHaveText('6,144')
    await expectNoHorizontalScroll(page)
  })
})
