/**
 * S1 subject GPS table (AC-M08-07.1, discovery §A.2): 16 computed rows plus the two observed empty rows as
 * D11 display constants (DV-M08-38), platform scope only, dropped when the subject has a computed row.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { curriculum } from '@/modules/m03-curriculum/mock'

import type { SchoolPerformance } from '../../api/types'
import { headcountReads, registerHeadcountReads } from '../../mock/repository/headcount-port'
import { S1_OBSERVED_EMPTY_SUBJECTS } from '../../mock/repository/performance'
import { ADMIN, ADMIN_SEKOLAH, MemoryStorage, bootM08, dataAs } from './boot'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM08()).runtime
}, 180_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('S1 subject GPS rows', () => {
  it('lists 18 rows: 16 by GPS, then Pendidikan Seni Visual and Sains Sukan with "—" and 0', async () => {
    const s1 = await dataAs<SchoolPerformance>(runtime, ADMIN, '/api/performance/school')
    expect(S1_OBSERVED_EMPTY_SUBJECTS).toEqual(['Pendidikan Seni Visual', 'Sains Sukan'])
    expect(s1.subjects).toHaveLength(18)
    expect(s1.subjects[0]?.name).toBe('Tasawwur Islam')
    expect(s1.subjects[15]?.name).toBe('Perniagaan')
    const computed = s1.subjects.slice(0, 16).map((r) => r.gps as number)
    expect(computed).toEqual([...computed].sort((a, b) => a - b))
    expect(s1.subjects.slice(16)).toEqual([
      expect.objectContaining({
        name: 'Pendidikan Seni Visual',
        gps: null,
        grade: null,
        entries: 0,
        onTrack: 0,
        below: 0,
        noTarget: 0,
        achievementPct: null,
      }),
      expect.objectContaining({ name: 'Sains Sukan', gps: null, grade: null, entries: 0 }),
    ])
  })

  it('the school scope has no constant rows', async () => {
    const s1 = await dataAs<SchoolPerformance>(runtime, ADMIN_SEKOLAH, '/api/performance/school')
    expect(s1.subjects.map((r) => r.name)).not.toContain('Sains Sukan')
  })

  it('guard: a subject with a computed row is never duplicated by the constant', async () => {
    const psv = curriculum.subjects().find((x) => x.name === 'Pendidikan Seni Visual')
    expect(psv).toBeDefined()
    const real = headcountReads.entries()
    const first = real[0]
    if (!first || !psv) throw new Error('no headcount entry or subject')
    registerHeadcountReads({
      entries: () => [
        ...real,
        { ...first, configId: 99_999, subjectId: psv.id, tov: 50, targets: [60], actuals: [61] },
      ],
    })
    try {
      const s1 = await dataAs<SchoolPerformance>(runtime, ADMIN, '/api/performance/school')
      const names = s1.subjects.map((r) => r.name)
      expect(new Set(names).size).toBe(names.length)
      const row = s1.subjects.find((r) => r.name === 'Pendidikan Seni Visual')
      expect(row?.entries).toBe(1)
      expect(row?.gps).not.toBeNull()
      expect(names.at(-1)).toBe('Sains Sukan')
      expect(s1.subjects).toHaveLength(18)
    } finally {
      registerHeadcountReads({ entries: () => real })
    }
  }, 120_000)
})
