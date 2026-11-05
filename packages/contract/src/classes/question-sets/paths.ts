import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import {
  GuruSetBankQuerySchema,
  GuruSetBankResponseSchema,
  GuruSetBankStimulusSchema,
  GuruSetBankUnitSchema,
  GuruSetCopyRequestSchema,
  GuruSetDeleteResultSchema,
  GuruSetListQuerySchema,
  GuruSetListResponseSchema,
  GuruSetListSchema,
  GuruSetResultsQuerySchema,
  GuruSetResultsResponseSchema,
  GuruSetResultsSchema,
  GuruSetStatusRequestSchema,
  GuruSetStatusSchema,
  GuruSetUpsertRequestSchema,
  QuestionSetRowSchema,
  QuestionSetSchema,
} from './schema'
import {
  DskpBidangCreateRequestSchema,
  DskpBidangInlineErrorSchema,
  DskpBidangSchema,
  DskpSkCreateRequestSchema,
  DskpSkInlineErrorSchema,
  DskpSkSchema,
  DskpSpCreateRequestSchema,
  DskpSpInlineErrorSchema,
  DskpSpSchema,
  QUESTION_SET_AUDIO_KBAT_TEMPLATE,
  QuestionSetPaperFieldErrorSchema,
  QuestionSetPaperFieldsSchema,
  QuestionSetPaperFileSchema,
  QuestionSetPaperFilesSchema,
  QuestionSetPaperRequestSchema,
  QuestionSetPaperSchema,
  QuestionSetPaperUploadSchema,
  QuestionSetStudentItemSchema,
  QuestionSetStudentListSchema,
} from './schema'

