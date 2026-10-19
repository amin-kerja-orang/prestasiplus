import { describe, expect, it } from 'vitest'

import { AUTH_ERROR_MESSAGES } from '../../../auth/errors'
import { envelopeOf, listEnvelopeOf } from '../../../common/envelope'
import { buildOpenApiDocument } from '../../../openapi'
import { BIJAK_PAPERS_COMPONENT_SCHEMAS } from '../../papers/paths'
import { BIJAK_ATTEMPTS_COMPONENT_SCHEMAS } from '../../attempts/paths'
import {
  BIJAK_BLUEPRINT_ADMIN_TAG,
  BIJAK_BUILDER_COMPONENT_SCHEMAS,
  BIJAK_BUILDER_TAG,
} from '../paths'
import {
  BIJAK_BUILDER_CHECK_LINES,
  BIJAK_BUILDER_CSRF_MESSAGE,
  BIJAK_BUILDER_MESSAGES,
  BIJAK_BUILDER_PAPER_STATUSES,
  BijakBlueprintAdminCreateSchema,
  BijakBlueprintAdminVersionInputSchema,
  BijakBlueprintListQuerySchema,
  BijakBlueprintViewSchema,
  BijakBuilderCsrfErrorSchema,
  BijakBuilderEditorSchema,
  BijakBuilderGroupSchema,
  BijakBuilderOkSchema,
  BijakBuilderPaperCreateResultSchema,
  BijakBuilderPaperCreateSchema,
  BijakBuilderPaperListQuerySchema,
  BijakBuilderPaperPatchSchema,
  BijakBuilderPaperSchema,
  BijakBuilderPaperSummarySchema,
  BijakBuilderPreviewRequestSchema,
  BijakBuilderPreviewSchema,
  BijakBuilderPublishResultSchema,
  BijakBuilderQuestionSchema,
} from '../schema'

/* Fixtures are shaped like the data of the prototype paper-builder mock (snapshot in
 * docs/reference/bijak-paper-builder-mock/): AdminPaper (extends PaperDef), AdminPaperSummary,
 * BuilderQuestion, BuilderGroup, PaperEditorData, BlueprintView, previewQuestions, publishPaper.
 * Ids and the Matematik Kertas 2 seed structure (A all, B all, C choose 1 of 2) follow the mock
 * seed (kp-N paper ids, kp-N-sN section ids, mat2-* question ids). The only differences are the
 * wire timestamps (the mock keeps epoch numbers) and the D54 question status codes. */

const TS = '2026-10-19T09:30:00+08:00'
const TS2 = '2026-10-19T10:00:00+08:00'

const section = (over: Record<string, unknown> = {}) => ({
  id: 'kp-2-s1',
  label: 'Bahagian A',
  markBudget: 6,
  questionCount: 2,
  rule: { type: 'all' },
  questionIds: ['mat2-algebra-v1', 'mat2-diskaun-v2'],
  ...over,
})
const paper = (over: Record<string, unknown> = {}) => ({
  id: 'kp-2',
  title: 'Percubaan SPM Matematik Kertas 2 Set B',
  subject: 'MAT',
  kertas: 2,
  year: 2026,
  code: '1449/2',
  durationMin: 150,
  instructions: ['Kertas ini mengandungi tiga bahagian.'],
  reference: [{ title: 'Rumus (ringkas)', items: ['Teorem Pythagoras: $c^2 = a^2 + b^2$'] }],
  sections: [section()],
  status: 'draf',
  createdAt: TS,
  updatedAt: TS,
  ...over,
})
const summary = (over: Record<string, unknown> = {}) => ({
  id: 'kp-2',
  title: 'Percubaan SPM Matematik Kertas 2 Set B',
  subject: 'MAT',
  subjectName: 'Matematik',
  kertas: 2,
  code: '1449/2',
  status: 'draf',
  questionCount: 2,
  marks: 6,
  budget: 6,
  ok: true,
  updatedAt: TS,
  ...over,
})
const bq = (over: Record<string, unknown> = {}) => ({
  id: 'mat2-algebra-v1',
  preview: 'Selesaikan $x^2 - 5x + 6 = 0$.',
  marks: 3,
  kind: 'berstruktur',
  topic: 'Fungsi dan Persamaan Kuadratik',
  status: 'published',
  kertas: 2,
  subject: 'MAT',
  ...over,
})
const stimulus = (over: Record<string, unknown> = {}) => ({
  id: 'st-1',
  kind: 'diagram',
  label: 'Rajah 2',
  alt: 'Dua bentuk geometri',
  ...over,
})
const REVIEW_Q = {
  id: 'mat2-algebra-v1',
  stem: 'Selesaikan $x^2 - 5x + 6 = 0$.',
  marks: 3,
  curriculum: {
    subject: 'MAT',
    level: 'T4',
    unit: 'T4-02',
    unitLabel: 'Fungsi dan Persamaan Kuadratik',
    sp: ['2.2.1'],
    tp: 3,
    formOrigin: 'T4',
  },
  parts: [
    {
      id: 'mat2-algebra-v1-a',
      label: '(a)',
      prompt: 'Cari nilai $x$.',
      marks: 3,
      answer: { kind: 'working' },
    },
  ],
  scheme: {
    'mat2-algebra-v1-a': {
      marks: 3,
      lines: [{ tag: 'K1', text: 'Memfaktorkan', marks: 1 }, { text: 'Jawapan akhir: $x = 2, 3$' }],
    },
  },
}
const bpSection = (over: Record<string, unknown> = {}) => ({
  label: 'Bahagian A',
  markBudget: 6,
  questionCount: 2,
  compulsory: false,
  instruction: '',
  rule: { type: 'all' },
  pool: 'mat-k2-a',
  ...over,
})
const bpView = (over: Record<string, unknown> = {}) => ({
  subject: 'MAT',
  subjectName: 'Matematik',
  kertas: 2,
  source: 'Disahkan',
  code: '1449/2',
  durationMin: 150,
  instructions: ['Jawab semua soalan.'],
  totalMarks: 26,
  sections: [
    bpSection(),
    bpSection({
      label: 'Bahagian C',
      markBudget: 20,
      questionCount: 2,
      compulsory: true,
      instruction: 'Jawab 1 daripada 2 soalan.',
      rule: { type: 'choose', n: 1 },
      pool: 'mat-k2-c',
    }),
  ],
  ...over,
})
const bpSectionInput = (over: Record<string, unknown> = {}) => ({
  label: 'Bahagian A',
  markBudget: 6,
  questionCount: 2,
  rule: { type: 'all' },
  pool: 'mat-k2-a',
  ...over,
})
const bpInput = (over: Record<string, unknown> = {}) => ({
  source: 'Spec',
  code: '1449/2',
  durationMin: 150,
  sections: [bpSectionInput()],
  ...over,
})
const meta = { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, from: 1, to: 1 }

