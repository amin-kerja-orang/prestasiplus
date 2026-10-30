/** Performance (architecture 10, NFR-13): 40 questions, 100 marks, 5,000 eligible questions, all constraints. */
import { describe, expect, it } from 'vitest'

import { composeStandardPaper } from '../src/compose'
import type { UnitFact } from '../src/eligibility'
import type { QuotaLine, StandardBlueprint, UnitKey } from '../src/standard-model'
import { unitKeyOf } from '../src/standard-model'
import { verifyComposition } from '../src/verify'
import { syntheticPool } from './support/synthetic-pool'

const units = new Map<UnitKey, UnitFact>()
const lines = (prefix: string, level: 'T4' | 'T5', values: number[]): QuotaLine[] =>
  values.map((value, i) => {
    const nodeId = `${prefix}${i}`
    const ref = { kind: 'unit' as const, nodeId }
    units.set(unitKeyOf(ref), { nodeId, level, code: `${i + 1}.0` })
    return { unit: ref, value }
  })

const bp: StandardBlueprint = {
  subject: 'PERF',
  kertas: 1,
  code: 'P/1',
  version: 1,
  durationMin: 150,
  sections: [
    {
      position: 1, label: 'Bahagian A', rule: { type: 'all' }, questionCount: 20, markBudget: 20, allowedModes: [],
      profile: { kind: 'ladder', groups: [1, 6, 11, 16].map((from, i) => ({ from, to: from + 4, tpMin: 1 + i, tpMax: 3 + i, marksMin: 1, marksMax: 1 })) },
      quota: { basis: 'questions', lines: lines('a', 'T4', [3, 3, 2, 3]).concat(lines('b', 'T5', [3, 3, 3])) },
      kbatMarks: 12,
    },
    {
      position: 2, label: 'Bahagian B', rule: { type: 'all' }, questionCount: 14, markBudget: 56, allowedModes: [],
      profile: { kind: 'bahagian', groups: [{ from: 1, to: 14, tpMin: 2, tpMax: 5, marksMin: 4, marksMax: 4 }] },
      quota: { basis: 'marks', lines: lines('c', 'T4', [8, 8, 8, 8]).concat(lines('d', 'T5', [8, 8, 8])) },
      kbatMarks: 40,
    },
    {
      position: 3, label: 'Bahagian C', rule: { type: 'choose', n: 2 }, questionCount: 3, markBudget: 24, allowedModes: [],
      profile: { kind: 'bahagian', groups: [{ from: 1, to: 3, tpMin: 4, tpMax: 6, marksMin: 12, marksMax: 12 }] },
      quota: { basis: 'marks', lines: lines('e', 'T4', [12, 12, 12]) },
      kbatMarks: 24,
    },
  ],
}

describe('perf: 40 questions, 100 marks, 5,000 eligible questions, all constraints', () => {
  const { facts } = syntheticPool(bp, units, 5000, 2024)

  it('p90 of the solver time is within 1.5 s and every paper passes the oracle', () => {
    const times: number[] = []
    for (let seed = 1; seed <= 20; seed++) {
      const t = performance.now()
      const r = composeStandardPaper(bp, facts, { seed })
      times.push(performance.now() - t)
      expect(r.ok).toBe(true)
      if (r.ok) expect(verifyComposition(bp, r.sections, facts)).toEqual([])
    }
    times.sort((a, b) => a - b)
    const p90 = times[Math.floor(times.length * 0.9) - 1]!
    expect(p90).toBeLessThanOrEqual(1500)
  })

  it('a node budget hit returns limit, never a wrong paper', () => {
    const r = composeStandardPaper(bp, facts, { seed: 1, budget: { section: 3, paper: 6 } })
    expect(r).toMatchObject({ ok: false, reason: 'limit' })
  })
})