/** Components contributed by BE-18 (question sets, papers and DSKP half; spread into COMPONENT_SCHEMAS). */
export const QUESTION_SETS_COMPONENT_SCHEMAS = {
  GuruSetStatus: GuruSetStatusSchema,
  GuruSetUpsertRequest: GuruSetUpsertRequestSchema,
  GuruSetStatusRequest: GuruSetStatusRequestSchema,
  GuruSetCopyRequest: GuruSetCopyRequestSchema,
  QuestionSetRow: QuestionSetRowSchema,
  QuestionSet: QuestionSetSchema,
  GuruSetList: GuruSetListSchema,
  GuruSetResults: GuruSetResultsSchema,
  GuruSetBankStimulus: GuruSetBankStimulusSchema,
  GuruSetBankUnit: GuruSetBankUnitSchema,
  GuruSetDeleteResult: GuruSetDeleteResultSchema,
  QuestionSetStudentItem: QuestionSetStudentItemSchema,
  QuestionSetStudentList: QuestionSetStudentListSchema,
  QuestionSetPaperFields: QuestionSetPaperFieldsSchema,
  QuestionSetPaperFile: QuestionSetPaperFileSchema,
  QuestionSetPaperFiles: QuestionSetPaperFilesSchema,
  QuestionSetPaperRequest: QuestionSetPaperRequestSchema,
  QuestionSetPaperUpload: QuestionSetPaperUploadSchema,
  QuestionSetPaper: QuestionSetPaperSchema,
  QuestionSetPaperFieldError: QuestionSetPaperFieldErrorSchema,
  DskpBidangCreateRequest: DskpBidangCreateRequestSchema,
  DskpSkCreateRequest: DskpSkCreateRequestSchema,
  DskpSpCreateRequest: DskpSpCreateRequestSchema,
  DskpBidang: DskpBidangSchema,
  DskpSk: DskpSkSchema,
  DskpSp: DskpSpSchema,
  DskpBidangInlineError: DskpBidangInlineErrorSchema,
  DskpSkInlineError: DskpSkInlineErrorSchema,
  DskpSpInlineError: DskpSpInlineErrorSchema,
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

const unauthorized = err('UNAUTHORIZED ("Sesi anda telah tamat. Sila log masuk semula."): no valid session.')
const teacherOnly = err('FORBIDDEN ("Anda tidak dibenarkan melakukan tindakan ini."): role is not teacher or admin; or CSRF_INVALID on a mutation.')
const rateLimited = {
  description: 'RATE_LIMITED (D57): too many writes. Body error.code RATE_LIMITED with retryAfter (seconds); Retry-After header carries the same value.',
  headers: { 'Retry-After': { description: 'Seconds until a retry is allowed.', schema: { type: 'integer' as const } } },
  content: { 'application/json': { schema: ErrorBodySchema } },
}

const download = (contentType: string, fileName: string, description: string) => ({
  description,
  headers: {
    'Content-Disposition': {
      description: `attachment; filename="${fileName}"`,
      schema: { type: 'string' as const },
    },
  },
  content: { [contentType]: { schema: { type: 'string' as const, format: 'binary' } } },
})

/** Registers the BE-18 question set, paper, template and DSKP endpoints. */
export function registerQuestionSetsPaths(registry: OpenAPIRegistry): void {
  registerGuruQuestionSetsPaths(registry)
  registry.registerPath({
    method: 'get',
    path: '/set-soalan-saya',
    tags: ['question-sets'],
    summary: 'Teacher question sets the caller may start (S34, BR-M10-18)',
    description:
      'Any signed-in user (no role check). Sets of the classes the caller is actively enrolled in: draft never, scheduled once due, published always; oldest created first. Single page. A migrated set keeps its header only (Q4): its empty state is an open question.',
    responses: { 200: json(QuestionSetStudentListSchema, 'Sets with attemptsLeft.'), 401: unauthorized },
  })

  registry.registerPath({
    method: 'post',
    path: '/guru/question-papers',
    tags: ['question-sets'],
    summary: 'Upload a question paper (S22, BR-M10-25, FR-M10-98)',
    description:
      'SCOPE: BE-18 owns only this submission request and its validation; storing and processing the uploaded files belongs to BE-37 (intake). Teacher or admin. Multipart. Creates a question bank submission with status pending for the admin to review. 422 lists every failing field at once (first message per field); the message is the Laravel summary. The file checks (1 to 5 files, .pdf .doc .docx .xls .xlsx, each at most 20 MB) are on the uploaded parts.',
    request: { headers: [csrf], body: { required: true, content: { 'multipart/form-data': { schema: QuestionSetPaperUploadSchema } } } },
    responses: {
      201: json(envelopeOf(QuestionSetPaperSchema), 'The pending submission.'),
      401: unauthorized,
      403: teacherOnly,
      422: json(QuestionSetPaperFieldErrorSchema, 'VALIDATION_ERROR with fields.'),
      429: rateLimited,
    },
  })

  const audio = QUESTION_SET_AUDIO_KBAT_TEMPLATE
  registry.registerPath({
    method: 'get',
    path: '/guru/audio-kbat/template',
    tags: ['question-sets'],
    summary: 'Audio KBAT bulk-import template (CSV)',
    description:
      'Teacher or admin. A CSV with a UTF-8 BOM, the heading row tajuk, kod_subjek, kod_tingkatan, nama_fail_audio and one example row. The screen labels the link XLSX, the mock serves CSV.',
    responses: {
      200: download('text/csv', audio.csv.fileName, 'The CSV file (Content-Type text/csv; charset=UTF-8).'),
      401: unauthorized,
      403: teacherOnly,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/audio-kbat/template-word',
    tags: ['question-sets'],
    summary: 'Audio KBAT bulk-import template (Word)',
    description: 'Teacher or admin. A .docx with the title, an intro line and a table of the four columns with one example row.',
    responses: {
      200: download(audio.word.contentType, audio.word.fileName, 'The DOCX file.'),
      401: unauthorized,
      403: teacherOnly,
    },
  })

  const inline = 'Inline create (as live): 201 with the new row; a refusal is HTTP 200 with a bare { error } string.'
  registry.registerPath({
    method: 'post',
    path: '/guru/dskp/bidang',
    tags: ['dskp'],
    summary: 'Inline "Bidang Baru" (teacher DSKP pick)',
    description: `Teacher or admin. ${inline} Stored with createdBy = the caller.`,
    request: { headers: [csrf], body: body(DskpBidangCreateRequestSchema) },
    responses: {
      201: json(DskpBidangSchema, 'Bare { id, code, name }.'),
      200: json(DskpBidangInlineErrorSchema, 'Refusal: { error } with the BM text.'),
      429: rateLimited,
      401: unauthorized,
      403: teacherOnly,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/guru/dskp/sk',
    tags: ['dskp'],
    summary: 'Inline "SK Baru" (teacher DSKP pick)',
    description: `Teacher or admin. ${inline} The code and description check comes before the parent check.`,
    request: { headers: [csrf], body: body(DskpSkCreateRequestSchema) },
    responses: {
      201: json(DskpSkSchema, 'Bare { id, code, description }.'),
      200: json(DskpSkInlineErrorSchema, 'Refusal: { error } with the BM text.'),
      429: rateLimited,
      401: unauthorized,
      403: teacherOnly,
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/guru/dskp/sp',
    tags: ['dskp'],
    summary: 'Inline "SP Baru" (teacher DSKP pick)',
    description: `Teacher or admin. ${inline} The code and description check comes before the parent check.`,
    request: { headers: [csrf], body: body(DskpSpCreateRequestSchema) },
    responses: {
      201: json(DskpSpSchema, 'Bare { id, code, description }.'),
      200: json(DskpSpInlineErrorSchema, 'Refusal: { error } with the BM text.'),
      429: rateLimited,
      401: unauthorized,
      403: teacherOnly,
    },
  })
}

const setId = z.object({ id: IdSchema })
const notFoundSet = err('NOT_FOUND: unknown set or not owned by the caller (never reveals another teacher\'s set).')
const teacherOnlySets = err('FORBIDDEN ("Anda tidak dibenarkan melakukan tindakan ini."): role is not teacher (@Roles teacher; an admin has no own sets); or CSRF_INVALID on a mutation.')
const setFields = err('VALIDATION_ERROR with fields: title, subjectId, educationLevelId, questionIds (also "Soalan dalam kumpulan rangsangan mesti dipilih bersama." and non-approved ids), classroomIds (also "Pilih sekurang-kurangnya satu kelas sebelum menerbitkan." and a class that is not own), status.')
const setLocked = err('CONFLICT "Soalan tidak boleh diubah kerana pelajar telah menjawab set ini." when the question list changes while a pupil has an attempt; title and classes still save.')

/** API-GUR-16 (S6-T14, R1-GUR-8b): teacher Set Soalan. All routes are `@Roles` teacher, own sets only. */
function registerGuruQuestionSetsPaths(registry: OpenAPIRegistry): void {
  const tags = ['question-sets']

  registry.registerPath({
    method: 'get',
    path: '/guru/question-sets',
    tags,
    summary: 'Own sets, newest update first, with counters (API-GUR-16)',
    request: { query: GuruSetListQuerySchema },
    responses: { 200: json(GuruSetListResponseSchema, '`{ data: { rows, counters, summary }, meta }`.'), 401: unauthorized, 403: teacherOnlySets },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/question-sets/bank',
    tags,
    summary: 'Bank picker: approved and servable question units (API-GUR-16)',
    description: 'Newest first, 50 units per call by cursor. A stimulus group is one unit and is never split. Must be matched before `/guru/question-sets/{id}`.',
    request: { query: GuruSetBankQuerySchema },
    responses: {
      200: json(GuruSetBankResponseSchema, '`{ data: { units, nextCursor } }`; an empty page shows "Tiada soalan sepadan. Laraskan penapis di atas.".'),
      401: unauthorized,
      403: teacherOnlySets,
      422: err('VALIDATION_ERROR fields.q "Taip sekurang-kurangnya 2 aksara."'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/guru/question-sets',
    tags,
    summary: 'Create a set (draft or published)',
    description: 'Toast "Draf disimpan." or "Set diterbitkan.".',
    request: { headers: [csrf], body: body(GuruSetUpsertRequestSchema) },
    responses: { 201: json(envelopeOf(QuestionSetSchema), 'The created set.'), 401: unauthorized, 403: teacherOnlySets, 422: setFields },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/question-sets/{id}',
    tags,
    summary: 'Set detail for the "Urus" form',
    request: { params: setId },
    responses: { 200: json(envelopeOf(QuestionSetSchema), 'The set with questionIds, classroomIds and locked.'), 401: unauthorized, 403: teacherOnlySets, 404: notFoundSet },
  })

  registry.registerPath({
    method: 'put',
    path: '/guru/question-sets/{id}',
    tags,
    summary: 'Update a set (same body as create)',
    request: { headers: [csrf], params: setId, body: body(GuruSetUpsertRequestSchema) },
    responses: {
      200: json(envelopeOf(QuestionSetSchema), 'The updated set.'),
      401: unauthorized,
      403: teacherOnlySets,
      404: notFoundSet,
      409: setLocked,
      422: setFields,
    },
  })

  registry.registerPath({
    method: 'delete',
    path: '/guru/question-sets/{id}',
    tags,
    summary: 'Delete a set (attempt records stay for Prestasi)',
    description: 'Toast "Set dipadam.".',
    request: { headers: [csrf], params: setId },
    responses: { 200: json(envelopeOf(GuruSetDeleteResultSchema), '`{ data: { deleted: 1 } }`.'), 401: unauthorized, 403: teacherOnlySets, 404: notFoundSet },
  })

  registry.registerPath({
    method: 'post',
    path: '/guru/question-sets/{id}/status',
    tags,
    summary: 'Terbitkan / Jadikan Draf',
    description: 'Toast "Set diterbitkan." or "Set dijadikan draf.". Publishing needs at least one class.',
    request: { headers: [csrf], params: setId, body: body(GuruSetStatusRequestSchema) },
    responses: {
      200: json(envelopeOf(QuestionSetSchema), 'The set with its new status.'),
      401: unauthorized,
      403: teacherOnlySets,
      404: notFoundSet,
      422: err('VALIDATION_ERROR fields.status, or fields.classroomIds "Pilih sekurang-kurangnya satu kelas sebelum menerbitkan."'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/guru/question-sets/{id}/copy',
    tags,
    summary: 'Salin Set ke Kelas: a draft copy titled "{title} (Salinan)"',
    description: 'All questions are copied; the copy is assigned to the chosen own classes only. Toast "Set disalin.".',
    request: { headers: [csrf], params: setId, body: body(GuruSetCopyRequestSchema) },
    responses: {
      201: json(envelopeOf(QuestionSetSchema), 'The draft copy.'),
      401: unauthorized,
      403: teacherOnlySets,
      404: notFoundSet,
      422: err('VALIDATION_ERROR fields.classroomIds "Sila pilih kelas sasaran." (empty, or a class that is not own).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/question-sets/{id}/results',
    tags,
    summary: 'Hasil: per-attempt results, newest first, 25 per page',
    request: { params: setId, query: GuruSetResultsQuerySchema },
    responses: {
      200: json(GuruSetResultsResponseSchema, '`{ data: { summary, rows }, meta }`; empty rows show "Belum ada pelajar menjawab set ini.".'),
      401: unauthorized,
      403: teacherOnlySets,
      404: notFoundSet,
    },
  })
}
