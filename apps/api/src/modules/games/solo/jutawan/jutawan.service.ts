import { randomBytes } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { GamesJutawanQuerySchema } from '@pp/contract'

import type { TxClient } from '../../../../db/client'
import { CLOCK, type Clock } from '../../../../db/clock'
import { idFromString, idToString, isIdString } from '../../../../db/ids'
import { prngStream } from '../../../../db/prng'
import { PrismaService } from '../../../../db/prisma.service'
import type { GamesCaller } from '../../caller'
import { CurriculumRepository } from '../../../curriculum'
import { GameQuestions, type ServedQuestion } from '../../core/game-questions.service'
import { GamesPorts } from '../../core/ports'
import { GameSubjects } from '../../core/subjects'
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
import { JUTAWAN_LIFELINES, JUTAWAN_MIN_MS_PER_QUESTION, JUTAWAN_QUESTIONS, jutawanCoins, jutawanDifficulty, hasFastGap } from '../play/solo.rules'
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

/** Jutawan Ilmu (M16-36 to M16-39): 15 keyless questions on a difficulty ladder, one wrong answer ends the run. */
@Injectable()
export class JutawanService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JutawanRepository) private readonly repo: JutawanRepository,
    @Inject(SoloRepository) private readonly solo: SoloRepository,
    @Inject(GameQuestions) private readonly questions: GameQuestions,
    @Inject(GameSubjects) private readonly subjects: GameSubjects,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(GamesPorts) private readonly ports: GamesPorts,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

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
      if (s.over) throw jutawanOver()
      const current = await this.repo.itemAt(s.id, s.level + 1)
      if (!current) throw jutawanQuestionNotFound()
      if (b['questionId'] !== current.questionId) throw jutawanQuestionMismatch()
      const optionId = b['optionId']
      if (!isInt(optionId) || optionId < 0 || optionId > 3) throw jutawanOptionInvalid()
      if (!(await this.questions.byIds([current.questionId]))[0]) throw jutawanQuestionNotFound()

      const correct = optionId === current.keyIndex
      const seq = s.checks + 1
      await this.repo.storeAnswer(current.id, { seq, correct, optionId, at: this.clock.now() })
      const common = { checks: seq, correctCount: s.correctCount + (correct ? 1 : 0) }
      if (correct && s.level + 1 < JUTAWAN_QUESTIONS) {
        const level = s.level + 1
        const nextItem = await this.repo.itemAt(s.id, level + 1)
        const next = nextItem ? (await this.questions.byIds([nextItem.questionId]))[0] : undefined
        if (!next) throw jutawanQuestionNotFound()
        await this.repo.update(s.id, { ...common, jutawanLevel: level, jutawanRemovedOptions: [] })
        return { correct: true, level, next: next.question }
      }
      const level = correct ? s.level + 1 : s.level
      const credited = await this.finish(caller, s, level, common, tx)
      return { correct, level, result: { level, credited } }
    })
  }

  /** End of a run: best level and games count, the one reward report (only when allowed, never for Mod Pelajar). */
  private async finish(
    caller: GamesCaller,
    s: JutawanSession,
    level: number,
    common: { checks: number; correctCount: number },
    tx: TxClient,
  ): Promise<number> {
    const sessionId = s.id
    const subjectId = s.subjectId
    const now = this.clock.now()
    // pacing guard: any answer less than 2 s after the previous one (the first: after the start) keeps the level but credits nothing
    const fast = hasFastGap(s.createdAt, await this.repo.answerTimes(s.id), JUTAWAN_MIN_MS_PER_QUESTION)
    const coins = jutawanCoins(level)
    let credited = 0
    if (!fast && !caller.isTest && (await this.ports.rewards.canEarnSyiling(caller.userId, { tx }))) {
      const subject = subjectId === null ? null : await this.curriculum.subject(idFromString(subjectId))
      const out = await this.ports.rewards.onGameResult(
        caller.userId,
        { game: 'jutawan', event: 'finish', coins, xp: 0, correct: level, total: JUTAWAN_QUESTIONS, detail: { level, subject: subject?.name ?? 'Bahasa Melayu' }, key: sessionId },
        { tx, isTest: false },
      )
      credited = out.coinsCredited
    }
    await this.repo.update(sessionId, {
      ...common,
      jutawanLevel: level,
      jutawanRemovedOptions: [],
      jutawanOver: true,
      submittedAt: now,
      score: level,
      coinsComputed: coins,
      coinsCredited: credited,
    })
    await this.repo.bumpStats(caller.userId, level, caller.isTest)
    return credited
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
