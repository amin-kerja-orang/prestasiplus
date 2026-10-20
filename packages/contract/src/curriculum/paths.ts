import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf, listEnvelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import { rateLimitedResponse } from '../schools/http'
import {
  CURRICULUM_CONFLICT_MESSAGES as CF,
  CURRICULUM_FLASH_MESSAGES as FLASH,
  CURRICULUM_NOT_FOUND_MESSAGES as NF,
  CurriculumActiveStateSchema,
  CurriculumChapterCreateSchema,
  CurriculumChapterDeletedSchema,
  CurriculumChapterDetailSchema,
  CurriculumChapterNodeSchema,
  CurriculumChapterSchema,
  CurriculumChapterUpdateSchema,
  CurriculumDeletedOneSchema,
  CurriculumEducationLevelListItemSchema,
  CurriculumEducationLevelLookupSchema,
  CurriculumEducationLevelSchema,
  CurriculumEducationLevelWriteSchema,
  CurriculumGradeCodeSchema,
  CurriculumLearningMapQuerySchema,
  CurriculumLearningMapSchema,
  CurriculumLegacySubjectCodeSchema,
  CurriculumNodeKindSchema,
  CurriculumNodeSchema,
  CurriculumRefSchema,
  CurriculumSetActiveRequestSchema,
  CurriculumStageSchema,
  CurriculumSubjectListItemSchema,
  CurriculumSubjectLookupSchema,
  CurriculumSubjectSchema,
  CurriculumSubjectWriteSchema,
  CurriculumSubtopicCreateSchema,
  CurriculumSubtopicSchema,
  CurriculumSubtopicUpdateSchema,
  CurriculumTopicCardSchema,
  CurriculumTopicCreateSchema,
  CurriculumTopicDeletedSchema,
  CurriculumTopicDetailLearnerSchema,
  CurriculumTopicDetailSchema,
  CurriculumTopicNodeSchema,
  CurriculumTopicSchema,
  CurriculumTopicStateSchema,
  CurriculumTopicUpdateSchema,
  CurriculumTopicsQuerySchema,
  CurriculumTpSchema,
  CurriculumTreeQuerySchema,
  CurriculumTreeSchema,
  CurriculumTreeStatsSchema,
  curriculumStatusEnvelopeOf as withStatus,
} from './schema'

