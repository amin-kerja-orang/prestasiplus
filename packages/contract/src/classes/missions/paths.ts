import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import {
  MissionStatusSchema,
  MissionTodayResponseSchema,
  MissionTodaySchema,
  MissionTypeSchema,
  RemedialCancelFieldErrorSchema,
  RemedialCancelRequestSchema,
  RemedialCancelResponseSchema,
  RemedialGenerateFieldErrorSchema,
  RemedialGenerateRefusedSchema,
  RemedialGenerateRequestSchema,
  RemedialGenerateResponseSchema,
  RemedialMineItemSchema,
  RemedialMineResponseSchema,
  RemedialNotYourStudentSchema,
  RemedialPreviewQuestionSchema,
  RemedialPreviewSchema,
  RemedialProgressSchema,
  RemedialScanSchema,
  RemedialStatusSchema,
  RemedialTestNotActiveSchema,
  RemedialTestNotFoundSchema,
} from './schema'

/** Components contributed by BE-18 (missions and remedial half; spread into COMPONENT_SCHEMAS). */
export const MISSIONS_COMPONENT_SCHEMAS = {
  MissionType: MissionTypeSchema,
  MissionStatus: MissionStatusSchema,
  MissionToday: MissionTodaySchema,
  MissionTodayResponse: MissionTodayResponseSchema,
  RemedialStatus: RemedialStatusSchema,
  RemedialMineItem: RemedialMineItemSchema,
  RemedialMineResponse: RemedialMineResponseSchema,
  RemedialPreviewQuestion: RemedialPreviewQuestionSchema,
  RemedialPreview: RemedialPreviewSchema,
  RemedialProgress: RemedialProgressSchema,
  RemedialScan: RemedialScanSchema,
  RemedialGenerateRequest: RemedialGenerateRequestSchema,
  RemedialGenerateResponse: RemedialGenerateResponseSchema,
  RemedialCancelRequest: RemedialCancelRequestSchema,
  RemedialCancelResponse: RemedialCancelResponseSchema,
  RemedialGenerateFieldError: RemedialGenerateFieldErrorSchema,
  RemedialGenerateRefused: RemedialGenerateRefusedSchema,
  RemedialNotYourStudent: RemedialNotYourStudentSchema,
  RemedialCancelFieldError: RemedialCancelFieldErrorSchema,
  RemedialTestNotFound: RemedialTestNotFoundSchema,
  RemedialTestNotActive: RemedialTestNotActiveSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })

const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
const idParam = z.object({ id: IdSchema })

const unauthorized = err('UNAUTHORIZED ("Unauthenticated."): no valid session.')
const teacherOnly = err('FORBIDDEN ("This action is unauthorized."): role is not teacher or admin; or CSRF_INVALID on a mutation.')