describe('AdminPaper and AdminPaperSummary (mock shapes)', () => {
  it('has the two statuses of the mock, draf and terbit, and no ready or withdrawn', () => {
    expect([...BIJAK_BUILDER_PAPER_STATUSES]).toEqual(['draf', 'terbit'])
    expect(
      BijakBuilderPaperSchema.safeParse(paper({ status: 'terbit', publishedAt: TS2 })).success,
    ).toBe(true)
    for (const bad of ['draft', 'ready', 'published', 'withdrawn']) {
      expect(BijakBuilderPaperSchema.safeParse(paper({ status: bad })).success, bad).toBe(false)
    }
  })

  it('carries instructions, reference, createdAt, publishedAt? and a per-section questionCount', () => {
    const parsed = BijakBuilderPaperSchema.parse(
      paper({
        sections: [
          section(),
          section({
            id: 'kp-2-s3',
            label: 'Bahagian C',
            markBudget: 20,
            questionCount: 2,
            rule: { type: 'choose', n: 1 },
            compulsory: true,
            instruction: 'Jawab 1 daripada 2 soalan.',
            questionIds: [],
          }),
        ],
      }),
    )
    expect(parsed.instructions).toHaveLength(1)
    expect(parsed.createdAt).toBe(TS)
    expect(parsed.publishedAt).toBeUndefined()
    expect(parsed.sections[1]!.questionCount).toBe(2)
    expect(BijakBuilderPaperSchema.safeParse(paper({ reference: undefined })).success).toBe(true)
    expect(BijakBuilderPaperSchema.safeParse({ ...paper(), instructions: undefined }).success).toBe(
      false,
    )
    expect(
      BijakBuilderPaperSchema.safeParse(
        paper({ sections: [section({ questionCount: undefined })] }),
      ).success,
    ).toBe(false)
  })

  it('does not expose the conformance result on AdminPaper (the mock keeps checkOf server-side)', () => {
    expect(BijakBuilderPaperSchema.safeParse(paper({ checks: [] })).success).toBe(false)
    expect(BijakBuilderPaperSchema.safeParse(paper({ budget: 6, ok: true })).success).toBe(false)
  })

  it('rejects the old paper model: placements, blueprint ref, numeric ids and extra keys', () => {
    expect(BijakBuilderPaperSchema.safeParse(paper({ id: 12 })).success).toBe(false)
    expect(
      BijakBuilderPaperSchema.safeParse(paper({ blueprint: { id: 'bp', version: 1 } })).success,
    ).toBe(false)
    expect(
      BijakBuilderPaperSchema.safeParse(paper({ sections: [section({ placements: [] })] })).success,
    ).toBe(false)
    expect(
      BijakBuilderPaperSchema.safeParse(paper({ sections: [section({ questionIds: [1] })] }))
        .success,
    ).toBe(false)
  })

  it('serialises timestamps with +08:00, not the mock epoch numbers', () => {
    expect(BijakBuilderPaperSummarySchema.safeParse(summary()).success).toBe(true)
    expect(
      BijakBuilderPaperSummarySchema.safeParse(summary({ updatedAt: 1760837400000 })).success,
    ).toBe(false)
    expect(
      BijakBuilderPaperSummarySchema.safeParse(summary({ updatedAt: '2026-10-19T01:30:00Z' }))
        .success,
    ).toBe(false)
    expect(BijakBuilderPaperSchema.safeParse(paper({ createdAt: 1760837400000 })).success).toBe(
      false,
    )
  })

  it('parses a summary row with subjectName, code, budget and ok, and the paged list', () => {
    expect(BijakBuilderPaperSummarySchema.parse(summary()).subjectName).toBe('Matematik')
    expect(
      BijakBuilderPaperSummarySchema.safeParse({ ...summary(), code: undefined }).success,
    ).toBe(false)
    expect(
      BijakBuilderPaperSummarySchema.safeParse({ ...summary(), subjectName: undefined }).success,
    ).toBe(false)
    expect(
      listEnvelopeOf(BijakBuilderPaperSummarySchema).safeParse({ data: [summary()], meta }).success,
    ).toBe(true)
  })

  it('parses the list query (coerced) with the two statuses only', () => {
    expect(BijakBuilderPaperListQuerySchema.parse({ page: '2', status: 'terbit' })).toEqual({
      page: 2,
      status: 'terbit',
    })
    expect(BijakBuilderPaperListQuerySchema.safeParse({ status: 'ready' }).success).toBe(false)
  })
})

