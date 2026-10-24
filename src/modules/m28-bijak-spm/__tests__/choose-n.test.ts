import { describe, expect, it } from 'vitest'

import {
  chooseCounterLine,
  chooseFullHint,
  chooseOverflowHint,
  chooseState,
  countedIds,
  pickOnAnswer,
  progressOf,
  unansweredIn,
} from '../domain/choose-n'
import { BijakServer, MemoryStorage } from '../server/store'

const c = (id: string, attempted: boolean, awarded = 0) => ({ id, attempted, awarded })

describe('countedIds (AC-06.3, FB-048)', () => {
  it('counts the best N attempted by marks, ties to the lower position', () => {
    const qs = [c('a', true, 2), c('b', true, 5), c('c', true, 5)]
    expect(countedIds(qs, 1)).toEqual(['b'])
    expect(countedIds(qs, 2)).toEqual(['b', 'c'])
  })
  it('ignores the ticks while enough questions are attempted', () => {
    const qs = [c('a', true, 3), c('b', false)]
    expect(countedIds(qs, 1, ['b'])).toEqual(['a'])
  })
  it('lets a ticked blank question fill a free slot, so a chosen question is never "tidak dikira"', () => {
    const qs = [c('a', false), c('b', false)]
    expect(countedIds(qs, 1, ['b'])).toEqual(['b'])
    expect(countedIds(qs, 2, ['b'])).toEqual(['b'])
  })
  it('fills only the missing slots, in paper order', () => {
    const qs = [c('a', false), c('b', true, 1), c('c', false)]
    expect(countedIds(qs, 2, ['c', 'a'])).toEqual(['a', 'b'])
  })
  it('counts nothing when nothing is attempted or ticked', () => {
    expect(countedIds([c('a', false), c('b', false)], 1)).toEqual([])
  })
  it('never counts more than N', () => {
    const qs = [c('a', true, 1), c('b', true, 1), c('c', false)]
    expect(countedIds(qs, 1, ['a', 'b', 'c'])).toHaveLength(1)
  })
})

describe('chooseState and copy', () => {
  const ids = ['q1', 'q2', 'q3']
  it('counts ticks of the section only, and flags the cap and the overflow', () => {
    const st = chooseState(1, ids, ['q2', 'other'], new Set(['q2']))
    expect(st).toEqual({ chosen: 1, answered: 1, full: true, overflow: false })
    expect(chooseState(1, ids, ['q2'], new Set(['q2', 'q3'])).overflow).toBe(true)
    expect(chooseState(2, ids, undefined, new Set())).toMatchObject({ chosen: 0, full: false })
  })
  it('uses the exact BM copy', () => {
    expect(chooseCounterLine(1, 2)).toBe('1 / 2 soalan dipilih')
    expect(chooseFullHint(1)).toBe(
      'Anda sudah memilih 1 soalan. Nyahpilih soalan lain untuk menukar pilihan.',
    )
    expect(chooseOverflowHint(2, 1)).toBe(
      'Anda telah menjawab 2 soalan. Hanya 1 soalan dengan markah tertinggi akan dikira.',
    )
  })
  it('ticks a question when it is answered and the section has room', () => {
    expect(pickOnAnswer([], 'q1', 1)).toEqual(['q1'])
    const full = ['q2']
    expect(pickOnAnswer(full, 'q1', 1)).toBe(full)
    const same = ['q1']
    expect(pickOnAnswer(same, 'q1', 1)).toBe(same)
  })
  it('counts unanswered questions of an "all" section but only the open slots of a choose section', () => {
    const answered = new Set(['q1'])
    expect(unansweredIn({ type: 'all' }, ids, answered)).toBe(2)
    expect(unansweredIn({ type: 'choose', n: 1 }, ids, answered)).toBe(0)
    expect(unansweredIn({ type: 'choose', n: 2 }, ids, answered)).toBe(1)
    expect(unansweredIn({ type: 'choose', n: 1 }, ids, new Set())).toBe(1)
  })
})

describe('progressOf: Kemajuan menjawab', () => {
  const sections = [
    { rule: { type: 'all' } as const, questionIds: ['a1', 'a2'] },
    { rule: { type: 'choose', n: 1 } as const, questionIds: ['b1', 'b2'] },
  ]
  it('counts a choose section as N, so one answered alternative completes it', () => {
    expect(progressOf(sections, new Set())).toEqual({ done: 0, total: 3 })
    expect(progressOf(sections, new Set(['a1', 'b2']))).toEqual({ done: 2, total: 3 })
    expect(progressOf(sections, new Set(['a1', 'a2', 'b1']))).toEqual({ done: 3, total: 3 })
  })
  it('does not count overflow answers', () => {
    expect(progressOf(sections, new Set(['a1', 'a2', 'b1', 'b2']))).toEqual({ done: 3, total: 3 })
  })
})

describe('result counting on the server (FB-048)', () => {
  const USER = 7
  const run = async (picks: Record<string, string[]>, changes: { id: string; text: string }[]) => {
    const server = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
    const { attemptId } = await server.startAttempt(USER, 'sej-k2-2025-a', 'exam')
    await server.submit(USER, attemptId, {
      idempotencyKey: 'k',
      changes: changes.map((x, i) => ({
        partId: x.id,
        answer: { text: x.text },
        rev: i + 1,
        savedAt: i + 1,
      })),
      picks,
    })
    return (await server.getResult(USER, attemptId)).result
  }
  const SEC = 'sej-k2-2025-a-s2'

  it('counts the ticked question when nothing is answered (no "tiada")', async () => {
    const r = await run({ [SEC]: ['sej2-q4'] }, [])
    const b = r.sections.find((s) => s.sectionId === SEC)!
    expect(b.counted).toEqual(['sej2-q4'])
    expect(b.awarded).toBe(0)
    expect(r.questions.find((q) => q.questionId === 'sej2-q4')!.counted).toBe(true)
    expect(r.questions.find((q) => q.questionId === 'sej2-q3')!.counted).toBe(false)
  })
  it('counts nothing when nothing is answered and nothing is ticked', async () => {
    const r = await run({}, [])
    expect(r.sections.find((s) => s.sectionId === SEC)!.counted).toEqual([])
  })
})
