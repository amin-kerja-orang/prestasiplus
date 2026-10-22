/**
 * BE-30 rollback (card AC3): deletes every row loaded from ONE legacy source, so a rehearsal database returns to its
 * pre-migration row counts and the migration can be repeated.
 *
 * What is removed
 *  - every row with `legacy_source = <source>` from every table in `prisma/migratable-models.json` that exists, children
 *    before parents (the order is a topological sort of the foreign keys between those tables, read from `pg_catalog` at
 *    run time, see `fk-graph.ts`);
 *  - the rows the ETL wrote without a legacy pair (`ETL_DERIVED_CHILDREN`: `attempt_results`), which go with their
 *    parent through `ON DELETE CASCADE` and are counted before;
 *  - the `etl_id_map` rows of the source.
 * `etl_runs`, `etl_recon` and `etl_rejects` are KEPT: they are the audit trail of what was loaded and rolled back.
 * Re-applying after a rollback must start from scratch, so every unfinished apply run of the source (`status = 'failed'`,
 * the runs `RunLedger.findResumable` would continue) is closed: it stays `failed` (the status check allows only
 * running / succeeded / failed) but its `input_hash` gets the prefix `rolled-back:`, so no resume matches it, and its
 * `etl_checkpoints` are deleted (they point at batches that no longer exist). A succeeded dry-run of the same input stays valid: the next apply may reuse it.
 * Never touched: rows born in v2 (`legacy_source IS NULL`), `staging_cloud`, `archive_cloud` and the .cloud source.
 *
 * One transaction. `dryRun` does the same work and rolls it back, so the counts are exact. Before anything: the shared
 * apply guard (`PP_ALLOW_MIGRATE_APPLY=1`, and in production `PP_MIGRATE_TARGET_DB`), `PP_ALLOW_MIGRATE_ROLLBACK=1` (a
 * second, separate switch, also for a dry-run), `PP_MIGRATE_TARGET_DB = current_database()` in EVERY environment (not only in
 * production) and `confirmDb = current_database()`.
 * NEVER AFTER GO-LIVE WITHOUT A LEAD DECISION: once v2 users work on the migrated data, a rollback deletes their accounts
 * (it refuses while v2 rows depend on them, but that is a safety net, not a procedure).
 *
 * Rows other tables depend on ("pinned")
 *  A migrated row that a row outside the migration refers to (a v2-born row, or any table that is not an ETL table) is
 *  never deleted, because the delete would fail on a restrict key, null a column of v2 data, or CASCADE into v2 data.
 *   - In a table whose loader ADOPTS seed rows (`CLAIMABLE_TABLES`: levels, subjects, chapters, topics, geography, tiers,
 *     achievements, settings) such a row is almost certainly a seed row that received the legacy pair, so it is RELEASED:
 *     `legacy_source` / `legacy_id` are set to NULL and it stays (listed in `released`). A re-run adopts it again by its
 *     natural key. The values the ETL wrote into it (names, dates) are not restored; re-run the seeds to do that. An
 *     adopted row that nothing depends on cannot be told from one the ETL inserted and is deleted: re-run the seeds
 *     (idempotent) after a rollback in a seeded environment.
 *   - In any other table (users, practice rows, ...) the rollback REFUSES (`RollbackRefusedError`) and names the table and
 *     the referencing column, because v2 data now depends on migrated data. Nothing is changed.
 *  The check repeats until no new row is released (releasing a child can pin its parent).
 *
 * OPEN POINT (provenance gap): the ETL does not record which rows it ADOPTED, and `load/claim.ts` (BE-28) is outside this
 * card. A row is therefore "adopted and still used" (released) or "indistinguishable from an inserted row" (deleted). Every
 * delete in a claimable table adds a `warnings` entry telling the operator to re-run the seeds before comparing counts. The
 * fix is a claim marker written by `claimSeeded` (for example `etl_id_map` with an `adopted` flag); then rollback could
 * release exactly the adopted rows.
 *
 * Concurrency: the rollback holds two advisory locks for its transaction, `etl:rollback:<source>` (one rollback at a time)
 * and `etl:source:<source>` (the source-level lock), and refuses while an apply run of the source is marked `running`;
 * that check is made after both locks are held and again immediately before the first DELETE. OPEN POINT: the runner
 * (`kit/runner.ts`) does not take `etl:source:<source>`, so an apply that starts between the second check and the commit
 * is not blocked. Closing that needs the runner to take the lock (a kit change, outside this card); until then the
 * operator must not start a load while a rollback runs.
 *
 * Cycles: a foreign key inside a cycle (`users.created_by_id` references `users`) is cleared first (set to NULL on the rows
 * to delete) when the column is nullable; a NOT NULL one must be deferrable (`SET CONSTRAINTS ... DEFERRED`), else refuse.
 *
 * `coin_ledger` is append-only (trigger): a row may be deleted only when its user no longer exists. It is therefore not
 * deleted on its own: it leaves with its user, through the user's `ON DELETE CASCADE`, and the rollback verifies that
 * no migrated ledger row is left.
 */