describe('editor read: BuilderQuestion, BuilderGroup, BlueprintView, PaperEditorData', () => {
  it('parses BuilderQuestion {id, groupId?, stimulusLabel?, preview, marks, kind, topic, status, kertas, subject}', () => {
    expect(BijakBuilderQuestionSchema.safeParse(bq()).success).toBe(true)
    expect(
      BijakBuilderQuestionSchema.safeParse(bq({ groupId: 'g-1', stimulusLabel: 'Rajah 2' }))
        .success,
    ).toBe(true)
    for (const key of ['preview', 'kind', 'status', 'kertas', 'subject', 'topic', 'marks']) {
      expect(BijakBuilderQuestionSchema.safeParse({ ...bq(), [key]: undefined }).success, key).toBe(
        false,
      )
    }
    expect(BijakBuilderQuestionSchema.safeParse(bq({ stem: 'x' })).success).toBe(false)
    for (const kind of ['objektif', 'berstruktur', 'esei']) {
      expect(BijakBuilderQuestionSchema.safeParse(bq({ kind })).success, kind).toBe(true)
    }
    expect(BijakBuilderQuestionSchema.safeParse(bq({ kind: 'mcq' })).success).toBe(false)
    expect(BijakBuilderQuestionSchema.safeParse(bq({ status: 'pending_review' })).success).toBe(
      false,
    )
  })

  it('parses BuilderGroup {id, stimulus, questionIds} and rejects the old label form', () => {
    const group = { id: 'g-1', stimulus: stimulus(), questionIds: ['q-201', 'q-202'] }
    expect(BijakBuilderGroupSchema.safeParse(group).success).toBe(true)
    expect(
      BijakBuilderGroupSchema.safeParse({ id: 'g-1', label: 'Rajah 2', questionIds: ['q-201'] })
        .success,
    ).toBe(false)
    expect(
      BijakBuilderGroupSchema.safeParse({ ...group, stimulus: stimulus({ kind: 'video' }) })
        .success,
    ).toBe(false)
  })

  it('parses BlueprintView exactly as the mock has it, with pool, instructions and totalMarks', () => {
    const parsed = BijakBlueprintViewSchema.parse(bpView())
    expect(parsed.totalMarks).toBe(26)
    expect(parsed.sections[0]!.pool).toBe('mat-k2-a')
    expect(parsed.sections[1]!.compulsory).toBe(true)
    for (const key of ['instructions', 'totalMarks', 'subjectName', 'code', 'source']) {
      expect(
        BijakBlueprintViewSchema.safeParse({ ...bpView(), [key]: undefined }).success,
        key,
      ).toBe(false)
    }
    for (const key of ['pool', 'questionCount', 'compulsory', 'instruction', 'markBudget']) {
      const sections = [{ ...bpSection(), [key]: undefined }]
      expect(BijakBlueprintViewSchema.safeParse(bpView({ sections })).success, key).toBe(false)
    }
    expect(BijakBlueprintViewSchema.safeParse(bpView({ id: 'bp-1' })).success).toBe(false)
    expect(BijakBlueprintViewSchema.safeParse(bpView({ version: 1 })).success).toBe(false)
    expect(
      BijakBlueprintViewSchema.safeParse(bpView({ sections: [bpSection({ take: 2 })] })).success,
    ).toBe(false)
    expect(BijakBlueprintViewSchema.safeParse(bpView({ source: 'Draf' })).success).toBe(true)
    expect(BijakBlueprintViewSchema.safeParse(bpView({ sections: [] })).success).toBe(false)
  })

  it('parses the editor read with blueprint, picker questions and groups; blueprint may be null', () => {
    const editor = {
      paper: paper(),
      blueprint: bpView(),
      questions: [
        bq(),
        bq({ id: 'q-201', groupId: 'g-1', stimulusLabel: 'Rajah 2', marks: 4 }),
        bq({ id: 'q-202', groupId: 'g-1', stimulusLabel: 'Rajah 2', marks: 2 }),
      ],
      groups: [{ id: 'g-1', stimulus: stimulus(), questionIds: ['q-201', 'q-202'] }],
    }
    expect(BijakBuilderEditorSchema.safeParse(editor).success).toBe(true)
    expect(envelopeOf(BijakBuilderEditorSchema).safeParse({ data: editor }).success).toBe(true)
    expect(BijakBuilderEditorSchema.safeParse({ ...editor, blueprint: null }).success).toBe(true)
    expect(BijakBuilderEditorSchema.safeParse({ ...editor, blueprint: undefined }).success).toBe(
      false,
    )
    expect(
      BijakBuilderEditorSchema.safeParse({ ...editor, questions: [bq({ scheme: {} })] }).success,
    ).toBe(false)
  })
})

