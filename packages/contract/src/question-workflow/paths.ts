import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import { envelopeOf, listEnvelopeOf } from '../common/envelope'
import {
  QuestionWorkflowAiExplanationQuerySchema,
  QuestionWorkflowAiExplanationResultSchema,
} from './ai-explanation'
import {
  DIAGRAM_AUDIT_MESSAGES,
  DiagramAuditImageRequestSchema,
  DiagramAuditKindSchema,
  DiagramAuditMcqItemSchema,
  DiagramAuditMetaSchema,
  DiagramAuditMutationSchema,
  DiagramAuditPageMetaSchema,
  DiagramAuditQuerySchema,
  DiagramAuditResponseSchema,
  DiagramAuditResultSchema,
  DiagramAuditStructuredItemSchema,
} from './diagram-audit'
import {
  GuruDskpBidangListSchema,
  GuruDskpBidangQuerySchema,
  GuruDskpBidangSchema,
  GuruDskpSkListSchema,
  GuruDskpSkQuerySchema,
  GuruDskpSkSchema,
  GuruDskpSpListSchema,
  GuruDskpSpQuerySchema,
  GuruDskpSpSchema,
} from './guru'
import {
  QUESTION_IMPORT_TEMPLATE_CONTENT_TYPE,
  QUESTION_IMPORT_TEMPLATE_FILENAME,
  QuestionImportCreateRequestSchema,
  QuestionImportCreatedSchema,
  QuestionImportDefaultsSchema,
  QuestionImportFailureSchema,
  QuestionImportGuruRequestSchema,
  QuestionImportGuruResultSchema,
  QuestionImportListQuerySchema,
  QuestionImportRunSchema,
} from './imports'
import {
  QuestionWorkflowActorSchema,
  QuestionWorkflowGateSchema,
  QuestionWorkflowStatusEventSchema,
  QuestionWorkflowStatusSchema,
  QuestionWorkflowTransitionRuleSchema,
} from './lifecycle'
import {
  MasterNoteActionResultSchema,
  MasterNoteActionSchema,
  MasterNoteListMetaSchema,
  MasterNoteListQuerySchema,
  MasterNoteListResponseSchema,
  MasterNoteRowSchema,
  MasterNoteTabSchema,
} from './master-notes'
import {
  QuestionQualityActionRowSchema,
  QuestionQualityAuditResultSchema,
  QuestionQualityAuditedSchema,
  QuestionQualityBandSchema,
  QuestionQualityRefSchema,
  QuestionQualitySummarySchema,
} from './quality'
import {
  QuestionReportCategorySchema,
  QuestionReportCountsSchema,
  QuestionReportCreateRequestSchema,
  QuestionReportCreatedSchema,
  QuestionReportDisplayStatusSchema,
  QuestionReportFilterSchema,
  QuestionReportListMetaSchema,
  QuestionReportListQuerySchema,
  QuestionReportListResponseSchema,
  QuestionReportMineMetaSchema,
  QuestionReportMineResponseSchema,
  QuestionReportMineViewSchema,
  QuestionReportQuestionRefSchema,
  QuestionReportQuestionTypeSchema,
  QuestionReportQuestionViewSchema,
  QuestionReportSourceSchema,
  QuestionReportStatusSchema,
  QuestionReportUpdateRequestSchema,
  QuestionReportUpdateResultSchema,
  QuestionReportUpdatedSchema,
  QuestionReportViewSchema,
} from './reports'

/**
 * Components contributed by BE-10 (appended to COMPONENT_SCHEMAS in openapi.ts). Every id is
 * prefixed `QuestionWorkflow`, `QuestionReport`, `QuestionImport`, `QuestionQuality`,
 * `DiagramAudit`, `MasterNote` or `GuruDskp`; none equals an id of the BE-09 `questions` folder.
 */
