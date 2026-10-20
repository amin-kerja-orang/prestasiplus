import { randomBytes } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import {
  GAMES_MESSAGES,
  GamesBetulSalahCheckSchema,
  GamesCabaranKilatCheckSchema,
  GamesKadMemoriCheckSchema,
  GamesKadMemoriRevealRequestSchema,
  GamesSessionIdSchema,
  GamesSoloQuerySchema,
  GamesSoloSubmitRequestSchema,
  GamesSusunJawapanCheckSchema,
  GamesTembakJawapanCheckSchema,
  type GamesSoloGame,
} from '@pp/contract'
import type { z } from 'zod'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock } from '../../../../db/clock'
import { prngStream } from '../../../../db/prng'
import { PrismaService } from '../../../../db/prisma.service'
import type { GamesCaller } from '../../caller'
import { GameQuestions, type ServedQuestion } from '../../core/game-questions.service'
import { GameSubjects } from '../../core/subjects'
import { GameUsers } from '../../core/game-users'
import { GamesPorts } from '../../core/ports'
import { fieldError, gameNotFound, levelInvalid, rawMessage, soloAlreadyChecked, soloCardMatched, soloCardOpen, soloItemNotFound, soloSessionNotFound } from '../../errors'
import { SoloItemBuilder } from './solo-items'
import { type ItemRecord, SoloRepository } from './solo.repository'
import {
  DEFAULT_DARJAH,
  isSoloGame,
  MEMORY_COINS,
  MEMORY_PAIRS,
  memoryAccuracy,
  normaliseAnswer,
  scoreRun,
  MIN_MS_PER_ITEM,
  SOLO_INFO,
  tooFast,
} from './solo.rules'

const M = GAMES_MESSAGES

/** Standard-envelope 409 "Keputusan sudah dihantar." for the check and reveal routes (the submit answers it raw). */
const alreadySubmitted = (): ApiError => ApiError.of('CONFLICT', { message: M.soloAlreadySubmitted })

/** A raw submit refusal or success; the controller sets the status and returns the body as is. */
export type SubmitOutcome = { status: 200 | 404 | 409 | 422; body: Record<string, unknown> }

const refuse = (status: 404 | 409 | 422, message: string): SubmitOutcome => ({ status, body: rawMessage(message) })
const objectOf = (body: unknown): Record<string, unknown> => (typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {})

/** `?darjah=`: absent or empty = not given; an integer 1..11 else 422 "Tahap tidak sah." (darjah). */
function parseDarjah(raw: unknown): number | undefined {
  if (raw === undefined || raw === '') return undefined
  const r = GamesSoloQuerySchema.safeParse({ darjah: raw })
  if (!r.success) throw levelInvalid()
  return r.data.darjah
}

/** 422 "Jawapan tidak sah." on the field that failed (the first issue's path, `answer` when it is the whole body). */
function parseCheck<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body)
  if (r.success) return r.data
  const path = r.error.issues[0]?.path[0]
  throw fieldError(typeof path === 'string' ? path : 'answer', M.actionValue)
}

