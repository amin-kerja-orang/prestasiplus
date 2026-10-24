import type pg from 'pg'

import { assertApplyAllowed } from './apply-guard'
import { batches } from './batches'
import { loadCheckpoint, saveCheckpoint } from './checkpoint'
import { IdMap } from './id-map'
import {
  emptyCounters,
  type EntityCounters,
  type ReconRow,
  RunLedger,
  type RunCounters,
} from './ledger'
import { Rejects } from './rejects'
import { type LegacySource, type LoadStats, type RunMode, type RunStatus } from './types'

/** Everything a loader needs inside one batch. `db` is the batch's transaction client. */
export interface BatchContext {
  db: pg.PoolClient
  source: LegacySource
  idMap: IdMap
  rejects: Rejects
  runId: string
  /** 1-based number of this batch within the entity. */
  batch: number
  mode: RunMode
  /** Runs `undo` (best effort, errors ignored) if this batch does not commit: removes what the batch made outside the database. */
  onRollback(undo: () => Promise<void>): void
  /** Runs `done` (best effort, errors ignored) once this batch has committed. */
  afterCommit(done: () => Promise<void>): void
}

/** What a step reports for a batch; omitted numbers count as 0. */
export type BatchResult = Partial<LoadStats> & {
  /** Rows left out by a documented exclusion (reconciliation `eligible_count`). */
  excluded?: number
}

/** One entity of a migration: how to read it and how to load a batch of it. */
export interface EntityStep<Row = unknown> {
  entity: string
  source: LegacySource
  /** Source rows in ascending key order, strictly after `afterKey` (`null` = from the start). */
  extract(afterKey: string | null): AsyncIterable<Row> | Iterable<Row>
  /** The row's key as text; must follow the order of `extract`. */
  keyOf(row: Row): string
  /** Loads one batch. Runs in one transaction; throw to roll the batch back. No network or file I/O here. */
  load(rows: Row[], ctx: BatchContext): Promise<BatchResult | void>
  /** A documented number for the reconciliation (`eligible - loaded - rejected`); default 0. */
  expectedDelta?: number
}

/** A step of any row type (steps differ per entity, so the row type is erased here). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEntityStep = EntityStep<any>

export interface RunOptions {
  /** Default `dry-run`. */
  mode?: RunMode
  steps: readonly AnyEntityStep[]
  /** Identifies the input (dump hash, entity list, ...). A dry-run and its apply must share it. */
  inputHash: string
  gitSha?: string | null
  /** Rows per batch; plan 14.5 suggests 1,000 to 10,000. Default 1,000. */
  batchSize?: number
  /** `--apply` continues an unfinished apply run on the same input. Default true. */
  resume?: boolean
  /**
   * Called once the run row of THIS invocation exists (started, or reopened for a resume) and before any batch runs. Nothing is
   * called when the run stops earlier (apply guard, held lock, apply refused), so a caller knows whether a row is its own.
   */
  onRunStart?: (runId: string) => void
}

export interface RunReport {
  runId: string
  mode: RunMode
  status: Exclude<RunStatus, 'running'>
  recon: ReconRow[]
  counters: RunCounters
  /** Batches skipped because a checkpoint said they were already committed. */
  resumedBatches: number
}

/** `--apply` was requested without a passing dry-run on the same input hash. */
export class ApplyRefusedError extends Error {
  constructor(inputHash: string) {
    super(
      `Refusing --apply: no passing dry-run found for input hash ${inputHash}. ` +
        `Run the same command with --dry-run first (it must succeed with every reconciliation row ok).`,
    )
    this.name = 'ApplyRefusedError'
  }
}

/** Another run with the same mode and input is active. */
export class RunInProgressError extends Error {
  constructor(mode: RunMode, inputHash: string) {
    super(`Another ${mode} run on input hash ${inputHash} is already in progress.`)
    this.name = 'RunInProgressError'
  }
}

export interface RunnerDeps {
  pool: pg.Pool
  /**
   * Environment for the apply guard (default `process.env`). Commands pass `ctx.env` so the guard
   * sees the same variables as the CLI. Dry-run never reads it.
   */
  env?: Readonly<Record<string, string | undefined>>
}

