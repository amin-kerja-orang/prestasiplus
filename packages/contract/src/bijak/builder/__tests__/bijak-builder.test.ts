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
  BijakBuilderOkSchema,
  BijakBuilderPaperCreateResultSchema,
  BijakBuilderPaperCreateSchema,
  BijakBuilderPaperListQuerySchema,
  BijakBuilderPaperPatchSchema,
  BijakBuilderPaperSchema,
  BijakBuilderPaperSummarySchema,
  BijakBuilderPreviewSchema,
  BijakBuilderPublishResultSchema,
  BijakBuilderSectionCheckSchema,
} from '../schema'

/* The paper builder mock exists in the prototype but is not pushed yet. The payloads below are
 * built from the LEAD round-2 review quotes (statuses draf/terbit, sections with questionIds,
 * PaperPatch, SectionCheck, publish errors, BM copy). Field lists the review does not quote are
 * [PROPOSED]. Fictitious content only (Matematik Kertas 2: A all, B all, C choose 1 of 2). */

const TS = '2026-10-19T09:30:00+08:00'

const check = (over: Record<string, unknown> = {}) => ({
  label: 'Bahagian A',
  count: 2,
  need: 2,
  marks: 6,
  budget: 6,
  errors: [],
  notes: [],
  ok: true,
  ...over,
})
const section = (over: Record<string, unknown> = {}) => ({
  id: 's-a',
  label: 'Bahagian A',
  markBudget: 6,
  rule: { type: 'all' },
  questionIds: ['q-101', 'q-102'],
  ...over,
})
const summary = (over: Record<string, unknown> = {}) => ({
  id: 'pp-1',
  title: 'Percubaan SPM Matematik Kertas 2 Set B',
  subject: 'MAT',
  kertas: 2,
  year: 2026,
  durationMin: 150,
  status: 'draf',
  questionCount: 2,
  marks: 6,
  budget: 6,
  ok: true,
  updatedAt: TS,
  ...over,
})
const paper = (over: Record<string, unknown> = {}) => ({
  ...summary(),
  code: '1449/2',
  sections: [section()],
  checks: [check()],
  ...over,
})
const bpView = (over: Record<string, unknown> = {}) => ({
  id: 'bp-mat-2',
  subject: 'MAT',
  subjectName: 'Matematik',
  kertas: 2,
  version: 1,
  status: 'active',
  source: 'Disahkan',
  code: '1449/2',
  durationMin: 150,
  sections: [
    { label: 'Bahagian A', rule: { type: 'all' }, take: 2, markBudget: 6 },
    {
      label: 'Bahagian C',
      rule: { type: 'choose', n: 1 },
      take: 2,
      markBudget: 20,
      compulsory: true,
    },
  ],
  ...over,
})
const bpSectionInput = (over: Record<string, unknown> = {}) => ({
  label: 'Bahagian A',
  rule: { type: 'all' },
  pool: 'mat-k2-a',
  take: 2,
  markBudget: 6,
  ...over,
})
const bpInput = (over: Record<string, unknown> = {}) => ({
  source: 'Spec',
  code: '1449/2',
  durationMin: 150,
  sections: [bpSectionInput()],
  ...over,
})

