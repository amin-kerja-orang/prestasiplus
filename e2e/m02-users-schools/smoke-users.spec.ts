/**
 * M02-T4 developer smoke (build-plan M02-T4; QA writes E2E-M02-* at G5): S1 user list `/admin/users`
 * as the demo admin at 375 / 768 / 1280 — totals, role cards, one filter, toggle, delete through the
 * modal, and Login As a student. The admin session comes in through `loginAs` (fast login hook).
 *
 * v2 list: `DsDataTable` (table rows from 768 px, cards below, no row test id: `user-row` is the actions
 * box of a row, carrying `data-user-id`), the filter bar (`Cari`, or the `Penapis` sheet below 768 px),
 * the "..." row menu (`row-menu`: Nyahaktifkan/Aktifkan, Login As, Padam) and the shared confirm dialog
 * (`[data-ds=confirm-ok]`) instead of native confirms.
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
  TAG,
} from '../support'

const ROLE_COUNTS: Record<string, string> = {
  student: '4,533',
  teacher: '551',
  parent: '38',
  sponsor: '6',
  school_admin: '16',
  ppd_officer: '5',
  admin: '2',
}

const tableLayout = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 768

/** The list rows: table rows from 768 px, cards below. */
const rowsOf = (page: Page) =>
  page.locator(
    '[data-testid=users-table] tbody tr, [data-testid=users-table] [data-ds=data-table-cards] > li',
  )

/** The row (table row or card) of user `id`. */
const rowOf = (page: Page, id: string | null) =>
  rowsOf(page).filter({
    has: page.locator(`[data-testid="user-row"][data-user-id="${String(id)}"]`),
  })

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

const stat = (page: Page, role: string) =>
  page.getByTestId(`users-stat-${role}`).getByTestId('users-stat-value')

