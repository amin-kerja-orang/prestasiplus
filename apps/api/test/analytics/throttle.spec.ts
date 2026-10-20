import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, STUDENT_1, TEACHER_A, type AnalyticsTestApp, type Client, bootAnalyticsApp, client, errorIs } from './helpers'

describe('M11 throttle (per user, 429 with Retry-After)', () => {
  let t: AnalyticsTestApp
  let admin: Client
  let teacher: Client
  let student: Client

  beforeAll(async () => {
    t = await bootAnalyticsApp({ env: { THROTTLE_ANALYTICS_READ_PER_MINUTE: '3' } })
    admin = await client(t, ADMIN)
    teacher = await client(t, TEACHER_A)
    student = await client(t, STUDENT_1)
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('the fourth read in a minute is 429 on every route of the bucket; another user is not affected', async () => {
    for (let i = 0; i < 3; i++) expect((await admin.get('/monitoring/overview')).status).toBe(200)
    const res = await admin.get('/teacher/report')
    errorIs(res, 429, 'RATE_LIMITED')
    expect(res.headers['retry-after']).toBeDefined()
    expect(res.body.error.retryAfter).toBeGreaterThan(0)
    expect((await teacher.get('/monitoring/overview')).status).toBe(200)
  })

  it('a refused request (403) is not counted against the user', async () => {
    for (let i = 0; i < 6; i++) errorIs(await student.get('/monitoring/overview'), 403, 'FORBIDDEN')
  })
})
