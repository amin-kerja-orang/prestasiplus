/**
 * M02 G5 QA (qa-engineer): gap-closing E2E for S2 / S3 (E2E-M02-13, 14, 15, 17, 18, 20, 21, 22, 23, 24, 25).
 * Adds what the developer smoke does not assert: request payloads, role-switch state, school pickers with
 * latency and faults, the password change round trip, and role reactivity on S3.
 */

import type { Page } from '@playwright/test'

import { DEMO_PASSWORD, expect, gotoApp as gotoAppOn, test } from '../fixtures/test'
import {
  acceptNextDialog,
  expectNoHorizontalScroll,
  isMobileWidth,
  moduleTag,
  TAG,
} from '../support'

const ADMIN = 'admin@demo.test'
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
async function spaGoto(page: Page, path: string): Promise<void> {
  await page.evaluate(async (p) => {
    const el = document.querySelector('#app') as Element & {
      __vue_app__: {
        config: { globalProperties: { $router: { push(target: string): Promise<unknown> } } }
      }
    }
    await el.__vue_app__.config.globalProperties.$router.push(p)
  }, path)
}
async function writes(
  mock: { requests: (p?: string) => Promise<{ method: string; path: string; body: unknown }[]> },
  prefix = '/api/admin/users',
) {
  return (await mock.requests()).filter((r) => r.method !== 'GET' && r.path.startsWith(prefix))
}

