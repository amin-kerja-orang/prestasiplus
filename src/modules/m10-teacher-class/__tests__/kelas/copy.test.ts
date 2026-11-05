import { describe, expect, it } from 'vitest'

import { LEVEL_TILES } from '../../components/kelas/copy'

describe('LEVEL_TILES (BR-M10-03, v2 secondary only; R1-GUR-8 labels)', () => {
  it('has the five Tingkatan options and no Tahun option', () => {
    expect(LEVEL_TILES.map((t) => t.label)).toEqual([
      'Tingkatan 1',
      'Tingkatan 2',
      'Tingkatan 3',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    expect(LEVEL_TILES.some((t) => t.slug.startsWith('tahun-'))).toBe(false)
  })
})
