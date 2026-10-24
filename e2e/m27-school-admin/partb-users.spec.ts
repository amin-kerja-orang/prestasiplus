/**
 * M27 Part B user management at 375 / 768 / 1280: S6 Senarai Pelajar, S7 Senarai Guru, S9 Edit Pelajar, S10 Edit Guru,
 * S11 Cipta Pengguna, S12 Tambah Pelajar and "Eksport CSV" (SRS M27 Part B §24: E2E-M27-39, 41 to 43, 83 to 86, 90,
 * 91, 95, 100 to 102 and the write flows E2E-M27-87, 88, 92 to 94).
 *
 * Personas (URS §10.3): P1 `azlan@demo.test` (school 900003, no pupil, teacher or class), P2 `adminsekolah@demo.test`
 * (school 900001: pupils 3001 to 3008, teacher 5 `guru@demo.test`, classes 2001 and 2002). Oracle = the owner's data
 * through the app itself; no figure is pinned.
 *
 */

import { readFileSync } from 'node:fs'

import type { Page } from '@playwright/test'

import { createMockHandle, gotoApp as gotoAppOn } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  dismissNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  viewportWidth,
} from '../support'

const MODULE = { tag: ['@m27'] }
const WRITES = MODULE
const P1 = 'azlan@demo.test'
const P2 = 'adminsekolah@demo.test'
const NOT_FOUND_TITLE = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'
const FORBIDDEN_TITLE = '403 - Akses Ditolak | PRESTASIPLUS'

test.use({ mockInit: { latency: 0 } })

/** Signs a non-canonical fixture user in (`loginAs` knows canonical accounts only). */
async function signIn(page: Page, who: string | number): Promise<void> {
  await gotoAppOn(page, '/login')
  await createMockHandle(page).setUser(who)
}

const rows = (page: Page) => page.getByTestId('user-row')

async function openList(page: Page, gotoApp: (p: string) => Promise<void>, path: string) {
  await gotoApp(path)
  await expect(page.getByTestId('user-found')).toContainText('pengguna dijumpai', { timeout: 60_000 })
}

