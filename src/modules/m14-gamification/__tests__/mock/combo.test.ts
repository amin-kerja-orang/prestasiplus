/**
 * S7-T04 part 14: the mock `bestCombo` mirrors the API (R 4, FR-GM-19.4): the longest run of consecutive correct
 * answers inside ONE session today, game sessions excluded.
 */

import { createHash } from 'node:crypto'

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { challenges } from '../../mock'
import { ledgerDataset } from '../../mock/datasets/ledger'
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
  const read = (answers: PracticeAnswerFact[], modes: Record<string, string> = {}) =>
    setPracticeReadsForTests({
      sessionsOn: () => [],
      practiceSessions: () => [],
      answersOn: () => answers,
      mastery: () => [],
      sessionMode: (id) => modes[id] ?? null,
    })
  const progress = (answers: PracticeAnswerFact[], modes: Record<string, string> = {}) => {
    read(answers, modes)
    return challenges.today(3).items.find((c) => c.title === 'Kombo 10')!.progress
  }

  it('the run inside one session; a wrong answer breaks it', () => {
    expect(progress(ans('a', 'CCCWCCCCC'))).toBe(5)
  })

  it('two sessions of 4 in a row give 4, not 8', () => {
    expect(progress([...ans('a', 'CCCC'), ...ans('b', 'CCCC')])).toBe(4)
  })

  it('answers without a session and those of a game session do not count', () => {
    expect(progress(ans(null, 'CCCCCCCCCC'))).toBe(0)
    expect(progress(ans('g', 'CCCCCCCCCC'), { g: 'game' })).toBe(0)
  })

  it('progress is capped at the target (10)', () => {
    expect(progress(ans('a', 'CCCCCCCCCCCC'))).toBe(10)
  })

  it('an in-progress game or battle session (not in sessionsOn) is excluded by its mode', () => {
    expect(progress([...ans('g', 'CCCCCC'), ...ans('b', 'CCCCCCC'), ...ans('r', 'CCC')], { g: 'game', b: 'battle', r: 'random' })).toBe(3)
  })

  it('answers are ordered by answeredAt then id before the run is counted', () => {
    const at = (sec: number) => `${day}T09:00:${String(sec).padStart(2, '0')}+08:00`
    const row = (id: number, sec: number, isCorrect: boolean): PracticeAnswerFact => ({ id, sessionId: 'a', subjectId: 3, chapterId: null, isCorrect, answeredAt: at(sec) })
    // delivered out of order: by time 1C 2C 3W 4C 5C 6C 7C, by delivery order the run would read 4 and 3
    const rows = [row(1, 1, true), row(2, 2, true), row(4, 4, true), row(5, 5, true), row(3, 3, false), row(6, 6, true), row(7, 7, true)]
    expect(progress(rows)).toBe(4)
    // equal times fall back to the id: 5 right, 1 wrong, 5 right gives 5
    const ties = [...'CCCCCWCCCCC'].map((c, i) => row(i + 1, 10, c === 'C'))
    expect(progress([...ties].reverse())).toBe(5)
  })

  it('the chapters of game answers do not count as topics', () => {
    const chapter = (sessionId: string, chapterId: number): PracticeAnswerFact => ({ sessionId, subjectId: 3, chapterId, isCorrect: true, answeredAt: `${day}T09:00:00+08:00` })
    read([chapter('r', 1), chapter('g', 143), chapter('b', 136)], { r: 'random', g: 'game', b: 'battle' })
    const topic = challenges.today(3).items.find((c) => c.title === 'Penjelajah Topik')!
    expect(topic.progress).toBe(1)
  })
})

describe('generated daily_challenge ledger history is pinned (D12: Kombo 10 must not reshuffle it)', () => {
  it('6,786 rows summing to 157,672, with a fixed hash, none of them Kombo 10', () => {
    const all = ledgerDataset.query({ where: { source: 'daily_challenge' }, limit: 1_000_000 } as never).rows
    const rows = all.filter((r) => r.source === 'daily_challenge')
    expect(rows).toHaveLength(6_786)
    expect(rows.reduce((t, r) => t + r.amount, 0)).toBe(157_672)
    expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16)).toBe('35a0a2470f3bd64e')
    expect(rows.some((r) => String(r.description).includes('Kombo 10'))).toBe(false)
  })
})
