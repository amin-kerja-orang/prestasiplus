import { describe, expect, it } from 'vitest'

import type { KedudukanScopeCard } from '../../api/types'
import { SCOPE_META, nearbyCard, rankSub, rankText } from '../../lib/ranking'

const card = (over: Partial<KedudukanScopeCard>): KedudukanScopeCard => ({
  scope: 'sekolah',
  rank: 1,
  total: 1,
  percentile: 100,
  nearby: [],
  ...over,
})

describe('Kedudukan helpers (R1-MUR-18)', () => {
  it('card titles', () => {
    expect(Object.values(SCOPE_META).map((m) => m.label)).toEqual([
      'Dalam kelas',
      'Dalam sekolah',
      'Dalam negeri',
      'Kebangsaan',
    ])
  })

  it('rank texts: grouped digits; without a rank no value and "Belum tersedia"', () => {
    expect(rankText(card({ rank: 2141 }))).toBe('#2,141')
    expect(rankText(card({ rank: null }))).toBeNull()
    expect(rankSub(card({ total: 864, percentile: 47 }))).toBe('/ 864 · Kumpulan 47% teratas')
    expect(rankSub(card({ total: null, percentile: null }))).toBe('Belum tersedia')
  })

  it('"Sekitar anda" follows the class, else the school, else the nation; negeri never', () => {
    const k = card({ scope: 'kelas' })
    const s = card({ scope: 'sekolah' })
    const n = card({ scope: 'negeri' })
    const b = card({ scope: 'kebangsaan' })
    expect(nearbyCard([s, n, b, k])?.scope).toBe('kelas')
    expect(nearbyCard([s, n, b])?.scope).toBe('sekolah')
    expect(nearbyCard([n, b])?.scope).toBe('kebangsaan')
    expect(nearbyCard([card({ scope: 'negeri', rank: null })])).toBeNull()
    expect(nearbyCard([])).toBeNull()
  })
})
