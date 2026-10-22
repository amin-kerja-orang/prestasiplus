import { Controller, Get, Module, Param } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { loadEnv } from '../../src/common/config/env.schema'
import { parseCidrList } from '../../src/common/metrics/cidr'
import { hasForwardingHeaders, isInternalRequest, isPrivateAddress } from '../../src/common/metrics/internal-network'
import { MetricsService, routeLabel } from '../../src/common/metrics/metrics.service'
import { Public } from '../../src/common/guards/decorators'
import { AuthModule } from '../../src/modules/auth'
import { createTestApp } from '../support/app'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { COOKIE_NAME, DEMO_PASSWORD } from '../auth/helpers'

@Public()
@Controller('_probe')
class ProbeController {
  @Get('item/:id')
  item(@Param('id') id: string) {
    return { data: { id } }
  }
}
@Module({ controllers: [ProbeController] })
class ProbeModule {}

const ENV = { COOKIE_SECURE: 'false', LEGACY_BCRYPT_DUMMY_COST: '4', LOGIN_FAILURE_FLOOR_MS: '0' }

async function boot(db: TestDatabase, extra: Record<string, string | undefined> = {}): Promise<INestApplication> {
  for (const [k, v] of Object.entries({ ...ENV, METRICS_ENABLED: undefined, ...extra })) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  return createTestApp({ db, modules: [AuthModule, ProbeModule] })
}

