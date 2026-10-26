import type { Locator } from '@playwright/test'

import { expect } from '@playwright/test'

type Rgba = [number, number, number, number]

function luminance([r, g, b]: number[]): number {
  const c = [r, g, b].map((v) => {
    const s = (v ?? 0) / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}

/** WCAG contrast ratio of two opaque rgb colours. */
export function contrastRatio(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/**
 * Real contrast check of a text element against the background it is actually painted on:
 * walks up to the nearest ancestor with an opaque `background-color` (compositing translucent
 * layers on the way) and, when a gradient `background-image` is met first, uses every rgb stop.
 * Fails when the worst ratio is below `min` (4.5 normal text, 3 large text).
 */
export async function expectContrast(el: Locator, min = 4.5): Promise<void> {
  const { fg, backgrounds } = await el.evaluate((node) => {
    const parse = (s: string): Rgba => {
      const n = (s.match(/[\d.]+/g) ?? []).map(Number)
      return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1]
    }
    const fgc = parse(getComputedStyle(node).color)
    const layers: Rgba[] = []
    let gradient: Rgba[] = []
    for (let p: HTMLElement | null = node as HTMLElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        const stops = cs.backgroundImage.match(/rgba?\([^)]*\)/g)
        if (stops && stops.length) {
          gradient = stops.map(parse)
          break
        }
      }
      const bg = parse(cs.backgroundColor)
      if (bg[3] > 0) layers.push(bg)
      if (bg[3] === 1) break
    }
    // composite translucent layers (top-most first in `layers`) onto white when nothing opaque was met
    const flatten = (base: number[]): number[] =>
      layers.reduceRight(
        (acc, l) => acc.map((c, i) => (i < 3 ? l[i]! * l[3] + c * (1 - l[3]) : c)),
        base,
      )
    const bgs = gradient.length
      ? gradient.map((g) => g.slice(0, 3))
      : [flatten([255, 255, 255, 1]).slice(0, 3)]
    return { fg: fgc.slice(0, 3), backgrounds: bgs }
  })
  for (const bg of backgrounds) {
    expect(contrastRatio(fg, bg), `text rgb(${fg}) on rgb(${bg})`).toBeGreaterThanOrEqual(min)
  }
}
