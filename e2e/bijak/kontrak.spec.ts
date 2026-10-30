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
      await expect(page.getByTestId('add-exists')).toContainText('Kontrak untuk subjek dan kertas ini sudah wujud.')
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
