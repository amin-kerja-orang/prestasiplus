import { GamificationChallengesResponseSchema, type StartSessionResponse } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { gamificationSeed } from '../../prisma/seed/gamification'
import { GamificationService } from '../../src/modules/gamification'
import { PracticeFactsAdapter } from '../../src/modules/bijak/integration/practice-facts'
import { PracticePorts } from '../../src/modules/practice/ports'
import { fillBank, loadWorld, type World } from '../practice/helpers'
import { FakeBank } from '../practice/helpers'
import { ADMIN, bootIntegrationApp, type Client, type IntegrationApp, loginAs, STUDENT } from './helpers'

/**
 * FIX-3 D-07: the daily challenges read the M05 store (BR-M14-12) and a met target is claimed inside the submit
 * transaction (BR-M14-13). Real wiring: BijakIntegrationModule plugs the practice facts and the reward binding;
 * only the question bank is the in-memory fake of the practice tests.
 */
const MAJU = 'pelajarmaju@demo.test'
const DAY = '2026-10-20'

let t: IntegrationApp
let w: World
let bank: FakeBank
let student: Client
let maju: Client
let admin: Client

beforeAll(async () => {
  t = await bootIntegrationApp({ extraSeeds: [gamificationSeed] })
  w = await loadWorld(t.db)
  bank = new FakeBank()
  fillBank(bank, w, { perChapter: 6, random: 30, spm: 4 })
  t.app.get(PracticePorts).provideQuestions(bank)
  student = await loginAs(t, STUDENT)
  maju = await loginAs(t, MAJU)
  admin = await loginAs(t, ADMIN, true)
}, 120_000)
afterAll(async () => {
  await t.close()
})

/** Starts a MATH chapter session, answers every question wrongly (so only the `sessions` metric moves) and submits. */
async function play(who: Client, startBody: Record<string, unknown> = { mode: 'chapter', chapterId: w.chapter.c1, count: 5 }): Promise<string> {
  const start = await who.post('/api/practice/sessions', startBody)
  expect(start.status, JSON.stringify(start.body)).toBe(201)
  const data = start.body.data as StartSessionResponse
  for (const q of data.questions) {
    const wrong = (bank.correctIndex(q.id) + 1) % bank.get(q.id).options.length
    const r = await who.post(`/api/practice/sessions/${data.sessionId}/check-answer`, { questionId: q.id, selectedOptionId: wrong })
    expect(r.status, JSON.stringify(r.body)).toBe(200)
  }
  const done = await who.post(`/api/practice/sessions/${data.sessionId}/submit`, { timeSpent: 60 })
  expect(done.status, JSON.stringify(done.body)).toBe(200)
  return data.sessionId
}

const challenges = async (who: Client) => {
  const res = await who.get('/api/gamification/challenges')
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return Object.fromEntries(GamificationChallengesResponseSchema.parse(res.body).data.map((c) => [c.title, c]))
}
/** Rows of the test days only (the wallet seed carries older, observed daily_challenge rows). */
const challengeRows = (userId: string) =>
  t.db.query<{ source_id: string; amount: number; is_test: boolean }>(`select source_id, amount::int, is_test from coin_ledger where user_id = $1 and source = 'daily_challenge' and source_id like '%:2026-10-2_' order by id`, [userId])
const completions = (userId: string) =>
  t.db.query<{ challenge_id: string; completion_date: string; is_test: boolean }>(
    `select challenge_id::text, completion_date::text, is_test from challenge_completions where user_id = $1 and completion_date >= '2026-10-20' order by id`,
    [userId],
  )
const idOfChallenge = async (title: string) => (await t.db.query<{ id: string }>(`select id::text from challenges where title = $1`, [title]))[0]!.id

