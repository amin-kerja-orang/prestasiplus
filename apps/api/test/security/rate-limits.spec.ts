import { ErrorBodySchema } from '@pp/contract'
import type { Response } from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GLOBAL_RATE_SPEC } from '../../src/common/security/global-rate-limit.guard'
import { ACCOUNT_LIMITS } from '../../src/modules/account/account.constants'
import { DEFAULT_LOGIN_LIMIT } from '../../src/modules/auth/auth.constants'
import { FilesConfig } from '../../src/modules/files/files.config'
import { INTAKE_LIMITS } from '../../src/modules/intake/files/intake-files.config'
import { SUPPORT_LIMITS } from '../../src/modules/support/support.constants'
import { ACCOUNT_THROTTLE, ACCOUNT_RESET_REQUEST_INTERVAL_SECONDS } from '@pp/contract'
import { makePng } from '../files/fixtures'
import { bootSecurityApp, DEMO_PASSWORD, loginAs, type SecurityApp } from './helpers'

/**
 * BE-33 AC2: login, password reset, registration, file upload and ticket creation are rate limited;
 * the 429 is `RATE_LIMITED` with `error.retryAfter` (a positive integer) and a `Retry-After` header.
 *
 * Limits are read from the validated environment when the app boots, so the app below is booted with low
 * ceilings for registration, upload and tickets. Login and password reset run on their DEFAULTS. The
 * clock is fixed, so no window ever expires inside a test. The default numbers are asserted at the end
 * (they are the numbers of the operations runbook).
 */

function expectRateLimited(res: Response, maxRetry: number): void {
  expect(res.status, JSON.stringify(res.body)).toBe(429)
  const { error } = ErrorBodySchema.parse(res.body)
  expect(error.code).toBe('RATE_LIMITED')
  expect(Number.isInteger(error.retryAfter)).toBe(true)
  expect(error.retryAfter).toBeGreaterThanOrEqual(1)
  expect(error.retryAfter).toBeLessThanOrEqual(maxRetry)
  expect(res.headers['retry-after']).toBe(String(error.retryAfter))
}

