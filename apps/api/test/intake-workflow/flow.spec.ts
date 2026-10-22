import { IntakeBatchReviewEnvelopeSchema, IntakeExtractionRunEnvelopeSchema, IntakeItemEnvelopeSchema, IntakeItemListResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, draft, extract, extractAndRun, itemsOf, loginAs, paper, post, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

/** AC-1: upload, extract, review, accept ends in a Draf question, end to end through the HTTP API. */
let t: WorkflowTestApp
let teacher: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp()
  teacher = await loginAs(t, 'guru@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

describe('intake-e2e (AC-1)', () => {
  it('upload, extract, review, edit, accept: a Draf question exists with provenance', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1'), draft(t.codes, '2', { lowFields: ['stem'], fieldConfidence: { stem: 0.5, marks: 0.97 } })])
    const { batchId } = await readyBatch(t, teacher)

    const started = await extract(t, teacher, batchId, 202)
    expect(IntakeExtractionRunEnvelopeSchema.parse(started.body).data.state).toBe('queued')
    await t.drain()
    expect(t.ai.calls).toHaveLength(1)

    const review = IntakeBatchReviewEnvelopeSchema.parse((await teacher.agent.get(`/api/intake/batches/${batchId}/review`)).body).data
    expect(review.extraction?.state).toBe('succeeded')
    expect(review.counts.items).toBe(2)
    expect(review.counts.states.generated).toBe(1)
    expect(review.counts.states.needs_review).toBe(1)

    const list = IntakeItemListResponseSchema.parse((await teacher.agent.get(`/api/intake/items?batchId=${batchId}`)).body)
    expect(list.meta.totalItems).toBe(2)
    const [first, second] = await itemsOf(teacher, batchId)

    // The low field blocks accept until a person confirms it.
    const blocked = await post(teacher, `/intake/items/${second!.id}/accept`)
    expect(blocked.status).toBe(422)
    expect(blocked.body.error.details.issues.length).toBeGreaterThan(0)

    const confirmed = await teacher.agent.patch(`/api/intake/items/${second!.id}`).set('X-CSRF-Token', teacher.csrf).send({ confirmed: ['stem'] })
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200)
    expect(confirmed.body.data.state).toBe('generated')

    for (const id of [first!.id, second!.id]) {
      const res = await post(teacher, `/intake/items/${id}/accept`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const item = IntakeItemEnvelopeSchema.parse(res.body).data
      expect(item.state).toBe('accepted')
      expect(item.question?.status).toBe('draft')
    }

    const rows = await t.db.query<{ status: string; n: string }>(
      `select v.status, count(*)::text n from question_versions v join intake_items i on i.question_id = v.question_id and i.question_version_no = v.version_no where i.batch_id = $1 group by v.status`,
      [batchId],
    )
    expect(rows).toEqual([{ status: 'draft', n: '2' }])
    const prov = await t.db.query<{ source_type: string; ai_model: string | null; number_label: string | null }>(
      `select q.source_type, v.ai_model, v.number_label from questions q join question_versions v on v.question_id = q.id join intake_items i on i.question_id = q.id where i.batch_id = $1 order by v.number_label`,
      [batchId],
    )
    expect(prov.map((p) => p.number_label)).toEqual(['1', '2'])
    expect(prov.every((p) => p.source_type === 'pdf' && p.ai_model === 'mock-1')).toBe(true)
  })

  it('extract is idempotent: a second request after success answers 200 and adds nothing', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1')])
    const { batchId } = await readyBatch(t, teacher)
    const before = t.ai.calls.length
    await extractAndRun(t, teacher, batchId)
    const again = await extract(t, teacher, batchId, 200)
    expect(IntakeExtractionRunEnvelopeSchema.parse(again.body).data.state).toBe('succeeded')
    await t.drain()
    expect(t.ai.calls.length - before).toBe(1)
    expect(await itemsOf(teacher, batchId)).toHaveLength(1)
  })
})
