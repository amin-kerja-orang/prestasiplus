import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import {
  BijakBlueprintAdminCreateSchema,
  BijakBlueprintAdminSectionInputSchema,
  BijakBlueprintAdminVersionInputSchema,
} from '../../builder/schema'
import {
  BijakBlueprintContractSchema,
  BijakGenerateLimitErrorSchema,
  BijakGenerateShortageErrorSchema,
  BijakGenerateShortageSchema,
} from '../../papers/schema'
import {
  BijakBlueprintInvalidErrorSchema,
  BijakDraftGenerateRequestSchema,
  BijakDskpUnitSchema,
  BijakDskpUnitsQuerySchema,
  BijakEvidenceInputSchema,
  BijakEvidenceItemSchema,
  BijakPoolPreviewSchema,
  BijakSectionReviewInputSchema,
  BijakVerificationFailedErrorSchema,
  BijakVerificationStateSchema,
  BijakVerifyInputSchema,
} from '../admin'
import { BIJAK_STANDARDS_COMPONENT_SCHEMAS, BIJAK_STANDARDS_TAG } from '../paths'
import {
  ALLOWED_MODES_UNIQUE_MESSAGE,
  BIJAK_STANDARDS_MESSAGES,
  BijakDifficultyProfileSchema,
  BijakQuotaLineSchema,
  BijakQuotaLineViewSchema,
  BijakSlotGroupSchema,
  BijakTopicQuotaSchema,
  BijakUnitRefSchema,
  SLOT_GROUP_REFINE_MESSAGE,
} from '../schema'
import { BIJAK_PAPERS_MESSAGES } from '../../papers/schema'
import { BijakBlueprintViewSchema, BijakBlueprintViewSectionSchema } from '../../builder/schema'

const TS = '2026-10-29T09:30:00+08:00'

const group = (over: Record<string, unknown> = {}) => ({ from: 1, to: 10, tpMin: 2, tpMax: 4, ...over })
const sectionInput = (over: Record<string, unknown> = {}) => ({
  label: 'Bahagian A',
  markBudget: 40,
  questionCount: 10,
  rule: { type: 'all' },
  profile: { kind: 'bahagian', groups: [group({ marksMin: 3, marksMax: 5 })] },
  quota: {
    basis: 'marks',
    lines: [
      { unit: { kind: 'unit', nodeId: '101' }, value: 30, tag: 'observed' },
      { unit: { kind: 't1_t3' }, value: 10, tag: 'inferred' },
    ],
    levelShare: { t4: 30, t5: 0 },
  },
  kbatMarks: 12,
  allowedModes: ['working', 'numeric'],
  ...over,
})
const versionInput = (over: Record<string, unknown> = {}) => ({
  source: 'Spec',
  code: '1449/2',
  durationMin: 150,
  totalMarks: 40,
  notes: 'diinferens',
  subPartRamp: false,
  kbatMarks: 12,
  levelShare: null,
  sections: [sectionInput()],
  ...over,
})

const viewFixture = () => ({
  subject: 'MAT',
  subjectName: 'Matematik',
  kertas: 2,
  source: 'Spec',
  code: '1449/2',
  durationMin: 150,
  instructions: [],
  totalMarks: 40,
  sections: [
    {
      label: 'Bahagian A',
      markBudget: 40,
      questionCount: 10,
      compulsory: false,
      instruction: 'Jawab semua soalan.',
      rule: { type: 'all' },
      pool: null,
      position: 1,
      profile: null,
      quota: null,
      kbatMarks: null,
      kbatReviewed: false,
      allowedModes: [],
    },
  ],
  version: 2,
  servesStudents: false,
  verification: null,
  evidenceCount: 0,
  notes: null,
  subPartRamp: false,
  kbatMarks: null,
  levelShare: null,
  warnings: [],
  needsReview: false,
  reviewPapers: [],
  reference: [],
  dependentPaperCount: 0,
})

