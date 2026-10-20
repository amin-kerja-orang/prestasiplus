import { describe, expect, it } from 'vitest'

import { chunksOf } from '../../src/modules/practice/practice.repository'
import { MAX_ROLLUP_SCHOOLS, ROLLUP_TOO_LARGE_MESSAGE } from '../../src/modules/school-admin/amaran/amaran.service'

describe('BE-21 Amaran batching helpers (no database)', () => {
  it('cuts ids into lists of at most 1000, keeping the order', () => {
    const ids = Array.from({ length: 2500 }, (_, i) => String(i + 1))
    const parts = chunksOf(ids)
    expect(parts.map((x) => x.length)).toEqual([1000, 1000, 500])
    expect(parts.flat()).toEqual(ids)
  })

  it('gives no list for no ids (no query is sent)', () => {
    expect(chunksOf([])).toEqual([])
    expect(chunksOf(['1'], 1000)).toEqual([['1']])
  })

  it('has a positive roll-up cap and a BM refusal text', () => {
    expect(MAX_ROLLUP_SCHOOLS).toBeGreaterThan(0)
    expect(ROLLUP_TOO_LARGE_MESSAGE).toMatch(/sekolah/)
  })
})
