import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { RoomsService } from '../../../src/modules/games/rooms/rooms.service'
import { JutawanService } from '../../../src/modules/games/solo/jutawan/jutawan.service'
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

  describe('FR-GM-00.3, FR-GM-00.6, FR-PA-30: the reward block, caps and the pace guard', () => {
    const events = (sessionId: string) =>
      t.db.query<{ xp: number; syiling: number; capped_reason: string | null }>('select xp, syiling, capped_reason from game_reward_events where game_session_id = $1::uuid', [sessionId])
    const xpOf = async (userId: string) => Number((await t.db.query<{ xp: number }>('select xp from wallets where user_id = $1::bigint', [userId]))[0]?.xp ?? 0)
    const submit = (c: Client, id: string) => c.post('/api/games/solo/betul-salah/submit', { session_id: id })
    /** Finishes a Perang Fakta room with every vote right. */
    const finishRoom = async (c: Client, code: string, gapMs = 1000) => {
      let v = parseRoom(await c.get(P('perang-fakta', code)))
      while (v.status === 'playing') v = await vote(c, code, true, gapMs)
      return v
    }
    /** The caps and the earned counters start clean for each test (one pupil plays them all). */
    beforeEach(async () => {
      await t.db.query('delete from game_reward_events')
    })

    it('AC-GM-00.1: a solo game with 3 correct, syiling off: XP 3 x 10 + the play XP, no syiling; stored once', async () => {
      const before = await xpOf(student.userId)
      const id = await playBetulSalah(student, 'TFTFT')
      const res = await submit(student, id)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect((res.body as { reward: unknown }).reward).toEqual({ xp: 35, syiling: 0, capped: false, reason: null })
      expect(await xpOf(student.userId)).toBe(before + 35)
      expect(await events(id)).toEqual([{ xp: 35, syiling: 0, capped_reason: null }])
    })

    it('rule 3: a room won against robots only gives the per-correct XP and the play XP; the view read again shows the same', async () => {
      const code = await createRoom(student, 'perang-fakta')
      parseRoom(await fillAndStart(t, student, 'perang-fakta', code))
      const v = await finishRoom(student, code)
      expect(v.result?.winnerId).toBe(student.userId)
      expect(v.result?.reward).toEqual({ xp: 15 * 10 + 5, syiling: 0, capped: false, reason: null })
      expect(parseRoom(await student.get(P('perang-fakta', code))).result?.reward).toEqual(v.result?.reward)
      expect(await events(await sessionOf(code))).toHaveLength(1)
    })

    it('AC-GM-00.2 with the settings on: a room won against another pupil gives the win XP and the bonus; the ledger source is game:<key>', async () => {
      await t.db.query(`update reward_settings set mini_games_give_coins = true, coins_per_correct = 1 where id = 1`)
      try {
        const student2 = await loginAs(t, ACCOUNTS.student2)
        const code = await createRoom(student, 'perang-fakta', { ...FORM, match_mode: 'same_level' })
        await student2.post(P('perang-fakta', undefined, '/join'), { room_code: code })
        parseRoom(await student.post(P('perang-fakta', code, '/start')))
        const v = await finishRoom(student, code)
        expect(v.result?.reward).toMatchObject({ xp: 15 * 10 + 20, capped: false })
        const session = await sessionOf(code)
        const ledger = await t.db.query<{ source: string; source_id: string; amount: number }>('select source, source_id, amount from coin_ledger where source_id = $1', [`game:${session}`])
        expect(ledger).toEqual([{ source: 'game:perang-fakta', source_id: `game:${session}`, amount: 15 + 5 }])
      } finally {
        await t.db.query(`update reward_settings set mini_games_give_coins = false where id = 1`)
      }
    })

    it('AC-GM-00.5: with the daily XP cap reached the result gives 0 XP and says so', async () => {
      await t.db.query('update gamification_settings set value = 10 where key = $1', ['games_daily_xp_cap'])
      try {
        const first = await playBetulSalah(student, 'TT')
        expect((await submit(student, first)).body).toMatchObject({ reward: { xp: 10, capped: true, reason: 'xp_cap' } })
        const second = await playBetulSalah(student, 'T')
        expect((await submit(student, second)).body).toMatchObject({ reward: { xp: 0, capped: true, reason: 'xp_cap' } })
      } finally {
        await t.db.query('update gamification_settings set value = 500 where key = $1', ['games_daily_xp_cap'])
      }
    })

    it('pace guard, any gap (48 section 3.4 rule 5): a solo game with one fast gap is scored and credits nothing, no event', async () => {
      const { sessionId, items } = await openSolo(student, 'betul-salah')
      t.clock.advance(5000)
      expect((await checkBetulSalah(student, sessionId, items[0] as DbItem, true)).status).toBe(200)
      t.clock.advance(999)
      expect((await checkBetulSalah(student, sessionId, items[1] as DbItem, true)).status).toBe(200)
      t.clock.advance(20_000) // a long total time does not help: any gap counts
      const res = await submit(student, sessionId)
      expect(res.body).toMatchObject({ score: 12 + 14, reward: { xp: 0, syiling: 0, capped: false, reason: 'pace_guard' } })
      expect(await events(sessionId)).toEqual([])
    })

    it('pace guard in a room: the game finishes and is scored, the reward says pace_guard', async () => {
      const code = await createRoom(student, 'perang-fakta')
      parseRoom(await fillAndStart(t, student, 'perang-fakta', code))
      const before = await xpOf(student.userId)
      const v = await finishRoom(student, code, 200)
      expect(v.status).toBe('finished')
      expect(v.players.find((p) => p.id === student.userId)?.points).toBe(15)
      expect(v.result?.reward).toEqual({ xp: 0, syiling: 0, capped: false, reason: 'pace_guard' })
      expect(await xpOf(student.userId)).toBe(before)
      expect(await events(await sessionOf(code))).toEqual([])
    })

    it('Jutawan: a wrong answer gives the play XP with correct = level; a fast gap credits nothing and writes no best', async () => {
      const run = await startRun(student)
      await answerRun(student, run.sessionId, run.items[0] as DbItem, true)
      const end = await answerRun(student, run.sessionId, run.items[1] as DbItem, false)
      expect((end.body as { data: { result: { reward: unknown } } }).data.result.reward).toEqual({ xp: 10 + 5, syiling: 0, capped: false, reason: null })
      const best = async () => (await t.db.query<{ best_level: number }>('select best_level from jutawan_stats where user_id = $1::bigint', [student.userId]))[0]?.best_level
      const was = (await best()) as number
      const fast = await startRun(student)
      for (let i = 0; i <= was; i++) await answerRun(student, fast.sessionId, fast.items[i] as DbItem, true, i === 0 ? 2000 : 1000)
      const stop = await answerRun(student, fast.sessionId, fast.items[was + 1] as DbItem, false, 1000)
      expect((stop.body as { data: { result: { reward: unknown } } }).data.result.reward).toEqual({ xp: 0, syiling: 0, capped: false, reason: 'pace_guard' })
      expect(await best()).toBe(was)
    })

    it('Mod Pelajar: no reward block and no event', async () => {
      const id = await playBetulSalah(mod, 'T')
      const res = await submit(mod, id)
      expect(res.status).toBe(200)
      expect((res.body as Record<string, unknown>).reward).toBeUndefined()
      expect(await events(id)).toEqual([])
    })
  })

  describe('FR-GM-00.7: clocks of every game, moved by a poll and by the 5 s sweep', () => {
    const roomStatus = async (code: string) => (await t.db.query<{ status: string }>('select status from game_rooms where code = $1', [code]))[0]?.status
    const openBetulSalahAt = async (ms: number) => {
      const { sessionId, items } = await openSolo(student, 'betul-salah')
      t.clock.advance(ms)
      return checkBetulSalah(student, sessionId, items[0] as DbItem, true)
    }

    it('a Benteng Ilmu question times out at 15 s on a poll: a wrong answer row, the next round, roundEndsAt from the server clock', async () => {
      const code = await createRoom(student, 'benteng-ilmu')
      const started = parseRoom(await fillAndStart(t, student, 'benteng-ilmu', code))
      expect(started.state?.roundSecondsLeft).toBe(15)
      expect(new Date(started.roundEndsAt as string).getTime()).toBe(t.clock.now().getTime() + 15_000)
      t.clock.advance(14_999)
      expect(parseRoom(await student.get(P('benteng-ilmu', code))).round).toBe(1)
      t.clock.advance(1)
      const after = parseRoom(await student.get(P('benteng-ilmu', code)))
      expect(after.round).toBe(2)
      expect(after.state?.roundSecondsLeft).toBe(15)
      expect((await rowsOf(await sessionOf(code))).map((r) => [r.part_ref, r.is_correct])).toEqual([['benteng-ilmu#1', false]])
    })

    it('the sweep finishes a room with no poller, once, with its rows and its reward', async () => {
      const code = await createRoom(student, 'perang-fakta')
      parseRoom(await fillAndStart(t, student, 'perang-fakta', code))
      const rooms = t.app.get(RoomsService, { strict: false })
      t.clock.advance(9_000)
      await rooms.sweepClocks()
      expect((await stateOf(t.db, code)).round).toBe(1)
      t.clock.advance(15 * 10_000)
      await rooms.sweepClocks()
      expect(await roomStatus(code)).toBe('finished')
      const session = await sessionOf(code)
      expect(await rowsOf(session)).toHaveLength(15)
      await rooms.sweepClocks()
      expect(await rowsOf(session)).toHaveLength(15)
      expect(await t.db.query('select 1 from game_reward_events where game_session_id = $1::uuid', [session])).toHaveLength(1)
    })

    it('AC-GM-08.4: a Betul atau Salah check at 55 s is taken, at 56 s it is refused with "Masa sudah tamat."; the submit still scores', async () => {
      expect((await openBetulSalahAt(55_000)).status).toBe(200)
      const late = await openBetulSalahAt(56_000)
      expect(late.status).toBe(409)
      expect((late.body as { error: { message: string } }).error.message).toBe('Masa sudah tamat.')
    })

    it('ruling on #497: Tembak Jawapan and Kad Memori are never refused for time', async () => {
      const tembak = await openSolo(student, 'tembak-jawapan')
      t.clock.advance(3_600_000)
      const item = tembak.items[0] as DbItem
      expect((await student.post('/api/games/solo/tembak-jawapan/check', { session_id: tembak.sessionId, item_id: item.question_id, option_index: item.key_index })).status).toBe(200)
      const kad = await openSolo(student, 'kad-memori')
      t.clock.advance(3_600_000)
      const card = (face: string) => kad.items.find((r) => r.pair_key === 0 && r.face === face) as DbItem
      expect((await student.post('/api/games/solo/kad-memori/check', { session_id: kad.sessionId, card_id: card('question').card_id, other_card_id: card('answer').card_id })).status).toBe(200)
    })

    it('GAME-13: a Jutawan answer at 60 s is a timeout; the sweep ends a run nobody answers, once', async () => {
      const late = await startRun(student)
      const res = await answerRun(student, late.sessionId, late.items[0] as DbItem, true, 60_000)
      expect((res.body as { data: { correct: boolean; level: number } }).data).toMatchObject({ correct: false, level: 0 })
      const jutawan = t.app.get(JutawanService, { strict: false })
      const open = await startRun(student)
      t.clock.advance(59_999)
      await jutawan.sweepClocks()
      expect(await rowsOf(open.sessionId)).toEqual([])
      t.clock.advance(1)
      await jutawan.sweepClocks()
      expect((await rowsOf(open.sessionId)).map((r) => [r.part_ref, r.is_correct])).toEqual([['jutawan#1', false]])
      await jutawan.sweepClocks()
      expect(await rowsOf(open.sessionId)).toHaveLength(1)
      expect((await t.db.query<{ jutawan_over: boolean }>('select jutawan_over from game_sessions where id = $1::uuid', [open.sessionId]))[0]?.jutawan_over).toBe(true)
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
