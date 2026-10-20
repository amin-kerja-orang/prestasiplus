import { Inject, Injectable } from '@nestjs/common'
import {
  GamesRoomActionRequestSchema,
  GamesRoomGameSchema,
  GAMES_ROOM_LIMITS,
  gamesRoomCreateRequestFor,
  gamesRoomMaxPlayers,
  type GamesHub,
  type GamesLobby,
  type GamesRoomGame,
  type GamesRoomSubject,
  type GamesRoomView,
} from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import type { TxClient } from '../../../db/client'
import { CLOCK, type Clock } from '../../../db/clock'
import { PrismaService } from '../../../db/prisma.service'
import { prngStream } from '../../../db/prng'
import {
  fieldError,
  gameNotFound,
  roomNotFound,
  startAlreadyStarted,
  startHostOnly,
  startNotEnoughPlayers,
  startNotEnoughQuestions,
  actionNotStarted,
  actionNotYourTurn,
} from '../errors'
import { DEFAULT_QUIZ_TILES } from '../games.constants'
import { GamesPorts } from '../core/ports'
import { GameQuestions } from '../core/game-questions.service'
import { GameSubjects } from '../core/subjects'
import { GameUsers, type GameUser } from '../core/game-users'
import { enumOfGrade, gradeFits, gradeLabel, gradeName } from '../core/grades'
import { initialsOf, kadarOf, truncateName } from '../core/names'
import {
  applyAction,
  computeSettlement,
  EngineRefusal,
  POOL_SIZE,
  questionView,
  resolveClocks,
  startGame,
  stateView,
  type EngineOut,
  type EnginePlayer,
  type EngineRoom,
  type PoolQuestion,
  type RoomAction,
  type RoomState,
} from './engine'
import { RoomSecrets } from './room-secrets'
import { type PlayerRow, type RoomRow, RoomsRepository } from './rooms.repository'

const CODE_PATTERN = /^[A-Z0-9]{6}$/

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** The room game of a path value, else 404 "Permainan tidak dijumpai.". */
export function parseGame(value: string): GamesRoomGame {
  const r = GamesRoomGameSchema.safeParse(value)
  if (!r.success) throw gameNotFound()
  return r.data
}

/** A path/body room code trimmed and upper-cased; null when it cannot be a code. */
export function normaliseCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return CODE_PATTERN.test(code) ? code : null
}

export interface Caller {
  userId: string
  isTest: boolean
}

export interface NewRoomInput {
  subject: string
  gradeLevel: string
  matchMode: string
  gradeMin: number | null
  gradeMax: number | null
  maxPlayers: number
}

const CREATE_RANK = ['subject', 'grade_level', 'match_mode', 'grade_min', 'max_players']

