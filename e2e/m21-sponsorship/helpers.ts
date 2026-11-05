/**
 * Shared checks of the M21 specs.
 *
 * Shell header: S6 has `meta.layout: 'user'`, and `userShellFor` (src/app/router/layouts.ts) gives the
 * student the Pembelajaran layout (D29, D30, D43). Its navbar prints the route's title and no subtitle.
 * S6 prints its own h1 (`meta.ownsH1`, 9af431349), so the navbar title is a `shell-title` paragraph.
 *
 * Selects: `DsNativeSelect` keeps a hidden native `<select>` that holds the options, `required` and the
 * value; the user works a `USelect` combobox beside it.
 */

import type { Locator, Page } from '@playwright/test'

import { expect } from '../fixtures/test'

/** The navbar title of a screen that prints its own h1: exactly one h1 on the page. */
export async function expectShellTitle(page: Page, title: string): Promise<void> {
  await expect(page.getByTestId('shell-title')).toHaveText(title)
  await expect(page.locator('h1')).toHaveCount(1)
}

/** The visible combobox of the `DsNativeSelect` whose hidden select has this id. */
export function selectTrigger(page: Page, id: string): Locator {
  return page
    .locator('[data-ds="native-select"]', { has: page.locator(`#${id}`) })
    .getByRole('combobox')
}

/** Picks an option the way a user does: opens the combobox and clicks the row. */
export async function chooseOption(page: Page, id: string, label: string | RegExp): Promise<void> {
  await selectTrigger(page, id).click()
  await page.getByRole('option', { name: label }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
}
