import { describe, expect, it } from 'vitest'

import { LEVEL_TILES, schoolPlace, tilesForSchoolType } from '../../components/kelas/copy'

describe('tilesForSchoolType (BR-M10-03)', () => {
  it('shows all 11 tiles with no school', () => {
    expect(tilesForSchoolType(null)).toHaveLength(11)
    expect(tilesForSchoolType(null)).toBe(LEVEL_TILES)
  })
  it('shows Tahun 1-6 for type SK, SJK(C) and SJK(T) and Ting. 1-5 for any other type (DV-M10-38)', () => {
    expect(tilesForSchoolType('SK').map((t) => t.label)).toEqual([
      'Tahun 1',
      'Tahun 2',
      'Tahun 3',
      'Tahun 4',
      'Tahun 5',
      'Tahun 6',
    ])
    expect(tilesForSchoolType('SMK').map((t) => t.label)).toEqual([
      'Ting. 1',
      'Ting. 2',
      'Ting. 3',
      'Ting. 4',
      'Ting. 5',
    ])
    for (const type of ['SJK(C)', 'SJK(T)']) {
      expect(
        tilesForSchoolType(type).map((t) => t.label),
        type,
      ).toEqual(tilesForSchoolType('SK').map((t) => t.label))
    }
    for (const type of ['MRSM', 'SBP']) expect(tilesForSchoolType(type), type).toHaveLength(5)
  })
})

describe('schoolPlace', () => {
  it('joins district and state, skipping a missing district', () => {
    expect(schoolPlace({ district: 'PPD SEGAMAT', state: 'Johor' })).toBe('PPD SEGAMAT, Johor')
    expect(schoolPlace({ district: null, state: 'Johor' })).toBe('Johor')
  })
})
