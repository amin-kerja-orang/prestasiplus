import { ACCOUNT_PROFILE_CALENDAR_DAYS, ACCOUNT_PROFILE_RECENT_MAX, AccountProfileActivitySchema, type AccountProfileActivity } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { walletSeed } from '../../prisma/seed/wallet'
import { createTestDatabase } from '../support/db'
import { type AccountTestApp, bootAccountApp, errorOf, get, login, userRow, type Who } from './account-helpers'

/** API-MUR-02 `GET /api/me/profile-activity` (S5-T05, issue 458 decision 4). The fixed clock is 2026-10-19 09:00 MYT. */
const STUDENT = 'pelajar@demo.test'
const OTHER_STUDENT = 'pelajarmaju@demo.test'
const NO_SESSIONS = 'pelajar2@demo.test'
const TODAY = '2026-10-19'

describe('GET /api/me/profile-activity (API-MUR-02)', () => {
  let t: AccountTestApp
  let studentId: string
  let otherId: string

  /** One completed session, `answered` questions of which `correct` right, finished at `at` (an ISO instant). */
  async function session(email: string, mode: string, answered: number, correct: number, coins: number, at: string, isTest = false): Promise<void> {
    const user = await userRow(t.db, email)
    await t.db.query(
      `insert into practice_sessions (user_id, mode, question_count, status, correct_count, coins_earned, started_at, completed_at, is_test)
       values ($1::bigint, $2, $3, 'completed', $4, $5, $6::timestamptz, $6::timestamptz, $7)`,
      [user?.id, mode, answered, correct, coins, at, isTest],
    )
  }

  const read = async (who: Who): Promise<AccountProfileActivity> => {
    const res = await get(who, '/me/profile-activity')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return AccountProfileActivitySchema.parse(res.body.data)
  }

  beforeAll(async () => {
    const db = await createTestDatabase()
    await runSeeds([identitySeed, walletSeed], { prisma: db.prisma })
    t = await bootAccountApp({ db })
    studentId = (await userRow(t.db, STUDENT))?.id as string
    otherId = (await userRow(t.db, OTHER_STUDENT))?.id as string

    // The pupil: two sessions today, one 18 days ago, one OUTSIDE the 30 days, and one Mod Pelajar row that must not count.
    await session(STUDENT, 'latih_tubi', 10, 7, 14, '2026-10-19T08:00:00+08:00')
    await session(STUDENT, 'past_year', 20, 12, 24, '2026-10-19T07:30:00+08:00')
    await session(STUDENT, 'random', 5, 5, 10, '2026-10-01T20:00:00+08:00')
    await session(STUDENT, 'chapter', 8, 4, 8, '2026-09-10T20:00:00+08:00')
    await session(STUDENT, 'latih_tubi', 50, 50, 99, '2026-10-18T10:00:00+08:00', true)
    // Another pupil: his data must never show in the first pupil's answer.
    await session(OTHER_STUDENT, 'mission', 9, 9, 18, '2026-10-19T06:00:00+08:00')

    // Two configured badges; the pupil holds the first, nobody holds the second.
    const first = await t.db.prisma.achievement.create({ data: { name: 'Langkah Pertama' } })
    await t.db.prisma.achievement.create({ data: { name: 'Rajin Berlatih' } })
    await t.db.prisma.userAchievement.create({ data: { userId: BigInt(studentId), achievementId: first.id, unlockedAt: new Date('2026-10-05T10:00:00+08:00') } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('needs a session (401 for a guest)', async () => {
    const res = await t.http().get('/api/me/profile-activity')
    errorOf(res, 401, 'UNAUTHORIZED')
  })

  it('answers the decided shape for the pupil own data: tiles, 30-day calendar, badges, recent sessions', async () => {
    const who = await login(t, STUDENT)
    const data = await read(who)
    expect(data.publicProfilePath).toBe(`/pelajar/${studentId}`)
    // Tiles: the Mod Pelajar row and every other pupil are left out; pooled accuracy has one decimal (28 / 43).
    expect(data.tiles).toMatchObject({ sessions: 4, practiceDays: 3, accuracy: 65.1 })
    expect(data.tiles.level).toBeGreaterThanOrEqual(1)
    expect(data.tiles.streakBest).toBeGreaterThanOrEqual(data.tiles.streakDays)
    expect(data.tiles.coins).toBeGreaterThanOrEqual(0)
    expect(JSON.stringify(data.tiles.accuracy)).toMatch(/^\d+(\.\d)?$/)
  })

  it('calendar30d: exactly 30 Malaysia days, oldest first, today last, {date, answered, sessions}', async () => {
    const data = await read(await login(t, STUDENT))
    expect(data.calendar30d).toHaveLength(ACCOUNT_PROFILE_CALENDAR_DAYS)
    expect(data.calendar30d[0]?.date).toBe('2026-09-20')
    expect(data.calendar30d.at(-1)).toEqual({ date: TODAY, answered: 30, sessions: 2 })
    expect(data.calendar30d.find((d) => d.date === '2026-10-01')).toEqual({ date: '2026-10-01', answered: 5, sessions: 1 })
    // The session of 2026-09-10 is before the window: no cell, but the all-time tiles count it.
    expect(data.calendar30d.some((d) => d.date === '2026-09-10')).toBe(false)
    expect(data.calendar30d.reduce((n, d) => n + d.sessions, 0)).toBe(3)
    expect(data.calendar30d.filter((d) => d.sessions === 0)).toHaveLength(ACCOUNT_PROFILE_CALENDAR_DAYS - 2)
  })

  it('recentSessions: newest first, every mode, BM mode names (never snake_case), one-decimal accuracy', async () => {
    const data = await read(await login(t, STUDENT))
    expect(data.recentSessions.length).toBeLessThanOrEqual(ACCOUNT_PROFILE_RECENT_MAX)
    expect(data.recentSessions.map((s) => s.modeLabel)).toEqual(['Latih Tubi', 'Tahun Lepas', 'Latih Tubi Rawak', 'Soalan by Chapter'])
    expect(data.recentSessions.map((s) => s.mode)).toEqual(['latih_tubi', 'past_year', 'random', 'chapter'])
    expect(data.recentSessions[0]).toMatchObject({ questions: 10, correct: 7, accuracy: 70, coins: 14 })
    expect(data.recentSessions[1]).toMatchObject({ questions: 20, correct: 12, accuracy: 60 })
    for (const s of data.recentSessions) expect(s.modeLabel).not.toMatch(/_/)
    const times = data.recentSessions.map((s) => Date.parse(s.at))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('badges: every configured badge, locked ones with unlocked false and earnedAt null', async () => {
    const data = await read(await login(t, STUDENT))
    const held = data.badges.find((b) => b.name === 'Langkah Pertama')
    const locked = data.badges.find((b) => b.name === 'Rajin Berlatih')
    expect(held?.unlocked).toBe(true)
    expect(Date.parse(held?.earnedAt as string)).toBe(Date.parse('2026-10-05T10:00:00+08:00'))
    expect(locked).toMatchObject({ unlocked: false, earnedAt: null })
    expect(data.badges.filter((b) => b.unlocked)).toHaveLength(1)
  })

  it('own data only: another pupil sees his own sessions and none of the first pupil', async () => {
    const data = await read(await login(t, OTHER_STUDENT))
    expect(data.publicProfilePath).toBe(`/pelajar/${otherId}`)
    expect(data.tiles).toMatchObject({ sessions: 1, practiceDays: 1, accuracy: 100 })
    expect(data.recentSessions).toHaveLength(1)
    expect(data.recentSessions[0]).toMatchObject({ mode: 'mission', modeLabel: 'Misi Harian', questions: 9, correct: 9 })
    expect(data.calendar30d.at(-1)).toEqual({ date: TODAY, answered: 9, sessions: 1 })
    // He holds no badge: the whole catalogue is locked.
    expect(data.badges.length).toBeGreaterThan(0)
    expect(data.badges.every((b) => !b.unlocked && b.earnedAt === null)).toBe(true)
  })

  it('a user id in the query is ignored: the answer is still the caller own', async () => {
    const who = await login(t, OTHER_STUDENT)
    const res = await get(who, `/me/profile-activity?userId=${studentId}`)
    expect(res.status).toBe(200)
    expect(AccountProfileActivitySchema.parse(res.body.data).publicProfilePath).toBe(`/pelajar/${otherId}`)
  })

  it('accuracy is null with 0 answers, and the lists are empty or zero', async () => {
    const data = await read(await login(t, NO_SESSIONS))
    expect(data.tiles).toMatchObject({ sessions: 0, practiceDays: 0, accuracy: null })
    expect(data.recentSessions).toEqual([])
    expect(data.calendar30d).toHaveLength(ACCOUNT_PROFILE_CALENDAR_DAYS)
    expect(data.calendar30d.every((d) => d.sessions === 0 && d.answered === 0)).toBe(true)
  })

  it('streakToday is the current streak only when the last activity is today (Malaysia day)', async () => {
    const who = await login(t, STUDENT)
    await t.db.query(`update streaks set current = 3, best = 5, last_activity_date = '2026-10-18' where user_id = $1::bigint`, [studentId])
    expect((await read(who)).tiles).toMatchObject({ streakDays: 3, streakBest: 5, streakToday: 0 })
    await t.db.query(`update streaks set last_activity_date = $2::date where user_id = $1::bigint`, [studentId, TODAY])
    expect((await read(who)).tiles).toMatchObject({ streakDays: 3, streakBest: 5, streakToday: 3 })
  })

  it('a role other than student gets 403 FORBIDDEN (teacher, admin)', async () => {
    for (const email of ['guru@demo.test', 'admin@demo.test']) {
      const res = await get(await login(t, email), '/me/profile-activity')
      errorOf(res, 403, 'FORBIDDEN')
    }
  })

  it('is no-store (personal data)', async () => {
    const res = await get(await login(t, STUDENT), '/me/profile-activity')
    expect(res.headers['cache-control']).toContain('no-store')
  })
})