describe('slot group, profile, quota', () => {
  it('accepts a marks band and exact TP counts, and min = max (exact marks)', () => {
    expect(BijakSlotGroupSchema.safeParse(group({ marksMin: 4, marksMax: 4 })).success).toBe(true)
    expect(
      BijakSlotGroupSchema.safeParse(group({ tpCounts: [{ tp: 3, count: 6 }, { tp: 4, count: 4 }] })).success,
    ).toBe(true)
  })

  it('rejects inverted bands, out-of-range TP, unknown keys', () => {
    expect(BijakSlotGroupSchema.safeParse(group({ marksMin: 5, marksMax: 3 })).success).toBe(false)
    expect(BijakSlotGroupSchema.safeParse(group({ tpMin: 5, tpMax: 3 })).success).toBe(false)
    expect(BijakSlotGroupSchema.safeParse(group({ tpMax: 7 })).success).toBe(false)
    expect(BijakSlotGroupSchema.safeParse(group({ to: 0 })).success).toBe(false)
    expect(BijakSlotGroupSchema.safeParse(group({ extra: 1 })).success).toBe(false)
  })

  it('refuses from > to, and a marks band with only one end is accepted', () => {
    const r = BijakSlotGroupSchema.safeParse(group({ from: 5, to: 3 }))
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]!.message).toBe(SLOT_GROUP_REFINE_MESSAGE)
    expect(BijakSlotGroupSchema.safeParse(group({ marksMin: 4 })).success).toBe(true)
    expect(BijakSlotGroupSchema.safeParse(group({ marksMax: 4 })).success).toBe(true)
    expect(BijakSlotGroupSchema.safeParse(group({ marksMin: 0 })).success).toBe(false)
  })

  it('keeps the BM copy free of the [PROPOSED] tag and as decided', () => {
    expect(SLOT_GROUP_REFINE_MESSAGE).toBe(
      'Kumpulan slot tidak sah: slot akhir tidak boleh sebelum slot awal, dan nilai maksimum tidak boleh kurang daripada nilai minimum.',
    )
    expect(ALLOWED_MODES_UNIQUE_MESSAGE).toBe('Mod jawapan tidak boleh berulang.')
    for (const text of [
      ...Object.values(BIJAK_STANDARDS_MESSAGES),
      SLOT_GROUP_REFINE_MESSAGE,
      ALLOWED_MODES_UNIQUE_MESSAGE,
      BIJAK_PAPERS_MESSAGES.generateLimit,
    ]) {
      expect(text).not.toContain('[PROPOSED]')
    }
    expect(BIJAK_STANDARDS_MESSAGES.blueprintInvalid).toBe('Kontrak tidak boleh disimpan. Betulkan masalah yang disenaraikan.')
    expect(BIJAK_STANDARDS_MESSAGES.verificationFailed).toBe('Kontrak belum boleh disahkan. Semak senarai kegagalan.')
    expect(BIJAK_STANDARDS_MESSAGES.poolEmpty).toBe('Tiada soalan Terbit untuk tag ini')
    expect(BIJAK_PAPERS_MESSAGES.generateLimit).toBe('Kertas tidak dapat disusun sekarang. Cuba lagi.')
  })

  it('refuses duplicate allowed modes', () => {
    const r = BijakBlueprintAdminSectionInputSchema.safeParse(sectionInput({ allowedModes: ['numeric', 'numeric'] }))
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]!.message).toBe(ALLOWED_MODES_UNIQUE_MESSAGE)
    expect(BijakBlueprintAdminSectionInputSchema.safeParse(sectionInput({ allowedModes: [] })).success).toBe(true)
  })

  it('has three profile kinds and rejects an empty group list', () => {
    for (const kind of ['ladder', 'bahagian', 'tema']) {
      expect(BijakDifficultyProfileSchema.safeParse({ kind, groups: [group()] }).success, kind).toBe(true)
    }
    expect(BijakDifficultyProfileSchema.safeParse({ kind: 'lain', groups: [group()] }).success).toBe(false)
    expect(BijakDifficultyProfileSchema.safeParse({ kind: 'ladder', groups: [] }).success).toBe(false)
  })

  it('parses unit references and quota lines with the optional tag', () => {
    expect(BijakUnitRefSchema.safeParse({ kind: 'unit', nodeId: '1' }).success).toBe(true)
    expect(BijakUnitRefSchema.safeParse({ kind: 't1_t3' }).success).toBe(true)
    expect(BijakUnitRefSchema.safeParse({ kind: 't1_t3', nodeId: '1' }).success).toBe(false)
    expect(BijakUnitRefSchema.safeParse({ kind: 'unit' }).success).toBe(false)
    const quota = sectionInput().quota
    expect(BijakTopicQuotaSchema.safeParse(quota).success).toBe(true)
    const bad = { ...quota, lines: [{ unit: { kind: 't1_t3' }, value: 1, tag: 'guess' }] }
    expect(BijakTopicQuotaSchema.safeParse(bad).success).toBe(false)
    expect(BijakTopicQuotaSchema.safeParse({ ...quota, lines: [{ unit: { kind: 't1_t3' }, value: -1 }] }).success).toBe(false)
    expect(BijakTopicQuotaSchema.safeParse({ ...quota, basis: 'persen' }).success).toBe(false)
  })
})

