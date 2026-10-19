import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import {
  BIJAK_ATTEMPTS_MESSAGES,
  BijakAttemptCarriedAnswerSchema,
  BijakAttemptGroupSchema,
  BijakAttemptHistoryRowSchema,
  BijakAttemptInProgressSchema,
  BijakAttemptLeafKindSchema,
  BijakAttemptMetaSchema,
  BijakAttemptModeSchema,
  BijakAttemptNotSubmittedErrorSchema,
  BijakAttemptOptionSchema,
  BijakAttemptPaperViewSchema,
  BijakAttemptPartAnswerSchema,
  BijakAttemptPartResultSchema,
  BijakAttemptPartStatusSchema,
  BijakAttemptPartViewSchema,
  BijakAttemptPhotoSchema,
  BijakAttemptPhotoUploadSchema,
  BijakAttemptPointResultSchema,
  BijakAttemptQuestionResultSchema,
  BijakAttemptQuestionSchema,
  BijakAttemptResultSchema,
  BijakAttemptResultViewSchema,
  BijakAttemptRubricBandSchema,
  BijakAttemptSaveChangeSchema,
  BijakAttemptSavePayloadSchema,
  BijakAttemptSaveResultSchema,
  BijakAttemptSchemeSchema,
  BijakAttemptSectionResultSchema,
  BijakAttemptSectionRuleSchema,
  BijakAttemptSectionSchema,
  BijakAttemptStartRequestSchema,
  BijakAttemptStartResultSchema,
  BijakAttemptStatusSchema,
  BijakAttemptStimulusSchema,
  BijakAttemptStoredAnswerSchema,
  BijakAttemptSubmitPayloadSchema,
  BijakAttemptSubmitResultSchema,
} from './schema'

/**
 * Components contributed by BE-16 (appended to COMPONENT_SCHEMAS in openapi.ts). Every id is
 * prefixed `BijakAttempt` so it cannot clash with BE-15 (`BijakPaper...`), the Bijak admin cards
 * or the question bank (`Attempt`, `Answer`, `Result` are never used bare).
 */
