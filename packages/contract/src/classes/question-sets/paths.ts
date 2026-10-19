import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { envelopeOf } from '../../common/envelope'
import { ErrorBodySchema } from '../../common/error'
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

const unauthorized = err('UNAUTHORIZED ("Unauthenticated."): no valid session.')
const teacherOnly = err('FORBIDDEN ("This action is unauthorized."): role is not teacher or admin; or CSRF_INVALID on a mutation.')

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
      'Teacher or admin. Multipart. Creates a question bank submission with status pending for the admin to review. 422 lists every failing field at once (first message per field); the message is the Laravel summary. The file checks (1 to 5 files, .pdf .doc .docx .xls .xlsx, each at most 20 MB) are on the uploaded parts.',
    request: { headers: [csrf], body: { required: true, content: { 'multipart/form-data': { schema: QuestionSetPaperUploadSchema } } } },
    responses: {
      201: json(envelopeOf(QuestionSetPaperSchema), 'The pending submission.'),
      401: unauthorized,
      403: teacherOnly,
      422: json(QuestionSetPaperFieldErrorSchema, 'VALIDATION_ERROR with fields.'),
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
      401: unauthorized,
      403: teacherOnly,
    },
  })
}
