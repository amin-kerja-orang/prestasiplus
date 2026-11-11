import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { uiConfig } from '../ui.config'

type SizeMap = Record<string, { base: string }>
const sizes = (uiConfig as unknown as { button: { variants: { size: SizeMap } } }).button.variants.size

/** Tailwind `min-h-N` (spacing scale, 0.25rem steps) as pixels; 0 when the class is absent. */
const minHeightPx = (classes: string): number => {
  const m = classes.split(/\s+/).find((c) => /^min-h-\d+$/.test(c))
  return m ? Number(m.slice('min-h-'.length)) * 4 : 0
}

/** Every `.vue` file under `dir`, recursively. */
const vueFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : vueFiles(p)
    return e.name.endsWith('.vue') ? [p] : []
  })

describe('UButton sizes (touch targets)', () => {
  it('every size a page passes to UButton is themed', () => {
    const used = new Set<string>()
    for (const f of vueFiles(join(__dirname, '..', '..'))) {
      for (const tag of readFileSync(f, 'utf8').matchAll(/<UButton\b[^>]*?>/gs)) {
        const size = tag[0].match(/\bsize="([a-z]+)"/)?.[1]
        if (size) used.add(size)
      }
    }
    expect(used.size).toBeGreaterThan(0)
    expect([...used].filter((s) => !(s in sizes))).toEqual([])
  })

  it.each(['md', 'lg', 'xl'])('%s is at least 44px', (size) => {
    expect(minHeightPx(sizes[size]!.base)).toBeGreaterThanOrEqual(44)
  })
})

describe('UPagination controls (touch targets, C-64)', () => {
  const slots = (uiConfig as unknown as { pagination: { slots: Record<string, string> } }).pagination.slots

  it.each(['item', 'first', 'prev', 'next', 'last', 'ellipsis'])('%s is 44px, 40px only on staff from lg', (slot) => {
    const classes = slots[slot]!.split(/\s+/)
    expect(classes).toEqual(expect.arrayContaining(['size-11', 'min-h-11', 'min-w-11']))
    expect(classes).toEqual(expect.arrayContaining(['staff:lg:size-10', 'staff:lg:min-h-10', 'staff:lg:min-w-10']))
    expect(classes.filter((c) => /^(md:|lg:)(size|min-h|min-w)-/.test(c))).toEqual([])
  })
})
