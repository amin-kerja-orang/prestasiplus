import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import {
  PersonalQuestionDeleteResponseSchema,
  PersonalQuestionListQuerySchema,
  PersonalQuestionListResponseSchema,
  PersonalQuestionOptionSchema,
  PersonalQuestionResponseSchema,
  PersonalQuestionSchema,
  PersonalQuestionWriteSchema,
} from './schema'

/** Components contributed by S6-T16 (spread into COMPONENT_SCHEMAS). */
export const TEACHER_TOOLS_COMPONENT_SCHEMAS = {
  PersonalQuestionOption: PersonalQuestionOptionSchema,
  PersonalQuestion: PersonalQuestionSchema,
  PersonalQuestionWrite: PersonalQuestionWriteSchema,
  PersonalQuestionListResponse: PersonalQuestionListResponseSchema,
  PersonalQuestionResponse: PersonalQuestionResponseSchema,
  PersonalQuestionDeleteResponse: PersonalQuestionDeleteResponseSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })

const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
const idParam = z.object({ id: IdSchema })

const unauthorized = err('UNAUTHORIZED ("Sesi anda telah tamat. Sila log masuk semula."): no valid session.')
const teacherOnly = err('FORBIDDEN ("Anda tidak dibenarkan melakukan tindakan ini."): role is not teacher; or CSRF_INVALID on a mutation.')
const notFound = err('NOT_FOUND: the question does not exist or is not the caller\'s own (another teacher\'s id is 404, never 403).')
const invalid = err('VALIDATION_ERROR (422) with `fields`: subjectId, educationLevelId, chapterId, spIds, tp, cognitiveLevel, difficulty, text, options, correctIndex, referenceUrl (BM messages).')
const rateLimited = {
  description: 'RATE_LIMITED (D57): too many writes. Body error.code RATE_LIMITED with retryAfter (seconds); Retry-After header carries the same value.',
  headers: { 'Retry-After': { description: 'Seconds until a retry is allowed.', schema: { type: 'integer' as const } } },
  content: { 'application/json': { schema: ErrorBodySchema } },
}

/** Registers the Soalan & Rujukan endpoints (API-GUR-24). Bodies are `{ data }` or `{ data, meta }`. */
export function registerTeacherToolsPaths(registry: OpenAPIRegistry): void {
  const base = '/guru/personal-questions'

  registry.registerPath({
    method: 'get',
    path: base,
    tags: ['personal-questions'],
    summary: 'Own personal questions (Soalan & Rujukan, API-GUR-24)',
    description: 'Teacher only. The caller\'s own personal questions, newest first, 20 per page; `educationLevelId` filters by Tingkatan. Never lists another teacher\'s question or a bank question.',
    request: { query: PersonalQuestionListQuerySchema },
    responses: { 200: json(PersonalQuestionListResponseSchema, 'Own personal questions.'), 401: unauthorized, 403: teacherOnly },
  })

  registry.registerPath({
    method: 'post',
    path: base,
    tags: ['personal-questions'],
    summary: 'Create a personal question (API-GUR-24)',
    description:
      'Teacher only. Saved already approved with `visibility = teacher_private`, `owner_user_id` = the caller and `created_by_id` NULL; it never enters admin review, the bank, Databank, Set Soalan pickers or any count (FR-GUR-44a-4). Tingkatan 1 to 5 only; `referenceUrl` must start with http:// or https:// (max 2048); the DSKP fields are conditional (D112).',
    request: { headers: csrf, body: body(PersonalQuestionWriteSchema) },
    responses: { 201: json(PersonalQuestionResponseSchema, 'The saved question.'), 401: unauthorized, 403: teacherOnly, 422: invalid, 429: rateLimited },
  })

  registry.registerPath({
    method: 'get',
    path: `${base}/{id}`,
    tags: ['personal-questions'],
    summary: 'One own personal question (API-GUR-24)',
    description: 'Teacher only. The same `PersonalQuestion` shape as a list row. Another teacher\'s id, a bank question id and an unknown id are all 404.',
    request: { params: idParam },
    responses: { 200: json(PersonalQuestionResponseSchema, 'The question.'), 401: unauthorized, 403: teacherOnly, 404: notFound },
  })

  registry.registerPath({
    method: 'put',
    path: `${base}/{id}`,
    tags: ['personal-questions'],
    summary: 'Edit an own personal question (API-GUR-24)',
    description: 'Teacher only. Same body and rules as the create; replaces the content in place. Owner and visibility never change.',
    request: { headers: csrf, params: idParam, body: body(PersonalQuestionWriteSchema) },
    responses: { 200: json(PersonalQuestionResponseSchema, 'The saved question.'), 401: unauthorized, 403: teacherOnly, 404: notFound, 422: invalid, 429: rateLimited },
  })

  registry.registerPath({
    method: 'delete',
    path: `${base}/{id}`,
    tags: ['personal-questions'],
    summary: 'Delete an own personal question (API-GUR-24, ADD-21)',
    description:
      'Teacher only. 409 CONFLICT "Soalan sedang digunakan dalam misi." while an active Misi draws the question: the mission date is today (Malaysia) or later AND a session of that mission holds it. Pool membership alone does not block.',
    request: { headers: csrf, params: idParam },
    responses: {
      200: json(PersonalQuestionDeleteResponseSchema, 'Deleted.'),
      401: unauthorized,
      403: teacherOnly,
      404: notFound,
      409: err('CONFLICT ("Soalan sedang digunakan dalam misi."): an active Misi draws the question.'),
      429: rateLimited,
    },
  })
}
