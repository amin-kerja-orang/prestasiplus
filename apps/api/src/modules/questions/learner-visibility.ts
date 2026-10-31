import { Prisma } from '../../db/generated/client'
import { OFFERED_LEVEL_CODES } from '../practice/rules'

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

/**
 * R1-B06 (D85/D87): the ONE definition of "SPM-servable" for the SPM activities (Databank Soalan SPM, Latih Tubi SPM, Mock K1,
 * the Misi fallback, Battle SPM mode). It replaces the legacy `pool:spm` tag (`spmPool`): a question qualifies by what it IS,
 * not by a tag only the QLOAD import wrote, so admin-created questions reach the same activities. Aliases: `q`, `v`.
 *
 * Pieces: learner-visible level (LEARNER_LEVEL_SQL), not PKSK (NOT_PKSK_SQL), the level is one of OFFERED_LEVEL_CODES
 * (T4, T5), of an active subject linked to that level (the same rule as the practice cards and the login count). The servable
 * status, active flag, subject and MCQ-leaf shape are applied by the callers (`QuestionsRepository.scope`, the overview SQL),
 * so the status constant stays in one place.
 */
const OFFERED_LIST = OFFERED_LEVEL_CODES.map((c) => `'${c.replaceAll("'", '')}'`).join(', ')
export const SPM_SERVABLE_SQL = Prisma.sql`(${LEARNER_LEVEL_SQL} AND ${NOT_PKSK_SQL} AND EXISTS (SELECT 1 FROM education_levels ol WHERE ol.id = v.education_level_id AND ol.code IN (${Prisma.raw(OFFERED_LIST)})) AND EXISTS (SELECT 1 FROM subjects sj WHERE sj.id = v.subject_id AND sj.is_active) AND EXISTS (SELECT 1 FROM subject_levels sl WHERE sl.subject_id = v.subject_id AND sl.education_level_id = v.education_level_id))`
