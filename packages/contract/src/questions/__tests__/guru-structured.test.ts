import { describe, expect, it } from 'vitest'

import { GURU_STRUCTURED_PAGE_SIZE, GuruStructuredListQuerySchema, GuruStructuredRowSchema } from '../schema'

describe('API-GUR-26 teacher structured questions', () => {
  it('the page is fixed at 20 and the query takes status approved or review only', () => {
    expect(GURU_STRUCTURED_PAGE_SIZE).toBe(20)
    expect(GuruStructuredListQuerySchema.parse({}).page).toBe(1)
    expect(GuruStructuredListQuerySchema.safeParse({ status: 'review' }).success).toBe(true)
    expect(GuruStructuredListQuerySchema.safeParse({ status: 'draft' }).success).toBe(false)
  })

  it('a row carries no admin field', () => {
    const row = { id: '1', number: 1, textExcerpt: 'x', level: null, subject: null, kbat: 'MOTS 3', subCount: 1, marks: 8, status: 'approved' }
    expect(GuruStructuredRowSchema.parse({ ...row, sourceFile: 'leak.pdf' })).toEqual(row)
  })
})
