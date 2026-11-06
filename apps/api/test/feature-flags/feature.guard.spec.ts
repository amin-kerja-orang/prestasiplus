import 'reflect-metadata'

import { Controller, Get, Post, type CanActivate, type ExecutionContext, type INestApplication, Injectable } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { ErrorBodySchema, FEATURE_ROUTE_PREFIXES, featureKeyForApiPath } from '@pp/contract'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AllExceptionsFilter } from '../../src/common/errors/all-exceptions.filter'
import { ApiError } from '../../src/common/errors/api-error'
import { FEATURE_CACHE_TTL_MS, FeatureFlagsService } from '../../src/common/feature-flags/feature-flags.service'
import { FeatureGuard } from '../../src/common/feature-flags/feature.guard'
import { FixedClock } from '../../src/db/clock'

/** S0-T10, API-AUTH-16: FeatureGuard on a real HTTP stack, ahead of an AuthGuard stand-in, over an in-memory flag table. */
const rows = new Map<string, { enabled: boolean; locked: boolean }>()
let reads = 0
const clock = new FixedClock('2026-11-05T08:00:00Z')

const prisma = {
  client: {
    featureFlag: {
      findMany: async () => {
        reads += 1
        return [...rows].map(([key, v]) => ({ key, ...v }))
      },
    },
  },
}

/** Stands in for AuthGuard: 401 unless `x-test-user` is present. It runs after FeatureGuard. */
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    if (!ctx.switchToHttp().getRequest().headers['x-test-user']) throw ApiError.of('UNAUTHORIZED')
    return true
  }
}

@Controller('api')
class ProbeController {
  @Get('games/hub') games() { return { data: 'games' } }
  @Post('games/rooms') room() { return { data: 'room' } }
  @Get('papan-bijak/quick-match/poll') bijak() { return { data: 'bijak' } }
  @Get('cikgu/threads') cikgu() { return { data: 'cikgu' } }
  @Post('mohon-keluarga-angkat') sponsor() { return { data: 'sponsor' } }
  @Get('practice/sessions') practice() { return { data: 'practice' } }
  @Get('gamesx') lookalike() { return { data: 'gamesx' } }
  @Get('other') other() { return { data: 'other' } }
}

