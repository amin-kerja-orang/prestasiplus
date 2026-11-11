/**
 * Helpers shared by the two M12 Kirkpatrick specs (T-C11): the shell header, the DS filter bar (inline from 768,
 * bottom sheet below), the DS data table (rows on a table, cards below 768) and the in-place error page.
 */

import type { Locator, Page } from '@playwright/test'

import { expect } from '../fixtures/test'
import { expectTabTitle, viewportWidth } from '../support'

/** Admin Pusat sits in Pentadbiran; teacher and school administrator in Pembelajaran (src/app/router/layouts.ts). */
export type Shell = 'pentadbiran' | 'pembelajaran'

/** innerText, so `<br>` and block boundaries read like the screen. */
export const TEXT = { useInnerText: true } as const

/** "{Page} | PRESTASIPLUS" (user decision 2026-10-29). */
export const tabTitle = (page: string): string => `${page} | PRESTASIPLUS`

/** Tab title, h1 and subtitle of the EXPECTED shell (never "either"). */
export async function expectHeader(
  page: Page,
  shell: Shell,
  [title, subtitle]: readonly [string, string],
  tab: string = title,
): Promise<void> {
  await expectTabTitle(page, tabTitle(tab))
  await expect(page.getByTestId(`${shell}-header`).locator('h1')).toHaveText(title)
  await expect(page.getByTestId(`${shell}-subtitle`)).toHaveText(subtitle)
}

/** The distinct left edges of `items` (columns of a grid). */
export async function columns(items: Locator): Promise<number> {
  const xs = await items.evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().x)),
  )
  return new Set(xs).size
}

/** hrefs of the anchors in `scope`. */
export async function hrefs(scope: Locator): Promise<(string | null)[]> {
  return scope.evaluateAll((els) => els.map((e) => e.getAttribute('href')))
}

/** DsDataTable and DsFilterBar switch at 768 (`useMedia('(min-width: 768px)')`). */
export const isWide = (page: Page): boolean => viewportWidth(page) >= 768

/** Rows of a DsDataTable: `tbody tr` from 768, the card list below. */
export const dsRows = (scope: Locator): Locator =>
  scope.locator('tbody tr, [data-ds="data-table-cards"] > li')

/** The pager summary of a DsDataTable ("Menunjukkan 1-20 daripada 33 hasil"). */
export const pagerSummary = (scope: Locator): Locator =>
  scope.locator('[data-ds="data-table-pager"] [role="status"]')

/** Shows every row of a DsDataTable on one page (page-size select "{n} / halaman"). */
export async function showAllRows(page: Page, scope: Locator): Promise<void> {
  const select = scope.locator('[data-ds="data-table-page-size"]').first()
  if ((await select.count()) === 0) return
  await select.click()
  await page.getByRole('option', { name: /^50\b/ }).click()
}

/** Below 768 the filter fields sit in a bottom sheet behind "Penapis"; from 768 they are inline. */
export async function openFilters(page: Page): Promise<void> {
  if (isWide(page)) return
  await page.locator('[data-ds="filter-open"]').click()
  await expect(page.locator('[data-ds="filter-sheet"]')).toBeVisible()
}

/** "Tapis" (inline) or "Guna" in the sheet. */
export async function applyFilters(page: Page): Promise<void> {
  if (isWide(page)) await page.getByRole('button', { name: 'Tapis', exact: true }).click()
  else await page.locator('[data-ds="filter-sheet"]').getByRole('button', { name: 'Guna' }).click()
}

/** The in-place error page of the shared shell (URL unchanged). */
export async function expectErrorPage(page: Page, code: '403' | '404'): Promise<void> {
  await expect(page.locator(`[data-ds="error-page"][data-code="${code}"]`)).toBeVisible()
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A stat tile reads "{value} {label}" (and an optional sub line) on one normalised line. */
export async function expectStat(
  tile: Locator,
  value: string,
  label: string,
  sub?: string,
): Promise<void> {
  const tail = sub === undefined ? '' : `\\s*${escape(sub)}`
  await expect(tile).toHaveText(new RegExp(`^\\s*${escape(value)}\\s*${escape(label)}${tail}\\s*$`), TEXT)
}

/** In-app navigation (no reload), so one boot serves several screens of a test. */
export async function spaGo(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    const app = document.querySelector('#app') as
      | (Element & {
          __vue_app__?: {
            config: { globalProperties: { $router: { push: (p: string) => Promise<unknown> } } }
          }
        })
      | null
    await app!.__vue_app__!.config.globalProperties.$router.push(to)
  }, path)
}

/** Whitespace-normalised inner texts. */
export const texts = (loc: Locator): Promise<string[]> =>
  loc.allInnerTexts().then((a) => a.map((t) => t.replace(/\s+/g, ' ').trim()))

/**
 * The rows of a DsDataTable as arrays of cell texts. From 768 the cells of every `td` (the "#" column dropped when
 * `dropIndex`); below, the card title followed by the values of the card fields.
 */
export async function tableMatrix(
  page: Page,
  scope: Locator,
  { dropIndex = false }: { dropIndex?: boolean } = {},
): Promise<string[][]> {
  if (isWide(page)) {
    const rows = await scope.locator('tbody tr').evaluateAll((els) =>
      els.map((r) => [...r.querySelectorAll('td')].map((c) => (c as HTMLElement).innerText.replace(/\s+/g, ' ').trim())),
    )
    return dropIndex ? rows.map((r) => r.slice(1)) : rows
  }
  return scope.locator('[data-ds="data-table-cards"] > li').evaluateAll((els) =>
    els.map((li) => [
      (li.querySelector('button') as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
      ...[...li.querySelectorAll('dd')].map((d) => (d as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
    ]),
  )
}

/** Goes through every page of a DsDataTable and returns what `read` extracts from the visible rows of each. */
export async function collectPages<T>(
  scope: Locator,
  read: (scope: Locator) => Promise<T[]>,
): Promise<T[]> {
  const out: T[] = []
  const next = scope.getByRole('button', { name: 'Seterusnya' })
  for (let i = 0; i < 100; i++) {
    out.push(...(await read(scope)))
    if ((await next.count()) === 0 || (await next.isDisabled())) break
    await next.click()
  }
  return out
}

/** Options of a Nuxt UI select (Reka listbox) opened from its trigger. */
export async function selectOptions(page: Page, trigger: Locator): Promise<string[]> {
  await trigger.click()
  const options = await page.getByRole('option').allInnerTexts()
  await page.keyboard.press('Escape')
  return options.map((t) => t.trim())
}

/** Picks one option of a Nuxt UI select by its label. */
export async function pickOption(page: Page, trigger: Locator, label: string): Promise<void> {
  await trigger.click()
  await page.getByRole('option', { name: label, exact: true }).click()
}
