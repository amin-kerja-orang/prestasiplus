import { describe, expect, it } from 'vitest'

import { AUTH_ERROR_MESSAGES } from '../../../auth/errors'
import { envelopeOf, listEnvelopeOf } from '../../../common/envelope'
import { ErrorBodySchema } from '../../../common/error'
import { buildOpenApiDocument } from '../../../openapi'
import { BIJAK_PAPERS_COMPONENT_SCHEMAS } from '../../papers/paths'
import {
  BIJAK_BLUEPRINT_ADMIN_TAG,
  BIJAK_BUILDER_COMPONENT_SCHEMAS,
  BIJAK_BUILDER_TAG,
} from '../paths'
import {
  BIJAK_BUILDER_CONFORMANCE_RULES,
  BIJAK_BUILDER_CSRF_MESSAGE,
  BIJAK_BUILDER_MESSAGES,
  BIJAK_BUILDER_PAPER_STATUSES,
  BIJAK_BUILDER_QUESTION_STATUSES,
  BijakBlueprintAdminCreateSchema,
  BijakBlueprintAdminListQuerySchema,
  BijakBlueprintAdminSchema,
  BijakBlueprintAdminSummarySchema,
  BijakBlueprintAdminVersionInputSchema,
  BijakBuilderConformanceSchema,
  BijakBuilderCsrfErrorSchema,
  BijakBuilderDeleteResultSchema,
  BijakBuilderGroupSplitErrorSchema,
  BijakBuilderPaperInputSchema,
  BijakBuilderPaperListQuerySchema,
  BijakBuilderPaperSchema,
  BijakBuilderPaperSummarySchema,
  BijakBuilderPlacementsRequestSchema,
  BijakBuilderPublishRefusedErrorSchema,
  BijakBuilderQuestionStatusSchema,
  BijakBuilderSectionsRequestSchema,
} from '../schema'

/* No mock route exists for the builder (the admin screens are not in src/ yet): the payloads
 * below are derived from the m28 domain types (PaperDef, SectionDef, Blueprint, Shortage) and the
 * Matematik Kertas 2 seed structure (A all, B all, C choose 1 of 2). Fictitious content only. */

const TS = '2026-10-19T09:30:00+08:00'

const omit = <T extends Record<string, unknown>>(value: T, keys: string[]) =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)))

const q = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  version: 1,
  status: 'published',
  marks: 3,
  modes: ['working'],
  groupId: null,
  stemPreview: 'Selesaikan $x^2 - 5x + 6 = 0$.',
  ...over,
})
const placement = (
  id: string,
  sectionId: string,
  position: number,
  questionId: string,
  over: Record<string, unknown> = {},
) => ({
  id,
  sectionId,
  position,
  numberLabel: String(position),
  questionId,
  pinnedVersion: null,
  marksOverride: null,
  marks: 3,
  question: q(questionId),
  ...over,
})
const section = (over: Record<string, unknown> = {}) => ({
  id: 's-a',
  position: 1,
  label: 'Bahagian A',
  title: null,
  instruction: null,
  rule: { type: 'all' },
  compulsory: false,
  markBudget: 6,
  questionCount: 2,
  marks: 6,
  placements: [placement('p-1', 's-a', 1, 'q-101'), placement('p-2', 's-a', 2, 'q-102')],
  ...over,
})
const paper = (over: Record<string, unknown> = {}) => ({
  id: 'pp-1',
  title: 'Percubaan SPM Matematik Kertas 2 Set B',
  subject: 'MAT',
  subjectName: 'Matematik',
  kertas: 2,
  year: 2026,
  code: '1449/2',
  durationMin: 150,
  status: 'draft',
  version: 1,
  blueprint: { id: 'bp-mat-2', version: 1 },
  questionCount: 2,
  marks: 6,
  createdAt: TS,
  updatedAt: TS,
  publishedAt: null,
  instructions: ['Kertas ini mengandungi tiga bahagian.'],
  reference: [{ title: 'Rumus (ringkas)', items: ['Teorem Pythagoras: $c^2 = a^2 + b^2$'] }],
  sections: [section()],
  ...over,
})
const paperSummary = omit(paper(), ['instructions', 'reference', 'sections'])

