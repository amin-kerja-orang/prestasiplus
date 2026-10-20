
import type { HttpClient, Scenario, ScenarioContext } from '@pp/contract-tests'

import { textPdf } from '../../intake-files/pdf-fixtures'
import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * Intake submissions and files (BE-37): create a batch, upload a generated PDF, let the in-process job worker
 * read it (the conformance app runs it, see `boot.ts`), then read the status, the pages, the page image, the
 * thumbnail and the original. There is no mock route for any of this (new in D52), so every scenario is API only;
 * the runner still checks each JSON answer against the contract. Each scenario uses its own PDF (different page
 * count or line count) because the same bytes in a live batch are refused as a duplicate.
 */
const DECLARATION = {
  paperType: 'trial',
  subject: 'MAT',
  kertas: 1,
  year: 2025,
  source: 'Sumber ujian sintetik',
  copyright: 'sendiri',
  notes: 'Nota penghantar sintetik',
  declaration: true,
} as const

const pdfPart = (bytes: Uint8Array, filename = 'kertas.pdf') => ({ field: 'files', filename, contentType: 'application/pdf', content: bytes })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function createBatch(ctx: ScenarioContext, client: HttpClient): Promise<string> {
  const res = await client.request('POST', '/intake/batches', { body: DECLARATION })
  ctx.expectStatus(res, 201)
  ctx.check(dataOf(res).status === 'submitted' && dataOf(res).statusLabel === 'Dihantar', 'a new batch must be submitted / Dihantar')
  return String(dataOf(res).id)
}

/** Polls the batch until it leaves submitted/processing (the worker ticks every 100 ms in the conformance app). */
async function waitFinished(client: HttpClient, id: string): Promise<Record<string, unknown>> {
  let last: Record<string, unknown> = {}
  for (let i = 0; i < 200; i++) {
    const res = await client.request('GET', `/intake/batches/${id}`)
    last = dataOf(res)
    if (last.status !== 'submitted' && last.status !== 'processing') return last
    await sleep(100)
  }
  return last
}

const ID_ROUTES = (batch: string, file: string): Array<[string, string, string]> => [
  ['GET', `/intake/batches/${batch}`, ''],
  ['POST', `/intake/batches/${batch}/files`, 'upload'],
  ['POST', `/intake/batches/${batch}/cancel`, ''],
  ['GET', `/intake/files/${file}/pages`, ''],
  ['GET', `/intake/files/${file}/pages/1/image`, ''],
  ['GET', `/intake/files/${file}/pages/1/thumb`, ''],
  ['GET', `/intake/files/${file}/original`, ''],
]