/**
 * Dry-run first, apply second (plan 14.5 item 3, BE-MIG-04).
 *
 *  - `dry-run` (default): every step runs inside ONE transaction that is always rolled back, so no
 *    non-`etl_*` table changes. The run row, rejects and reconciliation are written on separate
 *    connections and survive the rollback. Checkpoints are not kept.
 *  - `apply`: first the shared apply guard (`ApplyGuardError`: `PP_ALLOW_MIGRATE_APPLY=1`, and in
 *    production `PP_MIGRATE_TARGET_DB` = `current_database()`), then refuses (`ApplyRefusedError`) unless a dry-run with `status = succeeded` exists for
 *    the same `inputHash`, sources and entity set. Each batch is its own transaction that includes
 *    its rejects, counters and checkpoint, so a crash never leaves a half-batch and a re-run
 *    resumes at the next batch of the same run row.
 *
 * Status is `succeeded` only when every reconciliation row is `ok`
 * (`eligible - loaded - rejected = expectedDelta`).
 */
export class Runner {
  private readonly pool: pg.Pool
  private readonly ledger: RunLedger
  private readonly env: Readonly<Record<string, string | undefined>>

  constructor(deps: RunnerDeps) {
    this.pool = deps.pool
    this.env = deps.env ?? process.env
    this.ledger = new RunLedger(deps.pool)
  }

  async run(options: RunOptions): Promise<RunReport> {
    const mode: RunMode = options.mode ?? 'dry-run'
    const steps = options.steps as readonly EntityStep<unknown>[]
    if (!options.inputHash) throw new RangeError('A run needs an input hash.')
    if (steps.length === 0) throw new RangeError('A run needs at least one step.')
    const names = steps.map((s) => s.entity)
    if (new Set(names).size !== names.length) throw new RangeError('Duplicate entity in the run.')
    const sources = [...new Set(steps.map((s) => s.source))].sort()
    const batchSize = options.batchSize ?? 1_000

    // The apply guard lives here, not only in the CLI: refuse before any lock, run row or batch.
    if (mode === 'apply') await assertApplyAllowed(this.pool, this.env)

    const lock = await this.pool.connect()
    try {
      const got = await lock.query<{ ok: boolean }>(
        `SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS ok`,
        [`etl:${mode}:${options.inputHash}`],
      )
      if (!got.rows[0]?.ok) throw new RunInProgressError(mode, options.inputHash)

      let runId: string
      let counters: RunCounters = {}
      if (mode === 'apply') {
        const passed = await this.ledger.findPassedDryRun(options.inputHash, sources, names)
        if (!passed) throw new ApplyRefusedError(options.inputHash)
        const unfinished =
          options.resume === false ? null : await this.ledger.findResumable(options.inputHash, sources, names)
        if (unfinished) {
          runId = unfinished.id
          counters = unfinished.counters
          await this.ledger.reopen(runId)
        } else {
          runId = await this.ledger.start({ mode, sources, entitySet: names, gitSha: options.gitSha, inputHash: options.inputHash })
        }
      } else {
        runId = await this.ledger.start({ mode, sources, entitySet: names, gitSha: options.gitSha, inputHash: options.inputHash })
      }

      options.onRunStart?.(runId)

      const rejects = new Rejects()
      let resumedBatches = 0
      try {
        if (mode === 'dry-run') {
          counters = await this.runDryRun(runId, steps, batchSize, rejects)
        } else {
          for (const step of steps) {
            const result = await this.runStepApply(runId, step, batchSize, rejects, counters)
            resumedBatches += result.skipped
          }
        }
      } catch (err) {
        // A failing bookkeeping write must not mask the original error.
        await this.ledger.finish(runId, 'failed', mode === 'apply' ? undefined : counters).catch(() => undefined)
        throw err
      }

      // A dry-run's rejects are written after its rollback; an apply already flushed them per batch.
      if (rejects.size > 0) await rejects.flush(this.pool, runId)
      const recon = await this.reconcile(runId, steps, counters)
      await this.ledger.writeRecon(runId, recon)
      const status = recon.every((r) => r.status === 'ok') ? 'succeeded' : 'failed'
      await this.ledger.finish(runId, status, counters)
      // A resumed row's `counters` JSON can carry keys that are not entities (the core command keeps its `notes` there):
      // the report holds the entity counters of this run's steps only.
      const entityCounters = Object.fromEntries(names.filter((n) => counters[n] !== undefined).map((n) => [n, counters[n]])) as RunCounters
      return { runId, mode, status, recon, counters: entityCounters, resumedBatches }
    } finally {
      await lock.query(`SELECT pg_advisory_unlock_all()`).catch(() => undefined)
      lock.release()
    }
  }