describe('blueprint admin bodies (extended)', () => {
  it('accepts the full standard body and the old minimal body (pool optional)', () => {
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(versionInput()).success).toBe(true)
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse({
        code: '1449/2',
        durationMin: 150,
        sections: [{ label: 'A', markBudget: 6, questionCount: 2, rule: { type: 'all' }, pool: 'mat-k2-a' }],
      }).success,
    ).toBe(true)
    expect(
      BijakBlueprintAdminCreateSchema.safeParse({ subject: 'MAT', kertas: 2, ...versionInput() }).success,
    ).toBe(true)
  })

  it('narrows the client source to Draf or Spec: Disahkan is refused', () => {
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(versionInput({ source: 'Draf' })).success).toBe(true)
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(versionInput({ source: 'Disahkan' })).success).toBe(false)
  })

  it('allows null for profile, quota and kbatMarks (0 is a value) and rejects unknown keys', () => {
    expect(
      BijakBlueprintAdminSectionInputSchema.safeParse(sectionInput({ profile: null, quota: null, kbatMarks: null })).success,
    ).toBe(true)
    expect(BijakBlueprintAdminSectionInputSchema.safeParse(sectionInput({ kbatMarks: 0 })).success).toBe(true)
    expect(BijakBlueprintAdminSectionInputSchema.safeParse(sectionInput({ topicWeights: {} })).success).toBe(false)
    expect(BijakBlueprintAdminSectionInputSchema.safeParse(sectionInput({ allowedModes: ['lain'] })).success).toBe(false)
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(versionInput({ servesStudents: true })).success).toBe(false)
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(versionInput({ kbatMarks: -1 })).success).toBe(false)
  })
})