const bpSection = (over: Record<string, unknown> = {}) => ({
  label: 'Bahagian A',
  rule: { type: 'all' },
  pool: 'mat-k2-a',
  take: 2,
  markBudget: 6,
  compulsory: false,
  instruction: null,
  allowedModes: ['working', 'short_text'],
  ...over,
})
const bpVersion = (over: Record<string, unknown> = {}) => ({
  version: 1,
  status: 'active',
  source: 'Disahkan',
  code: '1449/2',
  durationMin: 150,
  instructions: ['Jawab semua soalan dalam Bahagian A.'],
  reference: [],
  provenance: 'PAPER (contoh fiksyen)',
  confidence: 'High (structure) / Low (duration)',
  sections: [
    bpSection(),
    bpSection({
      label: 'Bahagian C',
      rule: { type: 'choose', n: 1 },
      pool: 'mat-k2-c',
      take: 2,
      markBudget: 15,
    }),
  ],
  questionCount: 4,
  totalMarks: 21,
  locked: false,
  createdAt: TS,
  ...over,
})
const blueprintSummary = {
  id: 'bp-mat-2',
  subject: 'MAT',
  subjectName: 'Matematik',
  kertas: 2,
  status: 'active',
  latestVersion: 1,
  versionCount: 1,
  source: 'Disahkan',
  code: '1449/2',
  durationMin: 150,
  questionCount: 4,
  totalMarks: 21,
  updatedAt: TS,
}
const blueprint = (over: Record<string, unknown> = {}) => ({
  ...blueprintSummary,
  versions: [bpVersion()],
  ...over,
})

const meta = (n: number, counts?: Record<string, number>) => ({
  page: 1,
  pageSize: 20,
  totalItems: n,
  totalPages: 1,
  from: n ? 1 : null,
  to: n || null,
  ...(counts ? { counts } : {}),
})

