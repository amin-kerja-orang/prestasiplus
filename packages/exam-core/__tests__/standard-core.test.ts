import { describe, expect, it } from 'vitest'

import { describeQuestion, eligibilityOf, excludedReport } from '../src/eligibility'
import { checkEvidence, type EvidenceItem } from '../src/evidence'
import { shortageLine } from '../src/shortage'
import {
  canonicalStructure,
  offeredMarks,
  perQuestionMarks,
  unitKeyOf,
  unitRefOf,
} from '../src/standard-model'
import { validateBlueprint, validateForVerification } from '../src/validate'
import { buildStandardReport, measureSection, verifyComposition } from '../src/verify'
import { blueprint, facts, leaf, section, unit } from './support/builders'

describe('standard model', () => {
  it('offeredMarks: all gives the budget, choose N gives budget / N * M', () => {
    expect(offeredMarks({ rule: { type: 'all' }, markBudget: 40, questionCount: 10 })).toBe(40)
    expect(offeredMarks({ rule: { type: 'choose', n: 1 }, markBudget: 15, questionCount: 2 })).toBe(30)
    expect(offeredMarks({ rule: { type: 'choose', n: 3 }, markBudget: 60, questionCount: 5 })).toBe(100)
    expect(perQuestionMarks({ rule: { type: 'choose', n: 3 }, markBudget: 60 })).toBe(20)
    expect(perQuestionMarks({ rule: { type: 'all' }, markBudget: 60 })).toBeNull()
  })

  it('unit keys round-trip', () => {
    expect(unitRefOf(unitKeyOf({ kind: 'unit', nodeId: '12' }))).toEqual({ kind: 'unit', nodeId: '12' })
    expect(unitRefOf(unitKeyOf({ kind: 't1_t3' }))).toEqual({ kind: 't1_t3' })
  })

  it('canonicalStructure string is pinned for one sample (the 0092 SQL backfill is a different legacy form)', () => {
    const bp = blueprint([section({ allowedModes: ['working', 'mcq'] })], { durationMin: 90 })
    expect(canonicalStructure(bp)).toBe(
      '{"code":"1449/2","durationMin":90,"kbatMarks":null,"kertas":2,"levelShare":null,"sections":[{"allowedModes":["mcq","working"],"compulsory":false,"kbatMarks":null,"markBudget":8,"pool":null,"position":1,"profile":null,"questionCount":2,"quota":null,"rule":{"type":"all"}}],"subPartRamp":false,"subject":"MAT","totalMarks":8}',
    )
  })

  it('canonicalStructure ignores cosmetic content and key order, and reviewed flags', () => {
    const a = blueprint([
      section({ label: 'A', quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: '1' }, value: 2, reviewed: false }] } }),
    ])
    const b = blueprint([
      section({ label: 'Bahagian A (lain)', quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: '1' }, value: 2, reviewed: true }] } }),
    ])
    const c = blueprint([section({ markBudget: 9 })])
    expect(canonicalStructure(a)).toBe(canonicalStructure(b))
    expect(canonicalStructure(a)).not.toBe(canonicalStructure(c))
  })
})

describe('describeQuestion', () => {
  it('tp is the max leaf TP, KBAT marks the sum of KBAT leaves, marks the sum of leaves', () => {
    const d = describeQuestion(
      facts('1', {
        leaves: [
          leaf({ marks: 2, tp: 2, kbat: false }),
          leaf({ marks: 3, tp: 5, kbat: true }),
          leaf({ marks: 4, tp: 4, kbat: true }),
        ],
      }),
    )
    expect(d.marks).toBe(9)
    expect(d.tp).toBe(5)
    expect(d.kbatMarks).toBe(7)
    expect(d.reasons).toEqual([])
    expect(d.bucket).toBe('unit:1')
    expect(d.unitMarks).toEqual({ 'unit:1': 9 })
  })

  it('leaf units override the question unit (3.1a): marks per effective unit, primary bucket unchanged', () => {
    const d = describeQuestion(
      facts('7', {
        unit: unit('12', 'T5'),
        leaves: [leaf({ marks: 12 }), leaf({ marks: 8, unit: unit('14', 'T5') })],
      }),
    )
    expect(d.bucket).toBe('unit:12')
    expect(d.unitMarks).toEqual({ 'unit:12': 12, 'unit:14': 8 })
  })

  it('a T1-T3 leaf without a unit counts under the bucket', () => {
    const d = describeQuestion(
      facts('8', { unit: unit('3'), leaves: [leaf({ marks: 4 }), leaf({ marks: 3, unit: null, formOrigin: 't1_t3' })] }),
    )
    expect(d.unitMarks).toEqual({ 't1_t3': 3, 'unit:3': 4 })
    expect(d.reasons).toEqual([])
  })

  it('lists missing facts in the fixed order', () => {
    const d = describeQuestion(
      facts('9', {
        unit: null,
        tagReview: true,
        formOrigin: 't4',
        leaves: [leaf({ tp: null, marks: 0, hasKey: false })],
      }),
    )
    expect(d.reasons).toEqual(['no_unit', 'no_tp', 'no_marks', 'no_key', 'tag_review'])
  })

  it('a leaf with no effective unit is no_unit even when the question has one', () => {
    const d = describeQuestion(facts('10', { leaves: [leaf(), leaf({ unit: null })] }))
    expect(d.reasons).toEqual(['no_unit'])
  })

  it('a question with no leaves has no marks', () => {
    expect(describeQuestion(facts('11', { leaves: [] })).reasons).toContain('no_marks')
  })
})