describe('AC-39.9 reviewed flags ("Belum disemak")', () => {
  const viewSection = (over: Record<string, unknown> = {}) => ({
    label: 'Bahagian A',
    markBudget: 40,
    questionCount: 10,
    compulsory: false,
    instruction: 'Jawab semua soalan.',
    rule: { type: 'all' },
    pool: null,
    position: 1,
    profile: null,
    quota: {
      basis: 'marks',
      lines: [{ unit: { kind: 't1_t3' }, value: 40, tag: 'inferred', reviewed: false }],
    },
    kbatMarks: 12,
    kbatReviewed: false,
    allowedModes: [],
    ...over,
  })

  it('requires reviewed on a quota line view and kbatReviewed on a section view', () => {
    expect(BijakBlueprintViewSectionSchema.safeParse(viewSection()).success).toBe(true)
    const noFlag = viewSection({ kbatReviewed: undefined })
    expect(BijakBlueprintViewSectionSchema.safeParse(noFlag).success).toBe(false)
    expect(BijakQuotaLineViewSchema.safeParse({ unit: { kind: 't1_t3' }, value: 1 }).success).toBe(false)
    expect(BijakQuotaLineViewSchema.safeParse({ unit: { kind: 't1_t3' }, value: 1, reviewed: true }).success).toBe(true)
  })

  it('rejects reviewed and kbatReviewed on write: the server sets them', () => {
    expect(BijakQuotaLineSchema.safeParse({ unit: { kind: 't1_t3' }, value: 1, reviewed: true }).success).toBe(false)
    expect(BijakBlueprintAdminSectionInputSchema.safeParse(sectionInput({ kbatReviewed: true })).success).toBe(false)
    const quota = { basis: 'questions', lines: [{ unit: { kind: 't1_t3' }, value: 1, reviewed: true }] }
    expect(BijakBlueprintAdminSectionInputSchema.safeParse(sectionInput({ quota })).success).toBe(false)
  })

  it('has a strict empty review body and a documented review route', () => {
    expect(BijakSectionReviewInputSchema.safeParse({}).success).toBe(true)
    expect(BijakSectionReviewInputSchema.safeParse({ reviewed: true }).success).toBe(false)
    const doc = buildOpenApiDocument() as unknown as {
      paths: Record<string, Record<string, { tags?: string[]; responses: Record<string, unknown> }>>
    }
    const op = doc.paths['/admin/blueprints/{subject}/{kertas}/sections/{position}/review']!.post!
    expect(op.tags).toEqual(['bijak-standards'])
    expect(Object.keys(op.responses).sort()).toEqual(['200', '401', '403', '404', '409', '422', '429'])
  })

  it('has the UNREVIEWED completeness code, with a section position and optionally a unit', () => {
    const state = (completeness: unknown) =>
      BijakVerificationStateSchema.safeParse({
        record: null,
        check: { passes: false, blueprintProblems: [], completeness, lines: [] },
      }).success
    expect(state([{ code: 'UNREVIEWED', sectionPosition: 2 }])).toBe(true)
    expect(state([{ code: 'UNREVIEWED', sectionPosition: 2, unit: { kind: 'unit', nodeId: '101', code: '1.0' } }])).toBe(true)
    expect(state([{ code: 'UNREVIEWED', sectionPosition: 2, unit: { kind: 'unit' } }])).toBe(false)
  })
})

describe('gap fields and routes (architecture 15)', () => {
  it('parses a DSKP unit and its query', () => {
    const unit = { nodeId: '101', code: '4.0', level: 'T4', title: 'Fungsi', elective: false }
    expect(BijakDskpUnitSchema.safeParse(unit).success).toBe(true)
    expect(BijakDskpUnitSchema.safeParse({ ...unit, level: 'T3' }).success).toBe(false)
    expect(BijakDskpUnitSchema.safeParse({ ...unit, elective: undefined }).success).toBe(false)
    expect(BijakDskpUnitSchema.safeParse({ ...unit, extra: 1 }).success).toBe(false)
    expect(BijakDskpUnitsQuerySchema.safeParse({ subject: 'MAT', level: 'T5' }).success).toBe(true)
    expect(BijakDskpUnitsQuerySchema.safeParse({ subject: 'MAT' }).success).toBe(true)
    expect(BijakDskpUnitsQuerySchema.safeParse({ level: 'T4' }).success).toBe(false)
    expect(BijakDskpUnitsQuerySchema.safeParse({ subject: 'MAT', level: 'T6' }).success).toBe(false)
  })

  it('requires reference and dependentPaperCount on the view, servingVersion optional', () => {
    const view = viewFixture()
    expect(BijakBlueprintViewSchema.safeParse(view).success).toBe(true)
    expect(BijakBlueprintViewSchema.safeParse({ ...view, servingVersion: 1 }).success).toBe(true)
    expect(BijakBlueprintViewSchema.safeParse({ ...view, servingVersion: 0 }).success).toBe(false)
    expect(BijakBlueprintViewSchema.safeParse({ ...view, reference: undefined }).success).toBe(false)
    expect(BijakBlueprintViewSchema.safeParse({ ...view, dependentPaperCount: undefined }).success).toBe(false)
    expect(BijakBlueprintViewSchema.safeParse({ ...view, dependentPaperCount: -1 }).success).toBe(false)
    expect(
      BijakBlueprintViewSchema.safeParse({ ...view, reference: [{ title: 'Rumus', items: ['$a^2$'] }] }).success,
    ).toBe(true)
  })

  it('keeps reference optional on versions: omitted carries over, [] clears', () => {
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(versionInput()).success).toBe(true)
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(versionInput({ reference: [] })).success).toBe(true)
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse(versionInput({ reference: [{ title: 'Rumus', items: [] }] })).success,
    ).toBe(true)
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(versionInput({ reference: [{ items: [] }] })).success).toBe(false)
  })
})

