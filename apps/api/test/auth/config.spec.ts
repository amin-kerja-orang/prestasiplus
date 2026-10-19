import type { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'

import { AuthConfig } from '../../src/modules/auth/auth.config'
import { type AuthTestApp, bootAuthApp, DEMO_PASSWORD, setCookieLine } from './helpers'

const config = (env: Record<string, string>) =>
  new AuthConfig({ get: (k: string) => ({ SESSION_SECRET: 'x'.repeat(32), ...env })[k] } as unknown as ConfigService)

describe('auth configuration', () => {
  it('defaults: Secure cookie named pp_session, limit 5', () => {
    const c = config({})
    expect(c).toMatchObject({ cookieName: 'pp_session', cookieSecure: true, loginLimit: 5, cookieDomain: undefined })
  })

  it('reads the cookie name, domain, Secure flag and limit from the environment', () => {
    const c = config({
      SESSION_COOKIE_NAME: 'x_sess',
      COOKIE_DOMAIN: 'example.test',
      COOKIE_SECURE: 'false',
      THROTTLE_LOGIN_PER_MINUTE: '3',
    })
    expect(c).toMatchObject({ cookieName: 'x_sess', cookieDomain: 'example.test', cookieSecure: false, loginLimit: 3 })
  })

  it('takes the secret from the validated configuration and refuses to run without one', () => {
    expect(config({ SESSION_SECRET: 'y'.repeat(20) }).secret).toBe('y'.repeat(20))
    expect(() => new AuthConfig({ get: () => undefined } as unknown as ConfigService)).toThrow(/SESSION_SECRET/)
  })

  it('remember lifetimes: 30 days, staff 1 day, staff never above the general value', () => {
    expect(config({})).toMatchObject({ rememberDays: 30, rememberDaysStaff: 1, legacyDummyCost: 12 })
    expect(config({}).rememberDaysFor(['teacher', 'school_admin'])).toBe(1)
    expect(config({}).rememberDaysFor(['admin'])).toBe(1)
    expect(config({}).rememberDaysFor(['teacher'])).toBe(30)
    expect(config({ SESSION_REMEMBER_DAYS: '2', SESSION_REMEMBER_DAYS_STAFF: '9' }).rememberDaysStaff).toBe(2)
    expect(config({ SESSION_REMEMBER_DAYS: 'abc' }).rememberDays).toBe(30)
    expect(config({ LEGACY_BCRYPT_DUMMY_COST: '99' }).legacyDummyCost).toBe(12)
  })
})

describe('session cookie flags', () => {
  let t: AuthTestApp
  it('is HttpOnly, Secure and SameSite=Lax by default, and uses the configured name', async () => {
    t = await bootAuthApp({ secureCookie: true, env: { SESSION_COOKIE_NAME: 'pp_test_sid' } })
    try {
      const res = await t.http().post('/api/auth/login').send({ identifier: 'admin@demo.test', password: DEMO_PASSWORD })
      expect(res.status).toBe(200)
      const line = setCookieLine(res, 'pp_test_sid') as string
      expect(line).toMatch(/HttpOnly/i)
      expect(line).toMatch(/Secure/i)
      expect(line).toMatch(/SameSite=Lax/i)
    } finally {
      await t.close()
    }
  }, 120_000)
})
