import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'

export interface ListingQuery {
  /** Education level ids a student may see (T4, T5), decimal strings. */
  levelIds: readonly string[]
  /** Restrict to these subjects (decimal strings); null = every subject. */
  subjectIds: readonly string[] | null
  /** 1..6, compared with the clamped cognitive level; null = any. */
  kbat: number | null
  /** Order by the position of the subject in `subjectIds` first (Tracking A Bahasa), then newest. */
  subjectOrder: boolean
  limit: number
  offset: number
}

/**
 * Id page of the student structured list: live version published, set active, type structured, level T4/T5.
 * One parameterised query for the page and one for the total; the caller hydrates only the page ids
 * through `QuestionsRepository`. Newest first (created desc), then id asc.
 */
@Injectable()
export class StructuredListingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async page(q: ListingQuery): Promise<{ ids: string[]; total: number }> {
    if (q.levelIds.length === 0 || (q.subjectIds !== null && q.subjectIds.length === 0)) return { ids: [], total: 0 }
    const db = this.prisma.client
    const levels = q.levelIds.map(idFromString)
    const subjects = q.subjectIds === null ? null : q.subjectIds.map(idFromString)
    const order = q.subjectOrder && subjects !== null ? subjects : []
    const [rows, totals] = await Promise.all([
      db.$queryRaw<{ id: bigint }[]>`
        SELECT q.id FROM questions q
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
        WHERE q.is_active AND v.status = 'approved' AND v.type = 'structured'
          AND v.education_level_id = ANY(${levels}::bigint[])
          AND (${subjects}::bigint[] IS NULL OR v.subject_id = ANY(${subjects}::bigint[]))
          AND (${q.kbat}::int IS NULL OR LEAST(6, GREATEST(1, COALESCE(v.cognitive_level, 1))) = ${q.kbat}::int)
        ORDER BY (CASE WHEN cardinality(${order}::bigint[]) > 0 THEN array_position(${order}::bigint[], v.subject_id) END) ASC NULLS FIRST,
                 q.created_at DESC, q.id ASC
        LIMIT ${q.limit} OFFSET ${q.offset}`,
      db.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM questions q
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
        WHERE q.is_active AND v.status = 'approved' AND v.type = 'structured'
          AND v.education_level_id = ANY(${levels}::bigint[])
          AND (${subjects}::bigint[] IS NULL OR v.subject_id = ANY(${subjects}::bigint[]))
          AND (${q.kbat}::int IS NULL OR LEAST(6, GREATEST(1, COALESCE(v.cognitive_level, 1))) = ${q.kbat}::int)`,
    ])
    return { ids: rows.map((r) => idToString(r.id)), total: totals[0]?.n ?? 0 }
  }
}