describe('evidence and verification', () => {
  const evidence = {
    kind: 'trial_paper',
    body: 'sbp',
    year: 2025,
    paperCode: '1449/2',
    values: {
      durationMin: 150,
      totalMarks: 100,
      sections: [{ position: 1, markBudget: 40, rule: { type: 'all' }, questionCount: 10 }, { position: 3, rule: { type: 'choose', n: 1 } }],
    },
  }

  it('accepts evidence with optional values and rejects unknown kinds and keys', () => {
    expect(BijakEvidenceInputSchema.safeParse(evidence).success).toBe(true)
    expect(BijakEvidenceInputSchema.safeParse({ ...evidence, values: {} }).success).toBe(true)
    expect(BijakEvidenceInputSchema.safeParse({ ...evidence, kind: 'foto' }).success).toBe(false)
    expect(BijakEvidenceInputSchema.safeParse({ ...evidence, file: 'x.pdf' }).success).toBe(false)
    expect(BijakEvidenceInputSchema.safeParse({ ...evidence, values: { sections: [{ markBudget: 3 }] } }).success).toBe(false)
  })

  it('bounds year, body and paperCode', () => {
    const ok = (over: Record<string, unknown>) => BijakEvidenceInputSchema.safeParse({ ...evidence, ...over }).success
    expect(ok({ year: 1990 })).toBe(true)
    expect(ok({ year: 2100 })).toBe(true)
    expect(ok({ year: 1989 })).toBe(false)
    expect(ok({ year: 2101 })).toBe(false)
    expect(ok({ body: 'sbp' })).toBe(true)
    expect(ok({ body: 'selangor_mpsm' })).toBe(true)
    expect(ok({ body: 'SBP' })).toBe(false)
    expect(ok({ body: '' })).toBe(false)
    expect(ok({ body: '   ' })).toBe(false)
    expect(ok({ body: ' sbp ' })).toBe(false)
    expect(ok({ body: 'a'.repeat(64) })).toBe(true)
    expect(ok({ body: 'a'.repeat(65) })).toBe(false)
    expect(ok({ paperCode: '' })).toBe(false)
    expect(ok({ paperCode: '   ' })).toBe(false)
  })

  it('parses an evidence item and the verify body', () => {
    expect(
      BijakEvidenceItemSchema.safeParse({
        ...evidence,
        id: '7',
        setLabel: null,
        sourceRef: 'Kajian kertas percubaan 2025',
        origin: 'study',
        note: null,
        createdAt: TS,
      }).success,
    ).toBe(true)
    expect(BijakVerifyInputSchema.safeParse({}).success).toBe(true)
    expect(BijakVerifyInputSchema.safeParse({ note: 'ok' }).success).toBe(true)
    expect(BijakVerifyInputSchema.safeParse({ source: 'Disahkan' }).success).toBe(false)
  })

  const check = {
    passes: false,
    blueprintProblems: [{ code: 'QUOTA_SUM', sectionPosition: 1, expected: 40, actual: 38 }],
    completeness: [{ code: 'NO_KBAT', sectionPosition: 2 }, { code: 'NO_EVIDENCE_BODIES' }],
    lines: [
      {
        field: 'markBudget',
        sectionPosition: 1,
        expected: 40,
        statements: [{ evidenceId: '7', body: 'sbp', kind: 'trial_paper', value: 40 }],
        supportingBodies: 1,
        status: 'tidak_disahkan',
      },
    ],
  }

  it('parses the verification state with and without a record', () => {
    expect(BijakVerificationStateSchema.safeParse({ record: null, check }).success).toBe(true)
    const record = {
      verifiedAt: TS,
      verifierName: 'Pentadbir Ujian',
      verifierRole: 'admin',
      evidenceLabel: 'Kajian kertas percubaan 2025',
      bodies: ['sbp', 'selangor_mpsm'],
      evidence: [],
      lines: [],
    }
    expect(BijakVerificationStateSchema.safeParse({ record, check: { ...check, passes: true } }).success).toBe(true)
    expect(BijakVerificationStateSchema.safeParse({ record: { ...record, verifierRole: 'guru' }, check }).success).toBe(false)
    expect(
      BijakVerificationStateSchema.safeParse({ record: null, check: { ...check, lines: [{ ...check.lines[0], status: 'ok?' }] } }).success,
    ).toBe(false)
  })

  it('has the 422 bodies with every problem listed at once', () => {
    expect(
      BijakBlueprintInvalidErrorSchema.safeParse({
        error: {
          code: 'BLUEPRINT_INVALID',
          message: 'Kontrak tidak boleh disimpan. Betulkan masalah yang disenaraikan.',
          details: { problems: check.blueprintProblems, warnings: [{ code: 'KBAT_TP_BAND', warning: true, sectionPosition: 1 }] },
        },
      }).success,
    ).toBe(true)
    expect(
      BijakBlueprintInvalidErrorSchema.safeParse({
        error: { code: 'BLUEPRINT_INVALID', message: 'x', details: { problems: [] } },
      }).success,
    ).toBe(false)
    expect(
      BijakVerificationFailedErrorSchema.safeParse({
        error: {
          code: 'VERIFICATION_FAILED',
          message: 'Kontrak belum boleh disahkan. Semak senarai kegagalan.',
          details: { check },
        },
      }).success,
    ).toBe(true)
  })
})

