import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { BATTLE_MESSAGES, BattleArenaViewSchema, BattleEmptyBodySchema, BattlePollMatchResponseSchema, ErrorBodySchema } from '@pp/contract'

import { startOfMytDay } from '../../src/db/clock'
import { addMcqs, bootBattleApp, client, matchBot, parse, parseData, startQueue, STUDENT_G10, STUDENT_G10_B, STUDENT_G11, subjectsOf, type BattleTestApp, type Client, type Subjects } from './arena-helpers'

/** A third and fourth pupil of Tingkatan 4 in the same school as the first two (population seed, fictitious). */
const STUDENT_G10_C = 'murid.demo001.01@example.test'
const STUDENT_G10_D = 'murid.demo001.04@example.test'

/**
 * S7-T01 part GAME-01 A: FR-GM-01.1 (question count), FR-GM-01.5 (human before robot, `robot` flag), FR-GM-01.9 (daily max).
 * Same school and invitation rules are in invitations.spec.ts, the 0-0 draw in arena.spec.ts.
 */
describe('battle matchmaking (FR-GM-01.1, 01.5, 01.9)', () => {
  let t: BattleTestApp
  let s: Subjects
  let a: Client
  let b: Client
  let c: Client
  let d: Client
  let e: Client
  let otherSchool: string
  const rows = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)
  const setting = (key: string, value: number) => rows(`update gamification_settings set value = $2 where key = $1`, [key, value])
  const poll = (who: Client, queueId: string) => who.get(`/battle/poll-match/${queueId}`)
  const matched = async (who: Client, queueId: string) => {
    const res = await poll(who, queueId)
    return parse(BattlePollMatchResponseSchema, res)
  }

  beforeAll(async () => {
    t = await bootBattleApp()
    s = await subjectsOf(t)
    await addMcqs(t, s.math, s.t4, 24)
    await addMcqs(t, s.math, s.t5, 24)
    await addMcqs(t, s.sci, s.t4, 3)
    await addMcqs(t, s.bm, s.t4, 10)
    // a school the Tingkatan 5 pupil moves to, for the school battle (his session is opened after the move)
    otherSchool = (await rows<{ id: string }>(`insert into schools (name, code, type, state) values ('SMK Ujian Padanan', 'UJIPADANAN', 'SMK', 'Selangor') returning id::text`))[0]?.id as string
    await rows(`update users set school_id = $1 where lower(email) = lower($2)`, [otherSchool, STUDENT_G11])
    ;[a, b, c, d, e] = [await client(t, STUDENT_G10), await client(t, STUDENT_G10_B), await client(t, STUDENT_G11), await client(t, STUDENT_G10_C), await client(t, STUDENT_G10_D)]
  }, 240_000)
  afterAll(async () => t.close())

  beforeEach(async () => {
    await rows(`delete from battle_queues`)
    await rows(`delete from battles`)
    await setting('battle_daily_max', 20)
    await setting('battle_questions_default', 10)
    await setting('battle_bot_fallback_seconds', 30)
  })

  /** Ages every queue entry past `battle_bot_fallback_seconds` without moving the clock of the test. */
  const ageQueues = (seconds = 31) => rows(`update battle_queues set created_at = created_at - ($1 || ' seconds')::interval`, [String(seconds)])

  describe('question count (FR-GM-01.1, AC-GM-01.2)', () => {
    it.each([5, 10, 15, 20])('%i: stored on the queue, on the battle, and drawn once each (same questions for both)', async (n) => {
      const qid = await startQueue(a, s.math, { question_count: n })
      const [q] = await rows<{ question_count: number }>(`select question_count from battle_queues where id = $1`, [qid])
      expect(q?.question_count).toBe(n)
      const uuid = await matchBot(a, qid)
      const [battle] = await rows<{ question_count: number }>(`select question_count from battles where id = $1`, [uuid])
      expect(battle?.question_count).toBe(n)
      const qs = await rows<{ n: string; d: string; max: number }>(`select count(*)::text n, count(distinct question_id)::text d, max(position) max from battle_questions where battle_id = $1`, [uuid])
      expect(qs[0]).toMatchObject({ n: String(n), d: String(n), max: n })
    })

    it('absent: battle_questions_default (10, or the admin setting)', async () => {
      const first = await startQueue(a, s.math)
      expect((await rows<{ question_count: number }>(`select question_count from battle_queues where id = $1`, [first]))[0]?.question_count).toBe(10)
      await setting('battle_questions_default', 15)
      const second = await startQueue(a, s.math)
      expect((await rows<{ question_count: number }>(`select question_count from battle_queues where id = $1`, [second]))[0]?.question_count).toBe(15)
      const uuid = await matchBot(a, second)
      expect((await rows<{ n: string }>(`select count(*)::text n from battle_questions where battle_id = $1`, [uuid]))[0]?.n).toBe('15')
    })

    it.each([[7], [0], [25], ['10'], [null], [10.5], [[10]], [true]])('an invalid question_count (%j) answers 422 with an empty body and creates nothing', async (bad) => {
      for (const path of ['/battle/quick-match', '/battle/school-battle']) {
        const res = await a.post(path, { question_type: 'biasa', subject_id: s.math, question_count: bad })
        expect(res.status, path).toBe(422)
        expect(parse(BattleEmptyBodySchema, res)).toEqual({})
      }
      expect((await rows(`select 1 from battle_queues`)).length).toBe(0)
    })

    it('the pool must hold the chosen count: 10 questions allow 10 but not 15 (422 {})', async () => {
      expect((await a.post('/battle/quick-match', { question_type: 'biasa', subject_id: s.bm, question_count: 10 })).status).toBe(200)
      const res = await a.post('/battle/quick-match', { question_type: 'biasa', subject_id: s.bm, question_count: 15 })
      expect(res.status).toBe(422)
      expect(res.body).toEqual({})
    })

    it('a battle of 5 ends after 5 answers, with the result', async () => {
      const uuid = await matchBot(a, await startQueue(a, s.math, { question_count: 5 }))
      let last: { result?: unknown; next?: unknown } = {}
      for (let i = 1; i <= 5; i++) {
        const view = parseData(BattleArenaViewSchema, await a.get(`/battle/arena/${uuid}`))
        expect(view.status).toBe('active')
        const res = await a.post(`/battle/arena/${uuid}/answer`, { questionId: view.question?.id, optionId: 1, seconds: 3 })
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        last = res.body.data
        expect(last.result === undefined, `answer ${i}`).toBe(i < 5)
      }
      const [battle] = await rows<{ status: string; answered: number }>(`select status, answered from battles where id = $1`, [uuid])
      expect(battle).toEqual({ status: 'finished', answered: 5 })
      const done = parseData(BattleArenaViewSchema, await a.get(`/battle/arena/${uuid}`))
      expect(done).toMatchObject({ status: 'finished', question: null })
    })

    it('a human match needs the same count: 5 and 10 do not meet', async () => {
      const qa = await startQueue(a, s.math, { question_count: 5 })
      await startQueue(b, s.math, { question_count: 10 })
      expect(await matched(a, qa)).toEqual({ status: 'waiting' })
    })

    it('two pupils with 15 are matched and the battle has 15 questions', async () => {
      const qa = await startQueue(a, s.math, { question_count: 15 })
      await startQueue(b, s.math, { question_count: 15 })
      const m = await matched(a, qa)
      expect(m.status).toBe('matched')
      const uuid = (m as { battle_uuid: string }).battle_uuid
      expect((await rows<{ n: string }>(`select count(*)::text n from battle_questions where battle_id = $1`, [uuid]))[0]?.n).toBe('15')
      expect((await rows<{ question_count: number }>(`select question_count from battles where id = $1`, [uuid]))[0]?.question_count).toBe(15)
    })
  })

  describe('human before robot (FR-GM-01.5, AC-GM-01.4, AC-GM-01.5)', () => {
    it('two pupils waiting in a compatible queue are matched on poll, robot false; the other one polls the same battle', async () => {
      const qa = await startQueue(a, s.math)
      const qb = await startQueue(b, s.math)
      expect(await matched(a, qa)).toMatchObject({ status: 'matched', robot: false })
      const m = (await matched(a, qa)) as { battle_uuid: string }
      expect(await matched(b, qb)).toEqual({ status: 'matched', battle_uuid: m.battle_uuid, robot: false })
      const parts = await rows<{ side: string; user_id: string | null; is_bot: boolean }>(`select side, user_id::text, is_bot from battle_participants where battle_id = $1 order by side`, [m.battle_uuid])
      // side A is the entry that waited longer
      expect(parts).toEqual([{ side: 'A', user_id: a.id, is_bot: false }, { side: 'B', user_id: b.id, is_bot: false }])
      const [battle] = await rows<{ mode: string; counts_for_ranking: boolean; status: string; level_id: string }>(`select mode, counts_for_ranking, status, level_id::text from battles where id = $1`, [m.battle_uuid])
      expect(battle).toEqual({ mode: 'quick_match', counts_for_ranking: true, status: 'active', level_id: s.t4 })
      expect((await rows(`select 1 from battles`)).length).toBe(1)
      const qs = await rows<{ status: string; battle_id: string }>(`select status, battle_id::text from battle_queues order by id`)
      expect(qs).toEqual([{ status: 'matched', battle_id: m.battle_uuid }, { status: 'matched', battle_id: m.battle_uuid }])
    })

    it('the poller may be the younger entry: the older one is side A', async () => {
      const qa = await startQueue(a, s.math)
      t.clock.advance(1_000)
      const qb = await startQueue(b, s.math)
      const m = (await matched(b, qb)) as { battle_uuid: string }
      expect(m).toMatchObject({ status: 'matched', robot: false })
      const [sideA] = await rows<{ user_id: string }>(`select user_id::text from battle_participants where battle_id = $1 and side = 'A'`, [m.battle_uuid])
      expect(sideA?.user_id).toBe(a.id)
      expect(await matched(a, qa)).toEqual({ status: 'matched', battle_uuid: m.battle_uuid, robot: false })
    })

    it('a human beats the robot: both entries are past battle_bot_fallback_seconds and the poll still matches the pupil', async () => {
      const qa = await startQueue(a, s.math)
      await startQueue(b, s.math)
      await ageQueues()
      expect(await matched(a, qa)).toMatchObject({ status: 'matched', robot: false })
      expect((await rows(`select 1 from battle_participants where is_bot`)).length).toBe(0)
    })

    it('no human fits: waiting, then the robot with robot true (repeated polls keep true); the poll before the fallback has no robot flag', async () => {
      const qa = await startQueue(a, s.math)
      expect(await matched(a, qa)).toEqual({ status: 'waiting' })
      await ageQueues()
      const m = await matched(a, qa)
      expect(m).toMatchObject({ status: 'matched', robot: true })
      expect(await matched(a, qa)).toEqual(m)
      const [battle] = await rows<{ counts_for_ranking: boolean }>(`select counts_for_ranking from battles where id = $1`, [(m as { battle_uuid: string }).battle_uuid])
      expect(battle?.counts_for_ranking).toBe(false)
    })

    it('battle_bot_fallback_seconds = 0 never brings the robot', async () => {
      await setting('battle_bot_fallback_seconds', 0)
      const qa = await startQueue(a, s.math)
      await ageQueues(100)
      expect(await matched(a, qa)).toEqual({ status: 'waiting' })
    })

    it('oldest entry first, and an entry is matched once', async () => {
      const qb = await startQueue(b, s.math)
      t.clock.advance(1_000)
      const qd = await startQueue(d, s.math)
      t.clock.advance(1_000)
      const qa = await startQueue(a, s.math)
      const m = (await matched(a, qa)) as { battle_uuid: string }
      const parts = await rows<{ user_id: string }>(`select user_id::text from battle_participants where battle_id = $1 order by side`, [m.battle_uuid])
      expect(parts.map((p) => p.user_id)).toEqual([b.id, a.id])
      expect(await matched(b, qb)).toMatchObject({ status: 'matched', battle_uuid: m.battle_uuid })
      expect(await matched(d, qd)).toEqual({ status: 'waiting' })
      // d and e can still meet
      const qe = await startQueue(e, s.math)
      expect(await matched(e, qe)).toMatchObject({ status: 'matched', robot: false })
    })

    it.each([
      ['another subject', () => startQueue(b, s.bm)],
      ['another question type', async () => (await b.post('/battle/quick-match', { question_type: 'spm', subject_id: s.math })).body.queue_id as string],
    ])('is not matched with %s', async (_n, other) => {
      const qa = await startQueue(a, s.math)
      await other()
      expect(await matched(a, qa)).toEqual({ status: 'waiting' })
    })

    it('Quick Match and Battle Sekolah do not meet', async () => {
      const qa = await startQueue(a, s.math)
      await startQueue(b, s.math, {}, '/battle/school-battle')
      expect(await matched(a, qa)).toEqual({ status: 'waiting' })
    })

    it('the same pupil in two entries is never matched with himself', async () => {
      const first = await startQueue(a, s.math)
      await startQueue(a, s.math)
      expect(await matched(a, first)).toEqual({ status: 'waiting' })
    })

    it('Tingkatan: 10 and 11 meet only when both are open to all (Keterlihatan Barisan off)', async () => {
      const qa = await startQueue(a, s.math)
      await startQueue(c, s.math)
      expect(await matched(a, qa)).toEqual({ status: 'waiting' })
      await rows(`delete from battle_queues`)
      const qa2 = await startQueue(a, s.math, { open_to_all: true })
      await startQueue(c, s.math)
      expect(await matched(a, qa2)).toEqual({ status: 'waiting' }) // c wants his own Tingkatan only
      await rows(`delete from battle_queues`)
      const qa3 = await startQueue(a, s.math, { open_to_all: true })
      await startQueue(c, s.math, { open_to_all: true })
      expect(await matched(a, qa3)).toMatchObject({ status: 'matched', robot: false })
    })

    it('entries that are cancelled, abandoned (no poll for 10 s) or expired (120 s) are not matched', async () => {
      const qa = await startQueue(a, s.math)
      const qb = await startQueue(b, s.math)
      expect((await b.post(`/battle/queue/${qb}/cancel`)).status).toBe(200)
      expect(await matched(a, qa)).toEqual({ status: 'waiting' })
      const qd = await startQueue(d, s.math)
      await rows(`update battle_queues set last_polled_at = last_polled_at - interval '11 seconds' where id = $1`, [qd])
      expect(await matched(a, qa)).toEqual({ status: 'waiting' })
      const qe = await startQueue(e, s.math)
      await rows(`update battle_queues set created_at = created_at - interval '121 seconds' where id = $1`, [qe])
      expect(await matched(a, qa)).toEqual({ status: 'waiting' })
      expect((await rows(`select 1 from battles`)).length).toBe(0)
    })

    it('Battle Sekolah: pupils of two different schools meet; pupils of one school do not (they wait for the robot)', async () => {
      const same = await startQueue(a, s.math, {}, '/battle/school-battle')
      await startQueue(b, s.math, {}, '/battle/school-battle')
      expect(await matched(a, same)).toEqual({ status: 'waiting' })
      await rows(`delete from battle_queues`)
      const qa = await startQueue(a, s.math, { open_to_all: true }, '/battle/school-battle')
      const qc = await startQueue(c, s.math, { open_to_all: true }, '/battle/school-battle')
      const m = (await matched(a, qa)) as { status: string; battle_uuid: string; robot: boolean }
      expect(m).toMatchObject({ status: 'matched', robot: false })
      expect(await matched(c, qc)).toEqual(m)
      const parts = await rows<{ side: string; user_id: string; school_id: string }>(`select side, user_id::text, school_id::text from battle_participants where battle_id = $1 order by side`, [m.battle_uuid])
      expect(parts.map((p) => p.user_id)).toEqual([a.id, c.id])
      expect(parts[0]?.school_id).not.toBe(parts[1]?.school_id)
      expect(parts[1]?.school_id).toBe(otherSchool)
      expect((await rows<{ mode: string }>(`select mode from battles where id = $1`, [m.battle_uuid]))[0]?.mode).toBe('school_battle')
    })

    it('Battle Sekolah: a pupil with no school is refused with 422 {}, no queue entry and no daily count; Quick Match still works', async () => {
      await rows(`update users set school_id = null where lower(email) = lower($1)`, [STUDENT_G10_D])
      try {
        await setting('battle_daily_max', 1)
        const res = await e.post('/battle/school-battle', { question_type: 'biasa', subject_id: s.math })
        expect(res.status).toBe(422)
        expect(parse(BattleEmptyBodySchema, res)).toEqual({})
        expect((await rows(`select 1 from battle_queues`)).length).toBe(0)
        expect((await rows(`select 1 from battles`)).length).toBe(0)
        expect((await e.post('/battle/quick-match', { question_type: 'biasa', subject_id: s.math })).status).toBe(200)
      } finally {
        await rows(`update users set school_id = 1 where lower(email) = lower($1)`, [STUDENT_G10_D])
      }
    })

    it('two pupils polling at the same moment get exactly one battle', async () => {
      const qa = await startQueue(a, s.math)
      const qb = await startQueue(b, s.math)
      await Promise.all([poll(a, qa), poll(b, qb)])
      const [ra, rb] = await Promise.all([matched(a, qa), matched(b, qb)])
      expect(ra).toMatchObject({ status: 'matched', robot: false })
      expect(rb).toEqual(ra)
      expect((await rows(`select 1 from battles`)).length).toBe(1)
    })

    it('an incoming join request on the entry still comes first (old challenger routes are kept)', async () => {
      const qa = await startQueue(a, s.math)
      expect((await b.post(`/battle/join-queue/${qa}`)).status).toBe(200)
      expect((await poll(a, qa)).body.status).toBe('incoming_challenge')
    })
  })

  describe('daily limit (FR-GM-01.9, AC-GM-01.9, ERR-GAME-05)', () => {
    const DAILY = 'Had battle hari ini telah dicapai. Cuba lagi esok.'
    const limited = async (who: Client, path = '/battle/quick-match') => {
      const res = await who.post(path, { question_type: 'biasa', subject_id: s.math })
      expect(res.status, JSON.stringify(res.body)).toBe(429)
      const body = parse(ErrorBodySchema, res)
      expect(body.error).toMatchObject({ code: 'BATTLE_DAILY_LIMIT', message: DAILY })
      expect(body.error.retryAfter).toBeGreaterThan(0)
      expect(res.header['retry-after']).toBe(String(body.error.retryAfter))
      return body
    }

    it('429 BATTLE_DAILY_LIMIT at battle_daily_max, robot battles included; nothing is created', async () => {
      await setting('battle_daily_max', 2)
      await matchBot(a, await startQueue(a, s.math))
      await matchBot(a, await startQueue(a, s.math))
      await rows(`delete from battle_queues`)
      await limited(a)
      await limited(a, '/battle/school-battle')
      expect((await rows(`select 1 from battle_queues`)).length).toBe(0)
      expect(BATTLE_MESSAGES.dailyLimit).toBe(DAILY)
    })

    it('counts per pupil: a human battle counts for both seats and nobody else; a pupil under the limit still starts', async () => {
      await setting('battle_daily_max', 1)
      const qd = await startQueue(d, s.math)
      const qe = await startQueue(e, s.math)
      expect(await matched(d, qd)).toMatchObject({ status: 'matched', robot: false })
      expect(await matched(e, qe)).toMatchObject({ status: 'matched' })
      await limited(d)
      await limited(e)
      expect((await a.post('/battle/quick-match', { question_type: 'biasa', subject_id: s.math })).status).toBe(200)
    })

    it('a battle against the robot counts at the moment it is created, an entry that never became a battle does not', async () => {
      await setting('battle_daily_max', 1)
      for (let i = 0; i < 4; i++) await startQueue(a, s.math) // four waiting entries and no battle
      const cancelled = await startQueue(a, s.math)
      await a.post(`/battle/queue/${cancelled}/cancel`)
      const last = await startQueue(a, s.math)
      await rows(`update battle_queues set status = 'expired' where id = $1`, [last])
      expect(await matched(a, last)).toEqual({ status: 'expired' })
      expect((await rows(`select 1 from battles`)).length).toBe(0)
      const queued = await startQueue(a, s.math)
      await matchBot(a, queued)
      await limited(a)
    })

    it('Cabar Kawan is not limited and does not count', async () => {
      await setting('battle_daily_max', 1)
      await matchBot(a, await startQueue(a, s.math))
      await limited(a)
      const sent = await a.post('/battle/invite', { question_type: 'biasa', subject_id: s.math, receiver_id: b.id })
      expect(sent.status).toBe(200)
      const inv = (await rows<{ id: string }>(`select id::text from battle_invitations order by created_at desc limit 1`))[0]?.id
      expect((await b.post(`/battle/invite/${inv}/accept`)).status).toBe(200)
      // b has only the Cabar Kawan battle, which does not count: he can still start one
      expect((await b.post('/battle/quick-match', { question_type: 'biasa', subject_id: s.math })).status).toBe(200)
      await rows(`delete from battle_invitations`)
    })

    it('the day is the Malaysia day: 23:59:59 yesterday does not count, 00:00 today does', async () => {
      await setting('battle_daily_max', 1)
      const uuid = await matchBot(a, await startQueue(a, s.math))
      const midnight = startOfMytDay(t.clock.now())
      await rows(`update battles set created_at = $2 where id = $1`, [uuid, new Date(midnight.getTime() - 1000).toISOString()])
      expect((await a.post('/battle/quick-match', { question_type: 'biasa', subject_id: s.math })).status).toBe(200)
      await rows(`delete from battle_queues`)
      await rows(`update battles set created_at = $2 where id = $1`, [uuid, midnight.toISOString()])
      await limited(a)
      // the last millisecond of today still counts
      await rows(`update battles set created_at = $2 where id = $1`, [uuid, new Date(midnight.getTime() + 86_400_000 - 1).toISOString()])
      await limited(a)
    })

    it('a new Malaysia day resets the count (the clock passes midnight)', async () => {
      await setting('battle_daily_max', 1)
      await matchBot(a, await startQueue(a, s.math))
      const first = await limited(a)
      const toMidnight = startOfMytDay(t.clock.now()).getTime() + 86_400_000 - t.clock.now().getTime()
      expect(first.error.retryAfter).toBe(Math.ceil(toMidnight / 1000))
      t.clock.advance(toMidnight + 1_000)
      const next = await client(t, STUDENT_G10)
      expect((await next.post('/battle/quick-match', { question_type: 'biasa', subject_id: s.math })).status).toBe(200)
      await rows(`delete from battle_queues`)
      await matchBot(next, await startQueue(next, s.math))
      await limited(next)
    })
  })
})
