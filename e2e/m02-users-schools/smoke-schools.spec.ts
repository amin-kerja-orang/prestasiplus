/**
 * M02-T8 developer smoke for S9 / S10 / S11 (build-plan M02-T8; QA writes E2E-M02-43..45 at G5):
 * the school list, its filters, create, edit and the active toggle, as the admin demo account at
 * 375 / 768 / 1280. Flash texts after a save or toggle are UNVERIFIED COPY (SRS §8), so the tests
 * that assert them are `@provisional`.
 *
 * v2 list (SchoolListPage): `DsDataTable` (table rows from 768 px, cards below), the filter bar (`Cari`,
 * or the `Penapis` sheet below 768 px), the "Kod Daftar" column, and primary schools (SK, SJK) hidden
 * unless "Tunjuk sekolah rendah" is ticked (U-04, `includePrimary=true`).
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
const NEW_SCHOOL = { name: 'SK TAMAN UJIAN E2E', code: 'ZZT0001', district: 'PPD UJIAN' }

const tableLayout = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 768

/** The list rows: table rows from 768 px, cards below. */
function rows(page: Page) {
  return page.locator(
    '[data-testid=schools-table] tbody tr, [data-testid=schools-table] [data-ds=data-table-cards] > li',
  )
}

function pager(page: Page) {
  return page.locator('[data-ds="data-table-pager"]')
}

async function openFilters(page: Page): Promise<void> {
  if (!tableLayout(page)) {
    await page.locator('[data-ds="filter-open"]').click()
    await expect(page.locator('[data-ds="filter-sheet"]')).toBeVisible()
  }
}

async function applyFilters(page: Page): Promise<void> {
  if (tableLayout(page)) await page.getByRole('button', { name: 'Cari', exact: true }).click()
  else await page.locator('[data-ds="filter-sheet"]').getByRole('button', { name: 'Guna' }).click()
}

async function resetFilters(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Set Semula' }).first().click()
}

async function openList(
  page: Page,
  gotoApp: (path: string) => Promise<void>,
  path = '/admin/schools',
): Promise<void> {
  await gotoApp(path)
  await expect(rows(page).first()).toBeVisible()
}

