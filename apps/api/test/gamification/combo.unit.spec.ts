import { describe, expect, it } from 'vitest'

import { FixedClock } from '../../src/db/clock'
import type { ChallengeRecord } from '../../src/modules/gamification/gamification.repository'
import { GamificationService } from '../../src/modules/gamification/gamification.service'
import { GamificationPorts, NoPracticeFacts } from '../../src/modules/gamification/ports'

import { DEFAULT_METRIC_BY_TYPE, GAME_SESSION_MODES } from '../../src/modules/gamification/gamification.constants'
import { dayMetrics } from '../../src/modules/gamification/gamification.service'
import { GAME_ANSWER_MODES, longestRunInSession } from '../../src/modules/practice/day-facts'

/** S7-T04 part 14: the `best_combo` run rule (R 4), the metric map and the game exclusion (FR-GM-19.4). */
const rows = (sessionId: string | null, pattern: string) => [...pattern].map((c) => ({ sessionId, isCorrect: c === 'C' }))

describe('longestRunInSession', () => {
  it('a run inside one session', () => {
    expect(longestRunInSession(rows('a', 'CCCWCC'))).toBe(3)
  })

  it('an incorrect answer breaks the run', () => {
    expect(longestRunInSession(rows('a', 'CCCCCWCCCCC'))).toBe(5)
    expect(longestRunInSession(rows('a', 'WWW'))).toBe(0)
  })

  it('runs of two sessions are never summed, even when their answers interleave', () => {
    expect(longestRunInSession([...rows('a', 'CCCCCC'), ...rows('b', 'CCCCC')])).toBe(6)
    const mixed = [...rows('a', 'CCC'), ...rows('b', 'CC'), ...rows('a', 'CCC'), ...rows('b', 'CC')]
    expect(longestRunInSession(mixed)).toBe(6) // a: 6 in a row inside a, b: 4
  })

  it('answers without a session do not count; no answers give 0', () => {
    expect(longestRunInSession(rows(null, 'CCCCCCCCCC'))).toBe(0)
    expect(longestRunInSession([])).toBe(0)
  })
})

describe('dayMetrics: best_combo and the game exclusion', () => {
  const s = (mode: string, correct: number, total: number, timeSpent: number) => ({ sessionId: mode, mode, correct, total, timeSpent })

  it('passes best_combo through; 0 when no combo is given', () => {
    expect(dayMetrics({ sessions: [], chapterIds: [] }, 0, 7).best_combo).toBe(7)
    expect(dayMetrics({ sessions: [], chapterIds: [] }, 0).best_combo).toBe(0)
  })

  it('game and battle sessions add nothing to any metric', () => {
    const m = dayMetrics({ sessions: [s('random', 4, 5, 120), s('game', 20, 20, 600), s('battle', 10, 10, 600)], chapterIds: ['1'] }, 0)
    expect(m).toMatchObject({ sessions: 1, correct: 4, best_correct_in_session: 4, best_accuracy: 80, minutes: 2 })
  })

  it('a game-only day leaves every challenge metric at 0 (AC-GM-19.4)', () => {
    const m = dayMetrics({ sessions: [s('game', 20, 20, 600)], chapterIds: [] }, 0)
    expect(m).toMatchObject({ sessions: 0, correct: 0, best_accuracy: 0, minutes: 0, best_combo: 0 })
  })

  it('the service and the practice module agree on the game codes', () => {
    expect([...GAME_SESSION_MODES]).toEqual([...GAME_ANSWER_MODES])
  })
})

describe('combo is a selectable challenge type', () => {
  it('maps to best_combo', () => {
    expect(DEFAULT_METRIC_BY_TYPE.combo).toBe('best_combo')
  })
})

describe('GamificationService reads best_combo only when a challenge needs it', () => {
  const rec = (id: string, metric: string): ChallengeRecord => ({
    id, title: `C${id}`, description: 'x', icon: '🎯', challengeType: 'quiz_count', metric, targetValue: 10,
    rewardSyiling: 1, rewardXp: 1, difficulty: 'easy', sortOrder: 0, isActive: true,
  })
  async function run(metrics: string[]) {
    const calls: string[] = []
    const ports = new GamificationPorts()
    ports.providePracticeFacts(Object.assign(new NoPracticeFacts(), { bestCombo: async (_u: string, day: string) => (calls.push(day), 7) }))
    const repo = {
      handle: () => ({}),
      challenges: async () => metrics.map((m, i) => rec(String(i + 1), m)),
      completedOn: async () => new Set<string>(),
      streakOf: async () => ({ current: 0, lastActivityDate: null }),
    }
    const svc = new GamificationService(repo as never, {} as never, {} as never, new FixedClock('2026-10-20T09:00:00+08:00'), ports, {} as never, {} as never, {} as never, {} as never)
    const res = await svc.challengesToday('5')
    return { calls, res }
  }

  it('no best_combo challenge: the port is not called', async () => {
    expect((await run(['sessions', 'correct'])).calls).toEqual([])
  })

  it('a best_combo challenge: one call for the Malaysia day, and its progress is the run', async () => {
    const { calls, res } = await run(['sessions', 'best_combo'])
    expect(calls).toEqual(['2026-10-20'])
    expect(res.data[1]).toMatchObject({ progress: 7, target: 10 })
  })
})
