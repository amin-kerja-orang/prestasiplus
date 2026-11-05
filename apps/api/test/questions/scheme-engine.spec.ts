/**
 * S1-T09a part 3: best reachable marks and the scheme validator (pure, no database).
 * FR-QA-19 / AC-QA-19 / FR-ADM-QE3.3 (45 section 7 examples), AC-QA-48, AC-QA-49.
 */
import { describe, expect, it } from 'vitest'

import { bestReachable, checkKeysGate, SCHEME_PENALTY_CODE, validateScheme, type SchemeKeyLike } from '../../src/modules/questions/publish-gate'
import type { QuestionPart } from '@pp/contract'

const rich = (t: string) => ({ ms: t }) as never
const pt = (id: string, marks: number, extra: object = {}) => ({ id, code: 'M', label: id, marks, ...extra })
const pts = (n: number, prefix = 'p', marks = 1) => Array.from({ length: n }, (_, i) => pt(`${prefix}${String(i + 1)}`, marks))
const v2 = (marks: number, rest: object): SchemeKeyLike => ({ kind: 'points', scheme_v: 2, marks, ...rest }) as unknown as SchemeKeyLike
const leaf = (label: string, mode: string, marks: number, key: object, extra: object = {}) =>
  ({ label, prompt: rich('x'), mode, marks, key, ...extra }) as unknown as QuestionPart
const O = { path: 'parts.a.key' }

// 45 section 7 worked examples (v2 names; D1 fix for 7.3: one pair group of 8 points, cap 8, bonus 2).
const e71b = v2(3, { points: pts(4, 'f'), groups: [{ id: 'g1', anyN: 3, eachMarks: 1, pointIds: ['f1', 'f2', 'f3', 'f4'] }] })
const e71c = { kind: 'rubric', scheme_v: 2, marks: 5, scoring: 'overall', criteria: [{ id: 'k', name: 'Kandungan' }],
  bands: [{ name: 'Aras 1', range: [1, 2] }, { name: 'Aras 2', range: [3, 4] }, { name: 'Aras 3', range: [5, 5] }] } as unknown as SchemeKeyLike
const e72b = v2(2, { points: [pt('k1', 1, { code: 'K' }), pt('n1', 1, { code: 'N' })] })
const e73b = v2(3, { points: [pt('m1', 1), pt('m2', 1, { requires: ['m1'] }), pt('n1', 1, { requires: ['m2'], ecf: { fromPart: '(a)', rule: { op: 'same' } } })] })
const e73c = v2(10, { points: pts(8), groups: [{ id: 'p1', type: 'pair', cap: 8, pointIds: pts(8).map((p) => p.id) }], bonus: { ifAllCorrect: true, marks: 2, label: 'b' } })
// Second 7.3 (c) shape (team-dd ruling on #558, D1): four pair groups of 2 points (8 marks), no per-group cap, bonus 2 = 10.
const e73cFour = v2(10, {
  points: pts(8),
  groups: [0, 1, 2, 3].map((i) => ({ id: `p${String(i + 1)}`, type: 'pair', pointIds: [`p${String(2 * i + 1)}`, `p${String(2 * i + 2)}`] })),
  bonus: { ifAllCorrect: true, marks: 2, label: 'b' },
})
const e74 = { kind: 'rubric', scheme_v: 2, marks: 15, scoring: 'overall', criteria: [{ id: 'isi', name: 'Isi' }, { id: 'bahasa', name: 'Bahasa' }],
  bands: [{ name: 'P1', range: [1, 5] }, { name: 'P2', range: [6, 10] }, { name: 'P3', range: [11, 15] }], floorBand: { name: 'Sifar', range: [0, 0] } } as unknown as SchemeKeyLike
const e75 = { kind: 'rubric', scheme_v: 2, marks: 20, scoring: 'perCriterion',
  criteria: ['C', 'CA', 'O', 'L'].map((id) => ({ id, name: id, max: 5 })), bands: [{ name: '5', range: [5, 5] }] } as unknown as SchemeKeyLike
const e76b = v2(3, { points: [pt('k1', 1, { code: 'K' }), pt('n1', 1, { code: 'N' }), pt('p1', 1, { code: 'P' })] })
const e76c = v2(1, { points: [pt('n1', 1, { code: 'N' })] })