describe('paper header (list, detail, create/update body)', () => {
  it('parses a paper detail with sections, placements and pinned versions', () => {
    expect(envelopeOf(BijakBuilderPaperSchema).safeParse({ data: paper() }).success).toBe(true)
    const pinned = paper({
      status: 'published',
      version: 2,
      publishedAt: TS,
      sections: [
        section({
          placements: [
            placement('p-1', 's-a', 1, 'q-101', { pinnedVersion: 3 }),
            placement('p-2', 's-a', 2, 'q-102', { pinnedVersion: 1, marksOverride: 4, marks: 4 }),
          ],
        }),
      ],
    })
    expect(BijakBuilderPaperSchema.safeParse(pinned).success).toBe(true)
  })

  it('parses a paper without blueprint and without sections (fresh draft)', () => {
    expect(
      BijakBuilderPaperSchema.safeParse(
        paper({
          blueprint: null,
          sections: [],
          questionCount: 0,
          marks: 0,
          instructions: [],
          reference: [],
        }),
      ).success,
    ).toBe(true)
  })

  it('keeps the four statuses of the card and the five question codes of D54', () => {
    expect([...BIJAK_BUILDER_PAPER_STATUSES]).toEqual(['draft', 'ready', 'published', 'withdrawn'])
    expect([...BIJAK_BUILDER_QUESTION_STATUSES]).toEqual([
      'draft',
      'review',
      'approved',
      'published',
      'archived',
    ])
    expect(BijakBuilderQuestionStatusSchema.safeParse('pending_review').success).toBe(false)
    expect(BijakBuilderPaperSchema.safeParse(paper({ status: 'archived' })).success).toBe(false)
  })

  it('parses a list page with per-status counts and rejects numeric ids and extra keys', () => {
    const ok = listEnvelopeOf(BijakBuilderPaperSummarySchema).safeParse({
      data: [paperSummary],
      meta: meta(1, { draft: 1, ready: 0, published: 0, withdrawn: 0 }),
    })
    expect(ok.success).toBe(true)
    expect(BijakBuilderPaperSummarySchema.safeParse({ ...paperSummary, id: 7 }).success).toBe(false)
    expect(
      BijakBuilderPaperSummarySchema.safeParse({ ...paperSummary, sections: [] }).success,
    ).toBe(false)
    expect(
      BijakBuilderPaperSummarySchema.safeParse({
        ...paperSummary,
        updatedAt: '2026-10-19T09:30:00Z',
      }).success,
    ).toBe(false)
  })

  it('accepts a header body, with or without a blueprint, and rejects bad input', () => {
    const body = {
      title: 'Percubaan SPM Matematik Kertas 2 Set B',
      subject: 'MAT',
      kertas: 2,
      year: 2026,
      code: '1449/2',
      durationMin: 150,
    }
    expect(BijakBuilderPaperInputSchema.safeParse(body).success).toBe(true)
    expect(
      BijakBuilderPaperInputSchema.safeParse({ ...body, blueprint: { id: 'bp-mat-2', version: 1 } })
        .success,
    ).toBe(true)
    expect(BijakBuilderPaperInputSchema.safeParse({ ...body, blueprint: null }).success).toBe(true)
    expect(BijakBuilderPaperInputSchema.safeParse({ ...body, title: '   ' }).success).toBe(false)
    expect(BijakBuilderPaperInputSchema.safeParse({ ...body, kertas: '2' }).success).toBe(false)
    expect(BijakBuilderPaperInputSchema.safeParse({ ...body, durationMin: 0 }).success).toBe(false)
    expect(BijakBuilderPaperInputSchema.safeParse({ ...body, year: 1.5 }).success).toBe(false)
    expect(BijakBuilderPaperInputSchema.safeParse({ ...body, status: 'published' }).success).toBe(
      false,
    )
    expect(BijakBuilderPaperInputSchema.safeParse({ ...body, version: 3 }).success).toBe(false)
    expect(
      BijakBuilderPaperInputSchema.safeParse({ ...body, blueprint: { id: 'bp', version: 0 } })
        .success,
    ).toBe(false)
    const noCode = omit(body, ['code'])
    expect(BijakBuilderPaperInputSchema.safeParse(noCode).success).toBe(false)
  })

  it('parses the list query (coerced) and rejects an unknown status', () => {
    const parsed = BijakBuilderPaperListQuerySchema.parse({
      page: '2',
      pageSize: '50',
      status: 'ready',
      subject: 'MAT',
      kertas: '2',
      q: 'Set B',
    })
    expect(parsed).toMatchObject({ page: 2, pageSize: 50, kertas: 2, status: 'ready' })
    expect(BijakBuilderPaperListQuerySchema.safeParse({}).success).toBe(true)
    expect(BijakBuilderPaperListQuerySchema.safeParse({ status: 'draf' }).success).toBe(false)
    expect(BijakBuilderPaperListQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false)
  })

  it('carries the delete result as { deleted: 1 }', () => {
    expect(
      envelopeOf(BijakBuilderDeleteResultSchema).safeParse({ data: { deleted: 1 } }).success,
    ).toBe(true)
    expect(BijakBuilderDeleteResultSchema.safeParse({ deleted: 0 }).success).toBe(false)
  })
})