export const QUESTION_WORKFLOW_COMPONENT_SCHEMAS = {
  // lifecycle
  QuestionWorkflowStatus: QuestionWorkflowStatusSchema,
  QuestionWorkflowActor: QuestionWorkflowActorSchema,
  QuestionWorkflowGate: QuestionWorkflowGateSchema,
  QuestionWorkflowTransitionRule: QuestionWorkflowTransitionRuleSchema,
  QuestionWorkflowStatusEvent: QuestionWorkflowStatusEventSchema,
  // reports
  QuestionReportQuestionType: QuestionReportQuestionTypeSchema,
  QuestionReportSource: QuestionReportSourceSchema,
  QuestionReportStatus: QuestionReportStatusSchema,
  QuestionReportDisplayStatus: QuestionReportDisplayStatusSchema,
  QuestionReportFilter: QuestionReportFilterSchema,
  QuestionReportCategory: QuestionReportCategorySchema,
  QuestionReportCreateRequest: QuestionReportCreateRequestSchema,
  QuestionReportCreated: QuestionReportCreatedSchema,
  QuestionReportQuestionRef: QuestionReportQuestionRefSchema,
  QuestionReportQuestionView: QuestionReportQuestionViewSchema,
  QuestionReportView: QuestionReportViewSchema,
  QuestionReportMineView: QuestionReportMineViewSchema,
  QuestionReportCounts: QuestionReportCountsSchema,
  QuestionReportListQuery: QuestionReportListQuerySchema,
  QuestionReportListMeta: QuestionReportListMetaSchema,
  QuestionReportListResponse: QuestionReportListResponseSchema,
  QuestionReportMineMeta: QuestionReportMineMetaSchema,
  QuestionReportMineResponse: QuestionReportMineResponseSchema,
  QuestionReportUpdateRequest: QuestionReportUpdateRequestSchema,
  QuestionReportUpdateResult: QuestionReportUpdateResultSchema,
  QuestionReportUpdated: QuestionReportUpdatedSchema,
  // imports
  QuestionImportFailure: QuestionImportFailureSchema,
  QuestionImportDefaults: QuestionImportDefaultsSchema,
  QuestionImportRun: QuestionImportRunSchema,
  QuestionImportCreateRequest: QuestionImportCreateRequestSchema,
  QuestionImportCreated: QuestionImportCreatedSchema,
  QuestionImportListQuery: QuestionImportListQuerySchema,
  QuestionImportGuruRequest: QuestionImportGuruRequestSchema,
  QuestionImportGuruResult: QuestionImportGuruResultSchema,
  // quality
  QuestionQualityBand: QuestionQualityBandSchema,
  QuestionQualityRef: QuestionQualityRefSchema,
  QuestionQualityActionRow: QuestionQualityActionRowSchema,
  QuestionQualitySummary: QuestionQualitySummarySchema,
  QuestionQualityAuditResult: QuestionQualityAuditResultSchema,
  QuestionQualityAudited: QuestionQualityAuditedSchema,
  // diagram audit
  DiagramAuditKind: DiagramAuditKindSchema,
  DiagramAuditQuery: DiagramAuditQuerySchema,
  DiagramAuditMcqItem: DiagramAuditMcqItemSchema,
  DiagramAuditStructuredItem: DiagramAuditStructuredItemSchema,
  DiagramAuditPageMeta: DiagramAuditPageMetaSchema,
  DiagramAuditMeta: DiagramAuditMetaSchema,
  DiagramAuditResponse: DiagramAuditResponseSchema,
  DiagramAuditImageRequest: DiagramAuditImageRequestSchema,
  DiagramAuditResult: DiagramAuditResultSchema,
  DiagramAuditMutation: DiagramAuditMutationSchema,
  // guru DSKP lookups
  GuruDskpBidang: GuruDskpBidangSchema,
  GuruDskpSk: GuruDskpSkSchema,
  GuruDskpSp: GuruDskpSpSchema,
  GuruDskpBidangQuery: GuruDskpBidangQuerySchema,
  GuruDskpSkQuery: GuruDskpSkQuerySchema,
  GuruDskpSpQuery: GuruDskpSpQuerySchema,
  GuruDskpBidangList: GuruDskpBidangListSchema,
  GuruDskpSkList: GuruDskpSkListSchema,
  GuruDskpSpList: GuruDskpSpListSchema,
  // master notes
  MasterNoteTab: MasterNoteTabSchema,
  MasterNoteAction: MasterNoteActionSchema,
  MasterNoteListQuery: MasterNoteListQuerySchema,
  MasterNoteRow: MasterNoteRowSchema,
  MasterNoteListMeta: MasterNoteListMetaSchema,
  MasterNoteListResponse: MasterNoteListResponseSchema,
  MasterNoteActionResult: MasterNoteActionResultSchema,
  // AI explanation stub
  QuestionWorkflowAiExplanationQuery: QuestionWorkflowAiExplanationQuerySchema,
  QuestionWorkflowAiExplanationResult: QuestionWorkflowAiExplanationResultSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })
const multipart = (schema: z.ZodType) => ({ required: true, content: { 'multipart/form-data': { schema } } })
const binary = z.string().meta({ type: 'string', format: 'binary' })

