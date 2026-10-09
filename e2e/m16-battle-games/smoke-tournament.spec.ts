/**
 * M16 S23 `/tournament`, the provisional `/tournament/:uuid` and the S30 tournament banner at
 * 375 / 768 / 1280 (M16-T6c, M16-T7a; SRS M16 v1.6 §12 E2E-M16-06, 09, 10, 76, 77, 80, 81). Clock
 * 2026-09-25T15:40+08:00. The `tournaments` fixture (§6.11.7) gives the registration, ongoing and
 * live tournaments.
 */

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, provisional } from '../support'

const ADMIN = 'admin@demo.test'
const STUDENT = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(16)] }
const BANNER = 'GET /api/tournament/active'

test.use({ mockInit: { latency: 0 } })

test.describe('S23 Tournament list', () => {
  test(
    'E2E-M16-76 hero, admin button and the empty text',
    MODULE,
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp('/tournament')
      await expectTabTitle(page, 'Liga & Tournament')
      await expect(page.getByTestId('shell-user-title')).toHaveText('Liga & Tournament')
      await expect(page.getByTestId('shell-user-subtitle')).toHaveText(
        'Senarai tournament antara sekolah',
      )
      await expect(page.getByRole('heading', { level: 2, name: 'Liga & Tournament' })).toBeVisible()
      await expect(
        page.getByText('Bertanding antara sekolah dalam format liga, kalah mati, atau hibrid!'),
      ).toBeVisible()
      await expect(page.getByTestId('tournament-create')).toHaveText('Cipta Tournament Baru')
      await expect(page.getByTestId('tournament-create')).toHaveAttribute(
        'href',
        '/tournament/admin/create',
      )
      await expect(page.getByTestId('tournament-empty')).toHaveText(
        'Tiada tournament aktif buat masa ini.',
      )
      // S23 does not link to the leagues (S25-S27).
      await expect(page.locator('main a[href^="/liga"]')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M16-06 a student does not see "Cipta Tournament Baru"',
    MODULE,
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(STUDENT)
      await gotoApp('/tournament')
      await expect(page.getByTestId('tournament-empty')).toBeVisible()
      await expect(page.getByTestId('tournament-create')).toHaveCount(0)
    },
  )

  test(
    'E2E-M16-77 fixture "tournaments": cards link to their uuids',
    provisional('registration / ongoing tournaments exist only as a test fixture', [moduleTag(16)]),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(STUDENT)
      await gotoApp('/tournament')
      await mock.hook('m16Fixture', 'tournaments')
      await gotoApp('/tournament')
      const cards = page.getByTestId('tournament-card')
      await expect(cards).toHaveCount(3)
      await expect(cards.nth(0)).toContainText('Contoh Tournament Pendaftaran')
      await expect(cards.nth(0)).toContainText('Pendaftaran dibuka')
      await expect(cards.nth(1)).toContainText('Contoh Tournament Berlangsung')
      await expect(cards.nth(1)).toContainText('Sedang berlangsung')
      for (let i = 0; i < 3; i++) {
        await expect(cards.nth(i)).toHaveAttribute('href', /^\/tournament\/[0-9a-f-]{36}$/)
      }
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M16-81 an unknown uuid renders the 404 page',
    MODULE,
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp('/tournament/00000000-0000-4000-8000-000000000000')
      await expect(page.getByRole('heading', { name: 'Halaman Tidak Dijumpai' })).toBeVisible()
      await gotoApp('/tournament/1')
      await expect(page.getByRole('heading', { name: 'Halaman Tidak Dijumpai' })).toBeVisible()
    },
  )
})

test.describe('S30 Tournament banner', () => {
  test(
    'E2E-M16-09 hidden by default: one request per page load, no banner',
    MODULE,
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      for (const path of ['/dashboard', '/permainan', '/tournament']) {
        await gotoApp(path)
        await expect(page.getByTestId('shell-user-main')).toBeVisible()
        await expect.poll(async () => (await mock.requests(BANNER)).length).toBe(1)
        const last = await mock.lastRequest(BANNER)
        expect(last?.status).toBe(200)
        await expect(page.getByTestId('tournament-banner')).toHaveCount(0)
      }
    },
  )

  test(
    'E2E-M16-09 a failing request shows no banner and no message',
    MODULE,
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(ADMIN)
      await gotoApp('/tournament')
      await mock.failNext(BANNER, 500)
      await gotoApp('/tournament')
      await expect(page.getByTestId('tournament-empty')).toBeVisible()
      await expect(page.getByTestId('tournament-banner')).toHaveCount(0)
      await expect(page.getByTestId('shell-user-main').getByRole('alert')).toHaveCount(0)
    },
  )

  test(
    'E2E-M16-10 fixture "tournaments": registration, ongoing and live cards stack in order',
    provisional('banner items exist only as a test fixture', [moduleTag(16)]),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(STUDENT)
      await gotoApp('/dashboard')
      await mock.hook('m16Fixture', 'tournaments')
      await gotoApp('/dashboard')
      const banner = page.getByTestId('tournament-banner')
      await expect(banner).toBeVisible()
      // First child of <main>.
      const first = await page
        .getByTestId('shell-user-main')
        .evaluate((m) => (m.firstElementChild as HTMLElement | null)?.dataset.testid)
      expect(first).toBe('tournament-banner')

      const items = banner.locator('a')
      await expect(items).toHaveCount(3)
      await expect(items.nth(0)).toContainText('Contoh Tournament Pendaftaran')
      await expect(items.nth(0)).toContainText('Pendaftaran dibuka')
      await expect(items.nth(0)).toContainText('DAFTAR')
      await expect(items.nth(1)).toContainText('Sedang berlangsung')
      await expect(items.nth(1)).not.toContainText('DAFTAR')
      await expect(items.nth(2)).toContainText('LIVE:')
      await expect(items.nth(2)).toContainText(' vs ')
      await expect(items.nth(2)).toContainText('MAIN')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M16-80 open the registration tournament from the banner: read-only detail',
    provisional('the detail page is PROVISIONAL (no tournament exists on live)', [moduleTag(16)]),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(STUDENT)
      await gotoApp('/dashboard')
      await mock.hook('m16Fixture', 'tournaments')
      await gotoApp('/dashboard')
      await page.getByTestId('tournament-banner').locator('a').first().click()
      await expect(page).toHaveURL(/\/tournament\/[0-9a-f-]{36}$/)
      await expect(page.getByTestId('tournament-detail-title')).toHaveText(
        'Contoh Tournament Pendaftaran',
      )
      await expect(page.getByTestId('tournament-detail-line')).toHaveText('Pendaftaran dibuka')
      await expect(page.getByTestId('tournament-detail-fields')).toContainText('Hibrid')
      await expectNoHorizontalScroll(page)
    },
  )
})
