import { describe, expect, it } from 'vitest'

import { MISSION_GOAL_KINDS, type MissionGoalKind } from '@pp/contract'

import { FixedClock } from '../../src/db/clock'
import type { MissionRecord } from '../../src/modules/classes/missions/missions.repository'
import { goalMet, goalProgress, MissionsService, mytDayWindow, type GoalFacts } from '../../src/modules/classes/missions/missions.service'

// S6-T07 Global goals (PO decision on #483): DB-free. Pure rules per goal kind, then the service with fakes.
const facts = (over: Partial<GoalFacts> = {}): GoalFacts => ({ sessions: [], answers: [], streak: 0, ...over })
const ans = (correct: boolean, topicId: string | null = null) => ({ isCorrect: correct, topicId })

describe('goalProgress per kind (met / not met, boundaries)', () => {
  it('sessions_per_day counts the completed sessions of the day', () => {
    const s = { correct: 1, total: 2, timeSpentSec: 10 }
    expect(goalProgress('sessions_per_day', facts({ sessions: [s, s] }))).toBe(2)
    expect(goalMet(goalProgress('sessions_per_day', facts({ sessions: [s, s] })), 3)).toBe(false)
    expect(goalMet(goalProgress('sessions_per_day', facts({ sessions: [s, s, s] })), 3)).toBe(true)
  })

  it('correct_per_day counts only the correct answers (10 wrong are not 10 correct)', () => {
    expect(goalProgress('correct_per_day', facts({ answers: [...Array(9).fill(ans(true)), ...Array(5).fill(ans(false))] }))).toBe(9)
    expect(goalMet(goalProgress('correct_per_day', facts({ answers: Array(10).fill(ans(true)) })), 10)).toBe(true)
  })

  it('correct_in_session is the best single session, not the sum', () => {
    const f = facts({ sessions: [{ correct: 12, total: 15, timeSpentSec: 1 }, { correct: 12, total: 15, timeSpentSec: 1 }] })
    expect(goalProgress('correct_in_session', f)).toBe(12)
    expect(goalMet(12, 20)).toBe(false)
    expect(goalMet(goalProgress('correct_in_session', facts({ sessions: [{ correct: 20, total: 20, timeSpentSec: 1 }] })), 20)).toBe(true)
  })

  it('accuracy_in_session is the best session percent rounded down: 79.9 is not 80, 4/5 is 80', () => {
    expect(goalProgress('accuracy_in_session', facts({ sessions: [{ correct: 4, total: 5, timeSpentSec: 1 }] }))).toBe(80)
    expect(goalProgress('accuracy_in_session', facts({ sessions: [{ correct: 799, total: 1000, timeSpentSec: 1 }] }))).toBe(79)
    expect(goalMet(goalProgress('accuracy_in_session', facts({ sessions: [{ correct: 799, total: 1000, timeSpentSec: 1 }] })), 80)).toBe(false)
    expect(goalProgress('accuracy_in_session', facts({ sessions: [{ correct: 1, total: 0, timeSpentSec: 1 }] }))).toBe(0)
    expect(goalProgress('accuracy_in_session', facts({ sessions: [{ correct: 1, total: 4, timeSpentSec: 1 }, { correct: 9, total: 10, timeSpentSec: 1 }] }))).toBe(90)
  })

  it('minutes_per_day sums the session durations and rounds down: 599 s is 9 minutes, 600 s is 10', () => {
    const at = (sec: number) => facts({ sessions: [{ correct: 0, total: 1, timeSpentSec: sec - 100 }, { correct: 0, total: 1, timeSpentSec: 100 }] })
    expect(goalProgress('minutes_per_day', at(599))).toBe(9)
    expect(goalMet(goalProgress('minutes_per_day', at(599)), 10)).toBe(false)
    expect(goalMet(goalProgress('minutes_per_day', at(600)), 10)).toBe(true)
  })

  it('topics_per_day counts distinct topics and ignores an answer without a topic', () => {
    const f = facts({ answers: [ans(true, '1'), ans(false, '1'), ans(true, '2'), ans(true, null), ans(true, '3')] })
    expect(goalProgress('topics_per_day', f)).toBe(3)
    expect(goalMet(goalProgress('topics_per_day', facts({ answers: [ans(true, '1'), ans(true, '2')] })), 3)).toBe(false)
  })

  it('streak_days is the stored current streak', () => {
    expect(goalProgress('streak_days', facts({ streak: 2 }))).toBe(2)
    expect(goalMet(goalProgress('streak_days', facts({ streak: 1 })), 2)).toBe(false)
    expect(goalMet(goalProgress('streak_days', facts({ streak: 10 })), 10)).toBe(true)
  })

  it('every contract kind has a rule', () => {
    for (const k of MISSION_GOAL_KINDS) expect(typeof goalProgress(k, facts())).toBe('number')
  })
})

