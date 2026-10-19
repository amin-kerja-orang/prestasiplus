import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import { HEATMAP_COMPONENT_SCHEMAS } from '../paths'
import {
  HEATMAP_AMBER_MIN_PERCENT,
  HEATMAP_BANDS,
  HEATMAP_GREEN_MIN_PERCENT,
  HEATMAP_MIN_ATTEMPTS,
  HeatmapResponseSchema,
  HeatmapSubjectSchema,
  HeatmapTopicSchema,
  heatmapBand,
  heatmapPercent,
} from '../schema'

/** Mock-shaped payloads: Matematik cells 37 / 26 ordered 43, 57, 83 (observed figures), ids as strings. */
const topic = { chapterId: '101', name: 'Pecahan', attempts: 7, correct: 3, percent: 43, band: 'red' }
const mat = {
  subjectId: '1',
  name: 'Matematik',
  topics: [
    topic,
    { chapterId: '102', name: 'Perpuluhan', attempts: 7, correct: 4, percent: 57, band: 'amber' },
    { chapterId: '103', name: 'Peratus', attempts: 23, correct: 19, percent: 83, band: 'green' },
  ],
}
const body = { data: { subjects: [mat, { subjectId: '2', name: 'Sains', topics: [{ ...topic, chapterId: '201', name: 'Cahaya' }] }] } }

describe('HeatmapResponse (GET /buku-nota/heatmap)', () => {
  it('parses a mock-shaped body and the empty state', () => {
    expect(HeatmapResponseSchema.safeParse(body).success).toBe(true)
    expect(HeatmapResponseSchema.safeParse({ data: { subjects: [] } }).success).toBe(true)
  })

  it('accepts the edges: 5 attempts, 0 correct red 0, all correct green 100', () => {
    expect(HeatmapTopicSchema.safeParse({ ...topic, attempts: 5, correct: 0, percent: 0, band: 'red' }).success).toBe(true)
    expect(HeatmapTopicSchema.safeParse({ ...topic, attempts: 5, correct: 5, percent: 100, band: 'green' }).success).toBe(true)
  })

  it('rejects an unknown band (never gray) and out-of-range or fractional percent', () => {
    expect(HeatmapTopicSchema.safeParse({ ...topic, band: 'gray' }).success).toBe(false)
    expect(HeatmapTopicSchema.safeParse({ ...topic, percent: 101 }).success).toBe(false)
    expect(HeatmapTopicSchema.safeParse({ ...topic, percent: -1 }).success).toBe(false)
    expect(HeatmapTopicSchema.safeParse({ ...topic, percent: 42.5 }).success).toBe(false)
  })

  it('rejects numeric ids and empty ids', () => {
    expect(HeatmapTopicSchema.safeParse({ ...topic, chapterId: 101 }).success).toBe(false)
    expect(HeatmapTopicSchema.safeParse({ ...topic, chapterId: '' }).success).toBe(false)
    expect(HeatmapSubjectSchema.safeParse({ ...mat, subjectId: 1 }).success).toBe(false)
  })

  it('rejects a chapter below the minimum attempts and correct above attempts', () => {
    expect(HeatmapTopicSchema.safeParse({ ...topic, attempts: 4, correct: 3 }).success).toBe(false)
    expect(HeatmapTopicSchema.safeParse({ ...topic, attempts: 7, correct: 8 }).success).toBe(false)
    expect(HeatmapTopicSchema.safeParse({ ...topic, correct: -1 }).success).toBe(false)
    expect(HeatmapTopicSchema.safeParse({ ...topic, attempts: 7.5 }).success).toBe(false)
  })

  it('rejects missing keys, extra keys, an empty subject block and a bare body', () => {
    const noBand: Record<string, unknown> = { ...topic }
    delete noBand.band
    expect(HeatmapTopicSchema.safeParse(noBand).success).toBe(false)
    expect(HeatmapTopicSchema.safeParse({ ...topic, subjectId: '1' }).success).toBe(false)
    expect(HeatmapSubjectSchema.safeParse({ ...mat, topics: [] }).success).toBe(false)
    expect(HeatmapResponseSchema.safeParse({ subjects: [] }).success).toBe(false)
    expect(HeatmapResponseSchema.safeParse({ data: { subjects: [], hidden: 3 } }).success).toBe(false)
    expect(HeatmapResponseSchema.safeParse({ data: {} }).success).toBe(false)
  })
})

