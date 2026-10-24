/**
 * M02-T5 developer smoke for S2 `/admin/users/create` and S3 `/admin/users/:id/edit` (build-plan M02-T5;
 * QA writes E2E-M02-* at G5): role-driven create form, student / parent / school-admin creation, the
 * generator with its "Disalin!" toast, editing with the change visible on reload, and the §5 validation
 * copy, as the admin demo account at 375 / 768 / 1280. Success flashes and validation copy are
 * UNVERIFIED (SRS §5, §8), so tests that assert them are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { expect, reloadApp, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  moduleTag,
  provisional,
  TAG,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
/** The first user created at runtime gets this id (SRS §6, X-9). */
const FIRST_NEW_USER_ID = 9_000_001

const byId = (page: Page, id: string) => page.getByTestId(id)

async function pickRole(page: Page, role: string): Promise<void> {
  await byId(page, 'user-role').selectOption(role)
}

async function fillIdentity(page: Page, name: string, email: string): Promise<void> {
  await byId(page, 'user-name').fill(name)
  await byId(page, 'user-email').fill(email)
  await byId(page, 'user-password').fill('rahsia123')
  await byId(page, 'user-password-confirm').fill('rahsia123')
}

async function submitAndLeave(page: Page): Promise<void> {
  await byId(page, 'form-submit').click()
  await expect(page).toHaveURL('/admin/users')
}