describe('sections and placements bodies', () => {
  it('accepts sections with all and choose-N rules (mock Matematik Kertas 2 structure)', () => {
    const body = {
      sections: [
        { id: 's-a', label: 'Bahagian A', rule: { type: 'all' }, markBudget: 40 },
        {
          label: 'Bahagian B',
          rule: { type: 'all' },
          markBudget: 45,
          instruction: 'Jawab semua soalan.',
        },
        {
          label: 'Bahagian C',
          title: null,
          rule: { type: 'choose', n: 1 },
          markBudget: 15,
          compulsory: false,
        },
      ],
    }
    expect(BijakBuilderSectionsRequestSchema.safeParse(body).success).toBe(true)
    expect(BijakBuilderSectionsRequestSchema.safeParse({ sections: [] }).success).toBe(true)
  })

  it('rejects a bad rule, a negative budget, an empty label and unknown keys', () => {
    const base = { label: 'Bahagian A', rule: { type: 'all' }, markBudget: 10 }
    const parse = (s: unknown) =>
      BijakBuilderSectionsRequestSchema.safeParse({ sections: [s] }).success
    expect(parse(base)).toBe(true)
    expect(parse({ ...base, rule: { type: 'choose' } })).toBe(false)
    expect(parse({ ...base, rule: { type: 'choose', n: 0 } })).toBe(false)
    expect(parse({ ...base, rule: { type: 'any' } })).toBe(false)
    expect(parse({ ...base, rule: { type: 'all', n: 2 } })).toBe(false)
    expect(parse({ ...base, markBudget: -1 })).toBe(false)
    expect(parse({ ...base, label: ' ' })).toBe(false)
    expect(parse({ ...base, questionCount: 3 })).toBe(false)
    expect(parse({ ...base, marks: 3 })).toBe(false)
  })

  it('accepts ordered placements with pin, label and marks override', () => {
    const body = {
      placements: [
        { sectionId: 's-a', questionId: 'q-101' },
        {
          sectionId: 's-a',
          questionId: 'q-102',
          numberLabel: '2',
          marksOverride: 4,
          pinnedVersion: 2,
        },
        {
          sectionId: 's-c',
          questionId: 'q-201',
          numberLabel: null,
          marksOverride: null,
          pinnedVersion: null,
        },
      ],
    }
    expect(BijakBuilderPlacementsRequestSchema.safeParse(body).success).toBe(true)
    expect(BijakBuilderPlacementsRequestSchema.safeParse({ placements: [] }).success).toBe(true)
  })

  it('rejects a question placed twice with the BM message, and malformed placements', () => {
    const dup = BijakBuilderPlacementsRequestSchema.safeParse({
      placements: [
        { sectionId: 's-a', questionId: 'q-101' },
        { sectionId: 's-c', questionId: 'q-101' },
      ],
    })
    expect(dup.success).toBe(false)
    expect(dup.error?.issues[0]?.message).toBe(BIJAK_BUILDER_MESSAGES.duplicateQuestion)
    const parse = (p: unknown) =>
      BijakBuilderPlacementsRequestSchema.safeParse({ placements: [p] }).success
    expect(parse({ sectionId: 's-a', questionId: 'q-1' })).toBe(true)
    expect(parse({ questionId: 'q-1' })).toBe(false)
    expect(parse({ sectionId: 's-a' })).toBe(false)
    expect(parse({ sectionId: 's-a', questionId: 'q-1', pinnedVersion: 0 })).toBe(false)
    expect(parse({ sectionId: 's-a', questionId: 'q-1', marksOverride: -2 })).toBe(false)
    expect(parse({ sectionId: 's-a', questionId: 7 })).toBe(false)
    expect(parse({ sectionId: 's-a', questionId: 'q-1', status: 'published' })).toBe(false)
  })

  it('returns a placement without any answer key or scheme (admin view shows ids and marks only)', () => {
    const withScheme = paper({
      sections: [
        section({
          placements: [
            placement('p-1', 's-a', 1, 'q-101', {
              question: q('q-101', { scheme: { kind: 'option' } }),
            }),
          ],
        }),
      ],
    })
    expect(BijakBuilderPaperSchema.safeParse(withScheme).success).toBe(false)
  })
})

