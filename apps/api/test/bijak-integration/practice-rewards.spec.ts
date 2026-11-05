import 'reflect-metadata'

import type { PracticeMode, StartSessionResponse } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { MISSION_TARGET_REWARD_DESCRIPTION, MISSION_TARGET_REWARD_SOURCE, PRACTICE_REWARD_DESCRIPTION, WalletPracticeReward } from '../../src/modules/bijak/integration'
import { PracticePorts, type PracticeRewardSource } from '../../src/modules/practice/ports'
import { FakeBank, fillBank, loadWorld, makeSubscribed, type World } from '../practice/helpers'
import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, STUDENT } from './helpers'

/**
 * R1-10.1 (docs/qa/r1-10-1-practice-rewards.md): pins what a Latih Tubi, Databank (`past_year`) and Ulang Kaji
 * (`revision`) submit writes TODAY, on the real wiring (real wallet, streak and reward binding; only the question bank
 * is the in-memory fake). It is a characterisation of the current behaviour, not a statement of the V2 rule: the V2
 * `PracticeRecorder` practice rate and kombo step are unconfirmed and a user decision is pending. If that decision
 * changes a rate, this file is the one that must be changed with it.
 *
 * Current behaviour pinned here:
 *  - syiling = 1 per correct answer; nothing is credited for 0 correct;
 *  - ledger source `quiz_spm` for latih_tubi / past_year and `quiz_practice` for revision, description "Latihan: jawapan betul";
 *  - points = 10 per correct, stored on the session and on session_credits;
 *  - the wallet XP total is NOT moved by a practice submit;
 *  - the streak moves once per Malaysia day;
 *  - a second submit of the same session, or a second reward call for it, pays nothing more.
 */
let t: IntegrationApp
let w: World
let bank: FakeBank
let ids: { math: string[]; spm: string[] }
let student: Client

beforeAll(async () => {
  process.env.THROTTLE_PRACTICE_WRITE_PER_MINUTE = '100000' // 40-question sessions: the default per-minute write limit would stop the checks
  t = await bootIntegrationApp()
  w = await loadWorld(t.db)
  bank = new FakeBank()
  const f = fillBank(bank, w, { perChapter: 6, random: 30, spm: 60 })
  ids = { math: f.random, spm: f.spm }
  t.app.get(PracticePorts).provideQuestions(bank)
  student = await loginAs(t, STUDENT)
  await makeSubscribed(t.db, student.userId)
}, 120_000)
afterAll(async () => {
  await t.close()
})

const one = async <T>(sql: string, params: unknown[] = []): Promise<T | undefined> => (await t.db.query<T & object>(sql, params))[0] as T | undefined
const balance = async () => Number((await one<{ b: number }>('select current_syiling::int as b from wallets where user_id = $1', [student.userId]))?.b ?? 0)
const xp = async () => Number((await one<{ x: number }>('select xp::int as x from wallets where user_id = $1', [student.userId]))?.x ?? 0)
const ledger = (sessionId: string) => t.db.query<{ source: string; amount: number; description: string; is_test: boolean }>('select source, amount::int, description, is_test from coin_ledger where source_id = $1', [sessionId])
const credit = (sessionId: string) => one<{ coins_earned: number; points_earned: number; streak_count: number; total_balance: number }>('select coins_earned, points_earned, streak_count, total_balance from session_credits where session_id = $1', [sessionId])
const sessionRow = (sessionId: string) => one<{ status: string; correct_count: number; coins_earned: number; points_earned: number }>('select status, correct_count, coins_earned, points_earned from practice_sessions where id = $1', [sessionId])
const streak = async () => one<{ current: number; total_days: number; last: string }>('select current, total_days, last_activity_date::text as last from streaks where user_id = $1', [student.userId])

/** Starts a session of `startBody`, answers the first `correct` questions right and the rest wrong, and submits. */
async function play(startBody: Record<string, unknown>, correct: number) {
  const start = await student.post('/api/practice/sessions', startBody)
  expect(start.status, JSON.stringify(start.body)).toBe(201)
  const data = start.body.data as StartSessionResponse
  let i = 0
  for (const q of data.questions) {
    const key = bank.correctIndex(q.id)
    const count = bank.get(q.id).options.length
    const r = await student.post(`/api/practice/sessions/${data.sessionId}/check-answer`, { questionId: q.id, selectedOptionId: i++ < correct ? key : (key + 1) % count })
    expect(r.status, JSON.stringify(r.body)).toBe(200)
  }
  const before = { balance: await balance(), xp: await xp() }
  const submit = await student.post(`/api/practice/sessions/${data.sessionId}/submit`, { timeSpent: 60 })
  expect(submit.status, JSON.stringify(submit.body)).toBe(200)
  return { sessionId: data.sessionId, total: data.questions.length, submit, before }
}