test.describe('S6 Senarai Pelajar', MODULE, () => {
  test('E2E-M27-83 P2: single card "Pelajar", rows of pupils 3001-3008, columns, school scope only', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    await expectTabTitle(page, 'Senarai Pelajar - PRESTASIPLUS')
    await expect(page.getByTestId('user-count-card').locator('> div')).toHaveCount(1)
    await expect(page.getByTestId('user-count-label')).toHaveText('Pelajar')
    await expect(page.locator('thead th')).toHaveText([
      '#', 'Nama', 'Emel', 'Telefon', 'Tingkatan', 'Kelas', 'Aktif?', 'Tarikh', 'Tindakan',
    ])
    for (let id = 3001; id <= 3008; id++) {
      await expect(page.locator(`[data-testid="user-row"][data-user-id="${id}"]`)).toBeVisible()
    }
    // the count card is the unfiltered total of the school; "{n} pengguna dijumpai" equals it without a filter
    const card = (await page.getByTestId('user-count').innerText()).trim()
    await expect(page.getByTestId('user-found')).toHaveText(`${card} pengguna dijumpai`)
    await expect(rows(page).first().getByTestId('user-date')).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/)
    await expect(page.getByTestId('user-impersonate')).toHaveCount(await rows(page).count())
  })

  test('E2E-M27-84 P1: empty row; P2: buttons, link and "Edit" on an active pupil, no import / delete / checkbox', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, P1)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    await expect(page.getByTestId('user-empty')).toContainText('Tiada pengguna dijumpai')
    await expect(page.getByTestId('user-empty')).toContainText('Cuba ubah kriteria carian anda')
    await expect(page.getByTestId('user-count')).toHaveText('0')
    await expect(page.getByTestId('user-pager')).toBeEmpty()
    await createMockHandle(page).setUser(P2)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    await expect(page.getByTestId('user-export')).toHaveText('Eksport CSV')
    await expect(page.getByTestId('user-export')).toHaveAttribute(
      'title',
      'Muat turun senarai mengikut tapisan di atas',
    )
    await expect(page.getByTestId('user-add')).toHaveText('Tambah Pelajar')
    const first = page.locator('[data-testid="user-row"][data-user-id="3001"]')
    await expect(first.getByTestId('user-name')).toHaveAttribute('href', '/admin-sekolah/pelajar/3001')
    await expect(first.getByTestId('user-edit')).toHaveAttribute('title', 'Edit')
    await expect(first.getByTestId('user-status')).toHaveText('Aktif')
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0)
    await expect(page.getByTestId('sp-page').getByText(/Import|Padam|Log Masuk Sebagai/)).toHaveCount(0)
  })

  test('E2E-M27-85 status filter and search narrow the list and the count', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    const all = await rows(page).count()
    await page.getByTestId('user-search').fill('zzz-tiada-padanan')
    await page.getByTestId('user-search-submit').click()
    await expect(page).toHaveURL(/search=zzz-tiada-padanan/)
    await expect(page.getByTestId('user-found')).toHaveText('0 pengguna dijumpai')
    await expect(page.getByTestId('user-empty')).toBeVisible()
    // the card ignores the filters
    await expect(page.getByTestId('user-count')).not.toHaveText('0')
    await page.getByTestId('user-search').fill('')
    await page.getByTestId('user-status-filter').selectOption('1')
    await page.getByTestId('user-search-submit').click()
    await expect(page).toHaveURL(/is_active=1/)
    await expect.poll(() => rows(page).count()).toBeGreaterThan(0)
    expect(await rows(page).count()).toBeLessThanOrEqual(all)
    await expect(page.getByTestId('user-status').first()).toHaveText('Aktif')
  })

  test('E2E-M27-41 header, sub-line, tab title and breadcrumb; "Tambah Pelajar" opens S12 with "Senarai Pelajar" active', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, P1)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    const back = page.getByTestId('user-crumb-back')
    await expect(back).toHaveText('Papan Pemuka Sekolah')
    await expect(back).toHaveAttribute('href', '/admin-sekolah')
    await expect(page.locator('main h1, h1').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Senarai Pelajar' }).first()).toBeVisible()
    if (isDesktopShell(page)) {
      await expect(page.getByTestId('shell-user-sidebar').locator('[data-nav-id="sa-senarai-pelajar"]')).toHaveClass(/\bactive\b/)
      await expect(page.getByTestId('shell-user-sidebar').locator('[data-nav-id="sa-dashboard"]')).not.toHaveClass(/\bactive\b/)
    }
    await page.getByTestId('user-add').click()
    await expect(page).toHaveURL(/\/admin-sekolah\/pelajar\/baru$/)
    await expectTabTitle(page, 'Tambah Pelajar - PRESTASIPLUS')
    await expect(page.getByText('Cipta satu akaun pelajar').first()).toBeVisible()
    if (isDesktopShell(page)) {
      await expect(page.getByTestId('shell-user-sidebar').locator('[data-nav-id="sa-senarai-pelajar"]')).toHaveClass(/\bactive\b/)
    }
  })

  test('E2E-M27-43 no horizontal scroll; the table scrolls inside its card', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    await expectNoHorizontalScroll(page)
    if (viewportWidth(page) < 1280) {
      const scroller = page.getByTestId('user-table').locator('xpath=ancestor::div[contains(@class,"overflow-x-auto")][1]')
      expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
    }
    // touch targets of the header-actions row
    const box = await page.getByTestId('user-export').boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })
})

