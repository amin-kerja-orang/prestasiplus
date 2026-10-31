import { describe, expect, it } from 'vitest'

import { LEVEL_TILES, schoolPlace } from '../../components/kelas/copy'

describe('LEVEL_TILES (BR-M10-03, v2 secondary only)', () => {
  it('has the five Tingkatan tiles and no Tahun tile', () => {
    expect(LEVEL_TILES.map((t) => t.label)).toEqual(['Ting. 1', 'Ting. 2', 'Ting. 3', 'Ting. 4', 'Ting. 5'])
    expect(LEVEL_TILES.some((t) => t.slug.startsWith('tahun-'))).toBe(false)
  })
})

describe('schoolPlace', () => {
  it('joins district and state, skipping a missing district', () => {
    expect(schoolPlace({ district: 'PPD SEGAMAT', state: 'Johor' })).toBe('PPD SEGAMAT, Johor')
    expect(schoolPlace({ district: null, state: 'Johor' })).toBe('Johor')
  })
})
