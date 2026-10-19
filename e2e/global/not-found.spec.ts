/**
 * Global smoke: the 404 page (M01 S10, FR-M01-50; build-plan F-21, F-22). Replaces the F-01
 * placeholder smoke. Exact copy, links and tab title; no horizontal scroll at every project width.
 */

import { expect, gotoApp, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, TAG } from '../support'
import type { Page } from '@playwright/test'

const TITLE = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'
const MESSAGE =
  'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?'

async function expectNotFoundPage(page: Page): Promise<void> {
  await expectTabTitle(page, TITLE)
  const main = page.getByRole('main')
  await expect(main.getByText('404', { exact: true })).toBeVisible()
  await expect(main.getByText('🔍', { exact: true })).toBeVisible()
  await expect(
    main.getByRole('heading', { level: 1, name: 'Halaman Tidak Dijumpai', exact: true }),
  ).toBeVisible()
  await expect(main.getByText(MESSAGE, { exact: true })).toBeVisible()
  await expect(main.getByRole('link', { name: 'Halaman Utama', exact: true })).toHaveAttribute(
    'href',
    '/',
  )
  // M01 DV-02: live "/latih-tubi" is itself a 404.
  await expect(main.getByRole('link', { name: 'Mula Latihan', exact: true })).toHaveAttribute(
    'href',
    '/practice',
  )
  await expect(main.getByText('PRESTASIPLUS', { exact: true })).toBeVisible()
  await expect(page.getByRole('link')).toHaveCount(2)
  await expectNoHorizontalScroll(page)
}

test.describe('404 page', { tag: [TAG.smoke] }, () => {
  test('unknown route renders the 404 page for a guest', async ({ page }) => {
    await gotoApp(page, '/halaman-yang-tiada-langsung')
    await expect(page).toHaveURL('/halaman-yang-tiada-langsung')
    await expectNotFoundPage(page)
  })

  test('unknown route renders the 404 page for a logged-in student', async ({ page, loginAs }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp(page, '/tiada/halaman/ini?x=1')
    await expect(page).toHaveURL('/tiada/halaman/ini?x=1')
    await expectNotFoundPage(page)
    // Standalone page: no user shell around it.
    await expect(page.locator('[data-layout="user"]')).toHaveCount(0)
  })
})