describe('daily challenges follow completed practice sessions', () => {
  it('1. nothing played: progress 0 everywhere, except the streak challenge (SW10-03b: the form login moved the streak to today, BR-M14-12 / BR-M14-14)', async () => {
    const c = await challenges(student)
    expect(Object.values(c).every((x) => !x.completed)).toBe(true)
    const moved = Object.values(c).filter((x) => x.progress !== 0)
    expect(moved.map((x) => x.title)).toEqual(['Kombo 2 Hari'])
    expect(moved[0]).toMatchObject({ progress: 1, target: 2 })
  })

  it('2. one completed session: sessions challenges advance, the target-1 challenge is completed once and pays nothing (ruling 12 on #500: the reward is claimed with API-GAME-11)', async () => {
    await play(student)
    const c = await challenges(student)
    expect(c['Mula Hari Ini']).toMatchObject({ progress: 1, target: 1, completed: true })
    expect(c['Rajin Berlatih']).toMatchObject({ progress: 1, target: 3, completed: false })
    const mula = await idOfChallenge('Mula Hari Ini')
    expect(await challengeRows(student.userId)).toEqual([]) // ruling 12: completing credits nothing (it used to write a 10-syiling daily_challenge row)
    expect(await completions(student.userId)).toEqual([{ challenge_id: mula, completion_date: DAY, is_test: false }])
  })

  it('3. another pupil is not affected by the sessions of the first', async () => {
    const c = await challenges(maju)
    expect(c['Mula Hari Ini']).toMatchObject({ progress: 0, completed: false })
    expect(await challengeRows(maju.userId)).toEqual([])
  })

  it('4. N sessions give progress N; reaching the target pays the challenge once; a further session adds nothing', async () => {
    await play(student)
    expect((await challenges(student))['Rajin Berlatih']).toMatchObject({ progress: 2, completed: false })
    await play(student)
    const c = await challenges(student)
    expect(c['Rajin Berlatih']).toMatchObject({ progress: 3, target: 3, completed: true })
    const rajin = await idOfChallenge('Rajin Berlatih')
    const done = (await completions(student.userId)).map((r) => r.challenge_id)
    // the random draw also touched 3 chapters, so Penjelajah Topik is met too: every met challenge is completed exactly once, and none is paid
    expect(done).toEqual(expect.arrayContaining([await idOfChallenge('Mula Hari Ini'), rajin]))
    expect(new Set(done).size).toBe(done.length)
    expect(await challengeRows(student.userId)).toEqual([])
    const paid = done.length
    await play(student)
    expect((await challenges(student))['Rajin Berlatih']).toMatchObject({ progress: 3, completed: true })
    expect(await challengeRows(student.userId)).toEqual([])
    expect(await completions(student.userId)).toHaveLength(paid)
  })

  it('5. the day facts count completed sessions of ANY mode inside the Malaysia day only (boundaries included), never in-progress ones', async () => {
    const adapter = t.app.get(PracticeFactsAdapter)
    const uid = maju.userId
    const add = (mode: string, status: string, completedAt: string) =>
      t.db.query(
        `insert into practice_sessions (id, user_id, mode, question_count, status, correct_count, time_spent_sec, started_at, completed_at, is_test)
         values (gen_random_uuid(), $1::bigint, $2, 5, $3, 3, 120, $4::timestamptz, case when $3 = 'completed' then $4::timestamptz end, false)`,
        [uid, mode, status, completedAt],
      )
    await add('past_year', 'completed', '2026-10-23T23:59:59+08:00') // last second of the day
    await add('latih_tubi', 'completed', '2026-10-23T00:00:00+08:00') // first second
    await add('ramalan', 'completed', '2026-10-22T23:59:59+08:00') // the day before
    await add('pksk', 'completed', '2026-10-24T00:00:00+08:00') // the day after
    await add('random', 'in_progress', '2026-10-23T12:00:00+08:00') // not completed
    const facts = await adapter.dayFacts(uid, '2026-10-23')
    expect(facts.sessions.map((x) => x.mode).sort()).toEqual(['latih_tubi', 'past_year'])
    expect(facts.sessions[0]).toMatchObject({ correct: 3, total: 5, timeSpent: 120 })
    expect(facts.chapterIds).toEqual([])
    expect((await adapter.dayFacts(uid, '2026-10-24')).sessions.map((x) => x.mode)).toEqual(['pksk'])
    expect(await adapter.sessionCounts(uid)).toMatchObject({ all: expect.any(Number), practice: expect.any(Number) })
  })

  it("6. yesterday's sessions do not count: the next Malaysia day starts at 0 and can be claimed again", async () => {
    const doneToday = (await completions(student.userId)).filter((r) => r.completion_date === DAY).length
    t.clock.set('2026-10-21T09:00:00+08:00')
    student = await loginAs(t, STUDENT) // the session of the first day is older than the clock now
    const c = await challenges(student)
    expect(c['Mula Hari Ini']).toMatchObject({ progress: 0, completed: false })
    expect(c['Rajin Berlatih']).toMatchObject({ progress: 0, completed: false })
    await play(student)
    expect((await challenges(student))['Mula Hari Ini']).toMatchObject({ progress: 1, completed: true })
    const mula = await idOfChallenge('Mula Hari Ini')
    const rows = await completions(student.userId)
    expect(rows).toContainEqual({ challenge_id: mula, completion_date: '2026-10-21', is_test: false })
    expect(rows.filter((r) => r.completion_date === DAY)).toHaveLength(doneToday)
    expect(await challengeRows(student.userId)).toEqual([])
    t.clock.set('2026-10-20T09:00:00+08:00')
  })

  it('7. Mod Pelajar: the completion is stamped is_test (and nothing is paid)', async () => {
    t.clock.set('2026-10-20T10:00:00+08:00')
    await play(admin)
    const mula = await idOfChallenge('Mula Hari Ini')
    expect(await completions(admin.userId)).toEqual([{ challenge_id: mula, completion_date: DAY, is_test: true }])
    expect(await challengeRows(admin.userId)).toEqual([])
    // real figures of the pupils stay untouched
    expect((await t.db.query(`select count(*)::int as n from challenge_completions where is_test = false and user_id = $1`, [admin.userId]))[0]?.n).toBe(0)
  })
})