describe('FeatureGuard (API-AUTH-16)', () => {
  let app: INestApplication
  let service: FeatureFlagsService
  const http = () => request(app.getHttpServer())
  const as = (user: boolean) => (user ? { 'x-test-user': 'admin' } : {})

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        { provide: FeatureFlagsService, useFactory: () => new FeatureFlagsService(prisma as never, { record: async () => undefined } as never, clock) },
        { provide: APP_GUARD, useClass: FeatureGuard },
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    service = moduleRef.get(FeatureFlagsService)
  })
  afterAll(() => app.close())
  beforeEach(() => {
    rows.clear()
    rows.set('permainan', { enabled: true, locked: false })
    rows.set('latih-tubi', { enabled: true, locked: false })
    rows.set('cikgu-alesa', { enabled: false, locked: true })
    rows.set('keluarga-angkat', { enabled: false, locked: true })
    service.invalidate()
    reads = 0
  })

  const expect404 = (res: request.Response) => {
    expect(res.status).toBe(404)
    const body = ErrorBodySchema.parse(res.body)
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?')
  }

  it('OFF prefix: 404 NOT_FOUND for an anonymous caller (never 401) and for a signed-in one', async () => {
    rows.set('permainan', { enabled: false, locked: false })
    service.invalidate()
    for (const user of [false, true]) {
      expect404(await http().get('/api/games/hub').set(as(user)))
      expect404(await http().post('/api/games/rooms').set(as(user)).send({}))
      expect404(await http().get('/api/papan-bijak/quick-match/poll').set(as(user)))
    }
  })

  it('locked keys (Cikgu Alesa, Keluarga Angkat) answer 404 for everyone', async () => {
    for (const user of [false, true]) {
      expect404(await http().get('/api/cikgu/threads').set(as(user)))
      expect404(await http().post('/api/mohon-keluarga-angkat').set(as(user)).send({}))
    }
  })

  it('ON: the request reaches AuthGuard (anonymous 401) and the handler (signed in 200)', async () => {
    expect((await http().get('/api/games/hub')).status).toBe(401)
    const res = await http().get('/api/games/hub').set(as(true))
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: 'games' })
  })

  it('matches case-insensitively, with repeated slashes and a query string', async () => {
    rows.set('permainan', { enabled: false, locked: false })
    service.invalidate()
    expect404(await http().get('/API/Games/hub?x=1').set(as(true)))
    expect404(await http().get('/api//games/hub').set(as(true)))
  })

  it('does not match a look-alike path or an unmapped route, and latih-tubi has no api prefix (shared endpoints)', async () => {
    rows.set('permainan', { enabled: false, locked: false })
    rows.set('latih-tubi', { enabled: false, locked: false })
    service.invalidate()
    expect((await http().get('/api/gamesx').set(as(true))).status).toBe(200)
    expect((await http().get('/api/other').set(as(true))).status).toBe(200)
    expect((await http().get('/api/practice/sessions').set(as(true))).status).toBe(200)
  })

  it('a key with no row is ON (fail-open)', async () => {
    rows.delete('permainan')
    service.invalidate()
    expect((await http().get('/api/games/hub').set(as(true))).status).toBe(200)
  })

  it('caches for 5 s and a PUT-style invalidate takes effect at once', async () => {
    await http().get('/api/games/hub').set(as(true))
    await http().get('/api/games/rooms').set(as(true))
    await http().get('/api/cikgu/threads').set(as(true))
    expect(reads).toBe(1)
    rows.set('permainan', { enabled: false, locked: false })
    expect((await http().get('/api/games/hub').set(as(true))).status).toBe(200) // still cached
    clock.advance(FEATURE_CACHE_TTL_MS)
    expect404(await http().get('/api/games/hub').set(as(true)))
    rows.set('permainan', { enabled: true, locked: false })
    service.invalidate()
    expect((await http().get('/api/games/hub').set(as(true))).status).toBe(200)
  })

  it('table unreadable with a cold cache: /api/cikgu and /api/mohon-keluarga-angkat stay 404, other keys stay ON', async () => {
    const failing = prisma.client.featureFlag.findMany
    prisma.client.featureFlag.findMany = async () => {
      throw new Error('db down')
    }
    try {
      service.invalidate()
      expect404(await http().get('/api/cikgu/threads').set(as(false)))
      expect404(await http().get('/api/cikgu/threads').set(as(true)))
      expect404(await http().post('/api/mohon-keluarga-angkat').set(as(true)).send({}))
      expect((await http().get('/api/games/hub').set(as(true))).status).toBe(200)
    } finally {
      prisma.client.featureFlag.findMany = failing
    }
  })

  it('paths no flag covers never read the table', async () => {
    await http().get('/api/other').set(as(true))
    expect(reads).toBe(0)
  })
})

describe('FEATURE_ROUTE_PREFIXES', () => {
  it('has exactly the 4 seeded keys', () => {
    expect(Object.keys(FEATURE_ROUTE_PREFIXES).sort()).toEqual(['cikgu-alesa', 'keluarga-angkat', 'latih-tubi', 'permainan'])
  })

  it('the longest (most specific) prefix wins on nested prefixes', () => {
    const table = {
      broad: { fe: [], api: ['/api/games'] },
      narrow: { fe: [], api: ['/api/games/x'] },
    }
    expect(featureKeyForApiPath('/api/games/x/play', table)).toBe('narrow')
    expect(featureKeyForApiPath('/api/games/x', table)).toBe('narrow')
    expect(featureKeyForApiPath('/api/games/y', table)).toBe('broad')
    // order of the table does not matter
    expect(featureKeyForApiPath('/api/games/x/play', { narrow: table.narrow, broad: table.broad })).toBe('narrow')
    expect(featureKeyForApiPath('/api/games/xy', table)).toBe('broad')
  })

  it('maps api paths to their key on a segment boundary', () => {
    expect(featureKeyForApiPath('/api/games')).toBe('permainan')
    expect(featureKeyForApiPath('/api/games/jutawan/play?x=1')).toBe('permainan')
    expect(featureKeyForApiPath('/api/papan-bijak/quick-match')).toBe('permainan')
    expect(featureKeyForApiPath('/api/cikgu/send')).toBe('cikgu-alesa')
    expect(featureKeyForApiPath('/api/mohon-keluarga-angkat')).toBe('keluarga-angkat')
    expect(featureKeyForApiPath('/api/gamesx')).toBeNull()
    expect(featureKeyForApiPath('/api/admin/games')).toBeNull()
    expect(featureKeyForApiPath('/api/practice/sessions')).toBeNull()
  })
})
