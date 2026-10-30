/**
 * Property suite (architecture 10, BJS-05): for each of the six launch blueprints (layer 1 plus a
 * synthetic layer 2) over synthetic pools of 300, 1,500 and 5,000 questions, 30 seeds each, zero papers
 * differ from the blueprint per the independent oracle `verifyComposition`.
 */
import { describe, expect, it } from 'vitest'

import { composeStandardPaper } from '../src/compose'
import type { QuestionFacts } from '../src/eligibility'
import { unitKeyOf, type StandardBlueprint } from '../src/standard-model'
import { shortageLine } from '../src/shortage'
import { verifyComposition } from '../src/verify'
import { launchBlueprints } from './support/launch'
import { syntheticPool } from './support/synthetic-pool'

const SIZES = [300, 1500, 5000]
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1)
const launch = launchBlueprints()

const idsOf = (r: { sections: { questionIds: readonly string[] }[] }) => r.sections.flatMap((s) => [...s.questionIds])

describe.each(launch.map((l) => [l.bp.code, l] as const))('property suite %s', (_code, l) => {
  describe.each(SIZES)('pool of %i', (size) => {
    const { facts, planted } = syntheticPool(l.bp, l.units, size, 1000 + size)

    it('the synthetic pool is feasible by construction (planted paper passes the oracle)', () => {
      const composed = l.bp.sections.map((s) => ({ position: s.position, questionIds: planted.get(s.position)! }))
      expect(verifyComposition(l.bp, composed, facts)).toEqual([])
    })

    it('30 seeds: 0 papers differ from the blueprint', () => {
      const papers = new Set<string>()
      const bad: string[] = []
      let worstNodes = 0
      for (const seed of SEEDS) {
        const r = composeStandardPaper(l.bp, facts, { seed })
        if (!r.ok) {
          bad.push(`seed ${seed}: ${r.reason} ${r.reason === 'shortage' ? r.shortages.map(shortageLine).join(' | ') : ''}`)
          continue
        }
        worstNodes = Math.max(worstNodes, r.nodes)
        const violations = verifyComposition(l.bp, r.sections, facts)
        if (violations.length > 0) bad.push(`seed ${seed}: ${JSON.stringify(violations.slice(0, 2))}`)
        const ids = idsOf(r)
        if (new Set(ids).size !== ids.length) bad.push(`seed ${seed}: duplicate`)
        papers.add(ids.join())
        // continuous numbering and sections in blueprint order
        expect(r.sections.map((s) => s.position)).toEqual(l.bp.sections.map((s) => s.position))
      }
      expect(bad).toEqual([])
      // different seeds give different papers when the pool is larger than the paper
      if (size >= 1500) expect(papers.size).toBeGreaterThan(20)
      expect(worstNodes).toBeLessThan(600_000)
    }, 120_000)

    it('the same seed gives the same paper', () => {
      const a = composeStandardPaper(l.bp, facts, { seed: 7 })
      const b = composeStandardPaper(l.bp, facts, { seed: 7 })
      expect(a).toEqual(b)
    })
  })
})

