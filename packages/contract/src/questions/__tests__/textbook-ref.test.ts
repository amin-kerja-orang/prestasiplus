import { describe, expect, it } from 'vitest'

import { QUESTION_TEXTBOOK_PAGE_MESSAGE, QuestionTextbookRefSchema, textbookRefCompact } from '../schema'

/** AC-QA-29 (PRD 45 T-11, DM-56): Bab 3, Tingkatan 4, muka surat 56 shows "B3T4 M56" in the scheme panel; the page is 1 to 999. */
describe('AC-QA-29 Rujukan buku teks', () => {
  const ref = { bab: '3', tingkatan: 'T4', mukaSurat: 56 } as const

  it('the compact form is "B3T4 M56", and "B3T4 M56-58" with hingga', () => {
    expect(textbookRefCompact(QuestionTextbookRefSchema.parse(ref))).toBe('B3T4 M56')
    expect(textbookRefCompact(QuestionTextbookRefSchema.parse({ ...ref, hingga: 58 }))).toBe('B3T4 M56-58')
  })

  it('page 0 and page 1000 are refused with the page message (also for hingga); 1 and 999 pass', () => {
    for (const bad of [0, 1000]) {
      const r = QuestionTextbookRefSchema.safeParse({ ...ref, mukaSurat: bad })
      expect(r.success).toBe(false)
      expect(r.error?.issues.map((i) => i.message)).toEqual([QUESTION_TEXTBOOK_PAGE_MESSAGE])
      expect(QuestionTextbookRefSchema.safeParse({ ...ref, hingga: bad }).error?.issues.map((i) => i.message)).toEqual([QUESTION_TEXTBOOK_PAGE_MESSAGE])
    }
    expect(QuestionTextbookRefSchema.safeParse({ ...ref, mukaSurat: 1, hingga: 999 }).success).toBe(true)
  })
})
