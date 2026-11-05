import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BattleArenaViewSchema, BattleRawErrorSchema, BattleSuccessSchema } from '@pp/contract'

import { GamesPorts } from '../../src/modules/games'
import { addMcqs, bootBattleApp, botBattle, client, parse, parseData, STUDENT_G10, STUDENT_G10_B, STUDENT_G11, subjectsOf, type BattleTestApp, type Client, type Subjects } from './arena-helpers'

describe('forfeit (M16-14)', () => {
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
    ;[a, b, c] = [await client(t, STUDENT_G10), await client(t, STUDENT_G10_B), await client(t, STUDENT_G11)]
  }, 180_000)
  afterAll(async () => t.close())

  it('a player forfeits an active battle: the opponent wins, finished_at is set, M14 hears "forfeit"', async () => {
    const uuid = await botBattle(a, s.math)
    t.clock.advance(5_000)
    const res = await a.post(`/battle/forfeit/${uuid}`)
    expect(res.status).toBe(200)
    expect(parse(BattleSuccessSchema, res)).toEqual({ success: true })
    const [row] = await rows<{ status: string; winner: string; finished_at: Date }>(`select status, winner, finished_at from battles where id = $1`, [uuid])
    expect(row).toMatchObject({ status: 'forfeited', winner: 'B' })
    expect(row?.finished_at.toISOString()).toBe(t.clock.now().toISOString())
    expect(t.reports.at(-1)).toEqual({ userId: a.id, game: 'battle', event: 'forfeit', coins: 0, xp: 0, correct: 0, total: 0, session: uuid }) // rule 1: the leaver gets nothing
    // the arena now shows the result and no question; answering is refused
    const v = parseData(BattleArenaViewSchema, await a.get(`/battle/arena/${uuid}`))
    expect(v).toMatchObject({ status: 'forfeited', question: null, secondsLeft: 0, result: { winner: 'B' } })
    const answer = await a.post(`/battle/arena/${uuid}/answer`, { questionId: '1', optionId: 1, seconds: 1 })
    expect(answer.status).toBe(409)
  })

  it('a robot opponent (DM-60: no user): the arena still shows the battle and the player can forfeit', async () => {
    const uuid = await botBattle(a, s.math)
    await rows(`update battle_participants set user_id = null where battle_id = $1 and side = 'B'`, [uuid])
    expect(parseData(BattleArenaViewSchema, await a.get(`/battle/arena/${uuid}`))).toMatchObject({ uuid, status: 'active', you: 'A', players: { B: { name: 'Robot PrestasiPlus', isBot: true } } })
    expect((await a.post(`/battle/forfeit/${uuid}`)).status).toBe(200)
  })

  it('a second forfeit is 409 {error: "Battle sudah tamat."}', async () => {
    const uuid = await botBattle(a, s.math)
    expect((await a.post(`/battle/forfeit/${uuid}`)).status).toBe(200)
    const again = await a.post(`/battle/forfeit/${uuid}`)
    expect(again.status).toBe(409)
    expect(parse(BattleRawErrorSchema, again)).toEqual({ error: 'Battle sudah tamat.' })
  })

  it('a finished battle cannot be forfeited', async () => {
    const uuid = await botBattle(a, s.math)
    await rows(`update battles set status = 'finished', winner = 'A' where id = $1`, [uuid])
    const res = await a.post(`/battle/forfeit/${uuid}`)
    expect(res.status).toBe(409)
    expect(res.body).toEqual({ error: 'Battle sudah tamat.' })
  })

  it('a foreign, unknown or malformed battle is 404 {error: "Battle tidak dijumpai."} and stays active', async () => {
    const uuid = await botBattle(a, s.math)
    for (const [who, id] of [[b, uuid], [a, '00000000-0000-4000-8000-000000000000'], [a, 'abc'], [a, "1' or '1'='1"]] as const) {
      const res = await who.post(`/battle/forfeit/${encodeURIComponent(id)}`)
      expect(res.status, id).toBe(404)
      expect(parse(BattleRawErrorSchema, res)).toEqual({ error: 'Battle tidak dijumpai.' })
    }
    expect((await rows<{ status: string }>(`select status from battles where id = $1`, [uuid]))[0]?.status).toBe('active')
  })

  it('against another pupil the forfeiting side loses whichever side it is', async () => {
    await a.post('/battle/invite', { question_type: 'biasa', subject_id: s.math, receiver_id: b.id })
    const inv = (await b.get('/battle/invitations')).body.invitations[0].uuid as string
    const uuid = (await b.post(`/battle/invite/${inv}/accept`)).body.battle_uuid as string
    expect((await c.post(`/battle/forfeit/${uuid}`)).status).toBe(404)
    expect((await b.post(`/battle/forfeit/${uuid}`)).status).toBe(200)
    expect((await rows<{ winner: string; status: string }>(`select winner, status from battles where id = $1`, [uuid]))[0]).toEqual({ winner: 'A', status: 'forfeited' })
    expect(t.reports.at(-1)).toMatchObject({ userId: b.id, event: 'forfeit' })
  })

  it('two concurrent forfeits: one success, one 409, one report', async () => {
    const uuid = await botBattle(a, s.math)
    const before = t.reports.length
    const [r1, r2] = await Promise.all([a.post(`/battle/forfeit/${uuid}`), a.post(`/battle/forfeit/${uuid}`)])
    expect([r1.status, r2.status].sort()).toEqual([200, 409])
    expect(t.reports.length).toBe(before + 1)
  })

  it('AC-GM-00.12: Mod Pelajar makes no reward call', async () => {
    const admin = await client(t, 'admin@demo.test', { modPelajar: true })
    const uuid = await botBattle(admin, s.math)
    const before = t.reports.length
    expect((await admin.post(`/battle/forfeit/${uuid}`)).status).toBe(200)
    expect(t.reports.length).toBe(before)
  })

  it('a seat marked is_bot that still points at a pupil (before FR-GM-00.4) is not a participant: the stranger not-found', async () => {
    const uuid = await botBattle(a, s.math)
    await rows(`update battle_participants set user_id = $2 where battle_id = $1 and is_bot`, [uuid, b.id])
    const view = await b.get(`/battle/arena/${uuid}`)
    expect(view.status).toBe(404)
    const answer = await b.post(`/battle/arena/${uuid}/answer`, { questionId: '1', optionId: 1, seconds: 1 })
    expect(answer.status).toBe(404)
    const forfeit = await b.post(`/battle/forfeit/${uuid}`)
    expect(forfeit.status).toBe(404)
    expect(parse(BattleRawErrorSchema, forfeit)).toEqual({ error: 'Battle tidak dijumpai.' })
    expect((await rows<{ status: string }>(`select status from battles where id = $1`, [uuid]))[0]?.status).toBe('active')
  })

  it('a failing reward fails the forfeit as a whole: the reward and the state change are one transaction', async () => {
    const port = t.get(GamesPorts).rewards
    const original = port.onGameResult
    port.onGameResult = async () => {
      throw new Error('port down')
    }
    try {
      const uuid = await botBattle(a, s.math)
      const res = await a.post(`/battle/forfeit/${uuid}`)
      expect(res.status).toBe(500)
      expect((await rows<{ status: string }>(`select status from battles where id = $1`, [uuid]))[0]?.status).toBe('active')
      port.onGameResult = original
      expect(parse(BattleSuccessSchema, await a.post(`/battle/forfeit/${uuid}`))).toEqual({ success: true })
    } finally {
      port.onGameResult = original
    }
  })
})