  /** One transaction for all steps, always rolled back. Returns the counters. */
  private async runDryRun(
    runId: string,
    steps: readonly EntityStep<unknown>[],
    batchSize: number,
    rejects: Rejects,
  ): Promise<RunCounters> {
    const counters: RunCounters = {}
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      for (const step of steps) {
        const c = (counters[step.entity] = emptyCounters())
        let batchNo = 0
        for await (const rows of batches(step.extract(null), batchSize)) {
          batchNo++
          const result = await step.load(rows, {
            db: client,
            source: step.source,
            idMap: new IdMap(client, step.source),
            rejects,
            runId,
            batch: batchNo,
            mode: 'dry-run',
            // A dry-run writes nothing outside the database and its transaction is always rolled back.
            onRollback: () => undefined,
            afterCommit: () => undefined,
          })
          addBatch(c, rows.length, result)
        }
      }
    } finally {
      await rollbackAndRelease(client)
    }
    return counters
  }

  private async runStepApply(
    runId: string,
    step: EntityStep<unknown>,
    batchSize: number,
    rejects: Rejects,
    counters: RunCounters,
  ): Promise<{ skipped: number }> {
    const checkpoint = await loadCheckpoint(this.pool, runId, step.entity)
    let batchNo = checkpoint.batch
    counters[step.entity] ??= emptyCounters()
    for await (const rows of batches(step.extract(checkpoint.lastKey), batchSize)) {
      batchNo++
      const next: EntityCounters = { ...(counters[step.entity] as EntityCounters) }
      const client = await this.pool.connect()
      let released = false
      const undo: (() => Promise<void>)[] = []
      const done: (() => Promise<void>)[] = []
      try {
        await client.query('BEGIN')
        const result = await step.load(rows, {
          db: client,
          source: step.source,
          idMap: new IdMap(client, step.source),
          rejects,
          runId,
          batch: batchNo,
          mode: 'apply',
          onRollback: (fn) => void undo.push(fn),
          afterCommit: (fn) => void done.push(fn),
        })
        addBatch(next, rows.length, result)
        await rejects.flush(client, runId)
        await saveCheckpoint(client, runId, step.entity, {
          lastKey: step.keyOf(rows[rows.length - 1] as unknown),
          batch: batchNo,
        })
        await this.ledger.saveCounters(runId, { ...counters, [step.entity]: next }, client)
        await client.query('COMMIT')
        await Promise.allSettled(done.map((fn) => fn()))
      } catch (err) {
        rejects.clear()
        await rollbackAndRelease(client)
        released = true
        await Promise.allSettled(undo.map((fn) => fn()))
        throw err
      } finally {
        if (!released) client.release()
      }
      counters[step.entity] = next
    }
    return { skipped: checkpoint.batch }
  }

  private async reconcile(
    runId: string,
    steps: readonly EntityStep<unknown>[],
    counters: RunCounters,
  ): Promise<ReconRow[]> {
    const rejected = await this.pool.query<{ entity: string; n: string }>(
      `SELECT entity, count(*)::text AS n FROM etl_rejects WHERE run_id = $1::bigint GROUP BY entity`,
      [runId],
    )
    const rejectedBy = new Map(rejected.rows.map((r) => [r.entity, Number(r.n)]))
    return steps.map((step) => {
      const c = counters[step.entity] ?? emptyCounters()
      const eligible = c.read - c.excluded
      const loaded = c.inserted + c.updated + c.unchanged
      const rej = rejectedBy.get(step.entity) ?? 0
      const expectedDelta = step.expectedDelta ?? 0
      return {
        entity: step.entity,
        sourceCount: c.read,
        eligibleCount: eligible,
        loaded,
        rejected: rej,
        expectedDelta,
        status: eligible - loaded - rej === expectedDelta ? 'ok' : 'mismatch',
      }
    })
  }
}

/** ROLLBACK, then return the client; when the ROLLBACK itself fails the connection is destroyed, not pooled. */
async function rollbackAndRelease(client: pg.PoolClient): Promise<void> {
  let broken = false
  await client.query('ROLLBACK').catch(() => {
    broken = true
  })
  client.release(broken ? true : undefined)
}

function addBatch(c: EntityCounters, read: number, result: BatchResult | void): void {
  c.read += read
  c.batches += 1
  c.inserted += result?.inserted ?? 0
  c.updated += result?.updated ?? 0
  c.unchanged += result?.unchanged ?? 0
  c.excluded += result?.excluded ?? 0
}
