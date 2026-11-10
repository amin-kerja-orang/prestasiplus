import { GamesHubSchema, GamesLobbySchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootGamesApp, loginAs, parseData, type Client, type GamesTestApp } from '../helpers'
import { FixedAccuracy, P, createRoom, demo001Students, fillAndStart, parseRoom } from './support'

/** S7-T01 part GAME-02 A: AC-GM-02.3 (no quiz tiles), GAME-R Top 10 order, ruling 62 (robot names). */
describe('Papan Bijak API gaps (GAME-02 A)', () => {
  let t: GamesTestApp
  let student: Client
  let admin: Client
  const enabled = async (): Promise<string[]> => parseData(await student.get('/api/games/hub'), GamesHubSchema).enabledGames
  const setTiles = (n: number) => t.db.query('update game_settings set boardgame_quiz_tiles = $1 where id = 1', [n])

  beforeAll(async () => {
    t = await bootGamesApp({ ports: { platformAccuracy: new FixedAccuracy(0.5) } })
    student = await loginAs(t, ACCOUNTS.student)
    admin = await loginAs(t, ACCOUNTS.admin)
    await t.db.query('update questions set is_active = false') // an empty bank
  })
  afterAll(async () => {
    await t.close()
  })

  it('AC-GM-02.3: with an empty bank Papan Bijak is hidden at 35 quiz tiles and listed at 0', async () => {
    expect(await enabled()).not.toContain('papan-bijak')
    await setTiles(0)
    expect(await enabled()).toContain('papan-bijak')
    await setTiles(35)
    expect(await enabled()).not.toContain('papan-bijak')
  })

  it('AC-GM-02.3: 35 tiles and an empty bank refuse the start; 0 tiles start, play to the end and write no practice_answers row', async () => {
    const refused = await createRoom(student, 'papan-bijak')
    const bad = await fillAndStart(t, student, 'papan-bijak', refused)
    expect(bad.status).toBe(422)
    expect(bad.body.error.message).toBe('Soalan tidak mencukupi.')

    await setTiles(0)
    const code = await createRoom(student, 'papan-bijak')
    let view = parseRoom(await fillAndStart(t, student, 'papan-bijak', code))
    expect(view.status).toBe('playing')
    for (let i = 0; i < 400 && view.status === 'playing'; i++) {
      view = parseRoom(await student.post(P('papan-bijak', code, '/action'), { type: 'roll' }))
    }
    expect(view.status).toBe('finished')
    expect(view.question).toBeUndefined()
    const st = await t.db.query<{ board: string[] }>('select state->\'board\' as board from game_rooms where code = $1', [code])
    expect(st[0]?.board.filter((x) => x === 'quiz')).toHaveLength(0)
    const rows = await t.db.query<{ n: number }>(
      'select count(*)::int as n from practice_answers where attempt_id = (select session_id from game_rooms where code = $1)',
      [code],
    )
    expect(rows[0]?.n).toBe(0)
    await setTiles(35)
  })

  it('GAME-R Top 10 order: menang desc, skor desc, jumlah asc, user id asc (not the standing row id)', async () => {
    const kids = await demo001Students(t.db)
    await t.db.query('delete from game_standings')
    const rows: [number, number, number, number][] = [
      // kid index, wins, jumlah, skor; inserted so the row id order is the opposite of the user id order
      [4, 5, 9, 500],
      [3, 5, 8, 500], // fewer games than idx 4 with the same menang and skor: ranks above it
      [2, 5, 9, 500],
      [1, 5, 9, 500], // same as idx 2 and 4: user id ascending
      [0, 6, 20, 100], // most menang: first
      [5, 5, 9, 600], // higher skor than the 500s
    ]
    for (const [i, wins, jumlah, skor] of rows)
      await t.db.query(
        `insert into game_standings (game, user_id, wins, jumlah, skor, betul) values ('papan-bijak', $1, $2, $3, $4, 0)`,
        [(kids[i] as { id: string }).id, wins, jumlah, skor],
      )
    const lobby = parseData(await admin.get('/api/games/papan-bijak/lobby'), GamesLobbySchema)
    if (!('top10' in lobby)) throw new Error('expected top10')
    expect(lobby.top10.map((r) => r.userId)).toEqual([0, 5, 3, 1, 2, 4].map((i) => (kids[i] as { id: string }).id))
  })

  it('ruling 62: one robot is "Robot PrestasiPlus"; two or more are numbered', async () => {
    await t.db.query('update questions set is_active = true')
    await setTiles(0)
    const one = await createRoom(student, 'papan-bijak', { subject: 'MATEMATIK', grade_level: 'TINGKATAN_4', match_mode: 'same_grade', max_players: 2 })
    const v1 = parseRoom(await fillAndStart(t, student, 'papan-bijak', one))
    expect(v1.players.filter((p) => p.isBot).map((p) => p.name)).toEqual(['Robot PrestasiPlus'])
    // Kuiz Relay needs 4 seats, so 3 robots join the host (the name is built for every room game)
    const two = await createRoom(student, 'kuiz-relay')
    t.clock.advance(30_000)
    const v2 = parseRoom(await student.get(P('kuiz-relay', two)))
    expect(v2.players.filter((p) => p.isBot).map((p) => p.name)).toEqual(['Robot PrestasiPlus 1', 'Robot PrestasiPlus 2', 'Robot PrestasiPlus 3'])
  })
})