test.describe('M02 S9 school list', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('header, stats, table, pager and no page h-scroll', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    await expectTabTitle(page, 'Sekolah | PRESTASIPLUS')

    await expect(page.getByTestId('schools-stat-total')).toContainText('Jumlah Sekolah')
    await expect(page.getByTestId('schools-stat-active')).toContainText('Aktif')
    await expect(page.getByTestId('schools-stat-inactive')).toContainText('Tidak Aktif')
    const add = page.getByTestId('schools-add')
    await expect(add).toHaveText('Tambah Sekolah')
    await expect(add).toHaveAttribute('href', '/admin/schools/create')

    // Filter controls and their copy.
    await openFilters(page)
    await expect(page.getByTestId('schools-search')).toHaveAttribute(
      'placeholder',
      'Cari nama atau kod sekolah...',
    )
    await expect(page.getByTestId('schools-state').locator('option')).toHaveCount(17)
    // Primary types are hidden by default (U-04): the type filter lists the secondary types only.
    await expect(page.getByTestId('schools-type').locator('option').first()).toHaveText(
      'Semua Jenis',
    )
    expect(await page.getByTestId('schools-type').locator('option').allTextContents()).not.toContain('SK')
    await expect(page.getByTestId('schools-include-primary')).toBeVisible()
    if (!tableLayout(page)) await page.keyboard.press('Escape')

    // Table: ten columns, 30 rows per page.
    if (tableLayout(page)) {
      const heads = (await page.locator('thead th').allTextContents()).map((t) => t.trim())
      expect(heads).toEqual([
        'Nama Sekolah',
        'Kod',
        'Kod Daftar',
        'Jenis',
        'Negeri',
        'Daerah',
        'Pelajar',
        'Guru',
        'Status',
        'Tindakan',
      ])
    }
    await expect(rows(page)).toHaveCount(30)
    const first = rows(page).first()
    if (tableLayout(page)) {
      await expect(first.getByTestId('school-edit')).toHaveAttribute('title', 'Edit')
      await expect(first.getByTestId('school-toggle')).toHaveAttribute('title', 'Nyahaktif')
    }
    await expect(first.getByTestId('school-join-code')).toBeVisible()

    await expect(pager(page)).toContainText('Menunjukkan 1-30 daripada')
    await expectNoHorizontalScroll(page)
  })

  test('the next-page button opens page 2 with 30 other rows', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    const firstName = (await rows(page).first().getByTestId('school-row').innerText()).trim()

    await pager(page).getByRole('button', { name: 'Seterusnya' }).click()
    await expect(page).toHaveURL(/\/admin\/schools\?page=2$/)
    await expect(rows(page)).toHaveCount(30)
    await expect(rows(page).first().getByTestId('school-row')).not.toHaveText(firstName)
    await expect(pager(page)).toContainText('Menunjukkan 31-60 daripada')
    await expectNoHorizontalScroll(page)
  })

  test('with primary schools shown, the list has the live 10,220 schools over 341 pages', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp, '/admin/schools?includePrimary=true')
    await expect(page.getByTestId('schools-stat-total')).toHaveText(/10,220\s*Jumlah Sekolah/)
    await expect(page.getByTestId('schools-stat-active')).toHaveText(/10,212\s*Aktif/)
    await expect(page.getByTestId('schools-stat-inactive')).toHaveText(/8\s*Tidak Aktif/)
    await expect(pager(page)).toContainText('daripada 10220 hasil')
    await gotoApp('/admin/schools?includePrimary=true&page=341')
    await expect(rows(page)).toHaveCount(20)
    await expectNoHorizontalScroll(page)
  })

  test('search, state and type filters narrow the list; reset only when filtered', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    await expect(page.getByRole('button', { name: 'Set Semula' })).toHaveCount(0)

    await openFilters(page)
    await page.getByTestId('schools-search').fill('bangi')
    await applyFilters(page)
    await expect(page).toHaveURL(/\?search=bangi$/)
    await expect(rows(page).first()).toBeVisible()
    for (const row of await rows(page).all()) {
      await expect(row).toContainText(/bangi/i)
    }

    await resetFilters(page)
    await expect(page).toHaveURL(/\/admin\/schools$/)
    await expect(rows(page)).toHaveCount(30)

    await openFilters(page)
    await page.getByTestId('schools-state').selectOption('Perlis')
    await applyFilters(page)
    await expect(page).toHaveURL(/\?state=Perlis$/)
    await expect(rows(page).first()).toBeVisible()
    for (const row of await rows(page).all()) {
      await expect(row).toContainText('Perlis')
    }

    await resetFilters(page)
    await expect(page).toHaveURL(/\/admin\/schools$/)
    await openFilters(page)
    await page.getByTestId('schools-include-primary').check()
    await page.getByTestId('schools-type').selectOption('SK')
    await applyFilters(page)
    await expect(page).toHaveURL(/type=SK/)
    await expect(pager(page)).toContainText('daripada 7779 hasil')
    await expect(rows(page).first()).toContainText('SK')

    // Filters survive in the pager.
    await pager(page).getByRole('button', { name: 'Seterusnya' }).click()
    await expect(page).toHaveURL(/type=SK/)
    await expect(page).toHaveURL(/page=2/)
    await expectNoHorizontalScroll(page)
  })

  test('a search with no match shows the empty state and no pager', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/schools?search=zzqxv')
    const empty = page.getByTestId('schools-empty')
    await expect(empty).toContainText('Tiada sekolah dijumpai')
    await expect(rows(page).filter({ has: page.getByTestId('school-row') })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Set Semula' }).first()).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('row actions are touch-sized below 1024px', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    if (isDesktopShell(page)) return
    if (tableLayout(page)) {
      await expectTouchTarget(rows(page).first().getByTestId('school-edit'))
      await expectTouchTarget(rows(page).first().getByTestId('school-toggle'))
    } else {
      await expectTouchTarget(rows(page).first().getByRole('link', { name: 'Edit' }))
    }
    await expectTouchTarget(page.getByTestId('schools-add'))
  })

  test(
    'toggle switches the status without a dialog and updates the stats',
    provisional('the flash text after a toggle is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openList(page, gotoApp, '/admin/schools?search=bangi')
      let dialogs = 0
      page.on('dialog', (dialog) => {
        dialogs += 1
        void dialog.dismiss()
      })
      const activeBefore = await page.getByTestId('schools-stat-active').innerText()
      const inactiveBefore = await page.getByTestId('schools-stat-inactive').innerText()

      const id = await rows(page).first().getByTestId('school-row').getAttribute('data-school-id')
      const target = rows(page).filter({
        has: page.locator(`[data-school-id="${String(id)}"]`),
      })
      await expect(target.getByTestId('school-status')).toHaveText('Aktif')
      await target.getByTestId('school-toggle').click()

      await expect(target.getByTestId('school-status')).toHaveText('Tidak Aktif')
      await expect(target.getByTestId('school-toggle')).toHaveAttribute('title', 'Aktifkan')
      await expect(page.getByTestId('schools-stat-active')).not.toHaveText(activeBefore)
      await expect(page.getByTestId('schools-stat-inactive')).not.toHaveText(inactiveBefore)
      await expect(page.getByText('Status sekolah berjaya dikemaskini.')).toBeVisible()
      await expect(page).toHaveURL(/\?search=bangi$/)
      expect(dialogs).toBe(0)

      await target.getByTestId('school-toggle').click()
      await expect(target.getByTestId('school-status')).toHaveText('Aktif')
      await expect(page.getByTestId('schools-stat-inactive')).toHaveText(inactiveBefore)
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M02 S10 / S11 school form', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  async function fillNewSchool(page: Page): Promise<void> {
    await page.getByLabel('Nama Sekolah').fill(NEW_SCHOOL.name)
    await page.getByLabel('Kod Sekolah').fill(NEW_SCHOOL.code)
    await page.getByLabel('Jenis').selectOption('SK')
    await page.getByLabel('Negeri').selectOption('Selangor')
    await page.getByLabel('Daerah').fill(NEW_SCHOOL.district)
  }

  test('create form: title, fields, options, grid, native validation, cancel', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await openList(page, gotoApp)
    await page.getByTestId('schools-add').click()
    await expect(page).toHaveURL('/admin/schools/create')
    await expect(page.getByTestId('school-form')).toBeVisible()
    await expectTabTitle(page, 'Tambah Sekolah | PRESTASIPLUS')

    await expect(page.getByTestId('school-back')).toHaveText('Kembali ke Senarai Sekolah')
    await expect(page.getByLabel('Nama Sekolah')).toHaveAttribute(
      'placeholder',
      'cth: SK TAMAN KLUANG BARU',
    )
    await expect(page.getByLabel('Kod Sekolah')).toHaveAttribute('placeholder', 'cth: JBA1234')
    await expect(page.getByLabel('Daerah')).toHaveAttribute('placeholder', 'cth: KLUANG')
    await expect(page.getByLabel('Bandar')).toHaveAttribute('placeholder', 'cth: KLUANG')
    await expect(page.getByTestId('school-type').locator('option')).toHaveText([
      'Pilih jenis',
      'SK',
      'SMK',
      'SJK(C)',
      'SJK(T)',
      'MRSM',
      'SBP',
    ])
    await expect(page.getByTestId('school-state').locator('option')).toHaveCount(17)
    await expect(page.getByTestId('school-state').locator('option').first()).toHaveText(
      'Pilih negeri',
    )
    await expect(page.getByLabel('Sekolah Aktif')).toBeChecked()
    await expect(page.getByTestId('form-submit')).toHaveText('Simpan')
    await expect(page.getByTestId('form-cancel')).toHaveText('Batal')

    // One column below 640, two columns from 640 (Jenis / Negeri side by side).
    const type = await page.getByTestId('school-type').boundingBox()
    const state = await page.getByTestId('school-state').boundingBox()
    if (isMobileWidth(page)) expect(state!.y).toBeGreaterThan(type!.y + type!.height - 1)
    else expect(Math.abs(state!.y - type!.y)).toBeLessThan(2)

    // Native validation blocks an empty submit (no request, stays on the form).
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL('/admin/schools/create')
    await expect(page.getByTestId('school-name')).toBeFocused()
    expect(
      await page
        .getByTestId('school-name')
        .evaluate((el) => (el as HTMLInputElement).validity.valueMissing),
    ).toBe(true)
    await expectNoHorizontalScroll(page)

    await page.getByTestId('form-cancel').click()
    await expect(page).toHaveURL('/admin/schools')
    await expect(rows(page).first()).toBeVisible()
  })

  test(
    'create saves the school, returns to the list with the flash and updates the total',
    provisional('the flash text after a save is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/schools/create')
      await fillNewSchool(page)
      await page.getByTestId('form-submit').click()

      await expect(page).toHaveURL('/admin/schools')
      await expect(page.getByText('Sekolah berjaya disimpan.')).toBeVisible()
      await expect(page.getByTestId('schools-stat-total')).toHaveText(/10,221/)
      await expect(page.getByTestId('schools-stat-active')).toHaveText(/10,213/)

      await page.getByTestId('schools-search').fill(NEW_SCHOOL.code)
      await page.getByTestId('schools-search-submit').click()
      await expect(rows(page)).toHaveCount(1)
      await expect(rows(page).first()).toContainText(NEW_SCHOOL.name)
      await expect(rows(page).first()).toContainText('Selangor')
      await expect(rows(page).first()).toContainText(NEW_SCHOOL.district)
      await expect(rows(page).first().getByTestId('school-status')).toHaveText('Aktif')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'a duplicate code shows the red alert and keeps the input',
    provisional('the duplicate-code message is INFERRED Laravel copy (SRS §5)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/schools/create')
      await fillNewSchool(page)
      await page.getByTestId('form-submit').click()
      await expect(page).toHaveURL('/admin/schools')

      await page.getByTestId('schools-add').click()
      await expect(page.getByTestId('school-form')).toBeVisible()
      await fillNewSchool(page)
      await page.getByTestId('form-submit').click()

      await expect(page.getByTestId('school-form-alert')).toContainText(
        'The code has already been taken.',
      )
      await expect(page).toHaveURL('/admin/schools/create')
      await expect(page.getByLabel('Kod Sekolah')).toHaveValue(NEW_SCHOOL.code)
      await expect(page.getByLabel('Nama Sekolah')).toHaveValue(NEW_SCHOOL.name)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'edit pre-fills the school, saves the change and returns to the list',
    provisional('the flash text after a save is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await openList(page, gotoApp, '/admin/schools?search=bangi')
      const row = rows(page).first()
      const name = (await row.locator('td').first().innerText()).trim()
      const code = (await row.locator('td').nth(1).innerText()).trim()
      await row.getByTestId('school-edit').click()

      await expect(page).toHaveURL(/\/admin\/schools\/\d+\/edit$/)
      await expectTabTitle(page, 'Edit Sekolah | PRESTASIPLUS')
      await expect(page.getByLabel('Nama Sekolah')).toHaveValue(name)
      await expect(page.getByLabel('Kod Sekolah')).toHaveValue(code)
      await expect(page.getByLabel('Jenis')).not.toHaveValue('')
      await expect(page.getByLabel('Negeri')).not.toHaveValue('')
      await expect(page.getByTestId('form-submit')).toHaveText('Kemaskini')
      // The shell header subtitle is the school name (SRS §2).
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
      await expectNoHorizontalScroll(page)

      await page.getByLabel('Daerah').fill('PPD KEMASKINI')
      // The native checkbox is visually hidden behind the switch track: click its label text.
      await page.getByText('Sekolah Aktif', { exact: true }).click()
      await expect(page.getByLabel('Sekolah Aktif')).not.toBeChecked()
      await page.getByTestId('form-submit').click()

      await expect(page).toHaveURL('/admin/schools')
      await expect(page.getByText('Sekolah berjaya disimpan.')).toBeVisible()
      await page.getByTestId('schools-search').fill(code)
      await page.getByTestId('schools-search-submit').click()
      await expect(rows(page)).toHaveCount(1)
      await expect(rows(page).first()).toContainText('PPD KEMASKINI')
      await expect(rows(page).first().getByTestId('school-status')).toHaveText('Tidak Aktif')
      await expect(rows(page).first().getByTestId('school-toggle')).toHaveAttribute(
        'title',
        'Aktifkan',
      )
    },
  )

  test('edit of an unknown school shows the standard 404 page', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/schools/99999999/edit')
    await expectTabTitle(page, 'Halaman Tidak Dijumpai | PRESTASIPLUS')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Halaman Tidak Dijumpai', exact: true }),
    ).toBeVisible()
  })
})
