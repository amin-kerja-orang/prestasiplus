import type { StartSessionResponse } from '@pp/contract'
import { GamificationAchievementsSchema } from '@pp/contract'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { gamificationSeed } from '../../prisma/seed/gamification'
import { GamificationService } from '../../src/modules/gamification'
import { PracticePorts } from '../../src/modules/practice/ports'
import { fillBank, FakeBank, loadWorld, type World } from '../practice/helpers'
import { ADMIN, bootIntegrationApp, type Client, type IntegrationApp, loginAs, STUDENT } from './helpers'

/**
 * SW10-03 at the binding: `WalletPracticeReward.onSessionCompleted` evaluates the BR-M14-16 achievements after the
 * challenges, for the practice modes only (`random`, `chapter`, `revision`); the unlock pays once and shows on S15.
 */
let t: IntegrationApp
let w: World
let bank: FakeBank
let student: Client
let admin: Client
let maju: Client

beforeAll(async () => {
  t = await bootIntegrationApp({ extraSeeds: [gamificationSeed] })
  w = await loadWorld(t.db)
  bank = new FakeBank()
  fillBank(bank, w, { perChapter: 6, random: 30, spm: 8 })
  t.app.get(PracticePorts).provideQuestions(bank)
  student = await loginAs(t, STUDENT)
  admin = await loginAs(t, ADMIN, true)
  maju = await loginAs(t, 'pelajarmaju@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})
afterEach(() => {
  vi.restoreAllMocks()
})

const RANDOM = { mode: 'random', subjectCode: 'MATH', levelId: undefined as string | undefined, count: 5 }

/** Starts a session, answers every question wrongly and submits (so only the session count moves). */
async function play(who: Client, body: Record<string, unknown>): Promise<string> {
  const start = await who.post('/api/practice/sessions', body)
  expect(start.status, JSON.stringify(start.body)).toBe(201)
  const data = start.body.data as StartSessionResponse
  for (const q of data.questions) {
    const wrong = (bank.correctIndex(q.id) + 1) % bank.get(q.id).options.length
    expect((await who.post(`/api/practice/sessions/${data.sessionId}/check-answer`, { questionId: q.id, selectedOptionId: wrong })).status).toBe(200)
  }
  const done = await who.post(`/api/practice/sessions/${data.sessionId}/submit`, { timeSpent: 60 })
  expect(done.status, JSON.stringify(done.body)).toBe(200)
  return data.sessionId
}
const random = () => ({ ...RANDOM, levelId: w.level.d1 })
const unlocks = (userId: string) => t.db.query<{ name: string; is_test: boolean }>(`select a.name, ua.is_test from user_achievements ua join achievements a on a.id = ua.achievement_id where ua.user_id = $1 order by ua.id`, [userId])
const achievementRows = (userId: string) =>
  t.db.query<{ source_id: string; amount: number; description: string; is_test: boolean }>(`select source_id, amount::int, description, is_test from coin_ledger where user_id = $1 and source = 'achievement' order by id`, [userId])
const xpOf = async (userId: string) => Number((await t.db.query('select xp from wallets where user_id = $1', [userId]))[0]?.xp ?? 0)

describe('achievements follow completed practice-mode sessions (BR-M14-16, FR-M14-51)', () => {
  it('1. an SPM-mode session never evaluates achievements, even when a criterion is already met', async () => {
    // one completed practice-mode session already exists (so "Langkah Pertama" would be met if the evaluation ran)
    await t.db.query(
      `insert into practice_sessions (id, user_id, mode, question_count, status, correct_count, time_spent_sec, started_at, completed_at, is_test)
       values (gen_random_uuid(), $1::bigint, 'random', 5, 'completed', 3, 100, '2026-10-19T09:00:00+08:00', '2026-10-19T09:05:00+08:00', false)`,
      [student.userId],
    )
    await play(student, { mode: 'past_year', subjectCode: 'SEJ', count: 5 })
    expect(await unlocks(student.userId)).toEqual([])
    expect(await achievementRows(student.userId)).toEqual([])
  })

  it('2. a practice-mode session unlocks "Langkah Pertama" (+5 syiling, +3 XP) and, from the seeded 370 lifetime syiling, "Pengumpul Syiling" (+10), each once ("Pencapaian: {name}")', async () => {
    const xpBefore = await xpOf(student.userId)
    await play(student, random())
    const idOf = async (name: string) => (await t.db.query<{ id: string }>(`select id::text from achievements where name = $1`, [name]))[0]!.id
    expect(await unlocks(student.userId)).toEqual([
      { name: 'Langkah Pertama', is_test: false },
      { name: 'Pengumpul Syiling', is_test: false },
    ])
    expect(await achievementRows(student.userId)).toEqual([
      { source_id: `achievement:${await idOf('Langkah Pertama')}`, amount: 5, description: 'Pencapaian: Langkah Pertama', is_test: false },
      { source_id: `achievement:${await idOf('Pengumpul Syiling')}`, amount: 10, description: 'Pencapaian: Pengumpul Syiling', is_test: false },
    ])
    expect(await xpOf(student.userId)).toBe(xpBefore + 3 + 5)
    const s15 = await student.get('/api/gamification/achievements')
    expect(s15.status).toBe(200)
    const d = GamificationAchievementsSchema.parse(s15.body.data)
    expect(d.unlocked).toBe(2)
    expect(d.items[0]).toMatchObject({ name: 'Langkah Pertama', unlocked: true })
  })

  it('3. a further session does not unlock or pay it again', async () => {
    await play(student, random())
    expect(await unlocks(student.userId)).toHaveLength(2)
    expect(await achievementRows(student.userId)).toHaveLength(2)
  })

  it('4. Mod Pelajar: an admin acting as a pupil unlocks and earns nothing (achievements are the pupil\'s, BR-M14-16)', async () => {
    await play(admin, random())
    expect(await unlocks(admin.userId)).toEqual([])
    expect(await achievementRows(admin.userId)).toEqual([])
  })

  it('5. the evaluator cannot fail the submit: when it throws after a partial write, the submit is 200, the session and the credit stay, only the unlock is skipped (savepoint)', async () => {
    const gamification = t.app.get(GamificationService)
    const rajin = (await t.db.query<{ id: string }>(`select id::text from achievements where name = 'Pelajar Rajin'`))[0]!.id
    const before = (await unlocks(maju.userId)).length
    const ledgerBefore = (await achievementRows(maju.userId)).length
    vi.spyOn(gamification, 'evaluateAchievements').mockImplementation(async (userId, opts) => {
      await gamification.unlockAchievement(userId, rajin, opts) // a partial write inside the submit transaction
      throw new Error('evaluator boom')
    })
    const sessionId = await play(maju, random()) // play() asserts the submit answers 200
    const row = await t.db.query<{ status: string }>(`select status from practice_sessions where id = $1`, [sessionId])
    expect(row[0]?.status).toBe('completed')
    expect((await t.db.query(`select 1 from session_credits where session_id = $1`, [sessionId])).length).toBe(1)
    expect((await t.db.query(`select 1 from practice_answers where session_id = $1`, [sessionId])).length).toBeGreaterThan(0)
    expect(await unlocks(maju.userId)).toHaveLength(before) // the partial unlock was rolled back to the savepoint
    expect(await achievementRows(maju.userId)).toHaveLength(ledgerBefore)
    vi.restoreAllMocks()
    await play(maju, random()) // the next session evaluates normally (10 sessions are not played, so the rolled-back unlock is not re-earned)
    expect((await unlocks(maju.userId)).map((r) => r.name)).not.toContain('Pelajar Rajin')
  })
})
