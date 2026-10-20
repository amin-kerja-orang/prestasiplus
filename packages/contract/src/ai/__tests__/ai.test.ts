import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, expectTypeOf, it } from 'vitest'

import { buildOpenApiDocument, COMPONENT_SCHEMAS } from '../../openapi'
import { AI_COMPONENT_SCHEMAS, AI_TAG } from '../paths'
import {
  AI_FAILURE_CODES,
  AI_LEAF_KINDS,
  AI_MESSAGES,
  AI_MOCK_MODEL_ID,
  AI_POINT_CODES,
  AI_PROVIDER_IDS,
  AI_PROVIDER_LABELS,
  aiUnknownProviderMessage,
  AiCallContextSchema,
  AiCurriculumTagSchema,
  AiDraftPartSchema,
  AiExtractRequestSchema,
  AiExtractedPaperSchema,
  AiGenerateTextRequestSchema,
  AiGenerateTextResultSchema,
  AiPageImageRefSchema,
  AiQuestionDraftSchema,
  AiRedactionSummarySchema,
  AiSchemeDefSchema,
  AiSettingsSchema,
  AiSettingsUpdateSchema,
  AiStatusSchema,
  AiStimulusDefSchema,
  AiIntakeStimulusSchema,
  AiSuggestTagsRequestSchema,
  AiSuggestTagsResultSchema,
  AiTestRequestSchema,
  AiTestResultSchema,
  AiUsageQuerySchema,
  AiUsageRowSchema,
  AiUsageSchema,
  type AiQuestionDraft,
} from '../schema'

const ok = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => s.safeParse(v).success

const usage = { provider: 'mock', model: AI_MOCK_MODEL_ID, pages: 2, tokensIn: 1200, tokensOut: 800, costSen: 0 }
const redaction = { applied: true, masked: [{ flag: 'school_name', count: 1 }, { flag: 'phone', count: 2 }] }

// Prototype-shaped fixtures: what `parsePaper` builds for a fictitious sample paper
// (`admin/intake/ai/mock-extractor.ts` at 9af43134), plus the contract's server additions.
const tag = { subject: 'MAT', level: 'T4', unit: 'MAT-T4-02', unitLabel: 'Asas Nombor', sp: ['02.1'], tp: 3, formOrigin: 'T4' }
const emptyTag = { subject: 'MAT', level: 'T4+T5', unit: null, unitLabel: '', sp: [], tp: 3, formOrigin: 'T4' }
const optionScheme = { kind: 'option', marks: 1, correct: 'B', reason: '' }
const pointsScheme = {
  kind: 'points',
  marks: 2,
  points: [
    { id: 'pt1', code: 'K', marks: 1, label: '2x = 14 - 6', match: { type: 'step', accept: ['2x = 14 - 6'] } },
    {
      id: 'pt2',
      code: 'N',
      marks: 1,
      label: 'x = 4',
      match: { type: 'step', accept: ['x = 4', '4'] },
      ecf: { fromPart: 'q-3-p1', rule: { op: 'same' }, note: 'Ikut jawapan sendiri' },
    },
  ],
  groups: [{ id: 'g1', anyN: 2, pointIds: ['pt1', 'pt2'] }],
}
const server = {
  status: 'draft',
  confirmed: [],
  fieldConfidence: { stem: 0.97, marks: 0.9, 'tag.sp': 0.4 },
  warnings: [{ code: 'low_confidence', field: 'tag.sp', message: 'Unit kurikulum tidak pasti.' }],
}
const draft = {
  ...server,
  id: 'q-2-3',
  label: '2',
  type: 'mcq',
  stem: 'Nilai bagi 3 + 4 ialah',
  options: [
    { id: 'A', text: '6' },
    { id: 'B', text: '7' },
  ],
  marks: 1,
  mode: 'short_text',
  parts: [],
  scheme: optionScheme,
  tag,
  page: 1,
  region: { page: 1, x: 0.1, y: 0.2, w: 0.8, h: 0.1 },
  lowFields: ['tag.sp'],
}
const structured = {
  ...server,
  id: 'q-3-4',
  label: '3',
  type: 'structured',
  stem: 'Rajah 1 menunjukkan sebuah segi tiga.',
  options: [],
  marks: 4,
  mode: 'short_text',
  parts: [
    { id: '3-p1', label: '(a)', prompt: 'Hitung nilai x.', marks: 2, mode: 'working', scheme: pointsScheme },
    { id: '3-p2', label: '(a)(i)', prompt: 'Nyatakan unit.', marks: 2, mode: 'short_text' },
  ],
  tag: emptyTag,
  stimulusId: 'stim-1',
  page: 2,
  lowFields: ['tag.unit'],
  needsManual: true,
}
const stimulus = { id: 'stim-1', kind: 'diagram', label: 'Rajah 1', caption: 'Segi tiga', alt: 'Segi tiga', page: 2 }
const extracted = {
  provider: 'mock',
  model: AI_MOCK_MODEL_ID,
  questions: [draft, structured],
  stimuli: [stimulus, { id: 'stim-2', kind: 'passage', label: 'Petikan 1', alt: '', text: 'Teks petikan.', page: 3, region: { page: 3, x: 0, y: 0, w: 0.5, h: 0.3 } }],
  unmatched: ['Jawapan 9-B', 'Skema 9(a)'],
  warnings: [AI_MESSAGES.noQuestions],
  usage,
  redaction,
}

