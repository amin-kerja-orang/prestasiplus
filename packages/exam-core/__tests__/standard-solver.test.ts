import { describe, expect, it } from 'vitest'

import { orderOk } from '../src/arrange'
import { mulberry32 } from '../src/blueprint'
import { composeStandardPaper, previewStandard } from '../src/compose'
import { shortageLine } from '../src/shortage'
import { makePoolContext } from '../src/pool'
import { precheckSection } from '../src/precheck'
import type { QuestionFacts } from '../src/eligibility'
import type { QuotaLine, StandardBlueprint, StandardSection } from '../src/standard-model'
import { verifyComposition } from '../src/verify'
import { blueprint, facts, leaf, q, section, unit } from './support/builders'

const u = (nodeId: string) => ({ kind: 'unit' as const, nodeId })
const line = (nodeId: string, value: number): QuotaLine => ({ unit: u(nodeId), value })

/** n questions per (unit, tp) combination, ids prefixed. */
function grid(prefix: string, units: string[], tps: number[], marks: number, n: number, kbat = 0): QuestionFacts[] {
  const out: QuestionFacts[] = []
  for (const un of units) for (const tp of tps) for (let i = 0; i < n; i++) out.push(q(`${prefix}-${un}-${tp}-${i}`, un, tp, marks, kbat))
  return out
}

const compose = (bp: StandardBlueprint, pool: QuestionFacts[], seed = 1, extra = {}) => composeStandardPaper(bp, pool, { seed, ...extra })

function expectOk(r: ReturnType<typeof compose>) {
  if (!r.ok) throw new Error(`expected a paper, got ${JSON.stringify(r).slice(0, 400)}`)
  return r
}

