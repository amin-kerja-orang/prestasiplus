import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import type { RoomState } from './engine'

export interface RoomRow {
  code: string
  game: string
  subject: string
  gradeLevel: string
  matchMode: string
  gradeMin: number | null
  gradeMax: number | null
  maxPlayers: number
  hostId: string
  status: string
  startedAt: Date | null
  finishedAt: Date | null
  state: RoomState | null
  result: unknown
  settledAt: Date | null
  isTest: boolean
  createdAt: Date
}

export interface PlayerRow {
  id: bigint
  userId: string
  team: number | null
  points: number
  correct: number
  isBot: boolean
  isTest: boolean
}

export interface NewRoom {
  game: string
  subject: string
  gradeLevel: string
  matchMode: string
  gradeMin: number | null
  gradeMax: number | null
  maxPlayers: number
  hostId: string
  isTest: boolean
  createdAt: Date
}

export interface RoomPatch {
  status?: string
  startedAt?: Date
  finishedAt?: Date
  state?: RoomState
  result?: unknown
  settledAt?: Date
}

export interface StandingRow {
  userId: string
  wins: number
  jumlah: number
  skor: number
  betul: number
}

const toRoom = (r: {
  code: string
  game: string
  subject: string
  gradeLevel: string
  matchMode: string
  gradeMin: number | null
  gradeMax: number | null
  maxPlayers: number
  hostId: bigint
  status: string
  startedAt: Date | null
  finishedAt: Date | null
  state: Prisma.JsonValue | null
  result: Prisma.JsonValue | null
  settledAt: Date | null
  isTest: boolean
  createdAt: Date
}): RoomRow => ({
  code: r.code,
  game: r.game,
  subject: r.subject,
  gradeLevel: r.gradeLevel,
  matchMode: r.matchMode,
  gradeMin: r.gradeMin,
  gradeMax: r.gradeMax,
  maxPlayers: r.maxPlayers,
  hostId: idToString(r.hostId),
  status: r.status,
  startedAt: r.startedAt,
  finishedAt: r.finishedAt,
  state: (r.state as unknown as RoomState | null) ?? null,
  result: r.result,
  settledAt: r.settledAt,
  isTest: r.isTest,
  createdAt: r.createdAt,
})

const toPlayer = (p: {
  id: bigint
  userId: bigint
  team: number | null
  points: number
  correct: number
  isBot: boolean
  isTest: boolean
}): PlayerRow => ({
  id: p.id,
  userId: idToString(p.userId),
  team: p.team,
  points: p.points,
  correct: p.correct,
  isBot: p.isBot,
  isTest: p.isTest,
})

