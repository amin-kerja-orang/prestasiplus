/**
 * The SQL half of the rules: the `QuestionFilter` each activity's real reader passes to the bank, so a count or a draw over
 * `filterOf(activity)` is exactly what pupils can be served (before the per-record mapper checks that `evaluate` adds).
 *
 * Every filter is applied by `QuestionsRepository.scope`, which already forces the live version, `is_active`, not PKSK, not
 * Darjah and the learner level (`NOT_PRIMARY_LEVEL_SQL`, `LEARNER_LEVEL_SQL`); the SPM activities add `spmPool` (`SPM_SERVABLE_SQL`).
 * Use with `eligibleIds`, `eligibleAmong`, `eligibleIdsPage`, `sampleIds` or `groupCount`.
 *
 * - latih_tubi_spm, databank: what `Be09PracticeQuestionSource.sample({ spmPool: true })` and the SPM pool read.
 * - bab:                      what `chapterPage` / `chapterCounts` read.
 * - simulasi_kuiz:            the random draw of the kuiz (`type mcq`, one MCQ leaf; groups allowed, D90).
 * - simulasi_paper, jana_kertas: the bank scope only; the bridge, the paper and the pool facts are per-record checks.
 */
import { PRACTICE_SHAPE } from '../../practice/question-bridge/be09-practice-mapping'
import type { ServabilityActivity } from '@pp/contract'

import { Prisma } from '../../../db/generated/client'
import { LEARNER_LEVEL_SQL, NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL, SERVABLE_STATUS } from '../learner-visibility'
import type { QuestionFilter } from '../types'

export interface ActivityScope {
  subjectId?: string
  chapterId?: string
}

export function filterOf(activity: ServabilityActivity, scope: ActivityScope = {}): QuestionFilter {
  const subject = scope.subjectId === undefined ? {} : { subjectId: scope.subjectId }
  switch (activity) {
    case 'latih_tubi_spm':
    case 'databank':
      return { ...subject, type: 'mcq', ungrouped: true, mcqShape: PRACTICE_SHAPE, spmPool: true }
    case 'bab':
      return { ...subject, ...(scope.chapterId === undefined ? {} : { chapterId: scope.chapterId }), type: 'mcq', ungrouped: true, mcqShape: PRACTICE_SHAPE }
    case 'simulasi_kuiz':
      return { ...subject, type: 'mcq', singleMcqLeaf: true }
    case 'simulasi_paper':
    case 'jana_kertas':
      return { ...subject }
  }
}

/**
 * The ONE scope of the Databank lane (R1-B11): the questions the lane lists AND the questions the hub card counts, so the card's
 * `attention` can never differ from the lane's rows. A row is a question whose LATEST version is an MCQ of a subject on the
 * Databank list (a Tahun Lepas position), not PKSK, not Darjah; any status (a draft is a row, with the reason `not_approved`).
 * Aliases: `q` (questions), `v` (the latest version), `c` (the subject's SPM configuration).
 */
export const DATABANK_LANE_FROM = Prisma.sql`FROM questions q
      JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
      JOIN spm_subject_configs c ON c.subject_id = v.subject_id`
export const databankLaneConds = (): Prisma.Sql[] => [Prisma.sql`v.type = 'mcq'`, Prisma.sql`c.databank_order IS NOT NULL`, NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL]

/**
 * "Served in the Databank" as a predicate over the rows of the LIVE draw (`filterOf('databank')`, aliases `q`, `v` live): the live
 * subject is on the Databank list (`evaluate` reads the subject of the live version) AND the question is a row of the lane
 * (`databankLaneConds`, the latest version). Used as `count(*) FILTER (WHERE ...)` next to the Latih Tubi count over the same
 * draw, so the draw's shape check (the costly part, an uncorrelated InitPlan) runs once for both.
 */
export const databankServedPredicate = (): Prisma.Sql =>
  Prisma.sql`(EXISTS (SELECT 1 FROM spm_subject_configs dc WHERE dc.subject_id = v.subject_id AND dc.databank_order IS NOT NULL)
       AND q.id IN (SELECT q.id ${DATABANK_LANE_FROM} WHERE ${Prisma.join(databankLaneConds(), ' AND ')}))`

/** The unit of a node is a DSKP unit of Tingkatan 4 or 5 (`QuestionsBijakPoolSource` keeps only those as `UnitFact`). */
const dskpUnit = (node: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`EXISTS (SELECT 1 FROM curriculum_nodes un JOIN education_levels ul ON ul.id = un.education_level_id WHERE un.id = ${node} AND ul.code IN ('T4', 'T5'))`

/**
 * SQL twin of the Jana pool's base eligibility (R1-T30, replaces loading every question of every subject): `describeQuestion(facts)`
 * has no reason (no_unit, no_tp, no_marks, no_key, tag_review) for the live version, within the bank scope of the hub (active,
 * live approved, subject set, not PKSK, learner-visible level). Rules, per `eligibility.ts` and `bijak-pool.ts`:
 *  - the question has at least one leaf (a part with a `mode`) and no leaf lacks marks >= 1, an effective TP of 1 to 6
 *    (`coalesce(part, version)`) or an answer key;
 *  - its bucket exists: the version's own unit is a DSKP unit of T4/T5, or its form origin is `t1_t3`;
 *  - every leaf has a unit (effective, T4/T5) or an effective form origin of `t1_t3`;
 *  - the version is not awaiting tag review.
 * Aliases: `q`, `v` (live). The parity spec proves it equals the pool facts through `describeQuestion` on a mixed bank. The service
 * counts `SELECT count(*) FROM <from> WHERE <where>`; the spec lists the ids with the same fragments.
 */
export const janaEligibleScope = (): { from: Prisma.Sql; where: Prisma.Sql } => {
  const tp = Prisma.sql`coalesce(p.difficulty_tp, v.difficulty_tp)`
  return {
    from: Prisma.sql`FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no`,
    where: Prisma.sql`q.is_active AND v.status = ${Prisma.raw(`'${SERVABLE_STATUS}'`)} AND v.subject_id IS NOT NULL
       AND v.tag_review IS NOT TRUE
       AND ${NOT_PKSK_SQL} AND ${LEARNER_LEVEL_SQL}
       AND (${dskpUnit(Prisma.sql`v.unit_node_id`)} OR v.form_origin = 't1_t3')
       AND EXISTS (SELECT 1 FROM question_parts p WHERE p.question_version_id = v.id AND p.mode IS NOT NULL)
       AND NOT EXISTS (
         SELECT 1 FROM question_parts p
          WHERE p.question_version_id = v.id AND p.mode IS NOT NULL
            AND (p.marks IS NULL OR p.marks < 1
                 OR ${tp} IS NULL OR ${tp} < 1 OR ${tp} > 6
                 OR NOT EXISTS (SELECT 1 FROM answer_keys k WHERE k.part_id = p.id)
                 OR (NOT ${dskpUnit(Prisma.sql`coalesce(p.unit_node_id, v.unit_node_id)`)} AND coalesce(p.form_origin, v.form_origin) IS DISTINCT FROM 't1_t3')))`,
  }
}
