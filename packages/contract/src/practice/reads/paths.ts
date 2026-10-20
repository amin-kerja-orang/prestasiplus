import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { ErrorBodySchema } from '../../common/error'
import { envelopeOf } from '../../common/envelope'
import { registerRoute } from './rate-limit'
import {
  PRACTICE_READS_MESSAGES,
  PracticeReadChapterCardSchema,
  PracticeReadChapterSubjectDetailSchema,
  PracticeReadChapterSubjectListResponseSchema,
  PracticeReadChapterSubjectQuerySchema,
  PracticeReadChapterSubjectSchema,
  PracticeReadCodeParamsSchema,
  PracticeReadCorrectionsQuerySchema,
  PracticeReadCorrectionsSchema,
  PracticeReadDashboardBadgeSchema,
  PracticeReadDashboardSchema,
  PracticeReadDifficultyCountsSchema,
  PracticeReadGreetingPeriodSchema,
  PracticeReadHistoryItemSchema,
  PracticeReadHistoryMetaSchema,
  PracticeReadHistoryQuerySchema,
  PracticeReadHistoryResponseSchema,
  PracticeReadHistoryTotalsSchema,
  PracticeReadLevelPillSchema,
  PracticeReadMasteryCardSchema,
  PracticeReadMasterySchema,
  PracticeReadProgressQuerySchema,
  PracticeReadProgressSchema,
  PracticeReadProgressSubjectSchema,
  PracticeReadQuestSchema,
  PracticeReadRecentQuestionSchema,
  PracticeReadRevisionOverviewSchema,
  PracticeReadRevisionSubjectCardSchema,
  PracticeReadRevisionSubjectSchema,
  PracticeReadBannerSchema,
  PracticeReadArticleSchema,
  PracticeReadSpmGradeSchema,
  PracticeReadSpmTargetRowSchema,
  PracticeReadSpmTargetsSaveRequestSchema,
  PracticeReadSpmTargetsSaveResponseSchema,
  PracticeReadSpmTargetsSchema,
  PracticeReadStructuredAttemptRequestSchema,
  PracticeReadStructuredAttemptResultSchema,
  PracticeReadStructuredCardSchema,
  PracticeReadStructuredDetailQuerySchema,
  PracticeReadStructuredDetailSchema,
  PracticeReadStructuredListMetaSchema,
  PracticeReadStructuredListQuerySchema,
  PracticeReadStructuredListResponseSchema,
  PracticeReadStructuredParamsSchema,
  PracticeReadStructuredScopeSchema,
  PracticeReadStructuredTrackSchema,
  PracticeReadSubjectConfigSchema,
  PracticeReadSubjectLevelSchema,
  PracticeReadSubjectListResponseSchema,
  PracticeReadSubjectSchema,
  PracticeReadSubjectStatSchema,
  PracticeReadTrialStatusSchema,
} from './schema'

