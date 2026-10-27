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
    // The browser normalises every CSS colour (rgb, oklch, color(), hsl, lab, named, ...) to sRGB:
    // paint it on a 1x1 canvas and read the pixel back. An unsupported or malformed value throws
    // instead of being misread as black.
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const toRgba = (value: string): Rgba => {
      if (!CSS.supports('color', value)) throw new Error(`contrast: cannot parse colour "${value}"`)
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return [r!, g!, b!, a! / 255]
    }
    const STOP = /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\((?:[^()]|\([^()]*\))*\)/g
    // composite `top` over an opaque `base`
    const over = (top: Rgba, base: Rgba): Rgba => [
      top[0] * top[3] + base[0] * (1 - top[3]),
      top[1] * top[3] + base[1] * (1 - top[3]),
      top[2] * top[3] + base[2] * (1 - top[3]),
      1,
    ]

    const layers: Rgba[] = []
    let gradient: Rgba[] = []
    for (let p: HTMLElement | null = node as HTMLElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        const stops = cs.backgroundImage.match(STOP)
        if (!stops?.length) {
          throw new Error(
            `contrast: cannot read colour stops of background-image "${cs.backgroundImage}"`,
          )
        }
        gradient = stops.map(toRgba)
        break
      }
      const bg = toRgba(cs.backgroundColor)
      if (bg[3] > 0) layers.push(bg)
      if (bg[3] === 1) break
    }
    // layers are top-most first; flatten bottom-up onto the base (white when nothing opaque was met)
    const flatten = (base: Rgba): Rgba => layers.reduceRight((acc, l) => over(l, acc), base)
    const white: Rgba = [255, 255, 255, 1]
    const bgs = (
      gradient.length ? gradient.map((g) => flatten(over(g, white))) : [flatten(white)]
    ).map((c) => c.slice(0, 3))
    // text colour with alpha is composited over the first resolved background
    const fgc = toRgba(getComputedStyle(node).color)
    const fgFlat = over(fgc, [...(bgs[0] as number[]), 1] as Rgba)
    return { fg: fgFlat.slice(0, 3), backgrounds: bgs }
  })
  for (const bg of backgrounds) {
    expect(contrastRatio(fg, bg), `text rgb(${fg}) on rgb(${bg})`).toBeGreaterThanOrEqual(min)
  }
}
