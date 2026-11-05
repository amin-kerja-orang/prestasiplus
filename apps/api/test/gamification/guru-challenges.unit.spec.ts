import { describe, expect, it } from 'vitest'

import { FixedClock } from '../../src/db/clock'
import { GamificationService } from '../../src/modules/gamification/gamification.service'
import type { ChallengeRecord } from '../../src/modules/gamification/gamification.repository'

const rec = (id: string, sortOrder: number, over: Partial<ChallengeRecord> = {}): ChallengeRecord => ({
  id,
  title: `Cabaran ${id}`,
  description: `Huraian ${id}`,
  icon: '🎯',
  challengeType: 'quiz_count',
  metric: 'sessions',
  targetValue: 3,
  rewardSyiling: 10,
  rewardXp: 5,
  difficulty: 'easy',
  sortOrder,
  isActive: true,
  ...over,
})

/** A fake repository: completions keyed by day, so the day the service asks for decides the counts. */
function build(now: string, byDay: Record<string, Record<string, number>>) {
  const asked: { day: string; ids: bigint[] }[] = []
  const repo = {
    handle: () => ({}),
    challenges: async (_db: unknown, activeOnly: boolean) => {
      expect(activeOnly).toBe(true)
      return [rec('1', 1), rec('2', 2, { targetValue: 5, difficulty: 'hard' }), rec('3', 3)]
    },
    completionCountsOn: async (_db: unknown, day: string, ids: bigint[]) => {
      asked.push({ day, ids })
      return new Map(Object.entries(byDay[day] ?? {}))
    },
  }
  const svc = new GamificationService(repo as never, {} as never, {} as never, new FixedClock(now), {} as never, {} as never, {} as never, {} as never)
  return { svc, asked }
}

describe('GamificationService.challengesForTeacher (S6-T07)', () => {
  it('lists active challenges in display order with the per-challenge count of today', async () => {
    const { svc, asked } = build('2026-11-05T04:00:00Z', { '2026-11-05': { '1': 2, '3': 1 } })
    const rows = await svc.challengesForTeacher(['10', '11'])
    expect(rows.map((r) => r.id)).toEqual(['1', '2', '3'])
    expect(rows.map((r) => r.completedToday)).toEqual([2, 0, 1])
    expect(rows[1]).toEqual({ id: '2', title: 'Cabaran 2', description: 'Huraian 2', target: 5, rewardSyiling: 10, rewardXp: 5, difficulty: 'hard', icon: '🎯', completedToday: 0 })
    expect(asked).toEqual([{ day: '2026-11-05', ids: [10n, 11n] }])
  })

  it('uses the Malaysia day: 16:30 UTC is already tomorrow, so yesterday\'s completions are not counted', async () => {
    const data = { '2026-11-05': { '1': 4 }, '2026-11-06': { '1': 1 } }
    expect((await build('2026-11-05T15:59:00Z', data).svc.challengesForTeacher(['10']))[0]!.completedToday).toBe(4)
    expect((await build('2026-11-05T16:00:00Z', data).svc.challengesForTeacher(['10']))[0]!.completedToday).toBe(1)
  })

  it('no completions anywhere gives zero for every challenge', async () => {
    const { svc } = build('2026-11-05T04:00:00Z', {})
    expect((await svc.challengesForTeacher([])).map((r) => r.completedToday)).toEqual([0, 0, 0])
  })
})
