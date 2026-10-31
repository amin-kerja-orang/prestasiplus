import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import { INTAKE_COMPONENT_SCHEMAS } from '../paths'
import {
  INTAKE_ACCEPT_BLOCKING_RULES,
  INTAKE_ACCEPT_NON_BLOCKING_RULES,
  INTAKE_AI_SETTABLE_STATES,
  INTAKE_BLANK_ITEM_DEFAULTS,
  INTAKE_BULK_MAX_IDS,
  INTAKE_CONFIDENCE_BAND_LABELS,
  INTAKE_CONFIDENCE_BANDS,
  INTAKE_DUPLICATE_KIND_LABELS,
  INTAKE_DUPLICATE_NEAR_THRESHOLD,
  INTAKE_DUPLICATE_STATUSES,
  INTAKE_GATE_MESSAGES,
  INTAKE_HUMAN_EDITED_LABEL,
  INTAKE_ITEM_STATES,
  INTAKE_ITEM_STATE_LABELS,
  INTAKE_MAX_BODY_BYTES,
  INTAKE_MAX_MAPPING_KEYS,
  INTAKE_MESSAGES,
  INTAKE_NEEDS_MANUAL_LABEL,
  INTAKE_OPEN_STATES,
  IntakeAcceptedQuestionSchema,
  IntakeBatchIssueSchema,
  IntakeBatchReviewSchema,
  IntakeBulkRequestSchema,
  IntakeBulkResultSchema,
  IntakeDuplicateEntrySchema,
  IntakeDuplicateRequestSchema,
  IntakeExtractRequestSchema,
  IntakeExtractionRunSchema,
  IntakeGateErrorBodySchema,
  IntakeIssueSchema,
  IntakeItemEventSchema,
  IntakeItemListQuerySchema,
  IntakeItemListResponseSchema,
  IntakeItemPatchResultSchema,
  IntakeItemPatchSchema,
  IntakeItemRowSchema,
  IntakeItemSchema,
  IntakeItemStateSchema,
  IntakePartSchema,
  IntakeQuestionSchema,
  IntakeRegionSchema,
  IntakeRejectRequestSchema,
  IntakeSchemeSchema,
  IntakeStimulusCreateRequestSchema,
  IntakeStimulusSchema,
  IntakeStimulusUpdateRequestSchema,
  intakeConfidenceBand,
  intakeFieldName,
  intakeItemConfidenceBand,
  intakeOpenState,
} from '../schema'

const AT = '2026-10-20T09:30:00+08:00'
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => schema.safeParse(value).success

/* Fictitious fixtures shaped like the prototype sample paper (MAT kertas 2). No real names. */
const tag = { subject: 'MAT', level: 'T4', unit: 'MAT-T4-08', unitLabel: 'Teorem Pythagoras dan Trigonometri', sp: ['8.1'], tp: 3, formOrigin: 'T4' } as const

const mcq = {
  id: '9001',
  label: '2',
  type: 'mcq',
  stem: 'Nilai bagi $2^3$ ialah',
  options: [
    { id: 'A', text: '5' },
    { id: 'B', text: '8' },
    { id: 'C', text: '6' },
    { id: 'D', text: '9' },
  ],
  marks: 1,
  mode: 'short_text',
  parts: [],
  scheme: { kind: 'option', marks: 1, correct: 'B', reason: '2 x 2 x 2 = 8' },
  tag,
  page: 1,
  lowFields: [],
  confirmed: [],
} as const

const structured = {
  id: '9002',
  label: '3',
  type: 'structured',
  stem: 'Rajah 1 menunjukkan segi tiga ABC.',
  options: [],
  marks: 4,
  mode: 'short_text',
  parts: [
    {
      id: 'q3-a',
      label: '(a)',
      prompt: 'Hitung luas segi tiga itu.',
      marks: 2,
      mode: 'working',
      scheme: {
        kind: 'points',
        marks: 2,
        points: [
          { id: 'k1', code: 'K', marks: 1, label: 'Guna 1/2 x tapak x tinggi', match: { type: 'step', accept: ['1/2 x 6 x 8', '0.5 x 6 x 8'] } },
          { id: 'n1', code: 'N', marks: 1, label: '24', match: { type: 'final' }, requires: ['k1'] },
        ],
        groups: [{ id: 'g1', anyN: 1, pointIds: ['k1'] }],
        final: { accept: ['24'], display: '24', unit: 'cm^2', tolerance: 0 },
      },
    },
    {
      id: 'q3-b-i',
      label: '(b)(i)',
      prompt: 'Nyatakan panjang AC.',
      marks: 2,
      mode: 'numeric',
      unit: 'cm',
      lead: [{ id: 'q3-b', label: '(b)', prompt: 'Diberi AB = 6 cm dan BC = 8 cm.' }],
      scheme: {
        kind: 'points',
        marks: 2,
        points: [
          { id: 'p1', code: 'K', marks: 1, label: 'Pythagoras', match: { type: 'all_of', items: ['6', '8'] } },
          { id: 'p2', code: 'N', marks: 1, label: '10', match: { type: 'unit' }, ecf: { fromPart: 'q3-a', rule: { op: 'sub_from', k: 1 }, note: 'Ikut jawapan sendiri' } },
        ],
      },
    },
  ],
  tag,
  stimulusId: '31',
  page: 2,
  lowFields: ['tag.sp', 'marks'],
  confirmed: ['marks'],
  needsManual: true,
} as const

const essay = {
  id: '9003',
  label: '5',
  type: 'essay',
  stem: 'Huraikan satu faktor kebangkitan nasionalisme.',
  options: [],
  marks: 10,
  mode: 'essay',
  wordRange: { min: 120, max: 200 },
  parts: [],
  scheme: {
    kind: 'rubric',
    marks: 10,
    criteria: [{ id: 'c1', name: 'Isi' }],
    bands: [{ name: 'Cemerlang', range: [8, 10], descriptor: 'Huraian lengkap' }],
    notes: ['Terima jawapan lain yang relevan'],
  },
  tag: { ...tag, subject: 'SEJ', unit: null, formOrigin: 'T1-T3' },
  page: 3,
  lowFields: [],
  confirmed: [],
} as const

const stimulus = { id: '31', kind: 'diagram', label: 'Rajah 1', alt: 'Segi tiga bersudut tegak ABC.', page: 2, figureId: '77', region: { page: 2, x: 0.1, y: 0.2, w: 0.5, h: 0.3 } } as const
const actor = { id: '5', name: 'Cikgu Contoh' } as const
const region = { page: 2, x: 0.05, y: 0.4, w: 0.9, h: 0.25 } as const