describe('conformance report (AC 1: one gap per rule)', () => {
  const base = {
    paperId: 'pp-1',
    status: 'draft',
    blueprint: { id: 'bp-mat-2', version: 1 },
    conforms: false,
    publishable: false,
    totals: { questionCount: 3, expectedQuestionCount: 4, marks: 12, expectedMarks: 21 },
    sections: [
      {
        sectionId: 's-a',
        label: 'Bahagian A',
        blueprintSection: 'Bahagian A',
        questionCount: 2,
        expectedCount: 2,
        marks: 6,
        expectedMarks: 6,
        ok: true,
      },
      {
        sectionId: 's-c',
        label: 'Bahagian C',
        blueprintSection: 'Bahagian C',
        questionCount: 1,
        expectedCount: 2,
        marks: 6,
        expectedMarks: 15,
        ok: false,
      },
    ],
    issues: [],
    shortages: [],
  }
  const issue = (rule: string, over: Record<string, unknown> = {}) => ({
    rule,
    sectionId: 's-c',
    sectionLabel: 'Bahagian C',
    questionId: null,
    expected: 15,
    actual: 6,
    message: 'Bahagian C: markah 6, perlu 15',
    ...over,
  })

  it('lists one gap for each rule of the card with section and rule', () => {
    const issues = [
      issue('marks_budget'),
      issue('count', {
        expected: 2,
        actual: 1,
        message: 'Bahagian C: perlu 2 soalan, hanya 1 tersedia',
      }),
      issue('mode', {
        questionId: 'q-201',
        expected: 'working, short_text',
        actual: 'essay',
        message: 'Bahagian C: mod jawapan tidak dibenarkan',
      }),
      issue('choose_n', {
        expected: 'choose 1',
        actual: 'all',
        message: 'Bahagian C: peraturan tidak sepadan',
      }),
    ]
    const parsed = envelopeOf(BijakBuilderConformanceSchema).safeParse({
      data: { ...base, issues, shortages: [{ section: 'Bahagian C', need: 2, have: 1 }] },
    })
    expect(parsed.success).toBe(true)
    expect(issues.map((i) => i.rule)).toEqual(['marks_budget', 'count', 'mode', 'choose_n'])
    for (const rule of ['marks_budget', 'count', 'mode', 'choose_n']) {
      expect(BIJAK_BUILDER_CONFORMANCE_RULES).toContain(rule)
    }
  })

  it('also covers section, group integrity, question status and blueprint gaps', () => {
    const issues = [
      issue('section', {
        expected: 'Bahagian D',
        actual: null,
        message: 'Bahagian D tiada dalam kontrak',
      }),
      issue('group_integrity', { questionId: 'q-203', sectionId: null, sectionLabel: null }),
      issue('question_status', { questionId: 'q-204', expected: 'published', actual: 'approved' }),
      issue('blueprint', { sectionId: null, sectionLabel: null, expected: null, actual: null }),
    ]
    expect(BijakBuilderConformanceSchema.safeParse({ ...base, issues }).success).toBe(true)
    expect(
      BijakBuilderConformanceSchema.safeParse({ ...base, issues: [issue('speed')] }).success,
    ).toBe(false)
  })

  it('parses a clean report and a paper without blueprint', () => {
    expect(
      BijakBuilderConformanceSchema.safeParse({
        ...base,
        status: 'ready',
        conforms: true,
        publishable: true,
        sections: base.sections.map((s) => ({ ...s, ok: true })),
      }).success,
    ).toBe(true)
    expect(
      BijakBuilderConformanceSchema.safeParse({
        ...base,
        blueprint: null,
        totals: { questionCount: 0, expectedQuestionCount: null, marks: 0, expectedMarks: null },
        sections: [],
        issues: [
          issue('blueprint', { sectionId: null, sectionLabel: null, expected: null, actual: null }),
        ],
      }).success,
    ).toBe(true)
  })

  it('rejects a malformed shortage and a missing flag', () => {
    expect(
      BijakBuilderConformanceSchema.safeParse({ ...base, shortages: [{ section: 'A', need: 3 }] })
        .success,
    ).toBe(false)
    const noFlag = omit(base, ['publishable'])
    expect(BijakBuilderConformanceSchema.safeParse(noFlag).success).toBe(false)
  })
})

describe('error bodies', () => {
  it('parses the publish refusal (422 VALIDATION_ERROR, new BM copy) with issues and shortages', () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: BIJAK_BUILDER_MESSAGES.publishRefused,
        details: {
          issues: [
            {
              rule: 'question_status',
              sectionId: 's-a',
              sectionLabel: 'Bahagian A',
              questionId: 'q-102',
              expected: 'published',
              actual: 'approved',
              message: 'Soalan q-102 belum diterbitkan',
            },
          ],
          shortages: [{ section: 'Bahagian C', need: 2, have: 1 }],
        },
      },
    }
    expect(BijakBuilderPublishRefusedErrorSchema.safeParse(body).success).toBe(true)
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
    expect(
      BijakBuilderPublishRefusedErrorSchema.safeParse({
        error: { ...body.error, details: { issues: [], shortages: [] } },
      }).success,
    ).toBe(false)
    expect(
      BijakBuilderPublishRefusedErrorSchema.safeParse({
        error: { ...body.error, message: 'lain' },
      }).success,
    ).toBe(false)
  })

  it('parses the group-split refusal (AC 3) and rejects a single-question "group"', () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: BIJAK_BUILDER_MESSAGES.groupSplit,
        fields: { placements: BIJAK_BUILDER_MESSAGES.groupSplit },
        details: { groups: [{ groupId: 'g-1', questionIds: ['q-301', 'q-302', 'q-303'] }] },
      },
    }
    expect(BijakBuilderGroupSplitErrorSchema.safeParse(body).success).toBe(true)
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
    expect(
      BijakBuilderGroupSplitErrorSchema.safeParse({
        error: { ...body.error, details: { groups: [{ groupId: 'g-1', questionIds: ['q-301'] }] } },
      }).success,
    ).toBe(false)
  })

  it('parses the CSRF_INVALID body with the shared auth copy', () => {
    const body = { error: { code: 'CSRF_INVALID', message: AUTH_ERROR_MESSAGES.CSRF_INVALID } }
    expect(BIJAK_BUILDER_CSRF_MESSAGE).toBe(AUTH_ERROR_MESSAGES.CSRF_INVALID)
    expect(BijakBuilderCsrfErrorSchema.safeParse(body).success).toBe(true)
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
    expect(
      BijakBuilderCsrfErrorSchema.safeParse({ error: { code: 'FORBIDDEN', message: 'x' } }).success,
    ).toBe(false)
  })

  it('keeps the mock copy for "Kertas tidak ditemui" and every new message non-empty', () => {
    expect(BIJAK_BUILDER_MESSAGES.paperNotFound).toBe('Kertas tidak ditemui')
    for (const text of Object.values(BIJAK_BUILDER_MESSAGES)) expect(text.length).toBeGreaterThan(5)
  })
})

