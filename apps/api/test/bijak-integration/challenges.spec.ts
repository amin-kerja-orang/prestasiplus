import { GamificationChallengesResponseSchema, type StartSessionResponse } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { gamificationSeed } from '../../prisma/seed/gamification'
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

/** Starts a MATH D1 `random` session, answers every question wrongly (so only the `sessions` metric moves) and submits. */
async function play(who: Client, startBody: Record<string, unknown> = { mode: 'random', subjectCode: 'MATH', levelId: w.level.d1, count: 5 }): Promise<string> {
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

  it('2. one completed session: sessions challenges advance, the target-1 challenge is claimed once (ledger daily_challenge, key challenge:<id>:<day>)', async () => {
    const before = Number((await t.db.query('select current_syiling from wallets where user_id = $1', [student.userId]))[0]?.current_syiling ?? 0)
    await play(student)
    const c = await challenges(student)
    expect(c['Mula Hari Ini']).toMatchObject({ progress: 1, target: 1, completed: true })
    expect(c['Rajin Berlatih']).toMatchObject({ progress: 1, target: 3, completed: false })
    const mula = await idOfChallenge('Mula Hari Ini')
    expect(await challengeRows(student.userId)).toEqual([{ source_id: `challenge:${mula}:${DAY}`, amount: 10, is_test: false }])
    expect(await completions(student.userId)).toEqual([{ challenge_id: mula, completion_date: DAY, is_test: false }])
    const after = Number((await t.db.query('select current_syiling from wallets where user_id = $1', [student.userId]))[0]?.current_syiling ?? 0)
    expect(after).toBeGreaterThanOrEqual(before + 10)
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
    const rows = await challengeRows(student.userId)
    // the random draw also touched 3 chapters, so Penjelajah Topik is met too: every met challenge is paid exactly once
    const keys = rows.map((r) => r.source_id)
    expect(keys).toEqual(expect.arrayContaining([`challenge:${await idOfChallenge('Mula Hari Ini')}:${DAY}`, `challenge:${rajin}:${DAY}`]))
    expect(new Set(keys).size).toBe(keys.length)
    const paid = keys.length
    await play(student)
    expect((await challenges(student))['Rajin Berlatih']).toMatchObject({ progress: 3, completed: true })
    expect(await challengeRows(student.userId)).toHaveLength(paid)
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
    const paidToday = (await challengeRows(student.userId)).length
    t.clock.set('2026-10-21T09:00:00+08:00')
    student = await loginAs(t, STUDENT) // the session of the first day is older than the clock now
    const c = await challenges(student)
    expect(c['Mula Hari Ini']).toMatchObject({ progress: 0, completed: false })
    expect(c['Rajin Berlatih']).toMatchObject({ progress: 0, completed: false })
    await play(student)
    expect((await challenges(student))['Mula Hari Ini']).toMatchObject({ progress: 1, completed: true })
    const mula = await idOfChallenge('Mula Hari Ini')
    const rows = (await challengeRows(student.userId)).map((r) => r.source_id)
    expect(rows).toContain(`challenge:${mula}:2026-10-21`)
    expect(rows.filter((k) => k.endsWith(':2026-10-20'))).toHaveLength(paidToday)
    t.clock.set('2026-10-20T09:00:00+08:00')
  })

  it('7. Mod Pelajar: the completion and the ledger row are stamped is_test', async () => {
    t.clock.set('2026-10-20T10:00:00+08:00')
    await play(admin)
    const mula = await idOfChallenge('Mula Hari Ini')
    expect(await completions(admin.userId)).toEqual([{ challenge_id: mula, completion_date: DAY, is_test: true }])
    expect(await challengeRows(admin.userId)).toEqual([{ source_id: `challenge:${mula}:${DAY}`, amount: 10, is_test: true }])
    // real figures of the pupils stay untouched
    expect((await t.db.query(`select count(*)::int as n from challenge_completions where is_test = false and user_id = $1`, [admin.userId]))[0]?.n).toBe(0)
  })
})