describe('eligibilityOf', () => {
  const quota = (basis: 'questions' | 'marks') => ({
    basis,
    lines: [{ unit: { kind: 'unit' as const, nodeId: '1' }, value: 2 }, { unit: { kind: 'unit' as const, nodeId: '2' }, value: 0 }],
  })

  it('a question awaiting tag review is never eligible', () => {
    expect(eligibilityOf(facts('1', { tagReview: true }), section()).reasons).toEqual(['tag_review'])
  })

  it('accepts a well-tagged question in a section without extra rules', () => {
    expect(eligibilityOf(facts('1'), section()).eligible).toBe(true)
  })

  it('refuses a mode outside allowed_modes, a pool mismatch and a unit without a line', () => {
    const r = eligibilityOf(facts('1', { unit: unit('9') }), section({ allowedModes: ['mcq'], pool: 'x', quota: quota('questions') }))
    expect(r.reasons).toEqual(['mode_not_allowed', 'pool_mismatch', 'unit_not_in_quota'])
  })

  it('a unit with value 0 has no line (AC-36.2)', () => {
    expect(eligibilityOf(facts('1', { unit: unit('2') }), section({ quota: quota('questions') })).reasons).toEqual(['unit_not_in_quota'])
  })

  it('marks basis checks every leaf unit; questions basis only the primary unit', () => {
    const f = facts('1', { leaves: [leaf(), leaf({ unit: unit('9') })] })
    expect(eligibilityOf(f, section({ quota: quota('marks') })).reasons).toEqual(['unit_not_in_quota'])
    expect(eligibilityOf(f, section({ quota: quota('questions') })).eligible).toBe(true)
  })

  it('T1-T3 content needs a bucket line above 0 (AC-36.5)', () => {
    const t = facts('1', { unit: null, formOrigin: 't1_t3', leaves: [leaf({ unit: null })] })
    expect(eligibilityOf(t, section({ quota: quota('questions') })).reasons).toEqual(['unit_not_in_quota'])
    const withBucket = { basis: 'questions' as const, lines: [{ unit: { kind: 't1_t3' as const }, value: 1 }] }
    expect(eligibilityOf(t, section({ quota: withBucket })).eligible).toBe(true)
  })

  it('excludedReport counts unique questions, per reason with overlap and per first reason', () => {
    const r = excludedReport([
      facts('1'),
      facts('2', { unit: null }),
      facts('3', { leaves: [leaf({ tp: null, hasKey: false })] }),
      facts('4', { unit: null, leaves: [leaf({ tp: null })] }),
    ])
    expect(r.total).toBe(3)
    expect(r.byReason.find((x) => x.reason === 'no_tp')?.count).toBe(2)
    expect(r.byFirstReason.reduce((n, x) => n + x.count, 0)).toBe(3)
    expect(r.byFirstReason.find((x) => x.reason === 'no_unit')?.count).toBe(2)
  })
})

