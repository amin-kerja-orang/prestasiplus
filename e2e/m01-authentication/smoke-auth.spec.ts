/**
 * M01-T3 developer smoke (build-plan R.3.1; QA writes E2E-M01-01..18 at G5): the login and register
 * pages at 375 / 768 / 1280, and a real UI login of demo accounts 2, 5 and 8 (Milestone A).
 * Landing per BR-07: student, teacher and school admin all land on `/dashboard` (INFERRED for the
 * last two, URS OQ-3). The landing pages belong to other modules; only the URL is asserted here.
 */

import { expect, test, DEMO_PASSWORD } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  TAG,
} from '../support'

test.describe('M01 auth pages', { tag: [TAG.smoke, moduleTag(1)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('login page: title, copy, links and no horizontal scroll', async ({ page, gotoApp }) => {
    await gotoApp('/login')
    await expectTabTitle(page, 'Log Masuk | PRESTASIPLUS')

    const form = page.getByTestId('login-form')
    // the logo renders a light and a display:none dark <img>; assert the visible one
    await expect(page.locator('img[alt="PRESTASIPLUS"]:visible')).toHaveCount(1)
    await expect(page.getByText('Platform Latih Tubi Nasional 🇲🇾')).toBeVisible()
    await expect(form.getByLabel('Alamat Email')).toHaveAttribute('placeholder', 'nama@email.com')
    await expect(form.getByLabel('Kata Laluan')).toHaveAttribute('type', 'password')
    await expect(form.getByLabel('Ingat saya')).not.toBeChecked()
    await expect(form.getByRole('button', { name: 'Log Masuk' })).toBeEnabled()
    await expect(form.getByRole('link', { name: 'Lupa kata laluan?' })).toHaveAttribute(
      'href',
      '/password/reset',
    )
    await expect(form.getByRole('link', { name: 'Reset melalui No IC' })).toHaveAttribute(
      'href',
      '/password/reset-ic',
    )
    await expect(form.getByRole('link', { name: /Daftar Sekarang/ })).toHaveAttribute(
      'href',
      '/register',
    )
    await expect(form.getByRole('link', { name: 'Kembali ke Laman Utama' })).toHaveAttribute(
      'href',
      '/',
    )
    await expect(page.getByTestId('login-stats')).toContainText('Soalan')
    await expect(page.getByText('© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia.')).toBeVisible()

    // DV-07: the welcome panel shows from lg (1024px) only.
    const welcome = page.getByRole('heading', { name: 'Selamat Kembali! 👋' })
    if (isDesktopShell(page)) await expect(welcome).toBeVisible()
    else await expect(welcome).toBeHidden()

    await expectNoHorizontalScroll(page)
  })

  test('password eye toggle switches the field type without submitting', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/login')
    const password = page.getByTestId('login-password')
    await password.fill('rahsia')
    await page.getByTestId('login-password-toggle').click()
    await expect(password).toHaveAttribute('type', 'text')
    await page.getByTestId('login-password-toggle').click()
    await expect(password).toHaveAttribute('type', 'password')
    await expect(page).toHaveURL('/login')
  })

  test('wrong password shows the alert, keeps the email and clears the password', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/login')
    await page.getByTestId('login-email').fill('pelajar@demo.test')
    await page.getByTestId('login-password').fill('salah-salah')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('login-alert')).toContainText('Email atau kata laluan tidak sah.')
    await expect(page.getByTestId('login-email')).toHaveValue('pelajar@demo.test')
    await expect(page.getByTestId('login-password')).toHaveValue('')
    await expect(page).toHaveURL('/login')
    await expectNoHorizontalScroll(page)
  })

  // depends on #383 (R1 xl field size): the state select is 44px high but the school search input
  // is 40px, so their tops are 2px apart and the "side by side" check (< 2px) fails at every width.
  test('register page: title, copy, role and level cards, no horizontal scroll', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/register')
    await expectTabTitle(page, 'Daftar | PRESTASIPLUS')

    const form = page.getByTestId('register-form')
    await expect(page.getByText('Daftar Akaun Baru 🇲🇾')).toBeVisible()
    await expect(page.getByTestId('register-steps')).toHaveText(/1\s*2\s*3/)
    await expect(form.getByLabel('Nama Penuh')).toHaveAttribute(
      'placeholder',
      'Muhammad Fulan bin Fulan',
    )
    await expect(form.getByLabel('No. Telefon (Pilihan)')).toHaveAttribute('maxlength', '14')
    await expect(page.getByTestId('role-student')).toHaveAttribute('data-selected', 'true')
    await expect(page.getByText('Pilih Tahap Anda')).toBeVisible()
    await expect(form.getByLabel('No. Kad Pengenalan (Pilihan)')).toHaveAttribute('maxlength', '14')
    await expect(page.getByText('Minimum 6 aksara')).toBeVisible()
    await expect(form.getByRole('button', { name: 'Daftar Sekarang' })).toBeEnabled()

    await page.getByTestId('role-teacher').click()
    await expect(page.getByText('Pilih Tahap Anda')).toBeHidden()
    await expect(form.getByLabel('No. Kad Pengenalan (Pilihan)')).toBeHidden()
    await page.getByTestId('role-student').click()
    await page.getByTestId('grade-10').click()
    await expect(page.getByTestId('grade-10')).toHaveAttribute('data-selected', 'true')

    await expectNoHorizontalScroll(page)

    // State select and school search sit side by side at every width, and an open dropdown
    // adds no horizontal scroll.
    const state = await page.getByTestId('register-state').boundingBox()
    const search = await page.getByTestId('register-school-search').boundingBox()
    expect(Math.abs((state?.y ?? 0) - (search?.y ?? 99))).toBeLessThan(2)
    await page.getByTestId('register-school-search').click()
    await page.getByTestId('register-school-search').fill('de')
    await expect(page.getByTestId('school-dropdown')).toBeVisible()
    await expect(page.getByTestId('school-option').first()).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  for (const { id, email, role } of [
    { id: 2, email: 'pelajar@demo.test', role: 'Pelajar' },
    { id: 5, email: 'guru@demo.test', role: 'Guru' },
    { id: 8, email: 'adminsekolah@demo.test', role: 'Admin Sekolah' },
  ]) {
    test(`account ${String(id)} (${role}) logs in through the form and lands on /dashboard`, async ({
      page,
      gotoApp,
    }) => {
      await gotoApp('/login')
      await page.getByTestId('login-email').fill(email)
      await page.getByTestId('login-password').fill(DEMO_PASSWORD)
      await page.getByTestId('login-submit').click()

      await expect(page).toHaveURL('/dashboard')
      // No flash or toast after a successful login (FR-M01-07).
      const stored = await page.evaluate(() => window.localStorage.getItem('pp.auth'))
      expect(stored).not.toBeNull()
      const session = JSON.parse(stored ?? '{}') as { user: { id: number; email: string } }
      expect(session.user.id).toBe(id)
      expect(session.user.email).toBe(email)
    })
  }
})
