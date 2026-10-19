/**
 * M04-T7 developer smoke for S10 (build-plan M04-T7; QA writes the E2E ids at G5): the teacher
 * question papers, the status filter and the inline "Kemaskini" panel, as the admin demo account at
 * 375 / 768 / 1280. The flash copy and the pending / rejected pills are UNVERIFIED or INFERRED
 * (SRS §8, FN-M04-5.1.5), so the tests that assert them are `@provisional`.
 */

import type { Page } from '@playwright/test'

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

const ADMIN = 'admin@demo.test'
const PATH = '/admin/question-submissions'

function rows(page: Page) {
  return page.getByTestId('submission-row')
}

async function openList(page: Page, gotoApp: (path: string) => Promise<void>, path = PATH) {
  await gotoApp(path)
  await expect(rows(page).first()).toBeVisible()
}

test.describe('M04 S10 teacher papers', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('header, counters, six papers and the in-card scroll at every width', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    await expectTabTitle(page, 'Kertas Soalan - Admin')
    await expect(page.getByTestId('shell-admin-title')).toHaveText('Kertas Soalan Guru')
    await expect(page.getByTestId('shell-admin-subtitle')).toHaveText(
      'Semak dan proses fail soalan yang dihantar oleh guru',
    )

    // Counters: all 6, pending 1, processing 3, done 1 (no Ditolak card).
    await expect(page.getByTestId('submissions-count-all')).toHaveText(/6\s*Jumlah/)
    await expect(page.getByTestId('submissions-count-pending')).toHaveText(/1\s*Pending/)
    await expect(page.getByTestId('submissions-count-processing')).toHaveText(/3\s*Processing/)
    await expect(page.getByTestId('submissions-count-done')).toHaveText(/1\s*Selesai/)
    await expect(page.locator('section [data-testid^="submissions-count-"]')).toHaveCount(4)

    await expect(page.getByTestId('submissions-status').locator('option')).toHaveText([
      'Semua Status',
      'Pending',
      'Processing',
      'Selesai',
      'Ditolak',
    ])
    await expect(page.getByTestId('submissions-filter-submit')).toHaveText('Tapis')
    await expect(page.getByTestId('submissions-reset')).toHaveCount(0)
    await expect(page.locator('thead th')).toHaveText([
      'Guru / Sekolah',
      'Soalan',
      'Fail',
      'Status',
      'Tarikh',
      'Tindakan',
    ])
    await expect(rows(page)).toHaveCount(6)
    await expect(rows(page).first().getByTestId('submission-toggle')).toHaveText('Kemaskini')
    await expectTouchTarget(rows(page).first().getByTestId('submission-toggle'))

    // The table scrolls inside its card below its natural width, never the page.
    const scroller = page.getByTestId('submissions-table').locator('xpath=../..')
    const overflow = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)
    if (viewportWidth(page) >= 1280) expect(overflow).toBeLessThanOrEqual(0)
    else expect(overflow).toBeGreaterThan(0)
    await expectNoHorizontalScroll(page)
  })

  test('filtering by "Selesai" keeps one paper, shows Reset, and Reset brings all six back', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    await page.getByTestId('submissions-status').selectOption('done')
    await page.getByTestId('submissions-filter-submit').click()
    await expect(page).toHaveURL(/status=done/)
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page).first().getByTestId('submission-status')).toHaveText('Selesai')
    // The counters stay global.
    await expect(page.getByTestId('submissions-count-all')).toHaveText(/6\s*Jumlah/)
    await page.getByTestId('submissions-reset').click()
    await expect(rows(page)).toHaveCount(6)
    await expectNoHorizontalScroll(page)
  })

  test('a status with no paper shows "Tiada rekod ditemui"', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp(`${PATH}?status=unknown`)
    await expect(page.getByTestId('submissions-empty')).toHaveText('Tiada rekod ditemui')
    await expectNoHorizontalScroll(page)
  })

  test('"Kemaskini" opens and closes the inline panel with the current status selected', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    const row = rows(page).first()
    const current = (await row.getByTestId('submission-status').innerText()).trim()
    await expect(row.getByTestId('submission-panel')).toHaveCount(0)
    await row.getByTestId('submission-toggle').click()
    const panel = row.getByTestId('submission-panel')
    await expect(panel).toBeVisible()
    const selected = await panel
      .getByTestId('submission-panel-status')
      .evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent)
    expect(selected).toBe(current)
    await expect(panel.getByTestId('submission-panel-notes')).toHaveAttribute(
      'placeholder',
      'Nota admin (pilihan)...',
    )
    await expect(panel.getByTestId('submission-panel-notes')).toHaveAttribute('maxlength', '1000')
    await expect(panel.getByTestId('submission-panel-save')).toHaveText('Simpan')
    await expectNoHorizontalScroll(page)
    await row.getByTestId('submission-toggle').click()
    await expect(panel).toHaveCount(0)
  })

  test(
    'saving a status and a note updates the row and flashes the API text',
    provisional('the save result and the flash copy are INFERRED / UNVERIFIED (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openList(page, gotoApp)
      const row = rows(page).first()
      const id = await row.getAttribute('data-submission-id')
      const before = (await row.getByTestId('submission-status').innerText()).trim()
      const target = before === 'Ditolak' ? 'done' : 'rejected'
      const targetLabel = target === 'done' ? 'Selesai' : 'Ditolak'

      await row.getByTestId('submission-toggle').click()
      await row.getByTestId('submission-panel-status').selectOption(target)
      await row.getByTestId('submission-panel-notes').fill('Diproses oleh ujian E2E')
      await row.getByTestId('submission-panel-save').click()

      await expect(page.getByText('Status kertas soalan berjaya dikemaskini.')).toBeVisible()
      const updated = page.locator(`[data-submission-id="${id}"]`)
      await expect(updated.getByTestId('submission-status')).toHaveText(targetLabel)
      await expect(updated.getByTestId('submission-admin-notes')).toHaveText(
        'Diproses oleh ujian E2E',
      )
      // The panel closed with the reload.
      await expect(updated.getByTestId('submission-panel')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'a file link downloads the placeholder file',
    provisional('the download is INFERRED (FN-M04-5.1.4)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openList(page, gotoApp)
      const link = rows(page).first().getByTestId('submission-file').first()
      const name = (await link.innerText()).trim()
      const [download] = await Promise.all([page.waitForEvent('download'), link.click()])
      expect(download.suggestedFilename().length).toBeGreaterThan(0)
      expect(name.length).toBeGreaterThan(0)
    },
  )
})
