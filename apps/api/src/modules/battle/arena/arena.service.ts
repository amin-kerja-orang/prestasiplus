/**
 * Lobby and arena (M16-15 to M16-17; BR-M16-02, BR-M16-07, BR-M16-08). Scoring is server side only: the body carries
 * `questionId`, `optionId` and `seconds`, nothing else is read. The answer key is revealed only in the answer response of
 * the question just answered. A battle is visible to its two players only (anyone else: 404 "Battle tidak dijumpai.").
 */
import { Inject, Injectable } from '@nestjs/common'
import { BATTLE_MESSAGES, BATTLE_RULES, battleArenaPoints, battleWinner } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../db/clock'
import { idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import type { ArenaQuestionView } from '../battle.deps'
import { BattleEngine, botAnswers, gradeLabel, isUuid } from '../engine'

type Side = 'A' | 'B'
interface Result {
  winner: Side | null
  scoreA: number
  scoreB: number
}

const notFound = (message: string = BATTLE_MESSAGES.battleNotFound): ApiError => ApiError.of('NOT_FOUND', { message })
const invalid = (field: string, message: string): ApiError => ApiError.of('VALIDATION_ERROR', { message, fields: { [field]: message } })

const asRecord = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {}

@Injectable()
export class ArenaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BattleEngine) private readonly engine: BattleEngine,
  ) {}

  /** M16-15. */
  async lobby(userId: string) {
    const deps = this.engine.deps
    const grade = await deps.gradeOf(userId)
    const unlocked = grade !== null && grade >= BATTLE_RULES.spmMinGrade
    const subjects = (await deps.subjects()).sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
    const out = {
      grade,
      gradeLabel: gradeLabel(grade),
      spmUnlocked: unlocked,
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, icon: s.icon, colour: s.colour, core: s.core })),
      pkskDomains: deps.pkskDomains().map((d) => ({ id: d.id, name: d.name, icon: '', colour: '' })),
    }
    if (!unlocked) return out
    const spm: { id: string; name: string }[] = []
    for (const s of subjects) if ((await deps.spmPoolCount(s.id)) > 0) spm.push({ id: s.id, name: s.name })
    return { ...out, spmSubjects: spm }
  }

  private async load(uuid: string, userId: string) {
    if (!isUuid(uuid)) throw notFound()
    const battle = await this.prisma.client.battle.findUnique({ where: { id: uuid }, include: { participants: true } })
    const mine = battle?.participants.find((p) => idToString(p.userId) === userId)
    if (!battle || !mine) throw notFound()
    return { battle, mine }
  }

  private questionAt(uuid: string, position: number): Promise<{ questionId: bigint } | null> {
    return this.prisma.client.battleQuestion.findUnique({ where: { battleId_position: { battleId: uuid, position } }, select: { questionId: true } })
  }

  /** M16-16. */
  async view(uuid: string, userId: string) {
    const { battle, mine } = await this.load(uuid, userId)
    const a = battle.participants.find((p) => p.side === 'A')
    const b = battle.participants.find((p) => p.side === 'B')
    if (!a || !b) throw notFound()
    const done = await this.prisma.client.battleAnswer.count({ where: { battleId: uuid, userId: mine.userId } })
    const active = battle.status === 'active'
    let question: ArenaQuestionView | null = null
    if (active) {
      const row = await this.questionAt(uuid, done + 1)
      question = row ? await this.engine.deps.arenaQuestion(idToString(row.questionId)) : null
      if (!question) throw notFound(BATTLE_MESSAGES.questionNotFound)
    }
    const people = await this.engine.deps.players([idToString(a.userId), idToString(b.userId)])
    const schools = await this.engine.deps.schoolsByIds([a, b].flatMap((p) => (p.schoolId === null ? [] : [idToString(p.schoolId)])))
    const player = (p: typeof a) => ({
      name: people.get(idToString(p.userId))?.name ?? 'Pelajar',
      school: p.schoolId === null ? '' : (schools.get(idToString(p.schoolId))?.name ?? ''),
    })
    return {
      uuid,
      status: battle.status,
      you: mine.side as Side,
      players: { A: player(a), B: player(b) },
      scores: { A: a.score, B: b.score },
      index: Math.min(done + 1, BATTLE_RULES.arenaQuestions),
      total: BATTLE_RULES.arenaQuestions,
      question,
      secondsLeft: active ? BATTLE_RULES.questionSeconds : 0,
      ...(active ? {} : { result: { winner: battle.winner as Side | null, scoreA: a.score, scoreB: b.score } as Result }),
    }
  }

  /**
   * M16-17. Everything that reads the owners' tables (grading, the next question, the bot accuracy) happens BEFORE the
   * transaction; the transaction then locks the battle row and re-checks that the caller's position did not move, so two
   * identical concurrent answers store one answer (the loser gets "Soalan tidak sah." like any replay).
   */
  async answer(uuid: string, userId: string, body: unknown) {
    const input = asRecord(body)
    const { battle, mine } = await this.load(uuid, userId)
    if (battle.status !== 'active') throw ApiError.of('CONFLICT', { message: BATTLE_MESSAGES.battleOver })
    const done = await this.prisma.client.battleAnswer.count({ where: { battleId: uuid, userId: mine.userId } })
    const expected = done < BATTLE_RULES.arenaQuestions ? await this.questionAt(uuid, done + 1) : null
    if (!expected) throw ApiError.of('CONFLICT', { message: BATTLE_MESSAGES.battleOver })
    const questionId = idToString(expected.questionId)
    if (input.questionId !== questionId) throw invalid('questionId', BATTLE_MESSAGES.questionInvalid)
    const raw = input.optionId ?? null
    if (raw !== null && !(typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 3)) throw invalid('optionId', BATTLE_MESSAGES.answerInvalid)
    const optionId = raw as number | null
    const seconds = input.seconds
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || seconds > BATTLE_RULES.questionSeconds) {
      throw invalid('seconds', BATTLE_MESSAGES.timeInvalid)
    }
    const graded = await this.engine.deps.gradeAnswer(questionId, optionId)
    if (!graded) throw notFound(BATTLE_MESSAGES.questionNotFound)
    const index = done + 1
    const last = index >= BATTLE_RULES.arenaQuestions
    const nextRow = last ? null : await this.questionAt(uuid, index + 1)
    const next = nextRow ? await this.engine.deps.arenaQuestion(idToString(nextRow.questionId)) : null
    if (!last && !next) throw notFound(BATTLE_MESSAGES.questionNotFound)
    const bot = botAnswers(uuid, await this.engine.botAccuracy())[done]
    if (!bot) throw notFound()

    const whole = Math.floor(seconds)
    const points = graded.correct ? battleArenaPoints(whole) : 0
    let ended: { side: Side; winner: Side | null; correct: number; total: number; isTest: boolean } | null = null
    const out = await this.prisma
      .transaction(async () => {
        await this.prisma.client.$queryRaw`SELECT id FROM battles WHERE id = ${uuid}::uuid FOR UPDATE`
        const locked = await this.prisma.client.battle.findUnique({ where: { id: uuid }, include: { participants: true } })
        if (!locked) throw notFound()
        if (locked.status !== 'active') throw ApiError.of('CONFLICT', { message: BATTLE_MESSAGES.battleOver })
        // Another answer of the caller got in first: this position is no longer the next one.
        if ((await this.prisma.client.battleAnswer.count({ where: { battleId: uuid, userId: mine.userId } })) !== done) throw invalid('questionId', BATTLE_MESSAGES.questionInvalid)
        const opp = locked.participants.find((p) => p.userId !== mine.userId)
        if (!opp) throw notFound()
        const now = this.clock.now()
        await this.prisma.client.battleAnswer.create({
          data: { battleId: uuid, userId: mine.userId, position: index, questionId: expected.questionId, optionId, correct: graded.correct, seconds: whole, points, createdAt: now },
        })
        // The opponent is simulated from its pre-drawn list (D53(a)); a row already there for this position is kept as it is.
        const simulated = await this.prisma.client.battleAnswer.createMany({
          data: [
            {
              battleId: uuid,
              userId: opp.userId,
              position: index,
              questionId: expected.questionId,
              optionId: bot.correct ? graded.correctOptionId : null,
              correct: bot.correct,
              seconds: bot.seconds,
              points: bot.points,
              createdAt: now,
            },
          ],
          skipDuplicates: true,
        })
        await this.prisma.client.battleParticipant.update({
          where: { id: mine.id },
          data: { score: { increment: points }, correct: { increment: graded.correct ? 1 : 0 } },
        })
        if (simulated.count === 1) {
          await this.prisma.client.battleParticipant.update({
            where: { id: opp.id },
            data: { score: { increment: bot.points }, correct: { increment: bot.correct ? 1 : 0 } },
          })
        }
        await this.prisma.client.battle.update({ where: { id: uuid }, data: { answered: Math.max(locked.answered, index) } })
        const meNow = await this.prisma.client.battleParticipant.findUniqueOrThrow({ where: { id: mine.id } })
        const oppNow = await this.prisma.client.battleParticipant.findUniqueOrThrow({ where: { id: opp.id } })
        const base = {
          correct: graded.correct,
          correctOptionId: graded.correctOptionId,
          points,
          you: { score: meNow.score },
          opponent: { answered: true as const, correct: bot.correct, score: oppNow.score },
        }
        if (!last) return { ...base, next: next as ArenaQuestionView }
        const scoreA = mine.side === 'A' ? meNow.score : oppNow.score
        const scoreB = mine.side === 'A' ? oppNow.score : meNow.score
        const winner = battleWinner(scoreA, scoreB)
        await this.prisma.client.battle.update({ where: { id: uuid }, data: { status: 'finished', winner, finishedAt: now } })
        ended = { side: mine.side as Side, winner, correct: meNow.correct, total: index, isTest: locked.isTest }
        return { ...base, result: { winner, scoreA, scoreB } as Result }
      })
      .catch((e: unknown) => {
        // A unique violation on (battle, user, position) is a replay of an answered position.
        if (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002') throw invalid('questionId', BATTLE_MESSAGES.questionInvalid)
        throw e
      })
    const finished = ended as { side: Side; winner: Side | null; correct: number; total: number; isTest: boolean } | null
    if (finished) await this.engine.report({ userId, forfeited: false, ...finished })
    return out
  }
}
