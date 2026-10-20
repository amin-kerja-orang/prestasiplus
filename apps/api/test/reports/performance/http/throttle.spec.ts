import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { expectError, loginAs } from '../../../curriculum/helpers'
import { bootWorld, type World } from './boot'

let w: World

beforeAll(async () => {
  w = await bootWorld({ THROTTLE_PERFORMANCE_READ_PER_MINUTE: '3' })
}, 120_000)
afterAll(async () => {
  await w?.close()
  delete process.env.THROTTLE_PERFORMANCE_READ_PER_MINUTE
})

describe('rate limit', () => {
  it('answers 429 with Retry-After once the per-user budget is spent, and is per user', async () => {
    const a = await loginAs(w, 'guru@demo.test')
    for (let i = 0; i < 3; i++) expect((await a.get('/api/analytics/me')).status).toBe(200)
    const res = await a.get('/api/analytics/me')
    expectError(res, 'RATE_LIMITED')
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)

    const b = await loginAs(w, 'admin@demo.test')
    expect((await b.get('/api/analytics/me')).status).toBe(200)
  })
})
