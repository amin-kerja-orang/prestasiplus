import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootPartC, expectError, jsonOf, loginPartC, type LoggedIn, type PartCApp } from '../content/audio-helpers'

describe('THROTTLE_SUPPORT_READ_PER_MINUTE (429 + Retry-After)', () => {
  let t: PartCApp
  let student: LoggedIn
  let admin: LoggedIn

  beforeAll(async () => {
    t = await bootPartC({ THROTTLE_SUPPORT_READ_PER_MINUTE: '2' })
    student = await loginPartC(t, 'pelajar@demo.test')
    admin = await loginPartC(t, 'admin@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  it('the 3rd GET /api/tiket in a minute is 429 with Retry-After and the error envelope; another user is unaffected', async () => {
    for (let i = 0; i < 2; i++) expect((await jsonOf(student).get('/tiket')).status).toBe(200)
    const res = await jsonOf(student).get('/tiket')
    const err = expectError(res, 'RATE_LIMITED', 'Too Many Attempts.')
    expect(err.retryAfter).toBeGreaterThan(0)
    expect(Number(res.headers['retry-after'])).toBe(err.retryAfter)
    expect((await jsonOf(admin).get('/tiket')).status).toBe(200)
  })

  it('the admin queue and open-count share the read bucket: the admin queue read after that is 429 with Retry-After', async () => {
    // The admin already spent one of the 2 reads in the previous test (GET /api/tiket), so one more fills the bucket.
    expect((await jsonOf(admin).get('/admin/tiket/open-count')).status).toBe(200)
    const res = await jsonOf(admin).get('/admin/tiket')
    expect(expectError(res, 'RATE_LIMITED', 'Too Many Attempts.').retryAfter).toBeGreaterThan(0)
    expect(res.headers['retry-after']).toBeTruthy()
  })
})