test.describe('S7 Senarai Guru', MODULE, () => {
  test('E2E-M27-90 P2: single card "Guru", buttons, columns, teacher 5 "2 kelas", edit link', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/guru')
    await expectTabTitle(page, 'Senarai Guru - PRESTASIPLUS')
    await expect(page.getByTestId('user-count-label')).toHaveText('Guru')
    await expect(page.getByTestId('user-export')).toHaveText('Eksport CSV')
    await expect(page.getByTestId('user-add')).toHaveText('Cipta Pengguna')
    await expect(page.getByTestId('user-add')).toHaveAttribute('href', '/admin-sekolah/guru/baru')
    await expect(page.locator('thead th')).toHaveText([
      '#', 'Nama', 'Emel', 'Telefon', 'Kelas', 'Login Terakhir', 'Aktif?', 'Tarikh', 'Tindakan',
    ])
    const t5 = page.locator('[data-testid="user-row"][data-user-id="5"]')
    await expect(t5.getByTestId('user-classes')).toHaveText('2 kelas')
    await expect(t5.getByTestId('user-toggle')).toContainText('Aktif')
    await expect(t5.getByTestId('user-name')).toHaveAttribute('href', '/admin-sekolah/guru/5')
    await expect(t5.getByTestId('user-last-login')).toHaveText(/^(Belum login|\d+ .+ yang lepas)$/)
    await expect(page.getByText('Tambah Pelajar')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M27-91 P1: empty row for a school without teachers', async ({ page, gotoApp }) => {
    await signIn(page, P1)
    await openList(page, gotoApp, '/admin-sekolah/guru')
    await expect(page.getByTestId('user-empty')).toContainText('Tiada pengguna dijumpai')
    if (isDesktopShell(page)) {
      await expect(page.getByTestId('shell-user-sidebar').locator('[data-nav-id="sa-senarai-guru"]')).toHaveClass(/\bactive\b/)
    }
  })
})

test.describe('S9, S10 edit pages (read part)', MODULE, () => {
  test('E2E-M27-86 P2 pupil 3001: profile card, fields, status line, closed reset bar, footer', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await gotoApp('/admin-sekolah/pelajar/3001')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await expectTabTitle(page, 'Edit Pengguna - PRESTASIPLUS')
    await expect(page.getByText('Kemaskini maklumat pengguna').first()).toBeVisible()
    await expect(page.getByTestId('user-profile-created')).toContainText('Daftar: ')
    await expect(page.getByTestId('user-profile-updated')).toContainText('Kemaskini: ')
    await expect(page.getByTestId('user-name')).not.toHaveValue('')
    await expect(page.getByTestId('user-status-line')).toContainText('Aktif')
    await expect(page.getByTestId('user-password-toggle')).toContainText('Set Semula Kata Laluan')
    await expect(page.getByTestId('user-password-panel')).toBeHidden()
    await page.getByTestId('user-password-toggle').click()
    await expect(page.getByTestId('user-new-password')).toBeVisible()
    await expect(page.getByTestId('user-new-password-confirm')).toBeVisible()
    await expect(page.getByTestId('form-cancel')).toHaveAttribute('href', '/admin-sekolah/pelajar')
    await expect(page.getByTestId('form-submit')).toHaveText('Kemaskini')
    await expect(page.locator('select')).toHaveCount(0)
    await expect(page.getByText(/Nota Keselamatan|Kad Pengenalan/)).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    if (isDesktopShell(page)) {
      await expect(page.getByTestId('shell-user-sidebar').locator('[data-nav-id="sa-senarai-pelajar"]')).toHaveClass(/\bactive\b/)
    }
  })

  test('E2E-M27-92 P2 teacher 5 (S10): form and closed reset bar, no status line; "Batal" returns to S7', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await gotoApp('/admin-sekolah/guru/5')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('user-status-line')).toHaveCount(0)
    await expect(page.getByTestId('user-password-panel')).toBeHidden()
    await page.getByTestId('form-cancel').click()
    await expect(page).toHaveURL(/\/admin-sekolah\/guru$/)
  })

  test('E2E-M27-39 P2: a foreign / unknown id, teacher 5 on the pupil route and pupil 3001 on the teacher route give the 404 page', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M27-39 runs at 1280 only')
    test.setTimeout(360_000) // five full app boots
    await loginAs(P2)
    for (const path of [
      '/admin-sekolah/pelajar/5',
      '/admin-sekolah/guru/3001',
      '/admin-sekolah/pelajar/99999999',
      '/admin-sekolah/guru/99999999',
      '/admin-sekolah/pelajar/abc',
    ]) {
      await gotoApp(path)
      await expect(page.locator('[data-page=not-found]')).toBeVisible({
        timeout: 60_000,
      })
      await expectTabTitle(page, NOT_FOUND_TITLE)
    }
  })

  test('E2E-M27-36 a teacher gets the 403 page on every route of this task', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M27-36 runs at 1280 only')
    test.setTimeout(360_000) // six full app boots
    await loginAs('guru@demo.test')
    for (const path of [
      '/admin-sekolah/pelajar',
      '/admin-sekolah/guru',
      '/admin-sekolah/pelajar/3001',
      '/admin-sekolah/guru/5',
      '/admin-sekolah/guru/baru',
      '/admin-sekolah/pelajar/baru',
    ]) {
      await gotoApp(path)
      await expect(page.locator('[data-page=forbidden]')).toBeVisible()
      await expectTabTitle(page, FORBIDDEN_TITLE)
    }
  })
})

