import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { BattleAnswerResultSchema, BattleArenaViewSchema } from '@pp/contract'

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
    const res = await who.post(`/battle/arena/${uuid}/answer`, { questionId: await questionOf(who, uuid), optionId: right ? 1 : 0, seconds: gapMs / 1000 })
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

  it('AC-GM-00.12: Mod Pelajar writes no answer row', async () => {
    const admin = await client(t, 'admin@demo.test', { modPelajar: true })
    const uuid = await botBattle(admin, s.math)
    await answer(admin, uuid, true)
    expect(await answerRows(uuid)).toEqual([])
  })
})
