import { describe, expect, it } from 'vitest'

import { tileLayout } from '../tile-layout'

/** Grid auto-placement of a track and the per-tile spans at one width (mobile-first inheritance). */
function rowsAt(n: number, bp: 'base' | 'md' | 'xl', cols?: number): number[] {
  const { grid, spans } = tileLayout(n, cols)
  const order = ['base', 'md', 'xl'] as const
  let track = 1
  for (const cls of grid) {
    const m = cls.match(/^(?:(md|xl):)?grid-cols-(\d+)$/)
    const at = (m?.[1] ?? 'base') as 'base' | 'md' | 'xl'
    if (order.indexOf(at) <= order.indexOf(bp)) track = Number(m?.[2])
  }
  const sizes: number[] = []
  let used = 0
  let count = 0
  spans.forEach((s) => {
    let span = 1
    for (const k of order) if (order.indexOf(k) <= order.indexOf(bp) && s[k] !== undefined) span = s[k]!
    if (used + span > track) {
      sizes.push(-1) // overflow marker: a gap would be left in the row
      used = 0
      count = 0
    }
    used += span
    count += 1
    if (used === track) {
      sizes.push(count)
      used = 0
      count = 0
    }
  })
  if (used !== 0) sizes.push(-used)
  return sizes
}

describe('tileLayout (no orphan row)', () => {
  it('fills every row at every width for 1 to 12 tiles', () => {
    for (let n = 1; n <= 12; n++) {
      for (const bp of ['base', 'md', 'xl'] as const) {
        const rows = rowsAt(n, bp)
        expect(rows.every((r) => r > 0), `n=${n} ${bp}: ${rows.join('+')}`).toBe(true)
        expect(rows.reduce((a, b) => a + b, 0)).toBe(n)
      }
    }
  })

  it('honours the most tiles per row at xl', () => {
    for (let n = 2; n <= 12; n++) {
      for (const cols of [2, 3, 4]) {
        const rows = rowsAt(n, 'xl', cols)
        expect(Math.max(...rows)).toBeLessThanOrEqual(cols)
        expect(rows.every((r) => r > 0)).toBe(true)
      }
    }
  })

  it('splits the counts of the audit as agreed', () => {
    expect(rowsAt(4, 'md')).toEqual([2, 2])
    expect(rowsAt(4, 'xl')).toEqual([4])
    expect(rowsAt(5, 'md')).toEqual([3, 2])
    expect(rowsAt(7, 'xl')).toEqual([4, 3])
    expect(rowsAt(11, 'xl')).toEqual([4, 4, 3])
  })
})
