import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'

/**
 * REQ-A-018 (B3 pre-scan): `GET /api/admin/questions/:id/paper-servability` shares the 120-a-minute-per-user bucket of the servability reads
 * (env `THROTTLE_SERVABILITY_READ_PER_MINUTE`). A low limit makes the 429 testable: the 6th call inside the minute is refused.
 */
describe('REQ-A-018 paper-servability rate limit', () => {
  let t: QuestionsTestApp
  let admin: Client
  beforeAll(async () => {
    process.env.THROTTLE_SERVABILITY_READ_PER_MINUTE = '5'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
  })
  afterAll(async () => {
    delete process.env.THROTTLE_SERVABILITY_READ_PER_MINUTE
    await t.close()
  })

  it('the 6th call within a minute is 429 with Retry-After; the first five are answered (404 for an unknown id)', async () => {
    const codes: number[] = []
    for (let i = 0; i < 6; i++) codes.push((await admin.get('/api/admin/questions/999999999/paper-servability')).status)
    expect(codes).toEqual([404, 404, 404, 404, 404, 429])
    const again = await admin.get('/api/admin/questions/999999999/paper-servability')
    expect(again.status).toBe(429)
    expect(Number(again.headers['retry-after'])).toBeGreaterThan(0)
  })
})
