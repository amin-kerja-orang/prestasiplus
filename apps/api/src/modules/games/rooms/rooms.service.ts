import { randomUUID } from 'node:crypto'

import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  GamesRoomActionRequestSchema,
  GamesRoomGameSchema,
  GAMES_ROBOT_NAME,
  GAMES_ROOM_LIMITS,
  gamesRoomCreateRequestFor,
  gamesRoomMaxPlayers,
  type GamesHub,
  type GamesLobby,
  type GamesReward,
  type GamesRoomGame,
  type GamesRoomSubject,
  type GamesRoomView,
  type RoleCode,
} from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { toMytTimestamp } from '../../../common/time/myt'
import type { TxClient } from '../../../db/client'
import { CLOCK, type Clock } from '../../../db/clock'
import { PrismaService } from '../../../db/prisma.service'
import { prngStream } from '../../../db/prng'
import {
  fieldError,
  gameNotFound,
  roomGradeLevelInvalid,
  roomFull,
  roomGradeRefused,
  roomNotFound,
  roomStarted,
  startAlreadyStarted,
  startHostOnly,
  startNotEnoughPlayers,
  startNotEnoughQuestions,
  actionNotStarted,
  actionNotYourTurn,
} from '../errors'
import { DEFAULT_QUIZ_TILES } from '../games.constants'
import { NamePrivacy } from '../core/name-privacy.service'
import { GamesPorts, gameAnswerEntry } from '../core/ports'
import { GameQuestions } from '../core/game-questions.service'
import { GameSettingsService } from '../core/game-settings.service'
import { GameSubjects } from '../core/subjects'
import { PACE_GUARD_REWARD, rewardBlock, rewardNow } from '../core/wallet-rewards'
import { GameUsers, type GameUser } from '../core/game-users'
import { enumOfGrade, gradeFits, gradeLabel, gradeName } from '../core/grades'
import { startGameSweep } from '../core/time'
import { initialsOf, kadarOf, truncateName } from '../core/names'
import {
  applyAction,
  computeSettlement,
  EngineRefusal,
  handOverSeat,
  isMultiHuman,
  markSeen,
  playedHumans,
  POOL_SIZE,
  questionView,
  resolveClocks,
  roundEndsAtMs,
  startedHumans,
  startGame,
  stateView,
  youAnswered,
  type EngineOut,
  type EnginePlayer,
  type EngineRoom,
  type PoolQuestion,
  type RoomAction,
  type RoomState,
} from './engine'
import { DEFAULT_GRADE, hasFastGap, JUTAWAN_QUESTIONS, SOLO_INFO } from '../solo/play/solo.rules'
import { RoomSecrets } from './room-secrets'
import { type PlayerRow, type RoomRow, RoomsRepository } from './rooms.repository'

const CODE_PATTERN = /^[A-Z0-9]{6}$/

/** The hub's games: game key, draw size and whether it needs exactly 4 options (48 sections 3.2 and 3.5; Battle 5, ruling 13; Roda Nasib has no questions). */
const HUB_GAMES = [
  ['papan-bijak', POOL_SIZE['papan-bijak'], false],
  ['battle', 5, false],
  ['perang-fakta', POOL_SIZE['perang-fakta'], false],
  ['benteng-ilmu', POOL_SIZE['benteng-ilmu'], false],
  ['perlumbaan-matematik', POOL_SIZE['perlumbaan-matematik'], false],
  ['kuiz-relay', POOL_SIZE['kuiz-relay'], false],
  ['teka-silang-kata', POOL_SIZE['teka-silang-kata'], false],
  ['betul-salah', SOLO_INFO['betul-salah'].items, false],
  ['cabaran-kilat', SOLO_INFO['cabaran-kilat'].items, true],
  ['tembak-jawapan', SOLO_INFO['tembak-jawapan'].items, true],
  ['susun-jawapan', SOLO_INFO['susun-jawapan'].items, false],
  ['kad-memori', SOLO_INFO['kad-memori'].items, false],
  ['jutawan', JUTAWAN_QUESTIONS, false],
  ['roda-nasib', 0, false],
] as const

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
  /** The ACTIVE role: scopes which pupils' names the caller sees (children's names rule). */
  role: RoleCode
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

