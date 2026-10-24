import { describe, expect, it } from 'vitest'

import {
  chooseCounterLine,
  chooseFullHint,
  chooseOverflowHint,
  chooseLockedHint,
  chooseState,
  effectiveAnswered,
  isLockedQuestion,
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

describe('Mod Peperiksaan: the student must choose (FB-048 per mode)', () => {
  const qs = [c('a', true, 5), c('b', true, 1), c('c', false)]

  it('counts only the ticked questions, however well the others scored', () => {
    expect(countedIds(qs, 1, ['b'], 'exam')).toEqual(['b'])
    expect(countedIds(qs, 2, ['c', 'b'], 'exam')).toEqual(['b', 'c'])
  })
  it('counts a ticked blank question (0 marks) and nothing when nothing is ticked', () => {
    expect(countedIds(qs, 1, ['c'], 'exam')).toEqual(['c'])
    expect(countedIds(qs, 1, [], 'exam')).toEqual([])
  })
  it('an unticked answered question does not count (untick keeps the answer, loses the count)', () => {
    expect(countedIds(qs, 1, [], 'exam')).not.toContain('a')
  })
  it('never counts more than N even if more were ticked', () => {
    expect(countedIds(qs, 1, ['a', 'b', 'c'], 'exam')).toEqual(['a'])
  })
  it('Latihan is unchanged by the mode argument', () => {
    expect(countedIds(qs, 1, ['c'])).toEqual(['a'])
    expect(countedIds(qs, 1, ['c'], 'latihan')).toEqual(['a'])
  })

  it('locks the unticked questions once N are ticked, only in Peperiksaan', () => {
    const full = chooseState(1, ['a', 'b'], ['a'], new Set(['a']))
    expect(isLockedQuestion('exam', full, false)).toBe(true)
    expect(isLockedQuestion('exam', full, true)).toBe(false)
    expect(isLockedQuestion('latihan', full, false)).toBe(false)
    const open = chooseState(1, ['a', 'b'], [], new Set())
    expect(isLockedQuestion('exam', open, false)).toBe(false)
  })
  it('re-ticking at the cap: untick frees the slot, tick again re-locks the other', () => {
    const ids = ['a', 'b']
    // a ticked: b locked
    expect(isLockedQuestion('exam', chooseState(1, ids, ['a'], new Set(['a'])), false)).toBe(true)
    // a unticked (answer kept): nothing locked, b can be answered
    const unticked = chooseState(1, ids, [], new Set(['a']))
    expect(isLockedQuestion('exam', unticked, false)).toBe(false)
    // b ticked now: a is locked, its answer is still there but does not count
    const bTicked = chooseState(1, ids, ['b'], new Set(['a']))
    expect(isLockedQuestion('exam', bTicked, false)).toBe(true)
    expect(countedIds([c('a', true, 3), c('b', false)], 1, ['b'], 'exam')).toEqual(['b'])
    // a ticked again after b was unticked: counts again
    expect(countedIds([c('a', true, 3), c('b', false)], 1, ['a'], 'exam')).toEqual(['a'])
  })
  it('the lock hint copy', () => {
    expect(chooseLockedHint(1)).toBe(
      'Anda sudah memilih 1 soalan. Nyahpilih soalan lain untuk menjawab soalan ini.',
    )
  })

  const sections = [
    { id: 's1', rule: { type: 'all' } as const, questionIds: ['a1', 'a2'] },
    { id: 's2', rule: { type: 'choose', n: 1 } as const, questionIds: ['b1', 'b2'] },
  ]
  it('answered / unanswered / progress follow the exam rule', () => {
    const answered = new Set(['a1', 'b1', 'b2'])
    const eff = effectiveAnswered(sections, { s2: ['b2'] }, answered, 'exam')
    expect([...eff].sort()).toEqual(['a1', 'b2'])
    expect(progressOf(sections, eff)).toEqual({ done: 2, total: 3 })
    expect(unansweredIn(sections[1]!.rule, sections[1]!.questionIds, eff)).toBe(0)
    expect(unansweredIn(sections[0]!.rule, sections[0]!.questionIds, eff)).toBe(1)
    // unticked answers do not fill the slot
    const none = effectiveAnswered(sections, { s2: [] }, answered, 'exam')
    expect(unansweredIn(sections[1]!.rule, sections[1]!.questionIds, none)).toBe(1)
    // Latihan: every answer counts as answered
    expect(effectiveAnswered(sections, {}, answered, 'latihan').size).toBe(3)
  })
})

describe('result counting per mode on the server', () => {
  const USER = 7
  const SEC = 'sej-k2-2025-a-s2'
  const run = async (
    mode: 'exam' | 'latihan',
    picks: Record<string, string[]>,
    typed: string[],
  ) => {
    const server = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
    const { attemptId } = await server.startAttempt(USER, 'sej-k2-2025-a', mode)
    await server.submit(USER, attemptId, {
      idempotencyKey: 'k',
      changes: typed.map((id, i) => ({
        partId: `${id}-a`,
        answer: { text: 'jawapan' },
        rev: i + 1,
        savedAt: i + 1,
      })),
      picks,
    })
    return (await server.getResult(USER, attemptId)).result.sections.find(
      (s) => s.sectionId === SEC,
    )!
  }
  it('exam: ticked blank counts; untick with an answer does not; re-tick counts again', async () => {
    expect((await run('exam', { [SEC]: ['sej2-q4'] }, [])).counted).toEqual(['sej2-q4'])
    expect((await run('exam', { [SEC]: [] }, ['sej2-q3'])).counted).toEqual([])
    expect((await run('exam', { [SEC]: ['sej2-q3'] }, ['sej2-q3'])).counted).toEqual(['sej2-q3'])
  })
  it('exam: an answer in the unticked question is ignored although it exists', async () => {
    const r = await run('exam', { [SEC]: ['sej2-q4'] }, ['sej2-q3'])
    expect(r.counted).toEqual(['sej2-q4'])
  })
  it('latihan: answers count whatever was ticked (best N)', async () => {
    const r = await run('latihan', { [SEC]: ['sej2-q4'] }, ['sej2-q3'])
    expect(r.counted).toEqual(['sej2-q3'])
    expect((await run('latihan', { [SEC]: ['sej2-q4'] }, [])).counted).toEqual(['sej2-q4'])
  })
})