describe('property suite: soft preferences and statistics', () => {
  it('prefers unseen questions when an all-unseen paper exists', () => {
    for (const l of launch.slice(0, 4)) {
      const { facts, planted } = syntheticPool(l.bp, l.units, 1500, 77)
      // Every third question was served, but never one of the planted paper: an all-unseen paper exists.
      const keep = new Set([...planted.values()].flat())
      const seen = new Set(facts.filter((f, i) => i % 3 === 0 && !keep.has(f.id)).map((f) => f.id))
      const unseenOnly = facts.filter((f) => !seen.has(f.id))
      const possible = composeStandardPaper(l.bp, unseenOnly, { seed: 5 }).ok
      expect(possible).toBe(true)
      let clean = 0
      for (const seed of SEEDS.slice(0, 10)) {
        const r = composeStandardPaper(l.bp, facts, { seed, seen })
        expect(r.ok).toBe(true)
        if (r.ok && idsOf(r).every((id) => !seen.has(id))) clean++
      }
      expect(clean).toBeGreaterThanOrEqual(9)
    }
  })

  it('AC-36.6 rates over 30 papers for sections that qualify', () => {
    const l = launch.find((x) => x.bp.code === '1449/1')!
    const { facts } = syntheticPool(l.bp, l.units, 1500, 91)
    const byId = new Map(facts.map((f) => [f.id, f]))
    // 1449/1 is a ladder (excluded from the rule); use a free-order copy to measure the arrangement
    const free: StandardBlueprint = {
      ...l.bp,
      sections: l.bp.sections.map((s) => ({
        ...s,
        profile: s.profile ? { kind: 'bahagian' as const, groups: [{ from: 1, to: s.questionCount, tpMin: 2, tpMax: 5, marksMin: 1, marksMax: 1 }] } : null,
      })),
    }
    let chapter = 0
    let blocks = 0
    for (const seed of SEEDS) {
      const r = composeStandardPaper(free, facts, { seed })
      if (!r.ok) throw new Error(`seed ${seed} ${r.reason}`)
      const seq = r.sections[0]!.questionIds.map((id) => byId.get(id)!.unit).filter((u): u is NonNullable<typeof u> => u !== null)
      const rank = (u: { level: string; code: string }) => (u.level === 'T5' ? 1000 : 0) + Number.parseFloat(u.code)
      if (seq.every((u, i) => i === 0 || rank(u) >= rank(seq[i - 1]!))) chapter++
      const lastT4 = seq.map((u) => u.level).lastIndexOf('T4')
      const firstT5 = seq.map((u) => u.level).indexOf('T5')
      if (lastT4 < firstT5) blocks++
    }
    expect(chapter).toBeLessThanOrEqual(1)
    expect(blocks).toBeLessThanOrEqual(1)
  })
})

describe('oracle mutation test: a corrupted pick must be flagged', () => {
  const l = launch.find((x) => x.bp.code === '3472/2')!
  const { facts } = syntheticPool(l.bp, l.units, 1500, 5)
  const base = composeStandardPaper(l.bp, facts, { seed: 3 })
  if (!base.ok) throw new Error('baseline paper expected')
  const clone = (): { composed: { position: number; questionIds: string[] }[]; map: Map<string, QuestionFacts> } => ({
    composed: base.sections.map((s) => ({ position: s.position, questionIds: [...s.questionIds] })),
    map: new Map(facts.map((f) => [f.id, structuredClone(f)])),
  })
  const codes = (c: ReturnType<typeof clone>) => verifyComposition(l.bp, c.composed, c.map).map((v) => v.code)

  it('the untouched paper is clean', () => {
    const c = clone()
    expect(codes(c)).toEqual([])
  })

  it('duplicate, missing, unknown and extra questions', () => {
    let c = clone()
    c.composed[0]!.questionIds[1] = c.composed[0]!.questionIds[0]!
    expect(codes(c)).toContain('DUPLICATE')
    c = clone()
    c.composed[1]!.questionIds.pop()
    expect(codes(c)).toContain('COUNT')
    c = clone()
    c.composed[2]!.questionIds[0] = 'no-such-question'
    expect(codes(c)).toContain('UNKNOWN_QUESTION')
    c = clone()
    c.composed.pop()
    expect(codes(c)).toContain('SECTION_MISSING')
  })

  it('a pick with one more mark', () => {
    const c = clone()
    const f = c.map.get(c.composed[0]!.questionIds[0]!)!
    f.leaves[0]!.marks = (f.leaves[0]!.marks ?? 0) + 1
    expect(codes(c)).toContain('MARKS_TOTAL')
  })

  it('a pick with a TP outside the band', () => {
    const c = clone()
    const f = c.map.get(c.composed[0]!.questionIds[0]!)!
    f.leaves = f.leaves.map((x) => ({ ...x, tp: 1 }))
    expect(codes(c)).toContain('TP_BAND')
  })

  it('a pick whose KBAT marks change', () => {
    const c = clone()
    const f = c.map.get(c.composed[0]!.questionIds[0]!)!
    f.leaves = f.leaves.map((x) => ({ ...x, kbat: false }))
    expect(codes(c)).toContain('KBAT')
  })

  it('a pick moved to another unit', () => {
    const c = clone()
    const f = c.map.get(c.composed[0]!.questionIds[0]!)!
    const other = [...l.units.values()].find((u) => u.nodeId !== f.unit?.nodeId && f.leaves.every((x) => x.unit?.nodeId !== u.nodeId))!
    f.unit = other
    f.leaves = f.leaves.map((x) => ({ ...x, unit: other }))
    expect(codes(c)).toContain('QUOTA')
  })

  it('a stimulus group split by a swap', () => {
    const c = clone()
    const g1 = { ...structuredClone(c.map.get(c.composed[0]!.questionIds[0]!)!), id: 'gx-1', groupId: 'GX', groupPosition: 1, groupSize: 2 }
    const g2 = { ...structuredClone(c.map.get(c.composed[0]!.questionIds[1]!)!), id: 'gx-2', groupId: 'GX', groupPosition: 2, groupSize: 2 }
    c.map.set(g1.id, g1)
    c.map.set(g2.id, g2)
    c.composed[0]!.questionIds[0] = 'gx-1'
    c.composed[0]!.questionIds[1] = c.composed[0]!.questionIds[2]!
    c.composed[0]!.questionIds[2] = 'gx-2'
    expect(codes(c)).toContain('GROUP_BROKEN')
  })

  it('an ineligible pick (no answer key)', () => {
    const c = clone()
    const f = c.map.get(c.composed[0]!.questionIds[0]!)!
    f.leaves[0]!.hasKey = false
    expect(codes(c)).toContain('INELIGIBLE')
  })
})