describe('rules', () => {
  it('constants', () => {
    expect(HEATMAP_MIN_ATTEMPTS).toBe(5)
    expect(HEATMAP_AMBER_MIN_PERCENT).toBe(50)
    expect(HEATMAP_GREEN_MIN_PERCENT).toBe(80)
    expect(HEATMAP_BANDS).toEqual(['red', 'amber', 'green'])
  })

  it('heatmapBand edges on the rounded percent', () => {
    expect(heatmapBand(0)).toBe('red')
    expect(heatmapBand(49)).toBe('red')
    expect(heatmapBand(50)).toBe('amber')
    expect(heatmapBand(79)).toBe('amber')
    expect(heatmapBand(80)).toBe('green')
    expect(heatmapBand(100)).toBe('green')
  })

  it('heatmapPercent rounds half up (49.5 -> 50, 79.5 -> 80) and matches the formula up to 20 attempts', () => {
    expect(heatmapPercent(99, 200)).toBe(50)
    expect(heatmapPercent(159, 200)).toBe(80)
    expect(heatmapPercent(0, 5)).toBe(0)
    expect(heatmapPercent(5, 5)).toBe(100)
    expect(heatmapPercent(0, 0)).toBe(0)
    for (let attempts = 1; attempts <= 20; attempts++) {
      for (let correct = 0; correct <= attempts; correct++) {
        const exact = (100 * correct) / attempts
        // round half up on the exact fraction, compared in integers to avoid float noise
        const expected = Math.floor((200 * correct + attempts) / (2 * attempts))
        expect(heatmapPercent(correct, attempts)).toBe(expected)
        expect(Math.abs(heatmapPercent(correct, attempts) - exact)).toBeLessThanOrEqual(0.5)
      }
    }
  })

  it('heatmapPercent and heatmapBand always produce values the topic schema accepts', () => {
    for (let attempts = HEATMAP_MIN_ATTEMPTS; attempts <= 20; attempts++) {
      for (let correct = 0; correct <= attempts; correct++) {
        const percent = heatmapPercent(correct, attempts)
        const parsed = HeatmapTopicSchema.safeParse({ ...topic, attempts, correct, percent, band: heatmapBand(percent) })
        expect(parsed.success).toBe(true)
      }
    }
  })
})

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { responses: Record<string, unknown>; parameters?: unknown[] }>>
    components: { schemas: Record<string, unknown> }
  }

  it('contains GET /buku-nota/heatmap with 200, 401 and 403 and no parameters', () => {
    const op = doc.paths['/buku-nota/heatmap']
    expect(Object.keys(op ?? {})).toEqual(['get'])
    expect(Object.keys(op?.get?.responses ?? {}).sort()).toEqual(['200', '401', '403'])
    expect(op?.get?.parameters ?? []).toEqual([])
  })

  it('registers the Heatmap components, all prefixed Heatmap', () => {
    const ids = Object.keys(HEATMAP_COMPONENT_SCHEMAS)
    expect(ids).toEqual(['HeatmapBand', 'HeatmapTopic', 'HeatmapSubject', 'HeatmapResponse'])
    for (const id of ids) expect(doc.components.schemas[id]).toBeDefined()
  })
})

describe('errors', () => {
  it('the 401 and 403 bodies parse as the common error body', () => {
    expect(ErrorBodySchema.safeParse({ error: { code: 'UNAUTHORIZED', message: 'Unauthenticated.' } }).success).toBe(true)
    expect(ErrorBodySchema.safeParse({ error: { code: 'FORBIDDEN', message: 'This action is unauthorized.' } }).success).toBe(true)
  })
})
