import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'

/**
 * R1-T30 (B2 MAJOR): the overview counts the whole bank, so it has its OWN rate-limit bucket
 * (`THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE`, default 6), separate from the cheap reads (`THROTTLE_SERVABILITY_READ_PER_MINUTE`, 120).
 * Small limits here make both visible; the shared test clock never advances, so a window never resets inside the spec.
 */
describe('servability rate limits: the overview has its own bucket (R1-T30)', () => {
  let t: QuestionsTestApp
  let admin: Client

  beforeAll(async () => {
    process.env.THROTTLE_SERVABILITY_READ_PER_MINUTE = '3'
    process.env.THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE = '2'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
  })
  afterAll(async () => {
    delete process.env.THROTTLE_SERVABILITY_READ_PER_MINUTE
    delete process.env.THROTTLE_SERVABILITY_OVERVIEW_PER_MINUTE
    await t.close()
  })

  it('draining the read bucket (3) does not touch the overview bucket, and the overview stops at its own limit (2)', async () => {
    for (let i = 0; i < 3; i += 1) expect((await admin.get('/api/admin/servability/lanes/databank')).status, `read ${String(i + 1)}`).toBe(200)
    expectError(await admin.get('/api/admin/servability/lanes/databank'), 'RATE_LIMITED')
    expectError(await admin.get('/api/admin/servability/lanes/bijak-spm'), 'RATE_LIMITED')

    expect((await admin.get('/api/admin/servability/overview')).status).toBe(200)
    expect((await admin.get('/api/admin/servability/overview')).status).toBe(200)
    const limited = await admin.get('/api/admin/servability/overview')
    expectError(limited, 'RATE_LIMITED')
    expect(Number(limited.headers['retry-after'])).toBeGreaterThanOrEqual(1)
  })
})
