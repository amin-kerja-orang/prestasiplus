import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, type PracticeTestApp, type World, bootPracticeApp, fillBank, loadWorld, loginAs } from './helpers'

/** Every practice write is limited per user (bucket practice.write); reads and refused requests are not counted. */
let t: PracticeTestApp
let w: World
let pelajar: Client
let maju: Client

beforeAll(async () => {
  t = await bootPracticeApp({ env: { THROTTLE_PRACTICE_WRITE_PER_MINUTE: '3', THROTTLE_PRACTICE_READ_PER_MINUTE: '2' } })
  w = await loadWorld(t.db)
  fillBank(t.bank, w)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  maju = await loginAs(t, 'pelajarmaju@demo.test')
}, 120_000)

afterAll(async () => {
  await t.close()
})

describe('rate limit on the three writes', () => {
  it('the 4th write inside the window is 429 RATE_LIMITED with retryAfter and Retry-After; another user and the reads are unaffected', async () => {
    const body = { mode: 'random', subjectCode: 'MATH', count: 5 }
    // A refused request (CSRF) does not use the allowance.
    expect((await pelajar.noCsrf.post('/api/practice/sessions', body)).status).toBe(403)
    expect((await pelajar.post('/api/practice/sessions', body)).status).toBe(201)
    expect((await pelajar.post('/api/practice/sessions/11111111-1111-4111-8111-111111111111/submit', {})).status).toBe(404)
    expect((await pelajar.post('/api/practice/sessions/11111111-1111-4111-8111-111111111111/check-answer', { questionId: '1', selectedOptionId: 0 })).status).toBe(404)
    const limited = await pelajar.post('/api/practice/sessions', body)
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('RATE_LIMITED')
    expect(typeof limited.body.error.retryAfter).toBe('number')
    expect(limited.headers['retry-after']).toBe(String(limited.body.error.retryAfter))
    expect((await maju.post('/api/practice/sessions', body)).status).toBe(201)
    // The window moves with the clock.
    t.clock.advance(61_000)
    expect((await pelajar.post('/api/practice/sessions', body)).status).toBe(201)
  })

  it('the history read is limited per user too (bucket practice.read): the 3rd read is 429, a write and another user are unaffected', async () => {
    t.clock.advance(120_000)
    const url = '/api/practice/sessions?modes=random'
    expect((await pelajar.get(url)).status).toBe(200)
    expect((await pelajar.get(url)).status).toBe(200)
    const limited = await pelajar.get(url)
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('RATE_LIMITED')
    expect(limited.headers['retry-after']).toBe(String(limited.body.error.retryAfter))
    expect((await maju.get(url)).status).toBe(200)
    expect((await pelajar.post('/api/practice/sessions', { mode: 'random', subjectCode: 'MATH', count: 5 })).status).toBe(201)
  })
})
