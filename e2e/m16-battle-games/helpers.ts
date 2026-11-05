/**
 * Shared shell checks of the M16 specs. Every M16 route has `meta.layout: 'user'`, and `userShellFor`
 * (src/app/router/layouts.ts) gives Admin Pusat the Portal Pentadbiran and the pupil the Pembelajaran
 * layout. The legacy `shell-user-*` header is only for roles outside v2, so these accounts never see it.
 * Neither v2 shell prints the route's `header.subtitle`: in Pentadbiran a subtitle comes only from
 * `DsPageHeader`, which the M16 pages do not use.
 */

import type { Locator, Page } from '@playwright/test'

import { expect } from '../fixtures/test'

/** The `<main>` of whichever v2 shell the account gets. */
export function shellMain(page: Page): Locator {
  return page.locator('[data-testid=pentadbiran-main], [data-testid=pembelajaran-main]')
}

/** The Portal Pentadbiran navbar names the page; no subtitle line is printed under it. */
export async function expectAdminHeader(page: Page, title: string): Promise<void> {
  await expect(page.getByTestId('pentadbiran-header').locator('h1')).toHaveText(title)
  await expect(page.getByTestId('pentadbiran-subtitle')).toHaveCount(0)
}

/** The Pembelajaran navbar names the page: an `h1`, or a `p` when the page owns the `h1` (`meta.ownsH1`). */
export async function expectLearnerHeader(page: Page, title: string): Promise<void> {
  await expect(
    page.getByTestId('pembelajaran-header').locator('h1, [data-testid=shell-title]').first(),
  ).toHaveText(title)
}

/** The option texts of a `USelect`: it renders a listbox on open, not a native `<select>`. */
export async function selectOptionTexts(page: Page, select: Locator): Promise<string[]> {
  await select.click()
  const options = page.getByRole('option')
  await expect(options.first()).toBeVisible()
  const texts = (await options.allTextContents()).map((t) => t.trim())
  await page.keyboard.press('Escape')
  await expect(options).toHaveCount(0)
  return texts
}

/** Picks one option of a `USelect`. */
export async function pickOption(page: Page, select: Locator, name: string): Promise<void> {
  await select.click()
  await page.getByRole('option', { name, exact: true }).click()
}

/** The value of one labelled `<dt>/<dd>` stat of a ranked row. */
export function rowStat(row: Locator, label: string): Locator {
  return row.locator('div', { has: row.page().getByText(label, { exact: true }) }).locator('dd')
}
