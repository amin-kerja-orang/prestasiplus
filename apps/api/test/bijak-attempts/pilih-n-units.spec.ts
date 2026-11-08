/** S1-T09a part 6b: in a "Pilih N" Bahagian a stimulus group is ONE choice unit (45 5.4 rule 4, FR-QA-41). Pure unit test, no database. */
import { describe, expect, it } from 'vitest'

import type { PartAnswer, SectionSnapshot } from '../../src/modules/bijak/attempts/exam-core.adapter'
import { gradeAttempt } from '../../src/modules/bijak/attempts/marking'
import type { BijakQuestionBundle } from '../../src/modules/bijak/attempts/ports'

const bundle = (qid: string, marks: number, groupId?: string): BijakQuestionBundle =>
  ({
    question: {
      id: qid,
      curriculum: { subject: 'SEJ', unitLabel: 'u', formOrigin: 1 },
      stem: 's',
      ...(groupId ? { groupId } : {}),
      parts: [{ id: `${qid}-a`, label: '', prompt: 'p', marks, answer: { kind: 'short_text' as const } }],
    },
    schemes: { [`${qid}-a`]: { kind: 'accepted' as const, marks, values: [{ v: 'ya' }] } },
  }) as unknown as BijakQuestionBundle

const bundles = new Map([
  ['g1', bundle('g1', 1, 'G')],
  ['g2', bundle('g2', 1, 'G')],
  ['s1', bundle('s1', 2)],
  ['s2', bundle('s2', 2)],
])
const right: PartAnswer = { text: 'ya' }
const wrong: PartAnswer = { text: 'tidak' }
const answers = (m: Record<string, PartAnswer>) => new Map(Object.entries(m).map(([q, a]) => [`${q}-a`, a]))
const section = (rule: SectionSnapshot['rule']): SectionSnapshot[] => [{ id: 'b', label: 'B', rule, questionIds: ['g1', 'g2', 's1', 's2'] }]

describe('Pilih N choice units in the attempt result', () => {
  it('[CI] Pilih 2: the 2-member group is one unit, so both members count and the best 2 units are the total', () => {
    const r = gradeAttempt(section({ type: 'choose', n: 2 }), bundles, answers({ g1: right, g2: right, s1: right, s2: wrong }), 1)
    // units: G = 2, s1 = 2, s2 = 0 -> G and s1 count; per-question ranking would have kept s1 and g1 only.
    expect(r.sections[0]?.counted).toEqual(['g1', 'g2', 's1'])
    expect(r.score).toBe(4)
    expect(r.max).toBe(4)
  })

  it('[CI] Pilih 1: a weaker group is dropped whole (both members)', () => {
    const r = gradeAttempt(section({ type: 'choose', n: 1 }), bundles, answers({ g1: right, g2: wrong, s1: right }), 1)
    expect(r.sections[0]?.counted).toEqual(['s1'])
    expect(r.questions.filter((q) => !q.counted).map((q) => q.questionId)).toEqual(['g1', 'g2', 's2'])
    expect(r.score).toBe(2)
  })

  it('[CI] semua is unchanged: every question counts', () => {
    const r = gradeAttempt(section({ type: 'all' }), bundles, answers({ g1: right, g2: right, s1: right, s2: wrong }), 1)
    expect(r.sections[0]?.counted).toEqual(['g1', 'g2', 's1', 's2'])
    expect(r.score).toBe(4)
    expect(r.max).toBe(6)
  })
})
