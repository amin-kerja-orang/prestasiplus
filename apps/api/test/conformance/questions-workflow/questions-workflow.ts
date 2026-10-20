import type { HttpResponse, Scenario, ScenarioContext } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * Question workflow (BE-10) deep scenarios. The question bank port is EMPTY until BE-09 merges, so every
 * happy path here works on an empty bank (lists, template, DSKP lookups, quality summary, audit run,
 * diagram list, master notes list, an import whose rows are all rejected) and every write that needs
 * an existing question proves its 404. API target only (cookie session with CSRF, multipart).
 */

const CSV_TEMPLATE_NAME = 'template-import-soalan.csv'
const ROW_CSV =
  'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level\r\n' +
  'Berapakah 2 + 2?,3,4,5,6,B,999999,999999,2\r\n'

const csvPart = (field: string, content: string, filename = 'soalan.csv') => ({
  file: { field, filename, contentType: 'text/csv', content: new Uint8Array(Buffer.from(content, 'utf8')) },
})

function fieldsOf(res: HttpResponse): Record<string, unknown> {
  const fields = errorOf(res).fields
  return fields !== null && typeof fields === 'object' ? (fields as Record<string, unknown>) : {}
}

function expectField(ctx: ScenarioContext, res: HttpResponse, field: string): void {
  expectError(ctx, res, 422, 'VALIDATION_ERROR')
  ctx.check(field in fieldsOf(res), `expected error.fields.${field}, got ${Object.keys(fieldsOf(res)).join(', ') || 'none'}`)
}

/** Admin-only reads and writes with no body; used by the role negatives. */
const ADMIN_READS = [
  '/question-reports',
  '/question-imports',
  '/question-imports/template',
  '/question-quality',
  '/diagram-audit',
  '/master-notes',
] as const
const ADMIN_WRITES = [
  '/question-quality/audit',
  '/question-imports',
  '/diagram-audit/mcq/1/dismiss',
  '/diagram-audit/mcq/1/image',
  '/master-notes/1/approve',
  '/questions/1/ai-explanation',
] as const
const GURU_READS = ['/guru/questions/template', '/guru/dskp/bidang', '/guru/dskp/sk', '/guru/dskp/sp'] as const