describe('createPaper and PaperPatch (single PUT)', () => {
  it('accepts {subject, kertas, title?} and answers the new id', () => {
    expect(BijakBuilderPaperCreateSchema.safeParse({ subject: 'MAT', kertas: 2 }).success).toBe(
      true,
    )
    expect(
      BijakBuilderPaperCreateSchema.safeParse({ subject: 'MAT', kertas: 2, title: 'Set C' })
        .success,
    ).toBe(true)
    expect(BijakBuilderPaperCreateResultSchema.parse({ id: 'kp-3' })).toEqual({ id: 'kp-3' })
    expect(BijakBuilderPaperCreateResultSchema.safeParse({ id: 9 }).success).toBe(false)
  })

  it('allows a blank title on create (the mock uses the default) and rejects extra or missing keys', () => {
    expect(
      BijakBuilderPaperCreateSchema.safeParse({ subject: 'MAT', kertas: 2, title: '  ' }).success,
    ).toBe(true)
    expect(BijakBuilderPaperCreateSchema.safeParse({ kertas: 2 }).success).toBe(false)
    expect(BijakBuilderPaperCreateSchema.safeParse({ subject: 'MAT', kertas: 0 }).success).toBe(
      false,
    )
    expect(
      BijakBuilderPaperCreateSchema.safeParse({ subject: 'MAT', kertas: 2, year: 2026 }).success,
    ).toBe(false)
  })

  it('accepts a PaperPatch {title?, year?, durationMin?, sections?: [{id, questionIds}]}', () => {
    expect(BijakBuilderPaperPatchSchema.safeParse({}).success).toBe(true)
    expect(
      BijakBuilderPaperPatchSchema.safeParse({
        title: 'Set B (semakan)',
        year: 2026,
        durationMin: 150,
      }).success,
    ).toBe(true)
    expect(
      BijakBuilderPaperPatchSchema.safeParse({
        sections: [
          { id: 'kp-2-s1', questionIds: ['mat2-algebra-v1', 'mat2-diskaun-v2'] },
          { id: 'kp-2-s3', questionIds: [] },
        ],
      }).success,
    ).toBe(true)
  })

  it('rejects the removed header and placement fields, a bad section and an empty title', () => {
    for (const extra of [
      { code: '1449/2' },
      { instructions: [] },
      { reference: [] },
      { blueprint: null },
      { subject: 'MAT' },
    ]) {
      expect(BijakBuilderPaperPatchSchema.safeParse(extra).success, JSON.stringify(extra)).toBe(
        false,
      )
    }
    expect(
      BijakBuilderPaperPatchSchema.safeParse({
        sections: [{ id: 'kp-2-s1', questionIds: ['q-1'], label: 'X' }],
      }).success,
    ).toBe(false)
    expect(
      BijakBuilderPaperPatchSchema.safeParse({ sections: [{ questionIds: [] }] }).success,
    ).toBe(false)
    expect(
      BijakBuilderPaperPatchSchema.safeParse({ sections: [{ id: 'kp-2-s1', questionIds: [101] }] })
        .success,
    ).toBe(false)
    expect(BijakBuilderPaperPatchSchema.safeParse({ durationMin: 0 }).success).toBe(false)
    const r = BijakBuilderPaperPatchSchema.safeParse({ title: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]!.message).toBe(BIJAK_BUILDER_MESSAGES.titleRequired)
  })
})