const queueMath = async (n: number) => {
  await t.db.query('delete from revision_queue')
  for (const [i, id] of ids.math.slice(0, n).entries())
    await t.db.query(`insert into revision_queue (user_id, question_id, subject_id, wrong_times, last_wrong_at) values ($1, $2, $3, 1, '2026-10-01T00:00:00Z'::timestamptz + ($4 || ' minutes')::interval)`, [student.userId, id, w.subject.math, String(i)])
}

const MODES: { name: string; mode: PracticeMode; source: PracticeRewardSource; start: () => Promise<Record<string, unknown>> }[] = [
  { name: 'Latih Tubi', mode: 'latih_tubi', source: 'quiz_spm', start: () => Promise.resolve({ mode: 'latih_tubi', subjectCode: 'SEJ', count: 40 }) },
  { name: 'Databank', mode: 'past_year', source: 'quiz_spm', start: () => Promise.resolve({ mode: 'past_year', subjectCode: 'SEJ', count: 5 }) },
  {
    name: 'Ulang Kaji',
    mode: 'revision',
    source: 'quiz_practice',
    start: async () => {
      await queueMath(5)
      return { mode: 'revision', subjectCode: 'MATH' }
    },
  },
]

describe.each(MODES)('$name ($mode) submit', ({ mode, source, start }) => {
  it('1. 3 right: 3 syiling (1 per correct) in ONE ledger row with the mode source and description, 30 points on the session and on session_credits', async () => {
    const p = await play(await start(), 3)
    expect(p.total).toBeGreaterThanOrEqual(5)
    const rows = await ledger(p.sessionId)
    expect(rows).toEqual([{ source, amount: 3, description: PRACTICE_REWARD_DESCRIPTION, is_test: false }])
    expect(PRACTICE_REWARD_DESCRIPTION).toBe('Latihan: jawapan betul')
    expect(await sessionRow(p.sessionId)).toMatchObject({ status: 'completed', correct_count: 3, coins_earned: 3, points_earned: 30 })
    const sc = await credit(p.sessionId)
    expect(sc).toMatchObject({ coins_earned: 3, points_earned: 30 })
    expect(await balance()).toBe(p.before.balance + 3)
    expect(sc!.total_balance).toBe(p.before.balance + 3)
    expect(p.submit.body.data.results).toMatchObject({ score: 3, total: p.total, gamification: { coinsEarned: 3, pointsEarned: 30, totalBalance: p.before.balance + 3 } })
  })

  it('2. the wallet XP total is NOT changed by the submit (current behaviour; the 30 points are only stored on the session)', async () => {
    const p = await play(await start(), 4)
    expect((await sessionRow(p.sessionId))!.points_earned).toBe(40)
    expect(await xp()).toBe(p.before.xp)
  })

  it('3. 0 right: no ledger row, no balance change, but the session and session_credits still record 0 coins and 0 points', async () => {
    const p = await play(await start(), 0)
    expect(await ledger(p.sessionId)).toEqual([])
    expect(await balance()).toBe(p.before.balance)
    expect(await sessionRow(p.sessionId)).toMatchObject({ status: 'completed', correct_count: 0, coins_earned: 0, points_earned: 0 })
    expect(await credit(p.sessionId)).toMatchObject({ coins_earned: 0, points_earned: 0, total_balance: p.before.balance })
  })

  it('4. all right: 1 syiling and 10 points per question (the rate is linear, no bonus for a full score)', async () => {
    const p = await play(await start(), 1000)
    expect(await ledger(p.sessionId)).toEqual([{ source, amount: p.total, description: PRACTICE_REWARD_DESCRIPTION, is_test: false }])
    expect(await credit(p.sessionId)).toMatchObject({ coins_earned: p.total, points_earned: 10 * p.total })
    expect(await balance()).toBe(p.before.balance + p.total)
  })

  it('5. a second submit of the same session is refused (409 ALREADY_SUBMITTED) and pays nothing more', async () => {
    const p = await play(await start(), 3)
    const after = { balance: await balance(), xp: await xp(), ledger: await ledger(p.sessionId), streak: await streak(), credit: await credit(p.sessionId) }
    const again = await student.post(`/api/practice/sessions/${p.sessionId}/submit`, { timeSpent: 60 })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('ALREADY_SUBMITTED')
    expect(await balance()).toBe(after.balance)
    expect(await xp()).toBe(after.xp)
    expect(await ledger(p.sessionId)).toEqual(after.ledger)
    expect(await streak()).toEqual(after.streak)
    expect((await credit(p.sessionId))!.coins_earned).toBe(3)
    expect((await credit(p.sessionId))!.total_balance).toBe(after.credit!.total_balance) // the stored balance of the session is not rewritten by the refused submit
    expect(await credit(p.sessionId)).toEqual(after.credit)
  })

  it('6. the reward binding is idempotent per session: calling it again for the same session returns the stored result and writes nothing', async () => {
    const p = await play(await start(), 2)
    const s = (await sessionRow(p.sessionId))!
    const prisma = t.app.get(PrismaService)
    const reward = t.app.get(WalletPracticeReward)
    const out = await prisma.transaction((tx) =>
      reward.onSessionCompleted({ userId: student.userId, sessionId: p.sessionId, mode, source, correct: s.correct_count, total: p.total, timeSpent: 60, completedAt: new Date('2026-10-20T01:00:00Z'), pointsEarned: s.points_earned, sessionCoins: s.coins_earned, isTest: false }, tx),
    )
    expect(out.coinsEarned).toBe(2)
    expect(await ledger(p.sessionId)).toHaveLength(1)
    expect(await balance()).toBe(p.before.balance + 2)
    expect(await xp()).toBe(p.before.xp)
  })
})

