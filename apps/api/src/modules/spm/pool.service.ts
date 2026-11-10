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

/** A cached count: valid until `until` (ms), computed under question-event `generation`. */
interface Memo<T> {
  until: number
  value: T
  generation: number
}

/** Background refreshes of stale counts that run at the same time (each is a bank-wide count of one subject). */
const REFRESH_PARALLEL = 2

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


/** First window of a draw is `n * DRAW_OVER`; it widens x4 (same seed, so the same prefix) while records are refused. */
const DRAW_OVER = 2
const DRAW_ROUNDS = 3

/** True for a question the pool serves: live-approved, active, one multiple-choice leaf (the SQL scope already enforced the SPM-servable level rule). */
const inPool = (r: QuestionRecord): boolean => r.isActive && r.version.status === 'approved' && mcqItemOf(r.version.stemMs, r.version.parts) !== null

/**
 * The SPM pool (BR-M06-02), computed through the BE-09 doorway only. Counts are ONE grouped SQL statement per subject
 * (`QuestionsRepository.groupCountsByLevelTp` over the `spmPool` filter): no id list and no hydration, whatever the bank size.
 * A draw is `QuestionsRepository.sampleIds` (SQL, LIMIT) plus a hydration of the drawn ids only. The cells of a subject are
 * reused for `SPM_POOL_CACHE_SECONDS` (default 300; 0 turns the cache off) and single-flighted per subject. Past the TTL a count is still served while one refresh runs behind it; only a question event or a cold start makes a read wait (see `memo`).
 */
@Injectable()
export class SpmPoolService {
  private readonly inflight = new Map<string, Promise<PoolCell[]>>()
  private readonly cache = new Map<string, Memo<PoolCell[]>>()
  private readonly databankInflight = new Map<string, Promise<number>>()
  private readonly unitCellsInflight = new Map<string, Promise<PoolCell[]>>()
  private readonly unitCellsCache = new Map<string, Memo<PoolCell[]>>()
  private readonly databankCache = new Map<string, Memo<number>>()
  /** Background refreshes waiting for their turn: at most `REFRESH_PARALLEL` run at once, so a hub whose 19 subjects expired together never starts 19 bank-wide counts. */
  private readonly refreshQueue: (() => void)[] = []
  private refreshing = 0

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

  /**
   * The one cache rule of the three counts below. A value of the CURRENT generation (no question event since) is served as it is; once it is older than the
   * TTL it is still served at once and ONE refresh runs behind it (stale-while-revalidate), so a pupil never waits for a count that is only old, not changed.
   * After a question event (a new generation) or with no value yet (cold) the read computes and waits, so a change shows on the next load. Concurrent
   * computes of one key and generation share one statement. `fresh` skips the cache. A TTL of 0 turns the cache off.
   */
  private memo<T>(store: Map<string, Memo<T>>, flights: Map<string, Promise<T>>, key: string, fresh: boolean | undefined, load: () => Promise<T>): Promise<T> {
    const ttl = this.ttlMs()
    const now = this.clock.now().getTime()
    const generation = this.generation()
    const hit = store.get(key)
    if (!fresh && ttl > 0 && hit && hit.generation === generation) {
      if (hit.until <= now) this.refreshBehind(store, flights, key, generation, load)
      return Promise.resolve(hit.value)
    }
    // Single-flight: concurrent reads of one key share one statement, but never across a question event (the flight key holds the generation).
    const flight = `${key}:${String(generation)}`
    const running = flights.get(flight)
    if (running) return running
    const run = (async () => {
      const value = await load()
      if (ttl > 0) store.set(key, { until: now + ttl, value, generation })
      return value
    })()
    flights.set(flight, run)
    const done = () => flights.delete(flight)
    run.then(done, done)
    return run
  }

  /** Starts the one background refresh of a stale value (none when it is already running); a failure keeps the stale value. */
  private refreshBehind<T>(store: Map<string, Memo<T>>, flights: Map<string, Promise<T>>, key: string, generation: number, load: () => Promise<T>): void {
    const flight = `${key}:${String(generation)}`
    if (flights.has(flight)) return
    const run = this.inBackground(async () => {
      const value = await load()
      // A question event during the refresh moved the generation: this value is already old, the next read computes its own.
      if (this.generation() === generation) store.set(key, { until: this.clock.now().getTime() + this.ttlMs(), value, generation })
      return value
    })
    flights.set(flight, run)
    const done = () => flights.delete(flight)
    run.then(done, done)
  }

  private inBackground<T>(job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.refreshing++
        job().then(resolve, reject).finally(() => {
          this.refreshing--
          this.refreshQueue.shift()?.()
        })
      }
      if (this.refreshing < REFRESH_PARALLEL) start()
      else this.refreshQueue.push(start)
    })
  }

  /** The pool of a subject as counts per (level, difficulty). */
  cells(subjectId: string, options: { fresh?: boolean } = {}): Promise<PoolCell[]> {
    return this.memo(this.cache, this.inflight, subjectId, options.fresh, async () => mergeCells(await this.questions.groupCountsByLevelTp({ ...poolFilter(subjectId), status: 'approved', active: true })))
  }

  /**
   * The Databank count of a subject: units the Databank draw can serve (see `databankFilter`). Cached like `cells` (same TTL, single
   * flight, dropped when a question event moves `generation`).
   */
  databankCount(subjectId: string, options: { fresh?: boolean } = {}): Promise<number> {
    return this.memo(this.databankCache, this.databankInflight, subjectId, options.fresh, () => this.questions.unitCount(databankFilter(subjectId)))
  }

  /** The Latih Tubi SPM total of a subject: the sum of `latihTubiCells`, ONE statement and ONE cache, so total and breakdowns are equal by construction. */
  async latihTubiCount(subjectId: string, options: { fresh?: boolean } = {}): Promise<number> {
    return countOf(await this.latihTubiCells(subjectId, options))
  }

  /**
   * The Latih Tubi cells of a subject by (level, difficulty) in UNITS (see `latihTubiFilter`): they sum to `latihTubiCount` (which is their sum), because a
   * group sits in one bucket (the level and TP of its first member, `unitCountsByLevelTp`). Cached like `databankCount`.
   */
  latihTubiCells(subjectId: string, options: { fresh?: boolean } = {}): Promise<PoolCell[]> {
    return this.memo(this.unitCellsCache, this.unitCellsInflight, subjectId, options.fresh, async () => mergeCells(await this.questions.unitCountsByLevelTp(latihTubiFilter(subjectId))))
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

/** Merges (level, TP) rows into cells by (level, mock difficulty 1 to 5). */
function mergeCells(rows: readonly { levelId: string | null; tp: number | null; n: number }[]): PoolCell[] {
  const merged = new Map<string, PoolCell>()
  for (const r of rows) {
    const difficulty = difficultyOf(r.tp)
    const key = `${r.levelId ?? ''}:${String(difficulty)}`
    const cell = merged.get(key)
    if (cell) cell.n += r.n
    else merged.set(key, { levelId: r.levelId, difficulty, n: r.n })
  }
  return [...merged.values()]
}

export function countOf(cells: readonly PoolCell[], filter: { levelId?: string; difficulty?: number } = {}): number {
  return cells
    .filter((c) => (filter.levelId === undefined || c.levelId === filter.levelId) && (filter.difficulty === undefined || c.difficulty === filter.difficulty))
    .reduce((a, c) => a + c.n, 0)
}
