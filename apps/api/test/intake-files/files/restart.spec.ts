import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PDF_ENGINE, type PdfEngine } from '../../../src/modules/ocr'
import { scanPdf, textPdf } from '../pdf-fixtures'
import { bootIntakeApp, countRows, createBatch, FakeOcrEngine, getBatch, type IntakeTestApp, loginAs, uploadOk } from '../helpers'

/**
 * AC2: a batch survives a restart. A job is claimed and its process "dies" (lock gone stale, app closed), a
 * fresh app on the same database sweeps it, and the work completes with every page processed exactly once.
 * Statuses go submitted -> processing -> ready_for_review (or failed).
 */
let first: IntakeTestApp
let second: IntakeTestApp | undefined

beforeAll(async () => {
  first = await bootIntakeApp()
}, 120_000)
afterAll(async () => {
  await second?.closeApp()
  await first.close()
})

function countExtractions(t: IntakeTestApp): { pages: number[] } {
  const engine = t.app.get<PdfEngine>(PDF_ENGINE)
  const seen: number[] = []
  const original = engine.extractText.bind(engine)
  engine.extractText = (bytes, pageNo, signal) => {
    seen.push(pageNo)
    return original(bytes, pageNo, signal)
  }
  return { pages: seen }
}

describe('restart (AC2)', () => {
  it('resumes after a crash: stale running jobs are swept, nothing runs twice, the batch finishes', async () => {
    const teacher = await loginAs(first, 'guru@demo.test')
    const batch = await createBatch(teacher)
    expect(batch.status).toBe('submitted')
    await uploadOk(teacher, batch.id, [{ bytes: textPdf(3) }, { bytes: scanPdf(2, 90, 112) }])
    expect((await getBatch(teacher, batch.id)).status).toBe('processing')

    // Both process_file jobs run and fan out 5 page jobs; one process_file is then "re-opened" as if its worker died
    // after the fan-out but before it could record success.
    expect(await first.jobs.runOnce(2)).toBe(2)
    expect(await countRows(first.db, 'jobs')).toBe(2 + 5)
    await first.db.query(
      `update jobs set state = 'running', locked_by = 'dead-worker:1', locked_at = now() - interval '2 hours', finished_at = null
       where id = (select min(id) from jobs where type = 'intake.process_file')`,
    )
    // A page job claimed by a process that then crashed before doing anything.
    await first.db.query(
      `update jobs set state = 'running', attempts = attempts + 1, locked_by = 'dead-worker:2', locked_at = now() - interval '2 hours'
       where id = (select min(id) from jobs where type = 'intake.page')`,
    )
    expect(first.ocr.calls).toHaveLength(0)
    await first.closeApp() // the "crash": the process is gone, rows stay as they were

    // A fresh process on the same database and storage folder.
    second = await bootIntakeApp({}, { db: first.db, dir: first.dir }, new FakeOcrEngine())
    const extracted = countExtractions(second)
    const mid = await getBatch(await loginAs(second, 'guru@demo.test'), batch.id)
    expect(mid.status).toBe('processing')

    expect(await second.jobs.sweepStuck()).toBe(2)
    await second.drain()

    const teacher2 = await loginAs(second, 'guru@demo.test')
    const done = await getBatch(teacher2, batch.id)
    expect(done.status).toBe('ready_for_review')
    expect(done.files.map((f) => f.status)).toEqual(['done', 'done'])
    // Each of the 5 pages was read once; OCR ran for the 2 scanned pages once each.
    expect(extracted.pages.sort()).toEqual([1, 1, 2, 2, 3])
    expect(second.ocr.calls).toHaveLength(2)
    // Still exactly one process_file and one page job per page (idempotency keys), all succeeded.
    const jobs = await second.db.query<{ type: string; state: string }>(`select type, state from jobs`)
    expect(jobs.filter((j) => j.type === 'intake.process_file')).toHaveLength(2)
    expect(jobs.filter((j) => j.type === 'intake.page')).toHaveLength(5)
    expect(jobs.every((j) => j.state === 'succeeded')).toBe(true)
    expect(await countRows(second.db, 'intake_pages')).toBe(5)
  })

  it('a batch whose only file cannot be read ends failed, not stuck', async () => {
    const t = second!
    t.ocr.available = false
    const teacher = await loginAs(t, 'guru@demo.test')
    const batch = await createBatch(teacher)
    await uploadOk(teacher, batch.id, [{ bytes: scanPdf(1, 92, 112) }])
    await t.drain()
    const detail = await getBatch(teacher, batch.id)
    expect(detail.status).toBe('failed')
    expect(detail.statusLabel).toBe('Gagal')
    expect(detail.files[0]).toMatchObject({ status: 'failed', errorCode: 'OCR_UNAVAILABLE' })
  })

  it('one failed file does not fail the batch when another file is done', async () => {
    const t = second!
    const teacher = await loginAs(t, 'guru@demo.test')
    const batch = await createBatch(teacher)
    t.ocr.available = false
    await uploadOk(teacher, batch.id, [{ bytes: scanPdf(1, 94, 112) }, { bytes: textPdf(1, 12) }])
    await t.drain()
    const detail = await getBatch(teacher, batch.id)
    expect(detail.status).toBe('ready_for_review')
    expect(detail.files.map((f) => f.status)).toEqual(['failed', 'done'])
  })

  it('two pages finishing together close the file and the batch exactly once', async () => {
    const t = second!
    t.ocr.available = true
    t.ocr.delayMs = 40
    const teacher = await loginAs(t, 'guru@demo.test')
    const batch = await createBatch(teacher)
    await uploadOk(teacher, batch.id, [{ bytes: scanPdf(4, 96, 112) }, { bytes: scanPdf(4, 98, 112) }])
    // Claim and run everything concurrently, as two workers would.
    await t.jobs.runOnce(10)
    await Promise.all([t.jobs.runOnce(10), t.jobs.runOnce(10), t.jobs.runOnce(10)])
    await t.drain()
    t.ocr.delayMs = 0
    const detail = await getBatch(teacher, batch.id)
    expect(detail.status).toBe('ready_for_review')
    expect(detail.files.map((f) => f.status)).toEqual(['done', 'done'])
  })
})
