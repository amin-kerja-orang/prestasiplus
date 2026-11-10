/**
 * Pembelajaran shell helpers of the M27 specs (school admin, T-C11). The school admin sits in the staff
 * Pembelajaran layout: sidebar (`pembelajaran-nav`) from lg, the "Lagi" sheet (`pembelajaran-lagi-nav`)
 * below it, the page title as the navbar h1 (or the `shell-title` paragraph when the page owns its h1),
 * no sub-line, and the account menu behind the top-right avatar (`pembelajaran-account-top`) with the
 * school name and "Log Keluar". Active menu rows carry `aria-current="page"`.
 */

import type { Locator, Page } from '@playwright/test'

import { expect } from '../fixtures/test'
import { isDesktopShell } from '../support'

/** The title the navbar prints. */
export const navbarTitle = (page: Page): Locator =>
  page.getByTestId('pembelajaran-header').locator('h1, [data-testid=shell-title]').first()

/** The menu of the current width: the sidebar nav (>= lg) or, after opening "Lagi", the full-menu sheet. */
export async function openMenu(page: Page): Promise<Locator> {
  if (isDesktopShell(page)) {
    const nav = page.getByTestId('pembelajaran-nav')
    await expect(nav).toBeVisible()
    return nav
  }
  await page.getByTestId('pembelajaran-bottom-nav').locator('[data-nav-id="tab-lagi"]').click()
  const nav = page.getByTestId('pembelajaran-lagi-nav')
  await expect(nav).toBeVisible()
  return nav
}

/** The menu row that links to `href`. */
export const menuLink = (menu: Locator, href: string): Locator =>
  menu.locator(`a[href="${href}"]`).first()

/** Opens the account menu of the navbar avatar. */
export async function openAccountMenu(page: Page): Promise<Locator> {
  await page.getByTestId('pembelajaran-account-top').click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  return menu
}

/** The navbar sub-line (school name, planned test id `pembelajaran-subtitle`, pending the layout fix). */
export const navbarSubtitle = (page: Page): Locator => page.getByTestId('pembelajaran-subtitle')

export async function expectSchoolName(page: Page, name: string): Promise<void> {
  await expect(navbarSubtitle(page)).toHaveText(name)
}

/** Logs out through the account menu. */
export async function logoutViaAccountMenu(page: Page): Promise<void> {
  const menu = await openAccountMenu(page)
  await menu.getByRole('menuitem', { name: 'Log Keluar' }).click()
}

/** Menu target of a school-admin menu entry id (the Pembelajaran menu rows carry no `data-nav-id`). */
const NAV_HREF: Record<string, string> = {
  'sa-dashboard': '/admin-sekolah',
  'sa-senarai-pelajar': '/admin-sekolah/pelajar',
  'sa-senarai-guru': '/admin-sekolah/guru',
  'sa-kelas-sekolah': '/admin-sekolah/kelas',
  'sa-amaran-awal': '/amaran/sekolah',
  'sa-statistik-penggunaan': '/admin-sekolah/statistik-penggunaan',
  'sa-laporan-aktiviti': '/admin-sekolah/laporan-aktiviti',
  'sa-laporan-bulanan': '/admin-sekolah/laporan-bulanan',
  'sa-dskp-heatmap': '/admin-sekolah/dskp-heatmap',
}
export function navHref(id: string): string {
  const href = NAV_HREF[id]
  if (!href) throw new Error(`no menu target known for ${id}`)
  return href
}

/** All user table rows: `user-row` (with `data-user-id`) marks the identity cell, so take its `tr`. */
export const userRows = (page: Page): Locator =>
  page.locator('tr').filter({ has: page.getByTestId('user-row') })

/** The table row of the user with this id. */
export const userRow = (page: Page, id: number): Locator =>
  page.locator('tr').filter({ has: page.locator(`[data-testid="user-row"][data-user-id="${id}"]`) })

/** The DS confirm dialog (`useConfirm`), which replaced the native `confirm()`: waits for it, checks the message, answers it. */
async function answerConfirm(page: Page, button: 'confirm-ok' | 'confirm-cancel', message?: string): Promise<void> {
  const ok = page.locator(`[data-ds="${button}"]`)
  await expect(ok).toBeVisible()
  if (message !== undefined) {
    await expect(page.locator('[data-ds="confirm-message"]')).toHaveText(message)
  }
  await ok.click()
  await expect(ok).toBeHidden()
}
export const acceptConfirm = (page: Page, message?: string): Promise<void> =>
  answerConfirm(page, 'confirm-ok', message)
export const dismissConfirm = (page: Page, message?: string): Promise<void> =>
  answerConfirm(page, 'confirm-cancel', message)

/** The unfiltered count tile of S6 / S7 (`DsStatTile`: the figure, then the label "Pelajar" / "Guru"). */
export const userCountCard = (page: Page): Locator => page.getByTestId('user-count-card')

/** The figure of the count tile as text, e.g. "10". */
export async function userCountValue(page: Page): Promise<string> {
  const text = (await userCountCard(page).innerText()).trim()
  const m = /^\s*([\d,]+)/.exec(text)
  if (!m) throw new Error(`no figure in the count tile: "${text}"`)
  return m[1]!
}

/** The count tile shows this figure (`not`: it does not). */
export async function expectUserCount(page: Page, n: string, not = false): Promise<void> {
  const re = new RegExp(`^\s*${n}(?![\d,])`)
  if (not) await expect(userCountCard(page)).not.toHaveText(re)
  else await expect(userCountCard(page)).toHaveText(re)
}

/** `DsFilterBar` keeps the selects inline from md; below md they sit in a bottom sheet behind "Penapis". */
const FILTER_INLINE_MIN_WIDTH = 768
export async function openUserFilters(page: Page): Promise<void> {
  if ((page.viewportSize()?.width ?? 1280) >= FILTER_INLINE_MIN_WIDTH) return
  if (await page.locator('[data-ds="filter-sheet"]').isVisible()) return
  await page.locator('[data-ds="filter-open"]').click()
  await expect(page.locator('[data-ds="filter-sheet"]')).toBeVisible()
}

/** Sets a select of the filter bar (opens the sheet below md). */
export async function selectUserFilter(page: Page, testid: string, value: string): Promise<void> {
  await openUserFilters(page)
  await page.getByTestId(testid).selectOption(value)
}

/** Applies the filter bar: "Cari" from md, "Guna" in the sheet below it. */
export async function applyUserFilter(page: Page): Promise<void> {
  if ((page.viewportSize()?.width ?? 1280) >= FILTER_INLINE_MIN_WIDTH) {
    await page.locator('[data-ds="filter-bar"] button[type="submit"]').click()
    return
  }
  await openUserFilters(page)
  await page.locator('[data-ds="filter-sheet"]').getByRole('button', { name: 'Guna' }).click()
}
