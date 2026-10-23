/**
 * Shared types of BE-30 `migrate:verify` (reconciliation report), the rollback and the orchestrator.
 * The report holds aggregates and surrogate ids only: never a name, e-mail, IC, phone, free text or hash.
 */
import type pg from 'pg'

import type { LegacySource } from '../kit/types'

export type Env = Readonly<Record<string, string | undefined>>

/** One row per entity of the plan 14.7 matrix that a BE-28 / BE-29 step loads. */
export interface EntityCheck {
  entity: string
  /** `staging_cloud` table the entity is read from (null for derived entities such as JPN/PPD). */
  stagingTable: string | null
  /** v2 table the entity is written to. */
  targetTable: string
  /** Rows the run read (from `etl_recon` of the latest succeeded apply run of the entity). */
  sourceCount: number
  eligibleCount: number
  loaded: number
  rejected: number
  expectedDelta: number
  /** Rows now in `targetTable` with `legacy_source = <source>` (null when the table carries no legacy columns). */
  targetCount: number | null
  status: 'ok' | 'mismatch' | 'not-run'
  note?: string
  /** Optional (added by Part B): rows in `targetTable` whose source row no longer exists (null = not computable for this entity). */
  deletedAtSource?: number | null
}

/** A semantic check of plan 14.6 (sums, distinct sets, distributions, orphans, accepted drift). */
export interface StatCheck {
  name: string
  kind: 'counts' | 'sums' | 'distinct' | 'distribution' | 'orphans' | 'accepted-drift'
  expected: number | string | null
  actual: number | string | null
  /** `reported` = shown for the go/no-go reader, never fails the run (e.g. ledger vs balance, accepted drift). */
  status: 'ok' | 'mismatch' | 'reported'
  detail?: string
}

export interface VerifyReport {
  generatedAt: string
  source: LegacySource
  /** The `etl_runs.id` values the report was built from. */
  runIds: string[]
  /** `pass` only when every entity row is `ok` and no check is `mismatch`. */
  status: 'pass' | 'fail'
  entities: EntityCheck[]
  checks: StatCheck[]
  /** Paths of the written report files (set by `writeVerifyReport`). */
  files?: { json: string; md: string; deletedIds?: string }
  /**
   * Optional (added by Part B): per entity, the surrogate legacy ids of the rows deleted at the source (capped at 200). Held in
   * memory for the writer only: `writeVerifyReport` moves them into the separate `deleted-at-source-*.json` file
   * (`files.deletedIds`) and leaves them out of the recon json, the markdown and the console, which show counts.
   */
  deletedAtSourceIds?: Record<string, string[]>
}

export interface VerifyOptions {
  pool: pg.Pool
  env: Env
  source: LegacySource
  /** Report directory; must be a `.migration-out` folder (see `profile/render.ts` `prepareOutputDir`). Default `<repo>/.migration-out`. */
  outDir?: string
  /** Build from these runs instead of the latest succeeded apply runs. */
  runIds?: readonly string[]
  /** Test seam for `generatedAt`. */
  now?: Date
  /**
   * Ceiling for rows deleted at the source (optional, added by Part B). Above BOTH `maxDeletedRatio` of an entity's target rows
   * and `maxDeletedRows` rows the entity gets a failing `deleted_at_source_ratio:<entity>` check: a truncated or wrong re-stage
   * would otherwise turn everything into "deleted at source". Defaults 0.05 and 100 (AND rule); decided: LEAD 22 Oct
   * (MIG-08 4b).
   */
  maxDeletedRatio?: number
  maxDeletedRows?: number
}

export interface RollbackOptions {
  pool: pg.Pool
  env: Env
  source: LegacySource
  /** Must equal `current_database()`: the operator types the database name (wrong-database guard). */
  confirmDb: string
  /** Count what would be deleted, inside a transaction that is rolled back. Default false. */
  dryRun?: boolean
}

export interface RollbackReport {
  database: string
  dryRun: boolean
  /** Child tables first (the delete order). */
  tables: { table: string; deleted: number }[]
  idMapDeleted: number
  status: 'succeeded' | 'failed'
  /** Optional (added by Part B): adopted seed rows that other tables use; kept and unmarked instead of deleted. */
  released?: { table: string; rows: number }[]
  /** Optional (added by Part B): things the operator must know (e.g. unfinished runs keep their checkpoints). */
  warnings?: string[]
}
