import { IntakeBatchDetailEnvelopeSchema, INTAKE_FILE_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { IntakeProcessingService } from '../../../src/modules/intake/files'
import { scanPdf, textPdf } from '../pdf-fixtures'
import { bootIntakeApp, createBatch, expectError, getBatch, type IntakeTestApp, loginAs, type LoggedIn, uploadFiles, uploadOk } from '../helpers'

let t: IntakeTestApp
let teacher: LoggedIn

beforeAll(async () => {
  t = await bootIntakeApp()
  teacher = await loginAs(t, 'guru@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

const cancel = (id: string, who: LoggedIn = teacher) => who.agent.post(`/api/intake/batches/${id}/cancel`).set('X-CSRF-Token', who.csrf)
const jobStates = async (): Promise<Record<string, number>> => {
  const rows = await t.db.query<{ state: string; n: string }>(`select state, count(*)::text as n from jobs group by state`)
  return Object.fromEntries(rows.map((r) => [r.state, Number(r.n)]))
}

describe('cancel lifecycle', () => {
  it('an empty batch cancels, and cancelling again is a 200 no-op', async () => {
    const b = await createBatch(teacher)
    const first = await cancel(b.id)
    expect(first.status).toBe(200)
    const detail = IntakeBatchDetailEnvelopeSchema.parse(first.body).data
    expect(detail).toMatchObject({ status: 'cancelled', statusLabel: 'Dibatalkan', files: [] })
    const again = await cancel(b.id)
    expect(again.status).toBe(200)
    expect(again.body.data.status).toBe('cancelled')
    const audit = await t.db.query(`select 1 from audit_events where action = 'intake.batch_cancelled' and target_id = $1`, [b.id])
    expect(audit).toHaveLength(1) // the idempotent call writes nothing
  })

  it('queued jobs are cancelled with the batch; files and pending pages are marked; nothing runs afterwards', async () => {
    const b = await createBatch(teacher)
    const up = await uploadOk(teacher, b.id, [{ bytes: scanPdf(2, 106, 112) }, { bytes: textPdf(1, 20) }])
    expect(await jobStates()).toMatchObject({ queued: expect.any(Number) })
    const res = await cancel(b.id)
    expect(res.status).toBe(200)
    const detail = IntakeBatchDetailEnvelopeSchema.parse(res.body).data
    expect(detail.status).toBe('cancelled')
    expect(detail.files.map((f) => [f.status, f.errorCode])).toEqual([['cancelled', 'CANCELLED'], ['cancelled', 'CANCELLED']])
    expect(detail.files[0]!.progress).toEqual({ total: 2, done: 0, failed: 2 })
    const states = await t.db.query<{ state: string }>(`select state from jobs where entity_id = any($1)`, [up.files.map((f) => f.id)])
    expect(states.length).toBe(2)
    expect(states.every((s) => s.state === 'cancelled')).toBe(true)
    t.ocr.calls.length = 0
    expect(await t.drain()).toBe(0)
    expect(t.ocr.calls).toHaveLength(0)
    expect((await getBatch(teacher, b.id)).status).toBe('cancelled')
  })

  it('page jobs queued after the fan-out are cancelled too, and a handler that still runs does nothing', async () => {
    const b = await createBatch(teacher)
    const up = await uploadOk(teacher, b.id, [{ bytes: scanPdf(3, 108, 112) }])
    await t.jobs.runOnce(1) // process_file fans out 3 page jobs
    const queued = await t.db.query<{ id: string; payload: unknown }>(`select id::text, payload from jobs where type = 'intake.page' and entity_id = $1`, [up.files[0]!.id])
    expect(queued).toHaveLength(3)
    expect((await cancel(b.id)).status).toBe(200)
    expect((await t.db.query<{ state: string }>(`select state from jobs where type = 'intake.page' and entity_id = $1`, [up.files[0]!.id])).every((r) => r.state === 'cancelled')).toBe(true)

    // A worker that had already claimed one of them: the handler finds the batch cancelled and returns.
    const svc = t.app.get(IntakeProcessingService)
    t.ocr.calls.length = 0
    await svc.processPage({ id: '1', type: 'intake.page', entityType: 'intake_file', entityId: up.files[0]!.id, payload: queued[0]!.payload, attempts: 1, maxAttempts: 3 }, new AbortController().signal)
    await svc.processFile({ id: '2', type: 'intake.process_file', entityType: 'intake_file', entityId: up.files[0]!.id, payload: { intakeFileId: up.files[0]!.id }, attempts: 1, maxAttempts: 3 }, new AbortController().signal)
    expect(t.ocr.calls).toHaveLength(0)
    const pages = await t.db.query<{ ocr_status: string; error_code: string | null; image_file_id: string | null }>(`select ocr_status, error_code, image_file_id::text from intake_pages where intake_file_id = $1`, [up.files[0]!.id])
    expect(pages.every((p) => p.ocr_status === 'failed' && p.error_code === 'CANCELLED' && p.image_file_id === null)).toBe(true)
    expect((await t.db.query(`select 1 from jobs where state = 'queued'`)).length).toBe(0)
  })

  it('a job that is running when the batch is cancelled is aborted and its result is not written', async () => {
    const b = await createBatch(teacher)
    const up = await uploadOk(teacher, b.id, [{ bytes: scanPdf(1, 110, 112) }])
    await t.jobs.runOnce(1)
    t.ocr.calls.length = 0
    t.ocr.delayMs = 800
    try {
      const running = t.jobs.runOnce(1)
      for (let i = 0; i < 100 && t.ocr.calls.length === 0; i++) await new Promise((r) => setTimeout(r, 20))
      expect(t.ocr.calls).toHaveLength(1) // OCR has started
      expect((await cancel(b.id)).status).toBe(200)
      await running
    } finally {
      t.ocr.delayMs = 0
    }
    const page = (await t.db.query<{ ocr_status: string; text: string | null; error_code: string | null }>(`select ocr_status, text, error_code from intake_pages where intake_file_id = $1`, [up.files[0]!.id]))[0]!
    expect(page).toEqual({ ocr_status: 'failed', text: null, error_code: 'CANCELLED' })
    const job = (await t.db.query<{ state: string }>(`select state from jobs where type = 'intake.page' and entity_id = $1`, [up.files[0]!.id]))[0]!
    expect(job.state).toBe('cancelled')
    expect((await getBatch(teacher, b.id)).status).toBe('cancelled')
  })

  it('a finished batch cannot be cancelled (409), and no closed batch takes files (409 with the BM message)', async () => {
    const ready = await createBatch(teacher)
    await uploadOk(teacher, ready.id, [{ bytes: textPdf(1, 21) }])
    await t.drain()
    expect((await getBatch(teacher, ready.id)).status).toBe('ready_for_review')
    expectError(await cancel(ready.id), 'CONFLICT')
    const refused = await uploadFiles(teacher, ready.id, [{ bytes: textPdf(1, 22) }])
    expectError(refused, 'CONFLICT', INTAKE_FILE_MESSAGES.batchClosed)

    t.ocr.available = false
    const failed = await createBatch(teacher)
    await uploadOk(teacher, failed.id, [{ bytes: scanPdf(1, 112, 112) }])
    await t.drain()
    t.ocr.available = true
    expect((await getBatch(teacher, failed.id)).status).toBe('failed')
    expectError(await cancel(failed.id), 'CONFLICT')
    expectError(await uploadFiles(teacher, failed.id, [{ bytes: textPdf(1, 23) }]), 'CONFLICT', INTAKE_FILE_MESSAGES.batchClosed)

    const gone = await createBatch(teacher)
    await cancel(gone.id)
    expectError(await uploadFiles(teacher, gone.id, [{ bytes: textPdf(1, 24) }]), 'CONFLICT', INTAKE_FILE_MESSAGES.batchClosed)
  })

  it('writes the audit trail for create, upload and cancel without file names or text', async () => {
    const rows = await t.db.query<{ action: string; detail: unknown }>(`select action, detail from audit_events where action like 'intake.%'`)
    const actions = new Set(rows.map((r) => r.action))
    expect(actions).toEqual(new Set(['intake.batch_created', 'intake.files_uploaded', 'intake.batch_cancelled']))
    expect(JSON.stringify(rows)).not.toMatch(/\.pdf|Teks OCR|Nota penghantar/)
  })
})
