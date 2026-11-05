import { describe, expect, it } from 'vitest'

import { GURU_STRUCTURED_MESSAGES, GURU_STRUCTURED_PAGE_SIZE, GuruStructuredCreateRequestSchema, GuruStructuredListQuerySchema, GuruStructuredRowSchema } from '../schema'

describe('API-GUR-26 teacher structured questions', () => {
  it('the page is fixed at 20 and the query takes status approved or review only', () => {
    expect(GURU_STRUCTURED_PAGE_SIZE).toBe(20)
    expect(GuruStructuredListQuerySchema.parse({}).page).toBe(1)
    expect(GuruStructuredListQuerySchema.safeParse({ status: 'review' }).success).toBe(true)
    expect(GuruStructuredListQuerySchema.safeParse({ status: 'draft' }).success).toBe(false)
  })

  it('a row carries no admin field', () => {
    const row = { id: '1', number: 1, textExcerpt: 'x', level: null, subject: null, kbat: 'MOTS 3', subCount: 1, marks: 8, status: 'approved', source: 'question', editable: false }
    expect(GuruStructuredRowSchema.parse({ ...row, sourceFile: 'leak.pdf' })).toEqual(row)
  })
})

describe('API-GUR-17 structured variant: request schema', () => {
  const part = { text: 'a', marks: 3, scheme: 's' }
  const ok = { subjectId: '1', educationLevelId: '2', difficultyLevel: 3, parts: [part] }
  const fields = (v: unknown) => {
    const r = GuruStructuredCreateRequestSchema.safeParse(v)
    return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))
  }

  it('takes 1 to 10 parts with marks 1 to 20 and the verbatim BM messages', () => {
    expect(GuruStructuredCreateRequestSchema.safeParse(ok).success).toBe(true)
    expect(GuruStructuredCreateRequestSchema.safeParse({ ...ok, parts: Array.from({ length: 10 }, () => part) }).success).toBe(true)
    expect(fields({ ...ok, parts: [] }).parts).toBe('Sekurang-kurangnya satu sub-soalan diperlukan.')
    expect(fields({ ...ok, parts: Array.from({ length: 11 }, () => part) }).parts).toBe(GURU_STRUCTURED_MESSAGES.partsMax)
    expect(fields({ ...ok, parts: [{ ...part, marks: 21 }] })['parts.0.marks']).toBe('Markah mesti antara 1 dan 20.')
    expect(fields({ ...ok, parts: [{ ...part, marks: 0 }] })['parts.0.marks']).toBe('Markah mesti antara 1 dan 20.')
    expect(fields({ ...ok, parts: [{ ...part, marks: 2.5 }] })['parts.0.marks']).toBe('Markah mesti antara 1 dan 20.')
    expect(fields({ ...ok, parts: [{ ...part, text: ' ' }] })['parts.0.text']).toBe('Sila isi teks sub-soalan.')
    expect(fields({ ...ok, parts: [{ ...part, scheme: '' }] })['parts.0.scheme']).toBe('Sila isi skema jawapan.')
    expect(fields({ ...ok, stimulus: 'x'.repeat(4001) }).stimulus).toBe('Rangsangan tidak boleh melebihi 4000 aksara.')
    expect(GuruStructuredCreateRequestSchema.safeParse({ ...ok, stimulus: 'x'.repeat(4000) }).success).toBe(true)
  })

  it('refuses a client-sent total (the total is computed)', () => {
    expect(GuruStructuredCreateRequestSchema.safeParse({ ...ok, totalMarks: 3 }).success).toBe(false)
  })
})
