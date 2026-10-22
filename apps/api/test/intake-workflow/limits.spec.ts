import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, draft, extract, loginAs, paper, post, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

let t: WorkflowTestApp
let teacher: LoggedIn

beforeAll(async () => {
  t = await bootWorkflowApp({ INTAKE_EXTRACTS_PER_MINUTE: '2', INTAKE_BULK_PER_MINUTE: '1', INTAKE_REVIEW_WRITES_PER_MINUTE: '3' })
  teacher = await loginAs(t, 'guru@demo.test')
}, 120_000)
afterAll(async () => {
  await t.close()
})

function expectLimited(res: { status: number; body: { error: { code: string; retryAfter?: number } }; headers: Record<string, string> }): void {
  expect(res.status).toBe(429)
  expect(res.body.error.code).toBe('RATE_LIMITED')
  expect(res.body.error.retryAfter).toBeGreaterThan(0)
  expect(res.headers['retry-after']).toBeTruthy()
}

describe('rate limits (D57a)', () => {
  it('extract is limited per user and answers 429 with Retry-After', async () => {
    t.ai.paper = () => paper([draft(t.codes, '1')])
    const { batchId } = await readyBatch(t, teacher)
    expect((await extract(t, teacher, batchId)).status).toBe(202)
    expect((await extract(t, teacher, batchId)).status).toBe(202)
    expectLimited(await post(teacher, `/intake/batches/${batchId}/extract`))
  })

  it('bulk is limited per user', async () => {
    const admin = await loginAs(t, 'admin@demo.test')
    expect((await post(admin, '/intake/items/bulk', { action: 'reject', ids: ['987654321'], reason: 'x' })).status).toBe(200)
    expectLimited(await post(admin, '/intake/items/bulk', { action: 'reject', ids: ['987654321'], reason: 'x' }))
  })

  it('review writes are limited per user', async () => {
    const other = await loginAs(t, 'admin@demo.test')
    const statuses: number[] = []
    for (let i = 0; i < 5; i++) statuses.push((await post(other, '/intake/items/987654321/reject', { reason: 'x' })).status)
    expect(statuses.slice(0, 3)).toEqual([404, 404, 404])
    expect(statuses.slice(3)).toEqual([429, 429])
  })
})
