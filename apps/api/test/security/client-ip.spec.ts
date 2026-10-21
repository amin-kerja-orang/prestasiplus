import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadEnv } from '../../src/common/config/env.schema'
import { clientIpMiddleware, deriveClientIp, parseSingleIp } from '../../src/common/net/client-ip'
import { hasForwardingHeaders } from '../../src/common/metrics/internal-network'
import { bootSecurityApp, type SecurityApp } from './helpers'

/**
 * ops-edge-client-ip: the per-client login throttle works behind the edge worker (X-PP-Client-IP + X-PP-Edge-Secret)
 * and a spoofed X-Forwarded-For or X-PP-Client-IP cannot pick a fresh bucket. The pair limit is 5 failed logins per
 * identifier + address per minute (THROTTLE_LOGIN_PER_MINUTE default), so the 6th is 429.
 */
const SECRET = 'x'.repeat(40)
const EDGE = { CLIENT_IP_HEADER: 'x-pp-client-ip', EDGE_PROXY_SECRET: SECRET, TRUST_PROXY_HOPS: '2' }
const UNSET = { CLIENT_IP_HEADER: undefined, EDGE_PROXY_SECRET: undefined }

type Headers = Record<string, string>
const login = (t: SecurityApp, identifier: string, headers: Headers) =>
  t.http().post('/api/auth/login').set(headers).send({ identifier, password: 'Salah-Sentiasa-1' })

/** Six failed logins, each with its own headers; returns the six statuses. */
async function sixFailures(t: SecurityApp, identifier: string, headersFor: (i: number) => Headers): Promise<number[]> {
  const out: number[] = []
  for (let i = 0; i < 6; i++) out.push((await login(t, identifier, headersFor(i))).status)
  return out
}

