import { IntakeRetryResultEnvelopeSchema, INTAKE_FILE_MESSAGES, INTAKE_MAX_RETRIES, ErrorBodySchema, type IntakeBatchDetail } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { IntakeFilesConfig } from '../../../src/modules/intake/files/intake-files.config'
import { IntakeProcessingService } from '../../../src/modules/intake/files'
import { OcrConfig, OcrError } from '../../../src/modules/ocr'
import { scanPdf } from '../pdf-fixtures'
import { addAccount, bootIntakeApp, createBatch, getBatch, type IntakeTestApp, loginAs, type LoggedIn, uploadOk } from '../helpers'

/** S1-T04: page timeout, batch timeout sweep, the error states and the retry routes (API-Q-26, ERR-INT-05, ERR-INT-11). */
let t: IntakeTestApp
let teacher: LoggedIn
let other: LoggedIn
let admin: LoggedIn
let seq = 0

beforeAll(async () => {
  t = await bootIntakeApp()
  teacher = await loginAs(t, 'guru@demo.test')
  await addAccount(t.db, 'guru.lain@demo.test', 'teacher', 'DEMO001')
  other = await loginAs(t, 'guru.lain@demo.test')
  admin = await loginAs(t, 'admin@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

/** Distinct scanned PDF per call (own hash). */
const pdf = (pages: number): Buffer => {
  seq += 1
  return scanPdf(pages, 80 + seq, 112)
}
const retry = (who: LoggedIn, kind: 'files' | 'batches', id: string) => who.agent.post(`/api/intake/${kind}/${id}/retry`).set('X-CSRF-Token', who.csrf)
/** The next OCR call (1-based over the life of the fake engine) fails with this code. */
const failNext = (code: 'OCR_TIMEOUT' | 'OCR_FAILED' | 'RENDER_FAILED' | 'OCR_UNAVAILABLE' = 'OCR_TIMEOUT', ahead = 1): void => {
  t.ocr.failOn.set(t.ocr.calls.length + ahead, new OcrError(code))
}
const pagesOf = (fileId: string) =>
  t.db.query<{ page_no: number; ocr_status: string; error_code: string | null }>(
    `select page_no, ocr_status, error_code from intake_pages where intake_file_id = $1::bigint order by page_no`,
    [fileId],
  )
const retryCountOf = async (fileId: string): Promise<number> => (await t.db.query<{ n: number }>(`select retry_count as n from intake_files where id = $1::bigint`, [fileId]))[0]!.n
const batchRow = async (id: string) => (await t.db.query<{ status: string; status_reason: string | null }>(`select status, status_reason from intake_batches where id = $1::bigint`, [id]))[0]!

/** A batch with one scanned file of `pages` pages whose page `failPage` (the n-th OCR call) times out; processed to the end. */
async function batchWithFailedPage(pages = 3, failAt = 2): Promise<{ batchId: string; fileId: string; detail: IntakeBatchDetail }> {
  const b = await createBatch(teacher)
  t.ocr.failOn.clear()
  failNext('OCR_TIMEOUT', failAt)
  const up = await uploadOk(teacher, b.id, [{ bytes: pdf(pages) }])
  await t.drain()
  t.ocr.failOn.clear()
  return { batchId: b.id, fileId: up.files[0]!.id, detail: await getBatch(teacher, b.id) }
}

describe('the limits are the same everywhere', () => {
  it('90 s per page (read by OCR), 15 min per batch, 3 retries per file', () => {
    expect(t.app.get(OcrConfig).pageTimeoutMs).toBe(90_000)
    expect(t.app.get(IntakeFilesConfig).batchTimeoutMs).toBe(900_000)
    expect(INTAKE_MAX_RETRIES).toBe(3)
  })
})

describe('page timeout and the end of OCR', () => {
  it('a page that times out is failed with OCR_TIMEOUT; the batch is ready_for_review (Selesai) with the page listed when the others succeed', async () => {
    const { batchId, fileId, detail } = await batchWithFailedPage(3, 2)
    expect(detail).toMatchObject({ status: 'ready_for_review', statusLabel: 'Selesai' })
    expect(detail.files[0]).toMatchObject({ status: 'done', progress: { total: 3, done: 2, failed: 1 } })
    const pages = await pagesOf(fileId)
    expect(pages.filter((p) => p.ocr_status === 'failed')).toEqual([expect.objectContaining({ error_code: 'OCR_TIMEOUT' })])
    expect((await batchRow(batchId)).status).toBe('ready_for_review')
  })

  it('the batch is failed (Gagal) when no page could be read', async () => {
    const b = await createBatch(teacher)
    failNext('OCR_TIMEOUT', 1)
    await uploadOk(teacher, b.id, [{ bytes: pdf(1) }])
    await t.drain()
    t.ocr.failOn.clear()
    const detail = await getBatch(teacher, b.id)
    expect(detail).toMatchObject({ status: 'failed', statusLabel: 'Gagal' })
    expect(detail.files[0]).toMatchObject({ status: 'failed', errorCode: 'OCR_TIMEOUT', progress: { total: 1, done: 0, failed: 1 } })
  })
})

describe('batch timeout (intake.batch_timeout)', () => {
  /** Pretends the worker picked the batch up `minutes` ago (the job table clock and the batch row, which are the sweep's clock). */
  async function ageBatch(batchId: string, minutes: number): Promise<void> {
    await t.db.query(
      `update jobs set started_at = now() - make_interval(mins => $2::int) where entity_type = 'intake_file' and entity_id in (select id::text from intake_files where batch_id = $1::bigint)`,
      [batchId, minutes],
    )
    await t.db.query(`update intake_batches set updated_at = now() - make_interval(mins => $2::int) where id = $1::bigint`, [batchId, minutes])
  }
  /** Runs the sweep job alone: the page jobs of the other batches are parked while it runs. */
  const sweepJob = async (): Promise<void> => {
    await t.db.query(`update jobs set run_after = now() + interval '1 hour' where state = 'queued' and type <> 'intake.batch_timeout'`)
    await t.app.get(IntakeProcessingService).scheduleBatchTimeout()
    await t.drain()
    await t.db.query(`update jobs set run_after = now() where state = 'queued' and type <> 'intake.batch_timeout'`)
  }

  it('a batch whose jobs started more than 15 minutes ago is failed with the ERR-INT-05 reason; its unread pages fail with OCR_TIMEOUT and its jobs are cancelled', async () => {
    const b = await createBatch(teacher)
    const up = await uploadOk(teacher, b.id, [{ bytes: pdf(2) }])
    const fileId = up.files[0]!.id
    expect((await batchRow(b.id)).status).toBe('processing')
    await ageBatch(b.id, 20)
    const calls = t.ocr.calls.length

    await sweepJob()

    expect(await batchRow(b.id)).toEqual({ status: 'failed', status_reason: 'Pengecaman teks mengambil masa terlalu lama.' })
    expect(INTAKE_FILE_MESSAGES.ocrTimeout).toBe('Pengecaman teks mengambil masa terlalu lama.')
    expect((await getBatch(teacher, b.id)).files[0]).toMatchObject({ status: 'failed', errorCode: 'OCR_TIMEOUT', progress: { total: 2, done: 0, failed: 2 } })
    expect((await pagesOf(fileId)).every((p) => p.ocr_status === 'failed' && p.error_code === 'OCR_TIMEOUT')).toBe(true)
    const open = await t.db.query(`select 1 from jobs where entity_type = 'intake_file' and entity_id = $1 and state in ('queued', 'running')`, [fileId])
    expect(open).toHaveLength(0)
    expect(t.ocr.calls.length).toBe(calls) // nothing ran after the timeout

    // The failed pages can be run again (retryable code): the batch then finishes.
    const res = await retry(teacher, 'batches', b.id)
    expect(res.status, JSON.stringify(res.body)).toBe(202)
    await t.drain()
    expect(await batchRow(b.id)).toEqual({ status: 'ready_for_review', status_reason: null })
  })

  it('a batch younger than the limit, a batch with no started job, and a submitted batch are not swept', async () => {
    const young = await createBatch(teacher)
    await uploadOk(teacher, young.id, [{ bytes: pdf(1) }])
    await ageBatch(young.id, 5)

    const idle = await createBatch(teacher)
    await uploadOk(teacher, idle.id, [{ bytes: pdf(1) }]) // jobs queued, none started

    const waiting = await createBatch(teacher)
    await uploadOk(teacher, waiting.id, [{ bytes: pdf(1) }])
    await ageBatch(waiting.id, 30)
    await t.db.query(`update intake_batches set status = 'submitted' where id = $1::bigint`, [waiting.id]) // AI budget wait

    expect(await t.app.get(IntakeProcessingService).sweepBatchTimeouts()).toBe(0)

    expect((await batchRow(young.id)).status).toBe('processing')
    expect((await batchRow(idle.id)).status).toBe('processing')
    expect((await batchRow(waiting.id)).status).toBe('submitted')
    await t.drain()
  })

  it('the job reschedules itself, one job per time bucket', async () => {
    const svc = t.app.get(IntakeProcessingService)
    await svc.scheduleBatchTimeout()
    await svc.scheduleBatchTimeout()
    await t.drain()
    const next = await t.db.query<{ due_in: number }>(
      `select extract(epoch from run_after - now())::float as due_in from jobs where type = 'intake.batch_timeout' and state = 'queued'`,
    )
    expect(next).toHaveLength(1)
    expect(next[0]!.due_in).toBeGreaterThan(30)
    expect(next[0]!.due_in).toBeLessThanOrEqual(61)
    const keys = await t.db.query<{ idempotency_key: string }>(`select idempotency_key from jobs where type = 'intake.batch_timeout'`)
    expect(keys.every((k) => /^intake\.batch_timeout:\d+$/.test(k.idempotency_key))).toBe(true)
  })
})

describe('retry routes (API-Q-26)', () => {
  it('POST files/:id/retry re-runs only the failed pages, adds 1 to retry_count and answers attempt / retriesLeft; the batch finishes again', async () => {
    const { batchId, fileId } = await batchWithFailedPage(3, 2)
    const before = t.ocr.calls.length
    const res = await retry(teacher, 'files', fileId)
    expect(res.status, JSON.stringify(res.body)).toBe(202)
    expect(IntakeRetryResultEnvelopeSchema.parse(res.body).data).toEqual({ attempt: 1, retriesLeft: 2 })
    expect(await retryCountOf(fileId)).toBe(1)
    expect((await batchRow(batchId)).status).toBe('processing')
    expect((await getBatch(teacher, batchId)).files[0]!.status).toBe('processing')
    await t.drain()
    expect(t.ocr.calls.length - before).toBe(1) // one page only
    const detail = await getBatch(teacher, batchId)
    expect(detail).toMatchObject({ status: 'ready_for_review' })
    expect(detail.files[0]).toMatchObject({ status: 'done', progress: { total: 3, done: 3, failed: 0 } })
    expect((await pagesOf(fileId)).every((p) => p.ocr_status === 'done' && p.error_code === null)).toBe(true)
  })

  it('the 4th retry of a file is 409 with the ERR-INT-11 text and changes nothing; the first three count 1, 2, 3', async () => {
    const { batchId, fileId } = await batchWithFailedPage(3, 2)
    for (const [attempt, retriesLeft] of [[1, 2], [2, 1], [3, 0]] as const) {
      failNext('OCR_FAILED', 1) // the page fails again
      const res = await retry(teacher, 'files', fileId)
      expect(res.status, JSON.stringify(res.body)).toBe(202)
      expect(res.body.data).toEqual({ attempt, retriesLeft })
      await t.drain()
      t.ocr.failOn.clear()
      expect((await getBatch(teacher, batchId)).files[0]!.progress.failed).toBe(1)
    }
    const calls = t.ocr.calls.length
    const fourth = await retry(teacher, 'files', fileId)
    expect(fourth.status).toBe(409)
    const body = ErrorBodySchema.parse(fourth.body)
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toBe('Fail ini gagal diproses berulang kali. Sila hubungi sokongan.')
    expect(await retryCountOf(fileId)).toBe(3)
    expect((await batchRow(batchId)).status).toBe('ready_for_review')
    expect(t.ocr.calls.length).toBe(calls)
    // The batch route refuses it the same way.
    const viaBatch = await retry(teacher, 'batches', batchId)
    expect(viaBatch.status).toBe(409)
    expect(viaBatch.body.error.message).toBe(INTAKE_FILE_MESSAGES.retryExhausted)
  })

  it('409 while the file is still being processed', async () => {
    const b = await createBatch(teacher)
    const up = await uploadOk(teacher, b.id, [{ bytes: pdf(1) }])
    for (const [kind, id] of [['files', up.files[0]!.id], ['batches', b.id]] as const) {
      const res = await retry(teacher, kind, id)
      expect(res.status, kind).toBe(409)
      expect(res.body.error.code).toBe('CONFLICT')
    }
    await t.drain()
  })

  it('409 for a file with nothing a retry can fix (an unavailable OCR engine is not retryable), and for a cancelled batch', async () => {
    const b = await createBatch(teacher)
    failNext('OCR_UNAVAILABLE', 1)
    const up = await uploadOk(teacher, b.id, [{ bytes: pdf(2) }])
    await t.drain()
    t.ocr.failOn.clear()
    // OCR_UNAVAILABLE is only produced when the engine says so; mark the page the way the worker does.
    await t.db.query(`update intake_pages set ocr_status = 'failed', error_code = 'OCR_UNAVAILABLE' where intake_file_id = $1::bigint and page_no = 1`, [up.files[0]!.id])
    expect((await retry(teacher, 'files', up.files[0]!.id)).status).toBe(409)
    expect(await retryCountOf(up.files[0]!.id)).toBe(0)

    const c = await createBatch(teacher)
    await uploadOk(teacher, c.id, [{ bytes: pdf(1) }])
    await teacher.agent.post(`/api/intake/batches/${c.id}/cancel`).set('X-CSRF-Token', teacher.csrf)
    expect((await retry(teacher, 'batches', c.id)).status).toBe(409)
  })

  it('another teacher gets 404 (file and batch); an unknown id is 404; Admin Pusat may retry any batch', async () => {
    const { batchId, fileId } = await batchWithFailedPage(2, 1)
    expect((await retry(other, 'files', fileId)).status).toBe(404)
    expect((await retry(other, 'batches', batchId)).status).toBe(404)
    expect((await retry(teacher, 'files', '999999999')).status).toBe(404)
    expect((await retry(teacher, 'batches', 'abc')).status).toBe(404)
    expect(await retryCountOf(fileId)).toBe(0)
    const res = await retry(admin, 'batches', batchId)
    expect(res.status, JSON.stringify(res.body)).toBe(202)
    expect(res.body.data).toEqual({ attempt: 1, retriesLeft: 2 })
    await t.drain()
    expect((await batchRow(batchId)).status).toBe('ready_for_review')
  })

  it('POST batches/:id/retry re-runs the failed pages of every file that has some; attempt is the highest and retriesLeft the lowest', async () => {
    const b = await createBatch(teacher)
    failNext('OCR_TIMEOUT', 2) // file A page 2 (calls are in file order: files of one batch run one after the other per entity)
    const up = await uploadOk(teacher, b.id, [{ bytes: pdf(3) }, { bytes: pdf(2) }, { bytes: pdf(1) }])
    await t.drain()
    t.ocr.failOn.clear()
    const files = up.files.map((f) => f.id)
    // Make the failures explicit and independent of the order the pages ran in: file 0 and file 1 have one failed page, file 2 none.
    await t.db.query(`update intake_pages set ocr_status = 'done', error_code = null where intake_file_id = any($1::bigint[])`, [files])
    await t.db.query(`update intake_pages set ocr_status = 'failed', error_code = 'RENDER_FAILED' where intake_file_id = $1::bigint and page_no = 1`, [files[0]])
    await t.db.query(`update intake_pages set ocr_status = 'failed', error_code = 'OCR_FAILED' where intake_file_id = $1::bigint and page_no = 2`, [files[1]])
    await t.db.query(`update intake_files set status = 'done', error_code = null, retry_count = 1 where id = $1::bigint`, [files[1]])
    await t.db.query(`update intake_batches set status = 'ready_for_review' where id = $1::bigint`, [b.id])
    const calls = t.ocr.calls.length

    const res = await retry(teacher, 'batches', b.id)
    expect(res.status, JSON.stringify(res.body)).toBe(202)
    expect(res.body.data).toEqual({ attempt: 2, retriesLeft: 1 })
    expect(await Promise.all(files.map(retryCountOf))).toEqual([1, 2, 0])
    await t.drain()
    expect(t.ocr.calls.length - calls).toBe(2) // the two failed pages only
    expect((await batchRow(b.id)).status).toBe('ready_for_review')
    expect((await getBatch(teacher, b.id)).files.map((f) => f.progress.failed)).toEqual([0, 0, 0])
  })

  it('a batch retry is refused as a whole when one file to re-run is out of retries', async () => {
    const b = await createBatch(teacher)
    const up = await uploadOk(teacher, b.id, [{ bytes: pdf(2) }, { bytes: pdf(2) }])
    await t.drain()
    const [a, c] = up.files.map((f) => f.id) as [string, string]
    await t.db.query(`update intake_pages set ocr_status = 'failed', error_code = 'OCR_TIMEOUT' where intake_file_id = any($1::bigint[]) and page_no = 1`, [[a, c]])
    await t.db.query(`update intake_files set retry_count = 3 where id = $1::bigint`, [c])
    const res = await retry(teacher, 'batches', b.id)
    expect(res.status).toBe(409)
    expect(res.body.error.message).toBe(INTAKE_FILE_MESSAGES.retryExhausted)
    expect(await retryCountOf(a)).toBe(0) // nothing was re-run
    expect((await pagesOf(a))[0]!.ocr_status).toBe('failed')
    expect((await batchRow(b.id)).status).toBe('ready_for_review')
  })
})