const common = {
  batchId: '12',
  position: 3,
  state: 'needs_review',
  confidenceBand: 'low',
  uploader: actor,
  question: null,
  duplicates: [],
  createdAt: AT,
  updatedAt: AT,
} as const

const item = {
  ...structured,
  ...common,
  fieldConfidence: { 'tag.sp': 0.55, marks: 0.65, stem: 0.97 },
  region,
  humanEdited: ['marks'],
  issues: [{ itemId: '9002', where: 'Soalan 3(b)(i)', message: INTAKE_GATE_MESSAGES.schemeMissing }],
  stimulus,
  rejectReason: null,
  decidedBy: null,
  decidedAt: null,
  provenance: { sourceType: 'pdf', fileId: '88', sourcePaperId: null, page: 2, region, numberLabel: '3', runId: '41', provider: 'mock', model: 'heuristik-1' },
  events: [
    { id: '1', at: AT, action: 'extracted', actor: null, actorRole: null, from: null, to: 'needs_review', field: null, previous: null, reason: null },
    { id: '2', at: AT, action: 'edited', actor, actorRole: 'teacher', from: 'needs_review', to: 'needs_review', field: 'marks', previous: '3', reason: null },
  ],
}

const row = {
  id: '9002',
  label: '3',
  type: 'structured',
  stemPreview: 'Rajah 1 menunjukkan segi tiga ABC.',
  marks: 4,
  page: 2,
  subject: 'MAT',
  stimulusId: '31',
  lowCount: 1,
  issueCount: 1,
  needsManual: true,
  ...common,
}

describe('question content (prototype types.ts, field for field)', () => {
  it('IntakeQuestion has exactly the prototype keys', () => {
    expect(Object.keys(IntakeQuestionSchema.shape).sort()).toEqual(
      ['id', 'label', 'type', 'stem', 'options', 'marks', 'mode', 'unit', 'wordRange', 'parts', 'scheme', 'tag', 'stimulusId', 'page', 'lowFields', 'confirmed', 'needsManual'].sort(),
    )
    expect(Object.keys(IntakePartSchema.shape).sort()).toEqual(['id', 'label', 'prompt', 'marks', 'mode', 'scheme', 'unit', 'wordRange', 'lead'].sort())
  })

  it('parses an MCQ, a structured question with nested parts and an essay', () => {
    for (const q of [mcq, structured, essay]) expect(IntakeQuestionSchema.safeParse(q).success).toBe(true)
  })

  it('rejects an unknown key, a bad type or leaf mode, and a bad option', () => {
    expect(ok(IntakeQuestionSchema, { ...mcq, extra: 1 })).toBe(false)
    expect(ok(IntakeQuestionSchema, { ...mcq, type: 'objektif' })).toBe(false)
    expect(ok(IntakeQuestionSchema, { ...mcq, mode: 'mcq' })).toBe(false)
    expect(ok(IntakeQuestionSchema, { ...mcq, options: [{ id: 'A' }] })).toBe(false)
    expect(ok(IntakeQuestionSchema, { ...mcq, tag: { ...tag, level: 'T3' } })).toBe(false)
  })

  it('keeps a draft with gaps savable (the gate runs on accept, not on parse)', () => {
    expect(ok(IntakeQuestionSchema, { ...mcq, stem: '', marks: 0, options: [], scheme: undefined, tag: { ...tag, sp: [], tp: 3 } })).toBe(true)
    // tp is 1..6 as the prototype gate and BE-36; the prototype empty tag uses 3, so 0 is never needed
    expect(ok(IntakeQuestionSchema, { ...mcq, tag: { ...tag, tp: 0 } })).toBe(false)
    expect(ok(IntakeQuestionSchema, { ...mcq, tag: { ...tag, tp: 7 } })).toBe(false)
    expect(ok(IntakeQuestionSchema, { ...essay, wordRange: { min: 200, max: 120 } })).toBe(false)
    expect(ok(IntakeQuestionSchema, { ...mcq, scheme: { kind: 'option', marks: 1, correct: '', reason: '' } })).toBe(true)
  })

  it('knows the five scheme kinds and every point match type', () => {
    const kinds = [
      { kind: 'option', marks: 1, correct: 'A', reason: '' },
      { kind: 'mapping', marks: 2, map: { '1': 'A', '2': 'B' } },
      { kind: 'accepted', marks: 1, values: [{ v: '5', tol: 0.1, unit: 'cm' }], caseSensitive: false },
      { kind: 'points', marks: 1, points: [] },
      { kind: 'rubric', marks: 4, criteria: [], bands: [] },
    ]
    for (const k of kinds) expect(ok(IntakeSchemeSchema, k)).toBe(true)
    expect(ok(IntakeSchemeSchema, { kind: 'free', marks: 1 })).toBe(false)
    const point = (match: unknown) => ({ kind: 'points', marks: 1, points: [{ id: 'p', code: 'M', marks: 1, label: 'x', match }] })
    for (const m of [{ type: 'step', accept: [] }, { type: 'all_of', items: [] }, { type: 'final' }, { type: 'unit' }, { type: 'keywords', anyOf: ['a'] }, { type: 'manual' }])
      expect(ok(IntakeSchemeSchema, point(m))).toBe(true)
    expect(ok(IntakeSchemeSchema, point({ type: 'regex', pattern: '.*' }))).toBe(false)
    expect(ok(IntakeSchemeSchema, { kind: 'points', marks: 1, points: [{ id: 'p', code: 'Z', marks: 1, label: 'x', match: { type: 'final' } }] })).toBe(false)
  })

  it('stimulus: response may carry svg and a figure crop, writes cannot send svg', () => {
    expect(IntakeStimulusSchema.safeParse({ ...stimulus, svg: '<svg></svg>' }).success).toBe(true)
    expect(IntakeStimulusSchema.safeParse({ id: '1', kind: 'table', label: 'Jadual 1', alt: 'x', table: { head: ['a'], rows: [['1']] } }).success).toBe(true)
    expect(ok(IntakeStimulusCreateRequestSchema, { kind: 'diagram' })).toBe(true)
    expect(ok(IntakeStimulusCreateRequestSchema, { kind: 'diagram', svg: '<svg onload=x>' })).toBe(false)
    expect(ok(IntakeStimulusUpdateRequestSchema, { alt: 'Segi tiga' })).toBe(true)
    expect(ok(IntakeStimulusUpdateRequestSchema, {})).toBe(false)
    expect(ok(IntakeStimulusUpdateRequestSchema, { svg: '<svg/>' })).toBe(false)
    expect(ok(IntakeStimulusUpdateRequestSchema, { figureId: '1' })).toBe(false)
  })

  it('a mapping scheme is capped at 50 keys', () => {
    const map = (n: number) => ({ kind: 'mapping', marks: 1, map: Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, 'A'])) })
    expect(INTAKE_MAX_MAPPING_KEYS).toBe(50)
    expect(ok(IntakeSchemeSchema, map(50))).toBe(true)
    expect(ok(IntakeSchemeSchema, map(51))).toBe(false)
  })

  it('a stimulus response keeps the figure crop and svg, and no write schema can carry svg or a figure id', () => {
    expect(IntakeStimulusSchema.safeParse({ ...stimulus, svg: '<svg></svg>', figureId: null, region: null }).success).toBe(true)
    for (const [schema, base] of [
      [IntakeStimulusCreateRequestSchema, { kind: 'diagram', alt: 'x' }],
      [IntakeStimulusUpdateRequestSchema, { alt: 'x' }],
    ] as const) {
      expect(ok(schema, base)).toBe(true)
      expect(ok(schema, { ...base, svg: '<svg/>' })).toBe(false)
      expect(ok(schema, { ...base, figureId: '1' })).toBe(false)
    }
  })

  it('region must lie inside the page', () => {
    expect(ok(IntakeRegionSchema, region)).toBe(true)
    expect(ok(IntakeRegionSchema, { ...region, x: 0.5, w: 0.6 })).toBe(false)
    expect(ok(IntakeRegionSchema, { ...region, page: 0 })).toBe(false)
  })
})

