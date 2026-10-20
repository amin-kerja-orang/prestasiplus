import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT, bootGamificationApp, fail, signIn, type Client, type GamificationTestApp } from './helpers'

/** D57: a write ceiling per signed-in user answers 429 RATE_LIMITED with retryAfter; refused requests (401, 403, CSRF) are not counted. */
describe('rate limits (D57)', () => {
  let t: GamificationTestApp
  let student: Client
  let admin: Client

  beforeAll(async () => {
    t = await bootGamificationApp({ env: { THROTTLE_GAMIFICATION_CONVERT_PER_MINUTE: '3', THROTTLE_ADMIN_WRITE_PER_MINUTE: '2', THROTTLE_WALLET_READ_PER_MINUTE: '4', THROTTLE_ADMIN_READ_PER_MINUTE: '3' } })
    student = await signIn(t, STUDENT)
    admin = await signIn(t, ADMIN)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('convert: the 4th call in a minute is 429 with retryAfter (the first three ran: 422 here only because 1 is below the rate)', async () => {
    for (let i = 0; i < 3; i++) fail(await student.post('/gamification/convert', { syilingAmount: 1 }), 422, 'VALIDATION_ERROR')
    const res = await student.post('/gamification/convert', { syilingAmount: 1 })
    const err = fail(res, 429, 'RATE_LIMITED')
    expect(err).toBeTruthy()
    expect((res.body as { error: { retryAfter: number } }).error.retryAfter).toBeGreaterThan(0)
  })

  it('a request without CSRF is refused before the limiter and does not count', async () => {
    for (let i = 0; i < 5; i++) fail(await admin.noCsrfPost('/admin/gamification/tiers', {}), 403, 'CSRF_INVALID')
    fail(await admin.post('/admin/gamification/tiers', {}), 422, 'VALIDATION_ERROR')
    fail(await admin.post('/admin/gamification/tiers', {}), 422, 'VALIDATION_ERROR')
    fail(await admin.post('/admin/gamification/tiers', {}), 429, 'RATE_LIMITED')
  })

  it('admin reads and student reads have their own per-user ceilings', async () => {
    for (let i = 0; i < 3; i++) expect((await admin.get('/admin/gamification/tiers')).status).toBe(200)
    fail(await admin.get('/admin/gamification/tiers'), 429, 'RATE_LIMITED')
    for (let i = 0; i < 4; i++) expect((await student.get('/gamification/leaderboard')).status).toBe(200)
    fail(await student.get('/gamification/leaderboard'), 429, 'RATE_LIMITED')
  })
})
