import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { envelopeOf, listEnvelopeOf } from '../common/envelope'
import { IdSchema } from '../common/ids'
import {
  ClassCreateRequestSchema,
  ClassEducationLevelSlugSchema,
  ClassEnrolmentSchema,
  ClassEnrolmentSourceSchema,
  ClassEnrolmentStatusSchema,
  ClassJoinRequestSchema,
  ClassJoinResponseSchema,
  ClassJoinResultSchema,
  ClassJoinedClassSchema,
  ClassQrDataSchema,
  ClassStudentAddRequestSchema,
  ClassStudentRemoveQuerySchema,
  ClassStudentRemovedSchema,
  ClassroomKindSchema,
  TeacherChapterCreateRequestSchema,
  TeacherChapterOptionSchema,
  TeacherChaptersQuerySchema,
  TeacherClassSchema,
  TeacherContributionsSchema,
  TeacherDashboardSchema,
  TeacherGalleryQuerySchema,
  TeacherGallerySchema,
  TeacherStudentSchema,
  TeacherStudentsMetaSchema,
  TeacherStudentsQuerySchema,
  TeacherTopicCreateRequestSchema,
  TeacherTopicOptionSchema,
  TeacherTopicsQuerySchema,
} from './schema'

/** Components contributed by BE-17 (spread into COMPONENT_SCHEMAS in openapi.ts). */
export const CLASSES_COMPONENT_SCHEMAS = {
  ClassEducationLevelSlug: ClassEducationLevelSlugSchema,
  ClassroomKind: ClassroomKindSchema,
  ClassEnrolmentStatus: ClassEnrolmentStatusSchema,
  ClassEnrolmentSource: ClassEnrolmentSourceSchema,
  TeacherClass: TeacherClassSchema,
  ClassCreateRequest: ClassCreateRequestSchema,
  ClassQrData: ClassQrDataSchema,
  TeacherStudentsQuery: TeacherStudentsQuerySchema,
  TeacherStudent: TeacherStudentSchema,
  TeacherStudentsMeta: TeacherStudentsMetaSchema,
  ClassStudentAddRequest: ClassStudentAddRequestSchema,
  ClassStudentRemoveQuery: ClassStudentRemoveQuerySchema,
  ClassEnrolment: ClassEnrolmentSchema,
  ClassStudentRemoved: ClassStudentRemovedSchema,
  TeacherDashboard: TeacherDashboardSchema,
  TeacherChaptersQuery: TeacherChaptersQuerySchema,
  TeacherTopicsQuery: TeacherTopicsQuerySchema,
  TeacherChapterOption: TeacherChapterOptionSchema,
  TeacherTopicOption: TeacherTopicOptionSchema,
  TeacherChapterCreateRequest: TeacherChapterCreateRequestSchema,
  TeacherTopicCreateRequest: TeacherTopicCreateRequestSchema,
  TeacherContributions: TeacherContributionsSchema,
  TeacherGalleryQuery: TeacherGalleryQuerySchema,
  TeacherGallery: TeacherGallerySchema,
  ClassJoinedClass: ClassJoinedClassSchema,
  ClassJoinRequest: ClassJoinRequestSchema,
  ClassJoinResult: ClassJoinResultSchema,
  ClassJoinResponse: ClassJoinResponseSchema,
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

const unauthorized = err('UNAUTHORIZED: no valid session ("Unauthenticated.").')
const teacherOnly = err('FORBIDDEN ("This action is unauthorized."): role is not teacher; or CSRF_INVALID on a mutation.')

/** Registers the BE-17 endpoints. Success bodies follow the mock: `{ data }`, `{ data, meta }` or bare. */
export function registerClassesPaths(registry: OpenAPIRegistry): void {
  const teacher = { tags: ['classes'] }

  registry.registerPath({
    method: 'get',
    path: '/guru/classes',
    ...teacher,
    summary: 'Own classes (newest first, active and inactive)',
    description: 'Single-page list meta (page 1, pageSize = max(1, n)); live does not paginate.',
    responses: {
      200: json(listEnvelopeOf(TeacherClassSchema), 'The own classes.'),
      401: unauthorized,
      403: teacherOnly,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/guru/classes',
    ...teacher,
    summary: 'Create a class with a server-generated unique join code',
    description:
      'Owner is the caller, isActive true, academic year from the clock. The join code is never accepted from the client.',
    request: { headers: [csrf], body: body(ClassCreateRequestSchema) },
    responses: {
      201: json(envelopeOf(TeacherClassSchema), 'The created class.'),
      401: unauthorized,
      403: teacherOnly,
      422: err('VALIDATION_ERROR with fields: name, subjectId, educationLevel, schoolId, description.'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/classes/{id}/qr-data',
    ...teacher,
    summary: 'Join-QR payload of an own class (bare body)',
    request: { params: idParam },
    responses: {
      200: json(ClassQrDataSchema, 'Bare `{ name, school, joinUrl }`.'),
      401: unauthorized,
      403: teacherOnly,
      404: err('NOT_FOUND "Not Found.": unknown, not owned, or a school class (never names a model).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/students',
    ...teacher,
    summary: 'Pelajar Saya: roster of own classes, or students of the teacher profile school',
    description:
      'tab=mine: distinct pupils with an active enrolment in an active own class. tab=school: active students of the teacher-profile school, at most 200 rows. Ordered by name A-Z then id.',
    request: { query: TeacherStudentsQuerySchema },
    responses: {
      200: json(
        z.object({ data: z.array(TeacherStudentSchema), meta: TeacherStudentsMetaSchema }),
        'Students and `{ count, schoolSet }` (not the standard list meta).',
      ),
      401: unauthorized,
      403: teacherOnly,
    },
  })

  registry.registerPath({
    method: 'put',
    path: '/guru/students/{id}',
    ...teacher,
    summary: 'Add a student of the teacher school to an own class',
    description:
      'Checks in order: classroomId (422), student exists and is a student (404), class exists (404), class owned (403), same school (403), not already a member (409).',
    request: { headers: [csrf], params: idParam, body: body(ClassStudentAddRequestSchema) },
    responses: {
      200: json(envelopeOf(ClassEnrolmentSchema), 'The active enrolment (source "teacher").'),
      401: unauthorized,
      403: err(
        'FORBIDDEN "Kelas ini bukan milik anda." or "Pelajar bukan daripada sekolah anda."; or role / CSRF_INVALID.',
      ),
      404: err('NOT_FOUND "Pelajar tidak dijumpai." or "Kelas tidak sah."'),
      409: err('CONFLICT "Pelajar sudah berada dalam kelas ini."'),
      422: err('VALIDATION_ERROR fields.classroomId "Kelas tidak sah."'),
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/guru/students/{id}',
    ...teacher,
    summary: 'Remove a student from an own class (enrolment status becomes removed)',
    request: { headers: [csrf], params: idParam, query: ClassStudentRemoveQuerySchema },
    responses: {
      200: json(envelopeOf(ClassStudentRemovedSchema), '`{ data: { removed: 1 } }`.'),
      401: unauthorized,
      403: err('FORBIDDEN "Kelas ini bukan milik anda."; or role / CSRF_INVALID.'),
      404: err('NOT_FOUND "Kelas tidak sah." or "Pelajar tiada dalam kelas ini."'),
      422: err('VALIDATION_ERROR fields.classroomId "Kelas tidak sah."'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/dashboard',
    ...teacher,
    summary: 'Teacher dashboard counters',
    description:
      'All counters are computed from the tables (no stored aggregates). today, peerTutor and submissions are always empty; assignments is 0.',
    responses: { 200: json(envelopeOf(TeacherDashboardSchema), 'Dashboard.'), 401: unauthorized, 403: teacherOnly },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/chapters',
    ...teacher,
    summary: 'Active chapters of a subject and level (bare array; M03 data)',
    request: { query: TeacherChaptersQuerySchema },
    responses: {
      200: json(z.array(TeacherChapterOptionSchema), 'Bare array; `[]` when a parent is missing or unknown.'),
      401: unauthorized,
      403: teacherOnly,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/guru/chapters',
    ...teacher,
    summary: 'Inline "Bab Baru" (creates an M03 chapter)',
    request: { headers: [csrf], body: body(TeacherChapterCreateRequestSchema) },
    responses: {
      201: json(TeacherChapterOptionSchema, 'Bare `{ id, chapterNumber, name }`.'),
      401: unauthorized,
      403: teacherOnly,
      422: err('VALIDATION_ERROR (v2 shape; the mock answers 200 `{ error }`): name, chapterNumber, subjectId/educationLevelId.'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/topics',
    ...teacher,
    summary: 'Active topics of a chapter (bare array; M03 data)',
    request: { query: TeacherTopicsQuerySchema },
    responses: {
      200: json(z.array(TeacherTopicOptionSchema), 'Bare array; `[]` when the chapter is missing or unknown.'),
      401: unauthorized,
      403: teacherOnly,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/guru/topics',
    ...teacher,
    summary: 'Inline "Topik Baru" (creates an M03 topic numbered max + 1)',
    request: { headers: [csrf], body: body(TeacherTopicCreateRequestSchema) },
    responses: {
      201: json(TeacherTopicOptionSchema, 'Bare `{ id, topicNumber, name }`.'),
      401: unauthorized,
      403: teacherOnly,
      422: err('VALIDATION_ERROR (v2 shape; the mock answers 200 `{ error }`): name, chapterId.'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/contributions',
    ...teacher,
    summary: 'Sumbang Soalan header: stats, eight tiers, subject breakdown (bare body)',
    responses: { 200: json(TeacherContributionsSchema, 'Bare contributions body.'), 401: unauthorized, 403: teacherOnly },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/galeri-rajah',
    ...teacher,
    summary: 'Galeri Rajah (empty in the prototype, D22; bare body)',
    request: { query: TeacherGalleryQuerySchema },
    responses: { 200: json(TeacherGallerySchema, '`{ folders: [] }`, or `{ images: [] }` with `folder`.'), 401: unauthorized, 403: teacherOnly },
  })

  registry.registerPath({
    method: 'get',
    path: '/kelas-saya',
    tags: ['classes'],
    summary: 'Classes the signed-in user has joined (newest first)',
    description: 'School classes are not joined classes and are left out. Single-page list meta.',
    responses: { 200: json(listEnvelopeOf(ClassJoinedClassSchema), 'Joined classes.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'post',
    path: '/kelas-saya/join',
    tags: ['classes'],
    summary: 'Join a class by code',
    description:
      'classCode is trimmed and compared case-insensitively. Only student (and admin) may join. The enrolment source is "code".',
    request: { headers: [csrf], body: body(ClassJoinRequestSchema) },
    responses: {
      201: json(ClassJoinResponseSchema, '`{ data: { classroomId }, message }`.'),
      401: unauthorized,
      403: err('FORBIDDEN: role may not join; or CSRF_INVALID.'),
      404: err('NOT_FOUND "Kod kelas tidak sah."'),
      409: err('CONFLICT "Anda sudah menyertai kelas ini."'),
      422: err('VALIDATION_ERROR fields.classCode "Sila masukkan kod kelas."'),
    },
  })
}