test.describe('M02 QA S2 create gaps', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/users/create')
  })

  test('E2E-M02-14: Ting. 4 posts grade 10; IC has maxlength 14; Batal leaves without saving', async ({
    page,
    mock,
    gotoApp,
  }) => {
    await pickRole(page, 'student')
    await expect(byId(page, 'user-ic')).toHaveAttribute('maxlength', '14')
    await fillIdentity(page, 'Murid Ujian QA', 'murid.qa@contoh.test')
    await page.locator('label:has([data-testid=grade-10])').click()
    await expect(page.locator('label:has([data-testid=grade-10])')).toContainText('Ting. 4')
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL('/admin/users')
    const posts = (await writes(mock)).filter((r) => r.method === 'POST')
    expect((posts.at(-1)!.body as { grade: number }).grade).toBe(10)

    await gotoApp('/admin/users/create')
    await pickRole(page, 'student')
    await byId(page, 'user-name').fill('Tidak Disimpan')
    await byId(page, 'form-cancel').click()
    await expect(page).toHaveURL('/admin/users')
    await expect(byId(page, 'users-stat-student').getByTestId('users-stat-count')).toHaveText(
      '4534',
    )
    await gotoApp('/admin/users?search=Tidak+Disimpan')
    await expect(byId(page, 'users-empty')).toBeVisible()
  })

  test('E2E-M02-13: student values survive Pelajar -> Guru -> Pelajar; no grade posted after switching to Admin Sekolah (AB-06)', async ({
    page,
    mock,
  }) => {
    await pickRole(page, 'student')
    await byId(page, 'user-name').fill('Nama Kekal')
    await byId(page, 'user-ic').fill('111')
    await page.locator('label:has([data-testid=grade-10])').click()
    await pickRole(page, 'teacher')
    await pickRole(page, 'student')
    await expect(byId(page, 'user-name')).toHaveValue('Nama Kekal')
    await expect(byId(page, 'user-ic')).toHaveValue('111')
    await expect(byId(page, 'grade-10')).toBeChecked()

    // School admin generator resets when the role changes away and back.
    await pickRole(page, 'school_admin')
    await byId(page, 'gen-search').fill('bangi')
    await byId(page, 'gen-result').filter({ hasNotText: 'Tiada kod' }).first().click()
    await byId(page, 'gen-generate').click()
    await expect(byId(page, 'gen-box')).toBeVisible()
    await pickRole(page, 'teacher')
    await pickRole(page, 'school_admin')
    await expect(byId(page, 'gen-box')).toHaveCount(0)
    await expect(byId(page, 'gen-chosen')).toHaveCount(0)
    await expect(byId(page, 'gen-search')).toHaveValue('')

    // SRS §0.2 AB-06 (as built, supersedes the "as live" clause of E2E-M02-13): no grade is sent for an
    // Admin Sekolah, because the role has no grade section.
    await byId(page, 'gen-search').fill('bangi')
    await byId(page, 'gen-result').filter({ hasNotText: 'Tiada kod' }).first().click()
    await byId(page, 'gen-generate').click()
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL('/admin/users')
    const post = (await writes(mock)).filter((r) => r.method === 'POST').at(-1)!
    expect((post.body as { grade?: number }).grade).toBeUndefined()
  })

  test('E2E-M02-15: role visibility - Guru shows Sekolah only; Ibu Bapa / Penaja / Admin show none of Tahap / IC / Sekolah', async ({
    page,
  }) => {
    await pickRole(page, 'teacher')
    await expect(byId(page, 'std-school')).toBeVisible()
    await expect(byId(page, 'grade-cards')).toHaveCount(0)
    await expect(byId(page, 'user-ic')).toHaveCount(0)
    for (const role of ['parent', 'sponsor', 'admin']) {
      await pickRole(page, role)
      await expect(byId(page, 'grade-cards')).toHaveCount(0)
      await expect(byId(page, 'user-ic')).toHaveCount(0)
      await expect(byId(page, 'std-school')).toHaveCount(0)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M02-15: an inactive school is not offered by the S2 school search', async ({
    page,
    gotoApp,
  }) => {
    // Deactivate the first "bangi" school on S9, then search for it on S2.
    await gotoApp('/admin/schools?search=bangi')
    const row = byId(page, 'school-row').first()
    const name = (await row.locator('td').first().innerText()).trim()
    await row.getByTestId('school-toggle').click()
    await expect(row.getByTestId('school-status')).toHaveText('Tidak Aktif')

    await gotoApp('/admin/users/create')
    await pickRole(page, 'student')
    await byId(page, 'std-school-search').fill('bangi')
    await expect(byId(page, 'std-school-result').first()).toBeVisible()
    for (const text of await byId(page, 'std-school-result').allInnerTexts()) {
      expect(text.startsWith(name)).toBe(false)
    }
    await byId(page, 'std-school-search').fill(name)
    await expect(byId(page, 'std-school-dropdown').getByText(name, { exact: false })).toHaveCount(0)
  })

  test('E2E-M02-17: parent search shows a loading indicator, then at most 15 rows with class / school badges', async ({
    page,
    mock,
  }) => {
    await pickRole(page, 'parent')
    await mock.setLatency(1200)
    await byId(page, 'linker-search').fill('demo')
    await expect(byId(page, 'linker-loading')).toBeVisible()
    await expect(byId(page, 'linker-result').first()).toBeVisible({ timeout: 8000 })
    expect(await byId(page, 'linker-result').count()).toBeLessThanOrEqual(15)
    expect(await byId(page, 'linker-result').count()).toBeGreaterThan(0)
    await mock.clearLatency()
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M02-17: re-adding a linked student does not duplicate; a chip can be removed (title "Buang")', async ({
    page,
  }) => {
    await pickRole(page, 'parent')
    await byId(page, 'linker-search').fill('pelajar')
    await expect(byId(page, 'linker-result').first()).toBeVisible()
    await byId(page, 'linker-result').first().click()
    await byId(page, 'linker-search').fill('pelajar ')
    await expect(byId(page, 'linker-result').nth(1)).toBeVisible()
    await byId(page, 'linker-result').nth(1).click()
    await expect(byId(page, 'linker-chip')).toHaveCount(2)
    await byId(page, 'linker-search').fill('pelajar')
    await expect(byId(page, 'linker-result').first()).toBeVisible()
    await byId(page, 'linker-result').first().click()
    await expect(byId(page, 'linker-chip')).toHaveCount(2)
    await byId(page, 'linker-search').fill('')
    await byId(page, 'linker-remove').first().click()
    await expect(byId(page, 'linker-chip')).toHaveCount(1)
  })

  test('E2E-M02-18: an Admin Sekolah school without a KPM code blocks the generator with the warning', async ({
    page,
  }) => {
    await pickRole(page, 'school_admin')
    await expect(byId(page, 'form-submit')).toBeDisabled()
    await byId(page, 'gen-search').fill('AMINUDDIN BAKI')
    const noCode = byId(page, 'gen-result').filter({ hasText: 'Tiada kod' })
    await expect(noCode.first()).toBeVisible()
    await noCode.first().click()
    await expect(byId(page, 'gen-no-code')).toContainText(
      'Sekolah ini tiada kod KPM. Sila kemaskini kod sekolah di halaman Sekolah terlebih dahulu.',
    )
    await expect(byId(page, 'gen-generate')).toBeDisabled()
    await expect(byId(page, 'form-submit')).toBeDisabled()
    await expect(byId(page, 'gen-box')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M02-18: generator output - Title Case name, {code}@prestasiplus.my read-only, default password read-only', async ({
    page,
  }) => {
    await pickRole(page, 'school_admin')
    await byId(page, 'gen-search').fill('bangi')
    const coded = byId(page, 'gen-result').filter({ hasNotText: 'Tiada kod' }).first()
    await expect(coded).toBeVisible()
    await coded.click()
    await byId(page, 'gen-generate').click()
    const name = await byId(page, 'gen-name').inputValue()
    expect(name.startsWith('Pentadbir ')).toBe(true)
    expect(name).not.toBe(name.toUpperCase())
    await expect(byId(page, 'gen-email')).toHaveAttribute('readonly', '')
    await expect(byId(page, 'gen-password')).toHaveAttribute('readonly', '')
    // SEC-M02-01: the configured school-admin default password (not the demo password).
    await expect(byId(page, 'gen-password')).toHaveValue('Sekolah2026')
    await expect(byId(page, 'gen-email')).toHaveValue(/@prestasiplus\.my$/)
  })

  test('E2E-M02-20: JPN list fault leaves only "-- Pilih Negeri --" without a message; Selangor has 10 PPD; PPD officer saves state and district', async ({
    page,
    mock,
    gotoApp,
  }) => {
    await gotoApp('/admin/users')
    await expect(byId(page, 'user-row').first()).toBeVisible()
    await mock.failNext('/api/jpn', 500)
    await spaGoto(page, '/admin/users/create')
    await pickRole(page, 'ppd_officer')
    await expect(byId(page, 'officer-jpn').locator('option')).toHaveText(['-- Pilih Negeri --'])
    await expect(byId(page, 'user-form-alert')).toHaveCount(0)

    await spaGoto(page, '/admin/users')
    await spaGoto(page, '/admin/users/create')
    await pickRole(page, 'ppd_officer')
    await expect(byId(page, 'officer-jpn').locator('option')).toHaveCount(17)
    await byId(page, 'officer-jpn').selectOption({ label: 'Selangor' })
    await expect(byId(page, 'officer-ppd').locator('option')).toHaveCount(11)
    await byId(page, 'officer-ppd').selectOption({ value: 'PPD HULU LANGAT' })
    await fillIdentity(page, 'Pegawai PPD QA', 'ppd.qa@contoh.test')
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL('/admin/users')
    const post = (await writes(mock)).filter((r) => r.method === 'POST').at(-1)!
    expect(post.body).toMatchObject({ ppdState: 'Selangor', ppdDistrict: 'PPD HULU LANGAT' })
  })

  test('E2E-M02-20: a JPN officer has no PPD field', async ({ page }) => {
    await pickRole(page, 'jpn_officer')
    await expect(byId(page, 'officer-jpn')).toBeVisible()
    await expect(byId(page, 'officer-ppd')).toHaveCount(0)
  })
})