@Injectable()
export class RoomsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RoomsRepository) private readonly repo: RoomsRepository,
    @Inject(GamesPorts) private readonly ports: GamesPorts,
    @Inject(GameUsers) private readonly users: GameUsers,
    @Inject(GameQuestions) private readonly questions: GameQuestions,
    @Inject(GameSubjects) private readonly subjects: GameSubjects,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(RoomSecrets) private readonly secrets: RoomSecrets,
  ) {}

  // --- hub and lobby ---------------------------------------------------------------------------------------

  async hub(caller: Caller): Promise<GamesHub> {
    const open = await this.repo.openRooms(6)
    const names = await this.users.getMany(open.map((r) => r.hostId))
    const [played, battled] = await Promise.all([
      this.repo.hasPlayed('papan-bijak', caller.userId),
      this.ports.battle.hasBattled(caller.userId),
    ])
    return {
      openRooms: open.map((r) => ({
        game: r.game as GamesRoomGame,
        code: r.code,
        host: names.get(r.hostId)?.name ?? '',
        players: r.players,
        max: r.max,
      })),
      chips: { papanBijakPlayed: played, battled },
    }
  }

  async lobby(caller: Caller, gameParam: string): Promise<GamesLobby> {
    const game = parseGame(gameParam)
    const viewer = await this.users.get(caller.userId)
    const autoGrade = enumOfGrade(viewer?.grade ?? null)
    const base = { autoGrade, autoGradeName: gradeName(viewer?.grade ?? null) }
    if (game === 'papan-bijak') {
      const rows = await this.repo.papanBijakTop(10)
      const names = await this.users.getMany(rows.map((r) => r.userId))
      return {
        ...base,
        top10: rows.flatMap((r, i) => {
          const name = names.get(r.userId)?.name
          if (name === undefined) return []
          return [
            {
              rank: i + 1,
              userId: r.userId,
              name: truncateName(name),
              initials: initialsOf(name),
              menang: r.wins,
              jumlah: r.jumlah,
              kadar: kadarOf(r.wins, r.jumlah),
              skor: r.skor,
              betul: r.betul,
            },
          ]
        }),
      }
    }
    const rows = await this.repo.leaders(game, 10)
    const names = await this.users.getMany(rows.map((r) => r.userId))
    return {
      ...base,
      leaders: rows.flatMap((r, i) => {
        const name = names.get(r.userId)?.name
        return name === undefined ? [] : [{ rank: i + 1, userId: r.userId, name, value: r.wins }]
      }),
    }
  }

  // --- create and join -------------------------------------------------------------------------------------

  /** Validation order of the mock: subject, grade_level, match_mode, grade_min, max_players. */
  private parseCreate(game: GamesRoomGame, body: unknown): NewRoomInput {
    const r = gamesRoomCreateRequestFor(game).safeParse(isRecord(body) ? body : {})
    if (!r.success) {
      const ranked = r.error.issues
        .map((i) => {
          const raw = String(i.path[0] ?? '')
          return { field: raw === 'grade_max' ? 'grade_min' : raw, message: i.message }
        })
        .sort((a, b) => rank(a.field) - rank(b.field))
      const first = ranked[0]
      throw first ? fieldError(first.field, first.message) : ApiError.of('VALIDATION_ERROR')
    }
    const v = r.data
    const custom = v.match_mode === 'custom'
    return {
      subject: v.subject,
      gradeLevel: v.grade_level,
      matchMode: v.match_mode,
      gradeMin: custom ? (v.grade_min ?? null) : null,
      gradeMax: custom ? (v.grade_max ?? null) : null,
      maxPlayers: gamesRoomMaxPlayers(game, v.max_players),
    }
  }

  async create(caller: Caller, gameParam: string, body: unknown): Promise<{ code: string }> {
    const game = parseGame(gameParam)
    const input = this.parseCreate(game, body)
    return this.prisma.transaction(async () => ({
      code: await this.createRoom(caller, game, input),
    }))
  }

  /** Inserts the room and its human host; the code and the secret seed come from crypto randomness; a taken code is retried on collision. */
  async createRoom(host: Caller, game: GamesRoomGame, input: NewRoomInput): Promise<string> {
    const now = this.clock.now()
    const seed = this.secrets.newSeed()
    for (let attempt = 0; attempt < 1000; attempt++) {
      const code = this.secrets.roomCode()
      const inserted = await this.repo.insertRoom(
        code,
        {
          game,
          subject: input.subject,
          gradeLevel: input.gradeLevel,
          matchMode: input.matchMode,
          gradeMin: input.gradeMin,
          gradeMax: input.gradeMax,
          maxPlayers: input.maxPlayers,
          hostId: host.userId,
          isTest: host.isTest,
          createdAt: now,
        },
        seed,
      )
      if (inserted) {
        await this.repo.addPlayer(code, host.userId, false, host.isTest, now)
        return code
      }
    }
    throw new Error('M16: no free room code')
  }

  async join(caller: Caller, gameParam: string, body: unknown): Promise<{ code: string }> {
    const game = parseGame(gameParam)
    const code = normaliseCode(isRecord(body) ? body.room_code : undefined)
    if (code === null) throw roomNotFound()
    const probe = await this.repo.room(code)
    if (!probe || probe.game !== game) throw roomNotFound()
    return this.prisma.transaction(async () => {
      // The row lock serialises concurrent joins: the seat count below is never stale.
      if (!(await this.repo.lock(code))) throw roomNotFound()
      const room = await this.repo.room(code)
      if (!room || room.game !== game) throw roomNotFound()
      const ps = await this.repo.players(code)
      if (ps.some((p) => p.userId === caller.userId)) return { code }
      const viewer = await this.users.get(caller.userId)
      if (
        room.status !== 'waiting' ||
        ps.length >= room.maxPlayers ||
        !gradeFits(room, viewer?.grade ?? null) ||
        room.isTest !== caller.isTest // no mixed rooms: test actors and normal users never share one
      ) {
        throw roomNotFound()
      }
      await this.repo.addPlayer(code, caller.userId, false, caller.isTest, this.clock.now())
      return { code }
    })
  }

  // --- view ---------------------------------------------------------------------------------------------------

  /** Reads the room for one of its players; 404 for everything else. */
  private async mustPlayer(
    caller: Caller,
    game: GamesRoomGame,
    rawCode: string,
  ): Promise<{ room: RoomRow; players: PlayerRow[] }> {
    const code = normaliseCode(rawCode)
    if (code === null) throw roomNotFound()
    const room = await this.repo.room(code)
    if (!room || room.game !== game) throw roomNotFound()
    const players = await this.repo.players(code)
    if (!players.some((p) => p.userId === caller.userId)) throw roomNotFound()
    return { room, players }
  }

  async view(caller: Caller, gameParam: string, rawCode: string): Promise<GamesRoomView> {
    const game = parseGame(gameParam)
    const probe = await this.mustPlayer(caller, game, rawCode)
    if (probe.room.status !== 'waiting' && probe.room.status !== 'playing')
      return this.viewOf(probe.room, probe.players)
    return this.prisma.transaction(async (tx) => {
      await this.repo.lock(probe.room.code)
      let { room, players } = await this.mustPlayer(caller, game, rawCode)
      if (
        room.status === 'waiting' &&
        room.hostId === caller.userId &&
        players.length < GAMES_ROOM_LIMITS[game].minPlayers
      ) {
        await this.addBot(room, players)
        players = await this.repo.players(room.code)
      }
      if (room.status === 'playing') {
        const after = await this.runClocks(tx, room, players)
        room = after.room
        players = after.players
      }
      return this.viewOf(room, players)
    })
  }

  // --- start --------------------------------------------------------------------------------------------------

  async start(caller: Caller, gameParam: string, rawCode: string): Promise<GamesRoomView> {
    const game = parseGame(gameParam)
    await this.mustPlayer(caller, game, rawCode)
    return this.prisma.transaction(async (tx) => {
      const probe = await this.mustPlayer(caller, game, rawCode)
      await this.repo.lock(probe.room.code)
      const { room, players } = await this.mustPlayer(caller, game, rawCode)
      if (room.hostId !== caller.userId) throw startHostOnly()
      if (room.status !== 'waiting') throw startAlreadyStarted()
      if (players.length < GAMES_ROOM_LIMITS[game].minPlayers) throw startNotEnoughPlayers()
      const pool = await this.drawPool(room, game)
      const now = this.clock.now()
      const out = startGame({
        room: engineRoom(room),
        players: enginePlayers(players),
        humanId: caller.userId,
        seed: seedOf(room, this.secrets),
        pool,
        quizTiles: (await this.repo.quizTiles()) ?? DEFAULT_QUIZ_TILES,
        p: await this.botAccuracy(),
        nowMs: now.getTime(),
      })
      await this.repo.updateRoom(room.code, { status: 'playing', startedAt: now }, now)
      const started: RoomRow = { ...room, status: 'playing', startedAt: now }
      const done = await this.applyOut(tx, started, players, out)
      return this.viewOf(done.room, done.players)
    })
  }

  // --- action -------------------------------------------------------------------------------------------------

  private parseAction(body: unknown): RoomAction {
    const r = GamesRoomActionRequestSchema.safeParse(isRecord(body) ? body : {})
    if (!r.success) {
      const issue = r.error.issues[0]
      const path = issue?.path[0]
      // An unknown / missing `type` is "Tindakan tidak sah." on `type`.
      throw fieldError(
        typeof path === 'string' && path !== '' ? path : 'type',
        issue?.message ?? 'Tindakan tidak sah.',
      )
    }
    const v = r.data
    if (v.type === 'roll') return { type: 'roll' }
    return {
      type: 'answer',
      questionId: v.questionId,
      optionId: typeof v.optionId === 'number' ? v.optionId : null,
      value: v.value,
      seconds: typeof v.seconds === 'number' ? v.seconds : 15,
    }
  }

  async action(
    caller: Caller,
    gameParam: string,
    rawCode: string,
    body: unknown,
  ): Promise<GamesRoomView> {
    const game = parseGame(gameParam)
    const action = this.parseAction(body)
    await this.mustPlayer(caller, game, rawCode)
    return this.prisma.transaction(async (tx) => {
      const probe = await this.mustPlayer(caller, game, rawCode)
      await this.repo.lock(probe.room.code)
      const before = await this.mustPlayer(caller, game, rawCode)
      const clocked =
        before.room.status === 'playing'
          ? await this.runClocks(tx, before.room, before.players)
          : before
      // The clock ended the game just now: the answer arrived too late, so answer with the finished room.
      if (before.room.status === 'playing' && clocked.room.status === 'finished')
        return this.viewOf(clocked.room, clocked.players)
      const { room, players } = clocked
      if (room.status !== 'playing' || !room.state) throw actionNotStarted()
      if (room.state.humanId !== caller.userId) throw actionNotYourTurn()
      try {
        const out = applyAction({
          room: engineRoom(room),
          players: enginePlayers(players),
          state: room.state,
          action,
          p: await this.botAccuracy(),
          nowMs: this.clock.now().getTime(),
        })
        const done = await this.applyOut(tx, room, players, out)
        return this.viewOf(done.room, done.players)
      } catch (e) {
        throw mapRefusal(e)
      }
    })
  }

  // --- engine plumbing -------------------------------------------------------------------------------------------

  private async botAccuracy(): Promise<number> {
    const p = await this.ports.platformAccuracy.accuracy()
    return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0
  }

  /** Resolves the server clocks of a playing room (idempotent) and writes the outcome back. */
  private async runClocks(
    tx: TxClient,
    room: RoomRow,
    players: PlayerRow[],
  ): Promise<{ room: RoomRow; players: PlayerRow[] }> {
    if (room.status !== 'playing' || !room.state) return { room, players }
    const res = resolveClocks({
      room: engineRoom(room),
      players: enginePlayers(players),
      state: room.state,
      startedAtMs: (room.startedAt ?? this.clock.now()).getTime(),
      nowMs: this.clock.now().getTime(),
      p: await this.botAccuracy(),
    })
    if (!res.changed) return { room, players }
    return this.applyOut(tx, room, players, {
      state: res.state,
      players: res.players,
      finished: res.finished,
    })
  }

  /**
   * Writes an engine result back: players, state, and the finish when the game ended. The finish settles inside the
   * caller's locked transaction and exactly once (`settled_at`).
   */
  private async applyOut(
    tx: TxClient,
    room: RoomRow,
    players: PlayerRow[],
    out: EngineOut,
  ): Promise<{ room: RoomRow; players: PlayerRow[] }> {
    const now = this.clock.now()
    for (const ep of out.players) {
      const row = players.find((p) => p.userId === ep.userId)
      if (row)
        await this.repo.updatePlayer(row.id, {
          team: ep.team,
          points: ep.points,
          correct: ep.correct,
        })
    }
    const nextPlayers = players.map((p) => {
      const ep = out.players.find((x) => x.userId === p.userId)
      return ep ? { ...p, team: ep.team, points: ep.points, correct: ep.correct } : p
    })
    if (!out.finished) {
      await this.repo.updateRoom(room.code, { state: out.state }, now)
      return { room: { ...room, state: out.state }, players: nextPlayers }
    }
    const result = {
      winnerId: out.state.winnerId,
      mvpId: out.state.mvpId,
      scores: out.players.map((p) => ({ userId: p.userId, points: p.points, correct: p.correct })),
    }
    const patch = { state: out.state, status: 'finished', finishedAt: now, result, settledAt: now }
    if (room.settledAt === null) await this.settle(tx, room, nextPlayers, out)
    await this.repo.updateRoom(
      room.code,
      room.settledAt === null ? patch : { state: out.state, status: 'finished', finishedAt: now },
      now,
    )
    return {
      room: {
        ...room,
        state: out.state,
        status: 'finished',
        finishedAt: now,
        settledAt: room.settledAt ?? now,
        result,
      },
      players: nextPlayers,
    }
  }

  /** AC10: standings for human, non-test players and one reward report for the acting human. */
  private async settle(
    tx: TxClient,
    room: RoomRow,
    players: PlayerRow[],
    out: EngineOut,
  ): Promise<void> {
    const game = room.game as GamesRoomGame
    const s = computeSettlement({ code: room.code, game, state: out.state, players: out.players })
    const now = this.clock.now()
    const byId = new Map(players.map((p) => [p.userId, p]))
    for (const d of s.standings) {
      if (byId.get(d.userId)?.isTest || (d.wins === 0 && d.jumlah === 0)) continue
      await this.repo.bumpStanding(game, d.userId, d, now)
    }
    const r = s.report
    if (!r || byId.get(r.userId)?.isTest) return // the Mod Pelajar actor never earns: no reward call at all
    let coins = r.coins
    if (coins === undefined) {
      const rates = await this.ports.rewards.tierRates(r.userId, { tx })
      coins = r.correct * rates.correct + (r.won ? rates.win : 0)
    }
    await this.ports.rewards.onGameResult(
      r.userId,
      {
        game: r.game,
        event: r.event,
        coins,
        xp: 0,
        correct: r.correct,
        total: r.total,
        detail: r.detail,
        key: room.code,
      },
      { tx, isTest: false },
    )
  }

  /** One fictitious student of a fitting grade not yet in the room (BR-M16-19); none when the pool is empty. */
  async addBot(room: RoomRow, players: PlayerRow[]): Promise<void> {
    const exclude = players.map((p) => p.userId)
    const stream = `m16:room:${room.code}:${seedOf(room, this.secrets)}:bot:${String(players.length)}`
    const pick =
      (await this.ports.botPool.pick({
        hostId: room.hostId,
        fits: (g) => gradeFits(room, g),
        exclude,
        stream,
      })) ??
      (await this.ports.botPool.pick({ hostId: room.hostId, fits: () => true, exclude, stream }))
    if (pick) await this.repo.addPlayer(room.code, pick.id, true, room.isTest, this.clock.now())
  }

  /** Draws the question pool through BE-09 for the room subject and level, widening like the mock. */
  private async drawPool(room: RoomRow, game: GamesRoomGame): Promise<PoolQuestion[]> {
    const n = POOL_SIZE[game]
    const fits =
      game === 'teka-silang-kata'
        ? (q: PoolQuestion): boolean => q.keyText.trim().length > 0 && q.keyText.length <= 20
        : (): boolean => true
    const subjectId = await this.subjects.subjectId(room.subject as GamesRoomSubject)
    const levelId = await this.subjects.levelIdOfEnum(room.gradeLevel)
    const rng = prngStream(`m16:room:${room.code}:${seedOf(room, this.secrets)}:pool`)
    const tries =
      subjectId === null
        ? [{}]
        : [
            { subjectId, ...(levelId === null ? {} : { educationLevelId: levelId }) },
            { subjectId },
            {},
          ]
    for (const filter of tries) {
      const served = await this.questions.sample(
        filter,
        game === 'teka-silang-kata' ? n * 4 : n,
        rng,
      )
      const pool = served
        .map((s) => ({
          id: s.question.id,
          text: s.question.text,
          options: s.question.options,
          keyIndex: s.keyIndex,
          keyText: s.keyText,
        }))
        .filter(fits)
        .slice(0, n)
      if (pool.length >= Math.min(n, 3)) return pool
    }
    throw startNotEnoughQuestions()
  }

  // --- view building -----------------------------------------------------------------------------------------------

  private async viewOf(room: RoomRow, players: PlayerRow[]): Promise<GamesRoomView> {
    const game = room.game as GamesRoomGame
    const ids = [room.hostId, ...players.map((p) => p.userId)]
    const st = room.status === 'waiting' ? null : room.state // a waiting room only stores its secret seed
    if (st?.winnerId) ids.push(st.winnerId)
    const names = await this.users.getMany(ids)
    const nameOf = (id: string): string => names.get(id)?.name ?? ''
    const nowMs = this.clock.now().getTime()
    const view: GamesRoomView = {
      code: room.code,
      game,
      status: room.status as GamesRoomView['status'],
      host: { id: room.hostId, name: nameOf(room.hostId) },
      players: players.map((p) => ({
        id: p.userId,
        name: nameOf(p.userId),
        grade: gradeLabel((names.get(p.userId) as GameUser | undefined)?.grade ?? null),
        ...(p.team === null ? {} : { team: p.team }),
        points: p.points,
        isBot: p.isBot,
      })),
      settings: {
        subject: room.subject as GamesRoomSubject,
        gradeLevel: room.gradeLevel as GamesRoomView['settings']['gradeLevel'],
        matchMode: room.matchMode as GamesRoomView['settings']['matchMode'],
        gradeMin: room.gradeMin,
        gradeMax: room.gradeMax,
        maxPlayers: room.maxPlayers,
        minPlayers: GAMES_ROOM_LIMITS[game].minPlayers,
      },
      state: st
        ? stateView(game, room.status, st, room.startedAt ? room.startedAt.getTime() : null, nowMs)
        : null,
    }
    if (st) view.round = st.round
    const q = questionView(game, room.status, st)
    if (q) view.question = q
    if (room.status === 'finished' && st) {
      view.result = {
        winnerId: st.winnerId,
        winnerName: st.winnerId === null ? null : nameOf(st.winnerId),
        mvpId: st.mvpId,
        scores: players.map((p) => ({
          userId: p.userId,
          name: nameOf(p.userId),
          points: p.points,
          correct: p.correct,
        })),
      }
    }
    return view
  }
}

/** The room's secret seed (stored at create); a room without one (older rows) gets a fresh one. */
function seedOf(room: RoomRow, secrets: RoomSecrets): string {
  const seed = (room.state as { seed?: unknown } | null)?.seed
  return typeof seed === 'string' && seed !== '' ? seed : secrets.newSeed()
}

function rank(field: string): number {
  const i = CREATE_RANK.indexOf(field)
  return i < 0 ? CREATE_RANK.length : i
}

function engineRoom(room: RoomRow): EngineRoom {
  return {
    code: room.code,
    game: room.game as GamesRoomGame,
    subject: room.subject,
    gradeLevel: room.gradeLevel,
  }
}

function enginePlayers(players: PlayerRow[]): EnginePlayer[] {
  return players.map((p) => ({
    userId: p.userId,
    team: p.team,
    points: p.points,
    correct: p.correct,
    isBot: p.isBot,
  }))
}

function mapRefusal(e: unknown): unknown {
  if (e instanceof EngineRefusal) {
    return e.kind === 'conflict'
      ? ApiError.of('CONFLICT', { message: e.message })
      : fieldError(e.field ?? 'type', e.message)
  }
  return e
}

export type { RoomState }