describe('mytDayWindow: the Malaysia day is [00:00 +08:00, next 00:00 +08:00)', () => {
  it('starts at 16:00 UTC of the day before and lasts 24 h (the MYT midnight boundary)', () => {
    const w = mytDayWindow('2026-11-06')
    expect(w.from.toISOString()).toBe('2026-11-05T16:00:00.000Z')
    expect(w.to.toISOString()).toBe('2026-11-06T16:00:00.000Z')
    const inside = (iso: string) => new Date(iso) >= w.from && new Date(iso) < w.to
    expect(inside('2026-11-05T15:59:59Z')).toBe(false) // 23:59:59 on the 5th in Malaysia
    expect(inside('2026-11-05T16:00:00Z')).toBe(true) // 00:00:00 on the 6th
    expect(inside('2026-11-06T15:59:59Z')).toBe(true)
    expect(inside('2026-11-06T16:00:00Z')).toBe(false)
  })
})

const DAY = '2026-11-06'
const global = (id: string, goalKind: MissionGoalKind, target: number, reward: number | null, over: Partial<MissionRecord> = {}): MissionRecord => ({
  id, teacherId: null, classroomId: null, title: `Misi ${id}`, missionType: 'harian', missionDate: DAY, subjectId: null, chapterId: null,
  questionCount: target, coinsPerCorrect: 3, description: 'Penerangan', rewardCoins: reward, scope: 'global', goalKind,
  resourceTitle: null, resourceUrl: null, resourceNote: null, isTest: false, createdAt: new Date('2026-11-01T00:00:00Z'), ...over,
})

function build(missions: MissionRecord[], practice: { sessions?: { correctCount: number; questionCount: number; timeSpentSec: number; isTest: boolean }[]; answers?: { isCorrect: boolean; topicId: string | null; isTest: boolean }[] } = {}, streak = 0) {
  const world = { paid: new Map<string, number>(), locks: 0, windows: [] as Date[] }
  const repo = {
    globalMissionsOfDay: (day: string) => Promise.resolve(missions.filter((m) => m.missionDate === day)),
    paidMissionIds: (_s: string, ids: string[]) => Promise.resolve(new Set(ids.filter((id) => world.paid.has(`${_s}:${id}`)))),
    lockTargetReward: () => (world.locks++, Promise.resolve()),
    insertReward: (_tx: unknown, i: { missionId: string; studentId: string; coins: number }) => {
      const k = `${i.studentId}:${i.missionId}`
      if (world.paid.has(k)) return Promise.resolve(false)
      world.paid.set(k, i.coins)
      return Promise.resolve(true)
    },
    missionsForStudent: () => Promise.resolve([]),
  }
  const prac = {
    dayFacts: (_u: string, from: Date) => (world.windows.push(from), Promise.resolve({ sessions: practice.sessions ?? [], chapterIds: [] })),
    answers: () => Promise.resolve(practice.answers ?? []),
  }
  const service = new MissionsService(repo as never, {} as never, prac as never, {} as never, {} as never, new FixedClock('2026-11-06T02:00:00Z'), { get: () => Promise.resolve({ current: streak }) } as never)
  return { service, world }
}
const settle = (service: MissionsService, userId = '21', isTest = false) => service.evaluateGlobalGoals({ userId, day: DAY, isTest, at: new Date('2026-11-06T02:00:00Z'), sessionId: null }, {} as never)
const sess = (correctCount: number, questionCount: number, timeSpentSec = 60, isTest = false) => ({ correctCount, questionCount, timeSpentSec, isTest })