export const intakeScenarios: Scenario[] = [
  {
    id: 'intake-api/teacher: create, upload, process, then pages, image, thumb and original',
    domain: 'intake-files',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const id = await createBatch(ctx, teacher)
      const bytes = textPdf(2, 3)
      const up = await teacher.request('POST', `/intake/batches/${id}/files`, { file: pdfPart(bytes, 'Kertas Percubaan.pdf') })
      ctx.expectStatus(up, 201)
      const uploaded = (dataOf(up).files ?? []) as Array<Record<string, unknown>>
      ctx.check(uploaded.length === 1 && uploaded[0]?.originalName === 'Kertas Percubaan.pdf' && uploaded[0]?.pageCount === 2, 'the upload must list the stored file with its name and page count')
      ctx.check(uploaded[0]?.status === 'uploaded', 'a stored file starts as uploaded')
      const fileId = String(uploaded[0]?.id)

      const done = await waitFinished(teacher, id)
      ctx.check(done.status === 'ready_for_review' && done.statusLabel === 'Sedia untuk semakan', `batch ended ${String(done.status)}, expected ready_for_review`)
      const file = ((done.files ?? []) as Array<Record<string, unknown>>)[0]
      ctx.check(file?.status === 'done', 'the file must be done')
      const progress = file?.progress as { total: number; done: number; failed: number } | undefined
      ctx.check(progress?.total === 2 && progress.done === 2 && progress.failed === 0, 'progress must be 2 of 2 pages, none failed')
      ctx.check(done.fileCount === 1 && done.pageCount === 2, 'fileCount and pageCount must be 1 and 2')

      const pages = await teacher.request('GET', `/intake/files/${fileId}/pages`)
      ctx.expectStatus(pages, 200)
      const list = (dataOf(pages).pages ?? []) as Array<Record<string, unknown>>
      ctx.check(list.length === 2 && list.every((p) => p.textSource === 'text-layer' && p.ocrStatus === 'not_needed' && p.hasImage === true), 'both pages must be read from the text layer with an image')
      ctx.check(String(list[0]?.text).includes('Page 1 line 1'), 'page 1 text must come from the PDF')

      for (const [path, type] of [
        [`/intake/files/${fileId}/pages/1/image`, 'image/webp'],
        [`/intake/files/${fileId}/pages/2/thumb`, 'image/webp'],
      ] as const) {
        const img = await teacher.request('GET', path)
        ctx.expectStatus(img, 200)
        ctx.check(img.headers['content-type'] === type, `${path} served as ${String(img.headers['content-type'])}`)
        ctx.check(img.headers['x-content-type-options'] === 'nosniff' && img.headers['cache-control'] === 'no-store', `${path} must be nosniff and no-store`)
        ctx.check(img.headers['content-disposition'] === 'inline', `${path} must be inline`)
      }
      const original = await teacher.request('GET', `/intake/files/${fileId}/original`)
      ctx.expectStatus(original, 200)
      ctx.check(original.headers['content-type'] === 'application/pdf', 'the original must be application/pdf')
      ctx.check(original.headers['content-disposition'] === 'attachment; filename="Kertas Percubaan.pdf"', `original disposition was ${String(original.headers['content-disposition'])}`)
      ctx.check(Number(original.headers['content-length']) === bytes.length, 'the original must be the uploaded bytes')

      // A finished batch can be neither cancelled nor given more files.
      expectError(ctx, await teacher.request('POST', `/intake/batches/${id}/cancel`), 409, 'CONFLICT')
      const more = await teacher.request('POST', `/intake/batches/${id}/files`, { file: pdfPart(textPdf(1, 3)) })
      expectError(ctx, more, 409, 'CONFLICT')
      ctx.check(errorOf(more).message === 'Kelompok ini tidak lagi menerima fail.', 'the closed-batch message differs')
    },
  },
  {
    id: 'intake-api/list: own batches newest first, status filter, paging; Admin Pusat sees them too',
    domain: 'intake-files',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const first = await createBatch(ctx, teacher)
      const second = await createBatch(ctx, teacher)
      const list = await teacher.request('GET', '/intake/batches?pageSize=100')
      ctx.expectStatus(list, 200)
      const ids = listOf(list).map((b) => String(b.id))
      ctx.check(ids.indexOf(second) !== -1 && ids.indexOf(second) < ids.indexOf(first), 'the newer batch must be listed first')
      const meta = (list.body as { meta: { page: number; pageSize: number; totalItems: number } }).meta
      ctx.check(meta.page === 1 && meta.pageSize === 100 && meta.totalItems >= 2, 'list meta is wrong')
      const submitted = await teacher.request('GET', '/intake/batches?status=submitted&pageSize=1')
      ctx.expectStatus(submitted, 200)
      ctx.check(listOf(submitted).length === 1 && listOf(submitted).every((b) => b.status === 'submitted'), 'the status filter must apply')
      ctx.expectStatus(await teacher.request('GET', '/intake/batches?status=nope'), 422)
      ctx.expectStatus(await teacher.request('GET', '/intake/batches?page=0'), 422)

      const admin = await ctx.as('admin')
      const seen = await admin.request('GET', `/intake/batches/${first}`)
      ctx.expectStatus(seen, 200)
      ctx.check(dataOf(seen).id === first && (dataOf(seen).owner as { name?: string } | null)?.name !== undefined, 'Admin Pusat must read a teacher batch with its owner')
      for (const id of [first, second]) ctx.expectStatus(await teacher.request('POST', `/intake/batches/${id}/cancel`), 200)
    },
  },
  {
    id: 'intake-api/refusals: declaration, wrong type, and the exact BM upload messages',
    domain: 'intake-files',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const bad = await teacher.request('POST', '/intake/batches', { body: { ...DECLARATION, declaration: false, year: 1800 } })
      ctx.expectStatus(bad, 422)
      ctx.check(errorOf(bad).code === 'VALIDATION_ERROR', 'a bad declaration must be VALIDATION_ERROR')
      const id = await createBatch(ctx, teacher)
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
      const wrongType = await teacher.request('POST', `/intake/batches/${id}/files`, { file: pdfPart(png, 'kertas.pdf') })
      ctx.expectStatus(wrongType, 422)
      ctx.check((errorOf(wrongType).fields as Record<string, string> | undefined)?.files === 'Jenis fail tidak disokong. Gunakan PDF.', 'the wrong-type message differs')
      const junk = new TextEncoder().encode(`%PDF-1.4\n${'garbled '.repeat(100)}`)
      const corrupt = await teacher.request('POST', `/intake/batches/${id}/files`, { file: pdfPart(junk) })
      ctx.expectStatus(corrupt, 422)
      ctx.check((errorOf(corrupt).fields as Record<string, string> | undefined)?.files === 'Fail PDF rosak atau tidak boleh dibaca.', 'the corrupt-PDF message differs')
      const ok = await teacher.request('POST', `/intake/batches/${id}/files`, { file: pdfPart(textPdf(1, 4)) })
      ctx.expectStatus(ok, 201)
      const dup = await teacher.request('POST', `/intake/batches/${id}/files`, { file: pdfPart(textPdf(1, 4)) })
      ctx.expectStatus(dup, 422)
      ctx.check((errorOf(dup).fields as Record<string, string> | undefined)?.files === 'Fail ini telah diimport dalam kelompok lain.', 'the duplicate message differs')
      ctx.expectStatus(await teacher.request('POST', `/intake/batches/${id}/cancel`), 200)
    },
  },
  {
    id: 'intake-api/cancel: 200 with the batch, repeated cancel is 200, the batch then refuses files with 409',
    domain: 'intake-files',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const id = await createBatch(ctx, teacher)
      const up = await teacher.request('POST', `/intake/batches/${id}/files`, { file: pdfPart(textPdf(3, 5)) })
      ctx.expectStatus(up, 201)
      const cancelled = await teacher.request('POST', `/intake/batches/${id}/cancel`)
      ctx.expectStatus(cancelled, 200)
      ctx.check(dataOf(cancelled).status === 'cancelled' && dataOf(cancelled).statusLabel === 'Dibatalkan', 'the batch must be cancelled / Dibatalkan')
      ctx.expectStatus(await teacher.request('POST', `/intake/batches/${id}/cancel`), 200)
      const closed = await teacher.request('POST', `/intake/batches/${id}/files`, { file: pdfPart(textPdf(1, 6)) })
      expectError(ctx, closed, 409, 'CONFLICT')
    },
  },
  {
    id: 'intake-api/unknown ids are 404 on every id route; a page that has no image yet is 404',
    domain: 'intake-files',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      for (const [method, path] of ID_ROUTES('999999999', '999999999')) {
        const res = await teacher.request(method as 'GET' | 'POST', path, method === 'POST' && path.endsWith('/files') ? { file: pdfPart(textPdf(1, 7)) } : undefined)
        expectError(ctx, res, 404, 'NOT_FOUND')
      }
      expectError(ctx, await teacher.request('GET', '/intake/figures/999999999/image'), 404, 'NOT_FOUND')
      expectError(ctx, await teacher.request('GET', '/intake/batches/not-an-id'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'intake-api/anonymous 401, student 403, school admin 403 and a missing CSRF token 403 on every route',
    domain: 'intake-files',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const id = await createBatch(ctx, teacher)
      const up = await teacher.request('POST', `/intake/batches/${id}/files`, { file: pdfPart(textPdf(1, 8)) })
      ctx.expectStatus(up, 201)
      const fileId = String(((dataOf(up).files ?? []) as Array<{ id: string }>)[0]?.id)
      const routes: Array<[string, string, boolean]> = [
        ['POST', '/intake/batches', true],
        ['GET', '/intake/batches', false],
        ...ID_ROUTES(id, fileId).map(([m, p]): [string, string, boolean] => [m, p, m === 'POST']),
        ['GET', '/intake/figures/1/image', false],
      ]
      const init = (method: string, path: string) =>
        method === 'POST' && path.endsWith('/files') ? { file: pdfPart(textPdf(1, 9)) } : method === 'POST' && path === '/intake/batches' ? { body: DECLARATION } : undefined
      const anon = ctx.anonymous()
      const student = await ctx.as('student')
      const schoolAdmin = await ctx.as('school_admin')
      const noCsrf = await ctx.as('teacher', { csrf: false })
      for (const [method, path, write] of routes) {
        const m = method as 'GET' | 'POST'
        expectError(ctx, await anon.request(m, path, init(method, path)), 401, 'UNAUTHORIZED')
        expectError(ctx, await student.request(m, path, init(method, path)), 403, 'FORBIDDEN')
        expectError(ctx, await schoolAdmin.request(m, path, init(method, path)), 403, 'FORBIDDEN')
        if (write) expectError(ctx, await noCsrf.request(m, path, init(method, path)), 403, 'CSRF_INVALID')
      }
      ctx.expectStatus(await teacher.request('POST', `/intake/batches/${id}/cancel`), 200)
    },
  },
]