describe('FR-QA-19 / AC-QA-19 / FR-ADM-QE3.3: 45 section 7 worked examples', () => {
  it.each([
    ['7.1 (b) any 3 of 4 facts', e71b, 3],
    ['7.1 (c) bands 1-2, 3-4, 5', e71c, 5],
    ['7.2 (b) K1 + N1', e72b, 2],
    ['7.3 (b) requires chain + carried value', e73b, 3],
    ['7.3 (c) 8 pair points, cap 8, bonus 2', e73c, 10],
    ['7.3 (c) four pair groups of 2, no cap, bonus 2', e73cFour, 10],
    ['7.4 overall bands with floor band', e74, 15],
    ['7.5 perCriterion 4 x 5', e75, 20],
    ['7.6 (b) K N P', e76b, 3],
    ['7.6 (c) N', e76c, 1],
  ] as const)('%s reaches the documented max and has no scheme issue', (_n, key, max) => {
    expect(bestReachable(key)).toBe(max)
    expect(validateScheme(key, max, O)).toEqual([])
  })

  it('passes the gate as a whole question (7.3: (a) numeric, (b) depends on (a), (c) pairs + bonus)', () => {
    const parts = [
      leaf('(a)', 'numeric', 2, { kind: 'accepted', values: [{ v: 4.2 }] }),
      leaf('(b)', 'working', 3, e73b, { modeConfig: { dependsOnPart: '(a)' } }),
      leaf('(c)', 'essay', 10, e73c),
    ]
    expect(checkKeysGate(parts)).toEqual({})
  })
  it('7.1, 7.2 and 7.6 pass the gate; 7.4 and 7.5 too', () => {
    expect(checkKeysGate([leaf('(b)', 'essay', 3, e71b), leaf('(c)', 'essay', 5, e71c)])).toEqual({})
    expect(checkKeysGate([leaf('(b)', 'drawing', 2, e72b)])).toEqual({})
    expect(checkKeysGate([leaf('(b)', 'drawing', 3, e76b), leaf('(c)', 'drawing', 1, e76c, { modeConfig: { dependsOnPart: '(b)' } })])).toEqual({})
    expect(checkKeysGate([leaf('(a)', 'essay', 15, e74)])).toEqual({})
    expect(checkKeysGate([leaf('1', 'essay', 20, e75)])).toEqual({})
  })
  it('fails the gate with the 45 text when the scheme does not sum to the leaf marks', () => {
    expect(checkKeysGate([leaf('(a)', 'essay', 9, e73c)])).toEqual({ 'parts.(a).key': 'Jumlah skema (10) mesti sama dengan markah bahagian (9).' })
  })
})

describe('AC-QA-48 "Maks 4"', () => {
  it('credits a capped group at most 4', () => {
    const key = v2(4, { points: pts(6), groups: [{ id: 'g', cap: 4, pointIds: pts(6).map((p) => p.id) }] })
    expect(bestReachable(key)).toBe(4)
    expect(validateScheme(key, 4, O)).toEqual([])
  })
})

describe('AC-QA-49: deductions never raise (or lower) the maximum', () => {
  it('a deduction of 1 per error capped at 5 leaves the max unchanged; 7 errors deduct min(7, cap) = 5, never below 0', () => {
    const base = { points: [pt('a', 6), pt('b', 4)] }
    const withDed = v2(10, { ...base, deductions: [{ code: 'spelling', amount: 1, cap: 5, scope: 'part' }], zeroIf: [{ code: 'copy', label: 'x' }] })
    expect(bestReachable(withDed)).toBe(bestReachable(v2(10, base)))
    expect(bestReachable(withDed)).toBe(10)
    const cap = withDed.deductions![0]!.cap!
    expect(Math.max(0, 10 - Math.min(7 * withDed.deductions![0]!.amount, cap))).toBe(5)
    expect(Math.max(0, 3 - Math.min(7, cap))).toBe(0)
    expect(validateScheme(withDed, 10, O)).toEqual([])
  })
})

