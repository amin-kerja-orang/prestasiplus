/**
 * Shared checks of the M14 specs.
 *
 * Shell header: every M14 route has `meta.layout: 'user'`, and `userShellFor` (src/app/router/layouts.ts)
 * gives Admin Pusat the Portal Pentadbiran (D29, D30, D43, D48). The legacy `shell-user-*` header is
 * only for roles outside v2, and the Pentadbiran navbar prints a subtitle only from `DsPageHeader`, so
 * the route's "Selamat datang kembali" is not shown.
 *
 * Leaderboard rows: B05 (147793363) moved them to the design-system `DsLeaderRow`, which has no
 * `lb-row-*` test ids, so `leaderRow` reads the row by its structure.
 */

import type { Locator, Page } from '@playwright/test'

import { expect } from '../fixtures/test'

/** The Portal Pentadbiran navbar names the page; a page subtitle comes only from `DsPageHeader`. */
export async function expectAdminHeader(page: Page, title: string): Promise<void> {
  await expect(page.getByTestId('pentadbiran-header').locator('h1')).toHaveText(title)
  await expect(page.getByTestId('pentadbiran-subtitle')).toHaveCount(0)
}

/** `{shell header title} | PRESTASIPLUS` (docs/design/v2-copy-glossary.md, "Tab title"). */
export const tabTitle = (headerTitle: string): string => `${headerTitle} | PRESTASIPLUS`

type Rgb = [number, number, number]

function parseRgb(css: string): Rgb {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css)
  if (!m) throw new Error(`not an rgb colour: ${css}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function luminance([r, g, b]: Rgb): number {
  const f = (v: number): number => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** WCAG contrast of an element's text against the nearest opaque background behind it. */
export async function textContrast(locator: Locator): Promise<number> {
  const [fg, bg] = await locator.evaluate((el) => {
    let node: Element | null = el
    while (node) {
      const colour = getComputedStyle(node).backgroundColor
      if (/^rgb\(/.test(colour)) return [getComputedStyle(el).color, colour]
      node = node.parentElement
    }
    throw new Error('no opaque background behind the element')
  })
  const [hi, lo] = [luminance(parseRgb(fg as string)), luminance(parseRgb(bg as string))].sort(
    (x, y) => y - x,
  ) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** The body-text contrast minimum of WCAG AA, for a heading or label that must stay readable. */
export async function expectReadable(locator: Locator): Promise<void> {
  expect(await textContrast(locator)).toBeGreaterThanOrEqual(4.5)
}

/**
 * A `UProgress` bar really filled to `pct`: the reported value and the painted indicator. The width
 * lives in the indicator's `translateX`, so the edge is measured rather than read from a style.
 */
export async function expectBarFill(bar: Locator, pct: number): Promise<void> {
  await expect(bar.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(pct))
  await expect
    .poll(() =>
      bar.evaluate((el) => {
        const base = el.querySelector('[data-slot="base"]')!.getBoundingClientRect()
        const fill = el.querySelector('[data-slot="indicator"]')!.getBoundingClientRect()
        return Math.round(((fill.right - base.left) / base.width) * 100)
      }),
    )
    .toBe(pct)
}

/** The parts of a `DsLeaderRow` (`data-testid="lb-row"`). */
export const leaderRow = {
  rank: (row: Locator) => row.locator('[data-ds="leader-rank"]'),
  avatar: (row: Locator) => row.locator('[data-slot="fallback"]'),
  name: (row: Locator) => row.locator('> span.grow > span').first(),
  title: (row: Locator) => row.locator('> span.grow > span').last(),
  score: (row: Locator) => row.locator('> span.tabular').last(),
}
