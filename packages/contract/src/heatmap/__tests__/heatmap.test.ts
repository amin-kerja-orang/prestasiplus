import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import { HEATMAP_COMPONENT_SCHEMAS } from '../paths'
import {
  HEATMAP_AMBER_MIN_PERCENT,
  HEATMAP_BANDS,
  HEATMAP_GREEN_MIN_PERCENT,
  HEATMAP_STATES,
  HeatmapChapterSchema,
  HeatmapResponseSchema,
  HeatmapStateSchema,
  HeatmapSubjectSchema,
  heatmapAccuracy,
  heatmapBand,
  heatmapPercent,
} from '../schema'
import * as heatmapSchema from '../schema'

/** AC-MUR-14-5 tile (7 attempts, 4 correct), AC-MUR-14-1 tile (10 attempts, 4 correct) and a grey tile. */
const amber = {
  id: '102',
  number: 2,
  name: 'Perpuluhan',
  attempts: 7,
  correct: 4,
  accuracy: 57.1,
  state: 'amber',
}
const red = {
  id: '101',
  number: 1,
  name: 'Pecahan',
  attempts: 10,
  correct: 4,
  accuracy: 40,
  state: 'red',
}
const grey = {
  id: '103',
  number: 3,
  name: 'Peratus',
  attempts: 0,
  correct: 0,
  accuracy: null,
  state: 'belum-cuba',
}
const mat = { id: '1', code: 'MAT', name: 'Matematik', chapters: [red, amber, grey] }
const body = {
  data: {
    subjects: [mat, { id: '2', code: 'SNS', name: 'Sains', chapters: [{ ...grey, id: '201', name: 'Cahaya' }] }],
  },
}

describe('HeatmapResponse (GET /buku-nota/heatmap, API-DSKP-08)', () => {
  it('parses subjects[{id,name,chapters[{id,number,name,attempts,correct,accuracy,state}]}] and the empty state', () => {
    expect(HeatmapResponseSchema.safeParse(body).success).toBe(true)
    expect(HeatmapResponseSchema.safeParse({ data: { subjects: [] } }).success).toBe(true)
  })

  it('has no minimum number of attempts: 1 attempt and 0 attempts both parse', () => {
    expect(
      HeatmapChapterSchema.safeParse({ ...red, attempts: 1, correct: 0, accuracy: 0, state: 'red' })
        .success,
    ).toBe(true)
    expect(HeatmapChapterSchema.safeParse(grey).success).toBe(true)
    expect('HEATMAP_MIN_ATTEMPTS' in heatmapSchema).toBe(false)
  })

  it('accuracy is one decimal or null: a second decimal digit is rejected', () => {
    expect(HeatmapChapterSchema.safeParse(amber).success).toBe(true)
    expect(HeatmapChapterSchema.safeParse({ ...amber, accuracy: 57.14 }).success).toBe(false)
    expect(HeatmapChapterSchema.safeParse({ ...amber, accuracy: 57.142857 }).success).toBe(false)
    expect(HeatmapChapterSchema.safeParse({ ...amber, accuracy: 101 }).success).toBe(false)
    expect(HeatmapChapterSchema.safeParse({ ...amber, accuracy: -1 }).success).toBe(false)
  })

  it('accuracy is null exactly when attempts is 0, and then the state is belum-cuba', () => {
    expect(HeatmapChapterSchema.safeParse({ ...grey, accuracy: 0 }).success).toBe(false)
    expect(HeatmapChapterSchema.safeParse({ ...amber, accuracy: null }).success).toBe(false)
    expect(HeatmapChapterSchema.safeParse({ ...grey, state: 'red' }).success).toBe(false)
    expect(HeatmapChapterSchema.safeParse({ ...amber, state: 'belum-cuba' }).success).toBe(false)
  })

  it('the state is red, amber, green or belum-cuba (the PRD name); "gray" is not a state', () => {
    expect(HEATMAP_STATES).toEqual(['red', 'amber', 'green', 'belum-cuba'])
    for (const s of HEATMAP_STATES) expect(HeatmapStateSchema.safeParse(s).success).toBe(true)
    for (const s of ['gray', 'grey', 'belum_cuba'])
      expect(HeatmapStateSchema.safeParse(s).success).toBe(false)
    expect(HeatmapChapterSchema.safeParse({ ...red, state: 'gray' }).success).toBe(false)
  })

  it('number is an integer or null; ids are strings', () => {
    expect(HeatmapChapterSchema.safeParse({ ...red, number: null }).success).toBe(true)
    expect(HeatmapChapterSchema.safeParse({ ...red, number: 1.5 }).success).toBe(false)
    expect(HeatmapChapterSchema.safeParse({ ...red, id: 101 }).success).toBe(false)
    expect(HeatmapChapterSchema.safeParse({ ...red, id: '' }).success).toBe(false)
    expect(HeatmapSubjectSchema.safeParse({ ...mat, id: 1 }).success).toBe(false)
    expect(HeatmapSubjectSchema.safeParse({ ...mat, code: '' }).success).toBe(false)
    const noCode: Record<string, unknown> = { ...mat }
    delete noCode.code
    expect(HeatmapSubjectSchema.safeParse(noCode).success).toBe(false)
  })

  it('rejects correct above attempts, fractional counts, missing keys, extra keys and a bare body', () => {
    expect(HeatmapChapterSchema.safeParse({ ...red, correct: 11 }).success).toBe(false)
    expect(HeatmapChapterSchema.safeParse({ ...red, correct: -1 }).success).toBe(false)
    expect(HeatmapChapterSchema.safeParse({ ...red, attempts: 7.5 }).success).toBe(false)
    const noState: Record<string, unknown> = { ...red }
    delete noState.state
    expect(HeatmapChapterSchema.safeParse(noState).success).toBe(false)
    expect(HeatmapChapterSchema.safeParse({ ...red, percent: 40 }).success).toBe(false)
    expect(HeatmapSubjectSchema.safeParse({ ...mat, chapters: [] }).success).toBe(false)
    expect(HeatmapResponseSchema.safeParse({ subjects: [] }).success).toBe(false)
    expect(HeatmapResponseSchema.safeParse({ data: { subjects: [], hidden: 3 } }).success).toBe(
      false,
    )
  })
})

