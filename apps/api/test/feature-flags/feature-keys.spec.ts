import 'reflect-metadata'

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { All, Controller, type CanActivate, type ExecutionContext, type INestApplication, Injectable } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { ErrorBodySchema, FEATURE_ROUTE_PREFIXES, featureKeyForApiPath } from '@pp/contract'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { AllExceptionsFilter } from '../../src/common/errors/all-exceptions.filter'
import { ApiError } from '../../src/common/errors/api-error'
import { FeatureFlagsService } from '../../src/common/feature-flags/feature-flags.service'
import { FeatureGuard } from '../../src/common/feature-flags/feature.guard'
import { FixedClock } from '../../src/db/clock'

/**
 * S0-T11 (R1-ADM-P2-19 FR-19.2, API-AUTH-16): every one of the 32 Kawalan Ciri keys has a route-prefix entry, and for every
 * key that has an api prefix, OFF answers 404 NOT_FOUND (anonymous included) and ON reaches the handler. No database: the
 * flag table is an in-memory stand-in, as in feature.guard.spec.ts.
 */

/** The 32 keys of N-06 / P2-19: 4 from S0-T10 and the 28 of migration 0251. */
const ALL_KEYS = [
  'permainan', 'misi-harian', 'kombo', 'leaderboard', 'remedial', 'cita-cita', 'universiti', 'biasiswa', 'target-spm',
  'analisa-item', 'prestasi', 'psikometrik', 'profil-cerah', 'kemajuan-saya', 'sejarah-latihan', 'video-pembelajaran',
  'perutusan', 'panduan-pengguna', 'tiket-bantuan', 'latih-tubi', 'cikgu-alesa', 'keluarga-angkat',
  'guru.headcount', 'guru.misi-harian', 'guru.kelas', 'guru.prestasi', 'guru.monitoring', 'guru.analisis-item',
  'guru.gamifikasi', 'guru.broadcast', 'guru.databank', 'guru.sumbang-soalan',
] as const

/** Keys enforced on the front-end only (D-7): no dedicated API controller, or an endpoint shared with other roles or screens. */
const FE_ONLY_KEYS = [
  'kombo', 'cita-cita', 'universiti', 'biasiswa', 'prestasi', 'psikometrik', 'profil-cerah', 'kemajuan-saya',
  'sejarah-latihan', 'panduan-pengguna', 'latih-tubi', 'guru.misi-harian', 'guru.kelas', 'guru.prestasi',
  'guru.monitoring', 'analisa-item', 'video-pembelajaran',
  'guru.gamifikasi', 'guru.broadcast', 'guru.databank',
] as const

const apiKeys = ALL_KEYS.filter((k) => !(FE_ONLY_KEYS as readonly string[]).includes(k))

describe('FEATURE_ROUTE_PREFIXES coverage (S0-T11)', () => {
  it('has exactly the 32 keys, each with at least one front-end prefix', () => {
    expect(Object.keys(FEATURE_ROUTE_PREFIXES).sort()).toEqual([...ALL_KEYS].sort())
    expect(ALL_KEYS).toHaveLength(32)
    for (const [key, p] of Object.entries(FEATURE_ROUTE_PREFIXES)) {
      expect(p.fe.length, `${key} has no fe prefix`).toBeGreaterThan(0)
      for (const prefix of p.fe) expect(prefix.startsWith('/') && !prefix.startsWith('/api'), `${key} fe ${prefix}`).toBe(true)
    }
  })

  it('api prefixes start with /api; exactly the fe-only keys have none', () => {
    for (const [key, p] of Object.entries(FEATURE_ROUTE_PREFIXES)) {
      for (const prefix of p.api) expect(prefix.startsWith('/api/'), `${key} api ${prefix}`).toBe(true)
      expect(p.api.length === 0, key).toBe((FE_ONLY_KEYS as readonly string[]).includes(key))
    }
  })

  it('no api prefix is claimed twice or nested in another key (the first match would win)', () => {
    const all = Object.entries(FEATURE_ROUTE_PREFIXES).flatMap(([key, p]) => p.api.map((prefix) => ({ key, prefix })))
    for (const a of all) {
      for (const b of all) {
        if (a === b) continue
        expect(b.prefix === a.prefix || b.prefix.startsWith(`${a.prefix}/`), `${a.key} ${a.prefix} vs ${b.key} ${b.prefix}`).toBe(false)
      }
    }
  })

  it('every api prefix points at a real route: each segment is a quoted route string in apps/api/src', () => {
    const root = fileURLToPath(new URL('../../src/', import.meta.url))
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.controllers?\.ts$|\.controller\.ts$/.test(name)) files.push(full)
      }
    }
    walk(root)
    const text = files.map((f) => readFileSync(f, 'utf8')).join('\n')
    for (const [key, p] of Object.entries(FEATURE_ROUTE_PREFIXES)) {
      for (const prefix of p.api) {
        for (const seg of prefix.replace(/^\/api\//, '').split('/')) {
          expect(new RegExp(`['"\`]${seg}['"\`/]`).test(text), `${key}: no route string '${seg}' for ${prefix}`).toBe(true)
        }
      }
    }
  })

  it('featureKeyForApiPath maps each api prefix, a sub-path and a query string to its key, and not a look-alike', () => {
    for (const [key, p] of Object.entries(FEATURE_ROUTE_PREFIXES)) {
      for (const prefix of p.api) {
        expect(featureKeyForApiPath(prefix)).toBe(key)
        expect(featureKeyForApiPath(`${prefix}/sub/1?x=1`)).toBe(key)
        expect(featureKeyForApiPath(`${prefix}x`)).toBeNull()
      }
    }
  })

  it('admin routes are never covered', () => {
    for (const path of ['/api/admin/tiket', '/api/admin/gamification', '/api/admin/feature-toggles', '/api/practice/sessions', '/api/guru/classes']) {
      expect(featureKeyForApiPath(path), path).toBeNull()
    }
  })
})