describe('validateBlueprint', () => {
  const codes = (bp: ReturnType<typeof blueprint>, opts = {}) => validateBlueprint(bp, opts).problems.map((p) => p.code)
  const units = new Map<string, 'T4' | 'T5'>([['1', 'T4'], ['2', 'T5']])
  const tiled = (kind: 'ladder' | 'bahagian' | 'tema' = 'bahagian') => ({
    kind,
    groups: [{ from: 1, to: 2, tpMin: 2, tpMax: 4 }],
  })

  it('a consistent blueprint has no problem', () => {
    const bp = blueprint([section({ profile: tiled(), kbatMarks: 4, quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: '1' }, value: 1 }, { unit: { kind: 'unit', nodeId: '2' }, value: 1 }] } })])
    expect(validateBlueprint(bp, { unitLevels: units })).toEqual({ problems: [], warnings: [] })
  })

  it('TOTAL_MISMATCH', () => {
    expect(codes(blueprint([section()], { totalMarks: 9 }))).toEqual(['TOTAL_MISMATCH'])
  })

  it('CHOOSE_N_RANGE: N above the count, or a budget N does not divide', () => {
    expect(codes(blueprint([section({ rule: { type: 'choose', n: 3 } })]))).toContain('CHOOSE_N_RANGE')
    expect(codes(blueprint([section({ rule: { type: 'choose', n: 3 }, questionCount: 4, markBudget: 10 })]))).toContain('CHOOSE_N_RANGE')
  })

  it('SLOT_OVERLAP and SLOT_GAP', () => {
    const overlap = section({ questionCount: 4, markBudget: 4, profile: { kind: 'ladder', groups: [{ from: 1, to: 3, tpMin: 1, tpMax: 2 }, { from: 3, to: 4, tpMin: 2, tpMax: 3 }] } })
    expect(codes(blueprint([overlap]))).toContain('SLOT_OVERLAP')
    const gap = section({ questionCount: 4, markBudget: 4, profile: { kind: 'ladder', groups: [{ from: 1, to: 2, tpMin: 1, tpMax: 2 }, { from: 4, to: 4, tpMin: 2, tpMax: 3 }] } })
    expect(codes(blueprint([gap]))).toContain('SLOT_GAP')
    const short = section({ questionCount: 4, markBudget: 4, profile: { kind: 'ladder', groups: [{ from: 1, to: 3, tpMin: 1, tpMax: 2 }] } })
    expect(codes(blueprint([short]))).toContain('SLOT_GAP')
  })

  it('PROFILE_SHAPE: ladder must not decrease, bahagian and choose-N have one group, tema needs units', () => {
    const down = section({ questionCount: 4, markBudget: 4, profile: { kind: 'ladder', groups: [{ from: 1, to: 2, tpMin: 3, tpMax: 4 }, { from: 3, to: 4, tpMin: 1, tpMax: 2 }] } })
    expect(codes(blueprint([down]))).toEqual(['PROFILE_SHAPE'])
    const two = section({ questionCount: 4, markBudget: 4, profile: { kind: 'bahagian', groups: [{ from: 1, to: 2, tpMin: 1, tpMax: 2 }, { from: 3, to: 4, tpMin: 1, tpMax: 2 }] } })
    expect(codes(blueprint([two]))).toEqual(['PROFILE_SHAPE'])
    const choose = section({ rule: { type: 'choose', n: 1 }, questionCount: 2, markBudget: 4, profile: { kind: 'ladder', groups: [{ from: 1, to: 1, tpMin: 1, tpMax: 2 }, { from: 2, to: 2, tpMin: 1, tpMax: 2 }] } })
    expect(codes(blueprint([choose]))).toContain('PROFILE_SHAPE')
    expect(codes(blueprint([section({ profile: tiled('tema') })]))).toEqual(['PROFILE_SHAPE'])
  })

  it('TP_COUNTS: sum, duplicates and a TP outside the band', () => {
    const bad = (tpCounts: { tp: number; count: number }[]) =>
      codes(blueprint([section({ profile: { kind: 'bahagian', groups: [{ from: 1, to: 2, tpMin: 2, tpMax: 4, tpCounts }] } })]))
    expect(bad([{ tp: 3, count: 1 }])).toEqual(['TP_COUNTS'])
    expect(bad([{ tp: 3, count: 1 }, { tp: 3, count: 1 }])).toEqual(['TP_COUNTS'])
    expect(bad([{ tp: 6, count: 2 }])).toEqual(['TP_COUNTS'])
    expect(bad([{ tp: 3, count: 1 }, { tp: 4, count: 1 }])).toEqual([])
  })

  it('MARKS_BAND: bands that cannot reach the section marks', () => {
    const band = (marksMin: number, marksMax: number, over: Partial<ReturnType<typeof section>> = {}) =>
      codes(blueprint([section({ profile: { kind: 'bahagian', groups: [{ from: 1, to: 2, tpMin: 1, tpMax: 2, marksMin, marksMax }] }, ...over })]))
    expect(band(5, 6)).toEqual(['MARKS_BAND'])
    expect(band(1, 3)).toEqual(['MARKS_BAND'])
    expect(band(3, 5)).toEqual([])
    expect(band(6, 5)).toContain('MARKS_BAND')
    expect(band(3, 3, { rule: { type: 'choose', n: 1 }, markBudget: 8, questionCount: 2 })).toContain('MARKS_BAND')
  })

  it('QUOTA_SUM: sum, negative value and duplicate unit', () => {
    const q = (lines: { unit: { kind: 'unit'; nodeId: string }; value: number }[], basis: 'questions' | 'marks' = 'questions') =>
      codes(blueprint([section({ quota: { basis, lines } })]))
    const u1 = { kind: 'unit' as const, nodeId: '1' }
    const u2 = { kind: 'unit' as const, nodeId: '2' }
    expect(q([{ unit: u1, value: 1 }])).toEqual(['QUOTA_SUM'])
    expect(q([{ unit: u1, value: 1 }, { unit: u2, value: 1 }])).toEqual([])
    expect(q([{ unit: u1, value: 4 }, { unit: u2, value: 4 }], 'marks')).toEqual([])
    expect(q([{ unit: u1, value: 4 }, { unit: u2, value: 3 }], 'marks')).toEqual(['QUOTA_SUM'])
    expect(q([{ unit: u1, value: 1 }, { unit: u1, value: 1 }])).toEqual(['QUOTA_SUM'])
    expect(q([{ unit: u1, value: -1 }, { unit: u2, value: 3 }])).toEqual(['QUOTA_SUM'])
  })

  it('QUOTA_UNIT needs the unit map', () => {
    const bp = blueprint([section({ quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: '99' }, value: 2 }] } })])
    expect(codes(bp)).toEqual([])
    expect(codes(bp, { unitLevels: units })).toEqual(['QUOTA_UNIT'])
  })

  it('LEVEL_SHARE: section and paper level', () => {
    const lines = [{ unit: { kind: 'unit' as const, nodeId: '1' }, value: 1 }, { unit: { kind: 'unit' as const, nodeId: '2' }, value: 1 }]
    const ok = blueprint([section({ quota: { basis: 'questions', lines, levelShare: { t4: 1, t5: 1 } } })], { levelShare: { t4: 1, t5: 1 } })
    expect(codes(ok, { unitLevels: units })).toEqual([])
    const bad = blueprint([section({ quota: { basis: 'questions', lines, levelShare: { t4: 2, t5: 0 } } })])
    expect(codes(bad, { unitLevels: units })).toEqual(['LEVEL_SHARE'])
    const paperBad = blueprint([section({ quota: { basis: 'questions', lines } })], { levelShare: { t4: 2, t5: 0 } })
    expect(codes(paperBad, { unitLevels: units })).toEqual(['LEVEL_SHARE'])
    const mixed = blueprint(
      [
        section({ quota: { basis: 'questions', lines } }),
        section({ position: 2, quota: { basis: 'marks', lines: [{ unit: { kind: 'unit', nodeId: '1' }, value: 8 }] } }),
      ],
      { levelShare: { t4: 1, t5: 1 } },
    )
    expect(codes(mixed, { unitLevels: units })).toContain('LEVEL_SHARE')
  })

  it('KBAT_RANGE, KBAT_TOTAL and the KBAT_TP_BAND warning', () => {
    expect(codes(blueprint([section({ kbatMarks: 9 })]))).toEqual(['KBAT_RANGE'])
    expect(codes(blueprint([section({ kbatMarks: 0 })]))).toEqual([])
    const total = blueprint([section({ kbatMarks: 4 }), section({ position: 2, kbatMarks: 4 })], { kbatMarks: 9 })
    expect(codes(total)).toEqual(['KBAT_TOTAL'])
    const low = blueprint([section({ kbatMarks: 4, profile: { kind: 'bahagian', groups: [{ from: 1, to: 2, tpMin: 1, tpMax: 2 }] } })])
    expect(validateBlueprint(low).warnings).toEqual([{ code: 'KBAT_TP_BAND', warning: true, sectionPosition: 1 }])
    expect(validateBlueprint(low).problems).toEqual([])
  })

  it('MODES', () => {
    expect(codes(blueprint([section({ allowedModes: ['mcq', 'nope'] })]))).toEqual(['MODES'])
  })

  it('returns every problem at once', () => {
    const bp = blueprint([section({ rule: { type: 'choose', n: 5 }, kbatMarks: 99, allowedModes: ['x'] })], { totalMarks: 1 })
    expect(codes(bp).sort()).toEqual(['CHOOSE_N_RANGE', 'KBAT_RANGE', 'MODES', 'TOTAL_MISMATCH'])
  })
})

