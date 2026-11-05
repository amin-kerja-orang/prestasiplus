import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { CLOCK, type Clock } from '../../db/clock'
import type { Prng } from '../../db/prng'
import { OverviewCache, QuestionsRepository, servabilityFilterOf, type QuestionFilter, type QuestionRecord } from '../questions'
import { POOL_CACHE_SECONDS } from './config'
import { difficultyOf, mcqItemOf } from './rules'

/** Pool questions of one subject at one (level, mock difficulty 1 to 5): the count facts the hub shows. */
export interface PoolCell {
  levelId: string | null
  /** Mock difficulty 1 to 5. */
  difficulty: number
  n: number
}

/** The SQL scope of the SPM pool of a subject: live-published, active, SPM-servable (offered level, no tag), one multiple-choice leaf outside any group (the same shape `inPool` / `mcqItemOf` accept, so counts and draws agree). */
const poolFilter = (subjectId: string): QuestionFilter => ({ subjectId, type: 'mcq', spmPool: true, ungrouped: true, singleMcqLeaf: true })

/**
 * S3-T07 (D91, AC-MUR-13-13): the SQL scope of the Databank COUNT. It is the serving definition of the Databank draw
 * (`filterOf('databank')`, which follows `GROUP_SURFACES`), so a count equals what a Databank draw can serve: a stimulus group
 * is counted once (and only while complete). A multi-leaf question is one unit in any scope that serves it; the Databank shape serves
 * single-part questions only, so there it counts 0. NOT `poolFilter`: that one stays the single-leaf scope of the
 * SPM Mock paper 1 draw (`mock.service.ts`, `mcqItemOf`).
 */
export const databankFilter = (subjectId: string): QuestionFilter => ({ ...servabilityFilterOf('databank', { subjectId }), status: 'approved', active: true })

/**
 * The same for the Latih Tubi SPM hub total: the serving definition of the Latih Tubi draw (`filterOf('latih_tubi_spm')`, which
 * follows `GROUP_SURFACES`: singles only while the surface is not a group surface, whole groups once it is).
 */
export const latihTubiFilter = (subjectId: string): QuestionFilter => ({ ...servabilityFilterOf('latih_tubi_spm', { subjectId }), status: 'approved', active: true })

type CountedActivity = 'databank' | 'latih_tubi_spm'

/** First window of a draw is `n * DRAW_OVER`; it widens x4 (same seed, so the same prefix) while records are refused. */
const DRAW_OVER = 2
const DRAW_ROUNDS = 3

/** True for a question the pool serves: live-approved, active, one multiple-choice leaf (the SQL scope already enforced the SPM-servable level rule). */
const inPool = (r: QuestionRecord): boolean => r.isActive && r.version.status === 'approved' && mcqItemOf(r.version.stemMs, r.version.parts) !== null

/**
 * The SPM pool (BR-M06-02), computed through the BE-09 doorway only. Counts are ONE grouped SQL statement per subject
 * (`QuestionsRepository.groupCountsByLevelTp` over the `spmPool` filter): no id list and no hydration, whatever the bank size.
 * A draw is `QuestionsRepository.sampleIds` (SQL, LIMIT) plus a hydration of the drawn ids only. The cells of a subject are
 * reused for `SPM_POOL_CACHE_SECONDS` (default 60; 0 turns the cache off) and single-flighted per subject.
 */
@Injectable()
export class SpmPoolService {
  private readonly inflight = new Map<string, Promise<PoolCell[]>>()
  private readonly cache = new Map<string, { until: number; cells: PoolCell[]; generation: number }>()
  private readonly databankInflight = new Map<string, Promise<number>>()
  private readonly databankCache = new Map<string, { until: number; n: number; generation: number }>()

  constructor(
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(CLOCK) private readonly clock: Clock,
    /**
     * N4 / ruling 8: the question events (approve, Terbit, Tarik balik, create, remove, activate) already call `OverviewCache.invalidate()`
     * in `QuestionsService`; its `generation` moves with each, so a cached count is dropped on the next load ("+1 on next load").
     */
    @Inject(OverviewCache) private readonly events: OverviewCache,
  ) {}

  private generation(): number {
    return this.events.generation
  }

  private ttlMs(): number {
    const n = Number.parseInt(String(this.config.get<string>('SPM_POOL_CACHE_SECONDS') ?? ''), 10)
    return (Number.isInteger(n) && n >= 0 ? n : POOL_CACHE_SECONDS) * 1000
  }

