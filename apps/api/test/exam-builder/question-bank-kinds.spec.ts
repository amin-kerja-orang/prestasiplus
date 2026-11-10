import { questionTypeFromDb, questionTypeToDb } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { kindOfRows } from '../../src/modules/exam/builder/question-bank.mapping'

describe('question-bank mapping of the S1-T09a kinds', () => {
  it('[CI] round-trips the DB values and keeps mcq_multi and true_false objective, fill_blank structured', () => {
    for (const t of ['mcq', 'mcq_multi', 'true_false', 'fill_blank'] as const) expect(questionTypeFromDb(questionTypeToDb(t))).toBe(t)
    expect(kindOfRows(questionTypeToDb('mcq'), [])).toBe('objektif')
    expect(kindOfRows(questionTypeToDb('mcq_multi'), [])).toBe('objektif')
    expect(kindOfRows(questionTypeToDb('true_false'), [])).toBe('objektif')
    expect(kindOfRows(questionTypeToDb('fill_blank'), [])).toBe('berstruktur')
  })
})
