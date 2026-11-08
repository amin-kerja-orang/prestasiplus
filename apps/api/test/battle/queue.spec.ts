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

import { BattleDeps } from '../../src/modules/battle/battle.deps'
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
    await addMcqs(t, s.bm, s.t4, 10)
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
      ['pksk with an unknown domain', { question_type: 'pksk', pksk_domain_id: '999999', pksk_target_level: 'T1' }],
      ['pool below 10 questions', 'sci'],
    ])('422 with an EMPTY body: %s', async (_name, body) => {
      const res = await a.post('/battle/quick-match', body === 'sci' ? { question_type: 'biasa', subject_id: s.sci } : (body as object))
      expect(res.status).toBe(422)
      expect(parse(BattleEmptyBodySchema, res)).toEqual({})
    })

    it('SPM: 403 {} below Tingkatan 4; 422 {} with too small an SPM pool; 200 for grade 10 with a pool', async () => {
      const lowGrade = (await rows<{ email: string }>(`select email from users where grade = 9 and email is not null order by id limit 1`))[0]?.email as string
      const low = await client(t, lowGrade)
      const denied = await low.post('/battle/quick-match', { question_type: 'spm', subject_id: s.bm })
      expect(denied.status).toBe(403)
      expect(parse(BattleEmptyBodySchema, denied)).toEqual({})
      // R1-B06: the SPM pool is by level, so math (12 T4 questions) has one; science (3) is too small to start a battle.
      const noPool = await a.post('/battle/school-battle', { question_type: 'spm', subject_id: s.sci })
      expect(noPool.status).toBe(422)
      expect(noPool.body).toEqual({})
      const ok = await a.post('/battle/quick-match', { question_type: 'spm', subject_id: s.bm })
      expect(ok.status).toBe(200)
      parse(BattleStartResponseSchema, ok)
    })
  })

  describe('poll-match (AC 4, 5, 16)', () => {
    it('FR-PA-29: waits until battle_bot_fallback_seconds (30), then matches the robot, repeats the answer afterwards', async () => {
      const qid = await startQueue(a, s.math)
      for (let i = 0; i < 9; i++) {
        const w = await a.get(`/battle/poll-match/${qid}`)
        expect(parse(BattlePollMatchResponseSchema, w)).toEqual({ status: 'waiting' })
        t.clock.advance(3_000)
      }
      t.clock.advance(2_999)
      expect(parse(BattlePollMatchResponseSchema, await a.get(`/battle/poll-match/${qid}`))).toEqual({ status: 'waiting' })
      t.clock.advance(1)
      const m = parse(BattlePollMatchResponseSchema, await a.get(`/battle/poll-match/${qid}`))
      expect(m.status).toBe('matched')
      const uuid = (m as { battle_uuid: string }).battle_uuid
      expect(parse(BattlePollMatchResponseSchema, await a.get(`/battle/poll-match/${qid}`))).toEqual({ status: 'matched', battle_uuid: uuid, robot: true })
      const [battle] = await rows<{ status: string; mode: string; is_test: boolean; winner: string | null; level_id: string; counts_for_ranking: boolean }>(
        `select status, mode, is_test, winner, level_id::text, counts_for_ranking from battles where id = $1`,
        [uuid],
      )
      expect(battle).toEqual({ status: 'active', mode: 'quick_match', is_test: false, winner: null, level_id: s.t4, counts_for_ranking: false })
      const parts = await rows<{ side: string; user_id: string | null; school_id: string | null; is_bot: boolean; is_test: boolean }>(`select side, user_id::text, school_id::text, is_bot, is_test from battle_participants where battle_id = $1 order by side`, [uuid])
      expect(parts.map((p) => [p.side, p.is_bot, p.is_test])).toEqual([['A', false, false], ['B', true, false]])
      expect(parts[0]?.user_id).toBe(a.id)
      expect(parts[1]).toMatchObject({ user_id: null, school_id: null }) // AC-GM-00.4: no user, no school
      const qs = await rows<{ n: string; d: string }>(`select count(*)::text n, count(distinct question_id)::text d from battle_questions where battle_id = $1`, [uuid])
      expect(qs[0]).toEqual({ n: '10', d: '10' })
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

    it('battle_bot_fallback_seconds = 120 (its maximum), the same as the queue: the robot comes, the entry does not expire first', async () => {
      await rows(`update gamification_settings set value = 120 where key = 'battle_bot_fallback_seconds'`)
      try {
        const qid = await startQueue(a, s.math)
        for (let i = 0; i < 14; i++) {
          expect((await a.get(`/battle/poll-match/${qid}`)).body).toEqual({ status: 'waiting' })
          t.clock.advance(i === 13 ? 3_000 : 9_000) // polled at 0, 9 ... 117 s, then at exactly 120 s
        }
        expect(parse(BattlePollMatchResponseSchema, await a.get(`/battle/poll-match/${qid}`)).status).toBe('matched')
      } finally {
        await rows(`update gamification_settings set value = 30 where key = 'battle_bot_fallback_seconds'`)
      }
    })

    it('battle_bot_fallback_seconds = 0: never a robot; the entry expires after 120 s', async () => {
      await rows(`update gamification_settings set value = 0 where key = 'battle_bot_fallback_seconds'`)
      try {
        const qid = await startQueue(a, s.math)
        for (let i = 0; i < 14; i++) {
          expect((await a.get(`/battle/poll-match/${qid}`)).body).toEqual({ status: 'waiting' })
          t.clock.advance(i === 13 ? 3_000 : 9_000)
        }
        expect((await a.get(`/battle/poll-match/${qid}`)).body).toEqual({ status: 'expired' })
        expect((await rows<{ status: string }>(`select status from battle_queues where id = $1`, [qid]))[0]?.status).toBe('expired')
      } finally {
        await rows(`update gamification_settings set value = 30 where key = 'battle_bot_fallback_seconds'`)
      }
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
      expect(incoming).toEqual({ status: 'incoming_challenge', challenger: { name: 'Murid', grade_label: 'Tingkatan 4', school: '' } })

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
      expect(parse(BattlePollMatchResponseSchema, await a.get(`/battle/poll-match/${qid}`))).toEqual({ status: 'matched', battle_uuid, robot: false })
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
      await rows(`update battle_queues set created_at = created_at - interval '30 seconds' where id = $1`, [qid])
      const res = await a.get(`/battle/poll-match/${qid}`)
      expect(res.status).toBe(422)
      expect(parse(BattleRawErrorSchema, res)).toEqual({ error: 'Soalan tidak mencukupi.' })
      expect(Number((await rows<{ n: string }>(`select count(*)::text n from battles`))[0]?.n)).toBe(before)
      const [q] = await rows<{ status: string; battle_id: string | null }>(`select status, battle_id::text from battle_queues where id = $1`, [qid])
      expect(q).toEqual({ status: 'waiting', battle_id: null })
      await rows(`update questions set is_active = true`)
    })

    it('no other pupil at all: the robot still comes (no real pupil is read)', async () => {
      await rows(`update users set is_active = false where id <> $1`, [a.id])
      t.get(BattleDeps).invalidateCache()
      const qid = await startQueue(a, s.math)
      await matchBot(a, qid)
      await rows(`update users set is_active = true`)
      await rows(`update users set is_active = false where email = 'tidakaktif@demo.test'`)
      t.get(BattleDeps).invalidateCache()
    })
  })

  describe('Mod Pelajar (is_test)', () => {
    it('writes is_test rows, gets the robot, and cannot meet real queues', async () => {
      const admin = await client(t, 'admin@demo.test', { modPelajar: true })
      const qid = await startQueue(admin, s.math)
      const [q] = await rows<{ is_test: boolean }>(`select is_test from battle_queues where id = $1`, [qid])
      expect(q?.is_test).toBe(true)
      const uuid = await matchBot(admin, qid)
      const [battle] = await rows<{ is_test: boolean }>(`select is_test from battles where id = $1`, [uuid])
      expect(battle?.is_test).toBe(true)
      const parts = await rows<{ is_test: boolean; is_bot: boolean; user_id: string | null }>(`select is_test, is_bot, user_id::text from battle_participants where battle_id = $1 order by side`, [uuid])
      expect(parts[0]).toMatchObject({ is_test: true, is_bot: false })
      expect(parts[1]).toEqual({ is_test: true, is_bot: true, user_id: null })

      // test and real queues never meet
      const real = await startQueue(a, s.math)
      expect((await admin.post(`/battle/join-queue/${real}`)).status).toBe(404)
      expect((await admin.get(`/battle/poll-match/${real}`)).body).toEqual({ status: 'not_found' })
      const test2 = await startQueue(admin, s.math)
      expect((await b.post(`/battle/join-queue/${test2}`)).status).toBe(404)
      expect((await b.get(`/battle/poll-challenger/${test2}`)).body).toEqual({ status: 'not_found' })
    })

    it('staff in their own role (not Mod Pelajar) also write is_test rows and never meet real pupils', async () => {
      const staff = await client(t, 'guru@demo.test')
      const qid = await startQueue(staff, s.math)
      expect((await rows<{ is_test: boolean }>(`select is_test from battle_queues where id = $1`, [qid]))[0]?.is_test).toBe(true)
      const uuid = await matchBot(staff, qid)
      expect((await rows<{ is_test: boolean }>(`select is_test from battles where id = $1`, [uuid]))[0]?.is_test).toBe(true)
      expect((await b.post(`/battle/join-queue/${qid}`)).status).toBe(404)
      expect((await staff.post('/battle/invite', { question_type: 'biasa', subject_id: s.math, receiver_id: b.id })).status).toBe(200)
      expect((await rows<{ is_test: boolean }>(`select is_test from battle_invitations order by created_at desc limit 1`))[0]?.is_test).toBe(true)
      expect((await b.get('/battle/invitations')).body.invitations).toEqual([])
    })

    it('AC-GM-00.4: no account is ever a robot', async () => {
      const bots = await rows<{ n: string }>(`select count(*)::text n from battle_participants where is_bot and user_id is not null`)
      expect(bots[0]?.n).toBe('0')
    })
  })
})