describe('validateScheme issues', () => {
  it('SCHEME_SUM mismatch (key marks, then points)', () => {
    const k = v2(3, { points: pts(3) })
    expect(validateScheme(k, 4, O)).toEqual([{ code: 'SCHEME_SUM', message: 'Jumlah skema (3) mesti sama dengan markah bahagian (4).', path: 'parts.a.key.marks' }])
    const short = v2(3, { points: pts(2) })
    expect(validateScheme(short, 3, O).map((i) => i.code)).toEqual(['SCHEME_SUM'])
  })
  it('example leaves are exempt from the sum check', () => {
    expect(validateScheme(v2(3, { points: pts(2) }), 0, { ...O, example: true })).toEqual([])
  })
  it('BAND_RANGE gap above 0', () => {
    const k = { kind: 'rubric', scheme_v: 2, marks: 5, scoring: 'overall', criteria: [{ id: 'k', name: 'k' }],
      bands: [{ name: 'a', range: [1, 2] }, { name: 'b', range: [4, 5] }] } as unknown as SchemeKeyLike
    expect(validateScheme(k, 5, O)).toEqual([{ code: 'BAND_RANGE', message: 'Julat band tidak meliputi 0 hingga 5.', path: 'parts.a.key' }])
  })
  it('SCHEME_PENALTY (deductions above the leaf marks)', () => {
    const k = v2(2, { points: pts(2), deductions: [{ code: 'spelling', amount: 1, cap: 2, scope: 'part' }, { code: 'unit', amount: 1, scope: 'part' }] })
    expect(validateScheme(k, 2, O)).toEqual([{ code: SCHEME_PENALTY_CODE, message: 'Jumlah penalti melebihi markah bahagian.', path: 'parts.a.key.deductions' }])
  })
  it('SCHEME_DEPENDS: requires missing, requires cycle, dependsOnPart missing or later, ecf part missing', () => {
    const missing = v2(2, { points: [pt('a', 1), pt('b', 1, { requires: ['zz'] })] })
    expect(validateScheme(missing, 2, O).filter((i) => i.code === 'SCHEME_DEPENDS').map((i) => i.message)).toEqual(['Mata b bergantung pada mata yang tiada.'])
    const cycle = v2(2, { points: [pt('a', 1, { requires: ['b'] }), pt('b', 1, { requires: ['a'] })] })
    expect(validateScheme(cycle, 2, O).filter((i) => i.code === 'SCHEME_DEPENDS')).toHaveLength(2)
    const ok = v2(1, { points: [pt('a', 1)] })
    const labels = ['(a)', '(b)', '(c)']
    expect(validateScheme(ok, 1, { ...O, ownLabel: '(b)', partLabels: labels, dependsOnPart: '(a)' })).toEqual([])
    expect(validateScheme(ok, 1, { ...O, ownLabel: '(b)', partLabels: labels, dependsOnPart: '(c)' })[0]).toMatchObject({ code: 'SCHEME_DEPENDS', message: 'SCHEME_DEPENDS' })
    expect(validateScheme(ok, 1, { ...O, ownLabel: '(b)', partLabels: labels, dependsOnPart: '(z)' })[0]?.code).toBe('SCHEME_DEPENDS')
    const ecf = v2(1, { points: [pt('a', 1, { ecf: { fromPart: '(z)', rule: { op: 'same' } } })] })
    expect(validateScheme(ecf, 1, { ...O, partLabels: labels })[0]?.code).toBe('SCHEME_DEPENDS')
  })
  it('NO_SCHEME for a missing key', () => {
    expect(validateScheme(null, 3, O)).toEqual([{ code: 'NO_SCHEME', message: '⚠ tiada skema', path: 'parts.a.key' }])
  })
})

describe('bestReachable decisions the PRD leaves open', () => {
  it('takes the best single alternative, never the sum', () => {
    const k = v2(3, { points: pts(5), alternatives: [{ id: 'A', name: 'A', pointIds: ['p1', 'p2'] }, { id: 'B', name: 'B', pointIds: ['p3', 'p4', 'p5'] }] })
    expect(bestReachable(k)).toBe(3)
  })
  it('a point whose requires is unreachable adds nothing', () => {
    expect(bestReachable(v2(1, { points: [pt('a', 1), pt('b', 1, { requires: ['zz'] })] }))).toBe(1)
  })
  it('anyN over pairs counts pairs; eachMarks replaces member marks', () => {
    const k = v2(4, { points: pts(8), groups: [{ id: 'g', type: 'pair', anyN: 2, pointIds: pts(8).map((p) => p.id) }] })
    expect(bestReachable(k)).toBe(4)
    expect(bestReachable(v2(6, { points: pts(4), groups: [{ id: 'g', anyN: 2, eachMarks: 3, pointIds: pts(4).map((p) => p.id) }] }))).toBe(6)
  })
  it('countMarks replaces the sum by its highest value', () => {
    expect(bestReachable(v2(2, { points: pts(3), countMarks: { items: 3, marks: [2, 1, 0] } }))).toBe(2)
  })
  it('rubric contentPoints add nothing', () => {
    const k = { ...e74, contentPoints: { points: pts(4) } } as unknown as SchemeKeyLike
    expect(bestReachable(k)).toBe(15)
  })
})

describe('v1 keys are unchanged', () => {
  const v1 = (marks: number, key: object) => leaf('a', 'working', marks, { kind: 'points', marks, ...key })
  it('pointsTotal semantics: free points + anyN x eachMarks; paths are not evaluated', () => {
    const k = { kind: 'points', marks: 4, points: [1, 2, 3].map((n) => ({ id: `p${String(n)}`, code: 'K', label: 'k', marks: 2 })), groups: [{ id: 'g', anyN: 2, eachMarks: 2, pointIds: ['p1', 'p2', 'p3'] }] }
    expect(bestReachable(k)).toBe(4)
    expect(bestReachable({ kind: 'points', points: [pt('a', 1)], paths: [{ id: 'x', pointIds: ['a'] }] })).toBeNull()
  })
  it('keeps the old message and field for a v1 mismatch', () => {
    const msg = 'Jumlah markah tidak sepadan dengan skema.'
    expect(checkKeysGate([v1(3, { points: [pt('a', 2)] })])).toEqual({ 'parts.a.key': msg })
    expect(checkKeysGate([v1(3, { points: [pt('a', 3)] })])).toEqual({})
    expect(checkKeysGate([leaf('a', 'essay', 3, { kind: 'rubric', marks: 2, criteria: [], bands: [] })])).toEqual({ 'parts.a.key': msg })
  })
})