/** The shortest clock of a room (Perang Fakta): a room moved more recently has nothing due. */
const SHORTEST_CLOCK_MS = 10_000
const SWEEP_ROOMS = 200
/** FR-GM-R.4: this many timeouts in a row with no poll in between remove a seat. */
const ABSENT_TIMEOUTS = 3
/** A poll refreshes a seat's presence at most this often (one write per seat per 5 s). */
const SEEN_GAP_MS = 5_000

@Injectable()
export class RoomsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomsService.name)
  private stopSweep: () => void = () => undefined

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RoomsRepository) private readonly repo: RoomsRepository,
    @Inject(GamesPorts) private readonly ports: GamesPorts,
    @Inject(GameUsers) private readonly users: GameUsers,
    @Inject(NamePrivacy) private readonly privacy: NamePrivacy,
    @Inject(GameQuestions) private readonly questions: GameQuestions,
    @Inject(GameSubjects) private readonly subjects: GameSubjects,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(RoomSecrets) private readonly secrets: RoomSecrets,
    @Inject(GameSettingsService) private readonly settings: GameSettingsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.stopSweep = startGameSweep(RoomsService.name, this.config.get<string>('NODE_ENV'), () => this.sweepAll())
  }

  onModuleDestroy(): void {
    this.stopSweep()
  }

  private async sweepAll(): Promise<number> {
    return (await this.sweepClocks()) + (await this.closeStaleWaiting())
  }

  /** FR-GM-00.7: one pass over the rooms with no poller; every room takes its lock and re-checks. Returns how many moved. */
  async sweepClocks(): Promise<number> {
    const codes = await this.repo.playingIdleSince(new Date(this.clock.now().getTime() - SHORTEST_CLOCK_MS), SWEEP_ROOMS)
    let moved = 0
    for (const code of codes) {
      try {
        const changed = await this.prisma.transaction(async (tx) => {
          await this.repo.lock(code)
          const room = await this.repo.room(code)
          if (room?.status !== 'playing') return false
          return (await this.advance(tx, room, await this.repo.players(code))).room !== room
        })
        if (changed) moved += 1
      } catch (err) {
        this.logger.warn(`Room clock failed for ${code}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return moved
  }

  /** Rooms created at or before this instant have waited `room_waiting_minutes` and are closed (FR-GM-R.5, ruling 51). */
  private async waitingNotBefore(): Promise<Date> {
    const minutes = await this.settings.get('room_waiting_minutes')
    return new Date(this.clock.now().getTime() - minutes * 60_000)
  }

  /** FR-GM-R.5: closes the waiting rooms past `room_waiting_minutes` since creation; every room takes its lock and re-checks. Returns how many closed. */
  async closeStaleWaiting(): Promise<number> {
    const before = await this.waitingNotBefore()
    let closed = 0
    for (const code of await this.repo.waitingCreatedBefore(before, SWEEP_ROOMS)) {
      try {
        const done = await this.prisma.transaction(async () => {
          await this.repo.lock(code)
          const room = await this.repo.room(code)
          if (room?.status !== 'waiting' || room.createdAt.getTime() > before.getTime()) return false
          await this.repo.updateRoom(code, { status: 'closed' }, this.clock.now())
          return true
        })
        if (done) closed += 1
      } catch (err) {
        this.logger.warn(`Waiting room close failed for ${code}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return closed
  }

  // --- hub and lobby ---------------------------------------------------------------------------------------

  async hub(caller: Caller): Promise<GamesHub> {
    const viewer = await this.users.get(caller.userId)
    const open = await this.repo.openRooms(6, viewer?.grade ?? null, await this.waitingNotBefore())
    const names = await this.users.getMany(open.map((r) => r.hostId))
    const seen = await this.privacy.resolver(caller)
    const hostName = (id: string): string => {
      const h = names.get(id)
      return h ? seen.name(h) : ''
    }
    const [played, battled] = await Promise.all([
      this.repo.hasPlayed('papan-bijak', caller.userId),
      this.ports.battle.hasBattled(caller.userId),
    ])
    return {
      openRooms: open.map((r) => ({
        game: r.game as GamesRoomGame,
        code: r.code,
        host: hostName(r.hostId),
        players: r.players,
        max: r.max,
      })),
      chips: { papanBijakPlayed: played, battled },
      enabledGames: await this.enabledGames(caller),
    }
  }

  /**
   * FR-GM-00.1, AC-GM-00.6, 48 section 3.1, ruling 13 on #497: the games switched on (`game_enabled_*`) whose pool for the
   * caller's Tingkatan holds the draw. Text-length rules (Susun Jawapan, Teka Silang Kata) are applied at the start, not here.
   */
  private async enabledGames(caller: Caller): Promise<string[]> {
    const levelId = await this.subjects.levelIdOfGrade((await this.users.get(caller.userId))?.grade ?? DEFAULT_GRADE)
    const filter = levelId === null ? {} : { educationLevelId: levelId }
    const [settings, pool, fourOptionPool] = await Promise.all([
      this.settings.getMany(HUB_GAMES.map(([game]) => `game_enabled_${game}` as const)),
      this.questions.eligibleCount(filter),
      this.questions.eligibleCount({ ...filter, exactOptions: 4 }),
    ])
    return HUB_GAMES.filter(([game, draw, fourOptions]) => settings[`game_enabled_${game}`] === 1 && (fourOptions ? fourOptionPool : pool) >= draw).map(([game]) => game)
  }

  async lobby(caller: Caller, gameParam: string): Promise<GamesLobby> {
    const game = parseGame(gameParam)
    const viewer = await this.users.get(caller.userId)
    const autoGrade = enumOfGrade(viewer?.grade ?? null)
    const base = { autoGrade, autoGradeName: gradeName(viewer?.grade ?? null) }
    if (game === 'papan-bijak') {
      const rows = await this.repo.papanBijakTop(10)
      const names = await this.users.getMany(rows.map((r) => r.userId))
      const seen = await this.privacy.resolver(caller)
      return {
        ...base,
        top10: rows.flatMap((r, i) => {
          const pupil = names.get(r.userId)
          if (pupil === undefined) return []
          // Children's names rule: the name (and so the initials) are computed from what this viewer may see.
          const shown = seen.shown(pupil)
          return [
            {
              rank: i + 1,
              userId: shown.userId,
              name: truncateName(shown.name),
              initials: initialsOf(shown.name),
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
    const seen = await this.privacy.resolver(caller)
    return {
      ...base,
      leaders: rows.flatMap((r, i) => {
        const pupil = names.get(r.userId)
        if (pupil === undefined) return []
        const shown = seen.shown(pupil)
        return [{ rank: i + 1, userId: shown.userId, name: shown.name, value: r.wins }]
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
    if (v.grade_level.startsWith('DARJAH')) throw roomGradeLevelInvalid() // secondary-only (2026-10-29)
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
        await this.repo.addPlayer(code, host.userId, host.isTest, now)
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
      // FR-GM-R.2, 48 GAME-R: exists (above), not started, a free seat, then the Tingkatan; a closed room no longer joins.
      // A waiting room past `room_waiting_minutes` is as good as closed before the sweep writes it (ruling 51).
      const stale = room.status === 'waiting' && room.createdAt.getTime() <= (await this.waitingNotBefore()).getTime()
      if (room.status === 'closed' || stale || room.isTest !== caller.isTest) throw roomNotFound() // no mixed rooms: test actors and normal users never share one
      if (room.status !== 'waiting') throw roomStarted()
      const robots = ps.filter((p) => p.robot !== null)
      if (ps.length - robots.length >= room.maxPlayers) throw roomFull()
      const viewer = await this.users.get(caller.userId)
      if (!gradeFits(room, viewer?.grade ?? null)) throw roomGradeRefused() // AC-GM-R.6, ruling on DOC DEFECT 48: 403 "Tindakan tidak sah."
      // 48 section 3.6, humans first: a pupil takes the seat of a robot, so a robot never blocks a join.
      const seatToFree = robots.at(-1)
      if (seatToFree) await this.repo.removeSeat(seatToFree.id)
      await this.repo.addPlayer(code, caller.userId, caller.isTest, this.clock.now())
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
      return this.viewOf(caller, probe.room, probe.players)
    return this.prisma.transaction(async (tx) => {
      await this.repo.lock(probe.room.code)
      let { room, players } = await this.mustPlayer(caller, game, rawCode)
      if (room.status === 'waiting' && room.hostId === caller.userId) {
        players = await this.robotsAfterWait(room, players)
      }
      if (room.status === 'playing') {
        const after = await this.advance(tx, room, players, caller.userId)
        room = after.room
        players = after.players
      }
      return this.viewOf(caller, room, players)
    })
  }

  // --- start --------------------------------------------------------------------------------------------------

  async start(caller: Caller, gameParam: string, rawCode: string): Promise<GamesRoomView> {
    const game = parseGame(gameParam)
    await this.mustPlayer(caller, game, rawCode)
    return this.prisma.transaction(async (tx) => {
      const probe = await this.mustPlayer(caller, game, rawCode)
      await this.repo.lock(probe.room.code)
      const { room, players: seated } = await this.mustPlayer(caller, game, rawCode)
      if (room.hostId !== caller.userId) throw startHostOnly()
      if (room.status !== 'waiting') throw startAlreadyStarted()
      const players = await this.robotsAfterWait(room, seated)
      if (players.length < GAMES_ROOM_LIMITS[game].minPlayers) throw startNotEnoughPlayers()
      const pool = await this.drawPool(room, game)
      const now = this.clock.now()
      const out = startGame({
        room: engineRoom(room),
        players: enginePlayers(players),
        humanId: caller.userId,
        seed: seedOf(room, this.secrets),
        secretInt: (max) => this.secrets.int(max),
        pool,
        quizTiles: (await this.repo.quizTiles()) ?? DEFAULT_QUIZ_TILES,
        p: await this.botAccuracy(),
        nowMs: now.getTime(),
      })
      // DM-67: every `waiting` to `playing` is a new play of the room, with its own attempt id.
      const sessionId = randomUUID()
      await this.repo.updateRoom(room.code, { status: 'playing', sessionId, startedAt: now }, now)
      const started: RoomRow = { ...room, status: 'playing', sessionId, startedAt: now }
      const done = await this.applyOut(tx, started, players, out)
      return this.viewOf(caller, done.room, done.players)
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
    if (v.type === 'leave') return { type: 'leave' }
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
    if (action.type === 'leave') return this.leave(caller, game, rawCode)
    return this.prisma.transaction(async (tx) => {
      const probe = await this.mustPlayer(caller, game, rawCode)
      await this.repo.lock(probe.room.code)
      const before = await this.mustPlayer(caller, game, rawCode)
      const clocked =
        before.room.status === 'playing'
          ? await this.advance(tx, before.room, before.players, caller.userId)
          : before
      // The clock ended the game just now: the answer arrived too late, so answer with the finished room.
      if (before.room.status === 'playing' && clocked.room.status === 'finished')
        return this.viewOf(caller, clocked.room, clocked.players)
      const { room, players } = clocked
      const movedByClock = room !== before.room
      if (room.status !== 'playing' || !room.state) throw actionNotStarted()
      // Seat-keyed: the room waits for one seat (its turn, or the one acting human of an own-part game); nobody else may act.
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
        return this.viewOf(caller, done.room, done.players)
      } catch (e) {
        // The clock moved the room during this request, so the action was for a turn that has passed: a refusal would roll
        // the timeouts back. They commit and the pupil gets the room as it now stands.
        if (movedByClock && e instanceof EngineRefusal) return this.viewOf(caller, room, players)
        throw mapRefusal(e)
      }
    })
  }

  // --- leave (Keluar) ---------------------------------------------------------------------------------------------

  /**
   * 48 GAME-R "Absent, leave": `Keluar` in `waiting` frees the seat and the host leaving closes the room; in `playing` it
   * forfeits the seat (0 XP, no reward, no standing). A finished or closed room answers unchanged. The leaver is no longer a
   * player afterwards, so the answer is the room as the others now see it.
   */
  private async leave(caller: Caller, game: GamesRoomGame, rawCode: string): Promise<GamesRoomView> {
    return this.prisma.transaction(async (tx) => {
      const probe = await this.mustPlayer(caller, game, rawCode)
      await this.repo.lock(probe.room.code)
      let { room, players } = await this.mustPlayer(caller, game, rawCode)
      if (room.status === 'playing') {
        const after = await this.advance(tx, room, players, caller.userId)
        room = after.room
        players = after.players
      }
      if (room.status === 'waiting') return this.leaveWaiting(caller, room, players)
      const seat = players.find((p) => p.userId === caller.userId)
      if (room.status === 'playing' && room.state && seat) {
        const rest = await this.dropSeat(tx, room, players, seat)
        return this.viewOf(caller, rest.room, rest.players)
      }
      return this.viewOf(caller, room, players)
    })
  }

  private async leaveWaiting(caller: Caller, room: RoomRow, players: PlayerRow[]): Promise<GamesRoomView> {
    if (room.hostId === caller.userId) {
      await this.repo.updateRoom(room.code, { status: 'closed' }, this.clock.now())
      return this.viewOf(caller, { ...room, status: 'closed' }, players)
    }
    const seat = players.find((p) => p.userId === caller.userId)
    if (seat) await this.repo.removeSeat(seat.id)
    return this.viewOf(caller, room, players.filter((p) => p !== seat))
  }

  /**
   * Ruling 50 and R1 Q1-Q3 (lead answers on #983): a human leaves a game in play (Keluar, or 3 timeouts in a row). A leaver always
   * gets jumlah + 1, menang 0, XP 0 and no reward, in every room game that writes standings (2 or more humans started). While
   * 2 or more humans remain a robot takes the seat and the game goes on (the seat keeps its place and points). With exactly 1
   * human left that human wins by default if present (polled within `games_absent_seconds`); with no human left, or one who is
   * not present, the game ends and nothing is settled. This is not tied to the host role.
   */
  private async dropSeat(
    tx: TxClient,
    room: RoomRow,
    players: PlayerRow[],
    seat: PlayerRow,
  ): Promise<{ room: RoomRow; players: PlayerRow[] }> {
    const st = room.state as RoomState
    const now = this.clock.now()
    if (!room.isTest && !seat.isTest && seat.userId !== null && startedHumans(st, enginePlayers(players)) >= 2) {
      await this.repo.bumpStanding(room.game, seat.userId, { wins: 0, jumlah: 1, betul: 0, skor: 0 }, now)
    }
    const left = players.filter((p) => !p.isBot && p !== seat)
    if (left.length >= 2) {
      await this.repo.seatToRobot(seat.id)
      const after = await this.repo.players(room.code)
      const remap: Record<string, string> = {}
      for (const old of players) {
        const next = after.find((p) => p.id === old.id)
        if (next && next.seat !== old.seat) remap[old.seat] = next.seat
      }
      const out = handOverSeat({
        room: engineRoom(room),
        players: enginePlayers(after),
        state: st,
        remap,
        leaver: seat.seat,
        p: await this.botAccuracy(),
        nowMs: now.getTime(),
      })
      return this.applyOut(tx, room, after, out)
    }
    const last = left[0]
    // The leaver gives the seat up when a human stays to win by default; with nobody left the seat stays as the record of the
    // ended game (the leaver can still read the finished room).
    if (last) await this.repo.removeSeat(seat.id)
    const rest = last ? players.filter((p) => p !== seat) : players
    const absentMs = (await this.settings.get('games_absent_seconds')) * 1000
    const seen = last ? st.seats?.[last.seat]?.seenMs : null
    const present = seen !== null && seen !== undefined && now.getTime() - seen <= absentMs
    if (last && present) {
      const state: RoomState = { ...st, humanId: last.seat, awaiting: null, pendingQ: null, winnerId: last.seat, mvpId: last.seat }
      return this.applyOut(tx, room, rest, { state, players: enginePlayers(rest), finished: true })
    }
    // Nobody present is left: the game ends with no winner, no standing and no reward (`settledAt` is set so nothing settles later).
    const state: RoomState = { ...st, awaiting: null, pendingQ: null, winnerId: null, mvpId: null }
    const result = {
      winnerId: null,
      mvpId: null,
      scores: rest.map((p) => ({ userId: p.seat, points: p.points, correct: p.correct })),
      forfeitedBy: seat.userId,
    }
    await this.repo.updateRoom(room.code, { state, status: 'finished', finishedAt: now, result, settledAt: now }, now)
    return { room: { ...room, state, status: 'finished', finishedAt: now, result, settledAt: now }, players: rest }
  }

  // --- engine plumbing -------------------------------------------------------------------------------------------

  private async botAccuracy(): Promise<number> {
    const p = await this.ports.platformAccuracy.accuracy()
    return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0
  }

  /**
   * The one locked advance of a playing room, shared by the poll, the 5 s sweep and the action (the caller holds the room row
   * lock): marks the caller present, resolves the server clocks (idempotent: same time, same result) and removes the seats
   * that missed 3 turns in a row. Calling it again moves nothing.
   */
  private async advance(
    tx: TxClient,
    room: RoomRow,
    players: PlayerRow[],
    seen?: string,
  ): Promise<{ room: RoomRow; players: PlayerRow[] }> {
    if (room.status !== 'playing' || !room.state) return { room, players }
    let cur = { room, players }
    // Presence is written in place: the room object stays the same, so a caller can tell the clock moved the room.
    if (seen !== undefined && markSeen(room.state, seen, this.clock.now().getTime(), SEEN_GAP_MS)) {
      await this.repo.updateRoom(room.code, { state: room.state }, this.clock.now())
    }
    cur = await this.runClocks(tx, cur.room, cur.players)
    for (let i = 0; i < 8; i++) {
      const st = cur.room.state
      if (cur.room.status !== 'playing' || !st) break
      // Multi-human games only (Papan Bijak, Kuiz Relay) and only while another human could carry on; a lone human or an
      // own-part game keeps timing out as before, and the game ends by its own rules.
      if (!isMultiHuman(cur.room.game as GamesRoomGame) || cur.players.filter((p) => !p.isBot).length < 2) break
      const absent = cur.players.find((p) => !p.isBot && (st.seats?.[p.seat]?.missed ?? 0) >= ABSENT_TIMEOUTS)
      if (!absent) break
      cur = await this.dropSeat(tx, cur.room, cur.players, absent)
    }
    return cur.room === room ? { room, players } : cur
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
      answered: res.answered,
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
    // FR-GM-00.5, 48 section 3.5: in the same transaction as the state change; Mod Pelajar writes no row.
    if (!room.isTest) {
      for (const a of out.answered ?? []) {
        await this.ports.answers.record(
          gameAnswerEntry({
            userId: a.userId,
            attemptId: room.sessionId,
            questionId: a.questionId,
            gameKey: room.game,
            position: a.position,
            isCorrect: a.correct,
            answeredAt: new Date(a.atMs),
          }),
        )
      }
    }
    for (const ep of out.players) {
      const row = players.find((p) => p.seat === ep.userId)
      if (row)
        await this.repo.updatePlayer(row.id, {
          team: ep.team,
          points: ep.points,
          correct: ep.correct,
        })
    }
    const nextPlayers = players.map((p) => {
      const ep = out.players.find((x) => x.userId === p.seat)
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

  /**
   * AC10, 48 GAME-R: standings for every human of a game that 2 or more humans started (none otherwise), and one reward report
   * per human who stayed: one `onGameResult` each (the port keeps one reward event per session and pupil), each from the one
   * formula, the pace guard per player. The Mod Pelajar actor never earns.
   */
  private async settle(
    tx: TxClient,
    room: RoomRow,
    players: PlayerRow[],
    out: EngineOut,
  ): Promise<void> {
    const game = room.game as GamesRoomGame
    const s = computeSettlement({ code: room.code, game, state: out.state, players: out.players })
    const now = this.clock.now()
    const byId = new Map(players.map((p) => [p.seat, p]))
    for (const d of s.standings) {
      if (byId.get(d.userId)?.isTest || (d.wins === 0 && d.jumlah === 0)) continue
      await this.repo.bumpStanding(game, d.userId, d, now)
    }
    for (const r of s.reports) {
      if (byId.get(r.userId)?.isTest) continue // the Mod Pelajar actor never earns: no reward call at all
      if (this.paceTripped(room, out.state, r.userId, await this.settings.get('games_min_ms_per_answer'))) continue // 48 section 3.4 rule 5: stored and scored, credits nothing
      const reward = await rewardNow(this.settings, tx, { correct: r.correct, outcome: r.outcome, robotsOnly: r.robotsOnly, fastGap: false })
      await this.ports.rewards.onGameResult(
        r.userId,
        {
          game: r.game,
          event: r.event,
          coins: reward.coins,
          xp: reward.xp,
          correct: r.correct,
          total: r.total,
          detail: r.detail,
          key: room.code,
          session: { id: room.sessionId, gameKey: room.game },
        },
        { tx, isTest: false },
      )
    }
  }

  /** Rule 5 of 48 section 3.4, per player: a gap between this human's answers (the first: from the start) is under the minimum. */
  private paceTripped(room: RoomRow, st: RoomState, userId: string, minMs: number): boolean {
    const times = (st.seats?.[userId]?.answerMs ?? []).map((ms) => new Date(ms))
    return hasFastGap(room.startedAt ?? room.createdAt, times, minMs)
  }

  /** The reward block of the finished room for the caller; nothing for a seat that did not play or left, or for Mod Pelajar. */
  private async rewardOf(caller: Caller, room: RoomRow, st: RoomState, players: PlayerRow[]): Promise<GamesReward | undefined> {
    if (room.isTest || isRecord(room.result) && room.result.forfeitedBy !== undefined) return undefined
    if (!playedHumans(room.game as GamesRoomGame, st, enginePlayers(players)).some((p) => p.userId === caller.userId)) return undefined
    const first = await this.ports.rewards.firstGameResult(room.sessionId, caller.userId)
    if (first) return rewardBlock(first)
    return this.paceTripped(room, st, caller.userId, await this.settings.get('games_min_ms_per_answer')) ? PACE_GUARD_REWARD : undefined
  }

  /** 48 GAME-R: the robots of a room that has waited `battle_bot_fallback_seconds` below its minimum; else the seats as they are. */
  private async robotsAfterWait(room: RoomRow, players: PlayerRow[]): Promise<PlayerRow[]> {
    const waited = this.clock.now().getTime() - room.createdAt.getTime()
    const seconds = await this.settings.get('battle_bot_fallback_seconds')
    return waited >= seconds * 1000 ? this.addRobots(room, players) : players
  }

  /** Ruling 53: seconds until robots may join a waiting room (counted from creation); null when none will (robots off, never, or the minimum is met). */
  private async robotInSeconds(room: RoomRow, seated: number): Promise<number | null> {
    if (seated >= GAMES_ROOM_LIMITS[room.game as GamesRoomGame].minPlayers) return null
    const s = await this.settings.getMany(['games_room_bots_enabled', 'battle_bot_fallback_seconds'])
    if (s.games_room_bots_enabled !== 1 || s.battle_bot_fallback_seconds === 0) return null
    const waited = this.clock.now().getTime() - room.createdAt.getTime()
    return Math.max(0, Math.ceil((s.battle_bot_fallback_seconds * 1000 - waited) / 1000))
  }

  /** One robot per seat missing to the minimum, when robots are on (`games_room_bots_enabled`; a fallback of 0 is "never a robot", 48 section 2). */
  async addRobots(room: RoomRow, players: PlayerRow[]): Promise<PlayerRow[]> {
    const missing = GAMES_ROOM_LIMITS[room.game as GamesRoomGame].minPlayers - players.length
    if (missing <= 0) return players
    const s = await this.settings.getMany(['games_room_bots_enabled', 'battle_bot_fallback_seconds'])
    if (s.games_room_bots_enabled !== 1 || s.battle_bot_fallback_seconds === 0) return players
    for (let i = 0; i < missing; i++) await this.repo.addRobot(room.code, room.isTest, this.clock.now())
    return this.repo.players(room.code)
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
      const served = await this.questions.draw(filter, game === 'teka-silang-kata' ? n * 4 : n, rng, room.hostId)
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
      if (pool.length >= n) return pool
    }
    throw startNotEnoughQuestions()
  }

  // --- view building -----------------------------------------------------------------------------------------------

  private async viewOf(caller: Caller, room: RoomRow, players: PlayerRow[]): Promise<GamesRoomView> {
    const game = room.game as GamesRoomGame
    const ids = [room.hostId, ...players.flatMap((p) => (p.userId === null ? [] : [p.userId]))]
    const st = room.status === 'waiting' || room.status === 'closed' ? null : room.state // a waiting (or closed) room only stores its secret seed
    const names = await this.users.getMany(ids)
    // Children's names rule: players, host, winner and scores show a name the caller may see, else first given name.
    // Ids stay: they key `state.positions` / `meter` and `humanId`, which the room client needs to draw the game.
    const seen = await this.privacy.resolver(caller)
    const nameOf = (id: string): string => {
      const u = names.get(id)
      return u ? seen.name(u) : ''
    }
    // A robot is never shown as a person, also on a seat from before FR-GM-00.4 that still points at a pupil.
    const seatName = (p: PlayerRow): string =>
      p.robot !== null ? `${GAMES_ROBOT_NAME} ${String(p.robot)}` : nameOf(p.seat)
    const nowMs = this.clock.now().getTime()
    const view: GamesRoomView = {
      code: room.code,
      game,
      status: room.status as GamesRoomView['status'],
      host: { id: room.hostId, name: nameOf(room.hostId) },
      players: players.map((p) => ({
        id: p.seat,
        name: seatName(p),
        grade: p.robot === null ? gradeLabel((names.get(p.seat) as GameUser | undefined)?.grade ?? null) : '',
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
    if (st && youAnswered(st, caller.userId)) view.youAnswered = true
    if (room.status === 'waiting') {
      const robotIn = await this.robotInSeconds(room, players.length)
      if (robotIn !== null) view.robotInSeconds = robotIn
    }
    const endsAt = st ? roundEndsAtMs(game, room.status, st, room.startedAt ? room.startedAt.getTime() : null) : null
    if (endsAt !== null) view.roundEndsAt = toMytTimestamp(new Date(endsAt))
    const q = questionView(game, room.status, st)
    if (q) view.question = q
    if (room.status === 'finished' && st) {
      const winnerSeat = players.find((p) => p.seat === st.winnerId)
      view.result = {
        winnerId: st.winnerId,
        winnerName: winnerSeat ? seatName(winnerSeat) : null,
        mvpId: st.mvpId,
        scores: players.map((p) => ({
          userId: p.seat,
          name: seatName(p),
          points: p.points,
          correct: p.correct,
        })),
      }
      const reward = await this.rewardOf(caller, room, st, players)
      if (reward) view.result.reward = reward
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
    userId: p.seat,
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