describe('paper model (review quotes)', () => {
  it('has the two statuses of the mock, draf and terbit, and no ready or withdrawn', () => {
    expect([...BIJAK_BUILDER_PAPER_STATUSES]).toEqual(['draf', 'terbit'])
    expect(BijakBuilderPaperSchema.safeParse(paper({ status: 'terbit' })).success).toBe(true)
    for (const bad of ['draft', 'ready', 'published', 'withdrawn']) {
      expect(BijakBuilderPaperSchema.safeParse(paper({ status: bad })).success, bad).toBe(false)
    }
  })

  it('parses a paper whose sections carry questionIds and whose summary has budget and ok', () => {
    const parsed = BijakBuilderPaperSchema.parse(
      paper({
        sections: [
          section(),
          section({
            id: 's-c',
            label: 'Bahagian C',
            rule: { type: 'choose', n: 1 },
            compulsory: true,
            questionIds: [],
          }),
        ],
        checks: [
          check(),
          check({
            label: 'Bahagian C',
            count: 0,
            need: 2,
            marks: 0,
            budget: 20,
            errors: ['Bahagian C: perlu 2 soalan, hanya 0 tersedia'],
            ok: false,
          }),
        ],
        ok: false,
      }),
    )
    expect(parsed.sections[0]!.questionIds).toEqual(['q-101', 'q-102'])
    expect(parsed.budget).toBe(6)
    expect(parsed.ok).toBe(false)
  })

  it('rejects the old paper model: placements, header fields, numeric ids and extra keys', () => {
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

  it('serialises updatedAt as a +08:00 timestamp, not the mock epoch number', () => {
    expect(BijakBuilderPaperSummarySchema.safeParse(summary()).success).toBe(true)
    expect(
      BijakBuilderPaperSummarySchema.safeParse(summary({ updatedAt: 1760837400000 })).success,
    ).toBe(false)
    expect(
      BijakBuilderPaperSummarySchema.safeParse(summary({ updatedAt: '2026-10-19T01:30:00Z' }))
        .success,
    ).toBe(false)
  })

  it('parses the SectionCheck model {label, count, need, marks, budget, errors, notes, ok}', () => {
    const ok = BijakBuilderSectionCheckSchema.safeParse(
      check({
        count: 3,
        need: 2,
        marks: 9,
        errors: ['Bahagian A: perlu 2 soalan, ada 3'],
        notes: ['Soalan stimulus kekal bersama'],
        ok: false,
      }),
    )
    expect(ok.success).toBe(true)
    expect(BijakBuilderSectionCheckSchema.safeParse({ ...check(), ok: undefined }).success).toBe(
      false,
    )
    expect(BijakBuilderSectionCheckSchema.safeParse({ ...check(), sectionId: 's-a' }).success).toBe(
      false,
    )
    expect(BijakBuilderSectionCheckSchema.safeParse(check({ count: -1 })).success).toBe(false)
  })

  it('parses the list envelope and the editor read with picker questions and groups', () => {
    expect(
      listEnvelopeOf(BijakBuilderPaperSummarySchema).safeParse({
        data: [summary()],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, from: 1, to: 1 },
      }).success,
    ).toBe(true)
    const editor = {
      paper: paper(),
      questions: [
        {
          id: 'q-101',
          stem: 'Selesaikan $x^2 - 5x + 6 = 0$.',
          topic: 'Fungsi dan Persamaan Kuadratik',
          marks: 3,
        },
        {
          id: 'q-201',
          stem: 'Berdasarkan Rajah 2, hitung luas.',
          topic: 'Geometri Koordinat',
          marks: 4,
          groupId: 'g-1',
        },
        {
          id: 'q-202',
          stem: 'Hitung perimeter.',
          topic: 'Geometri Koordinat',
          marks: 2,
          groupId: 'g-1',
        },
      ],
      groups: [{ id: 'g-1', label: 'Rajah 2', questionIds: ['q-201', 'q-202'] }],
    }
    expect(BijakBuilderEditorSchema.safeParse(editor).success).toBe(true)
    expect(envelopeOf(BijakBuilderEditorSchema).safeParse({ data: editor }).success).toBe(true)
    expect(
      BijakBuilderEditorSchema.safeParse({
        ...editor,
        groups: [{ id: 'g-1', label: 'Rajah 2', questionIds: ['q-201'] }],
      }).success,
    ).toBe(false)
    expect(
      BijakBuilderEditorSchema.safeParse({
        ...editor,
        questions: [{ id: 'q-1', stem: 's', topic: 't', marks: 1, scheme: {} }],
      }).success,
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
    expect(BijakBuilderPaperCreateResultSchema.parse({ id: 'pp-9' })).toEqual({ id: 'pp-9' })
    expect(BijakBuilderPaperCreateResultSchema.safeParse({ id: 9 }).success).toBe(false)
  })

  it('rejects an empty title with the BM copy, and extra or missing keys on create', () => {
    const r = BijakBuilderPaperCreateSchema.safeParse({ subject: 'MAT', kertas: 2, title: '  ' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]!.message).toBe('Tajuk kertas diperlukan')
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
          { id: 's-a', questionIds: ['q-101', 'q-102'] },
          { id: 's-c', questionIds: [] },
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
        sections: [{ id: 's-a', questionIds: ['q-1'], label: 'X' }],
      }).success,
    ).toBe(false)
    expect(
      BijakBuilderPaperPatchSchema.safeParse({ sections: [{ questionIds: [] }] }).success,
    ).toBe(false)
    expect(
      BijakBuilderPaperPatchSchema.safeParse({ sections: [{ id: 's-a', questionIds: [101] }] })
        .success,
    ).toBe(false)
    expect(BijakBuilderPaperPatchSchema.safeParse({ durationMin: 0 }).success).toBe(false)
    const r = BijakBuilderPaperPatchSchema.safeParse({ title: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0]!.message).toBe(BIJAK_BUILDER_MESSAGES.titleRequired)
  })

  it('parses the list query (coerced) with the two statuses only', () => {
    expect(BijakBuilderPaperListQuerySchema.parse({ page: '2', status: 'terbit' })).toEqual({
      page: 2,
      status: 'terbit',
    })
    expect(BijakBuilderPaperListQuerySchema.safeParse({ status: 'ready' }).success).toBe(false)
  })
})