  /** The pool of a subject as counts per (level, difficulty). */
  async cells(subjectId: string, options: { fresh?: boolean } = {}): Promise<PoolCell[]> {
    const ttl = this.ttlMs()
    const now = this.clock.now().getTime()
    const hit = this.cache.get(subjectId)
    const generation = this.generation()
    if (!options.fresh && ttl > 0 && hit && hit.until > now && hit.generation === generation) return hit.cells
    // Single-flight: concurrent reads of one subject share one statement, but never across a question event (the key holds the generation).
    const flight = `${subjectId}:${String(generation)}`
    const running = this.inflight.get(flight)
    if (running) return running
    const load = (async () => {
      const rows = await this.questions.groupCountsByLevelTp({ ...poolFilter(subjectId), status: 'approved', active: true })
      const merged = new Map<string, PoolCell>()
      for (const r of rows) {
        const difficulty = difficultyOf(r.tp)
        const key = `${r.levelId ?? ''}:${String(difficulty)}`
        const cell = merged.get(key)
        if (cell) cell.n += r.n
        else merged.set(key, { levelId: r.levelId, difficulty, n: r.n })
      }
      const cells = [...merged.values()]
      if (ttl > 0) this.cache.set(subjectId, { until: now + ttl, cells, generation })
      return cells
    })()
    this.inflight.set(flight, load)
    try {
      return await load
    } finally {
      this.inflight.delete(flight)
    }
  }

  /**
   * The Databank count of a subject: units the Databank draw can serve (see `databankFilter`). Cached like `cells` (same TTL, single
   * flight, dropped when a question event moves `generation`).
   */
  databankCount(subjectId: string, options: { fresh?: boolean } = {}): Promise<number> {
    return this.unitsOf('databank', subjectId, options)
  }

  /** The Latih Tubi SPM total of a subject: units the Latih Tubi draw can serve (see `latihTubiFilter`); cached like `databankCount`. */
  latihTubiCount(subjectId: string, options: { fresh?: boolean } = {}): Promise<number> {
    return this.unitsOf('latih_tubi_spm', subjectId, options)
  }

  private async unitsOf(activity: CountedActivity, subjectId: string, options: { fresh?: boolean }): Promise<number> {
    const ttl = this.ttlMs()
    const now = this.clock.now().getTime()
    const generation = this.generation()
    const key = `${activity}:${subjectId}`
    const hit = this.databankCache.get(key)
    if (!options.fresh && ttl > 0 && hit && hit.until > now && hit.generation === generation) return hit.n
    const flight = `${key}:${String(generation)}`
    const running = this.databankInflight.get(flight)
    if (running) return running
    const load = (async () => {
      const n = await this.questions.unitCount(activity === 'databank' ? databankFilter(subjectId) : latihTubiFilter(subjectId))
      if (ttl > 0) this.databankCache.set(key, { until: now + ttl, n, generation })
      return n
    })()
    this.databankInflight.set(flight, load)
    try {
      return await load
    } finally {
      this.databankInflight.delete(flight)
    }
  }

  /** Pool size of a subject, optionally of one level and one difficulty. */
  async count(subjectId: string, filter: { levelId?: string; difficulty?: number } = {}): Promise<number> {
    return countOf(await this.cells(subjectId), filter)
  }

  /**
   * Up to `n` pool questions drawn in SQL with a seed taken from `rng`, then hydrated (only those ids). A question the
   * hydration refuses (`mcqItemOf`, no longer eligible) is skipped and the window widens; at most `DRAW_ROUNDS` bounded reads.
   */
  async sample(subjectId: string, n: number, rng: Prng): Promise<QuestionRecord[]> {
    if (!Number.isSafeInteger(n) || n <= 0) return []
    const seed = rng.int(0, 0xffffffff)
    const picked: QuestionRecord[] = []
    const seen = new Set<string>()
    let limit = n * DRAW_OVER
    for (let round = 0; round < DRAW_ROUNDS; round++) {
      const ids = await this.questions.sampleIds(poolFilter(subjectId), limit, seed)
      const fresh = ids.filter((id) => !seen.has(id))
      for (const id of fresh) seen.add(id)
      const records = new Map((await this.questions.getMany(fresh, 'live')).filter(inPool).map((r) => [r.id, r]))
      for (const id of fresh) {
        const r = records.get(id)
        if (r && picked.length < n) picked.push(r)
      }
      if (picked.length >= n || ids.length < limit) break
      limit *= 4
    }
    return picked
  }
}

export function countOf(cells: readonly PoolCell[], filter: { levelId?: string; difficulty?: number } = {}): number {
  return cells
    .filter((c) => (filter.levelId === undefined || c.levelId === filter.levelId) && (filter.difficulty === undefined || c.difficulty === filter.difficulty))
    .reduce((a, c) => a + c.n, 0)
}
