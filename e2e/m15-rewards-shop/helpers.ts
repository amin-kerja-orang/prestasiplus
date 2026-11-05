/**
 * Shared checks of the M15 specs.
 *
 * Shell header: every M15 route has `meta.layout: 'user'`, and `userShellFor` (src/app/router/layouts.ts)
 * gives Admin Pusat the Portal Pentadbiran and the student the Pembelajaran layout (D29, D30, D43,
 * D48; f66078938). The legacy `shell-user-*` header is only for roles outside v2, so these accounts
 * never see it, and neither v2 shell prints the route's "Selamat datang kembali" subtitle.
 */

import type { Locator, Page } from '@playwright/test'

import { expect } from '../fixtures/test'

/** The Portal Pentadbiran navbar names the page; a page subtitle comes only from `DsPageHeader`. */
export async function expectAdminHeader(page: Page, title: string): Promise<void> {
  await expect(page.getByTestId('pentadbiran-header').locator('h1')).toHaveText(title)
  await expect(page.getByTestId('pentadbiran-subtitle')).toHaveCount(0)
}

/** The Pembelajaran navbar names the page in a `p`, because the page owns the h1 (`meta.ownsH1`). */
export async function expectLearnerHeader(page: Page, title: string): Promise<void> {
  await expect(page.getByTestId('shell-title')).toHaveText(title)
  await expect(page.locator('h1')).toHaveCount(1)
}

export type Rgb = [number, number, number]

export function parseRgb(css: string): Rgb {
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

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** Contrast of an element's text against the nearest opaque background behind it. */
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
  return contrast(parseRgb(fg as string), parseRgb(bg as string))
}
