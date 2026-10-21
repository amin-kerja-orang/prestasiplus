import { Controller, Get, UseFilters } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { INestApplication } from '@nestjs/common'

import { BattleRawError, BattleRawErrorFilter, rawConflict, rawForbidden, rawInvalid, rawNotFound } from '../../src/modules/battle/raw-response'
import { ApiError } from '../../src/common/errors/api-error'
import { createTestApp } from '../support/app'

@Controller('_battle_raw')
@UseFilters(BattleRawErrorFilter)
class RawController {
  @Get('text')
  text(): never {
    throw rawConflict('Battle sudah tamat.')
  }
  @Get('empty')
  empty(): never {
    throw rawInvalid()
  }
  @Get('forbidden-empty')
  forbiddenEmpty(): never {
    throw rawForbidden()
  }
  @Get('missing')
  missing(): never {
    throw rawNotFound('Giliran tidak dijumpai.')
  }
  @Get('envelope')
  envelope(): never {
    throw ApiError.of('NOT_FOUND', { message: 'Battle tidak dijumpai.' })
  }
  @Get('ok')
  ok() {
    return { queue_id: '1' }
  }
}

describe('battle raw responses', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp({ controllers: [RawController] })
  })
  afterAll(async () => {
    await app.close()
  })

  it('a raw error answers {error: text} with its status', async () => {
    const res = await request(app.getHttpServer()).get('/api/_battle_raw/text').expect(409)
    expect(res.body).toEqual({ error: 'Battle sudah tamat.' })
    expect((await request(app.getHttpServer()).get('/api/_battle_raw/missing').expect(404)).body).toEqual({ error: 'Giliran tidak dijumpai.' })
  })

  it('a raw error without text answers an empty body {} (M16-02 / M16-03)', async () => {
    expect((await request(app.getHttpServer()).get('/api/_battle_raw/empty').expect(422)).body).toEqual({})
    expect((await request(app.getHttpServer()).get('/api/_battle_raw/forbidden-empty').expect(403)).body).toEqual({})
  })

  it('an ApiError still gets the standard envelope; a success body is bare', async () => {
    const res = await request(app.getHttpServer()).get('/api/_battle_raw/envelope').expect(404)
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Battle tidak dijumpai.' })
    expect((await request(app.getHttpServer()).get('/api/_battle_raw/ok').expect(200)).body).toEqual({ queue_id: '1' })
  })

  it('BattleRawError keeps its status and body', () => {
    const e = new BattleRawError(422)
    expect(e.getStatus()).toBe(422)
    expect(e.rawBody).toEqual({})
    expect(new BattleRawError(404, 'x').rawBody).toEqual({ error: 'x' })
  })
})