const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
const idParams = z.object({ id: IdSchema })

const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
const FORBIDDEN_ADMIN = err('FORBIDDEN "This action is unauthorized." (role is not admin; Admin Sekolah and every other role included).')
const FORBIDDEN_ADMIN_WRITE = err(
  'FORBIDDEN "This action is unauthorized." (role is not admin), or CSRF_INVALID (missing or wrong X-CSRF-Token).',
)
const FORBIDDEN_TEACHER = err('FORBIDDEN "This action is unauthorized." (role is not teacher or admin).')
const FORBIDDEN_TEACHER_WRITE = err(
  'FORBIDDEN "This action is unauthorized." (role is not teacher or admin), or CSRF_INVALID (missing or wrong X-CSRF-Token).',
)
const FORBIDDEN_CSRF = err('CSRF_INVALID (missing or wrong X-CSRF-Token).')
const NOT_FOUND = err('NOT_FOUND "Not Found." (unknown id, or a segment that does not match the route).')

const CSV_422 =
  'VALIDATION_ERROR with fields.csvFile: "Sila pilih fail CSV." (missing), "Fail mesti jenis CSV atau TXT dan tidak melebihi 5MB." (extension, MIME or size), "Fail CSV mesti mempunyai kolum <missing columns joined by comma and space>." or "Fail CSV tiada baris data."'

/**
 * Registers the BE-10 routes (20). Reports: create and mine accept any signed-in user. Imports,
 * quality, diagram audit, master notes and the AI-explanation stub: admin only. Guru import/template
 * and the DSKP lookups: teacher or admin. Question-submission routes (`/question-submissions*`)
 * are NOT part of this card (D53/OWN-1, served by the intake cards). Question status changes go
 * through the BE-09 routes (`bulk-action`, `PUT /questions/{id}`), which call the transition table
 * of `lifecycle.ts`; a forbidden pair answers 409 CONFLICT.
 */
