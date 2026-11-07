import { randomBytes } from 'node:crypto'

import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { GamesJutawanQuerySchema, type GamesReward } from '@pp/contract'

import type { TxClient } from '../../../../db/client'
import { CLOCK, type Clock } from '../../../../db/clock'
import { idFromString, idToString, isIdString } from '../../../../db/ids'
import { prngStream } from '../../../../db/prng'
import { PrismaService } from '../../../../db/prisma.service'
import type { GamesCaller } from '../../caller'
import { CurriculumRepository } from '../../../curriculum'
import { GameQuestions, type ServedQuestion } from '../../core/game-questions.service'
import { GameSettingsService } from '../../core/game-settings.service'
import { GamesPorts, gameAnswerEntry } from '../../core/ports'
import { GameSubjects } from '../../core/subjects'
import { startGameSweep } from '../../core/time'
import { PACE_GUARD_REWARD, rewardBlock, rewardNow } from '../../core/wallet-rewards'
import {
  jutawanLifelineInvalid,
  jutawanNoLifeline,
  jutawanNotEnoughQuestions,
  jutawanOptionInvalid,
  jutawanOver,
  jutawanQuestionMismatch,
  jutawanQuestionNotFound,
  jutawanSessionNotFound,
  jutawanSubjectInvalid,
  levelInvalid,
} from '../../errors'
import { secretRng } from '../play/secret-rng'
import { shuffled } from '../play/solo-items'
import { JUTAWAN_LIFELINES, JUTAWAN_QUESTIONS, jutawanDifficulty, hasFastGap } from '../play/solo.rules'
import { SoloRepository } from '../play/solo.repository'
import { JutawanRepository, type JutawanSession } from './jutawan.repository'

/** Tile emoji and colour of the observed subjects (by curriculum code); every other subject gets the fallback. */
const TILES: Readonly<Record<string, { emoji: string; colour: string }>> = {
  BM: { emoji: '📝', colour: '#3b82f6' },
  BI: { emoji: '🇬🇧', colour: '#8b5cf6' },
  MATH: { emoji: '🔢', colour: '#10b981' },
  SCI: { emoji: '🔬', colour: '#06b6d4' },
  SEJ: { emoji: '📜', colour: '#f59e0b' },
  PI: { emoji: '☪️', colour: '#059669' },
  PM: { emoji: '💛', colour: '#ec4899' },
  GEO: { emoji: '🌍', colour: '#0ea5e9' },
  BA: { emoji: '🕌', colour: '#047857' },
  JAWI: { emoji: '📖', colour: '#64748b' },
}
const TILE_FALLBACK = { emoji: '📚', colour: '#64748b' }

const objectOf = (body: unknown): Record<string, unknown> => (typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {})
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

function parseDarjah(raw: unknown): number | undefined {
  if (raw === undefined || raw === '') return undefined
  const r = GamesJutawanQuerySchema.safeParse({ darjah: raw })
  if (!r.success) throw levelInvalid()
  if (r.data.darjah !== undefined && r.data.darjah < 7) throw levelInvalid() // secondary-only (2026-10-29)
  return r.data.darjah
}

/** How long the lobby tile counts of `page()` are reused (the `start` gate always counts fresh). */
const TILE_COUNT_TTL_MS = 60_000
const SWEEP_RUNS = 200

