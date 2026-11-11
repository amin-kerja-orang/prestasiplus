/**
 * The ONE definition of "this paper is migration-owned and unedited" (KP-14). Used by `BuilderService.publishLegacyV2`; the migration's papers recompute
 * (`migration/load/papers/papers-recompute.ts`) keeps its own copy of the same rule for now and is meant to switch to this helper: nothing an admin touched is
 * ever changed by the migration.
 *
 * Importable WITHOUT Nest: the only import is the plain `AUDIT_ACTIONS` constant table. Deep import path for the migration:
 * `apps/api/src/modules/exam/builder/migration-ownership` (not the `exam/builder` index, which pulls the Nest services).
 *
 * The rule is ONE SQL constant (`MIGRATION_OWNERSHIP_SQL`), run through a minimal executor `(sql, params) => rows`, so a Prisma client (`prismaExecutor`)
 * and a `pg` client (`pgExecutor`) use exactly the same statement.
 *
 * A paper counts only when ALL hold:
 *  - an `etl_id_map` entry of entity `exam_papers` points at it (the migration created it). The migration is single-source ('cloud'); pass
 *    `legacySource` to require that source explicitly, else any source matches;
 *  - it is `draft` or `published`, `version = 1` (a withdraw and re-publish raises it), and has no admin-added Bahagian;
 *  - its audit trail (`audit_events`, target `bijak_paper`) holds nothing but the Terbit of the migration pass (`bijak.paper.published` /
 *    `bijak.paper.published_override` with NO request id: the pass calls the service in-process; a Studio call always carries one);
 *  - a PUBLISHED paper also has `updated_at = published_at` (every later edit bumps `updated_at`). A DRAFT is not held to this: `publishLegacyV2`
 *    runs on a draft before its first Terbit, so a draft with no Terbit rows at all is owned.
 */
import { AUDIT_ACTIONS } from '../../../common/audit/audit-actions'

/** A minimal SQL executor: positional `$1..` parameters, rows back. */
export type SqlExecutor = (sql: string, params: unknown[]) => Promise<readonly Record<string, unknown>[]>

/** The slice of a Prisma client (or transaction client) `prismaExecutor` needs. */
export interface OwnershipDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>
}

/** The slice of a `pg` client / pool client `pgExecutor` needs. */
export interface PgLike {
  query(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
}

export const prismaExecutor =
  (db: OwnershipDb): SqlExecutor =>
  (sql, params) =>
    db.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params)

export const pgExecutor =
  (client: PgLike): SqlExecutor =>
  async (sql, params) =>
    (await client.query(sql, params)).rows

export type OwnershipReason =
  | 'not_found'
  | 'no_etl_id_map_entry'
  | 'status_not_draft_or_published'
  | 'version_not_1'
  | 'admin_added_bahagian'
  | 'edited_audit_events'
  | 'updated_after_publish'

/** $1 = paper id, $2 = legacy source or null (any). The audit actions are the registry constants, never literals. */
export const MIGRATION_OWNERSHIP_SQL = `
  SELECT p.status, p.version, (p.updated_at = p.published_at) AS stamped,
         EXISTS (SELECT 1 FROM etl_id_map m WHERE m.entity = 'exam_papers' AND m.new_id = p.id::text AND ($2::text IS NULL OR m.legacy_source = $2::text)) AS mapped,
         (SELECT count(*) FROM paper_sections s WHERE s.paper_id = p.id AND s.admin_created)::int AS admin_sections,
         (SELECT count(*) FROM audit_events a WHERE a.target_type = 'bijak_paper' AND a.target_id = p.id::text
             AND NOT (a.action IN ('${AUDIT_ACTIONS.BIJAK_PAPER_PUBLISHED}', '${AUDIT_ACTIONS.BIJAK_PAPER_PUBLISHED_OVERRIDE}') AND a.request_id IS NULL))::int AS foreign_events
    FROM papers p WHERE p.id = $1::bigint AND p.kind = 'pilihan'`

export async function isMigrationOwnedUneditedPaper(
  db: SqlExecutor | OwnershipDb,
  paperId: string,
  opts: { legacySource?: string } = {},
): Promise<{ owned: boolean; reason?: OwnershipReason }> {
  if (!/^\d+$/.test(paperId)) return { owned: false, reason: 'not_found' }
  const exec = typeof db === 'function' ? db : prismaExecutor(db)
  const rows = await exec(MIGRATION_OWNERSHIP_SQL, [paperId, opts.legacySource ?? null])
  const h = rows[0] as { status: string; version: number; stamped: boolean; mapped: boolean; admin_sections: number; foreign_events: number } | undefined
  if (h === undefined) return { owned: false, reason: 'not_found' }
  if (!h.mapped) return { owned: false, reason: 'no_etl_id_map_entry' }
  const published = h.status === 'published'
  if (h.status !== 'draft' && !published) return { owned: false, reason: 'status_not_draft_or_published' }
  if (Number(h.version) !== 1) return { owned: false, reason: 'version_not_1' }
  if (Number(h.admin_sections) > 0) return { owned: false, reason: 'admin_added_bahagian' }
  if (Number(h.foreign_events) > 0) return { owned: false, reason: 'edited_audit_events' }
  if (published && !h.stamped) return { owned: false, reason: 'updated_after_publish' }
  return { owned: true }
}
