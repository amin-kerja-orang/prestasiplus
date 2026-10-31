/**
 * M02-T9 developer smoke for S12-S16 (build-plan M02-T9; QA writes E2E-M02-26 and 47..59 at G5): the
 * subscription list, create, detail (extend, upgrade, cancel), standalone renewal invoice and the
 * school-admin package assignment, as the admin demo account at 375 / 768 / 1280. Flash texts after a
 * mutation are UNVERIFIED COPY (SRS §8), so the tests that assert them are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  dismissNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  moduleTag,
  provisional,
  TAG,
} from '../support'

const ADMIN = 'admin@demo.test'

function rows(page: Page) {
  return page.getByTestId('subs-row')
}

test.describe('M02 S12 subscription list', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('header, stat cards, 14 rows, badges and no page h-scroll', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions')
    await expect(rows(page).first()).toBeVisible()
    await expectTabTitle(page, 'Langganan Sekolah | PRESTASIPLUS')

    await expect(page.getByTestId('subs-stat-active')).toHaveText(/9\s*Aktif/)
    await expect(page.getByTestId('subs-stat-grace')).toHaveText(/0\s*Tempoh Ihsan/)
    await expect(page.getByTestId('subs-stat-expired')).toHaveText(/1\s*Tamat Tempoh/)
    await expect(page.getByTestId('subs-stat-quota')).toHaveText(/5,738\s*Jumlah Kuota Pelajar/)
    await expect(rows(page)).toHaveCount(14)
    await expect(page.locator('thead th')).toHaveText([
      'Sekolah',
      'Tingkatan',
      'Pakej',
      'Kuota',
      'Status',
      'Mula',
      'Tamat',
      '',
    ])

    const badges = await page.getByTestId('subs-status-badge').allInnerTexts()
    expect(badges.filter((b) => b === 'Aktif')).toHaveLength(9)
    expect(badges.filter((b) => b === 'Tamat')).toHaveLength(1)
    expect(badges.filter((b) => b === 'Batal')).toHaveLength(4)
    await expect(page.getByTestId('subs-add')).toHaveAttribute(
      'href',
      '/admin/school-subscriptions/create',
    )
    await expectNoHorizontalScroll(page)
  })

  test('filters narrow the rows and an unknown search shows the empty text', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions')
    await expect(rows(page)).toHaveCount(14)

    await page.getByTestId('subs-status').selectOption('cancelled')
    await page.getByTestId('subs-search-submit').click()
    await expect(page).toHaveURL(/\?status=cancelled$/)
    await expect(rows(page)).toHaveCount(4)
    for (const badge of await page.getByTestId('subs-status-badge').all()) {
      await expect(badge).toHaveText('Batal')
    }

    await page.getByTestId('subs-status').selectOption('')
    await page.getByTestId('subs-level').selectOption('t4')
    await page.getByTestId('subs-search-submit').click()
    await expect(page).toHaveURL(/\?form_level=t4$/)
    await expect(rows(page)).toHaveCount(2)
    // Stat cards count every subscription, not the filtered rows.
    await expect(page.getByTestId('subs-stat-active')).toHaveText(/9\s*Aktif/)

    await gotoApp('/admin/school-subscriptions?search=zzqxv')
    await expect(page.getByTestId('subs-empty')).toHaveText('Tiada langganan dijumpai.')
    await expect(page.getByTestId('subs-empty').locator('td')).toHaveAttribute('colspan', '8')
    await expectNoHorizontalScroll(page)
  })

  test('"Lihat" opens the detail and "Langganan Baru" the form; touch targets below 1024', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions')
    await expect(rows(page).first()).toBeVisible()
    if (!isDesktopShell(page)) {
      await expectTouchTarget(page.getByTestId('subs-add'))
      await expectTouchTarget(page.getByTestId('subs-search-submit'))
    }
    await rows(page).first().getByTestId('subs-view').click()
    await expect(page).toHaveURL(/\/admin\/school-subscriptions\/\d+$/)
    await expect(page.getByTestId('sub-summary-card')).toBeVisible()
    await page.getByTestId('sub-list-back').click()
    await expect(page).toHaveURL('/admin/school-subscriptions')
    await page.getByTestId('subs-add').click()
    await expect(page).toHaveURL('/admin/school-subscriptions/create')
    await expect(page.getByTestId('sub-form')).toBeVisible()
  })
})

test.describe('M02 S13 new subscription', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  async function pickSchool(page: Page): Promise<string> {
    await page.getByTestId('sub-school-search').fill('kluang')
    const first = page.getByTestId('sub-school-result').first()
    await expect(first).toBeVisible()
    const name = (await first.locator('span').first().innerText()).trim()
    await first.click()
    await expect(page.getByTestId('sub-school-name')).toHaveText(name)
    return name
  }

  test('defaults, summaries and quota limits', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/create')
    await expect(page.getByTestId('sub-form')).toBeVisible()
    await expectTabTitle(page, 'Langganan Baru | PRESTASIPLUS')
    await expect(page.getByTestId('sub-tier-basic')).toBeChecked()
    await expect(page.getByTestId('sub-package')).toHaveCount(4)
    for (const radio of await page.getByTestId('sub-package').all()) {
      await expect(radio).not.toBeChecked()
    }
    await expect(page.getByTestId('sub-quota')).toHaveValue('100')
    await expect(page.getByTestId('sub-summary')).toContainText(
      'Pakej Pemantauan: PERCUMA · 500 soalan/bulan/pelajar · 1 bulan',
    )

    await page.getByText('Penuh', { exact: true }).click()
    await expect(page.getByTestId('sub-summary')).toHaveCount(0)
    await page.getByTestId('sub-package').first().check({ force: true })
    await expect(page.getByTestId('sub-summary-line')).toHaveText('100 pelajar × RM30.00/tahun')
    await expect(page.getByTestId('sub-summary-total')).toHaveText('RM3,000.00')
    await expect(page.getByTestId('sub-summary-grand')).toHaveText('Jumlah 2 tahun: RM6,000.00')
    await page.getByTestId('sub-package').nth(1).check({ force: true })
    await expect(page.getByTestId('sub-summary-grand')).toHaveCount(0)

    // Native validation: 0 and 2001 are blocked, 2000 is accepted.
    for (const [value, valid] of [
      ['0', false],
      ['2001', false],
      ['2000', true],
    ] as const) {
      await page.getByTestId('sub-quota').fill(value)
      expect(
        await page
          .getByTestId('sub-quota')
          .evaluate((el) => (el as HTMLInputElement).validity.valid),
      ).toBe(valid)
    }
    await expectNoHorizontalScroll(page)
  })

  test('the school picker shows rows, the empty text and the selected card', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/create')
    await page.getByTestId('sub-school-search').fill('zzqxvzz')
    await expect(page.getByTestId('sub-school-empty')).toHaveText('Tiada sekolah dijumpai')
    await page.getByTestId('sub-school-search').fill('kluang')
    await expect(page.getByTestId('sub-school-result').first()).toContainText(/—/)
    const name = await pickSchool(page)
    expect(name).not.toBe('')
    await expect(page.getByTestId('sub-school-search')).toHaveCount(0)
    await page.getByTestId('sub-school-clear').click()
    await expect(page.getByTestId('sub-school-search')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('without a package the server refuses and the form keeps its input', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/create')
    await pickSchool(page)
    await page.getByTestId('sub-reference').fill('REF-E2E')
    await page.getByTestId('sub-submit').click()
    await expect(page.getByTestId('sub-form-alert')).toBeVisible()
    await expect(page).toHaveURL('/admin/school-subscriptions/create')
    await expect(page.getByTestId('sub-reference')).toHaveValue('REF-E2E')
    await expect(page.getByTestId('sub-school-name')).toBeVisible()
  })

  test(
    'creates a full T4 subscription and lands on its detail with the total',
    provisional('the flash text after a create is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/school-subscriptions/create')
      const name = await pickSchool(page)
      await page.getByText('Penuh', { exact: true }).click()
      await page.getByTestId('sub-package').first().check({ force: true })
      await page.getByTestId('sub-quota').fill('100')
      await expect(page.getByTestId('sub-summary-total')).toHaveText('RM3,000.00')
      await page.getByTestId('sub-submit').click()

      await expect(page).toHaveURL(/\/admin\/school-subscriptions\/\d+$/)
      await expect(page.getByTestId('sub-school')).toHaveText(name)
      await expect(page.getByTestId('sub-tier')).toHaveText('Penuh')
      await expect(page.getByTestId('sub-status')).toHaveText('Aktif')
      await expect(page.getByTestId('sub-total')).toHaveText('RM3,000.00')
      await expect(page.getByText('Langganan berjaya dicipta.')).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )

  test('creates a Pemantauan subscription with the 500/bulan tiles', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/create')
    await pickSchool(page)
    await page.getByTestId('sub-package').nth(1).check({ force: true })
    await page.getByTestId('sub-submit').click()
    await expect(page).toHaveURL(/\/admin\/school-subscriptions\/\d+$/)
    await expect(page.getByTestId('sub-tier')).toHaveText('Pemantauan')
    await expect(page.getByTestId('sub-tiles')).toContainText('500/bulan')
    await expect(page.getByTestId('sub-tiles')).toContainText('PERCUMA')
  })
})

test.describe('M02 S14 subscription detail', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('basic 8277 (id 14): 15% emerald bar, box, tiles, note and 150 students', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/14')
    await expect(page.getByTestId('sub-summary-card')).toBeVisible()
    await expect(page.getByTestId('sub-list-back')).toHaveText('Senarai Langganan')
    await expect(page.getByTestId('sub-tier')).toHaveText('Pemantauan')
    await expect(page.getByTestId('sub-usage')).toHaveText('150 / 1000')
    await expect(page.getByTestId('sub-percent')).toHaveText('15% digunakan')
    await expect(page.getByTestId('sub-remaining')).toHaveText('Baki: 850 pelajar')
    await expect(page.getByTestId('sub-bar')).toHaveClass(/bg-emerald-500/)
    await expect(page.getByTestId('sub-basic-box')).toContainText(
      '500 soalan/bulan/pelajar · PERCUMA · Tamat 12/05/2027',
    )
    await expect(page.getByTestId('sub-tiles')).toContainText('500/bulan')
    await expect(page.getByTestId('sub-notes')).toContainText('Nota:')
    await expect(page.getByTestId('sub-code')).toContainText('· Pakej SPM Tingkatan 5')
    await expect(page.getByTestId('sub-toggle-upgrade')).toBeVisible()
    const title = await page.title()
    expect(title).toMatch(/^Langganan .+ [|] PRESTASIPLUS$/)

    await expect(page.getByTestId('sub-student-row')).toHaveCount(50)
    await expect(page.getByTestId('sub-range')).toHaveText('perbarisan · Memaparkan 1-50 dari 150')
    await expect(page.getByTestId('sub-per-page')).toHaveValue('50')
    await expectNoHorizontalScroll(page)
  })

  test('full 8106 (id 10): red full bar at 562 / 500, price tiles, no upgrade', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/10')
    await expect(page.getByTestId('sub-summary-card')).toBeVisible()
    await expect(page.getByTestId('sub-usage')).toHaveText('562 / 500')
    await expect(page.getByTestId('sub-percent')).toHaveText('100% digunakan')
    await expect(page.getByTestId('sub-remaining')).toHaveText('Baki: 0 pelajar')
    await expect(page.getByTestId('sub-bar')).toHaveClass(/bg-red-500/)
    await expect(page.getByTestId('sub-price')).toHaveText('RM30.00')
    await expect(page.getByTestId('sub-total')).toHaveText('RM15,000.00')
    await expect(page.getByTestId('sub-toggle-upgrade')).toHaveCount(0)
    await expect(page.getByTestId('sub-notes')).toContainText(
      '[Naik taraf Pemantauan → Penuh pada 08/05/2026 03:09]',
    )
    await expectNoHorizontalScroll(page)
  })

  test('"Tunjuk" changes the page size and the pager keeps per_page', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/14')
    await expect(page.getByTestId('sub-student-row')).toHaveCount(50)
    await page.getByTestId('sub-per-page').selectOption('25')
    await expect(page).toHaveURL(/\?per_page=25$/)
    await expect(page.getByTestId('sub-student-row')).toHaveCount(25)
    await expect(page.getByTestId('sub-per-page')).toHaveValue('25')
    await expect(page.getByTestId('sub-range')).toHaveText('perbarisan · Memaparkan 1-25 dari 150')
    await expect(
      page
        .getByTestId('sub-pager')
        .getByRole('link', { name: /Next|Go to page 2/ })
        .first(),
    ).toHaveAttribute('href', /per_page=25.*page=2|page=2.*per_page=25/)
    await expectNoHorizontalScroll(page)
  })

  test('the three panels toggle independently; presets fill the days; 366 is blocked', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/14')
    await expect(page.getByTestId('sub-actions')).toBeVisible()
    await page.getByTestId('sub-toggle-quota').click()
    await page.getByTestId('sub-toggle-extend').click()
    await page.getByTestId('sub-toggle-upgrade').click()
    await expect(page.getByTestId('sub-quota-form')).toBeVisible()
    await expect(page.getByTestId('sub-extend-form')).toBeVisible()
    await expect(page.getByTestId('sub-upgrade-text')).toContainText(
      'Naik taraf dari Pemantauan (500 soalan/bulan) ke Penuh (Tanpa Had). Langganan akan dilanjutkan 1 tahun dari sekarang dengan harga RM30.00/pelajar.',
    )
    await expect(page.getByTestId('sub-quota-input')).toHaveValue('1000')
    await expect(page.getByTestId('sub-extend-current')).toContainText(
      /Tamat semasa: 12\/05\/2027 \d{2}:\d{2}/,
    )

    const expected = ['7', '14', '30', '60', '90', '180', '365']
    const presets = page.getByTestId('sub-extend-preset')
    await expect(presets).toHaveCount(7)
    for (let i = 0; i < expected.length; i++) {
      await presets.nth(i).click()
      await expect(page.getByTestId('sub-extend-days')).toHaveValue(expected[i]!)
    }
    await page.getByTestId('sub-extend-days').fill('366')
    expect(
      await page
        .getByTestId('sub-extend-days')
        .evaluate((el) => (el as HTMLInputElement).validity.rangeOverflow),
    ).toBe(true)
    await page.getByTestId('sub-quota-input').fill('2001')
    expect(
      await page
        .getByTestId('sub-quota-input')
        .evaluate((el) => (el as HTMLInputElement).validity.rangeOverflow),
    ).toBe(true)

    await page.getByTestId('sub-toggle-quota').click()
    await expect(page.getByTestId('sub-quota-form')).toHaveCount(0)
    await expect(page.getByTestId('sub-extend-form')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test(
    'Ubah Kuota saves 1200 with a reason',
    provisional('the flash text and the reason note format are UNVERIFIED (SRS §8, BR-26)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/school-subscriptions/14')
      await page.getByTestId('sub-toggle-quota').click()
      await page.getByTestId('sub-quota-input').fill('1200')
      await page.getByTestId('sub-quota-notes').fill('Tambahan pelajar')
      await page.getByTestId('sub-quota-save').click()
      await expect(page.getByTestId('sub-usage')).toHaveText('150 / 1200')
      await expect(page.getByTestId('sub-notes')).toContainText('Tambahan pelajar')
      await expect(page.getByText('Kuota berjaya dikemaskini.')).toBeVisible()
      await expect(page.getByTestId('sub-quota-form')).toHaveCount(0)
    },
  )

  test(
    'Lanjutkan Tempoh: dismissed confirm changes nothing, accepted adds 30 days',
    provisional('the flash text after an extend is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/school-subscriptions/14')
      await page.getByTestId('sub-toggle-extend').click()
      await page.getByTestId('sub-extend-preset').nth(2).click()

      const dismissed = dismissNextDialog(page, {
        type: 'confirm',
        message: 'Lanjutkan tempoh langganan?',
      })
      await page.getByTestId('sub-extend-submit').click()
      await dismissed
      await expect(page.getByTestId('sub-tiles')).toContainText('12/05/2027')
      await expect(page.getByTestId('sub-extend-form')).toBeVisible()

      const accepted = acceptNextDialog(page, { type: 'confirm' })
      await page.getByTestId('sub-extend-submit').click()
      await accepted
      // 12/05/2027 + 30 days = 11/06/2027.
      await expect(page.getByTestId('sub-tiles')).toContainText('11/06/2027')
      await expect(page.getByText('Tempoh langganan berjaya dilanjutkan.')).toBeVisible()
    },
  )

  test(
    'Naik Taraf: dismissed confirm changes nothing, accepted makes it Penuh',
    provisional('the flash text after an upgrade is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/school-subscriptions/14')
      await page.getByTestId('sub-toggle-upgrade').click()
      await page.getByTestId('sub-upgrade-reference').fill('REF-UPG')

      const dismissed = dismissNextDialog(page, {
        type: 'confirm',
        message: 'Naik taraf ke Pakej Penuh? Ini akan menukar langganan ke tanpa had soalan.',
      })
      await page.getByTestId('sub-upgrade-submit').click()
      await dismissed
      await expect(page.getByTestId('sub-tier')).toHaveText('Pemantauan')

      const accepted = acceptNextDialog(page, { type: 'confirm' })
      await page.getByTestId('sub-upgrade-submit').click()
      await accepted
      await expect(page.getByTestId('sub-tier')).toHaveText('Penuh')
      await expect(page.getByTestId('sub-toggle-upgrade')).toHaveCount(0)
      await expect(page.getByTestId('sub-notes')).toContainText(
        '[Naik taraf Pemantauan → Penuh pada',
      )
      await expect(page.getByTestId('sub-price')).toHaveText('RM30.00')
      await expect(page.getByText('Langganan berjaya dinaik taraf.')).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'Batalkan: dismissed confirm changes nothing, accepted shows "Batal"',
    provisional('the flash text after a cancel is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/school-subscriptions/14')
      await expect(page.getByTestId('sub-status')).toHaveText('Aktif')

      const dismissed = dismissNextDialog(page, {
        type: 'confirm',
        message: 'Adakah anda pasti mahu batalkan langganan ini?',
      })
      await page.getByTestId('sub-cancel').click()
      await dismissed
      await expect(page.getByTestId('sub-status')).toHaveText('Aktif')

      const accepted = acceptNextDialog(page, { type: 'confirm' })
      await page.getByTestId('sub-cancel').click()
      await accepted
      await expect(page.getByTestId('sub-status')).toHaveText('Batal')
      await expect(page.getByText('Langganan berjaya dibatalkan.')).toBeVisible()
    },
  )

  test('seed cancelled (13) and expired (4) rows render fully', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/13')
    await expect(page.getByTestId('sub-status')).toHaveText('Batal')
    await expect(page.getByTestId('sub-actions')).toBeVisible()
    await gotoApp('/admin/school-subscriptions/4')
    await expect(page.getByTestId('sub-status')).toHaveText('Tamat')
    await expect(page.getByTestId('sub-actions')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('an unknown subscription (detail and invoice) is the standard 404 page', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/999999')
    await expect(page.getByRole('heading', { name: 'Halaman Tidak Dijumpai' })).toBeVisible()
    await expect(page.getByTestId('sub-load-error')).toHaveCount(0)
    await gotoApp('/admin/school-subscriptions/999999/renewal-invoice')
    await expect(page.getByRole('heading', { name: 'Halaman Tidak Dijumpai' })).toBeVisible()
  })
})

test.describe('M02 S15 renewal invoice', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('opens standalone from S14 with 562 x RM30.00 = RM16,860.00', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/10')
    await expect(page.getByTestId('sub-summary-card')).toBeVisible()
    const school = (await page.getByTestId('sub-school').innerText()).trim()
    await page.getByTestId('sub-invoice').click()

    await expect(page).toHaveURL('/admin/school-subscriptions/10/renewal-invoice')
    await expect(page.getByTestId('invoice-sheet')).toBeVisible()
    await expect(page.getByTestId('invoice-row').first()).toBeVisible()
    await expectTabTitle(page, `Invoice Pembaharuan - ${school}`)
    // Standalone: no shell around it.
    await expect(page.locator('.admin-shell')).toHaveCount(0)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('PRESTASIPLUS')
    await expect(page.getByText('Platform Pembelajaran Interaktif')).toBeVisible()
    await expect(page.getByText('https://prestasiplus.my')).toBeVisible()
    await expect(page.getByTestId('invoice-date')).toHaveText('Tarikh: 25/09/2026')
    await expect(page.getByTestId('invoice-ref')).toHaveText('Ref: INV-10-20260925')
    await expect(page.getByTestId('invoice-school')).toHaveText(school)
    await expect(page.getByTestId('invoice-school-meta')).toContainText('Kod: ')
    await expect(page.getByTestId('invoice-package')).toHaveText('Pakej SPM Tingkatan 5')
    await expect(page.getByTestId('invoice-current')).toHaveText('21/04/2026 - 08/05/2027')
    await expect(page.getByTestId('invoice-renewal')).toHaveText('08/05/2027 - 08/05/2028')
    await expect(page.getByTestId('invoice-list-title')).toHaveText('Senarai Pelajar (562 orang)')
    await expect(page.getByTestId('invoice-row')).toHaveCount(562)
    await expect(page.locator('thead th')).toHaveText([
      'No.',
      'Nama Pelajar',
      'ID Delima',
      'Tingkatan',
    ])
    await expect(page.getByTestId('invoice-count')).toHaveText('562 orang')
    await expect(page.getByTestId('invoice-price')).toHaveText('RM30.00')
    await expect(page.getByTestId('invoice-total')).toHaveText('RM16,860.00')
    await expect(
      page.getByText(
        'Sila buat pembayaran melalui pemindahan bank atau tunai kepada pihak pentadbir.',
      ),
    ).toBeVisible()
    await expect(
      page.getByText('Dokumen ini dijana secara automatik oleh sistem PRESTASIPLUS.'),
    ).toBeVisible()
    await expect(
      page.getByText('Untuk sebarang pertanyaan, hubungi pentadbir sistem.'),
    ).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('"Cetak Invoice" calls window.print, the toolbar hides in print, "Kembali" returns', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/school-subscriptions/14/renewal-invoice')
    await expect(page.getByTestId('invoice-total')).toHaveText('RM4,500.00')
    await expect(page.getByTestId('invoice-ref')).toHaveText('Ref: INV-14-20260925')

    await page.evaluate(() => {
      ;(window as unknown as { __printed: number }).__printed = 0
      window.print = () => {
        ;(window as unknown as { __printed: number }).__printed += 1
      }
    })
    await page.getByTestId('invoice-print').click()
    expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(
      1,
    )

    await page.emulateMedia({ media: 'print' })
    await expect(page.getByTestId('invoice-toolbar')).toBeHidden()
    await page.emulateMedia({ media: 'screen' })
    await expect(page.getByTestId('invoice-toolbar')).toBeVisible()

    await page.getByTestId('invoice-back').click()
    await expect(page).toHaveURL('/admin/school-subscriptions/14')
    await expect(page.getByTestId('sub-summary-card')).toBeVisible()
  })
})

test.describe('M02 S16 assign SPM packages', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('school card, T4 at 150, T5 unassigned, links and quota limits', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/5601/packages')
    await expect(page.getByTestId('packages-school')).toBeVisible()
    await expect(page).toHaveTitle(/^Assign Pakej SPM - .+ [|] PRESTASIPLUS$/)
    await expect(page.getByTestId('packages-school')).toContainText('Admin Sekolah')

    const t4 = page.getByTestId('package-card-t4')
    const t5 = page.getByTestId('package-card-t5')
    await expect(t4).toContainText('Pakej Tingkatan 4')
    await expect(t4).toContainText('RM 30/pelajar · 2 tahun')
    await expect(t4.getByTestId('package-status')).not.toHaveText('Belum Ditetapkan')
    await expect(t4.getByTestId('package-quota')).toHaveValue('150')
    await expect(t4.getByTestId('package-submit')).toHaveText('Tetapkan Pakej T4')
    await expect(t5).toContainText('Pakej Tingkatan 5')
    await expect(t5).toContainText('RM 30/pelajar · 1 tahun')
    await expect(t5.getByTestId('package-status')).toHaveText('Belum Ditetapkan')
    await expect(t5.getByTestId('package-quota')).toHaveAttribute('placeholder', 'Cth: 120')
    await expect(t5.getByTestId('package-quota')).toHaveValue('')
    await expect(page.getByTestId('package-t5-count')).toContainText(
      'pelajar T5 sedia ada dalam sistem',
    )
    await expect(page.getByTestId('packages-back')).toHaveAttribute(
      'href',
      '/admin/users?role=school_admin',
    )
    await expect(page.getByTestId('packages-edit')).toHaveAttribute(
      'href',
      '/admin/users/5601/edit',
    )

    for (const [value, valid] of [
      ['0', false],
      ['2001', false],
      ['2000', true],
    ] as const) {
      await t5.getByTestId('package-quota').fill(value)
      expect(
        await t5
          .getByTestId('package-quota')
          .evaluate((el) => (el as HTMLInputElement).validity.valid),
      ).toBe(valid)
    }
    // Two cards side by side from lg, stacked below.
    const a = await t4.boundingBox()
    const b = await t5.boundingBox()
    if (isDesktopShell(page)) expect(Math.abs(a!.y - b!.y)).toBeLessThan(2)
    else expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1)
    await expectNoHorizontalScroll(page)
  })

  test(
    'assigning T5 shows the flash, the assigned badge and the saved quota',
    provisional('the flash text and the "Ditetapkan" badge are UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/users/5601/packages')
      const t5 = page.getByTestId('package-card-t5')
      await t5.getByTestId('package-quota').fill('120')
      await t5.getByTestId('package-submit').click()
      await expect(page.getByText('Pakej berjaya ditetapkan.')).toBeVisible()
      await expect(t5.getByTestId('package-status')).toHaveText('Ditetapkan')
      await expect(t5.getByTestId('package-quota')).toHaveValue('120')
      // T4 is untouched.
      await expect(page.getByTestId('package-card-t4').getByTestId('package-quota')).toHaveValue(
        '150',
      )

      await gotoApp('/admin/users/5601/packages')
      await expect(page.getByTestId('package-card-t5').getByTestId('package-quota')).toHaveValue(
        '120',
      )
      await expectNoHorizontalScroll(page)
    },
  )

  test('a user that is not a school admin shows the red box', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/1/packages')
    await expect(page.getByTestId('packages-error')).toBeVisible()
  })

  test('an unknown user is the standard 404 page', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/99999999/packages')
    await expect(page.getByRole('heading', { name: 'Halaman Tidak Dijumpai' })).toBeVisible()
  })
})