/** Jutawan Ilmu (M16-36 to M16-39): 15 keyless questions on a difficulty ladder, one wrong answer ends the run. */
@Injectable()
export class JutawanService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JutawanService.name)
  private stopSweep: () => void = () => undefined

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JutawanRepository) private readonly repo: JutawanRepository,
    @Inject(SoloRepository) private readonly solo: SoloRepository,
    @Inject(GameQuestions) private readonly questions: GameQuestions,
    @Inject(GameSubjects) private readonly subjects: GameSubjects,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(GamesPorts) private readonly ports: GamesPorts,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(GameSettingsService) private readonly settings: GameSettingsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.stopSweep = startGameSweep(JutawanService.name, this.config.get<string>('NODE_ENV'), () => this.sweepClocks())
  }

  onModuleDestroy(): void {
    this.stopSweep()
  }

  /** FR-GM-00.7, GAME-13: a run whose question outlived `jutawan_question_seconds` ends as a timeout. Returns how many ended. */
  async sweepClocks(): Promise<number> {
    const limitMs = (await this.settings.get('jutawan_question_seconds')) * 1000
    const due = await this.repo.dueRuns(new Date(this.clock.now().getTime() - limitMs), SWEEP_RUNS)
    let ended = 0
    for (const run of due) {
      try {
        const done = await this.prisma.transaction(async (tx) => {
          const s = await this.repo.lockOwn(run.id, run.userId)
          if (!s || s.over || this.clock.now().getTime() - (await this.shownAt(s)).getTime() < limitMs) return false
          const current = await this.repo.itemAt(s.id, s.level + 1)
          if (!current) return false
          await this.settle({ userId: run.userId, isTest: run.isTest }, s, current, null, false, tx)
          return true
        })
        if (done) ended += 1
      } catch (err) {
        this.logger.warn(`Jutawan clock failed for a run: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return ended
  }

  /** When the current question was shown: the last answer, or the start. */
  private async shownAt(s: JutawanSession): Promise<Date> {
    return (await this.repo.answerTimes(s.id)).at(-1) ?? s.createdAt
  }

  private readonly tileCounts = new Map<string, { at: number; value: Promise<number> }>()

  /**
   * Eligible count of one (subject, level) tile for the lobby: cached `TILE_COUNT_TTL_MS` of Clock time, single flight, a failed
   * read is dropped. Only the page uses it; `start` gates on a fresh `eligibleCount`.
   */
  private tileCount(subjectId: string, levelId: string): Promise<number> {
    const key = `${subjectId}:${levelId}`
    const now = this.clock.now().getTime()
    const hit = this.tileCounts.get(key)
    if (hit && now >= hit.at && now - hit.at < TILE_COUNT_TTL_MS) return hit.value
    const value = this.questions.eligibleCount({ subjectId, educationLevelId: levelId })
    const entry = { at: now, value }
    this.tileCounts.set(key, entry)
    value.catch(() => {
      if (this.tileCounts.get(key) === entry) this.tileCounts.delete(key)
    })
    return value
  }

  async page(caller: GamesCaller, darjahRaw: unknown): Promise<Record<string, unknown>> {
    const darjah = parseDarjah(darjahRaw)
    const base = await this.repo.stats(caller.userId)
    if (darjah === undefined) return { ...base }
    const levelId = await this.subjects.levelIdOfGrade(darjah)
    const tiles: Record<string, unknown>[] = []
    if (levelId !== null) {
      const subjects = await this.curriculum.subjects({ active: true })
      const counts = await Promise.all(subjects.map((s) => this.tileCount(idToString(s.id), levelId)))
      subjects.forEach((s, i) => {
        const count = counts[i] as number
        if (count <= 0) return
        const tile = TILES[s.code] ?? TILE_FALLBACK
        tiles.push({ id: idToString(s.id), name: s.name, emoji: tile.emoji, colour: tile.colour, count })
      })
    }
    return { ...base, heading: darjah <= 6 ? `DARJAH ${String(darjah)}` : `TINGKATAN ${String(darjah - 6)}`, subjects: tiles }
  }

  async start(caller: GamesCaller, body: unknown): Promise<Record<string, unknown>> {
    const b = objectOf(body)
    const darjah = b['darjah']
    if (!isInt(darjah) || darjah < 7 || darjah > 11) throw levelInvalid('darjah')
    const subjectRaw = b['subject']
    if (typeof subjectRaw !== 'string' || !isIdString(subjectRaw)) throw jutawanSubjectInvalid()
    const subject = await this.curriculum.subject(idFromString(subjectRaw))
    if (!subject || !subject.isActive) throw jutawanSubjectInvalid()
    const subjectId = idToString(subject.id)
    const levelId = await this.subjects.levelIdOfGrade(darjah)
    if (levelId === null || (await this.questions.eligibleCount({ subjectId, educationLevelId: levelId })) <= 0) throw jutawanSubjectInvalid()

    const rng = prngStream(`games:jutawan:${caller.userId}:${randomBytes(12).toString('hex')}`)
    const picked: ServedQuestion[] = []
    for (const d of [1, 2, 3, 4]) {
      const want = Array.from({ length: JUTAWAN_QUESTIONS }, (_, i) => i + 1).filter((n) => jutawanDifficulty(n) === d).length
      picked.push(...(await this.questions.sample({ subjectId, educationLevelId: levelId, difficultyTp: d, excludeIds: picked.map((p) => p.question.id) }, want, rng)))
    }
    if (picked.length < JUTAWAN_QUESTIONS) {
      picked.push(...(await this.questions.sample({ subjectId, educationLevelId: levelId, excludeIds: picked.map((p) => p.question.id) }, JUTAWAN_QUESTIONS - picked.length, rng)))
      picked.sort((x, y) => (x.difficultyTp ?? 99) - (y.difficultyTp ?? 99))
    }
    if (picked.length < JUTAWAN_QUESTIONS) throw jutawanNotEnoughQuestions()
    const run = picked.slice(0, JUTAWAN_QUESTIONS)
    const sessionId = await this.prisma.transaction(async () => {
      await this.solo.supersede(caller.userId, 'jutawan', this.clock.now())
      return this.repo.create({
        userId: caller.userId,
        darjah,
        subjectId,
        isTest: caller.isTest,
        createdAt: this.clock.now(),
        items: run.map((q, i) => ({ questionId: q.question.id, keyIndex: q.keyIndex, difficulty: q.difficultyTp ?? jutawanDifficulty(i + 1) })),
      })
    })
    return { sessionId, index: 1, question: (run[0] as ServedQuestion).question, lifelines: JUTAWAN_LIFELINES }
  }

  async answer(caller: GamesCaller, sessionId: string, body: unknown): Promise<Record<string, unknown>> {
    const b = objectOf(body)
    return this.prisma.transaction(async (tx) => {
      const s = await this.repo.lockOwn(sessionId, caller.userId)
      if (!s || s.game !== 'jutawan') throw jutawanSessionNotFound()
      if (s.over && s.closedAt !== null) throw jutawanOver() // superseded by a newer run: it has no result
      if (s.over) return this.storedResult(caller, s) // the sweep or an earlier answer ended it: the pupil keeps the result screen
      const current = await this.repo.itemAt(s.id, s.level + 1)
      if (!current) throw jutawanQuestionNotFound()
      if (b['questionId'] !== current.questionId) throw jutawanQuestionMismatch()
      const optionId = b['optionId']
      if (!isInt(optionId) || optionId < 0 || optionId > 3) throw jutawanOptionInvalid()
      if (!(await this.questions.byIds([current.questionId]))[0]) throw jutawanQuestionNotFound()
      // GAME-13: the clock is the server's; an answer after `jutawan_question_seconds` is a timeout.
      const late = this.clock.now().getTime() - (await this.shownAt(s)).getTime() >= (await this.settings.get('jutawan_question_seconds')) * 1000
      const correct = !late && optionId === current.keyIndex
      if (correct && s.level + 1 < JUTAWAN_QUESTIONS) {
        const level = s.level + 1
        const nextItem = await this.repo.itemAt(s.id, level + 1)
        const next = nextItem ? (await this.questions.byIds([nextItem.questionId]))[0] : undefined
        if (!next) throw jutawanQuestionNotFound()
        await this.settle(caller, s, current, optionId, true, tx)
        return { correct: true, level, next: next.question }
      }
      const level = correct ? s.level + 1 : s.level
      const end = await this.settle(caller, s, current, late ? null : optionId, correct, tx)
      return { correct, level, result: { level, credited: end?.credited ?? 0, ...(end?.reward ? { reward: end.reward } : {}) } }
    })
  }

  /** The result of a run already ended, as its last answer returned it; writes nothing (48 section 3.4 rule 6). */
  private async storedResult(caller: Pick<GamesCaller, 'userId' | 'isTest'>, s: JutawanSession): Promise<Record<string, unknown>> {
    const first = caller.isTest ? null : await this.ports.rewards.firstGameResult(s.id, caller.userId)
    const fast = !caller.isTest && first === null && hasFastGap(s.createdAt, await this.repo.answerTimes(s.id), await this.settings.get('jutawan_min_ms_per_answer'))
    const reward = first ? rewardBlock(first) : fast ? PACE_GUARD_REWARD : undefined
    return { correct: s.level >= JUTAWAN_QUESTIONS, level: s.level, result: { level: s.level, credited: s.coinsCredited, ...(reward ? { reward } : {}) } }
  }

  /** Stores one answer or timeout (`optionId` null) with its answer row; moves up the ladder or, returned, ends the run. */
  private async settle(
    caller: Pick<GamesCaller, 'userId' | 'isTest'>,
    s: JutawanSession,
    current: { id: bigint; position: number; questionId: string },
    optionId: number | null,
    correct: boolean,
    tx: TxClient,
  ): Promise<{ credited: number; reward?: GamesReward } | null> {
    const seq = s.checks + 1
    const at = this.clock.now()
    await this.repo.storeAnswer(current.id, { seq, correct, optionId, at })
    // FR-GM-00.5, 48 section 3.5: in the same transaction as the answer; Mod Pelajar writes no row.
    if (!caller.isTest) await this.ports.answers.record(gameAnswerEntry({ userId: caller.userId, attemptId: s.id, questionId: current.questionId, gameKey: 'jutawan', position: current.position, isCorrect: correct, answeredAt: at }))
    const common = { checks: seq, correctCount: s.correctCount + (correct ? 1 : 0) }
    const level = correct ? s.level + 1 : s.level
    if (correct && level < JUTAWAN_QUESTIONS) {
      await this.repo.update(s.id, { ...common, jutawanLevel: level, jutawanRemovedOptions: [] })
      return null
    }
    return this.finish(caller, s, level, common, tx)
  }

  /** End of a run: best level and games count, the one reward report (only when allowed, never for Mod Pelajar). */
  private async finish(
    caller: Pick<GamesCaller, 'userId' | 'isTest'>,
    s: JutawanSession,
    level: number,
    common: { checks: number; correctCount: number },
    tx: TxClient,
  ): Promise<{ credited: number; reward?: GamesReward }> {
    const sessionId = s.id
    const subjectId = s.subjectId
    const now = this.clock.now()
    // pace guard: any answer under `jutawan_min_ms_per_answer` after the previous one (the first: after the start) keeps the level but credits nothing and writes no best
    const fast = hasFastGap(s.createdAt, await this.repo.answerTimes(s.id), await this.settings.get('jutawan_min_ms_per_answer'))
    // FR-GM-00.3, GAME-13: correct = level, level 15 is a win.
    const asked = await rewardNow(this.settings, tx, { correct: level, outcome: level >= JUTAWAN_QUESTIONS ? 'win' : 'play', robotsOnly: false, fastGap: false })
    let credited = 0
    let reward: GamesReward | undefined
    // Reported also while syiling is off, for the reward event (DM-87); the port decides what is paid.
    if (fast && !caller.isTest) reward = PACE_GUARD_REWARD
    if (!fast && !caller.isTest) {
      const subject = subjectId === null ? null : await this.curriculum.subject(idFromString(subjectId))
      const out = await this.ports.rewards.onGameResult(
        caller.userId,
        { game: 'jutawan', event: level >= JUTAWAN_QUESTIONS ? 'win' : 'finish', coins: asked.coins, xp: asked.xp, correct: level, total: JUTAWAN_QUESTIONS, detail: { level, subject: subject?.name ?? 'Bahasa Melayu' }, key: sessionId, session: { id: sessionId, gameKey: 'jutawan' } },
        { tx, isTest: false },
      )
      credited = out.coinsCredited
      reward = rewardBlock(out)
    }
    await this.repo.update(sessionId, {
      ...common,
      jutawanLevel: level,
      jutawanRemovedOptions: [],
      jutawanOver: true,
      submittedAt: now,
      score: level,
      coinsComputed: asked.coins,
      coinsCredited: credited,
    })
    await this.repo.bumpStats(caller.userId, fast ? 0 : level, caller.isTest)
    return { credited, ...(reward ? { reward } : {}) }
  }

  async lifeline(caller: GamesCaller, sessionId: string, body: unknown): Promise<Record<string, unknown>> {
    if (objectOf(body)['type'] !== '50:50') throw jutawanLifelineInvalid()
    return this.prisma.transaction(async () => {
      const s = await this.repo.lockOwn(sessionId, caller.userId)
      if (!s || s.game !== 'jutawan') throw jutawanSessionNotFound()
      if (s.over) throw jutawanOver()
      if (s.lifelines <= 0 || s.removed.length > 0) throw jutawanNoLifeline()
      const current = await this.repo.itemAt(s.id, s.level + 1)
      if (!current) throw jutawanQuestionNotFound()
      const served = (await this.questions.byIds([current.questionId]))[0]
      if (!served) throw jutawanQuestionNotFound()
      const wrong = served.question.options.filter((o) => o.id !== current.keyIndex && o.text.trim() !== '').map((o) => o.id)
      const removed = shuffled(wrong, secretRng()).slice(0, 2).sort((x, y) => x - y)
      const lifelines = s.lifelines - 1
      await this.repo.update(s.id, { jutawanLifelines: lifelines, jutawanRemovedOptions: removed })
      return { removedOptionIds: removed, lifelines }
    })
  }
}
