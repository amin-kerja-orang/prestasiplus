/**
 * The M05 seam of `reads.ts` (review MAJOR-2): while `practice` is absent every read is empty; once
 * it exists, a missing method or an unrecognised shape throws `RepositoryError('CONTRACT')`; rows
 * are filtered by MYT local date, mode and `status`. M05 is replaced by a mock entry here; the real
 * repository is checked by `m05-contract.test.ts` once F-26 lands.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { RepositoryError } from '@/mock/repository'

const holder: { practice: unknown } = { practice: undefined }

vi.mock('@/modules/m05-practice/mock', () => ({
  default: { id: 'M05' },
  get practice() {
    return holder.practice
  },
}))

const { m05PracticeReads } = await import('../../mock/repository/reads')

const reads = () => m05PracticeReads()

const session = (over: Record<string, unknown> = {}) => ({
  id: 'P1',
  mode: 'past_year',
  status: 'completed',
  correct: 4,
  total: 10,
  timeSpent: 300,
  completedAt: '2026-09-22T19:00:00+08:00',
  ...over,
})

function contractError(fn: () => unknown): RepositoryError {
  try {
    fn()
  } catch (err) {
    expect(err).toBeInstanceOf(RepositoryError)
    expect((err as RepositoryError).code).toBe('CONTRACT')
    return err as RepositoryError
  }
  throw new Error('expected a CONTRACT error')
}

afterEach(() => {
  holder.practice = undefined
})

describe('M05 seam', () => {
  it('practice absent → empty reads', () => {
    expect(reads().sessionsOn(2, '2026-09-22')).toEqual([])
    expect(reads().practiceSessions(2)).toEqual([])
    expect(reads().answersOn(2, '2026-09-22')).toEqual([])
    expect(reads().mastery(2)).toEqual([])
  })

  it('passes the documented filter and keeps only completed rows of that MYT day and mode', () => {
    const calls: unknown[] = []
    holder.practice = {
      history: (userId: number, filter: unknown) => {
        calls.push([userId, filter])
        return [
          session(),
          session({ id: 'late', completedAt: '2026-09-22T16:30:00Z' }), // 23/09 00:30 MYT
          session({ id: 'open', status: 'in_progress' }),
          session({ id: 'rand', mode: 'random' }),
        ]
      },
      answers: () => [
        { chapterId: 1, subjectId: 3, isCorrect: true, answeredAt: '2026-09-22T19:00:00+08:00' },
        { chapterId: 2, subjectId: 3, isCorrect: false, answeredAt: '2026-09-23T08:00:00+08:00' },
      ],
      mastery: () => [{ subjectId: 3, correct: 26, answered: 37 }],
    }
    expect(
      reads()
        .sessionsOn(2, '2026-09-22')
        .map((s) => s.id),
    ).toEqual(['P1', 'rand'])
    expect(
      reads()
        .practiceSessions(2)
        .map((s) => s.id),
    ).toEqual(['rand'])
    expect(calls).toEqual([
      [2, { date: '2026-09-22' }],
      [2, { modes: ['random', 'chapter', 'revision'] }],
    ])
    expect(
      reads()
        .answersOn(2, '2026-09-22')
        .map((a) => a.chapterId),
    ).toEqual([1])
    expect(reads().mastery(2)).toEqual([{ subjectId: 3, correct: 26, answered: 37 }])
  })

  it('practice present but a method is missing → CONTRACT', () => {
    holder.practice = { history: () => [] }
    expect(contractError(() => reads().answersOn(2, '2026-09-22')).message).toMatch(
      /practice\.answers is missing/,
    )
    expect(contractError(() => reads().mastery(2)).message).toMatch(/practice\.mastery is missing/)
  })

  it('an unrecognised shape → CONTRACT (paged object, old field names, bad answer row)', () => {
    holder.practice = {
      history: () => ({ rows: [session()], total: 1 }),
      answers: () => [{ chapterId: 1, isCorrect: 'yes', answeredAt: '2026-09-22T19:00:00+08:00' }],
      mastery: () => [{ subjectId: 3, correct: '26', answered: 37 }],
    }
    expect(contractError(() => reads().sessionsOn(2, '2026-09-22')).message).toMatch(
      /must return an array/,
    )
    expect(contractError(() => reads().answersOn(2, '2026-09-22')).message).toMatch(/isCorrect/)
    expect(contractError(() => reads().mastery(2)).message).toMatch(/subjectId \/ correct/)
    holder.practice = {
      history: () => [{ id: 'P1', mode: 'past_year', correctCount: 4, questionCount: 10 }],
    }
    expect(contractError(() => reads().sessionsOn(2, '2026-09-22')).message).toMatch(
      /lacks id \/ mode \/ correct/,
    )
  })
})