describe('infeasible instances return the matching shortage kind and numbers', () => {
  const l = launch.find((x) => x.bp.code === '3472/2')!
  const { facts } = syntheticPool(l.bp, l.units, 1500, 11)
  const refuse = (bp: StandardBlueprint, pool: QuestionFacts[]) => {
    const r = composeStandardPaper(bp, pool, { seed: 1 })
    if (r.ok || r.reason !== 'shortage') throw new Error(`expected a shortage, got ${r.ok ? 'a paper' : r.reason}`)
    return r.shortages
  }

  it('remove one unit from the pool: kind unit, need = the line, have = 0', () => {
    const line = l.bp.sections[0]!.quota!.lines[0]!
    const key = unitKeyOf(line.unit)
    const without = facts.filter((f) => !(f.leaves.some((x) => (x.unit ? `unit:${x.unit.nodeId}` : '') === key) || (f.unit && `unit:${f.unit.nodeId}` === key)))
    const s = refuse(l.bp, without).find((x) => x.section === 'Bahagian A' && x.kind === 'unit')!
    expect(s).toMatchObject({ kind: 'unit', basis: 'marks', need: line.value, have: 0 })
    expect(s.unit).toMatchObject({ kind: 'unit' })
    expect(shortageLine(s)).toMatch(/^Bahagian A: perlu \d+ markah .+, hanya 0 tersedia$/)
  })

  it('a unit with one question fewer than a questions-basis line needs', () => {
    const q1 = launch.find((x) => x.bp.code === '1449/1')!
    const pool = syntheticPool(q1.bp, q1.units, 1500, 12).facts
    const line = q1.bp.sections[0]!.quota!.lines.find((x) => x.unit.kind === 'unit' && x.value >= 2)!
    const key = unitKeyOf(line.unit)
    const mine = pool.filter((f) => f.unit && `unit:${f.unit.nodeId}` === key)
    const drop = new Set(mine.slice(line.value - 1).map((f) => f.id))
    const s = refuse(q1.bp, pool.filter((f) => !drop.has(f.id))).find((x) => x.kind === 'unit')!
    expect(s).toMatchObject({ kind: 'unit', basis: 'questions', need: line.value, have: line.value - 1 })
  })

  it('no non-KBAT / KBAT question: kind kbat', () => {
    const nonKbat = facts.map((f) => ({ ...f, leaves: f.leaves.map((x) => ({ ...x, kbat: false })) }))
    const s = refuse(l.bp, nonKbat).find((x) => x.kind === 'kbat')!
    expect(s).toMatchObject({ kind: 'kbat', have: 0 })
    expect(shortageLine(s)).toMatch(/^Bahagian [ABC]: perlu \d+ markah KBAT, hanya 0 tersedia$/)
  })

  it('every question at TP1: kind tp, with the slot range and band', () => {
    const low = facts.map((f) => ({ ...f, leaves: f.leaves.map((x) => ({ ...x, tp: 1 })) }))
    const s = refuse(l.bp, low).find((x) => x.kind === 'tp')!
    expect(s).toMatchObject({ kind: 'tp', have: 0, slot: { from: 1 }, tp: { min: 3 } })
  })

  it('too few questions: kind count with the real numbers', () => {
    const few = facts.filter((_, i) => i < 5)
    const s = refuse(l.bp, few)[0]!
    expect(s.kind).toBe('count')
    expect(s.have).toBeLessThan(s.need)
  })
})
