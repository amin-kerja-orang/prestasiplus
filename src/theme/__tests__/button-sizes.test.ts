import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import { uiConfig } from '../ui.config'

type SizeMap = Record<string, { base: string }>
const sizes = (uiConfig as unknown as { button: { variants: { size: SizeMap } } }).button.variants.size

/** Tailwind `min-h-N` (spacing scale, 0.25rem steps) as pixels; 0 when the class is absent. */
const minHeightPx = (classes: string): number => {
  const m = classes.split(/\s+/).find((c) => /^min-h-\d+$/.test(c))
  return m ? Number(m.slice('min-h-'.length)) * 4 : 0
}

describe('UButton sizes (touch targets)', () => {
  it('every size a page passes to UButton is themed', () => {
    const files = execSync('git ls-files "src/**/*.vue"', { encoding: 'utf8' }).trim().split('\n')
    const used = new Set<string>()
    for (const f of files) {
      for (const tag of readFileSync(f, 'utf8').matchAll(/<UButton\b[^>]*?>/gs)) {
        const size = tag[0].match(/\bsize="([a-z]+)"/)?.[1]
        if (size) used.add(size)
      }
    }
    expect([...used].filter((s) => !(s in sizes))).toEqual([])
  })

  it.each(['md', 'lg', 'xl'])('%s is at least 44px', (size) => {
    expect(minHeightPx(sizes[size]!.base)).toBeGreaterThanOrEqual(44)
  })

  it('sizes grow in order xs < sm < md < lg < xl', () => {
    const order = ['xs', 'sm', 'md', 'lg', 'xl'].map((s) => minHeightPx(sizes[s]!.base))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(new Set(order).size).toBe(order.length)
  })
})
