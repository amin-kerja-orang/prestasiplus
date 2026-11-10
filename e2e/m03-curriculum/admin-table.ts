/**
 * Locators for the M03 admin lists (S6 subjects, S9 levels) after the DsTable restyle (commit
 * 52260010f). The old `subject-row` / `level-row` / `switch-track` / `*-edit` / `*-delete` test
 * ids are gone; rows, switches, the edit link and the delete menu are found by role, scoped to the
 * list's table (`subjects-table` / `levels-table`). Table layout (md and up); below md the lists
 * render as cards, handled per test with `isCardLayout`.
 */

import type { Locator, Page } from '@playwright/test'

import { expect } from '../fixtures/test'

export type AdminList = 'subjects' | 'levels'

const TABLE_ID: Record<AdminList, string> = { subjects: 'subjects-table', levels: 'levels-table' }

/** DsDataTable switches from cards to the table at Tailwind `md`. */
export const TABLE_MIN_WIDTH = 768

export function isCardLayout(page: Page): boolean {
  const size = page.viewportSize()
  return size !== null && size.width < TABLE_MIN_WIDTH
}

export function listTable(page: Page, list: AdminList): Locator {
  return page.getByTestId(TABLE_ID[list])
}

/** Body rows of the table (or the cards below md). */
export function listRows(page: Page, list: AdminList): Locator {
  return isCardLayout(page)
    ? listTable(page, list).locator('[data-ds="data-table-cards"] > li')
    : listTable(page, list).locator('tbody tr')
}

/** The row of the record with this id (first column "#"). */
export function rowById(page: Page, list: AdminList, id: number): Locator {
  const table = listTable(page, list)
  if (isCardLayout(page)) {
    // Cards do not print the id; fall back to the edit link target.
    const path = list === 'subjects' ? 'subjects' : 'education-levels'
    return table
      .locator('[data-ds="data-table-cards"] > li')
      .filter({ has: page.locator(`a[href="/admin/${path}/${String(id)}/edit"]`) })
  }
  return table
    .locator('tbody tr')
    .filter({ has: page.locator('td').first().filter({ hasText: new RegExp(`^\\s*${String(id)}\\s*$`) }) })
}

export function rowSwitch(row: Locator): Locator {
  return row.getByRole('switch')
}

export function rowEdit(row: Locator): Locator {
  return row.getByRole('link', { name: 'Edit', exact: true })
}

export function rowMenuButton(row: Locator): Locator {
  return row.getByRole('button', { name: 'Tindakan', exact: true })
}

/** Opens the row's "..." menu and picks "Padam" (the confirm dialog then appears). */
export async function chooseDelete(page: Page, row: Locator): Promise<void> {
  await rowMenuButton(row).click()
  await page.getByRole('menuitem', { name: 'Padam', exact: true }).click()
}

export function confirmDialog(page: Page): {
  message: Locator
  cancel: Locator
  ok: Locator
} {
  return {
    message: page.locator('[data-ds="confirm-message"]'),
    cancel: page.locator('[data-ds="confirm-cancel"]'),
    ok: page.locator('[data-ds="confirm-ok"]'),
  }
}

/** Waits until the list shows at least one record. */
export async function expectListLoaded(page: Page, list: AdminList): Promise<void> {
  await expect(listRows(page, list).first()).toBeVisible()
}

/** Checked state of a row's "Aktif?" switch. */
export async function expectSwitch(row: Locator, on: boolean): Promise<void> {
  await expect(rowSwitch(row)).toHaveAttribute('aria-checked', on ? 'true' : 'false')
}

/** The record id of a row: the "#" cell in the table, the edit link target in the card list. */
export async function idOfRow(row: Locator): Promise<string> {
  const cell = row.locator('td').first()
  if ((await cell.count()) > 0) return (await cell.innerText()).trim()
  const href = (await rowEdit(row).getAttribute('href')) ?? ''
  return /\/(\d+)\/edit$/.exec(href)?.[1] ?? ''
}
