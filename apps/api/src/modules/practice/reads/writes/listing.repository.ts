import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { ALL_LEAVES_KEYED_SQL, BANK_VISIBLE_SQL, MEDIA_RESOLVED_SQL, NOT_FLAGGED_SQL } from '../../../questions/learner-visibility'

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
  /** true = only sets whose every leaf part has an answer key (`ALL_LEAVES_KEYED_SQL`, the one rule of S1). */
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
        WHERE q.is_active AND v.status = 'approved' AND v.type = 'structured' AND ${BANK_VISIBLE_SQL} AND ${NOT_FLAGGED_SQL} AND ${MEDIA_RESOLVED_SQL}
          AND v.education_level_id = ANY(${levels}::bigint[])
          AND (${subjects}::bigint[] IS NULL OR v.subject_id = ANY(${subjects}::bigint[]))
          AND (${q.kbat}::int IS NULL OR LEAST(6, GREATEST(1, COALESCE(v.cognitive_level, 1))) = ${q.kbat}::int)
          AND (${like}::text IS NULL OR v.stem_ms ILIKE ${like}::text OR EXISTS (
                SELECT 1 FROM question_version_stimuli qs JOIN stimuli st ON st.id = qs.stimulus_id
                WHERE qs.question_version_id = v.id AND (st.body_ms ILIKE ${like}::text OR st.label ILIKE ${like}::text)))
          AND (NOT ${q.markable}::boolean OR ${ALL_LEAVES_KEYED_SQL})
        ORDER BY (CASE WHEN cardinality(${order}::bigint[]) > 0 THEN array_position(${order}::bigint[], v.subject_id) END) ASC NULLS FIRST,
                 COALESCE(v.published_at, q.created_at) DESC, q.id ASC
        LIMIT ${q.limit} OFFSET ${q.offset}`,
      db.$queryRaw<{ n: number; pending: number }[]>`
        SELECT count(*) FILTER (WHERE NOT ${q.markable}::boolean OR ok)::int AS n,
               count(*) FILTER (WHERE NOT ok)::int AS pending
        FROM (
          SELECT ${ALL_LEAVES_KEYED_SQL} AS ok
          FROM questions q
          JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
          WHERE q.is_active AND v.status = 'approved' AND v.type = 'structured' AND ${BANK_VISIBLE_SQL} AND ${NOT_FLAGGED_SQL} AND ${MEDIA_RESOLVED_SQL}
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

  /**
   * Card facts of sets the question bank cannot hydrate (a present but invalid stored key): read from the rows, no key parsing.
   * The live version only; `subs` are the parts in depth-first order with their marks (null on a branch).
   */
  async degraded(ids: readonly string[]): Promise<DegradedSet[]> {
    if (ids.length === 0) return []
    const db = this.prisma.client
    const sets = await db.$queryRaw<{ id: bigint; version_id: bigint; created_by_id: bigint | null; stem_ms: string | null; subject_id: bigint | null; cognitive_level: number | null; education_level_id: bigint | null }[]>`
      SELECT q.id, v.id AS version_id, q.created_by_id, v.stem_ms, v.subject_id, v.cognitive_level, v.education_level_id
      FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
      WHERE q.id = ANY(${ids.map(idFromString)}::bigint[])`
    const parts = await db.$queryRaw<{ version_id: bigint; top: boolean; marks: number | null; mode: string | null; prompt_ms: string }[]>`
      SELECT p.question_version_id AS version_id, (p.parent_part_id IS NULL) AS top, p.marks, p.mode, p.prompt_ms FROM question_parts p
      WHERE p.question_version_id = ANY(${sets.map((r) => r.version_id)}::bigint[]) ORDER BY p.depth, p.position, p.id`
    return sets.map((r) => {
      const mine = parts.filter((p) => p.version_id === r.version_id)
      return {
        id: idToString(r.id),
        createdById: r.created_by_id === null ? null : idToString(r.created_by_id),
        stemMs: r.stem_ms,
        firstPrompt: mine[0]?.prompt_ms ?? '',
        subjectId: r.subject_id === null ? null : idToString(r.subject_id),
        cognitiveLevel: r.cognitive_level,
        educationLevelId: r.education_level_id === null ? null : idToString(r.education_level_id),
        subs: mine.map((p) => ({ top: p.top, marks: p.mode === null ? 0 : (p.marks ?? 0) })),
      }
    })
  }
}

export interface DegradedSet {
  id: string
  createdById: string | null
  stemMs: string | null
  firstPrompt: string
  subjectId: string | null
  cognitiveLevel: number | null
  educationLevelId: string | null
  subs: { top: boolean; marks: number }[]
}
