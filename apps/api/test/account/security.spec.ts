import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import { overloadTo429 } from '../../src/modules/account/helpers'
import { LoggingMailPort } from '../../src/modules/account/ports'
import { type AccountTestApp, bootAccountApp, errorOf, login, put } from './account-helpers'

const STUDENT = 'pelajar@demo.test'

let apps: AccountTestApp[] = []
async function boot(opts: Parameters<typeof bootAccountApp>[0] = {}): Promise<AccountTestApp> {
  const t = await bootAccountApp(opts)
  apps.push(t)
  return t
}
afterEach(async () => {
  for (const t of apps) await t.close()
  apps = []
})

const stub = (values: Record<string, string | undefined>): ConfigService => ({ get: (key: string) => values[key] }) as unknown as ConfigService

describe('LoggingMailPort prints the link only in development with the explicit flag', () => {
  it.each([
    ['test', 'true', false],
    ['production', 'true', false],
    ['production', undefined, false],
    ['development', undefined, false],
    ['development', 'false', false],
    ['development', 'true', true],
  ])('NODE_ENV=%s MAIL_LOG_RESET_LINKS=%s -> link printed: %s', async (nodeEnv, flag, printed) => {
    const lines: string[] = []
    const sink = (msg: unknown) => lines.push(String(msg))
    const spies = [vi.spyOn(Logger.prototype, 'log').mockImplementation(sink), vi.spyOn(Logger.prototype, 'warn').mockImplementation(sink)]
    try {
      await new LoggingMailPort(stub({ NODE_ENV: nodeEnv, MAIL_LOG_RESET_LINKS: flag })).sendPasswordReset({
        to: 'orang@contoh.test',
        userId: '1',
        resetId: '9',
        token: 'SECRET-TOKEN-VALUE',
        link: '/password/reset#token=SECRET-TOKEN-VALUE&email=orang%40contoh.test',
        expiresAt: new Date(),
      })
    } finally {
      for (const s of spies) s.mockRestore()
    }
    const text = lines.join('\n')
    expect(text.includes('SECRET-TOKEN-VALUE')).toBe(printed)
    // The e-mail is masked in every case, and the reset id is always there.
    expect(text).not.toContain('orang@contoh.test')
    expect(text).toContain('o***@contoh.test')
    expect(text).toContain('resetId=9')
  })
})

describe('timing and enumeration (D55a, D55b)', () => {
  it('every outcome of the reset routes is held to the response floor, and the real work finishes well under it', async () => {
    const floor = 1500
    const t = await boot({ env: { LOGIN_FAILURE_FLOOR_MS: String(floor) } })
    const link = (email: string) => t.http().post('/api/auth/password/email').send({ email })
    const ic = (email: string, icNumber: string) => t.http().post('/api/auth/password/reset-ic').send({ email, icNumber })
    const redeem = (email: string) =>
      t.http().post('/api/auth/password/reset').send({ token: 'z'.repeat(43), email, password: 'Baharu123', passwordConfirmation: 'Baharu123' })
    const time = async (fn: () => Promise<unknown>) => {
      const t0 = performance.now()
      await fn()
      return performance.now() - t0
    }

    // Warm-up: the first request of a process pays for connections and module loading, so it is not measured.
    await link('warmup@ujian.test')
    await link('pelajar2@demo.test') // the known path too: token issue, mail port, audit
    await ic('warmup@ujian.test', '999999999999')
    await redeem('warmup@ujian.test')

    // The mail port is called after the known-path DB work (token issue): its timestamp is the real work time.
    let mailAt = 0
    const send = t.mail.sendPasswordReset.bind(t.mail)
    t.mail.sendPasswordReset = (m) => {
      mailAt = performance.now()
      return send(m)
    }
    t.clock.advance(61_000)
    const started = performance.now()
    const known = await time(() => link(STUDENT))
    expect(mailAt).toBeGreaterThan(0)
    expect(mailAt - started).toBeLessThan(floor / 2) // the work is far below the floor, so the floor decides the answer time
    t.clock.advance(61_000)
    const unknown = await time(() => link('tiada.siapa@ujian.test'))
    // Both answers are held to the floor (a timer, so this lower bound cannot be flaky).
    expect(known).toBeGreaterThanOrEqual(floor - 20)
    expect(unknown).toBeGreaterThanOrEqual(floor - 20)

    for (const [name, run] of [
      ['reset-ic wrong IC', () => ic(STUDENT, '999999999999')],
      ['reset-ic unknown e-mail', () => ic('tiada.siapa@ujian.test', '999999999999')],
      ['reset wrong token', () => redeem(STUDENT)],
      ['reset unknown e-mail', () => redeem('tiada.siapa@ujian.test')],
    ] as const) {
      t.clock.advance(16 * 60_000)
      expect(await time(run), name).toBeGreaterThanOrEqual(floor - 20)
    }
  })
})

describe('rate limits on writes and public lookups (D57a)', () => {
  it('writes are limited per user with 429, retryAfter and Retry-After; reads are not counted', async () => {
    const t = await boot({ env: { THROTTLE_ACCOUNT_WRITE_PER_MINUTE: '3' } })
    const who = await login(t, STUDENT)
    for (let i = 0; i < 3; i++) expect((await put(who, '/me', { name: 'Murid Demo' })).status).toBe(200)
    const blocked = await put(who, '/me', { name: 'Murid Demo' })
    const err = errorOf(blocked, 429, 'RATE_LIMITED')
    expect(err.retryAfter).toBeGreaterThan(0)
    expect(blocked.headers['retry-after']).toBe(String(err.retryAfter))
    expect((await who.agent.get('/api/me')).status).toBe(200)
    // Settings, password and picture share the per-user bucket.
    expect((await put(who, '/me/settings', {})).status).toBe(429)
    expect((await put(who, '/me/password', {})).status).toBe(429)
  })

  it('public stats and registration are limited per client address', async () => {
    const t = await boot({ env: { THROTTLE_PUBLIC_PER_MINUTE: '3' } })
    for (let i = 0; i < 3; i++) expect((await t.http().get('/api/public/stats')).status).toBe(200)
    const stats = await t.http().get('/api/public/stats')
    expect(errorOf(stats, 429, 'RATE_LIMITED').retryAfter).toBeGreaterThan(0)
    for (let i = 0; i < 3; i++) expect((await t.http().post('/api/auth/register').send({ name: 'x' })).status).toBe(422)
    errorOf(await t.http().post('/api/auth/register').send({ name: 'x' }), 429, 'RATE_LIMITED')
  })

  it('an overloaded database is answered 429 with retryAfter, never 500; other errors pass through', async () => {
    const overloaded = Object.assign(new Error('Transaction API error: expired transaction'), { code: 'P2028' })
    const err = await overloadTo429(() => Promise.reject(overloaded)).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('RATE_LIMITED')
    expect((err as ApiError).retryAfter).toBe(5)
    const plain = new Error('boom')
    await expect(overloadTo429(() => Promise.reject(plain))).rejects.toBe(plain)
  })
})