describe('GET /api/metrics (BE-33)', () => {
  let db: TestDatabase
  let app: INestApplication

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed], { prisma: db.prisma })
    app = await boot(db)
  })
  afterAll(async () => {
    await app.close()
    await db.drop()
  })

  const http = () => request(app.getHttpServer())

  async function login(identifier: string): Promise<string> {
    const res = await http().post('/api/auth/login').send({ identifier, password: DEMO_PASSWORD, remember: false })
    expect(res.status).toBe(200)
    const line = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${COOKIE_NAME}=`))!
    return line.split(';')[0]!
  }

  it('is 200 from a direct loopback peer, in the Prometheus text format, with all families', async () => {
    await http().get('/api/health') // so a duration series exists
    const res = await http().get('/api/metrics')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('text/plain; version=0.0.4; charset=utf-8')
    for (const family of [
      '# TYPE http_requests_total counter',
      '# TYPE http_request_duration_seconds histogram',
      '# TYPE http_requests_in_flight gauge',
      'process_uptime_seconds ',
      'process_resident_memory_bytes ',
      'nodejs_heap_used_bytes ',
    ]) expect(res.text).toContain(family)
    expect(res.text).toMatch(/http_request_duration_seconds_bucket\{[^}]*le="0.005"\}/)
    expect(res.text).toMatch(/http_request_duration_seconds_bucket\{[^}]*le="10"\}/)
  })

  it('is 403 FORBIDDEN when a proxy header is present (X-Forwarded-For, X-Real-IP, Forwarded), even from loopback', async () => {
    for (const h of [['X-Forwarded-For', '203.0.113.9'], ['X-Real-IP', '203.0.113.9'], ['Forwarded', 'for=203.0.113.9']] as const) {
      const res = await http().get('/api/metrics').set(h[0], h[1])
      expect(res.status).toBe(403)
      expect(JSON.stringify(res.body)).toContain('FORBIDDEN')
    }
  })

  it('stays 403 for a non-admin session and is 200 for an admin session reaching it through the proxy', async () => {
    const teacher = await login('guru@demo.test')
    expect((await http().get('/api/metrics').set('X-Forwarded-For', '203.0.113.9').set('Cookie', teacher)).status).toBe(403)
    const admin = await login('admin@demo.test')
    const res = await http().get('/api/metrics').set('X-Forwarded-For', '203.0.113.9').set('Cookie', admin)
    expect(res.status).toBe(200)
    expect(res.text).toContain('http_requests_total')
  })

  it('labels with the route template, never the raw URL, query or id; unmatched routes are "unmatched"', async () => {
    await http().get('/api/health?email=a@b.c&token=secret-query-value')
    await http().get('/api/_probe/item/987654321')
    await http().get('/api/_probe/item/55512345')
    await http().get('/api/this/does/not/exist/4242')
    await http().get('/api/session').set('Cookie', `${COOKIE_NAME}=not-a-session`) // 401 from the guard
    const text = (await http().get('/api/metrics')).text
    expect(text).toContain('http_requests_total{method="GET",route="/api/_probe/item/:id",status="200"} 2')
    expect(text).toContain('route="unmatched",status="404"')
    expect(text).toMatch(/route="\/api\/health"/)
    expect(text).not.toMatch(/@|secret-query-value|987654321|55512345|4242|not-a-session/)
    expect(text).toMatch(/status="401"/)
  })

  it('counts requests per bucket cumulatively (+Inf equals _count)', async () => {
    const text = (await http().get('/api/metrics')).text
    const inf = /http_request_duration_seconds_bucket\{method="GET",route="\/api\/health",le="\+Inf"\} (\d+)/.exec(text)
    const count = /http_request_duration_seconds_count\{method="GET",route="\/api\/health"\} (\d+)/.exec(text)
    expect(inf?.[1]).toBeDefined()
    expect(inf?.[1]).toBe(count?.[1])
  })

  it('is 404 when METRICS_ENABLED=false', async () => {
    const off = await boot(db, { METRICS_ENABLED: 'false' })
    try {
      expect((await request(off.getHttpServer()).get('/api/metrics')).status).toBe(404)
    } finally {
      await off.close()
      delete process.env.METRICS_ENABLED
    }
  })

  describe('production policy (METRICS_INTERNAL_CIDRS)', () => {
    async function withProd(extra: Record<string, string | undefined>, fn: (a: INestApplication) => Promise<void>): Promise<void> {
      const saved = { NODE_ENV: process.env.NODE_ENV, IC_HASH_KEY: process.env.IC_HASH_KEY, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR, SESSION_SECRET: process.env.SESSION_SECRET, MAIL_LOG_RESET_LINKS: process.env.MAIL_LOG_RESET_LINKS }
      let a: INestApplication | undefined
      try {
        Object.assign(process.env, { NODE_ENV: 'production', IC_HASH_KEY: 'i'.repeat(40), SESSION_SECRET: 's'.repeat(40), FILE_STORAGE_DIR: '/tmp/pp-metrics-test' })
        delete process.env.MAIL_LOG_RESET_LINKS
        a = await boot(db, { METRICS_INTERNAL_CIDRS: undefined, ...extra })
        await fn(a)
      } finally {
        await a?.close()
        for (const [k, v] of Object.entries(saved)) {
          if (v === undefined) delete process.env[k]
          else process.env[k] = v
        }
        delete process.env.METRICS_INTERNAL_CIDRS
      }
    }

    it('without the key the internal path is off: loopback is 403, an admin session is 200', async () => {
      await withProd({}, async (a) => {
        expect((await request(a.getHttpServer()).get('/api/metrics')).status).toBe(403)
        const res = await request(a.getHttpServer()).post('/api/auth/login').send({ identifier: 'admin@demo.test', password: DEMO_PASSWORD, remember: false })
        const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${COOKIE_NAME}=`))!.split(';')[0]!
        expect((await request(a.getHttpServer()).get('/api/metrics').set('Cookie', cookie)).status).toBe(200)
      })
    })

    it('with 127.0.0.1/32 a loopback peer is 200; a CIDR that does not contain it is 403', async () => {
      await withProd({ METRICS_INTERNAL_CIDRS: '127.0.0.1/32' }, async (a) => {
        expect((await request(a.getHttpServer()).get('/api/metrics')).status).toBe(200)
        expect((await request(a.getHttpServer()).get('/api/metrics').set('X-Forwarded-For', '127.0.0.1')).status).toBe(403)
      })
      await withProd({ METRICS_INTERNAL_CIDRS: '10.0.0.0/8, fd00::/8' }, async (a) => {
        expect((await request(a.getHttpServer()).get('/api/metrics')).status).toBe(403)
      })
    })
  })

  it('is under the global ceiling: an external flood with a junk session cookie gets 429 (G4 M1)', async () => {
    let tight: INestApplication | undefined
    try {
      tight = await boot(db, { THROTTLE_GLOBAL_PER_MINUTE: '3' })
      const hit = () =>
        request(tight!.getHttpServer()).get('/api/metrics').set('X-Forwarded-For', '203.0.113.50').set('Cookie', `${COOKIE_NAME}=junk-session`)
      const statuses: number[] = []
      for (let i = 0; i < 8; i++) statuses.push((await hit()).status)
      expect(statuses.slice(0, 3)).toEqual([403, 403, 403])
      expect(statuses.slice(3).every((s) => s === 429)).toBe(true)
      const last = await hit()
      expect(last.status).toBe(429)
      expect(JSON.stringify(last.body)).toContain('retryAfter')
      // Probes stay exempt under the same exhausted ceiling.
      expect((await request(tight.getHttpServer()).get('/api/health')).status).toBe(200)
    } finally {
      await tight?.close()
      process.env.THROTTLE_GLOBAL_PER_MINUTE = '100000'
    }
  })
})