describe('request types', () => {
  it('accepts text, images by reference, taxonomy and structure hints', () => {
    expect(
      ok(AiExtractRequestSchema, {
        pages: [{ page: 1, text: 'Soalan 1 ...', source: 'text-layer' }, { page: 2, text: '', source: 'ocr', confidence: 71.5 }],
        images: [{ page: 2, fileId: '9000012', width: 1240, height: 1754 }],
        subject: 'MAT',
        kertas: 2,
        taxonomy: [{ code: 'MAT-T4-02', label: 'Asas Nombor', form: 'T4' }],
        structure: [{ label: 'Bahagian A', type: 'mcq', questionCount: 40, marks: 40 }],
      }),
    ).toBe(true)
  })

  it('accepts empty pages as the prototype does (the result then carries the no-question warning)', () => {
    expect(ok(AiExtractRequestSchema, { pages: [], subject: 'MAT', kertas: 1 })).toBe(true)
  })

  it('rejects a bad kertas, an inline data URL image and extra keys', () => {
    expect(ok(AiExtractRequestSchema, { pages: [{ page: 1, text: 'x', source: 'ocr' }], subject: 'MAT', kertas: 3 })).toBe(false)
    expect(ok(AiPageImageRefSchema, { page: 1, dataUrl: 'data:image/png;base64,AAAA', width: 1, height: 1 })).toBe(false)
    expect(ok(AiPageImageRefSchema, { page: 1, fileId: '', width: 1, height: 1 })).toBe(false)
    expect(ok(AiExtractRequestSchema, { pages: [{ page: 1, text: 'x', source: 'scan' }], subject: 'MAT', kertas: 1 })).toBe(false)
  })

  it('cannot carry a user, student, teacher or school identifier (AC-04.8)', () => {
    const base = { pages: [{ page: 1, text: 'x', source: 'text-layer' }], subject: 'MAT', kertas: 1 }
    expect(ok(AiExtractRequestSchema, base)).toBe(true)
    for (const extra of [{ userId: '1' }, { studentId: '1' }, { schoolId: '1' }, { actorId: '1' }, { teacher: 'x' }]) {
      expect(ok(AiExtractRequestSchema, { ...base, ...extra })).toBe(false)
    }
    expect(ok(AiSuggestTagsRequestSchema, { subject: 'MAT', items: [{ ref: 'a', stem: 's' }], taxonomy: [{ code: 'c', label: 'l' }], userId: '1' })).toBe(false)
  })

  it('keeps the caller identity in a separate context type', () => {
    expect(ok(AiCallContextSchema, { actorId: '5', batchId: '7', runId: '9' })).toBe(true)
    expect(ok(AiCallContextSchema, { batchId: '7' })).toBe(false)
  })

  it('validates generateText input (purpose slug, non-empty input)', () => {
    expect(ok(AiGenerateTextRequestSchema, { purpose: 'cikgu.chat', system: 'sys', input: 'hai' })).toBe(true)
    expect(ok(AiGenerateTextRequestSchema, { purpose: 'Cikgu Chat', system: 'sys', input: 'hai' })).toBe(false)
    expect(ok(AiGenerateTextRequestSchema, { purpose: 'cikgu.chat', system: 'sys', input: '' })).toBe(false)
    expect(ok(AiGenerateTextResultSchema, { text: 'ok', tokensIn: 10, tokensOut: 5 })).toBe(true)
    expect(ok(AiGenerateTextResultSchema, { text: 'ok', tokensIn: -1, tokensOut: 5 })).toBe(false)
  })

  it('suggestTags needs at least one item and one taxonomy unit', () => {
    const t = [{ code: 'c', label: 'l' }]
    expect(ok(AiSuggestTagsRequestSchema, { subject: 'MAT', items: [{ ref: 'a', stem: 's' }], taxonomy: t })).toBe(true)
    expect(ok(AiSuggestTagsRequestSchema, { subject: 'MAT', items: [], taxonomy: t })).toBe(false)
    expect(ok(AiSuggestTagsRequestSchema, { subject: 'MAT', items: [{ ref: 'a', stem: 's' }], taxonomy: [] })).toBe(false)
  })
})

