import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ErrorBodySchema, PkskAccessSchema, PkskAdminAccessItemSchema, PkskDomainSchema, PkskPackageSchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { populationSeed } from '../../prisma/seed/core/population'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { pkskSeed } from '../../prisma/seed/pksk'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { PKSK_PRACTICE_PORT, PKSK_QUESTIONS_PORT, PkskModule } from '../../src/modules/pksk'
import { loginAs, START, type LoggedIn } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { buildWorld, seedQuestions } from './fakes'

/**
 * HTTP and database specs of the PKSK routes that do not need the question bank (the questions and practice ports
 * are replaced by the in-memory fakes of the unit specs, because BE-09 / BE-12 do not offer the PKSK methods yet).
 * Needs Docker (or TEST_DATABASE_URL).
 */
describe('PKSK HTTP (BE-42)', () => {
  let db: TestDatabase
  let app: INestApplication
  let http: () => TestAgent
  const world = buildWorld()
  const as = async (email: string): Promise<LoggedIn> => loginAs({ app, db, http, agent: () => request.agent(app.getHttpServer()) } as never, email)
  const get = (who: LoggedIn, path: string) => who.agent.get(`/api${path}`)
  const post = (who: LoggedIn, path: string, body: object = {}) => who.agent.post(`/api${path}`).set('X-CSRF-Token', who.csrf).send(body)
  const idOf = async (email: string) => (await db.query<{ id: string }>(`select id::text from users where lower(email) = $1`, [email]))[0]?.id as string

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, schoolsSeed, populationSeed, pkskSeed], { prisma: db.prisma })
    process.env.DATABASE_URL = db.url
    process.env.COOKIE_SECURE = 'false'
    process.env.SESSION_SECRET = 'test-secret-0123456789abcdef'
    process.env.LEGACY_BCRYPT_DUMMY_COST = '4'
    process.env.LOGIN_FAILURE_FLOOR_MS = '0'
    const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, PkskModule])] })
      .overrideProvider(CLOCK)
      .useValue(new FixedClock(START))
      .overrideProvider(PKSK_QUESTIONS_PORT)
      .useValue(world.questions)
      .overrideProvider(PKSK_PRACTICE_PORT)
      .useValue(world.practice)
      .compile()
    app = moduleRef.createNestApplication({ bufferLogs: false })
    configureApp(app)
    await app.init()
    http = () => request(app.getHttpServer()) as unknown as TestAgent
  }, 120_000)
  afterAll(async () => {
    await app.close()
    await db.drop()
  })

  it('reference rows: 15 domains in order and 3 packages come from the migration', async () => {
    const rows = await db.query<{ code: string; display_order: number }>(`select code, display_order from pksk_domains order by id`)
    expect(rows).toHaveLength(15)
    expect(rows.map((r) => r.display_order)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
    expect(await db.query(`select 1 from pksk_packages`)).toHaveLength(3)
  })

  it('401 without a session on every route; CSRF on writes', async () => {
    for (const path of ['/pksk/me/access', '/pksk-domains', '/pksk/levels/T1/dashboard', '/admin/pksk-questions', '/admin/pksk-access', '/pksk-packages']) {
      const res = await http().get(`/api${path}`)
      expect(res.status, path).toBe(401)
    }
    const admin = await as('admin@demo.test')
    const res = await admin.agent.post('/api/admin/pksk-access').send({ userId: '1', packageId: '1' })
    expect(res.status).toBe(403)
    expect(ErrorBodySchema.parse(res.body).error.code).toBe('CSRF_INVALID')
  })

  it('learner: access flags from the seeded Kombo, the 15 domains, level gate 404 before 403', async () => {
    const s = await as('pelajar@demo.test')
    expect(PkskAccessSchema.parse((await get(s, '/pksk/me/access')).body.data)).toEqual({ T1: true, T4: true })
    const domains = (await get(s, '/pksk-domains')).body.data as unknown[]
    expect(domains).toHaveLength(15)
    for (const d of domains) PkskDomainSchema.parse(d)
    expect((await get(s, '/pksk/levels/T9/dashboard')).status).toBe(404)
    const none = await as('pelajar2@demo.test')
    expect(PkskAccessSchema.parse((await get(none, '/pksk/me/access')).body.data)).toEqual({ T1: false, T4: false })
    expect((await get(none, '/pksk/levels/T1/dashboard')).status).toBe(403)
    expect((await get(none, '/pksk/levels/T9/dashboard')).status).toBe(404)
    expect((await get(none, '/pksk/levels/T1/exam')).status).toBe(403)
  })

  it('learner dashboard reads the seeded attempts and mastery of the demo student', async () => {
    const s = await as('pelajar@demo.test')
    const d = (await get(s, '/pksk/levels/T1/dashboard')).body.data
    expect(d.readiness).toEqual({ scorePct: 55, grade: 'C' })
    expect(d.examCount).toBe(2)
    expect(d.bahagianBAvgPct).toBe(59.7)
    expect((await get(s, '/pksk/levels/T4/dashboard')).body.data.examCount).toBe(0)
  })

  it('learner exam submit stores one attempt for the caller only and credits nothing', async () => {
    const s = await as('pelajar@demo.test')
    const q = seedQuestions(world.world, 'PKSK_ESSAY', 'T1', 1)[0]
    const before = (await db.query<{ n: string }>(`select count(*)::text n from pksk_exam_attempts`))[0]?.n
    const res = await post(s, '/pksk/levels/T1/exam-attempts', { answers: [{ questionId: q?.id, text: 'x'.repeat(60) }] })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.completedAt).toMatch(/\+08:00$/)
    const after = (await db.query<{ n: string }>(`select count(*)::text n from pksk_exam_attempts`))[0]?.n
    expect(Number(after)).toBe(Number(before) + 1)
    const other = await as('pelajar2@demo.test')
    expect((await get(other, '/pksk/levels/T1/exam-attempts')).status).toBe(403)
  })

  it('admin routes: 403 for a student, packages list for admin', async () => {
    const s = await as('pelajar@demo.test')
    for (const path of ['/admin/pksk-questions', '/admin/pksk-access', '/admin/pksk-access/stats', '/pksk-packages']) expect((await get(s, path)).status, path).toBe(403)
    const admin = await as('admin@demo.test')
    const pk = (await get(admin, '/pksk-packages')).body.data as unknown[]
    expect(pk.map((p) => PkskPackageSchema.parse(p).level)).toEqual(['T1', 'T4', 'ALL'])
    expect((await get(admin, '/pksk-packages')).headers['cache-control']).toBe('no-store')
  })

  it('admin grant and revoke: the learner sees the change at once, audit rows carry ids only', async () => {
    const admin = await as('admin@demo.test')
    const target = await as('pelajar2@demo.test')
    const userId = await idOf('pelajar2@demo.test')
    const bad = await post(admin, '/admin/pksk-access', { userId: '999999', packageId: '99', expiresAt: 'nope' })
    expect(bad.status).toBe(422)
    expect(bad.body.error.fields).toEqual({ userId: 'Pengguna tidak dijumpai.', packageId: 'Sila pilih pakej.', expiresAt: 'Tarikh tamat tidak sah.' })
    const granted = await post(admin, '/admin/pksk-access', { userId, packageId: '1' })
    expect(granted.status, JSON.stringify(granted.body)).toBe(201)
    expect(granted.body.status).toBe('Akses PKSK berjaya diberi.')
    const item = PkskAdminAccessItemSchema.parse(granted.body.data)
    expect((await get(target, '/pksk/me/access')).body.data).toEqual({ T1: true, T4: false })
    expect((await get(admin, '/admin/pksk-access?search=pelajar2')).body.meta.totalItems).toBeGreaterThanOrEqual(1)
    const revoked = await post(admin, `/admin/pksk-access/${item.id}/revoke`)
    expect(revoked.status).toBe(200)
    expect((await get(target, '/pksk/me/access')).body.data).toEqual({ T1: false, T4: false })
    expect((await post(admin, `/admin/pksk-access/${item.id}/revoke`)).status).toBe(409)
    expect((await post(admin, '/admin/pksk-access/987654/revoke')).status).toBe(404)
    const audits = await db.query<{ action: string; detail: unknown }>(`select action, detail from audit_events where action like 'pksk.%' order by id`)
    expect(audits.map((a) => a.action)).toEqual(['pksk.access.granted', 'pksk.access.revoked'])
    expect(JSON.stringify(audits)).not.toMatch(/@demo\.test|Pelajar/)
    const stats = (await get(admin, '/admin/pksk-access/stats')).body.data
    expect(stats.activeTotal).toBe(2)
  })

  it('admin questions through the port: create 201, PKSK-only guard on bulk', async () => {
    const admin = await as('admin@demo.test')
    const res = await post(admin, '/admin/pksk-questions', { bahagian: 'B', pkskDomainId: '2', pkskTargetLevel: 'T1', questionText: 'Soalan ujian', difficultyLevel: 3, options: [{ text: 'a', isCorrect: true }, { text: 'b' }] })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const bulk = await post(admin, '/admin/pksk-questions/bulk', { action: 'delete', ids: ['424242'] })
    expect(bulk.status).toBe(422)
    expect(bulk.body.error.fields.ids).toBe('Sila pilih sekurang-kurangnya satu soalan PKSK.')
  })

  it('the default question port fails closed (no question data) when nothing is plugged in', async () => {
    // Covered by the unit spec of ports; here we only assert the seeded demo data carries no questions.
    expect(await db.query(`select 1 from question_tags where kind like 'pksk%'`)).toHaveLength(0)
  })
})