describe('internal network rule (unit)', () => {
  it('CIDR policy: matches by direct peer, unwraps ::ffff: mapped addresses, rejects invalid lists', () => {
    const cidrs = parseCidrList('10.0.0.0/8, 127.0.0.1/32, fd00::/8')
    const req = (addr: string, headers = {}) => ({ socket: { remoteAddress: addr }, headers }) as never
    expect(isInternalRequest(req('::ffff:10.1.2.3'), { cidrs })).toBe(true)
    expect(isInternalRequest(req('::ffff:127.0.0.1'), { cidrs })).toBe(true)
    expect(isInternalRequest(req('fd12::1'), { cidrs })).toBe(true)
    expect(isInternalRequest(req('192.168.1.1'), { cidrs })).toBe(false) // private, but not in the list
    expect(isInternalRequest(req('10.1.2.3', { 'x-forwarded-for': '1.2.3.4' }), { cidrs })).toBe(false)
    expect(isInternalRequest(req('127.0.0.1'), 'off')).toBe(false)
    for (const bad of ['', 'nonsense', '10.0.0.1', '10.0.0.0/33', '::1/129', '10.0.0.0/8/1', '10.0.0.0/x', '10.0.0.0/8,,zz'])
      expect(() => parseCidrList(bad), bad).toThrow()
    const base = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://u:p@localhost:5432/x' }
    expect(() => loadEnv({ ...base, METRICS_INTERNAL_CIDRS: '10.0.0.0/99' })).toThrow(/METRICS_INTERNAL_CIDRS/)
    expect(loadEnv({ ...base, METRICS_INTERNAL_CIDRS: '10.0.0.0/8' }).METRICS_INTERNAL_CIDRS).toBe('10.0.0.0/8')
  })

  it('accepts loopback and private peers only', () => {
    for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', 'fd12:3456::1', '::ffff:10.0.0.5'])
      expect(isPrivateAddress(a), a).toBe(true)
    for (const a of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '192.169.0.1', '2001:db8::1', 'garbage', '', undefined])
      expect(isPrivateAddress(a), String(a)).toBe(false)
  })

  it('a forwarding header disqualifies even a private peer; X-Forwarded-For is not trusted for the address', () => {
    expect(hasForwardingHeaders({ 'x-forwarded-proto': 'https' })).toBe(true)
    expect(hasForwardingHeaders({ host: 'a' })).toBe(false)
    expect(isInternalRequest({ socket: { remoteAddress: '10.0.0.2' }, headers: { 'x-forwarded-for': '10.0.0.3' } } as never)).toBe(false)
    expect(isInternalRequest({ socket: { remoteAddress: '10.0.0.2' }, headers: {} } as never)).toBe(true)
    expect(isInternalRequest({ socket: { remoteAddress: '203.0.113.7' }, headers: {} } as never)).toBe(false)
  })

  it('routeLabel uses baseUrl + route path and falls back to unmatched', () => {
    expect(routeLabel({ baseUrl: '/api', route: { path: '/users/:id' } } as never)).toBe('/api/users/:id')
    expect(routeLabel({ baseUrl: '', route: undefined } as never)).toBe('unmatched')
  })

  it('renders escaped labels and the cumulative histogram', () => {
    const m = new MetricsService()
    m.observe('GET', '/a"b', 200, 0.003)
    m.observe('GET', '/a"b', 200, 20)
    m.observe('BREW', '/x', 418, 0.1)
    const text = m.render()
    expect(text).toContain('route="/a\\"b"')
    expect(text).toContain('le="0.005"} 1')
    expect(text).toContain('le="10"} 1')
    expect(text).toContain('le="+Inf"} 2')
    expect(text).toContain('method="OTHER"')
  })
})
