/**
 * S7-T04 part 14: the mock `bestCombo` mirrors the API (R 4, FR-GM-19.4): the longest run of consecutive correct
 * answers inside ONE session today, game sessions excluded.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { challenges } from '../../mock'
import { dayMetrics } from '../../mock/repository/engine'
import { setPracticeReadsForTests, type PracticeAnswerFact } from '../../mock/repository/reads'
import { bootM14, NOW } from './helpers'

beforeAll(async () => {
  await bootM14()
}, 60_000)
afterEach(() => setPracticeReadsForTests(null))
afterAll(() => vi.unstubAllGlobals())

const s = (sessionId: string, mode: string, correct: number, total: number, timeSpent: number) => ({ sessionId, mode, correct, total, timeSpent })

describe('dayMetrics: game sessions and best combo', () => {
  it('game and battle sessions add to no metric', () => {
    const m = dayMetrics({ sessions: [s('a', 'random', 4, 5, 120), s('b', 'game', 20, 20, 600), s('c', 'battle', 10, 10, 600)], chapterIds: [], bestCombo: 3 }, 0)
    expect(m).toMatchObject({ sessions: 1, correct: 4, bestCorrectInSession: 4, bestAccuracy: 80, minutes: 2, bestCombo: 3 })
  })

  it('a day without a combo reads 0', () => {
    expect(dayMetrics({ sessions: [], chapterIds: [] }, 0).bestCombo).toBe(0)
  })
})

describe('Kombo 10 progress from the M05 answers of today', () => {
  const day = NOW.slice(0, 10)
  const ans = (sessionId: string | null, pattern: string): PracticeAnswerFact[] =>
    [...pattern].map((c, i) => ({ sessionId, subjectId: 3, chapterId: null, isCorrect: c === 'C', answeredAt: `${day}T09:00:${String(i % 60).padStart(2, '0')}+08:00` }))
  const progress = (answers: PracticeAnswerFact[], sessions: ReturnType<typeof gameSession>[] = []) => {
    setPracticeReadsForTests({ sessionsOn: () => sessions, practiceSessions: () => [], answersOn: () => answers, mastery: () => [] })
    return challenges.today(3).items.find((c) => c.title === 'Kombo 10')!.progress
  }
  const gameSession = (id: string, mode: string) => ({ id, mode, correct: 0, total: 0, timeSpent: 0, completedAt: `${day}T09:00:00+08:00` })

  it('the run inside one session; a wrong answer breaks it', () => {
    expect(progress(ans('a', 'CCCWCCCCC'))).toBe(5)
  })

  it('two sessions of 4 in a row give 4, not 8', () => {
    expect(progress([...ans('a', 'CCCC'), ...ans('b', 'CCCC')])).toBe(4)
  })

  it('answers without a session and those of a game session do not count', () => {
    expect(progress(ans(null, 'CCCCCCCCCC'))).toBe(0)
    expect(progress(ans('g', 'CCCCCCCCCC'), [gameSession('g', 'game')])).toBe(0)
  })

  it('progress is capped at the target (10)', () => {
    expect(progress(ans('a', 'CCCCCCCCCCCC'))).toBe(10)
  })
})