describe('quality-gate copy (prototype validation.ts, verbatim)', () => {
  it('has the exact BM messages', () => {
    expect(INTAKE_GATE_MESSAGES.noQuestions).toBe('Tiada soalan. Tambah sekurang-kurangnya satu soalan.')
    expect(INTAKE_GATE_MESSAGES.sourceRequired).toBe('Pengisytiharan sumber diperlukan.')
    expect(INTAKE_GATE_MESSAGES.copyrightRequired).toBe('Status hak cipta diperlukan.')
    expect(INTAKE_GATE_MESSAGES.stemEmpty).toBe('Teks soalan kosong.')
    expect(INTAKE_GATE_MESSAGES.needsManual).toBe('Soalan ini perlu disemak manual. Tandakan selesai disemak.')
    expect(INTAKE_GATE_MESSAGES.mcqOptionsMin).toBe('Soalan objektif perlu sekurang-kurangnya 2 pilihan.')
    expect(INTAKE_GATE_MESSAGES.mcqOptionEmpty).toBe('Ada pilihan jawapan yang kosong.')
    expect(INTAKE_GATE_MESSAGES.mcqKeyMissing).toBe('Kunci jawapan belum dipilih.')
    expect(INTAKE_GATE_MESSAGES.marksPositive).toBe('Markah mesti lebih daripada 0.')
    expect(INTAKE_GATE_MESSAGES.partPromptEmpty).toBe('Teks bahagian kosong.')
    expect(INTAKE_GATE_MESSAGES.schemeMissing).toBe('Skema pemarkahan tiada.')
    expect(INTAKE_GATE_MESSAGES.schemePointNoLabel).toBe('Ada mata skema tanpa penerangan.')
    expect(INTAKE_GATE_MESSAGES.questionMarksZero).toBe('Jumlah markah soalan ialah 0.')
    expect(INTAKE_GATE_MESSAGES.subjectLevelMissing).toBe('Subjek dan tingkatan perlu ditetapkan.')
    expect(INTAKE_GATE_MESSAGES.unitMissing).toBe('Unit DSKP belum dipilih.')
    expect(INTAKE_GATE_MESSAGES.spMissing).toBe('Standard Pembelajaran (SP) belum dipilih.')
    expect(INTAKE_GATE_MESSAGES.tpRange).toBe('Tahap Penguasaan (TP) mesti antara 1 dan 6.')
    expect(INTAKE_GATE_MESSAGES.stimulusMissing).toBe('Rajah / petikan yang dirujuk tidak wujud.')
    expect(INTAKE_GATE_MESSAGES.groupNotContiguous).toBe('Soalan dalam satu kumpulan mesti berturutan.')
    expect(INTAKE_GATE_MESSAGES.stimulusAltMissing).toBe('Teks alternatif (alt) bagi rajah diperlukan.')
  })

  it('builds the parameterised messages', () => {
    expect(INTAKE_GATE_MESSAGES.schemeTotalPart(3, 2)).toBe('Jumlah markah skema (3) tidak sama dengan markah bahagian (2).')
    expect(INTAKE_GATE_MESSAGES.schemeTotalQuestion(1, 4)).toBe('Jumlah markah skema (1) tidak sama dengan markah soalan (4).')
    expect(INTAKE_GATE_MESSAGES.lowFieldUnconfirmed('tag.unit')).toBe('Medan keyakinan rendah belum disahkan: unit DSKP.')
    expect(INTAKE_GATE_MESSAGES.lowFieldUnconfirmed('other')).toBe('Medan keyakinan rendah belum disahkan: other.')
  })

  it('maps field names as the prototype fieldName', () => {
    expect([intakeFieldName('tag.unit'), intakeFieldName('tag.sp'), intakeFieldName('marks'), intakeFieldName('stem'), intakeFieldName('scheme')]).toEqual([
      'unit DSKP',
      'SP',
      'markah',
      'teks soalan',
      'skema',
    ])
  })

  it('uses the prototype and card copy for lookups and the extraction failure', () => {
    expect(INTAKE_MESSAGES.batchNotFound).toBe('Kumpulan ekstrak tidak ditemui')
    expect(INTAKE_MESSAGES.extractionFailed).toBe('Pengekstrakan gagal.')
    expect(INTAKE_MESSAGES.alreadyImported).toBe('Kertas sama sudah diimport')
    expect(INTAKE_MESSAGES.groupMoved).toBe('Soalan dipindahkan supaya kumpulan kekal berturutan.')
  })

  it('IntakeIssue is the prototype shape with itemId', () => {
    expect(ok(IntakeIssueSchema, { itemId: '1', where: 'Soalan 3(b)', message: 'x' })).toBe(true)
    expect(ok(IntakeIssueSchema, { where: 'Kertas', message: INTAKE_GATE_MESSAGES.sourceRequired })).toBe(true)
    expect(ok(IntakeIssueSchema, { questionId: '1', where: 'Kertas', message: 'x' })).toBe(false)
  })
})