import type pg from 'pg'

import { ApplyGuardError, assertApplyAllowed } from '../kit/apply-guard'
import { sanitizeDbError } from '../kit/errors'
import { quoteIdent } from '../kit/sql'
import { assertLegacySource } from '../kit/types'
import { CLAIMABLE_TABLES, ETL_DERIVED_CHILDREN } from './entities'
import {
  deleteOrder,
  existingLegacyTables,
  loadForeignKeys,
  notNullColumns,
  readMigratableList,
  type ForeignKey,
} from './fk-graph'
import type { RollbackOptions, RollbackReport } from './types'

/** The rollback would damage data that is not part of the migration; nothing was changed. */
export class RollbackRefusedError extends ApplyGuardError {
  constructor(message: string) {
    super(message)
    this.name = 'RollbackRefusedError'
  }
}

/** Tables that cannot be deleted row by row (append-only trigger); they leave with their user. */
const APPEND_ONLY_VIA_PARENT: ReadonlySet<string> = new Set(['coin_ledger'])

const MAX_RELEASE_ROUNDS = 50

const q = quoteIdent
const quoteConstraint = (name: string): string => `"${name.replace(/"/g, '""')}"`

/** Rows of `fk.parent` (migrated, source `$1`) that at least one row of `fk.child` outside the migration refers to. */
export function pinnedPredicate(fk: ForeignKey, childPredicate: string): string {
  const notNull = fk.childCols.map((c) => `c.${q(c)} IS NOT NULL`).join(' AND ')
  const match = fk.childCols.map((c, i) => `c.${q(c)} = p.${q(fk.parentCols[i] as string)}`).join(' AND ')
  return `p.legacy_source = $1 AND EXISTS (SELECT 1 FROM ${q(fk.child)} c WHERE ${childPredicate} AND ${notNull} AND ${match})`
}

interface Pinned {
  parent: string
  child: string
  columns: string
  rows: number
}

export async function rollbackLegacy(options: RollbackOptions): Promise<RollbackReport> {
  const { pool, env, source, confirmDb } = options
  const dryRun = options.dryRun ?? false
  assertLegacySource(source)
  await assertApplyAllowed(pool, env)
  if (env.PP_ALLOW_MIGRATE_ROLLBACK !== '1') {
    throw new RollbackRefusedError('Refusing rollback: set PP_ALLOW_MIGRATE_ROLLBACK=1 to allow it (never after go-live without a LEAD decision). Nothing was changed.')
  }
  const current = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db ?? ''
  // Stricter than the apply guard (which asks for it in production only): a rollback names its database in EVERY environment.
  if (env.PP_MIGRATE_TARGET_DB !== current) {
    throw new RollbackRefusedError(`Refusing rollback: PP_MIGRATE_TARGET_DB must equal the connected database name ("${current}") in every environment. Nothing was changed.`)
  }
  if (confirmDb !== current) {
    throw new ApplyGuardError(`Refusing rollback: the confirmed database name does not match the connected database "${current}". Nothing was changed.`)
  }

  const client = await pool.connect()
  let broken = false
  try {
    await client.query('BEGIN')
    // Fail fast instead of waiting behind a long transaction that holds a lock on a table we delete from.
    await client.query(`SET LOCAL lock_timeout = '30s'`)
    // One rollback per source at a time, and the source-level lock (see the header: the runner does not take it yet).
    for (const name of [`etl:rollback:${source}`, `etl:source:${source}`]) {
      const lock = await client.query<{ ok: boolean }>(`SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS ok`, [name])
      if (lock.rows[0]?.ok !== true) throw new RollbackRefusedError(`Refusing rollback: the lock "${name}" is held by another session. Nothing was changed.`)
    }
    await assertNoRunningApply(client, source)
    const report = await run(client, source, current, dryRun)
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT')
    return report
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {
      broken = true
    })
    throw err instanceof RollbackRefusedError || err instanceof ApplyGuardError ? err : sanitizeDbError(err)
  } finally {
    client.release(broken ? true : undefined)
  }
}

