/**
 * BE-30 `migrate:verify`: the reconciliation report and go/no-go gate (plan 14.6).
 *
 * `runVerify` builds one `EntityCheck` per entity of the matrix (`entities.ts`) from `etl_recon` of the latest succeeded
 * apply run of that entity (or of the runs in `options.runIds`) plus the live row count of the v2 target table, then the
 * semantic checks (`checks.ts`). `status` is `pass` only when every entity is `ok` (or `not-run` and not required) and no
 * check is a `mismatch`. A check that is only `reported` (ledger versus wallet, accepted drift) never fails the run.
 */
import type pg from 'pg'

import { STAGING_SCHEMA } from '../ddl/spec'
import { sanitizeDbError } from '../kit/errors'
import { quoteIdent } from '../kit/sql'
import { assertLegacySource, type LegacySource } from '../kit/types'
import { runChecks } from './checks'
import { deletedAtSource, type DeletedAtSource } from './deleted'
import { ENTITY_MATRIX, matrixEntry, type MatrixEntry } from './entities'
import type { EntityCheck, StatCheck, VerifyOptions, VerifyReport } from './types'

export * from './types'
export { ENTITY_MATRIX, CLAIMABLE_TABLES, ETL_DERIVED_CHILDREN, matrixEntry, type MatrixEntry } from './entities'
export { renderVerifyJson, renderVerifyMarkdown, writeVerifyReport } from './render'
export { rollbackLegacy, RollbackRefusedError } from './rollback'

interface ReconRow {
  run_id: string
  entity: string
  source_count: number
  eligible_count: number
  loaded: number
  rejected: number
  expected_delta: number
  status: string
}

const RUN_ID = /^\d{1,18}$/

/**
 * One row per entity: the latest recon row. By default only succeeded apply runs of the source count (a dry-run is rolled
 * back, a failed run is incomplete). With explicit `runIds` the caller chose the runs, so only the ids and the source are
 * filtered; a failed or dry run then shows up as a mismatch instead of vanishing.
 */
async function latestRecon(pool: pg.Pool, source: LegacySource, runIds: readonly string[] | undefined): Promise<ReconRow[]> {
  if (runIds !== undefined) for (const id of runIds) if (!RUN_ID.test(id)) throw new RangeError('runIds must be numeric etl_runs ids.')
  const res = await pool.query<ReconRow>(
    `SELECT DISTINCT ON (r.entity) r.run_id::text AS run_id, r.entity, r.source_count, r.eligible_count, r.loaded, r.rejected,
            r.expected_delta, r.status
     FROM etl_recon r JOIN etl_runs run ON run.id = r.run_id
     WHERE $1 = ANY(run.sources)
       AND ($2::bigint[] IS NOT NULL OR (run.mode = 'apply' AND run.status = 'succeeded'))
       AND ($2::bigint[] IS NULL OR r.run_id = ANY($2::bigint[]))
     ORDER BY r.entity, r.run_id DESC`,
    [source, runIds === undefined ? null : [...runIds]],
  )
  return res.rows
}

/** Rows of `table` with `legacy_source = source`; null when the table or its legacy column does not exist. */
async function legacyCount(pool: pg.Pool, table: string, source: LegacySource): Promise<number | null> {
  const has = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = 'legacy_source'`,
    [table],
  )
  if (has.rowCount === 0) return null
  const res = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${quoteIdent(table)} WHERE legacy_source = $1`, [source])
  return Number(res.rows[0]?.n ?? 0)
}