describe('publish, delete and preview results', () => {
  it('parses publishPaper as { ok, errors } with errors empty on success', () => {
    expect(BijakBuilderPublishResultSchema.parse({ ok: true, errors: [] })).toEqual({
      ok: true,
      errors: [],
    })
    const L = BIJAK_BUILDER_CHECK_LINES
    // the order publishPaper uses: paper-wide lines, then each section line prefixed with its label
    const lines = [
      L.duplicateQuestion(['mat2-algebra-v1', 'mat2-garis-v2']),
      L.groupSplit('g-rajah-2'),
      L.sectionLine('Bahagian A', L.tooFew(3, 2)),
      L.sectionLine('Bahagian B', L.marksMismatch(18, 20)),
      L.sectionLine('Bahagian B', L.notPublished(2)),
    ]
    const bad = BijakBuilderPublishResultSchema.parse({ ok: false, errors: lines })
    expect(bad.ok).toBe(false)
    expect(
      envelopeOf(BijakBuilderPublishResultSchema).safeParse({ data: { ok: false, errors: lines } })
        .success,
    ).toBe(true)
  })

  it('requires the errors key and rejects the old union shapes', () => {
    expect(BijakBuilderPublishResultSchema.safeParse({ ok: true }).success).toBe(false)
    expect(BijakBuilderPublishResultSchema.safeParse({ ok: false }).success).toBe(false)
    expect(BijakBuilderPublishResultSchema.safeParse({ ok: 'yes', errors: [] }).success).toBe(false)
    expect(
      BijakBuilderPublishResultSchema.safeParse({ ok: true, errors: [], paper: {} }).success,
    ).toBe(false)
  })

  it('builds the checkPaper lines exactly as the mock does', () => {
    const L = BIJAK_BUILDER_CHECK_LINES
    expect(L.duplicateQuestion(['a', 'b'])).toBe('Soalan berulang dalam kertas: a, b')
    expect(L.groupSplit('g1')).toBe('Kumpulan rangsangan g1 dipecahkan antara dua bahagian')
    expect(L.tooFew(3, 2)).toBe('Kurang 1 soalan (perlu 3, ada 2)')
    expect(L.tooMany(2, 3)).toBe('Lebih 1 soalan (perlu 2, ada 3)')
    expect(L.marksMismatch(18, 20)).toBe('Markah 18 tidak sama dengan bajet 20')
    expect(L.groupNotConsecutive('g1')).toBe('Kumpulan rangsangan g1 tidak berturutan')
    expect(L.groupIncomplete('g1', 2)).toBe('Kumpulan rangsangan g1 tidak lengkap (2 soalan tiada)')
    expect(L.notPublished(2)).toBe('2 soalan belum Terbit')
    expect(L.sectionLine('Bahagian A', L.notPublished(1))).toBe('Bahagian A: 1 soalan belum Terbit')
  })

  it('returns delete as { ok: true } (idempotent: also for an unknown id)', () => {
    expect(BijakBuilderOkSchema.safeParse({ ok: true }).success).toBe(true)
    expect(BijakBuilderOkSchema.safeParse({ ok: false }).success).toBe(false)
    expect(BijakBuilderOkSchema.safeParse({ deleted: 1 }).success).toBe(false)
  })

  it('takes { ids } for the preview, saved or not, and rejects other keys', () => {
    expect(
      BijakBuilderPreviewRequestSchema.safeParse({ ids: ['mat2-algebra-v1', 'q-new-1'] }).success,
    ).toBe(true)
    expect(BijakBuilderPreviewRequestSchema.safeParse({ ids: [] }).success).toBe(true)
    expect(BijakBuilderPreviewRequestSchema.safeParse({ ids: [1] }).success).toBe(false)
    expect(BijakBuilderPreviewRequestSchema.safeParse({ paperId: 'kp-2' }).success).toBe(false)
    expect(BijakBuilderPreviewRequestSchema.safeParse({ ids: ['a'], extra: 1 }).success).toBe(false)
  })

  it('parses { questions, stimuli, optionBanks } keyed by group id (ReviewQuestion with its scheme)', () => {
    const mcq = {
      id: 'mat2-obj-1',
      stem: 'Nilai $f(2)$ ialah',
      marks: 1,
      curriculum: { ...REVIEW_Q.curriculum, unit: null, formOrigin: 'T1-T3' },
      mcq: {
        options: [
          { id: 'o1', text: '1' },
          { id: 'o2', text: '2' },
        ],
        correct: 'o2',
      },
      scheme: { 'mat2-obj-1': { marks: 1, lines: [{ text: 'Jawapan betul: B' }] } },
    }
    const preview = {
      questions: [REVIEW_Q, mcq, { ...REVIEW_Q, id: 'mat2-x', scheme: { 'mat2-x-a': null } }],
      stimuli: { 'g-rajah-2': stimulus() },
      optionBanks: {
        'g-rajah-2': [
          { id: 'A', text: 'Segi tiga' },
          { id: 'B', text: 'Segi empat' },
        ],
      },
    }
    expect(BijakBuilderPreviewSchema.safeParse(preview).success).toBe(true)
    expect(envelopeOf(BijakBuilderPreviewSchema).safeParse({ data: preview }).success).toBe(true)
    expect(
      BijakBuilderPreviewSchema.safeParse({ questions: [], stimuli: {}, optionBanks: {} }).success,
    ).toBe(true)
    expect(BijakBuilderPreviewSchema.safeParse({ ...preview, groups: [] }).success).toBe(false)
    expect(BijakBuilderPreviewSchema.safeParse({ questions: [], stimuli: {} }).success).toBe(false)
  })

  it('requires the mock ReviewQuestion fields and rejects the BE-16 view fields', () => {
    const parse = (q: unknown) =>
      BijakBuilderPreviewSchema.safeParse({ questions: [q], stimuli: {}, optionBanks: {} }).success
    for (const key of ['stem', 'marks', 'curriculum', 'scheme']) {
      expect(parse({ ...REVIEW_Q, [key]: undefined }), key).toBe(false)
    }
    expect(parse({ ...REVIEW_Q, number: 1 })).toBe(false)
    expect(parse({ ...REVIEW_Q, sectionId: 'kp-2-s1' })).toBe(false)
    expect(parse({ ...REVIEW_Q, curriculum: { ...REVIEW_Q.curriculum, level: 'T3' } })).toBe(false)
  })
})

