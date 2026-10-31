import {
  GAMES_MESSAGES,
  GamesJutawanAnswerResponseSchema,
  GamesJutawanLifelineResponseSchema,
  GamesJutawanPageSchema,
  GamesJutawanStartResponseSchema,
} from '@pp/contract'
import type { Response } from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootGamesApp, expectCsrfInvalid, expectError, FakeRewards, idOf, insertMcqQuestions, loginAs, parseData, START, type Client, type GamesTestApp } from '../helpers'
import { expectKeyless, itemRows, type DbItem } from './support'

const M = GAMES_MESSAGES
const rewards = new FakeRewards()

describe('Jutawan Ilmu (M16-36 to M16-39)', () => {
  let t: GamesTestApp
  let student: Client
  let student2: Client
  let mathId: string
  let mathName: string

  beforeAll(async () => {
    t = await bootGamesApp({ ports: { rewards } })
    // 20 MATH questions at T4: five of each difficulty 1..4; five BI (fewer than the 15 a run needs)
    await insertMcqQuestions(t.db, { subject: 'MATH', level: 'T4', count: 20, prefix: 'J', difficultyTp: (i) => Math.floor(i / 5) + 1 })
    await insertMcqQuestions(t.db, { subject: 'BI', level: 'T4', count: 5, prefix: 'J' })
    mathId = await idOf(t.db, 'subjects', 'MATH')
    mathName = (await t.db.query<{ name: string }>(`select name from subjects where code = 'MATH'`))[0]?.name as string
    student = await loginAs(t, ACCOUNTS.student)
    student2 = await loginAs(t, ACCOUNTS.student2)
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(() => {
    rewards.calls.length = 0
    rewards.canEarn = true
    t.clock.set(START)
  })

  const startRun = async (c: Client, body: Record<string, unknown> = { subject: mathId, darjah: 10 }) => {
    const res = await c.post('/api/games/jutawan/start', body)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const data = parseData(res, GamesJutawanStartResponseSchema)
    return { res, data, sessionId: data.sessionId, items: await itemRows(t.db, data.sessionId) }
  }
  const answer = (c: Client, sessionId: string, item: DbItem, right: boolean) => {
    t.clock.advance(2000) // a human pace: the pacing guard wants 2 s per answered question
    return c.post(`/api/games/jutawan/${sessionId}/answer`, { questionId: item.question_id, optionId: right ? item.key_index : ((item.key_index as number) + 1) % 4 })
  }
  const sessionRow = async (id: string) =>
    (await t.db.query<{ jutawan_level: number; jutawan_lifelines: number; jutawan_removed_options: number[]; jutawan_over: boolean; score: number; coins_computed: number; coins_credited: number; submitted_at: Date | null; is_test: boolean; darjah: number; item_count: number }>(
      `select jutawan_level, jutawan_lifelines, jutawan_removed_options, jutawan_over, score, coins_computed, coins_credited, submitted_at, is_test, darjah, item_count from game_sessions where id = $1::uuid`,
      [id],
    ))[0]
  const statsOf = async (userId: string) => (await t.db.query<{ best_level: number; games: number; is_test: boolean }>(`select best_level, games, is_test from jutawan_stats where user_id = $1::bigint`, [userId]))[0]

  it('401 on every route, CSRF_INVALID on a write', async () => {
    const id = '3f2b8a6e-5c1d-4e7a-9b0f-1a2b3c4d5e6f'
    expectError(await t.http().get('/api/games/jutawan'), 'UNAUTHORIZED', M.unauthenticated)
    expectError(await t.http().post('/api/games/jutawan/start').send({}), 'UNAUTHORIZED', M.unauthenticated)
    expectError(await t.http().post(`/api/games/jutawan/${id}/answer`).send({}), 'UNAUTHORIZED', M.unauthenticated)
    expectError(await t.http().post(`/api/games/jutawan/${id}/lifeline`).send({}), 'UNAUTHORIZED', M.unauthenticated)
    expectCsrfInvalid(await student.noCsrf.post('/api/games/jutawan/start', { subject: mathId, darjah: 10 }))
    expectCsrfInvalid(await student.noCsrf.post(`/api/games/jutawan/${id}/answer`, {}))
    expectCsrfInvalid(await student.noCsrf.post(`/api/games/jutawan/${id}/lifeline`, { type: '50:50' }))
  })

  describe('page (M16-36)', () => {
    it('without darjah: bestLevel and games only', async () => {
      const page = parseData(await student2.get('/api/games/jutawan'), GamesJutawanPageSchema)
      expect(page).toEqual({ bestLevel: 0, games: 0 })
    })

    it('with darjah: heading and the subject tiles with their question counts', async () => {
      const page = parseData(await student.get('/api/games/jutawan?darjah=10'), GamesJutawanPageSchema)
      expect(page.heading).toBe('TINGKATAN 4')
      const math = page.subjects?.find((s) => s.id === mathId)
      expect(math).toMatchObject({ name: mathName, emoji: '🔢', colour: '#10b981' })
      expect(math?.count).toBeGreaterThanOrEqual(20)
      const bi = page.subjects?.find((s) => s.name !== mathName && s.count >= 5)
      expect(bi?.emoji).toBeTruthy()
      expect(parseData(await student.get('/api/games/jutawan?darjah=7'), GamesJutawanPageSchema).heading).toBe('TINGKATAN 1')
    })

    it('an invalid darjah is 422 "Tahap tidak sah." on fields.darjah', async () => {
      for (const bad of ['0', '12', 'x', '2.5']) {
        expect(expectError(await student.get(`/api/games/jutawan?darjah=${bad}`), 'VALIDATION_ERROR', M.level).fields).toEqual({ darjah: M.level })
      }
    })
  })

  describe('start (M16-37)', () => {
    it('refusals: darjah, subject, too few questions', async () => {
      expect(expectError(await student.post('/api/games/jutawan/start', { subject: mathId, darjah: 0 }), 'VALIDATION_ERROR', M.level).fields).toEqual({ darjah: M.level })
      expectError(await student.post('/api/games/jutawan/start', { subject: mathId }), 'VALIDATION_ERROR', M.level)
      expectError(await student.post('/api/games/jutawan/start', { subject: mathId, darjah: '10' }), 'VALIDATION_ERROR', M.level)
      for (const subject of [undefined, 'abc', '987654321', 3, '']) {
        expect(expectError(await student.post('/api/games/jutawan/start', { subject, darjah: 10 }), 'VALIDATION_ERROR', M.jutawanSubject).fields).toEqual({ subject: M.jutawanSubject })
      }
      const jawi = await idOf(t.db, 'subjects', 'JAWI')
      expectError(await student.post('/api/games/jutawan/start', { subject: jawi, darjah: 10 }), 'VALIDATION_ERROR', M.jutawanSubject)
      const bi = await idOf(t.db, 'subjects', 'BI')
      const few = expectError(await student.post('/api/games/jutawan/start', { subject: bi, darjah: 10 }), 'VALIDATION_ERROR', M.jutawanNotEnoughQuestions)
      expect(few.fields).toEqual({ subject: M.jutawanNotEnoughQuestions })
    })

    it('200 with question 1 keyless and 3 lifelines; 15 stored questions on the difficulty ladder', async () => {
      const { res, data, sessionId, items } = await startRun(student)
      expect(data).toMatchObject({ index: 1, lifelines: 3 })
      expect(data.question.id).toBe(items[0]?.question_id)
      expect(data.question.options.length).toBeGreaterThanOrEqual(2)
      expectKeyless(res.body)
      expect(items.map((i) => i.difficulty)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4])
      expect(new Set(items.map((i) => i.question_id)).size).toBe(15)
      expect(items.every((i) => i.key_index !== null)).toBe(true)
      expect(await sessionRow(sessionId)).toMatchObject({ jutawan_level: 0, jutawan_lifelines: 3, jutawan_removed_options: [], jutawan_over: false, is_test: false, darjah: 10, item_count: 15, submitted_at: null })
    })
  })

  describe('answer (M16-38)', () => {
    it('validation order and ownership: 404 session, 422 question, 422 option', async () => {
      const { sessionId, items } = await startRun(student)
      const url = `/api/games/jutawan/${sessionId}/answer`
      expect(expectError(await student.post(url, { questionId: items[3]?.question_id, optionId: 0 }), 'VALIDATION_ERROR', M.jutawanQuestionMismatch).fields).toEqual({ questionId: M.jutawanQuestionMismatch })
      expectError(await student.post(url, { optionId: 0 }), 'VALIDATION_ERROR', M.jutawanQuestionMismatch)
      for (const optionId of [7, -1, '1', 1.5, null]) {
        expect(expectError(await student.post(url, { questionId: items[0]?.question_id, optionId }), 'VALIDATION_ERROR', M.jutawanOption).fields).toEqual({ optionId: M.jutawanOption })
      }
      expectError(await student2.post(url, { questionId: items[0]?.question_id, optionId: 0 }), 'NOT_FOUND', M.jutawanSessionNotFound)
      expectError(await student.post('/api/games/jutawan/not-a-uuid/answer', { questionId: '1', optionId: 0 }), 'NOT_FOUND', M.jutawanSessionNotFound)
      expectError(await student.post('/api/games/jutawan/3f2b8a6e-5c1d-4e7a-9b0f-1a2b3c4d5e6f/answer', { questionId: '1', optionId: 0 }), 'NOT_FOUND', M.jutawanSessionNotFound)
      expect(await sessionRow(sessionId)).toMatchObject({ jutawan_level: 0, jutawan_over: false })
    })

    it('a right answer moves up one level with the next keyless question', async () => {
      const { sessionId, items } = await startRun(student)
      const res = await answer(student, sessionId, items[0] as DbItem, true)
      const out = parseData(res, GamesJutawanAnswerResponseSchema)
      expect(out.correct).toBe(true)
      expect(out.level).toBe(1)
      expect(out.result).toBeUndefined()
      expect(out.next?.id).toBe(items[1]?.question_id)
      expectKeyless(out.next)
      expect(await sessionRow(sessionId)).toMatchObject({ jutawan_level: 1 })
      // the answered question is not the current one any more
      expectError(await answer(student, sessionId, items[0] as DbItem, true), 'VALIDATION_ERROR', M.jutawanQuestionMismatch)
    })

    it('a wrong answer ends the run: result, stats, one reward report, then 409 "Permainan sudah tamat."', async () => {
      const before = (await statsOf(student.userId)) ?? { best_level: 0, games: 0 }
      const { sessionId, items } = await startRun(student)
      const out = parseData(await answer(student, sessionId, items[0] as DbItem, false), GamesJutawanAnswerResponseSchema)
      expect(out).toEqual({ correct: false, level: 0, result: { level: 0, credited: 0 } })
      expect(await sessionRow(sessionId)).toMatchObject({ jutawan_over: true, score: 0, coins_computed: 0 })
      expect((await sessionRow(sessionId))?.submitted_at).not.toBeNull()
      expect(await statsOf(student.userId)).toMatchObject({ best_level: before.best_level, games: before.games + 1 })
      expect(rewards.calls).toHaveLength(1)
      expect(rewards.calls[0]?.input).toEqual({ game: 'jutawan', event: 'finish', coins: 0, xp: 0, correct: 0, total: 15, detail: { level: 0, subject: mathName }, key: sessionId })
      expectError(await answer(student, sessionId, items[0] as DbItem, true), 'CONFLICT', M.jutawanOver)
      expectError(await student.post(`/api/games/jutawan/${sessionId}/lifeline`, { type: '50:50' }), 'CONFLICT', M.jutawanOver)
    })

    it('level 11 reached: 50 syiling through the port with the ledger detail; best level updated', async () => {
      const { sessionId, items } = await startRun(student)
      for (let i = 0; i < 11; i++) expect((await answer(student, sessionId, items[i] as DbItem, true)).status).toBe(200)
      const out = parseData(await answer(student, sessionId, items[11] as DbItem, false), GamesJutawanAnswerResponseSchema)
      expect(out).toEqual({ correct: false, level: 11, result: { level: 11, credited: 50 } })
      expect(rewards.calls[0]?.input).toMatchObject({ game: 'jutawan', event: 'finish', coins: 50, correct: 11, detail: { level: 11, subject: mathName }, key: sessionId })
      expect((await statsOf(student.userId))?.best_level).toBeGreaterThanOrEqual(11)
      expect(await sessionRow(sessionId)).toMatchObject({ score: 11, coins_computed: 50, coins_credited: 50 })
    })

    it('15 right answers: level 15 ends the game with 1000 syiling and no next question', async () => {
      const { sessionId, items } = await startRun(student2)
      let last: Response | undefined
      for (let i = 0; i < 15; i++) {
        last = await answer(student2, sessionId, items[i] as DbItem, true)
        expect(last.status, JSON.stringify(last.body)).toBe(200)
      }
      const out = parseData(last as Response, GamesJutawanAnswerResponseSchema)
      expect(out).toEqual({ correct: true, level: 15, result: { level: 15, credited: 1000 } })
      expect(rewards.calls).toHaveLength(1)
      expect(rewards.calls[0]?.input).toMatchObject({ coins: 1000, correct: 15, key: sessionId })
      expect(await statsOf(student2.userId)).toMatchObject({ best_level: 15, games: 1 })
      expect(await sessionRow(sessionId)).toMatchObject({ jutawan_level: 15, jutawan_over: true })
    })

    it('pacing guard: one answer less than 2 s after the previous one keeps the level but credits nothing', async () => {
      const { sessionId, items } = await startRun(student)
      for (let i = 0; i < 10; i++) {
        if (i === 4) {
          t.clock.advance(1999)
          const r = await student.post(`/api/games/jutawan/${sessionId}/answer`, { questionId: items[i]?.question_id, optionId: items[i]?.key_index })
          expect(r.status).toBe(200)
        } else expect((await answer(student, sessionId, items[i] as DbItem, true)).status).toBe(200)
      }
      const wrong = await answer(student, sessionId, items[10] as DbItem, false)
      expect(parseData(wrong, GamesJutawanAnswerResponseSchema).result).toEqual({ level: 10, credited: 0 })
      expect(rewards.calls).toHaveLength(0)
      expect(await sessionRow(sessionId)).toMatchObject({ score: 10, coins_computed: 50, coins_credited: 0, jutawan_over: true })
      expect((await statsOf(student.userId))?.best_level).toBeGreaterThanOrEqual(10)
    })

    it('no reward call when syiling cannot be earned', async () => {
      rewards.canEarn = false
      const { sessionId, items } = await startRun(student)
      for (let i = 0; i < 10; i++) await answer(student, sessionId, items[i] as DbItem, true)
      const out = parseData(await answer(student, sessionId, items[10] as DbItem, false), GamesJutawanAnswerResponseSchema)
      expect(out.result).toEqual({ level: 10, credited: 0 })
      expect(rewards.calls).toHaveLength(0)
      expect(await sessionRow(sessionId)).toMatchObject({ coins_computed: 50, coins_credited: 0 })
    })

    it('two concurrent answers to one question: the second sees the next question (422), never two levels', async () => {
      const { sessionId, items } = await startRun(student)
      const out = await Promise.all([answer(student, sessionId, items[0] as DbItem, true), answer(student, sessionId, items[0] as DbItem, true)])
      expect(out.map((r) => r.status).sort()).toEqual([200, 422])
      expect(await sessionRow(sessionId)).toMatchObject({ jutawan_level: 1 })
    })
  })

  describe('one open run per user', () => {
    it('a new start ends the earlier unfinished run ("Permainan sudah tamat."), the new one plays', async () => {
      const a = await startRun(student)
      const b = await startRun(student)
      expectError(await answer(student, a.sessionId, a.items[0] as DbItem, true), 'CONFLICT', M.jutawanOver)
      expectError(await student.post(`/api/games/jutawan/${a.sessionId}/lifeline`, { type: '50:50' }), 'CONFLICT', M.jutawanOver)
      expect(rewards.calls).toHaveLength(0)
      expect((await answer(student, b.sessionId, b.items[0] as DbItem, true)).status).toBe(200)
    })

    it('concurrent starts leave exactly one open run', async () => {
      const out = await Promise.all([1, 2, 3].map(() => student2.post('/api/games/jutawan/start', { subject: mathId, darjah: 10 })))
      expect(out.map((r) => r.status)).toEqual([200, 200, 200])
      const [row] = await t.db.query<{ n: string }>(`select count(*)::text as n from game_sessions where user_id = $1::bigint and game = 'jutawan' and jutawan_over = false and closed_at is null`, [student2.userId])
      expect(row?.n).toBe('1')
    })
  })

  describe('lifeline (M16-39)', () => {
    it('50:50 removes two wrong options, once per question, three in all', async () => {
      const { sessionId, items } = await startRun(student)
      const url = `/api/games/jutawan/${sessionId}/lifeline`
      expect(expectError(await student.post(url, { type: 'telefon' }), 'VALIDATION_ERROR', M.jutawanLifelineType).fields).toEqual({ type: M.jutawanLifelineType })
      expectError(await student.post(url, {}), 'VALIDATION_ERROR', M.jutawanLifelineType)
      expectError(await student2.post(url, { type: '50:50' }), 'NOT_FOUND', M.jutawanSessionNotFound)
      expectError(await student.post('/api/games/jutawan/xyz/lifeline', { type: '50:50' }), 'NOT_FOUND', M.jutawanSessionNotFound)

      for (let q = 0; q < 3; q++) {
        const res = await student.post(url, { type: '50:50' })
        const out = parseData(res, GamesJutawanLifelineResponseSchema)
        expect(out.lifelines).toBe(2 - q)
        expect(out.removedOptionIds).toHaveLength(2)
        expect(out.removedOptionIds).not.toContain(items[q]?.key_index)
        expect(new Set(out.removedOptionIds).size).toBe(2)
        expect((await sessionRow(sessionId))?.jutawan_removed_options).toEqual(out.removedOptionIds)
        // already used on this question
        expectError(await student.post(url, { type: '50:50' }), 'CONFLICT', M.jutawanNoLifeline)
        await answer(student, sessionId, items[q] as DbItem, true)
        expect((await sessionRow(sessionId))?.jutawan_removed_options).toEqual([])
      }
      // none left
      expectError(await student.post(url, { type: '50:50' }), 'CONFLICT', M.jutawanNoLifeline)
      expect(await sessionRow(sessionId)).toMatchObject({ jutawan_lifelines: 0, jutawan_level: 3 })
    })
  })

  describe('Mod Pelajar (is_test)', () => {
    it('rows are stamped is_test and the actor never earns', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin, { mod: true })
      const { sessionId, items } = await startRun(admin)
      for (let i = 0; i < 10; i++) await answer(admin, sessionId, items[i] as DbItem, true)
      const out = parseData(await answer(admin, sessionId, items[10] as DbItem, false), GamesJutawanAnswerResponseSchema)
      expect(out.result).toEqual({ level: 10, credited: 0 })
      expect(rewards.calls).toHaveLength(0)
      expect(await sessionRow(sessionId)).toMatchObject({ is_test: true, coins_computed: 50, coins_credited: 0 })
      expect(await statsOf(admin.userId)).toMatchObject({ is_test: true, best_level: 10, games: 1 })
    })
  })
})