describe('item review states (D54a: a separate set from the question statuses)', () => {
  it('has the five card states and their BM labels', () => {
    expect([...INTAKE_ITEM_STATES]).toEqual(['generated', 'needs_review', 'accepted', 'rejected', 'duplicate'])
    expect(INTAKE_ITEM_STATE_LABELS).toEqual({ generated: 'Dijana', needs_review: 'Perlu semakan', accepted: 'Diterima', rejected: 'Ditolak', duplicate: 'Pendua' })
    expect(Object.keys(INTAKE_ITEM_STATE_LABELS)).toEqual([...INTAKE_ITEM_STATES])
  })

  it('the AI can only set generated or needs_review; accepted and rejected are final', () => {
    expect([...INTAKE_AI_SETTABLE_STATES]).toEqual(['generated', 'needs_review'])
    expect([...INTAKE_OPEN_STATES]).toEqual(['generated', 'needs_review', 'duplicate'])
    for (const s of INTAKE_AI_SETTABLE_STATES) expect(INTAKE_ITEM_STATES).toContain(s)
    expect(INTAKE_AI_SETTABLE_STATES).not.toContain('accepted')
  })

  it('the state rule: duplicate if a person linked one, else needs_review on a low field, needsManual or an open entry, else generated', () => {
    const base = { lowFields: [] as string[], confirmed: [] as string[], needsManual: false, duplicates: [] as { kind: 'exact' | 'near' | 'variant'; status: 'open' | 'linked' | 'dismissed' }[] }
    expect(intakeOpenState(base)).toBe('generated')
    expect(intakeOpenState({ ...base, lowFields: ['marks'] })).toBe('needs_review')
    expect(intakeOpenState({ ...base, lowFields: ['marks'], confirmed: ['marks'] })).toBe('generated')
    expect(intakeOpenState({ ...base, lowFields: ['marks', 'stem'], confirmed: ['marks'] })).toBe('needs_review')
    expect(intakeOpenState({ ...base, needsManual: true })).toBe('needs_review')
    expect(intakeOpenState({ ...base, duplicates: [{ kind: 'exact', status: 'open' }] })).toBe('needs_review')
    expect(intakeOpenState({ ...base, duplicates: [{ kind: 'near', status: 'open' }] })).toBe('needs_review')
    expect(intakeOpenState({ ...base, duplicates: [{ kind: 'near', status: 'dismissed' }] })).toBe('generated')
    expect(intakeOpenState({ ...base, duplicates: [{ kind: 'exact', status: 'linked' }] })).toBe('duplicate')
    // linked wins over every other reason
    expect(intakeOpenState({ ...base, lowFields: ['stem'], needsManual: true, duplicates: [{ kind: 'near', status: 'linked' }, { kind: 'exact', status: 'open' }] })).toBe('duplicate')
    // a variant is informational and never changes the state
    expect(intakeOpenState({ ...base, duplicates: [{ kind: 'variant', status: 'open' }] })).toBe('generated')
    expect(intakeOpenState({ ...base, duplicates: [{ kind: 'variant', status: 'linked' }] })).toBe('generated')
    // the rule only ever returns an open state
    for (const st of ['generated', 'needs_review', 'duplicate']) expect(INTAKE_OPEN_STATES).toContain(st)
  })

  it('the review labels are the BM copy', () => {
    expect(INTAKE_HUMAN_EDITED_LABEL).toBe('Disunting oleh manusia')
    expect(INTAKE_NEEDS_MANUAL_LABEL).toBe('Perlu semak manual')
  })

  it('rejects the mock batch and question statuses as an item state', () => {
    for (const v of ['draf', 'semakan', 'pending_review', 'approved', 'published', 'Dijana', '']) expect(ok(IntakeItemStateSchema, v)).toBe(false)
  })

  it('a linked question carries only the four D54a codes (ADR-0027)', () => {
    for (const status of ['draft', 'review', 'approved', 'archived'])
      expect(ok(IntakeAcceptedQuestionSchema, { id: '1', version: 1, status })).toBe(true)
    for (const status of ['published', 'pending_review', 'rejected', 'Draf', 'semakan', 'terbit', 'ditolak'])
      expect(ok(IntakeAcceptedQuestionSchema, { id: '1', version: 1, status })).toBe(false)
    expect(ok(IntakeAcceptedQuestionSchema, { id: '1', version: 0, status: 'draft' })).toBe(false)
  })
})