describe('BE-33 AC2: rate limits answer 429 RATE_LIMITED with retryAfter', () => {
  let t: SecurityApp

  beforeAll(async () => {
    t = await bootSecurityApp({
      env: {
        THROTTLE_REGISTER_PER_MINUTE: '3',
        UPLOAD_RATE_PER_MINUTE: '3',
        THROTTLE_SUPPORT_TICKET_CREATE_PER_HOUR: '2',
        THROTTLE_LOGIN_PER_MINUTE: undefined, // the default (5) is the test
      },
    })
  })
  afterAll(async () => {
    await t.close()
  })

  it('login: the 6th failed attempt of an identifier from one address (default 5 per 60 s) is 429, even with the right password', async () => {
    const ip = '10.20.0.1'
    const post = (password: string) =>
      t.http().post('/api/auth/login').set('X-Forwarded-For', ip).send({ identifier: 'pelajar2@demo.test', password, remember: false })
    for (let i = 0; i < DEFAULT_LOGIN_LIMIT; i++) {
      const res = await post('Salah-1234')
      expect(res.status).toBe(401)
    }
    expectRateLimited(await post('Salah-1234'), 60)
    expectRateLimited(await post(DEMO_PASSWORD), 60)
    // Another address is not affected.
    const other = await t.http().post('/api/auth/login').set('X-Forwarded-For', '10.20.0.2').send({ identifier: 'pelajar2@demo.test', password: DEMO_PASSWORD, remember: false })
    expect(other.status).toBe(200)
  })

  it('password reset: a second request for the same e-mail within 60 s (default) is 429', async () => {
    const ip = '10.20.0.3'
    const email = 'pelajar@demo.test'
    const ask = (to: string) => t.http().post('/api/auth/password/email').set('X-Forwarded-For', ip).send({ email: to })
    expect((await ask(email)).status).toBe(200)
    expectRateLimited(await ask(email), ACCOUNT_RESET_REQUEST_INTERVAL_SECONDS)
    // Unknown e-mails are throttled the same way (no account enumeration through the limiter).
    expect((await ask('tiada.siapa@ujian.test')).status).toBe(200)
    expectRateLimited(await ask('tiada.siapa@ujian.test'), ACCOUNT_RESET_REQUEST_INTERVAL_SECONDS)
  })

  it('password reset: the per-address ceiling (default 20 per 60 s) is 429 across different e-mails', async () => {
    const ip = '10.20.0.4'
    const ask = (i: number) => t.http().post('/api/auth/password/email').set('X-Forwarded-For', ip).send({ email: `orang${String(i)}@ujian.test` })
    for (let i = 0; i < ACCOUNT_THROTTLE.ipCeilingPerWindow; i++) expect((await ask(i)).status).toBe(200)
    expectRateLimited(await ask(999), ACCOUNT_THROTTLE.windowSeconds)
  })

  it('registration: every attempt counts per address; over the (lowered) ceiling is 429', async () => {
    const ip = '10.20.0.5'
    const register = () => t.http().post('/api/auth/register').set('X-Forwarded-For', ip).send({})
    for (let i = 0; i < 3; i++) expect((await register()).status).toBe(422)
    expectRateLimited(await register(), 60)
  })

  it('file upload: over the (lowered) per-user ceiling is 429', async () => {
    const l = await loginAs(t, 'pelajar@demo.test', { ip: '10.20.0.6' })
    const up = () =>
      l.agent
        .post('/api/files?purpose=avatar')
        .set('X-CSRF-Token', l.csrf)
        .attach('file', makePng(), { filename: 'gambar.png', contentType: 'image/png' })
    for (let i = 0; i < 3; i++) expect((await up()).status).toBe(201)
    expectRateLimited(await up(), 60)
    // The limit is per user: another user can still upload.
    const other = await loginAs(t, 'pelajar2@demo.test', { ip: '10.20.0.7' })
    const ok = await other.agent
      .post('/api/files?purpose=avatar')
      .set('X-CSRF-Token', other.csrf)
      .attach('file', makePng(), { filename: 'gambar.png', contentType: 'image/png' })
    expect(ok.status).toBe(201)
  })

  it('ticket creation: over the (lowered) per-user hourly ceiling is 429 with retryAfter up to 3600', async () => {
    const l = await loginAs(t, 'pelajar@demo.test', { ip: '10.20.0.8' })
    const create = () => l.agent.post('/api/tiket').set('X-CSRF-Token', l.csrf).send({ subject: 'Soalan ujian', body: 'Isi pertanyaan ujian.' })
    for (let i = 0; i < 2; i++) expect((await create()).status).toBe(201)
    expectRateLimited(await create(), 3600)
  })
})

describe('BE-33 AC2: the default numbers (the ones the runbook lists)', () => {
  it('login 5 failed per 60 s; reset 1 per e-mail per 60 s and 20 per address; registration 30 per minute; upload 30 per minute; tickets 10 per hour; global 300 per minute', () => {
    expect(DEFAULT_LOGIN_LIMIT).toBe(5)
    expect(ACCOUNT_RESET_REQUEST_INTERVAL_SECONDS).toBe(60)
    expect(ACCOUNT_THROTTLE).toEqual({ failedAttemptsPerWindow: 5, windowSeconds: 60, ipCeilingPerWindow: 20 })
    expect(ACCOUNT_LIMITS.register).toMatchObject({ default: 30, per: 'ip' })
    expect(ACCOUNT_LIMITS.register.env).toBe('THROTTLE_REGISTER_PER_MINUTE')
    expect(new FilesConfig({ get: () => undefined } as never)).toMatchObject({ ratePerMinute: 30, readsPerMinute: 120 })
    expect(SUPPORT_LIMITS.create).toMatchObject({ default: 10, per: 'user', windowSeconds: 3600 })
    expect(INTAKE_LIMITS.write).toMatchObject({ default: 20, per: 'user' })
    expect(GLOBAL_RATE_SPEC).toMatchObject({ default: 300, per: 'ip' })
  })
})
