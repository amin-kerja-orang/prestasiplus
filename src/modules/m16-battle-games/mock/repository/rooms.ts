/**
 * The `rooms` repository (owner M16; SRS M16 v1.6 DATA-M16-06/07/13/14, BR-M16-17…24, BR-M16-36, §7 #22-#31,
 * #51-#52): the games hub reads, the six room lobbies and their standings, room create / join / poll /
 * start / action, the Papan Bijak quick match and the game settings. Every other player is a SIMULATION
 * (D4); the rules of the games are PROVISIONAL (`./room-engine.ts`).
 */

import type { Prng, PrngRegistry } from '@/mock/determinism'
import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import { users, type UserRow } from '@/modules/m01-authentication/mock'

import {
  BOARD_NON_PLAIN,
  MAX_QUIZ_TILES,
  PAPAN_BIJAK_SUBJECTS,
  ROOM_COINS,
  ROOM_GAMES,
  ROOM_SUBJECTS,
  roomGameInfo,
  SEED_QUIZ_TILES,
  SEED_ROOMS,
  SEED_ROOM_PLAYERS,
  LOBBY_STANDINGS,
  PAPAN_BIJAK_STANDINGS,
  standingUserIds,
} from '../data/games'
import {
  battlesTable,
  gameRoomsTable,
  gameSettingsTable,
  gameStandingsTable,
  pbSearchesTable,
  roomPlayersTable,
} from '../tables/tables'
import type {
  GameRoomRow,
  GameStandingRow,
  MatchMode,
  PbSearchRow,
  RoomGame,
  RoomPlayerRow,
  RoomState,
  RoomSubject,
} from '../types'
import { botAccuracy } from './battle-pool'
import { gradeLabel, M16Error, m16Now, userName } from './common'
import {
  boardRates,
  drawFreeId,
  enumOfGrade,
  gradeOfEnum,
  isPrimary,
  keylessView,
  reportGame,
  roomCodeFrom,
} from './games-common'
import {
  applyAction,
  startGame,
  type EnginePlayer,
  type EngineRoom,
  type RoomAction,
} from './room-engine'

export const roomQueries = defineNamedQueries(gameRoomsTable, {
  'Q-ROOMS': { expected: SEED_ROOMS, source: 'M16 §6.10 (S29 "Jumlah Bilik")' },
  'Q-ROOMS-PLAYING': { where: { status: 'playing' }, expected: 0, source: 'M16 §6.10' },
  'Q-ROOMS-FINISHED': { where: { status: 'finished' }, expected: 0, source: 'M16 §6.10' },
})

export const standingQueries = defineNamedQueries(gameStandingsTable, {
  'Q-GAME-STANDING-ROWS': {
    where: (game: RoomGame) => ({ game, wins: { gte: 1 } }),
    expected: [
      { args: ['perang-fakta'], value: 10 },
      { args: ['benteng-ilmu'], value: 8 },
      { args: ['perlumbaan-matematik'], value: 10 },
      { args: ['kuiz-relay'], value: 1 },
      { args: ['teka-silang-kata'], value: 6 },
    ],
    source: 'M16 §6.10 Q-LOBBY-TOP',
  },
})

const MATCH_MODES: readonly MatchMode[] = ['same_grade', 'same_level', 'custom']
const QUICK_MATCH_ON_POLL = 3
const QUICK_MATCH_EXPIRES_MS = 120_000

const NOT_FOUND_ROOM = 'Bilik tidak dijumpai.'

export interface RoomCreateInput {
  subject: RoomSubject
  gradeLevel: string
  matchMode: MatchMode
  gradeMin: number | null
  gradeMax: number | null
  maxPlayers: number
}

