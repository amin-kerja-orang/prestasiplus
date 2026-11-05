import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { QUESTION_MESSAGES, QuestionFilterSchema } from '../questions/schema'

/**
 * Bulk "Tetapkan Bab" (API-DSKP-09, DM-17, S4-T03) and the Bab coverage counts behind the work-list
 * "Soalan tanpa Bab" (API-DSKP-10). The bulk call sets `question_versions.chapter_id` in place on the live
 * approved version; it creates no version and changes no status. No auto-mapping (D89, OQ-03).
 */

/** Rows one bulk-chapter run updates at most (D115 default; own constant, not `FILTER_ACTION_CAP` = 500). */
export const BULK_CHAPTER_CAP = 10_000

/** `ids` of one call: 1 to 64 (a selection in the list; "all results of the filter" uses `filter`). */
export const BULK_CHAPTER_MAX_IDS = 64

/** 422 copy of the body rules that the PRD does not word (English, [PROPOSED]); `expectedCount` reuses the question-bank copy. */
export const CURRICULUM_BULK_CHAPTER_MESSAGES = {
  oneOfIdsOrFilter: 'Send exactly one of ids or filter.',
  filterNeedsSubjectAndLevel: 'The filter must contain subjectId and educationLevelId.',
  expectedCountNeeded: QUESTION_MESSAGES.filterCountNeeded,
} as const

/**
 * Body of `POST /admin/curriculum/questions/bulk-chapter`. Strict: an unknown key, in the body or in `filter`, is 422.
 * Exactly one of `ids` (1 to 64) or `filter` (the `GET /questions` filter; it must contain `subjectId` and `educationLevelId`).
 * `expectedCount` is the `matched` total the client showed; it is required unless `dryRun`, and a different live count is 409.
 * `overwrite` (default false) is "Tukar Bab sedia ada": a question that already has a Bab is changed too.
 */
export const BulkChapterRequestSchema = z
  .strictObject({
    chapterId: IdSchema.meta({ description: 'The Bab to set.' }),
    ids: z.array(IdSchema).min(1).max(BULK_CHAPTER_MAX_IDS).optional(),
    filter: QuestionFilterSchema.optional(),
    dryRun: z.boolean().optional(),
    expectedCount: z.int().min(0).optional(),
    overwrite: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if ((v.ids === undefined) === (v.filter === undefined)) {
      ctx.addIssue({ code: 'custom', path: [v.ids === undefined ? 'filter' : 'ids'], message: CURRICULUM_BULK_CHAPTER_MESSAGES.oneOfIdsOrFilter })
    }
    if (v.filter !== undefined && (v.filter.subjectId === undefined || v.filter.educationLevelId === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['filter'], message: CURRICULUM_BULK_CHAPTER_MESSAGES.filterNeedsSubjectAndLevel })
    }
    if (v.expectedCount === undefined && v.dryRun !== true) {
      ctx.addIssue({ code: 'custom', path: ['expectedCount'], message: CURRICULUM_BULK_CHAPTER_MESSAGES.expectedCountNeeded })
    }
  })
  .meta({ id: 'CurriculumBulkChapterRequest' })

/**
 * Result of a bulk-chapter call. `matched` = the rows of the filter or ids; `eligible` = matched rows whose live version is approved,
 * has no Bab (unless `overwrite`) and whose subject and level equal the Bab's; `refused` = matched - eligible, ONE number with no
 * per-reason breakdown (a question that is not approved counts here too). `applied` = rows updated (0 on a dry run); `cap` =
 * `BULK_CHAPTER_CAP`; `remaining` = eligible - applied after a capped run (0 on a dry run, which reports `capped` from the match);
 * `auditId` = the audit row, null on a dry run.
 */
export const BulkChapterResultSchema = z
  .object({
    matched: z.int().min(0),
    eligible: z.int().min(0),
    refused: z.int().min(0),
    applied: z.int().min(0),
    cap: z.int().min(1),
    remaining: z.int().min(0),
    capped: z.boolean(),
    dryRun: z.boolean(),
    auditId: IdSchema.nullable(),
  })
  .meta({ id: 'CurriculumBulkChapterResult' })

/** Query of `GET /admin/curriculum/chapter-coverage`: both optional. */
export const ChapterCoverageQuerySchema = z
  .object({ subjectId: IdSchema.optional(), educationLevelId: IdSchema.optional() })
  .meta({ id: 'CurriculumChapterCoverageQuery' })

/**
 * Per offered Subjek x Tingkatan, over the live, active, approved question versions: `approved` = all of them,
 * `withChapter` = those with a Bab, `withoutChapter` = those without (withChapter + withoutChapter = approved).
 */
export const ChapterCoverageRowSchema = z
  .object({
    subjectId: IdSchema,
    subjectName: z.string(),
    levelCode: z.string(),
    approved: z.int().min(0),
    withChapter: z.int().min(0),
    withoutChapter: z.int().min(0),
  })
  .meta({ id: 'CurriculumChapterCoverageRow' })

export const ChapterCoverageSchema = z
  .object({ rows: z.array(ChapterCoverageRowSchema) })
  .meta({ id: 'CurriculumChapterCoverage' })

export type BulkChapterRequest = z.infer<typeof BulkChapterRequestSchema>
export type BulkChapterResult = z.infer<typeof BulkChapterResultSchema>
export type ChapterCoverageRow = z.infer<typeof ChapterCoverageRowSchema>
