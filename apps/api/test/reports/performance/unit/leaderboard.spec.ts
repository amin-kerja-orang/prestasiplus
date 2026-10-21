import { PerformanceLeaderboardSchema } from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import { parsePeriod, periodWindow } from '../../../../src/modules/reports/performance/domain'
import { ctxOf, NOW } from '../fakes/fixtures'
import { addPupil, socialWorld, type SocialWorld } from '../fakes/social-world'

let w: SocialWorld
const viewer = ctxOf('student', '1')

// NOW = Friday 2026-09-25 15:40 MYT: the week starts Monday 2026-09-21, the month on 2026-09-01.
const session = (userId: string, at: string, coins: number, correct = 8, questions = 10) =>
  w.practice.addSession({ userId, completedAt: new Date(at), questionCount: questions, correctCount: correct, coins })

beforeEach(() => {
  w = socialWorld()
  addPupil(w, '1', 'Aina Binti Hassan', 's1')
  addPupil(w, '2', 'Bakar Bin Ismail', 's1')
  addPupil(w, '3', 'Chong Wei Ming', 's2')
  session('1', '2026-09-22T10:00:00+08:00', 30, 8, 10)
  session('1', '2026-09-23T10:00:00+08:00', 20, 6, 10)
  session('2', '2026-09-24T10:00:00+08:00', 50, 10, 10)
  session('3', '2026-09-20T23:59:00+08:00', 90) // Sunday: last week
  session('3', '2026-09-05T10:00:00+08:00', 10) // this month only
})

describe('Leaderboard (S20)', () => {
  it('week: ordered by coins DESC; accuracy is the mean of the session percentages; me is the viewer', async () => {
    const r = await w.board.leaderboard(viewer, 'week')
    expect(r.period).toBe('week')
    // the viewer is pupil 1: own row keeps the id, the other pupil's id is hidden
    expect(r.rows.map((x) => [x.rank, x.userId, x.coins, x.sessions, x.accuracy, x.avatarUrl])).toEqual([
      [1, null, 50, 1, 100, null],
      [2, '1', 50, 2, 70, null],
    ])
    expect(r.rows.map((x) => x.name)).toEqual(['Bakar I.', 'Aina Binti Hassan'])
    expect(r.me).toEqual({ rank: 2, coins: 50, sessions: 2, accuracy: 70 })
    expect(r.participants).toBe(2)
    PerformanceLeaderboardSchema.parse(r)
  })

  it('window edges in MYT: Sunday 23:59 is last week; month and all widen the window', async () => {
    expect((await w.board.leaderboard(ctxOf('admin', 'a1'), 'week')).rows.map((x) => x.userId)).not.toContain('3')
    expect((await w.board.leaderboard(ctxOf('admin', 'a1'), 'month')).rows.find((x) => x.userId === '3')?.coins).toBe(100)
    expect((await w.board.leaderboard(viewer, 'all')).rows).toHaveLength(3)
    expect(periodWindow('week', new Date(NOW)).from?.toISOString()).toBe('2026-09-20T16:00:00.000Z')
    expect(periodWindow('month', new Date(NOW)).from?.toISOString()).toBe('2026-08-31T16:00:00.000Z')
    expect(periodWindow('all', new Date(NOW)).from).toBeUndefined()
  })

  it('an unknown period is the week; a viewer without sessions has rank null', async () => {
    expect(parsePeriod('year')).toBe('week')
    expect(parsePeriod(undefined)).toBe('week')
    const r = await w.board.leaderboard(ctxOf('student', '77'), 'bogus')
    expect(r.period).toBe('week')
    expect(r.me).toEqual({ rank: null, coins: 0, sessions: 0, accuracy: 0 })
  })

  it('6. a pupil with only test sessions is never shown, in any period', async () => {
    addPupil(w, '8', 'Murid Ujian Lain', 's1')
    w.practice.addSession({ userId: '8', completedAt: new Date('2026-09-25T10:00:00+08:00'), questionCount: 10, correctCount: 10, coins: 500, isTest: true })
    for (const p of ['week', 'month', 'all']) expect((await w.board.leaderboard(ctxOf('admin', 'a1'), p)).rows.map((x) => x.userId)).not.toContain('8')
    expect((await w.board.leaderboard(ctxOf('admin', '8'), 'all')).me).toMatchObject({ rank: null })
  })

  it('caps the rows at 50 but reports the viewer rank in the full order', async () => {
    for (let i = 0; i < 60; i++) {
      addPupil(w, `7${i}`, `Murid Ramai ${i}`, 's1')
      session(`7${i}`, '2026-09-24T10:00:00+08:00', 1000 - i)
    }
    addPupil(w, '500', 'Murid Terakhir', 's1')
    session('500', '2026-09-24T10:00:00+08:00', 1)
    const r = await w.board.leaderboard(ctxOf('student', '500'), 'week')
    expect(r.rows).toHaveLength(50)
    expect(r.participants).toBe(50)
    expect(r.me.rank).toBe(63)
  })
})