/** S7-T04 part 14 (R 4, FR-GM-19.4): `best_combo` and the game exclusion over the real answer store. */
describe('best_combo: the longest correct run inside one practice session of the Malaysia day', () => {
  const uid = () => maju.userId
  /** One completed session of `mode` whose answers (C correct, W wrong) are one second apart from `at`. */
  async function session(mode: string, pattern: string, at: string, answerMode: string = 'latih_tubi', chapter: number | null = null): Promise<string> {
    const id = (
      await t.db.query<{ id: string }>(
        `insert into practice_sessions (id, user_id, mode, question_count, status, correct_count, time_spent_sec, started_at, completed_at, is_test)
         values (gen_random_uuid(), $1::bigint, $2, $3, 'completed', 0, 60, $4::timestamptz, $4::timestamptz, false) returning id::text`,
        [uid(), mode, pattern.length, at],
      )
    )[0]!.id
    for (const [i, c] of [...pattern].entries()) {
      await t.db.query(
        `insert into practice_answers (session_id, user_id, subject_id, is_correct, answered_at, mode, chapter_id) values ($1::uuid, $2::bigint, 1, $3, $4::timestamptz + ($5 || ' seconds')::interval, $6, $7)`,
        [id, uid(), c === 'C', at, String(i), answerMode, chapter],
      )
    }
    return id
  }
  const combo = (day: string) => t.app.get(PracticeFactsAdapter).bestCombo(uid(), day)
  const clear = async () => {
    await t.db.query(`delete from practice_answers where user_id = $1::bigint`, [uid()])
    await t.db.query(`delete from practice_sessions where user_id = $1::bigint`, [uid()])
  }

  it('1. a run inside one session; a wrong answer breaks it', async () => {
    await clear()
    await session('random', 'CCCWCCCCC', '2026-10-20T10:00:00+08:00')
    expect(await combo('2026-10-20')).toBe(5)
  })

  it('2. runs split across two sessions: the longest per session counts, never the sum', async () => {
    await clear()
    await session('random', 'CCCCCC', '2026-10-20T10:00:00+08:00')
    await session('chapter', 'CCCCC', '2026-10-20T11:00:00+08:00')
    expect(await combo('2026-10-20')).toBe(6)
  })

  it("3. yesterday's answers are excluded, at the Malaysia midnight", async () => {
    await clear()
    await session('random', 'CCCCCCCC', '2026-10-19T23:59:50+08:00') // all inside the 19th
    await session('random', 'CC', '2026-10-20T00:00:00+08:00')
    expect(await combo('2026-10-20')).toBe(2)
    expect(await combo('2026-10-19')).toBe(8)
  })

  it('4. game and battle answers are excluded; other modes count', async () => {
    await clear()
    await session('random', 'CCCCCCCCCC', '2026-10-20T10:00:00+08:00', 'game')
    await session('random', 'CCCCCCCCCC', '2026-10-20T11:00:00+08:00', 'battle')
    expect(await combo('2026-10-20')).toBe(0)
    await session('chapter', 'CCCC', '2026-10-20T12:00:00+08:00', 'chapter')
    await session('chapter', 'CCC', '2026-10-20T13:00:00+08:00', 'latih_tubi')
    expect(await combo('2026-10-20')).toBe(4)
  })

  it('4b. answers with an IDENTICAL answered_at (the direct-complete path) are ordered by id: 5 right, 1 wrong, 5 right gives 5', async () => {
    await clear()
    const id = (
      await t.db.query<{ id: string }>(
        `insert into practice_sessions (id, user_id, mode, question_count, status, correct_count, time_spent_sec, started_at, completed_at, is_test)
         values (gen_random_uuid(), $1::bigint, 'random', 11, 'completed', 10, 60, '2026-10-20T10:00:00+08:00', '2026-10-20T10:00:00+08:00', false) returning id::text`,
        [uid()],
      )
    )[0]!.id
    for (const c of 'CCCCCWCCCCC') {
      await t.db.query(`insert into practice_answers (session_id, user_id, subject_id, is_correct, answered_at, mode) values ($1::uuid, $2::bigint, 1, $3, '2026-10-20T10:00:00+08:00', 'random')`, [id, uid(), c === 'C'])
    }
    expect(await combo('2026-10-20')).toBe(5)
  })

  it('5. answers outside a session do not count', async () => {
    await clear()
    for (let i = 0; i < 10; i++) {
      await t.db.query(`insert into practice_answers (user_id, subject_id, is_correct, answered_at, mode) values ($1::bigint, 1, true, '2026-10-20T10:00:00+08:00'::timestamptz + ($2 || ' seconds')::interval, 'latih_tubi')`, [uid(), String(i)])
    }
    expect(await combo('2026-10-20')).toBe(0)
  })

  it('6. the chapters of game answers do not count as topics (FR-GM-19.4)', async () => {
    await clear()
    await session('random', 'CC', '2026-10-20T10:00:00+08:00', 'random', 1)
    await session('random', 'CC', '2026-10-20T11:00:00+08:00', 'game', 2)
    await session('random', 'CC', '2026-10-20T12:00:00+08:00', 'battle', 3)
    await session('random', 'CC', '2026-10-20T13:00:00+08:00', 'latih_tubi', 4)
    const facts = await t.app.get(PracticeFactsAdapter).dayFacts(uid(), '2026-10-20')
    expect([...new Set(facts.chapterIds)].sort()).toEqual(['1', '4'])
  })

  it('7. Kombo 10 shows 9/10 at a run of 9 and completes at 10', async () => {
    await clear()
    t.clock.set('2026-10-20T10:30:00+08:00')
    await session('random', 'CCCCCCCCCWCCCC', '2026-10-20T10:00:00+08:00')
    const progress = async () => (await challenges(maju))['Kombo 10']
    expect(await progress()).toMatchObject({ progress: 9, target: 10, completed: false })
    const gm = t.app.get(GamificationService)
    await gm.settleChallenges(uid(), { isTest: false })
    expect(await completions(uid())).not.toContainEqual(expect.objectContaining({ challenge_id: await idOfChallenge('Kombo 10') }))
    await clear()
    await session('random', 'CCCCCCCCCCC', '2026-10-20T10:00:00+08:00')
    expect(await progress()).toMatchObject({ progress: 10, target: 10, pct: 100 })
    await gm.settleChallenges(uid(), { isTest: false })
    expect(await completions(uid())).toContainEqual({ challenge_id: await idOfChallenge('Kombo 10'), completion_date: DAY, is_test: false })
    expect(await progress()).toMatchObject({ progress: 10, completed: true })
    await clear()
  })
})
