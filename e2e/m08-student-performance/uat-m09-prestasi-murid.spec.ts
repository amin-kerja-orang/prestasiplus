/**
 * UAT M-09: `/prestasi` for a murid is the own Prestasi 360 (S6), never the school board; the school-level
 * screens (S1–S3, S9) are the 403 page for a murid; teacher / school admin still reach `/prestasi/sekolah`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag } from '../support'

const path = (page: Page): string => new URL(page.url()).pathname

test.describe('M08 UAT M-09 murid Prestasi', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('/prestasi lands on the own Prestasi 360, not the school board', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/prestasi')
    await expect.poll(() => path(page)).toBe('/prestasi/2')
    await expect(page.getByTestId('prestasi360-page')).toBeVisible()
    await expect(page.getByTestId('prestasi-sekolah-page')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  for (const url of [
    '/prestasi/sekolah',
    '/prestasi/tingkatan',
    '/prestasi/tingkatan/t4',
    '/analisa-item/sekolah',
    '/analisa-item/sekolah/900001',
  ]) {
    test(`murid ${url} is the 403 page with no school data`, async ({ page, gotoApp, loginAs }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp(url)
      await expect(page.locator('[data-page=forbidden]')).toBeVisible()
      expect(path(page)).toBe(url)
      await expect(page.getByTestId('prestasi-sekolah-page')).toHaveCount(0)
      await expect(page.getByTestId('school-card')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    })
  }

  test('murid cannot open another pupil Prestasi 360', async ({ page, gotoApp, loginAs }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/prestasi/3001')
    await expect(page.locator('[data-page=forbidden]')).toBeVisible()
    await expect(page.getByTestId('prestasi360-page')).toHaveCount(0)
  })

  for (const who of ['guru@demo.test', 'adminsekolah@demo.test']) {
    test(`${who} /prestasi still reaches the school board`, async ({ page, gotoApp, loginAs }) => {
      await loginAs(who)
      await gotoApp('/prestasi')
      await expect.poll(() => path(page)).toBe('/prestasi/sekolah')
      await expect(page.getByTestId('prestasi-sekolah-page')).toBeVisible()
      await expect(page.locator('[data-page=forbidden]')).toHaveCount(0)
    })
  }

  test('school admin still reaches S2 and S9', async ({ page, gotoApp, loginAs }) => {
    await loginAs('adminsekolah@demo.test')
    await gotoApp('/prestasi/tingkatan')
    await expect(page.getByTestId('level-link-t5')).toBeVisible()
    await gotoApp('/analisa-item/sekolah')
    await expect(page.getByTestId('school-card')).toBeVisible()
  })
})
