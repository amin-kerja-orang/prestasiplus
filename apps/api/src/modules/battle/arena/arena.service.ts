/**
 * Lobby and arena (M16-15 to M16-17; BR-M16-02, BR-M16-07, BR-M16-08; 48 GAME-01). Scoring is server side only: the body carries
 * `questionId`, `optionId` and `seconds`, nothing else is read. A battle is visible to its two players only (anyone else:
 * 404 "Battle tidak dijumpai.").
 *
 * Rounds are shared (FR-GM-01.3). Both seats are in the same round `battles.answered + 1`; it opened at `round_started_at` and
 * closes when both seats have a row for it, or when N + grace (`battle_question_seconds`, `battle_grace_seconds`) have
 * passed: a seat with no row then gets a timeout row stamped at the end of the window. A closed round is revealed for 3 s: its
 * closing sets `round_started_at` to the closing time + 3 s (so a start in the future means "reveal"), then the next round
 * opens. Everything is derived from the rows and the injected clock, under the battle row lock, so a poll, the 5 s sweep and an
 * answer all advance a round exactly once and in any order (the stamps do not depend on who ran). The robot seat answers
 * `botAnswer(..).seconds` after the round opens; a human opponent is never simulated.
 */
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BATTLE_MESSAGES, BATTLE_RULES, GAMES_ROBOT_NAME, battleArenaPoints, battleWinner, type BattleArenaReveal, type GamesReward } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import { idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { startGameSweep } from '../../games/core/time'
import type { ArenaQuestionView } from '../battle.deps'
import { BattleEngine, botAnswer, gradeLabel, isUuid, type BattleTiming } from '../engine'
import { displayName } from '../privacy'
import { ForfeitService } from '../queue'

/** Subjects whose SPM pool the lobby counts at the same time. */
const LOBBY_PARALLEL = 4
const SWEEP_BATTLES = 200
/** FR-GM-01.7, ruling 29 on #497: this many timeouts in a row, polled or not, forfeit the seat. */
const FORFEIT_TIMEOUTS = 3

type Side = 'A' | 'B'
interface Result {
  winner: Side | null
  scoreA: number
  scoreB: number
  reward?: GamesReward
}

interface Seat {
  id: bigint
  side: string
  userId: bigint | null
  isBot: boolean
  score: number
  correct: number
}
interface BattleRow {
  id: string
  status: string
  answered: number
  questionCount: number
  roundStartedAt: Date | null
  createdAt: Date
  isTest: boolean
  participants: Seat[]
}
interface AnswerRow {
  userId: bigint | null
  position: number
  optionId: number | null
  correct: boolean
  points: number
  createdAt: Date
}

const notFound = (message: string = BATTLE_MESSAGES.battleNotFound): ApiError => ApiError.of('NOT_FOUND', { message })
const invalid = (field: string, message: string): ApiError => ApiError.of('VALIDATION_ERROR', { message, fields: { [field]: message } })

const asRecord = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {}

/** A participant that is a user; a robot has no `user_id` (DM-60). */
const hasUser = <P extends { userId: bigint | null }>(p: P): p is P & { userId: bigint } => p.userId !== null

/** A seat a pupil plays: has a user and is not the robot. */
const isHuman = (p: Seat): p is Seat & { userId: bigint } => p.userId !== null && !p.isBot

/** When the current round opened: the stored start, the battle start for a battle from before the shared loop. */
const roundStart = (b: { roundStartedAt: Date | null; createdAt: Date }): Date => b.roundStartedAt ?? b.createdAt

/** A wrong pick of the robot: any option but the key (every question has at least two). */
const robotWrongPick = (key: number): number => (key === 1 ? 0 : 1)

@Injectable()
export class ArenaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArenaService.name)
  private stopSweep: () => void = () => undefined

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BattleEngine) private readonly engine: BattleEngine,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ForfeitService) private readonly forfeits: ForfeitService,
  ) {}

  onModuleInit(): void {
    this.stopSweep = startGameSweep(ArenaService.name, this.config.get<string>('NODE_ENV'), () => this.sweepClocks())
  }

  onModuleDestroy(): void {
    this.stopSweep()
  }

  /** FR-GM-00.7: one pass over the active battles whose round window has run out. Returns how many timeouts it stored. */
  async sweepClocks(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - (await this.engine.timing()).limitMs)
    const due = await this.prisma.client.$queryRaw<{ id: string }[]>`
      SELECT b.id::text AS id FROM battles b
       WHERE b.status = 'active' AND COALESCE(b.round_started_at, b.created_at) <= ${cutoff}
       ORDER BY COALESCE(b.round_started_at, b.created_at)
       LIMIT ${SWEEP_BATTLES}`
    let timedOut = 0
    for (const { id } of due) {
      try {
        timedOut += await this.advance(id)
      } catch (err) {
        this.logger.warn(`Battle clock failed for ${id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return timedOut
  }

  /**
   * Moves the rounds of a battle to where the clock says they are (a poll and the sweep call it). Cheap when nothing is due; else it
   * locks the battle row, re-reads it and runs the rounds that are over. Returns the timeouts stored.
   */
  async advance(uuid: string): Promise<number> {
    const snap = await this.prisma.client.battle.findUnique({ where: { id: uuid }, include: { participants: true } })
    if (!snap || snap.status !== 'active') return 0
    const timing = await this.engine.timing()
    const now = this.clock.now()
    if (!(await this.due(snap, timing, now))) return 0
    const accuracy = snap.participants.some((p) => p.isBot) ? await this.engine.botAccuracy() : 0
    return this.prisma.transaction(async (tx) => {
      const locked = await this.lock(uuid)
      if (!locked || locked.status !== 'active') return 0
      return (await this.runRounds(tx, locked, now, timing, accuracy)).timedOut
    })
  }

  /** True when the open round has something to do: its window ran out, the robot's time came, or both rows are there. */
  private async due(b: BattleRow, timing: BattleTiming, now: Date): Promise<boolean> {
    const start = roundStart(b)
    if (now.getTime() < start.getTime()) return false
    const round = b.answered + 1
    if (round > b.questionCount) return true
    const elapsed = now.getTime() - start.getTime()
    if (elapsed > timing.limitMs) return true
    const rows = await this.prisma.client.battleAnswer.findMany({ where: { battleId: b.id, position: round }, select: { userId: true } })
    if (rows.length >= b.participants.length) return true
    const robot = b.participants.find((p) => p.isBot)
    return robot !== undefined && !rows.some((r) => r.userId === robot.userId) && elapsed >= botAnswer(b.id, round, 1, timing.questionSeconds).seconds * 1000
  }

  /** The row lock of the battle (the same for an answer, a forfeit and the clock), then the battle as it now is. */
  private async lock(uuid: string): Promise<BattleRow | null> {
    await this.prisma.client.$queryRaw`SELECT id FROM battles WHERE id = ${uuid}::uuid FOR UPDATE`
    return this.prisma.client.battle.findUnique({ where: { id: uuid }, include: { participants: true } })
  }

  /**
   * Runs the rounds the clock has passed, under the row lock of `b` (an `active` battle). Round `r` = `answered + 1`:
   *  - the robot's row is stored once its time came (`start + seconds`), a seat of a pupil with no row after N + grace gets a timeout
   *    stamped at `start + N + grace`;
   *  - with a row from both seats the round closes at the later row: scores are added, `answered` = r, the next round opens 3 s after;
   *  - a pupil with 3 timeouts in a row forfeits (both: the battle is `abandoned`); after the last round the battle finishes once, with
   *    the reward of each pupil. A start still in the future is the reveal: the loop stops there.
   * Every stamp is a function of the stored rows, so the loop gives the same state whoever runs it first.
   */
  private async runRounds(tx: Parameters<ForfeitService['forfeitLocked']>[0], b: BattleRow, now: Date, timing: BattleTiming, accuracy: number): Promise<{ timedOut: number }> {
    let timedOut = 0
    let answered = b.answered
    let start = roundStart(b)
    while (answered < b.questionCount && now.getTime() >= start.getTime()) {
      const round = answered + 1
      const question = await this.questionAt(b.id, round)
      if (!question) break
      const deadline = start.getTime() + timing.limitMs
      const rows: AnswerRow[] = await this.prisma.client.battleAnswer.findMany({ where: { battleId: b.id, position: round } })
      for (const seat of b.participants) {
        if (rows.some((r) => r.userId === seat.userId)) continue
        if (seat.isBot) {
          const bot = botAnswer(b.id, round, accuracy, timing.questionSeconds)
          const at = new Date(start.getTime() + bot.seconds * 1000)
          if (at.getTime() > now.getTime()) continue
          const row = { battleId: b.id, userId: seat.userId, position: round, questionId: question.questionId, optionId: null, correct: bot.correct, seconds: bot.seconds, points: bot.points, createdAt: at }
          await this.prisma.client.battleAnswer.create({ data: row })
          rows.push(row)
        } else if (now.getTime() > deadline && isHuman(seat)) {
          const at = new Date(deadline)
          const row = { battleId: b.id, userId: seat.userId, position: round, questionId: question.questionId, optionId: null, correct: false, seconds: timing.questionSeconds, points: 0, createdAt: at }
          await this.prisma.client.battleAnswer.create({ data: row })
          if (!b.isTest) await this.engine.recordAnswer({ userId: idToString(seat.userId), battleId: b.id, questionId: idToString(question.questionId), position: round, isCorrect: false, answeredAt: at })
          rows.push(row)
          timedOut += 1
        }
      }
      if (rows.length < b.participants.length) break
      // The round is closed: at the later of the two rows.
      const closedAt = Math.max(...rows.map((r) => r.createdAt.getTime()))
      for (const seat of b.participants) {
        const row = rows.find((r) => r.userId === seat.userId)
        if (!row) continue
        const updated = await this.prisma.client.battleParticipant.update({ where: { id: seat.id }, data: { score: { increment: row.points }, correct: { increment: row.correct ? 1 : 0 } } })
        seat.score = updated.score
        seat.correct = updated.correct
      }
      answered = round
      start = new Date(closedAt + timing.revealMs)
      await this.prisma.client.battle.update({ where: { id: b.id }, data: { answered, roundStartedAt: start } })
      const gone = await this.absentSeats(b)
      if (gone.length === 2) {
        await this.prisma.client.battle.update({ where: { id: b.id }, data: { status: 'abandoned', winner: null, finishedAt: now } })
        return { timedOut }
      }
      if (gone.length === 1) {
        await this.forfeits.forfeitLocked(tx, { id: b.id, createdAt: b.createdAt, answered, isTest: b.isTest }, gone[0] as Side)
        return { timedOut }
      }
      if (answered >= b.questionCount) {
        await this.finish(tx, b, new Date(closedAt))
        return { timedOut }
      }
    }
    return { timedOut }
  }

  /** The sides of the pupils whose last FORFEIT_TIMEOUTS answers are all timeouts (an in-time answer, right or wrong, ends the run). */
  private async absentSeats(b: BattleRow): Promise<Side[]> {
    const out: Side[] = []
    for (const seat of b.participants.filter(isHuman)) {
      const last = await this.prisma.client.battleAnswer.findMany({ where: { battleId: b.id, userId: seat.userId }, orderBy: { position: 'desc' }, take: FORFEIT_TIMEOUTS, select: { optionId: true } })
      if (last.length === FORFEIT_TIMEOUTS && last.every((r) => r.optionId === null)) out.push(seat.side as Side)
    }
    return out
  }

  /** The last round closed: the battle finishes once and each pupil's reward goes to M14 in the same transaction (keyed by the battle). */
  private async finish(tx: Parameters<ForfeitService['forfeitLocked']>[0], b: BattleRow, at: Date): Promise<void> {
    const a = b.participants.find((p) => p.side === 'A')
    const bb = b.participants.find((p) => p.side === 'B')
    if (!a || !bb) throw notFound()
    const winner = battleWinner(a.score, bb.score)
    await this.prisma.client.battle.update({ where: { id: b.id }, data: { status: 'finished', winner, finishedAt: at } })
    for (const seat of b.participants.filter(isHuman)) {
      const other = b.participants.find((p) => p.side !== seat.side)
      await this.engine.report({ tx, battleId: b.id, startedAt: b.createdAt, userId: idToString(seat.userId), side: seat.side as Side, winner, forfeited: false, robotsOnly: other?.isBot ?? true, correct: seat.correct, total: b.questionCount, isTest: b.isTest })
    }
  }

  /** M16-15. */
  async lobby(who: { userId: string; role: string }) {
    const deps = this.engine.deps
    const grade = await deps.gradeOf(who.userId)
    const unlocked = grade !== null && grade >= BATTLE_RULES.spmMinGrade
    const subjects = (await deps.subjects()).sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
    const out = {
      grade,
      gradeLabel: gradeLabel(grade),
      spmUnlocked: unlocked,
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, icon: s.icon, colour: s.colour, core: s.core })),
      pkskDomains: (await deps.pkskDomains()).map((d) => ({ id: d.id, name: d.name, icon: d.icon, colour: d.colour })),
      pkskAccess: await deps.pkskAccess(who),
    }
    if (!unlocked) return out
    // Bounded parallelism: a few subjects at a time (the counts are cached by the deps).
    const withPool = new Set<string>()
    for (let i = 0; i < subjects.length; i += LOBBY_PARALLEL) {
      const batch = subjects.slice(i, i + LOBBY_PARALLEL)
      const counts = await Promise.all(batch.map((s) => deps.spmPoolCount(s.id)))
      batch.forEach((s, j) => (counts[j] ?? 0) > 0 && withPool.add(s.id))
    }
    return { ...out, spmSubjects: subjects.filter((s) => withPool.has(s.id)).map((s) => ({ id: s.id, name: s.name })) }
  }

  private async load(uuid: string, userId: string) {
    if (!isUuid(uuid)) throw notFound()
    const battle = await this.prisma.client.battle.findUnique({ where: { id: uuid }, include: { participants: true } })
    // A seat marked is_bot, also one from before FR-GM-00.4 that still points at a pupil, is not a participant: same not-found as a stranger.
    const mine = battle?.participants.filter(hasUser).find((p) => idToString(p.userId) === userId && !p.isBot)
    if (!battle || !mine) throw notFound()
    return { battle, mine }
  }

  /** M16-16. */
  async view(uuid: string, userId: string) {
    const opened = await this.load(uuid, userId)
    // 48 section 3.3: a poll moves the clock too. A round past its window is closed, then the battle is read as it now stands.
    // A read never fails on it: the sweep retries, so an error here is logged and the view is still answered.
    if (opened.battle.status === 'active') {
      try {
        await this.advance(uuid)
      } catch (err) {
        this.logger.warn(`Battle clock failed on view for ${uuid}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    const { battle, mine } = await this.load(uuid, userId)
    const a = battle.participants.find((p) => p.side === 'A')
    const b = battle.participants.find((p) => p.side === 'B')
    if (!a || !b) throw notFound()
    const active = battle.status === 'active'
    const timing = await this.engine.timing()
    const now = this.clock.now()
    const start = roundStart(battle)
    const revealing = active && now.getTime() < start.getTime() && battle.answered >= 1
    const phase = !active ? ('finished' as const) : revealing ? ('reveal' as const) : ('answering' as const)
    // The round on screen: the open one, or (reveal) the one just closed. A finished battle shows its last round.
    const shown = !active ? Math.min(Math.max(battle.answered, 1), battle.questionCount) : revealing ? battle.answered : battle.answered + 1
    let question: ArenaQuestionView | null = null
    if (active) {
      const row = await this.questionAt(uuid, shown)
      question = row ? await this.engine.deps.arenaQuestion(idToString(row.questionId)) : null
      if (!question) throw notFound(BATTLE_MESSAGES.questionNotFound)
    }
    const reveal = (active ? revealing : battle.status === 'finished') ? await this.revealOf(battle, mine, shown) : undefined
    const left = Math.ceil((start.getTime() + timing.questionSeconds * 1000 - now.getTime()) / 1000)
    const secondsLeft = phase === 'answering' ? Math.min(timing.questionSeconds, Math.max(0, left)) : 0
    const roundEndsAt = phase === 'answering' ? start.getTime() + timing.limitMs : phase === 'reveal' ? start.getTime() : null
    const reward = active ? undefined : await this.engine.rewardOf(uuid, userId, battle.createdAt, battle.isTest)
    const people = await this.engine.deps.players([a, b].filter(hasUser).map((p) => idToString(p.userId)))
    // FR-GM-00.8, 48 section 3.10: the opponent by first given name, no school; `school` stays in the contract, always empty.
    // FR-MUR-21-9: a robot is "Robot PrestasiPlus", also on a seat from before FR-GM-00.4 that still points at a pupil.
    const player = (p: typeof a) => {
      if (p.isBot) return { name: GAMES_ROBOT_NAME, school: '', isBot: true }
      const name = (p.userId === null ? undefined : people.get(idToString(p.userId)))?.name ?? ''
      return { name: (p.side === mine.side ? name : displayName(name)) || 'Pelajar', school: '', isBot: false }
    }
    return {
      uuid,
      status: battle.status,
      you: mine.side as Side,
      players: { A: player(a), B: player(b) },
      scores: { A: a.score, B: b.score },
      index: shown,
      total: battle.questionCount,
      question,
      secondsLeft,
      ...(roundEndsAt !== null ? { roundEndsAt: toMytTimestamp(new Date(roundEndsAt)) } : {}),
      phase,
      ...(reveal ? { reveal } : {}),
      ...(active ? {} : { result: { winner: battle.winner as Side | null, scoreA: a.score, scoreB: b.score, ...(reward ? { reward } : {}) } as Result }),
    }
  }

  /** The key and both sides' picks and points of closed round `round`; undefined when it has no two rows or its question is gone. */
  private async revealOf(battle: BattleRow, mine: Seat, round: number): Promise<BattleArenaReveal | undefined> {
    const question = await this.questionAt(battle.id, round)
    if (!question) return undefined
    const rows: AnswerRow[] = await this.prisma.client.battleAnswer.findMany({ where: { battleId: battle.id, position: round } })
    const mineRow = rows.find((r) => r.userId === mine.userId)
    const theirs = battle.participants.find((p) => p.side !== mine.side)
    const theirRow = theirs ? rows.find((r) => r.userId === theirs.userId) : undefined
    if (!mineRow || !theirRow || !theirs) return undefined
    const key = (await this.engine.deps.gradeAnswer(idToString(question.questionId), null))?.correctOptionId
    if (key === undefined) return undefined
    const side = (row: AnswerRow, robot: boolean) => ({ optionId: robot ? (row.correct ? key : robotWrongPick(key)) : row.optionId, correct: row.correct, points: row.points })
    return { index: round, correctOptionId: key, you: side(mineRow, false), opponent: side(theirRow, theirs.isBot) }
  }

  /**
   * M16-17. Everything that reads the owners' tables (grading, the bot accuracy, the timing) happens BEFORE the transaction; the
   * transaction then locks the battle row, re-checks that the round did not move and that the caller has no row for it, so two
   * identical concurrent answers store one answer (the loser gets "Soalan tidak sah." like any replay). The answer is stored, then
   * the rounds are run (the other seat's row, the close, the finish).
   */
  async answer(uuid: string, userId: string, body: unknown) {
    const input = asRecord(body)
    const { battle, mine } = await this.load(uuid, userId)
    if (battle.status !== 'active') throw ApiError.of('CONFLICT', { message: BATTLE_MESSAGES.battleOver })
    const round = battle.answered + 1
    const expected = round <= battle.questionCount ? await this.questionAt(uuid, round) : null
    if (!expected) throw ApiError.of('CONFLICT', { message: BATTLE_MESSAGES.battleOver })
    const questionId = idToString(expected.questionId)
    if (input.questionId !== questionId) throw invalid('questionId', BATTLE_MESSAGES.questionInvalid)
    const raw = input.optionId ?? null
    if (raw !== null && !(typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 3)) throw invalid('optionId', BATTLE_MESSAGES.answerInvalid)
    const optionId = raw as number | null
    const timing = await this.engine.timing()
    const seconds = input.seconds
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || seconds > timing.questionSeconds) {
      throw invalid('seconds', BATTLE_MESSAGES.timeInvalid)
    }
    const graded = await this.engine.deps.gradeAnswer(questionId, optionId)
    if (!graded) throw notFound(BATTLE_MESSAGES.questionNotFound)
    const accuracy = battle.participants.some((p) => p.isBot) ? await this.engine.botAccuracy() : 0
    const now = this.clock.now()

    const out = await this.prisma
      .transaction(async (tx) => {
        const locked = await this.lock(uuid)
        if (!locked) throw notFound()
        if (locked.status !== 'active') throw ApiError.of('CONFLICT', { message: BATTLE_MESSAGES.battleOver })
        // The round moved since the question was read, the round is still in its reveal, or this seat already has its row: not the next question.
        const start = roundStart(locked)
        if (locked.answered !== battle.answered || now.getTime() < start.getTime()) throw invalid('questionId', BATTLE_MESSAGES.questionInvalid)
        if ((await this.prisma.client.battleAnswer.count({ where: { battleId: uuid, userId: mine.userId, position: round } })) > 0) throw invalid('questionId', BATTLE_MESSAGES.questionInvalid)
        // Time is the server's: the round opened at `round_started_at`. The client's `seconds` can only make the answer slower, never faster.
        const elapsedMs = now.getTime() - start.getTime()
        const timedOut = elapsedMs > timing.limitMs
        const whole = timedOut ? timing.questionSeconds : Math.min(timing.questionSeconds, Math.max(Math.floor(seconds), Math.floor(elapsedMs / 1000)))
        const correct = !timedOut && graded.correct
        const points = correct ? battleArenaPoints(whole, timing.questionSeconds, timing.graceSeconds) : 0
        // A late answer is a timeout stamped at the end of the window, like the one the clock stores.
        const at = timedOut ? new Date(start.getTime() + timing.limitMs) : now
        await this.prisma.client.battleAnswer.create({
          data: { battleId: uuid, userId: mine.userId, position: round, questionId: expected.questionId, optionId: timedOut ? null : optionId, correct, seconds: whole, points, createdAt: at },
        })
        if (!locked.isTest) await this.engine.recordAnswer({ userId, battleId: uuid, questionId, position: round, isCorrect: correct, answeredAt: at })
        await this.runRounds(tx, locked, now, timing, accuracy)
        return { points, correct, timedOut }
      })
      .catch((e: unknown) => {
        // A unique violation on (battle, user, position) is a replay of an answered position.
        if (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002') throw invalid('questionId', BATTLE_MESSAGES.questionInvalid)
        throw e
      })

    const after = await this.load(uuid, userId)
    const rows: AnswerRow[] = await this.prisma.client.battleAnswer.findMany({ where: { battleId: uuid, position: round } })
    const theirs = after.battle.participants.find((p) => p.side !== after.mine.side)
    const theirRow = theirs ? rows.find((r) => r.userId === theirs.userId) : undefined
    const closed = after.battle.answered >= round
    const base = {
      correct: out.correct,
      correctOptionId: graded.correctOptionId,
      points: out.points,
      you: { score: after.mine.score + (closed ? 0 : out.points) },
      opponent: closed && theirs && theirRow ? { answered: true as const, correct: theirRow.correct, score: theirs.score } : { answered: false as const },
    }
    if (after.battle.status === 'active') return base
    const a = after.battle.participants.find((p) => p.side === 'A')
    const b = after.battle.participants.find((p) => p.side === 'B')
    const reward = await this.engine.rewardOf(uuid, userId, after.battle.createdAt, after.battle.isTest)
    return { ...base, result: { winner: after.battle.winner as Side | null, scoreA: a?.score ?? 0, scoreB: b?.score ?? 0, ...(reward ? { reward } : {}) } as Result }
  }

  private questionAt(uuid: string, position: number): Promise<{ questionId: bigint } | null> {
    return this.prisma.client.battleQuestion.findUnique({ where: { battleId_position: { battleId: uuid, position } }, select: { questionId: true } })
  }
}
