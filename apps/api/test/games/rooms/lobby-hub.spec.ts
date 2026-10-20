import { GamesHubSchema, GamesLobbySchema, GAMES_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ACCOUNTS,
  bootGamesApp,
  expectError,
  loginAs,
  parseData,
  type Client,
  type GamesTestApp,
} from '../helpers'
import { FORM, P, createRoom, demo001Students, userId } from './support'

describe('hub and lobby (M16-22, M16-23)', () => {
  let t: GamesTestApp
  let student: Client
  let student2: Client
  let admin: Client
  const battled = new Set<string>()

  beforeAll(async () => {
    t = await bootGamesApp({ ports: { battle: { hasBattled: async (id) => battled.has(id) } } })
    student = await loginAs(t, ACCOUNTS.student)
    student2 = await loginAs(t, ACCOUNTS.student2)
    admin = await loginAs(t, ACCOUNTS.admin)
  })
  afterAll(async () => {
    await t.close()
  })

  it('hub: empty, then lists a free room with the host display name; no-store; parsed by the contract', async () => {
    const empty = await student.get('/api/games/hub')
    expect(empty.headers['cache-control']).toBe('no-store')
    expect(parseData(empty, GamesHubSchema)).toEqual({
      openRooms: [],
      chips: { papanBijakPlayed: false, battled: false },
    })
    const code = await createRoom(student, 'papan-bijak')
    const hub = parseData(await student2.get('/api/games/hub'), GamesHubSchema)
    expect(hub.openRooms).toEqual([
      { game: 'papan-bijak', code, host: 'Murid Demo', players: 1, max: 4 },
    ])
  })

  it('hub: full and non-waiting rooms are hidden; at most 6 newest first, code ascending on a tie', async () => {
    await t.db.query('delete from game_rooms')
    // two rooms at the same instant: code ascending
    const a = await createRoom(student, 'perang-fakta')
    const b = await createRoom(student, 'perang-fakta')
    const tie = parseData(await student.get('/api/games/hub'), GamesHubSchema).openRooms.map(
      (r) => r.code,
    )
    expect(tie).toEqual([a, b].sort())
    for (let i = 0; i < 7; i++) {
      t.clock.advance(1000)
      await createRoom(student, 'kuiz-relay')
    }
    const hub = parseData(await student.get('/api/games/hub'), GamesHubSchema)
    expect(hub.openRooms).toHaveLength(6)
    expect(hub.openRooms.every((r) => r.game === 'kuiz-relay' && r.max === 8)).toBe(true)
    // a full room (benteng, 2 seats) is not offered; a started room is not offered
    await t.db.query('delete from game_rooms')
    const full = await createRoom(student, 'benteng-ilmu', { ...FORM, match_mode: 'same_level' })
    expect(
      (await student2.post(P('benteng-ilmu', undefined, '/join'), { room_code: full })).status,
    ).toBe(200)
    expect(parseData(await student.get('/api/games/hub'), GamesHubSchema).openRooms).toEqual([])
    const open = await createRoom(student, 'perang-fakta')
    await t.db.query(`update game_rooms set status = 'playing' where code = $1`, [open])
    expect(parseData(await student.get('/api/games/hub'), GamesHubSchema).openRooms).toEqual([])
  })

  it('hub: rooms of a Mod Pelajar (test) host are never listed', async () => {
    await t.db.query('delete from game_rooms')
    const mod = await loginAs(t, ACCOUNTS.admin, { mod: true })
    const code = await createRoom(mod, 'perang-fakta')
    expect(await t.db.query('select is_test from game_rooms where code = $1', [code])).toEqual([
      { is_test: true },
    ])
    expect(parseData(await student.get('/api/games/hub'), GamesHubSchema).openRooms).toEqual([])
    expect(parseData(await mod.get('/api/games/hub'), GamesHubSchema).openRooms).toEqual([])
  })

  it('hub chips: papanBijakPlayed needs a standing with jumlah > 0; battled comes from the battle port', async () => {
    const sid = await userId(t.db, ACCOUNTS.student)
    await t.db.query(
      `insert into game_standings (game, user_id, wins, jumlah) values ('papan-bijak', $1, 0, 0)`,
      [sid],
    )
    expect(parseData(await student.get('/api/games/hub'), GamesHubSchema).chips).toEqual({
      papanBijakPlayed: false,
      battled: false,
    })
    await t.db.query(`update game_standings set jumlah = 2 where user_id = $1`, [sid])
    battled.add(sid)
    expect(parseData(await student.get('/api/games/hub'), GamesHubSchema).chips).toEqual({
      papanBijakPlayed: true,
      battled: true,
    })
    expect(parseData(await student2.get('/api/games/hub'), GamesHubSchema).chips).toEqual({
      papanBijakPlayed: false,
      battled: false,
    })
  })

  it('lobby: unknown game 404; autoGrade of the caller (null without a grade)', async () => {
    expectError(
      await student.get('/api/games/tidak-ada/lobby'),
      'NOT_FOUND',
      GAMES_MESSAGES.gameNotFound,
    )
    expectError(
      await student.get('/api/games/solo/lobby'),
      'NOT_FOUND',
      GAMES_MESSAGES.gameNotFound,
    )
    const mine = parseData(await student.get('/api/games/benteng-ilmu/lobby'), GamesLobbySchema)
    expect(mine).toMatchObject({
      autoGrade: 'TINGKATAN_4',
      autoGradeName: 'Tingkatan 4',
      leaders: [],
    })
    const none = parseData(await admin.get('/api/games/benteng-ilmu/lobby'), GamesLobbySchema)
    expect(none).toMatchObject({ autoGrade: null, autoGradeName: null })
  })

  it('lobby: Papan Bijak top10 order, truncated name, initials, kadar; jumlah 0, test and ordering rules', async () => {
    const kids = await demo001Students(t.db)
    expect(kids.length).toBeGreaterThanOrEqual(5)
    await t.db.query('delete from game_standings')
    const rows: [number, number, number, number, number, boolean][] = [
      // idx, wins, jumlah, skor, betul, is_test
      [0, 5, 10, 400, 50, false],
      [1, 5, 8, 500, 40, false], // same wins, higher skor -> first
      [2, 5, 9, 500, 41, false], // same wins and skor as idx 1 -> creation order after idx 1
      [3, 9, 0, 0, 0, false], // jumlah 0 -> hidden
      [4, 20, 20, 900, 90, true], // test -> hidden
    ]
    for (const [i, wins, jumlah, skor, betul, isTest] of rows) {
      await t.db.query(
        `insert into game_standings (game, user_id, wins, jumlah, skor, betul, is_test) values ('papan-bijak', $1, $2, $3, $4, $5, $6)`,
        [(kids[i] as { id: string }).id, wins, jumlah, skor, betul, isTest],
      )
    }
    const lobby = parseData(await student.get('/api/games/papan-bijak/lobby'), GamesLobbySchema)
    if (!('top10' in lobby)) throw new Error('expected top10')
    expect(lobby.top10.map((r) => r.userId)).toEqual(
      [kids[1], kids[2], kids[0]].map((k) => (k as { id: string }).id),
    )
    expect(lobby.top10.map((r) => r.rank)).toEqual([1, 2, 3])
    const first = lobby.top10[0] as (typeof lobby.top10)[number]
    const fullName = (kids[1] as { name: string }).name
    expect(first.name).toBe(fullName.length > 15 ? `${fullName.slice(0, 15)}...` : fullName)
    expect(first.initials).toBe(
      fullName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join(''),
    )
    expect(first).toMatchObject({ menang: 5, jumlah: 8, kadar: 63, skor: 500, betul: 40 })
    expect(JSON.stringify(lobby)).not.toMatch(/@|email|phone/)
  })

  it('lobby: other games list leaders with wins > 0 (wins desc, creation order), full names', async () => {
    const kids = await demo001Students(t.db)
    await t.db.query('delete from game_standings')
    for (const [i, wins] of [
      [0, 1],
      [1, 4],
      [2, 4],
      [3, 0],
    ] as const) {
      await t.db.query(
        `insert into game_standings (game, user_id, wins, jumlah) values ('kuiz-relay', $1, $2, 0)`,
        [(kids[i] as { id: string }).id, wins],
      )
    }
    const lobby = parseData(await student.get('/api/games/kuiz-relay/lobby'), GamesLobbySchema)
    if (!('leaders' in lobby)) throw new Error('expected leaders')
    expect(lobby.leaders.map((l) => [l.userId, l.value, l.name])).toEqual(
      [1, 2, 0].map((i, n) => [
        (kids[i] as { id: string }).id,
        [4, 4, 1][n],
        (kids[i] as { name: string }).name,
      ]),
    )
    expect(lobby.leaders.map((l) => l.rank)).toEqual([1, 2, 3])
  })

  it('hub and lobby need a session (401)', async () => {
    expectError(await t.http().get('/api/games/hub'), 'UNAUTHORIZED', 'Unauthenticated.')
    expectError(
      await t.http().get('/api/games/papan-bijak/lobby'),
      'UNAUTHORIZED',
      'Unauthenticated.',
    )
  })
})
