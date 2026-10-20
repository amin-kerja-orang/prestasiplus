import { describe, expect, it } from 'vitest'

import {
  type Blueprint,
  composeFromBlueprint,
  effectiveMarks,
  type GroupDef,
  type PoolEntry,
  type PoolUnit,
  poolUnits,
} from '../../src/modules/bijak/papers/exam-core.adapter'

/**
 * Pins the behaviour of the local copy of the exam-core functions (blueprint composition, section
 * marks). When the adapter is switched to `@pp/exam-core` (BE-14) this file must stay green
 * unchanged: it is the contract between the two.
 */
const entries = (pool: string, ids: string[]): PoolEntry[] => ids.map((questionId) => ({ questionId, pool }))
const bp = (sections: Blueprint['sections']): Blueprint => ({ subject: 'MAT', kertas: 2, source: 'Spec', code: '1449/2', durationMin: 150, instructions: [], sections })

describe('poolUnits', () => {
  const groups = new Map<string, GroupDef>([['g', { id: 'g', questionIds: ['g1', 'g2'] }]])
  const groupOf = (q: string): string | undefined => (q.startsWith('g') ? 'g' : undefined)

  it('takes a stimulus group whole, once, in published order, and singles on their own', () => {
    const units = poolUnits('P', entries('P', ['a', 'g1', 'g2', 'b']), groups, groupOf)
    expect(units).toEqual([{ ids: ['a'] }, { ids: ['g1', 'g2'], groupId: 'g' }, { ids: ['b'] }])
  })

  it('skips a group with a member outside the pool, and entries of other pools', () => {
    const units = poolUnits('P', [...entries('P', ['a', 'g1']), ...entries('Q', ['g2', 'z'])], groups, groupOf)
    expect(units).toEqual([{ ids: ['a'] }])
  })
})

describe('composeFromBlueprint', () => {
  const singles = Array.from({ length: 20 }, (_, i) => `q${String(i + 1)}`)
  const units = (ids: string[]): PoolUnit[] => ids.map((id) => ({ ids: [id] }))

  it('the same seed gives the same paper, another seed another one', () => {
    const b = bp([{ label: 'A', rule: { type: 'all' }, pool: 'P', take: 5 }])
    const run = (seed: number) => composeFromBlueprint(b, new Map([['P', units(singles)]]), { seed })
    expect(run(7)).toEqual(run(7))
    expect(run(7)).not.toEqual(run(8))
  })

  it('never repeats a question across sections, even when two sections share a pool', () => {
    const b = bp([
      { label: 'A', rule: { type: 'all' }, pool: 'P', take: 8 },
      { label: 'B', rule: { type: 'all' }, pool: 'P', take: 8 },
    ])
    const out = composeFromBlueprint(b, new Map([['P', units(singles)]]), { seed: 1 })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const ids = out.sections.flatMap((s) => s.questionIds)
    expect(ids).toHaveLength(16)
    expect(new Set(ids).size).toBe(16)
  })

  it('prefers units the user has not seen, and falls back to seen ones when the pool is short', () => {
    const b = bp([{ label: 'A', rule: { type: 'all' }, pool: 'P', take: 5 }])
    const seen = new Set(singles.slice(0, 15))
    const out = composeFromBlueprint(b, new Map([['P', units(singles)]]), { seed: 3, seen })
    expect(out.ok && out.sections[0]?.questionIds.every((id) => !seen.has(id))).toBe(true)
    const more = composeFromBlueprint(bp([{ label: 'A', rule: { type: 'all' }, pool: 'P', take: 8 }]), new Map([['P', units(singles)]]), { seed: 3, seen })
    expect(more.ok && more.sections[0]?.questionIds.filter((id) => seen.has(id))).toHaveLength(3)
  })

  it('keeps a group together and reports a shortage when the sizes cannot add up to take', () => {
    const pool: PoolUnit[] = [{ ids: ['g1', 'g2', 'g3'], groupId: 'g' }, { ids: ['a'] }]
    const ok = composeFromBlueprint(bp([{ label: 'A', rule: { type: 'all' }, pool: 'P', take: 4 }]), new Map([['P', pool]]), { seed: 1 })
    expect(ok.ok && ok.sections[0]?.questionIds.slice().sort()).toEqual(['a', 'g1', 'g2', 'g3'])
    // 2 can be reached only by splitting the group: not allowed, so the best reachable total is 1.
    const short = composeFromBlueprint(bp([{ label: 'A', rule: { type: 'all' }, pool: 'P', take: 2 }]), new Map([['P', pool]]), { seed: 1 })
    expect(short).toEqual({ ok: false, shortages: [{ section: 'A', need: 2, have: 1 }] })
  })

  it('lists every short section, and an empty or unknown pool as have 0', () => {
    const b = bp([
      { label: 'A', rule: { type: 'all' }, pool: 'P', take: 3 },
      { label: 'B', rule: { type: 'all' }, pool: 'EMPTY', take: 4 },
      { label: 'C', rule: { type: 'all' }, pool: '', take: 1 },
    ])
    const out = composeFromBlueprint(b, new Map([['P', units(singles)]]), { seed: 1 })
    expect(out).toEqual({
      ok: false,
      shortages: [
        { section: 'B', need: 4, have: 0 },
        { section: 'C', need: 1, have: 0 },
      ],
    })
  })

  it('carries the authored instruction and the rule of the section', () => {
    const b = bp([{ label: 'C', instruction: 'Jawab 1 daripada 2 soalan.', rule: { type: 'choose', n: 1 }, pool: 'P', take: 2 }])
    const out = composeFromBlueprint(b, new Map([['P', units(singles)]]), { seed: 1 })
    expect(out.ok && out.sections[0]).toMatchObject({ label: 'C', instruction: 'Jawab 1 daripada 2 soalan.', rule: { type: 'choose', n: 1 } })
  })
})

describe('effectiveMarks', () => {
  it('adds everything for "all" and only the N largest for "choose N"', () => {
    expect(effectiveMarks({ type: 'all' }, [3, 4, 2])).toBe(9)
    expect(effectiveMarks({ type: 'choose', n: 1 }, [3, 6, 2])).toBe(6)
    expect(effectiveMarks({ type: 'choose', n: 2 }, [3, 6, 2])).toBe(9)
    expect(effectiveMarks({ type: 'choose', n: 5 }, [3, 6])).toBe(9)
    expect(effectiveMarks({ type: 'all' }, [])).toBe(0)
  })
})
