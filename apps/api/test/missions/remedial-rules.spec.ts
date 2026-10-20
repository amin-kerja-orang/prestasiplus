import { describe, expect, it } from 'vitest'

import { type AnswerFact, percent, round, shuffled, type TopicInfo, topicKeyOf, weakTopicsOf } from '../../src/modules/classes/missions/remedial.rules'
import { prngStream } from '../../src/db/prng'

const fact = (questionId: string | null, correct: boolean, over: Partial<AnswerFact> = {}): AnswerFact => ({ questionId, subjectId: '1', chapterId: null, isCorrect: correct, ...over })
const info = new Map<string, TopicInfo>([
  ['10', { spId: '100', chapterId: '5' }],
  ['11', { spId: '100', chapterId: '5' }],
  ['12', { spId: null, chapterId: '6' }],
  ['13', { spId: '101', chapterId: null }],
])

describe('remedial rules (BR-M10-11, pure)', () => {
  it('round halves away from zero and percent of nothing is 0', () => {
    expect(round(12.25, 1)).toBe(12.3)
    expect(round(-87.5)).toBe(-88)
    expect(round(33.333, 1)).toBe(33.3)
    expect(percent(1, 3)).toBeCloseTo(33.333, 3)
    expect(percent(0, 0)).toBe(0)
  })

  it('topic key: the SP first, else the chapter of the bank, else the answer\'s chapter, else none', () => {
    expect(topicKeyOf(info, fact('10', true))).toBe('sp:100')
    expect(topicKeyOf(info, fact('12', true))).toBe('ch:6')
    expect(topicKeyOf(info, fact('99', true, { chapterId: '9' }))).toBe('ch:9')
    expect(topicKeyOf(info, fact(null, true, { chapterId: '9' }))).toBe('ch:9')
    expect(topicKeyOf(info, fact(null, true))).toBeNull()
  })

  it('a topic is weak with at least 2 answers and accuracy below 50 (exactly 50 is not weak), weakest first', () => {
    const weak = weakTopicsOf(
      [
        fact('10', true), fact('11', false), // sp:100 = 50 -> not weak
        fact('12', false), fact('12', false), // ch:6 = 0
        fact('13', false), // sp:101 one answer -> below the minimum
        fact(null, false, { chapterId: '9' }), fact(null, true, { chapterId: '9' }), fact(null, false, { chapterId: '9' }), // ch:9 = 33.3
      ],
      info,
    )
    expect(weak).toEqual([
      { subjectId: '1', key: 'ch:6', accuracy: 0 },
      { subjectId: '1', key: 'ch:9', accuracy: 33.3 },
    ])
  })

  it('equal accuracy is ordered by key', () => {
    const weak = weakTopicsOf([fact(null, false, { chapterId: '2' }), fact(null, false, { chapterId: '2' }), fact('10', false), fact('11', false)], info)
    expect(weak.map((w) => w.key)).toEqual(['ch:2', 'sp:100'])
  })

  it('the shuffle is a deterministic permutation per stream', () => {
    const ids = ['1', '2', '3', '4', '5', '6', '7', '8']
    const a = shuffled(ids, prngStream('x'))
    expect(shuffled(ids, prngStream('x'))).toEqual(a)
    expect([...a].sort()).toEqual(ids)
    expect(ids).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
  })
})
