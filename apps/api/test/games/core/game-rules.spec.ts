import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootGamesApp, idOf, insertMcqQuestions, loginAs, START, type Client, type GamesTestApp } from '../helpers'
import { FORM, P, createRoom, fillAndStart, insertShortMcqs, parseRoom, stateOf } from '../rooms/support'
import { itemRows, type DbItem } from '../solo/support'

/**
 * S7-T01, part GAME-00 (48 section 3): the common rules through the API on the real rewards wiring: robots, the answer store,
 * the reward formula, the pace guard and the clocks.
 */
describe('GAME-00 common rules', () => {
  let t: GamesTestApp
  let student: Client
  let mod: Client
  let mathId: string

  const rowsOf = (attemptId: string) =>
    t.db.query<{ user_id: string; part_ref: string; mode: string; is_correct: boolean; marks_awarded: string; marks_max: string; is_test: boolean; subject_id: string | null }>(
      `select user_id::text, part_ref, mode, is_correct, marks_awarded::text, marks_max::text, is_test, subject_id::text from practice_answers where attempt_id = $1::uuid order by answered_at, id`,
      [attemptId],
    )
  const sessionOf = async (code: string) => (await t.db.query<{ session_id: string }>('select session_id from game_rooms where code = $1', [code]))[0]?.session_id as string

  const openSolo = async (c: Client, game: string): Promise<{ sessionId: string; items: DbItem[] }> => {
    const res = await c.get(`/api/games/solo/${game}?darjah=10`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const sessionId = (res.body as { data: { sessionId: string } }).data.sessionId
    return { sessionId, items: await itemRows(t.db, sessionId) }
  }
  const checkBetulSalah = (c: Client, sessionId: string, item: DbItem, right: boolean) =>
    c.post('/api/games/solo/betul-salah/check', { session_id: sessionId, item_id: item.question_id, answer: right ? item.statement_true : !item.statement_true })
  const playBetulSalah = async (c: Client, flags: string, gapMs = 1000) => {
    const { sessionId, items } = await openSolo(c, 'betul-salah')
    for (const [i, f] of flags.split('').entries()) {
      t.clock.advance(gapMs)
      const res = await checkBetulSalah(c, sessionId, items[i] as DbItem, f === 'T')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
    }
    return sessionId
  }
  const startRun = async (c: Client) => {
    const res = await c.post('/api/games/jutawan/start', { subject: mathId, darjah: 10 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const sessionId = (res.body as { data: { sessionId: string } }).data.sessionId
    return { sessionId, items: await itemRows(t.db, sessionId) }
  }
  const answerRun = (c: Client, sessionId: string, item: DbItem, right: boolean, gapMs = 2000) => {
    t.clock.advance(gapMs)
    return c.post(`/api/games/jutawan/${sessionId}/answer`, { questionId: item.question_id, optionId: right ? item.key_index : ((item.key_index as number) + 1) % 4 })
  }
  /** Votes in the open Perang Fakta round; `right` is against the truth of the shown statement. */
  const vote = async (c: Client, code: string, right: boolean, gapMs = 1000) => {
    t.clock.advance(gapMs)
    const st = await stateOf(t.db, code)
    const fact = st.facts[st.round - 1] as { isTrue: boolean }
    return parseRoom(await c.post(P('perang-fakta', code, '/action'), { type: 'answer', questionId: st.pendingQ, value: right ? fact.isTrue : !fact.isTrue }))
  }

  beforeAll(async () => {
    t = await bootGamesApp({ withGamification: true })
    await insertShortMcqs(t.db, { subject: 'MATH', level: 'T4', count: 60, prefix: 'GR' })
    await insertMcqQuestions(t.db, { subject: 'MATH', level: 'T4', count: 20, prefix: 'GJ', difficultyTp: (i) => Math.floor(i / 5) + 1 })
    mathId = await idOf(t.db, 'subjects', 'MATH')
    student = await loginAs(t, ACCOUNTS.student)
    mod = await loginAs(t, ACCOUNTS.admin, { mod: true })
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(() => {
    t.clock.set(START)
  })

  describe('FR-GM-00.4, AC-GM-00.4: a robot is a seat', () => {
    it('is_bot, no user, the label, no answer row; no user of the host school is linked to the game', async () => {
      const code = await createRoom(student, 'perang-fakta')
      const v = parseRoom(await fillAndStart(t, student, 'perang-fakta', code))
      expect(v.players.map((p) => [p.name.startsWith('Robot'), p.isBot])).toEqual([[false, false], [true, true]])
      expect(v.players[1]).toMatchObject({ name: 'Robot PrestasiPlus 1', grade: '' })
      const seats = await t.db.query<{ user_id: string | null; is_bot: boolean }>('select user_id::text, is_bot from game_room_players where room_code = $1 order by id', [code])
      expect(seats).toEqual([{ user_id: student.userId, is_bot: false }, { user_id: null, is_bot: true }])
      await vote(student, code, true)
      const rows = await rowsOf(await sessionOf(code))
      expect(rows.map((r) => r.user_id)).toEqual([student.userId])
    })
  })

  describe('FR-GM-00.5, FR-PA-28, FR-MUR-21-4: one answer row per answered or timed-out question', () => {
    it('AC-GM-00.1: Betul atau Salah, 5 answers, 3 correct: 5 rows `betul-salah#1..5`, mode game, marks 1 or 0', async () => {
      const id = await playBetulSalah(student, 'TFTFT')
      const rows = await rowsOf(id)
      expect(rows.map((r) => [r.part_ref, r.mode, r.is_correct, Number(r.marks_awarded), Number(r.marks_max), r.is_test])).toEqual([
        ['betul-salah#1', 'game', true, 1, 1, false],
        ['betul-salah#2', 'game', false, 0, 1, false],
        ['betul-salah#3', 'game', true, 1, 1, false],
        ['betul-salah#4', 'game', false, 0, 1, false],
        ['betul-salah#5', 'game', true, 1, 1, false],
      ])
      expect(rows.every((r) => r.subject_id !== null)).toBe(true) // the port copies the dimensions
    })

    it('a refused check writes nothing: the same transaction as the state change', async () => {
      const { sessionId, items } = await openSolo(student, 'betul-salah')
      t.clock.advance(1000)
      expect((await checkBetulSalah(student, sessionId, items[0] as DbItem, true)).status).toBe(200)
      t.clock.advance(1000)
      expect((await checkBetulSalah(student, sessionId, items[0] as DbItem, false)).status).toBe(409)
      expect(await rowsOf(sessionId)).toHaveLength(1)
    })

    it('AC-GM-12.2: Kad Memori, a row per matched pair `kad-memori#1..6`, a mismatch writes nothing', async () => {
      const { sessionId, items } = await openSolo(student, 'kad-memori')
      const card = (p: number, face: string) => items.find((r) => r.pair_key === p && r.face === face) as DbItem
      const check = (a: DbItem, b: DbItem) => {
        t.clock.advance(1000)
        return student.post('/api/games/solo/kad-memori/check', { session_id: sessionId, card_id: a.card_id, other_card_id: b.card_id })
      }
      expect((await check(card(0, 'question'), card(1, 'answer'))).status).toBe(200)
      expect(await rowsOf(sessionId)).toEqual([])
      for (let p = 0; p < 6; p++) expect((await check(card(p, 'question'), card(p, 'answer'))).status).toBe(200)
      const rows = await rowsOf(sessionId)
      expect(rows.map((r) => [r.part_ref, r.is_correct])).toEqual([1, 2, 3, 4, 5, 6].map((n) => [`kad-memori#${String(n)}`, true]))
    })

    it('AC-GM-13.1: Jutawan, a row per answer `jutawan#n`; the wrong answer that ends the run has one too', async () => {
      const { sessionId, items } = await startRun(student)
      for (const i of [0, 1]) expect((await answerRun(student, sessionId, items[i] as DbItem, true)).status).toBe(200)
      expect((await answerRun(student, sessionId, items[2] as DbItem, false)).status).toBe(200)
      expect((await rowsOf(sessionId)).map((r) => [r.part_ref, r.is_correct])).toEqual([['jutawan#1', true], ['jutawan#2', true], ['jutawan#3', false]])
    })

    it('AC-GM-03.1: Perang Fakta, votes and timeouts are all rows of the room session; a timeout is not correct', async () => {
      const code = await createRoom(student, 'perang-fakta')
      parseRoom(await fillAndStart(t, student, 'perang-fakta', code))
      await vote(student, code, true)
      t.clock.advance(10_000) // this round times out on the poll
      parseRoom(await student.get(P('perang-fakta', code)))
      const rows = await rowsOf(await sessionOf(code))
      expect(rows.map((r) => [r.part_ref, r.mode, r.is_correct, Number(r.marks_awarded)])).toEqual([
        ['perang-fakta#1', 'game', true, 1],
        ['perang-fakta#2', 'game', false, 0],
      ])
    })

    it('AC-GM-07.3: Teka Silang Kata, at 300 s every word not attempted is written as a timeout', async () => {
      const code = await createRoom(student, 'teka-silang-kata')
      parseRoom(await fillAndStart(t, student, 'teka-silang-kata', code))
      t.clock.advance(1000)
      const st = await stateOf(t.db, code)
      await student.post(P('teka-silang-kata', code, '/action'), { type: 'answer', questionId: st.pendingQ, value: (st.words[0] as { answer: string }).answer })
      t.clock.advance(300_000)
      parseRoom(await student.get(P('teka-silang-kata', code)))
      const rows = await rowsOf(await sessionOf(code))
      expect(rows.map((r) => r.part_ref)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => `teka-silang-kata#${String(n)}`))
      expect(rows.map((r) => r.is_correct)).toEqual([true, false, false, false, false, false, false, false])
    })

    it('AC-GM-00.12: Mod Pelajar writes no answer row in a room, a solo game or Jutawan', async () => {
      const code = await createRoom(mod, 'perang-fakta')
      parseRoom(await fillAndStart(t, mod, 'perang-fakta', code))
      await vote(mod, code, true)
      expect(await rowsOf(await sessionOf(code))).toEqual([])
      expect(await rowsOf(await playBetulSalah(mod, 'TF'))).toEqual([])
      const run = await startRun(mod)
      await answerRun(mod, run.sessionId, run.items[0] as DbItem, false)
      expect(await rowsOf(run.sessionId)).toEqual([])
    })
  })
})
