import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootGamesApp, loginAs, type Client, type GamesTestApp } from '../helpers'
import { FORM, ListBots, P, createRoom, demo001Students, fillAndStart, roomOf, userId } from './support'

/**
 * S7-T01 part 2, DM-67 (migration 0228): `game_rooms.session_id` is a new uuid each time a room starts, and a robot seat
 * has no user (ruling 6 on #497). The reversal is the one written in the file's own comment.
 */
const MIGRATION = readFileSync(fileURLToPath(new URL('../../../prisma/migrations/0228_s7_game_room_session/migration.sql', import.meta.url)), 'utf8')
const REVERSE = MIGRATION.split('\n')
  .filter((line) => /^-- {3}(DELETE|ALTER|DROP) /.test(line))
  .map((line) => line.slice(5))
  .join('\n')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('room session id and robot seats (DM-67)', () => {
  let t: GamesTestApp
  let student: Client

  const sessionOf = async (code: string) => (await roomOf(t.db, code)).session_id as string

  beforeAll(async () => {
    t = await bootGamesApp()
    student = await loginAs(t, ACCOUNTS.student)
    const kids = await demo001Students(t.db)
    t.ports.provideBotPool(new ListBots(kids.map((k) => ({ id: k.id, name: k.name, grade: k.grade }))))
  })
  afterAll(async () => {
    await t.close()
  })

  it('a waiting room has its own uuid', async () => {
    const a = await sessionOf(await createRoom(student, 'perang-fakta'))
    const b = await sessionOf(await createRoom(student, 'perang-fakta'))
    expect(a).toMatch(UUID)
    expect(b).toMatch(UUID)
    expect(a).not.toBe(b)
  })

  it('each start of a room writes a new uuid, and an action or a poll keeps it', async () => {
    const code = await createRoom(student, 'perang-fakta', { ...FORM, max_players: 2 })
    const waiting = await sessionOf(code)
    expect((await fillAndStart(student, 'perang-fakta', code)).status).toBe(200)
    const first = await sessionOf(code)
    expect(first).toMatch(UUID)
    expect(first).not.toBe(waiting)
    await student.get(P('perang-fakta', code))
    expect(await sessionOf(code)).toBe(first)

    await t.db.query(`update game_rooms set status = 'waiting', state = jsonb_build_object('seed', 'again') where code = $1`, [code])
    expect((await student.post(P('perang-fakta', code, '/start'))).status).toBe(200)
    const second = await sessionOf(code)
    expect(second).toMatch(UUID)
    expect(second).not.toBe(first)
  })

  it('the column refuses a null and a repeated value', async () => {
    const a = await createRoom(student, 'perang-fakta')
    const b = await createRoom(student, 'perang-fakta')
    await expect(t.db.query('update game_rooms set session_id = null where code = $1', [a])).rejects.toThrow(/session_id/)
    await expect(t.db.query('update game_rooms set session_id = $1 where code = $2', [await sessionOf(a), b])).rejects.toThrow(/uq_game_rooms_session_id/)
  })

  it('a room holds several robot seats and one seat per user; a robot seat does not break the room view', async () => {
    const code = await createRoom(student, 'perang-fakta')
    const seat = `insert into game_room_players (room_code, user_id, is_bot) values ($1, $2, $3)`
    await t.db.query(seat, [code, null, true])
    await t.db.query(seat, [code, null, true])
    const other = await userId(t.db, ACCOUNTS.student2)
    await t.db.query(seat, [code, other, false])
    await expect(t.db.query(seat, [code, other, false])).rejects.toThrow(/uq_game_room_players_room_code_user_id/)
    expect((await student.get(P('perang-fakta', code))).status).toBe(200)
  })

  it('reverses as its comment says and applies again: existing rooms get a value each', async () => {
    const codes = [await createRoom(student, 'perang-fakta'), await createRoom(student, 'perang-fakta')]
    await t.db.query(`insert into game_room_players (room_code, user_id, is_bot) values ($1, null, true)`, [codes[0]])
    await t.db.query(REVERSE)
    const columns = await t.db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'game_rooms' and column_name = 'session_id'`)
    expect(columns).toHaveLength(0)
    expect(await t.db.query(`select 1 from game_room_players where room_code = $1 and user_id is null`, [codes[0]])).toHaveLength(0)
    await t.db.query(MIGRATION)
    const [a, b] = await Promise.all(codes.map(sessionOf))
    expect(a).toMatch(UUID)
    expect(b).toMatch(UUID)
    expect(a).not.toBe(b)
  })
})
