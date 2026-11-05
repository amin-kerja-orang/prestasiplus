/**
 * Shared checks of the M20 specs.
 *
 * Shell header: every M20 screen has `meta.layout: 'user'`, and `userShellFor`
 * (src/app/router/layouts.ts) gives the student the Pembelajaran layout (D29, D30, D43). The legacy
 * `shell-user-*` header is only for roles outside v2. The Pembelajaran navbar prints the route's
 * title and no subtitle, so the category of S7 and the shop name of S8 show on the page itself.
 *
 * Filters: B06 (79b5fa2dc) and M-G (85e356c67) moved the search card to `DsFilterBar`
 * (docs/design/v2-learner-page-templates.md 1.9; AC-MUR-32-4). Its selects are `USelect` comboboxes
 * and it draws its own buttons: "Cari" from `md`; below `md` the selects sit in a bottom sheet behind
 * "Penapis" and the sheet applies with "Guna".
 */

import type { Locator, Page } from '@playwright/test'

import { expect } from '../fixtures/test'
import { viewportWidth } from '../support'

/** `DsFilterBar` keeps its selects inline from this width (`useMedia('(min-width: 768px)')`). */
const FILTER_BAR_INLINE_MIN_WIDTH = 768

const search = (page: Page) => page.getByTestId('marketplace-search')
export const filtersInline = (page: Page): boolean =>
  viewportWidth(page) >= FILTER_BAR_INLINE_MIN_WIDTH

/** The navbar title of a screen whose only h1 is the shell's own. */
export async function expectShellH1(page: Page, title: string): Promise<void> {
  const h1 = page.locator('h1')
  await expect(h1).toHaveCount(1)
  await expect(page.getByTestId('pembelajaran-header').locator('h1')).toHaveText(title)
}

/** The navbar title of a screen that prints its own h1 (`meta.ownsH1`): exactly one h1 on the page. */
export async function expectShellTitle(page: Page, title: string): Promise<void> {
  await expect(page.getByTestId('shell-title')).toHaveText(title)
  await expect(page.locator('h1')).toHaveCount(1)
}

/** The "Penapis" button of the phone layout. */
export const filterOpenButton = (page: Page): Locator =>
  search(page).locator('[data-ds="filter-open"]')

/** Opens the bottom sheet below `md`; from `md` the selects are already on the page. */
export async function openFilters(page: Page): Promise<void> {
  if (filtersInline(page) || (await page.getByTestId('marketplace-sort').isVisible())) return
  await filterOpenButton(page).click()
  await expect(page.getByTestId('marketplace-sort')).toBeVisible()
}

/** Picks an option of a `USelect` by its exact label (the trigger is a `role=combobox` button). */
export async function chooseOption(page: Page, testId: string, label: string): Promise<void> {
  await openFilters(page)
  await page.getByTestId(testId).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

/** The apply button of the current layout, with the sheet open below `md`: "Cari" or "Guna". */
export function applyButton(page: Page): Locator {
  return filtersInline(page)
    ? search(page).getByRole('button', { name: 'Cari', exact: true })
    : page.locator('[data-ds="filter-sheet"]').getByRole('button', { name: 'Guna', exact: true })
}

/** Applies the current values. */
export async function applyFilters(page: Page): Promise<void> {
  await openFilters(page)
  await applyButton(page).click()
  // The sheet closes with an animation: wait for it, or the next `openFilters` sees it still open.
  if (!filtersInline(page)) await expect(page.locator('[data-ds="filter-sheet"]')).toHaveCount(0)
}

/** Picks a list of `[testId, label]` and applies them in one search. */
export async function searchWith(
  page: Page,
  picks: readonly (readonly [testId: string, label: string])[],
): Promise<void> {
  for (const [testId, label] of picks) await chooseOption(page, testId, label)
  await applyFilters(page)
}

/** The labels of a `USelect`, read from its open list. Closes the list again. */
export async function optionLabels(page: Page, testId: string): Promise<string[]> {
  await page.getByTestId(testId).click()
  const options = page.getByRole('option')
  await expect(options.first()).toBeVisible()
  const labels = (await options.allTextContents()).map((t) => t.trim())
  await page.keyboard.press('Escape')
  await expect(options).toHaveCount(0)
  return labels
}

/**
 * Every product photo really decodes. `DsArt3D variant="plain"` loads lazily (B06, 79b5fa2dc), so a
 * card is scrolled into view first; a broken URL still fails on `naturalWidth`.
 */
export async function expectProductPhotosLoad(page: Page): Promise<void> {
  const images = page.getByTestId('product-card-image')
  const count = await images.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i += 1) {
    const image = images.nth(i)
    await image.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        image.evaluate((el) => {
          const img = el as HTMLImageElement
          return img.complete && img.naturalWidth > 0
        }),
      )
      .toBe(true)
  }
}
