import { describe, expect, it } from 'vitest'

import { paperServabilityRows } from '../../mock/data/paper-servability'
import type { Question } from '../../mock/repository/types'

const q = (id: number, over: Partial<Question> = {}): Question => ({ id, subjectId: 3, status: 'approved', isActive: true, ...over }) as Question

describe('mock paper servability', () => {
  it('is deterministic: none, one or two papers by id', () => {
    expect(paperServabilityRows(q(3), 'Matematik')).toEqual([])
    expect(paperServabilityRows(q(4), 'Matematik')).toHaveLength(1)
    expect(paperServabilityRows(q(5), 'Matematik')).toHaveLength(2)
    expect(paperServabilityRows(q(5), 'Matematik')).toEqual(paperServabilityRows(q(5), 'Matematik'))
  })

  it('serves the papers of an approved question and refuses those of a draft with the contract sentence', () => {
    expect(paperServabilityRows(q(4), 'Matematik')[0]).toMatchObject({ served: true, reasons: [] })
    const draft = paperServabilityRows(q(4, { status: 'draft' }), 'Matematik')[0]
    expect(draft?.served).toBe(false)
    expect(draft?.reasons[0]).toMatchObject({ code: 'not_approved', message: 'Belum diluluskan — tekan Terbitkan untuk memaparkannya.' })
  })

  it('adds a paper with a question_missing placement on every seventh id', () => {
    const rows = paperServabilityRows(q(7), 'Matematik')
    const last = rows[rows.length - 1]
    expect(last?.served).toBe(false)
    expect(last?.reasons[0]?.code).toBe('question_missing')
  })
})
