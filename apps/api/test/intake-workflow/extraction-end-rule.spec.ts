import { ErrorBodySchema, INTAKE_FILE_MESSAGES, IntakeExtractionRunEnvelopeSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { addAccount, bootWorkflowApp, draft, extract, itemsOf, loginAs, paper, post, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

/**
 * S1-T04: the one batch end rule (45 section 3.3.2 item 7) at the end of extraction, `extract` with `pages[]` (API-Q-15) and the retry
 * routes on a batch that already has items (API-Q-26).
 */
let t: WorkflowTestApp
let teacher: LoggedIn
let other: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp()
  teacher = await loginAs(t, 'guru@demo.test')
  await addAccount(t.db, 'guru.lain@demo.test', 'teacher', 'DEMO001')
  other = await loginAs(t, 'guru.lain@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

const batchRow = async (id: string) => (await t.db.query<{ status: string; status_reason: string | null }>(`select status, status_reason from intake_batches where id = $1::bigint`, [id]))[0]!
const fileOf = async (batchId: string): Promise<string> => (await t.db.query<{ id: string }>(`select id::text from intake_files where batch_id = $1::bigint order by id limit 1`, [batchId]))[0]!.id
const retryCountOf = async (fileId: string): Promise<number> => (await t.db.query<{ n: number }>(`select retry_count as n from intake_files where id = $1::bigint`, [fileId]))[0]!.n
const failPage = (fileId: string, pageNo: number, code = 'OCR_TIMEOUT') =>
  t.db.query(`update intake_pages set ocr_status = 'failed', error_code = $3, text = null where intake_file_id = $1::bigint and page_no = $2`, [fileId, pageNo, code])
/** Runs queued jobs, and the delayed ones (a pages run looks again every few seconds while its pages are read), until nothing is queued. */
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await t.drain()
    const queued = Number((await t.db.query<{ n: string }>(`select count(*)::text as n from jobs where state = 'queued'`))[0]!.n)
    if (queued === 0) return
    await t.releaseDelayed()
  }
  throw new Error('jobs did not settle')
}
const extractWith = (batchId: string, body: unknown, who: LoggedIn = teacher) => who.agent.post(`/api/intake/batches/${batchId}/extract`).set('X-CSRF-Token', who.csrf).send(body as object)
const twoQuestionsOfTwoPages = (): void => {
  t.ai.paper = (req) => paper(req.pages.length >= 2 ? [draft(t.codes, '1'), draft(t.codes, '2', { page: 2 })] : [draft(t.codes, '1')])
}

describe('extraction end rule', () => {
  it('no failed page and items: ready_for_review (Selesai)', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1')])
    const { batchId } = await readyBatch(t, teacher)
    await extract(t, teacher, batchId)
    await t.drain()
    expect(await batchRow(batchId)).toEqual({ status: 'ready_for_review', status_reason: null })
  })

  it('one failed page and at least one item: selesai_dengan_ralat (Selesai dengan ralat)', async () => {
    twoQuestionsOfTwoPages()
    const { batchId } = await readyBatch(t, teacher, { pages: 2 })
    await failPage(await fileOf(batchId), 2)
    await extract(t, teacher, batchId)
    await t.drain()
    expect(await batchRow(batchId)).toEqual({ status: 'selesai_dengan_ralat', status_reason: null })
    expect(await itemsOf(teacher, batchId)).toHaveLength(1)
    const detail = (await teacher.agent.get(`/api/intake/batches/${batchId}`)).body.data
    expect(detail).toMatchObject({ status: 'selesai_dengan_ralat', statusLabel: 'Selesai dengan ralat', itemCount: 1 })
    expect(detail.files[0].progress).toEqual({ total: 2, done: 1, failed: 1 })
  })

  it('no item extracted: failed (Gagal) with a reason, even when no page failed; the batch can be extracted again', async () => {
    t.ai.paper = () => paper([])
    const { batchId } = await readyBatch(t, teacher)
    await extract(t, teacher, batchId)
    await t.drain()
    expect((await batchRow(batchId)).status).toBe('failed')
    expect((await batchRow(batchId)).status_reason).toBeTruthy()
    expect(await itemsOf(teacher, batchId)).toHaveLength(0)
    t.ai.paper = () => paper([draft(t.codes, '1')])
    await extract(t, teacher, batchId) // not short-cut to the earlier "succeeded" run
    await t.drain()
    expect((await batchRow(batchId)).status).toBe('ready_for_review')
    expect(await itemsOf(teacher, batchId)).toHaveLength(1)
  })
})

