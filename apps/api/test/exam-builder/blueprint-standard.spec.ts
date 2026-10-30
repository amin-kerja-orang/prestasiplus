import { BijakBlueprintViewSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import type { Blueprint, BlueprintSection } from '../../src/db/generated/client'
import { profileOfDoc, quotaOfDoc, quotaToDoc, structureHashOf, toStandard, unitLevelsOf } from '../../src/modules/exam/blueprints/blueprint-standard'
import { blueprintView, type BlueprintWithSections } from '../../src/modules/exam/blueprints/blueprint-view'

const section = (over: Partial<BlueprintSection> = {}): BlueprintSection => ({
  id: 1n,
  blueprintId: 1n,
  position: 1,
  label: 'Bahagian A',
  instruction: null,
  ruleType: 'all',
  ruleN: null,
  questionCount: 4,
  markBudget: 8,
  compulsory: false,
  pool: null,
  allowedModes: [],
  profile: null,
  quota: null,
  kbatMarks: null,
  kbatReviewed: true,
  ...over,
})

const row = (over: Partial<Blueprint> = {}, sections: BlueprintSection[] = [section()]): BlueprintWithSections => ({
  id: 1n,
  subjectId: 1n,
  kertas: 1,
  code: 'T/1',
  version: 1,
  status: 'active',
  source: 'spec',
  provenance: null,
  confidence: null,
  durationMin: 60,
  totalMarks: 8,
  languageMode: null,
  autoMarkable: null,
  instructions: [],
  referenceSheets: [],
  cognitiveMix: null,
  notes: null,
  subPartRamp: false,
  kbatMarks: null,
  levelShare: null,
  servesStudents: false,
  structureHash: '0'.repeat(64),
  verificationId: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  sections,
  ...over,
})

const quota = {
  basis: 'questions',
  lines: [
    { unit: { kind: 'unit', nodeId: '10' }, value: 3 },
    { unit: { kind: 'unit', nodeId: '11' }, value: 1, reviewed: false, tag: 'inferred' },
  ],
}

describe('structure hash (architecture 3.5)', () => {
  const hash = (r: BlueprintWithSections) => structureHashOf(toStandard(r, 'MAT'))

  it('is a sha-256 hex that the 0092 CHECK accepts', () => {
    expect(hash(row())).toMatch(/^[0-9a-f]{64}$/)
  })

  it('ignores cosmetic content: notes, instructions, reference sheets, section label and instruction, reviewed flags', () => {
    const base = hash(row({}, [section({ quota })]))
    const cosmetic = row(
      { notes: 'nota', instructions: ['Baca arahan.'], referenceSheets: [{ title: 'Rumus', items: ['a'] }] },
      [section({ label: 'Lain', instruction: 'Jawab semua.', quota: { ...quota, lines: quota.lines.map((l) => ({ unit: l.unit, value: l.value })) } })],
    )
    expect(hash(cosmetic)).toBe(base)
  })

  it.each([
    ['duration', { durationMin: 90 }, [section()]],
    ['code', { code: 'T/2' }, [section()]],
    ['sub-part ramp', { subPartRamp: true }, [section()]],
    ['paper KBAT marks', { kbatMarks: 2 }, [section()]],
    ['mark budget', {}, [section({ markBudget: 12 })]],
    ['rule', {}, [section({ ruleType: 'choose', ruleN: 2 })]],
    ['question count', {}, [section({ questionCount: 5 })]],
    ['allowed modes', {}, [section({ allowedModes: ['mcq'] })]],
    ['section KBAT marks', {}, [section({ kbatMarks: 0 })]],
    ['quota value', {}, [section({ quota: { ...quota, lines: [{ unit: quota.lines[0]!.unit, value: 2 }, quota.lines[1]!] } })]],
  ])('changes with a structural edit: %s', (_name, over, sections) => {
    expect(hash(row(over, sections))).not.toBe(hash(row({}, [section({ quota })])))
  })

  it('is independent of the key order of the stored documents', () => {
    const a = section({ quota: { basis: 'questions', lines: [{ value: 3, unit: { nodeId: '10', kind: 'unit' } }] } })
    const b = section({ quota: { lines: [{ unit: { kind: 'unit', nodeId: '10' }, value: 3 }], basis: 'questions' } })
    expect(hash(row({}, [a]))).toBe(hash(row({}, [b])))
  })
})

describe('stored documents', () => {
  it('reads a quota line without `reviewed` as reviewed (absent = true) and `reviewed: false` as unreviewed', () => {
    expect(quotaOfDoc(quota)?.lines.map((l) => l.reviewed)).toEqual([true, false])
  })

  it('writes a quota without the reviewed key: an admin save reviews every line', () => {
    const doc = quotaToDoc({ basis: 'marks', lines: [{ unit: { kind: 't1_t3' }, value: 5, tag: 'observed' }], levelShare: { t4: 1, t5: 2 } }) as Record<string, unknown>
    expect(doc).toEqual({ basis: 'marks', lines: [{ unit: { kind: 't1_t3' }, value: 5, tag: 'observed' }], levelShare: { t4: 1, t5: 2 } })
    expect(JSON.stringify(doc)).not.toContain('reviewed')
    expect(quotaToDoc(null)).toBeNull()
  })

  it('re-parses a profile and refuses a corrupt document', () => {
    expect(profileOfDoc(null)).toBeNull()
    expect(profileOfDoc({ kind: 'bahagian', groups: [{ from: 1, to: 4, tpMin: 1, tpMax: 3 }] })?.groups).toHaveLength(1)
    expect(() => profileOfDoc({ kind: 'nope', groups: [] })).toThrow()
  })

  it('maps unit rows to the unitLevels record of the validator', () => {
    expect(unitLevelsOf([{ nodeId: '1', code: '1.0', level: 'T4', title: 'a' }, { nodeId: '2', code: '5.0', level: 'T5', title: 'b' }])).toEqual({ '1': 'T4', '2': 'T5' })
  })
})

describe('blueprintView', () => {
  const subject = { code: 'MATH', name: 'Matematik' }

  it('defaults the standard fields for a plain row and parses against the contract', () => {
    const view = BijakBlueprintViewSchema.parse(blueprintView(row(), subject))
    expect(view).toMatchObject({
      subject: 'MAT',
      source: 'Spec',
      version: 1,
      servesStudents: false,
      verification: null,
      evidenceCount: 0,
      needsReview: false,
      reviewPapers: [],
      warnings: [],
      reference: [],
      dependentPaperCount: 0,
    })
    expect(view.servingVersion).toBeUndefined()
    expect(view.sections[0]).toMatchObject({ position: 1, profile: null, quota: null, kbatMarks: null, kbatReviewed: true, allowedModes: [], pool: null })
  })

  it('shows quota lines with their reviewed flag and enriches known units', () => {
    const units = new Map([['10', { nodeId: '10', code: '4.0', level: 'T4' as const, title: 'Fungsi' }]])
    const view = BijakBlueprintViewSchema.parse(
      blueprintView(row({}, [section({ quota, kbatMarks: 2, kbatReviewed: false })]), subject, {
        verification: null,
        evidenceCount: 3,
        servingVersion: 1,
        dependentPaperCount: 2,
        warnings: [],
        needsReview: false,
        reviewPapers: [],
        units,
      }),
    )
    expect(view).toMatchObject({ evidenceCount: 3, servingVersion: 1, dependentPaperCount: 2 })
    const s = view.sections[0]!
    expect(s).toMatchObject({ kbatMarks: 2, kbatReviewed: false })
    expect(s.quota?.lines).toEqual([
      { unit: { kind: 'unit', nodeId: '10', code: '4.0', level: 'T4', title: 'Fungsi' }, value: 3, reviewed: true },
      { tag: 'inferred', unit: { kind: 'unit', nodeId: '11' }, value: 1, reviewed: false },
    ])
  })
})
