/**
 * Shared locators for the M04 S1 list / S3 detail specs (v2 admin-list pattern: `DsDataTable`,
 * `DsFilterBar`, `DsRowActions`, `useConfirm` dialog). Not a spec file.
 */

import { expect, type Locator, type Page } from '@playwright/test'

import { isMobileWidth, viewportWidth } from '../support'

/** Table rows (>= md) or cards (< md) of the list. */
export function listRows(page: Page): Locator {
  const table = page.getByTestId('questions-table')
  return table.locator('tbody tr, [data-ds="data-table-cards"] > li')
}

/** The row / card that holds question `id`. */
export function rowOf(page: Page, id: string | number): Locator {
  return listRows(page).filter({ has: page.getByTestId('question-id').getByText(String(id), { exact: true }) })
}

/** The pager block under the table (summary + page size + pagination). */
export function pager(page: Page): Locator {
  return page.locator('[data-ds="data-table-pager"]')
}

/** The DS confirm dialog (`useConfirm`), replacing the native `confirm()`. */
export function confirmDialog(page: Page): Locator {
  // The OK button is unique to the confirm host; the dialog shell around it is shared with other dialogs.
  return page.locator('[data-ds="confirm-ok"]')
}

/** Waits for the DS confirm dialog, checks its message, and answers it. */
export async function answerConfirm(
  page: Page,
  answer: 'ok' | 'cancel',
  message?: string,
): Promise<void> {
  const dialog = confirmDialog(page)
  await expect(dialog).toBeVisible()
  if (message !== undefined) await expect(page.locator('[data-ds="confirm-message"]')).toHaveText(message)
  await page.locator(`[data-ds="confirm-${answer}"]`).click()
  await expect(dialog).toBeHidden()
}

/** Opens the row "..." menu and clicks the danger item "Padam" (no direct button on a row). */
export async function clickRowDelete(row: Locator): Promise<void> {
  await row.getByTestId('question-more').click()
  await row.page().getByRole('menuitem', { name: 'Padam' }).click()
}

/** Expands the per-subject table of the summary card (collapsed by default). */
export async function openSubjectTable(page: Page): Promise<void> {
  const toggle = page.getByTestId('questions-summary-toggle')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(page.getByTestId('questions-tile').first()).toBeVisible()
}

/** Below md the filter bar is a drawer behind a "Penapis" button; opens it. No-op from md. */
export async function openFilters(page: Page): Promise<void> {
  if (viewportWidth(page) >= 768) return
  await page.locator('[data-ds="filter-open"]').click()
  await expect(page.locator('[data-ds="filter-sheet"]')).toBeVisible()
}

/** Opens the "Lagi Penapis" popover (DSKP / Kesukaran / Compliance / Source) from md. */
export async function openMoreFilters(page: Page): Promise<void> {
  await openFilters(page)
  if (viewportWidth(page) >= 768) {
    await page.locator('[data-ds="filter-more"]').click()
    await expect(page.locator('[data-ds="filter-more-panel"]')).toBeVisible()
  }
}

/** Applies the filter form: "Cari" button from md, the drawer apply button below md. */
export async function applyFilters(page: Page): Promise<void> {
  if (viewportWidth(page) >= 768) {
    // The popover (if open) overlays the bar; Enter in the search box submits the same form.
    await page.getByTestId('questions-search').press('Enter')
  } else {
    await page.locator('[data-ds="filter-sheet"] button').filter({ hasText: /^Guna/ }).first().click()
  }
}

export const isNarrow = (page: Page): boolean => isMobileWidth(page)
