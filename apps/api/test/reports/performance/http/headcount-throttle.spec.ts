import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { expectError, loginAs } from '../../../curriculum/helpers'
import { bootHeadcountWorld, type HeadcountWorld } from './headcount-boot'

let w: HeadcountWorld

beforeAll(async () => {
  w = await bootHeadcountWorld({ THROTTLE_PERFORMANCE_WRITE_PER_MINUTE: '2' })
}, 180_000)
afterAll(async () => {
  await w?.close()
  delete process.env.THROTTLE_PERFORMANCE_WRITE_PER_MINUTE
})

describe('headcount write bucket', () => {
  it('writes have their own per-user budget: 429 with Retry-After on the third write, reads stay open', async () => {
    const guru = await loginAs(w, 'guru@demo.test')
    expect((await guru.post('/api/headcounts/auto-setup', { levels: ['T4'] })).status).toBe(200)
    expect((await guru.post('/api/headcounts/auto-setup', { levels: ['T4'] })).status).toBe(200)
    const res = await guru.delete('/api/headcounts/987654321')
    expectError(res, 'RATE_LIMITED')
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    // The read bucket is separate and untouched.
    expect((await guru.get('/api/headcounts')).status).toBe(200)
    // Per user: another teacher still has a budget.
    const other = await loginAs(w, 'guru2@demo.test')
    expect((await other.post('/api/headcounts/auto-setup', { levels: ['T4'] })).status).toBe(200)
  })
})
