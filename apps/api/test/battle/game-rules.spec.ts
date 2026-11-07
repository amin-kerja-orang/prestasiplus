import { Logger } from '@nestjs/common'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { BATTLE_MESSAGES, BattleAnswerResultSchema, BattleArenaViewSchema } from '@pp/contract'

import { ApiError } from '../../src/common/errors/api-error'
import { ArenaService } from '../../src/modules/battle/arena/arena.service'
import { BattleEngine } from '../../src/modules/battle/engine'
import { addMcqs, bootBattleApp, botBattle, client, parseData, STUDENT_G10, STUDENT_G10_B, subjectsOf, type BattleTestApp, type Client, type Subjects } from './arena-helpers'

/** S7-T01, part GAME-00 in Battle Arena (48 sections 3.3 to 3.6): the robot, the answer store, rewards, pace and clocks. */
describe('GAME-00 common rules in Battle', () => {
  let t: BattleTestApp
  let s: Subjects
  let a: Client
  const rows = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)
  const answerRows = (uuid: string) =>
    rows<{ user_id: string; part_ref: string; mode: string; is_correct: boolean }>(`select user_id::text, part_ref, mode, is_correct from practice_answers where attempt_id = $1::uuid order by answered_at, id`, [uuid])
  const questionOf = async (who: Client, uuid: string): Promise<string> => parseData(BattleArenaViewSchema, await who.get(`/battle/arena/${uuid}`)).question?.id as string
  /** One answer after `gapMs`; the seeded right option is 1. */
  const answer = async (who: Client, uuid: string, right: boolean, gapMs = 2000) => {
    t.clock.advance(gapMs)
    const res = await who.post(`/battle/arena/${uuid}/answer`, { questionId: await questionOf(who, uuid), optionId: right ? 1 : 0, seconds: Math.min(15, gapMs / 1000) })
    return parseData(BattleAnswerResultSchema, res)
  }

  beforeAll(async () => {
    t = await bootBattleApp()
    s = await subjectsOf(t)
    await addMcqs(t, s.math, s.t4, 12)
    a = await client(t, STUDENT_G10)
    vi.spyOn(t.get(BattleEngine), 'botAccuracy').mockResolvedValue(0)
  })
  afterAll(async () => {
    await t.close()
  })

  it('AC-GM-00.4, AC-MUR-21-7: the robot is a seat with no user, labelled, and its answers write no answer row', async () => {
    const uuid = await botBattle(a, s.math)
    expect(parseData(BattleArenaViewSchema, await a.get(`/battle/arena/${uuid}`)).players.B).toEqual({ name: 'Robot PrestasiPlus', school: '', isBot: true })
    await answer(a, uuid, true)
    const robot = await rows<{ user_id: string | null }>(`select user_id from battle_answers where battle_id = $1 and user_id is null`, [uuid])
    expect(robot).toHaveLength(1)
    expect((await answerRows(uuid)).map((r) => r.user_id)).toEqual([a.id])
  })

  it('FR-GM-00.5, AC-PA-26: one row per answer of mode battle, `battle#n`, attempt id the battle uuid; a timeout is not correct', async () => {
    const uuid = await botBattle(a, s.math)
    await answer(a, uuid, true)
    await answer(a, uuid, false)
    t.clock.advance(2000)
    await a.post(`/battle/arena/${uuid}/answer`, { questionId: await questionOf(a, uuid), optionId: null, seconds: 2 })
    expect((await answerRows(uuid)).map((r) => [r.part_ref, r.mode, r.is_correct])).toEqual([
      ['battle#1', 'battle', true],
      ['battle#2', 'battle', false],
      ['battle#3', 'battle', false],
    ])
  })

  describe('FR-GM-00.3, FR-GM-00.6: rewards', () => {
    const finish = async (who: Client, uuid: string, gapMs = 2000) => {
      let last = await answer(who, uuid, true, gapMs)
      while (!last.result) last = await answer(who, uuid, true, gapMs)
      return last.result
    }

    it('rule 3: a battle won against the robot: 10 x 10 + the play XP, session and ledger key the battle uuid; the view repeats the block', async () => {
      const uuid = await botBattle(a, s.math)
      const result = await finish(a, uuid)
      expect(result.winner).toBe('A')
      expect(result.reward).toEqual({ xp: 105, syiling: 10, capped: false, reason: null })
      expect(t.reports.at(-1)).toMatchObject({ userId: a.id, game: 'battle', event: 'win', xp: 105, coins: 10, session: uuid })
      expect(parseData(BattleArenaViewSchema, await a.get(`/battle/arena/${uuid}`)).result?.reward).toEqual(result.reward)
    })

    it('a forfeit against a pupil: nothing for the one who left, the win XP for the other', async () => {
      const b = await client(t, STUDENT_G10_B)
      const invite = await a.post('/battle/invite', { question_type: 'biasa', subject_id: s.math, receiver_id: b.id })
      expect(invite.status).toBe(200)
      const uuid = (await b.get('/battle/invitations')).body.invitations[0].uuid as string
      const accepted = await b.post(`/battle/invite/${uuid}/accept`)
      const battle = accepted.body.battle_uuid as string
      expect((await a.post(`/battle/forfeit/${battle}`)).status).toBe(200)
      expect(t.reports.slice(-2).map((r) => [r.userId, r.event, r.xp])).toEqual([[b.id, 'forfeit_win', 20], [a.id, 'forfeit', 0]])
    })

    it('pace guard, any gap: the battle is scored and credits nothing; the view says the same', async () => {
      await rows(`update gamification_settings set value = 1000 where key = 'games_min_ms_per_answer'`)
      try {
        const uuid = await botBattle(a, s.math)
        const before = t.reports.length
        await answer(a, uuid, true, 5000)
        const result = await finish(a, uuid, 500)
        expect(result.scoreA).toBeGreaterThan(0)
        expect(result.reward).toEqual({ xp: 0, syiling: 0, capped: false, reason: 'pace_guard' })
        expect(t.reports.length).toBe(before)
        expect(parseData(BattleArenaViewSchema, await a.get(`/battle/arena/${uuid}`)).result?.reward).toEqual(result.reward)
      } finally {
        await rows(`update gamification_settings set value = 0 where key = 'games_min_ms_per_answer'`)
      }
    })
  })

  describe('FR-GM-00.7: the clock of a question', () => {
    const lastAnswer = async (uuid: string) => (await rows<{ option_id: number | null; points: number }>(`select option_id, points from battle_answers where battle_id = $1 and user_id = $2 order by position desc limit 1`, [uuid, a.id]))[0]

    it('AC-GM-01.2: a right answer at 17 s scores 500; at 18.5 s it is a timeout with 0 points', async () => {
      const uuid = await botBattle(a, s.math)
      const view = parseData(BattleArenaViewSchema, await a.get(`/battle/arena/${uuid}`))
      expect(new Date(view.roundEndsAt as string).getTime()).toBe(t.clock.now().getTime() + 18_000)
      expect((await answer(a, uuid, true, 17_000)).points).toBe(500)
      const question = await questionOf(a, uuid)
      t.clock.advance(18_500)
      const res = await a.post(`/battle/arena/${uuid}/answer`, { questionId: question, optionId: 1, seconds: 2 })
      // the poll for the question was before the deadline: the late answer itself is the timeout
      expect(parseData(BattleAnswerResultSchema, res).points).toBe(0)
      expect(await lastAnswer(uuid)).toEqual({ option_id: null, points: 0 })
    })

    it('a poll after the time writes the timeout and shows the next question', async () => {
      const uuid = await botBattle(a, s.math)
      t.clock.advance(18_001)
      const view = parseData(BattleArenaViewSchema, await a.get(`/battle/arena/${uuid}`))
      expect(view.index).toBe(2)
      expect((await answerRows(uuid)).map((r) => [r.part_ref, r.is_correct])).toEqual([['battle#1', false]])
    })

    it('the sweep moves a battle with no poller to its end, with its rows and one reward', async () => {
      const uuid = await botBattle(a, s.math)
      const arena = t.get(ArenaService)
      t.clock.advance(18_000)
      await arena.sweepClocks()
      expect(await answerRows(uuid)).toEqual([]) // exactly at the limit is still in time
      for (let i = 0; i < 10; i++) {
        t.clock.advance(18_001)
        await arena.sweepClocks()
      }
      expect((await rows<{ status: string }>(`select status from battles where id = $1`, [uuid]))[0]?.status).toBe('finished')
      expect(await answerRows(uuid)).toHaveLength(10)
      expect(t.reports.filter((r) => r.session === uuid)).toHaveLength(1)
    })
  })

  describe('the sweep and a question that cannot be served', () => {
    /** The questions of the battle lose their live version: the owner's reads give nothing. */
    const archive = (uuid: string) => rows(`update questions set live_version_no = null where id in (select question_id from battle_questions where battle_id = $1)`, [uuid])
    const restore = (uuid: string) => rows(`update questions set live_version_no = 1 where id in (select question_id from battle_questions where battle_id = $1)`, [uuid])
    beforeEach(() => rows(`update battles set status = 'finished' where status = 'active'`)) // the counts below are of one battle

    it('a battle whose questions were archived still times out to its end, with its rows and its reward', async () => {
      const uuid = await botBattle(a, s.math)
      await archive(uuid)
      try {
        const arena = t.get(ArenaService)
        for (let i = 0; i < 10; i++) {
          t.clock.advance(18_001)
          expect(await arena.sweepClocks()).toBe(1)
        }
        expect((await rows<{ status: string }>(`select status from battles where id = $1`, [uuid]))[0]?.status).toBe('finished')
        expect(await answerRows(uuid)).toHaveLength(10)
      } finally {
        await restore(uuid)
      }
    })

    it('only "moved first" stays silent; any other refusal is logged', async () => {
      await botBattle(a, s.math)
      const arena = t.get(ArenaService)
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
      const store = vi.spyOn(arena as unknown as { store: () => Promise<unknown> }, 'store')
      try {
        t.clock.advance(18_001)
        store.mockRejectedValueOnce(ApiError.of('CONFLICT', { message: BATTLE_MESSAGES.battleOver }))
        expect(await arena.sweepClocks()).toBe(0)
        store.mockRejectedValueOnce(ApiError.of('VALIDATION_ERROR', { message: BATTLE_MESSAGES.questionInvalid }))
        expect(await arena.sweepClocks()).toBe(0)
        expect(warn).not.toHaveBeenCalled()
        store.mockRejectedValueOnce(ApiError.of('NOT_FOUND', { message: BATTLE_MESSAGES.questionNotFound }))
        expect(await arena.sweepClocks()).toBe(0)
        expect(warn).toHaveBeenCalledTimes(1)
      } finally {
        store.mockRestore()
        warn.mockRestore()
      }
    })
  })

  it('AC-GM-00.12: Mod Pelajar writes no answer row', async () => {
    const admin = await client(t, 'admin@demo.test', { modPelajar: true })
    const uuid = await botBattle(admin, s.math)
    await answer(admin, uuid, true)
    expect(await answerRows(uuid)).toEqual([])
  })
})