describe('result types: drafts only', () => {
  it('parses an extracted paper with confidence, region, warnings, usage and redaction flags', () => {
    expect(ok(AiExtractedPaperSchema, extracted)).toBe(true)
    expect(ok(AiSuggestTagsResultSchema, { suggestions: [{ ref: 'a', tag, confidence: 0.8 }], usage, redaction })).toBe(true)
  })

  it('has no status other than draft and no approval shape (AC-05.6)', () => {
    for (const status of ['approved', 'published', 'review', 'archived', 'accepted', undefined]) {
      expect(ok(AiQuestionDraftSchema, { ...draft, status })).toBe(false)
    }
    expectTypeOf<AiQuestionDraft['status']>().toEqualTypeOf<'draft'>()
    // the service cannot confirm a low field: the prototype `confirmed` key exists but is always empty
    expect(ok(AiQuestionDraftSchema, { ...draft, confirmed: ['tag.sp'] })).toBe(false)
    expect(ok(AiQuestionDraftSchema, { ...draft, confirmed: undefined })).toBe(false)
    expect(ok(AiQuestionDraftSchema, { ...draft, approvedBy: '1' })).toBe(false)
  })

  it('keeps a region inside the page', () => {
    const q = (region: unknown) => ({ ...draft, region })
    expect(ok(AiQuestionDraftSchema, q({ page: 1, x: 0.2, y: 0.5, w: 0.8, h: 0.5 }))).toBe(true)
    expect(ok(AiQuestionDraftSchema, q({ page: 1, x: 0.3, y: 0, w: 0.8, h: 0.1 }))).toBe(false)
    expect(ok(AiQuestionDraftSchema, q({ page: 1, x: 0, y: 0.6, w: 0.1, h: 0.5 }))).toBe(false)
  })

  it('rejects out-of-range confidence, region and marks', () => {
    expect(ok(AiQuestionDraftSchema, { ...draft, fieldConfidence: { stem: 1.2 } })).toBe(false)
    expect(ok(AiQuestionDraftSchema, { ...draft, region: { page: 1, x: -0.1, y: 0, w: 1, h: 1 } })).toBe(false)
    expect(ok(AiQuestionDraftSchema, { ...draft, marks: -1 })).toBe(false)
    // the prototype `marks` is a number (0 when not found, with 'marks' in lowFields), never null
    expect(ok(AiQuestionDraftSchema, { ...draft, marks: 0, lowFields: ['marks'] })).toBe(true)
    expect(ok(AiQuestionDraftSchema, { ...draft, marks: null })).toBe(false)
    expect(ok(AiQuestionDraftSchema, { ...draft, tag: { ...tag, tp: 7 } })).toBe(false)
  })

  it('rejects a usage with a negative or fractional cost and an unknown provider', () => {
    expect(ok(AiUsageSchema, usage)).toBe(true)
    expect(ok(AiUsageSchema, { ...usage, costSen: -1 })).toBe(false)
    expect(ok(AiUsageSchema, { ...usage, costSen: 1.5 })).toBe(false)
    expect(ok(AiUsageSchema, { ...usage, provider: 'cohere' })).toBe(false)
  })

  it('redaction summary carries counts only', () => {
    expect(ok(AiRedactionSummarySchema, redaction)).toBe(true)
    expect(ok(AiRedactionSummarySchema, { applied: true, masked: [{ flag: 'phone', count: 1, text: '012' }] })).toBe(false)
    expect(ok(AiRedactionSummarySchema, { applied: false, masked: [] })).toBe(false)
    expect(ok(AiRedactionSummarySchema, { applied: true, masked: [{ flag: 'phone', count: 0 }] })).toBe(false)
  })

  it('lists the failure codes shared with BE-43', () => {
    expect(AI_FAILURE_CODES).toEqual(expect.arrayContaining(['AI_UNAVAILABLE', 'AI_BUDGET_EXHAUSTED', 'RATE_LIMITED']))
    expect(AI_PROVIDER_IDS).toEqual(['mock', 'anthropic', 'openai', 'gemini', 'openai-compatible'])
    expect(AI_MESSAGES.unavailable).toMatch(/Sila cuba sebentar lagi\.$/)
  })
})