describe('confidence and duplicates', () => {
  it('bands follow AC-05.3 (>= 0.90 high, 0.70-0.89 medium, < 0.70 low)', () => {
    expect([0.99, 0.9, 0.89, 0.7, 0.69, 0].map(intakeConfidenceBand)).toEqual(['high', 'high', 'medium', 'medium', 'low', 'low'])
    expect([...INTAKE_CONFIDENCE_BANDS]).toEqual(['high', 'medium', 'low'])
    expect(INTAKE_CONFIDENCE_BAND_LABELS).toEqual({ high: 'Tinggi', medium: 'Sederhana', low: 'Rendah' })
  })

  it('the item band is its lowest field; no data counts as high', () => {
    expect(intakeItemConfidenceBand({ stem: 0.98, marks: 0.8, 'tag.sp': 0.6 })).toBe('low')
    expect(intakeItemConfidenceBand({ stem: 0.98, marks: 0.8 })).toBe('medium')
    expect(intakeItemConfidenceBand({})).toBe('high')
  })

  it('a duplicate entry needs the matching id of its scope and hides an unreadable bank question', () => {
    const base = { id: '5', kind: 'exact', similarity: 1, restricted: false, status: 'open' }
    expect(ok(IntakeDuplicateEntrySchema, { ...base, scope: 'bank', matchedQuestionId: '10', matchedItemId: null })).toBe(true)
    expect(ok(IntakeDuplicateEntrySchema, { ...base, scope: 'batch', matchedQuestionId: null, matchedItemId: '9001' })).toBe(true)
    expect(ok(IntakeDuplicateEntrySchema, { ...base, scope: 'bank', matchedQuestionId: null, matchedItemId: '9001' })).toBe(false)
    expect(ok(IntakeDuplicateEntrySchema, { ...base, scope: 'batch', matchedQuestionId: '10', matchedItemId: null })).toBe(false)
    expect(ok(IntakeDuplicateEntrySchema, { ...base, kind: 'copy', scope: 'bank', matchedQuestionId: '10', matchedItemId: null })).toBe(false)
    expect(ok(IntakeDuplicateEntrySchema, { ...base, status: 'dismissed', scope: 'bank', matchedQuestionId: '10', matchedItemId: null })).toBe(true)
    expect(ok(IntakeDuplicateEntrySchema, { ...base, status: 'merged', scope: 'bank', matchedQuestionId: '10', matchedItemId: null })).toBe(false)
    expect(ok(IntakeDuplicateEntrySchema, { ...base, dismissed: false, scope: 'bank', matchedQuestionId: '10', matchedItemId: null })).toBe(false)
    expect([...INTAKE_DUPLICATE_STATUSES]).toEqual(['open', 'linked', 'dismissed'])
    expect(INTAKE_DUPLICATE_KIND_LABELS).toEqual({ exact: 'Pendua tepat', near: 'Mungkin pendua', variant: 'Varian' })
    expect(INTAKE_DUPLICATE_NEAR_THRESHOLD).toBe(0.85)
  })

  it('restricted: a bank question the caller may not read has no id, and only then', () => {
    const hidden = { id: '5', kind: 'near', scope: 'bank', similarity: 0.9, matchedItemId: null, status: 'open' }
    expect(ok(IntakeDuplicateEntrySchema, { ...hidden, matchedQuestionId: null, restricted: true })).toBe(true)
    expect(ok(IntakeDuplicateEntrySchema, { ...hidden, matchedQuestionId: '10', restricted: true })).toBe(false)
    expect(ok(IntakeDuplicateEntrySchema, { ...hidden, matchedQuestionId: null, restricted: false })).toBe(false)
    // a batch entry is never restricted
    expect(ok(IntakeDuplicateEntrySchema, { id: '6', kind: 'near', scope: 'batch', similarity: null, matchedQuestionId: null, matchedItemId: '9001', restricted: true, status: 'open' })).toBe(false)
  })

  it('an item carries a list of entries (at most 50) and no single duplicate flag', () => {
    const entry = { id: '5', kind: 'exact', scope: 'batch', similarity: 1, matchedQuestionId: null, matchedItemId: '9001', restricted: false, status: 'open' }
    expect(ok(IntakeItemSchema, { ...item, duplicates: [entry, { ...entry, id: '6', kind: 'variant' }] })).toBe(true)
    expect(ok(IntakeItemSchema, { ...item, duplicates: Array.from({ length: 51 }, (_, i) => ({ ...entry, id: String(i) })) })).toBe(false)
    expect(ok(IntakeItemSchema, { ...item, duplicate: null })).toBe(false)
    expect(Object.keys(IntakeItemSchema.shape)).not.toContain('duplicate')
    expect(Object.keys(IntakeItemRowSchema.shape)).toContain('duplicates')
  })
})

describe('item and queue', () => {
  it('parses a full item (prototype IntakeQuestion + review fields) and a row', () => {
    expect(IntakeItemSchema.safeParse(item).success).toBe(true)
    expect(IntakeItemRowSchema.safeParse(row).success).toBe(true)
  })

  it('an item keeps every prototype IntakeQuestion key, flattened', () => {
    for (const k of Object.keys(IntakeQuestionSchema.shape)) expect(Object.keys(IntakeItemSchema.shape)).toContain(k)
  })

  it('is strict: an unknown key is rejected, and no question status or credential field exists', () => {
    expect(ok(IntakeItemSchema, { ...item, status: 'pending_review' })).toBe(false)
    expect(ok(IntakeItemSchema, { ...item, apiKey: 'x'.repeat(8) })).toBe(false)
    expect(ok(IntakeItemSchema, { ...item, state: 'pending_review' })).toBe(false)
    expect(ok(IntakeItemRowSchema, { ...row, state: 'accepted', question: { id: '3', version: 1, status: 'draft' } })).toBe(true)
  })

  it('an accepted item stores the question id and version', () => {
    const accepted = { ...item, state: 'accepted', question: { id: '300', version: 1, status: 'draft' }, decidedBy: actor, decidedAt: AT, issues: [] }
    expect(IntakeItemSchema.parse(accepted).question).toEqual({ id: '300', version: 1, status: 'draft' })
  })

  it('an event keeps the previous value typed by its field (not truncated text)', () => {
    const ev = { id: '3', at: AT, action: 'edited', actor, actorRole: 'teacher', from: 'needs_review', to: 'needs_review', field: 'parts', previous: structured.parts, reason: null }
    expect(ok(IntakeItemEventSchema, ev)).toBe(true)
    for (const previous of ['Teks lama', null, 3, { kind: 'option', marks: 1, correct: 'A', reason: '' }, [{ id: 'A', text: '5' }]])
      expect(ok(IntakeItemEventSchema, { ...ev, previous })).toBe(true)
    expect(IntakeItemEventSchema.parse({ ...ev, previous: structured.parts }).previous).toEqual(structured.parts)
    expect(ok(IntakeItemEventSchema, { ...ev, action: 'linked_variant' })).toBe(true)
    expect(ok(IntakeItemEventSchema, { ...ev, action: 'merged' })).toBe(false)
  })

  it('timestamps are +08:00 and ids are strings (no epoch ms, no numeric ids)', () => {
    expect(ok(IntakeItemRowSchema, { ...row, createdAt: 1760000000000 })).toBe(false)
    expect(ok(IntakeItemRowSchema, { ...row, createdAt: '2026-10-20T01:30:00Z' })).toBe(false)
    expect(ok(IntakeItemRowSchema, { ...row, id: 9002 })).toBe(false)
  })

  it('list query: defaults, coercion, filters and the page-size cap', () => {
    expect(IntakeItemListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
    const q = IntakeItemListQuerySchema.parse({ page: '2', pageSize: '50', state: 'needs_review', batchId: '12', subject: 'MAT', uploaderId: '5', band: 'low', duplicate: 'any' })
    expect(q).toMatchObject({ page: 2, pageSize: 50, state: 'needs_review', band: 'low', duplicate: 'any' })
    expect(ok(IntakeItemListQuerySchema, { pageSize: '101' })).toBe(false)
    expect(ok(IntakeItemListQuerySchema, { state: 'draf' })).toBe(false)
    expect(ok(IntakeItemListQuerySchema, { duplicate: 'maybe' })).toBe(false)
  })

  it('list response carries per-state counts', () => {
    const counts = { generated: 1, needs_review: 2, accepted: 3, rejected: 0, duplicate: 1 }
    const res = { data: [row], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, from: 1, to: 1, counts } }
    expect(IntakeItemListResponseSchema.safeParse(res).success).toBe(true)
    expect(ok(IntakeItemListResponseSchema, { ...res, meta: { ...res.meta, counts: { generated: 1 } } })).toBe(false)
  })
})