export function registerQuestionWorkflowPaths(registry: OpenAPIRegistry): void {
  // -------------------------------------------------------------------------------------------
  // Reports (4)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/question-reports',
    tags: ['question-workflow', 'question-reports'],
    summary: 'Admin triage list of student reports (Laporan Soalan)',
    description:
      'Admin only. `status` pending|reviewed|fixed|dismissed|all; absent or empty means pending; unknown gives an empty list and meta.activeTab null. NOT paged (newest first, createdAt desc then id desc); meta.counts is over all reports regardless of the filter. `displayStatus` is `removed` when the status is fixed, the question exists and is inactive.',
    request: { query: QuestionReportListQuerySchema },
    responses: { 200: json(QuestionReportListResponseSchema, 'Reports with tab counts.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'post',
    path: '/question-reports',
    tags: ['question-workflow', 'question-reports'],
    summary: 'File a report on a question (Lapor Soalan)',
    description:
      'Any signed-in user. Creates a `pending` report. The response is RAW (no data envelope). No duplicate-open-report check (as the mock): a second report by the same user for the same question is accepted. Whether and when the report deactivates the question is Open question 1 of the card (mock: an MCQ at the first report, a structured question at the third open report).',
    request: { headers: [csrf], body: body(QuestionReportCreateRequestSchema) },
    responses: {
      201: json(QuestionReportCreatedSchema, 'Report filed: { success: true, message: "Laporan berjaya dihantar." }.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_CSRF,
      404: err('NOT_FOUND "Not Found." (the question does not exist).'),
      422: err(
        'VALIDATION_ERROR with fields: questionType "Jenis soalan tidak sah."; questionId "Sila pilih soalan."; reasons "Sila pilih sekurang-kurangnya satu sebab laporan." or "Sebab laporan tidak sah."; source "Sumber laporan tidak sah."; comment "Komen tidak boleh melebihi 500 aksara."; quizSessionId and roomCode "Rujukan sesi atau bilik tidak sah.". Top-level message is the first field message plus " (and N more error(s))" when several.',
      ),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/question-reports/mine',
    tags: ['question-workflow', 'question-reports'],
    summary: 'My reports (Laporan Soalan Saya)',
    description:
      'Any signed-in user; only the caller\'s own reports, newest first, not paged. The `question` block carries only { exists, type, id }; meta.counts is over the caller\'s reports only. Matches before any `{id}` path.',
    responses: { 200: json(QuestionReportMineResponseSchema, 'The caller\'s reports.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'patch',
    path: '/question-reports/{id}',
    tags: ['question-workflow', 'question-reports'],
    summary: 'Resolve a report',
    description:
      'Admin only. Sets status (fixed|dismissed|reviewed), the admin note and optionally reactivates (applied first) or force-deactivates the question. Flash: "Laporan berjaya dikemaskini.". The screen sends the notes "Soalan dan jawapan disemak — tiada masalah" (dismiss and reactivate) and "Dinyahaktifkan segera oleh admin" (force deactivate). BE-10 AC 11: the reporter is notified on every status change, and the status becomes fixed when the linked fixing version is published.',
    request: { params: idParams, headers: [csrf], body: body(QuestionReportUpdateRequestSchema) },
    responses: {
      200: json(QuestionReportUpdatedSchema, 'Updated; status is the flash text.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: NOT_FOUND,
      422: err('VALIDATION_ERROR with fields.status "Status tidak sah." or fields.adminNotes "Nota admin tidak boleh melebihi 1000 aksara.".'),
    },
  })

  // -------------------------------------------------------------------------------------------
  // CSV imports (3 admin + 2 Guru)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/question-imports',
    tags: ['question-workflow', 'question-imports'],
    summary: 'Import history',
    description: 'Admin only. Newest first, 20 per page (no pageSize override).',
    request: { query: QuestionImportListQuerySchema },
    responses: { 200: json(listEnvelopeOf(QuestionImportRunSchema), 'A page of import runs.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'post',
    path: '/question-imports',
    tags: ['question-workflow', 'question-imports'],
    summary: 'Import questions from a CSV file',
    description:
      'Admin only. multipart/form-data (file storage: BE-04). UTF-8, first row is the header (case-insensitive), comma separator, `"` quoting with `""`, quoted fields may span lines, blank lines ignored. Required columns question_text, option_a, option_b, correct_answer; correct_answer is a letter A to D (any case); subject_id, education_level_id and difficulty_level come from the row or the form default; marks default 1. Each valid row creates a `draft` question (it never bypasses review); a bad row is reported with its 1-based file line (header = line 1) and does not stop the others. The whole import is one transaction. An accepted file always answers 201. Flash: "Import selesai: <x> soalan diimport, <y> gagal.".',
    request: { headers: [csrf], body: multipart(QuestionImportCreateRequestSchema) },
    responses: {
      201: json(QuestionImportCreatedSchema, 'The run with its failures; status is the flash text.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      422: err(`${CSV_422} Also fields.defaultSubjectId "Sila pilih subjek.", fields.defaultEducationLevelId "Sila pilih tahap pendidikan.", fields.defaultDifficultyLevel "Sila pilih tahap kesukaran.". Row failures (200/201 body, not 422): "Baris tidak lengkap.", "Jawapan betul mesti A, B, C atau D.", "Jawapan betul merujuk pilihan yang kosong.", "Subjek tidak sah.", "Tahap pendidikan tidak sah.", "Tahap kesukaran mesti 1 hingga 5.", "Markah mesti nombor bulat sekurang-kurangnya 1.".`),
    },
  })

  const templateResponse = (description: string) => ({
    description,
    headers: {
      'Content-Disposition': {
        description: `attachment; filename="${QUESTION_IMPORT_TEMPLATE_FILENAME}"`,
        schema: { type: 'string' as const },
      },
    },
    content: { [QUESTION_IMPORT_TEMPLATE_CONTENT_TYPE]: { schema: binary } },
  })

  registry.registerPath({
    method: 'get',
    path: '/question-imports/template',
    tags: ['question-workflow', 'question-imports'],
    summary: 'Download the CSV template',
    description:
      'Admin only. A file, not JSON: `template-import-soalan.csv`, text/csv, CRLF, header line plus 2 sample rows. Matches before any `{id}` path. Cells starting with `=`, `+`, `-` or `@` are neutralised in any generated CSV. The v2 Excel template is Open question 4 of the card (OQ-25).',
    responses: { 200: templateResponse('The template file.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/questions/template',
    tags: ['question-workflow', 'guru-question-import'],
    summary: 'Guru CSV template (same file as the admin template)',
    description:
      'Teacher or admin. `template-import-soalan.csv`, text/csv with Content-Disposition attachment; the same bytes as GET /question-imports/template. A static path: it matches before `/guru/questions/{id}` of the BE-09 contract.',
    responses: { 200: templateResponse('The template file.'), 401: UNAUTHORIZED, 403: FORBIDDEN_TEACHER },
  })

  registry.registerPath({
    method: 'post',
    path: '/guru/questions/import',
    tags: ['question-workflow', 'guru-question-import'],
    summary: 'Guru CSV contribution (same import service, no defaults)',
    description:
      'Teacher or admin. multipart/form-data `csvFile` (.csv or .txt, up to 5 MB). Same parser and template as the admin import but no form defaults: each row must carry subject_id, education_level_id and difficulty_level; extra caps question text up to 2000 and each option up to 500 characters. Valid rows are created as `review` questions owned by the caller (D54a; the mock says pending_review) and each counts as a contribution; bad rows are listed ordered by file row. Answers 200 (not 201) with { data: { imported, failed } } and no flash. Row messages as the admin import plus "Soalan tidak boleh melebihi 2000 aksara." and "Pilihan jawapan tidak boleh melebihi 500 aksara.". A static path: it matches before `/guru/questions/{id}` of the BE-09 contract.',
    request: { headers: [csrf], body: multipart(QuestionImportGuruRequestSchema) },
    responses: {
      200: json(envelopeOf(QuestionImportGuruResultSchema), 'Imported count and failed rows.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_TEACHER_WRITE,
      422: err(CSV_422),
    },
  })

  // -------------------------------------------------------------------------------------------
  // Quality (2)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/question-quality',
    tags: ['question-workflow', 'question-quality'],
    summary: 'Quality dashboard',
    description:
      'Admin only. Every figure is computed from the question store. Bands: Cemerlang 76 to 100, Baik 51 to 75, Lemah 26 to 50, Kritikal 0 to 25 (BR-M04-21). `actionList` holds non-legacy rows scoring 50 or less, id descending; `legacyGeneric` counts scored rows with sourceType ai_generated.',
    responses: { 200: json(envelopeOf(QuestionQualitySummarySchema), 'The summary.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'post',
    path: '/question-quality/audit',
    tags: ['question-workflow', 'question-quality'],
    summary: 'Run the quality audit again (Jalankan Audit Semula)',
    description:
      'Admin only. No request body, no confirmation. Re-scores questions with the mock\'s score function (v2: every question, one `quality_audits` row per run) and stores the time. Flash: "Audit kualiti selesai.".',
    request: { headers: [csrf] },
    responses: { 200: json(QuestionQualityAuditedSchema, 'Audit done; status is the flash text.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN_WRITE, 409: err('CONFLICT: another quality audit is still running ("Audit kualiti sedang berjalan.").') },
  })

  // -------------------------------------------------------------------------------------------
  // Diagram audit (3)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/diagram-audit',
    tags: ['question-workflow', 'diagram-audit'],
    summary: 'Questions flagged as needing a diagram',
    description:
      'Admin only. Two lists with separate pagers (mcqPage, strPage; 20 per page; id descending). subjectId filters both lists, schoolId the MCQ list only; a malformed or unknown filter matches nothing. The body is { data: { mcq, structured }, meta: { stats, bySubject, unfilteredMcq } }, not the standard list meta.',
    request: { query: DiagramAuditQuerySchema },
    responses: { 200: json(DiagramAuditResponseSchema, 'Both lists with aggregates.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'post',
    path: '/diagram-audit/{kind}/{id}/image',
    tags: ['question-workflow', 'diagram-audit'],
    summary: 'Attach a diagram image and clear the flag',
    description: `Admin only. multipart/form-data \`image\` (JPG, PNG, WebP or GIF, SVG refused, up to 2 MB; storage: BE-04). Sets needsDiagram false and stores the image reference. Flash: "${DIAGRAM_AUDIT_MESSAGES.uploaded}".`,
    request: { params: z.object({ kind: DiagramAuditKindSchema, id: IdSchema }), headers: [csrf], body: multipart(DiagramAuditImageRequestSchema) },
    responses: {
      200: json(DiagramAuditMutationSchema, 'Image attached; status is the flash text.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Not Found." (kind is not mcq or structured, or the question does not exist; a PKSK MCQ row is also 404).'),
      422: err(
        `VALIDATION_ERROR fields.image "${DIAGRAM_AUDIT_MESSAGES.fileRequired}" (missing or not an image) or "${DIAGRAM_AUDIT_MESSAGES.fileType}".`,
      ),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/diagram-audit/{kind}/{id}/dismiss',
    tags: ['question-workflow', 'diagram-audit'],
    summary: 'Remove a question from the audit list without an image',
    description: `Admin only. No body. Sets needsDiagram false. Flash: "${DIAGRAM_AUDIT_MESSAGES.dismissed}".`,
    request: { params: z.object({ kind: DiagramAuditKindSchema, id: IdSchema }), headers: [csrf] },
    responses: {
      200: json(DiagramAuditMutationSchema, 'Dismissed; status is the flash text.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Not Found." (kind is not mcq or structured, or the question does not exist).'),
    },
  })

  // -------------------------------------------------------------------------------------------
  // DSKP lookups (3)
  // -------------------------------------------------------------------------------------------

  const dskpResponses = (schema: z.ZodType, what: string) => ({
    200: json(schema, `${what} as a BARE array (no data envelope); empty when a query value is missing or not an id.`),
    401: UNAUTHORIZED,
    403: FORBIDDEN_TEACHER,
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/dskp/bidang',
    tags: ['question-workflow', 'guru-dskp'],
    summary: 'DSKP cascade step 1: Bidang of a subject and level',
    description: 'Teacher or admin. Needs both subjectId and educationLevelId, else []. The POST writers are BE-18. A question is tagged with curriculum_node only (D53h); DSKP rows are never a question tag.',
    request: { query: GuruDskpBidangQuerySchema },
    responses: dskpResponses(GuruDskpBidangListSchema, 'The Bidang options'),
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/dskp/sk',
    tags: ['question-workflow', 'guru-dskp'],
    summary: 'DSKP cascade step 2: Standard Kandungan of a Bidang',
    description: 'Teacher or admin. Needs bidangId, else [].',
    request: { query: GuruDskpSkQuerySchema },
    responses: dskpResponses(GuruDskpSkListSchema, 'The SK options'),
  })

  registry.registerPath({
    method: 'get',
    path: '/guru/dskp/sp',
    tags: ['question-workflow', 'guru-dskp'],
    summary: 'DSKP cascade step 3: Standard Pembelajaran of an SK',
    description: 'Teacher or admin. Needs skId, else [].',
    request: { query: GuruDskpSpQuerySchema },
    responses: dskpResponses(GuruDskpSpListSchema, 'The SP options'),
  })

  // -------------------------------------------------------------------------------------------
  // Master notes (2)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/master-notes',
    tags: ['question-workflow', 'master-notes'],
    summary: 'AI master notes for admin review',
    description: 'Admin only. `tab` flagged|approved|all (default and fallback flagged, reported in meta.activeTab); 15 per page, id descending; meta.summary { flagged, teacherApproved, total }.',
    request: { query: MasterNoteListQuerySchema },
    responses: { 200: json(MasterNoteListResponseSchema, 'A page of notes.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'post',
    path: '/master-notes/{id}/{action}',
    tags: ['question-workflow', 'master-notes'],
    summary: 'Approve, unflag or regenerate a master note',
    description: 'Admin only. No body. approve: teacherApproved true and flagged false; unflag: flagged false; regen: the next canned note (text, trap, tokens), flags kept; the AI provider is BE-36 and a stub in B1 (OD-7). The body is RAW { ok: true } with no flash; the page judges success by the status only.',
    request: { params: z.object({ id: IdSchema, action: MasterNoteActionSchema }), headers: [csrf] },
    responses: {
      200: json(MasterNoteActionResultSchema, 'Done.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Not Found." (unknown id, or an action that is not approve|regen|unflag).'),
    },
  })

  // -------------------------------------------------------------------------------------------
  // AI explanation stub (1)
  // -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'post',
    path: '/questions/{id}/ai-explanation',
    tags: ['question-workflow', 'question-ai-explanation'],
    summary: 'Generate the AI explanation of a question (STUB)',
    description:
      'Admin only. STUB (OD-7): no AI provider and no network call; the server builds a deterministic canned Markdown explanation and stores it as { markdown, generatedAt } on the question. Without `force=1` an existing explanation is returned unchanged ("Penjelasan AI sudah wujud."); with `force=1` it is replaced and the text changes ("Penjelasan AI berjaya dijana."). The body is RAW { ok, message, stub: true } (no data envelope); `stub` is an addition to the mock body.',
    request: { params: idParams, query: QuestionWorkflowAiExplanationQuerySchema, headers: [csrf] },
    responses: {
      200: json(QuestionWorkflowAiExplanationResultSchema, 'Generated, or kept.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      404: err('NOT_FOUND "Not Found." (unknown question, or a PKSK row).'),
    },
  })
}
