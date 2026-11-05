/** FR-QA-09 (S1-T01): the served view (`buildServedPaper` -> `partView`) keeps a leaf's `stimulusId`, nested too, and omits it when absent. */
import { describe, expect, it } from 'vitest'

import { buildServedPaper } from '../../src/modules/bijak/attempts/marking'

const leaf = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  label: id,
  prompt: 'p',
  marks: 1,
  answer: { kind: 'short_text' },
  ...extra,
})

describe('partView stimulusId', () => {
  it('keeps stimulusId on a nested leaf and omits the key on a leaf without one', () => {
    const question = {
      id: 'q1',
      stem: 'Stem',
      curriculum: { unitLabel: 'U', formOrigin: 'T4' },
      parts: [
        {
          id: 'q1.a',
          label: '(a)',
          prompt: 'p',
          marks: 0,
          children: [leaf('q1.a.i', { stimulusId: 'qb-s71' }), leaf('q1.a.ii')],
        },
        leaf('q1.b'),
      ],
    }
    const composition = [{ id: 's1', label: 'A', questionIds: ['q1'], rule: { type: 'all' } }]
    const served = buildServedPaper(composition as never, new Map([['q1', { question, schemes: {} }]]) as never)
    const parts = served.questions[0]?.parts
    const kids = parts?.[0]?.children
    expect(kids?.[0]?.stimulusId).toBe('qb-s71')
    expect(kids?.[1]).not.toHaveProperty('stimulusId')
    expect(parts?.[1]).not.toHaveProperty('stimulusId')
  })
})
