import {
  GAMES_MESSAGES,
  GAMES_SOLO_CHECK_RESULT_SCHEMAS,
  GamesBetulSalahPayloadSchema,
  GamesCabaranKilatPayloadSchema,
  GamesKadMemoriFaceSchema,
  GamesKadMemoriPayloadSchema,
  GamesRawMessageSchema,
  GamesSoloSubmitResponseSchema,
  GamesSusunJawapanPayloadSchema,
  GamesTembakJawapanPayloadSchema,
  type GamesSoloGame,
} from '@pp/contract'
import type { Response } from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  ACCOUNTS,
  bootGamesApp,
  expectCsrfInvalid,
  expectError,
  FakeRewards,
  insertMcqQuestions,
  loginAs,
  parseData,
  START,
  type Client,
  type GamesTestApp,
  type InsertedMcq,
} from '../helpers'
import { expectKeyless, itemRows, keyTextOf, shortenAnswers, type DbItem } from './support'

const M = GAMES_MESSAGES
const rewards = new FakeRewards()

describe('solo games (D58a: keyless payload, server-checked answers, server-computed submit)', () => {
  let t: GamesTestApp
  let student: Client
  let student2: Client
  let math: InsertedMcq[]

  beforeAll(async () => {
    t = await bootGamesApp({ ports: { rewards } })
    math = await insertMcqQuestions(t.db, { subject: 'MATH', level: 'T4', count: 60, prefix: 'S' })
    await shortenAnswers(t.db, math, 40)
    for (const level of ['D1', 'D2', 'D3', 'D4']) await insertMcqQuestions(t.db, { subject: 'BM', level, count: 6, prefix: 'K' })
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

  const sessionRow = async (id: string) =>
    (
      await t.db.query<{ score: number; coins_computed: number; coins_credited: number; submitted_at: Date | null; is_test: boolean; checks: number; correct_count: number; moves: number; item_count: number; max_score: number; darjah: number | null; is_new_record: boolean; open_card_id: string | null }>(
        `select score, coins_computed, coins_credited, submitted_at, is_test, checks, correct_count, moves, item_count, max_score, darjah, is_new_record, open_card_id from game_sessions where id = $1::uuid`,
        [id],
      )
    )[0]

  /** Starts a question game and returns the session id and the server rows (oracle). */
  async function open(c: Client, game: GamesSoloGame, query = ''): Promise<{ sessionId: string; rows: DbItem[]; res: Response }> {
    const res = await c.get(`/api/games/solo/${game}${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const sessionId = (res.body as { data: { sessionId: string } }).data.sessionId
    return { sessionId, rows: await itemRows(t.db, sessionId), res }
  }

  /**
   * Betul/Salah oracle: a true statement is "<question> → <key option text>", a false one shows a wrong option text.
   * AZ-25: the draw is by level only, so an item may be any servable MCQ of the level (the base seed has three at T4),
   * not only one of `math`; the served question is read from the database by the item's question id.
   */
  async function expectStatementOracle(statement: string | undefined, item: DbItem): Promise<void> {
    const [served] = await t.db.query<{ stem: string; key: string }>(
      `select coalesce(nullif(btrim(v.stem_ms), ''), p.prompt_ms) as stem, o.body_ms as key
         from questions q
         join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
         join question_parts p on p.question_version_id = v.id
         join part_options o on o.part_id = p.id
        where q.id = $1::bigint and o.label = $2`,
      [item.question_id, 'ABCD'[item.key_index as number]],
    )
    expect(served, `question ${item.question_id}`).toBeDefined()
    expect(statement === `${served?.stem} → ${served?.key}`).toBe(item.statement_true)
  }

  /** Posts the check of item `i` answered correctly (`right`) or wrongly. */
  async function answerItem(c: Client, game: Exclude<GamesSoloGame, 'kad-memori'>, sessionId: string, item: DbItem, right: boolean): Promise<Response> {
    const base = { session_id: sessionId, item_id: item.question_id }
    switch (game) {
      case 'betul-salah':
        return c.post(`/api/games/solo/${game}/check`, { ...base, answer: right ? item.statement_true : !item.statement_true })
      case 'cabaran-kilat':
        return c.post(`/api/games/solo/${game}/check`, { ...base, option_id: right ? item.key_index : ((item.key_index as number) + 1) % 4 })
      case 'tembak-jawapan':
        return c.post(`/api/games/solo/${game}/check`, { ...base, option_index: right ? item.key_index : ((item.key_index as number) + 1) % 4 })
      case 'susun-jawapan':
        return c.post(`/api/games/solo/${game}/check`, { ...base, answer: right ? (await keyTextOf(t.db, item.question_id, item.key_index as number)).toLowerCase() : 'zzz' })
    }
  }

  describe('guards', () => {
    it('401 on every route without a session', async () => {
      const id = '3f2b8a6e-5c1d-4e7a-9b0f-1a2b3c4d5e6f'
      expectError(await t.http().get('/api/games/solo/betul-salah'), 'UNAUTHORIZED', M.unauthenticated)
      expectError(await t.http().post('/api/games/solo/betul-salah/check').send({ session_id: id }), 'UNAUTHORIZED', M.unauthenticated)
      expectError(await t.http().post('/api/games/solo/kad-memori/reveal').send({ session_id: id, card_id: 'a' }), 'UNAUTHORIZED', M.unauthenticated)
      expectError(await t.http().post('/api/games/solo/betul-salah/submit').send({ session_id: id }), 'UNAUTHORIZED', M.unauthenticated)
    })

    it('CSRF_INVALID on a write without the token', async () => {
      const { sessionId } = await open(student, 'betul-salah')
      expectCsrfInvalid(await student.noCsrf.post('/api/games/solo/betul-salah/check', { session_id: sessionId, item_id: '1', answer: true }))
      expectCsrfInvalid(await student.noCsrf.post('/api/games/solo/kad-memori/reveal', { session_id: sessionId, card_id: 'a' }))
      expectCsrfInvalid(await student.noCsrf.post('/api/games/solo/betul-salah/submit', { session_id: sessionId }))
    })
  })

  describe('GET /games/solo/:game (M16-32)', () => {
    it('unknown game is 404 "Permainan tidak dijumpai."', async () => {
      expectError(await student.get('/api/games/solo/tidak-ada'), 'NOT_FOUND', M.gameNotFound)
    })

    it('darjah outside 1..11 is 422 "Tahap tidak sah." on fields.darjah; kad-memori ignores darjah', async () => {
      for (const bad of ['0', '12', 'abc', '4.5']) {
        const e = expectError(await student.get(`/api/games/solo/betul-salah?darjah=${bad}`), 'VALIDATION_ERROR', M.level)
        expect(e.fields).toEqual({ darjah: M.level })
      }
      expect((await student.get('/api/games/solo/kad-memori?darjah=99')).status).toBe(200)
    })

    it('Betul/Salah: 40 keyless statements, a session row and the server-only facts', async () => {
      const { sessionId, rows, res } = await open(student, 'betul-salah')
      const payload = parseData(res, GamesBetulSalahPayloadSchema)
      expect(payload.statements).toHaveLength(40)
      expect(payload).toMatchObject({ personalBest: 0, canEarnSyiling: true })
      expectKeyless(res.body)
      expect(rows).toHaveLength(40)
      expect(rows.map((r) => r.question_id)).toEqual(payload.statements.map((s) => s.id))
      expect(rows.every((r) => r.key_index !== null && r.statement_true !== null && r.checked_seq === null)).toBe(true)
      expect(await sessionRow(sessionId)).toMatchObject({ item_count: 40, is_test: false, darjah: 10, submitted_at: null, checks: 0 })
      // the statement of a true item is "<question> → <key option text>", a false one shows a wrong option text
      await expectStatementOracle(payload.statements[0]?.statement, rows[0] as DbItem)
    })

    it('Betul/Salah oracle holds for a question that is not one of this spec\'s (AZ-25 regression: base seed T4 MCQs)', async () => {
      // With every inserted MATH question inactive, the T4 draw can serve only the base seed's T4 MCQs: the item the old
      // oracle looked up in `math` (about 5% of runs) is now the only kind there is.
      const ids = math.map((m) => m.id)
      await t.db.query(`update questions set is_active = false where id = any($1::bigint[])`, [ids])
      try {
        const { rows, res } = await open(student, 'betul-salah')
        const payload = parseData(res, GamesBetulSalahPayloadSchema)
        expect(payload.statements.length).toBeGreaterThan(0)
        expect(rows.every((r) => !ids.includes(r.question_id))).toBe(true)
        for (const [i, r] of rows.entries()) await expectStatementOracle(payload.statements[i]?.statement, r)
      } finally {
        await t.db.query(`update questions set is_active = true where id = any($1::bigint[])`, [ids])
      }
    })

    it('the darjah query selects the level of the questions', async () => {
      const { sessionId, res } = await open(student, 'cabaran-kilat', '?darjah=4')
      const payload = parseData(res, GamesCabaranKilatPayloadSchema)
      expect(payload.questions.length).toBeGreaterThan(0)
      expect((await sessionRow(sessionId))?.darjah).toBe(4)
      for (const q of payload.questions) expect(math.some((m) => m.id === q.id)).toBe(false) // T4 questions are not served at D4
    })

    it('Cabaran Kilat / Tembak Jawapan: 30 keyless questions with four options', async () => {
      const a = await open(student, 'cabaran-kilat')
      const ck = parseData(a.res, GamesCabaranKilatPayloadSchema)
      expect(ck.questions).toHaveLength(30)
      expect(ck.questions.every((q) => q.options.length === 4 && q.options.map((o) => o.id).join() === '0,1,2,3')).toBe(true)
      expectKeyless(a.res.body)
      const b = await open(student, 'tembak-jawapan')
      const tj = parseData(b.res, GamesTembakJawapanPayloadSchema)
      expect(tj.questions).toHaveLength(30)
      expect(tj.questions.every((q) => q.options.length === 4)).toBe(true)
      expectKeyless(b.res.body)
    })

    it('Susun Jawapan: 20 puzzles, scrambled tiles, answer never in the payload, max_score = sum of the points', async () => {
      const { sessionId, rows, res } = await open(student, 'susun-jawapan')
      const payload = parseData(res, GamesSusunJawapanPayloadSchema)
      expect(payload.puzzles).toHaveLength(20)
      expectKeyless(res.body)
      let total = 0
      for (const [i, p] of payload.puzzles.entries()) {
        const answer = await keyTextOf(t.db, p.id, rows[i]?.key_index as number)
        const original = p.type === 'letters' ? [...answer] : answer.split(' ')
        expect(p.type).toBe(answer.includes(' ') ? 'words' : 'letters')
        expect([...p.scrambled].sort()).toEqual([...original].sort())
        if (new Set(original).size > 1) expect(p.scrambled.join('|')).not.toBe(original.join('|'))
        expect(p.points).toBe(rows[i]?.points)
        total += p.points
      }
      expect((await sessionRow(sessionId))?.max_score).toBe(total)
    })

    it('Kad Memori: 12 opaque card ids, no face, no pair, 6 pairs stored server side', async () => {
      const { sessionId, rows, res } = await open(student, 'kad-memori')
      const payload = parseData(res, GamesKadMemoriPayloadSchema)
      expect(Object.keys(payload).sort()).toEqual(['canEarnSyiling', 'cards', 'count', 'layout', 'personalBest', 'sessionId'])
      expect(payload.cards).toHaveLength(12)
      expect(new Set(payload.cards.map((c) => c.id)).size).toBe(12)
      expect(payload.cards.every((c) => Object.keys(c).join() === 'id' && !/^\d+$/.test(c.id))).toBe(true)
      expectKeyless(res.body)
      expect(rows.map((r) => r.card_id)).toEqual(payload.cards.map((c) => c.id))
      for (let p = 0; p < 6; p++) {
        const pair = rows.filter((r) => r.pair_key === p)
        expect(pair.map((r) => r.face).sort()).toEqual(['answer', 'question'])
        expect(pair[0]?.question_id).toBe(pair[1]?.question_id)
      }
      expect((await sessionRow(sessionId))?.item_count).toBe(6)
    })
  })

  describe('check (D58a)', () => {
    it('Betul/Salah: result carries the key only now, parsed by its contract schema, no-store, one check per item', async () => {
      const { sessionId, rows } = await open(student, 'betul-salah')
      const item = rows[0] as DbItem
      const res = await answerItem(student, 'betul-salah', sessionId, item, true)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(parseData(res, GAMES_SOLO_CHECK_RESULT_SCHEMAS['betul-salah'])).toEqual({ correct: true, is_true: item.statement_true })
      // key probing is blocked: a second check of the same item (even with the other answer) is refused
      const again = await answerItem(student, 'betul-salah', sessionId, item, false)
      expectError(again, 'CONFLICT', M.soloAlreadyChecked)
      const stored = (await itemRows(t.db, sessionId))[0] as DbItem
      expect(stored).toMatchObject({ checked_seq: 1, correct: true })
      expect(await sessionRow(sessionId)).toMatchObject({ checks: 1, correct_count: 1 })
    })

    it('Cabaran Kilat and Tembak Jawapan return correct and the correct option', async () => {
      const a = await open(student, 'cabaran-kilat')
      const ra = await answerItem(student, 'cabaran-kilat', a.sessionId, a.rows[0] as DbItem, false)
      expect(parseData(ra, GAMES_SOLO_CHECK_RESULT_SCHEMAS['cabaran-kilat'])).toEqual({ correct: false, correct_option_id: a.rows[0]?.key_index })
      const b = await open(student, 'tembak-jawapan')
      const rb = await answerItem(student, 'tembak-jawapan', b.sessionId, b.rows[0] as DbItem, true)
      expect(parseData(rb, GAMES_SOLO_CHECK_RESULT_SCHEMAS['tembak-jawapan'])).toEqual({ correct: true, correct_option_index: b.rows[0]?.key_index })
    })

    it('Susun Jawapan compares trimmed and case-insensitive and returns the answer', async () => {
      const { sessionId, rows } = await open(student, 'susun-jawapan')
      const first = rows[0] as DbItem
      const answer = await keyTextOf(t.db, first.question_id, first.key_index as number)
      const ok = await student.post('/api/games/solo/susun-jawapan/check', { session_id: sessionId, item_id: first.question_id, answer: `  ${answer.toLowerCase()} ` })
      expect(parseData(ok, GAMES_SOLO_CHECK_RESULT_SCHEMAS['susun-jawapan'])).toEqual({ correct: true, answer })
      const second = rows[1] as DbItem
      const bad = await answerItem(student, 'susun-jawapan', sessionId, second, false)
      expect(parseData(bad, GAMES_SOLO_CHECK_RESULT_SCHEMAS['susun-jawapan'])).toEqual({ correct: false, answer: await keyTextOf(t.db, second.question_id, second.key_index as number) })
    })

    it('validation: a body of another game, a missing value and an item outside the session', async () => {
      const { sessionId, rows } = await open(student, 'betul-salah')
      const item = rows[0] as DbItem
      const wrongBody = await student.post('/api/games/solo/betul-salah/check', { session_id: sessionId, item_id: item.question_id, option_id: 1 })
      const e = expectError(wrongBody, 'VALIDATION_ERROR', M.actionValue)
      expect(e.fields).toEqual({ answer: M.actionValue })
      expectError(await student.post('/api/games/solo/betul-salah/check', { session_id: sessionId, item_id: item.question_id, answer: 'true' }), 'VALIDATION_ERROR', M.actionValue)
      expectError(await student.post('/api/games/solo/betul-salah/check', { session_id: sessionId, answer: true }), 'VALIDATION_ERROR', M.actionValue)
      expectError(await student.post('/api/games/solo/betul-salah/check', { session_id: sessionId, item_id: '987654321', answer: true }), 'NOT_FOUND', M.soloItemNotFound)
      expect((await sessionRow(sessionId))?.checks).toBe(0)
    })

    it('unknown game, malformed or unknown session, and a session of another game are 404', async () => {
      const { sessionId, rows } = await open(student, 'betul-salah')
      const item = rows[0] as DbItem
      expectError(await student.post('/api/games/solo/tidak-ada/check', { session_id: sessionId }), 'NOT_FOUND', M.gameNotFound)
      for (const bad of ['abc', '', 42, null, '3f2b8a6e-5c1d-4e7a-9b0f-1a2b3c4d5e6f']) {
        expectError(await student.post('/api/games/solo/betul-salah/check', { session_id: bad, item_id: item.question_id, answer: true }), 'NOT_FOUND', M.soloSessionNotFound)
      }
      expectError(await student.post('/api/games/solo/betul-salah/check', {}), 'NOT_FOUND', M.soloSessionNotFound)
      expectError(await student.post('/api/games/solo/cabaran-kilat/check', { session_id: sessionId, item_id: item.question_id, option_id: 0 }), 'NOT_FOUND', M.soloSessionNotFound)
    })

    it('ownership: another student cannot check, reveal or submit a session (404 / raw 422), and nothing changes', async () => {
      const { sessionId, rows } = await open(student, 'betul-salah')
      const item = rows[0] as DbItem
      expectError(await answerItem(student2, 'betul-salah', sessionId, item, true), 'NOT_FOUND', M.soloSessionNotFound)
      const kad = await open(student, 'kad-memori')
      expectError(await student2.post('/api/games/solo/kad-memori/reveal', { session_id: kad.sessionId, card_id: kad.rows[0]?.card_id }), 'NOT_FOUND', M.soloSessionNotFound)
      const submit = await student2.post('/api/games/solo/betul-salah/submit', { session_id: sessionId })
      expect(submit.status).toBe(422)
      expect(GamesRawMessageSchema.parse(submit.body)).toEqual({ message: M.soloInvalidResult })
      expect(await sessionRow(sessionId)).toMatchObject({ checks: 0, submitted_at: null })
      expect((await sessionRow(kad.sessionId))?.open_card_id).toBeNull()
    })

    it('no check after submit (409 "Keputusan sudah dihantar.")', async () => {
      const { sessionId, rows } = await open(student, 'cabaran-kilat')
      await answerItem(student, 'cabaran-kilat', sessionId, rows[0] as DbItem, true)
      expect((await student.post('/api/games/solo/cabaran-kilat/submit', { session_id: sessionId })).status).toBe(200)
      expectError(await answerItem(student, 'cabaran-kilat', sessionId, rows[1] as DbItem, true), 'CONFLICT', M.soloAlreadySubmitted)
    })

    it('two concurrent checks of one item: exactly one is stored', async () => {
      const { sessionId, rows } = await open(student, 'tembak-jawapan')
      const item = rows[0] as DbItem
      const out = await Promise.all([answerItem(student, 'tembak-jawapan', sessionId, item, true), answerItem(student, 'tembak-jawapan', sessionId, item, false)])
      expect(out.map((r) => r.status).sort()).toEqual([200, 409])
      expect(await sessionRow(sessionId)).toMatchObject({ checks: 1 })
    })
  })

  describe('submit (M16-33, raw)', () => {
    const play = async (c: Client, game: Exclude<GamesSoloGame, 'kad-memori'>, flags: string, query = '') => {
      const { sessionId, rows } = await open(c, game, query)
      for (const [i, f] of flags.split('').entries()) {
        t.clock.advance(1000) // a human pace: the pacing guard wants 1 s between checks
        const res = await answerItem(c, game, sessionId, rows[i] as DbItem, f === 'T')
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        expect((res.body as { data: { correct: boolean } }).data.correct).toBe(f === 'T')
      }
      return { sessionId, rows }
    }

    it('Betul/Salah: the server computes score, coins, counts; forged client fields are ignored', async () => {
      const { sessionId } = await play(student, 'betul-salah', 'TTTFTT')
      const res = await student.post('/api/games/solo/betul-salah/submit', {
        session_id: sessionId,
        score: 99_999,
        syiling_earned: 99_999,
        correct_count: 40,
        total_answered: 40,
        streak: 40,
      })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toBeUndefined()
      expect(GamesSoloSubmitResponseSchema.parse(res.body)).toEqual({ is_new_record: true, syiling_awarded: 9, score: 68, correct_count: 5, total_answered: 6 })
      expect(await sessionRow(sessionId)).toMatchObject({ score: 68, coins_computed: 9, coins_credited: 9, correct_count: 5, checks: 6, is_new_record: true, is_test: false })
      expect((await sessionRow(sessionId))?.submitted_at).not.toBeNull()
      expect(rewards.calls).toHaveLength(1)
      expect(rewards.calls[0]).toMatchObject({
        userId: student.userId,
        isTest: false,
        input: { game: 'betul_salah', event: 'finish', coins: 9, xp: 0, correct: 5, total: 6, detail: { maxStreak: 3 }, key: sessionId },
      })
      // the next session reports the personal best
      const next = await student.get('/api/games/solo/betul-salah')
      expect(parseData(next, GamesBetulSalahPayloadSchema).personalBest).toBe(68)
    })

    it('Cabaran Kilat: 10 x combo, coins = combo', async () => {
      const { sessionId } = await play(student, 'cabaran-kilat', 'TTTFT')
      const res = await student.post('/api/games/solo/cabaran-kilat/submit', { session_id: sessionId, max_combo: 99, score: 1e6 })
      expect(GamesSoloSubmitResponseSchema.parse(res.body)).toMatchObject({ score: 70, syiling_awarded: 7, correct_count: 4, total_answered: 5 })
      expect(rewards.calls[0]?.input).toMatchObject({ game: 'cabaran_kilat', coins: 7, detail: { maxCombo: 3 } })
    })

    it('Tembak Jawapan: 10 x level, level +1 every 5 correct', async () => {
      const { sessionId } = await play(student, 'tembak-jawapan', 'TTTTTFT')
      const res = await student.post('/api/games/solo/tembak-jawapan/submit', { session_id: sessionId, max_level: 40 })
      expect(GamesSoloSubmitResponseSchema.parse(res.body)).toMatchObject({ score: 70, syiling_awarded: 7, correct_count: 6, total_answered: 7 })
      expect(rewards.calls[0]?.input).toMatchObject({ game: 'tembak_jawapan', coins: 7, detail: { level: 2 } })
    })

    it('Susun Jawapan: the points of the solved puzzles, coins ceil(points / 3)', async () => {
      const { sessionId, rows } = await play(student, 'susun-jawapan', 'TFT')
      const points = (rows[0]?.points as number) + (rows[2]?.points as number)
      const res = await student.post('/api/games/solo/susun-jawapan/submit', { session_id: sessionId })
      expect(GamesSoloSubmitResponseSchema.parse(res.body)).toEqual({
        is_new_record: true,
        syiling_awarded: Math.ceil((rows[0]?.points as number) / 3) + Math.ceil((rows[2]?.points as number) / 3),
        score: points,
        correct_count: 2,
        total_answered: 3,
      })
    })

    it('a second submit is 409 raw "Keputusan sudah dihantar."; two concurrent submits: exactly one succeeds and one reward report', async () => {
      const { sessionId } = await play(student, 'betul-salah', 'TT')
      const out = await Promise.all([student.post('/api/games/solo/betul-salah/submit', { session_id: sessionId }), student.post('/api/games/solo/betul-salah/submit', { session_id: sessionId })])
      expect(out.map((r) => r.status).sort()).toEqual([200, 409])
      const refused = out.find((r) => r.status === 409) as Response
      expect(GamesRawMessageSchema.parse(refused.body)).toEqual({ message: M.soloAlreadySubmitted })
      expect(rewards.calls).toHaveLength(1)
      const again = await student.post('/api/games/solo/betul-salah/submit', { session_id: sessionId })
      expect(again.status).toBe(409)
      expect(GamesRawMessageSchema.parse(again.body)).toEqual({ message: M.soloAlreadySubmitted })
    })

    it('raw refusals: no check yet, malformed / missing session, another game, unknown game', async () => {
      const { sessionId } = await open(student, 'betul-salah')
      for (const body of [{ session_id: sessionId }, { session_id: 'abc' }, {}, { session_id: 7 }]) {
        const res = await student.post('/api/games/solo/betul-salah/submit', body)
        expect(res.status).toBe(422)
        expect(GamesRawMessageSchema.parse(res.body)).toEqual({ message: M.soloInvalidResult })
      }
      const other = await student.post('/api/games/solo/cabaran-kilat/submit', { session_id: sessionId })
      expect(other.status).toBe(422)
      const unknown = await student.post('/api/games/solo/tidak-ada/submit', { session_id: sessionId })
      expect(unknown.status).toBe(404)
      expect(GamesRawMessageSchema.parse(unknown.body)).toEqual({ message: M.gameNotFound })
      expect((await sessionRow(sessionId))?.submitted_at).toBeNull()
    })

    it('personal best: the first result is a record even with score 0; later ones only when they beat it', async () => {
      const first = await play(student2, 'betul-salah', 'F')
      const r1 = GamesSoloSubmitResponseSchema.parse((await student2.post('/api/games/solo/betul-salah/submit', { session_id: first.sessionId })).body)
      expect(r1).toMatchObject({ is_new_record: true, score: 0, syiling_awarded: 0, correct_count: 0, total_answered: 1 })
      const lower = await play(student2, 'betul-salah', 'T')
      expect(GamesSoloSubmitResponseSchema.parse((await student2.post('/api/games/solo/betul-salah/submit', { session_id: lower.sessionId })).body)).toMatchObject({ is_new_record: true, score: 12 })
      const same = await play(student2, 'betul-salah', 'T')
      expect(GamesSoloSubmitResponseSchema.parse((await student2.post('/api/games/solo/betul-salah/submit', { session_id: same.sessionId })).body)).toMatchObject({ is_new_record: false, score: 12 })
      const higher = await play(student2, 'betul-salah', 'TT')
      expect(GamesSoloSubmitResponseSchema.parse((await student2.post('/api/games/solo/betul-salah/submit', { session_id: higher.sessionId })).body)).toMatchObject({ is_new_record: true, score: 26 })
      const [best] = await t.db.query<{ best_score: number }>(`select best_score from personal_bests where user_id = $1::bigint and game = 'betul-salah'`, [student2.userId])
      expect(best?.best_score).toBe(26)
    })

    it('pacing guard: one check less than 1 s after the previous one in an otherwise paced run earns nothing and is no record', async () => {
      const fast = await open(student2, 'cabaran-kilat')
      for (const [i, gap] of [1000, 999, 1000].entries()) {
        t.clock.advance(gap)
        await answerItem(student2, 'cabaran-kilat', fast.sessionId, fast.rows[i] as DbItem, true)
      }
      t.clock.advance(60_000)
      const res = await student2.post('/api/games/solo/cabaran-kilat/submit', { session_id: fast.sessionId })
      expect(GamesSoloSubmitResponseSchema.parse(res.body)).toEqual({ is_new_record: false, syiling_awarded: 0, score: 60, correct_count: 3, total_answered: 3 })
      expect(rewards.calls).toHaveLength(0)
      expect(await sessionRow(fast.sessionId)).toMatchObject({ score: 60, coins_computed: 6, coins_credited: 0, is_new_record: false })
      const [none] = await t.db.query<{ n: string }>(`select count(*)::text as n from personal_bests where user_id = $1::bigint and game = 'cabaran-kilat'`, [student2.userId])
      expect(none?.n).toBe('0')

      // a fast FIRST check (from the session creation) counts as well
      const first = await open(student2, 'cabaran-kilat')
      await answerItem(student2, 'cabaran-kilat', first.sessionId, first.rows[0] as DbItem, true)
      t.clock.advance(60_000)
      expect(GamesSoloSubmitResponseSchema.parse((await student2.post('/api/games/solo/cabaran-kilat/submit', { session_id: first.sessionId })).body)).toMatchObject({ syiling_awarded: 0 })
      expect(rewards.calls).toHaveLength(0)

      const paced = await open(student2, 'cabaran-kilat')
      for (const [i, gap] of [1000, 1000, 1000].entries()) {
        t.clock.advance(gap)
        await answerItem(student2, 'cabaran-kilat', paced.sessionId, paced.rows[i] as DbItem, true)
      }
      const ok = await student2.post('/api/games/solo/cabaran-kilat/submit', { session_id: paced.sessionId })
      expect(GamesSoloSubmitResponseSchema.parse(ok.body)).toMatchObject({ is_new_record: true, syiling_awarded: 6, score: 60 })
      expect(rewards.calls).toHaveLength(1)
    })

    it('rewards are reported only when syiling can be earned; the score is still computed', async () => {
      rewards.canEarn = false
      const { sessionId } = await play(student, 'cabaran-kilat', 'TT')
      const res = GamesSoloSubmitResponseSchema.parse((await student.post('/api/games/solo/cabaran-kilat/submit', { session_id: sessionId })).body)
      expect(res).toMatchObject({ score: 30, syiling_awarded: 0 })
      expect(rewards.calls).toHaveLength(0)
      expect(await sessionRow(sessionId)).toMatchObject({ coins_computed: 3, coins_credited: 0 })
      const page = await student.get('/api/games/solo/betul-salah')
      expect(parseData(page, GamesBetulSalahPayloadSchema).canEarnSyiling).toBe(false)
    })
  })

  describe('Kad Memori (reveal, pair checks, submit)', () => {
    it('plays a full board: reveal, mismatch, match, refusals, submit with server-side moves and time', async () => {
      const { sessionId, rows } = await open(student, 'kad-memori')
      const pairs = Array.from({ length: 6 }, (_, p) => ({
        q: rows.find((r) => r.pair_key === p && r.face === 'question') as DbItem,
        a: rows.find((r) => r.pair_key === p && r.face === 'answer') as DbItem,
      }))
      const check = (card: DbItem, other: DbItem) => (t.clock.advance(1000), student.post('/api/games/solo/kad-memori/check', { session_id: sessionId, card_id: card.card_id, other_card_id: other.card_id }))
      const submit = () => student.post('/api/games/solo/kad-memori/submit', { session_id: sessionId })

      // nothing matched yet: refused, raw
      expect((await submit()).status).toBe(422)

      // reveal the first card of a move
      const rev = await student.post('/api/games/solo/kad-memori/reveal', { session_id: sessionId, card_id: pairs[0]?.q.card_id })
      expect(rev.headers['cache-control']).toBe('no-store')
      const face = parseData(rev, GamesKadMemoriFaceSchema)
      expect(face).toMatchObject({ id: pairs[0]?.q.card_id, type: 'question' })
      expect(face.content).toContain('Soalan permainan contoh')
      expect((await sessionRow(sessionId))?.open_card_id).toBe(pairs[0]?.q.card_id)

      // one open card at a time; the open card is closed only by a check that names it
      expectError(await student.post('/api/games/solo/kad-memori/reveal', { session_id: sessionId, card_id: pairs[1]?.q.card_id }), 'CONFLICT', M.soloCardOpen)
      expectError(await check(pairs[1]?.q as DbItem, pairs[2]?.a as DbItem), 'CONFLICT', M.soloCardOpen)

      // mismatch: both faces, no pair id; the open card is closed
      const miss = await check(pairs[0]?.q as DbItem, pairs[1]?.a as DbItem)
      const missData = parseData(miss, GAMES_SOLO_CHECK_RESULT_SCHEMAS['kad-memori'])
      expect(missData.correct).toBe(false)
      expect(missData.pair_id).toBeNull()
      expect(missData.cards.map((c) => c.id)).toEqual([pairs[0]?.q.card_id, pairs[1]?.a.card_id])
      expect(missData.cards.map((c) => c.type)).toEqual(['question', 'answer'])
      expect(miss.headers['cache-control']).toBe('no-store')
      expect(await sessionRow(sessionId)).toMatchObject({ moves: 1, open_card_id: null })

      // a mismatch may be repeated; same card twice is a 422
      expect(parseData(await check(pairs[0]?.q as DbItem, pairs[1]?.a as DbItem), GAMES_SOLO_CHECK_RESULT_SCHEMAS['kad-memori']).correct).toBe(false)
      const same = await student.post('/api/games/solo/kad-memori/check', { session_id: sessionId, card_id: pairs[0]?.q.card_id, other_card_id: pairs[0]?.q.card_id })
      expect(expectError(same, 'VALIDATION_ERROR', M.actionValue).fields).toEqual({ other_card_id: M.actionValue })
      expectError(await student.post('/api/games/solo/kad-memori/check', { session_id: sessionId, card_id: 'zzzzzzzz', other_card_id: pairs[0]?.a.card_id }), 'NOT_FOUND', M.soloItemNotFound)

      // match
      const hit = parseData(await check(pairs[0]?.q as DbItem, pairs[0]?.a as DbItem), GAMES_SOLO_CHECK_RESULT_SCHEMAS['kad-memori'])
      expect(hit).toMatchObject({ correct: true, pair_id: 0 })
      expect(hit.cards[0]?.content).not.toBe(hit.cards[1]?.content)
      expectError(await check(pairs[0]?.q as DbItem, pairs[2]?.q as DbItem), 'CONFLICT', M.soloCardMatched)
      expectError(await student.post('/api/games/solo/kad-memori/reveal', { session_id: sessionId, card_id: pairs[0]?.a.card_id }), 'CONFLICT', M.soloCardMatched)
      expect((await submit()).status).toBe(422)

      for (let p = 1; p < 6; p++) {
        const r = parseData(await check(pairs[p]?.q as DbItem, pairs[p]?.a as DbItem), GAMES_SOLO_CHECK_RESULT_SCHEMAS['kad-memori'])
        expect(r).toMatchObject({ correct: true, pair_id: pairs[p]?.q.pair_key })
        if (p < 5) expect((await submit()).status).toBe(422)
      }
      expect(await sessionRow(sessionId)).toMatchObject({ moves: 8, correct_count: 6, checks: 8 })

      t.clock.advance(90_000)
      const res = await submit()
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(GamesSoloSubmitResponseSchema.parse(res.body)).toEqual({ results: { syiling_earned: 6, accuracy: 75, moves: 8, time_seconds: 100 } })
      expect(rewards.calls).toHaveLength(1)
      expect(rewards.calls[0]?.input).toMatchObject({ game: 'kad_memori', event: 'finish', coins: 6, correct: 6, total: 6, key: sessionId })
      expect(await sessionRow(sessionId)).toMatchObject({ coins_computed: 6, coins_credited: 6 })
      expect((await submit()).status).toBe(409)
      expectError(await student.post('/api/games/solo/kad-memori/reveal', { session_id: sessionId, card_id: pairs[0]?.q.card_id }), 'CONFLICT', M.soloAlreadySubmitted)
    })
  })

  describe('one open session per user and game', () => {
    const openCount = async (userId: string, game: string) =>
      Number((await t.db.query<{ n: string }>(`select count(*)::text as n from game_sessions where user_id = $1::bigint and game = $2 and submitted_at is null and closed_at is null`, [userId, game]))[0]?.n)

    it('a new session closes the earlier open one: its check and reveal are 404, its submit is raw 404, the new one works', async () => {
      const a = await open(student, 'betul-salah')
      const k = await open(student, 'kad-memori')
      const b = await open(student, 'betul-salah')
      expectError(await answerItem(student, 'betul-salah', a.sessionId, a.rows[0] as DbItem, true), 'NOT_FOUND', M.soloSessionNotFound)
      const submitA = await student.post('/api/games/solo/betul-salah/submit', { session_id: a.sessionId })
      expect(submitA.status).toBe(404)
      expect(GamesRawMessageSchema.parse(submitA.body)).toEqual({ message: M.soloSessionNotFound })
      expect((await sessionRow(a.sessionId))?.submitted_at).toBeNull()
      expect(rewards.calls).toHaveLength(0)
      // another game and another user are not affected
      expect((await t.db.query<{ closed_at: Date | null }>(`select closed_at from game_sessions where id = $1::uuid`, [k.sessionId]))[0]?.closed_at).toBeNull()
      const other = await open(student2, 'betul-salah')
      // the new session works end to end
      t.clock.advance(1000)
      expect((await answerItem(student, 'betul-salah', b.sessionId, b.rows[0] as DbItem, true)).status).toBe(200)
      t.clock.advance(1000)
      expect((await student.post('/api/games/solo/betul-salah/submit', { session_id: b.sessionId })).status).toBe(200)
      expect((await t.db.query<{ closed_at: Date | null }>(`select closed_at from game_sessions where id = $1::uuid`, [other.sessionId]))[0]?.closed_at).toBeNull()
      // a submitted session is never "closed" by the next start
      await open(student, 'betul-salah')
      expect((await t.db.query<{ closed_at: Date | null }>(`select closed_at from game_sessions where id = $1::uuid`, [b.sessionId]))[0]?.closed_at).toBeNull()
    })

    it('Kad Memori: reveal and check on a superseded board are 404', async () => {
      const a = await open(student, 'kad-memori')
      await open(student, 'kad-memori')
      const [x, y] = a.rows as [DbItem, DbItem]
      expectError(await student.post('/api/games/solo/kad-memori/reveal', { session_id: a.sessionId, card_id: x.card_id }), 'NOT_FOUND', M.soloSessionNotFound)
      expectError(await student.post('/api/games/solo/kad-memori/check', { session_id: a.sessionId, card_id: x.card_id, other_card_id: y.card_id }), 'NOT_FOUND', M.soloSessionNotFound)
    })

    it('concurrent starts leave exactly one open session', async () => {
      const out = await Promise.all([1, 2, 3, 4].map(() => student2.get('/api/games/solo/cabaran-kilat')))
      expect(out.map((r) => r.status)).toEqual([200, 200, 200, 200])
      expect(await openCount(student2.userId, 'cabaran-kilat')).toBe(1)
    })
  })

  describe('Kad Memori pacing', () => {
    it('one move less than 1 s after the previous one: the result is returned, nothing is credited', async () => {
      const { sessionId, rows } = await open(student, 'kad-memori')
      for (let p = 0; p < 6; p++) {
        const q = rows.find((r) => r.pair_key === p && r.face === 'question') as DbItem
        const a = rows.find((r) => r.pair_key === p && r.face === 'answer') as DbItem
        t.clock.advance(p === 3 ? 500 : 1000)
        const res = await student.post('/api/games/solo/kad-memori/check', { session_id: sessionId, card_id: q.card_id, other_card_id: a.card_id })
        expect(res.status).toBe(200)
      }
      const res = await student.post('/api/games/solo/kad-memori/submit', { session_id: sessionId })
      expect(GamesSoloSubmitResponseSchema.parse(res.body)).toMatchObject({ results: { syiling_earned: 0, moves: 6, accuracy: 100 } })
      expect(rewards.calls).toHaveLength(0)
      expect(await sessionRow(sessionId)).toMatchObject({ coins_computed: 6, coins_credited: 0 })
    })
  })

  describe('Mod Pelajar (is_test)', () => {
    it('rows are stamped is_test, the actor never earns and no reward call is made', async () => {
      const admin = await loginAs(t, ACCOUNTS.admin, { mod: true })
      const { sessionId, rows, res } = await open(admin, 'betul-salah', '?darjah=10')
      expect(parseData(res, GamesBetulSalahPayloadSchema).canEarnSyiling).toBe(false)
      for (const item of rows.slice(0, 3)) {
        t.clock.advance(1000)
        expect((await answerItem(admin, 'betul-salah', sessionId, item, true)).status).toBe(200)
      }
      const submit = await admin.post('/api/games/solo/betul-salah/submit', { session_id: sessionId })
      expect(GamesSoloSubmitResponseSchema.parse(submit.body)).toMatchObject({ score: 12 + 14 + 16, syiling_awarded: 0, correct_count: 3 })
      expect(rewards.calls).toHaveLength(0)
      expect(await sessionRow(sessionId)).toMatchObject({ is_test: true, coins_computed: 6, coins_credited: 0 })
      const [best] = await t.db.query<{ is_test: boolean }>(`select is_test from personal_bests where user_id = $1::bigint and game = 'betul-salah'`, [admin.userId])
      expect(best?.is_test).toBe(true)
    })
  })
})
