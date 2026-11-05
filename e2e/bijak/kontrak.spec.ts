/**
 * Bijak SPM Kontrak Blueprint (BJS-F1..F4), Admin Pusat, against the mock: list, editor tabs,
 * Pengesahan, Pratonton Kolam. Runs at 375 / 768 / 1280 in light and dark and asserts that no
 * screen scrolls sideways. Needs the scope-ON build: `npm run test:e2e:bijak`.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'
import { HTTP_MODE } from './bijak-flow'

test.skip(HTTP_MODE, 'mock-only: the contract editor mock is not served in http mode')
test.skip(process.env.E2E_PROTOTYPE_SCOPE !== 'on', 'needs the scope-on build: playwright.bijak.config.mjs')

for (const theme of ['light', 'dark'] as const) {
  test.describe(`Kontrak Blueprint (${theme})`, () => {
    test.beforeEach(async ({ page, loginAs }) => {
      await page.addInitScript((t) => localStorage.setItem('pp.theme', t), theme)
      await loginAs('admin')
    })

    async function openEditor(page: Page, gotoApp: (p: string) => Promise<void>): Promise<void> {
      await gotoApp('/admin/spm/kontrak')
      await expect(page.getByTestId('kontrak-list')).toBeVisible()
      await expectNoHorizontalScroll(page)
      await gotoApp('/admin/spm/kontrak/MAT/2')
      await expect(page.getByTestId('kontrak-editor')).toBeVisible()
      await expect(page.getByTestId('contract-check')).toBeVisible()
    }

    test(`K1 list and Tambah Kontrak guard (${theme}) @bijak`, async ({ page, gotoApp }) => {
      await gotoApp('/admin/spm/kontrak')
      await expect(page.getByTestId('kontrak-table')).toBeVisible()
      await expectNoHorizontalScroll(page)
      await page.getByTestId('kontrak-add').click()
      await page.getByTestId('add-subject').selectOption('MAT')
      await page.getByTestId('add-kertas').selectOption('2')
      await expect(page.getByTestId('add-exists')).toContainText('Kontrak untuk subjek/kertas ini sudah wujud.')
      await expectNoHorizontalScroll(page)
    })

    test(`K2 tabs, live check and Sahkan reason (${theme}) @bijak`, async ({ page, gotoApp }) => {
      await openEditor(page, gotoApp)
      await expectNoHorizontalScroll(page)

      await page.getByTestId('tab-bahagian-1').click()
      await expect(page.getByRole('heading', { name: 'Struktur Bahagian' })).toBeVisible()
      await expectNoHorizontalScroll(page)
      // Break the quota sum: 4 questions against quota lines of 3.
      await page.locator('#kontrak-s0-m').fill('4')
      await expect(page.getByTestId('quota-errors')).toContainText('jumlah kuota topik (3) tidak sama dengan 4 soalan')
      await expectNoHorizontalScroll(page)

      await page.getByTestId('tab-pengesahan').click()
      await expect(page.getByTestId('verify-panel')).toBeVisible()
      await expect(page.getByTestId('sahkan')).toHaveAttribute('aria-disabled', 'true')
      await expect(page.getByTestId('sahkan-reason')).toBeVisible()
      await expectNoHorizontalScroll(page)

      await page.getByTestId('tab-umum').click()
      await expect(page.getByTestId('section-list')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })

    test(`K4 Sumber Disahkan opens Pengesahan and writes nothing (${theme}) @bijak`, async ({ page, gotoApp }) => {
      await openEditor(page, gotoApp)
      const source = page.getByTestId('kontrak-source')
      await source.selectOption('Disahkan')
      await expect(page).toHaveURL(/paparan=pengesahan/)
      await expect(page.getByTestId('verify-panel')).toBeVisible()
      await expect(page.getByTestId('gates-failing')).toContainText('Belum lengkap untuk Disahkan (')
      await expect(page.getByTestId('gate-rekod')).toHaveAttribute('data-ok', 'false')
      await expectNoHorizontalScroll(page)

      await page.getByTestId('tab-umum').click()
      await expect(source).toHaveValue('Spec')
      await expect(page.getByText('Simpan perubahan dahulu.')).toHaveCount(0)

      // Unsaved edits: the option is off and the reason is on the screen.
      await page.locator('#kontrak-umum-code').fill('1449/2A')
      await expect(source.locator('option[value="Disahkan"]')).toBeDisabled()
      await expect(page.getByText('Simpan perubahan dahulu.')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })

    test(`K5 section rules, marks list and paper question count (${theme}) @bijak`, async ({ page, gotoApp }) => {
      await openEditor(page, gotoApp)
      await page.locator('#kontrak-umum-question-count').fill('201')
      await expect(page.getByTestId('field-error').filter({ hasText: 'Bilangan soalan tidak sah.' })).toBeVisible()
      await page.locator('#kontrak-umum-question-count').fill('20')
      await expect(page.getByTestId('field-error').filter({ hasText: 'Bilangan soalan tidak sah.' })).toHaveCount(0)
      await expect(page.getByTestId('section-row-0')).toContainText('Jawab 3 daripada 3')

      await page.getByTestId('tab-bahagian-1').click()
      await expect(page.getByTestId('answer-line')).toHaveText('Jawab 3 daripada 3')
      await page.getByTestId('section-marks-list').fill('1,1,1,1')
      await expect(page.getByTestId('field-error').filter({ hasText: 'Markah setiap soalan mesti sama dengan markah bahagian.' })).toBeVisible()
      await expectNoHorizontalScroll(page)
      await page.getByTestId('section-marks-list').fill('')

      await page.getByTestId('section-compulsory').click()
      await page.getByTestId('rule-kind').getByRole('radio', { name: 'Pilih N' }).click()
      await expect(page.getByTestId('field-error').filter({ hasText: 'Bahagian wajib dijawab tidak boleh digabungkan dengan Pilih N.' })).toBeVisible()
      await page.locator('#kontrak-s0-n').fill('9')
      await expect(page.getByTestId('field-error').filter({ hasText: 'Nombor N tidak sah.' })).toBeVisible()
      await page.locator('#kontrak-s0-n').fill('2')
      await expect(page.getByTestId('answer-line')).toHaveText('Jawab 2 daripada 3')
      await expectNoHorizontalScroll(page)
    })

    test(`K6 three Bahagian and a quota table keep the page still (AC-ADM-R8) (${theme}) @bijak`, async ({ page, gotoApp }) => {
      await openEditor(page, gotoApp)
      await page.getByTestId('add-section').click()
      await expect(page.getByTestId('section-row-2')).toBeVisible()
      await expectNoHorizontalScroll(page)
      await expect(page.getByTestId('tab-bahagian-3')).toBeVisible()

      await page.getByTestId('tab-bahagian-1').click()
      await expect(page.getByTestId('quota-lines')).toBeVisible()
      await expectNoHorizontalScroll(page)

      const toggle = page.getByTestId('check-toggle')
      if (await toggle.isVisible() && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
      const box = await page.getByTestId('check-matrix').evaluate((table) => {
        const parent = table.parentElement!
        return { overflow: getComputedStyle(parent).overflowX, right: parent.getBoundingClientRect().right, width: document.documentElement.clientWidth }
      })
      expect(box.overflow).toBe('auto')
      expect(box.right).toBeLessThanOrEqual(box.width)
      await expectNoHorizontalScroll(page)
    })

    test(`K7 Baharu lists Kertas 1 to 4 and a contract with no evidence is marked (${theme}) @bijak`, async ({ page, gotoApp }) => {
      await gotoApp('/admin/spm/kontrak')
      await expect(page.getByTestId('kontrak-table')).toBeVisible()
      await expect(page.getByTestId('no-evidence').first()).toHaveText('perlu semakan')
      await page.getByTestId('kontrak-add').click()
      await page.getByTestId('add-continue').click()
      await expect(page.getByText('Sila pilih subjek.')).toBeVisible()
      await expect(page.getByTestId('add-kertas').locator('option[value="4"]')).toHaveCount(1)
      await page.getByTestId('add-subject').selectOption('MAT')
      await page.getByTestId('add-kertas').selectOption('4')
      await page.getByTestId('add-continue').click()
      await expect(page).toHaveURL(/kontrak\/MAT\/4\?baharu=1/)
      await expect(page.getByTestId('kontrak-source').locator('option[value="Disahkan"]')).toBeDisabled()
      await expect(page.getByText('Simpan perubahan dahulu.')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })

    test(`K3 pool preview (${theme}) @bijak`, async ({ page, gotoApp }) => {
      await gotoApp('/admin/spm/kontrak/MAT/2/kolam')
      await expect(page.getByTestId('verdict')).toBeVisible()
      await expect(page.getByTestId('generate-draft')).toBeVisible()
      await expectNoHorizontalScroll(page)
      await page.getByTestId('only-short').click()
      await expectNoHorizontalScroll(page)
    })
  })
}