describe('BM copy (copied from the mock snapshot server_admin.ts.txt)', () => {
  it('keeps the quoted strings verbatim', () => {
    expect(BIJAK_BUILDER_MESSAGES.paperLocked).toBe(
      'Kertas Terbit tidak boleh disunting. Tarik balik dahulu.',
    )
    expect(BIJAK_BUILDER_MESSAGES.deleteTerbit).toBe('Tarik balik kertas Terbit sebelum memadam')
    expect(BIJAK_BUILDER_MESSAGES.titleRequired).toBe('Tajuk kertas diperlukan')
    expect(BIJAK_BUILDER_MESSAGES.invalidQuestion).toBe('Soalan tidak sah untuk kertas ini')
    expect(BIJAK_BUILDER_MESSAGES.invalidSection).toBe('Bahagian tidak sah')
    expect(BIJAK_BUILDER_MESSAGES.noBlueprint).toBe('Tiada blueprint untuk subjek dan kertas ini')
    expect(BIJAK_BUILDER_MESSAGES.paperNotFound).toBe('Kertas tidak ditemui')
  })

  it('has no leftover copy of the first draft and no empty message', () => {
    const text = JSON.stringify(BIJAK_BUILDER_MESSAGES)
    for (const gone of [
      'Hanya kertas yang masih draf',
      'telah diterbitkan',
      'publishRefused',
      'groupSplit',
    ]) {
      expect(text).not.toContain(gone)
    }
    for (const m of Object.values(BIJAK_BUILDER_MESSAGES)) expect(m.length).toBeGreaterThan(0)
  })

  it('parses the CSRF_INVALID body with the shared auth copy', () => {
    expect(BIJAK_BUILDER_CSRF_MESSAGE).toBe(AUTH_ERROR_MESSAGES.CSRF_INVALID)
    expect(
      BijakBuilderCsrfErrorSchema.safeParse({
        error: { code: 'CSRF_INVALID', message: AUTH_ERROR_MESSAGES.CSRF_INVALID },
      }).success,
    ).toBe(true)
    expect(
      BijakBuilderCsrfErrorSchema.safeParse({ error: { code: 'CSRF_INVALID', message: 'x' } })
        .success,
    ).toBe(false)
  })
})

describe('blueprint list and admin writes (writes have no mock)', () => {
  it('parses the paged blueprint list of BlueprintView rows', () => {
    expect(
      listEnvelopeOf(BijakBlueprintViewSchema).safeParse({ data: [bpView()], meta }).success,
    ).toBe(true)
    expect(BijakBlueprintListQuerySchema.parse({ subject: 'MAT', kertas: '2' })).toEqual({
      subject: 'MAT',
      kertas: 2,
    })
    expect(BijakBlueprintListQuerySchema.safeParse({ kertas: '0' }).success).toBe(false)
  })

  it('accepts the create and version bodies with the BlueprintView section names', () => {
    expect(
      BijakBlueprintAdminCreateSchema.safeParse({ subject: 'MAT', kertas: 2, ...bpInput() })
        .success,
    ).toBe(true)
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(bpInput()).success).toBe(true)
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse(
        bpInput({ instructions: ['Jawab semua soalan.'] }),
      ).success,
    ).toBe(true)
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse({ subject: 'MAT', kertas: 2, ...bpInput() })
        .success,
    ).toBe(false)
    expect(BijakBlueprintAdminCreateSchema.safeParse(bpInput()).success).toBe(false)
  })

  it('rejects bad blueprint sections: none, count 0, old names, no mark budget, a wrong source', () => {
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(bpInput({ sections: [] })).success).toBe(
      false,
    )
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse(
        bpInput({ sections: [bpSectionInput({ questionCount: 0 })] }),
      ).success,
    ).toBe(false)
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse(
        bpInput({ sections: [bpSectionInput({ take: 2 })] }),
      ).success,
    ).toBe(false)
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse(
        bpInput({ sections: [bpSectionInput({ allowedModes: ['essay'] })] }),
      ).success,
    ).toBe(false)
    const noBudget = Object.fromEntries(
      Object.entries(bpSectionInput()).filter(([key]) => key !== 'markBudget'),
    )
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse(bpInput({ sections: [noBudget] })).success,
    ).toBe(false)
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse(bpInput({ source: 'Lain' })).success,
    ).toBe(false)
  })
})

