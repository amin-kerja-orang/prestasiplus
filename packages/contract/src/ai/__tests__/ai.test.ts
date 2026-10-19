import { describe, expect, expectTypeOf, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { AI_COMPONENT_SCHEMAS, AI_TAG } from '../paths'
import {
  AI_FAILURE_CODES,
  AI_MESSAGES,
  AI_PROVIDER_IDS,
  AiCallContextSchema,
  AiExtractRequestSchema,
  AiExtractedPaperSchema,
  AiGenerateTextRequestSchema,
  AiGenerateTextResultSchema,
  AiPageImageRefSchema,
  AiQuestionDraftSchema,
  AiRedactionSummarySchema,
  AiSettingsSchema,
  AiSettingsUpdateSchema,
  AiStatusSchema,
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

const usage = { provider: 'mock', model: 'heuristik-1', pages: 2, tokensIn: 1200, tokensOut: 800, costSen: 0 }
const redaction = { applied: true, masked: [{ flag: 'school_name', count: 1 }, { flag: 'phone', count: 2 }] }
const draft = {
  status: 'draft',
  label: '1',
  type: 'mcq',
  stem: 'Nilai bagi 3 + 4 ialah',
  options: [
    { key: 'A', text: '6' },
    { key: 'B', text: '7' },
  ],
  marks: 1,
  parts: [],
  scheme: { answer: 'B' },
  tag: { unit: 'MAT-T4-02', unitLabel: 'Asas Nombor', level: 'T4', tp: 3 },
  page: 1,
  region: { page: 1, x: 0.1, y: 0.2, w: 0.8, h: 0.1 },
  fieldConfidence: { stem: 0.97, marks: 0.9, 'tag.unit': 0.4 },
  lowFields: ['tag.unit'],
  warnings: [{ code: 'low_confidence', field: 'tag.unit', message: 'Unit kurikulum tidak pasti.' }],
}
const extracted = {
  provider: 'mock',
  model: 'heuristik-1',
  questions: [draft],
  stimuli: [{ ref: 'S1', kind: 'rajah', title: 'Rajah 1', page: 1, region: { page: 1, x: 0, y: 0, w: 0.5, h: 0.3 } }],
  unmatched: ['Jawapan 1-5'],
  warnings: ['Tiada soalan dikesan dalam teks kertas.'],
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
        taxonomy: [{ code: 'MAT-T4-02', label: 'Asas Nombor' }],
        structure: [{ label: 'Bahagian A', type: 'mcq', questionCount: 40, marks: 40 }],
      }),
    ).toBe(true)
  })

  it('rejects empty input, a bad kertas, an inline data URL image and extra keys', () => {
    expect(ok(AiExtractRequestSchema, { pages: [], subject: 'MAT', kertas: 1 })).toBe(false)
    expect(ok(AiExtractRequestSchema, { pages: [{ page: 1, text: 'x', source: 'ocr' }], subject: 'MAT', kertas: 3 })).toBe(false)
    expect(ok(AiPageImageRefSchema, { page: 1, dataUrl: 'data:image/png;base64,AAAA', width: 1, height: 1 })).toBe(false)
    expect(ok(AiPageImageRefSchema, { page: 1, fileId: '', width: 1, height: 1 })).toBe(false)
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
    expect(ok(AiSuggestTagsResultSchema, { suggestions: [{ ref: 'a', tag: { unit: 'MAT-T4-02' }, confidence: 0.8 }], usage, redaction })).toBe(true)
  })

  it('has no status other than draft and no approval shape (AC-05.6)', () => {
    for (const status of ['approved', 'published', 'review', 'archived', 'accepted', undefined]) {
      expect(ok(AiQuestionDraftSchema, { ...draft, status })).toBe(false)
    }
    expectTypeOf<AiQuestionDraft['status']>().toEqualTypeOf<'draft'>()
    // the service cannot confirm a low field: no `confirmed` key is accepted
    expect(ok(AiQuestionDraftSchema, { ...draft, confirmed: ['tag.unit'] })).toBe(false)
    expect(ok(AiQuestionDraftSchema, { ...draft, approvedBy: '1' })).toBe(false)
  })

  it('rejects out-of-range confidence, region and marks', () => {
    expect(ok(AiQuestionDraftSchema, { ...draft, fieldConfidence: { stem: 1.2 } })).toBe(false)
    expect(ok(AiQuestionDraftSchema, { ...draft, region: { page: 1, x: -0.1, y: 0, w: 1, h: 1 } })).toBe(false)
    expect(ok(AiQuestionDraftSchema, { ...draft, marks: -1 })).toBe(false)
    expect(ok(AiQuestionDraftSchema, { ...draft, marks: null })).toBe(true)
    expect(ok(AiQuestionDraftSchema, { ...draft, tag: { tp: 7 } })).toBe(false)
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

describe('admin wire bodies', () => {
  const settings = { monthlyBudgetSen: 50000, notifyAt80: true, notifyAt100: true, updatedAt: '2026-10-19T10:00:00+08:00' }
  const status = {
    provider: 'mock',
    model: 'heuristik-1',
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
    const row = { id: '1', createdAt: '2026-10-19T10:00:00+08:00', purpose: 'extract_paper', provider: 'mock', model: 'heuristik-1', runId: '3', batchId: null, actorId: '5', pages: 4, tokensIn: 10, tokensOut: 20, costSen: 0 }
    expect(ok(AiUsageRowSchema, row)).toBe(true)
    expect(ok(AiUsageRowSchema, { ...row, text: 'Soalan 1' })).toBe(false)
    expect(ok(AiUsageRowSchema, { ...row, prompt: 'x' })).toBe(false)
    expect(ok(AiUsageRowSchema, { ...row, id: 7 })).toBe(false)
  })

  it('test request is an empty object; result parses', () => {
    expect(ok(AiTestRequestSchema, {})).toBe(true)
    expect(ok(AiTestRequestSchema, { text: 'user content' })).toBe(false)
    expect(ok(AiTestResultSchema, { ok: true, provider: 'mock', model: 'heuristik-1', latencyMs: 3, checkedAt: '2026-10-19T10:00:00+08:00', usage })).toBe(true)
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
