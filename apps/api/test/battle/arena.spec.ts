import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BATTLE_RULES, BattleAnswerResultSchema, BattleArenaViewSchema, ErrorBodySchema, battleArenaPoints } from '@pp/contract'

import { BattleEngine } from '../../src/modules/battle/engine'
import { botAnswers } from '../../src/modules/battle/engine'
import { addMcqs, bootBattleApp, botBattle, client, parseData, STUDENT_G10, STUDENT_G10_B, STUDENT_G11, subjectsOf, type BattleTestApp, type Client, type Subjects } from './arena-helpers'

const FORBIDDEN_KEYS = new Set(['correct', 'correctOptionId', 'isCorrect', 'answer', 'correctAnswer', 'key', 'explanation'])

/** Keys of the arena flow that would reveal the answer key (walks the whole body). */
function leakedKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => leakedKeys(v, found))
  else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k)) found.push(k)
      leakedKeys(v, found)
    }
  }
  return found
}

describe('arena (M16-16, M16-17)', () => {
  let t: BattleTestApp
  let s: Subjects
  let a: Client
  let b: Client
  let c: Client
  const rows = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)
  const setAccuracy = (p: number) => {
    ;(t.get(BattleEngine) as unknown as { accuracy: Promise<number> | null }).accuracy = Promise.resolve(p)
  }
  const view = async (who: Client, uuid: string) => who.get(`/battle/arena/${uuid}`)
  const questionOf = async (who: Client, uuid: string): Promise<string> => parseData(BattleArenaViewSchema, await view(who, uuid)).question?.id as string
  const answer = (who: Client, uuid: string, body: object) => who.post(`/battle/arena/${uuid}/answer`, body)
  const play = async (who: Client, uuid: string, plan: { option: number | null; seconds: number }[]) => {
    const out: ReturnType<typeof BattleAnswerResultSchema.parse>[] = []
    for (const p of plan) {
      const res = await answer(who, uuid, { questionId: await questionOf(who, uuid), optionId: p.option, seconds: p.seconds })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      out.push(parseData(BattleAnswerResultSchema, res))
    }
    return out
  }
  const ten = (option: number | null, seconds: number) => Array.from({ length: 10 }, () => ({ option, seconds }))

  beforeAll(async () => {
    t = await bootBattleApp()
    s = await subjectsOf(t)
    await addMcqs(t, s.math, s.t4, 14)
    ;[a, b, c] = [await client(t, STUDENT_G10), await client(t, STUDENT_G10_B), await client(t, STUDENT_G11)]
  }, 180_000)
  afterAll(async () => t.close())

  describe('view (AC 11, 15)', () => {
    it('shows the caller\'s next keyless question, four options, secondsLeft 15 and no result while active', async () => {
      setAccuracy(0)
      const uuid = await botBattle(a, s.math)
      const res = await view(a, uuid)
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const v = parseData(BattleArenaViewSchema, res)
      expect(v).toMatchObject({ uuid, status: 'active', you: 'A', index: 1, total: 10, secondsLeft: 15, scores: { A: 0, B: 0 } })
      expect(v.result).toBeUndefined()
      expect(v.question?.options.map((o) => [o.id, o.label])).toEqual([[0, 'A'], [1, 'B'], [2, 'C'], [3, 'D']])
      expect(v.players.A).toEqual({ name: 'Murid Demo', school: 'SMK Demo Satu' })
      expect(leakedKeys(res.body)).toEqual([])
      const [first] = await rows<{ question_id: string }>(`select question_id::text from battle_questions where battle_id = $1 and position = 1`, [uuid])
      expect(v.question?.id).toBe(first?.question_id)
    })

    it('only the two players see a battle; anyone else (and unknown or malformed ids) gets 404 NOT_FOUND "Battle tidak dijumpai."', async () => {
      const uuid = await botBattle(a, s.math)
      for (const id of [uuid, '00000000-0000-4000-8000-000000000000', 'abc', "x' or 1=1"]) {
        const who = id === uuid ? b : a
        const res = await view(who, encodeURIComponent(id))
        expect(res.status, id).toBe(404)
        const body = ErrorBodySchema.parse(res.body)
        expect(body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Battle tidak dijumpai.' })
        const post = await answer(who, encodeURIComponent(id), { questionId: '1', optionId: 1, seconds: 1 })
        expect(post.status).toBe(404)
        expect(ErrorBodySchema.parse(post.body).error.message).toBe('Battle tidak dijumpai.')
      }
    })
  })

  describe('answer (AC 11)', () => {
    it('scores on the server: 1000 - round(500 s / 15), wrong and timeout 0, ten answers end the battle', async () => {
      setAccuracy(0)
      const uuid = await botBattle(a, s.math)
      const plan = [
        { option: 1, seconds: 0 },
        { option: 1, seconds: 15 },
        { option: 1, seconds: 7.9 },
        { option: 0, seconds: 1 },
        { option: null, seconds: 3 },
        { option: 1, seconds: 14.99 },
        { option: 3, seconds: 0 },
        { option: 1, seconds: 3 },
        { option: 1, seconds: 10 },
        { option: 1, seconds: 1 },
      ]
      const results = await play(a, uuid, plan)
      const expected = plan.map((p) => (p.option === 1 ? battleArenaPoints(p.seconds) : 0))
      expect(results.map((r) => r.points)).toEqual(expected)
      expect(results.map((r) => r.correct)).toEqual(plan.map((p) => p.option === 1))
      expect(results.every((r) => r.correctOptionId === 1)).toBe(true)
      expect(results.map((r) => r.points).slice(0, 3)).toEqual([1000, 500, 767])
      const total = expected.reduce((x, y) => x + y, 0)
      expect(results.at(-1)?.you.score).toBe(total)
      expect(results.slice(0, 9).every((r) => r.next !== undefined && r.result === undefined)).toBe(true)
      expect(results[9]?.next).toBeUndefined()
      expect(results[9]?.result).toEqual({ winner: 'A', scoreA: total, scoreB: 0 })

      const [battle] = await rows<{ status: string; winner: string; answered: number; finished_at: Date }>(`select status, winner, answered, finished_at from battles where id = $1`, [uuid])
      expect(battle).toMatchObject({ status: 'finished', winner: 'A', answered: 10 })
      expect(battle?.finished_at.toISOString()).toBe(t.clock.now().toISOString())
      const parts = await rows<{ side: string; score: number; correct: number }>(`select side, score, correct from battle_participants where battle_id = $1 order by side`, [uuid])
      expect(parts).toEqual([{ side: 'A', score: total, correct: plan.filter((p) => p.option === 1).length }, { side: 'B', score: 0, correct: 0 }])
      const stored = await rows<{ position: number; option_id: number | null; seconds: number; points: number }>(`select position, option_id, seconds, points from battle_answers where battle_id = $1 and user_id = $2 order by position`, [uuid, a.id])
      expect(stored.map((r) => r.points)).toEqual(expected)
      expect(stored.map((r) => r.seconds)).toEqual(plan.map((p) => Math.floor(p.seconds)))
      expect(stored[4]?.option_id).toBeNull()

      // the finished arena shows the result and no question
      const done = parseData(BattleArenaViewSchema, await view(a, uuid))
      expect(done).toMatchObject({ status: 'finished', question: null, secondsLeft: 0, index: 10, result: { winner: 'A', scoreA: total, scoreB: 0 } })
      // M14 report (AC 12): the caller, coins 0, xp 0
      expect(t.reports.at(-1)).toEqual({ userId: a.id, game: 'battle', event: 'win', coins: 0, xp: 0, correct: 7, total: 10, isTest: false })
    })

    it('an omitted optionId is a timeout', async () => {
      const uuid = await botBattle(a, s.math)
      const res = await answer(a, uuid, { questionId: await questionOf(a, uuid), seconds: 15 })
      expect(res.status).toBe(200)
      expect(parseData(BattleAnswerResultSchema, res)).toMatchObject({ correct: false, points: 0, correctOptionId: 1 })
    })

    it('winner rules: 0-0 is player B, a higher total wins, equal non-zero totals are a draw (null)', async () => {
      // 0-0: nobody scores
      setAccuracy(0)
      const zero = await botBattle(a, s.math)
      const zeroRes = await play(a, zero, ten(0, 5))
      expect(zeroRes[9]?.result).toEqual({ winner: 'B', scoreA: 0, scoreB: 0 })
      expect(t.reports.at(-1)).toMatchObject({ event: 'finish', correct: 0 })
      // B wins: the bot answers right, the pupil wrong
      setAccuracy(1)
      const lose = await botBattle(a, s.math)
      const loseRes = await play(a, lose, ten(0, 5))
      expect(loseRes[9]?.result?.winner).toBe('B')
      expect(loseRes[9]?.result?.scoreA).toBe(0)
      expect(loseRes[9]?.result?.scoreB).toBeGreaterThan(0)
      // draw: right answers at exactly the bot's seconds
      const draw = await botBattle(a, s.math)
      const bot = botAnswers(draw, 1)
      const drawRes = await play(a, draw, bot.map((x) => ({ option: 1, seconds: x.seconds })))
      expect(drawRes[9]?.result?.winner).toBeNull()
      expect(drawRes[9]?.result?.scoreA).toBe(drawRes[9]?.result?.scoreB)
      expect(drawRes[9]?.result?.scoreA).toBeGreaterThan(0)
      const [row] = await rows<{ winner: string | null; status: string }>(`select winner, status from battles where id = $1`, [draw])
      expect(row).toEqual({ winner: null, status: 'finished' })
      expect(t.reports.at(-1)).toMatchObject({ event: 'finish', correct: 10 })
      setAccuracy(0)
    })

    it('the bot\'s answers come from the stream m16:battle:<battleUuid> and are returned as `opponent`', async () => {
      setAccuracy(1)
      const uuid = await botBattle(a, s.math)
      const bot = botAnswers(uuid, 1)
      expect(botAnswers(uuid, 1)).toEqual(bot)
      expect(bot.every((x) => x.seconds >= 2 && x.seconds <= 12 && x.correct)).toBe(true)
      const results = await play(a, uuid, ten(1, 9))
      let running = 0
      results.forEach((r, i) => {
        running += bot[i]?.points ?? 0
        expect(r.opponent).toEqual({ answered: true, correct: true, score: running })
      })
      const stored = await rows<{ position: number; seconds: number; correct: boolean; points: number; is_bot: boolean }>(
        `select a.position, a.seconds, a.correct, a.points, p.is_bot from battle_answers a join battle_participants p on p.battle_id = a.battle_id and p.user_id = a.user_id where a.battle_id = $1 and p.is_bot order by a.position`,
        [uuid],
      )
      expect(stored.map((r) => [r.seconds, r.correct, r.points])).toEqual(bot.map((x) => [x.seconds, x.correct, x.points]))
      setAccuracy(0)
    })

    it('validation: questionId must be the caller\'s next question; optionId 0..3 or null; seconds 0..15 (field messages)', async () => {
      const uuid = await botBattle(a, s.math)
      const next = await questionOf(a, uuid)
      const [second] = await rows<{ question_id: string }>(`select question_id::text from battle_questions where battle_id = $1 and position = 2`, [uuid])
      const cases: [object, string, string][] = [
        [{ questionId: second?.question_id, optionId: 1, seconds: 1 }, 'questionId', 'Soalan tidak sah.'],
        [{ optionId: 1, seconds: 1 }, 'questionId', 'Soalan tidak sah.'],
        [{ questionId: Number(next), optionId: 1, seconds: 1 }, 'questionId', 'Soalan tidak sah.'],
        [{ questionId: '0', optionId: 1, seconds: 1 }, 'questionId', 'Soalan tidak sah.'],
        [{ questionId: next, optionId: 4, seconds: 1 }, 'optionId', 'Jawapan tidak sah.'],
        [{ questionId: next, optionId: -1, seconds: 1 }, 'optionId', 'Jawapan tidak sah.'],
        [{ questionId: next, optionId: '1', seconds: 1 }, 'optionId', 'Jawapan tidak sah.'],
        [{ questionId: next, optionId: 1.5, seconds: 1 }, 'optionId', 'Jawapan tidak sah.'],
        [{ questionId: next, optionId: 1, seconds: -1 }, 'seconds', 'Masa tidak sah.'],
        [{ questionId: next, optionId: 1, seconds: 15.01 }, 'seconds', 'Masa tidak sah.'],
        [{ questionId: next, optionId: 1, seconds: '3' }, 'seconds', 'Masa tidak sah.'],
        [{ questionId: next, optionId: 1 }, 'seconds', 'Masa tidak sah.'],
        [{ questionId: next, optionId: 1, seconds: null }, 'seconds', 'Masa tidak sah.'],
      ]
      for (const [body, field, message] of cases) {
        const res = await answer(a, uuid, body)
        expect(res.status, JSON.stringify(body)).toBe(422)
        const err = ErrorBodySchema.parse(res.body).error
        expect(err).toMatchObject({ code: 'VALIDATION_ERROR', message, fields: { [field]: message } })
      }
      expect((await rows(`select 1 from battle_answers where battle_id = $1 and user_id = $2`, [uuid, a.id])).length).toBe(0)
      // an array or text body is just an empty body
      const res = await a.who.agent.post(`/api/battle/arena/${uuid}/answer`).set('X-CSRF-Token', a.who.csrf).send([1, 2])
      expect(res.status).toBe(422)
    })

    it('forged scoring is impossible: extra fields are ignored and the server grades the option', async () => {
      const uuid = await botBattle(a, s.math)
      const res = await answer(a, uuid, { questionId: await questionOf(a, uuid), optionId: 0, seconds: 0, points: 1000, correct: true, correctOptionId: 0, score: 9999, userId: b.id, you: { score: 5000 }, opponent: { score: 0 } })
      expect(res.status).toBe(200)
      expect(parseData(BattleAnswerResultSchema, res)).toMatchObject({ correct: false, points: 0, correctOptionId: 1, you: { score: 0 } })
      const [p] = await rows<{ score: number }>(`select score from battle_participants where battle_id = $1 and side = 'A'`, [uuid])
      expect(p?.score).toBe(0)
      // another user's answers cannot be written either: b is not a player
      expect((await answer(b, uuid, { questionId: '1', optionId: 1, seconds: 0 })).status).toBe(404)
    })

    it('two concurrent identical answers give one success and one stored answer', async () => {
      const uuid = await botBattle(a, s.math)
      const body = { questionId: await questionOf(a, uuid), optionId: 1, seconds: 2 }
      const [r1, r2] = await Promise.all([answer(a, uuid, body), answer(a, uuid, body)])
      expect([r1.status, r2.status].sort()).toEqual([200, 422])
      const failed = r1.status === 200 ? r2 : r1
      expect(ErrorBodySchema.parse(failed.body).error.fields).toEqual({ questionId: 'Soalan tidak sah.' })
      expect((await rows<{ n: string }>(`select count(*)::text n from battle_answers where battle_id = $1 and user_id = $2`, [uuid, a.id]))[0]?.n).toBe('1')
      const [p] = await rows<{ score: number }>(`select score from battle_participants where battle_id = $1 and side = 'A'`, [uuid])
      expect(p?.score).toBe(battleArenaPoints(2))
    })

    it('after the battle ended an answer is 409 CONFLICT "Battle sudah tamat."', async () => {
      const uuid = await botBattle(a, s.math)
      await play(a, uuid, ten(1, 1))
      const res = await answer(a, uuid, { questionId: '1', optionId: 1, seconds: 1 })
      expect(res.status).toBe(409)
      expect(ErrorBodySchema.parse(res.body).error).toMatchObject({ code: 'CONFLICT', message: 'Battle sudah tamat.' })
    })

    it('no response of the arena flow carries the answer key before the question is answered', async () => {
      const uuid = await botBattle(a, s.math)
      for (let i = 0; i < 10; i++) {
        const v = await view(a, uuid)
        expect(leakedKeys(v.body), `view ${i}`).toEqual([])
        const res = await answer(a, uuid, { questionId: parseData(BattleArenaViewSchema, v).question?.id, optionId: 2, seconds: 4 })
        // the key of the question just answered is the only key allowed, at the top level; `next` and `result` carry none
        expect(leakedKeys(res.body.data.next ?? {})).toEqual([])
        expect(leakedKeys(res.body.data.result ?? {})).toEqual([])
        expect(Object.keys(res.body.data).sort()).toEqual(i < 9 ? ['correct', 'correctOptionId', 'next', 'opponent', 'points', 'you'] : ['correct', 'correctOptionId', 'opponent', 'points', 'result', 'you'])
      }
      expect(leakedKeys((await view(a, uuid)).body.data.result)).toEqual([])
    })

    it('a battle against another pupil (invitation): both sides play their own arena', async () => {
      await a.post('/battle/invite', { question_type: 'biasa', subject_id: s.math, receiver_id: b.id })
      const inv = (await b.get('/battle/invitations')).body.invitations[0].uuid as string
      const uuid = (await b.post(`/battle/invite/${inv}/accept`)).body.battle_uuid as string
      const bView = parseData(BattleArenaViewSchema, await view(b, uuid))
      expect(bView.you).toBe('B')
      expect(bView.players.A.name).toBe('Murid Demo')
      expect(bView.players.B.name).toBe('Murid Demo Kosong')
      const res = await answer(b, uuid, { questionId: bView.question?.id, optionId: 1, seconds: 0 })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(parseData(BattleAnswerResultSchema, res).points).toBe(1000)
      // a third pupil is not a player
      expect((await view(c, uuid)).status).toBe(404)
      expect((await rows<{ side: string; score: number }>(`select side, score from battle_participants where battle_id = $1 order by side`, [uuid]))[1]?.score).toBe(1000)
    })
  })

  describe('Mod Pelajar (is_test)', () => {
    it('a test battle plays the same and reports isTest', async () => {
      setAccuracy(0)
      const admin = await client(t, 'admin@demo.test', { modPelajar: true })
      const uuid = await botBattle(admin, s.math)
      const results = await play(admin, uuid, ten(1, 0))
      // a staff account has no grade, so the pool is every level: the seeded questions have other keys than B
      expect(results[9]?.result).toMatchObject({ winner: 'A', scoreB: 0 })
      expect(results[9]?.result?.scoreA).toBeGreaterThan(0)
      expect(t.reports.at(-1)).toMatchObject({ userId: admin.id, isTest: true })
      const [b2] = await rows<{ is_test: boolean }>(`select is_test from battles where id = $1`, [uuid])
      expect(b2?.is_test).toBe(true)
    })
  })

  it('rules constants match the contract', () => {
    expect(BATTLE_RULES.arenaQuestions).toBe(10)
  })
})