describe('precheck', () => {
  const sec = section({
    questionCount: 4,
    markBudget: 16,
    profile: {
      kind: 'ladder',
      groups: [
        { from: 1, to: 2, tpMin: 1, tpMax: 2 },
        { from: 3, to: 4, tpMin: 3, tpMax: 4, tpCounts: [{ tp: 3, count: 1 }, { tp: 4, count: 1 }] },
      ],
    },
    quota: { basis: 'questions', lines: [line('1', 2), line('2', 2)] },
    kbatMarks: 8,
  })

  it('reports needed / available per line over the eligible pool', () => {
    const pool = [...grid('a', ['1', '2'], [1, 2, 3, 4], 4, 1, 0), ...grid('k', ['1', '2'], [1, 2, 3, 4], 4, 1, 4)]
    const p = precheckSection(makePoolContext(pool), sec)
    expect(p.eligible).toBe(16)
    expect(p.counts).toEqual({ needed: 4, available: 16, short: 0 })
    expect(p.quota.map((x) => [x.needed, x.available])).toEqual([[2, 8], [2, 8]])
    expect(p.tp.map((x) => [x.needed, x.available, x.tp ?? 0])).toEqual([[2, 8, 0], [2, 8, 0], [1, 4, 3], [1, 4, 4]])
    expect(p.kbat).toEqual({ needed: 8, available: 8, short: 0 })
    expect(p.marks).toMatchObject({ needed: 16, reachable: true })
    expect(p.failures).toEqual([])
  })

  it('first failure follows the fixed order: count, unit, tp, kbat, marks', () => {
    const only1 = grid('a', ['1'], [1, 2, 3, 4], 4, 1, 4)
    const p = precheckSection(makePoolContext(only1), sec)
    // unit 2 has no eligible question, and the pool only has 4 eligible questions of unit 1
    expect(p.failures[0]).toMatchObject({ kind: 'unit', need: 2, have: 0 })
    const tight = precheckSection(makePoolContext(grid('a', ['1', '2'], [1], 4, 1, 4)), sec)
    expect(tight.failures[0]).toMatchObject({ kind: 'count', need: 4, have: 2 })
  })

  it('tp: a group with no eligible question in its band, and the exact TP count', () => {
    const noHigh = grid('a', ['1', '2'], [1, 2], 4, 2, 4)
    const p = precheckSection(makePoolContext(noHigh), sec)
    const f = p.failures.find((x) => x.kind === 'tp')!
    expect(f).toMatchObject({ slot: { from: 3, to: 4 }, tp: { min: 3, max: 4 }, need: 2, have: 0 })
    expect(shortageLine(f)).toBe('Bahagian A soalan 3-4: tiada soalan layak pada TP 3-4')
  })

  it('tp: cross-group feasibility through the flow (each group alone is satisfiable)', () => {
    const s2 = section({
      questionCount: 2,
      markBudget: 8,
      profile: { kind: 'ladder', groups: [{ from: 1, to: 1, tpMin: 1, tpMax: 2 }, { from: 2, to: 2, tpMin: 2, tpMax: 3 }] },
    })
    const p = precheckSection(makePoolContext([q('x', '1', 2, 4)]), s2)
    // one eligible question is in both bands, but there is only one of it: count fails first
    expect(p.failures[0]).toMatchObject({ kind: 'count' })
    const p2 = precheckSection(makePoolContext([q('x', '1', 2, 4), q('y', '1', 2, 4)]), s2)
    expect(p2.failures).toEqual([])
    const s3 = { ...s2, profile: { kind: 'ladder' as const, groups: [{ from: 1, to: 1, tpMin: 1, tpMax: 2 }, { from: 2, to: 2, tpMin: 1, tpMax: 2 }] } }
    const p3 = precheckSection(makePoolContext([q('x', '1', 2, 4), q('y', '1', 3, 4)]), s3)
    expect(p3.failures[0]).toMatchObject({ kind: 'tp', slot: { from: 2, to: 2 } })
  })

  it('marks: not reachable, and a marks band that excludes the available questions (AC-34.9)', () => {
    const odd = precheckSection(makePoolContext([q('x', '1', 2, 5), q('y', '1', 2, 5)]), section({ questionCount: 2, markBudget: 8 }))
    expect(odd.failures[0]).toMatchObject({ kind: 'marks', need: 8, have: 5 + 0 > 0 ? 0 : 0 })
    const banded = section({
      questionCount: 2,
      markBudget: 8,
      profile: { kind: 'bahagian', groups: [{ from: 1, to: 2, tpMin: 1, tpMax: 6, marksMin: 3, marksMax: 3 }] },
    })
    const p = precheckSection(makePoolContext([q('x', '1', 2, 4), q('y', '1', 2, 4)]), banded)
    expect(p.failures[0]).toMatchObject({ kind: 'marks', slot: { from: 1, to: 2 }, marksBand: { min: 3, max: 3 } })
    expect(shortageLine(p.failures[0]!)).toBe('Bahagian A soalan 1-2: tiada soalan layak dengan 3 markah')
  })

  it('kbat: above the maximum, below the minimum (combination) and not exactly reachable', () => {
    const pool = [q('x', '1', 2, 4, 4), q('y', '1', 2, 4, 0), q('z', '1', 2, 4, 4)]
    const mk = (k: number) => precheckSection(makePoolContext(pool), section({ questionCount: 2, markBudget: 8, kbatMarks: k })).failures[0]
    expect(mk(8)).toBeUndefined()
    expect(mk(4)).toBeUndefined()
    expect(mk(0)).toMatchObject({ kind: 'combination', blocking: 'kbat' })
    const high = precheckSection(makePoolContext([q('x', '1', 2, 4, 4), q('y', '1', 2, 4, 0)]), section({ questionCount: 2, markBudget: 8, kbatMarks: 8 }))
    expect(high.failures[0]).toMatchObject({ kind: 'kbat', need: 8, have: 4 })
    const low = precheckSection(makePoolContext([q('x', '1', 2, 4, 4), q('y', '1', 2, 4, 4)]), section({ questionCount: 2, markBudget: 8, kbatMarks: 0 }))
    expect(low.failures[0]).toMatchObject({ kind: 'combination', blocking: 'kbat' })
    const odd = precheckSection(makePoolContext([q('x', '1', 2, 4, 4), q('y', '1', 2, 4, 0), q('z', '1', 2, 4, 0)]), section({ questionCount: 2, markBudget: 8, kbatMarks: 2 }))
    expect(odd.failures[0]).toMatchObject({ kind: 'kbat', need: 2, have: 0 })
  })

  it('marks-basis unit line: reachable marks by subset sum', () => {
    const s = section({ questionCount: 2, markBudget: 12, quota: { basis: 'marks', lines: [line('1', 7), line('2', 5)] } })
    const ok = precheckSection(makePoolContext([q('a', '1', 2, 7), q('b', '2', 2, 5)]), s)
    expect(ok.failures).toEqual([])
    const bad = precheckSection(makePoolContext([q('a', '1', 2, 4), q('a2', '1', 2, 4), q('b', '2', 2, 5)]), s)
    expect(bad.failures[0]).toMatchObject({ kind: 'unit', basis: 'marks', need: 7, have: 4 })
  })

  it('counts the questions excluded by answer mode', () => {
    const s = section({ allowedModes: ['mcq'] })
    const pool = [q('a', '1', 2, 4), q('b', '1', 2, 4)]
    const p = precheckSection(makePoolContext(pool), s)
    expect(p).toMatchObject({ eligible: 0, modeExcluded: 2 })
  })
})