describe('validateForVerification', () => {
  it('lists every completeness gap at once, including UNREVIEWED', () => {
    const bare = blueprint([section({ position: 1 }), section({ position: 2 })], { durationMin: null })
    const g = validateForVerification(bare)
    expect(g.completeness.map((c) => `${c.code}${c.sectionPosition ?? ''}`)).toEqual([
      'NO_DURATION',
      'NO_PROFILE1',
      'NO_QUOTA1',
      'NO_KBAT1',
      'NO_PROFILE2',
      'NO_QUOTA2',
      'NO_KBAT2',
    ])
    const seeded = blueprint([
      section({
        profile: { kind: 'bahagian', groups: [{ from: 1, to: 2, tpMin: 2, tpMax: 4 }] },
        quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: '1' }, value: 2, reviewed: false }] },
        kbatMarks: 4,
        kbatReviewed: false,
      }),
    ])
    const s = validateForVerification(seeded)
    expect(s.completeness).toEqual([
      { code: 'UNREVIEWED', sectionPosition: 1, unit: { kind: 'unit', nodeId: '1' } },
      { code: 'UNREVIEWED', sectionPosition: 1 },
    ])
  })

  it('a complete reviewed blueprint passes', () => {
    const ok = blueprint([
      section({
        profile: { kind: 'bahagian', groups: [{ from: 1, to: 2, tpMin: 2, tpMax: 4 }] },
        quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: '1' }, value: 2 }] },
        kbatMarks: 0,
      }),
    ])
    expect(validateForVerification(ok)).toEqual({ problems: [], warnings: [], completeness: [] })
  })

  it('NO_SHARE when the subject has both levels and the share cannot be derived', () => {
    const bp = blueprint([
      section({
        profile: { kind: 'bahagian', groups: [{ from: 1, to: 2, tpMin: 2, tpMax: 4 }] },
        quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: '1' }, value: 2 }] },
        kbatMarks: 0,
      }),
    ])
    expect(validateForVerification(bp, { subjectHasBothLevels: true }).completeness.map((c) => c.code)).toEqual(['NO_SHARE'])
    expect(validateForVerification(bp, { subjectHasBothLevels: true, unitLevels: new Map([['1', 'T4']]) }).completeness).toEqual([])
  })
})