describe('prototype parity (feature/student-prototype 9af43134)', () => {
  // Key lists copied from `domain/types.ts` and `admin/intake/types.ts`; a change on either side must
  // be a conscious one.
  const keysOf = (schema: unknown): string[] => Object.keys((schema as { shape: object }).shape).sort()
  const branchKeys = (schema: unknown, discriminator: string, value: string): string[] => {
    const options = (schema as { options: { shape: Record<string, { value?: string }> }[] }).options
    const branch = options.find((o) => o.shape[discriminator]?.value === value)
    expect(branch, value).toBeDefined()
    return Object.keys(branch!.shape).sort()
  }

  it('CurriculumTag has exactly the prototype fields, all required', () => {
    expect(keysOf(AiCurriculumTagSchema)).toEqual(['formOrigin', 'level', 'sp', 'subject', 'tp', 'unit', 'unitLabel'])
    expect(ok(AiCurriculumTagSchema, tag)).toBe(true)
    expect(ok(AiCurriculumTagSchema, emptyTag)).toBe(true) // lib/dskp.ts emptyTag
    expect(ok(AiCurriculumTagSchema, { ...tag, unit: 'x'.repeat(65) })).toBe(false)
    expect(ok(AiCurriculumTagSchema, { ...tag, unitLabel: undefined })).toBe(false)
    expect(ok(AiCurriculumTagSchema, { ...tag, level: 'T3' })).toBe(false)
    expect(ok(AiCurriculumTagSchema, { ...tag, formOrigin: 'T6' })).toBe(false)
    expect(ok(AiCurriculumTagSchema, { ...tag, sp: '02.1' })).toBe(false)
    expect(ok(AiCurriculumTagSchema, { ...tag, tp: 0 })).toBe(false)
    expect(ok(AiCurriculumTagSchema, { ...tag, tp: 3.5 })).toBe(false)
    // T1-T3 content has no unit (exam schema Q-S2)
    expect(ok(AiCurriculumTagSchema, { ...tag, formOrigin: 'T1-T3', unit: null })).toBe(true)
  })

  it('StimulusDef has exactly the prototype fields; IntakeStimulus adds page', () => {
    expect(keysOf(AiStimulusDefSchema)).toEqual(['alt', 'caption', 'id', 'kind', 'label', 'svg', 'table', 'text'])
    expect(keysOf(AiIntakeStimulusSchema)).toEqual(['alt', 'caption', 'id', 'kind', 'label', 'page', 'region', 'svg', 'table', 'text'])
    for (const kind of ['diagram', 'passage', 'table']) {
      expect(ok(AiStimulusDefSchema, { id: 's', kind, label: 'Rajah 1', alt: '' })).toBe(true)
    }
    // the mock's own kinds are `diagram | table | passage`, not the BM words
    expect(ok(AiStimulusDefSchema, { id: 's', kind: 'rajah', label: 'Rajah 1', alt: '' })).toBe(false)
    expect(ok(AiStimulusDefSchema, { id: 's', kind: 'table', label: 'Jadual 1', alt: 'x', table: { head: ['a'], rows: [['1'], ['2']] } })).toBe(true)
    expect(ok(AiStimulusDefSchema, { id: 's', kind: 'table', label: 'Jadual 1', alt: 'x', table: { head: ['a'] } })).toBe(false)
    expect(ok(AiStimulusDefSchema, { id: 's', kind: 'diagram', label: 'Rajah 1' })).toBe(false) // alt is required
    expect(ok(AiStimulusDefSchema, { id: 's', kind: 'diagram', label: 'Rajah 1', alt: '', page: 1 })).toBe(false)
    expect(ok(AiIntakeStimulusSchema, { id: 's', kind: 'diagram', label: 'Rajah 1', alt: '', page: 1 })).toBe(true)
    expect(ok(AiIntakeStimulusSchema, { id: 's', kind: 'diagram', label: 'Rajah 1', alt: '', colour: 'red' })).toBe(false)
  })

  it('SchemeDef has the five prototype kinds with the prototype fields', () => {
    const schema = AiSchemeDefSchema as unknown
    expect(branchKeys(schema, 'kind', 'option')).toEqual(['correct', 'kind', 'marks', 'reason'])
    expect(branchKeys(schema, 'kind', 'mapping')).toEqual(['kind', 'map', 'marks'])
    expect(branchKeys(schema, 'kind', 'accepted')).toEqual(['caseSensitive', 'kind', 'marks', 'values'])
    expect(branchKeys(schema, 'kind', 'points')).toEqual(['final', 'groups', 'kind', 'marks', 'model', 'points'])
    expect(branchKeys(schema, 'kind', 'rubric')).toEqual(['bands', 'criteria', 'kind', 'marks', 'notes'])
  })

  it('parses every SchemeDef kind and rejects the wrong shapes', () => {
    expect(ok(AiSchemeDefSchema, optionScheme)).toBe(true)
    expect(ok(AiSchemeDefSchema, pointsScheme)).toBe(true)
    expect(ok(AiSchemeDefSchema, { kind: 'mapping', marks: 2, map: { a: 'x', b: 'y' } })).toBe(true)
    expect(ok(AiSchemeDefSchema, { kind: 'accepted', marks: 1, values: [{ v: '12', tol: 0.5, unit: 'cm' }], caseSensitive: false })).toBe(true)
    expect(
      ok(AiSchemeDefSchema, {
        kind: 'rubric',
        marks: 6,
        criteria: [{ id: 'c1', name: 'Isi' }],
        bands: [{ name: 'Baik', range: [4, 6], descriptor: 'Lengkap' }],
        notes: ['n'],
      }),
    ).toBe(true)
    expect(ok(AiSchemeDefSchema, { kind: 'essay', marks: 1 })).toBe(false)
    expect(ok(AiSchemeDefSchema, { ...optionScheme, answer: 'B' })).toBe(false) // old proposed shape is gone
    expect(ok(AiSchemeDefSchema, { kind: 'option', marks: 1, correct: 'B' })).toBe(false) // reason required
    // every point match variant and every ecf rule of the prototype
    const point = (match: unknown, extra: object = {}) => ({ ...pointsScheme, points: [{ id: 'p', code: 'M', marks: 1, label: 'l', match, ...extra }] })
    for (const match of [
      { type: 'step', accept: ['a'] },
      { type: 'all_of', items: ['a', 'b'] },
      { type: 'final' },
      { type: 'unit' },
      { type: 'keywords', anyOf: ['a'] },
      { type: 'manual' },
    ]) {
      expect(ok(AiSchemeDefSchema, point(match)), JSON.stringify(match)).toBe(true)
    }
    expect(ok(AiSchemeDefSchema, point({ type: 'regex', pattern: '.' }))).toBe(false)
    for (const rule of [{ op: 'same' }, { op: 'sub_from', k: 10 }, { op: 'add', k: 1 }, { op: 'mul', k: 2 }]) {
      expect(ok(AiSchemeDefSchema, point({ type: 'final' }, { ecf: { fromPart: 'p1', rule, note: 'n' } }))).toBe(true)
    }
    expect(ok(AiSchemeDefSchema, point({ type: 'final' }, { ecf: { fromPart: 'p1', rule: { op: 'pow', k: 2 }, note: 'n' } }))).toBe(false)
    expect(ok(AiSchemeDefSchema, point({ type: 'final' }, { code: 'Z' }))).toBe(false)
    expect([...AI_POINT_CODES]).toEqual(['K', 'N', 'P', 'B', 'M', 'F', 'C'])
  })

  it('IntakeQuestion and IntakePart keep the prototype fields', () => {
    expect(keysOf(AiQuestionDraftSchema)).toEqual(
      [
        'confirmed', 'fieldConfidence', 'id', 'label', 'lowFields', 'marks', 'mode', 'needsManual', 'options', 'page', 'parts',
        'region', 'scheme', 'status', 'stem', 'stimulusId', 'tag', 'type', 'unit', 'warnings', 'wordRange',
      ].sort(),
    )
    expect(keysOf(AiDraftPartSchema)).toEqual(['id', 'label', 'marks', 'mode', 'prompt', 'scheme', 'unit', 'wordRange'])
    expect([...AI_LEAF_KINDS]).toEqual(['working', 'numeric', 'short_text', 'match_letter', 'essay', 'drawing', 'table_fill'])
    // a structured question, "(a)(i)" part labels, needsManual and an empty-tag question
    expect(ok(AiQuestionDraftSchema, structured)).toBe(true)
    // MCQ options use `id`, not `key`
    expect(ok(AiQuestionDraftSchema, { ...draft, options: [{ key: 'A', text: '6' }, { key: 'B', text: '7' }] })).toBe(false)
    // an essay with a word range
    expect(ok(AiQuestionDraftSchema, { ...draft, type: 'essay', options: [], mode: 'essay', wordRange: { min: 80, max: 120 }, scheme: undefined })).toBe(true)
    expect(ok(AiQuestionDraftSchema, { ...draft, wordRange: { min: 120, max: 80 } })).toBe(false)
    expect(ok(AiQuestionDraftSchema, { ...draft, mode: 'oral' })).toBe(false)
    // the old `stimulusRef` key is gone
    expect(ok(AiQuestionDraftSchema, { ...draft, stimulusRef: 'S1' })).toBe(false)
    // `lead` belongs to bank editing, not to an extraction result
    expect(ok(AiDraftPartSchema, { ...structured.parts[0], lead: [] })).toBe(false)
  })

  it('ExtractedPaper keeps provider, model, questions, stimuli, unmatched and warnings', () => {
    expect(keysOf(AiExtractedPaperSchema)).toEqual(['model', 'provider', 'questions', 'redaction', 'stimuli', 'unmatched', 'usage', 'warnings'])
    expect(ok(AiExtractedPaperSchema, extracted)).toBe(true)
    expect(ok(AiExtractedPaperSchema, { ...extracted, questions: [], stimuli: [], unmatched: [], warnings: [AI_MESSAGES.noQuestions] })).toBe(true)
  })

  it('provider ids, labels and BM copy equal the prototype', () => {
    expect(AI_PROVIDER_LABELS).toEqual({
      mock: 'Contoh (mock, tanpa AI)',
      anthropic: 'Anthropic Claude',
      openai: 'OpenAI',
      gemini: 'Google Gemini',
      'openai-compatible': 'Serasi OpenAI',
    })
    expect(Object.keys(AI_PROVIDER_LABELS)).toEqual([...AI_PROVIDER_IDS])
    expect(AI_MOCK_MODEL_ID).toBe('heuristik-1')
    expect(AI_MESSAGES.notConfigured).toBe('Dikonfigurasi di pelayan')
    expect(AI_MESSAGES.extractionFailed).toBe('Pengekstrakan gagal.')
    expect(AI_MESSAGES.noQuestions).toBe('Tiada soalan dikesan dalam teks kertas.')
    expect(aiUnknownProviderMessage('nope')).toBe('Penyedia AI tidak dikenali: nope')
  })
})