describe('pool preview and draft generation', () => {
  const short = { needed: 5, available: 3, short: 2 }
  const preview = {
    blueprint: { version: 2, source: 'Spec' },
    publishedTotal: 34,
    eligibleTotal: 30,
    verdict: 'tidak_boleh',
    firstFailure: { section: 'Bahagian A', need: 5, have: 3, kind: 'unit', basis: 'questions', unit: { kind: 'unit', nodeId: '101', code: '1.0', level: 'T4', title: 'Fungsi' } },
    excluded: {
      total: 4,
      byReason: [{ reason: 'tag_review', count: 4, bankQuery: { subject: 'MAT', missing: 'tag_review' } }],
    },
    warnings: [],
    sections: [
      {
        position: 1,
        label: 'Bahagian A',
        slots: 10,
        effectiveMarks: 40,
        offeredMarks: 40,
        eligible: 30,
        modeExcluded: 1,
        counts: { needed: 10, available: 30, short: 0 },
        marks: { needed: 40, reachable: true },
        quota: [{ unit: { kind: 't1_t3' }, basis: 'marks', ...short }],
        tp: [{ slot: { from: 1, to: 10 }, tpMin: 2, tpMax: 4, ...short }],
        kbat: short,
        bankQuery: { subject: 'MAT', status: 'published' },
      },
    ],
  }

  it('parses a preview, with a null firstFailure and a null kbat line', () => {
    expect(BijakPoolPreviewSchema.safeParse(preview).success).toBe(true)
    expect(
      BijakPoolPreviewSchema.safeParse({
        ...preview,
        verdict: 'boleh',
        firstFailure: null,
        sections: [{ ...preview.sections[0], kbat: null }],
      }).success,
    ).toBe(true)
    expect(BijakPoolPreviewSchema.safeParse({ ...preview, verdict: 'mungkin' }).success).toBe(false)
    const withReason = (reason: string) =>
      BijakPoolPreviewSchema.safeParse({
        ...preview,
        excluded: { total: 1, byReason: [{ reason, count: 1, bankQuery: {} }] },
      }).success
    for (const reason of ['no_unit', 'no_tp', 'no_marks', 'no_key', 'tag_review']) {
      expect(withReason(reason), reason).toBe(true)
    }
    expect(withReason('no_cognitive_level')).toBe(false)
  })

  it('parses the draft generate request and rejects unknown keys', () => {
    expect(BijakDraftGenerateRequestSchema.safeParse({ subject: 'MAT', kertas: 2 }).success).toBe(true)
    expect(BijakDraftGenerateRequestSchema.safeParse({ subject: 'MAT', kertas: 2, publish: true }).success).toBe(false)
  })
})