describe('streak (kombo) on a practice submit', () => {
  it('7. touched once per Malaysia day: a second submit the same day changes nothing; after Malaysia midnight (still the same UTC day) it adds one', async () => {
    // Log in again close to midnight (the form login also touches the streak, to the clock day) so the session stays valid.
    t.clock.set('2026-10-20T23:20:00+08:00') // 15:20 UTC
    student = await loginAs(t, STUDENT)
    const start = { mode: 'past_year', subjectCode: 'SEJ', count: 5 }
    t.clock.set('2026-10-20T23:30:00+08:00')
    await play(start, 1)
    const day1 = (await streak())!
    expect(day1.last).toBe('2026-10-20')
    await play(start, 1)
    expect(await streak()).toEqual(day1) // same Malaysia day: nothing moves
    t.clock.set('2026-10-21T00:10:00+08:00') // 16:10 UTC: still the 20th in UTC, the 21st in Malaysia
    const p = await play(start, 1)
    const day2 = (await streak())!
    expect(day2.last).toBe('2026-10-21')
    expect(day2.current).toBe(day1.current + 1)
    expect(day2.total_days).toBe(day1.total_days + 1)
    expect((await credit(p.sessionId))!.streak_count).toBe(day2.current)
    await play(start, 1)
    expect(await streak()).toEqual(day2)
  })
})


describe('mission target reward (S6-T07): its own ledger row, once per pupil and mission', () => {
  it('credits the paid coins as `mission_target` / `mission:<id>` with the BM description, keeps the session credit apart, and never pays the same mission twice', async () => {
    const p = await play({ mode: 'random', subjectCode: 'MATH', count: 5 }, 2)
    const s = (await sessionRow(p.sessionId))!
    const prisma = t.app.get(PrismaService)
    const reward = t.app.get(WalletPracticeReward)
    const base = { userId: student.userId, sessionId: p.sessionId, mode: 'random' as const, source: 'quiz_practice' as const, correct: s.correct_count, total: p.total, timeSpent: 60, completedAt: new Date('2026-10-20T01:00:00Z'), pointsEarned: s.points_earned, sessionCoins: s.coins_earned, isTest: false }
    const before = await balance()
    const out = await prisma.transaction((tx) => reward.onSessionCompleted({ ...base, missionTargetReward: { missionId: '8801', coins: 25 } }, tx))
    expect(out.coinsEarned).toBe(2) // the response keeps the session coins only
    expect(out.totalBalance).toBe(before + 25)
    expect(await balance()).toBe(before + 25)
    const rows = await t.db.query<{ amount: number; description: string }>('select amount::int, description from coin_ledger where user_id = $1 and source = $2 and source_id = $3', [student.userId, MISSION_TARGET_REWARD_SOURCE, 'mission:8801'])
    expect(rows).toEqual([{ amount: 25, description: MISSION_TARGET_REWARD_DESCRIPTION }])
    await prisma.transaction((tx) => reward.onSessionCompleted({ ...base, missionTargetReward: { missionId: '8801', coins: 25 } }, tx))
    expect(await balance()).toBe(before + 25)
    expect(await t.db.query('select 1 from coin_ledger where user_id = $1 and source = $2', [student.userId, MISSION_TARGET_REWARD_SOURCE])).toHaveLength(1)
  })
})
