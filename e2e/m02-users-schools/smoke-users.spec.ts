/**
 * M02-T4 developer smoke (build-plan M02-T4; QA writes E2E-M02-* at G5): S1 user list `/admin/users`
 * as the demo admin at 375 / 768 / 1280 — totals, role cards, one filter, toggle, delete through the
 * modal, and Log Masuk Sebagai a student. The admin session comes in through `loginAs` (fast login hook).
 */

import { expect, test } from '../fixtures/test'
import {
  acceptNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  isMobileWidth,
  moduleTag,
  TAG,
} from '../support'

const ROLE_COUNTS: Record<string, string> = {
  student: '4533',
  teacher: '551',
  parent: '38',
  sponsor: '6',
  school_admin: '16',
  ppd_officer: '5',
  admin: '2',
}

test.describe('M02 S1 user list', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/admin/users')
  })

  test('totals, role cards, layout and no horizontal scroll', async ({ page }) => {
    await expectTabTitle(page, 'Pengurusan Pengguna - Panel Admin')
    await expect(page.getByTestId('user-row')).toHaveCount(25)

    for (const [role, count] of Object.entries(ROLE_COUNTS)) {
      await expect(
        page.getByTestId(`users-stat-${role}`).getByTestId('users-stat-count'),
      ).toHaveText(count)
    }
    // Labels are never truncated (DV-M02-02): each card's text is fully inside its box.
    await expect(page.getByTestId('users-stat-school_admin')).toContainText('Admin Sekolah')
    await expect(page.getByTestId('users-stat-ppd_officer')).toContainText('Pegawai PPD')

    if (!isMobileWidth(page)) {
      await expect(page.getByTestId('users-pager')).toContainText('Showing 1 to 25 of 5159 results')
      await expect(
        page.getByTestId('users-pager').getByRole('link', { name: 'Go to page 207' }),
      ).toBeVisible()
    } else {
      await expect(page.getByTestId('users-pager').getByText('Next »')).toBeVisible()
      // "LA" label below 640px.
      const loginAs = page.getByTestId('user-login-as').first()
      await expect(loginAs.getByText('LA', { exact: true })).toBeVisible()
      await expect(loginAs.getByText('Log Masuk Sebagai', { exact: true })).toBeHidden()
      await expectTouchTarget(page.getByTestId('user-login-as').first())
      await expectTouchTarget(page.getByTestId('user-delete').first())
    }

    // DV-M02-01: the table fits from the desktop width, scrolls inside its card below it.
    const scroll = await page.getByTestId('users-table').evaluate((table) => {
      const scroller = table.closest('.overflow-x-auto') as HTMLElement
      return { scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth }
    })
    if (isDesktopShell(page)) expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth)
    else expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth)

    await expectNoHorizontalScroll(page)
  })

  test('the own row has no checkbox, Log Masuk Sebagai or delete', async ({ page, gotoApp }) => {
    await gotoApp('/admin/users?role=admin')
    const rows = page.getByTestId('user-row')
    await expect(rows).toHaveCount(2)
    const own = rows.filter({ hasText: 'admin@demo.test' })
    await expect(own).toHaveCount(1)
    await expect(own.getByTestId('user-select')).toHaveCount(0)
    await expect(own.getByTestId('user-login-as')).toHaveCount(0)
    await expect(own.getByTestId('user-delete')).toHaveCount(0)
    await expect(own.getByTestId('user-edit')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('filter by role and the empty state', async ({ page }) => {
    await page.getByTestId('users-role').selectOption('parent')
    await page.getByTestId('users-search-submit').click()
    await expect(page).toHaveURL(/\/admin\/users\?role=parent$/)
    await expect(page.getByTestId('users-stat-parent')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('user-role').first()).toHaveText('Ibu Bapa')
    // Cards keep the totals of all users (BR-02).
    await expect(page.getByTestId('users-stat-student').getByTestId('users-stat-count')).toHaveText(
      '4533',
    )

    await page.getByTestId('users-search').fill('tiada-padanan-zzz')
    await page.getByTestId('users-search-submit').click()
    await expect(page.getByTestId('users-empty')).toContainText('Tiada pengguna dijumpai')
    await expect(page.getByTestId('users-empty')).toContainText('Cuba ubah kriteria carian anda')
    await expectNoHorizontalScroll(page)
  })

  test('toggle the active status after the native confirm', async ({ page, gotoApp }) => {
    await gotoApp('/admin/users?role=student')
    const first = page.getByTestId('user-row').first()
    const id = await first.getAttribute('data-user-id')
    const row = page.locator(`[data-user-id="${id}"]`)
    const before = (await row.getByTestId('user-toggle').innerText()).trim()
    expect(['Aktif', 'Tidak']).toContain(before)
    const after = before === 'Aktif' ? 'Tidak' : 'Aktif'
    const dialog = acceptNextDialog(page, {
      type: 'confirm',
      message: 'Pasti untuk menukar status pengguna ini?',
    })
    await row.getByTestId('user-toggle').click()
    await dialog
    await expect(row.getByTestId('user-toggle')).toHaveText(after)
  })

  test('delete a user through the modal', async ({ page, gotoApp }) => {
    await gotoApp('/admin/users?role=student')
    const first = page.getByTestId('user-row').first()
    const name = (await first.getByTestId('user-name').innerText()).trim()
    await first.getByTestId('user-delete').click()

    const modal = page.getByTestId('users-delete-modal')
    await expect(modal.getByRole('heading', { name: 'Padam Pengguna?' })).toBeVisible()
    await expect(modal).toContainText('Anda pasti mahu memadam pengguna ini?')
    await expect(modal.getByTestId('users-delete-name')).toHaveText(name)
    await expectNoHorizontalScroll(page)

    // Cancel closes without deleting.
    await modal.getByRole('button', { name: 'Batal' }).click()
    await expect(modal).toHaveCount(0)

    await first.getByTestId('user-delete').click()
    await page.getByTestId('users-delete-confirm').click()
    await expect(page.getByTestId('users-delete-modal')).toHaveCount(0)
    await expect(page.getByTestId('users-stat-student').getByTestId('users-stat-count')).toHaveText(
      '4532',
    )
  })

  test('bulk select and delete', async ({ page, gotoApp }) => {
    await gotoApp('/admin/users?role=student')
    const rows = page.getByTestId('user-row')
    await rows.nth(0).getByTestId('user-select').check()
    await rows.nth(1).getByTestId('user-select').check()
    await expect(page.getByTestId('users-bulk-bar')).toContainText('2 dipilih')
    await page.getByTestId('users-bulk-delete').click()
    await expect(page.getByTestId('users-bulk-modal')).toContainText(
      'Anda pasti mahu memadam 2 pengguna?',
    )
    await expect(page.getByTestId('users-bulk-modal')).toContainText(
      'Tindakan ini tidak boleh dibatalkan.',
    )
    await page.getByTestId('users-bulk-confirm').click()
    await expect(page.getByTestId('users-bulk-bar')).toHaveCount(0)
    await expect(page.getByTestId('users-stat-student').getByTestId('users-stat-count')).toHaveText(
      '4531',
    )
  })

  test('Log Masuk Sebagai a student lands on the student page with the new session', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users?role=student')
    const first = page.getByTestId('user-row').first()
    const name = (await first.getByTestId('user-name').innerText()).trim()
    const dialog = acceptNextDialog(page, { type: 'confirm', message: `Log masuk sebagai ${name}?` })
    await first.getByTestId('user-login-as').click()
    await dialog

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page).not.toHaveURL(/\/admin\//)
    const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('pp.auth') ?? 'null'))
    expect(auth.user.role).toBe('student')
    expect(auth.user.name).toBe(name)
    await expectNoHorizontalScroll(page)
  })
})