export const questionsWorkflowScenarios: Scenario[] = [
  {
    id: 'question-workflow-api/reports: empty list with counts, mine, and the three student-facing errors',
    domain: 'question-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const list = await admin.request('GET', '/question-reports')
      ctx.expectStatus(list, 200)
      ctx.check(listOf(list).length === 0, 'a fresh database must have no reports')
      const meta = (list.body as { meta?: { activeTab?: unknown; counts?: unknown } }).meta
      ctx.check(meta?.activeTab === 'pending', `default tab must be pending, got ${String(meta?.activeTab)}`)
      ctx.check(meta?.counts !== undefined, 'meta.counts is missing')
      ctx.expectStatus(await admin.request('GET', '/question-reports?status=all'), 200)

      const student = await ctx.as('student')
      const mine = await student.request('GET', '/question-reports/mine')
      ctx.expectStatus(mine, 200)
      ctx.check(listOf(mine).length === 0, 'the student must have no reports')

      // A signed-in student may file; an unknown question is 404 (empty bank); a bad body is 422.
      const unknown = await student.request('POST', '/question-reports', {
        body: { questionId: '999999', questionType: 'mcq', reasons: ['wrong_answer'] },
      })
      ctx.check(unknown.status === 404 || unknown.status === 422, `unknown question answered ${String(unknown.status)}`)
      expectField(ctx, await student.request('POST', '/question-reports', { body: { reasons: [] } }), 'questionId')
      expectField(ctx, await student.request('POST', '/question-reports', { body: { questionId: '1', reasons: [] } }), 'reasons')

      // Resolve: unknown id is 404, an invalid status is 422.
      expectError(ctx, await admin.request('PATCH', '/question-reports/999999', { body: { status: 'fixed' } }), 404, 'NOT_FOUND')
      // The id is resolved before the body is judged, so a 422 on the status needs a report (reports.spec.ts).
      expectError(ctx, await admin.request('PATCH', '/question-reports/1', { body: { status: 'pending_review' } }), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'question-workflow-api/imports: history, template, admin import without file or with rejected rows',
    domain: 'question-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const history = await admin.request('GET', '/question-imports')
      ctx.expectStatus(history, 200)
      ctx.check(Array.isArray((history.body as { data?: unknown }).data), 'the history must be a data array')

      const template = await admin.request('GET', '/question-imports/template')
      ctx.expectStatus(template, 200)
      ctx.check(String(template.headers['content-type']).startsWith('text/csv'), `template served as ${String(template.headers['content-type'])}`)
      ctx.check(String(template.headers['content-disposition']).includes(CSV_TEMPLATE_NAME), 'template Content-Disposition lacks the file name')

      expectField(ctx, await admin.request('POST', '/question-imports'), 'csvFile')
      expectField(ctx, await admin.request('POST', '/question-imports', csvPart('csvFile', 'a,b\r\n1,2\r\n')), 'csvFile')
      expectField(ctx, await admin.request('POST', '/question-imports', csvPart('csvFile', ROW_CSV, 'soalan.pdf')), 'csvFile')

      // Every row names an unknown subject: an accepted file answers 201 with the failure listed.
      const run = await admin.request('POST', '/question-imports', csvPart('csvFile', ROW_CSV))
      ctx.expectStatus(run, 201)
      const data = dataOf(run)
      ctx.check(data.importedCount === 0 && data.failedCount === 1, `expected 0 imported and 1 failed, got ${String(data.importedCount)} / ${String(data.failedCount)}`)
      ctx.check(typeof (run.body as { status?: unknown }).status === 'string', 'the 201 body must carry the flash text in status')
      const after = listOf(await admin.request('GET', '/question-imports'))
      ctx.check(after.length >= 1, 'the run must appear in the history')
    },
  },
  {
    id: 'question-workflow-api/guru import and template: same template bytes, 422 without a file, rejected rows listed',
    domain: 'question-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const admin = await ctx.as('admin')
      const tpl = await teacher.request('GET', '/guru/questions/template')
      ctx.expectStatus(tpl, 200)
      ctx.check(String(tpl.headers['content-disposition']).includes(CSV_TEMPLATE_NAME), 'guru template Content-Disposition lacks the file name')
      const adminTpl = await admin.request('GET', '/question-imports/template')
      ctx.check(JSON.stringify(tpl.body) === JSON.stringify(adminTpl.body), 'the guru template differs from the admin template')

      expectField(ctx, await teacher.request('POST', '/guru/questions/import'), 'csvFile')
      const res = await teacher.request('POST', '/guru/questions/import', csvPart('csvFile', ROW_CSV))
      ctx.expectStatus(res, 200)
      const data = dataOf(res)
      ctx.check(data.imported === 0, `expected imported 0, got ${String(data.imported)}`)
      ctx.check(Array.isArray(data.failed) && data.failed.length === 1, 'expected one failed row')
    },
  },
  {
    id: 'question-workflow-api/quality: summary and audit run on an empty bank',
    domain: 'question-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const summary = await admin.request('GET', '/question-quality')
      ctx.expectStatus(summary, 200)
      ctx.check(Object.keys(dataOf(summary)).length > 0, 'the quality summary is empty')
      const audit = await admin.request('POST', '/question-quality/audit')
      ctx.expectStatus(audit, 200)
      ctx.check(typeof (audit.body as { status?: unknown }).status === 'string', 'the audit answer must carry the flash text in status')
      ctx.expectStatus(await admin.request('GET', '/question-quality'), 200)
    },
  },
  {
    id: 'question-workflow-api/diagram audit: lists on an empty bank, unknown question is 404, bad image is 422',
    domain: 'question-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const list = await admin.request('GET', '/diagram-audit')
      ctx.expectStatus(list, 200)
      const data = dataOf(list)
      const lists = [data.mcq, data.structured].map((l) => (l as { items?: unknown } | undefined)?.items)
      ctx.check(lists.every((l) => Array.isArray(l) && l.length === 0), 'data.mcq.items and data.structured.items must be empty arrays')
      ctx.expectStatus(await admin.request('GET', '/diagram-audit?mcqPage=2&strPage=3&subjectId=999999'), 200)

      expectError(ctx, await admin.request('POST', '/diagram-audit/mcq/999999/dismiss'), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('POST', '/diagram-audit/other/1/dismiss'), 404, 'NOT_FOUND')
      // The question is resolved before the file is judged, so the image 422 needs a question (diagram-audit.spec.ts).
      expectError(ctx, await admin.request('POST', '/diagram-audit/structured/1/image'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'question-workflow-api/master notes: empty list with summary, unknown note and action are 404',
    domain: 'question-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const list = await admin.request('GET', '/master-notes')
      ctx.expectStatus(list, 200)
      const meta = (list.body as { meta?: { activeTab?: unknown; summary?: unknown } }).meta
      ctx.check(meta?.activeTab === 'flagged', `default tab must be flagged, got ${String(meta?.activeTab)}`)
      ctx.check(meta?.summary !== undefined, 'meta.summary is missing')
      const fallback = await admin.request('GET', '/master-notes?tab=nonsense')
      ctx.expectStatus(fallback, 200)
      ctx.check((fallback.body as { meta?: { activeTab?: unknown } }).meta?.activeTab === 'flagged', 'an unknown tab must fall back to flagged')
      ctx.expectStatus(await admin.request('GET', '/master-notes?tab=approved'), 200)

      expectError(ctx, await admin.request('POST', '/master-notes/999999/approve'), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('POST', '/master-notes/1/explode'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'question-workflow-api/ai explanation stub: unknown question is 404',
    domain: 'question-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      expectError(ctx, await admin.request('POST', '/questions/999999/ai-explanation'), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('POST', '/questions/999999/ai-explanation?force=1'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'question-workflow-api/guru dskp: teacher and admin read empty cascades, a missing query value is an empty array',
    domain: 'question-workflow',
    targets: API_ONLY,
    async run(ctx) {
      for (const role of ['teacher', 'admin'] as const) {
        const client = await ctx.as(role)
        for (const path of ['/guru/dskp/bidang', '/guru/dskp/sk', '/guru/dskp/sp']) {
          const res = await client.request('GET', path)
          ctx.expectStatus(res, 200)
          ctx.check(Array.isArray(res.body) && (res.body as unknown[]).length === 0, `${path} must be a bare empty array without a query`)
        }
        const filled = await client.request('GET', '/guru/dskp/bidang?subjectId=999999&educationLevelId=999999')
        ctx.expectStatus(filled, 200)
        ctx.check(Array.isArray(filled.body), 'bidang must be a bare array')
        ctx.expectStatus(await client.request('GET', '/guru/dskp/sk?bidangId=999999'), 200)
        ctx.expectStatus(await client.request('GET', '/guru/dskp/sp?skId=abc'), 200)
      }
    },
  },
  {
    id: 'question-workflow-api/anonymous is 401 on every route',
    domain: 'question-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const path of [...ADMIN_READS, ...GURU_READS, '/question-reports/mine']) {
        expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
      }
      for (const path of [...ADMIN_WRITES, '/guru/questions/import', '/question-reports']) {
        expectError(ctx, await anon.request('POST', path), 401, 'UNAUTHORIZED')
      }
      expectError(ctx, await anon.request('PATCH', '/question-reports/1', { body: { status: 'fixed' } }), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'question-workflow-api/a write without CSRF is 403 CSRF_INVALID',
    domain: 'question-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin', { csrf: false })
      for (const path of ADMIN_WRITES) expectError(ctx, await admin.request('POST', path), 403, 'CSRF_INVALID')
      expectError(ctx, await admin.request('PATCH', '/question-reports/1', { body: { status: 'fixed' } }), 403, 'CSRF_INVALID')
      expectError(ctx, await admin.request('POST', '/guru/questions/import'), 403, 'CSRF_INVALID')
      const student = await ctx.as('student', { csrf: false })
      expectError(ctx, await student.request('POST', '/question-reports', { body: { questionId: '1', reasons: ['wrong_answer'] } }), 403, 'CSRF_INVALID')
    },
  },
  {
    id: 'question-workflow-api/school admin is 403 on every route except the student report routes',
    domain: 'question-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const schoolAdmin = await ctx.as('school_admin')
      for (const path of [...ADMIN_READS, ...GURU_READS]) expectError(ctx, await schoolAdmin.request('GET', path), 403, 'FORBIDDEN')
      for (const path of [...ADMIN_WRITES, '/guru/questions/import']) expectError(ctx, await schoolAdmin.request('POST', path), 403, 'FORBIDDEN')
      expectError(ctx, await schoolAdmin.request('PATCH', '/question-reports/1', { body: { status: 'fixed' } }), 403, 'FORBIDDEN')
      ctx.expectStatus(await schoolAdmin.request('GET', '/question-reports/mine'), 200)
    },
  },
  {
    id: 'question-workflow-api/student is 403 on admin and guru routes, teacher is 403 on admin-only routes',
    domain: 'question-workflow',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      for (const path of [...ADMIN_READS, ...GURU_READS]) expectError(ctx, await student.request('GET', path), 403, 'FORBIDDEN')
      const teacher = await ctx.as('teacher')
      for (const path of ADMIN_READS) expectError(ctx, await teacher.request('GET', path), 403, 'FORBIDDEN')
      for (const path of ADMIN_WRITES) expectError(ctx, await teacher.request('POST', path), 403, 'FORBIDDEN')
    },
  },
]