/** Rows of `etl_id_map` for the entity (the count of a derived table that has no legacy columns). */
async function idMapCount(pool: pg.Pool, entity: string, source: LegacySource): Promise<number> {
  const res = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM etl_id_map WHERE legacy_source = $1 AND entity = $2`, [source, entity])
  return Number(res.rows[0]?.n ?? 0)
}

/** Rows of a `staging_cloud` table now; null when the schema or table is not there (nothing to compare). */
async function stagingCount(pool: pg.Pool, table: string): Promise<number | null> {
  const name = `${quoteIdent(STAGING_SCHEMA)}.${quoteIdent(table)}`
  const has = await pool.query<{ ok: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS ok`, [name])
  if (has.rows[0]?.ok !== true) return null
  const res = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${name}`)
  return Number(res.rows[0]?.n ?? 0)
}

async function entityCheck(
  pool: pg.Pool,
  source: LegacySource,
  entry: MatrixEntry,
  recon: ReconRow | undefined,
  deleted: DeletedAtSource | null,
): Promise<EntityCheck> {
  const base = {
    entity: entry.entity,
    stagingTable: entry.stagingTable,
    targetTable: entry.targetTable,
    ...(entry.note ? { note: entry.note } : {}),
  }
  if (recon === undefined) {
    return {
      ...base,
      sourceCount: 0,
      eligibleCount: 0,
      loaded: 0,
      rejected: 0,
      expectedDelta: 0,
      targetCount: null,
      status: 'not-run',
      note: [entry.note, entry.required ? 'required: no succeeded apply run recorded' : 'no succeeded apply run recorded'].filter(Boolean).join('; '),
    }
  }
  const problems: string[] = []
  if (entry.plainRead && entry.stagingTable !== null) {
    const live = await stagingCount(pool, entry.stagingTable)
    if (live !== null && live !== recon.source_count) {
      problems.push(`staging changed since the run (the run read ${recon.source_count} rows, ${entry.stagingTable} holds ${live} now)`)
    }
  }
  if (recon.status !== 'ok') problems.push('reconciliation row is not ok (eligible - loaded - rejected differs from expected_delta)')

  let targetCount: number | null = null
  if (entry.count === 'legacy') {
    targetCount = await legacyCount(pool, entry.targetTable, source)
    if (targetCount === null) problems.push(`target table ${entry.targetTable} has no legacy_source column`)
    // A step upserts by (legacy_source, legacy_id): every loaded row is exactly one target row. The delta never deletes, so
    // the rows whose source row is gone are extra, and reported apart (`deleted_at_source:<entity>`).
    else if (targetCount - (deleted?.count ?? 0) !== recon.loaded) {
      problems.push(
        deleted && deleted.count > 0
          ? `target holds ${targetCount} rows of this source (${deleted.count} deleted at the source), the run loaded ${recon.loaded}`
          : `target holds ${targetCount} rows of this source, the run loaded ${recon.loaded}`,
      )
    }
  } else if (entry.count === 'idmap') {
    targetCount = await idMapCount(pool, entry.entity, source)
    if (targetCount !== recon.loaded) problems.push(`etl_id_map holds ${targetCount} ids, the run loaded ${recon.loaded}`)
  } else if (recon.loaded !== 0) {
    problems.push(`a report-only step loaded ${recon.loaded} rows`)
  }
  const notes = [entry.note, ...problems].filter(Boolean)
  return {
    ...base,
    sourceCount: recon.source_count,
    eligibleCount: recon.eligible_count,
    loaded: recon.loaded,
    rejected: recon.rejected,
    expectedDelta: recon.expected_delta,
    targetCount,
    ...(deleted ? { deletedAtSource: deleted.count } : {}),
    status: problems.length === 0 ? 'ok' : 'mismatch',
    ...(notes.length > 0 ? { note: notes.join('; ') } : {}),
  }
}

/** Proposed defaults of the deleted-at-source ceiling; the LEAD confirms them in MIG-08 section 8 item 4. */
export const DEFAULT_MAX_DELETED_RATIO = 0.05
export const DEFAULT_MAX_DELETED_ROWS = 100

export async function runVerify(options: VerifyOptions): Promise<VerifyReport> {
  const { pool, source } = options
  assertLegacySource(source)
  try {
    const recon = await latestRecon(pool, source, options.runIds)
    const byEntity = new Map(recon.map((r) => [r.entity, r]))

    const entities: EntityCheck[] = []
    const deletedIds: Record<string, string[]> = {}
    const extra: StatCheck[] = []
    for (const entry of ENTITY_MATRIX) {
      const recon1 = byEntity.get(entry.entity)
      // Only an entity that ran has a loaded count to compare; the others keep their own status.
      const deleted = recon1 ? await deletedAtSource(pool, source, entry) : null
      entities.push(await entityCheck(pool, source, entry, recon1, deleted))
      if (deleted && deleted.count > 0) {
        const target = entities[entities.length - 1]?.targetCount ?? 0
        const maxRatio = options.maxDeletedRatio ?? DEFAULT_MAX_DELETED_RATIO
        const maxRows = options.maxDeletedRows ?? DEFAULT_MAX_DELETED_ROWS
        if (deleted.count > maxRows && deleted.count > maxRatio * target) {
          extra.push({
            name: `deleted_at_source_ratio:${entry.entity}`,
            kind: 'counts',
            expected: `<= ${Math.max(maxRows, Math.floor(maxRatio * target))}`,
            actual: deleted.count,
            status: 'mismatch',
            detail: `more than ${maxRatio * 100}% of the ${target} target rows and more than ${maxRows} rows have no source row now: check that the re-staged dump is complete (proposed ceiling; the LEAD confirms it in MIG-08 section 8 item 4)`,
          })
        }
        deletedIds[entry.entity] = deleted.ids
        extra.push({
          name: `deleted_at_source:${entry.entity}`,
          kind: 'counts',
          expected: 0,
          actual: deleted.count,
          status: 'reported',
          detail:
            'rows in v2 whose source row no longer exists; not propagated by the delta; listed for the LEAD (MIG-08 go/no-go)',
        })
      }
    }
    // An entity that ran but is not in the matrix cannot be verified: a gap in this file, so it fails the gate.
    for (const r of recon) {
      if (matrixEntry(r.entity)) continue
      entities.push({
        entity: r.entity,
        stagingTable: null,
        targetTable: '(not in the entity matrix)',
        sourceCount: r.source_count,
        eligibleCount: r.eligible_count,
        loaded: r.loaded,
        rejected: r.rejected,
        expectedDelta: r.expected_delta,
        targetCount: null,
        status: 'mismatch',
        note: 'no row in verify/entities.ts: add the entity to the matrix',
      })
    }

    const checks = [...(await runChecks({ pool, source, entities })), ...extra]

    const used = [...new Set(recon.map((r) => r.run_id))].sort((a, b) => Number(a) - Number(b))
    const runIds = used.length > 0 ? used : [...(options.runIds ?? [])]
    const required = new Map(ENTITY_MATRIX.map((m) => [m.entity, m.required]))
    const entitiesPass = entities.every((e) => e.status === 'ok' || (e.status === 'not-run' && required.get(e.entity) !== true))
    const checksPass = checks.every((c) => c.status !== 'mismatch')
    return {
      generatedAt: (options.now ?? new Date()).toISOString(),
      source,
      runIds,
      status: entitiesPass && checksPass ? 'pass' : 'fail',
      entities,
      checks,
      ...(Object.keys(deletedIds).length > 0 ? { deletedAtSourceIds: deletedIds } : {}),
    }
  } catch (err) {
    throw sanitizeDbError(err)
  }
}
