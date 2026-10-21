import { INTAKE_MESSAGES, IntakeBatchReviewEnvelopeSchema, IntakeExtractionRunEnvelopeSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { JobError } from '../../src/modules/jobs'
import { addAccount, bootWorkflowApp, draft, extract, extractAndRun, itemsOf, loginAs, paper, post, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

let t: WorkflowTestApp
let teacher: LoggedIn
let other: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp({ INTAKE_EXTRACT_BUDGET_RECHECK_SECONDS: '60' })
  teacher = await loginAs(t, 'guru@demo.test')
  await addAccount(t.db, 'guru.lain@demo.test', 'teacher', 'DEMO001')
  other = await loginAs(t, 'guru.lain@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

const reviewOf = async (who: LoggedIn, batchId: string) => IntakeBatchReviewEnvelopeSchema.parse((await who.agent.get(`/api/intake/batches/${batchId}/review`)).body).data
const batchRow = async (batchId: string) => (await t.db.query<{ status: string; status_reason: string | null }>(`select status, status_reason from intake_batches where id = $1`, [batchId]))[0]!

describe('provider failure and retry', () => {
  it('a transient failure is retried by the runner and leaves exactly one set of items', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1'), draft(t.codes, '2')])
    const { batchId } = await readyBatch(t, teacher)
    const calls = t.ai.calls.length
    t.ai.failures.push(new Error('penyedia gagal sementara'), new Error('penyedia gagal sementara'))
    await extract(t, teacher, batchId)
    await t.drain()
    expect((await reviewOf(teacher, batchId)).extraction?.state).toBe('queued')
    await t.releaseDelayed()
    await t.drain()
    await t.releaseDelayed()
    await t.drain()
    expect(t.ai.calls.length - calls).toBe(3)
    expect((await reviewOf(teacher, batchId)).extraction?.state).toBe('succeeded')
    expect(await itemsOf(teacher, batchId)).toHaveLength(2)
    expect((await batchRow(batchId)).status).toBe('ready_for_review')
  })

  it('an answer that is not a valid result fails the attempt; when the runner gives up the run and batch are failed with a reason, and a new request recovers without duplicates', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1')])
    const { batchId } = await readyBatch(t, teacher)
    t.ai.failures.push(new Error('a'), new Error('b'), new JobError('AI_UNAVAILABLE', true))
    await extract(t, teacher, batchId)
    for (let i = 0; i < 4; i++) {
      await t.releaseDelayed()
      await t.drain()
    }
    const failed = await reviewOf(teacher, batchId)
    expect(failed.extraction?.state).toBe('failed')
    expect(failed.extraction?.reason?.code).toBeTruthy()
    expect((await batchRow(batchId)).status).toBe('failed')
    expect(await itemsOf(teacher, batchId)).toHaveLength(0)

    const again = await extract(t, teacher, batchId, 202)
    expect(IntakeExtractionRunEnvelopeSchema.parse(again.body).data.state).toBe('queued')
    await t.drain()
    expect((await reviewOf(teacher, batchId)).extraction?.state).toBe('succeeded')
    expect(await itemsOf(teacher, batchId)).toHaveLength(1)
  })

  it('an invalid provider answer is never stored', async () => {
    const { batchId } = await readyBatch(t, teacher)
    t.ai.paper = () => ({ nonsense: true }) as never
    await extract(t, teacher, batchId)
    for (let i = 0; i < 4; i++) {
      await t.releaseDelayed()
      await t.drain()
    }
    expect((await reviewOf(teacher, batchId)).extraction?.state).toBe('failed')
    expect(await itemsOf(teacher, batchId)).toHaveLength(0)
  })
})

describe('AI budget exhausted', () => {
  it('the run waits (queued, AI_BUDGET_EXHAUSTED), the batch says why, and it resumes without duplicates once the budget is back', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1'), draft(t.codes, '2')])
    const { batchId } = await readyBatch(t, teacher)
    t.ai.failures.push(Object.assign(new Error('budget'), { code: 'AI_BUDGET_EXHAUSTED' }))
    const started = await extract(t, teacher, batchId)
    expect(started.status).toBe(202)
    await t.drain()

    const waiting = await reviewOf(teacher, batchId)
    expect(waiting.extraction?.state).toBe('queued')
    expect(waiting.extraction?.reason?.code).toBe('AI_BUDGET_EXHAUSTED')
    expect(await batchRow(batchId)).toEqual({ status: 'submitted', status_reason: INTAKE_MESSAGES.budgetExhausted })
    expect(await itemsOf(teacher, batchId)).toHaveLength(0)

    // Not due yet: nothing runs and no provider call is made.
    const calls = t.ai.calls.length
    expect(await t.drain()).toBe(0)
    expect(t.ai.calls.length).toBe(calls)
    // A repeated request while waiting returns the same run (no second run, no second job).
    const same = await extract(t, teacher, batchId, 202)
    expect(IntakeExtractionRunEnvelopeSchema.parse(same.body).data.id).toBe(waiting.extraction?.id)

    // Budget raised: the follow-up job is due.
    await t.releaseDelayed()
    await t.drain()
    expect(t.ai.calls.length - calls).toBe(1)
    const done = await reviewOf(teacher, batchId)
    expect(done.extraction?.state).toBe('succeeded')
    expect(await itemsOf(teacher, batchId)).toHaveLength(2)
    expect((await batchRow(batchId)).status).toBe('ready_for_review')
    const runs = await t.db.query<{ n: string }>(`select count(*)::text n from intake_extraction_runs where batch_id = $1`, [batchId])
    expect(runs[0]?.n).toBe('1')
  })
})