/** Components contributed by BE-13 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const PRACTICE_READS_COMPONENT_SCHEMAS = {
  PracticeReadSubject: PracticeReadSubjectSchema,
  PracticeReadTrialStatus: PracticeReadTrialStatusSchema,
  PracticeReadDifficultyCounts: PracticeReadDifficultyCountsSchema,
  PracticeReadGreetingPeriod: PracticeReadGreetingPeriodSchema,
  PracticeReadQuest: PracticeReadQuestSchema,
  PracticeReadBanner: PracticeReadBannerSchema,
  PracticeReadDashboardBadge: PracticeReadDashboardBadgeSchema,
  PracticeReadArticle: PracticeReadArticleSchema,
  PracticeReadLevelPill: PracticeReadLevelPillSchema,
  PracticeReadRecentQuestion: PracticeReadRecentQuestionSchema,
  PracticeReadSubjectStat: PracticeReadSubjectStatSchema,
  PracticeReadDashboard: PracticeReadDashboardSchema,
  PracticeReadSubjectListResponse: PracticeReadSubjectListResponseSchema,
  PracticeReadSubjectLevel: PracticeReadSubjectLevelSchema,
  PracticeReadSubjectConfig: PracticeReadSubjectConfigSchema,
  PracticeReadChapterSubject: PracticeReadChapterSubjectSchema,
  PracticeReadChapterSubjectListResponse: PracticeReadChapterSubjectListResponseSchema,
  PracticeReadChapterCard: PracticeReadChapterCardSchema,
  PracticeReadChapterSubjectDetail: PracticeReadChapterSubjectDetailSchema,
  PracticeReadRevisionSubjectCard: PracticeReadRevisionSubjectCardSchema,
  PracticeReadRevisionOverview: PracticeReadRevisionOverviewSchema,
  PracticeReadRevisionSubject: PracticeReadRevisionSubjectSchema,
  PracticeReadProgressSubject: PracticeReadProgressSubjectSchema,
  PracticeReadProgress: PracticeReadProgressSchema,
  PracticeReadHistoryItem: PracticeReadHistoryItemSchema,
  PracticeReadHistoryTotals: PracticeReadHistoryTotalsSchema,
  PracticeReadHistoryMeta: PracticeReadHistoryMetaSchema,
  PracticeReadHistoryResponse: PracticeReadHistoryResponseSchema,
  PracticeReadCorrections: PracticeReadCorrectionsSchema,
  PracticeReadMasteryCard: PracticeReadMasteryCardSchema,
  PracticeReadMastery: PracticeReadMasterySchema,
  PracticeReadStructuredScope: PracticeReadStructuredScopeSchema,
  PracticeReadStructuredTrack: PracticeReadStructuredTrackSchema,
  PracticeReadStructuredCard: PracticeReadStructuredCardSchema,
  PracticeReadStructuredListMeta: PracticeReadStructuredListMetaSchema,
  PracticeReadStructuredListResponse: PracticeReadStructuredListResponseSchema,
  PracticeReadStructuredDetail: PracticeReadStructuredDetailSchema,
  PracticeReadStructuredAttemptRequest: PracticeReadStructuredAttemptRequestSchema,
  PracticeReadStructuredAttemptResult: PracticeReadStructuredAttemptResultSchema,
  PracticeReadSpmGrade: PracticeReadSpmGradeSchema,
  PracticeReadSpmTargetRow: PracticeReadSpmTargetRowSchema,
  PracticeReadSpmTargets: PracticeReadSpmTargetsSchema,
  PracticeReadSpmTargetsSaveRequest: PracticeReadSpmTargetsSaveRequestSchema,
  PracticeReadSpmTargetsSaveResponse: PracticeReadSpmTargetsSaveResponseSchema,
} as const

const TAG = 'practice-reads'

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

const UNAUTHORIZED = err('UNAUTHORIZED: no valid session.')
const NOT_FOUND_CODE = err(`NOT_FOUND "${PRACTICE_READS_MESSAGES.notFound}" (unknown or inactive subject code).`)
const NOT_FOUND_STRUCTURED = err(
  `NOT_FOUND "${PRACTICE_READS_MESSAGES.notFound}" (unknown id, or a structured question that is not published, active and for Tingkatan 4 or 5).`,
)

const WHO =
  'Any signed-in role (mock: "Any session (A)"); the figures are always the caller own, never another user (card AC4: staff read a student through the BE-19 and BE-20 report endpoints). Read-only: no CSRF header, no rate limit.'

/**
 * Registers the M05 learner read routes and the small writes around them (BE-13). Bodies are
 * `{ data }`, `{ data, meta }` or `{ error }`. Paths omit the `/api` base. D57: the two write routes
 * (PUT /spm-targets, POST /practice/structured/{id}/attempts) answer 429 RATE_LIMITED with
 * retryAfter and Retry-After (added by `registerRoute`); no response carries a credential, so none
 * sends Cache-Control: no-store. `GET /missions/today`, `GET /remedial-tests/*` belong to BE-18.
 */