/** Components contributed by BE-08 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const CURRICULUM_COMPONENT_SCHEMAS = {
  CurriculumRef: CurriculumRefSchema,
  CurriculumStage: CurriculumStageSchema,
  CurriculumEducationLevel: CurriculumEducationLevelSchema,
  CurriculumEducationLevelListItem: CurriculumEducationLevelListItemSchema,
  CurriculumEducationLevelWrite: CurriculumEducationLevelWriteSchema,
  CurriculumEducationLevelLookup: CurriculumEducationLevelLookupSchema,
  CurriculumSubject: CurriculumSubjectSchema,
  CurriculumSubjectListItem: CurriculumSubjectListItemSchema,
  CurriculumSubjectWrite: CurriculumSubjectWriteSchema,
  CurriculumSubjectLookup: CurriculumSubjectLookupSchema,
  CurriculumSetActiveRequest: CurriculumSetActiveRequestSchema,
  CurriculumActiveState: CurriculumActiveStateSchema,
  CurriculumDeletedOne: CurriculumDeletedOneSchema,
  CurriculumChapter: CurriculumChapterSchema,
  CurriculumTopic: CurriculumTopicSchema,
  CurriculumSubtopic: CurriculumSubtopicSchema,
  CurriculumChapterDetail: CurriculumChapterDetailSchema,
  CurriculumTopicDetail: CurriculumTopicDetailSchema,
  CurriculumTopicNode: CurriculumTopicNodeSchema,
  CurriculumChapterNode: CurriculumChapterNodeSchema,
  CurriculumTreeStats: CurriculumTreeStatsSchema,
  CurriculumTree: CurriculumTreeSchema,
  CurriculumTreeQuery: CurriculumTreeQuerySchema,
  CurriculumChapterCreate: CurriculumChapterCreateSchema,
  CurriculumChapterUpdate: CurriculumChapterUpdateSchema,
  CurriculumTopicCreate: CurriculumTopicCreateSchema,
  CurriculumTopicUpdate: CurriculumTopicUpdateSchema,
  CurriculumSubtopicCreate: CurriculumSubtopicCreateSchema,
  CurriculumSubtopicUpdate: CurriculumSubtopicUpdateSchema,
  CurriculumChapterDeleted: CurriculumChapterDeletedSchema,
  CurriculumTopicDeleted: CurriculumTopicDeletedSchema,
  CurriculumGradeCode: CurriculumGradeCodeSchema,
  CurriculumLegacySubjectCode: CurriculumLegacySubjectCodeSchema,
  CurriculumTopicState: CurriculumTopicStateSchema,
  CurriculumTopicsQuery: CurriculumTopicsQuerySchema,
  CurriculumTopicCard: CurriculumTopicCardSchema,
  CurriculumLearnerTopicDetail: CurriculumTopicDetailLearnerSchema,
  CurriculumLearningMapQuery: CurriculumLearningMapQuerySchema,
  CurriculumLearningMap: CurriculumLearningMapSchema,
  CurriculumNodeKind: CurriculumNodeKindSchema,
  CurriculumTp: CurriculumTpSchema,
  CurriculumNode: CurriculumNodeSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })

const idParams = z.object({ id: IdSchema })
const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})

const UNAUTHORIZED = err('UNAUTHORIZED: no valid session.')
const ADMIN_ONLY = err('FORBIDDEN: not an admin, or CSRF_INVALID on a mutating call.')
const notFound = (message: string) => err(`NOT_FOUND with message "${message}"`)
const invalid = (extra = '') =>
  err(`VALIDATION_ERROR with fields (Laravel-style copy, e.g. "The selected :attribute is invalid.")${extra}`)

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

/** Registers the 29 M03 endpoints. Every body is `{ data }`, `{ data, meta }`, `{ data, status }` or `{ error }`. */
export function registerCurriculumPaths(registry: OpenAPIRegistry): void {
  const admin = (
    method: Method,
    path: string,
    summary: string,
    opts: {
      tag: string
      params?: boolean
      query?: z.ZodObject
      req?: z.ZodType
      ok: { status: 200 | 201; schema: z.ZodType; text: string }
      notFound?: string
      validation?: boolean
      /** The 409 copy of a delete that still has children. */
      conflict?: string
      description?: string
    },
  ) =>
    registry.registerPath({
      method,
      path,
      tags: [opts.tag],
      summary,
      ...(opts.description ? { description: opts.description } : {}),
      request: {
        ...(opts.params ? { params: idParams } : {}),
        ...(opts.query ? { query: opts.query } : {}),
        ...(method === 'get' ? {} : { headers: [csrf] }),
        ...(opts.req ? { body: body(opts.req) } : {}),
      },
      responses: {
        [opts.ok.status]: json(opts.ok.schema, opts.ok.text),
        401: UNAUTHORIZED,
        403: ADMIN_ONLY,
        ...(opts.notFound ? { 404: notFound(opts.notFound) } : {}),
        ...(opts.conflict ? { 409: err(`CONFLICT with message "${opts.conflict}"; nothing is deleted.`) } : {}),
        ...(opts.validation ? { 422: invalid() } : {}),
        // Every admin write is rate limited per user (D57a, BE-08 follow-up); admin reads are not.
        ...(method === 'get' ? {} : { 429: rateLimitedResponse }),
      },
    })

  // --- Learner reads (any session) ---
  const learner = (
    path: string,
    summary: string,
    schema: z.ZodType,
    extra: { query?: z.ZodObject; params?: boolean; notFound?: boolean; description?: string },
  ) =>
    registry.registerPath({
      method: 'get',
      path,
      tags: ['curriculum'],
      summary,
      ...(extra.description ? { description: extra.description } : {}),
      request: { ...(extra.params ? { params: idParams } : {}), ...(extra.query ? { query: extra.query } : {}) },
      responses: {
        200: json(schema, 'OK.'),
        401: UNAUTHORIZED,
        ...(extra.notFound ? { 404: err('NOT_FOUND.') } : {}),
      },
    })

  learner('/education-levels', 'Active education levels', listEnvelopeOf(CurriculumEducationLevelLookupSchema), {
    description: 'Unpaged list envelope. Active levels only, ordered by `order` then id.',
  })
  learner('/subjects', 'Active subjects', listEnvelopeOf(CurriculumSubjectLookupSchema), {
    query: z.object({ educationLevelId: z.string().optional() }),
    description:
      'Unpaged. Active subjects only, ordered by `order` then id. An unknown `educationLevelId` is ignored (no filter).',
  })
  learner('/topics', 'Topic catalogue (S12)', listEnvelopeOf(CurriculumTopicCardSchema), {
    query: CurriculumTopicsQuerySchema,
    description: 'Unpaged. Case-insensitive AND filters, ordered by sequence then id; unknown codes return an empty list.',
  })
  learner('/topics/{id}', 'Topic detail with the current user progress (S13)', envelopeOf(CurriculumTopicDetailLearnerSchema), {
    params: true,
    notFound: true,
    description: 'Progress is read through the progress provider (BE-13); with no progress it is 0.',
  })
  learner('/learning-map', 'Peta Belajar (S14)', envelopeOf(CurriculumLearningMapSchema), {
    query: CurriculumLearningMapQuerySchema,
    description: 'Empty `subject` = MATEMATIK; `grade` outside DARJAH_1..DARJAH_4 = DARJAH_4.',
  })

  // --- Admin education levels ---
  const L = FLASH.level
  admin('get', '/admin/education-levels', 'List education levels (admin)', {
    tag: 'curriculum-admin',
    ok: { status: 200, schema: listEnvelopeOf(CurriculumEducationLevelListItemSchema), text: 'Unpaged; all levels, order then id.' },
  })
  admin('get', '/admin/education-levels/{id}', 'Get an education level', {
    tag: 'curriculum-admin', params: true, notFound: NF.level,
    ok: { status: 200, schema: envelopeOf(CurriculumEducationLevelSchema), text: 'The level.' },
  })
  admin('post', '/admin/education-levels', 'Create an education level', {
    tag: 'curriculum-admin', req: CurriculumEducationLevelWriteSchema, validation: true,
    ok: { status: 201, schema: withStatus(CurriculumEducationLevelSchema), text: `Created; status "${L.created}"` },
    description: 'Code is stored upper-case and unique case-insensitively (422 "The code has already been taken.").',
  })
  admin('put', '/admin/education-levels/{id}', 'Update an education level', {
    tag: 'curriculum-admin', params: true, req: CurriculumEducationLevelWriteSchema, notFound: NF.level, validation: true,
    ok: { status: 200, schema: withStatus(CurriculumEducationLevelSchema), text: `Updated; status "${L.updated}"` },
  })
  admin('patch', '/admin/education-levels/{id}/active', 'Activate or deactivate an education level', {
    tag: 'curriculum-admin', params: true, req: CurriculumSetActiveRequestSchema, notFound: NF.level, validation: true,
    ok: { status: 200, schema: envelopeOf(CurriculumActiveStateSchema), text: 'The new state (no status flash).' },
  })
  admin('delete', '/admin/education-levels/{id}', 'Delete an education level', {
    tag: 'curriculum-admin', params: true, notFound: NF.level, conflict: CF.level,
    ok: { status: 200, schema: withStatus(CurriculumDeletedOneSchema), text: `Deleted; status "${L.deleted}"` },
    description:
      '409 CONFLICT (and nothing deleted) while the level still has linked subjects, chapters (in the tree or not) or DSKP nodes; only an empty level is deleted. Supersedes the BR-10 cascade (LEAD 2026-10-20).',
  })

  // --- Admin subjects ---
  const S = FLASH.subject
  admin('get', '/admin/subjects', 'List subjects (admin)', {
    tag: 'curriculum-admin',
    ok: { status: 200, schema: listEnvelopeOf(CurriculumSubjectListItemSchema), text: 'Unpaged; all subjects, order then id.' },
  })
  admin('get', '/admin/subjects/{id}', 'Get a subject', {
    tag: 'curriculum-admin', params: true, notFound: NF.subject,
    ok: { status: 200, schema: envelopeOf(CurriculumSubjectSchema), text: 'The subject.' },
  })
  admin('post', '/admin/subjects', 'Create a subject', {
    tag: 'curriculum-admin', req: CurriculumSubjectWriteSchema, validation: true,
    ok: { status: 201, schema: withStatus(CurriculumSubjectSchema), text: `Created (isActive true); status "${S.created}"` },
  })
  admin('put', '/admin/subjects/{id}', 'Update a subject', {
    tag: 'curriculum-admin', params: true, req: CurriculumSubjectWriteSchema, notFound: NF.subject, validation: true,
    ok: { status: 200, schema: withStatus(CurriculumSubjectSchema), text: `Updated; status "${S.updated}"` },
  })
  admin('patch', '/admin/subjects/{id}/active', 'Activate or deactivate a subject', {
    tag: 'curriculum-admin', params: true, req: CurriculumSetActiveRequestSchema, notFound: NF.subject, validation: true,
    ok: { status: 200, schema: envelopeOf(CurriculumActiveStateSchema), text: 'The new state (no status flash).' },
  })
  admin('delete', '/admin/subjects/{id}', 'Delete a subject', {
    tag: 'curriculum-admin', params: true, notFound: NF.subject, conflict: CF.subject,
    ok: { status: 200, schema: withStatus(CurriculumDeletedOneSchema), text: `Deleted; status "${S.deleted}"` },
    description:
      '409 CONFLICT (and nothing deleted) while the subject still has level links, chapters (in the tree or not), DSKP nodes or TP descriptors; only an empty subject is deleted. Supersedes the BR-10 cascade (LEAD 2026-10-20).',
  })

  // --- Admin curriculum tree ---
  const C = FLASH.chapter
  const T = FLASH.topic
  const ST = FLASH.subtopic
  admin('get', '/admin/curriculum', 'Curriculum tree of one subject and level (S1)', {
    tag: 'curriculum-admin', query: CurriculumTreeQuerySchema,
    ok: { status: 200, schema: envelopeOf(CurriculumTreeSchema), text: 'In-tree chapters with topics and subtopics; stats include inactive records.' },
    notFound: `${NF.subject} or ${NF.level}`, validation: true,
    description: '422 fields.subjectId / fields.educationLevelId: "The subject id field is required." / "The education level id field is required.".',
  })
  admin('get', '/admin/curriculum/chapters/{id}', 'Get a chapter', {
    tag: 'curriculum-admin', params: true, notFound: NF.chapter,
    ok: { status: 200, schema: envelopeOf(CurriculumChapterDetailSchema), text: 'Chapter with subject and level refs.' },
  })
  admin('post', '/admin/curriculum/chapters', 'Create a chapter', {
    tag: 'curriculum-admin', req: CurriculumChapterCreateSchema, validation: true,
    ok: { status: 201, schema: withStatus(CurriculumChapterSchema), text: `Created (isActive true, inTree true); status "${C.created}"` },
  })
  admin('put', '/admin/curriculum/chapters/{id}', 'Update a chapter', {
    tag: 'curriculum-admin', params: true, req: CurriculumChapterUpdateSchema, notFound: NF.chapter, validation: true,
    ok: { status: 200, schema: withStatus(CurriculumChapterSchema), text: `Updated; status "${C.updated}"` },
  })
  admin('delete', '/admin/curriculum/chapters/{id}', 'Delete a chapter', {
    tag: 'curriculum-admin', params: true, notFound: NF.chapter, conflict: CF.chapter,
    ok: { status: 200, schema: withStatus(CurriculumChapterDeletedSchema), text: `Deleted; status "${C.deleted}"` },
    description: '409 CONFLICT (and nothing deleted) while the chapter still has topics, so `deleted.topics` and `deleted.subtopics` are always 0.',
  })
  admin('get', '/admin/curriculum/topics/{id}', 'Get a topic', {
    tag: 'curriculum-admin', params: true, notFound: NF.topic,
    ok: { status: 200, schema: envelopeOf(CurriculumTopicDetailSchema), text: 'Topic with its chapter (and subject and level refs).' },
  })
  admin('post', '/admin/curriculum/topics', 'Create a topic', {
    tag: 'curriculum-admin', req: CurriculumTopicCreateSchema, validation: true,
    ok: { status: 201, schema: withStatus(CurriculumTopicSchema), text: `Created; status "${T.created}"` },
  })
  admin('put', '/admin/curriculum/topics/{id}', 'Update a topic', {
    tag: 'curriculum-admin', params: true, req: CurriculumTopicUpdateSchema, notFound: NF.topic, validation: true,
    ok: { status: 200, schema: withStatus(CurriculumTopicSchema), text: `Updated; status "${T.updated}"` },
  })
  admin('delete', '/admin/curriculum/topics/{id}', 'Delete a topic', {
    tag: 'curriculum-admin', params: true, notFound: NF.topic, conflict: CF.topic,
    ok: { status: 200, schema: withStatus(CurriculumTopicDeletedSchema), text: `Deleted; status "${T.deleted}"` },
    description: '409 CONFLICT (and nothing deleted) while the topic still has subtopics, so `deleted.subtopics` is always 0.',
  })
  admin('post', '/admin/curriculum/subtopics', 'Create a subtopic', {
    tag: 'curriculum-admin', req: CurriculumSubtopicCreateSchema, validation: true,
    ok: { status: 201, schema: withStatus(CurriculumSubtopicSchema), text: `Created (appended last); status "${ST.created}"` },
  })
  admin('put', '/admin/curriculum/subtopics/{id}', 'Update a subtopic', {
    tag: 'curriculum-admin', params: true, req: CurriculumSubtopicUpdateSchema, notFound: NF.subtopic, validation: true,
    ok: { status: 200, schema: withStatus(CurriculumSubtopicSchema), text: `Updated; status "${ST.updated}"` },
  })
  admin('delete', '/admin/curriculum/subtopics/{id}', 'Delete a subtopic', {
    tag: 'curriculum-admin', params: true, notFound: NF.subtopic,
    ok: { status: 200, schema: withStatus(CurriculumDeletedOneSchema), text: `Deleted; status "${ST.deleted}"` },
  })
}
