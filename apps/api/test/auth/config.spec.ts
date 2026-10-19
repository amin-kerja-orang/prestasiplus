import type { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'

import { AuthConfig } from '../../src/modules/auth/auth.config'
import { type AuthTestApp, bootAuthApp, DEMO_PASSWORD, setCookieLine } from './helpers'

const config = (env: Record<string, string>) => new AuthConfig({ get: (k: string) => env[k] } as unknown as ConfigService)

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

  it('refuses to start in production without a strong SESSION_SECRET', () => {
    expect(() => config({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/)
    expect(() => config({ NODE_ENV: 'production', SESSION_SECRET: 'change-me' })).toThrow(/SESSION_SECRET/)
    expect(() => config({ NODE_ENV: 'production', SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/)
    expect(config({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) }).secret).toBe('x'.repeat(32))
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
