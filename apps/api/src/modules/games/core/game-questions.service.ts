import { Inject, Injectable } from '@nestjs/common'
import type { GamesKeylessQuestion, QuestionPart } from '@pp/contract'

import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString } from '../../../db/ids'
import type { Prng } from '../../../db/prng'
import { PrismaService } from '../../../db/prisma.service'
import { QuestionsRepository } from '../../questions'
import type { QuestionRecord } from '../../questions'

const LABELS = ['A', 'B', 'C', 'D'] as const

/** A question as a game serves it, plus the SERVER-ONLY key. The key is never part of `question`. */
export interface ServedQuestion {
  /** The keyless contract shape (`GamesKeylessQuestion`): id, text, options 0..3. Safe to send before the answer. */
  question: GamesKeylessQuestion
  /** SERVER ONLY: the index (0..3) of the correct option. */
  keyIndex: number
  /** SERVER ONLY: the text of the correct option. */
  keyText: string
  /** Difficulty TP 1..6 of the served version, null when unknown. */
  difficultyTp: number | null
  /** The version served (so a later edit never changes grading). */
  versionNo: number
}

export interface GameQuestionFilter {
  subjectId?: string
  educationLevelId?: string
  difficultyTp?: number
  difficultyTps?: readonly number[]
  /** Exactly this many options (Cabaran Kilat, Tembak Jawapan). */
  exactOptions?: number
  excludeIds?: readonly string[]
}

/** 48 section 3.2 rule 3: the bands of the mix, TP 6 with the hardest. */
const LOW_BAND = [1, 2]
const MID_BAND = [3]
const HIGH_BAND = [4, 5, 6]

/** 48 section 3.2 rule 4: the no-repeat window, and how many times the draw size the pool must hold to apply it. */
const NO_REPEAT_DAYS = 14
const NO_REPEAT_POOL_FACTOR = 3

/** 30% low, 30% high, each rounded to the nearest whole question; the remainder is the middle band (48 section 3.2 rule 3). */
export function difficultyMix(n: number): { low: number; mid: number; high: number } {
  const low = Math.round(n * 0.3)
  return { low, mid: n - low * 2, high: low }
}

/** Fisher-Yates over a copy, drawing from `rng`. */
export function shuffled<T>(list: readonly T[], rng: Prng): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const tmp = out[i] as T
    out[i] = out[j] as T
    out[j] = tmp
  }
  return out
}

/** Samples nothing beyond `n * OVERSAMPLE` ids so a bank of unusable questions cannot make a draw unbounded. */
const OVERSAMPLE = 4

/** What `toServed` accepts, in SQL: the draw (`sample`) and the gate (`eligibleCount`) share it, so a gate never passes while a draw is short. */
const GAME_SHAPE = { type: 'mcq', ungrouped: true, mcqShape: { minOptions: 2, maxOptions: 4 } } as const
const shapeOf = (exactOptions?: number) =>
  exactOptions === undefined ? GAME_SHAPE : { ...GAME_SHAPE, mcqShape: { minOptions: exactOptions, maxOptions: exactOptions } }

/**
 * Draws game questions through `QuestionsRepository` (BE-09, the owner): published, active, single-part MCQ with
 * at most 4 options (labels A..D). The draw uses the supplied named PRNG stream.
 */