/** Validates the S7 / S8–S12 create body (V-M16-01…05); the field names are the live ones. */
export function parseRoomBody(game: RoomGame, body: unknown): RoomCreateInput {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const info = roomGameInfo(game) as NonNullable<ReturnType<typeof roomGameInfo>>
  const subject = b.subject
  const allowed: readonly string[] =
    game === 'papan-bijak' ? PAPAN_BIJAK_SUBJECTS : Object.keys(ROOM_SUBJECTS)
  if (typeof subject !== 'string' || !allowed.includes(subject)) {
    throw new M16Error('VALIDATION_ERROR', 'Subjek tidak sah.', 'subject')
  }
  const gradeLevel = b.grade_level
  if (gradeOfEnum(gradeLevel) === null) {
    throw new M16Error('VALIDATION_ERROR', 'Tahap soalan tidak sah.', 'grade_level')
  }
  const mode = b.match_mode
  const modes = game === 'papan-bijak' ? MATCH_MODES : MATCH_MODES.slice(0, 2)
  if (typeof mode !== 'string' || !(modes as readonly string[]).includes(mode)) {
    throw new M16Error('VALIDATION_ERROR', 'Julat tahap tidak sah.', 'match_mode')
  }
  let gradeMin: number | null = null
  let gradeMax: number | null = null
  if (mode === 'custom') {
    const lo = b.grade_min
    const hi = b.grade_max
    if (
      typeof lo !== 'number' ||
      typeof hi !== 'number' ||
      !Number.isInteger(lo) ||
      !Number.isInteger(hi) ||
      lo < 1 ||
      hi > 11 ||
      lo > hi
    ) {
      throw new M16Error('VALIDATION_ERROR', 'Julat tahap tidak sah.', 'grade_min')
    }
    gradeMin = lo
    gradeMax = hi
  }
  let maxPlayers = info.maxPlayers
  if (game === 'papan-bijak') {
    const m = b.max_players
    if (typeof m !== 'number' || !Number.isInteger(m) || m < 2 || m > 6) {
      throw new M16Error('VALIDATION_ERROR', 'Bilangan pemain tidak sah.', 'max_players')
    }
    maxPlayers = m
  }
  return {
    subject: subject as RoomSubject,
    gradeLevel: gradeLevel as string,
    matchMode: mode as MatchMode,
    gradeMin,
    gradeMax,
    maxPlayers,
  }
}

/** Whether a user's grade fits a room's `match_mode` (BR-M16-18); a user without a grade fits. */
export function gradeFits(
  room: Pick<GameRoomRow, 'gradeLevel' | 'matchMode' | 'gradeMin' | 'gradeMax'>,
  grade: number | null,
): boolean {
  if (grade === null) return true
  const roomGrade = gradeOfEnum(room.gradeLevel) as number
  if (room.matchMode === 'same_grade') return grade === roomGrade
  if (room.matchMode === 'same_level') return isPrimary(grade) === isPrimary(roomGrade)
  return grade >= (room.gradeMin ?? 1) && grade <= (room.gradeMax ?? 11)
}

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] ?? '').toUpperCase())
    .join('')

/** BR-M16-22: name truncated to 15 characters + "...". */
const shortName = (name: string): string => (name.length > 15 ? `${name.slice(0, 15)}...` : name)

export const kadarOf = (menang: number, jumlah: number): number =>
  jumlah === 0 ? 0 : Math.round((menang / jumlah) * 100)

export interface RoomPlayerView {
  id: number
  name: string
  grade: string
  team?: number
  points: number
  isBot: boolean
}

export interface RoomView {
  code: string
  game: RoomGame
  status: GameRoomRow['status']
  host: { id: number; name: string }
  players: RoomPlayerView[]
  settings: {
    subject: RoomSubject
    gradeLevel: string
    matchMode: MatchMode
    gradeMin: number | null
    gradeMax: number | null
    maxPlayers: number
    minPlayers: number
  }
  state: {
    awaiting: 'roll' | 'answer' | null
    round: number
    total: number
    humanId: number
    board?: string[]
    positions?: Record<string, number>
    meter?: Record<string, number>
    teamScores?: Record<string, number>
    log: string[]
  } | null
  round?: number
  question?: { id: number; text: string; options: { id: number; label: string; text: string }[] }
  result?: {
    winnerId: number | null
    winnerName: string | null
    mvpId: number | null
    scores: { userId: number; name: string; points: number; correct: number }[]
  }
}

