import { describe, expect, it } from 'vitest'

import { OverviewTopicProgress } from '../../src/modules/practice/reads/overview/topic-progress.provider'

/** S4-T06: the learner topic is the chapter, so progress is keyed by chapter id and no longer paired to legacy topics by index. No database. */
describe('OverviewTopicProgress after the chapter read switch', () => {
  const provider = (totals: Map<string, { answered: number; correct: number; sessions: number }>) =>
    new OverviewTopicProgress({ chapterTotals: () => Promise.resolve(totals) } as never)

  it('keys the figures by chapter id with min(100, round(100 x correct / 20))', async () => {
    const out = await provider(
      new Map([
        ['41', { answered: 23, correct: 19, sessions: 3 }],
        ['7', { answered: 7, correct: 3, sessions: 2 }],
        ['9', { answered: 40, correct: 30, sessions: 4 }],
      ]),
    ).topicProgress('1')
    expect([...out.keys()].sort()).toEqual(['41', '7', '9'])
    expect(out.get('41')).toEqual({ sessions: 3, questionsAnswered: 23, progress: 95 })
    expect(out.get('7')).toEqual({ sessions: 2, questionsAnswered: 7, progress: 15 })
    expect(out.get('9')).toEqual({ sessions: 4, questionsAnswered: 40, progress: 100 })
  })

  it('a learner without answers has no entry (every topic reads 0)', async () => {
    expect((await provider(new Map()).topicProgress('1')).size).toBe(0)
  })

  it('does not read the curriculum tables: a chapter of any level (Tingkatan 1 to 5) is reported as is', async () => {
    const out = await provider(new Map([['1001', { answered: 1, correct: 1, sessions: 1 }]])).topicProgress('1')
    expect(out.get('1001')).toEqual({ sessions: 1, questionsAnswered: 1, progress: 5 })
  })
})