describe('student side: shortages, limit, canGenerate', () => {
  it('keeps the old shortage shape valid and adds the typed fields', () => {
    expect(BijakGenerateShortageSchema.safeParse({ section: 'Bahagian A', need: 10, have: 4 }).success).toBe(true)
    for (const kind of ['count', 'marks', 'tp', 'unit', 'kbat', 'level_share', 'combination', 'overlap']) {
      expect(BijakGenerateShortageSchema.safeParse({ section: 'A', need: 1, have: 0, kind }).success, kind).toBe(true)
    }
    expect(
      BijakGenerateShortageSchema.safeParse({
        section: 'A', need: 1, have: 0, kind: 'tp', slot: { from: 1, to: 10 }, tp: { min: 2, max: 4 },
      }).success,
    ).toBe(true)
    expect(
      BijakGenerateShortageSchema.safeParse({ section: 'A', need: 1, have: 0, kind: 'combination', blocking: 'kbat' }).success,
    ).toBe(true)
    const marksBand = { section: 'A', need: 2, have: 0, kind: 'marks', slot: { from: 1, to: 10 } }
    expect(BijakGenerateShortageSchema.safeParse({ ...marksBand, marksMin: 3, marksMax: 5 }).success).toBe(true)
    expect(BijakGenerateShortageSchema.safeParse({ ...marksBand, marksMin: 4, marksMax: 4 }).success).toBe(true)
    expect(BijakGenerateShortageSchema.safeParse(marksBand).success).toBe(true)
    expect(BijakGenerateShortageSchema.safeParse({ ...marksBand, marksMin: -1 }).success).toBe(false)
    expect(BijakGenerateShortageSchema.safeParse({ ...marksBand, marksMax: 2.5 }).success).toBe(false)
    expect(BijakGenerateShortageSchema.safeParse({ section: 'A', need: 1, have: 0, kind: 'lain' }).success).toBe(false)
    expect(BijakGenerateShortageSchema.safeParse({ section: 'A', need: 1, have: 0, blocking: 'x' }).success).toBe(false)
  })

  it('has the SHORTAGE body with typed lines and the 503 GENERATE_LIMIT body', () => {
    const details = { shortages: [{ section: 'Bahagian A', need: 5, have: 3, kind: 'kbat' }] }
    expect(
      BijakGenerateShortageErrorSchema.safeParse({
        error: { code: 'SHORTAGE', message: 'Kertas tidak dapat dijana kerana soalan tidak mencukupi.', details },
      }).success,
    ).toBe(true)
    const limit = (d: unknown, message = 'Kertas tidak dapat disusun sekarang. Cuba lagi.') =>
      BijakGenerateLimitErrorSchema.safeParse({ error: { code: 'GENERATE_LIMIT', message, details: d } }).success
    expect(limit({ limitSections: [{ section: 'Bahagian A' }, {}] })).toBe(true)
    expect(limit({ limitSections: [] })).toBe(true)
    expect(limit(details)).toBe(false)
    expect(limit({ limitSections: [{ section: 'A', need: 1 }] })).toBe(false)
    expect(limit({ limitSections: [] }, 'x')).toBe(false)
  })

  it('requires canGenerate on a contract row', () => {
    const row = {
      subject: 'MAT', subjectName: 'Matematik', kertas: 2, source: 'Spec', code: '1449/2', durationMin: 150,
      sections: [{ label: 'Bahagian A', take: 10 }],
    }
    expect(BijakBlueprintContractSchema.safeParse(row).success).toBe(false)
    expect(BijakBlueprintContractSchema.safeParse({ ...row, canGenerate: true }).success).toBe(true)
    expect(
      BijakBlueprintContractSchema.safeParse({ ...row, canGenerate: false, unavailableReason: 'NO_BLUEPRINT' }).success,
    ).toBe(true)
    expect(BijakBlueprintContractSchema.safeParse({ ...row, canGenerate: false, unavailableReason: 'LAIN' }).success).toBe(false)
  })
})

