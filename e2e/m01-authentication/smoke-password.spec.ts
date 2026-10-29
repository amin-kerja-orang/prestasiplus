/**
 * M01-T4 developer smoke (build-plan R.3.1; QA writes E2E-M01-19..24 at G5): the password pages
 * S3 `/password/reset`, S4 `/password/reset/:token` and S5 `/password/reset-ic` at 375 / 768 / 1280.
 * Covers forgot (outbox token) -> reset -> auto-login, the expired demo token, and the IC reset
 * that lands on S4 pre-filled.
 */

import { expect, test, DEMO_PASSWORD } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, moduleTag, TAG } from '../support'

const STUDENT = 'pelajar@demo.test'
const STUDENT_IC = '100101140001'
const NEW_PASSWORD = 'BaruBaru123'

test.describe('M01 password pages', { tag: [TAG.smoke, moduleTag(1)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('S3 forgot: copy, autofocus, no IC link, no horizontal scroll', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/password/reset')
    await expectTabTitle(page, 'Lupa Kata Laluan | PRESTASIPLUS')
    await expect(page.getByRole('heading', { name: 'Lupa Kata Laluan?' })).toBeVisible()
    await expect(
      page.getByText('Masukkan email anda dan kami akan hantar pautan untuk reset kata laluan.'),
    ).toBeVisible()
    const email = page.getByLabel('Alamat Email')
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('placeholder', 'nama@email.com')
    await expect(page.getByRole('button', { name: 'Hantar Pautan Reset' })).toBeEnabled()
    await expect(page.getByRole('link', { name: 'Kembali ke Log Masuk' })).toHaveAttribute(
      'href',
      '/login',
    )
    await expect(page.getByRole('link', { name: /No IC/ })).toHaveCount(0)
    await expect(page.getByTestId('auth-footer')).toHaveText(
      '© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia.',
    )
    await expectNoHorizontalScroll(page)
  })

  test('S3 forgot: unknown email shows the red alert and keeps the value', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/password/reset')
    await page.getByTestId('forgot-email').fill('tiada@demo.test')
    await page.getByTestId('forgot-submit').click()
    await expect(page.getByTestId('forgot-alert')).toContainText(
      "We can't find a user with that email address.",
    )
    await expect(page.getByTestId('forgot-email')).toHaveValue('tiada@demo.test')
    await expectNoHorizontalScroll(page)
  })

  test('forgot -> outbox token -> reset -> auto-login, then the old password fails', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/password/reset')
    await page.getByTestId('forgot-email').fill(STUDENT)
    await page.getByTestId('forgot-submit').click()
    await expect(page.getByTestId('forgot-status')).toBeVisible()
    await expect(page.getByTestId('forgot-status')).toContainText(
      'emailed your password reset link',
    )
    await expectNoHorizontalScroll(page)

    // A repeat within 60 s is throttled (BR-10).
    await page.getByTestId('forgot-submit').click()
    await expect(page.getByTestId('forgot-alert')).toContainText('Please wait before retrying.')

    const token = await mock.outbox.lastResetFor(STUDENT)
    expect(token).toBeTruthy()

    await gotoApp(`/password/reset/${token ?? ''}?email=${encodeURIComponent(STUDENT)}`)
    await expectTabTitle(page, 'Reset Kata Laluan | PRESTASIPLUS')
    await expect(page.getByRole('heading', { name: 'Reset Kata Laluan' })).toBeVisible()
    await expect(page.getByTestId('reset-email')).toHaveValue(STUDENT)
    await expect(page.getByTestId('auth-footer')).toContainText('© 2026 PRESTASIPLUS.')
    await expect(page.getByTestId('reset-password')).toHaveAttribute(
      'placeholder',
      'Minimum 6 aksara',
    )
    await expect(page.getByTestId('reset-confirm')).toHaveAttribute(
      'placeholder',
      'Taip semula kata laluan',
    )
    await expectNoHorizontalScroll(page)

    // Two independent eye toggles.
    await page.getByTestId('reset-password-toggle').click()
    await expect(page.getByTestId('reset-password')).toHaveAttribute('type', 'text')
    await expect(page.getByTestId('reset-confirm')).toHaveAttribute('type', 'password')

    await page.getByTestId('reset-password').fill(NEW_PASSWORD)
    await page.getByTestId('reset-confirm').fill(NEW_PASSWORD)
    await page.getByTestId('reset-submit').click()

    await expect(page).toHaveURL('/dashboard')
    const stored = await page.evaluate(() => window.localStorage.getItem('pp.auth'))
    const session = JSON.parse(stored ?? '{}') as { user: { email: string } }
    expect(session.user.email).toBe(STUDENT)

    // The old password no longer works; the new one does.
    await page.evaluate(() => window.localStorage.removeItem('pp.auth'))
    await gotoApp('/login')
    await page.getByTestId('login-email').fill(STUDENT)
    await page.getByTestId('login-password').fill(DEMO_PASSWORD)
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('login-alert')).toContainText('Email atau kata laluan tidak sah.')
    await page.getByTestId('login-password').fill(NEW_PASSWORD)
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL('/dashboard')
  })

  test('S4 with the seeded demo token logs in; the expired demo token shows the alert', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp(`/password/reset/demo-expired-token?email=${encodeURIComponent(STUDENT)}`)
    await page.getByTestId('reset-password').fill(NEW_PASSWORD)
    await page.getByTestId('reset-confirm').fill(NEW_PASSWORD)
    await page.getByTestId('reset-submit').click()
    await expect(page.getByTestId('reset-alert')).toContainText(
      'This password reset token is invalid.',
    )
    await expect(page.getByTestId('reset-email')).toHaveValue(STUDENT)
    await expect(page).toHaveURL(/\/password\/reset\/demo-expired-token/)
    await expectNoHorizontalScroll(page)

    await gotoApp(`/password/reset/demo-reset-token?email=${encodeURIComponent(STUDENT)}`)
    await page.getByTestId('reset-password').fill(NEW_PASSWORD)
    await page.getByTestId('reset-confirm').fill(NEW_PASSWORD)
    await page.getByTestId('reset-submit').click()
    await expect(page).toHaveURL('/dashboard')
  })

  test('S4 without ?email= starts with an empty, editable email', async ({ page, gotoApp }) => {
    await gotoApp('/password/reset/whatever')
    await expect(page.getByTestId('reset-email')).toHaveValue('')
    await expect(page.getByTestId('reset-email')).toBeEditable()
  })

  test('S5 IC reset: copy, mismatch alert, then a match lands on S4 pre-filled and resets', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/password/reset-ic')
    await expectTabTitle(page, 'Reset Kata Laluan (No IC) | PRESTASIPLUS')
    await expect(page.getByRole('heading', { name: 'Reset Melalui No IC' })).toBeVisible()
    await expect(page.getByTestId('ic-number')).toHaveAttribute('maxlength', '14')
    await expect(page.getByTestId('auth-footer')).toContainText('© 2026 PRESTASIPLUS.')
    await expect(page.getByText('Tanpa tanda sempang (-). Contoh: 000101010000')).toBeVisible()
    await expectNoHorizontalScroll(page)

    await page.getByTestId('ic-email').fill(STUDENT)
    await page.getByTestId('ic-number').fill('999999999999')
    await page.getByTestId('ic-submit').click()
    await expect(page.getByTestId('ic-alert')).toContainText(
      'Email atau No Kad Pengenalan tidak sepadan.',
    )
    await expect(page.getByTestId('ic-number')).toHaveValue('999999999999')

    await page.getByTestId('ic-number').fill(STUDENT_IC)
    await page.getByTestId('ic-submit').click()
    await expect(page).toHaveURL(/\/password\/reset\/[^/?]+\?email=/)
    await expect(page.getByTestId('reset-email')).toHaveValue(STUDENT)

    await page.getByTestId('reset-password').fill(NEW_PASSWORD)
    await page.getByTestId('reset-confirm').fill(NEW_PASSWORD)
    await page.getByTestId('reset-submit').click()
    await expect(page).toHaveURL('/dashboard')
  })
})
