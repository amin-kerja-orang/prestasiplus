/**
 * M04-T5 developer smoke for S5 `/admin/questions/import`, S5h `/admin/questions/import-history` and S6
 * `/admin/questions/quality` (build-plan M04-T5; QA writes E2E-M04-* at G5): a CSV import with a failed row
 * and a rejected file, the history list and its empty state (`importRuns: []`), the S6 cards and one
 * quality action ("Jalankan Audit Semula"), as the admin demo account at 375 / 768 / 1280. Copy that has no
 * live original (flashes, S5h) is UNVERIFIED / PROPOSED, so those assertions are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, provisional, TAG } from '../support'

const ADMIN = 'admin@demo.test'

const byId = (page: Page, id: string) => page.getByTestId(id)

const CSV = [
  'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation',
  '"Apakah ibu negara Malaysia?",Kuala Lumpur,Putrajaya,Johor Bahru,Ipoh,A,1,4,1,1,',
  '"Baris ini tidak lengkap",A',
].join('\n')

test.describe('M04 S5 question import', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/import')
  })

  test('title, form, side cards, links and no horizontal scroll', async ({ page }) => {
    await expectTabTitle(page, 'Import Soalan')
    await expect(
      page.getByText('Muat naik fail CSV untuk menambah soalan secara pukal'),
    ).toBeVisible()
    await expect(byId(page, 'import-file')).toHaveAttribute('accept', '.csv,.txt')
    await expect(byId(page, 'import-default-difficulty')).toHaveValue('2')
    await expect(page.getByText('Soalan disimpan sebagai draf')).toBeVisible()
    await expect(byId(page, 'import-template-card')).toContainText(
      'Template CSV dengan contoh soalan',
    )
    await expect(byId(page, 'import-format-card')).toContainText('Kolum diperlukan:')
    await expect(byId(page, 'import-tips-card').locator('li')).toHaveCount(4)
    await expect(byId(page, 'import-history-link')).toHaveAttribute(
      'href',
      '/admin/questions/import-history',
    )
    await expect(byId(page, 'import-back')).toHaveAttribute('href', '/admin/questions')
    await expectNoHorizontalScroll(page)
  })

  test('a file with an incomplete row imports 1 and fails 1; the run is first in the history', async ({
    page,
  }) => {
    await byId(page, 'import-file').setInputFiles({
      name: 'soalan-demo.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(CSV),
    })
    await byId(page, 'import-submit').click()
    await expect(byId(page, 'cmp-flash')).toContainText(
      'Import selesai: 1 soalan diimport, 1 gagal.',
    )
    await expect(byId(page, 'import-alert')).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    await byId(page, 'import-history-link').click()
    await expectTabTitle(page, 'Sejarah Import')
    const first = byId(page, 'history-row').first()
    await expect(first).toContainText('soalan-demo.csv')
    await expect(byId(page, 'history-imported').first()).toHaveText('1')
    await expect(byId(page, 'history-failed').first()).toHaveText('1')
  })

  test(
    'a file of another type is refused in the red alert above the form',
    provisional('The 422 file message is UNVERIFIED COPY (SRS §5)'),
    async ({ page }) => {
      await byId(page, 'import-file').setInputFiles({
        name: 'soalan.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4'),
      })
      await byId(page, 'import-submit').click()
      await expect(byId(page, 'import-alert')).toContainText(
        'Fail mesti jenis CSV atau TXT dan tidak melebihi 5MB.',
      )
      await expect(byId(page, 'cmp-flash')).toHaveCount(0)
    },
  )
})

test.describe('M04 S5h import history', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test(
    'lists 20 runs newest first with the pager, and "Kembali" returns to S5',
    provisional('S5h is DV-M04-01 PROPOSED COPY'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/questions/import-history')
      await expectTabTitle(page, 'Sejarah Import')
      await expect(page.locator('th')).toHaveText(['Tarikh', 'Fail', 'Diimport', 'Gagal'])
      await expect(byId(page, 'history-row')).toHaveCount(20)
      await expect(byId(page, 'history-file').first()).toHaveText('soalan-bm-d3.csv')
      await expect(byId(page, 'history-date').first()).toHaveText(/^20\/07\/2026 \d{2}:\d{2}$/)
      await expect(byId(page, 'history-pager')).toContainText(/of 1123 results|Next/)
      await expectNoHorizontalScroll(page)

      await byId(page, 'history-pager').getByRole('link', { name: /Next/ }).first().click()
      await expect(page).toHaveURL(/page=2/)
      await expect(byId(page, 'history-row')).toHaveCount(20)

      await byId(page, 'history-back').click()
      await expect(page).toHaveURL(/\/admin\/questions\/import$/)
    },
  )

  test.describe('with no runs', () => {
    test.use({ mockInit: { latency: 0, overrides: { importRuns: [] } } })

    test(
      'shows "Tiada sejarah import." and no pager',
      provisional('S5h is DV-M04-01 PROPOSED COPY'),
      async ({ page, loginAs, gotoApp }) => {
        await loginAs(ADMIN)
        await gotoApp('/admin/questions/import-history')
        await expect(byId(page, 'history-empty')).toHaveText('Tiada sejarah import.')
        await expect(byId(page, 'history-row')).toHaveCount(0)
        await expect(page.getByText(/results/)).toHaveCount(0)
        await expectNoHorizontalScroll(page)
      },
    )
  })
})

test.describe('M04 S6 question quality', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/quality')
  })

  test('KPI cards, bucket cards, distribution, lists and no horizontal scroll', async ({
    page,
  }) => {
    await expectTabTitle(page, 'Kualiti Soalan - Admin')
    await expect(byId(page, 'kpi-total-value')).toHaveText('465,278')
    await expect(byId(page, 'kpi-average-value')).toHaveText('94.1')
    await expect(byId(page, 'kpi-excellent-value')).toHaveText('146,275')
    await expect(byId(page, 'kpi-action-value')).toHaveText('2')
    await expect(byId(page, 'bucket-baik-value')).toHaveText('749')
    await expect(byId(page, 'bucket-lemah-value')).toHaveText('2')
    await expect(byId(page, 'bucket-legacy-value')).toHaveText('373')
    await expect(page.getByText('Taburan Kualiti')).toBeVisible()
    await expect(byId(page, 'dist-cemerlang')).toContainText('99.5%')
    await expect(page.getByText('Mengikut Subjek')).toBeVisible()
    await expect(byId(page, 'level-row')).toHaveCount(11)
    await expect(byId(page, 'action-count')).toHaveText('2 soalan')
    await expect(byId(page, 'action-row')).toHaveCount(2)
    await expect(byId(page, 'action-edit').first()).toHaveAttribute(
      'href',
      /\/admin\/questions\/\d+\/edit$/,
    )
    await expectNoHorizontalScroll(page)
  })

  test(
    '"Jalankan Audit Semula" runs without confirm and flashes the result',
    provisional('The audit flash copy is UNVERIFIED COPY (SRS §8)'),
    async ({ page }) => {
      let dialogs = 0
      page.on('dialog', (d) => {
        dialogs += 1
        void d.dismiss()
      })
      await byId(page, 'quality-audit').click()
      await expect(byId(page, 'cmp-flash')).toContainText('Audit kualiti selesai.')
      await expect(byId(page, 'quality-audit')).toHaveText('Jalankan Audit Semula')
      await expect(byId(page, 'kpi-total-value')).toHaveText('465,278')
      expect(dialogs).toBe(0)
    },
  )
})