test.describe('M02 S2 create user', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  // Several flows boot the app twice (create, then open the record); a boot takes up to ~6 s under load.
  test.describe.configure({ timeout: 90_000 })
  test.use({
    mockInit: { latency: 0 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })

  test('title, header, only "Peranan" at first, then the role sections; no page h-scroll', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/create')
    await expectTabTitle(page, 'Tambah Pengguna - Panel Admin')
    await expect(page.getByText('Tambah Pengguna Baru').first()).toBeVisible()
    await expect(page.getByText('Daftarkan akaun pengguna baru ke sistem').first()).toBeVisible()
    await expect(page.getByText('Borang Pendaftaran Pengguna')).toBeVisible()
    await expect(page.getByText('Isi maklumat untuk mendaftarkan pengguna baru')).toBeVisible()
    await expect(byId(page, 'user-role').locator('option')).toHaveText([
      '-- Pilih Peranan --',
      'Pelajar',
      'Guru',
      'Ibu Bapa',
      'Penaja',
      'Admin Sekolah',
      'Pegawai PPD',
      'Pegawai JPN',
      'Admin',
    ])
    await expect(byId(page, 'user-fields')).toHaveCount(0)
    await expect(byId(page, 'form-submit')).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    // Student: every field with its copy.
    await pickRole(page, 'student')
    await expect(byId(page, 'form-submit')).toHaveText('Daftar Pengguna')
    await expect(byId(page, 'form-cancel')).toHaveAttribute('href', '/admin/users')
    await expect(byId(page, 'user-name')).toHaveAttribute('placeholder', 'Nama penuh')
    await expect(byId(page, 'user-email')).toHaveAttribute('placeholder', 'contoh@email.com')
    await expect(byId(page, 'user-phone')).toHaveAttribute('placeholder', 'Cth: 0191234567')
    await expect(byId(page, 'user-password')).toHaveAttribute('placeholder', 'Minimum 6 aksara')
    await expect(byId(page, 'user-password-confirm')).toHaveAttribute(
      'placeholder',
      'Taip semula kata laluan',
    )
    await expect(byId(page, 'user-active')).toBeChecked()
    await expect(page.getByText('Pengguna yang tidak aktif tidak boleh log masuk')).toBeVisible()
    await expect(byId(page, 'grade-cards').locator('input[type=radio]')).toHaveCount(11)
    await expect(byId(page, 'grade-cards').locator('input:checked')).toHaveCount(0)
    await expect(byId(page, 'user-ic')).toHaveAttribute('placeholder', 'Cth: 031215101234')
    await expect(page.getByText('12 digit MyKad. Dilindungi PDPA.')).toBeVisible()
    await expect(byId(page, 'std-school-search')).toHaveAttribute(
      'placeholder',
      'Cari nama sekolah...',
    )

    // Two columns from `md` (768), one column below.
    const name = await byId(page, 'user-name').boundingBox()
    const email = await byId(page, 'user-email').boundingBox()
    if (viewportWidth(page) >= 768) expect(Math.abs(email!.y - name!.y)).toBeLessThan(2)
    else expect(email!.y).toBeGreaterThan(name!.y + name!.height - 1)
    await expectNoHorizontalScroll(page)

    if (!isDesktopShell(page)) {
      await expectTouchTarget(byId(page, 'user-role'))
      await expectTouchTarget(byId(page, 'form-submit'))
      await expectTouchTarget(byId(page, 'form-cancel'))
      await expectTouchTarget(page.locator('label:has([data-testid=grade-1])'))
      await expectTouchTarget(page.locator('label:has([data-testid=grade-11])'))
    }

    // Teacher keeps only the school; parent only the linker; admin neither.
    await pickRole(page, 'teacher')
    await expect(byId(page, 'grade-cards')).toHaveCount(0)
    await expect(byId(page, 'std-school')).toBeVisible()
    await pickRole(page, 'parent')
    await expect(byId(page, 'std-school')).toHaveCount(0)
    await expect(byId(page, 'linker-search')).toHaveAttribute(
      'placeholder',
      'Cari nama atau emel pelajar...',
    )
    await expect(
      page.getByText('Boleh pautkan lebih dari satu pelajar. Boleh juga ditambah kemudian.'),
    ).toBeVisible()
    await expectNoHorizontalScroll(page)
    await pickRole(page, 'admin')
    await expect(byId(page, 'linker-search')).toHaveCount(0)
    await expect(byId(page, 'user-fields')).toBeVisible()
  })

  test('ppd officer: 16 JPN, PPD loads for the chosen JPN, no phone or active switch', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/create')
    await pickRole(page, 'ppd_officer')
    await expect(byId(page, 'user-name')).toHaveAttribute('placeholder', 'Nama penuh pegawai')
    await expect(byId(page, 'user-phone')).toHaveCount(0)
    await expect(byId(page, 'user-active')).toHaveCount(0)
    await expect(byId(page, 'officer-jpn').locator('option')).toHaveCount(17)
    await expect(byId(page, 'officer-jpn').locator('option').first()).toHaveText(
      '-- Pilih Negeri --',
    )
    await expect(byId(page, 'officer-ppd')).toBeDisabled()

    await byId(page, 'officer-jpn').selectOption({ label: 'Selangor' })
    await expect(byId(page, 'officer-ppd')).toBeEnabled()
    await expect(byId(page, 'officer-ppd').locator('option')).toContainText(['-- Pilih PPD --'])
    await expect(byId(page, 'officer-ppd').locator('option')).not.toHaveCount(1)
    await byId(page, 'officer-ppd').selectOption({ index: 1 })
    await fillIdentity(page, 'Pegawai Ujian E2E', 'pegawai.e2e@contoh.test')
    await expectNoHorizontalScroll(page)
    await submitAndLeave(page)

    await gotoApp(`/admin/users/${String(FIRST_NEW_USER_ID)}/edit`)
    await expect(byId(page, 'user-role')).toHaveValue('ppd_officer')
    await expect(byId(page, 'user-name')).toHaveValue('Pegawai Ujian E2E')

    // JPN officer has no PPD select.
    await gotoApp('/admin/users/create')
    await pickRole(page, 'jpn_officer')
    await expect(byId(page, 'officer-jpn')).toBeVisible()
    await expect(byId(page, 'officer-ppd')).toHaveCount(0)
  })

  test('create a student with grade, school and IC; the record shows them on the edit screen', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/create')
    await pickRole(page, 'student')
    await fillIdentity(page, 'Muhammad Fulan bin Fulan', 'fulan.e2e@contoh.test')
    await byId(page, 'user-phone').fill('0191234567')
    // "Ting. 3" = grade 9; the radios are visually hidden, so the card label is clicked.
    await page.locator('label:has([data-testid=grade-9])').click()
    await expect(byId(page, 'grade-9')).toBeChecked()
    await byId(page, 'user-ic').fill('031215101234')

    await byId(page, 'std-school-search').fill('bangi')
    const row = byId(page, 'std-school-result').first()
    await expect(row).toBeVisible()
    const rowText = (await row.innerText()).trim()
    // The row reads "{name} ({type}, {state})": drop the last parenthesis only.
    const schoolName = rowText.replace(/\s*\([^()]*\)$/, '')
    await row.click()
    await expect(byId(page, 'std-school-chosen')).toHaveText(schoolName)
    await expect(byId(page, 'std-school-dropdown')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    await submitAndLeave(page)

    await gotoApp(`/admin/users/${String(FIRST_NEW_USER_ID)}/edit`)
    await expectTabTitle(page, 'Edit Pengguna - Panel Admin')
    await expect(byId(page, 'user-name')).toHaveValue('Muhammad Fulan bin Fulan')
    await expect(byId(page, 'user-email')).toHaveValue('fulan.e2e@contoh.test')
    await expect(byId(page, 'user-phone')).toHaveValue('0191234567')
    await expect(byId(page, 'user-role')).toHaveValue('student')
    await expect(byId(page, 'grade-9')).toBeChecked()
    // The IC is masked (DV-M02-16): only the last two digits show.
    await expect(byId(page, 'user-ic')).toHaveValue('xxxxxx-xx-xx34')
    await expect(byId(page, 'admin-school-name')).toHaveText(schoolName)
    await expectNoHorizontalScroll(page)
  })

  test('create a parent with two linked students as chips; the links show on the edit screen', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/create')
    await pickRole(page, 'parent')
    await fillIdentity(page, 'Ibu Bapa Ujian E2E', 'ibubapa.e2e@contoh.test')

    await byId(page, 'linker-search').fill('pelajar')
    const rows = byId(page, 'linker-result')
    await expect(rows.first()).toBeVisible()
    const first = (await rows.first().locator('span').first().innerText()).trim()
    await rows.first().click()
    await expect(byId(page, 'linker-chip')).toHaveCount(1)
    await expect(byId(page, 'linker-chip').first()).toContainText(first)
    await expect(page.getByText('Anak yang dipautkan:')).toBeVisible()

    // The linked student is dimmed and adds nothing when clicked again.
    await byId(page, 'linker-search').fill('pelajar')
    await expect(rows.first()).toBeVisible()
    await expect(rows.filter({ hasText: first }).first()).toHaveClass(/opacity-40/)
    // Clicking a linked row adds nothing.
    await rows.filter({ hasText: first }).first().click()
    await expect(byId(page, 'linker-chip')).toHaveCount(1)

    const second = (await rows.nth(1).locator('span').first().innerText()).trim()
    await rows.nth(1).click()
    await expect(byId(page, 'linker-chip')).toHaveCount(2)
    await expect(byId(page, 'linker-remove').first()).toHaveAttribute('title', 'Buang')
    await expectNoHorizontalScroll(page)
    if (!isDesktopShell(page)) await expectTouchTarget(byId(page, 'linker-remove').first())
    await submitAndLeave(page)

    await gotoApp(`/admin/users/${String(FIRST_NEW_USER_ID)}/edit`)
    await expect(byId(page, 'user-role')).toHaveValue('parent')
    await expect(byId(page, 'linker-chip')).toHaveCount(2)
    await expect(byId(page, 'parent-linker-edit')).toContainText(first)
    await expect(byId(page, 'parent-linker-edit')).toContainText(second)
    await expectNoHorizontalScroll(page)
  })

  test('parent search: the empty result reads "Tiada pelajar dijumpai"', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/create')
    await pickRole(page, 'parent')
    await byId(page, 'linker-search').fill('zzqxvzz')
    await expect(byId(page, 'linker-empty')).toHaveText('Tiada pelajar dijumpai')
    await expectNoHorizontalScroll(page)
  })

  test('school admin: pick a school, generate the account, copy shows "Disalin!" for 2 s, then register', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/create')
    await pickRole(page, 'school_admin')
    await expect(byId(page, 'form-submit')).toBeDisabled()
    await expect(byId(page, 'gen-search')).toHaveAttribute(
      'placeholder',
      'Taipkan nama sekolah atau kod sekolah (cth: JBA0001)...',
    )

    await byId(page, 'gen-search').fill('bangi')
    const rows = byId(page, 'gen-result')
    await expect(rows.first()).toBeVisible()
    await rows.filter({ hasNotText: 'Tiada kod' }).first().click()
    await expect(byId(page, 'gen-chosen')).toContainText('Sekolah Dipilih')
    await expect(byId(page, 'gen-reset')).toHaveAttribute('title', 'Set Semula')
    await expect(byId(page, 'form-submit')).toBeDisabled()
    await expect(byId(page, 'gen-generate')).toHaveText('Janakan Akaun Admin Sekolah')

    await byId(page, 'gen-generate').click()
    await expect(byId(page, 'gen-generate')).toHaveCount(0)
    const box = byId(page, 'gen-box')
    await expect(box).toContainText('Maklumat Dijana')
    await expect(byId(page, 'gen-name')).toHaveValue(/^Pentadbir /)
    await expect(byId(page, 'gen-email')).toHaveValue(/^[a-z0-9]+@prestasiplus\.my$/)
    await expect(byId(page, 'gen-email')).toHaveAttribute('readonly', '')
    await expect(byId(page, 'gen-phone')).toHaveAttribute('placeholder', '012-345 6789')
    await expect(byId(page, 'gen-jpn')).toContainText('JPN: ')
    await expect(byId(page, 'gen-ppd')).toContainText('PPD: ')
    await expect(byId(page, 'form-submit')).toBeEnabled()
    await expectNoHorizontalScroll(page)

    const password = await byId(page, 'gen-password').inputValue()
    const login = await byId(page, 'gen-email').inputValue()
    expect(password).not.toBe('')
    if (!isDesktopShell(page)) {
      await expectTouchTarget(byId(page, 'gen-copy-password'))
      await expectTouchTarget(byId(page, 'gen-generate').or(byId(page, 'gen-reset')))
    }

    await expect(page.getByText('Disalin!')).toHaveCount(0)
    await byId(page, 'gen-copy-password').click()
    await expect(page.getByText('Disalin!')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(password)
    await expectNoHorizontalScroll(page)
    // The toast hides itself after 2 s.
    await expect(page.getByText('Disalin!')).toBeHidden({ timeout: 6000 })

    await byId(page, 'gen-copy-email').click()
    await expect(page.getByText('Disalin!')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(login)

    await submitAndLeave(page)
    await gotoApp(`/admin/users/${String(FIRST_NEW_USER_ID)}/edit`)
    await expect(byId(page, 'user-role')).toHaveValue('school_admin')
    await expect(byId(page, 'user-email')).toHaveValue(login)
  })

  test('school admin: reset drops the school and the generated credentials and shows the search again', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/create')
    await pickRole(page, 'school_admin')
    await byId(page, 'gen-search').fill('bangi')
    await byId(page, 'gen-result').filter({ hasNotText: 'Tiada kod' }).first().click()
    await byId(page, 'gen-generate').click()
    await expect(byId(page, 'gen-box')).toBeVisible()
    await byId(page, 'gen-reset').click()
    await expect(byId(page, 'gen-box')).toHaveCount(0)
    await expect(byId(page, 'gen-chosen')).toHaveCount(0)
    await expect(byId(page, 'gen-search')).toHaveValue('')
    await expect(byId(page, 'form-submit')).toBeDisabled()
    await expectNoHorizontalScroll(page)
  })

  test(
    'submitting an empty student form shows the §5 messages in the red alert',
    provisional('the validation copy is INFERRED Laravel copy (SRS §5)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/users/create')
      await pickRole(page, 'student')
      await byId(page, 'form-submit').click()
      const alert = byId(page, 'user-form-alert')
      await expect(alert).toBeVisible()
      await expect(alert).toContainText('The name field is required.')
      await expect(alert).toContainText('The email field is required.')
      await expect(alert).toContainText('The password field is required.')
      await expect(alert).toContainText('The grade field is required when role is student.')
      await expect(page).toHaveURL('/admin/users/create')
      // The role is kept and the field is marked.
      await expect(byId(page, 'user-role')).toHaveValue('student')
      await expectNoHorizontalScroll(page)

      await byId(page, 'user-name').fill('Nama Ujian')
      await byId(page, 'user-email').fill('pelajar@demo.test')
      await byId(page, 'user-password').fill('abc')
      await byId(page, 'user-password-confirm').fill('abc')
      await page.locator('label:has([data-testid=grade-1])').click()
      await byId(page, 'form-submit').click()
      await expect(alert).toContainText('The email has already been taken.')
      await expect(alert).toContainText('The password field must be at least 6 characters.')
      await expect(alert).not.toContainText('The name field is required.')
      // A long enough password that does not match its confirmation.
      await byId(page, 'user-email').fill('baru.e2e@contoh.test')
      await byId(page, 'user-password').fill('rahsia123')
      await byId(page, 'user-password-confirm').fill('rahsia456')
      await byId(page, 'form-submit').click()
      await expect(alert).toContainText('The password field confirmation does not match.')
      await expect(alert).not.toContainText('The email has already been taken.')
      // Values are kept, the passwords are cleared.
      await expect(byId(page, 'user-name')).toHaveValue('Nama Ujian')
      await expect(byId(page, 'user-email')).toHaveValue('baru.e2e@contoh.test')
      await expect(byId(page, 'user-password')).toHaveValue('')
      await expect(byId(page, 'user-password-confirm')).toHaveValue('')
      await expect(byId(page, 'grade-1')).toBeChecked()
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'a created user comes back to the list with the success flash',
    provisional('the flash text is UNVERIFIED COPY (SRS §8) and the list is M02-T4'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/users/create')
      await pickRole(page, 'admin')
      await fillIdentity(page, 'Admin Ujian E2E', 'admin.e2e@contoh.test')
      await submitAndLeave(page)
      await expect(page.getByText('Pengguna berjaya didaftarkan.')).toBeVisible()
    },
  )
})

