import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { CLOCK, type Clock } from '../../db/clock'
import type { Prng } from '../../db/prng'
import { QuestionsRepository, type QuestionRecord } from '../questions'
import { POOL_CACHE_SECONDS } from './config'
import { difficultyOf, mcqItemOf } from './rules'

/** One question of the SPM pool, reduced to what the counts need. */
export interface PoolFact {
  id: string
  levelId: string | null
  /** Mock difficulty 1 to 5. */
  difficulty: number
}

const CHUNK = 200

/** True for a question the pool counts: live-published, active, flagged `spmPool`, one multiple-choice leaf. */
const inPool = (r: QuestionRecord): boolean => r.spmPool && r.isActive && r.version.status === 'published' && mcqItemOf(r.version.stemMs, r.version.parts) !== null

/**
 * The SPM pool (BR-M06-02), computed through the BE-09 doorway only: `QuestionsRepository.eligibleIds` +
 * `getMany(..., 'live')` and a filter on `spmPool` in memory. `QuestionFilter` has no pool filter (cross-lane ask:
 * add `spmPool`; see the deviations log). Facts per subject are reused for `SPM_POOL_CACHE_SECONDS` (default 60;
 * 0 turns the cache off) because a read hydrates every eligible question of the subject.
 */
@Injectable()
export class SpmPoolService {
  private readonly cache = new Map<string, { until: number; facts: PoolFact[] }>()

  constructor(
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private ttlMs(): number {
    const n = Number.parseInt(String(this.config.get<string>('SPM_POOL_CACHE_SECONDS') ?? ''), 10)
    return (Number.isInteger(n) && n >= 0 ? n : POOL_CACHE_SECONDS) * 1000
  }

  /** Ids of the live-published active multiple-choice questions of a subject, ascending. */
  private async candidateIds(subjectId: string): Promise<string[]> {
    return this.questions.eligibleIds({ subjectId, type: 'mcq' })
  }

  private async poolRecords(ids: readonly string[]): Promise<QuestionRecord[]> {
    const out: QuestionRecord[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const records = await this.questions.getMany(ids.slice(i, i + CHUNK), 'live')
      out.push(...records.filter(inPool))
    }
    return out
  }

  /** The pool of a subject as count facts, ascending by id. */
  async facts(subjectId: string, options: { fresh?: boolean } = {}): Promise<PoolFact[]> {
    const ttl = this.ttlMs()
    const now = this.clock.now().getTime()
    const hit = this.cache.get(subjectId)
    if (!options.fresh && ttl > 0 && hit && hit.until > now) return hit.facts
    const records = await this.poolRecords(await this.candidateIds(subjectId))
    const facts = records.map((r) => ({ id: r.id, levelId: r.version.educationLevelId, difficulty: difficultyOf(r.version.difficultyTp) }))
    if (ttl > 0) this.cache.set(subjectId, { until: now + ttl, facts })
    return facts
  }

  /** Pool size of a subject, optionally of one level and one difficulty. */
  async count(subjectId: string, filter: { levelId?: string; difficulty?: number } = {}): Promise<number> {
    return countOf(await this.facts(subjectId), filter)
  }

  /**
   * Up to `n` pool questions drawn with `rng` (Fisher-Yates over the ascending ids, like `QuestionsRepository.sample`),
   * read fresh. A drawn question that stopped being eligible meanwhile is skipped and the next one is taken.
   */
  async sample(subjectId: string, n: number, rng: Prng): Promise<QuestionRecord[]> {
    const ids = (await this.facts(subjectId, { fresh: true })).map((f) => f.id)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = rng.int(0, i)
      const tmp = ids[i] as string
      ids[i] = ids[j] as string
      ids[j] = tmp
    }
    const picked: QuestionRecord[] = []
    for (let i = 0; i < ids.length && picked.length < n; i += n) {
      const records = new Map((await this.poolRecords(ids.slice(i, i + n))).map((r) => [r.id, r]))
      for (const id of ids.slice(i, i + n)) {
        const r = records.get(id)
        if (r && picked.length < n) picked.push(r)
      }
    }
    return picked
  }
}

export function countOf(facts: readonly PoolFact[], filter: { levelId?: string; difficulty?: number } = {}): number {
  return facts.filter((f) => (filter.levelId === undefined || f.levelId === filter.levelId) && (filter.difficulty === undefined || f.difficulty === filter.difficulty)).length
}