describe('edit (PATCH)', () => {
  it('accepts a partial edit and null to clear', () => {
    expect(ok(IntakeItemPatchSchema, { stem: 'Teks baharu' })).toBe(true)
    expect(ok(IntakeItemPatchSchema, { scheme: null, unit: null, wordRange: null, stimulusId: null })).toBe(true)
    expect(ok(IntakeItemPatchSchema, { confirmed: ['marks'], needsManual: false })).toBe(true)
    expect(ok(IntakeItemPatchSchema, { parts: structured.parts, tag })).toBe(true)
  })

  it('refuses an empty edit and the keys a client may not write', () => {
    expect(IntakeItemPatchSchema.safeParse({}).error?.issues[0]?.message).toBe(INTAKE_MESSAGES.emptyPatch)
    for (const bad of [{ id: '1' }, { lowFields: [] }, { state: 'accepted' }, { status: 'draft' }, { question: null }, { needsManual: true }])
      expect(ok(IntakeItemPatchSchema, bad)).toBe(false)
  })

  it('the result says whether the paper order changed', () => {
    expect(IntakeItemPatchResultSchema.safeParse({ data: item, reordered: true }).success).toBe(true)
    expect(ok(IntakeItemPatchResultSchema, { data: item })).toBe(false)
  })
})

describe('accept, reject, duplicate, extract', () => {
  it('extract and accept take an empty body only', () => {
    expect(ok(IntakeExtractRequestSchema, {})).toBe(true)
    expect(ok(IntakeExtractRequestSchema, { provider: 'openai', pages: [] })).toBe(false)
  })

  it('reject needs a non-blank reason', () => {
    expect(ok(IntakeRejectRequestSchema, { reason: 'Soalan di luar skop' })).toBe(true)
    expect(IntakeRejectRequestSchema.safeParse({ reason: '   ' }).error?.issues[0]?.message).toBe(INTAKE_MESSAGES.rejectReasonRequired)
    expect(ok(IntakeRejectRequestSchema, {})).toBe(false)
    expect(ok(IntakeRejectRequestSchema, { reason: 'x'.repeat(501) })).toBe(false)
  })

  it('duplicate decision: one target for duplicate and variant, duplicateId alone for not_duplicate', () => {
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'duplicate', matchedQuestionId: '10' })).toBe(true)
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'duplicate', matchedItemId: '9001', note: 'Sama dengan soalan 2' })).toBe(true)
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'variant', matchedQuestionId: '10' })).toBe(true)
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'variant', matchedItemId: '9001' })).toBe(true)
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'not_duplicate', duplicateId: '5' })).toBe(true)
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'not_duplicate' })).toBe(false)
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'not_duplicate', duplicateId: '5', matchedQuestionId: '10' })).toBe(false)
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'duplicate' })).toBe(false)
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'variant' })).toBe(false)
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'duplicate', matchedQuestionId: '10', matchedItemId: '9001' })).toBe(false)
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'duplicate', matchedQuestionId: '10', duplicateId: '5' })).toBe(false)
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'not_duplicate', matchedQuestionId: '10' })).toBe(false)
    expect(ok(IntakeDuplicateRequestSchema, { decision: 'merge', matchedQuestionId: '10' })).toBe(false)
    expect(IntakeDuplicateRequestSchema.safeParse({ decision: 'duplicate' }).error?.issues[0]?.message).toBe(INTAKE_MESSAGES.duplicateTargetRequired)
  })

  it('the not-found copy for a duplicate target is one sentence, so ids cannot be probed', () => {
    expect(INTAKE_MESSAGES.duplicateTargetNotFound).toBe('Padanan pendua tidak ditemui')
    expect(INTAKE_MESSAGES.itemIsDuplicate).toContain('pendua')
  })

  it('an extraction run shows a visible reason while queued for the budget, and after a failure', () => {
    const run = { id: '41', batchId: '12', state: 'queued', reason: { code: 'AI_BUDGET_EXHAUSTED', message: INTAKE_MESSAGES.budgetExhausted }, itemCount: null, provider: null, model: null, attempts: 0, queuedAt: AT, startedAt: null, finishedAt: null }
    expect(IntakeExtractionRunSchema.safeParse(run).success).toBe(true)
    expect(ok(IntakeExtractionRunSchema, { ...run, state: 'failed', reason: { code: 'EXTRACTION_FAILED', message: INTAKE_MESSAGES.extractionFailed }, attempts: 3 })).toBe(true)
    expect(ok(IntakeExtractionRunSchema, { ...run, state: 'succeeded', reason: null, itemCount: 5, provider: 'mock', model: 'heuristik-1', attempts: 1, startedAt: AT, finishedAt: AT })).toBe(true)
    expect(ok(IntakeExtractionRunSchema, { ...run, state: 'cancelled' })).toBe(false)
    expect(ok(IntakeExtractionRunSchema, { ...run, reason: { code: 'AI_PROVIDER_ERROR', message: 'x' } })).toBe(false)
  })

  it('the gate failure is the standard error format with details.issues', () => {
    const body = { error: { code: 'VALIDATION_ERROR', message: INTAKE_MESSAGES.gateFailed, details: { issues: [{ itemId: '9002', where: 'Soalan 3(a)', message: INTAKE_GATE_MESSAGES.schemeTotalPart(1, 2) }] } } }
    expect(IntakeGateErrorBodySchema.safeParse(body).success).toBe(true)
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
    expect(ok(IntakeGateErrorBodySchema, { error: { ...body.error, details: { issues: [] } } })).toBe(false)
  })

  it('which gate rules block a single accept', () => {
    expect([...INTAKE_ACCEPT_BLOCKING_RULES]).toEqual(['question', 'unitNotInTaxonomy', 'stimulusMissing', 'stimulusAltMissing', 'figureNotResolved'])
    expect([...INTAKE_ACCEPT_NON_BLOCKING_RULES]).toEqual(['noQuestions', 'sourceRequired', 'copyrightRequired', 'groupNotContiguous'])
    for (const r of [...INTAKE_ACCEPT_BLOCKING_RULES].filter((x) => x !== 'question')) expect(INTAKE_GATE_MESSAGES).toHaveProperty(r)
    for (const r of INTAKE_ACCEPT_NON_BLOCKING_RULES) expect(INTAKE_GATE_MESSAGES).toHaveProperty(r)
    expect(INTAKE_GATE_MESSAGES.unitNotInTaxonomy).toBe('Unit DSKP tiada dalam senarai kurikulum.')
    expect(INTAKE_GATE_MESSAGES.figureNotResolved).toBe('Rajah belum mempunyai imej tersimpan.')
  })

  it('a blank item starts from the prototype defaults and the body cap is 1 MiB', () => {
    expect(INTAKE_BLANK_ITEM_DEFAULTS).toMatchObject({ type: 'short', stem: '', marks: 1, mode: 'short_text', page: 1, parts: [], options: [] })
    expect(INTAKE_BLANK_ITEM_DEFAULTS.tag).toEqual({ level: 'T4+T5', unit: null, unitLabel: '', sp: [], tp: 3, formOrigin: 'T4' })
    expect(INTAKE_MAX_BODY_BYTES).toBe(1_048_576)
  })
})

