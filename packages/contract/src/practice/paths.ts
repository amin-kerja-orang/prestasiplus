import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf } from '../common/envelope'
import { RATE_LIMITED_RESPONSE } from './reads/rate-limit'
import {
  CheckAnswerRequestSchema,
  CheckAnswerResponseSchema,
  ListSessionsQuerySchema,
  PracticeErrorCodeSchema,
  PracticeGamificationSchema,
  PracticeModeSchema,
  PracticeSessionIdSchema,
  PracticeSessionParamsSchema,
  PracticeStartModeSchema,
  PracticeQuizOptionSchema,
  PracticeQuizQuestionSchema,
  PracticeScriptTypeSchema,
  SessionListItemSchema,
  SessionListMetaSchema,
  SessionListResponseSchema,
  SessionListStatsSchema,
  StartSessionRequestSchema,
  StartSessionResponseSchema,
  SubmitSessionRequestSchema,
  SubmitSessionResponseSchema,
  PracticeTextDirectionSchema,
} from './schema'

/** Components contributed by BE-12 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const PRACTICE_COMPONENT_SCHEMAS = {
  PracticeMode: PracticeModeSchema,
  PracticeStartMode: PracticeStartModeSchema,
  PracticeSessionId: PracticeSessionIdSchema,
  PracticeErrorCode: PracticeErrorCodeSchema,
  PracticeTextDirection: PracticeTextDirectionSchema,
  PracticeScriptType: PracticeScriptTypeSchema,
  PracticeQuizOption: PracticeQuizOptionSchema,
  PracticeQuizQuestion: PracticeQuizQuestionSchema,
  PracticeGamification: PracticeGamificationSchema,
  StartSessionRequest: StartSessionRequestSchema,
  StartSessionResponse: StartSessionResponseSchema,
  CheckAnswerRequest: CheckAnswerRequestSchema,
  CheckAnswerResponse: CheckAnswerResponseSchema,
  SubmitSessionRequest: SubmitSessionRequestSchema,
  SubmitSessionResponse: SubmitSessionResponseSchema,
  ListSessionsQuery: ListSessionsQuerySchema,
  SessionListItem: SessionListItemSchema,
  SessionListStats: SessionListStatsSchema,
  SessionListMeta: SessionListMetaSchema,
  SessionListResponse: SessionListResponseSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

/** Registers the four practice session endpoints (BE-12). Bodies are `{ data }` or `{ error }`. */
export function registerPracticePaths(registry: OpenAPIRegistry): void {
  const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })
  const csrf = z.object({
    'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
  })
  const unauthorized = err('UNAUTHORIZED: no valid session.')
  const csrfInvalid = 'CSRF_INVALID (missing or wrong X-CSRF-Token).'
  const notYours = err('NOT_FOUND "Rekod tidak dijumpai." (unknown session, or a session of another user).')

  registry.registerPath({
    method: 'post',
    path: '/practice/sessions',
    tags: ['practice'],
    summary: 'Start a practice session',
    description:
      'Any signed-in user. Questions are served without the key or the explanation. Mission starts resume an in-progress session. A repeated clientUuid returns the same session (status code of the replay is an open question).',
    request: { headers: [csrf], body: body(StartSessionRequestSchema) },
    responses: {
      201: json(envelopeOf(StartSessionResponseSchema), 'Session started.'),
      401: unauthorized,
      402: err('TRIAL_EXHAUSTED "Baki percubaan percuma anda telah habis." (not subscribed, no trial left).'),
      403: err(csrfInvalid),
      404: err('NOT_FOUND "Rekod tidak dijumpai." (unknown subject, chapter, mission, remedial test, question set or ramalan set).'),
      409: err(
        'CHAPTER_LOCKED "Bab ini masih dikunci."; ALREADY_COMPLETED "Misi ini sudah diselesaikan." (mission) or "Ujian ini sudah selesai." (remedial); NO_ATTEMPTS_LEFT "Tiada percubaan lagi untuk set ini.".',
      ),
      422: err(
        'VALIDATION_ERROR "Nilai tidak sah." with fields (mode, levelId, difficulty, count, targetQuestionId); NOT_ENOUGH_QUESTIONS "Soalan tidak mencukupi."; SET_NOT_READY "Soalan tidak mencukupi."; NO_WRONG_QUESTIONS "Maaf, terdapat masalah memuatkan kuiz ulang kaji.".',
      ),
      429: RATE_LIMITED_RESPONSE,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/practice/sessions/{id}/check-answer',
    tags: ['practice'],
    summary: 'Check one answer',
    description:
      'One check per question per session: a repeat returns the stored result. +1 trial use per first check while not subscribed. Only the session owner may call it.',
    request: { params: PracticeSessionParamsSchema, headers: [csrf], body: body(CheckAnswerRequestSchema) },
    responses: {
      200: json(envelopeOf(CheckAnswerResponseSchema), 'Result of the check; the key is revealed here by design.'),
      401: unauthorized,
      403: err(csrfInvalid),
      404: notYours,
      409: err('ALREADY_SUBMITTED "Sesi ini sudah dihantar.".'),
      422: err('VALIDATION_ERROR "Jawapan tidak sah." (fields.questionId when not in the session, fields.selectedOptionId when out of range).'),
      429: RATE_LIMITED_RESPONSE,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/practice/sessions/{id}/submit',
    tags: ['practice'],
    summary: 'Submit (complete) a session',
    description:
      'Grades the stored checks and, in one transaction, writes the answer rows, revision queue, mastery, session totals and wallet/streak credit. timeSpent is coerced, never rejected: a non-number counts as 0 and the stored value is clamped to [0, 180 x questionCount]. Only the session owner may call it.',
    request: { params: PracticeSessionParamsSchema, headers: [csrf], body: body(SubmitSessionRequestSchema) },
    responses: {
      200: json(envelopeOf(SubmitSessionResponseSchema), 'Session completed.'),
      401: unauthorized,
      403: err(csrfInvalid),
      404: notYours,
      409: err('ALREADY_SUBMITTED "Sesi ini sudah dihantar." (second submit).'),
      429: RATE_LIMITED_RESPONSE,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/practice/sessions',
    tags: ['practice'],
    summary: 'Own completed sessions (history)',
    description: 'Newest first. Not paged when neither page nor pageSize is given.',
    request: { query: ListSessionsQuerySchema },
    responses: {
      200: json(SessionListResponseSchema, 'Sessions with meta.activeType and meta.stats.'),
      401: unauthorized,
      422: err('VALIDATION_ERROR "Mod tidak sah." with fields.modes.'),
    },
  })
}
