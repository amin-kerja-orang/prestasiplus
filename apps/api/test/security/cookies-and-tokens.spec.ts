import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Response } from 'supertest'

import { SESSION_TOKEN_SHAPE } from '../../src/modules/auth/tokens'
import { bootSecurityApp, cookieValue, COOKIE_NAME, DEMO_PASSWORD, setCookieLine, type SecurityApp } from './helpers'

/**
 * BE-33 AC3: cookie flags and "no token in any response body".
 *
 * The app is booted WITHOUT `COOKIE_SECURE`, so the default (Secure on) is what is asserted. The
 * supertest client speaks plain http and so cannot replay a Secure cookie from a jar; the tests send the
 * `Cookie` header by hand instead.
 */

const FORBIDDEN_KEYS = new Set(['token', 'sessiontoken', 'accesstoken', 'refreshtoken', 'password', 'passwordhash'])
/** The ONE key allowed to carry a token-shaped string: the CSRF token the client must echo (Session.csrf). */
const CSRF_KEY = 'csrf'

interface Hit {
  path: string
  reason: string
}

/** Recursively scans a JSON value for anything that looks like a credential. */
function scan(value: unknown, secrets: string[], path = '$', key = ''): Hit[] {
  const hits: Hit[] = []
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...scan(v, secrets, `${path}[${String(i)}]`, key)))
    return hits
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k.toLowerCase())) hits.push({ path: `${path}.${k}`, reason: 'forbidden key' })
      hits.push(...scan(v, secrets, `${path}.${k}`, k))
    }
    return hits
  }
  if (typeof value === 'string') {
    if (secrets.includes(value)) hits.push({ path, reason: 'equals a session cookie value' })
    if (SESSION_TOKEN_SHAPE.test(value) && key !== CSRF_KEY) hits.push({ path, reason: 'session-token shaped string' })
  }
  return hits
}

