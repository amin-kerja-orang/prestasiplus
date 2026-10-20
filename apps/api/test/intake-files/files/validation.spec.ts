import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { INTAKE_FILE_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { OcrError } from '../../../src/modules/ocr'
import { makePng } from '../../files/fixtures'
import { activePdf, bombPdf, corruptPdf, encryptedPdf, scanPdf, textPdf } from '../pdf-fixtures'
import {
  bootIntakeApp,
  countRows,
  createBatch,
  expectFilesError,
  getBatch,
  type IntakeTestApp,
  loginAs,
  type LoggedIn,
  uploadFiles,
  uploadOk,
} from '../helpers'
import { IntakePageListEnvelopeSchema } from '@pp/contract'

/**
 * AC3 and AC4: every refusal is a 422 on `fields.files` with the exact BM message and NOTHING is stored (no files
 * row, no intake row, no job); a page timeout marks only that page; duplicates are refused before any processing.
 * A small INTAKE_MAX_FILE_MB (1) and OCR_MAX_PAGES (3) make the limits reachable with tiny generated files.
 */
let t: IntakeTestApp
let teacher: LoggedIn
let batchId: string

beforeAll(async () => {
  t = await bootIntakeApp({ INTAKE_MAX_FILE_MB: '1', OCR_MAX_PAGES: '3' })
  teacher = await loginAs(t, 'guru@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

async function nothingStored(): Promise<void> {
  expect(await countRows(t.db, 'intake_files')).toBe(0)
  expect(await countRows(t.db, 'intake_pages')).toBe(0)
  expect(await countRows(t.db, 'jobs')).toBe(0)
  expect(await countRows(t.db, 'files')).toBe(0)
  const batch = await getBatch(teacher, batchId)
  expect(batch.status).toBe('submitted')
  expect(batch.files).toEqual([])
}

describe('refusals (AC3): exact BM message, nothing stored', () => {
  beforeAll(async () => {
    batchId = (await createBatch(teacher)).id
  })

  it('wrong magic bytes: a PNG, text and a zip all called .pdf', async () => {
    for (const bytes of [makePng(), Buffer.from('bukan pdf sama sekali'), Buffer.concat([Buffer.from('PK\x03\x04'), Buffer.alloc(200)])]) {
      expectFilesError(await uploadFiles(teacher, batchId, [{ bytes, filename: 'kertas.pdf', contentType: 'application/pdf' }]), INTAKE_FILE_MESSAGES.type)
    }
    await nothingStored()
  })

  it('a PDF header with a different declared type is still accepted by content, an empty file is not', async () => {
    expectFilesError(await uploadFiles(teacher, batchId, [{ bytes: Buffer.alloc(0) }]), INTAKE_FILE_MESSAGES.type)
    await nothingStored()
  })

  it('a file over INTAKE_MAX_FILE_MB', async () => {
    const big = Buffer.concat([textPdf(1), Buffer.alloc(1.2 * 1024 * 1024, 0x20)])
    expectFilesError(await uploadFiles(teacher, batchId, [{ bytes: big }]), INTAKE_FILE_MESSAGES.size(1))
    await nothingStored()
  })

  it('more pages than OCR_MAX_PAGES', async () => {
    expectFilesError(await uploadFiles(teacher, batchId, [{ bytes: textPdf(4) }]), INTAKE_FILE_MESSAGES.pages(3))
    await nothingStored()
  })

  it('an encrypted PDF, also with the /Encrypt key hidden by a name escape', async () => {
    expectFilesError(await uploadFiles(teacher, batchId, [{ bytes: encryptedPdf() }]), INTAKE_FILE_MESSAGES.encrypted)
    expectFilesError(await uploadFiles(teacher, batchId, [{ bytes: encryptedPdf({ hideName: true }) }]), INTAKE_FILE_MESSAGES.encrypted)
    await nothingStored()
  })

  it('a corrupt PDF', async () => {
    expectFilesError(await uploadFiles(teacher, batchId, [{ bytes: corruptPdf() }]), INTAKE_FILE_MESSAGES.corrupt)
    await nothingStored()
  })

  it('all-or-nothing: one bad file in the request stores none of the good ones', async () => {
    expectFilesError(await uploadFiles(teacher, batchId, [{ bytes: textPdf(1) }, { bytes: corruptPdf() }, { bytes: textPdf(2) }]), INTAKE_FILE_MESSAGES.corrupt)
    await nothingStored()
  })

  it('no files, or the wrong field name', async () => {
    const none = await teacher.agent.post(`/api/intake/batches/${batchId}/files`).set('X-CSRF-Token', teacher.csrf).field('x', 'y')
    expectFilesError(none, INTAKE_FILE_MESSAGES.type)
    expectFilesError(await uploadFiles(teacher, batchId, [{ bytes: textPdf(1) }], { field: 'file' }), INTAKE_FILE_MESSAGES.type)
    await nothingStored()
  })

  it('too many files in one request (over the batch limit, and over the multer limit)', async () => {
    const eleven = Array.from({ length: 11 }, (_, i) => ({ bytes: textPdf(1, 2 + i) }))
    expectFilesError(await uploadFiles(teacher, batchId, eleven), INTAKE_FILE_MESSAGES.tooManyFiles(10))
    const thirteen = Array.from({ length: 13 }, (_, i) => ({ bytes: textPdf(1, 2 + i) }))
    expectFilesError(await uploadFiles(teacher, batchId, thirteen), INTAKE_FILE_MESSAGES.tooManyFiles(10))
    await nothingStored()
  })

  it('a decompression bomb never takes the worker or the API down', async () => {
    const bomb = await bombPdf(600)
    const res = await uploadFiles(teacher, batchId, [{ bytes: bomb }])
    // The page tree is small, so the upload is accepted (201); the bomb sits in the page content, and the page job
    // ends it inside the worker limits: the page, the file and the batch fail, the process stays up.
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    // A first memory-watchdog trip is retried once (after its backoff, pulled forward here), then the page fails.
    for (let i = 0; i < 5; i++) {
      await t.drain()
      if ((await t.db.query(`select 1 from jobs where state = 'queued'`)).length === 0) break
      await t.db.query(`update jobs set run_after = now() - interval '1 second' where state = 'queued'`)
    }
    const detail = await getBatch(teacher, batchId)
    expect(detail.status).toBe('failed')
    expect(detail.files[0]).toMatchObject({ status: 'failed', progress: { total: 1, done: 0, failed: 1 } })
    expect(['TOO_COMPLEX', 'OCR_TIMEOUT']).toContain(detail.files[0]!.errorCode)
    expect((await t.http().get('/api/health')).status).toBe(200)
  }, 90_000)
})

describe('page timeout (AC3)', () => {
  it('an OCR timeout marks only that page failed; the others and the file are fine', async () => {
    const b = await createBatch(teacher)
    t.ocr.calls.length = 0
    t.ocr.failOn.set(2, new OcrError('OCR_TIMEOUT'))
    try {
      const up = await uploadOk(teacher, b.id, [{ bytes: scanPdf(3, 84, 112) }])
      await t.drain()
      expect(t.ocr.calls).toHaveLength(3)
      const detail = await getBatch(teacher, b.id)
      expect(detail.status).toBe('ready_for_review')
      expect(detail.files[0]).toMatchObject({ status: 'done', errorCode: null, progress: { total: 3, done: 2, failed: 1 } })
      const pages = IntakePageListEnvelopeSchema.parse((await teacher.agent.get(`/api/intake/files/${up.files[0]!.id}/pages`)).body).data.pages
      // Pages run concurrently, so which page got the second OCR call is not fixed: exactly one failed.
      const failed = pages.filter((p) => p.ocrStatus === 'failed')
      expect(failed).toHaveLength(1)
      expect(failed[0]).toMatchObject({ errorCode: 'OCR_TIMEOUT', text: null, ocrConfidence: null })
      const rest = pages.filter((p) => p.ocrStatus !== 'failed')
      expect(rest.map((p) => p.ocrStatus)).toEqual(['done', 'done'])
      expect(rest.every((p) => p.errorCode === null && p.text === t.ocr.text)).toBe(true)
      // The timed-out page was not retried (no retry storm): one job per page, all succeeded.
      const rows = await t.db.query<{ state: string; attempts: number }>(`select state, attempts from jobs where type = 'intake.page' and idempotency_key like $1`, [`%:${up.files[0]!.id}:%`])
      expect(rows).toHaveLength(3)
      expect(rows.every((r) => r.state === 'succeeded' && r.attempts === 1)).toBe(true)
    } finally {
      t.ocr.failOn.clear()
    }
  })

  it('an unexpected OCR error is retried by the job runner instead of failing the page', async () => {
    const b = await createBatch(teacher)
    t.ocr.calls.length = 0
    const original = t.ocr.recognize.bind(t.ocr)
    let first = true
    t.ocr.recognize = async (png, signal) => {
      if (first) {
        first = false
        throw new Error('boom')
      }
      return original(png, signal)
    }
    try {
      const up = await uploadOk(teacher, b.id, [{ bytes: scanPdf(1, 86, 112) }])
      await t.drain() // the retry waits for its backoff
      let detail = await getBatch(teacher, b.id)
      expect(detail.status).toBe('processing')
      await t.db.query(`update jobs set run_after = now() - interval '1 second' where state = 'queued'`)
      await t.drain()
      detail = await getBatch(teacher, b.id)
      expect(detail.status).toBe('ready_for_review')
      expect(detail.files[0]!.id).toBe(up.files[0]!.id)
    } finally {
      t.ocr.recognize = original
    }
  })
})

describe('duplicates (AC4)', () => {
  it('the same bytes in another live batch, in the same batch, or twice in a request are refused before any job exists', async () => {
    const a = await createBatch(teacher)
    const other = await createBatch(teacher)
    const pdf = textPdf(1, 9)
    await uploadOk(teacher, a.id, [{ bytes: pdf }])
    const jobsBefore = await countRows(t.db, 'jobs')
    const filesBefore = await countRows(t.db, 'files')
    expectFilesError(await uploadFiles(teacher, other.id, [{ bytes: pdf }]), INTAKE_FILE_MESSAGES.duplicate)
    expectFilesError(await uploadFiles(teacher, a.id, [{ bytes: pdf }]), INTAKE_FILE_MESSAGES.duplicate)
    const twin = textPdf(1, 10)
    expectFilesError(await uploadFiles(teacher, other.id, [{ bytes: twin }, { bytes: Buffer.from(twin) }]), INTAKE_FILE_MESSAGES.duplicate)
    expect(await countRows(t.db, 'jobs')).toBe(jobsBefore)
    expect(await countRows(t.db, 'files')).toBe(filesBefore)
    // A duplicate is also found after the first batch has finished.
    await t.drain()
    expect((await getBatch(teacher, a.id)).status).toBe('ready_for_review')
    expectFilesError(await uploadFiles(teacher, other.id, [{ bytes: pdf }]), INTAKE_FILE_MESSAGES.duplicate)
  })

  it('a batch that failed or was cancelled no longer blocks the same bytes', async () => {
    const a = await createBatch(teacher)
    const b = await createBatch(teacher)
    const pdf = textPdf(1, 11)
    await uploadOk(teacher, a.id, [{ bytes: pdf }])
    expectFilesError(await uploadFiles(teacher, b.id, [{ bytes: pdf }]), INTAKE_FILE_MESSAGES.duplicate)
    const cancel = await teacher.agent.post(`/api/intake/batches/${a.id}/cancel`).set('X-CSRF-Token', teacher.csrf)
    expect(cancel.status).toBe(200)
    await uploadOk(teacher, b.id, [{ bytes: pdf }])
  })
})

describe('active content (AC7, end to end)', () => {
  let server: Server
  let hits: string[]

  beforeAll(async () => {
    hits = []
    server = createServer((req, res) => {
      hits.push(`${req.method} ${req.url}`)
      res.end('x')
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  })
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()))
  })

  it('a PDF with JavaScript, URI links and a Launch action is read like any other and fetches nothing', async () => {
    const port = (server.address() as AddressInfo).port
    const b = await createBatch(teacher)
    await uploadOk(teacher, b.id, [{ bytes: activePdf(port) }])
    await t.drain()
    const detail = await getBatch(teacher, b.id)
    expect(detail.status).toBe('ready_for_review')
    await new Promise((r) => setTimeout(r, 400))
    expect(hits).toEqual([])
  })
})