export const BIJAK_ATTEMPTS_COMPONENT_SCHEMAS = {
  BijakAttemptMode: BijakAttemptModeSchema,
  BijakAttemptStatus: BijakAttemptStatusSchema,
  BijakAttemptPhoto: BijakAttemptPhotoSchema,
  BijakAttemptPartAnswer: BijakAttemptPartAnswerSchema,
  BijakAttemptStoredAnswer: BijakAttemptStoredAnswerSchema,
  BijakAttemptSaveChange: BijakAttemptSaveChangeSchema,
  BijakAttemptSavePayload: BijakAttemptSavePayloadSchema,
  BijakAttemptCarriedAnswer: BijakAttemptCarriedAnswerSchema,
  BijakAttemptSubmitPayload: BijakAttemptSubmitPayloadSchema,
  BijakAttemptStartRequest: BijakAttemptStartRequestSchema,
  BijakAttemptStartResult: BijakAttemptStartResultSchema,
  BijakAttemptInProgress: BijakAttemptInProgressSchema,
  BijakAttemptMeta: BijakAttemptMetaSchema,
  BijakAttemptSectionRule: BijakAttemptSectionRuleSchema,
  BijakAttemptSection: BijakAttemptSectionSchema,
  BijakAttemptLeafKind: BijakAttemptLeafKindSchema,
  BijakAttemptPartView: BijakAttemptPartViewSchema,
  BijakAttemptOption: BijakAttemptOptionSchema,
  BijakAttemptQuestion: BijakAttemptQuestionSchema,
  BijakAttemptStimulus: BijakAttemptStimulusSchema,
  BijakAttemptGroup: BijakAttemptGroupSchema,
  BijakAttemptPartStatus: BijakAttemptPartStatusSchema,
  BijakAttemptPointResult: BijakAttemptPointResultSchema,
  BijakAttemptRubricBand: BijakAttemptRubricBandSchema,
  BijakAttemptScheme: BijakAttemptSchemeSchema,
  BijakAttemptPartResult: BijakAttemptPartResultSchema,
  BijakAttemptQuestionResult: BijakAttemptQuestionResultSchema,
  BijakAttemptSectionResult: BijakAttemptSectionResultSchema,
  BijakAttemptResult: BijakAttemptResultSchema,
  BijakAttemptPaperView: BijakAttemptPaperViewSchema,
  BijakAttemptSaveResult: BijakAttemptSaveResultSchema,
  BijakAttemptSubmitResult: BijakAttemptSubmitResultSchema,
  BijakAttemptResultView: BijakAttemptResultViewSchema,
  BijakAttemptHistoryRow: BijakAttemptHistoryRowSchema,
  BijakAttemptNotSubmittedError: BijakAttemptNotSubmittedErrorSchema,
  BijakAttemptPhotoUpload: BijakAttemptPhotoUploadSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({
  required: true,
  content: { 'application/json': { schema } },
})

const csrf = z.object({
  'X-CSRF-Token': z
    .string()
    .min(1)
    .meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
const AttemptParams = z.object({
  id: IdSchema.meta({ description: 'Attempt id (opaque; a UUID on the backend).' }),
})
const PaperParams = z.object({
  paperId: IdSchema.meta({ description: 'Paper id (a curated paper or one the caller generated).' }),
})
const CheckParams = z.object({
  id: IdSchema.meta({ description: 'Attempt id.' }),
  questionId: IdSchema.meta({ description: 'A question of the attempt.' }),
})

const UNAUTHORIZED = err('UNAUTHORIZED (no valid session).')
const FORBIDDEN_OWNER = err(
  `FORBIDDEN "${BIJAK_ATTEMPTS_MESSAGES.forbidden}" when the attempt belongs to another user (D54b: 403, not 404; an unknown id is 404), or FORBIDDEN when the active role may not use Bijak SPM (student; admin and school_admin only inside Mod Pelajar, working assumption of BE-15).`,
)
const FORBIDDEN_OWNER_OR_CSRF = err(
  `FORBIDDEN "${BIJAK_ATTEMPTS_MESSAGES.forbidden}" (another user attempt, D54b), FORBIDDEN (the active role may not use Bijak SPM), or CSRF_INVALID (missing or wrong X-CSRF-Token).`,
)
const FORBIDDEN_ROLE_OR_CSRF = err(
  'FORBIDDEN (the active role may not use Bijak SPM) or CSRF_INVALID (missing or wrong X-CSRF-Token).',
)
const FORBIDDEN_ROLE = err(
  'FORBIDDEN (the active role may not use Bijak SPM). Allowed: student, and admin or school_admin inside Mod Pelajar (working assumption of BE-15).',
)
const NOT_FOUND_ATTEMPT = err(`NOT_FOUND "${BIJAK_ATTEMPTS_MESSAGES.attemptNotFound}" (unknown attempt id).`)
const VALIDATION = err('VALIDATION_ERROR with fields for an invalid body.')

const TAG = 'bijak-attempts'

const REVEAL_NOTE =
  'The attempt view carries no answer key, mark scheme, accepted equivalent or explanation (US-15); a scheme is revealed only after submit (exam) or per question after "Semak" (latihan). The deadline and every timestamp come from the server clock.'

/**
 * Registers the ten Bijak SPM attempt routes of BE-16, all student-only and owner-only. The
 * mock `BijakServer` has no HTTP routes; they map to `findInProgress`, `startAttempt`,
 * `getAttemptView`, `saveAnswers`, `submit`, `abandon`, `checkQuestion`, `getResult`, `history`
 * and a card-only photo upload. Every response body is `{ data }` or `{ error }`.
 */
export function registerBijakAttemptsPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/bijak/papers/{paperId}/in-progress',
    tags: [TAG],
    summary: 'Resume prompt: the caller open attempt on a paper',
    description: `Mock method findInProgress(userId, paperId). The caller most recent open attempt on the paper, or data null. An attempt with elapsedSeconds <= 60 resumes silently (fresh). Expired exam attempts are closed first (sweep). Student role. ${REVEAL_NOTE}`,
    request: { params: PaperParams },
    responses: {
      200: json(
        envelopeOf(BijakAttemptInProgressSchema.nullable()),
        'The open attempt, or { data: null } when there is none.',
      ),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ROLE,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/bijak/attempts',
    tags: [TAG],
    summary: 'Start or resume a sitting',
    description: `Mock method startAttempt(userId, paperId, mode, { restart }). The paper must resolve for the caller (as GET /bijak/papers/{id}). Without restart and with an open attempt on the paper: 200 with the id of the most recent one, nothing is created. Otherwise: 201; with restart every open attempt of the caller on the paper becomes abandoned ("Ditinggalkan", AC-12.2), then a new attempt is stored with status in_progress, startedAt = server now, deadline = startedAt + durationMin for exam and null for latihan, and the frozen composition of the paper (later paper or pool edits never change it). Student role. ${REVEAL_NOTE}`,
    request: { headers: [csrf], body: body(BijakAttemptStartRequestSchema) },
    responses: {
      200: json(envelopeOf(BijakAttemptStartResultSchema), 'The caller existing open attempt (no restart).'),
      201: json(envelopeOf(BijakAttemptStartResultSchema), 'A new attempt was created.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ROLE_OR_CSRF,
      404: err(
        `NOT_FOUND "${BIJAK_ATTEMPTS_MESSAGES.paperNotFound}" (unknown, unpublished or another user generated paper).`,
      ),
      422: VALIDATION,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/bijak/attempts/{id}',
    tags: [TAG],
    summary: 'The paper as served to an attempt, with saved answers, flags and server time',
    description: `Mock method getAttemptView(userId, attemptId); the response also carries serverNow (the mock serverNow()). Sections, questions (stem, marks, MCQ options, part tree, answer modes), stimulus groups, the caller saved answers, flags, picks, position, and the server deadline. In latihan, checks lists the questions already checked with "Semak" (their scheme revealed); it is always empty otherwise. An exam attempt past deadline + 300 s is closed by the sweep before the view is built. Student role, attempt owner only. ${REVEAL_NOTE}`,
    request: { params: AttemptParams },
    responses: {
      200: json(envelopeOf(BijakAttemptPaperViewSchema), 'The attempt view (no keys, no schemes outside checks).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_OWNER,
      404: NOT_FOUND_ATTEMPT,
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/bijak/attempts/{id}/answers',
    tags: [TAG],
    summary: 'Idempotent autosave with per-part revisions',
    description: `Mock method saveAnswers(userId, attemptId, payload). For an in_progress attempt: each change is ignored when its part is not on the attempt, is locked (latihan after 3 checks of its question), or the stored rev is >= change.rev; otherwise it is stored as { answer, rev, savedAt: min(change.savedAt, server now) }, so the device clock never extends or moves anything. Then flags, picks and position replace the stored values when present. For a closed attempt nothing is stored and the answer is 200 { savedAt, closed: true }; late sync: an auto_submitted exam attempt still accepts changes whose capped savedAt is at or before the deadline, within 24 h after the deadline; when they change the stored answers the attempt is graded again and regraded true is returned. The response never carries a key or scheme. Student role, attempt owner only.`,
    request: { params: AttemptParams, headers: [csrf], body: body(BijakAttemptSavePayloadSchema) },
    responses: {
      200: json(envelopeOf(BijakAttemptSaveResultSchema), 'Saved (or closed / regraded).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_OWNER_OR_CSRF,
      404: NOT_FOUND_ATTEMPT,
      422: VALIDATION,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/bijak/attempts/{id}/submit',
    tags: [TAG],
    summary: 'Submit and grade (idempotent)',
    description: `Mock method submit(userId, attemptId, payload). The changes and the device answers map are merged as for the autosave, then the attempt becomes submitted (auto_submitted when auto is true), submittedAt = server now, lateBySeconds is recorded when past the deadline, and the stored result is graded from the union of saved and carried answers (marking with @pp/exam-core). A repeat submit on an already closed attempt, with the same or another idempotencyKey, answers 200 with closed true and the stored late value; the stored result is not recomputed (a late sync may re-grade: regraded true). Two simultaneous submits with the same key produce one stored result. No wallet write (the mock does not credit coins). Student role, attempt owner only.`,
    request: { params: AttemptParams, headers: [csrf], body: body(BijakAttemptSubmitPayloadSchema) },
    responses: {
      200: json(envelopeOf(BijakAttemptSubmitResultSchema), 'Submitted, or already closed (closed: true).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_OWNER_OR_CSRF,
      404: NOT_FOUND_ATTEMPT,
      422: VALIDATION,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/bijak/attempts/{id}/abandon',
    tags: [TAG],
    summary: 'Discard an open sitting',
    description:
      'Mock method abandon(userId, attemptId). in_progress becomes abandoned ("Ditinggalkan"); on any other status nothing changes. Always 204 without a body. Student role, attempt owner only.',
    request: { params: AttemptParams, headers: [csrf] },
    responses: {
      204: { description: 'Abandoned, or nothing to do (the attempt was not in progress).' },
      401: UNAUTHORIZED,
      403: FORBIDDEN_OWNER_OR_CSRF,
      404: NOT_FOUND_ATTEMPT,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/bijak/attempts/{id}/questions/{questionId}/check',
    tags: [TAG],
    summary: 'Latihan "Semak": grade one question and reveal only its scheme',
    description: `Mock method checkQuestion(userId, attemptId, questionId, payload?). The optional body is an autosave payload merged first while the question has fewer than 3 checks. Each call below the cap increments the question count (3 = MAX_CHECKS_PER_QUESTION) and adds the question to checked; after the 3rd check the answer of that question is locked, and a further check still returns the question result but ignores any payload and changes neither the saved answer nor the count. Only latihan: in exam mode 403 "${BIJAK_ATTEMPTS_MESSAGES.schemeAfterSubmit}". An attempt that is not in progress answers 409 CONFLICT "${BIJAK_ATTEMPTS_MESSAGES.attemptClosed}". A question that is not on the attempt answers 404 "${BIJAK_ATTEMPTS_MESSAGES.questionNotFound}". The scheme of this question only is returned (US-15, AC-15.3). Student role, attempt owner only.`,
    request: {
      params: CheckParams,
      headers: [csrf],
      body: {
        required: false,
        content: { 'application/json': { schema: BijakAttemptSavePayloadSchema } },
      },
    },
    responses: {
      200: json(envelopeOf(BijakAttemptQuestionResultSchema), 'The graded question with its revealed scheme.'),
      401: UNAUTHORIZED,
      403: err(
        `FORBIDDEN "${BIJAK_ATTEMPTS_MESSAGES.schemeAfterSubmit}" (exam mode), FORBIDDEN "${BIJAK_ATTEMPTS_MESSAGES.forbidden}" (another user attempt, D54b), FORBIDDEN (role), or CSRF_INVALID (missing or wrong X-CSRF-Token).`,
      ),
      404: err(
        `NOT_FOUND "${BIJAK_ATTEMPTS_MESSAGES.attemptNotFound}" (unknown attempt) or "${BIJAK_ATTEMPTS_MESSAGES.questionNotFound}" (question not on the attempt).`,
      ),
      409: err(`CONFLICT "${BIJAK_ATTEMPTS_MESSAGES.attemptClosed}" (the attempt is no longer in progress).`),
      422: VALIDATION,
      429: err(
        'RATE_LIMITED: check requests are rate-limited (NFR-05); the threshold is an open question of BE-16. Not in the mock.',
      ),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/bijak/attempts/{id}/result',
    tags: [TAG],
    summary: 'The result page with full schemes (after submit only)',
    description: `Mock method getResult(userId, attemptId). Returns the attempt record, the stored result (score, max, percent, provisional, pendingReview, sections, questions with parts, points and revealed schemes, display coins and points) and the paper view with checks always empty. An exam attempt past deadline + 300 s is closed by the sweep first, so a result exists. Before submit: 409 NOT_SUBMITTED "${BIJAK_ATTEMPTS_MESSAGES.schemeAfterSubmit}". Student role, attempt owner only.`,
    request: { params: AttemptParams },
    responses: {
      200: json(envelopeOf(BijakAttemptResultViewSchema), 'The result view.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_OWNER,
      404: NOT_FOUND_ATTEMPT,
      409: json(BijakAttemptNotSubmittedErrorSchema, `NOT_SUBMITTED "${BIJAK_ATTEMPTS_MESSAGES.schemeAfterSubmit}" (the attempt has no result yet).`),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/bijak/history',
    tags: [TAG],
    summary: 'The caller attempts, newest first',
    description:
      'Mock method history(userId). Every attempt of the caller (all statuses, both modes), ordered by startedAt descending, with score and max when a result exists. No pagination in the mock (unbounded list). Expired exam attempts are closed first (sweep). Writes made under Mod Pelajar are marked is_test and excluded from other users aggregates. Student role.',
    responses: {
      200: json(envelopeOf(z.array(BijakAttemptHistoryRowSchema)), 'The caller history.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ROLE,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/bijak/attempts/{id}/photos',
    tags: [TAG],
    summary: 'Upload a photo of the working for one part',
    description: `Card-only route (the mock keeps photos on the device). multipart/form-data: partId and file (JPEG or PNG, at most 5 MB = MAX_PHOTO_BYTES). At most 3 photos per part (MAX_PHOTOS_PER_PART). The part must belong to the caller attempt and accept working or drawing. The file is stored privately through the BE-04 files service (purpose bijak_photo); only the attempt owner can read it. The returned metadata is then placed in PartAnswer.photos by the autosave. 422 VALIDATION_ERROR: fields.file "${BIJAK_ATTEMPTS_MESSAGES.photoType}" (type or size) or "${BIJAK_ATTEMPTS_MESSAGES.photoCount}" (a 4th photo), fields.partId for a part that is not on the attempt or does not accept photos. An attempt that is not in progress answers 409 CONFLICT "${BIJAK_ATTEMPTS_MESSAGES.attemptClosed}". Student role, attempt owner only.`,
    request: {
      params: AttemptParams,
      headers: [csrf],
      body: {
        required: true,
        content: { 'multipart/form-data': { schema: BijakAttemptPhotoUploadSchema } },
      },
    },
    responses: {
      201: json(envelopeOf(BijakAttemptPhotoSchema), 'The stored photo metadata.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_OWNER_OR_CSRF,
      404: NOT_FOUND_ATTEMPT,
      409: err(`CONFLICT "${BIJAK_ATTEMPTS_MESSAGES.attemptClosed}" (the attempt is no longer in progress).`),
      422: err(
        `VALIDATION_ERROR with fields.file "${BIJAK_ATTEMPTS_MESSAGES.photoType}" or "${BIJAK_ATTEMPTS_MESSAGES.photoCount}", or fields.partId.`,
      ),
    },
  })
}