describe('orderOk (AC-36.6, O-4)', () => {
  const U = (level: 'T4' | 'T5', code: string) => ({ level, code })
  it('small sections always pass', () => {
    expect(orderOk([U('T4', '1.0'), U('T4', '2.0')])).toBe(true)
    expect(orderOk([U('T4', '1.0'), U('T5', '1.0')])).toBe(true)
  })
  it('chapter order fails with 4 or more distinct units', () => {
    expect(orderOk([U('T4', '1.0'), U('T4', '2.0'), U('T4', '3.0'), U('T4', '4.0')])).toBe(false)
    expect(orderOk([U('T4', '2.0'), U('T4', '1.0'), U('T4', '3.0'), U('T4', '4.0')])).toBe(true)
  })
  it('all T4 before all T5 fails with 2 of each', () => {
    expect(orderOk([U('T4', '2.0'), U('T4', '1.0'), U('T5', '1.0'), U('T5', '2.0')])).toBe(false)
    expect(orderOk([U('T4', '2.0'), U('T5', '1.0'), U('T4', '1.0'), U('T5', '2.0')])).toBe(true)
  })
  it('the T1-T3 bucket is left out', () => {
    expect(orderOk([null, U('T4', '1.0'), null])).toBe(true)
  })
})

describe('composeStandardPaper', () => {
  it('fills a quota and verifies, deterministic for a seed, different between seeds', () => {
    const bp = blueprint([
      section({ questionCount: 6, markBudget: 24, quota: { basis: 'questions', lines: [line('1', 2), line('2', 2), line('3', 2)] } }),
    ])
    const pool = grid('p', ['1', '2', '3', '4'], [2, 3], 4, 4)
    const a = expectOk(compose(bp, pool, 11))
    const b = expectOk(compose(bp, pool, 11))
    expect(a.sections).toEqual(b.sections)
    expect(verifyComposition(bp, a.sections, pool)).toEqual([])
    const seeds = new Set([1, 2, 3, 4, 5].map((s) => expectOk(compose(bp, pool, s)).sections[0]!.questionIds.join()))
    expect(seeds.size).toBeGreaterThan(1)
    expect(a.report).toMatchObject({ blueprintVersion: 1, seed: 11, solverVersion: 'std-1' })
  })

  it('ladder with exact TP counts places every question inside its band', () => {
    const bp = blueprint([
      section({
        questionCount: 6,
        markBudget: 24,
        profile: {
          kind: 'ladder',
          groups: [
            { from: 1, to: 3, tpMin: 1, tpMax: 3, tpCounts: [{ tp: 1, count: 1 }, { tp: 2, count: 2 }] },
            { from: 4, to: 6, tpMin: 3, tpMax: 5, tpCounts: [{ tp: 4, count: 2 }, { tp: 5, count: 1 }] },
          ],
        },
        kbatMarks: 12,
      }),
    ])
    const pool = [...grid('p', ['1', '2'], [1, 2, 3, 4, 5], 4, 3, 0), ...grid('k', ['1', '2'], [1, 2, 3, 4, 5], 4, 3, 4)]
    for (let seed = 1; seed <= 10; seed++) {
      const r = expectOk(compose(bp, pool, seed))
      expect(verifyComposition(bp, r.sections, pool)).toEqual([])
      expect(r.report.sections[0]!.kbatMarks).toBe(12)
    }
  })

  it('marks-basis quota with a multi-unit question (3.1a)', () => {
    const multi = (id: string, a: string, b: string) =>
      facts(id, { unit: unit(a), leaves: [leaf({ marks: 12, tp: 4 }), leaf({ marks: 8, tp: 4, unit: unit(b, 'T5') })] })
    const bp = blueprint([
      section({
        label: 'Bahagian B',
        rule: { type: 'choose', n: 1 },
        questionCount: 2,
        markBudget: 20,
        quota: { basis: 'marks', lines: [line('12', 20), line('14', 20)] },
      }),
    ])
    const pool = [facts('s12', { unit: unit('12', 'T5'), leaves: [leaf({ marks: 20, tp: 4 })] }), facts('s14', { unit: unit('14', 'T5'), leaves: [leaf({ marks: 20, tp: 4 })] }), multi('m', '12', '14')]
    const r = expectOk(compose(bp, pool))
    expect(verifyComposition(bp, r.sections, pool)).toEqual([])
    const bp2 = blueprint([
      section({ rule: { type: 'choose', n: 1 }, questionCount: 2, markBudget: 20, quota: { basis: 'marks', lines: [line('12', 12 + 20), line('14', 8)] } }),
    ])
    const r2 = expectOk(compose(bp2, [multi('m', '12', '14'), facts('s12', { unit: unit('12', 'T5'), leaves: [leaf({ marks: 20, tp: 4 })] })]))
    expect([...r2.sections[0]!.questionIds].sort()).toEqual(['m', 's12'])
  })

  it('choose-N: every question has budget / N marks', () => {
    const bp = blueprint([section({ rule: { type: 'choose', n: 2 }, questionCount: 4, markBudget: 12 })])
    const pool = [...grid('a', ['1'], [2], 6, 5), ...grid('b', ['1'], [2], 5, 5), ...grid('c', ['1'], [2], 7, 5)]
    const r = expectOk(compose(bp, pool))
    expect(r.sections[0]!.questionIds.every((id) => id.startsWith('a-'))).toBe(true)
    expect(verifyComposition(bp, r.sections, pool)).toEqual([])
    expect(r.report.sections[0]).toMatchObject({ effectiveMarks: 12, offeredMarks: 24 })
  })

  it('stimulus groups are taken whole, adjacent and in published order', () => {
    const bp = blueprint([section({ questionCount: 4, markBudget: 16 })])
    const g = (gid: string, n: number) =>
      Array.from({ length: n }, (_, i) => q(`${gid}${i + 1}`, '1', 2, 4, 0, { groupId: gid, groupPosition: i + 1 }))
    const onlyGroups = [...g('G1', 2), ...g('G2', 2), ...g('G3', 2)]
    for (let seed = 1; seed <= 8; seed++) {
      const r = expectOk(compose(bp, onlyGroups, seed))
      expect(verifyComposition(bp, r.sections, onlyGroups)).toEqual([])
    }
    const mixed = [...g('G1', 3), ...grid('s', ['1'], [2], 4, 6)]
    const used = new Set<boolean>()
    for (let seed = 1; seed <= 20; seed++) {
      const r = expectOk(compose(bp, mixed, seed))
      expect(verifyComposition(bp, r.sections, mixed)).toEqual([])
      used.add(r.sections[0]!.questionIds.includes('G11'))
    }
    expect(used.has(true)).toBe(true) // the soft preference sometimes uses the group
  })

  it('a group is never split across a refusal: a group with an ineligible member is skipped', () => {
    const bp = blueprint([section({ questionCount: 2, markBudget: 8 })])
    const bad = q('G2', '1', 2, 4, 0, { groupId: 'G', groupPosition: 2 })
    bad.leaves = [leaf({ marks: 4, hasKey: false })]
    const pool = [q('G1', '1', 2, 4, 0, { groupId: 'G', groupPosition: 1 }), bad, q('s1', '1', 2, 4), q('s2', '1', 2, 4)]
    const r = expectOk(compose(bp, pool))
    expect([...r.sections[0]!.questionIds].sort()).toEqual(['s1', 's2'])
  })

  it('prefers unseen questions when enough exist (AC-03.5)', () => {
    const bp = blueprint([section({ questionCount: 4, markBudget: 16, quota: { basis: 'questions', lines: [line('1', 2), line('2', 2)] } })])
    const pool = grid('p', ['1', '2'], [2, 3], 4, 4)
    const seen = new Set(pool.filter((x) => x.id.endsWith('-0') || x.id.endsWith('-1')).map((x) => x.id))
    for (let seed = 1; seed <= 12; seed++) {
      const r = expectOk(compose(bp, pool, seed, { seen }))
      expect(r.sections[0]!.questionIds.filter((id) => seen.has(id))).toEqual([])
    }
    const allSeen = new Set(pool.map((x) => x.id))
    expectOk(compose(bp, pool, 3, { seen: allSeen }))
  })

  it('refuses with the typed shortage and real numbers (count, unit, tp, kbat, marks)', () => {
    const bp = blueprint([section({ questionCount: 4, markBudget: 16, quota: { basis: 'questions', lines: [line('1', 3), line('2', 1)] } })])
    const r = compose(bp, [q('a', '1', 2, 4), q('b', '1', 2, 4), q('c', '2', 2, 4), q('d', '2', 2, 4)])
    expect(r).toMatchObject({ ok: false, reason: 'shortage' })
    if (r.ok || r.reason !== 'shortage') throw new Error('x')
    expect(r.shortages[0]).toMatchObject({ section: 'Bahagian A', kind: 'unit', need: 3, have: 2 })
    expect(shortageLine(r.shortages[0]!)).toBe('Bahagian A: perlu 3 soalan unit 1, hanya 2 tersedia')
  })

  it('a combination refusal names the blocking constraint family (probe)', () => {
    // marks 8 and KBAT 5: marks 8 needs (p,q) or (r,q); KBAT 5 needs (p,r). Each alone is fine.
    const bp = blueprint([section({ questionCount: 2, markBudget: 8, kbatMarks: 5 })])
    const pool = [q('p', '1', 2, 5, 0), q('q', '1', 2, 3, 3), q('r', '1', 2, 5, 5)]
    const r = compose(bp, pool)
    if (r.ok || r.reason !== 'shortage') throw new Error(JSON.stringify(r))
    expect(r.shortages[0]).toMatchObject({ kind: 'combination', section: 'Bahagian A', blocking: 'kbat' })
    expect(shortageLine(r.shortages[0]!)).toBe('Bahagian A: syarat KBAT tidak dapat dipenuhi bersama syarat lain')
  })

  it('cross-section depletion is reported as overlap and names the other section', () => {
    const a = section({ position: 1, label: 'Bahagian A', questionCount: 2, markBudget: 8, quota: { basis: 'questions', lines: [line('1', 2)] } })
    const b = section({ position: 2, label: 'Bahagian B', questionCount: 2, markBudget: 8, quota: { basis: 'questions', lines: [line('1', 2)] } })
    const bp = blueprint([a, b])
    const r = compose(bp, [q('x', '1', 2, 4), q('y', '1', 2, 4), q('z', '1', 2, 4)])
    if (r.ok || r.reason !== 'shortage') throw new Error(JSON.stringify(r))
    expect(r.shortages[0]).toMatchObject({ kind: 'overlap', section: 'Bahagian B', otherSection: 'Bahagian A' })
    expect(shortageLine(r.shortages[0]!)).toBe('Bahagian B: soalan yang diperlukan telah digunakan oleh Bahagian A')
  })

  it('sections share one used set: no question twice in a paper', () => {
    const bp = blueprint([
      section({ position: 1, questionCount: 3, markBudget: 12 }),
      section({ position: 2, label: 'Bahagian B', questionCount: 3, markBudget: 12 }),
    ])
    const pool = grid('p', ['1', '2', '3'], [2, 3], 4, 1)
    for (let seed = 1; seed <= 10; seed++) {
      const r = expectOk(compose(bp, pool, seed))
      const ids = r.sections.flatMap((s) => [...s.questionIds])
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('a node budget that is too small returns limit, never a wrong paper', () => {
    const bp = blueprint([section({ questionCount: 6, markBudget: 24, quota: { basis: 'questions', lines: [line('1', 2), line('2', 2), line('3', 2)] } })])
    const pool = grid('p', ['1', '2', '3'], [2, 3, 4], 4, 3)
    const r = compose(bp, pool, 1, { budget: { section: 2, paper: 4 } })
    expect(r).toMatchObject({ ok: false, reason: 'limit' })
  })

  it('the wall-clock cap turns into limit without changing a produced paper', () => {
    const bp = blueprint([section({ questionCount: 6, markBudget: 24 })])
    const pool = grid('p', ['1', '2', '3'], [2, 3, 4], 4, 3)
    const fast = expectOk(compose(bp, pool, 5))
    let t = 0
    const slow = compose(bp, pool, 5, { clock: () => (t += 10_000) })
    expect(slow).toMatchObject({ ok: false, reason: 'limit' })
    const same = expectOk(compose(bp, pool, 5, { clock: () => 0 }))
    expect(same.sections).toEqual(fast.sections)
  })
})

describe('review fixes (BJS-04)', () => {
  it('never truncates the stimulus start slots: a pair that must sit in slots 1-2 is found (r3)', () => {
    const groups = Array.from({ length: 10 }, (_, i) =>
      i < 2 ? { from: i + 1, to: i + 1, tpMin: 1, tpMax: 6, marksMin: 4, marksMax: 4 } : { from: i + 1, to: i + 1, tpMin: 1, tpMax: 6, marksMin: 1, marksMax: 4 },
    )
    const bp = blueprint([section({ questionCount: 10, markBudget: 16, profile: { kind: 'bahagian', groups } })])
    for (let k = 0; k < 40; k++) {
      const pool = [
        q('G1', '1', 2, 4, 0, { groupId: 'G', groupPosition: 1, groupSize: 2 }),
        q('G2', '1', 2, 4, 0, { groupId: 'G', groupPosition: 2, groupSize: 2 }),
        ...Array.from({ length: 12 }, (_, i) => q(`b${i}`, '1', 1 + (i % (1 + (k % 6))), 1)),
      ]
      expect(previewStandard(bp, pool).verdict).toBe('boleh')
    }
  })

  it('a group declared larger than the members present is incomplete: skipped by the pool, broken for the oracle (r1)', () => {
    const bp = blueprint([section({ questionCount: 2, markBudget: 8 })])
    const g1 = q('G1', '1', 2, 4, 0, { groupId: 'G', groupPosition: 1, groupSize: 3 })
    const pool = [g1, q('s1', '1', 2, 4), q('s2', '1', 2, 4)]
    const r = composeStandardPaper(bp, pool, { seed: 1 })
    if (!r.ok) throw new Error('expected a paper')
    expect([...r.sections[0]!.questionIds].sort()).toEqual(['s1', 's2'])
    const codes = verifyComposition(bp, [{ position: 1, questionIds: ['G1', 's1'] }], pool).map((v) => v.code)
    expect(codes).toContain('GROUP_BROKEN')
    const only = composeStandardPaper(bp, [g1, q('s1', '1', 2, 4)], { seed: 1 })
    expect(only).toMatchObject({ ok: false, reason: 'shortage' })
  })

  it('marks band copy: only a minimum, only a maximum', () => {
    const base = { section: 'Bahagian A', kind: 'marks' as const, need: 1, have: 0, slot: { from: 1, to: 2 } }
    expect(shortageLine({ ...base, marksBand: { min: 3 } })).toBe('Bahagian A soalan 1-2: tiada soalan layak dengan sekurang-kurangnya 3 markah')
    expect(shortageLine({ ...base, marksBand: { max: 4 } })).toBe('Bahagian A soalan 1-2: tiada soalan layak dengan tidak lebih 4 markah')
    const only = section({ questionCount: 2, markBudget: 8, profile: { kind: 'bahagian', groups: [{ from: 1, to: 2, tpMin: 1, tpMax: 6, marksMin: 5 }] } })
    const f = precheckSection(makePoolContext([q('x', '1', 2, 4), q('y', '1', 2, 4)]), only).failures[0]!
    expect(f.marksBand).toEqual({ min: 5 })
  })

  it('tiny exact-marks-band instances with stimulus pairs: no false refusal, at least 80% decided (r5)', () => {
    let boleh = 0
    let total = 0
    for (let it = 0; it < 30; it++) {
      const r = mulberry32(it + 1000)
      const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1))
      const M = ri(8, 14)
      const groups: { from: number; to: number; tpMin: number; tpMax: number; marksMin: number; marksMax: number }[] = []
      for (let from = 1; from <= M; ) {
        const to = Math.min(M, from + ri(0, 2))
        const lo = ri(1, 4)
        groups.push({ from, to, tpMin: 1, tpMax: 6, marksMin: lo, marksMax: ri(lo, 5) })
        from = to + 1
      }
      const slotMarks: number[] = []
      for (const g of groups) for (let s = g.from; s <= g.to; s++) slotMarks.push(ri(g.marksMin, g.marksMax))
      const pool: QuestionFacts[] = []
      const ids: string[] = Array<string>(M).fill('')
      const place = (gid: string) => {
        for (let t = 0; t < 30; t++) {
          const s = ri(0, M - 2)
          if (!ids[s] && !ids[s + 1]) {
            ids[s] = `${gid}1`
            ids[s + 1] = `${gid}2`
            pool.push(q(`${gid}1`, '1', 2, slotMarks[s]!, 0, { groupId: gid, groupPosition: 1, groupSize: 2 }), q(`${gid}2`, '1', 2, slotMarks[s + 1]!, 0, { groupId: gid, groupPosition: 2, groupSize: 2 }))
            return
          }
        }
      }
      place('GA')
      place('GB')
      for (let s = 0; s < M; s++) if (!ids[s]) {
        ids[s] = `s${s}`
        pool.push(q(`s${s}`, '1', 2, slotMarks[s]!))
      }
      for (let i = 0; i < 6; i++) pool.push(q(`n${i}`, '1', 2, ri(1, 5)))
      const bp = blueprint([section({ questionCount: M, markBudget: slotMarks.reduce((a, b) => a + b, 0), profile: { kind: 'bahagian', groups } })])
      if (verifyComposition(bp, [{ position: 1, questionIds: ids }], pool).length) continue
      const verdict = previewStandard(bp, pool).verdict
      // Never a false proof of infeasibility; a rare hard instance may hit the section cap (`tidak_pasti`).
      expect(verdict).not.toBe('tidak_boleh')
      if (verdict === 'boleh') boleh++
      total++
    }
    expect(boleh).toBeGreaterThanOrEqual(Math.floor(total * 0.8))
  })

  it('TEMA_UNIT is flagged by the oracle', () => {
    const bp = blueprint([
      section({
        questionCount: 2,
        markBudget: 8,
        profile: { kind: 'tema', groups: [{ from: 1, to: 1, tpMin: 1, tpMax: 6, units: [{ kind: 'unit', nodeId: '1' }] }, { from: 2, to: 2, tpMin: 1, tpMax: 6, units: [{ kind: 'unit', nodeId: '2' }] }] },
      }),
    ])
    const pool = [q('a', '1', 2, 4), q('b', '2', 2, 4)]
    expect(verifyComposition(bp, [{ position: 1, questionIds: ['a', 'b'] }], pool)).toEqual([])
    expect(verifyComposition(bp, [{ position: 1, questionIds: ['b', 'a'] }], pool).map((v) => v.code)).toContain('TEMA_UNIT')
    const r = composeStandardPaper(bp, pool, { seed: 1 })
    if (!r.ok) throw new Error('expected a paper')
    expect(r.sections[0]!.questionIds).toEqual(['a', 'b'])
  })
})

describe('previewStandard', () => {
  it('boleh implies a generation that succeeds, with the same pool', () => {
    const bp = blueprint([section({ questionCount: 4, markBudget: 16, quota: { basis: 'questions', lines: [line('1', 2), line('2', 2)] }, kbatMarks: 16 })])
    const pool = grid('p', ['1', '2'], [2, 3], 4, 3, 4)
    const pv = previewStandard(bp, pool)
    expect(pv.verdict).toBe('boleh')
    expect(pv.firstFailure).toBeNull()
    expectOk(compose(bp, pool, 9))
    expect(pv.sections[0]!.quota.map((x) => x.available)).toEqual([6, 6])
  })

  it('tidak_boleh carries the first failure and the excluded breakdown', () => {
    const bp = blueprint([section({ questionCount: 4, markBudget: 16 })])
    const bad = facts('bad', { unit: null })
    const pv = previewStandard(bp, [q('a', '1', 2, 4), bad])
    expect(pv.verdict).toBe('tidak_boleh')
    expect(pv.firstFailure).toMatchObject({ kind: 'count', need: 4, have: 1 })
    expect(pv.excluded.total).toBe(1)
  })

  it('reports the KBAT_TP_BAND warning', () => {
    const bp = blueprint([section({ questionCount: 2, markBudget: 8, kbatMarks: 4, profile: { kind: 'bahagian', groups: [{ from: 1, to: 2, tpMin: 1, tpMax: 2 }] } })])
    expect(previewStandard(bp, [q('a', '1', 2, 4, 4), q('b', '1', 1, 4, 0)]).warnings).toEqual([{ code: 'KBAT_TP_BAND', warning: true, sectionPosition: 1 }])
  })
})

// type-level guard so unused helper imports stay used
export type _Unused = StandardSection
