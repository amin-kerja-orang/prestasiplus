/**
 * The id tie-breaks of the S5 read model with the ids the real API sends: strings (`packages/contract`
 * `IdSchema`). The mock itself holds numbers, so the ids are put in by hand: the ALESA list sort gets
 * string-id predictions, and `resultsOf` gets a school population whose ids are strings. The order must stay
 * numeric ("9" < "10" < "100"), never lexicographic ("10" < "100" < "9").
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Scope } from '../../mock/repository'
import { alesaOf } from '../../mock/repository/models/alesa'
import type { PredictionRow } from '../../mock/repository/models/predictions'
import { resultsOf } from '../../mock/repository/models/results'
import { resolveScope } from '../../mock/repository'
import { bootM12, shutdownM12 } from './helpers'

/** When set, `statsOf` answers a school population with these ids (strings, in a deliberately unsorted order). */
const injected = vi.hoisted(() => ({ schoolIds: null as string[] | null }))

vi.mock('../../mock/repository/models/shared', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../mock/repository/models/shared')>()
  return {
    ...real,
    statsOf: (scope: Scope) => {
      const stats = real.statsOf(scope)
      if (injected.schoolIds === null) return stats
      const template = stats.pop.schools[0]!
      const schools = injected.schoolIds.map((id) => ({ ...template, schoolId: id }))
      return { ...stats, pop: { ...stats.pop, schools } }
    },
  }
})

beforeAll(async () => {
  await bootM12()
}, 600_000)

afterAll(() => {
  injected.schoolIds = null
  shutdownM12()
})

/** A prediction row as the contract would carry it: string ids. */
const prediction = (userId: string, tenths: number): PredictionRow =>
  ({
    userId,
    name: `Pelajar ${userId}`,
    schoolId: '8080',
    schoolName: 'SMK Demo B',
    answers: 100,
    correct: tenths / 10,
    tenths,
    grade: 'A+',
  }) as unknown as PredictionRow

describe('ALESA list sort with string user ids (S5)', () => {
  const scope: Scope = {
    schoolId: null,
    state: null,
    schoolIds: [1, 2],
    ka: null as never,
  }

  it('breaks a grade tie by the numeric user id, not the string order', () => {
    const list = alesaOf(scope, [
      prediction('100', 950),
      prediction('9', 950),
      prediction('10', 950),
      prediction('2', 950),
    ])
    expect(list.rows.map((r) => r.userId)).toEqual(['2', '9', '10', '100'])
  })
})

describe('S5 school table sort with string school ids', () => {
  it('breaks an equal-score tie by the numeric school id, not the string order', () => {
    injected.schoolIds = ['100', '9', '10', '2']
    try {
      const rows = resultsOf(resolveScope()).schools
      expect(rows.map((r) => r.schoolId)).toEqual(['2', '9', '10', '100'])
    } finally {
      injected.schoolIds = null
    }
  })
})