@Injectable()
export class GameQuestions {
  constructor(
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * FR-GM-00.2, 48 section 3.2: `n` questions in the difficulty mix, in a shuffled order. It skips what the pupil answered in
   * any game in the last 14 days when the pool holds at least 3 times the draw, and repeats only to fill a short draw. Fewer
   * than `n` means the pool is too small: the caller refuses with ERR-GAME-01.
   */
  async draw(filter: GameQuestionFilter, n: number, rng: Prng, userId: string): Promise<ServedQuestion[]> {
    const recent = await this.recentlyAnswered(userId)
    const fresh = recent.length > 0 && (await this.eligibleCount(filter)) >= n * NO_REPEAT_POOL_FACTOR
    const excluded = filter.excludeIds ?? []
    const picked = await this.mix({ ...filter, excludeIds: fresh ? [...excluded, ...recent] : excluded }, n, rng)
    if (picked.length < n && fresh) {
      const ids = picked.map((p) => p.question.id)
      picked.push(...(await this.mix({ ...filter, excludeIds: [...excluded, ...ids] }, n - picked.length, rng)))
    }
    return shuffled(picked, rng)
  }

  /** A short band falls to the nearest one: both ends to the middle, the middle to both ends, then questions with no difficulty. */
  private async mix(filter: GameQuestionFilter, n: number, rng: Prng): Promise<ServedQuestion[]> {
    const picked: ServedQuestion[] = []
    const take = async (want: number, difficultyTps?: readonly number[]): Promise<number> => {
      if (want <= 0) return 0
      const excludeIds = [...(filter.excludeIds ?? []), ...picked.map((p) => p.question.id)]
      const got = await this.sample({ ...filter, excludeIds, ...(difficultyTps ? { difficultyTps } : {}) }, want, rng)
      picked.push(...got)
      return want - got.length
    }
    const { low, mid, high } = difficultyMix(n)
    const short = (await take(low, LOW_BAND)) + (await take(high, HIGH_BAND))
    const midShort = await take(mid + short, MID_BAND)
    const lowShort = await take(midShort, LOW_BAND)
    await take(await take(lowShort, HIGH_BAND))
    return picked
  }

  /** The pupil's game and Battle answers of the window, from the one answer store (DM-44). Test rows are not their answers. */
  private async recentlyAnswered(userId: string): Promise<string[]> {
    const rows = await this.prisma.client.practiceAnswer.findMany({
      where: {
        userId: idFromString(userId),
        mode: { in: ['game', 'battle'] },
        isTest: false,
        answeredAt: { gte: new Date(this.clock.now().getTime() - NO_REPEAT_DAYS * 86_400_000) },
      },
      select: { questionId: true },
      distinct: ['questionId'],
    })
    return rows.flatMap((r) => (r.questionId === null ? [] : [idToString(r.questionId)]))
  }

  /** Up to `n` servable questions for the filter, in the order of the seeded sample. */
  async sample({ exactOptions, ...filter }: GameQuestionFilter, n: number, rng: Prng): Promise<ServedQuestion[]> {
    if (n <= 0) return []
    // Plain MCQ with 2 to 4 options only (what `toServed` accepts), so the oversampled window is rarely short.
    const ids = await this.questions.sample({ ...filter, ...shapeOf(exactOptions) }, n * OVERSAMPLE, rng)
    return this.servedFrom(await this.questions.getMany(ids, 'live'), n)
  }

  /** The servable questions among `ids`, in the order of `ids`. Unknown / unservable ids are skipped. */
  async byIds(ids: readonly string[]): Promise<ServedQuestion[]> {
    return this.servedFrom(await this.questions.getMany(ids, 'live'), ids.length)
  }

  /** Servable (published, active, plain 2 to 4 option MCQ) questions for a filter (counts, e.g. "at least 15 for Jutawan"). */
  async eligibleCount({ exactOptions, ...filter }: GameQuestionFilter): Promise<number> {
    return this.questions.count({ ...filter, ...shapeOf(exactOptions), status: 'approved', active: true })
  }

  private servedFrom(records: QuestionRecord[], limit: number): ServedQuestion[] {
    const out: ServedQuestion[] = []
    for (const r of records) {
      const served = toServed(r)
      if (served) out.push(served)
      if (out.length >= limit) break
    }
    return out
  }
}

/**
 * Maps a record to the keyless shape plus the server-only key. Only a question with ONE part that is an MCQ with
 * 2..4 options is servable (null otherwise). Option ids are the option index 0..3, labels A..D by position.
 */
export function toServed(record: QuestionRecord): ServedQuestion | null {
  const parts: QuestionPart[] = record.version.parts
  const part = parts.length === 1 ? parts[0] : undefined
  if (!part || !('mode' in part) || part.mode !== 'mcq') return null
  if (part.options.length < 2 || part.options.length > 4) return null
  const keyIndex = part.options.findIndex((o) => o.label === part.key.correct)
  if (keyIndex < 0) return null
  const stem = record.version.stemMs?.trim() ? record.version.stemMs : part.prompt.ms
  if (!stem.trim()) return null
  const options = part.options.map((o, i) => ({ id: i, label: LABELS[i] as (typeof LABELS)[number], text: o.body.ms }))
  if (options.some((o) => o.text.trim() === '')) return null
  return {
    question: { id: record.id, text: stem, options },
    keyIndex,
    keyText: options[keyIndex]?.text ?? '',
    difficultyTp: record.version.difficultyTp,
    versionNo: record.version.versionNo,
  }
}
