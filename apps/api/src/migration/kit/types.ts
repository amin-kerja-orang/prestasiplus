import type pg from 'pg'

/** Anything that runs SQL: a `pg.Pool`, a checked-out `pg.PoolClient`, or a test double over them. */
export interface SqlExecutor {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<R>>
}

/** Sources an old-system row can come from (plan 14.2). `my` is an empty extension point (OD-13). */
export const LEGACY_SOURCES = ['cloud', 'my'] as const
export type LegacySource = (typeof LEGACY_SOURCES)[number]

export function assertLegacySource(value: string): asserts value is LegacySource {
  if (!(LEGACY_SOURCES as readonly string[]).includes(value)) {
    throw new RangeError(`Unknown legacy source "${value}" (allowed: ${LEGACY_SOURCES.join(', ')}).`)
  }
}

/** Reason codes of `etl_rejects` (plan 14.4). */
export const REJECT_REASONS = [
  'UNKNOWN_ENUM',
  'ORPHAN_PARENT',
  'DUPLICATE_KEY',
  'INVALID_VALUE',
  'UNSUPPORTED',
] as const
export type RejectReason = (typeof REJECT_REASONS)[number]

export type RunMode = 'dry-run' | 'apply'
export type RunStatus = 'running' | 'succeeded' | 'failed'

/** Row counts one load step reports; the runner sums them per entity for the reconciliation. */
export interface LoadStats {
  inserted: number
  updated: number
  unchanged: number
}

export const emptyStats = (): LoadStats => ({ inserted: 0, updated: 0, unchanged: 0 })