test.describe('M02 S3 edit user', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.describe.configure({ timeout: 90_000 })
  test.use({ mockInit: { latency: 0 } })

  test('a student: profile header, pre-filled fields, sections, copy and no page h-scroll', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/2/edit')
    await expectTabTitle(page, 'Edit Pengguna - Panel Admin')
    await expect(page.getByText('Kemaskini maklumat pengguna').first()).toBeVisible()
    await expect(byId(page, 'user-profile-name')).toHaveText('Pelajar Demo')
    await expect(byId(page, 'user-profile-email')).toHaveText('pelajar@demo.test')
    await expect(byId(page, 'user-profile-created')).toHaveText(/Daftar: \d{2}\/\d{2}\/\d{4}$/)
    await expect(byId(page, 'user-profile-updated')).toHaveText(
      /Kemaskini: \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/,
    )
    await expect(byId(page, 'user-name')).toHaveValue('Pelajar Demo')
    await expect(byId(page, 'user-email')).toHaveValue('pelajar@demo.test')
    await expect(byId(page, 'user-role')).toHaveValue('student')
    await expect(byId(page, 'user-role').locator('option')).toHaveText([
      'Pelajar',
      'Guru',
      'Ibu Bapa',
      'Penaja',
      'Admin Sekolah',
      'Pegawai PPD',
      'Pegawai JPN',
      'Admin',
    ])
    await expect(byId(page, 'grade-10')).toBeChecked()
    await expect(byId(page, 'user-ic')).not.toHaveValue('')
    await expect(byId(page, 'user-package-block')).toContainText('Pakej Langganan')
    await expect(byId(page, 'user-package').locator('option')).toHaveText([
      'Tiada (Percuma / Trial)',
      'Regular Bulanan — RM10/bulan (1 bulan)',
      'Personal Per Sesi — RM200 (hingga 10 Jan)',
    ])
    await expect(byId(page, 'user-pksk-status')).toHaveText('Tiada Akses')
    await expect(byId(page, 'admin-school-chip')).toBeVisible()
    await expect(byId(page, 'user-active')).toBeChecked()
    await expect(byId(page, 'form-submit')).toHaveText('Kemaskini')
    await expect(byId(page, 'form-cancel')).toHaveAttribute('href', '/admin/users')

    const notes = byId(page, 'user-security-notes')
    await expect(notes).toContainText('Nota Keselamatan')
    await expect(notes.locator('li')).toHaveCount(4)
    await expectNoHorizontalScroll(page)

    // The password panel is closed until the amber bar is clicked.
    await expect(byId(page, 'user-password-panel')).toBeHidden()
    await byId(page, 'user-password-toggle').click()
    await expect(byId(page, 'user-new-password')).toHaveAttribute('placeholder', 'Minimum 6 aksara')
    await expect(byId(page, 'user-new-password-confirm')).toHaveAttribute(
      'placeholder',
      'Taip semula kata laluan baru',
    )
    await expectNoHorizontalScroll(page)

    if (!isDesktopShell(page)) {
      await expectTouchTarget(byId(page, 'form-submit'))
      await expectTouchTarget(byId(page, 'user-password-toggle'))
      await expectTouchTarget(byId(page, 'admin-school-clear'))
      await expectTouchTarget(page.locator('label:has([data-testid=grade-10])'))
    }
  })

  test('role sections follow the "Peranan" select and keep their values', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/2/edit')
    await expect(byId(page, 'grade-10')).toBeChecked()
    await byId(page, 'user-role').selectOption('teacher')
    await expect(byId(page, 'grade-cards')).toHaveCount(0)
    await expect(byId(page, 'user-package-block')).toHaveCount(0)
    await expect(byId(page, 'admin-school')).toBeVisible()
    await byId(page, 'user-role').selectOption('parent')
    await expect(byId(page, 'admin-school')).toHaveCount(0)
    await expect(byId(page, 'linker-none')).toHaveText('Tiada pelajar dipautkan lagi')
    await byId(page, 'user-role').selectOption('sponsor')
    await expect(byId(page, 'parent-linker-edit')).toHaveCount(0)
    await byId(page, 'user-role').selectOption('student')
    await expect(byId(page, 'grade-10')).toBeChecked()
    await expectNoHorizontalScroll(page)
  })

  test(
    'edit a student: the change is saved and visible on reload',
    provisional('the flash text after a save is UNVERIFIED COPY (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/users/2/edit')
      await byId(page, 'user-name').fill('Pelajar Demo Kemaskini')
      await byId(page, 'user-phone').fill('0123456789')
      await page.locator('label:has([data-testid=grade-9])').click()
      await byId(page, 'user-package').selectOption('personal')
      // The native checkbox is visually hidden behind the pill: click the label, as a user does.
      await page.locator('label:has([data-testid=user-active])').click()
      await byId(page, 'form-submit').click()
      await expect(page).toHaveURL('/admin/users')
      await expect(page.getByText('Pengguna berjaya dikemaskini.')).toBeVisible()

      await gotoApp('/admin/users/2/edit')
      await expect(byId(page, 'user-name')).toHaveValue('Pelajar Demo Kemaskini')
      await expect(byId(page, 'user-phone')).toHaveValue('0123456789')
      await expect(byId(page, 'grade-9')).toBeChecked()
      await expect(byId(page, 'user-package')).toHaveValue('personal')
      await expect(byId(page, 'user-active')).not.toBeChecked()
      // The profile header still shows the account (the name follows the saved record).
      await expect(byId(page, 'user-profile-name')).toHaveText('Pelajar Demo Kemaskini')
      await reloadApp(page)
      await expect(byId(page, 'user-name')).toHaveValue('Pelajar Demo Kemaskini')
      await expectNoHorizontalScroll(page)
    },
  )

  test('edit the linked children of a parent: remove one, save, reload', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/6/edit')
    await expect(byId(page, 'user-role')).toHaveValue('parent')
    const chips = byId(page, 'linker-chip')
    await expect(chips).toHaveCount(2)
    await expect(byId(page, 'linker-remove').first()).toHaveAttribute('title', 'Buang pautan')
    await expect(
      page.getByText('Tambah atau buang pautan anak. Perubahan disimpan apabila klik "Kemaskini".'),
    ).toBeVisible()
    await expectNoHorizontalScroll(page)
    await byId(page, 'linker-remove').first().click()
    await expect(chips).toHaveCount(1)
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL('/admin/users')

    await gotoApp('/admin/users/6/edit')
    await expect(chips).toHaveCount(1)
  })

  test(
    'a duplicate e-mail and a short new password show the §5 messages; values are kept',
    provisional('the validation copy is INFERRED Laravel copy (SRS §5)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/users/2/edit')
      await byId(page, 'user-email').fill('admin@demo.test')
      await byId(page, 'user-password-toggle').click()
      await byId(page, 'user-new-password').fill('abc')
      await byId(page, 'user-new-password-confirm').fill('abc')
      await byId(page, 'form-submit').click()
      const alert = byId(page, 'user-form-alert')
      await expect(alert).toContainText('The email has already been taken.')
      await expect(alert).toContainText('The new password field must be at least 6 characters.')
      await expect(page).toHaveURL('/admin/users/2/edit')
      await expect(byId(page, 'user-email')).toHaveValue('admin@demo.test')
      await expect(byId(page, 'user-new-password')).toHaveValue('')
      // A long enough new password that does not match its confirmation.
      await byId(page, 'user-email').fill('pelajar@demo.test')
      await byId(page, 'user-new-password').fill('baru1234')
      await byId(page, 'user-new-password-confirm').fill('baru5678')
      await byId(page, 'form-submit').click()
      await expect(alert).toContainText('The new password field confirmation does not match.')
      await expect(alert).not.toContainText('The email has already been taken.')
      await expectNoHorizontalScroll(page)
    },
  )

  test('an unknown user shows the standard 404 page (as live)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/99999999/edit')
    await expectTabTitle(page, '404 - Halaman Tidak Dijumpai | PRESTASIPLUS')
    await expect(byId(page, 'user-form')).toHaveCount(0)
    await expect(byId(page, 'user-load-error')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
})
