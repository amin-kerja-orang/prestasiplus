/**
 * The ONE definition of "this paper is migration-owned and unedited" (KP-14). Shared by `BuilderService.publishLegacyV2` and the migration's papers recompute
 * (`migration/load/papers/papers-recompute.ts`): nothing an admin touched is ever changed by the migration. A plain function over a database handle, no Nest DI.
 *
 * A paper counts only when ALL hold:
 *  - an `etl_id_map` entry of entity `exam_papers` points at it (the migration created it);
 *  - it is `draft` or `published`, `version = 1` (a withdraw and re-publish raises it), and has no admin-added Bahagian;
 *  - its audit trail (`audit_events`, target `bijak_paper`) holds nothing but the Terbit of the migration pass (`bijak.paper.published` /
 *    `bijak.paper.published_override` with NO request id: the pass calls the service in-process; a Studio call always carries one);
 *  - a PUBLISHED paper also has `updated_at = published_at` (every later edit bumps `updated_at`). A DRAFT is not held to this: `publishLegacyV2`
 *    runs on a draft before its first Terbit, so a draft with no Terbit rows at all is owned.
 */
import { Prisma } from '../../../db/generated/client'

export interface OwnershipDb {
  $queryRaw<T = unknown>(query: Prisma.Sql): Prisma.PrismaPromise<T>
}

export async function isMigrationOwnedUneditedPaper(db: OwnershipDb, paperId: string): Promise<{ owned: boolean; reason?: string }> {
  if (!/^\d+$/.test(paperId)) return { owned: false, reason: 'not_found' }
  const rows = await db.$queryRaw<{ status: string; version: number; stamped: boolean; mapped: boolean; admin_sections: number; foreign_events: number }[]>(Prisma.sql`
    SELECT p.status, p.version, (p.updated_at = p.published_at) AS stamped,
           EXISTS (SELECT 1 FROM etl_id_map m WHERE m.entity = 'exam_papers' AND m.new_id = p.id::text) AS mapped,
           (SELECT count(*) FROM paper_sections s WHERE s.paper_id = p.id AND s.admin_created)::int AS admin_sections,
           (SELECT count(*) FROM audit_events a WHERE a.target_type = 'bijak_paper' AND a.target_id = p.id::text
               AND NOT (a.action IN ('bijak.paper.published', 'bijak.paper.published_override') AND a.request_id IS NULL))::int AS foreign_events
      FROM papers p WHERE p.id = ${paperId}::bigint AND p.kind = 'pilihan'`)
  const h = rows[0]
  if (h === undefined) return { owned: false, reason: 'not_found' }
  if (!h.mapped) return { owned: false, reason: 'no_etl_id_map_entry' }
  const published = h.status === 'published'
  if (h.status !== 'draft' && !published) return { owned: false, reason: 'status_not_draft_or_published' }
  if (h.version !== 1) return { owned: false, reason: 'version_not_1' }
  if (h.admin_sections > 0) return { owned: false, reason: 'admin_added_bahagian' }
  if (h.foreign_events > 0) return { owned: false, reason: 'edited_audit_events' }
  if (published && !h.stamped) return { owned: false, reason: 'updated_after_publish' }
  return { owned: true }
}