describe('admin wire bodies', () => {
  const settings = { monthlyBudgetSen: 50000, notifyAt80: true, notifyAt100: true, updatedAt: '2026-10-19T10:00:00+08:00' }
  const status = {
    provider: 'mock',
    model: AI_MOCK_MODEL_ID,
    configured: true,
    capabilities: { vision: false, jsonMode: true, maxPagesPerCall: 20 },
    month: '2026-10',
    monthToDateCostSen: 4000,
    budgetSen: 50000,
    remainingSen: 46000,
    percentUsed: 8,
    budgetState: 'ok',
    settings,
  }

  it('parses status and settings', () => {
    expect(ok(AiStatusSchema, status)).toBe(true)
    expect(ok(AiStatusSchema, { ...status, model: null, configured: false, capabilities: null })).toBe(true)
    expect(ok(AiSettingsSchema, { ...settings, updatedAt: null })).toBe(true)
    expect(ok(AiStatusSchema, { ...status, budgetState: 'almost' })).toBe(false)
    expect(ok(AiStatusSchema, { ...status, month: '2026-13' })).toBe(false)
  })

  it('status refuses any credential-looking key', () => {
    for (const k of ['apiKey', 'api_key', 'secret', 'baseUrl']) {
      expect(ok(AiStatusSchema, { ...status, [k]: 'x' })).toBe(false)
    }
  })

  it('settings update is strict and bounded', () => {
    const good = { monthlyBudgetSen: 0, notifyAt80: false, notifyAt100: true }
    expect(ok(AiSettingsUpdateSchema, good)).toBe(true)
    expect(ok(AiSettingsUpdateSchema, { ...good, monthlyBudgetSen: -1 })).toBe(false)
    expect(ok(AiSettingsUpdateSchema, { ...good, monthlyBudgetSen: 10.5 })).toBe(false)
    expect(ok(AiSettingsUpdateSchema, { ...good, monthlyBudgetSen: 100_000_001 })).toBe(false)
    expect(ok(AiSettingsUpdateSchema, { ...good, notifyAt80: 'yes' })).toBe(false)
    expect(ok(AiSettingsUpdateSchema, { ...good, provider: 'openai' })).toBe(false)
    expect(ok(AiSettingsUpdateSchema, { ...good, apiKey: 'x' })).toBe(false)
    expect(ok(AiSettingsUpdateSchema, { monthlyBudgetSen: 1 })).toBe(false)
  })

  it('usage query defaults and bounds', () => {
    expect(AiUsageQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 20 })
    expect(ok(AiUsageQuerySchema, { month: '2026-10', batchId: '7', provider: 'mock', page: '2', pageSize: '100' })).toBe(true)
    expect(ok(AiUsageQuerySchema, { month: '2026-1' })).toBe(false)
    expect(ok(AiUsageQuerySchema, { provider: 'x' })).toBe(false)
    expect(ok(AiUsageQuerySchema, { pageSize: '101' })).toBe(false)
  })

  it('usage rows carry no content', () => {
    const row = { id: '1', createdAt: '2026-10-19T10:00:00+08:00', purpose: 'extract_paper', provider: 'mock', model: AI_MOCK_MODEL_ID, runId: '3', batchId: null, actorId: '5', pages: 4, tokensIn: 10, tokensOut: 20, costSen: 0 }
    expect(ok(AiUsageRowSchema, row)).toBe(true)
    expect(ok(AiUsageRowSchema, { ...row, text: 'Soalan 1' })).toBe(false)
    expect(ok(AiUsageRowSchema, { ...row, prompt: 'x' })).toBe(false)
    expect(ok(AiUsageRowSchema, { ...row, id: 7 })).toBe(false)
  })

  it('test request is an empty object; result parses', () => {
    expect(ok(AiTestRequestSchema, {})).toBe(true)
    expect(ok(AiTestRequestSchema, { text: 'user content' })).toBe(false)
    const result = { ok: true, provider: 'mock', model: AI_MOCK_MODEL_ID, latencyMs: 3, checkedAt: '2026-10-19T10:00:00+08:00', usage }
    expect(ok(AiTestResultSchema, result)).toBe(true)
    // a failed check is a 503, never a 200 with ok false
    expect(ok(AiTestResultSchema, { ...result, ok: false })).toBe(false)
  })
})