test.describe('S11 and S12 forms (read part)', MODULE, () => {
  test('E2E-M27-95 P2 S11: copy, read-only role, locked school label, six fields, footer', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/guru')
    await page.getByTestId('user-add').click()
    await expect(page).toHaveURL(/\/admin-sekolah\/guru\/baru$/)
    await expectTabTitle(page, 'Cipta Pengguna - PRESTASIPLUS')
    await expect(page.getByText('Daftarkan akaun guru ke sekolah anda').first()).toBeVisible()
    await expect(page.getByText('Borang Pendaftaran Pengguna')).toBeVisible()
    await expect(page.getByTestId('user-role')).toHaveText('Guru')
    await expect(page.getByTestId('user-school-name')).not.toBeEmpty()
    await expect(page.getByTestId('user-password')).toHaveAttribute('placeholder', 'Minimum 6 aksara')
    await expect(page.getByTestId('form-submit')).toHaveText('Daftar Pengguna')
    await expect(page.locator('select')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    if (isDesktopShell(page)) {
      await expect(page.getByTestId('shell-user-sidebar').locator('[data-nav-id="sa-senarai-guru"]')).toHaveClass(/\bactive\b/)
    }
  })

  test('E2E-M27-100 P2 S12: header, locked school label, "Kelas" options (classes 2001, 2002), hint, buttons', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    await page.getByTestId('user-add').click()
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('Cipta satu akaun pelajar').first()).toBeVisible()
    await expect(page.getByTestId('user-school-name')).not.toBeEmpty()
    await expect(page.getByTestId('user-school-meta')).toContainText(' · ')
    const options = page.getByTestId('pupil-class').locator('option')
    expect(await options.count()).toBeGreaterThanOrEqual(3)
    await expect(options.first()).toHaveText('Tiada kelas')
    await expect(page.getByTestId('pupil-password-hint')).toHaveText(
      'Biarkan kosong untuk guna kata laluan lalai (minimum 8 aksara).',
    )
    await expect(page.getByTestId('pupil-password')).toHaveAttribute('placeholder', /^•+$/)
    await expect(page.getByTestId('form-submit')).toHaveText('Cipta Pelajar')
    await expect(page.getByTestId('form-cancel')).toHaveText('Batal')
    await expect(page.getByTestId('pupil-credential')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
})

test.describe('"Eksport CSV"', MODULE, () => {
  test('E2E-M27-102 S6 downloads the filtered pupils of the school (form values, Cari not pressed); S7 the teachers', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M27-102 runs at 1280 only')
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    await page.getByTestId('user-status-filter').selectOption('1')
    // "Cari" is not pressed: the export still uses the values in the form
    const pupils = page.waitForEvent('download')
    await page.getByTestId('user-export').click()
    const file = await pupils
    expect(file.suggestedFilename()).toMatch(/^users-pelajar-\d{4}-\d{2}-\d{2}\.csv$/)
    const body = readFileSync(await file.path(), 'utf8')
    expect(body.charCodeAt(0)).toBe(0xfeff)
    const lines = body.slice(1).trim().split(/\r?\n/)
    expect(lines[0]).toBe('id,name,email,role,sekolah,kelas,is_active,created_at')
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines.slice(1)) {
      expect(line).toContain(',pelajar,')
      expect(line).toMatch(/,1,[^,]+$/)
    }
    expect(body).not.toMatch(/phone|telefon|ic_number/i)

    await openList(page, gotoApp, '/admin-sekolah/guru')
    const teachers = page.waitForEvent('download')
    await page.getByTestId('user-export').click()
    const tfile = await teachers
    expect(tfile.suggestedFilename()).toMatch(/^users-guru-\d{4}-\d{2}-\d{2}\.csv$/)
    const tbody = readFileSync(await tfile.path(), 'utf8')
    expect(tbody).toContain(',guru,')
    expect(tbody).toContain('guru@demo.test')
  })
})