/** A load that is still running would write rows while they are deleted. */
async function assertNoRunningApply(db: pg.PoolClient, source: string): Promise<void> {
  const running = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM etl_runs WHERE mode = 'apply' AND status = 'running' AND $1 = ANY(sources)`,
    [source],
  )
  if ((running.rows[0]?.n ?? 0) > 0) {
    throw new RollbackRefusedError(
      `Refusing rollback: ${running.rows[0]?.n} apply run(s) of source "${source}" are marked running. Wait for them to finish; if one crashed, mark it failed in etl_runs first. Nothing was changed.`,
    )
  }
}

async function run(db: pg.PoolClient, source: string, database: string, dryRun: boolean): Promise<RollbackReport> {
  const tables = await existingLegacyTables(db, readMigratableList())
  const inSet = new Set(tables)
  const fks = await loadForeignKeys(db)
  const hasHash = new Set(
    (
      await db.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'legacy_hash' AND table_name = ANY($1::text[])`,
        [tables],
      )
    ).rows.map((r) => r.table_name),
  )
  const derived = new Map(ETL_DERIVED_CHILDREN.map((d) => [d.table, d.parent]))

  // ---- 1. pinned rows: release the adopted ones, refuse for the rest
  const released = new Map<string, number>()
  let blockers: Pinned[] = []
  for (let round = 0; ; round++) {
    if (round >= MAX_RELEASE_ROUNDS) throw new RollbackRefusedError('Refusing rollback: the release of adopted rows did not settle.')
    let releasedNow = 0
    blockers = []
    for (const fk of fks) {
      if (!inSet.has(fk.parent)) continue
      // A child row that is part of this migration will be deleted first, so it does not pin its parent.
      if (derived.get(fk.child) === fk.parent) continue
      const childPredicate = inSet.has(fk.child) ? 'c.legacy_source IS DISTINCT FROM $1' : 'true'
      const where = pinnedPredicate(fk, childPredicate)
      if (CLAIMABLE_TABLES.includes(fk.parent)) {
        const res = await db.query(
          `UPDATE ${q(fk.parent)} p SET legacy_source = NULL, legacy_id = NULL${hasHash.has(fk.parent) ? ', legacy_hash = NULL' : ''} WHERE ${where}`,
          [source],
        )
        const n = res.rowCount ?? 0
        if (n > 0) {
          released.set(fk.parent, (released.get(fk.parent) ?? 0) + n)
          releasedNow += n
        }
      } else {
        const res = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${q(fk.parent)} p WHERE ${where}`, [source])
        const n = res.rows[0]?.n ?? 0
        if (n > 0) blockers.push({ parent: fk.parent, child: fk.child, columns: fk.childCols.join('+'), rows: n })
      }
    }
    if (releasedNow === 0) break
  }
  if (blockers.length > 0) {
    const lines = blockers.map((b) => `${b.parent}: ${b.rows} row(s) referenced by ${b.child}.${b.columns}`)
    throw new RollbackRefusedError(
      `Refusing rollback: migrated rows are referenced by data that is not part of the migration (${lines.join('; ')}). ` +
        'Remove or re-point that data first. Nothing was changed.',
    )
  }

  // ---- 2. derived rows that cascade with their parent (counted for the report)
  const derivedRows: { table: string; parent: string; rows: number }[] = []
  for (const [table, parent] of derived) {
    if (!inSet.has(parent)) continue
    const fk = fks.find((f) => f.child === table && f.parent === parent)
    if (!fk) continue
    const match = fk.childCols.map((c, i) => `c.${q(c)} = p.${q(fk.parentCols[i] as string)}`).join(' AND ')
    const res = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${q(table)} c WHERE EXISTS (SELECT 1 FROM ${q(parent)} p WHERE p.legacy_source = $1 AND ${match})`,
      [source],
    )
    const n = res.rows[0]?.n ?? 0
    derivedRows.push({ table, parent, rows: n })
  }

  // ---- 3. cycles: clear the references inside a cycle on the rows to delete
  const { order, cyclic } = deleteOrder(tables, fks)
  for (const fk of cyclic) {
    const required = await notNullColumns(db, fk.child)
    if (fk.childCols.every((c) => !required.has(c))) {
      const set = fk.childCols.map((c) => `${q(c)} = NULL`).join(', ')
      const any = fk.childCols.map((c) => `${q(c)} IS NOT NULL`).join(' OR ')
      await db.query(`UPDATE ${q(fk.child)} SET ${set} WHERE legacy_source = $1 AND (${any})`, [source])
    } else if (fk.deferrable) {
      await db.query(`SET CONSTRAINTS ${quoteConstraint(fk.name)} DEFERRED`)
    } else {
      throw new RollbackRefusedError(
        `Refusing rollback: ${fk.child}.${fk.childCols.join('+')} is part of a reference cycle, is NOT NULL and not deferrable. Nothing was changed.`,
      )
    }
  }

  // ---- 4. delete, children first (last look at the running loads, just before the first DELETE)
  await assertNoRunningApply(db, source)
  const out: RollbackReport['tables'] = []
  const viaParent = new Map<string, number>()
  for (const table of order) {
    for (const d of derivedRows) if (d.parent === table) out.push({ table: d.table, deleted: d.rows })
    if (APPEND_ONLY_VIA_PARENT.has(table)) {
      const n = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${q(table)} WHERE legacy_source = $1`, [source])
      viaParent.set(table, n.rows[0]?.n ?? 0)
      out.push({ table, deleted: n.rows[0]?.n ?? 0 })
      continue
    }
    const res = await db.query(`DELETE FROM ${q(table)} WHERE legacy_source = $1`, [source])
    out.push({ table, deleted: res.rowCount ?? 0 })
  }
  for (const table of viaParent.keys()) {
    const left = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${q(table)} WHERE legacy_source = $1`, [source])
    if ((left.rows[0]?.n ?? 0) > 0) {
      throw new RollbackRefusedError(
        `Refusing rollback: ${left.rows[0]?.n} migrated ${table} row(s) remain after their users were deleted (append-only table). Nothing was changed.`,
      )
    }
  }

  // ---- 5. the id map of the source (the audit tables etl_runs / etl_recon / etl_rejects / etl_checkpoints stay)
  const idMap = await db.query(`DELETE FROM etl_id_map WHERE legacy_source = $1`, [source])

  // Close the runs a resume would continue, so the next apply starts from scratch (see the header).
  const closed = await db.query<{ id: string }>(
    `UPDATE etl_runs SET input_hash = 'rolled-back:' || coalesce(input_hash, '')
     WHERE mode = 'apply' AND status = 'failed' AND sources = ARRAY[$1]::text[] AND coalesce(input_hash, '') NOT LIKE 'rolled-back:%'
     RETURNING id`,
    [source],
  )
  if (closed.rows.length > 0) await db.query(`DELETE FROM etl_checkpoints WHERE run_id = ANY($1::bigint[])`, [closed.rows.map((r) => r.id)])
  const warnings: string[] = []
  // Only runs of this source alone are closed; a run that covers more sources also holds rows of the others.
  const multi = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM etl_runs WHERE mode = 'apply' AND status = 'failed' AND $1 = ANY(sources) AND sources <> ARRAY[$1]::text[]
       AND coalesce(input_hash, '') NOT LIKE 'rolled-back:%'`,
    [source],
  )
  if ((multi.rows[0]?.n ?? 0) > 0) {
    warnings.push(`${multi.rows[0]?.n} failed apply run(s) cover more than this source and were left open; a resume of one of them would skip batches that were rolled back`)
  }

  // An adopted seed row nobody uses is deleted with the rest (see the header): say so for every claimable table.
  for (const t of out) {
    if (CLAIMABLE_TABLES.includes(t.table) && t.deleted > 0) {
      warnings.push(
        `${t.table}: ${t.deleted} rows deleted may include adopted seed rows; re-run the idempotent seeds (npm run be:db:seed) before comparing counts`,
      )
    }
  }

  return {
    database,
    dryRun,
    tables: out,
    idMapDeleted: idMap.rowCount ?? 0,
    status: 'succeeded',
    ...(released.size > 0 ? { released: [...released].map(([table, rows]) => ({ table, rows })).sort((a, b) => (a.table < b.table ? -1 : 1)) } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
  }
}
