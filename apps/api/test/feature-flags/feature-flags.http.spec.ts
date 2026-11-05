import 'reflect-metadata'

import { Controller, Get, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { FEATURE_ROUTE_PREFIXES, FeatureToggleListResponseSchema, SessionSchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { Public } from '../../src/common/guards/decorators'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { START, loginAs, type LoggedIn } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { ADMIN, STUDENT, apiOf, expectError } from '../users/helpers'

/**
 * S0-T10 (DM-34, API-ADM-09, API-AUTH-16, API-AUTH-03) on a private migrated database: the 0250 seed and CHECK, the admin
 * routes, the audit row, the 404 of FeatureGuard ahead of AuthGuard, and `features` on GET /api/session.
 * Needs the Testcontainers Postgres like every DB spec in this folder (not run in the no-docker sandbox where it was written).
 */
@Public()
@Controller('games')
class GamesProbe {
  @Get('probe')
  probe() {
    return { data: 'ok' }
  }
}
@Module({ controllers: [GamesProbe] })
class ProbeModule {}

describe('Kawalan Ciri (S0-T10)', () => {
  let db: TestDatabase
  let close: () => Promise<void>
  let http: () => TestAgent
  let admin: LoggedIn
  let student: LoggedIn
  let t: { agent(): TestAgent }

  const auditRows = () => db.query<{ actor_user_id: string; detail: Record<string, unknown> }>(`select actor_user_id::text, detail from audit_events where action = 'feature_flag.toggled' order by id`)

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed], { prisma: db.prisma })
    Object.assign(process.env, { DATABASE_URL: db.url, COOKIE_SECURE: 'false', SESSION_SECRET: 'test-secret-0123456789abcdef', LEGACY_BCRYPT_DUMMY_COST: '4', LOGIN_FAILURE_FLOOR_MS: '0' })
    const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, ProbeModule])] })
      .overrideProvider(CLOCK)
      .useValue(new FixedClock(START))
      .compile()
    const app = moduleRef.createNestApplication({ bufferLogs: false })
    configureApp(app)
    await app.init()
    http = () => request(app.getHttpServer()) as unknown as TestAgent
    t = { agent: () => request.agent(app.getHttpServer()) }
    close = async () => {
      await app.close()
      await db.drop()
    }
    admin = await loginAs(t as never, ADMIN)
    student = await loginAs(t as never, STUDENT)
  }, 120_000)
  afterAll(async () => {
    await close()
  })

  it('migration 0250 seeds the 32 N-06 rows (S0-T10 four plus the S0-T11 28, #417 D-1); the CHECK refuses a locked row that is ON (INV-29)', async () => {
    const rows = await db.query<{ key: string; label_ms: string; audience: string; enabled: boolean; locked: boolean; sort_order: number }>(`select key, label_ms, audience, enabled, locked, sort_order from feature_flags order by sort_order`)
    expect(rows).toHaveLength(32)
    const byKey = new Map(rows.map((r) => [r.key, r]))
    expect([byKey.get('permainan'), byKey.get('latih-tubi'), byKey.get('cikgu-alesa'), byKey.get('keluarga-angkat')]).toEqual([
      { key: 'permainan', label_ms: 'Zona Permainan', audience: 'pelajar', enabled: true, locked: false, sort_order: 10 },
      { key: 'latih-tubi', label_ms: 'Latih Tubi', audience: 'pelajar', enabled: true, locked: false, sort_order: 200 },
      { key: 'cikgu-alesa', label_ms: 'Cikgu Alesa', audience: 'pelajar', enabled: false, locked: true, sort_order: 900 },
      { key: 'keluarga-angkat', label_ms: 'Mohon Keluarga Angkat', audience: 'pelajar', enabled: false, locked: true, sort_order: 910 },
    ])
    expect(rows.filter((r) => r.audience === 'guru')).toHaveLength(10)
    // Only the two locked rows and the Delivery B key `tiket-bantuan` (D-2) are OFF.
    expect(rows.filter((r) => !r.enabled).map((r) => r.key).sort()).toEqual(['cikgu-alesa', 'keluarga-angkat', 'tiket-bantuan'])
    // Every key has a route-prefix entry, and only the two locked keys are locked.
    expect(rows.map((r) => r.key).sort()).toEqual(Object.keys(FEATURE_ROUTE_PREFIXES).sort())
    expect(rows.filter((r) => r.locked).map((r) => r.key).sort()).toEqual(['cikgu-alesa', 'keluarga-angkat'])
    await expect(db.query(`update feature_flags set enabled = true where key = 'cikgu-alesa'`)).rejects.toThrow(/ck_feature_flags_locked_off/)
    await expect(db.query(`insert into feature_flags (key, label_ms, audience) values ('x', 'X', 'ibu')`)).rejects.toThrow(/ck_feature_flags_audience/)
  })

  it('GET lists the toggles for the admin only: 401 anonymous, 403 student', async () => {
    expectError(await http().get('/api/admin/feature-toggles'), 'UNAUTHORIZED')
    expectError(await apiOf(student).get('/admin/feature-toggles'), 'FORBIDDEN')
    const res = await apiOf(admin).get('/admin/feature-toggles')
    expect(res.status).toBe(200)
    const keys = FeatureToggleListResponseSchema.parse(res.body).data.map((r) => r.key)
    expect(keys).toHaveLength(32)
    expect(keys.slice(0, 2)).toEqual(['permainan', 'misi-harian']) // ordered by sort_order
    expect(keys.slice(-2)).toEqual(['cikgu-alesa', 'keluarga-angkat'])
    expect(keys.indexOf('guru.headcount')).toBeLessThan(keys.indexOf('guru.sumbang-soalan'))
  })

  it('PUT needs the admin and the CSRF header; a student gets 403', async () => {
    expectError(await apiOf(student).put('/admin/feature-toggles/permainan', { enabled: false }), 'FORBIDDEN')
    expectError(await admin.agent.put('/api/admin/feature-toggles/permainan').send({ enabled: false }), 'CSRF_INVALID')
  })

  it('PUT validates the body, refuses a locked key with 409 and an unknown key with 404', async () => {
    const api = apiOf(admin)
    expectError(await api.put('/admin/feature-toggles/permainan', { enabled: 'ya' }), 'VALIDATION_ERROR')
    expectError(await api.put('/admin/feature-toggles/cikgu-alesa', { enabled: true }), 'CONFLICT')
    expectError(await api.put('/admin/feature-toggles/tiada', { enabled: true }), 'NOT_FOUND')
    expect((await db.query<{ enabled: boolean }>(`select enabled from feature_flags where key = 'cikgu-alesa'`))[0]!.enabled).toBe(false)
    // A PUT of the stored value is a no-op: 200 and no audit row.
    const before = (await auditRows()).length
    expect((await api.put('/admin/feature-toggles/cikgu-alesa', { enabled: false })).status).toBe(200)
    expect((await api.put('/admin/feature-toggles/permainan', { enabled: true })).status).toBe(200)
    expect((await auditRows()).length).toBe(before)
  })

  it('PUT off: audited, shown in the session map, and the games prefix answers 404 to anonymous and admin; PUT on restores it', async () => {
    const api = apiOf(admin)
    expect((await http().get('/api/games/probe')).status).toBe(200)

    const off = await api.put('/admin/feature-toggles/permainan', { enabled: false })
    expect(off.status).toBe(200)
    expect(off.body).toEqual({ data: { key: 'permainan', labelMs: 'Zona Permainan', audience: 'pelajar', enabled: false, locked: false } })
    const audits = await auditRows()
    expect(audits.at(-1)).toMatchObject({ detail: { key: 'permainan', old: true, new: false } })
    expect(audits.at(-1)!.actor_user_id).toBe(admin.session.user.id)

    expectError(await http().get('/api/games/probe'), 'NOT_FOUND')
    expectError(await admin.agent.get('/api/games/probe'), 'NOT_FOUND')
    const session = SessionSchema.parse((await admin.agent.get('/api/session')).body.data)
    expect(Object.keys(session.features ?? {})).toHaveLength(32)
    expect(session.features).toMatchObject({ permainan: false, 'latih-tubi': true, 'cikgu-alesa': false, 'keluarga-angkat': false, leaderboard: true, 'tiket-bantuan': false })
    expect(Object.entries(session.features ?? {}).filter(([, on]) => !on).map(([k]) => k).sort()).toEqual(['cikgu-alesa', 'keluarga-angkat', 'permainan', 'tiket-bantuan'])

    expect((await api.put('/admin/feature-toggles/permainan', { enabled: true })).status).toBe(200)
    expect((await http().get('/api/games/probe')).status).toBe(200)
    expect((await auditRows()).at(-1)).toMatchObject({ detail: { key: 'permainan', old: false, new: true } })
  })

  it('every unlocked key can be switched OFF and back ON by the admin, audited, and shows in the session map (S0-T11)', async () => {
    const api = apiOf(admin)
    const keys = Object.keys(FEATURE_ROUTE_PREFIXES).filter((k) => k !== 'cikgu-alesa' && k !== 'keluarga-angkat' && k !== 'permainan')
    expect(keys).toHaveLength(29)
    const before = (await auditRows()).length
    for (const key of keys) {
      const row = (await db.query<{ enabled: boolean }>(`select enabled from feature_flags where key = $1`, [key]))[0]!
      const flip = await api.put(`/admin/feature-toggles/${key}`, { enabled: !row.enabled })
      expect(flip.status, key).toBe(200)
      expect(flip.body.data).toMatchObject({ key, enabled: !row.enabled, locked: false })
      expect((await admin.agent.get('/api/session')).body.data.features[key]).toBe(!row.enabled)
      expect((await api.put(`/admin/feature-toggles/${key}`, { enabled: row.enabled })).status, key).toBe(200)
    }
    expect((await auditRows()).length - before).toBe(keys.length * 2)
    expectError(await api.put('/admin/feature-toggles/cikgu-alesa', { enabled: true }), 'CONFLICT')
  })

  it('a key with no row is ON: deleting the permainan row reopens the prefix', async () => {
    await db.query(`delete from feature_flags where key = 'permainan'`)
    await apiOf(admin).put('/admin/feature-toggles/latih-tubi', { enabled: true }) // drops the in-process cache
    expect((await http().get('/api/games/probe')).status).toBe(200)
    expect((await admin.agent.get('/api/session')).body.data.features).not.toHaveProperty('permainan')
  })
})