/** Registers the BE-18 missions and remedial endpoints. Bodies are `{ data }`, `{ data, meta }` or bare, as the mock. */
export function registerMissionsPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/missions/today',
    tags: ['missions'],
    summary: 'Missions of today for the signed-in user (M05 #21)',
    description:
      'Any signed-in user (no role check). The M10 missions whose mission date is today (Malaysia day) and whose stored recipients include the caller, oldest first, with the caller\'s status from practice sessions linked by missionId (completed beats in progress, none gives new). Empty list when none. Single page.',
    responses: { 200: json(MissionTodayResponseSchema, 'Missions of today.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'get',
    path: '/remedial-tests/mine',
    tags: ['remedial'],
    summary: 'Own remedial tests (M05 #20)',
    description:
      'Any signed-in user. Only the caller\'s tests with status active or completed (cancelled never, BR-32), newest first. Single page.',
    responses: { 200: json(RemedialMineResponseSchema, 'Remedial tests of the caller.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'get',
    path: '/remedial-tests/{id}',
    tags: ['remedial'],
    summary: 'Read-only preview of a remedial test (M05 #20b, provisional in the SRS)',
    description:
      'SECURITY: the response carries the answer key (correctOptionId). Allowed only for the test\'s own teacher and for an admin; every other caller, including the assigned student, and an unknown id get 404 with the generic text. Writes nothing.',
    request: { params: idParam },
    responses: {
      200: json(envelopeOf(RemedialPreviewSchema), 'The test with its questions in stored order.'),
      401: unauthorized,
      404: err('NOT_FOUND ("Not Found."): unknown id, or the caller is not the owner teacher or an admin.'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/remedial-progress',
    tags: ['remedial'],
    summary: 'Remedial progress of the signed-in teacher (S3, BR-M10-13)',
    description: 'Teacher or admin. Bare body (no data envelope). Own tests only.',
    responses: { 200: json(RemedialProgressSchema, 'Stats and one row per test, newest first.'), 401: unauthorized, 403: teacherOnly },
  })

  const cc = '/guru/command-center/remedial'

  registry.registerPath({
    method: 'get',
    path: `${cc}/scan`,
    tags: ['remedial'],
    summary: 'Weak-topic scan of the caller\'s students (BR-M10-11)',
    description:
      'Teacher or admin. Bare body. Scope: the distinct students of the caller\'s active classes. A topic (DSKP SP, else the chapter) is weak with at least 2 answers and accuracy below 50; topics ascend by accuracy, students by weakest accuracy then id. existingRemedials lists the caller\'s active and completed tests.',
    responses: { 200: json(RemedialScanSchema, 'Weak students and existing tests.'), 401: unauthorized, 403: teacherOnly },
  })

  registry.registerPath({
    method: 'post',
    path: `${cc}/generate`,
    tags: ['remedial'],
    summary: 'Generate an active remedial test for one of the caller\'s students (BR-M10-12)',
    description:
      'Teacher or admin. Up to 10 questions (answered wrongly in the weak topics, then top-up per weak topic, then the subject pool at the student\'s level). 422 with fields: studentId and subject are reported together; the unknown subject is a second 422 with fields.subject. 422 without fields: the refusals RemedialGenerateRefused. 403 "Pelajar ini bukan murid anda." when the student is not one of the caller\'s students (checked before the subject).',
    request: { headers: [csrf], body: body(RemedialGenerateRequestSchema) },
    responses: {
      201: json(RemedialGenerateResponseSchema, 'Bare { quizId, totalQuestions }.'),
      401: unauthorized,
      403: json(
        z.union([RemedialNotYourStudentSchema, ErrorBodySchema]),
        'FORBIDDEN "Pelajar ini bukan murid anda."; or the generic role text; or CSRF_INVALID.',
      ),
      422: json(z.union([RemedialGenerateFieldErrorSchema, RemedialGenerateRefusedSchema]), 'VALIDATION_ERROR with fields, or without fields (typed refusal).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: `${cc}/cancel`,
    tags: ['remedial'],
    summary: 'Cancel an active remedial test of the caller',
    description:
      'Teacher or admin. Deliberate deviation from card AC2 ("cancel is idempotent") in favour of the mock: a repeat cancel answers 409 "Ujian remedial ini tidak aktif.", not 200. A test of another teacher answers 404 like an unknown id, also for an admin.',
    request: { headers: [csrf], body: body(RemedialCancelRequestSchema) },
    responses: {
      200: json(RemedialCancelResponseSchema, 'Bare { success: true }.'),
      401: unauthorized,
      403: teacherOnly,
      404: json(RemedialTestNotFoundSchema, 'NOT_FOUND "Ujian remedial tidak dijumpai.".'),
      409: json(RemedialTestNotActiveSchema, 'CONFLICT "Ujian remedial ini tidak aktif.".'),
      422: json(RemedialCancelFieldErrorSchema, 'VALIDATION_ERROR fields.quizId "ID ujian tidak sah.".'),
    },
  })

}