const rows = new Map<string, boolean>()
const clock = new FixedClock('2026-11-05T08:00:00Z')
const prisma = {
  client: { featureFlag: { findMany: async () => [...rows].map(([key, enabled]) => ({ key, enabled, locked: false })) } },
}

@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    if (!ctx.switchToHttp().getRequest().headers['x-test-user']) throw ApiError.of('UNAUTHORIZED')
    return true
  }
}

/** Answers 200 for any path under /api, so the test reaches "a normal answer" for every prefix. */
@Controller('api')
class AnyApiProbe {
  @All('*path')
  any() {
    return { data: 'ok' }
  }
}

describe('per-key OFF -> 404, ON -> normal answer (API keys)', () => {
  let app: INestApplication
  let service: FeatureFlagsService
  const http = () => request(app.getHttpServer())
  const signed = { 'x-test-user': 'u' }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AnyApiProbe],
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
    for (const key of ALL_KEYS) rows.set(key, true)
    service.invalidate()
  })

  it('covers the expected number of api keys', () => {
    expect(apiKeys).toHaveLength(32 - FE_ONLY_KEYS.length)
  })

  for (const key of apiKeys) {
    const prefixes = FEATURE_ROUTE_PREFIXES[key]?.api ?? []
    it(`${key}: OFF answers 404 NOT_FOUND on ${prefixes.join(', ')}, other keys stay reachable, ON answers normally`, async () => {
      const other = apiKeys.find((k) => k !== key && (FEATURE_ROUTE_PREFIXES[k]?.api.length ?? 0) > 0) ?? 'permainan'
      const otherPrefix = FEATURE_ROUTE_PREFIXES[other]?.api[0] ?? '/api/games'
      for (const prefix of prefixes) {
        // ON: anonymous reaches AuthGuard (401), signed in reaches the handler.
        expect((await http().get(prefix)).status).toBe(401)
        expect((await http().get(`${prefix}/1`).set(signed)).status).toBe(200)
      }
      rows.set(key, false)
      service.invalidate()
      for (const prefix of prefixes) {
        for (const headers of [{}, signed]) {
          for (const path of [prefix, `${prefix}/1?x=1`]) {
            const res = await http().get(path).set(headers)
            expect(res.status, path).toBe(404)
            expect(ErrorBodySchema.parse(res.body).error.code).toBe('NOT_FOUND')
          }
        }
        expect((await http().post(prefix).set(signed).send({})).status).toBe(404)
      }
      expect((await http().get(`${otherPrefix}/1`).set(signed)).status).toBe(200)
      rows.set(key, true)
      service.invalidate()
      for (const prefix of prefixes) expect((await http().get(`${prefix}/1`).set(signed)).status).toBe(200)
    })
  }

  it('a fe-only key switched OFF never changes an api answer', async () => {
    for (const key of FE_ONLY_KEYS) rows.set(key, false)
    service.invalidate()
    for (const key of apiKeys) {
      for (const prefix of FEATURE_ROUTE_PREFIXES[key]?.api ?? []) {
        expect((await http().get(`${prefix}/1`).set(signed)).status, prefix).toBe(200)
      }
    }
    expect((await http().get('/api/practice/sessions').set(signed)).status).toBe(200)
  })

  it('perutusan OFF closes only the public read; the shared writer endpoints stay reachable (D-7)', async () => {
    rows.set('perutusan', false)
    service.invalidate()
    expect((await http().get('/api/public/perutusan/1').set(signed)).status).toBe(404)
    expect((await http().post('/api/perutusan').set(signed).send({})).status).toBe(200)
    expect((await http().get('/api/monitoring/overview').set(signed)).status).toBe(200)
  })

  it('tiket-bantuan OFF leaves /api/admin/tiket reachable', async () => {
    rows.set('tiket-bantuan', false)
    service.invalidate()
    expect((await http().get('/api/tiket').set(signed)).status).toBe(404)
    expect((await http().get('/api/admin/tiket').set(signed)).status).toBe(200)
  })
})