describe('checkEvidence', () => {
  const bp = blueprint([section({ markBudget: 40, questionCount: 10 }), section({ position: 2, markBudget: 15, questionCount: 2, rule: { type: 'choose', n: 1 } })])
  const item = (id: string, kind: EvidenceItem['kind'], body: string, values: EvidenceItem['values']): EvidenceItem => ({ id, kind, body, values })
  const full = (over: EvidenceItem['values'] = {}): EvidenceItem['values'] => ({
    durationMin: 150,
    totalMarks: 55,
    sections: [
      { position: 1, markBudget: 40, rule: { type: 'all' }, questionCount: 10 },
      { position: 2, markBudget: 15, rule: { type: 'choose', n: 1 }, questionCount: 2 },
    ],
    ...over,
  })
  const skema = { totalMarks: 55, sections: [{ position: 1, markBudget: 40 }, { position: 2, markBudget: 15 }] }

  it('two bodies with paper and skema agreeing gives ok everywhere', () => {
    const r = checkEvidence(bp, [
      item('1', 'trial_paper', 'sbp', full()),
      item('2', 'skema', 'sbp', skema),
      item('3', 'trial_paper', 'selangor_mpsm', full()),
      item('4', 'skema', 'selangor_mpsm', skema),
    ])
    expect(r.lines.every((l) => l.status === 'ok')).toBe(true)
    expect(r.completeness).toEqual([])
    expect(r.passes).toBe(true)
  })

  it('a contradicting statement is differs', () => {
    const r = checkEvidence(bp, [
      item('1', 'trial_paper', 'sbp', full()),
      item('2', 'trial_paper', 'selangor_mpsm', full({ durationMin: 120 })),
    ])
    const line = r.lines.find((l) => l.field === 'durationMin')!
    expect(line.status).toBe('differs')
    expect(line.supportingBodies).toBe(1)
    expect(r.passes).toBe(false)
  })

  it('a single body is tidak_disahkan, a value nobody states is not_covered', () => {
    const r = checkEvidence(bp, [item('1', 'trial_paper', 'sbp', { durationMin: 150 })])
    expect(r.lines.find((l) => l.field === 'durationMin')?.status).toBe('tidak_disahkan')
    expect(r.lines.find((l) => l.field === 'totalMarks')?.status).toBe('not_covered')
    expect(r.completeness).toEqual([{ code: 'NO_EVIDENCE_BODIES' }])
  })

  it('skema state marks but not rules or duration (values are optional per item)', () => {
    const r = checkEvidence(bp, [
      item('1', 'trial_paper', 'sbp', full()),
      item('2', 'skema', 'sbp', skema),
      item('3', 'trial_paper', 'selangor_mpsm', full()),
      item('4', 'skema', 'selangor_mpsm', skema),
    ])
    const rule = r.lines.find((l) => l.field === 'rule' && l.sectionPosition === 2)!
    expect(rule.statements.map((s) => s.kind)).toEqual(['trial_paper', 'trial_paper'])
    const marks = r.lines.find((l) => l.field === 'markBudget' && l.sectionPosition === 1)!
    expect(marks.statements).toHaveLength(4)
  })

  // H-A15 (iii), AC-39.7 / AC-39.8 / SPP 10.3: a skema prints the marks of every offered question, so on a choose-N section its
  // Markah is the OFFERED marks (here 15 / 1 x 2 = 30); the trial paper states the effective budget (15). Each has its own figure.
  describe('Markah of a skema on a choose-N section (H-A15 iii)', () => {
    const marksAt = (r: ReturnType<typeof checkEvidence>, position: number) => r.lines.find((l) => l.field === 'markBudget' && l.sectionPosition === position)!
    const twoBodies = (skemaMarks: EvidenceItem['values']) => [
      item('1', 'trial_paper', 'sbp', full()),
      item('2', 'skema', 'sbp', skemaMarks),
      item('3', 'trial_paper', 'selangor_mpsm', full()),
      item('4', 'skema', 'selangor_mpsm', skemaMarks),
    ]

    it('a choose section: the skema offered marks (30) agree with the budget 15, the line is ok and the check passes', () => {
      expect(offeredMarks(bp.sections[1]!)).toBe(30)
      const r = checkEvidence(bp, twoBodies({ totalMarks: 55, sections: [{ position: 1, markBudget: 40 }, { position: 2, markBudget: 30 }] }))
      expect(marksAt(r, 2)).toMatchObject({ status: 'ok', expected: 15, supportingBodies: 2 })
      expect(marksAt(r, 2).statements.map((s) => s.value)).toEqual([15, 30, 15, 30])
      expect(r.passes).toBe(true)
    })

    it('a choose section: a skema that states the effective budget (15) still agrees; any other figure differs', () => {
      expect(marksAt(checkEvidence(bp, twoBodies(skema)), 2).status).toBe('ok')
      const wrong = checkEvidence(bp, twoBodies({ totalMarks: 55, sections: [{ position: 1, markBudget: 40 }, { position: 2, markBudget: 25 }] }))
      expect(marksAt(wrong, 2).status).toBe('differs')
      expect(wrong.passes).toBe(false)
    })

    it('only a skema reads Markah as offered: a trial paper stating 30 for the choose section differs', () => {
      const paper30 = full({ sections: [{ position: 1, markBudget: 40, rule: { type: 'all' }, questionCount: 10 }, { position: 2, markBudget: 30, rule: { type: 'choose', n: 1 }, questionCount: 2 }] })
      const r = checkEvidence(bp, [item('1', 'trial_paper', 'sbp', paper30), item('2', 'trial_paper', 'selangor_mpsm', full())])
      expect(marksAt(r, 2).status).toBe('differs')
    })

    it('a non-choose section: offered marks equal the budget, so any other skema figure differs', () => {
      expect(offeredMarks(bp.sections[0]!)).toBe(40)
      const r = checkEvidence(bp, twoBodies({ totalMarks: 55, sections: [{ position: 1, markBudget: 45 }, { position: 2, markBudget: 30 }] }))
      expect(marksAt(r, 1)).toMatchObject({ status: 'differs', expected: 40 })
      expect(marksAt(r, 2).status).toBe('ok')
      expect(marksAt(checkEvidence(bp, twoBodies(skema)), 1).status).toBe('ok')
    })

    it('a choose section whose budget is not divisible by N has no separate offered figure (offered = budget)', () => {
      const odd = blueprint([section({ markBudget: 10, questionCount: 3, rule: { type: 'choose', n: 3 } })])
      expect(offeredMarks(odd.sections[0]!)).toBe(10)
      const r = checkEvidence(odd, [item('1', 'skema', 'sbp', { sections: [{ position: 1, markBudget: 10 }] }), item('2', 'skema', 'selangor_mpsm', { sections: [{ position: 1, markBudget: 10 }] })])
      expect(marksAt(r, 1).status).toBe('ok')
    })
  })

  it('an lpm_format item counts as two supporting bodies and lifts the two-body rule', () => {
    const r = checkEvidence(bp, [item('1', 'lpm_format', 'lpm', full())])
    expect(r.lines.every((l) => l.status === 'ok')).toBe(true)
    expect(r.completeness).toEqual([])
    expect(r.passes).toBe(true)
  })

  it('two bodies but one lacks a skema fails the body rule', () => {
    const r = checkEvidence(bp, [
      item('1', 'trial_paper', 'sbp', full()),
      item('2', 'skema', 'sbp', skema),
      item('3', 'trial_paper', 'selangor_mpsm', full()),
    ])
    expect(r.lines.every((l) => l.status === 'ok')).toBe(true)
    expect(r.completeness).toEqual([{ code: 'NO_EVIDENCE_BODIES' }])
    expect(r.passes).toBe(false)
  })
})

