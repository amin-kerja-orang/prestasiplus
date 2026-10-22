import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootSpmApp, loginAgent, type SpmTestApp } from './helpers'

let t: SpmTestApp
let a: Awaited<ReturnType<typeof loginAgent>>
let b: Awaited<ReturnType<typeof loginAgent>>

beforeAll(async () => {
  t = await bootSpmApp({ env: { THROTTLE_SPM_MOCK_CREATE_PER_MINUTE: '2', THROTTLE_SPM_WALKTHROUGH_PER_MINUTE: '2' } })
  a = await loginAgent(t, 'student')
  b = await loginAgent(t, 'student2')
}, 120_000)
afterAll(async () => {
  await t.close()
})

describe('SPM per-user rate limits (BE-41)', () => {
  it('mock creation: the 3rd POST in the window is 429 RATE_LIMITED; another user and the list are unaffected', async () => {
    const post = (c: typeof a) => c.agent.post('/api/spm-mocks').set('X-CSRF-Token', c.csrf).send({ subject: 'Matematik', paperNumber: 1 })
    await post(a)
    await post(a)
    const limited = await post(a)
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('RATE_LIMITED')
    expect((await post(b)).status).not.toBe(429)
    expect((await a.agent.get('/api/spm-mocks')).status).toBe(200)
  })

  it('walkthrough: the 3rd POST in the window is 429 RATE_LIMITED', async () => {
    const post = () => a.agent.post('/api/spm-walkthrough/solve').set('X-CSRF-Token', a.csrf).field('subject', 'Matematik').field('question_text', 'Apakah x?')
    expect((await post()).status).toBe(200)
    expect((await post()).status).toBe(200)
    const limited = await post()
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('RATE_LIMITED')
  })
})