test.describe('M02 S1 user list', { tag: [TAG.smoke, moduleTag(2)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/admin/users')
  })

  test('totals, role cards, layout and no horizontal scroll', async ({ page }) => {
    await expectTabTitle(page, 'Senarai Pengguna | PRESTASIPLUS')
    await expect(rowsOf(page)).toHaveCount(25)

    for (const [role, count] of Object.entries(ROLE_COUNTS)) {
      await expect(stat(page, role)).toHaveText(count)
    }
    // Labels are never truncated (DV-M02-02): each card's text is fully inside its box.
    await expect(page.getByTestId('users-stat-school_admin')).toContainText('Admin Sekolah')
    await expect(page.getByTestId('users-stat-ppd_officer')).toContainText('Pegawai PPD')

    const pager = page.locator('[data-ds="data-table-pager"]')
    await expect(pager).toContainText('Menunjukkan 1-25 daripada 5159 hasil')
    if (!isMobileWidth(page)) {
      await expect(pager.getByRole('button', { name: '207', exact: true })).toBeVisible()
    } else {
      await expectTouchTarget(page.getByRole('link', { name: 'Edit' }).first())
    }

    // DV-M02-01 / DV-M02-25: the table fits its card from the desktop width.
    if (isDesktopShell(page)) {
      const scroll = await page.getByTestId('users-table').evaluate((table) => {
        const scroller = table.querySelector('.overflow-x-auto') as HTMLElement | null
        return scroller
          ? { scrollWidth: scroller.scrollWidth, clientWidth: scroller.clientWidth }
          : null
      })
      if (scroll) expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth)
    }

    await expectNoHorizontalScroll(page)
  })

  test('the own row has no checkbox, Login As or delete', async ({ page, gotoApp }) => {
    await gotoApp('/admin/users?role=admin')
    await expect(rowsOf(page)).toHaveCount(2)
    const own = rowsOf(page).filter({ hasText: 'admin@demo.test' })
    await expect(own).toHaveCount(1)
    await expect(own.getByRole('checkbox')).toHaveCount(0)
    await expect(own.getByRole('link', { name: 'Edit' })).toBeVisible()
    await own.getByTestId('row-menu').click()
    await expect(page.getByRole('menuitem', { name: 'Login As' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Padam' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: /ktifkan/ }).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expectNoHorizontalScroll(page)
  })

  test('filter by role and the empty state', async ({ page }) => {
    await openFilters(page)
    await page.getByTestId('users-role').selectOption('parent')
    await applyFilters(page)
    await expect(page).toHaveURL(/\/admin\/users\?role=parent$/)
    await expect(page.getByTestId('users-stat-parent')).toHaveAttribute('data-active', 'true')
    await expect(rowsOf(page).first()).toContainText('Ibu Bapa')
    // Cards keep the totals of all users (BR-02).
    await expect(stat(page, 'student')).toHaveText('4,533')

    await openFilters(page)
    await page.getByTestId('users-search').fill('tiada-padanan-zzz')
    await applyFilters(page)
    await expect(page.getByTestId('users-empty')).toContainText('Tiada pengguna dijumpai')
    await expect(page.getByTestId('users-empty')).toContainText('Cuba ubah kriteria carian anda')
    await expectNoHorizontalScroll(page)
  })

  test('toggle the active status after the confirm dialog', async ({ page, gotoApp }) => {
    await gotoApp('/admin/users?role=student')
    // The first rows may still wait for approval ("Menunggu kelulusan"): take the first active one.
    const active = rowsOf(page).filter({ has: page.getByText('Aktif', { exact: true }) }).first()
    const id = await active.getByTestId('user-row').getAttribute('data-user-id')
    const row = rowOf(page, id)
    await expect(row.getByTestId('user-status')).toHaveText('Aktif')
    await row.getByTestId('row-menu').click()
    await page.getByRole('menuitem', { name: 'Nyahaktifkan' }).click()
    await expect(page.getByRole('dialog')).toContainText('Pasti untuk menukar status pengguna ini?')
    await page.locator('[data-ds="confirm-ok"]').click()
    // A never-signed-in account that is switched off reads as waiting for approval (accountState).
    await expect(row.getByTestId('user-status')).toHaveText('Menunggu kelulusan')
  })

  test('delete a user through the modal', async ({ page, gotoApp }) => {
    await gotoApp('/admin/users?role=student')
    const id = await page.getByTestId('user-row').first().getAttribute('data-user-id')
    const row = rowOf(page, id)
    const name = (await row.getByTestId('user-name').first().innerText()).trim()
    await row.getByTestId('row-menu').click()
    await page.getByRole('menuitem', { name: 'Padam' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toContainText('Padam Pengguna?')
    await expect(modal).toContainText('Anda pasti mahu memadam pengguna ini?')
    await expect(modal.getByTestId('users-delete-name')).toHaveText(name)
    await expectNoHorizontalScroll(page)

    // Cancel closes without deleting.
    await modal.getByRole('button', { name: 'Batal' }).click()
    await expect(modal).toHaveCount(0)

    await row.getByTestId('row-menu').click()
    await page.getByRole('menuitem', { name: 'Padam' }).click()
    await page.getByTestId('users-delete-confirm').click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(stat(page, 'student')).toHaveText('4,532')
  })

  test('bulk select and delete', async ({ page, gotoApp }) => {
    await gotoApp('/admin/users?role=student')
    await rowsOf(page).nth(0).getByRole('checkbox').check()
    await rowsOf(page).nth(1).getByRole('checkbox').check()
    await expect(page.getByTestId('users-bulk-bar')).toContainText('2 dipilih')
    await page.getByTestId('users-bulk-delete').click()
    await expect(page.getByRole('dialog')).toContainText('Anda pasti mahu memadam 2 pengguna?')
    await expect(page.getByRole('dialog')).toContainText('Tindakan ini tidak boleh dibatalkan.')
    await page.getByTestId('users-bulk-confirm').click()
    await expect(page.getByTestId('users-bulk-bar')).toHaveCount(0)
    await expect(stat(page, 'student')).toHaveText('4,531')
  })

  test('Login As a student lands on the student page with the new session', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/admin/users?role=student')
    const id = await page.getByTestId('user-row').first().getAttribute('data-user-id')
    const row = rowOf(page, id)
    const name = (await row.getByTestId('user-name').first().innerText()).trim()
    await row.getByTestId('row-menu').click()
    await page.getByRole('menuitem', { name: 'Login As' }).click()
    await expect(page.getByRole('dialog')).toContainText(`Login sebagai ${name}?`)
    await page.locator('[data-ds="confirm-ok"]').click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page).not.toHaveURL(/\/admin\//)
    const auth = await page.evaluate(() => JSON.parse(localStorage.getItem('pp.auth') ?? 'null'))
    expect(auth.user.role).toBe('student')
    expect(auth.user.name).toBe(name)
    await expectNoHorizontalScroll(page)
  })
})