describe('extract with pages[]', () => {
  it('re-runs the named failed page, adds 1 to retry_count of its file and adds only the items of that page', async () => {
    twoQuestionsOfTwoPages()
    const { batchId } = await readyBatch(t, teacher, { pages: 2 })
    const fileId = await fileOf(batchId)
    await failPage(fileId, 2)
    await extract(t, teacher, batchId)
    await t.drain()
    expect((await batchRow(batchId)).status).toBe('selesai_dengan_ralat')
    const runs = (await t.db.query<{ n: string }>(`select count(*)::text as n from intake_extraction_runs where batch_id = $1::bigint`, [batchId]))[0]!.n
    expect(runs).toBe('1')

    const res = await extractWith(batchId, { pages: [{ fileId, pageNo: 2 }] })
    expect(res.status, JSON.stringify(res.body)).toBe(202) // a new run, not the succeeded one of before
    const run = IntakeExtractionRunEnvelopeSchema.parse(res.body).data
    expect(run.state).toBe('queued')
    expect(await retryCountOf(fileId)).toBe(1)
    expect((await batchRow(batchId)).status).toBe('processing')

    await settle()
    expect(await batchRow(batchId)).toEqual({ status: 'ready_for_review', status_reason: null })
    expect(await itemsOf(teacher, batchId)).toHaveLength(2) // the item of page 1 was not added twice
    const finished = (await t.db.query<{ state: string; item_count: number }>(`select state, item_count from intake_extraction_runs where id = $1::bigint`, [run.id]))[0]!
    expect(finished).toEqual({ state: 'succeeded', item_count: 1 })
  })

  it('a page that did not fail, a file of another batch, a page of no file: 422 fields.pages and nothing changes', async () => {
    twoQuestionsOfTwoPages()
    const { batchId } = await readyBatch(t, teacher, { pages: 2 })
    const fileId = await fileOf(batchId)
    await failPage(fileId, 2)
    await extract(t, teacher, batchId)
    await t.drain()
    const foreign = await fileOf((await readyBatch(t, teacher)).batchId)
    for (const pages of [[{ fileId, pageNo: 1 }], [{ fileId, pageNo: 2 }, { fileId, pageNo: 1 }], [{ fileId: foreign, pageNo: 1 }], [{ fileId: '999999999', pageNo: 1 }], [{ fileId, pageNo: 9 }]]) {
      const res = await extractWith(batchId, { pages })
      expect(res.status, JSON.stringify(pages)).toBe(422)
      const body = ErrorBodySchema.parse(res.body)
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.fields?.pages).toBeTruthy()
    }
    expect(await retryCountOf(fileId)).toBe(0)
    expect((await batchRow(batchId)).status).toBe('selesai_dengan_ralat')
  })

  it('a code a retry cannot fix (OCR_UNAVAILABLE) is not a page to retry; provider and empty pages are refused', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1')])
    const { batchId } = await readyBatch(t, teacher, { pages: 2 })
    const fileId = await fileOf(batchId)
    await failPage(fileId, 2, 'OCR_UNAVAILABLE')
    expect((await extractWith(batchId, { pages: [{ fileId, pageNo: 2 }] })).status).toBe(422)
    expect((await extractWith(batchId, { pages: [] })).status).toBe(422)
    expect((await extractWith(batchId, { pages: [{ fileId, pageNo: 2 }], provider: 'openai' })).status).toBe(422)
  })

  it('the 4th retry of a file is 409 with the ERR-INT-11 text', async () => {
    twoQuestionsOfTwoPages()
    const { batchId } = await readyBatch(t, teacher, { pages: 2 })
    const fileId = await fileOf(batchId)
    await failPage(fileId, 2)
    await extract(t, teacher, batchId)
    await t.drain()
    await t.db.query(`update intake_files set retry_count = 3 where id = $1::bigint`, [fileId])
    const res = await extractWith(batchId, { pages: [{ fileId, pageNo: 2 }] })
    expect(res.status).toBe(409)
    expect(res.body.error.message).toBe(INTAKE_FILE_MESSAGES.retryExhausted)
    expect(await retryCountOf(fileId)).toBe(3)
    expect((await batchRow(batchId)).status).toBe('selesai_dengan_ralat')
  })

  it('another teacher gets 404; a batch that is still processing is 409', async () => {
    twoQuestionsOfTwoPages()
    const { batchId } = await readyBatch(t, teacher, { pages: 2 })
    const fileId = await fileOf(batchId)
    await failPage(fileId, 2)
    expect((await extractWith(batchId, { pages: [{ fileId, pageNo: 2 }] }, other)).status).toBe(404)
    await t.db.query(`update intake_batches set status = 'processing' where id = $1::bigint`, [batchId])
    expect((await extractWith(batchId, { pages: [{ fileId, pageNo: 2 }] })).status).toBe(409)
  })
})

describe('retry routes on a batch that already has items', () => {
  it('POST batches/:id/retry re-reads the failed page and then extracts its items; the batch ends Selesai', async () => {
    twoQuestionsOfTwoPages()
    const { batchId } = await readyBatch(t, teacher, { pages: 2 })
    const fileId = await fileOf(batchId)
    await failPage(fileId, 2)
    await extract(t, teacher, batchId)
    await t.drain()
    expect((await batchRow(batchId)).status).toBe('selesai_dengan_ralat')

    const res = await post(teacher, `/intake/batches/${batchId}/retry`)
    expect(res.status, JSON.stringify(res.body)).toBe(202)
    expect(res.body.data).toEqual({ attempt: 1, retriesLeft: 2 })
    expect((await batchRow(batchId)).status).toBe('processing')
    await settle()
    expect((await batchRow(batchId)).status).toBe('ready_for_review')
    expect(await itemsOf(teacher, batchId)).toHaveLength(2)
    expect(await retryCountOf(fileId)).toBe(1)
  })

  it('when the page fails again the batch is selesai_dengan_ralat again', async () => {
    twoQuestionsOfTwoPages()
    const { batchId } = await readyBatch(t, teacher, { pages: 2 })
    const fileId = await fileOf(batchId)
    await failPage(fileId, 2)
    await extract(t, teacher, batchId)
    await t.drain()
    // The page cannot be read this time either: its source text is gone, so the retry fails it again.
    await t.db.query(`update files set storage_key = 'intake-original/gone.pdf' where id = (select file_id from intake_files where id = $1::bigint)`, [fileId])
    const res = await post(teacher, `/intake/files/${fileId}/retry`)
    expect(res.status, JSON.stringify(res.body)).toBe(202)
    await settle()
    expect((await batchRow(batchId)).status).toBe('selesai_dengan_ralat')
    expect(await itemsOf(teacher, batchId)).toHaveLength(1)
    expect(t.ai.calls.length).toBeGreaterThan(0)
  })
})