describe('openapi document', () => {
  type Op = {
    tags?: string[]
    summary?: string
    description?: string
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

  it('has 13 operations, 8 paper and 5 blueprint, under /admin only', () => {
    const keys = mine.map((o) => `${o.method} ${o.path}`).sort()
    expect(keys).toEqual(
      [
        'get /admin/papers',
        'post /admin/papers',
        'get /admin/papers/{id}',
        'put /admin/papers/{id}',
        'delete /admin/papers/{id}',
        'post /admin/papers/preview',
        'post /admin/papers/{id}/publish',
        'post /admin/papers/{id}/withdraw',
        'get /admin/blueprints',
        'post /admin/blueprints',
        'get /admin/blueprints/{subject}/{kertas}',
        'post /admin/blueprints/{subject}/{kertas}/versions',
        'post /admin/blueprints/{subject}/{kertas}/retire',
      ].sort(),
    )
    expect(mine.filter((o) => o.op.tags?.includes(BIJAK_BUILDER_TAG))).toHaveLength(8)
    expect(mine.filter((o) => o.op.tags?.includes(BIJAK_BLUEPRINT_ADMIN_TAG))).toHaveLength(5)
    expect(mine.every((o) => o.path.startsWith('/admin/'))).toBe(true)
  })

  it('has no separate sections, placements or conformance route', () => {
    for (const gone of ['/sections', '/placements', '/conformance']) {
      expect(
        mine.some((o) => o.path.endsWith(gone)),
        gone,
      ).toBe(false)
    }
  })

  it('answers 401 and 403 on every route and 404 on every route with path params except the idempotent delete and the preview', () => {
    for (const { path, method, op } of mine) {
      expect(op.responses['401'], `${method} ${path} 401`).toBeDefined()
      expect(op.responses['403'], `${method} ${path} 403`).toBeDefined()
      const addressed =
        path.includes('{') && !(method === 'delete' && path === '/admin/papers/{id}')
      if (addressed && !(method === 'post' && path === '/admin/blueprints')) {
        expect(op.responses['404'], `${method} ${path} 404`).toBeDefined()
      }
    }
    expect(Object.keys(doc.paths['/admin/papers/{id}']!.delete!.responses)).not.toContain('404')
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
    expect(writes).toHaveLength(9)
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

  it('sends no credential or token on any route of the card (D57b: no Cache-Control: no-store needed)', () => {
    for (const { path, method, op } of mine) {
      for (const [status, r] of Object.entries(
        op.responses as Record<string, { headers?: object }>,
      )) {
        expect(Object.keys(r.headers ?? {}), `${method} ${path} ${status}`).not.toContain(
          'Cache-Control',
        )
      }
    }
  })

  it('has the documented status codes of the key routes (no 409 on papers: the mock bad_request is 422)', () => {
    const codes = (path: string, method: string) =>
      Object.keys(doc.paths[path]?.[method]?.responses ?? {}).sort()
    const bp = '/admin/blueprints/{subject}/{kertas}'
    expect(codes('/admin/papers', 'post')).toEqual(['201', '401', '403', '422', '429'])
    expect(codes('/admin/papers/preview', 'post')).toEqual(['200', '401', '403', '422', '429'])
    expect(codes('/admin/papers/{id}', 'get')).toEqual(['200', '401', '403', '404'])
    expect(codes('/admin/papers/{id}', 'put')).toEqual(['200', '401', '403', '404', '422', '429'])
    expect(codes('/admin/papers/{id}', 'delete')).toEqual(['200', '401', '403', '422', '429'])
    expect(codes('/admin/papers/{id}/publish', 'post')).toEqual(['200', '401', '403', '404', '429'])
    expect(codes('/admin/papers/{id}/withdraw', 'post')).toEqual([
      '200',
      '401',
      '403',
      '404',
      '429',
    ])
    expect(codes('/admin/blueprints', 'post')).toEqual(['201', '401', '403', '409', '422', '429'])
    expect(codes(`${bp}/versions`, 'post')).toEqual([
      '201',
      '401',
      '403',
      '404',
      '409',
      '422',
      '429',
    ])
    expect(codes(`${bp}/retire`, 'post')).toEqual(['200', '401', '403', '404', '409', '429'])
  })

  it('carries the mock BM errors and the real checkPaper lines in the route descriptions', () => {
    const text = (path: string, method: string) => JSON.stringify(doc.paths[path]![method])
    expect(text('/admin/papers/{id}', 'put')).toContain(BIJAK_BUILDER_MESSAGES.paperLocked)
    expect(text('/admin/papers/{id}', 'put')).toContain(BIJAK_BUILDER_MESSAGES.invalidQuestion)
    expect(text('/admin/papers/{id}', 'put')).toContain(BIJAK_BUILDER_MESSAGES.invalidSection)
    expect(text('/admin/papers/{id}', 'put')).toContain(BIJAK_BUILDER_MESSAGES.titleRequired)
    expect(text('/admin/papers/{id}', 'put')).toContain('subject check only')
    expect(text('/admin/papers/{id}', 'delete')).toContain(BIJAK_BUILDER_MESSAGES.deleteTerbit)
    expect(text('/admin/papers', 'post')).toContain(BIJAK_BUILDER_MESSAGES.noBlueprint)
    expect(text('/admin/papers', 'post')).toContain('no field')
    expect(text('/admin/papers/{id}', 'get')).toContain(BIJAK_BUILDER_MESSAGES.paperNotFound)
    const publish = text('/admin/papers/{id}/publish', 'post')
    for (const line of [
      'Kurang N soalan (perlu X, ada Y)',
      'Lebih N soalan (perlu X, ada Y)',
      'Markah M tidak sama dengan bajet B',
      '{N} soalan belum Terbit',
      'tidak berturutan',
      'tidak lengkap (N soalan tiada)',
      'Soalan berulang dalam kertas',
      'dipecahkan antara dua bahagian',
      '{label}: ',
    ]) {
      expect(publish, line).toContain(line)
    }
    expect(publish).not.toContain('perlu 3 soalan, hanya 2 tersedia')
  })

  it('answers PaperEditorData on PUT and { ok: true } on withdraw and delete', () => {
    const ref = (path: string, method: string, code: string) =>
      JSON.stringify(
        (doc.paths[path]![method]!.responses[code] as { content: Record<string, unknown> }).content,
      )
    expect(ref('/admin/papers/{id}', 'put', '200')).toContain('BijakBuilderEditor')
    expect(ref('/admin/papers/{id}', 'get', '200')).toContain('BijakBuilderEditor')
    expect(ref('/admin/papers/{id}/withdraw', 'post', '200')).toContain('BijakBuilderOk')
    expect(ref('/admin/papers/{id}', 'delete', '200')).toContain('BijakBuilderOk')
    expect(ref('/admin/papers', 'post', '201')).toContain('BijakBuilderPaperCreateResult')
  })

  it('maps every mock refusal to 422 VALIDATION_ERROR and says the mapping awaits the LEAD', () => {
    for (const [path, method] of [
      ['/admin/papers', 'post'],
      ['/admin/papers/{id}', 'put'],
      ['/admin/papers/{id}', 'delete'],
    ] as const) {
      const op = doc.paths[path]![method]!
      expect(op.description, `${method} ${path}`).toContain('no BAD_REQUEST')
      expect(op.description, `${method} ${path}`).toContain('awaits the LEAD')
    }
  })

  it('marks the blueprint writes as having no mock and what is not quoted as [PROPOSED]', () => {
    for (const path of [
      '/admin/blueprints',
      '/admin/blueprints/{subject}/{kertas}/versions',
      '/admin/blueprints/{subject}/{kertas}/retire',
    ]) {
      const op = doc.paths[path]!.post!
      expect(`${op.summary} ${op.description}`, path).toContain('NO MOCK')
      expect(op.description, path).toContain('[PROPOSED]')
    }
    expect(doc.paths['/admin/papers/preview']!.post!.description).toContain('[PROPOSED]')
  })

  it('previews unsaved ids through POST /admin/papers/preview and has no GET preview', () => {
    const op = doc.paths['/admin/papers/preview']!.post!
    expect(op.requestBody).toBeDefined()
    expect(op.description).toContain('unsaved')
    expect(doc.paths['/admin/papers/{id}/preview']).toBeUndefined()
  })

  it('takes no body on publish, withdraw and retire, and a body on the other mutations', () => {
    const noBody = [
      '/admin/papers/{id}/publish',
      '/admin/papers/{id}/withdraw',
      '/admin/blueprints/{subject}/{kertas}/retire',
    ]
    for (const path of noBody) expect(doc.paths[path]?.post?.requestBody, path).toBeUndefined()
    for (const { path, method, op } of mine.filter(
      (o) => o.method !== 'get' && o.method !== 'delete' && !noBody.includes(o.path),
    )) {
      expect(op.requestBody, `${method} ${path}`).toBeDefined()
    }
  })

  it('registers every builder component, prefixed and distinct from the papers and attempts ids', () => {
    const ids = Object.keys(BIJAK_BUILDER_COMPONENT_SCHEMAS)
    const others = new Set([
      ...Object.keys(BIJAK_PAPERS_COMPONENT_SCHEMAS),
      ...Object.keys(BIJAK_ATTEMPTS_COMPONENT_SCHEMAS),
    ])
    for (const id of ids) {
      expect(id, id).toMatch(/^(BijakBuilder|BijakBlueprint(View|Admin|List))/)
      expect(others.has(id), `${id} clashes with a sibling`).toBe(false)
      expect(doc.components.schemas[id], id).toBeDefined()
    }
    for (const id of [
      'BijakBuilderPaper',
      'BijakBuilderEditor',
      'BijakBuilderPreview',
      'BijakBlueprintView',
    ]) {
      expect(ids).toContain(id)
    }
    for (const gone of [
      'BijakBuilderSectionCheck',
      'BijakBuilderConformance',
      'BijakBuilderPlacement',
      'BijakBlueprintAdmin',
    ]) {
      expect(ids, gone).not.toContain(gone)
    }
  })

  it('keeps answer keys and schemes out of every builder component except the admin-only review shapes', () => {
    const admin = new Set([
      'BijakBuilderReviewQuestion',
      'BijakBuilderSchemeLine',
      'BijakBuilderPreview',
    ])
    const text = JSON.stringify(
      Object.fromEntries(
        Object.entries(doc.components.schemas).filter(
          ([k]) => k in BIJAK_BUILDER_COMPONENT_SCHEMAS && !admin.has(k),
        ),
      ),
    )
    for (const word of ['"scheme"', '"correct"', '"accepted"', '"explanation"', '"answerKey"']) {
      expect(text).not.toContain(word)
    }
    expect(JSON.stringify(doc.paths['/admin/papers/preview'])).toContain('Admin Pusat only')
  })
})
