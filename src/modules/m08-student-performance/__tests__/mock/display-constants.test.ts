/** The M08 display constants (overview §6.6, DV-M08-32, BR-M08-28) listed in one place, and determinism of the seed. */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { DISPLAY_CONSTANTS, SCHOOL_ITEM_SUMMARIES } from '../../mock/constants/display'
import { itemStatistics, schoolSpmHistory, standings } from '../../mock'
import { MemoryStorage, bootM08 } from './boot'

beforeAll(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
})
afterAll(() => {
  vi.unstubAllGlobals()
})

describe('display constants', () => {
  it('lists every constant so reviewers see them together', () => {
    expect(DISPLAY_CONSTANTS.map((c) => c.id)).toEqual([
      'SCHOOL_ITEM_SUMMARIES',
      'OBSERVED_STANDINGS',
      'GENERATED_STANDINGS',
    ])
    expect(DISPLAY_CONSTANTS.every((c) => c.dv !== '' && c.why !== '')).toBe(true)
    // Only whole-school views of 8880 (all, T4), 8765 and 2710 carry an S9 constant.
    expect(
      SCHOOL_ITEM_SUMMARIES.map((r) => `${String(r.schoolId)}:${r.tingkatan ?? 'all'}`),
    ).toEqual(['8880:all', '8880:T4', '8765:all', '2710:all'])
  })
})

describe('determinism', () => {
  it('two boots seed identical M08 stores', async () => {
    const snap = () =>
      JSON.stringify([
        schoolSpmHistory.all(),
        itemStatistics.forScope('school', 8880),
        itemStatistics.forScope('school', 8880, 'T4'),
        standings.forPeriod('week'),
        standings.forPeriod('all').slice(0, 20),
      ])
    await bootM08()
    const first = snap()
    await bootM08()
    expect(snap()).toBe(first)
  }, 240_000)
})
