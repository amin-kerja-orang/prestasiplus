// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { dsCopy } from '@/ds/copy'

// S8-T07 D06-D09: class-level assertions on the Pembelajaran layout source.
// Real layout at 375/768/1280 is covered by UAT.
const src = readFileSync(resolve(__dirname, '../PembelajaranLayout.vue'), 'utf8')

describe('Pembelajaran shell a11y (S8-T07)', () => {
  it('D06 account button is a 44px target (size-11)', () => {
    const m = src.match(/<button[^>]*?class="([^"]*)"[^>]*?data-testid="pembelajaran-account-top"/s)
    expect(m?.[1]).toContain('size-11')
    expect(m?.[1]).not.toContain('size-10')
  })

  it('D07 nav link rows are h-10 on fine and pointer-coarse:h-12 on touch', () => {
    const rows = src.match(/'h-10 [^']*'/g) ?? []
    expect(rows).toHaveLength(2)
    for (const r of rows) expect(r).toContain('pointer-coarse:h-12')
  })

  it('D08 bottom-nav labels are at least 12px (text-xs)', () => {
    expect(src).toMatch(/max-w-full text-center text-xs leading-tight/)
    expect(src).not.toContain('text-[0.6875rem]')
  })

  it('D09 live tab has sr-only text, not colour alone', () => {
    expect(dsCopy.statusLive).toBe('LIVE')
    expect(src).toMatch(/class="sr-only"[^>]*>\{\{ dsCopy\.statusLive \}\}/)
  })
})