describe('shortageLine', () => {
  it('formats every kind with the AC wording', () => {
    expect(shortageLine({ section: 'Bahagian A', need: 10, have: 7 })).toBe('Bahagian A: perlu 10 soalan, hanya 7 tersedia')
    expect(shortageLine({ section: 'Bahagian A', kind: 'count', need: 10, have: 7 })).toBe('Bahagian A: perlu 10 soalan, hanya 7 tersedia')
    expect(shortageLine({ section: 'Bahagian C', kind: 'marks', need: 45, have: 40 })).toBe('Bahagian C: tidak dapat menyusun 45 markah daripada soalan yang tersedia')
    expect(shortageLine({ section: 'Bahagian A', kind: 'tp', need: 3, have: 0, slot: { from: 1, to: 10 }, tp: { min: 2, max: 4 } })).toBe('Bahagian A soalan 1-10: tiada soalan layak pada TP 2-4')
    expect(shortageLine({ section: 'Bahagian A', kind: 'tp', need: 3, have: 1, slot: { from: 5, to: 5 }, tp: { min: 3, max: 3 } })).toBe('Bahagian A soalan 5: perlu 3 soalan pada TP 3, hanya 1 tersedia')
    expect(shortageLine({ section: 'Bahagian A', kind: 'unit', basis: 'questions', need: 3, have: 1, unit: { kind: 'unit', nodeId: '1', level: 'T4', code: '3.0', title: 'Fungsi' } })).toBe('Bahagian A: perlu 3 soalan T4 3.0 Fungsi, hanya 1 tersedia')
    expect(shortageLine({ section: 'Bahagian B', kind: 'unit', basis: 'marks', need: 9, have: 4, unit: { kind: 't1_t3' } })).toBe('Bahagian B: perlu 9 markah T1-T3, luar DSKP, hanya 4 tersedia')
    expect(shortageLine({ section: 'Bahagian A', kind: 'kbat', need: 20, have: 12 })).toBe('Bahagian A: perlu 20 markah KBAT, hanya 12 tersedia')
    expect(shortageLine({ section: 'Bahagian A', kind: 'level_share', need: 1, have: 0 })).toBe('Bahagian A: nisbah Tingkatan 4 : 5 tidak dapat dipenuhi daripada soalan yang tersedia')
    expect(shortageLine({ section: 'Bahagian A', kind: 'combination', need: 1, have: 0, blocking: 'kbat' })).toBe('Bahagian A: syarat KBAT tidak dapat dipenuhi bersama syarat lain')
    expect(shortageLine({ section: 'Bahagian B', kind: 'overlap', need: 1, have: 0, otherSection: 'Bahagian A' })).toBe('Bahagian B: soalan yang diperlukan telah digunakan oleh Bahagian A')
  })

  it('a marks band shortage names the group (AC-34.9)', () => {
    expect(shortageLine({ section: 'Bahagian A', kind: 'marks', need: 3, have: 0, slot: { from: 1, to: 1 }, marksBand: { min: 3, max: 5 } })).toBe('Bahagian A soalan 1: tiada soalan layak dengan 3-5 markah')
  })
})