describe('blueprint admin', () => {
  const createBody = {
    subject: 'MAT',
    kertas: 2,
    source: 'Draf',
    code: '1449/2',
    durationMin: 150,
    sections: [
      { label: 'Bahagian A', rule: { type: 'all' }, pool: 'mat-k2-a', take: 10, markBudget: 40 },
      {
        label: 'Bahagian C',
        rule: { type: 'choose', n: 1 },
        pool: 'mat-k2-c',
        take: 2,
        markBudget: 15,
        allowedModes: ['working'],
      },
    ],
  }

  it('parses a blueprint with versions, provenance and the locked flag', () => {
    const locked = blueprint({
      latestVersion: 2,
      versionCount: 2,
      versions: [
        bpVersion({ version: 2, source: 'Spec' }),
        bpVersion({ version: 1, locked: true }),
      ],
    })
    expect(envelopeOf(BijakBlueprintAdminSchema).safeParse({ data: locked }).success).toBe(true)
    expect(
      listEnvelopeOf(BijakBlueprintAdminSummarySchema).safeParse({
        data: [blueprintSummary],
        meta: meta(1),
      }).success,
    ).toBe(true)
  })

  it('accepts the three provenance tags and a retired status, and rejects any other', () => {
    for (const source of ['Disahkan', 'Spec', 'Draf']) {
      expect(BijakBlueprintAdminCreateSchema.safeParse({ ...createBody, source }).success).toBe(
        true,
      )
    }
    expect(
      BijakBlueprintAdminCreateSchema.safeParse({ ...createBody, source: 'Rasmi' }).success,
    ).toBe(false)
    expect(
      BijakBlueprintAdminSummarySchema.safeParse({ ...blueprintSummary, status: 'retired' })
        .success,
    ).toBe(true)
    expect(
      BijakBlueprintAdminSummarySchema.safeParse({ ...blueprintSummary, status: 'draft' }).success,
    ).toBe(false)
  })

  it('accepts the create body and the version body (no subject/kertas) and rejects the wrong one', () => {
    expect(BijakBlueprintAdminCreateSchema.safeParse(createBody).success).toBe(true)
    const versionBody = omit(createBody, ['subject', 'kertas'])
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(versionBody).success).toBe(true)
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(createBody).success).toBe(false)
    expect(BijakBlueprintAdminCreateSchema.safeParse(versionBody).success).toBe(false)
  })

  it('rejects bad blueprint sections: no sections, take 0, mode outside D2, mark budget missing', () => {
    const sec = createBody.sections[0]!
    const parse = (sections: unknown) =>
      BijakBlueprintAdminCreateSchema.safeParse({ ...createBody, sections }).success
    expect(parse([sec])).toBe(true)
    expect(parse([])).toBe(false)
    expect(parse([{ ...sec, take: 0 }])).toBe(false)
    expect(parse([{ ...sec, markBudget: -1 }])).toBe(false)
    expect(parse([{ ...sec, allowedModes: ['true_false'] }])).toBe(false)
    expect(parse([{ ...sec, rule: { type: 'choose' } }])).toBe(false)
    const noPool = omit(sec, ['pool'])
    expect(parse([noPool])).toBe(false)
    const noBudget = omit(sec, ['markBudget'])
    expect(parse([noBudget])).toBe(false)
    expect(
      BijakBlueprintAdminCreateSchema.safeParse({ ...createBody, durationMin: 0 }).success,
    ).toBe(false)
    expect(BijakBlueprintAdminCreateSchema.safeParse({ ...createBody, version: 3 }).success).toBe(
      false,
    )
  })

  it('parses the list query', () => {
    expect(
      BijakBlueprintAdminListQuerySchema.parse({ subject: 'MAT', kertas: '2', status: 'active' }),
    ).toMatchObject({ kertas: 2, status: 'active' })
    expect(BijakBlueprintAdminListQuerySchema.safeParse({ status: 'draft' }).success).toBe(false)
  })
})