describe('openapi document', () => {
  const doc = buildOpenApiDocument() as unknown as {
    paths: Record<string, Record<string, { tags?: string[]; responses: Record<string, unknown> }>>
    components: { schemas: Record<string, unknown> }
  }

  it('registers the eleven BJS-01 operations under one tag, writes rate limited', () => {
    const mine: string[] = []
    for (const [path, ops] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        if (op.tags?.includes(BIJAK_STANDARDS_TAG)) {
          mine.push(`${method} ${path}`)
          if (method !== 'get') expect(op.responses['429'], `${method} ${path}`).toBeDefined()
        }
      }
    }
    expect(mine.sort()).toEqual([
      'delete /admin/blueprints/{subject}/{kertas}/evidence/{evidenceId}',
      'get /admin/bijak/dskp/units',
      'get /admin/bijak/subjects',
      'get /admin/blueprints/{subject}/{kertas}/evidence',
      'get /admin/blueprints/{subject}/{kertas}/pool',
      'get /admin/blueprints/{subject}/{kertas}/verification',
      'get /admin/blueprints/{subject}/{kertas}/versions',
      'post /admin/blueprints/{subject}/{kertas}/evidence',
      'post /admin/blueprints/{subject}/{kertas}/sections/{position}/review',
      'post /admin/blueprints/{subject}/{kertas}/verify',
      'post /admin/papers/generate',
    ].sort())
  })

  it('emits every component and documents 503 on generate', () => {
    for (const name of Object.keys(BIJAK_STANDARDS_COMPONENT_SCHEMAS)) {
      expect(doc.components.schemas[name], name).toBeDefined()
    }
    expect(doc.paths['/bijak/papers/generate']!.post!.responses['503']).toBeDefined()
    expect(doc.paths['/admin/papers/generate']!.post!.responses['503']).toBeDefined()
    expect(doc.paths['/admin/blueprints']!.post!.responses['422']).toBeDefined()
  })

  it('exposes needsReview and reviewPapers as required response fields of BijakBlueprintView', () => {
    const view = doc.components.schemas['BijakBlueprintView'] as { required?: string[] }
    expect(view.required).toEqual(expect.arrayContaining(['needsReview', 'reviewPapers', 'version', 'servesStudents', 'verification']))
  })
})