describe('evaluateGlobalGoals', () => {
  it('pays each reached goal once, nothing for an unmet one; a second evaluation pays nothing', async () => {
    const { service, world } = build([global('1', 'sessions_per_day', 2, 15), global('2', 'sessions_per_day', 3, 20)], { sessions: [sess(1, 2), sess(1, 2)] })
    expect(await settle(service)).toEqual([{ missionId: '1', coins: 15 }])
    expect(await settle(service)).toEqual([])
    expect(world.paid.size).toBe(1)
    expect(world.locks).toBe(2) // the unmet goal is still open, so the second call takes the lock again
  })

  it('pays several goals reached together, each with its own reward', async () => {
    const { service } = build([global('1', 'sessions_per_day', 1, 10), global('2', 'accuracy_in_session', 80, 20), global('3', 'streak_days', 2, 25)], { sessions: [sess(4, 5)] }, 2)
    expect(await settle(service)).toEqual([{ missionId: '1', coins: 10 }, { missionId: '2', coins: 20 }, { missionId: '3', coins: 25 }])
  })

  it('a reward of 0 or null pays nothing and writes no row; a goal of another day is not evaluated', async () => {
    const { service, world } = build([global('1', 'sessions_per_day', 1, 0), global('2', 'sessions_per_day', 1, null), global('3', 'sessions_per_day', 1, 5, { missionDate: '2026-11-05' })], { sessions: [sess(1, 1)] })
    expect(await settle(service)).toEqual([])
    expect(world.paid.size).toBe(0)
  })

  it('reads the Malaysia day window (16:00 UTC of the day before) and ignores rows of the other Mod Pelajar mode', async () => {
    const { service, world } = build([global('1', 'correct_per_day', 2, 5)], { answers: [{ isCorrect: true, topicId: '1', isTest: true }, { isCorrect: true, topicId: '1', isTest: true }, { isCorrect: true, topicId: '1', isTest: false }] })
    expect(await settle(service)).toEqual([])
    expect(world.windows[0]?.toISOString()).toBe('2026-11-05T16:00:00.000Z')
    expect(await settle(service, '21', true)).toEqual([{ missionId: '1', coins: 5 }])
  })

  it('a pupil is paid for a mission once; another pupil is paid separately', async () => {
    const { service, world } = build([global('1', 'sessions_per_day', 1, 10)], { sessions: [sess(1, 1)] })
    expect(await settle(service, '21')).toHaveLength(1)
    expect(await settle(service, '22')).toHaveLength(1)
    expect(await settle(service, '21')).toEqual([])
    expect(world.paid.size).toBe(2)
  })
})

describe('today(): every pupil sees the Global goals of today', () => {
  const actor = { userId: '21', isTest: false } as never
  it('lists them with global, goalKind, target, progress and completed; no subject draw, no session', async () => {
    const { service, world } = build([global('1', 'correct_per_day', 5, 12), global('2', 'streak_days', 2, 25), global('3', 'sessions_per_day', 1, 10, { missionDate: '2026-11-05' })], { answers: [ans(true), ans(true), ans(false)].map((a) => ({ ...a, isTest: false })) }, 1)
    world.paid.set('21:2', 25)
    const rows = await service.today(actor)
    expect(rows.map((r) => r.id)).toEqual(['1', '2'])
    expect(rows[0]).toMatchObject({ global: true, goalKind: 'correct_per_day', target: 5, progress: 2, completed: false, status: 'new', subjectName: '', rewardCoins: 12, description: 'Penerangan' })
    expect(rows[1]).toMatchObject({ goalKind: 'streak_days', target: 2, progress: 1, completed: true, status: 'completed' })
  })
})