describe('publish, delete and preview results', () => {
  it('returns publish as a normal result {ok: true} or {ok: false, errors} with BM lines', () => {
    expect(BijakBuilderPublishResultSchema.safeParse({ ok: true }).success).toBe(true)
    const lines = [
      BIJAK_BUILDER_CHECK_LINES.duplicateQuestion('q-101'),
      BIJAK_BUILDER_CHECK_LINES.groupSplit('Rajah 2'),
      'Bahagian C: perlu 2 soalan, hanya 1 tersedia',
    ]
    expect(lines[0]).toBe('Soalan berulang dalam kertas: q-101')
    expect(lines[1]).toBe('Kumpulan rangsangan Rajah 2 dipecahkan antara dua bahagian')
    const r = BijakBuilderPublishResultSchema.parse({ ok: false, errors: lines })
    expect(r.ok).toBe(false)
    expect(
      envelopeOf(BijakBuilderPublishResultSchema).safeParse({ data: { ok: false, errors: lines } })
        .success,
    ).toBe(true)
  })

  it('rejects a failed publish without errors, and ok: true carrying errors', () => {
    expect(BijakBuilderPublishResultSchema.safeParse({ ok: false }).success).toBe(false)
    expect(BijakBuilderPublishResultSchema.safeParse({ ok: false, errors: [] }).success).toBe(false)
    expect(BijakBuilderPublishResultSchema.safeParse({ ok: true, errors: ['x'] }).success).toBe(
      false,
    )
  })

  it('returns delete as { ok: true } (idempotent: also for an unknown id)', () => {
    expect(BijakBuilderOkSchema.safeParse({ ok: true }).success).toBe(true)
    expect(BijakBuilderOkSchema.safeParse({ ok: false }).success).toBe(false)
    expect(BijakBuilderOkSchema.safeParse({ deleted: 1 }).success).toBe(false)
  })

  it('parses a student-view preview with option banks and stimuli, and no answer key', () => {
    const preview = {
      questions: [
        {
          id: 'q-201',
          number: 1,
          sectionId: 's-a',
          topic: 'Geometri Koordinat',
          formOrigin: 'T4',
          groupId: 'g-1',
          optionBank: [
            { id: 'A', text: 'Segi tiga' },
            { id: 'B', text: 'Segi empat' },
          ],
          stem: 'Berdasarkan Rajah 2, kenal pasti bentuk.',
          marks: 2,
          parts: [
            {
              id: 'p-1',
              label: '(a)',
              prompt: 'Nyatakan',
              marks: 2,
              answer: { kind: 'match_letter' },
            },
          ],
        },
      ],
      groups: [
        {
          id: 'g-1',
          stimulus: { id: 'st-1', kind: 'diagram', label: 'Rajah 2', alt: 'Dua bentuk geometri' },
          from: 1,
          to: 1,
          questionIds: ['q-201'],
        },
      ],
    }
    expect(BijakBuilderPreviewSchema.safeParse(preview).success).toBe(true)
    const withKey = structuredClone(preview) as { questions: Record<string, unknown>[] }
    withKey.questions[0]!.scheme = { accept: ['A'] }
    expect(BijakBuilderPreviewSchema.safeParse(withKey).success).toBe(false)
  })
})