export const roomsRepo = defineRepository({
  owner: 'M16',
  name: 'rooms',
  store: gameRoomsTable,
  stores: {
    players: roomPlayersTable,
    standings: gameStandingsTable,
    searches: pbSearchesTable,
    settings: gameSettingsTable,
  },
  queries: roomQueries,
  methods: ({ store, stores, transaction }) => {
    const { players, standings, searches, settings } = stores

    const playersOf = (code: string): RoomPlayerRow[] =>
      players.query({ where: { roomCode: code }, sort: 'id' }).rows

    const mustUser = (id: number): UserRow => {
      const u = users.get(id)
      if (!u) throw new M16Error('NOT_FOUND', 'Pengguna tidak dijumpai.')
      return u
    }

    const quizTiles = (): number => settings.get(1)?.boardgameQuizTiles ?? SEED_QUIZ_TILES

    const newCode = (prng: PrngRegistry): string =>
      drawFreeId(prng, 'm16:room-code', store.size, roomCodeFrom, (id) => store.has(id))

    const addPlayer = (code: string, userId: number, isBot: boolean): RoomPlayerRow =>
      players.insert({
        roomCode: code,
        userId,
        team: null,
        points: 0,
        correct: 0,
        isBot,
        joinedAtMs: m16Now(),
      })

    /** A fictitious student fitting the room (BR-M16-19): grade fits, not already in the room. */
    const pickRoomBot = (room: GameRoomRow, rng: Prng): UserRow => {
      const present = new Set(playersOf(room.id).map((p) => p.userId))
      const draw = users.sample('U-ROLE-ACTIVE', 400, rng, 'student', true)
      const found =
        draw.find((u) => !present.has(u.id) && gradeFits(room, u.grade)) ??
        draw.find((u) => !present.has(u.id))
      if (!found) throw new M16Error('NOT_FOUND', 'Tiada pemain dijumpai.')
      return found
    }

    const addBot = (room: GameRoomRow, prng: PrngRegistry): void => {
      const rng = prng.fresh(`m16:room:${room.id}:bot:${String(playersOf(room.id).length)}`)
      addPlayer(room.id, pickRoomBot(room, rng).id, true)
    }

    const createRoom = (
      host: UserRow,
      game: RoomGame,
      input: RoomCreateInput,
      prng: PrngRegistry,
    ): GameRoomRow => {
      const code = newCode(prng)
      const row = store.insert({
        id: code,
        game,
        subject: input.subject,
        gradeLevel: input.gradeLevel,
        matchMode: input.matchMode,
        gradeMin: input.gradeMin,
        gradeMax: input.gradeMax,
        maxPlayers: input.maxPlayers,
        hostId: host.id,
        status: 'waiting',
        createdAtMs: m16Now(),
        startedAtMs: null,
        finishedAtMs: null,
        state: null,
      })
      addPlayer(code, host.id, false)
      return row
    }

    const mustRoom = (game: string, code: string, viewerId: number): GameRoomRow => {
      const room = store.get(String(code).trim().toUpperCase())
      if (!room || room.game !== game || !playersOf(room.id).some((p) => p.userId === viewerId)) {
        throw new M16Error('NOT_FOUND', NOT_FOUND_ROOM)
      }
      return room
    }

    // --- standings (BR-M16-21) -------------------------------------------------------------------------------

    const standingOf = (game: RoomGame, userId: number): GameStandingRow => {
      const found = standings.query({ where: { game, userId } }).rows[0]
      if (found) return found
      const next = Math.max(10_000, ...standings.query({}).rows.map((r) => r.orderKey + 1))
      return standings.insert({
        game,
        userId,
        wins: 0,
        jumlah: 0,
        skor: 0,
        betul: 0,
        orderKey: next,
        reachedAtMs: m16Now(),
      })
    }

    const bump = (game: RoomGame, userId: number, patch: Partial<GameStandingRow>): void => {
      const row = standingOf(game, userId)
      const next: Partial<GameStandingRow> = { reachedAtMs: m16Now() }
      for (const [k, v] of Object.entries(patch)) {
        ;(next as Record<string, number>)[k] =
          (row[k as keyof GameStandingRow] as number) + (v as number)
      }
      standings.update(row.id, next)
    }

    /** A finished room: standings of every player, and one M14 report for the acting viewer. */
    const settle = (room: GameRoomRow, st: RoomState, ps: EnginePlayer[]): void => {
      const winners = new Set<number>()
      if (room.game === 'kuiz-relay') {
        if (st.mvpId !== null) {
          bump('kuiz-relay', st.mvpId, { wins: 1 })
          const mvp = ps.find((p) => p.userId === st.mvpId)
          for (const p of ps) if (p.team !== null && p.team === mvp?.team) winners.add(p.userId)
        }
      } else if (st.winnerId !== null) {
        winners.add(st.winnerId)
        bump(room.game, st.winnerId, { wins: 1 })
      }
      if (room.game === 'papan-bijak') {
        for (const p of ps)
          bump('papan-bijak', p.userId, { jumlah: 1, betul: p.correct, skor: p.points })
      }
      const me = ps.find((p) => p.userId === st.humanId)
      if (!me) return
      const won = winners.has(me.userId)
      const info = roomGameInfo(room.game)
      let coins = 0
      let event = won ? 'win' : 'finish'
      if (room.game === 'papan-bijak') {
        const r = boardRates(me.userId)
        coins = me.correct * r.correct + (won ? r.win : 0)
        event = won ? 'win' : 'correct'
      } else if (room.game === 'benteng-ilmu') {
        coins = won ? ROOM_COINS.bentengWin : ROOM_COINS.bentengPlay
        event = won ? 'win' : 'play'
      } else if (room.game === 'perang-fakta') coins = won ? ROOM_COINS.perangFaktaWin : 0
      else if (room.game === 'perlumbaan-matematik') {
        coins = ROOM_COINS.mathracePlay
        event = 'play'
      }
      const rank =
        1 +
        ps.filter((p) => (st.meter[String(p.userId)] ?? 0) > (st.meter[String(me.userId)] ?? 0))
          .length
      reportGame(me.userId, {
        game: info?.token ?? room.game,
        event,
        coins,
        correct: me.correct,
        total: st.total,
        detail: { rank, roomCode: room.id },
      })
    }

    /** Writes an engine result back: players, state, and the finish when the game ended. */
    const applyOut = (
      room: GameRoomRow,
      out: { state: RoomState; players: EnginePlayer[]; finished: boolean },
    ): GameRoomRow => {
      for (const ep of out.players) {
        const row = playersOf(room.id).find((p) => p.userId === ep.userId)
        if (row) players.update(row.id, { team: ep.team, points: ep.points, correct: ep.correct })
      }
      if (!out.finished) return store.update(room.id, { state: out.state })
      const done = store.update(room.id, {
        state: out.state,
        status: 'finished',
        finishedAtMs: m16Now(),
      })
      settle(done, out.state, out.players)
      return done
    }

    const engineRoom = (room: GameRoomRow): EngineRoom => ({
      code: room.id,
      game: room.game,
      subject: room.subject,
      gradeLevel: room.gradeLevel,
    })

    const enginePlayers = (code: string): EnginePlayer[] =>
      playersOf(code).map((p) => ({
        userId: p.userId,
        team: p.team,
        points: p.points,
        correct: p.correct,
        isBot: p.isBot,
      }))

    // --- views --------------------------------------------------------------------------------------------------

    const questionOf = (room: GameRoomRow): RoomView['question'] | undefined => {
      const st = room.state
      if (room.status !== 'playing' || !st || st.pendingQ === null) return undefined
      if (room.game === 'perang-fakta') {
        const fact = st.facts[st.round - 1]
        if (!fact) return undefined
        return {
          id: fact.qId,
          text: fact.text,
          options: [
            { id: 0, label: 'A', text: 'Betul' },
            { id: 1, label: 'B', text: 'Salah' },
          ],
        }
      }
      const v = keylessView(st.pendingQ)
      if (!v) return undefined
      return room.game === 'teka-silang-kata' ? { ...v, options: [] } : v
    }

    const viewOf = (room: GameRoomRow): RoomView => {
      const info = roomGameInfo(room.game) as NonNullable<ReturnType<typeof roomGameInfo>>
      const ps = playersOf(room.id)
      const st = room.state
      const view: RoomView = {
        code: room.id,
        game: room.game,
        status: room.status,
        host: { id: room.hostId, name: userName(room.hostId) },
        players: ps.map((p) => ({
          id: p.userId,
          name: userName(p.userId),
          grade: gradeLabel(users.get(p.userId)?.grade),
          ...(p.team === null ? {} : { team: p.team }),
          points: p.points,
          isBot: p.isBot,
        })),
        settings: {
          subject: room.subject,
          gradeLevel: room.gradeLevel,
          matchMode: room.matchMode,
          gradeMin: room.gradeMin,
          gradeMax: room.gradeMax,
          maxPlayers: room.maxPlayers,
          minPlayers: info.minPlayers,
        },
        state: st
          ? {
              awaiting: st.awaiting,
              round: st.round,
              total: st.total,
              humanId: st.humanId,
              ...(room.game === 'papan-bijak' ? { board: st.board, positions: st.positions } : {}),
              ...(['benteng-ilmu', 'perlumbaan-matematik', 'teka-silang-kata'].includes(room.game)
                ? { meter: st.meter }
                : {}),
              ...(room.game === 'kuiz-relay' ? { teamScores: st.teamScores } : {}),
              log: st.log,
            }
          : null,
      }
      if (st) view.round = st.round
      const q = questionOf(room)
      if (q) view.question = q
      if (room.status === 'finished' && st) {
        view.result = {
          winnerId: st.winnerId,
          winnerName: st.winnerId === null ? null : userName(st.winnerId),
          mvpId: st.mvpId,
          scores: ps.map((p) => ({
            userId: p.userId,
            name: userName(p.userId),
            points: p.points,
            correct: p.correct,
          })),
        }
      }
      return view
    }

    // --- Papan Bijak quick match ------------------------------------------------------------------------------

    let pbPendingSim: 'match' | 'expired' = 'match'

    const activeSearch = (userId: number): PbSearchRow | undefined =>
      searches.query({ where: { userId }, sort: [{ field: 'id', dir: 'desc' }] }).rows[0]

    return {
      /** Seed phase: the observed standings (§6.11.3), the settings row. */
      seedStandings(): void {
        transaction(() => {
          let order = 0
          for (const game of Object.keys(LOBBY_STANDINGS) as (keyof typeof LOBBY_STANDINGS)[]) {
            for (const [userId, wins] of LOBBY_STANDINGS[game]) {
              standings.insert({
                game,
                userId,
                wins,
                jumlah: 0,
                skor: 0,
                betul: 0,
                orderKey: order++,
                reachedAtMs: 0,
              })
            }
          }
          for (const [userId, menang, jumlah, skor, betul] of PAPAN_BIJAK_STANDINGS) {
            standings.insert({
              game: 'papan-bijak',
              userId,
              wins: menang,
              jumlah,
              skor,
              betul,
              orderKey: order++,
              reachedAtMs: 0,
            })
          }
          settings.insert({ boardgameQuizTiles: SEED_QUIZ_TILES })
        })
      },

      /**
       * Finalise phase: the 160 closed rooms (DV-M16-16) over 189 distinct users — the 38 standing users
       * plus `generated` M02 students (stream `m16:seed-rooms`).
       */
      seedRooms(rng: Prng, generated: readonly number[]): void {
        const pool = [...standingUserIds(), ...generated]
        if (pool.length !== SEED_ROOM_PLAYERS) {
          throw new Error(
            `M16 seed: ${String(pool.length)} room users, need ${String(SEED_ROOM_PLAYERS)}`,
          )
        }
        transaction(() => {
          const order = [...pool]
          rng.shuffle(order)
          let at = 0
          const used = new Set<string>()
          for (let i = 0; i < SEED_ROOMS; i++) {
            const info = rng.pick(ROOM_GAMES)
            let code = roomCodeFrom(rng)
            while (used.has(code)) code = roomCodeFrom(rng)
            used.add(code)
            const size = rng.int(info.minPlayers, Math.min(info.maxPlayers, 4))
            const host = order[at++ % order.length] as number
            const at0 = Date.parse('2026-05-04T10:00:00+08:00') + i * 17 * 3_600_000
            store.insert({
              id: code,
              game: info.game,
              subject: rng.pick(
                info.game === 'papan-bijak'
                  ? PAPAN_BIJAK_SUBJECTS
                  : (Object.keys(ROOM_SUBJECTS) as RoomSubject[]),
              ),
              gradeLevel: 'DARJAH_4',
              matchMode: 'same_grade',
              gradeMin: null,
              gradeMax: null,
              maxPlayers: info.maxPlayers,
              hostId: host,
              status: 'closed',
              createdAtMs: at0,
              startedAtMs: null,
              finishedAtMs: null,
              state: null,
            })
            const seen = new Set<number>([host])
            players.insert({
              roomCode: code,
              userId: host,
              team: null,
              points: 0,
              correct: 0,
              isBot: false,
              joinedAtMs: at0,
            })
            while (seen.size < size) {
              const u = order[at++ % order.length] as number
              if (seen.has(u)) continue
              seen.add(u)
              players.insert({
                roomCode: code,
                userId: u,
                team: null,
                points: 0,
                correct: 0,
                isBot: false,
                joinedAtMs: at0,
              })
            }
          }
          // Every one of the 189 users must sit in a room: cycle the remainder in as extra players.
          const inRooms = new Set(players.query({}).rows.map((p) => p.userId))
          const rooms = store.query({ sort: 'id' }).rows
          let r = 0
          for (const u of pool) {
            if (inRooms.has(u)) continue
            const room = rooms[r++ % rooms.length] as GameRoomRow
            players.insert({
              roomCode: room.id,
              userId: u,
              team: null,
              points: 0,
              correct: 0,
              isBot: false,
              joinedAtMs: room.createdAtMs,
            })
          }
        })
      },

      /** Fixture `openRoom` (§6.11.7): Papan Bijak `PB1234`, waiting, host 4320, 1 player. */
      insertOpenRoom(): void {
        transaction(() => {
          if (store.has('PB1234')) return
          store.insert({
            id: 'PB1234',
            game: 'papan-bijak',
            subject: 'MATEMATIK',
            gradeLevel: 'DARJAH_4',
            matchMode: 'same_grade',
            gradeMin: null,
            gradeMax: null,
            maxPlayers: 4,
            hostId: 4320,
            status: 'waiting',
            createdAtMs: m16Now(),
            startedAtMs: null,
            finishedAtMs: null,
            state: null,
          })
          addPlayer('PB1234', 4320, false)
        })
      },

      /** Hook `roomBots({count, code?})`: adds `count` bots to a waiting room (default the newest). */
      addBots(count: number, prng: PrngRegistry, code?: string): number {
        return transaction(() => {
          const room = code
            ? store.get(code)
            : store.query({
                where: { status: 'waiting' },
                sort: [{ field: 'createdAtMs', dir: 'desc' }],
              }).rows[0]
          if (!room || room.status !== 'waiting') throw new M16Error('NOT_FOUND', NOT_FOUND_ROOM)
          let added = 0
          while (added < count && playersOf(room.id).length < room.maxPlayers) {
            addBot(room, prng)
            added += 1
          }
          return added
        })
      },

      setPbSim(mode: 'match' | 'expired'): void {
        pbPendingSim = mode
      },

      get(code: string): GameRoomRow | undefined {
        return store.get(code)
      },

      /** #22: open rooms (BR-M16-17) and the two chips (BR-M16-16). */
      hub(viewerId: number) {
        const open = store
          .query({
            where: { status: 'waiting' },
            sort: [
              { field: 'createdAtMs', dir: 'desc' },
              { field: 'id', dir: 'asc' },
            ],
          })
          .rows.map((r) => ({ room: r, count: playersOf(r.id).length }))
          .filter((x) => x.count < x.room.maxPlayers)
          .slice(0, 6)
          .map((x) => ({
            game: x.room.game,
            code: x.room.id,
            host: userName(x.room.hostId),
            players: x.count,
            max: x.room.maxPlayers,
          }))
        const pb = standings.query({ where: { game: 'papan-bijak', userId: viewerId } }).rows[0]
        const battled = [
          ...battlesTable.query({ where: { playerA: viewerId } }).rows,
          ...battlesTable.query({ where: { playerB: viewerId } }).rows,
        ].some((b) => b.status === 'finished' || b.status === 'forfeited')
        return {
          openRooms: open,
          chips: { papanBijakPlayed: (pb?.jumlah ?? 0) > 0, battled },
        }
      },

      /** #23: the lobby of one room game (BR-M16-02, BR-M16-22/23). */
      lobby(viewerId: number, game: RoomGame) {
        const viewer = mustUser(viewerId)
        const autoGrade = enumOfGrade(viewer.grade)
        const base = {
          autoGrade,
          autoGradeName: autoGrade === null ? null : gradeLabel(viewer.grade),
        }
        const rows = standings.query({ where: { game } }).rows
        if (game === 'papan-bijak') {
          const top = rows
            .filter((r) => r.jumlah > 0)
            .sort((a, b) => b.wins - a.wins || b.skor - a.skor || a.orderKey - b.orderKey)
            .slice(0, 10)
            .map((r, i) => {
              const name = userName(r.userId)
              return {
                rank: i + 1,
                userId: r.userId,
                name: shortName(name),
                initials: initialsOf(name),
                menang: r.wins,
                jumlah: r.jumlah,
                kadar: kadarOf(r.wins, r.jumlah),
                skor: r.skor,
                betul: r.betul,
              }
            })
          return { ...base, top10: top }
        }
        const leaders = rows
          .filter((r) => r.wins > 0)
          .sort(
            (a, b) => b.wins - a.wins || a.orderKey - b.orderKey || a.reachedAtMs - b.reachedAtMs,
          )
          .slice(0, 10)
          .map((r, i) => ({
            rank: i + 1,
            userId: r.userId,
            name: userName(r.userId),
            value: r.wins,
          }))
        return { ...base, leaders }
      },

      /** #24: creates a room; the viewer is its host and first player. */
      create(
        viewerId: number,
        game: RoomGame,
        body: unknown,
        prng: PrngRegistry,
      ): { code: string } {
        const input = parseRoomBody(game, body)
        return transaction(() => ({ code: createRoom(mustUser(viewerId), game, input, prng).id }))
      },

      /** #25: joins a waiting room (BR-M16-18); every refusal is "Bilik tidak dijumpai.". */
      join(viewerId: number, game: RoomGame, rawCode: unknown): { code: string } {
        const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : ''
        if (code === '') throw new M16Error('NOT_FOUND', NOT_FOUND_ROOM)
        return transaction(() => {
          const room = store.get(code)
          if (!room || room.game !== game) throw new M16Error('NOT_FOUND', NOT_FOUND_ROOM)
          const ps = playersOf(code)
          if (ps.some((p) => p.userId === viewerId)) return { code }
          const viewer = mustUser(viewerId)
          if (
            room.status !== 'waiting' ||
            ps.length >= room.maxPlayers ||
            !gradeFits(room, viewer.grade)
          ) {
            throw new M16Error('NOT_FOUND', NOT_FOUND_ROOM)
          }
          addPlayer(code, viewerId, false)
          return { code }
        })
      },

      /** #26: the room for a player; a waiting room adds one bot per host poll (BR-M16-19, SIMULATION). */
      view(viewerId: number, game: RoomGame, code: string, prng: PrngRegistry): RoomView {
        return transaction(() => {
          const room = mustRoom(game, code, viewerId)
          const info = roomGameInfo(game) as NonNullable<ReturnType<typeof roomGameInfo>>
          if (
            room.status === 'waiting' &&
            room.hostId === viewerId &&
            playersOf(room.id).length < info.minPlayers
          ) {
            addBot(room, prng)
          }
          return viewOf(store.get(room.id) as GameRoomRow)
        })
      },

      /** #27: the host starts the game once the minimum players are in. */
      start(viewerId: number, game: RoomGame, code: string, prng: PrngRegistry): RoomView {
        return transaction(() => {
          const room = mustRoom(game, code, viewerId)
          if (room.hostId !== viewerId)
            throw new M16Error('FORBIDDEN', 'Hanya hos boleh memulakan permainan.')
          const info = roomGameInfo(game) as NonNullable<ReturnType<typeof roomGameInfo>>
          if (room.status !== 'waiting')
            throw new M16Error('CONFLICT', 'Permainan sudah dimulakan.')
          if (playersOf(room.id).length < info.minPlayers) {
            throw new M16Error('CONFLICT', 'Pemain belum mencukupi.')
          }
          const res = startGame(
            engineRoom(room),
            enginePlayers(room.id),
            viewerId,
            quizTiles(),
            prng,
            botAccuracy(),
          )
          const started = store.update(room.id, { status: 'playing', startedAtMs: m16Now() })
          return viewOf(applyOut(started, res))
        })
      },

      /** #28: a roll or an answer of the viewer; the other players answer by simulation. */
      action(
        viewerId: number,
        game: RoomGame,
        code: string,
        body: unknown,
        prng: PrngRegistry,
      ): RoomView {
        const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
        let action: RoomAction
        if (b.type === 'roll') action = { type: 'roll' }
        else if (b.type === 'answer') {
          const q = b.questionId
          const o = b.optionId
          const s = b.seconds
          if (typeof q !== 'number' || !Number.isInteger(q)) {
            throw new M16Error('VALIDATION_ERROR', 'Soalan tidak sah.', 'questionId')
          }
          if (
            o !== undefined &&
            o !== null &&
            (typeof o !== 'number' || !Number.isInteger(o) || o < 0 || o > 3)
          ) {
            throw new M16Error('VALIDATION_ERROR', 'Pilihan tidak sah.', 'optionId')
          }
          if (s !== undefined && (typeof s !== 'number' || !Number.isFinite(s) || s < 0)) {
            throw new M16Error('VALIDATION_ERROR', 'Masa tidak sah.', 'seconds')
          }
          action = {
            type: 'answer',
            questionId: q,
            optionId: typeof o === 'number' ? o : null,
            value: b.value,
            seconds: typeof s === 'number' ? s : 15,
          }
        } else throw new M16Error('VALIDATION_ERROR', 'Tindakan tidak sah.', 'type')
        return transaction(() => {
          const room = mustRoom(game, code, viewerId)
          if (room.status !== 'playing' || !room.state)
            throw new M16Error('CONFLICT', 'Permainan belum bermula.')
          if (room.state.humanId !== viewerId)
            throw new M16Error('FORBIDDEN', 'Bukan giliran anda.')
          const res = applyAction(
            engineRoom(room),
            enginePlayers(room.id),
            room.state,
            action,
            prng,
            botAccuracy(),
          )
          return viewOf(applyOut(room, res))
        })
      },

      // --- Papan Bijak quick match (#29–#31, BR-M16-24; SIMULATION) --------------------------------------

      pbStart(viewerId: number, body: unknown): { status: 'searching' } {
        const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
        if (
          typeof b.subject !== 'string' ||
          !(PAPAN_BIJAK_SUBJECTS as readonly string[]).includes(b.subject)
        ) {
          throw new M16Error('VALIDATION_ERROR', 'Subjek tidak sah.', 'subject')
        }
        if (b.match_mode !== 'same_grade' && b.match_mode !== 'same_level') {
          throw new M16Error('VALIDATION_ERROR', 'Padanan tidak sah.', 'match_mode')
        }
        transaction(() => {
          searches.insert({
            userId: viewerId,
            subject: b.subject as RoomSubject,
            matchMode: b.match_mode as MatchMode,
            status: 'searching',
            polls: 0,
            roomCode: null,
            createdAtMs: m16Now(),
            sim: pbPendingSim,
          })
          pbPendingSim = 'match'
        })
        return { status: 'searching' }
      },

      pbPoll(
        viewerId: number,
        prng: PrngRegistry,
      ):
        | { status: 'searching' | 'expired' | 'cancelled' }
        | { status: 'matched'; room_code: string } {
        return transaction(() => {
          const s = activeSearch(viewerId)
          if (!s || s.status === 'cancelled') return { status: 'cancelled' }
          if (s.status === 'expired') return { status: 'expired' }
          if (s.status === 'matched') return { status: 'matched', room_code: s.roomCode as string }
          const polls = s.polls + 1
          if (s.sim === 'expired' || m16Now() - s.createdAtMs >= QUICK_MATCH_EXPIRES_MS) {
            searches.update(s.id, { status: 'expired', polls })
            return { status: 'expired' }
          }
          if (polls < QUICK_MATCH_ON_POLL) {
            searches.update(s.id, { polls })
            return { status: 'searching' }
          }
          const viewer = mustUser(viewerId)
          const room = createRoom(
            viewer,
            'papan-bijak',
            {
              subject: s.subject,
              gradeLevel: enumOfGrade(viewer.grade) ?? 'DARJAH_4',
              matchMode: s.matchMode,
              gradeMin: null,
              gradeMax: null,
              maxPlayers: 4,
            },
            prng,
          )
          addBot(room, prng)
          searches.update(s.id, { status: 'matched', polls, roomCode: room.id })
          return { status: 'matched', room_code: room.id }
        })
      },

      pbCancel(viewerId: number): { status: 'cancelled' } {
        transaction(() => {
          const s = activeSearch(viewerId)
          if (s && s.status === 'searching') searches.update(s.id, { status: 'cancelled' })
        })
        return { status: 'cancelled' }
      },

      // --- admin (#51–#52, BR-M16-36) -------------------------------------------------------------------------

      adminOverview() {
        const all = store.query({}).rows
        return {
          stats: {
            rooms: all.length,
            playing: all.filter((r) => r.status === 'playing').length,
            finished: all.filter((r) => r.status === 'finished').length,
            players: new Set(players.query({}).rows.map((p) => p.userId)).size,
          },
          settings: { boardgameQuizTiles: quizTiles() },
        }
      },

      setQuizTiles(value: unknown): { boardgameQuizTiles: number } {
        if (
          typeof value !== 'number' ||
          !Number.isInteger(value) ||
          value < 0 ||
          value > MAX_QUIZ_TILES
        ) {
          throw new M16Error(
            'VALIDATION_ERROR',
            'Nilai mesti antara 0 dan 38.',
            'boardgame_quiz_tiles',
          )
        }
        transaction(() => {
          const row = settings.get(1)
          if (row) settings.update(1, { boardgameQuizTiles: value })
          else settings.insert({ boardgameQuizTiles: value })
        })
        return { boardgameQuizTiles: value }
      },

      /** The plain-tile count the settings page shows (BR-M16-36). */
      plainTiles(): number {
        return Math.max(0, 48 - BOARD_NON_PLAIN - quizTiles())
      },

      /** Reads for M11 `gameResults.countFor` and the S29 checks: finished rooms of a user in a window. */
      finishedRoomsOf(userId: number, from: number, to: number): number {
        let n = 0
        for (const p of players.query({ where: { userId } }).rows) {
          if (p.isBot) continue
          const room = store.get(p.roomCode)
          if (
            room?.status === 'finished' &&
            room.finishedAtMs !== null &&
            room.finishedAtMs >= from &&
            room.finishedAtMs < to
          )
            n += 1
        }
        return n
      },

      /** The 38 + generated users of the seed rooms, for the build check. */
      distinctPlayers(): number {
        return new Set(players.query({}).rows.map((p) => p.userId)).size
      },

      /** `resetM16`: forgets the pending `pbQuickMatch` hook. */
      resetSim(): void {
        pbPendingSim = 'match'
      },
    }
  },
})
