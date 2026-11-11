import { describe, expect, it } from 'vitest'

import { uiConfig } from '../ui.config'

type SizeMap = Record<string, { base: string }>
const sizes = (uiConfig as unknown as { switch: { variants: { size: SizeMap } } }).switch.variants.size

/** Stock Nuxt UI track (px): width = `w-N` of the size, height = thumb + 2 x 2px border. */
const STOCK: Record<string, { w: number; h: number; thumb: number }> = {
  sm: { w: 32, h: 18, thumb: 14 },
  md: { w: 36, h: 20, thumb: 16 },
  lg: { w: 40, h: 22, thumb: 18 },
}

const px = (classes: string, re: RegExp): number => {
  const m = re.exec(classes)
  if (!m) throw new Error(`missing ${String(re)}`)
  return m[1]!.endsWith('px') || /^\d+$/.test(m[1]!) ? Number(m[1]!.replace('px', '')) : NaN
}

describe('USwitch touch box below lg (C-45)', () => {
  it.each(Object.keys(STOCK))('%s: a 44x44 element whose painted track keeps the stock size', (size) => {
    const base = sizes[size]!.base
    expect(base.split(/\s+/).every((c) => c.startsWith('max-lg:'))).toBe(true) // from lg nothing changes
    expect(base).toContain('max-lg:bg-clip-padding')
    const width = 44 // max-lg:w-11
    expect(base).toContain('max-lg:w-11')
    const bx = px(base, /max-lg:border-x-(\d+)\b/) // Tailwind border-x-N = N px
    const by = px(base, /max-lg:border-y-\[?(\d+(?:px)?)\]?/)
    const pad = 2 // max-lg:p-0.5
    expect(base).toContain('max-lg:p-0.5')
    const s = STOCK[size]!
    expect(width - 2 * bx).toBe(s.w) // padding box width = stock track width
    expect(s.thumb + 2 * pad + 2 * by).toBe(44) // element height
    expect(s.thumb + 2 * pad).toBe(s.h) // padding box height = stock track height
  })
})
