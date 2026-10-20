import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  BattleAcceptChallengerResponseSchema,
  BattleEmptyBodySchema,
  BattlePollChallengerResponseSchema,
  BattlePollMatchResponseSchema,
  BattleRawErrorSchema,
  BattleStartResponseSchema,
  BattleSuccessSchema,
} from '@pp/contract'

import { prngStream } from '../../src/db/prng'
import { BattleDeps } from '../../src/modules/battle/battle.deps'
import { pickBot } from '../../src/modules/battle/engine'
import { addMcqs, bootBattleApp, client, matchBot, parse, startQueue, STUDENT_G10, STUDENT_G10_B, STUDENT_G11, subjectsOf, type BattleTestApp, type Client, type Subjects } from './arena-helpers'

const DENIED = 'Giliran tidak dijumpai.'

describe('battle queue (M16-02 to M16-06, M16-12, M16-13)', () => {
  let t: BattleTestApp
  let s: Subjects
  let a: Client
  let b: Client
  let c: Client
  const rows = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)

  beforeAll(async () => {
    t = await bootBattleApp()
    s = await subjectsOf(t)
    await addMcqs(t, s.math, s.t4, 12)
    await addMcqs(t, s.sci, s.t4, 3)
    await addMcqs(t, s.bm, s.t4, 10, { spm: true })
    ;[a, b, c] = [await client(t, STUDENT_G10), await client(t, STUDENT_G10_B), await client(t, STUDENT_G11)]
  }, 180_000)
  afterAll(async () => t.close())

  describe('start (AC 3)', () => {
    it('creates one waiting queue owned by the caller; school-battle stores its own mode', async () => {
      const res = await a.post('/battle/quick-match', { question_type: 'biasa', subject_id: s.math })
      expect(res.status).toBe(200)
      const { queue_id } = parse(BattleStartResponseSchema, res)
      const [q] = await rows<{ owner_id: string; mode: string; status: string; open_to_all: boolean; is_test: boolean; subject_id: string }>(
        `select owner_id::text, mode, status, open_to_all, is_test, subject_id::text from battle_queues where id = $1`,
        [queue_id],
      )
      expect(q).toEqual({ owner_id: a.id, mode: 'quick_match', status: 'waiting', open_to_all: false, is_test: false, subject_id: s.math })
      const school = parse(BattleStartResponseSchema, await a.post('/battle/school-battle', { question_type: 'biasa', subject_id: s.math, open_to_all: true }))
      const [sq] = await rows<{ mode: string; open_to_all: boolean }>(`select mode, open_to_all from battle_queues where id = $1`, [school.queue_id])
      expect(sq).toEqual({ mode: 'school_battle', open_to_all: true })
    })

    it('open_to_all counts only when literally true; other body fields (status, points) are ignored', async () => {
      const res = await a.post('/battle/quick-match', { question_type: 'biasa', subject_id: s.math, open_to_all: 'true', status: 'matched', battle_id: 'x', score: 9999 })
      expect(res.status).toBe(200)
      const [q] = await rows<{ open_to_all: boolean; status: string; battle_id: string | null }>(`select open_to_all, status, battle_id::text from battle_queues where id = $1`, [res.body.queue_id])
      expect(q).toEqual({ open_to_all: false, status: 'waiting', battle_id: null })
    })

    it.each([
      ['no body', {}],
      ['bad question_type', { question_type: 'hard', subject_id: '3' }],
      ['biasa without subject', { question_type: 'biasa' }],
      ['unknown subject', { question_type: 'biasa', subject_id: '999999' }],
      ['numeric subject (ids are strings)', { question_type: 'biasa', subject_id: 3 }],
      ['subject injection text', { question_type: 'biasa', subject_id: "1'; drop table battles;--" }],
      ['pksk (no domain is served)', { question_type: 'pksk', pksk_domain_id: '1', pksk_target_level: 'T1' }],
      ['pool below 10 questions', 'sci'],
    ])('422 with an EMPTY body: %s', async (_name, body) => {
      const res = await a.post('/battle/quick-match', body === 'sci' ? { question_type: 'biasa', subject_id: s.sci } : (body as object))
      expect(res.status).toBe(422)
      expect(parse(BattleEmptyBodySchema, res)).toEqual({})
    })

    it('SPM: 403 {} below Tingkatan 4; 422 {} without an SPM pool; 200 for grade 10 with a pool', async () => {
      const lowGrade = (await rows<{ email: string }>(`select email from users where grade = 9 and email is not null order by id limit 1`))[0]?.email as string
      const low = await client(t, lowGrade)
      const denied = await low.post('/battle/quick-match', { question_type: 'spm', subject_id: s.bm })
      expect(denied.status).toBe(403)
      expect(parse(BattleEmptyBodySchema, denied)).toEqual({})
      const noPool = await a.post('/battle/school-battle', { question_type: 'spm', subject_id: s.math })
      expect(noPool.status).toBe(422)
      expect(noPool.body).toEqual({})
      const ok = await a.post('/battle/quick-match', { question_type: 'spm', subject_id: s.bm })
      expect(ok.status).toBe(200)
      parse(BattleStartResponseSchema, ok)
    })
  })

  describe('poll-match (AC 4, 5, 16)', () => {
    it('waits for two polls, matches a bot on the third, repeats the answer afterwards', async () => {
      const qid = await startQueue(a, s.math)
      for (let i = 0; i < 2; i++) {
        const w = await a.get(`/battle/poll-match/${qid}`)
        expect(parse(BattlePollMatchResponseSchema, w)).toEqual({ status: 'waiting' })
      }
      const m = parse(BattlePollMatchResponseSchema, await a.get(`/battle/poll-match/${qid}`))
      expect(m.status).toBe('matched')
      const uuid = (m as { battle_uuid: string }).battle_uuid
      expect(parse(BattlePollMatchResponseSchema, await a.get(`/battle/poll-match/${qid}`))).toEqual({ status: 'matched', battle_uuid: uuid })
      const [battle] = await rows<{ status: string; mode: string; is_test: boolean; winner: string | null; level_id: string }>(
        `select status, mode, is_test, winner, level_id::text from battles where id = $1`,
        [uuid],
      )
      expect(battle).toEqual({ status: 'active', mode: 'quick_match', is_test: false, winner: null, level_id: s.t4 })
      const parts = await rows<{ side: string; user_id: string; is_bot: boolean; is_test: boolean }>(`select side, user_id::text, is_bot, is_test from battle_participants where battle_id = $1 order by side`, [uuid])
      expect(parts.map((p) => [p.side, p.is_bot, p.is_test])).toEqual([['A', false, false], ['B', true, false]])
      expect(parts[0]?.user_id).toBe(a.id)
      expect(parts[1]?.user_id).not.toBe(a.id)
      const qs = await rows<{ n: string; d: string }>(`select count(*)::text n, count(distinct question_id)::text d from battle_questions where battle_id = $1`, [uuid])
      expect(qs[0]).toEqual({ n: '10', d: '10' })
    })

    it('the bot is the seeded pick of the stream m16:battle:<queueId>, same grade first', async () => {
      const deps = t.get(BattleDeps)
      const qid = await startQueue(a, s.math)
      const uuid = await matchBot(a, qid)
      const owner = (await deps.players([a.id])).get(a.id)!
      const expected = pickBot({ id: a.id, grade: owner.grade, schoolId: owner.schoolId }, 'quick_match', false, await deps.activeStudents({ excludeIds: new Set([a.id]) }), prngStream(`m16:battle:${qid}`))
      const [bot] = await rows<{ user_id: string }>(`select user_id::text from battle_participants where battle_id = $1 and side = 'B'`, [uuid])
      expect(bot?.user_id).toBe(expected?.id)
      expect(expected?.grade).toBe(owner.grade)
    })

    it('school battle: the bot is from another school (widened past the grade when nobody else fits)', async () => {
      const uuid = await matchBot(a, await startQueue(a, s.math, {}, '/battle/school-battle'))
      const [bot] = await rows<{ school_id: string | null; mode: string }>(
        `select p.school_id::text, b.mode from battle_participants p join battles b on b.id = p.battle_id where p.battle_id = $1 and p.side = 'B'`,
        [uuid],
      )
      expect(bot?.mode).toBe('school_battle')
      expect(bot?.school_id).not.toBeNull()
      const [owner] = await rows<{ school_id: string }>(`select school_id::text from users where id = $1`, [a.id])
      expect(bot?.school_id).not.toBe(owner?.school_id)
    })

    it('an unknown, foreign or malformed queue id answers {status: not_found} with HTTP 200', async () => {
      const qid = await startQueue(a, s.math)
      for (const id of [qid, '99999999', 'abc', '-1', '1; select 1', '9'.repeat(30)]) {
        const res = await b.get(`/battle/poll-match/${encodeURIComponent(id)}`)
        expect(res.status).toBe(200)
        expect(parse(BattlePollMatchResponseSchema, res)).toEqual({ status: 'not_found' })
      }
      const [q] = await rows<{ polls: number }>(`select polls from battle_queues where id = $1`, [qid])
      expect(q?.polls).toBe(0)
    })

    it('a queue not polled for more than 10 s is expired (and stays so)', async () => {
      const qid = await startQueue(a, s.math)
      expect((await a.get(`/battle/poll-match/${qid}`)).body).toEqual({ status: 'waiting' })
      t.clock.advance(10_000)
      expect((await a.get(`/battle/poll-match/${qid}`)).body).toEqual({ status: 'waiting' })
      t.clock.advance(10_001)
      expect(parse(BattlePollMatchResponseSchema, await a.get(`/battle/poll-match/${qid}`))).toEqual({ status: 'expired' })
      expect((await a.get(`/battle/poll-match/${qid}`)).body).toEqual({ status: 'expired' })
      const [q] = await rows<{ status: string }>(`select status from battle_queues where id = $1`, [qid])
      expect(q?.status).toBe('abandoned')
    })

    it('a queue older than 120 s is expired even when polled every 9 s', async () => {
      const qid = await startQueue(a, s.math)
      expect((await b.post(`/battle/join-queue/${qid}`)).status).toBe(200)
      expect((await a.get(`/battle/poll-match/${qid}`)).body.status).toBe('incoming_challenge')
      for (let i = 0; i < 13; i++) {
        t.clock.advance(9_000)
        expect((await a.get(`/battle/poll-match/${qid}`)).body.status).toBe('incoming_challenge')
      }
      t.clock.advance(9_000)
      expect((await a.get(`/battle/poll-match/${qid}`)).body).toEqual({ status: 'expired' })
      const [q] = await rows<{ status: string }>(`select status from battle_queues where id = $1`, [qid])
      expect(q?.status).toBe('expired')
    })
  })

  describe('challenger flow (AC 6, 7)', () => {
    it('join, incoming_challenge without an id, reject back to waiting, accept creates one battle', async () => {
      const qid = await startQueue(a, s.math)
      expect(parse(BattleSuccessSchema, await b.post(`/battle/join-queue/${qid}`))).toEqual({ success: true })
      expect(parse(BattlePollChallengerResponseSchema, await b.get(`/battle/poll-challenger/${qid}`))).toEqual({ status: 'waiting' })
      const incoming = parse(BattlePollMatchResponseSchema, await a.get(`/battle/poll-match/${qid}`))
      expect(incoming).toEqual({ status: 'incoming_challenge', challenger: { name: 'Murid Demo Kosong', grade_label: 'Tingkatan 4', school: 'SMK Demo Satu' } })

      expect(parse(BattleSuccessSchema, await a.post(`/battle/reject-challenger/${qid}`))).toEqual({ success: true })
      expect(parse(BattlePollChallengerResponseSchema, await b.get(`/battle/poll-challenger/${qid}`))).toEqual({ status: 'rejected' })
      const [q] = await rows<{ status: string; wait_polls: number; challenger_user_id: string | null }>(`select status, wait_polls, challenger_user_id::text from battle_queues where id = $1`, [qid])
      expect(q).toEqual({ status: 'waiting', wait_polls: 0, challenger_user_id: null })
      // nothing to reject now: still success
      expect(parse(BattleSuccessSchema, await a.post(`/battle/reject-challenger/${qid}`))).toEqual({ success: true })

      // the rejected joiner may ask again; the owner accepts this time
      expect((await b.post(`/battle/join-queue/${qid}`)).status).toBe(200)
      expect((await a.get(`/battle/poll-match/${qid}`)).body.status).toBe('incoming_challenge')
      const accepted = await a.post(`/battle/accept-challenger/${qid}`)
      expect(accepted.status).toBe(200)
      const { battle_uuid } = parse(BattleAcceptChallengerResponseSchema, accepted)
      expect(parse(BattlePollChallengerResponseSchema, await b.get(`/battle/poll-challenger/${qid}`))).toEqual({ status: 'matched', battle_uuid })
      expect(parse(BattlePollMatchResponseSchema, await a.get(`/battle/poll-match/${qid}`))).toEqual({ status: 'matched', battle_uuid })
      const parts = await rows<{ side: string; user_id: string; is_bot: boolean }>(`select side, user_id::text, is_bot from battle_participants where battle_id = $1 order by side`, [battle_uuid])
      expect(parts).toEqual([{ side: 'A', user_id: a.id, is_bot: false }, { side: 'B', user_id: b.id, is_bot: false }])
      // the queue is matched: a second accept is the documented not-found
      const again = await a.post(`/battle/accept-challenger/${qid}`)
      expect(again.status).toBe(404)
      expect(parse(BattleRawErrorSchema, again)).toEqual({ error: DENIED })
    })

    it('join errors: own queue, unknown queue, a join already pending, a closed queue: 404 "Ralat menghantar permohonan."', async () => {
      const qid = await startQueue(a, s.math)
      const denied = { error: 'Ralat menghantar permohonan.' }
      for (const [who, id] of [[a, qid], [b, '88888888'], [b, 'zzz']] as const) {
        const res = await who.post(`/battle/join-queue/${id}`)
        expect(res.status).toBe(404)
        expect(parse(BattleRawErrorSchema, res)).toEqual(denied)
      }
      expect((await b.post(`/battle/join-queue/${qid}`)).status).toBe(200)
      expect((await c.post(`/battle/join-queue/${qid}`)).body).toEqual(denied)
      const matched = await startQueue(a, s.math)
      await matchBot(a, matched)
      expect((await b.post(`/battle/join-queue/${matched}`)).body).toEqual(denied)
    })

    it('ownership: foreign callers get the not-found answer on accept, reject and poll-challenger', async () => {
      const qid = await startQueue(a, s.math)
      await b.post(`/battle/join-queue/${qid}`)
      await a.get(`/battle/poll-match/${qid}`)
      for (const path of [`/battle/accept-challenger/${qid}`, `/battle/reject-challenger/${qid}`]) {
        const res = await c.post(path)
        expect(res.status).toBe(404)
        expect(parse(BattleRawErrorSchema, res)).toEqual({ error: DENIED })
        // the joiner is not the owner either
        expect((await b.post(path)).status).toBe(404)
      }
      expect((await c.get(`/battle/poll-challenger/${qid}`)).body).toEqual({ status: 'not_found' })
      expect((await a.get(`/battle/poll-challenger/${qid}`)).body).toEqual({ status: 'not_found' })
      // accept of a queue that is only waiting
      const waiting = await startQueue(a, s.math)
      expect((await a.post(`/battle/accept-challenger/${waiting}`)).body).toEqual({ error: DENIED })
      expect((await a.post(`/battle/accept-challenger/nope`)).body).toEqual({ error: DENIED })
    })

    it('two concurrent accepts create exactly one battle', async () => {
      const qid = await startQueue(a, s.math)
      await b.post(`/battle/join-queue/${qid}`)
      await a.get(`/battle/poll-match/${qid}`)
      const before = Number((await rows<{ n: string }>(`select count(*)::text n from battles`))[0]?.n)
      const [r1, r2] = await Promise.all([a.post(`/battle/accept-challenger/${qid}`), a.post(`/battle/accept-challenger/${qid}`)])
      expect([r1.status, r2.status].sort()).toEqual([200, 404])
      expect(Number((await rows<{ n: string }>(`select count(*)::text n from battles`))[0]?.n)).toBe(before + 1)
    })

    it('the pool is checked again at match time: 422 {error: "Soalan tidak mencukupi."} and nothing is created', async () => {
      const qid = await startQueue(a, s.math)
      const before = Number((await rows<{ n: string }>(`select count(*)::text n from battles`))[0]?.n)
      await rows(`update questions set is_active = false where id in (select q.id from questions q join question_versions v on v.question_id = q.id where v.subject_id = $1)`, [s.math])
      await a.get(`/battle/poll-match/${qid}`)
      await a.get(`/battle/poll-match/${qid}`)
      const res = await a.get(`/battle/poll-match/${qid}`)
      expect(res.status).toBe(422)
      expect(parse(BattleRawErrorSchema, res)).toEqual({ error: 'Soalan tidak mencukupi.' })
      expect(Number((await rows<{ n: string }>(`select count(*)::text n from battles`))[0]?.n)).toBe(before)
      const [q] = await rows<{ status: string; battle_id: string | null }>(`select status, battle_id::text from battle_queues where id = $1`, [qid])
      expect(q).toEqual({ status: 'waiting', battle_id: null })
      await rows(`update questions set is_active = true`)
    })

    it('no student to pick: 404 {error: "Tiada lawan dijumpai."}', async () => {
      const qid = await startQueue(a, s.math)
      await rows(`update users set is_active = false where id <> $1`, [a.id])
      await a.get(`/battle/poll-match/${qid}`)
      await a.get(`/battle/poll-match/${qid}`)
      const res = await a.get(`/battle/poll-match/${qid}`)
      expect(res.status).toBe(404)
      expect(parse(BattleRawErrorSchema, res)).toEqual({ error: 'Tiada lawan dijumpai.' })
      await rows(`update users set is_active = true`)
      await rows(`update users set is_active = false where email = 'tidakaktif@demo.test'`)
    })
  })

  describe('Mod Pelajar (is_test)', () => {
    it('writes is_test rows, gets a real student as the bot, and cannot meet real queues', async () => {
      const admin = await client(t, 'admin@demo.test', { modPelajar: true })
      const qid = await startQueue(admin, s.math)
      const [q] = await rows<{ is_test: boolean }>(`select is_test from battle_queues where id = $1`, [qid])
      expect(q?.is_test).toBe(true)
      const uuid = await matchBot(admin, qid)
      const [battle] = await rows<{ is_test: boolean }>(`select is_test from battles where id = $1`, [uuid])
      expect(battle?.is_test).toBe(true)
      const parts = await rows<{ is_test: boolean; is_bot: boolean; role: string | null }>(
        `select p.is_test, p.is_bot, (select string_agg(r.role, ',') from user_roles r where r.user_id = p.user_id) role from battle_participants p where p.battle_id = $1 order by side`,
        [uuid],
      )
      expect(parts[0]).toMatchObject({ is_test: true, is_bot: false })
      expect(parts[1]).toMatchObject({ is_test: true, is_bot: true, role: 'student' })

      // test and real queues never meet
      const real = await startQueue(a, s.math)
      expect((await admin.post(`/battle/join-queue/${real}`)).status).toBe(404)
      expect((await admin.get(`/battle/poll-match/${real}`)).body).toEqual({ status: 'not_found' })
      const test2 = await startQueue(admin, s.math)
      expect((await b.post(`/battle/join-queue/${test2}`)).status).toBe(404)
      expect((await b.get(`/battle/poll-challenger/${test2}`)).body).toEqual({ status: 'not_found' })
    })

    it('no staff account is ever picked as a bot', async () => {
      const bots = await rows<{ n: string }>(
        `select count(*)::text n from battle_participants p where p.is_bot and not exists (select 1 from user_roles r where r.user_id = p.user_id and r.role = 'student')`,
      )
      expect(bots[0]?.n).toBe('0')
    })
  })
})
