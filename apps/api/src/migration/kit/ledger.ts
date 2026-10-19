import { toJson } from './sql'
import type { LegacySource, RunMode, RunStatus, SqlExecutor } from './types'

/** Per-entity counters kept in `etl_runs.counters` (aggregates only, no row values). */
export interface EntityCounters {
  read: number
  inserted: number
  updated: number
  unchanged: number
  excluded: number
  batches: number
}
export type RunCounters = Record<string, EntityCounters>

export const emptyCounters = (): EntityCounters => ({
  read: 0,
  inserted: 0,
  updated: 0,
  unchanged: 0,
  excluded: 0,
  batches: 0,
})

export interface StartRun {
  mode: RunMode
  sources: readonly LegacySource[]
  entitySet: readonly string[]
  gitSha?: string | null
  inputHash: string
}

export interface ReconRow {
  entity: string
  sourceCount: number
  eligibleCount: number
  loaded: number
  rejected: number
  expectedDelta: number
  status: 'ok' | 'mismatch'
}

export interface RunRow {
  id: string
  mode: RunMode
  status: RunStatus
  inputHash: string | null
  counters: RunCounters
}

interface RunDbRow {
  id: string
  mode: RunMode
  status: RunStatus
  input_hash: string | null
  counters: RunCounters | null
}

const toRun = (r: RunDbRow): RunRow => ({
  id: r.id,
  mode: r.mode,
  status: r.status,
  inputHash: r.input_hash,
  counters: r.counters ?? {},
})

/**
 * Reads and writes `etl_runs` and `etl_recon`: one row per CLI invocation. Use a pool (autocommit)
 * for ledger writes that must survive a rolled-back dry-run; pass a transaction client for
 * `saveCounters` when the counters must commit with a batch.
 */
export class RunLedger {
  constructor(private readonly db: SqlExecutor) {}

  async start(input: StartRun): Promise<string> {
    const res = await this.db.query<{ id: string }>(
      `INSERT INTO etl_runs (mode, sources, entity_set, git_sha, input_hash, status, counters)
       VALUES ($1, $2::text[], $3::text[], $4, $5, 'running', '{}'::jsonb) RETURNING id::text AS id`,
      [input.mode, [...input.sources], [...input.entitySet], input.gitSha ?? null, input.inputHash],
    )
    return (res.rows[0] as { id: string }).id
  }

  /** Puts a failed or interrupted run back to `running` so a resume continues under the same id. */
  async reopen(runId: string): Promise<void> {
    await this.db.query(`UPDATE etl_runs SET status = 'running', finished_at = NULL WHERE id = $1::bigint`, [runId])
  }

  async saveCounters(runId: string, counters: RunCounters, db: SqlExecutor = this.db): Promise<void> {
    await db.query(`UPDATE etl_runs SET counters = $2::jsonb WHERE id = $1::bigint`, [runId, toJson(counters)])
  }

  async finish(runId: string, status: Exclude<RunStatus, 'running'>, counters?: RunCounters): Promise<void> {
    await this.db.query(
      `UPDATE etl_runs SET status = $2, finished_at = now(), counters = COALESCE($3::jsonb, counters)
       WHERE id = $1::bigint`,
      [runId, status, counters ? toJson(counters) : null],
    )
  }

  async get(runId: string): Promise<RunRow | null> {
    const res = await this.db.query<RunDbRow>(
      `SELECT id::text AS id, mode, status, input_hash, counters FROM etl_runs WHERE id = $1::bigint`,
      [runId],
    )
    return res.rows[0] ? toRun(res.rows[0]) : null
  }

  /** Latest succeeded dry-run on the same input hash, entity set and sources (the `--apply` gate). */
  async findPassedDryRun(
    inputHash: string,
    sources: readonly LegacySource[],
    entitySet: readonly string[],
  ): Promise<RunRow | null> {
    const res = await this.db.query<RunDbRow>(
      `SELECT id::text AS id, mode, status, input_hash, counters FROM etl_runs
       WHERE mode = 'dry-run' AND status = 'succeeded' AND input_hash = $1
         AND entity_set @> $2::text[] AND entity_set <@ $2::text[]
         AND sources @> $3::text[] AND sources <@ $3::text[]
       ORDER BY id DESC LIMIT 1`,
      [inputHash, [...entitySet], [...sources]],
    )
    return res.rows[0] ? toRun(res.rows[0]) : null
  }

  /** Latest unfinished (failed or interrupted) apply run on the same input, to resume. */
  async findResumable(
    inputHash: string,
    sources: readonly LegacySource[],
    entitySet: readonly string[],
  ): Promise<RunRow | null> {
    const res = await this.db.query<RunDbRow>(
      `SELECT id::text AS id, mode, status, input_hash, counters FROM etl_runs
       WHERE mode = 'apply' AND status IN ('failed', 'running') AND input_hash = $1
         AND entity_set @> $2::text[] AND entity_set <@ $2::text[]
         AND sources @> $3::text[] AND sources <@ $3::text[]
       ORDER BY id DESC LIMIT 1`,
      [inputHash, [...entitySet], [...sources]],
    )
    return res.rows[0] ? toRun(res.rows[0]) : null
  }

  async writeRecon(runId: string, rows: readonly ReconRow[]): Promise<void> {
    for (const r of rows) {
      await this.db.query(
        `INSERT INTO etl_recon (run_id, entity, source_count, eligible_count, loaded, rejected, expected_delta, status)
         VALUES ($1::bigint, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (run_id, entity) DO UPDATE SET source_count = EXCLUDED.source_count,
           eligible_count = EXCLUDED.eligible_count, loaded = EXCLUDED.loaded, rejected = EXCLUDED.rejected,
           expected_delta = EXCLUDED.expected_delta, status = EXCLUDED.status`,
        [runId, r.entity, r.sourceCount, r.eligibleCount, r.loaded, r.rejected, r.expectedDelta, r.status],
      )
    }
  }
}
