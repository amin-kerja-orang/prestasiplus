import { describe, expect, it } from 'vitest'

import { QUESTION_JENIS, QUESTION_MESSAGES, QuestionFilterBulkRequestSchema, QuestionListQuerySchema } from '../../index'

const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }): Record<string, string> =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [i.path.map(String).join('.') || '_', i.message]))

describe('Studio list filters (R1-21.5, D79): Tahun, Negeri, Kertas, Jenis', () => {
  it('accept the V2 values', () => {
    const q = QuestionListQuerySchema.safeParse({ tahun: '2024', negeri: 'Selangor', kertas: '2', jenis: 'percubaan' })
    expect(q.success).toBe(true)
    expect([...QUESTION_JENIS]).toEqual(['sebenar', 'percubaan', 'modul', 'topikal', 'latihan'])
  })
  it('refuse a malformed value with the BM filter message', () => {
    const r = QuestionListQuerySchema.safeParse({ tahun: '24', kertas: '4', jenis: 'ujian' })
    expect(issues(r)).toEqual({ tahun: QUESTION_MESSAGES.filterInvalid, kertas: QUESTION_MESSAGES.filterInvalid, jenis: QUESTION_MESSAGES.filterInvalid })
  })
})

describe('filter-based bulk action request (AC-03.3)', () => {
  const ok = { action: 'approved', filter: { tahun: '2024' }, expectedCount: 3 }
  it('accepts approve with a filter and a count, a dry run without a count, and archive with an empty filter', () => {
    expect(QuestionFilterBulkRequestSchema.safeParse(ok).success).toBe(true)
    expect(QuestionFilterBulkRequestSchema.safeParse({ action: 'approved', filter: { tahun: '2024' }, dryRun: true }).success).toBe(true)
    expect(QuestionFilterBulkRequestSchema.safeParse({ action: 'archived', filter: {}, expectedCount: 0 }).success).toBe(true)
  })
  it('needs expectedCount unless dryRun, and a filter for approve (V2 text)', () => {
    expect(issues(QuestionFilterBulkRequestSchema.safeParse({ action: 'approved', filter: { tahun: '2024' } }))).toEqual({ expectedCount: QUESTION_MESSAGES.filterCountNeeded })
    expect(issues(QuestionFilterBulkRequestSchema.safeParse({ action: 'approved', filter: {}, expectedCount: 1 }))).toEqual({ filter: QUESTION_MESSAGES.filterNeeded })
  })
  it('T47-L1: a blank string is not a filter for approve; archive stays allowed', () => {
    for (const filter of [{ search: '   ' }, { search: '' }, { search: ' \t' }]) {
      expect(issues(QuestionFilterBulkRequestSchema.safeParse({ action: 'approved', filter, expectedCount: 1 })), JSON.stringify(filter)).toEqual({ filter: QUESTION_MESSAGES.filterNeeded })
    }
    expect(QuestionFilterBulkRequestSchema.safeParse({ action: 'approved', filter: { search: ' x ' }, expectedCount: 1 }).success).toBe(true)
    expect(QuestionFilterBulkRequestSchema.safeParse({ action: 'archived', filter: { search: '  ' }, expectedCount: 1 }).success).toBe(true)
  })
  it('is strict: unknown keys, other actions and ids are refused', () => {
    expect(QuestionFilterBulkRequestSchema.safeParse({ ...ok, ids: ['1'] }).success).toBe(false)
    expect(QuestionFilterBulkRequestSchema.safeParse({ ...ok, filter: { tahun: '2024', bogus: 'x' } }).success).toBe(false)
    for (const action of ['review', 'draft', 'delete', 'published']) expect(QuestionFilterBulkRequestSchema.safeParse({ ...ok, action }).success, action).toBe(false)
    expect(QuestionFilterBulkRequestSchema.safeParse({ ...ok, expectedCount: -1 }).success).toBe(false)
    expect(QuestionFilterBulkRequestSchema.safeParse({ ...ok, expectedCount: 1.5 }).success).toBe(false)
  })
  it('V2 flash texts', () => {
    expect(QUESTION_MESSAGES.filterApproved(3)).toBe('Berjaya luluskan 3 soalan (hasil tapisan) — kini kelihatan kepada pelajar.')
    expect(QUESTION_MESSAGES.filterArchivedAll(2)).toBe('Berjaya arkib 2 soalan. Bank pelajar kini kosong — luluskan soalan secara manual untuk memaparkannya semula.')
    expect(QUESTION_MESSAGES.filterCountChanged(5, 2)).toContain('dijangka 5, kini 2')
  })
})
