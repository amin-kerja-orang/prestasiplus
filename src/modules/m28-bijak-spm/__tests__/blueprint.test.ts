import { describe, expect, it } from 'vitest'

import { BANK, BLUEPRINTS, PAPERS } from '../data/registry'
import { composeFromBlueprint, poolUnits, shortageLine, type PoolUnit } from '../domain/blueprint'

function unitsFor(blueprintIndex: number): Map<string, PoolUnit[]> {
  const bp = BLUEPRINTS[blueprintIndex]!
  const m = new Map<string, PoolUnit[]>()
  for (const s of bp.sections)
    m.set(s.pool, poolUnits(s.pool, BANK.pool, BANK.groups, (q) => BANK.questions.get(q)?.groupId))
  return m
}

const k1 = BLUEPRINTS.findIndex((b) => b.subject === 'MAT' && b.kertas === 1)
const k2 = BLUEPRINTS.findIndex((b) => b.subject === 'MAT' && b.kertas === 2)
const sn1 = BLUEPRINTS.findIndex((b) => b.subject === 'SN' && b.kertas === 1)

describe('seed integrity', () => {
  it('Matematik K1 curated paper has 10 questions and one stimulus group of 4', () => {
    for (const id of ['mat-k1-2025-a']) {
      const p = PAPERS.find((x) => x.id === id)!
      const ids = p.sections.flatMap((s) => s.questionIds)
      expect(ids).toHaveLength(10)
      expect(new Set(ids).size).toBe(10)
      const grouped = ids.filter((q) => BANK.questions.get(q)!.groupId)
      expect(grouped).toHaveLength(4)
      // contiguous and in published order
      const first = ids.indexOf(grouped[0]!)
      expect(ids.slice(first, first + 4)).toEqual(BANK.groups.get(BANK.questions.get(grouped[0]!)!.groupId!)!.questionIds)
    }
  })
  it('every answerable part of every paper question has a scheme', () => {
    for (const q of BANK.questions.values()) {
      if (q.mcq) expect(BANK.schemes.has(q.id), q.id).toBe(true)
      else {
        const walk = (parts: NonNullable<typeof q.parts>): void => {
          for (const p of parts) {
            if (p.children) walk(p.children)
            else expect(BANK.schemes.has(p.id), p.id).toBe(true)
          }
        }
        walk(q.parts ?? [])
      }
    }
  })
})

describe('composeFromBlueprint', () => {
  it('fills the K1 blueprint with 10 distinct questions and keeps every group whole and ordered', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = composeFromBlueprint(BLUEPRINTS[k1]!, unitsFor(k1), { seed })
      if (!r.ok) throw new Error('expected a paper')
      const ids = r.sections.flatMap((s) => s.questionIds)
      expect(ids).toHaveLength(10)
      expect(new Set(ids).size).toBe(10)
      for (const g of BANK.groups.values()) {
        const at = ids.indexOf(g.questionIds[0]!)
        if (at < 0) {
          expect(g.questionIds.some((q) => ids.includes(q))).toBe(false)
        } else {
          expect(ids.slice(at, at + g.questionIds.length)).toEqual(g.questionIds)
        }
      }
    }
  })
  it('produces different papers for different seeds when the pool is larger', () => {
    const a = composeFromBlueprint(BLUEPRINTS[k1]!, unitsFor(k1), { seed: 1 })
    const b = composeFromBlueprint(BLUEPRINTS[k1]!, unitsFor(k1), { seed: 2 })
    expect(a.ok && b.ok && JSON.stringify(a) !== JSON.stringify(b)).toBe(true)
  })
  it('keeps the section structure of K2 (Bahagian A, 3 questions, groups whole)', () => {
    const r = composeFromBlueprint(BLUEPRINTS[k2]!, unitsFor(k2), { seed: 5 })
    if (!r.ok) throw new Error('expected a paper')
    expect(r.sections.map((s) => [s.label, s.rule.type, s.questionIds.length])).toEqual([['Bahagian A', 'all', 3]])
    const a = r.sections[0]!.questionIds
    // a group in section A is complete
    for (const g of BANK.groups.values()) {
      const inA = g.questionIds.filter((q) => a.includes(q))
      expect([0, g.questionIds.length]).toContain(inA.length)
    }
  })
  it('prefers questions the student has not seen', () => {
    const seen = new Set(
      [...BANK.pool.filter((e) => e.pool === 'MAT1-A')].slice(0, 20).map((e) => e.questionId),
    )
    const r = composeFromBlueprint(BLUEPRINTS[k1]!, unitsFor(k1), { seed: 3, seen })
    if (!r.ok) throw new Error('expected a paper')
    const ids = r.sections.flatMap((s) => s.questionIds)
    expect(ids.filter((q) => seen.has(q)).length).toBeLessThanOrEqual(2)
  })
  it('rejects with a shortage list instead of under-filling', () => {
    const r = composeFromBlueprint(BLUEPRINTS[sn1]!, unitsFor(sn1), { seed: 1 })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.shortages).toEqual([{ section: 'Bahagian A', need: 40, have: 0 }])
    expect(shortageLine(r.shortages[0]!)).toBe('Bahagian A: perlu 40 soalan, hanya 0 tersedia')
  })
  it('reports a shortage when groups cannot add up to the count exactly', () => {
    const units = new Map<string, PoolUnit[]>([['P', [{ ids: ['a', 'b'], groupId: 'g' }, { ids: ['c', 'd'], groupId: 'h' }]]])
    const bp = { ...BLUEPRINTS[k1]!, sections: [{ label: 'X', rule: { type: 'all' as const }, pool: 'P', take: 3 }] }
    const r = composeFromBlueprint(bp, units, { seed: 1 })
    expect(r).toEqual({ ok: false, shortages: [{ section: 'X', need: 3, have: 2 }] })
  })
})