describe('OpenAPI registration', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { tags?: string[]; responses: Record<string, { headers?: Record<string, unknown> }> }>>
    components: { schemas: Record<string, unknown> }
  }
  const aiOps = Object.entries(doc.paths).flatMap(([path, ops]) =>
    Object.entries(ops).filter(([, op]) => op.tags?.includes(AI_TAG)).map(([method, op]) => ({ path, method, op })),
  )

  it('registers every Ai component exactly once', () => {
    const names = Object.keys(AI_COMPONENT_SCHEMAS)
    expect(names.every((n) => n.startsWith('Ai'))).toBe(true)
    for (const n of names) expect(doc.components.schemas[n], n).toBeDefined()
  })

  it('does not share a component key with any other lane', async () => {
    const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
    const files = (readdirSync(srcDir, { recursive: true }) as string[])
      .filter((f) => f.endsWith('paths.ts') && !f.includes('__tests__'))
      .map((f) => join(srcDir, f))
    expect(files.length).toBeGreaterThan(30)
    const others = new Map<string, string>()
    for (const file of files) {
      const mod = (await import(file)) as Record<string, unknown>
      for (const [exportName, value] of Object.entries(mod)) {
        if (!exportName.endsWith('_COMPONENT_SCHEMAS') || value === AI_COMPONENT_SCHEMAS) continue
        for (const key of Object.keys(value as object)) others.set(key, `${file}:${exportName}`)
      }
    }
    expect(others.size).toBeGreaterThan(200)
    const clashes = Object.keys(AI_COMPONENT_SCHEMAS).filter((k) => others.has(k))
    expect(clashes).toEqual([])
    // the openapi.ts inline map holds the AI keys exactly once: every key is one this card owns
    const aiInRoot = Object.keys(COMPONENT_SCHEMAS).filter((k) => k.startsWith('Ai') && !(k in AI_COMPONENT_SCHEMAS))
    expect(aiInRoot).toEqual([])
    expect([...others.keys()].filter((k) => k.startsWith('Ai'))).toEqual([])
  })

  it('registers the four admin routes', () => {
    expect(aiOps.map((o) => `${o.method.toUpperCase()} ${o.path}`).sort()).toEqual([
      'GET /ai/status',
      'GET /ai/usage',
      'POST /ai/test',
      'PUT /ai/settings',
    ])
  })

  it('answers 429 with Retry-After on both writes and 401/403 on all (D57a)', () => {
    for (const { method, op } of aiOps) {
      expect(op.responses['401']).toBeDefined()
      expect(op.responses['403']).toBeDefined()
      if (method === 'put' || method === 'post') {
        expect(op.responses['429']).toBeDefined()
        expect(op.responses['429']?.headers).toHaveProperty('Retry-After')
      }
    }
    const test = aiOps.find((o) => o.path === '/ai/test')
    expect(test?.op.responses['503']).toBeDefined()
  })

  it('sends no-store on every 200', () => {
    for (const { op } of aiOps) expect(op.responses['200']?.headers).toHaveProperty('Cache-Control')
  })

  it('exposes no credential-like field name anywhere in the Ai components', () => {
    const names: string[] = []
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') {
        for (const [k, val] of Object.entries(v)) {
          if (k === 'properties' && val && typeof val === 'object') names.push(...Object.keys(val))
          walk(val)
        }
      }
    }
    for (const n of Object.keys(AI_COMPONENT_SCHEMAS)) walk(doc.components.schemas[n])
    expect(names.length).toBeGreaterThan(40)
    const bad = names.filter((k) => /api[-_]?key|secret|password|credential|authorization|bearer|baseurl|base_url/i.test(k))
    expect(bad).toEqual([])
  })
})