// ---- Write flows (handlers: M27-T1b #8, #9, #12 to #15, #19). -----------------------------------------------------

test.describe('write flows', WRITES, () => {
  test('E2E-M27-87 S9: save returns to S6 with the flash; validation errors show above the form', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M27-87 runs at 1280 only')
    await loginAs(P2)
    await gotoApp('/admin-sekolah/pelajar/3001')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('user-name').fill('')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toBeVisible()
    await expect(page).toHaveURL(/\/admin-sekolah\/pelajar\/3001$/)
    await page.getByTestId('user-name').fill('Murid Ujian Disunting')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL(/\/admin-sekolah\/pelajar$/)
    await expect(page.getByText('Pengguna berjaya dikemaskini.')).toBeVisible()
    await expect(
      page.locator('[data-testid="user-row"][data-user-id="3001"]').getByTestId('user-name'),
    ).toHaveText('Murid Ujian Disunting')
  })

  test('E2E-M27-88 S9: a valid new password is saved and the pupil signs in with it; a short one is refused', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M27-88 runs at 1280 only')
    await loginAs(P2)
    await gotoApp('/admin-sekolah/pelajar/3001')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    const email = await page.getByTestId('user-email').inputValue()
    await page.getByTestId('user-password-toggle').click()
    await page.getByTestId('user-new-password').fill('abc')
    await page.getByTestId('user-new-password-confirm').fill('abc')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toBeVisible()
    await page.getByTestId('user-new-password').fill('KataBaharu-123')
    await page.getByTestId('user-new-password-confirm').fill('KataBaharu-123')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL(/\/admin-sekolah\/pelajar$/)
    // sign in as the pupil with the new password
    await page.getByTestId('shell-user-header-logout').click()
    await expect(page).toHaveURL('/login')
    await page.getByTestId('login-email').fill(email)
    await page.getByTestId('login-password').fill('KataBaharu-123')
    await page.getByTestId('login-submit').click()
    await expect(page).not.toHaveURL(/\/login$/)
  })

  test('E2E-M27-92 S10: save returns to S7 with the flash', async ({ page, loginAs, gotoApp }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M27-92 save runs at 1280 only')
    await loginAs(P2)
    await gotoApp('/admin-sekolah/guru/5')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('user-phone').fill('0123456789')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL(/\/admin-sekolah\/guru$/)
    await expect(page.getByText('Pengguna berjaya dikemaskini.')).toBeVisible()
  })

  test('E2E-M27-94 S7 "Aktif?": cancel does nothing; accept deactivates, S10 answers 403, the button reactivates', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M27-94 runs at 1280 only')
    await loginAs(P2)
    await openList(page, gotoApp, '/admin-sekolah/guru')
    const toggle = page.locator('[data-testid="user-row"][data-user-id="5"]').getByTestId('user-toggle')
    const cancelled = dismissNextDialog(page, {
      type: 'confirm',
      message: 'Pasti untuk menukar status pengguna ini?',
    })
    await toggle.click()
    await cancelled
    await expect(toggle).toContainText('Aktif')
    const accepted = acceptNextDialog(page, { type: 'confirm' })
    await toggle.click()
    await accepted
    await expect(page.getByText('Status pengguna berjaya dikemaskini.')).toBeVisible()
    await expect(toggle).toContainText('Tidak')
    const row = page.locator('[data-testid="user-row"][data-user-id="5"]')
    await expect(row.getByTestId('user-edit')).toHaveCount(0)
    await expect(row.getByTestId('user-name')).not.toHaveAttribute('href', /.+/)
    await gotoApp('/admin-sekolah/guru/5')
    await expect(page.locator('[data-page=forbidden]')).toBeVisible()
    await openList(page, gotoApp, '/admin-sekolah/guru')
    const back = acceptNextDialog(page, { type: 'confirm' })
    await toggle.click()
    await back
    await expect(toggle).toContainText('Aktif')
  })

  test('E2E-M27-95 S11: create a teacher, listed active in S7; used e-mail and mismatch are refused', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M27-95 create runs at 1280 only')
    await loginAs(P2)
    await gotoApp('/admin-sekolah/guru/baru')
    await expect(page.getByTestId('user-form')).toBeVisible()
    await page.getByTestId('user-name').fill('Guru Ujian Baharu')
    await page.getByTestId('user-email').fill('guru@demo.test')
    await page.getByTestId('user-password').fill('KataLaluan-1')
    await page.getByTestId('user-password-confirm').fill('Lain-2')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toBeVisible()
    await page.getByTestId('user-email').fill('guru.ujian.baharu@demo.test')
    await page.getByTestId('user-password').fill('KataLaluan-1')
    await page.getByTestId('user-password-confirm').fill('KataLaluan-1')
    await page.getByTestId('form-submit').click()
    await expect(page).toHaveURL(/\/admin-sekolah\/guru$/)
    await expect(page.getByText('Pengguna berjaya didaftarkan.')).toBeVisible()
    await expect(page.getByText('Guru Ujian Baharu')).toBeVisible()
  })

  test('E2E-M27-101 S12: create with class 2001 shows the flash and the one-time credential block; errors refuse', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M27-101 runs at 1280 only')
    await loginAs(P2)
    await gotoApp('/admin-sekolah/pelajar/baru')
    await expect(page.getByTestId('user-form')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('pupil-name').fill('Ab')
    await page.getByTestId('pupil-email').fill('')
    await page.getByTestId('form-submit').click()
    await expect(page.getByTestId('user-form-alert')).toBeVisible()
    await page.getByTestId('pupil-name').fill('Murid Ujian Baharu')
    await page.getByTestId('pupil-class').selectOption({ index: 1 })
    await page.getByTestId('pupil-email').fill('murid.ujian.baharu@demo.test')
    await page.getByTestId('form-submit').click()
    await expect(page.getByText('Pelajar "Murid Ujian Baharu" berjaya dicipta.')).toBeVisible()
    const block = page.getByTestId('pupil-credential')
    await expect(block).toContainText('Maklumat log masuk pelajar — catat sekarang, ia tidak akan dipaparkan semula.')
    await expect(page.getByTestId('credential-email')).toHaveText('murid.ujian.baharu@demo.test')
    await expect(page.getByTestId('credential-password')).not.toBeEmpty()
    await expectNoHorizontalScroll(page)
    // a reload shows no password
    await gotoApp('/admin-sekolah/pelajar/baru')
    await expect(page.getByTestId('pupil-credential')).toHaveCount(0)
    await openList(page, gotoApp, '/admin-sekolah/pelajar')
    await expect(page.getByText('Murid Ujian Baharu')).toBeVisible()
  })
})