describe('BM copy (D58b: quoted by the review, [PROPOSED])', () => {
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

describe('blueprint read (slim BlueprintView) and admin writes (no mock)', () => {
  it('parses the slim view without pool tags, versions list or cover texts', () => {
    expect(BijakBlueprintViewSchema.safeParse(bpView()).success).toBe(true)
    expect(
      listEnvelopeOf(BijakBlueprintViewSchema).safeParse({
        data: [bpView()],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, from: 1, to: 1 },
      }).success,
    ).toBe(true)
    expect(BijakBlueprintViewSchema.safeParse(bpView({ versions: [] })).success).toBe(false)
    expect(
      BijakBlueprintViewSchema.safeParse(
        bpView({
          sections: [{ label: 'A', rule: { type: 'all' }, take: 2, markBudget: 6, pool: 'x' }],
        }),
      ).success,
    ).toBe(false)
    expect(BijakBlueprintViewSchema.safeParse(bpView({ status: 'draft' })).success).toBe(false)
    expect(BijakBlueprintViewSchema.safeParse(bpView({ sections: [] })).success).toBe(false)
    expect(BijakBlueprintViewSchema.safeParse(bpView({ source: 'Draf' })).success).toBe(true)
  })

  it('accepts the create and version bodies and rejects the wrong one', () => {
    expect(
      BijakBlueprintAdminCreateSchema.safeParse({ subject: 'MAT', kertas: 2, ...bpInput() })
        .success,
    ).toBe(true)
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(bpInput()).success).toBe(true)
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse({ subject: 'MAT', kertas: 2, ...bpInput() })
        .success,
    ).toBe(false)
    expect(BijakBlueprintAdminCreateSchema.safeParse(bpInput()).success).toBe(false)
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse(bpInput({ provenance: 'x' })).success,
    ).toBe(false)
  })

  it('rejects bad blueprint sections: none, take 0, a mode outside D2, no mark budget', () => {
    expect(BijakBlueprintAdminVersionInputSchema.safeParse(bpInput({ sections: [] })).success).toBe(
      false,
    )
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse(
        bpInput({ sections: [bpSectionInput({ take: 0 })] }),
      ).success,
    ).toBe(false)
    expect(
      BijakBlueprintAdminVersionInputSchema.safeParse(
        bpInput({ sections: [bpSectionInput({ allowedModes: ['voice'] })] }),
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

  it('parses the list query', () => {
    expect(BijakBlueprintListQuerySchema.parse({ subject: 'MAT', kertas: '2' })).toEqual({
      subject: 'MAT',
      kertas: 2,
    })
    expect(BijakBlueprintListQuerySchema.safeParse({ kertas: '0' }).success).toBe(false)
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
        'get /admin/papers/{id}/preview',
        'post /admin/papers/{id}/publish',
        'post /admin/papers/{id}/withdraw',
        'get /admin/blueprints',
        'post /admin/blueprints',
        'get /admin/blueprints/{id}',
        'post /admin/blueprints/{id}/versions',
        'post /admin/blueprints/{id}/retire',
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

  it('answers 401 and 403 on every route and 404 on every id route except the idempotent delete', () => {
    for (const { path, method, op } of mine) {
      expect(op.responses['401'], `${method} ${path} 401`).toBeDefined()
      expect(op.responses['403'], `${method} ${path} 403`).toBeDefined()
      if (path.includes('{id}') && method !== 'delete') {
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
    expect(writes).toHaveLength(8)
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

  it('has the documented status codes of the key routes', () => {
    const codes = (path: string, method: string) =>
      Object.keys(doc.paths[path]?.[method]?.responses ?? {}).sort()
    expect(codes('/admin/papers', 'post')).toEqual(['201', '401', '403', '422', '429'])
    expect(codes('/admin/papers/{id}', 'put')).toEqual([
      '200',
      '401',
      '403',
      '404',
      '409',
      '422',
      '429',
    ])
    expect(codes('/admin/papers/{id}', 'delete')).toEqual(['200', '401', '403', '409', '429'])
    expect(codes('/admin/papers/{id}/preview', 'get')).toEqual(['200', '401', '403', '404'])
    // publish refusal is a normal result, so there is no 409 or 422
    expect(codes('/admin/papers/{id}/publish', 'post')).toEqual(['200', '401', '403', '404', '429'])
    expect(codes('/admin/papers/{id}/withdraw', 'post')).toEqual([
      '200',
      '401',
      '403',
      '404',
      '429',
    ])
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

  it('carries the quoted BM errors in the route descriptions', () => {
    const text = (path: string, method: string) => JSON.stringify(doc.paths[path]![method])
    expect(text('/admin/papers/{id}', 'put')).toContain(BIJAK_BUILDER_MESSAGES.paperLocked)
    expect(text('/admin/papers/{id}', 'put')).toContain(BIJAK_BUILDER_MESSAGES.invalidQuestion)
    expect(text('/admin/papers/{id}', 'put')).toContain(BIJAK_BUILDER_MESSAGES.invalidSection)
    expect(text('/admin/papers/{id}', 'delete')).toContain(BIJAK_BUILDER_MESSAGES.deleteTerbit)
    expect(text('/admin/papers', 'post')).toContain(BIJAK_BUILDER_MESSAGES.noBlueprint)
    expect(text('/admin/papers', 'post')).toContain(BIJAK_BUILDER_MESSAGES.titleRequired)
    expect(text('/admin/papers/{id}', 'get')).toContain(BIJAK_BUILDER_MESSAGES.paperNotFound)
    expect(text('/admin/papers/{id}/publish', 'post')).toContain('Soalan berulang dalam kertas')
    expect(text('/admin/papers/{id}/publish', 'post')).toContain('dipecahkan antara dua bahagian')
  })

  it('marks the BM copy [PROPOSED] and the blueprint writes as having no mock', () => {
    for (const { path, method, op } of mine) {
      expect(op.description, `${method} ${path}`).toContain('[PROPOSED]')
    }
    for (const path of [
      '/admin/blueprints',
      '/admin/blueprints/{id}/versions',
      '/admin/blueprints/{id}/retire',
    ]) {
      const op = doc.paths[path]!.post!
      expect(`${op.summary} ${op.description}`, path).toContain('NO MOCK')
    }
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
      'BijakBuilderSectionCheck',
      'BijakBuilderEditor',
      'BijakBlueprintView',
    ]) {
      expect(ids).toContain(id)
    }
    for (const gone of [
      'BijakBuilderConformance',
      'BijakBuilderPlacement',
      'BijakBuilderSection',
      'BijakBlueprintAdmin',
    ]) {
      expect(ids, gone).not.toContain(gone)
    }
  })

  it('does not leak an answer key or scheme into any builder component', () => {
    const text = JSON.stringify(
      Object.fromEntries(
        Object.entries(doc.components.schemas).filter(
          ([k]) => k in BIJAK_BUILDER_COMPONENT_SCHEMAS,
        ),
      ),
    )
    for (const word of ['"scheme"', '"correct"', '"accepted"', '"explanation"', '"answerKey"']) {
      expect(text).not.toContain(word)
    }
  })
})