describe('bulk', () => {
  it('accept and reject, with the reason rules', () => {
    expect(ok(IntakeBulkRequestSchema, { action: 'accept', ids: ['1', '2'] })).toBe(true)
    expect(ok(IntakeBulkRequestSchema, { action: 'reject', ids: ['1'], reason: 'Pendua kertas lain' })).toBe(true)
    expect(ok(IntakeBulkRequestSchema, { action: 'reject', ids: ['1'] })).toBe(false)
    expect(ok(IntakeBulkRequestSchema, { action: 'accept', ids: ['1'], reason: 'x' })).toBe(false)
    expect(ok(IntakeBulkRequestSchema, { action: 'approve', ids: ['1'] })).toBe(false)
  })

  it('ids: 1 to 100, no repeats, and the threshold is not a request field', () => {
    expect(ok(IntakeBulkRequestSchema, { action: 'accept', ids: [] })).toBe(false)
    expect(ok(IntakeBulkRequestSchema, { action: 'accept', ids: ['1', '1'] })).toBe(false)
    const many = Array.from({ length: INTAKE_BULK_MAX_IDS + 1 }, (_, i) => String(i + 1))
    expect(ok(IntakeBulkRequestSchema, { action: 'accept', ids: many })).toBe(false)
    expect(ok(IntakeBulkRequestSchema, { action: 'accept', ids: many.slice(0, INTAKE_BULK_MAX_IDS) })).toBe(true)
    expect(ok(IntakeBulkRequestSchema, { action: 'accept', ids: ['1'], minBand: 'low' })).toBe(false)
  })

  it('lists a skipped item with its reason and the failed gate rules', () => {
    const result = {
      action: 'accept',
      threshold: 'high',
      results: [
        { id: '1', outcome: 'done', reason: null, item: row },
        { id: '2', outcome: 'skipped', reason: 'GATE_FAILED', issues: [{ itemId: '2', where: 'Soalan 1', message: INTAKE_GATE_MESSAGES.stemEmpty }], item: null },
        { id: '3', outcome: 'skipped', reason: 'BELOW_THRESHOLD', item: null },
        { id: '4', outcome: 'skipped', reason: 'NOT_FOUND', item: null },
      ],
      done: 1,
      skipped: 3,
    }
    expect(IntakeBulkResultSchema.safeParse(result).success).toBe(true)
    expect(ok(IntakeBulkResultSchema, { ...result, results: [{ id: '2', outcome: 'skipped', reason: 'FORBIDDEN', item: null }] })).toBe(false)
  })
})

describe('batch issues say whether they block a single accept', () => {
  it('IntakeBatchIssue is IntakeIssue plus blocksAccept', () => {
    expect(ok(IntakeBatchIssueSchema, { itemId: '9002', where: 'Soalan 3', message: 'x', blocksAccept: true })).toBe(true)
    expect(ok(IntakeBatchIssueSchema, { where: 'Kertas', message: INTAKE_GATE_MESSAGES.sourceRequired, blocksAccept: false })).toBe(true)
    expect(ok(IntakeBatchIssueSchema, { where: 'Kertas', message: 'x' })).toBe(false)
    expect(ok(IntakeIssueSchema, { where: 'Kertas', message: 'x', blocksAccept: true })).toBe(false)
  })
})

describe('batch review summary', () => {
  it('carries what the prototype review page showed', () => {
    const summary = {
      batchId: '12',
      provider: 'mock',
      model: 'heuristik-1',
      unmatched: ['Skema 9'],
      warnings: [],
      stimuli: [stimulus],
      groups: [{ stimulusId: '31', itemIds: ['9002'], from: '3', to: '4', contiguous: true }],
      counts: { items: 5, marks: 12, groups: 1, low: 6, states: { generated: 0, needs_review: 5, accepted: 0, rejected: 0, duplicate: 0 } },
      issues: [
        { itemId: '9002', where: 'Soalan 3', message: INTAKE_GATE_MESSAGES.spMissing, blocksAccept: true },
        { where: 'Kertas', message: INTAKE_GATE_MESSAGES.copyrightRequired, blocksAccept: false },
      ],
      extraction: null,
    }
    expect(IntakeBatchReviewSchema.safeParse(summary).success).toBe(true)
    expect(ok(IntakeBatchReviewSchema, { ...summary, status: 'semakan' })).toBe(false)
    expect(ok(IntakeBatchReviewSchema, { ...summary, issues: [{ where: 'Kertas', message: 'x' }] })).toBe(false)
  })
})

