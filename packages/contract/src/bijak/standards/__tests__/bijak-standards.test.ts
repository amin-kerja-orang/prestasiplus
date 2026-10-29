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
  BijakEvidenceInputSchema,
  BijakEvidenceItemSchema,
  BijakPoolPreviewSchema,
  BijakVerificationFailedErrorSchema,
  BijakVerificationStateSchema,
  BijakVerifyInputSchema,
} from '../admin'
import { BIJAK_STANDARDS_COMPONENT_SCHEMAS, BIJAK_STANDARDS_TAG } from '../paths'
import {
  BijakDifficultyProfileSchema,
  BijakSlotGroupSchema,
  BijakTopicQuotaSchema,
  BijakUnitRefSchema,
} from '../schema'

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
    verdict: 'tidak_boleh',
    firstFailure: { section: 'Bahagian A', need: 5, have: 3, kind: 'unit', basis: 'questions', unit: { kind: 'unit', nodeId: '101', code: '1.0', level: 'T4', title: 'Fungsi' } },
    excluded: {
      total: 4,
      byReason: [{ reason: 'no_cognitive_level', count: 4, bankQuery: { subject: 'MAT', missing: 'cognitive_level' } }],
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
    expect(
      BijakGenerateLimitErrorSchema.safeParse({
        error: { code: 'GENERATE_LIMIT', message: 'Kertas tidak dapat disusun sekarang. Cuba lagi.', details },
      }).success,
    ).toBe(true)
    expect(
      BijakGenerateLimitErrorSchema.safeParse({ error: { code: 'GENERATE_LIMIT', message: 'x', details } }).success,
    ).toBe(false)
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

  it('registers the eight BJS-01 operations under one tag, writes rate limited', () => {
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
      'get /admin/blueprints/{subject}/{kertas}/evidence',
      'get /admin/blueprints/{subject}/{kertas}/pool',
      'get /admin/blueprints/{subject}/{kertas}/verification',
      'get /admin/blueprints/{subject}/{kertas}/versions',
      'post /admin/blueprints/{subject}/{kertas}/evidence',
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