describe('openapi document', () => {
  type Op = {
    tags?: string[]
    summary?: string
    responses: Record<string, unknown>
    parameters?: { name: string; in: string }[]
    requestBody?: unknown
  }
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, Op>>
    components: { schemas: Record<string, unknown> }
  }
  const ops = Object.entries(doc.paths).flatMap(([path, item]) =>
    Object.entries(item).map(([method, op]) => ({ path, method, op })),
  )
  const mine = ops.filter(
    (o) => o.op.tags?.includes(BIJAK_BUILDER_TAG) || o.op.tags?.includes(BIJAK_BLUEPRINT_ADMIN_TAG),
  )

  it('has the 15 operations of the card, 10 paper and 5 blueprint, under /admin only', () => {
    const keys = mine.map((o) => `${o.method} ${o.path}`).sort()
    expect(keys).toEqual(
      [
        'get /admin/papers',
        'post /admin/papers',
        'get /admin/papers/{id}',
        'put /admin/papers/{id}',
        'delete /admin/papers/{id}',
        'put /admin/papers/{id}/sections',
        'put /admin/papers/{id}/placements',
        'get /admin/papers/{id}/conformance',
        'post /admin/papers/{id}/publish',
        'post /admin/papers/{id}/withdraw',
        'get /admin/blueprints',
        'post /admin/blueprints',
        'get /admin/blueprints/{id}',
        'post /admin/blueprints/{id}/versions',
        'post /admin/blueprints/{id}/retire',
      ].sort(),
    )
    expect(mine.filter((o) => o.op.tags?.includes(BIJAK_BUILDER_TAG))).toHaveLength(10)
    expect(mine.filter((o) => o.op.tags?.includes(BIJAK_BLUEPRINT_ADMIN_TAG))).toHaveLength(5)
    expect(mine).toHaveLength(15)
    expect(mine.every((o) => o.path.startsWith('/admin/'))).toBe(true)
  })

  it('answers 401 and 403 on every route and 404 on every route with an id', () => {
    for (const { path, method, op } of mine) {
      expect(op.responses['401'], `${method} ${path} 401`).toBeDefined()
      expect(op.responses['403'], `${method} ${path} 403`).toBeDefined()
      if (path.includes('{id}')) expect(op.responses['404'], `${method} ${path} 404`).toBeDefined()
    }
  })

  it('requires X-CSRF-Token on every mutation and on no read', () => {
    for (const { path, method, op } of mine) {
      const hasCsrf = (op.parameters ?? []).some(
        (p) => p.name === 'X-CSRF-Token' && p.in === 'header',
      )
      expect(hasCsrf, `${method} ${path}`).toBe(method !== 'get')
    }
  })

  it('documents CSRF_INVALID on the 403 of every mutation', () => {
    const json = JSON.stringify(doc)
    expect(json).toContain('BijakBuilderCsrfError')
    for (const { path, method, op } of mine.filter((o) => o.method !== 'get')) {
      expect(JSON.stringify(op.responses['403']), `${method} ${path}`).toContain('CSRF_INVALID')
    }
  })

  it('documents 429 RATE_LIMITED with retryAfter and a Retry-After header on every write route (D57a)', () => {
    type R429 = {
      description: string
      headers: Record<string, { schema: { type: string } }>
      content: Record<string, { schema: { $ref: string } }>
    }
    const writes = mine.filter((o) => o.method !== 'get')
    expect(writes).toHaveLength(10)
    for (const { path, method, op } of writes) {
      const r = op.responses['429'] as R429 | undefined
      expect(r, `${method} ${path}`).toBeDefined()
      expect(r!.description, `${method} ${path}`).toContain('RATE_LIMITED')
      expect(r!.description, `${method} ${path}`).toContain('retryAfter')
      expect(r!.headers['Retry-After'], `${method} ${path}`).toBeDefined()
      expect(r!.headers['Retry-After']!.schema.type).toBe('integer')
      expect(r!.content['application/json']!.schema.$ref).toBe('#/components/schemas/ErrorBody')
    }
  })

  it('sends no credential or token on any route of the card, so none needs Cache-Control: no-store (D57b)', () => {
    for (const { path, method, op } of mine) {
      for (const [status, r] of Object.entries(op.responses as Record<string, { headers?: object }>)) {
        expect(Object.keys(r.headers ?? {}), `${method} ${path} ${status}`).not.toContain('Cache-Control')
      }
    }
  })

  it('has the documented status codes of the key routes', () => {
    const codes = (path: string, method: string) =>
      Object.keys(doc.paths[path]?.[method]?.responses ?? {}).sort()
    expect(codes('/admin/papers', 'post')).toEqual(['201', '401', '403', '404', '422', '429'])
    expect(codes('/admin/papers/{id}', 'delete')).toEqual(['200', '401', '403', '404', '409', '429'])
    expect(codes('/admin/papers/{id}/placements', 'put')).toEqual([
      '200',
      '401',
      '403',
      '404',
      '409',
      '422',
      '429',
    ])
    expect(codes('/admin/papers/{id}/publish', 'post')).toEqual([
      '200',
      '401',
      '403',
      '404',
      '409',
      '422',
      '429',
    ])
    expect(codes('/admin/papers/{id}/withdraw', 'post')).toEqual([
      '200',
      '401',
      '403',
      '404',
      '409',
      '429',
    ])
    expect(codes('/admin/papers/{id}/conformance', 'get')).toEqual(['200', '401', '403', '404'])
    expect(codes('/admin/blueprints', 'post')).toEqual(['201', '401', '403', '409', '422', '429'])
    expect(codes('/admin/blueprints/{id}/versions', 'post')).toEqual([
      '201',
      '401',
      '403',
      '404',
      '409',
      '422',
      '429',
    ])
    expect(codes('/admin/blueprints/{id}/retire', 'post')).toEqual([
      '200',
      '401',
      '403',
      '404',
      '409',
      '429',
    ])
  })

  it('takes no body on publish, withdraw and retire, and a body on the other mutations', () => {
    const noBody = [
      '/admin/papers/{id}/publish',
      '/admin/papers/{id}/withdraw',
      '/admin/blueprints/{id}/retire',
    ]
    for (const path of noBody) expect(doc.paths[path]?.post?.requestBody, path).toBeUndefined()
    for (const { path, method, op } of mine.filter(
      (o) => o.method !== 'get' && o.method !== 'delete' && !noBody.includes(o.path),
    )) {
      expect(op.requestBody, `${method} ${path}`).toBeDefined()
    }
  })

  it('registers every builder component, prefixed and distinct from the bijak/papers ids', () => {
    const ids = Object.keys(BIJAK_BUILDER_COMPONENT_SCHEMAS)
    expect(ids.length).toBeGreaterThan(25)
    const papersIds = new Set(Object.keys(BIJAK_PAPERS_COMPONENT_SCHEMAS))
    for (const id of ids) {
      expect(id, id).toMatch(/^(BijakBuilder|BijakBlueprintAdmin)/)
      expect(papersIds.has(id), `${id} clashes with bijak/papers`).toBe(false)
      expect(doc.components.schemas[id], id).toBeDefined()
    }
    for (const id of ['BijakBuilderPaper', 'BijakBuilderConformance', 'BijakBlueprintAdmin']) {
      expect(ids).toContain(id)
    }
  })

  it('does not leak an answer key or scheme into any builder component', () => {
    const text = JSON.stringify(
      Object.fromEntries(
        Object.entries(doc.components.schemas).filter(([k]) =>
          /^(BijakBuilder|BijakBlueprintAdmin)/.test(k),
        ),
      ),
    )
    for (const word of ['"scheme"', '"correct"', '"accepted"', '"explanation"', '"answerKey"']) {
      expect(text).not.toContain(word)
    }
  })
})