describe('extract preconditions', () => {
  it('a batch with no processed file is not extractable (409) and no provider call is made', async () => {
    const created = await teacher.agent.post('/api/intake/batches').set('X-CSRF-Token', teacher.csrf).send({
      paperType: 'trial', subject: 'MATH', kertas: 1, year: 2025, source: 'Sumber ujian sintetik', copyright: 'sendiri', declaration: true,
    })
    expect(created.status).toBe(201)
    const calls = t.ai.calls.length
    const res = await post(teacher, `/intake/batches/${created.body.data.id}/extract`)
    expect(res.status).toBe(409)
    expect(res.body.error.message).toBe(INTAKE_MESSAGES.notExtractable)
    expect(t.ai.calls.length).toBe(calls)
  })

  it('a file imported by another finished batch is refused before any provider call; the earlier batch is named only to someone who may see it', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1')])
    const first = await readyBatch(t, teacher)
    await extractAndRun(t, teacher, first.batchId)
    const second = await readyBatch(t, other)
    // Same bytes as the first batch: same hash.
    await t.db.query(
      `update intake_files set sha256 = (select f.sha256 from intake_files f where f.batch_id = $1 limit 1) where batch_id = $2`,
      [first.batchId, second.batchId],
    )
    const calls = t.ai.calls.length

    const hidden = await post(other, `/intake/batches/${second.batchId}/extract`)
    expect(hidden.status).toBe(409)
    expect(hidden.body.error.message).toBe(INTAKE_MESSAGES.alreadyImported)
    expect(hidden.body.error.details).toBeUndefined()

    // An Admin Pusat sees both, so the earlier batch is named.
    const admin = await loginAs(t, 'admin@demo.test')
    const named = await post(admin, `/intake/batches/${second.batchId}/extract`)
    expect(named.status).toBe(409)
    expect(named.body.error.message).toBe(INTAKE_MESSAGES.alreadyImported)
    expect(named.body.error.details).toEqual({ batchId: first.batchId })
    expect(t.ai.calls.length).toBe(calls)
    const runs = await t.db.query<{ n: string }>(`select count(*)::text n from intake_extraction_runs where batch_id = $1`, [second.batchId])
    expect(runs[0]?.n).toBe('0')
  })

  it('concurrent requests create one run', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1')])
    const { batchId } = await readyBatch(t, teacher)
    const results = await Promise.all(Array.from({ length: 5 }, () => post(teacher, `/intake/batches/${batchId}/extract`)))
    expect(results.every((r) => r.status === 202)).toBe(true)
    expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1)
    await t.drain()
    expect(await itemsOf(teacher, batchId)).toHaveLength(1)
  })
})

describe('redaction before the provider (AC-8)', () => {
  it('cover-page identifiers never reach the extractor and are scrubbed from what it returns', async () => {
    const { batchId } = await readyBatch(t, teacher)
    const cover = [
      'PEPERIKSAAN PERCUBAAN',
      'Nama: Contoh Penuh Pelajar',
      'Guru: Contoh Guru Kelas',
      'Sekolah: SMK TAMAN CONTOH',
      'No. KP: 080808-10-1234',
      'Tel: 012-3456789',
      'E-mel: pelajar.contoh@sekolah.test',
      'Alamat: 1 Jalan Contoh, Taman Contoh',
      'Soalan 1. Hitung 2 + 3.',
    ].join('\n')
    await t.db.query(
      `update intake_pages set text = $1 where intake_file_id in (select id from intake_files where batch_id = $2) and page_no = 1`,
      [cover, batchId],
    )
    t.ai.paper = () => paper([draft(t.codes, '1', { stem: 'Hubungi guru.rahsia@sekolah.test atau 013-9876543 untuk soalan ini tentang pecahan.' })])
    const calls = t.ai.calls.length
    await extractAndRun(t, teacher, batchId)
    const sent = JSON.stringify(t.ai.calls[calls])
    for (const secret of ['Contoh Penuh Pelajar', 'Contoh Guru Kelas', 'TAMAN CONTOH', '080808', '3456789', 'pelajar.contoh', 'Jalan Contoh']) {
      expect(sent, secret).not.toContain(secret)
    }
    expect(sent).toContain('Hitung 2 + 3')
    expect(t.ai.calls[calls]?.images?.some((im) => im.page === 1) ?? false).toBe(false)

    const stored = await t.db.query<{ payload: unknown }>(`select payload from intake_items where batch_id = $1`, [batchId])
    const text = JSON.stringify(stored)
    expect(text).not.toContain('guru.rahsia')
    expect(text).not.toContain('9876543')
  })
})
