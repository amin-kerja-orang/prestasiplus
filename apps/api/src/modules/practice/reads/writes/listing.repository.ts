import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../../db/ids'
import { Prisma } from '../../../../db/generated/client'
import { PrismaService } from '../../../../db/prisma.service'

/**
 * A usable scheme (`markable`): the version has at least one leaf part and every leaf has an answer key with content
 * (a non-empty accepted list, points or model text, a correct option; mapping and rubric keys count when present).
 */
const SCHEME_USABLE = Prisma.sql`(
  EXISTS (SELECT 1 FROM question_parts p WHERE p.question_version_id = v.id AND p.mode IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM question_parts p WHERE p.question_version_id = v.id AND p.mode IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM answer_keys k WHERE k.part_id = p.id AND (
          k.kind IN ('mapping', 'rubric')
          OR (k.kind = 'accepted' AND jsonb_typeof(k.content -> 'values') = 'array' AND jsonb_array_length(k.content -> 'values') > 0)
          OR (k.kind = 'points' AND ((jsonb_typeof(k.content -> 'points') = 'array' AND jsonb_array_length(k.content -> 'points') > 0) OR COALESCE(k.content ->> 'modelText', '') <> ''))
          OR (k.kind = 'option' AND COALESCE(k.content ->> 'correct', '') <> '')))))`

export interface ListingQuery {
  /** Education level ids a student may see (T4, T5), decimal strings. */
  levelIds: readonly string[]
  /** Restrict to these subjects (decimal strings); null = every subject. */
  subjectIds: readonly string[] | null
  /** 1..6, compared with the clamped cognitive level; null = any. */
  kbat: number | null
  /** Order by the position of the subject in `subjectIds` first (Tracking A Bahasa), then newest. */
  subjectOrder: boolean
  /** Case-insensitive text match on the stem or a linked stimulus body; null = no search (already trimmed, max 100). */
  q: string | null
  /** true = only sets whose every leaf part has an answer key (a usable scheme). */
  markable: boolean
  limit: number
  offset: number
}

/**
 * Id page of the student structured list: live version published, set active, type structured, level T4/T5.
 * One parameterised query for the page and one for the total; the caller hydrates only the page ids
 * through `QuestionsRepository`. Newest published first (published_at, else created), then id asc.
 */
@Injectable()
export class StructuredListingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async page(q: ListingQuery): Promise<{ ids: string[]; total: number; pendingScheme: number }> {
    if (q.levelIds.length === 0 || (q.subjectIds !== null && q.subjectIds.length === 0)) return { ids: [], total: 0, pendingScheme: 0 }
    const db = this.prisma.client
    const levels = q.levelIds.map(idFromString)
    const subjects = q.subjectIds === null ? null : q.subjectIds.map(idFromString)
    // LIKE wildcards in the pupil's text are literal.
    const like = q.q === null ? null : `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    const order = q.subjectOrder && subjects !== null ? subjects : []
    const [rows, totals] = await Promise.all([
      db.$queryRaw<{ id: bigint }[]>`
        SELECT q.id FROM questions q
        JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
        WHERE q.is_active AND v.status = 'approved' AND v.type = 'structured'
          AND v.education_level_id = ANY(${levels}::bigint[])
          AND (${subjects}::bigint[] IS NULL OR v.subject_id = ANY(${subjects}::bigint[]))
          AND (${q.kbat}::int IS NULL OR LEAST(6, GREATEST(1, COALESCE(v.cognitive_level, 1))) = ${q.kbat}::int)
          AND (${like}::text IS NULL OR v.stem_ms ILIKE ${like}::text OR EXISTS (
                SELECT 1 FROM question_version_stimuli qs JOIN stimuli st ON st.id = qs.stimulus_id
                WHERE qs.question_version_id = v.id AND (st.body_ms ILIKE ${like}::text OR st.label ILIKE ${like}::text)))
          AND (NOT ${q.markable}::boolean OR ${SCHEME_USABLE})
        ORDER BY (CASE WHEN cardinality(${order}::bigint[]) > 0 THEN array_position(${order}::bigint[], v.subject_id) END) ASC NULLS FIRST,
                 COALESCE(v.published_at, q.created_at) DESC, q.id ASC
        LIMIT ${q.limit} OFFSET ${q.offset}`,
      db.$queryRaw<{ n: number; pending: number }[]>`
        SELECT count(*) FILTER (WHERE NOT ${q.markable}::boolean OR ok)::int AS n,
               count(*) FILTER (WHERE NOT ok)::int AS pending
        FROM (
          SELECT ${SCHEME_USABLE} AS ok
          FROM questions q
          JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
          WHERE q.is_active AND v.status = 'approved' AND v.type = 'structured'
            AND v.education_level_id = ANY(${levels}::bigint[])
            AND (${subjects}::bigint[] IS NULL OR v.subject_id = ANY(${subjects}::bigint[]))
            AND (${q.kbat}::int IS NULL OR LEAST(6, GREATEST(1, COALESCE(v.cognitive_level, 1))) = ${q.kbat}::int)
            AND (${like}::text IS NULL OR v.stem_ms ILIKE ${like}::text OR EXISTS (
                  SELECT 1 FROM question_version_stimuli qs JOIN stimuli st ON st.id = qs.stimulus_id
                  WHERE qs.question_version_id = v.id AND (st.body_ms ILIKE ${like}::text OR st.label ILIKE ${like}::text)))
        ) t`,
    ])
    return { ids: rows.map((r) => idToString(r.id)), total: totals[0]?.n ?? 0, pendingScheme: totals[0]?.pending ?? 0 }
  }
}
