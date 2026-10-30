import { Prisma } from '../../db/generated/client'

/**
 * SQL predicates (aliases `q` = questions, `v` = the question version) that decide what a learner may be served. One definition
 * for the question reads (`QuestionsRepository.scope` with `learnerVisible`) and for the file read rule (a pupil may read a
 * question image only for a question that passes the same filters).
 */

/** M07 PKSK questions are served by M07 only. */
export const NOT_PKSK_SQL = Prisma.sql`NOT EXISTS (SELECT 1 FROM question_tags pt WHERE pt.question_id = q.id AND pt.kind = 'pksk_domain')`

/**
 * Secondary-only (D72, OQ-06): a question of a primary-stage level (Darjah) is hidden from everyone, admin included. Apply it to
 * every list AND count over the same rows, before pagination, so `data` and `meta.totalItems` always agree.
 */
export const NOT_PRIMARY_LEVEL_SQL = Prisma.sql`(v.education_level_id IS NULL OR NOT EXISTS (SELECT 1 FROM education_levels el WHERE el.id = v.education_level_id AND el.stage = 'primary'))`

/** Not a primary-stage level (Darjah) and not an inactive level (secondary-only, 2026-10-29); no level at all is visible. */
export const LEARNER_LEVEL_SQL = Prisma.sql`(v.education_level_id IS NULL OR NOT EXISTS (SELECT 1 FROM education_levels el WHERE el.id = v.education_level_id AND (el.stage = 'primary' OR NOT el.is_active)))`