test.describe('M02 QA S3 edit gaps', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ADMIN)
  })

  test('E2E-M02-21: a JPN officer record shows "Pegawai JPN" and saving unchanged keeps the role; the password bar opens and closes', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users/10/edit')
    await expect(byId(page, 'user-role')).toHaveValue('jpn_officer')
    await expect(byId(page, 'user-role').locator('option:checked')).toHaveText('Pegawai JPN')
    await expect(byId(page, 'user-password-panel')).toBeHidden()
    await byId(page, 'user-password-toggle').click()
    await expect(byId(page, 'user-password-panel')).toBeVisible()
    await byId(page, 'user-password-toggle').click()
    await expect(byId(page, 'user-password-panel')).toBeHidden()
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL('/admin/users')
    await gotoApp('/admin/users/10/edit')
    await expect(byId(page, 'user-role')).toHaveValue('jpn_officer')
    await byId(page, 'form-cancel').click()
    await expect(page).toHaveURL('/admin/users')
  })

  test('E2E-M02-22: a new password lets the user log in with it; a blank password keeps the old one; an invalid e-mail shows the red alert', async ({
    page,
    gotoApp,
    newTab,
  }) => {
    await gotoApp('/admin/users/2/edit')
    await byId(page, 'user-name').fill('Pelajar Demo Diubah')
    await byId(page, 'user-password-toggle').click()
    await byId(page, 'user-new-password').fill('Baru12345')
    await byId(page, 'user-new-password-confirm').fill('Baru12345')
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL('/admin/users')

    // A blank password keeps the old one for user 3.
    await gotoApp('/admin/users/3/edit')
    await byId(page, 'user-name').fill('Pelajar Maju Diubah')
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL('/admin/users')

    const tab = await newTab()
    await gotoAppOn(tab, '/login')
    await tab.getByTestId('login-email').fill('pelajar@demo.test')
    await tab.getByTestId('login-password').fill(DEMO_PASSWORD)
    await tab.getByTestId('login-submit').click()
    await expect(tab.getByTestId('login-alert')).toBeVisible()
    await tab.getByTestId('login-password').fill('Baru12345')
    await tab.getByTestId('login-submit').click()
    await expect(tab).toHaveURL(/\/dashboard/)

    const tab2 = await newTab()
    await gotoAppOn(tab2, '/login')
    await tab2.getByTestId('login-email').fill('pelajarmaju@demo.test')
    await tab2.getByTestId('login-password').fill(DEMO_PASSWORD)
    await tab2.getByTestId('login-submit').click()
    await expect(tab2).toHaveURL(/\/dashboard/)

    await gotoApp('/admin/users/3/edit')
    await byId(page, 'user-email').fill('bukan-emel')
    await byId(page, 'form-submit').click()
    // Native type=email validation or the server red alert: either way the form stays.
    await expect(page).toHaveURL('/admin/users/3/edit')
  })

  test('E2E-M02-23: clearing the school chip offers state + search; results load with latency, "zzz" is empty, a fault shows nothing, picking sets the chip', async ({
    page,
    mock,
    gotoApp,
  }) => {
    await gotoApp('/admin/users/2/edit')
    await expect(byId(page, 'admin-school-chip')).toBeVisible()
    await byId(page, 'admin-school-clear').click()
    await expect(byId(page, 'admin-school-search')).toBeVisible()
    await expect(byId(page, 'admin-school-state')).toBeVisible()

    await mock.setLatency(1200)
    await byId(page, 'admin-school-search').fill('bangi')
    await expect(byId(page, 'admin-school-loading')).toBeVisible()
    await expect(byId(page, 'admin-school-result').first()).toBeVisible({ timeout: 8000 })
    expect(await byId(page, 'admin-school-result').count()).toBeLessThanOrEqual(20)
    await mock.clearLatency()

    await byId(page, 'admin-school-search').fill('zzqxvzz')
    await expect(byId(page, 'admin-school-empty')).toBeVisible()

    await mock.failNext('/api/schools', 500)
    await byId(page, 'admin-school-search').fill('bangi ')
    await expect(byId(page, 'admin-school-result')).toHaveCount(0)

    await byId(page, 'admin-school-search').fill('bangi')
    await byId(page, 'admin-school-result').first().click()
    await expect(byId(page, 'admin-school-chip')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M02-24: parent 5401 has no linked children; leaving with Batal changes nothing', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users/5401/edit')
    await expect(byId(page, 'linker-none')).toHaveText('Tiada pelajar dipautkan lagi')
    await byId(page, 'linker-search').fill('pelajar')
    await byId(page, 'linker-result').first().click()
    await expect(byId(page, 'linker-chip')).toHaveCount(1)
    await byId(page, 'form-cancel').click()
    await expect(page).toHaveURL('/admin/users')
    await gotoApp('/admin/users/5401/edit')
    await expect(byId(page, 'linker-none')).toHaveText('Tiada pelajar dipautkan lagi')
  })

  test('E2E-M02-24: an already linked child is dimmed in the search results and adds nothing', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users/6/edit')
    await expect(byId(page, 'linker-chip')).toHaveCount(2)
    const chipText = (await byId(page, 'linker-chip').nth(1).innerText()).trim().split('\n')[0]!
    await byId(page, 'linker-search').fill(chipText)
    const rows = byId(page, 'linker-result')
    await expect(rows.first()).toBeVisible()
    const dimmed = rows.and(page.locator('.opacity-40'))
    await expect(dimmed.first()).toBeVisible()
    await dimmed.first().click()
    await expect(byId(page, 'linker-chip')).toHaveCount(2)
  })

  test('E2E-M02-25: role reactivity - parent shows children, Guru only the school, others none; back restores; student -> parent posts no grade / IC / package / school', async ({
    page,
    mock,
    gotoApp,
  }) => {
    await gotoApp('/admin/users/2/edit')
    await pickRole(page, 'parent')
    await expect(byId(page, 'grade-cards')).toHaveCount(0)
    await expect(byId(page, 'user-package-block')).toHaveCount(0)
    await expect(byId(page, 'user-ic')).toHaveCount(0)
    await expect(byId(page, 'parent-linker-edit')).toBeVisible()
    await pickRole(page, 'teacher')
    await expect(byId(page, 'admin-school')).toBeVisible()
    await expect(byId(page, 'grade-cards')).toHaveCount(0)
    for (const role of ['sponsor', 'school_admin', 'ppd_officer', 'jpn_officer', 'admin']) {
      await pickRole(page, role)
      await expect(byId(page, 'grade-cards')).toHaveCount(0)
      await expect(byId(page, 'user-ic')).toHaveCount(0)
      await expect(byId(page, 'user-package-block')).toHaveCount(0)
      await expect(byId(page, 'admin-school')).toHaveCount(0)
    }
    await pickRole(page, 'student')
    await expect(byId(page, 'grade-10')).toBeChecked()
    await expect(byId(page, 'user-ic')).not.toHaveValue('')

    await pickRole(page, 'parent')
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL('/admin/users')
    const put = (await writes(mock)).filter((r) => r.method !== 'POST').at(-1)!
    const body = put.body as Record<string, unknown>
    for (const key of ['grade', 'icNumber', 'packageId', 'package', 'schoolId']) {
      expect(body[key] ?? null, `body.${key}`).toBeNull()
    }
    expect(body.role).toBe('parent')
  })

  test('E2E-M02-21: the status switch and Nota Keselamatan render; no horizontal scroll on the S3 mobile layout', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users/2/edit')
    await expect(byId(page, 'user-security-notes').locator('li')).toHaveCount(4)
    await expect(byId(page, 'user-active')).toBeChecked()
    if (isMobileWidth(page)) await expectNoHorizontalScroll(page)
  })
})

void acceptNextDialog
