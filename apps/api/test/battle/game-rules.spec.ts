import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { BattleAnswerResultSchema, BattleArenaViewSchema } from '@pp/contract'

import { BattleEngine } from '../../src/modules/battle/engine'
import { addMcqs, bootBattleApp, botBattle, client, parseData, STUDENT_G10, subjectsOf, type BattleTestApp, type Client, type Subjects } from './arena-helpers'

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

  it('AC-GM-00.12: Mod Pelajar writes no answer row', async () => {
    const admin = await client(t, 'admin@demo.test', { modPelajar: true })
    const uuid = await botBattle(admin, s.math)
    await answer(admin, uuid, true)
    expect(await answerRows(uuid)).toEqual([])
  })
})