/** Data access of the room games (tables `game_rooms`, `game_room_players`, `game_standings`, `pb_searches`, `game_settings`). */
@Injectable()
export class RoomsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  async room(code: string): Promise<RoomRow | null> {
    const r = await this.db.gameRoom.findUnique({ where: { code } })
    return r ? toRoom(r) : null
  }

  /** `SELECT ... FOR UPDATE` on the room row: join, start, action, poll and settlement serialise on it. */
  async lock(code: string): Promise<boolean> {
    const rows = await this.db.$queryRaw<
      { code: string }[]
    >`SELECT code FROM game_rooms WHERE code = ${code} FOR UPDATE`
    return rows.length > 0
  }

  async players(code: string): Promise<PlayerRow[]> {
    const rows = await this.db.gameRoomPlayer.findMany({
      where: { roomCode: code },
      orderBy: { id: 'asc' },
    })
    return rows.map(toPlayer)
  }

  async countRooms(): Promise<number> {
    return this.db.gameRoom.count()
  }

  /** Inserts a waiting room with `code`; false when the code is taken (the caller draws the next code). */
  async insertRoom(code: string, r: NewRoom): Promise<boolean> {
    const n = await this.db.$executeRaw`
      INSERT INTO game_rooms (code, game, subject, grade_level, match_mode, grade_min, grade_max, max_players, host_id, status, is_test, created_at, updated_at)
      VALUES (${code}, ${r.game}, ${r.subject}, ${r.gradeLevel}, ${r.matchMode}, ${r.gradeMin}, ${r.gradeMax}, ${r.maxPlayers}, ${idFromString(r.hostId)}, 'waiting', ${r.isTest}, ${r.createdAt}, ${r.createdAt})
      ON CONFLICT (code) DO NOTHING`
    return n === 1
  }

  async addPlayer(
    code: string,
    userId: string,
    isBot: boolean,
    isTest: boolean,
    joinedAt: Date,
  ): Promise<void> {
    await this.db.gameRoomPlayer.create({
      data: { roomCode: code, userId: idFromString(userId), isBot, isTest, joinedAt },
    })
  }

  async updateRoom(code: string, patch: RoomPatch, at: Date): Promise<void> {
    await this.db.gameRoom.update({
      where: { code },
      data: {
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.startedAt === undefined ? {} : { startedAt: patch.startedAt }),
        ...(patch.finishedAt === undefined ? {} : { finishedAt: patch.finishedAt }),
        ...(patch.state === undefined
          ? {}
          : { state: patch.state as unknown as Prisma.InputJsonValue }),
        ...(patch.result === undefined ? {} : { result: patch.result as Prisma.InputJsonValue }),
        ...(patch.settledAt === undefined ? {} : { settledAt: patch.settledAt }),
        updatedAt: at,
      },
    })
  }

  async updatePlayer(
    id: bigint,
    p: { team: number | null; points: number; correct: number },
  ): Promise<void> {
    await this.db.gameRoomPlayer.update({
      where: { id },
      data: { team: p.team, points: p.points, correct: p.correct },
    })
  }

  /** Adds to a standing (creating it); race-safe across rooms through `ON CONFLICT`. */
  async bumpStanding(
    game: string,
    userId: string,
    d: { wins: number; jumlah: number; betul: number; skor: number },
    at: Date,
  ): Promise<void> {
    await this.db.$executeRaw`
      INSERT INTO game_standings (game, user_id, wins, jumlah, skor, betul, reached_at, is_test, created_at)
      VALUES (${game}, ${idFromString(userId)}, ${d.wins}, ${d.jumlah}, ${d.skor}, ${d.betul}, ${at}, false, ${at})
      ON CONFLICT (game, user_id) DO UPDATE SET
        wins = game_standings.wins + EXCLUDED.wins,
        jumlah = game_standings.jumlah + EXCLUDED.jumlah,
        skor = game_standings.skor + EXCLUDED.skor,
        betul = game_standings.betul + EXCLUDED.betul,
        reached_at = EXCLUDED.reached_at`
  }

  // --- reads ----------------------------------------------------------------------------------------------

  /** Up to `limit` newest waiting rooms with a free seat whose host is not a test actor. */
  async openRooms(
    limit: number,
  ): Promise<{ code: string; game: string; hostId: string; players: number; max: number }[]> {
    const rows = await this.db.$queryRaw<
      { code: string; game: string; host_id: bigint; n: number; max_players: number }[]
    >`
      SELECT r.code, r.game, r.host_id, r.max_players,
             (SELECT count(*)::int FROM game_room_players p WHERE p.room_code = r.code) AS n
        FROM game_rooms r
       WHERE r.status = 'waiting' AND NOT r.is_test
         AND (SELECT count(*) FROM game_room_players p WHERE p.room_code = r.code) < r.max_players
       ORDER BY r.created_at DESC, r.code ASC
       LIMIT ${limit}`
    return rows.map((r) => ({
      code: r.code,
      game: r.game,
      hostId: idToString(r.host_id),
      players: r.n,
      max: r.max_players,
    }))
  }

  async hasPlayed(game: string, userId: string): Promise<boolean> {
    const s = await this.db.gameStanding.findUnique({
      where: { game_userId: { game, userId: idFromString(userId) } },
    })
    return (s?.jumlah ?? 0) > 0 && !s?.isTest
  }

  /** Papan Bijak top 10 (jumlah > 0): wins desc, skor desc, creation order. Test actors never appear. */
  async papanBijakTop(limit: number): Promise<StandingRow[]> {
    const rows = await this.db.gameStanding.findMany({
      where: { game: 'papan-bijak', jumlah: { gt: 0 }, isTest: false },
      orderBy: [{ wins: 'desc' }, { skor: 'desc' }, { id: 'asc' }],
      take: limit,
    })
    return rows.map((r) => ({
      userId: idToString(r.userId),
      wins: r.wins,
      jumlah: r.jumlah,
      skor: r.skor,
      betul: r.betul,
    }))
  }

  /** Other games' leaders (wins > 0): wins desc, creation order, reached_at asc. */
  async leaders(game: string, limit: number): Promise<StandingRow[]> {
    const rows = await this.db.gameStanding.findMany({
      where: { game, wins: { gt: 0 }, isTest: false },
      orderBy: [{ wins: 'desc' }, { id: 'asc' }, { reachedAt: 'asc' }],
      take: limit,
    })
    return rows.map((r) => ({
      userId: idToString(r.userId),
      wins: r.wins,
      jumlah: r.jumlah,
      skor: r.skor,
      betul: r.betul,
    }))
  }

  async quizTiles(): Promise<number | null> {
    const s = await this.db.gameSettings.findUnique({ where: { id: 1 } })
    return s ? s.boardgameQuizTiles : null
  }

  async setQuizTiles(value: number, at: Date): Promise<void> {
    await this.db.$executeRaw`
      INSERT INTO game_settings (id, boardgame_quiz_tiles, updated_at) VALUES (1, ${value}, ${at})
      ON CONFLICT (id) DO UPDATE SET boardgame_quiz_tiles = EXCLUDED.boardgame_quiz_tiles, updated_at = EXCLUDED.updated_at`
  }

  /** Room statistics of the admin page; test rooms are excluded. */
  async stats(): Promise<{ rooms: number; playing: number; finished: number; players: number }> {
    const rows = await this.db.$queryRaw<
      { rooms: number; playing: number; finished: number; players: number }[]
    >`
      SELECT (SELECT count(*)::int FROM game_rooms WHERE NOT is_test) AS rooms,
             (SELECT count(*)::int FROM game_rooms WHERE NOT is_test AND status = 'playing') AS playing,
             (SELECT count(*)::int FROM game_rooms WHERE NOT is_test AND status = 'finished') AS finished,
             (SELECT count(DISTINCT p.user_id)::int FROM game_room_players p JOIN game_rooms r ON r.code = p.room_code WHERE NOT r.is_test) AS players`
    return rows[0] ?? { rooms: 0, playing: 0, finished: 0, players: 0 }
  }

  // --- quick match ----------------------------------------------------------------------------------------

  async latestSearch(userId: string): Promise<SearchRow | null> {
    const s = await this.db.pbSearch.findFirst({
      where: { userId: idFromString(userId) },
      orderBy: { id: 'desc' },
    })
    return s ? toSearch(s) : null
  }

  async lockSearch(id: bigint): Promise<SearchRow | null> {
    await this.db.$queryRaw`SELECT id FROM pb_searches WHERE id = ${id} FOR UPDATE`
    const s = await this.db.pbSearch.findUnique({ where: { id } })
    return s ? toSearch(s) : null
  }

  async insertSearch(
    userId: string,
    subject: string,
    matchMode: string,
    isTest: boolean,
    at: Date,
  ): Promise<void> {
    await this.db.pbSearch.create({
      data: {
        userId: idFromString(userId),
        subject,
        matchMode,
        status: 'searching',
        polls: 0,
        isTest,
        createdAt: at,
      },
    })
  }

  async updateSearch(
    id: bigint,
    patch: { status?: string; polls?: number; roomCode?: string },
  ): Promise<void> {
    await this.db.pbSearch.update({ where: { id }, data: patch })
  }
}

export interface SearchRow {
  id: bigint
  userId: string
  subject: string
  matchMode: string
  status: string
  polls: number
  roomCode: string | null
  createdAt: Date
}

const toSearch = (s: {
  id: bigint
  userId: bigint
  subject: string
  matchMode: string
  status: string
  polls: number
  roomCode: string | null
  createdAt: Date
}): SearchRow => ({
  id: s.id,
  userId: idToString(s.userId),
  subject: s.subject,
  matchMode: s.matchMode,
  status: s.status,
  polls: s.polls,
  roomCode: s.roomCode,
  createdAt: s.createdAt,
})