describe('OpenAPI registration', () => {
  type Op = {
    description?: string
    parameters?: { name: string; in: string; required?: boolean }[]
    requestBody?: unknown
    responses: Record<string, { headers?: Record<string, unknown>; content?: Record<string, { schema?: unknown }> }>
    tags?: string[]
  }
  const doc = buildOpenApiDocument() as unknown as {
    paths: Record<string, Record<string, Op>>
    components: { schemas: Record<string, { properties?: Record<string, unknown>; additionalProperties?: unknown }> }
  }

  const ROUTES: readonly [string, string][] = [
    ['post', '/intake/batches/{id}/extract'],
    ['get', '/intake/batches/{id}/review'],
    ['post', '/intake/batches/{id}/items'],
    ['post', '/intake/batches/{id}/stimuli'],
    ['patch', '/intake/stimuli/{id}'],
    ['delete', '/intake/stimuli/{id}'],
    ['get', '/intake/items'],
    ['get', '/intake/items/{id}'],
    ['patch', '/intake/items/{id}'],
    ['post', '/intake/items/{id}/accept'],
    ['post', '/intake/items/{id}/reject'],
    ['post', '/intake/items/{id}/duplicate'],
    ['post', '/intake/items/bulk'],
  ]
  const op = (m: string, p: string) => doc.paths[p]![m]!
  const writes = ROUTES.filter(([m]) => m !== 'get')
  const withId = ROUTES.filter(([, p]) => p.includes('{id}'))
  const withBody = ROUTES.filter(([m, p]) => op(m, p).requestBody !== undefined)

  const BE37_ROUTES = new Set([
    'post /intake/batches',
    'get /intake/batches',
    'get /intake/batches/{id}',
    'post /intake/batches/{id}/files',
    'post /intake/batches/{id}/cancel',
    'get /intake/files/{id}/pages',
    'get /intake/files/{id}/pages/{n}/image',
    'get /intake/files/{id}/pages/{n}/thumb',
    'get /intake/figures/{id}/image',
    'get /intake/files/{id}/original',
  ])

  it('registers the 13 routes and no other /intake route', () => {
    expect(ROUTES).toHaveLength(13)
    for (const [m, p] of ROUTES) expect(doc.paths[p]?.[m], `${m} ${p}`).toBeDefined()
    const registered = Object.entries(doc.paths)
      .filter(([p]) => p.startsWith('/intake') && !p.startsWith('/intake/dashboard')) // BE-40 routes: dashboard.test.ts
      .flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m} ${p}`))
      .filter((r) => !BE37_ROUTES.has(r)) // BE-37 routes are covered by files.test.ts
      .filter((r) => r !== 'post /intake/stimuli/{id}/link-references') // R1-T13 route: questions/studio
      .sort()
    expect(registered).toEqual(ROUTES.map(([m, p]) => `${m} ${p}`).sort())
  })

  it('registers every component, each prefixed Intake, and exports the new ones', () => {
    for (const name of Object.keys(INTAKE_COMPONENT_SCHEMAS)) {
      expect(name.startsWith('Intake')).toBe(true)
      expect(doc.components.schemas, name).toHaveProperty(name)
    }
    for (const name of ['IntakeDuplicateEntry', 'IntakeDuplicateStatus', 'IntakeBatchIssue']) expect(doc.components.schemas, name).toHaveProperty(name)
    expect(doc.components.schemas).not.toHaveProperty('IntakeDuplicateFlag')
  })

  it.each(ROUTES)('%s %s is tagged intake, names its roles and documents 401 and 403', (m, p) => {
    const o = op(m, p)
    expect(o.tags).toEqual(['intake'])
    expect(Object.keys(o.responses)).toEqual(expect.arrayContaining(['401', '403']))
    expect(o.description ?? '').toContain('Admin Pusat')
    expect(o.description ?? '').toContain('Guru')
  })

  it.each(withId)('%s %s documents 404 for an id that is unknown or outside the scope', (m, p) => {
    expect(Object.keys(op(m, p).responses)).toContain('404')
  })

  it.each(writes)('%s %s requires the X-CSRF-Token header and documents 429 with Retry-After', (m, p) => {
    const o = op(m, p)
    const csrf = (o.parameters ?? []).find((x) => x.name === 'X-CSRF-Token')
    expect(csrf, 'X-CSRF-Token').toBeDefined()
    expect(csrf?.in).toBe('header')
    expect(csrf?.required).toBe(true)
    expect(Object.keys(o.responses)).toContain('429')
    expect(o.responses['429']!.headers).toHaveProperty('Retry-After')
  })

  it.each(withBody)('%s %s has a request body and documents 422', (m, p) => {
    expect(Object.keys(op(m, p).responses)).toContain('422')
  })

  it('no read route asks for a CSRF token', () => {
    for (const [m, p] of ROUTES.filter(([x]) => x === 'get')) expect((op(m, p).parameters ?? []).map((x) => x.name)).not.toContain('X-CSRF-Token')
  })

  it('the three large writes document 413 and the cap', () => {
    const large = [
      ['patch', '/intake/items/{id}'],
      ['post', '/intake/batches/{id}/stimuli'],
      ['patch', '/intake/stimuli/{id}'],
    ] as const
    for (const [m, p] of large) expect(Object.keys(op(m, p).responses), `${m} ${p}`).toContain('413')
    expect(JSON.stringify(op('patch', '/intake/items/{id}').responses['413'])).toContain('Data terlalu besar.')
    // and only those three
    const all = ROUTES.filter(([m, p]) => '413' in op(m, p).responses).map(([m, p]) => `${m} ${p}`)
    expect(all.sort()).toEqual(large.map(([m, p]) => `${m} ${p}`).sort())
  })

  it('declares the not-found, conflict and gate responses the card needs', () => {
    expect(op('post', '/intake/batches/{id}/extract').responses).toHaveProperty('409')
    expect(op('post', '/intake/batches/{id}/extract').responses).toHaveProperty('202')
    expect(op('post', '/intake/items/{id}/accept').responses).toHaveProperty('422')
    expect(op('post', '/intake/items/{id}/accept').responses).toHaveProperty('409')
    expect(op('get', '/intake/items/{id}').responses).toHaveProperty('404')
    expect(op('patch', '/intake/items/{id}').responses).toHaveProperty('409')
    expect(op('patch', '/intake/stimuli/{id}').responses).toHaveProperty('409')
    expect(op('delete', '/intake/stimuli/{id}').responses).toHaveProperty('409')
  })

  it('the accept 422 is either the gate body or the ordinary error body', () => {
    const schema = JSON.stringify(op('post', '/intake/items/{id}/accept').responses['422']!.content!['application/json']!.schema)
    expect(schema).toContain('anyOf')
    expect(schema).toContain('IntakeGateErrorBody')
    expect(schema).toContain('ErrorBody')
  })

  it('uses no mock question status and no credential or storage field', () => {
    const intake = JSON.stringify(Object.fromEntries(Object.entries(doc.components.schemas).filter(([k]) => k.startsWith('Intake'))))
    expect(intake).not.toContain('pending_review')
    expect(intake).not.toMatch(/"(apiKey|secret|password|baseUrl|storagePath|storageKey|dataUrl)"/i)
  })

  it('no write schema can carry svg: the property is absent and extra keys are refused, while the response keeps it', () => {
    for (const name of ['IntakeStimulusCreateRequest', 'IntakeStimulusUpdateRequest', 'IntakeItemPatch']) {
      const c = doc.components.schemas[name]!
      expect(c.properties, name).toBeDefined()
      expect(c.properties, name).not.toHaveProperty('svg')
      expect(c.additionalProperties, name).toBe(false)
    }
    expect(doc.components.schemas.IntakeStimulus!.properties).toHaveProperty('svg')
  })

  it('marks what the prototype does not cover as [PROPOSED]', () => {
    const proposed = (name: string) => JSON.stringify(doc.components.schemas[name])
    for (const name of ['IntakeItemState', 'IntakeDuplicateEntry', 'IntakeDuplicateStatus', 'IntakeBatchIssue', 'IntakeExtractionRun', 'IntakeBulkRequest', 'IntakeBatchReview', 'IntakeItemEvent', 'IntakeProvenance'])
      expect(proposed(name), name).toContain('[PROPOSED]')
  })
})