describe('rules', () => {
  it('constants', () => {
    expect(HEATMAP_AMBER_MIN_PERCENT).toBe(50)
    expect(HEATMAP_GREEN_MIN_PERCENT).toBe(80)
    expect(HEATMAP_BANDS).toEqual(['red', 'amber', 'green'])
  })

  it('heatmapBand edges on the whole percent', () => {
    expect([0, 49, 50, 79, 80, 100].map(heatmapBand)).toEqual([
      'red',
      'red',
      'amber',
      'amber',
      'green',
      'green',
    ])
  })

  it('heatmapPercent rounds half up (49.5 -> 50, 79.5 -> 80) and agrees with the exact formula', () => {
    expect(heatmapPercent(99, 200)).toBe(50)
    expect(heatmapPercent(159, 200)).toBe(80)
    expect(heatmapPercent(4, 7)).toBe(57)
    expect(heatmapPercent(0, 0)).toBe(0)
    for (let attempts = 1; attempts <= 30; attempts++) {
      for (let correct = 0; correct <= attempts; correct++) {
        expect(
          Math.abs(heatmapPercent(correct, attempts) - (100 * correct) / attempts),
        ).toBeLessThanOrEqual(0.5)
      }
    }
  })

  it('heatmapAccuracy is one decimal, half up, null without attempts (AC-MUR-14-1, AC-MUR-14-5)', () => {
    expect(heatmapAccuracy(4, 10)).toBe(40)
    expect(heatmapAccuracy(4, 7)).toBe(57.1)
    expect(heatmapAccuracy(1, 3)).toBe(33.3)
    expect(heatmapAccuracy(2, 3)).toBe(66.7)
    expect(heatmapAccuracy(1, 8)).toBe(12.5)
    expect(heatmapAccuracy(5, 5)).toBe(100)
    expect(heatmapAccuracy(0, 5)).toBe(0)
    expect(heatmapAccuracy(0, 0)).toBeNull()
  })

  it('every figure up to 40 attempts is a value the chapter schema accepts', () => {
    for (let attempts = 1; attempts <= 40; attempts++) {
      for (let correct = 0; correct <= attempts; correct++) {
        const state = heatmapBand(heatmapPercent(correct, attempts))
        const parsed = HeatmapChapterSchema.safeParse({
          ...red,
          attempts,
          correct,
          accuracy: heatmapAccuracy(correct, attempts),
          state,
        })
        expect(parsed.success, `${String(correct)}/${String(attempts)}`).toBe(true)
      }
    }
  })
})

describe('OpenAPI document', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<
      string,
      Record<string, { responses: Record<string, unknown>; parameters?: unknown[] }>
    >
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
    expect(ids).toEqual([
      'HeatmapBand',
      'HeatmapState',
      'HeatmapChapter',
      'HeatmapSubject',
      'HeatmapResponse',
    ])
    for (const id of ids) expect(doc.components.schemas[id]).toBeDefined()
  })
})

describe('errors', () => {
  it('the 401 and 403 bodies parse as the common error body', () => {
    expect(
      ErrorBodySchema.safeParse({ error: { code: 'UNAUTHORIZED', message: 'Unauthenticated.' } })
        .success,
    ).toBe(true)
    expect(
      ErrorBodySchema.safeParse({
        error: { code: 'FORBIDDEN', message: 'This action is unauthorized.' },
      }).success,
    ).toBe(true)
  })
})
