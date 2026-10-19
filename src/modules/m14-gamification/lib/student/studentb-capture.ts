/**
 * Card capture for "Muat Turun" (D25; FR-M14-49/54, FN-M14-6.1.6/6.2.6): the on-screen card is
 * rendered to a canvas with html2canvas (scale 2) and saved as a PNG. This is a client-side capture
 * of the user's own card, not generated media (D22 allows it). html2canvas is loaded on first use only.
 *
 * html2canvas 1.4.1 cannot parse the modern colour functions Tailwind v4 emits (`oklch`, `oklab`,
 * `color-mix`, `color(srgb …)`), so `onclone` rewrites every colour of the cloned card to plain
 * `rgb()` first, through a 1x1 canvas.
 */

import { saveBlob } from '@/lib/save-blob'

const MODERN_COLOR = /(?:oklch|oklab|lab|lch|color-mix|color)\((?:[^()]|\([^()]*\))*\)/g

const COLOR_PROPS = [
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
  'boxShadow',
  'textShadow',
] as const

let probe: CanvasRenderingContext2D | null = null

const SENTINEL = '#010203'

/** A CSS colour as `rgb()` / `rgba()` (the browser resolves any colour function), or `null` when it cannot be parsed. */
function toRgb(color: string): string | null {
  probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!probe) return null
  probe.fillStyle = SENTINEL
  probe.fillStyle = color
  // An unparseable value is ignored by the setter, so the sentinel would still be there.
  if (probe.fillStyle === SENTINEL) return null
  probe.clearRect(0, 0, 1, 1)
  probe.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0, a = 255] = probe.getImageData(0, 0, 1, 1).data
  return a === 255
    ? `rgb(${String(r)}, ${String(g)}, ${String(b)})`
    : `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(Math.round((a / 255) * 1000) / 1000)})`
}

/** Replaces every modern colour function of `value` by rgb; one that cannot be parsed is left as it is. */
export const flattenColorValue = (value: string): string =>
  value.replace(MODERN_COLOR, (m) => toRgb(m) ?? m)

/** Gradient strings: Firefox / Safari keep the interpolation token ("in oklab") that html2canvas cannot parse. */
export const flattenGradient = (value: string): string =>
  flattenColorValue(value.replace(/\s+in\s+\w+/g, ''))

/** Rewrites the colours of `root` and its descendants (in the clone) to plain rgb. */
export function flattenColors(root: HTMLElement): void {
  const view = root.ownerDocument.defaultView
  if (!view) return
  for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    const cs = view.getComputedStyle(el)
    for (const prop of COLOR_PROPS) {
      const value = cs[prop]
      MODERN_COLOR.lastIndex = 0
      if (!MODERN_COLOR.test(value)) continue
      const next = flattenColorValue(value)
      if (next !== value) el.style[prop] = next
    }
    MODERN_COLOR.lastIndex = 0
    const image = cs.backgroundImage
    if (image && image !== 'none') {
      const next = flattenGradient(image)
      if (next !== image) el.style.backgroundImage = next
    }
  }
}

/** Renders `target` to a PNG (scale 2) and saves it as `fileName`. */
export async function captureCardToPng(
  target: HTMLElement | null,
  fileName: string,
): Promise<void> {
  if (!target) return
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(target, {
    scale: 2,
    backgroundColor: null,
    logging: false,
    onclone: (_doc, cloned) => {
      flattenColors(cloned)
    },
  })
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
  canvas.width = 0 // release the bitmap
  if (!blob) throw new Error('capture failed')
  saveBlob(blob, fileName)
}
