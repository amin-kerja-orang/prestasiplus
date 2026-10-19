import type { INestApplication } from '@nestjs/common'
import { ErrorBodySchema } from '@pp/contract'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApp } from '../support/app'

describe('GET /api/health with the database down', () => {
  let app: INestApplication
  beforeAll(async () => {
    app = await createTestApp() // DATABASE_URL points at a closed port
  })
  afterAll(async () => {
    await app.close()
  })

  it('answers 503 SERVER_ERROR in the standard error shape', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(503)
    const body = ErrorBodySchema.parse(res.body)
    expect(body.error.code).toBe('SERVER_ERROR')
    expect(body.error.message).toBe('Server Error')
    expect(body.error.requestId).toBe(res.headers['x-request-id'])
    expect(JSON.stringify(res.body)).not.toMatch(/127\.0\.0\.1|ECONNREFUSED/)
  })
})
