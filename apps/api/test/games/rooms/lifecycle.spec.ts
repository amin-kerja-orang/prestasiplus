import { GamesHubSchema, GamesQuickMatchPollResponseSchema, GAMES_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { RoomsService } from '../../../src/modules/games/rooms/rooms.service'
import { ACCOUNTS, FakeRewards, bootGamesApp, expectError, loginAs, parseData, type Client, type GamesTestApp } from '../helpers'
import { FORM, FixedAccuracy, P, PB_FORM, ageRoom, createRoom, fillAndStart, insertShortMcqs, parseRoom, roomOf } from './support'

const M = GAMES_MESSAGES
const QM = '/api/papan-bijak/quick-match'
const join = (c: Client, game: string, code: string) => c.post(P(game, undefined, '/join'), { room_code: code })
const leave = (c: Client, game: string, code: string) => c.post(P(game, code, '/action'), { type: 'leave' })
const statusOf = async (t: GamesTestApp, code: string) => String((await roomOf(t.db, code)).status)
const seats = async (t: GamesTestApp, code: string) =>
  t.db.query<{ user_id: string | null }>('select user_id::text from game_room_players where room_code = $1 order by id', [code])

describe('room join and lifecycle (S7-T01 part GAME-R): FR-GM-R.1..R.7, ruling 16', () => {
  let t: GamesTestApp
  let student: Client // Tingkatan 4
  let student2: Client // Tingkatan 4
  let maju: Client // Tingkatan 5
  let teacher: Client
  const rewards = new FakeRewards()

  beforeAll(async () => {
    t = await bootGamesApp({ ports: { rewards, platformAccuracy: new FixedAccuracy(0) } })
    await insertShortMcqs(t.db, { subject: 'MATH', level: 'T4', count: 60, prefix: 'LC' })
    student = await loginAs(t, ACCOUNTS.student)
    student2 = await loginAs(t, ACCOUNTS.student2)
    maju = await loginAs(t, ACCOUNTS.studentMaju)
    teacher = await loginAs(t, ACCOUNTS.teacher)
  })
  afterAll(async () => {
    await t.close()
  })

  describe('join refusals and their order (FR-GM-R.2, AC-GM-R.2, AC-GM-R.6)', () => {
    it('the texts: ERR-GAME-07 404, ERR-GAME-09 409, ERR-GAME-08 409', () => {
      expect(M.roomNotFound).toBe('Bilik tidak dijumpai.')
      expect(M.startAlreadyStarted).toBe('Permainan sudah dimulakan.')
      expect(M.roomFull).toBe('Bilik sudah penuh.')
    })

    it('1 unknown room: 404 first, whatever else would apply', async () => {
      expectError(await join(maju, 'benteng-ilmu', 'ZZZZZZ'), 'NOT_FOUND', M.roomNotFound)
      expectError(await join(maju, 'benteng-ilmu', 'AB12C'), 'NOT_FOUND', M.roomNotFound) // malformed
    })

    it('2 started: 409 "Permainan sudah dimulakan." even when the room is also full and the Tingkatan does not fit', async () => {
      const code = await createRoom(student, 'benteng-ilmu') // 2 seats, same_grade T4
      expect((await join(student2, 'benteng-ilmu', code)).status).toBe(200) // now full
      await t.db.query(`update game_rooms set status = 'playing' where code = $1`, [code])
      expectError(await join(maju, 'benteng-ilmu', code), 'CONFLICT', M.startAlreadyStarted)
      await t.db.query(`update game_rooms set status = 'finished' where code = $1`, [code])
      expectError(await join(maju, 'benteng-ilmu', code), 'CONFLICT', M.startAlreadyStarted)
    })

    it('3 full: 409 "Bilik sudah penuh." before the Tingkatan check', async () => {
      const code = await createRoom(student, 'benteng-ilmu')
      expect((await join(student2, 'benteng-ilmu', code)).status).toBe(200)
      expectError(await join(maju, 'benteng-ilmu', code), 'CONFLICT', M.roomFull) // maju is T5: also the wrong Tingkatan
    })

    it('4 Tingkatan: AC-GM-R.6 answers 403 "Tindakan tidak sah." only when the room is waiting with a free seat', async () => {
      const code = await createRoom(student, 'perang-fakta')
      expectError(await join(maju, 'perang-fakta', code), 'FORBIDDEN', M.actionType)
      expect((await seats(t, code)).length).toBe(1)
      expect((await join(student2, 'perang-fakta', code)).status).toBe(200)
    })

    it('a closed room no longer joins: 404 "Bilik tidak dijumpai."; a seated player re-joining still gets the code', async () => {
      const code = await createRoom(student, 'perang-fakta')
      expect((await join(student2, 'perang-fakta', code)).status).toBe(200)
      await t.db.query(`update game_rooms set status = 'closed' where code = $1`, [code])
      expectError(await join(maju, 'perang-fakta', code), 'NOT_FOUND', M.roomNotFound)
      expect((await join(student2, 'perang-fakta', code)).status).toBe(200)
    })
  })

  describe('leave a waiting room (Keluar, ruling 16)', () => {
    it('a non-host leaving frees the seat: another pupil can take it', async () => {
      const code = await createRoom(student, 'benteng-ilmu')
      await join(student2, 'benteng-ilmu', code)
      expectError(await join(teacher, 'benteng-ilmu', code), 'CONFLICT', M.roomFull)
      const res = await leave(student2, 'benteng-ilmu', code)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect((await seats(t, code)).map((s) => s.user_id)).toEqual([student.userId])
      expect(await statusOf(t, code)).toBe('waiting')
      expect((await join(teacher, 'benteng-ilmu', code)).status).toBe(200)
      // the leaver is no longer a player
      expectError(await student2.get(P('benteng-ilmu', code)), 'NOT_FOUND', M.roomNotFound)
    })

    it('the host leaving closes the room; the others see it closed and the code no longer joins', async () => {
      const code = await createRoom(student, 'perang-fakta')
      await join(student2, 'perang-fakta', code)
      const res = await leave(student, 'perang-fakta', code)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(parseRoom(res).status).toBe('closed')
      expect(await statusOf(t, code)).toBe('closed')
      const seen = parseRoom(await student2.get(P('perang-fakta', code)))
      expect(seen.status).toBe('closed')
      expect(seen.state).toBeNull()
      expectError(await join(maju, 'perang-fakta', code), 'NOT_FOUND', M.roomNotFound)
      // it is off the hub strip
      const hub = parseData(await maju.get('/api/games/hub'), GamesHubSchema)
      expect(hub.openRooms.map((r) => r.code)).not.toContain(code)
    })

    it('leave on a closed or finished room answers its view unchanged', async () => {
      const code = await createRoom(student, 'perang-fakta')
      await leave(student, 'perang-fakta', code)
      const again = await leave(student, 'perang-fakta', code)
      expect(parseRoom(again).status).toBe('closed')
    })

    it('a stranger cannot leave (404), and an unknown action type is still 422', async () => {
      const code = await createRoom(student, 'perang-fakta')
      expectError(await leave(maju, 'perang-fakta', code), 'NOT_FOUND', M.roomNotFound)
      const bad = await student.post(P('perang-fakta', code, '/action'), { type: 'Leave' })
      expectError(bad, 'VALIDATION_ERROR', M.actionType)
    })
  })

  describe('leave a playing room: forfeit, 0 XP, no reward (48 GAME-R, ruling 50)', () => {
    it('the only human leaving ends the game with no winner, no reward call and no settlement (nobody is left to win by default)', async () => {
      const before = rewards.calls.length
      const code = await createRoom(student, 'perang-fakta')
      parseRoom(await fillAndStart(t, student, 'perang-fakta', code))
      const res = await leave(student, 'perang-fakta', code)
      const view = parseRoom(res)
      expect(view.status).toBe('finished')
      expect(view.result?.winnerId).toBeNull()
      expect(view.result?.reward).toBeUndefined()
      expect(await statusOf(t, code)).toBe('finished')
      expect(rewards.calls.length).toBe(before) // no reward call at all: 0 XP, no coins
      // a second leave changes nothing
      expect(parseRoom(await student.get(P('perang-fakta', code))).status).toBe('finished')
    })

    it('Papan Bijak with another human seated: the leaver gets jumlah + 1, menang 0, betul 0, skor 0 (ruling 50)', async () => {
      const code = await createRoom(student, 'papan-bijak', PB_FORM)
      await join(student2, 'papan-bijak', code)
      parseRoom(await student.post(P('papan-bijak', code, '/start')))
      const res = await leave(student, 'papan-bijak', code)
      expect(parseRoom(res).status).toBe('finished')
      const rows = await t.db.query(
        `select wins, jumlah, skor, betul from game_standings where game = 'papan-bijak' and user_id = $1`,
        [student.userId],
      )
      expect(rows).toEqual([{ wins: 0, jumlah: 1, skor: 0, betul: 0 }])
    })

    it('a robot-only game moves no standing when its host leaves', async () => {
      const code = await createRoom(teacher, 'papan-bijak', { ...PB_FORM, match_mode: 'same_level' })
      parseRoom(await fillAndStart(t, teacher, 'papan-bijak', code))
      expect(parseRoom(await leave(teacher, 'papan-bijak', code)).status).toBe('finished')
      expect(await t.db.query(`select 1 from game_standings where user_id = $1`, [teacher.userId])).toHaveLength(0)
    })

    it('R1 Q1 (lead answers on #983): with 3 humans one leaving, a robot takes the seat and the game goes on; the leaver gets jumlah + 1 and no reward', async () => {
      await t.db.query("delete from game_standings where game = 'papan-bijak'")
      const before = rewards.calls.length
      const code = await createRoom(student, 'papan-bijak', PB_FORM)
      await join(student2, 'papan-bijak', code)
      await join(teacher, 'papan-bijak', code)
      parseRoom(await student.post(P('papan-bijak', code, '/start')))
      const view = parseRoom(await leave(student2, 'papan-bijak', code))
      expect(view.status).toBe('playing')
      expect(view.players.map((p) => p.isBot)).toEqual([false, true, false]) // the seat keeps its place
      expect((await seats(t, code)).map((s) => s.user_id)).toEqual([student.userId, null, teacher.userId])
      // ruling 50.4: the leaver's jumlah is written only when the game finishes settled, not at the takeover
      expect(await t.db.query(`select 1 from game_standings where game = 'papan-bijak' and user_id = $1`, [student2.userId])).toHaveLength(0)
      // the second leaver leaves one present human, who wins by default: the game is settled and BOTH leavers get jumlah + 1, menang 0
      const done = parseRoom(await leave(teacher, 'papan-bijak', code))
      expect(done.status).toBe('finished')
      expect(done.result?.winnerId).toBe(student.userId)
      for (const leaver of [student2, teacher]) {
        expect(await t.db.query(`select wins, jumlah, skor, betul from game_standings where game = 'papan-bijak' and user_id = $1`, [leaver.userId])).toEqual([
          { wins: 0, jumlah: 1, skor: 0, betul: 0 },
        ])
      }
      expect(await t.db.query(`select wins, jumlah from game_standings where game = 'papan-bijak' and user_id = $1`, [student.userId])).toEqual([{ wins: 1, jumlah: 1 }])
      expect(rewards.calls.length).toBe(before + 1) // only the stayer is rewarded
      expect(await t.db.query("select 1 from game_room_players where room_code = $1 and is_bot and user_id is not null", [code])).toHaveLength(0)
    })

    it('R1 Q1: the HOST leaving with 2 humans left does not end the game: the default win is not tied to the host role', async () => {
      await t.db.query("delete from game_standings where game = 'papan-bijak'")
      const code = await createRoom(student, 'papan-bijak', PB_FORM)
      await join(student2, 'papan-bijak', code)
      await join(teacher, 'papan-bijak', code)
      parseRoom(await student.post(P('papan-bijak', code, '/start')))
      expect(parseRoom(await leave(student, 'papan-bijak', code)).status).toBe('playing')
      // the second leaver leaves exactly one human: that human (present) wins by default, whoever hosts
      const done = parseRoom(await leave(student2, 'papan-bijak', code))
      expect(done.status).toBe('finished')
      expect(done.result?.winnerId).toBe(teacher.userId)
      expect(await t.db.query(`select wins, jumlah from game_standings where game = 'papan-bijak' and user_id = $1`, [teacher.userId])).toEqual([{ wins: 1, jumlah: 1 }])
      expect(await t.db.query(`select wins, jumlah from game_standings where game = 'papan-bijak' and user_id = $1`, [student.userId])).toEqual([{ wins: 0, jumlah: 1 }])
    })

    it('R1 Q2: the leaver of another room game (Kuiz Relay) also gets jumlah + 1, menang 0', async () => {
      await t.db.query(`delete from game_standings where game = 'kuiz-relay'`)
      const code = await createRoom(student, 'kuiz-relay', { ...FORM, max_players: 4 })
      await join(student2, 'kuiz-relay', code)
      await ageRoom(t, code)
      parseRoom(await student.post(P('kuiz-relay', code, '/start')))
      parseRoom(await leave(student2, 'kuiz-relay', code))
      expect(await t.db.query(`select wins, jumlah from game_standings where game = 'kuiz-relay' and user_id = $1`, [student2.userId])).toEqual([{ wins: 0, jumlah: 1 }])
    })

    it('ruling 50: with nobody present left nothing is settled (the last human is absent)', async () => {
      await t.db.query("delete from game_standings where game = 'papan-bijak'")
      const before = rewards.calls.length
      const code = await createRoom(student, 'papan-bijak', PB_FORM)
      await join(student2, 'papan-bijak', code)
      parseRoom(await student.post(P('papan-bijak', code, '/start')))
      t.clock.advance(45_000) // the other human has not polled for longer than games_absent_seconds (30 s)
      parseRoom(await leave(student, 'papan-bijak', code))
      const room = await roomOf(t.db, code)
      expect(room.status).toBe('finished')
      expect(room.settled_at).not.toBeNull()
      expect(rewards.calls.length).toBe(before)
      expect(await t.db.query(`select 1 from game_standings where user_id = $1 and wins > 0`, [student2.userId])).toHaveLength(0)
      // ruling 50.4: nothing is settled, so the leaver gets no jumlah either
      expect(await t.db.query(`select 1 from game_standings where game = 'papan-bijak' and user_id = $1`, [student.userId])).toHaveLength(0)
    })
  })

  describe('waiting rooms close after room_waiting_minutes (FR-GM-R.5, AC-GM-R.4, ruling 51)', () => {
    it('a waiting room idle for 15 minutes since creation is closed by the sweep; its code no longer joins; a playing room is left alone', async () => {
      const rooms = t.app.get(RoomsService, { strict: false })
      const stale = await createRoom(student, 'perang-fakta')
      const fresh = await createRoom(student, 'benteng-ilmu')
      const playing = await createRoom(student, 'kuiz-relay', FORM)
      await t.db.query(`update game_rooms set status = 'playing' where code = $1`, [playing])
      await t.db.query(`update game_rooms set created_at = created_at - interval '14 minutes 59 seconds' where code = $1`, [stale])
      expect(await rooms.closeStaleWaiting()).toBe(0)
      expect(await statusOf(t, stale)).toBe('waiting')
      t.clock.advance(1_000) // 15 minutes exactly since creation (the injected clock)
      expect(await rooms.closeStaleWaiting()).toBe(1)
      expect(await statusOf(t, stale)).toBe('closed')
      expect(await statusOf(t, fresh)).toBe('waiting')
      expect(await statusOf(t, playing)).toBe('playing')
      expectError(await join(student2, 'perang-fakta', stale), 'NOT_FOUND', M.roomNotFound)
      expect(await rooms.closeStaleWaiting()).toBe(0) // idempotent
      await leave(student, 'benteng-ilmu', fresh)
    })

    it('a stale waiting room the sweep has not reached yet is already refused at join and hidden from the strip', async () => {
      const code = await createRoom(student, 'perang-fakta')
      await t.db.query(`update game_rooms set created_at = created_at - interval '16 minutes' where code = $1`, [code])
      expectError(await join(student2, 'perang-fakta', code), 'NOT_FOUND', M.roomNotFound)
      const hub = parseData(await student2.get('/api/games/hub'), GamesHubSchema)
      expect(hub.openRooms.map((r) => r.code)).not.toContain(code)
      await t.app.get(RoomsService, { strict: false }).closeStaleWaiting()
      expect(await statusOf(t, code)).toBe('closed')
    })
  })

  describe('open-rooms strip is filtered by the Tingkatan (FR-GM-R.7, ruling 52)', () => {
    it('a pupil sees only the waiting rooms whose match mode fits their Tingkatan, from any school; newest first, at most 6', async () => {
      await t.db.query('delete from game_rooms')
      const sameGrade = await createRoom(student, 'perang-fakta') // T4 only
      t.clock.advance(1_000)
      const sameLevel = await createRoom(student, 'benteng-ilmu', { ...FORM, match_mode: 'same_level' })
      t.clock.advance(1_000)
      const custom = await createRoom(student, 'papan-bijak', { ...PB_FORM, match_mode: 'custom', grade_min: 7, grade_max: 9 })
      const codesFor = async (c: Client) => parseData(await c.get('/api/games/hub'), GamesHubSchema).openRooms.map((r) => r.code)
      expect(await codesFor(student2)).toEqual([sameLevel, sameGrade]) // T4: not the T1-T3 custom room
      expect(await codesFor(maju)).toEqual([sameLevel]) // T5
      expect(await codesFor(teacher)).toEqual([custom, sameLevel, sameGrade]) // no grade: every room
    })

    it('the limit of 6 is applied after the filter', async () => {
      await t.db.query('delete from game_rooms')
      for (let i = 0; i < 6; i++) {
        t.clock.advance(1_000)
        await createRoom(maju, 'perang-fakta', { ...FORM, grade_level: 'TINGKATAN_5' }) // T5 only
      }
      t.clock.advance(1_000)
      const mine = await createRoom(student, 'perang-fakta') // newest of all, T4
      t.clock.advance(1_000)
      for (let i = 0; i < 6; i++) await createRoom(maju, 'benteng-ilmu', { ...FORM, grade_level: 'TINGKATAN_5' })
      const hub = parseData(await student2.get('/api/games/hub'), GamesHubSchema)
      expect(hub.openRooms.map((r) => r.code)).toEqual([mine])
    })
  })

  describe('robot countdown counts from creation (FR-GM-R.3, ruling 53)', () => {
    it('robotInSeconds is the seconds left of battle_bot_fallback_seconds (30) since creation; absent once the minimum is met', async () => {
      const code = await createRoom(student, 'perang-fakta')
      expect(parseRoom(await student.get(P('perang-fakta', code))).robotInSeconds).toBe(30)
      t.clock.advance(12_500)
      expect(parseRoom(await student.get(P('perang-fakta', code))).robotInSeconds).toBe(18)
      await join(student2, 'perang-fakta', code) // 2 players: the minimum of Perang Fakta
      expect(parseRoom(await student.get(P('perang-fakta', code))).robotInSeconds).toBeUndefined()
    })

    it('after the wait a host poll seats the robot; no real pupil is added', async () => {
      const code = await createRoom(student, 'perang-fakta')
      await ageRoom(t, code)
      const view = parseRoom(await student.get(P('perang-fakta', code)))
      expect(view.players.map((p) => p.isBot)).toEqual([false, true])
      expect(view.robotInSeconds).toBeUndefined()
    })
  })

  describe('Cari Lawan Auto pairs two pupils before a robot (ruling 16, Papan Bijak)', () => {
    const FORM_QM = { subject: 'MATEMATIK', match_mode: 'same_grade' }
    const poll = async (c: Client) => GamesQuickMatchPollResponseSchema.parse((await c.get(`${QM}/poll`)).body)
    const roomsOfHost = async (id: string) =>
      t.db.query<{ code: string }>(`select code from game_rooms where host_id = $1 and game = 'papan-bijak'`, [id])

    it('two compatible pupils end in one room, both seated as real players, with no robot (each pupil plays their own turns since R2)', async () => {
      await t.db.query('delete from pb_searches')
      await student.post(QM, FORM_QM)
      expect(await poll(student)).toEqual({ status: 'searching' })
      await student2.post(QM, FORM_QM)
      const second = await poll(student2) // first poll of student2: finds student and matches at once
      expect(second.status).toBe('matched')
      const code = (second as { room_code: string }).room_code
      expect((await seats(t, code)).map((s) => s.user_id)).toEqual([student2.userId, student.userId])
      expect(await t.db.query('select 1 from game_room_players where room_code = $1 and is_bot', [code])).toHaveLength(0)
      expect(await poll(student)).toEqual({ status: 'matched', room_code: code }) // the waiting pupil reads the same room
      expect(await t.db.query(`select 1 from pb_searches where status = 'matched' and room_code = $1`, [code])).toHaveLength(2)
      // the poller is the host; the other pupil sees both players
      const view = parseRoom(await student.get(P('papan-bijak', code)))
      expect(view.host.id).toBe(student2.userId)
      expect(view.players.map((p) => p.isBot)).toEqual([false, false])
    })

    it('concurrent polls make one room: two pupils polling at once never make two, and both converge on one code', async () => {
      await t.db.query('delete from pb_searches')
      await t.db.query('delete from game_rooms')
      await student.post(QM, FORM_QM)
      await student2.post(QM, FORM_QM)
      await Promise.all([student.get(`${QM}/poll`), student2.get(`${QM}/poll`)])
      const a = await poll(student)
      const b = await poll(student2)
      expect(a.status).toBe('matched')
      expect(b).toEqual(a)
      expect(await t.db.query(`select 1 from game_rooms where game = 'papan-bijak'`)).toHaveLength(1)
      // overlapping polls of one pupil also make one room
      await t.db.query('delete from pb_searches')
      await t.db.query('delete from game_rooms')
      await teacher.post(QM, FORM_QM)
      const bodies = (await Promise.all([1, 2, 3, 4].map(() => teacher.get(`${QM}/poll`)))).map((r) => GamesQuickMatchPollResponseSchema.parse(r.body))
      expect(new Set(bodies.filter((x) => x.status === 'matched').map((x) => (x as { room_code: string }).room_code)).size).toBeLessThanOrEqual(1)
      expect((await roomsOfHost(teacher.userId)).length).toBeLessThanOrEqual(1)
    })

    it('pupils who do not fit are not paired: another subject, another Tingkatan for same_grade, or Mod Pelajar vs a normal pupil', async () => {
      await t.db.query('delete from pb_searches')
      await student.post(QM, FORM_QM)
      await maju.post(QM, FORM_QM) // T5 against T4 under same_grade
      expect(await poll(maju)).toEqual({ status: 'searching' })
      await teacher.post(QM, { subject: 'SAINS', match_mode: 'same_grade' })
      expect(await poll(teacher)).toEqual({ status: 'searching' })
      const mod = await loginAs(t, ACCOUNTS.admin, { mod: true })
      await mod.post(QM, FORM_QM)
      expect(await poll(mod)).toEqual({ status: 'searching' })
      for (const c of [student, maju, teacher, mod]) await c.post(`${QM}/cancel`)
    })

    it('with nobody to pair the third poll still brings the robot', async () => {
      await t.db.query('delete from pb_searches')
      await student.post(QM, FORM_QM)
      await poll(student)
      await poll(student)
      const m = await poll(student)
      expect(m.status).toBe('matched')
      const players = await seats(t, (m as { room_code: string }).room_code)
      expect(players.map((p) => p.user_id)).toEqual([student.userId, null])
    })
  })
})