describe('BE-33 AC3: session cookie flags', () => {
  let t: SecurityApp
  beforeAll(async () => {
    t = await bootSecurityApp({ env: { COOKIE_SECURE: undefined, COOKIE_DOMAIN: '.demo.example.test' } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('HttpOnly, Secure (the default with no COOKIE_SECURE), SameSite=Lax, Path=/ and Domain from COOKIE_DOMAIN', async () => {
    const res = await t.http().post('/api/auth/login').send({ identifier: 'pelajar@demo.test', password: DEMO_PASSWORD, remember: false })
    expect(res.status).toBe(200)
    const line = setCookieLine(res) as string
    expect(line).toBeTruthy()
    const attrs = line.split(';').map((a) => a.trim())
    expect(attrs).toContain('HttpOnly')
    expect(attrs).toContain('Secure')
    expect(attrs).toContain('SameSite=Lax')
    expect(attrs).toContain('Path=/')
    expect(attrs).toContain('Domain=.demo.example.test')
    expect(attrs.some((a) => /^SameSite=None$/i.test(a))).toBe(false)
  })

  it('the cookie that clears the session on logout carries the same flags', async () => {
    const login = await t.http().post('/api/auth/login').send({ identifier: 'pelajar@demo.test', password: DEMO_PASSWORD, remember: false })
    const token = cookieValue(login) as string
    const out = await t
      .http()
      .post('/api/auth/logout')
      .set('Cookie', `${COOKIE_NAME}=${token}`)
      .set('X-CSRF-Token', login.body.data.csrf)
    expect(out.status).toBe(204)
    const attrs = (setCookieLine(out) as string).split(';').map((a) => a.trim())
    for (const a of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Domain=.demo.example.test']) expect(attrs).toContain(a)
  })
})

describe('BE-33 AC3: Secure can be turned off only by the explicit COOKIE_SECURE=false', () => {
  let t: SecurityApp
  beforeAll(async () => {
    t = await bootSecurityApp({ env: { COOKIE_SECURE: 'false', COOKIE_DOMAIN: undefined } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('no Secure and no Domain attribute when neither is configured, the other flags stay', async () => {
    const res = await t.http().post('/api/auth/login').send({ identifier: 'pelajar@demo.test', password: DEMO_PASSWORD, remember: false })
    const attrs = (setCookieLine(res) as string).split(';').map((a) => a.trim())
    expect(attrs).not.toContain('Secure')
    expect(attrs.some((a) => a.startsWith('Domain='))).toBe(false)
    for (const a of ['HttpOnly', 'SameSite=Lax', 'Path=/']) expect(attrs).toContain(a)
  })
})

describe('BE-33 AC3: no token in any response body (recursive scan)', () => {
  let t: SecurityApp
  beforeAll(async () => {
    t = await bootSecurityApp({ env: { COOKIE_SECURE: undefined, COOKIE_DOMAIN: undefined } })
  })
  afterAll(async () => {
    await t.close()
  })

  const cookieHeader = (token: string) => `${COOKIE_NAME}=${token}`

  it('the scanner itself catches a leak (self-test)', () => {
    expect(scan({ data: { a: [{ token: 'x' }] } }, [])).toEqual([{ path: '$.data.a[0].token', reason: 'forbidden key' }])
    const leaked = 'A'.repeat(43)
    expect(scan({ data: { x: leaked } }, [leaked]).map((h) => h.reason)).toContain('equals a session cookie value')
    expect(scan({ data: { x: leaked } }, []).map((h) => h.reason)).toContain('session-token shaped string')
    expect(scan({ data: { csrf: leaked } }, [])).toEqual([])
  })

  it('login, GET /session, role switch, Mod Pelajar enter and exit bodies hold no token, password or session value', async () => {
    const seen: string[] = []
    const bodies: [string, Response][] = []

    // Dual-role account: login, session, role switch.
    const login = await t.http().post('/api/auth/login').send({ identifier: 'guruadmin@demo.test', password: DEMO_PASSWORD, remember: false })
    expect(login.status).toBe(200)
    let token = cookieValue(login) as string
    seen.push(token)
    bodies.push(['login', login])
    const csrf1: string = login.body.data.csrf
    // The CSRF token is a distinct value, never the session cookie.
    expect(csrf1).not.toBe(token)

    const session = await t.http().get('/api/session').set('Cookie', cookieHeader(token))
    expect(session.status).toBe(200)
    bodies.push(['session', session])

    const sw = await t.http().post('/api/session/role').set('Cookie', cookieHeader(token)).set('X-CSRF-Token', csrf1).send({ role: 'teacher' })
    expect(sw.status).toBe(200)
    const rotated = cookieValue(sw)
    if (rotated) {
      seen.push(rotated)
      token = rotated
    }
    bodies.push(['role switch', sw])

    // Admin: Mod Pelajar enter and exit.
    const adminLogin = await t.http().post('/api/auth/login').send({ identifier: 'admin@demo.test', password: DEMO_PASSWORD, remember: false })
    let adminToken = cookieValue(adminLogin) as string
    seen.push(adminToken)
    bodies.push(['admin login', adminLogin])
    const enter = await t
      .http()
      .post('/api/session/mode')
      .set('Cookie', cookieHeader(adminToken))
      .set('X-CSRF-Token', adminLogin.body.data.csrf)
      .send({ mode: 'mod_pelajar' })
    expect(enter.status).toBe(200)
    const afterEnter = cookieValue(enter)
    if (afterEnter) {
      seen.push(afterEnter)
      adminToken = afterEnter
    }
    bodies.push(['mode enter', enter])
    const leave = await t.http().delete('/api/session/mode').set('Cookie', cookieHeader(adminToken)).set('X-CSRF-Token', enter.body.data.csrf)
    expect(leave.status).toBe(200)
    const afterLeave = cookieValue(leave)
    if (afterLeave) seen.push(afterLeave)
    bodies.push(['mode exit', leave])

    expect(seen.length).toBeGreaterThanOrEqual(2)
    for (const s of seen) expect(SESSION_TOKEN_SHAPE.test(s)).toBe(true)
    const failures: string[] = []
    for (const [name, res] of bodies) {
      for (const hit of scan(res.body, seen)) failures.push(`${name} ${hit.path}: ${hit.reason}`)
      // The raw text too: the cookie value must not appear anywhere in the body.
      for (const s of seen) if (res.text.includes(s)) failures.push(`${name}: raw body contains a session cookie value`)
      // The password sent in the login request is never echoed.
      if (res.text.includes(DEMO_PASSWORD)) failures.push(`${name}: raw body contains the password`)
    }
    expect(failures).toEqual([])
    // The only token-shaped value in a session body is the CSRF token under its own key.
    expect(session.body.data.csrf).toMatch(SESSION_TOKEN_SHAPE)
  })
})
