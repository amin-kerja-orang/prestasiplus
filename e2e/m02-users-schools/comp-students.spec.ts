/**
 * M02-T7 developer E2E for S6 `/admin/comp-students`, S7 `/admin/comp-students/create` and S8
 * `/admin/comp-students/:id` (build-plan M02-T7; QA writes the E2E-M02-36…42 set at G5): the list of 90
 * complimentary students with the in-card scroll (DV-M02-05) and one bulk action, registering two
 * students, and the detail with both toggles, as the admin demo account at 375 / 768 / 1280. Result flash
 * copy is UNVERIFIED (SRS §8), so the tests that assert it are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  isInViewportX,
  moduleTag,
  provisional,
  TAG,
} from '../support'

const ADMIN = 'admin@demo.test'

const byId = (page: Page, id: string) => page.getByTestId(id)

test.describe('M02 S6 complimentary list', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/comp-students')
  })

  test('title, summary, 90 students over 2 pages, upper-case headers and no horizontal page scroll', async ({
    page,
    gotoApp,
  }) => {
    await expectTabTitle(page, 'Pelajar Komplimen - Panel Admin')
    await expect(byId(page, 'comp-summary')).toHaveText('Syiling Mati: 90 / 90 pelajar komplimen')
    await expect(byId(page, 'comp-add')).toHaveAttribute('href', '/admin/comp-students/create')
    await expect(byId(page, 'comp-row')).toHaveCount(50)
    await expect(byId(page, 'comp-account').first()).toHaveText('AKTIF')
    await expect(byId(page, 'comp-coins').first()).toHaveText('MATI')
    await expect(byId(page, 'comp-name').first()).toHaveAttribute(
      'href',
      /^\/admin\/comp-students\/\d+$/,
    )
    await expect(byId(page, 'comp-table').locator('thead th').nth(1)).toHaveCSS(
      'text-transform',
      'uppercase',
    )
    await expect(byId(page, 'comp-pager')).toContainText(/Showing 1 to 50 of 90 results|Next/)
    await expectNoHorizontalScroll(page)

    await gotoApp('/admin/comp-students?page=2')
    await expect(byId(page, 'comp-row')).toHaveCount(40)
    await expect(byId(page, 'comp-summary')).toHaveText('Syiling Mati: 90 / 90 pelajar komplimen')
    await expectNoHorizontalScroll(page)
  })

  test('the table scrolls inside its card and the last column is reachable (DV-M02-05)', async ({
    page,
  }) => {
    const scroller = page
      .locator('[data-testid=comp-table]')
      .locator('xpath=ancestor::div[contains(@class,"overflow-x-auto")]')
    await expect(byId(page, 'comp-row')).toHaveCount(50)
    await scroller.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
    })
    const lastHead = byId(page, 'comp-table').locator('thead th').last()
    await expect(lastHead).toHaveText('Pakej tamat')
    expect(await isInViewportX(page, lastHead)).toBe(true)
    await expectNoHorizontalScroll(page)
  })

  test(
    'bulk: tick 2 shows the bar; "Batal pilihan" clears; "Hidupkan syiling" runs at once and updates the summary',
    provisional('The result flash copy is a placeholder (SRS §8)'),
    async ({ page }) => {
      await expect(byId(page, 'comp-bulk-bar')).toHaveCount(0)
      const boxes = byId(page, 'comp-select')
      await boxes.nth(0).check()
      await boxes.nth(1).check()
      const bar = byId(page, 'comp-bulk-bar')
      await expect(bar).toContainText('2 dipilih')
      await expect(bar.getByRole('button')).toHaveText([
        'Matikan syiling',
        'Hidupkan syiling',
        'Nyahaktif akaun',
        'Aktifkan akaun',
        'Batal pilihan',
      ])
      await expectNoHorizontalScroll(page)

      await byId(page, 'comp-bulk-clear').click()
      await expect(bar).toHaveCount(0)

      await byId(page, 'comp-select-all').check()
      await expect(byId(page, 'comp-selected-count')).toHaveText('50')
      await byId(page, 'comp-select-all').uncheck()
      await expect(bar).toHaveCount(0)

      await boxes.nth(0).check()
      await boxes.nth(1).check()
      await byId(page, 'comp-bulk-coins_on').click()
      await expect(byId(page, 'comp-summary')).toHaveText('Syiling Mati: 88 / 90 pelajar komplimen')
      await expect(byId(page, 'comp-coins').nth(0)).toHaveText('HIDUP')
      await expect(byId(page, 'comp-coins').nth(1)).toHaveText('HIDUP')
      await expect(byId(page, 'comp-coins').nth(2)).toHaveText('MATI')
      await expect(byId(page, 'cmp-flash')).toBeVisible()
      await expect(bar).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M02 S7 register complimentary students', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/comp-students/create')
  })

  test('title, info alert, fields, class select follows the teacher and no horizontal scroll', async ({
    page,
  }) => {
    await expectTabTitle(page, 'Daftar Pelajar Komplimen - Panel Admin')
    await expect(byId(page, 'comp-info')).toContainText(
      'Setiap pelajar dapat: username 6 digit akhir IC@prestasiplus.my',
    )
    await expect(byId(page, 'comp-info-password')).toHaveText(/^\d{8}$/)
    await expect(byId(page, 'comp-expiry')).toHaveValue(/^\d{4}-12-31$/)
    await expect(byId(page, 'comp-class')).toBeDisabled()
    await expect(byId(page, 'comp-help')).toContainText('NAMA, NOKP')
    await expect(byId(page, 'comp-back')).toHaveAttribute('href', '/admin/comp-students')
    await expectNoHorizontalScroll(page)

    // Fixture teacher 5302 owns 3 classes; 5301 owns none (SRS §6.14).
    await byId(page, 'comp-teacher').selectOption('5302')
    await expect(byId(page, 'comp-class')).toBeEnabled()
    await expect(byId(page, 'comp-class').locator('option')).toHaveCount(4)
    await expect(byId(page, 'comp-no-class')).toHaveCount(0)
    await byId(page, 'comp-teacher').selectOption('5301')
    await expect(byId(page, 'comp-no-class')).toHaveText('Guru ini tiada kelas aktif.')
    await expect(byId(page, 'comp-class')).toHaveValue('')
    await expectNoHorizontalScroll(page)
  })

  test(
    'two students into a class of teacher 5302: back on the list with the flash, 2 new rows, coins OFF',
    provisional('The result flash copy is a placeholder (SRS §8)'),
    async ({ page }) => {
      await byId(page, 'comp-teacher').selectOption('5302')
      await expect(byId(page, 'comp-class').locator('option')).toHaveCount(4)
      await byId(page, 'comp-class').selectOption({ index: 1 })
      await byId(page, 'comp-students').fill(
        [
          'PELAJAR DEMO SATU BIN DEMO, 070707077701',
          'PELAJAR DEMO DUA BIN DEMO, 080808088802',
        ].join('\n'),
      )
      await byId(page, 'form-submit').click()

      await expect(page).toHaveURL(/\/admin\/comp-students$/)
      await expect(byId(page, 'cmp-flash')).toContainText(
        '2 pelajar komplimen berjaya didaftarkan.',
      )
      await expect(byId(page, 'comp-summary')).toHaveText('Syiling Mati: 92 / 92 pelajar komplimen')
      const usernames = byId(page, 'comp-row').locator('td:nth-child(3)')
      await expect(usernames.filter({ hasText: '077701@prestasiplus.my' })).toHaveCount(1)
      await expect(usernames.filter({ hasText: '088802@prestasiplus.my' })).toHaveCount(1)
      const created = byId(page, 'comp-row').filter({ hasText: '088802@prestasiplus.my' })
      await expect(created.getByTestId('comp-coins')).toHaveText('MATI')
      await expect(created.getByTestId('comp-account')).toHaveText('AKTIF')
      await expectNoHorizontalScroll(page)
    },
  )

  test('an empty submit is stopped by the native required check', async ({ page }) => {
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL(/\/admin\/comp-students\/create$/)
    await expect(byId(page, 'comp-alert')).toHaveCount(0)
  })
})

test.describe('M02 S8 complimentary detail', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/comp-students/5901')
  })

  test('labels, values, wallet 0 / 0, classes table and no horizontal scroll', async ({ page }) => {
    await expect(byId(page, 'comp-card')).toBeVisible()
    await expect.poll(() => page.title()).toMatch(/^Pelajar Komplimen - .+/)
    await expect(byId(page, 'comp-card').locator('dt')).toHaveText([
      'Nama Pengguna',
      'No. KP',
      'Sekolah asal',
      'Tingkatan',
      'Status akaun',
      'Syiling',
      'Pakej tamat',
      'Baki syiling / koin',
    ])
    await expect(byId(page, 'comp-username')).toContainText('@prestasiplus.my')
    await expect(byId(page, 'comp-status')).toHaveText('AKTIF')
    await expect(byId(page, 'comp-coins')).toHaveText('MATI (tidak boleh kumpul/tuntut)')
    await expect(byId(page, 'comp-expiry')).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/)
    await expect(byId(page, 'comp-balance')).toHaveText('0 syiling · 0 koin')
    await expect(byId(page, 'comp-classes-title')).toContainText(/Kelas didaftar \(3\)/)
    await expect(byId(page, 'comp-classes').locator('thead th')).toHaveText([
      'Kelas',
      'Subjek',
      'Cikgu',
      'Status',
    ])
    await expect(byId(page, 'comp-classes').locator('thead th').first()).toHaveCSS(
      'text-transform',
      'uppercase',
    )
    expect(await byId(page, 'comp-class-row').count()).toBeGreaterThan(0)
    await expect(byId(page, 'comp-class-row').first().locator('td').last()).toHaveText('active')
    await expect(byId(page, 'comp-back')).toHaveAttribute('href', '/admin/comp-students')
    await expectNoHorizontalScroll(page)
  })

  test(
    'toggles: "Hidupkan syiling" -> ON + "Matikan syiling"; "Nyahaktif akaun" -> TIDAK AKTIF + "Aktifkan akaun"',
    provisional('The toggled labels and the flash copy are INFERRED (SRS FR-M02-75, §8)'),
    async ({ page }) => {
      await expect(byId(page, 'comp-toggle-coins')).toHaveText('Hidupkan syiling')
      await byId(page, 'comp-toggle-coins').click()
      await expect(byId(page, 'comp-coins')).toHaveText('HIDUP')
      await expect(byId(page, 'comp-toggle-coins')).toHaveText('Matikan syiling')

      await byId(page, 'comp-toggle-active').click()
      await expect(byId(page, 'comp-status')).toHaveText('TIDAK AKTIF')
      await expect(byId(page, 'comp-toggle-active')).toHaveText('Aktifkan akaun')
      await expect(byId(page, 'cmp-flash')).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )

  test('the list name link opens the detail', async ({ page, gotoApp }) => {
    await gotoApp('/admin/comp-students')
    const first = byId(page, 'comp-name').first()
    const name = (await first.innerText()).trim()
    await first.click()
    await expect(page).toHaveURL(/\/admin\/comp-students\/\d+$/)
    await expect.poll(() => page.title()).toBe(`Pelajar Komplimen - ${name}`)
  })
})