describe('verifyComposition', () => {
  // Section 1 (ladder): 2 slots, marks 3 + 5, TP 1-2 then 3-4. Unit 1 once, unit 2 once. KBAT 5.
  const bp = blueprint([
    section({
      markBudget: 8,
      questionCount: 2,
      profile: {
        kind: 'ladder',
        groups: [
          { from: 1, to: 1, tpMin: 1, tpMax: 2, marksMin: 3, marksMax: 3 },
          { from: 2, to: 2, tpMin: 3, tpMax: 4, tpCounts: [{ tp: 4, count: 1 }] },
        ],
      },
      quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: '1' }, value: 1 }, { unit: { kind: 'unit', nodeId: '2' }, value: 1 }], levelShare: { t4: 1, t5: 1 } },
      kbatMarks: 5,
    }),
  ])
  const a = facts('a', { unit: unit('1', 'T4'), leaves: [leaf({ marks: 3, tp: 2, kbat: false })] })
  const b = facts('b', { unit: unit('2', 'T5'), leaves: [leaf({ marks: 5, tp: 4, kbat: true })] })
  const pool = [a, b]
  const run = (ids: string[], p = pool, b2 = bp) => verifyComposition(b2, [{ position: 1, questionIds: ids }], p)

  it('a conforming paper has no violation', () => {
    expect(run(['a', 'b'])).toEqual([])
  })

  it('flags wrong count, duplicate and unknown question', () => {
    expect(run(['a']).map((v) => v.code)).toContain('COUNT')
    expect(run(['a', 'a']).map((v) => v.code)).toContain('DUPLICATE')
    expect(run(['a', 'zzz']).map((v) => v.code)).toContain('UNKNOWN_QUESTION')
  })

  it('flags the TP band, the exact TP count, the marks band and the marks total', () => {
    expect(run(['b', 'a']).map((v) => v.code)).toEqual(expect.arrayContaining(['TP_BAND', 'MARKS_BAND']))
    const c = facts('c', { unit: unit('2', 'T5'), leaves: [leaf({ marks: 5, tp: 3, kbat: true })] })
    expect(run(['a', 'c'], [a, c]).map((v) => v.code)).toContain('TP_COUNT')
    const d = facts('d', { unit: unit('2', 'T5'), leaves: [leaf({ marks: 6, tp: 4, kbat: true })] })
    expect(run(['a', 'd'], [a, d]).map((v) => v.code)).toContain('MARKS_TOTAL')
  })

  it('flags a quota line, level share and KBAT miss', () => {
    const e = facts('e', { unit: unit('1', 'T4'), leaves: [leaf({ marks: 5, tp: 4, kbat: false })] })
    const codes = run(['a', 'e'], [a, e]).map((v) => v.code)
    expect(codes).toEqual(expect.arrayContaining(['QUOTA', 'LEVEL_SHARE', 'KBAT']))
  })

  it('tiers: structural violations are separable from standard ones', () => {
    const e = facts('e', { unit: unit('1', 'T4'), leaves: [leaf({ marks: 5, tp: 4, kbat: false })] })
    const all = verifyComposition(bp, [{ position: 1, questionIds: ['a', 'e'] }], [a, e])
    const structural = verifyComposition(bp, [{ position: 1, questionIds: ['a', 'e'] }], [a, e], { tier: 'structural' })
    expect(all.length).toBeGreaterThan(structural.length)
    expect(structural.every((v) => v.tier === 'structural')).toBe(true)
    expect(structural.map((v) => v.code)).toEqual([])
  })

  it('flags a broken stimulus group', () => {
    const g1 = facts('g1', { groupId: 'G', groupPosition: 1, unit: unit('1'), leaves: [leaf({ marks: 3, tp: 2 })] })
    const g2 = facts('g2', { groupId: 'G', groupPosition: 2, unit: unit('2'), leaves: [leaf({ marks: 5, tp: 4 })] })
    const plain = blueprint([section({ markBudget: 8, questionCount: 2 })])
    expect(run(['g1', 'g2'], [g1, g2], plain)).toEqual([])
    expect(run(['g2', 'g1'], [g1, g2], plain).map((v) => v.code)).toEqual(['GROUP_BROKEN'])
    const x = facts('x', { unit: unit('1'), leaves: [leaf({ marks: 5, tp: 4 })] })
    expect(run(['g1', 'x'], [g1, g2, x], plain).map((v) => v.code)).toContain('GROUP_BROKEN')
  })

  it('choose-N: every question carries budget / N marks', () => {
    const choose = blueprint([section({ rule: { type: 'choose', n: 1 }, markBudget: 4, questionCount: 2 })])
    const p = facts('p', { leaves: [leaf({ marks: 4 })] })
    const q = facts('q', { leaves: [leaf({ marks: 3 })] })
    expect(run(['p', 'q'], [p, q], choose).map((v) => v.code)).toContain('MARKS_EACH')
  })

  it('flags ineligible questions and a missing section', () => {
    const bad = facts('bad', { leaves: [leaf({ hasKey: false, marks: 3, tp: 2 })] })
    expect(run(['bad', 'b'], [bad, b]).map((v) => v.code)).toContain('INELIGIBLE')
    expect(verifyComposition(bp, [], pool).map((v) => v.code)).toContain('SECTION_MISSING')
  })

  it('checks number continuity when numbers are given', () => {
    const two = blueprint([section({ markBudget: 8 }), section({ position: 2, markBudget: 8 })])
    const f = [1, 2, 3, 4].map((n) => facts(`n${n}`, { unit: unit(String(n)), leaves: [leaf({ marks: 4 })] }))
    const ok = verifyComposition(two, [{ position: 1, questionIds: ['n1', 'n2'], numbers: [1, 2] }, { position: 2, questionIds: ['n3', 'n4'], numbers: [3, 4] }], f)
    expect(ok).toEqual([])
    const bad = verifyComposition(two, [{ position: 1, questionIds: ['n1', 'n2'], numbers: [1, 2] }, { position: 2, questionIds: ['n3', 'n4'], numbers: [4, 5] }], f)
    expect(bad.map((v) => v.code)).toEqual(['NUMBERING'])
  })

  it('measureSection and buildStandardReport report the achieved numbers', () => {
    const m = measureSection(bp.sections[0]!, ['a', 'b'], pool)
    expect(m).toMatchObject({ effectiveMarks: 8, offeredMarks: 8, slotTp: [2, 4], kbatMarks: 5 })
    expect(m.unitCounts.map((u) => u.value)).toEqual([1, 1])
    const report = buildStandardReport(bp, [{ position: 1, questionIds: ['a', 'b'] }], pool, { seed: 7, solverVersion: 't' })
    expect(report).toMatchObject({ blueprintVersion: 1, seed: 7, solverVersion: 't', kbatMarksTotal: 5 })
  })

  it('marks-basis quota counts leaf marks per effective unit; questions-basis counts the primary unit', () => {
    const multi = facts('m', { unit: unit('12', 'T5'), leaves: [leaf({ marks: 12 }), leaf({ marks: 8, unit: unit('14', 'T5') })] })
    const marksBp = blueprint([section({ markBudget: 20, questionCount: 1, quota: { basis: 'marks', lines: [{ unit: { kind: 'unit', nodeId: '12' }, value: 12 }, { unit: { kind: 'unit', nodeId: '14' }, value: 8 }] } })])
    expect(run(['m'], [multi], marksBp)).toEqual([])
    const questionsBp = blueprint([section({ markBudget: 20, questionCount: 1, quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: '12' }, value: 1 }] } })])
    expect(run(['m'], [multi], questionsBp)).toEqual([])
  })
})
