import { Body, Controller, Get, Module, Param, Post, Res, UseGuards } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import type { Response } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Public } from '../../src/common/guards/decorators'
import { RateLimit, RateLimitGuard } from '../../src/common/throttle/rate-limit'
import { ThrottleModule } from '../../src/common/throttle/throttle.module'
import { createTestApp } from '../support/app'

const WRITES: string[] = []

@Public()
@Controller('_sec')
@UseGuards(RateLimitGuard)
class SecController {
  @Get('item/:id')
  item(@Param('id') id: string) {
    return { data: { id } }
  }

  @Post('write')
  write(@Body() body: Record<string, unknown>) {
    WRITES.push(JSON.stringify(body))
    return { data: { ok: true } }
  }

  @Post('upload')
  upload() {
    WRITES.push('upload')
    return { data: { ok: true } }
  }

  @Get('file')
  file(@Res() res: Response) {
    res.status(200).set({
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': 'attachment; filename="x.pdf"',
      'Content-Type': 'application/pdf',
    })
    res.end('%PDF')
  }

  @Get('strict')
  @RateLimit({ bucket: 'sec-strict', env: 'SEC_STRICT_TEST', default: 2, per: 'ip' })
  strict() {
    return { data: { ok: true } }
  }
}

@Module({ imports: [ThrottleModule], controllers: [SecController] })
class SecModule {}

describe('BE-33 hardening: headers, NUL guard, global rate limit', () => {
  let app: INestApplication
  const server = () => app.getHttpServer()

  beforeAll(async () => {
    process.env.THROTTLE_GLOBAL_PER_MINUTE = '12'
    app = await createTestApp({ modules: [SecModule] })
  })
  afterAll(async () => {
    delete process.env.THROTTLE_GLOBAL_PER_MINUTE
    await app.close()
  })

  it('sets the security headers on a JSON route and removes X-Powered-By', async () => {
    const res = await request(server()).get('/api/_sec/item/7').expect(200)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin')
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site')
    expect(res.headers['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'")
    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['strict-transport-security']).toBeUndefined() // plain http, not production
  })

  it('sends HSTS when the request came over https behind the proxy only', async () => {
    // TRUST_PROXY_HOPS is 0 here, so a forged X-Forwarded-Proto is ignored.
    const res = await request(server()).get('/api/_sec/item/7').set('X-Forwarded-Proto', 'https').expect(200)
    expect(res.headers['strict-transport-security']).toBeUndefined()
  })

  it('keeps the headers a route sets itself (file download)', async () => {
    const res = await request(server()).get('/api/_sec/file').expect(200)
    expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox")
    expect(res.headers['content-disposition']).toBe('attachment; filename="x.pdf"')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('sets the headers on health (the unreachable test database gives 503) and on a 404', async () => {
    const health = await request(server()).get('/api/health')
    expect(health.headers['x-content-type-options']).toBe('nosniff')
    expect(health.headers['x-frame-options']).toBe('DENY')
    const missing = await request(server()).get('/api/nope').expect(404)
    expect(missing.headers['content-security-policy']).toBe("default-src 'none'; frame-ancestors 'none'")
  })

  it('refuses NUL in a query, a path parameter and a nested body string with 422 and writes nothing', async () => {
    WRITES.length = 0
    const q = await request(server()).get('/api/_sec/item/1?name=a%00b').expect(422)
    expect(q.body.error.code).toBe('VALIDATION_ERROR')
    expect(q.body.error.fields.name).toBe('Medan ini tidak sah.')
    expect(q.body.error.requestId).toBeTruthy()
    const p = await request(server()).get('/api/_sec/item/a%00b').expect(422)
    expect(p.body.error.fields.id).toBe('Medan ini tidak sah.')
    const b = await request(server())
      .post('/api/_sec/write')
      .send({ a: { list: ['ok', { deep: 'x\u0000y' }] } })
      .expect(422)
    expect(b.body.error.code).toBe('VALIDATION_ERROR')
    expect(b.body.error.fields['a.list.1.deep']).toBe('Medan ini tidak sah.')
    expect(WRITES).toEqual([])
    await request(server()).post('/api/_sec/write').send({ a: 'fine' }).expect(201)
    expect(WRITES).toHaveLength(1)
  })

  it('does not inspect multipart bodies (binary content with NUL bytes is allowed)', async () => {
    WRITES.length = 0
    await request(server())
      .post('/api/_sec/upload')
      .attach('file', Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0x00, 0x01]), 'a.pdf')
      .expect(201)
    expect(WRITES).toEqual(['upload'])
  })

  it('applies the global ceiling per address, excludes health, and keeps stricter buckets', async () => {
    // A stricter per-route bucket (2 per minute) answers 429 before the global ceiling is reached.
    process.env.SEC_STRICT_TEST = '2'
    const fresh = await createTestApp({ modules: [SecModule] })
    try {
      const s = fresh.getHttpServer()
      await request(s).get('/api/_sec/strict').expect(200)
      await request(s).get('/api/_sec/strict').expect(200)
      const strict = await request(s).get('/api/_sec/strict').expect(429)
      expect(strict.body.error.code).toBe('RATE_LIMITED')
      expect(strict.headers['retry-after']).toBeDefined()
      // Health is never counted: many calls, still not 429 (503 because the test database is unreachable).
      for (let i = 0; i < 20; i++) expect((await request(s).get('/api/health')).status).not.toBe(429)
      // The global ceiling (12): 3 used above, 9 more pass, then 429 with the platform envelope and Retry-After.
      for (let i = 0; i < 9; i++) await request(s).get('/api/_sec/item/1').expect(200)
      const over = await request(s).get('/api/_sec/item/1').expect(429)
      expect(over.body.error.code).toBe('RATE_LIMITED')
      expect(over.body.error.message).toBe('Too Many Attempts.')
      expect(over.body.error.retryAfter).toBeGreaterThanOrEqual(1)
      expect(over.headers['retry-after']).toBeDefined()
      expect(over.headers['x-content-type-options']).toBe('nosniff')
    } finally {
      delete process.env.SEC_STRICT_TEST
      await fresh.close()
    }
  })
})
