import type { INestApplication } from '@nestjs/common'
import { ErrorBodySchema, TimestampSchema } from '@pp/contract'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApp, LogCapture } from './helpers/app'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('API cross-cutting behaviour', () => {
  let app: INestApplication
  const logs = new LogCapture()

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'info'
    app = await createTestApp({ logStream: logs })
  })
  afterAll(async () => {
    await app.close()
  })

  it('GET /api/health returns the envelope, a +08:00 time and no cookie', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200)
    expect(res.body.data.status).toBe('ok')
    expect(TimestampSchema.safeParse(res.body.data.time).success).toBe(true)
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('echoes X-Request-Id unchanged and generates a UUID otherwise', async () => {
    const a = await request(app.getHttpServer()).get('/api/health').set('X-Request-Id', 'abc-123')
    expect(a.headers['x-request-id']).toBe('abc-123')
    const b = await request(app.getHttpServer()).get('/api/health')
    expect(b.headers['x-request-id']).toMatch(UUID)
    const c = await request(app.getHttpServer()).get('/api/health').set('X-Request-Id', 'bad id!!')
    expect(c.headers['x-request-id']).toMatch(UUID)
  })

  it('invalid body gives 422 VALIDATION_ERROR with fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/_test/login')
      .set('X-Request-Id', 'req-422')
      .send({ identifier: '', password: 'x', role: 'admin' })
      .expect(422)
    const body = ErrorBodySchema.parse(res.body)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toBe('The given data was invalid.')
    expect(Object.keys(body.error.fields ?? {}).length).toBeGreaterThan(0)
    expect(body.error.requestId).toBe(res.headers['x-request-id'])
  })

  it('invalid query gives 422 and malformed JSON gives 422', async () => {
    const q = await request(app.getHttpServer()).get('/api/_test/query?n=abc').expect(422)
    expect(ErrorBodySchema.parse(q.body).error.fields).toHaveProperty('n')
    const j = await request(app.getHttpServer())
      .post('/api/_test/login')
      .set('Content-Type', 'application/json')
      .send('{bad')
      .expect(422)
    expect(ErrorBodySchema.parse(j.body).error.code).toBe('VALIDATION_ERROR')
  })

  it('unknown path gives 404 NOT_FOUND', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope').expect(404)
    const body = ErrorBodySchema.parse(res.body)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('Not Found.')
    expect(body.error.requestId).toBe(res.headers['x-request-id'])
  })

  it('unhandled error gives 500 SERVER_ERROR without stack or paths', async () => {
    const res = await request(app.getHttpServer()).get('/api/_test/boom').expect(500)
    const body = ErrorBodySchema.parse(res.body)
    expect(body.error.code).toBe('SERVER_ERROR')
    expect(body.error.message).toBe('Server Error')
    expect(body.error.requestId).toBe(res.headers['x-request-id'])
    const text = JSON.stringify(res.body)
    expect(text).not.toMatch(/\bat \S/)
    expect(text).not.toMatch(/db\.ts|\/srv\/|\.ts:\d+/)
  })

  it('logs are JSON with requestId and never contain cookie/authorization/password values', async () => {
    await request(app.getHttpServer())
      .post('/api/_test/login')
      .set('X-Request-Id', 'log-1')
      .set('Cookie', 'sid=SECRET_COOKIE_VALUE')
      .set('Authorization', 'Bearer SECRET_TOKEN_VALUE')
      .send({ identifier: 'a@b.my', password: 'SECRET_PASSWORD_VALUE', remember: false })
      .expect(201)
    const all = logs.lines.join('\n')
    expect(logs.lines.length).toBeGreaterThan(0)
    const parsed = logs.lines.map((l) => JSON.parse(l) as Record<string, unknown>)
    expect(parsed.some((l) => l.requestId === 'log-1')).toBe(true)
    expect(all).not.toContain('SECRET_COOKIE_VALUE')
    expect(all).not.toContain('SECRET_TOKEN_VALUE')
    expect(all).not.toContain('SECRET_PASSWORD_VALUE')
  })
})
