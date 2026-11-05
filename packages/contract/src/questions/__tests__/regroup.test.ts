import { describe, expect, it } from 'vitest'

import { QuestionListQuerySchema } from '../schema'
import { FlagDismissRequestSchema, REGROUP_MESSAGES, RegroupRequestSchema, RegroupUndoResultSchema, RegroupWorklistQuerySchema } from '../regroup'
import { QuestionFilterSchema } from '../schema'
import { STIMULUS_MESSAGES } from '../stimuli'

/** S1-T07 part 2: the request shapes of API-Q-12, API-Q-24, API-Q-13 and the API-Q-01 filters. */
describe('regroup contract (S1-T07)', () => {
  it('[CI] the undo conflict text is the one of 60 line 775', () => {
    expect(REGROUP_MESSAGES.undoConflict).toBe('Kumpulan telah diubah selepas kumpul semula; tidak boleh dibuat asal.')
    expect(RegroupUndoResultSchema.parse({ restored: 3 })).toEqual({ restored: 3 })
  })

  it('[CI] dismiss takes one of the three flags, strictly', () => {
    expect(FlagDismissRequestSchema.safeParse({ flag: 'figure_only' }).success).toBe(true)
    const bad = FlagDismissRequestSchema.safeParse({ flag: 'lain' })
    expect(bad.success).toBe(false)
    expect(FlagDismissRequestSchema.safeParse({ flag: 'stem_duplicated', extra: 1 }).success).toBe(false)
  })

  it('[CI] regroup: exactly one stimulus source, 1..40 distinct members, strict', () => {
    const ok = (body: unknown) => RegroupRequestSchema.safeParse(body).success
    expect(ok({ figureQuestionId: '1', memberQuestionIds: ['2'] })).toBe(true)
    expect(ok({ figureQuestionId: '1', stimulus: { alt: 'x' }, memberQuestionIds: ['2'] })).toBe(true)
    expect(ok({ stimulusId: '1', memberQuestionIds: ['2'] })).toBe(true)
    expect(ok({ stimulus: { kind: 'passage', body: { ms: 'x' } }, memberQuestionIds: ['2'], label: null })).toBe(true)
    expect(ok({ memberQuestionIds: ['2'] })).toBe(false)
    expect(ok({ stimulusId: '1', figureQuestionId: '3', memberQuestionIds: ['2'] })).toBe(false)
    expect(ok({ stimulusId: '1', stimulus: {}, memberQuestionIds: ['2'] })).toBe(false)
    expect(ok({ stimulusId: '1', memberQuestionIds: [] })).toBe(false)
    expect(ok({ stimulusId: '1', memberQuestionIds: ['2', '2'] })).toBe(false)
    expect(ok({ stimulusId: '1', memberQuestionIds: Array.from({ length: 41 }, (_, i) => String(i + 1)) })).toBe(false)
    expect(ok({ stimulusId: '1', memberQuestionIds: ['2'], surprise: true })).toBe(false)
  })

  it('[CI] work-list query: levelId alias, flag enum, paging bounds', () => {
    expect(RegroupWorklistQuerySchema.parse({ levelId: '4', flag: 'stem_duplicated' })).toMatchObject({ levelId: '4', flag: 'stem_duplicated', page: 1, pageSize: 20 })
    expect(RegroupWorklistQuerySchema.safeParse({ flag: 'lain' }).success).toBe(false)
    expect(RegroupWorklistQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false)
  })

  it('[CI] API-Q-01 filters: the list query and the bulk-by-filter body accept the same new keys, with the BM filter text', () => {
    const keys = { tingkatan: 'T4', chapter: 'none', unit: '12', source: 'guru', q: 'rajah 14', flag: 'stimulus_missing' }
    expect(QuestionListQuerySchema.parse({ ...keys })).toMatchObject(keys)
    expect(QuestionFilterSchema.parse({ ...keys })).toMatchObject(keys)
    expect(QuestionFilterSchema.safeParse({ chapter: '55' }).success).toBe(true)
    for (const bad of [{ tingkatan: 'T9' }, { chapter: 'abc' }, { source: 'lain' }, { flag: 'lain' }]) {
      const res = QuestionListQuerySchema.safeParse(bad)
      expect(res.success).toBe(false)
      expect(res.error?.issues[0]?.message).toBe('Nilai penapis tidak sah.')
    }
    expect(QuestionListQuerySchema.safeParse({ q: 'a'.repeat(101) }).error?.issues[0]?.message).toBe('Carian tidak boleh melebihi 100 aksara.')
    expect(STIMULUS_MESSAGES.requestInvalid).toBe('Data yang dihantar tidak sah. Sila semak dan cuba lagi.')
  })
})