export function registerPracticeReadsPaths(registry: OpenAPIRegistry): void {
  const csrf = z.object({
    'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
  })
  const csrfInvalid = 'CSRF_INVALID (missing or wrong X-CSRF-Token).'

  registerRoute(registry, {
    method: 'get',
    path: '/dashboard',
    tags: [TAG],
    summary: 'Student dashboard (S1)',
    description: `Mock GET /api/dashboard. One read model: greeting, trial, streak, wallet, this week (Monday-Sunday, Malaysia time), banners, today quests, badges, revision total, latest articles, subjects with counts, question-bank statistics, level pills, newest approved questions and per-subject stats. Wallet, streak, quests, badges, banners and articles come from their owner modules; counts never join live questions for the caller own figures. ${WHO}`,
    responses: { 200: json(envelopeOf(PracticeReadDashboardSchema), 'The dashboard.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/practice/subjects',
    tags: [TAG],
    summary: 'Practice subjects (S2)',
    description: `Mock GET /api/practice/subjects. The active M03 subjects in BR-08 order with approvedCount and bankCount. Not paged: page 1, pageSize = number of rows (at least 1), totalPages 1. ${WHO}`,
    responses: { 200: json(PracticeReadSubjectListResponseSchema, 'The subjects.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/practice/subjects/{code}',
    tags: [TAG],
    summary: 'Subject practice configuration (S3)',
    description: `Mock GET /api/practice/subjects/:code. Offered levels (Darjah 1-4) with practice counts, difficulty split overall and per level, and the caller trial status. ${WHO}`,
    request: { params: PracticeReadCodeParamsSchema },
    responses: { 200: json(envelopeOf(PracticeReadSubjectConfigSchema), 'The subject configuration.'), 401: UNAUTHORIZED, 404: NOT_FOUND_CODE },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/practice/chapter-subjects',
    tags: [TAG],
    summary: 'Subjects with chapter practice (S4)',
    description: `Mock GET /api/practice/chapter-subjects. Subjects with at least one chapter (having chapter questions) at an offered level. Not paged. A teacher may open it (no role rule). ${WHO}`,
    responses: { 200: json(PracticeReadChapterSubjectListResponseSchema, 'The subjects.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/practice/chapter-subjects/{code}',
    tags: [TAG],
    summary: 'Chapters of a subject with the caller progress (S5)',
    description: `Mock GET /api/practice/chapter-subjects/:code?levelId=. Chapter 1 is open; chapter k is open when chapter k - 1 is complete and its score is at least 70 (BR-16). A locked chapter is refused at session start (BE-12 CHAPTER_LOCKED), not here. ${WHO}`,
    request: { params: PracticeReadCodeParamsSchema, query: PracticeReadChapterSubjectQuerySchema },
    responses: { 200: json(envelopeOf(PracticeReadChapterSubjectDetailSchema), 'The chapter list of one level.'), 401: UNAUTHORIZED, 404: NOT_FOUND_CODE },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/practice/revision',
    tags: [TAG],
    summary: 'Revision queue overview (S6)',
    description: `Mock GET /api/practice/revision. Distinct queued questions per subject, only those that still have an active question link (card AC3). ${WHO}`,
    responses: { 200: json(envelopeOf(PracticeReadRevisionOverviewSchema), 'The overview.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/practice/revision/{code}',
    tags: [TAG],
    summary: 'Revision count of one subject (S7 guard)',
    description: `Mock GET /api/practice/revision/:code. count 0 is still 200. ${WHO}`,
    request: { params: PracticeReadCodeParamsSchema },
    responses: { 200: json(envelopeOf(PracticeReadRevisionSubjectSchema), 'The subject and its queued count.'), 401: UNAUTHORIZED, 404: NOT_FOUND_CODE },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/practice/progress',
    tags: [TAG],
    summary: 'Own progress analytics (S8)',
    description: `Mock GET /api/practice/progress?period=. Answered and accuracy count every answer in the window (with or without a session) read from the answer rows; sessions and minutes count completed sessions. Figures read the answer dimensions, not a question join (card AC2). ${WHO}`,
    request: { query: PracticeReadProgressQuerySchema },
    responses: { 200: json(envelopeOf(PracticeReadProgressSchema), 'The progress; an unknown period gives period null and zero figures.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/practice/history',
    tags: [TAG],
    summary: 'Own completed sessions with all-time totals (S9)',
    description: `Mock GET /api/practice/history?period=&page=. Newest first, 15 per page. meta.totals are all-time and never filtered by period (BR-21). Relation to BE-12 GET /practice/sessions: this is the S9 screen model (badge, wrongCount, 2-decimal accuracy), that one the session list of the write path. ${WHO}`,
    request: { query: PracticeReadHistoryQuerySchema },
    responses: { 200: json(PracticeReadHistoryResponseSchema, 'The page of sessions with meta.totals.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/practice/corrections',
    tags: [TAG],
    summary: 'Own corrections: first attempt versus later attempt per question (S11)',
    description: `Mock GET /api/practice/corrections?month=. Questions whose first attempt fell in the month; "before" is the first attempt, "after" counts a later correct attempt. SPM past_year sessions are not counted (BR-18). ${WHO}`,
    request: { query: PracticeReadCorrectionsQuerySchema },
    responses: { 200: json(envelopeOf(PracticeReadCorrectionsSchema), 'The month report.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/practice/mastery',
    tags: [TAG],
    summary: 'Own mastery level per subject (S12)',
    description: `Mock GET /api/practice/mastery. The L0-L10 scale and one card per answered active subject; the level comes from the correct count (BR-20). Computed from the answer dimensions, not a question join (card AC2). ${WHO}`,
    responses: { 200: json(envelopeOf(PracticeReadMasterySchema), 'The scale and the cards.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/practice/structured',
    tags: [TAG],
    summary: 'Structured question cards (S10 and the SPM variants)',
    description: `Mock GET /api/practice/structured. Published, active Tingkatan 4 and 5 sets, newest first, 20 per page. scope=spm lists the 15 Subjektif subjects newest first across subjects; with track=bahasa only BM then BI. An unknown scope, or a track without scope=spm, is ignored. ${WHO}`,
    request: { query: PracticeReadStructuredListQuerySchema },
    responses: { 200: json(PracticeReadStructuredListResponseSchema, 'A page of cards; meta carries scope, track and subjectOptions.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/practice/structured/{id}',
    tags: [TAG],
    summary: 'Structured question answer page (Q3)',
    description: `Mock GET /api/practice/structured/:id. Stimulus and sub-questions with marks; model answers are never part of it (they come back in the attempt result). ${WHO}`,
    request: { params: PracticeReadStructuredParamsSchema, query: PracticeReadStructuredDetailQuerySchema },
    responses: { 200: json(envelopeOf(PracticeReadStructuredDetailSchema), 'The question.'), 401: UNAUTHORIZED, 404: NOT_FOUND_STRUCTURED },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/practice/structured/{id}/attempts',
    tags: [TAG],
    summary: 'Submit a structured attempt',
    description: `Mock POST /api/practice/structured/:id/attempts. Stores one attempt of the caller (not idempotent: each call stores a new row) and returns it with the marks and the model answers. Marking is the mock placeholder (LS-7): a sub-question gets full marks when its trimmed answer has at least 20 characters, else 0; the server uses @pp/exam-core once BE-14 has merged. A sub-question left out of answers is marked 0. Any signed-in role; own attempts only.`,
    request: {
      params: PracticeReadStructuredParamsSchema,
      headers: [csrf],
      body: { required: true, content: { 'application/json': { schema: PracticeReadStructuredAttemptRequestSchema } } },
    },
    responses: {
      201: json(envelopeOf(PracticeReadStructuredAttemptResultSchema), 'The stored attempt with marks and model answers.'),
      401: UNAUTHORIZED,
      403: err(csrfInvalid),
      404: NOT_FOUND_STRUCTURED,
      422: err(
        `VALIDATION_ERROR with fields: scope or track "${PRACTICE_READS_MESSAGES.invalidScope}" (not 'spm' / 'bahasa', or track without scope 'spm'); answers "${PRACTICE_READS_MESSAGES.invalidAnswer}" (not an array); answers.<index> "${PRACTICE_READS_MESSAGES.invalidAnswer}" (bad row, unknown or repeated subQuestionId) or "${PRACTICE_READS_MESSAGES.answerTooLong(5000)}". message is the first field message, plus " (and N more error(s))" when there are several.`,
      ),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/spm-targets',
    tags: [TAG],
    summary: 'Own SPM targets (S15)',
    description: `Mock GET /api/spm-targets. The 20 SPM subjects of BR-22 in order with the caller target. answered, accuracyPct, band and predictedGrade are 0 / null ("Belum mula") unless progress exists (mock: only a test fixture sets it; the v2 source is an open question). ${WHO}`,
    responses: { 200: json(envelopeOf(PracticeReadSpmTargetsSchema), 'The targets.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'put',
    path: '/spm-targets',
    tags: [TAG],
    summary: 'Replace own SPM targets',
    description: `Mock PUT /api/spm-targets. Replaces all 20 values (BR-26): a missing subject or "" clears its target. Idempotent: the same body twice stores the same rows and answers the same. Any invalid key or grade is 422 and nothing is saved. Any signed-in role; own targets only (SEC-M05-06).`,
    request: {
      headers: [csrf],
      body: { required: true, content: { 'application/json': { schema: PracticeReadSpmTargetsSaveRequestSchema } } },
    },
    responses: {
      200: json(PracticeReadSpmTargetsSaveResponseSchema, `{ data: { saved: 20 }, status: "${PRACTICE_READS_MESSAGES.targetsSaved}" }.`),
      401: UNAUTHORIZED,
      403: err(csrfInvalid),
      422: err(
        `VALIDATION_ERROR "${PRACTICE_READS_MESSAGES.targetsInvalid}": fields.targets when targets is not an object; fields["targets.<key>"] for a key that is not one of the 20 subjects (or not canonical), or a value outside the nine grades and "".`,
      ),
    },
  })
}
