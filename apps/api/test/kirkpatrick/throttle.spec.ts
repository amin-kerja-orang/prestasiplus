import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, type KirkpatrickTestApp, bootKirkpatrickApp, client, errorIs, STUDENT_1, TEACHER_A, ADMIN } from './helpers'

describe('throttles (per user, 429 with Retry-After)', () => {
  let t: KirkpatrickTestApp
  let student: Client
  let teacher: Client
  let admin: Client

  beforeAll(async () => {
    t = await bootKirkpatrickApp({ env: { THROTTLE_KIRKPATRICK_READ_PER_MINUTE: '3', THROTTLE_KIRKPATRICK_WRITE_PER_MINUTE: '2' } })
    student = await client(t, STUDENT_1)
    teacher = await client(t, TEACHER_A)
    admin = await client(t, ADMIN)
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('writes: the third POST /feedback in a minute is 429, whatever its outcome', async () => {
    expect((await student.post('/feedback', { nps: 5, satisfaction: 3 })).status).toBe(201)
    expect((await student.post('/feedback', { nps: 5, satisfaction: 3 })).status).toBe(409)
    const res = await student.post('/feedback', { nps: 5, satisfaction: 3 })
    errorIs(res, 429, 'RATE_LIMITED')
    expect(res.headers['retry-after']).toBeDefined()
    expect(res.body.error.retryAfter).toBeGreaterThan(0)
  })

  it('writes: POST /kirkpatrick/interventions has the same budget', async () => {
    for (let i = 0; i < 2; i++) expect((await teacher.post('/kirkpatrick/interventions', {})).status).toBe(422)
    const res = await teacher.post('/kirkpatrick/interventions', {})
    errorIs(res, 429, 'RATE_LIMITED')
    expect(res.headers['retry-after']).toBeDefined()
  })

  it('reads: the fourth read in a minute is 429; the budget is per user', async () => {
    for (let i = 0; i < 3; i++) expect((await admin.get('/kirkpatrick/chain')).status).toBe(200)
    errorIs(await admin.get('/kirkpatrick/chain'), 429, 'RATE_LIMITED')
    // Another user is not affected.
    expect((await teacher.get('/kirkpatrick/chain')).status).toBe(200)
  })

  it('a refused request (403) is not counted against the user', async () => {
    for (let i = 0; i < 6; i++) errorIs(await student.get('/kirkpatrick/overview'), 403, 'FORBIDDEN')
  })
})
