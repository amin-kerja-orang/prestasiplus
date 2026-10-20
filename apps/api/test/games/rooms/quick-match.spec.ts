import {
  GamesQuickMatchCancelResponseSchema,
  GamesQuickMatchPollResponseSchema,
  GamesQuickMatchStartResponseSchema,
  GamesRawErrorSchema,
  GAMES_MESSAGES,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootGamesApp, loginAs, type Client, type GamesTestApp } from '../helpers'
import { P, demo001Students, ListBots, parseRoom, roomOf } from './support'

const M = GAMES_MESSAGES
const QM = '/api/papan-bijak/quick-match'
const FORM = { subject: 'MATEMATIK', match_mode: 'same_grade' }

describe('Papan Bijak quick match (M16-29..31): raw bodies', () => {
  let t: GamesTestApp
  let student: Client
  let student2: Client
  let teacher: Client

  beforeAll(async () => {
    t = await bootGamesApp()
    student = await loginAs(t, ACCOUNTS.student)
    student2 = await loginAs(t, ACCOUNTS.student2)
    teacher = await loginAs(t, ACCOUNTS.teacher)
    const kids = await demo001Students(t.db)
    t.ports.provideBotPool(
      new ListBots(kids.map((k) => ({ id: k.id, name: k.name, grade: k.grade }))),
    )
  })
  afterAll(async () => {
    await t.close()
  })

  const poll = async (c: Client, status = 200) => {
    const res = await c.get(`${QM}/poll`)
    expect(res.status, JSON.stringify(res.body)).toBe(status)
    return GamesQuickMatchPollResponseSchema.parse(res.body)
  }
  const searches = async () =>
    t.db.query(
      'select user_id::text, subject, match_mode, status, polls, room_code, is_test from pb_searches order by id',
    )

  it('start: raw { error } 422 in the order subject then match_mode (never the standard envelope)', async () => {
    const cases: [object | undefined, string][] = [
      [undefined, M.quickMatchSubject],
      [{}, M.quickMatchSubject],
      [{ subject: 'SEJARAH', match_mode: 'same_grade' }, M.quickMatchSubject],
      [{ subject: 'GEOGRAFI', match_mode: 'bad' }, M.quickMatchSubject],
      [{ subject: 'SAINS' }, M.quickMatchMode],
      [{ subject: 'SAINS', match_mode: 'custom' }, M.quickMatchMode],
      [{ subject: 'SAINS', match_mode: 5 }, M.quickMatchMode],
    ]
    for (const [body, error] of cases) {
      const res = await student.post(QM, body)
      expect(res.status).toBe(422)
      expect(GamesRawErrorSchema.parse(res.body)).toEqual({ error })
    }
    expect(await searches()).toEqual([])
  })

  it('start: 200 { status: "searching" } and a stored search; a plain poll with no search is cancelled', async () => {
    expect(await poll(student2)).toEqual({ status: 'cancelled' })
    const res = await student.post(QM, FORM)
    expect(res.status).toBe(200)
    expect(GamesQuickMatchStartResponseSchema.parse(res.body)).toEqual({ status: 'searching' })
    expect(await searches()).toEqual([
      {
        user_id: student.userId,
        subject: 'MATEMATIK',
        match_mode: 'same_grade',
        status: 'searching',
        polls: 0,
        room_code: null,
        is_test: false,
      },
    ])
    expect(await poll(student2)).toEqual({ status: 'cancelled' }) // another user's search is not mine
  })

  it('the third poll matches: a Papan Bijak room, host = caller, 4 seats, the caller grade level, one bot; then it stays matched', async () => {
    expect(await poll(student)).toEqual({ status: 'searching' })
    expect(await poll(student)).toEqual({ status: 'searching' })
    const matched = await poll(student)
    expect(matched).toMatchObject({ status: 'matched' })
    const code = (matched as { room_code: string }).room_code
    const room = await roomOf(t.db, code)
    expect(room).toMatchObject({
      game: 'papan-bijak',
      subject: 'MATEMATIK',
      grade_level: 'TINGKATAN_4',
      match_mode: 'same_grade',
      max_players: 4,
      status: 'waiting',
      is_test: false,
    })
    expect(String(room.host_id)).toBe(student.userId)
    const players = await t.db.query(
      'select user_id::text, is_bot from game_room_players where room_code = $1 order by id',
      [code],
    )
    expect(players).toHaveLength(2)
    expect(players[0]).toEqual({ user_id: student.userId, is_bot: false })
    expect(players[1]?.is_bot).toBe(true)
    // the caller can open the room
    const view = parseRoom(await student.get(P('papan-bijak', code)))
    expect(view.players).toHaveLength(2) // already at the minimum: the host poll adds no bot
    expect(await poll(student)).toEqual({ status: 'matched', room_code: code })
    expect(
      await t.db.query(`select count(*)::int as n from game_rooms where game = 'papan-bijak'`),
    ).toEqual([{ n: 1 }])
    expect((await searches())[0]).toMatchObject({ status: 'matched', polls: 3, room_code: code })
  })

  it('a search older than 120 s expires on the next poll (and stays expired); 119 s is still searching', async () => {
    await student2.post(QM, { subject: 'SAINS', match_mode: 'same_level' })
    t.clock.advance(119_000)
    expect(await poll(student2)).toEqual({ status: 'searching' })
    t.clock.advance(1000)
    expect(await poll(student2)).toEqual({ status: 'expired' })
    expect(await poll(student2)).toEqual({ status: 'expired' })
    const mine = (await searches()).filter((s) => s.user_id === student2.userId)
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ status: 'expired' })
    // a new search starts afresh
    await student2.post(QM, FORM)
    expect(await poll(student2)).toEqual({ status: 'searching' })
  })

  it('cancel always answers cancelled, turns searching into cancelled and leaves matched / absent searches alone', async () => {
    const none = await teacher.post(`${QM}/cancel`)
    expect(none.status).toBe(200)
    expect(GamesQuickMatchCancelResponseSchema.parse(none.body)).toEqual({ status: 'cancelled' })
    await teacher.post(QM, FORM)
    expect(await poll(teacher)).toEqual({ status: 'searching' })
    expect(
      GamesQuickMatchCancelResponseSchema.parse((await teacher.post(`${QM}/cancel`)).body),
    ).toEqual({ status: 'cancelled' })
    expect(await poll(teacher)).toEqual({ status: 'cancelled' })
    expect(
      (await searches()).filter((s) => s.user_id === teacher.userId).map((s) => s.status),
    ).toEqual(['cancelled'])
    // matched stays matched after a cancel
    const before = await poll(student)
    expect(before.status).toBe('matched')
    expect(
      GamesQuickMatchCancelResponseSchema.parse((await student.post(`${QM}/cancel`)).body),
    ).toEqual({ status: 'cancelled' })
    expect(await poll(student)).toEqual(before)
  })

  it('a caller without a grade gets DARJAH_4; overlapping third polls create exactly one room', async () => {
    await teacher.post(QM, FORM)
    await poll(teacher)
    await poll(teacher)
    const results = await Promise.all([1, 2, 3, 4].map(() => teacher.get(`${QM}/poll`)))
    const bodies = results.map((r) => GamesQuickMatchPollResponseSchema.parse(r.body))
    const codes = new Set(
      bodies
        .filter((b) => b.status === 'matched')
        .map((b) => (b as { room_code: string }).room_code),
    )
    expect(codes.size).toBe(1)
    const code = [...codes][0] as string
    expect(await roomOf(t.db, code)).toMatchObject({ grade_level: 'DARJAH_4', max_players: 4 })
    expect(
      await t.db.query(`select count(*)::int as n from game_rooms where host_id = $1`, [
        teacher.userId,
      ]),
    ).toEqual([{ n: 1 }])
  })

  it('Mod Pelajar: the search and the matched room are is_test', async () => {
    const mod = await loginAs(t, ACCOUNTS.admin, { mod: true })
    await mod.post(QM, FORM)
    await poll(mod)
    await poll(mod)
    const m = (await poll(mod)) as { status: string; room_code: string }
    expect(m.status).toBe('matched')
    expect(await roomOf(t.db, m.room_code)).toMatchObject({ is_test: true })
    expect((await searches()).filter((s) => s.user_id === mod.userId)[0]).toMatchObject({
      is_test: true,
    })
    // never offered on the hub
    const hub = await student.get('/api/games/hub')
    expect(JSON.stringify(hub.body)).not.toContain(m.room_code)
  })
})