@Injectable()
export class SoloService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SoloRepository) private readonly repo: SoloRepository,
    @Inject(SoloItemBuilder) private readonly builder: SoloItemBuilder,
    @Inject(GameQuestions) private readonly questions: GameQuestions,
    @Inject(GameSubjects) private readonly subjects: GameSubjects,
    @Inject(GameUsers) private readonly users: GameUsers,
    @Inject(GamesPorts) private readonly ports: GamesPorts,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Mod Pelajar never earns, so it never reports `canEarnSyiling`. */
  private async canEarn(caller: GamesCaller, tx?: Parameters<GamesPorts['rewards']['canEarnSyiling']>[1]): Promise<boolean> {
    return !caller.isTest && (await this.ports.rewards.canEarnSyiling(caller.userId, tx))
  }

  // --- M16-32: a new session and its KEYLESS payload ---------------------------------------------------

  async start(caller: GamesCaller, game: string, darjahRaw: unknown): Promise<Record<string, unknown>> {
    if (!isSoloGame(game)) throw gameNotFound()
    let darjah: number | null = null
    let levelIds: string[]
    if (game === 'kad-memori') {
      levelIds = (await Promise.all([1, 2, 3, 4].map((g) => this.subjects.levelIdOfGrade(g)))).filter((x): x is string => x !== null)
    } else {
      const given = parseDarjah(darjahRaw)
      const grade = (await this.users.get(caller.userId))?.grade ?? null
      darjah = given ?? (grade !== null && grade >= 1 && grade <= 11 ? grade : DEFAULT_DARJAH)
      const level = await this.subjects.levelIdOfGrade(darjah)
      levelIds = level === null ? [] : [level]
    }
    // Question sampling and puzzle scrambling use a named stream; every secret-bearing value (statement truth, card layout and
    // ids) is drawn from node:crypto inside the builder, because a 32-bit seeded stream could be recovered by a client.
    const stem = `games:solo:${caller.userId}:${game}:${randomBytes(12).toString('hex')}`
    const built = await this.builder.build(game, levelIds, prngStream(stem))
    const itemCount = game === 'kad-memori' ? built.rows.length / 2 : built.rows.length
    const sessionId = await this.prisma.transaction(async () => {
      const id = await this.repo.createSession({ userId: caller.userId, game, darjah, itemCount, maxScore: built.maxScore, isTest: caller.isTest, createdAt: this.clock.now() })
      await this.repo.addItems(id, built.rows)
      return id
    })
    return {
      sessionId,
      personalBest: await this.repo.bestOf(caller.userId, game),
      canEarnSyiling: await this.canEarn(caller),
      ...built.items,
    }
  }

  // --- POST /games/solo/{game}/check (D58a) ----------------------------------------------------------------

  async check(caller: GamesCaller, game: string, body: unknown): Promise<Record<string, unknown>> {
    if (!isSoloGame(game)) throw gameNotFound()
    const b = objectOf(body)
    if (!GamesSessionIdSchema.safeParse(b['session_id']).success) throw soloSessionNotFound()
    switch (game) {
      case 'betul-salah': {
        const d = parseCheck(GamesBetulSalahCheckSchema, b)
        return this.checkQuestion(caller, game, d.session_id, d.item_id, async (item) => {
          const isTrue = item.statementTrue === true
          return { correct: d.answer === isTrue, answer: String(d.answer), result: { is_true: isTrue } }
        })
      }
      case 'cabaran-kilat': {
        const d = parseCheck(GamesCabaranKilatCheckSchema, b)
        return this.checkQuestion(caller, game, d.session_id, d.item_id, async (item) => ({
          correct: d.option_id === item.keyIndex,
          answer: String(d.option_id),
          result: { correct_option_id: item.keyIndex ?? 0 },
        }))
      }
      case 'tembak-jawapan': {
        const d = parseCheck(GamesTembakJawapanCheckSchema, b)
        return this.checkQuestion(caller, game, d.session_id, d.item_id, async (item) => ({
          correct: d.option_index === item.keyIndex,
          answer: String(d.option_index),
          result: { correct_option_index: item.keyIndex ?? 0 },
        }))
      }
      case 'susun-jawapan': {
        const d = parseCheck(GamesSusunJawapanCheckSchema, b)
        return this.checkQuestion(caller, game, d.session_id, d.item_id, async (item) => {
          const served = (await this.questions.byIds([item.questionId]))[0]
          if (!served) throw soloItemNotFound()
          const answer = served.keyText.trim()
          return { correct: normaliseAnswer(d.answer) === normaliseAnswer(answer), answer: d.answer, result: { answer } }
        })
      }
      case 'kad-memori':
        return this.checkPair(caller, parseCheck(GamesKadMemoriCheckSchema, b))
    }
  }

  /** One check per item: the session row is locked, so two checks of one item cannot both be stored. */
  private checkQuestion(
    caller: GamesCaller,
    game: GamesSoloGame,
    sessionId: string,
    itemId: string,
    judge: (item: ItemRecord) => Promise<{ correct: boolean; answer: string; result: Record<string, unknown> }>,
  ): Promise<Record<string, unknown>> {
    return this.prisma.transaction(async () => {
      const s = await this.repo.lockOwn(sessionId, caller.userId)
      if (!s || s.game !== game) throw soloSessionNotFound()
      if (s.submittedAt !== null) throw alreadySubmitted()
      const item = await this.repo.itemByQuestion(s.id, itemId)
      if (!item) throw soloItemNotFound()
      if (item.checkedSeq !== null) throw soloAlreadyChecked()
      const j = await judge(item)
      const seq = s.checks + 1
      await this.repo.storeCheck(item.id, { seq, correct: j.correct, answer: j.answer, at: this.clock.now() })
      await this.repo.updateSession(s.id, { checks: seq, correctCount: s.correctCount + (j.correct ? 1 : 0) })
      return { correct: j.correct, ...j.result }
    })
  }

  private face(item: ItemRecord, served: ServedQuestion): { id: string; type: 'question' | 'answer'; content: string } {
    const type = item.face === 'answer' ? 'answer' : 'question'
    return { id: item.cardId as string, type, content: type === 'answer' ? served.keyText : served.question.text }
  }

  private async faces(items: readonly ItemRecord[]) {
    const served = await this.questions.byIds([...new Set(items.map((i) => i.questionId))])
    return items.map((item) => {
      const q = served.find((s) => s.question.id === item.questionId)
      if (!q) throw soloItemNotFound()
      return this.face(item, q)
    })
  }

  private checkPair(caller: GamesCaller, d: { session_id: string; card_id: string; other_card_id: string }): Promise<Record<string, unknown>> {
    return this.prisma.transaction(async () => {
      const s = await this.repo.lockOwn(d.session_id, caller.userId)
      if (!s || s.game !== 'kad-memori') throw soloSessionNotFound()
      if (s.submittedAt !== null) throw alreadySubmitted()
      const a = await this.repo.itemByCard(s.id, d.card_id)
      const c = await this.repo.itemByCard(s.id, d.other_card_id)
      if (!a || !c) throw soloItemNotFound()
      if (a.matched || c.matched) throw soloCardMatched()
      if (s.openCardId !== null && s.openCardId !== a.cardId && s.openCardId !== c.cardId) throw soloCardOpen()
      const faces = await this.faces([a, c])
      const match = a.pairKey !== null && a.pairKey === c.pairKey
      const seq = s.checks + 1
      const at = this.clock.now()
      if (match) {
        await this.repo.storeCheck(a.id, { seq, correct: true, answer: d.other_card_id, at, matched: true })
        await this.repo.storeCheck(c.id, { seq, correct: true, answer: d.card_id, at, matched: true })
      }
      await this.repo.updateSession(s.id, { checks: seq, moves: s.moves + 1, correctCount: s.correctCount + (match ? 1 : 0), openCardId: null })
      return { correct: match, pair_id: match ? a.pairKey : null, cards: faces }
    })
  }

  // --- POST /games/solo/kad-memori/reveal (D58a) ----------------------------------------------------------

  async reveal(caller: GamesCaller, body: unknown): Promise<Record<string, unknown>> {
    const b = objectOf(body)
    if (!GamesSessionIdSchema.safeParse(b['session_id']).success) throw soloSessionNotFound()
    const d = parseCheck(GamesKadMemoriRevealRequestSchema, b)
    return this.prisma.transaction(async () => {
      const s = await this.repo.lockOwn(d.session_id, caller.userId)
      if (!s || s.game !== 'kad-memori') throw soloSessionNotFound()
      if (s.submittedAt !== null) throw alreadySubmitted()
      const item = await this.repo.itemByCard(s.id, d.card_id)
      if (!item) throw soloItemNotFound()
      if (item.matched) throw soloCardMatched()
      if (s.openCardId !== null) throw soloCardOpen()
      const [face] = await this.faces([item])
      await this.repo.updateSession(s.id, { openCardId: d.card_id })
      return face as Record<string, unknown>
    })
  }

  // --- M16-33: raw submit, everything computed from the stored checks (D58a) ------------------------------

  async submit(caller: GamesCaller, game: string, body: unknown): Promise<SubmitOutcome> {
    if (!isSoloGame(game)) return refuse(404, M.gameNotFound)
    const parsed = GamesSoloSubmitRequestSchema.safeParse(objectOf(body))
    if (!parsed.success) return refuse(422, M.soloInvalidResult)
    const info = SOLO_INFO[game]
    return this.prisma.transaction(async (tx): Promise<SubmitOutcome> => {
      const s = await this.repo.lockOwn(parsed.data.session_id, caller.userId)
      if (!s || s.game !== game) return refuse(422, M.soloInvalidResult)
      if (s.submittedAt !== null) return refuse(409, M.soloAlreadySubmitted)
      const at = this.clock.now()
      const elapsed = at.getTime() - s.createdAt.getTime()
      const earn = await this.canEarn(caller, { tx })
      const report = async (coins: number, correct: number, total: number, detail: Record<string, unknown>): Promise<number> => {
        if (!earn) return 0
        const out = await this.ports.rewards.onGameResult(
          caller.userId,
          { game: info.token, event: 'finish', coins, xp: 0, correct, total, detail, key: s.id },
          { tx, isTest: false },
        )
        return out.coinsCredited
      }

      if (game === 'kad-memori') {
        const items = await this.repo.items(s.id)
        if (items.filter((i) => i.matched).length < MEMORY_PAIRS * 2) return refuse(422, M.soloInvalidResult)
        const fast = tooFast(elapsed, s.moves, MIN_MS_PER_ITEM)
        const credited = fast ? 0 : await report(MEMORY_COINS, MEMORY_PAIRS, MEMORY_PAIRS, { moves: s.moves })
        await this.repo.updateSession(s.id, { submittedAt: at, correctCount: MEMORY_PAIRS, coinsComputed: fast ? 0 : MEMORY_COINS, coinsCredited: credited })
        return {
          status: 200,
          body: {
            results: {
              syiling_earned: credited,
              accuracy: memoryAccuracy(s.moves),
              moves: s.moves,
              time_seconds: Math.max(0, Math.floor((at.getTime() - s.createdAt.getTime()) / 1000)),
            },
          },
        }
      }

      const checked = await this.repo.checkedItems(s.id)
      if (checked.length === 0) return refuse(422, M.soloInvalidResult)
      const run = scoreRun(game, checked.map((c) => ({ correct: c.correct === true, points: c.points })))
      // pacing guard: a run faster than a human can play keeps its score but earns nothing and is no record
      const fast = tooFast(elapsed, run.total, MIN_MS_PER_ITEM)
      const coins = fast ? 0 : run.coins
      const isNewRecord = fast ? false : await this.repo.recordBest(caller.userId, game, run.score, s.isTest, at)
      const detail =
        game === 'betul-salah' ? { maxStreak: run.best } : game === 'cabaran-kilat' ? { maxCombo: run.best } : game === 'tembak-jawapan' ? { level: run.best } : { solved: run.best }
      const credited = fast ? 0 : await report(coins, run.correct, run.total, detail)
      await this.repo.updateSession(s.id, {
        submittedAt: at,
        score: run.score,
        correctCount: run.correct,
        coinsComputed: coins,
        coinsCredited: credited,
        isNewRecord,
      })
      return {
        status: 200,
        body: { is_new_record: isNewRecord, syiling_awarded: credited, score: run.score, correct_count: run.correct, total_answered: run.total },
      }
    })
  }
}