describe('CLIENT_IP_HEADER unset: behaviour unchanged (TRUST_PROXY_HOPS=0)', () => {
  let t: SecurityApp
  beforeAll(async () => {
    t = await bootSecurityApp({ env: { ...UNSET, TRUST_PROXY_HOPS: '0' } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('a spoofed X-Forwarded-For does not change the bucket: the 6th failure is 429', async () => {
    const s = await sixFailures(t, 'guru@demo.test', (i) => ({ 'X-Forwarded-For': `198.51.100.${i + 1}` }))
    expect(s).toEqual([401, 401, 401, 401, 401, 429])
  })

  it('X-PP-Client-IP and X-PP-Edge-Secret are ignored', async () => {
    const s = await sixFailures(t, 'pelajar@demo.test', (i) => ({ 'X-PP-Client-IP': `198.51.100.${i + 1}`, 'X-PP-Edge-Secret': SECRET }))
    expect(s).toEqual([401, 401, 401, 401, 401, 429])
  })
})

describe('CLIENT_IP_HEADER=x-pp-client-ip behind two proxies (TRUST_PROXY_HOPS=2)', () => {
  let t: SecurityApp
  beforeAll(async () => {
    t = await bootSecurityApp({ env: { ...EDGE, THROTTLE_GLOBAL_PER_MINUTE: '1000' } })
  })
  afterAll(async () => {
    await t.close()
  })
  const edge = (ip: string, xff?: string): Headers => ({ 'X-PP-Client-IP': ip, 'X-PP-Edge-Secret': SECRET, ...(xff ? { 'X-Forwarded-For': xff } : {}) })

  it('one client with different spoofed X-Forwarded-For values shares one bucket: 5x 401 then 429 with retryAfter', async () => {
    const id = 'guru@demo.test'
    const s: Awaited<ReturnType<typeof login>>[] = []
    for (let i = 0; i < 6; i++) s.push(await login(t, id, edge('203.0.113.7', `198.51.100.${i + 1}, 10.0.0.${i + 1}`)))
    expect(s.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 429])
    expect(JSON.stringify(s[5]!.body)).toContain('retryAfter')
  })

  it('a different client address with the right secret is a separate bucket', async () => {
    expect((await login(t, 'guru@demo.test', edge('203.0.113.8'))).status).toBe(401)
    expect((await login(t, 'guru@demo.test', edge('2001:db8::8'))).status).toBe(401)
  })

  it('a wrong or missing secret cannot get a fresh bucket: everything falls into the socket peer bucket', async () => {
    const id = 'pelajar@demo.test'
    const variants: Headers[] = [
      { 'X-PP-Client-IP': '203.0.113.21', 'X-PP-Edge-Secret': 'y'.repeat(40), 'X-Forwarded-For': '198.51.100.21' },
      { 'X-PP-Client-IP': '203.0.113.22', 'X-PP-Edge-Secret': 'short' },
      { 'X-PP-Client-IP': '203.0.113.23', 'X-Forwarded-For': '198.51.100.23' },
      { 'X-Forwarded-For': '198.51.100.24' },
      { 'X-PP-Client-IP': '203.0.113.25', 'X-PP-Edge-Secret': SECRET.slice(0, -1) },
      { 'X-PP-Client-IP': '203.0.113.26', 'X-PP-Edge-Secret': `${SECRET}x` },
    ]
    expect((await sixFailures(t, id, (i) => variants[i]!)).join()).toBe('401,401,401,401,401,429')
  })

  it('a right secret with an invalid address (list, junk, empty) also falls back to the peer bucket', async () => {
    const id = 'pelajar2@demo.test'
    const bad = ['203.0.113.1, 203.0.113.2', 'not-an-ip', '', '1.2.3.4.5', '203.0.113.99/24', `${'1'.repeat(50)}`]
    expect((await sixFailures(t, id, (i) => ({ 'X-PP-Client-IP': bad[i]!, 'X-PP-Edge-Secret': SECRET }))).join()).toBe('401,401,401,401,401,429')
  })
})

describe('probes stay exempt from the global limit with the edge env set', () => {
  let t: SecurityApp
  beforeAll(async () => {
    t = await bootSecurityApp({ env: { ...EDGE, THROTTLE_GLOBAL_PER_MINUTE: '3' } })
  })
  afterAll(async () => {
    await t.close()
  })
  it('/api/health and /api/ready answer while the client is over the ceiling', async () => {
    const h = { 'X-PP-Client-IP': '203.0.113.90', 'X-PP-Edge-Secret': SECRET }
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) statuses.push((await t.http().get('/api/session').set(h)).status)
    expect(statuses.at(-1)).toBe(429)
    expect((await t.http().get('/api/health').set(h)).status).toBe(200)
    expect([200, 503]).toContain((await t.http().get('/api/ready').set(h)).status)
    expect((await t.http().get('/api/ready').set(h)).status).not.toBe(429)
  })
})

describe('client-ip unit', () => {
  const sock = (remoteAddress: string) => ({ remoteAddress }) as never
  const cfg = { header: 'x-pp-client-ip', secret: SECRET }

  it('parseSingleIp accepts one address and rejects lists, junk and long values', () => {
    expect(parseSingleIp(' 203.0.113.5 ')).toBe('203.0.113.5')
    expect(parseSingleIp('2001:db8::1')).toBe('2001:db8::1')
    expect(parseSingleIp('::ffff:203.0.113.5')).toBe('203.0.113.5')
    expect(parseSingleIp('2001:DB8::ABCD')).toBe('2001:db8::abcd')
    expect(parseSingleIp('::FFFF:203.0.113.5')).toBe('203.0.113.5')
    for (const bad of ['fe80::1%eth0', '203.0.113.5%x', '', ' ', 'a, b', '1.1.1.1, 2.2.2.2', 'x', '1.2.3', 'f'.repeat(46), undefined, ['1.1.1.1']]) expect(parseSingleIp(bad), String(bad)).toBeUndefined()
  })

  it('deriveClientIp trusts the header only with the exact secret; otherwise the socket peer', () => {
    const req = (headers: Record<string, unknown>) => ({ headers, socket: sock('192.0.2.1') }) as never
    expect(deriveClientIp(req({ 'x-pp-edge-secret': SECRET, 'x-pp-client-ip': '203.0.113.5' }), cfg)).toBe('203.0.113.5')
    expect(deriveClientIp(req({ 'x-pp-client-ip': '203.0.113.5' }), cfg)).toBe('192.0.2.1')
    expect(deriveClientIp(req({ 'x-pp-edge-secret': 'z'.repeat(40), 'x-pp-client-ip': '203.0.113.5' }), cfg)).toBe('192.0.2.1')
    expect(deriveClientIp(req({ 'x-pp-edge-secret': SECRET, 'x-pp-client-ip': 'junk' }), cfg)).toBe('192.0.2.1')
  })

  it('the middleware is a no-op when unset, and when set it deletes the secret and defines req.ip', () => {
    const untouched = { headers: { 'x-pp-edge-secret': 'k' }, socket: sock('192.0.2.1') } as never as Record<string, unknown>
    clientIpMiddleware({})(untouched as never, {} as never, () => undefined)
    expect(untouched).toEqual({ headers: { 'x-pp-edge-secret': 'k' }, socket: sock('192.0.2.1') })
    const req = { headers: { 'x-pp-edge-secret': SECRET, 'x-pp-client-ip': '203.0.113.5' }, socket: sock('192.0.2.1') } as never as Record<string, unknown> & { headers: Record<string, unknown> }
    clientIpMiddleware(cfg)(req as never, {} as never, () => undefined)
    expect(req.ip).toBe('203.0.113.5')
    expect(req.headers['x-pp-edge-secret']).toBeUndefined()
  })

  it('the edge headers count as forwarding headers for the metrics internal-network rule', () => {
    for (const h of ['x-pp-client-ip', 'cf-connecting-ip', 'true-client-ip', 'x-real-ip']) expect(hasForwardingHeaders({ [h]: '1.1.1.1' })).toBe(true)
  })
})

describe('env schema: CLIENT_IP_HEADER and EDGE_PROXY_SECRET', () => {
  const base = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://u:p@localhost:5432/db' }
  it('both empty or absent is fine', () => {
    expect(loadEnv({ ...base }).CLIENT_IP_HEADER).toBeUndefined()
    const e = loadEnv({ ...base, CLIENT_IP_HEADER: '', EDGE_PROXY_SECRET: '' })
    expect(e.CLIENT_IP_HEADER).toBeUndefined()
    expect(e.EDGE_PROXY_SECRET).toBeUndefined()
  })
  it('accepts each allow-listed header with a long enough secret', () => {
    for (const h of ['x-pp-client-ip', 'cf-connecting-ip', 'x-real-ip', 'true-client-ip'])
      expect(loadEnv({ ...base, CLIENT_IP_HEADER: h, EDGE_PROXY_SECRET: SECRET }).CLIENT_IP_HEADER).toBe(h)
  })
  it('a header outside the allow-list fails', () => {
    expect(() => loadEnv({ ...base, CLIENT_IP_HEADER: 'x-forwarded-for', EDGE_PROXY_SECRET: SECRET })).toThrow(/CLIENT_IP_HEADER/)
    expect(() => loadEnv({ ...base, CLIENT_IP_HEADER: 'X-PP-Client-IP', EDGE_PROXY_SECRET: SECRET })).toThrow(/CLIENT_IP_HEADER/)
  })
  it('a header without a secret fails (any NODE_ENV)', () => {
    expect(() => loadEnv({ ...base, CLIENT_IP_HEADER: 'x-pp-client-ip' })).toThrow(/EDGE_PROXY_SECRET/)
    expect(() => loadEnv({ ...base, CLIENT_IP_HEADER: 'x-pp-client-ip', EDGE_PROXY_SECRET: '' })).toThrow(/EDGE_PROXY_SECRET/)
  })
  it('a secret shorter than 32 fails; a secret alone is allowed', () => {
    expect(() => loadEnv({ ...base, CLIENT_IP_HEADER: 'x-pp-client-ip', EDGE_PROXY_SECRET: 'x'.repeat(31) })).toThrow(/EDGE_PROXY_SECRET/)
    expect(() => loadEnv({ ...base, EDGE_PROXY_SECRET: 'x'.repeat(31) })).toThrow(/EDGE_PROXY_SECRET/)
    expect(loadEnv({ ...base, EDGE_PROXY_SECRET: SECRET }).EDGE_PROXY_SECRET).toBe(SECRET)
  })
})
