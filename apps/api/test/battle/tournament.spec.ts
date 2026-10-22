import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import {
  BattleTournamentActiveSchema,
  BattleTournamentCreatedSchema,
  BattleTournamentDetailSchema,
  BattleTournamentFormOptionsSchema,
  BattleTournamentListItemSchema,
  ErrorBodySchema,
} from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { populationSeed } from '../../prisma/seed/core/population'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { BattleTournamentsModule } from '../../src/modules/battle/tournaments'
import { SPM_COUNTS } from '../../src/modules/battle/tournaments/spm-counts'
import { DEMO_PASSWORD, loginAs, START, type LoggedIn } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

const ROLE_ACCOUNTS: Record<string, string> = {
  admin: 'admin@demo.test',
  school_admin: 'adminsekolah@demo.test',
  ppd_officer: 'ppd@demo.test',
  teacher: 'guru@demo.test',
  student: 'pelajar@demo.test',
  parent: 'ibubapa@demo.test',
  sponsor: 'penaja@demo.test',
}

const VALID = {
  title: 'Piala Sekolah',
  description: 'Pertandingan',
  education_level_id: 'spm',
  format: 'single_match',
  question_mode: 'subject',
  total_questions: 20,
  time_window_minutes: 30,
  top_n_scoring: 5,
  min_participants: 4,
  action: 'open_registration',
} as const

describe('battle tournaments (M16-01, M16-42..45)', () => {
  let db: TestDatabase
  let app: INestApplication
  let clock: FixedClock
  let admin: LoggedIn
  let adminTest: TestAgent
  let adminTestCsrf: string
  let subjectIds: string[]
  const clients: Record<string, LoggedIn> = {}

  const http = (): TestAgent => request(app.getHttpServer()) as unknown as TestAgent
  const get = (who: LoggedIn, path: string): Promise<Response> => who.agent.get(`/api${path}`)
  const post = (who: LoggedIn, path: string, body: object = {}): Promise<Response> =>
    who.agent.post(`/api${path}`).set('X-CSRF-Token', who.csrf).send(body)
  const create = async (body: object): Promise<string> => {
    const r = await post(admin, '/tournaments', body)
    expect(r.status, JSON.stringify(r.body)).toBe(201)
    return BattleTournamentCreatedSchema.parse(r.body.data).uuid
  }
  const error = (res: Response, status: number, code: string, message?: string) => {
    const e = ErrorBodySchema.parse(res.body).error
    expect(res.status, JSON.stringify(res.body)).toBe(status)
    expect(e.code).toBe(code)
    if (message !== undefined) expect(e.message).toBe(message)
    return e
  }
  const clear = () => db.query('delete from tournaments')

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, schoolsSeed, populationSeed, curriculumSeed], { prisma: db.prisma })
    Object.assign(process.env, {
      DATABASE_URL: db.url,
      COOKIE_SECURE: 'false',
      SESSION_SECRET: 'test-secret-0123456789abcdef',
      LEGACY_BCRYPT_DUMMY_COST: '4',
      LOGIN_FAILURE_FLOOR_MS: '0',
      THROTTLE_BATTLE_READ_PER_MINUTE: '100000',
      THROTTLE_BATTLE_WRITE_PER_MINUTE: '100000',
    })
    for (const k of ['IC_HASH_KEY', 'SESSION_COOKIE_NAME', 'COOKIE_DOMAIN', 'THROTTLE_LOGIN_PER_MINUTE', 'TRUST_PROXY_HOPS', 'LOGIN_IDENTIFIER_FAIL_LIMIT']) delete process.env[k]
    clock = new FixedClock(START)
    const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, BattleTournamentsModule])] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile()
    app = moduleRef.createNestApplication({ bufferLogs: false })
    configureApp(app)
    await app.init()
    const t = { app, db, clock, http, agent: () => request.agent(app.getHttpServer()) as unknown as TestAgent, close: async () => undefined }
    for (const [role, email] of Object.entries(ROLE_ACCOUNTS)) clients[role] = await loginAs(t as never, email)
    admin = clients.admin as LoggedIn

    // Mod Pelajar admin session.
    adminTest = request.agent(app.getHttpServer()) as unknown as TestAgent
    const l = await adminTest.post('/api/auth/login').send({ identifier: ROLE_ACCOUNTS.admin, password: DEMO_PASSWORD, remember: false })
    const m = await adminTest.post('/api/session/mode').set('X-CSRF-Token', l.body.data.csrf).send({ mode: 'mod_pelajar' })
    expect(m.status, JSON.stringify(m.body)).toBe(200)
    adminTestCsrf = (m.body.data as { csrf?: string }).csrf ?? l.body.data.csrf

    const fo = BattleTournamentFormOptionsSchema.parse((await get(admin, '/tournaments/form-options')).body.data)
    subjectIds = fo.subjects.map((s) => s.id)
  }, 180_000)

  afterAll(async () => {
    await app.close()
    await db.drop()
  })

  describe('guards', () => {
    it('anonymous callers get 401 UNAUTHORIZED on all five routes', async () => {
      const uuid = '00000000-0000-4000-8000-000000000000'
      for (const res of [
        await http().get('/api/tournament/active'),
        await http().get('/api/tournaments'),
        await http().get('/api/tournaments/form-options'),
        await http().post('/api/tournaments').send({}),
        await http().get(`/api/tournaments/${uuid}`),
      ]) {
        error(res, 401, 'UNAUTHORIZED', 'Unauthenticated.')
      }
    })

    it.each(Object.keys(ROLE_ACCOUNTS).filter((r) => r !== 'admin'))('%s gets 403 FORBIDDEN on form options and create', async (role) => {
      const who = clients[role] as LoggedIn
      error(await get(who, '/tournaments/form-options'), 403, 'FORBIDDEN', 'This action is unauthorized.')
      error(await post(who, '/tournaments', VALID), 403, 'FORBIDDEN', 'This action is unauthorized.')
      expect((await get(who, '/tournament/active')).status).toBe(200)
      expect((await get(who, '/tournaments')).status).toBe(200)
    })

    it('create without the CSRF header is 403 CSRF_INVALID', async () => {
      const r = await admin.agent.post('/api/tournaments').send(VALID)
      expect(r.status).toBe(403)
      expect(ErrorBodySchema.parse(r.body).error.code).toBe('CSRF_INVALID')
    })

    it('answers are no-store', async () => {
      expect((await get(admin, '/tournaments')).headers['cache-control']).toMatch(/no-store/)
    })
  })

  describe('form options (M16-43)', () => {
    it('lists levels, active subjects sorted by name, no exam papers, and the SPM counts by code', async () => {
      const r = await get(admin, '/tournaments/form-options')
      expect(r.status).toBe(200)
      const d = BattleTournamentFormOptionsSchema.parse(r.body.data)
      expect(d.educationLevels).toEqual([
        { id: 'tingkatan4', name: 'Tingkatan 4' },
        { id: 'tingkatan5', name: 'Tingkatan 5' },
        { id: 'spm', name: 'SPM (Tingkatan 4 & 5)' },
      ])
      expect(d.examPapers).toEqual([])
      expect(d.spmCounts).toEqual(SPM_COUNTS)
      expect(d.spmCounts.ADDMATH).toBe(20)
      expect(d.subjects.length).toBeGreaterThan(0)
      const names = d.subjects.map((s) => s.name)
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms')))
    })
  })

  describe('create (M16-44) and detail (M16-45)', () => {
    it('creates a registration tournament (201) and stores created_by', async () => {
      await clear()
      const id = await create({ ...VALID, subject_id: subjectIds[0], registration_opens_at: '2026-11-01T08:00', registration_closes_at: '2026-11-10T18:30' })
      const row = (await db.query<{ status: string; created_by: string; is_test: boolean; subject_id: string; opens: string; closes: string }>(
        `select status, created_by::text, is_test, subject_id::text, to_char(registration_opens_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI') as opens, to_char(registration_closes_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI') as closes from tournaments where id = $1`,
        [id],
      ))[0]!
      expect(row.status).toBe('registration')
      expect(row.created_by).toBe(admin.session.user.id)
      expect(row.is_test).toBe(false)
      expect(row.subject_id).toBe(subjectIds[0])
      // Local Asia/Kuala_Lumpur text -> UTC (-8h).
      expect(row.opens).toBe('2026-11-01T00:00')
      expect(row.closes).toBe('2026-11-10T10:30')
      const d = BattleTournamentDetailSchema.parse((await get(clients.student as LoggedIn, `/tournaments/${id}`)).body.data)
      expect(d).toMatchObject({
        title: 'Piala Sekolah',
        status: 'registration',
        educationLevelId: 'spm',
        format: 'single_match',
        groupsCount: null,
        questionMode: 'subject',
        subjectId: subjectIds[0],
        examPaperId: null,
        mixedSubjectIds: [],
        registrationOpensAt: '2026-11-01T08:00:00.000+08:00',
        registrationClosesAt: '2026-11-10T18:30:00.000+08:00',
        liveMatch: null,
      })
    })

    it('draft action creates a draft; random_mix stores the subjects; league needs groups_count', async () => {
      await clear()
      const draft = await create({ ...VALID, subject_id: subjectIds[0], action: 'draft' })
      expect(BattleTournamentDetailSchema.parse((await get(admin, `/tournaments/${draft}`)).body.data).status).toBe('draft')
      const mix = await create({ ...VALID, question_mode: 'random_mix', mixed_subject_ids: [subjectIds[0], subjectIds[1], subjectIds[0], '999999999'], format: 'league', groups_count: 4 })
      const d = BattleTournamentDetailSchema.parse((await get(admin, `/tournaments/${mix}`)).body.data)
      expect(d.mixedSubjectIds).toEqual([subjectIds[0], subjectIds[1]])
      expect(d.subjectId).toBeNull()
      expect(d.groupsCount).toBe(4)
    })

    it('collects every failing field; the top-level message is the first one', async () => {
      const r = await post(admin, '/tournaments', {
        title: '  ',
        education_level_id: 'x',
        format: 'league',
        question_mode: 'subject',
        total_questions: 4,
        time_window_minutes: 181,
        top_n_scoring: 0,
        min_participants: 101,
        registration_opens_at: '2026-13-01T08:00',
        registration_closes_at: 'soon',
        action: 'publish',
      })
      const e = error(r, 422, 'VALIDATION_ERROR', 'Tajuk tournament diperlukan.')
      expect(e.fields).toEqual({
        title: 'Tajuk tournament diperlukan.',
        education_level_id: 'Sila pilih tahap pendidikan.',
        groups_count: 'Bilangan kumpulan mesti antara 2 dan 8.',
        subject_id: 'Sila pilih sumber soalan.',
        total_questions: 'Nilai di luar julat.',
        time_window_minutes: 'Nilai di luar julat.',
        top_n_scoring: 'Nilai di luar julat.',
        min_participants: 'Nilai di luar julat.',
        registration_opens_at: 'Tarikh tidak sah.',
        registration_closes_at: 'Tarikh tidak sah.',
        action: 'Tindakan tidak sah.',
      })
    })

    it('rejects an empty body, a bad format, groups out of 2..8, exam_paper and an empty random_mix', async () => {
      const empty = error(await post(admin, '/tournaments', {}), 422, 'VALIDATION_ERROR', 'Tajuk tournament diperlukan.')
      expect(Object.keys(empty.fields ?? {})).toEqual(expect.arrayContaining(['title', 'education_level_id', 'format', 'question_mode', 'total_questions', 'action']))
      error(await post(admin, '/tournaments', { ...VALID, format: 'swiss', subject_id: subjectIds[0] }), 422, 'VALIDATION_ERROR', 'Format tidak sah.')
      for (const g of [1, 9, 2.5, undefined]) {
        const e = error(await post(admin, '/tournaments', { ...VALID, subject_id: subjectIds[0], format: 'hybrid', groups_count: g }), 422, 'VALIDATION_ERROR', 'Bilangan kumpulan mesti antara 2 dan 8.')
        expect(e.fields).toEqual({ groups_count: 'Bilangan kumpulan mesti antara 2 dan 8.' })
      }
      expect((await post(admin, '/tournaments', { ...VALID, subject_id: subjectIds[0], format: 'knockout', groups_count: 99 })).status).toBe(201)
      const paper = error(await post(admin, '/tournaments', { ...VALID, question_mode: 'exam_paper', exam_paper_id: '1' }), 422, 'VALIDATION_ERROR', 'Sila pilih sumber soalan.')
      expect(paper.fields).toEqual({ exam_paper_id: 'Sila pilih sumber soalan.' })
      const mix = error(await post(admin, '/tournaments', { ...VALID, question_mode: 'random_mix', mixed_subject_ids: ['999999999'] }), 422, 'VALIDATION_ERROR')
      expect(mix.fields).toEqual({ mixed_subject_ids: 'Sila pilih sumber soalan.' })
      error(await post(admin, '/tournaments', { ...VALID, subject_id: '999999999' }), 422, 'VALIDATION_ERROR', 'Sila pilih sumber soalan.')
    })

    it('description is capped at 5000 characters', async () => {
      const ok5000 = { ...VALID, subject_id: subjectIds[0], description: 'x'.repeat(5000) }
      expect((await post(admin, '/tournaments', ok5000)).status).toBe(201)
      const e = error(await post(admin, '/tournaments', { ...ok5000, description: 'x'.repeat(5001) }), 422, 'VALIDATION_ERROR', 'Nilai di luar julat.')
      expect(e.fields).toEqual({ description: 'Nilai di luar julat.' })
    })

    it('range bounds are inclusive and the close date must be after the open date (table CHECK is strict)', async () => {
      const lo = { ...VALID, subject_id: subjectIds[0], total_questions: 5, time_window_minutes: 10, top_n_scoring: 1, min_participants: 1 }
      const hi = { ...VALID, subject_id: subjectIds[0], total_questions: 100, time_window_minutes: 180, top_n_scoring: 50, min_participants: 100 }
      expect((await post(admin, '/tournaments', lo)).status).toBe(201)
      expect((await post(admin, '/tournaments', hi)).status).toBe(201)
      const same = { ...lo, registration_opens_at: '2026-11-01T08:00', registration_closes_at: '2026-11-01T08:00' }
      expect((await post(admin, '/tournaments', { ...same, registration_closes_at: '2026-11-01T08:01' })).status).toBe(201)
      for (const closes of ['2026-11-01T08:00', '2026-11-01T07:59']) {
        const e = error(await post(admin, '/tournaments', { ...same, registration_closes_at: closes }), 422, 'VALIDATION_ERROR', 'Tarikh tutup mesti selepas tarikh buka.')
        expect(e.fields).toEqual({ registration_closes_at: 'Tarikh tutup mesti selepas tarikh buka.' })
      }
      // an empty date string is "no date"
      expect((await post(admin, '/tournaments', { ...lo, registration_opens_at: '', registration_closes_at: '' })).status).toBe(201)
    })

    it('detail: unknown and malformed uuids are the same 404; drafts are admin only', async () => {
      await clear()
      const draft = await create({ ...VALID, subject_id: subjectIds[0], action: 'draft' })
      const student = clients.student as LoggedIn
      error(await get(student, `/tournaments/${draft}`), 404, 'NOT_FOUND', 'Tournament tidak dijumpai.')
      error(await get(student, '/tournaments/00000000-0000-4000-8000-000000000000'), 404, 'NOT_FOUND', 'Tournament tidak dijumpai.')
      for (const bad of ['abc', '123', 'not-a-uuid-at-all', '%27%20or%201=1']) {
        error(await get(student, `/tournaments/${bad}`), 404, 'NOT_FOUND', 'Tournament tidak dijumpai.')
        error(await get(admin, `/tournaments/${bad}`), 404, 'NOT_FOUND', 'Tournament tidak dijumpai.')
      }
      expect((await get(admin, `/tournaments/${draft}`)).status).toBe(200)
      // form-options is a literal route, not a uuid
      expect((await get(admin, '/tournaments/form-options')).status).toBe(200)
    })
  })

  describe('active list (M16-01, M16-42)', () => {
    it('orders by opening date (null last) then creation time; hides drafts and completed; derives ongoing', async () => {
      await clear()
      const sub = subjectIds[0]
      const mk = (title: string, extra: object) => create({ ...VALID, title, subject_id: sub, ...extra })
      const late = await mk('Lewat', { registration_opens_at: '2026-12-01T08:00' })
      clock.advance(1000)
      const noDate = await mk('Tiada tarikh', {})
      clock.advance(1000)
      const early = await mk('Awal', { registration_opens_at: '2026-10-01T08:00', registration_closes_at: '2026-10-19T09:10' })
      clock.advance(1000)
      const noDate2 = await mk('Tiada tarikh 2', {})
      await mk('Draf', { action: 'draft' })
      await db.query(`insert into tournaments (title, education_level_id, format, question_mode, total_questions, time_window_minutes, top_n_scoring, min_participants, status, created_by, created_at)
        values ('Tamat', 'spm', 'knockout', 'subject', 10, 30, 5, 2, 'completed', $1, '2030-01-01'), ('Berlangsung', 'spm', 'knockout', 'subject', 10, 30, 5, 2, 'ongoing', $1, '2030-01-01')`, [admin.session.user.id])
      const student = clients.student as LoggedIn

      const banner = (await get(student, '/tournament/active')).body as unknown[]
      expect(Array.isArray(banner)).toBe(true)
      const items = banner.map((b) => BattleTournamentActiveSchema.parse(b))
      expect(items.map((i) => i.title)).toEqual(['Awal', 'Lewat', 'Tiada tarikh', 'Tiada tarikh 2', 'Berlangsung'])
      expect(items.every((i) => i.live_match === null)).toBe(true)
      expect(items.find((i) => i.uuid === early)?.status).toBe('registration')

      const list = (await get(student, '/tournaments')).body.data as unknown[]
      expect(list.map((l) => BattleTournamentListItemSchema.parse(l).uuid)).toEqual(items.map((i) => i.uuid))
      expect(Object.keys(list[0] as object).sort()).toEqual(['status', 'title', 'uuid'])
      void late
      void noDate
      void noDate2

      // Registration closed (clock past 2026-10-19T09:10 +08:00) -> ongoing, in banner and detail.
      clock.set('2026-10-19T09:11:00+08:00')
      const after = (await get(student, '/tournament/active')).body.map((b: unknown) => BattleTournamentActiveSchema.parse(b))
      expect(after.find((i: { uuid: string }) => i.uuid === early)?.status).toBe('ongoing')
      expect(BattleTournamentDetailSchema.parse((await get(student, `/tournaments/${early}`)).body.data).status).toBe('ongoing')
      expect(after.map((i: { title: string }) => i.title)).not.toContain('Draf')
      expect(after.map((i: { title: string }) => i.title)).not.toContain('Tamat')
      clock.set(START)
    })
  })

  describe('Mod Pelajar (is_test)', () => {
    it('a Mod Pelajar session acts as a student, so it cannot create; is_test rows are seen only by test sessions', async () => {
      await clear()
      const denied = await adminTest.post('/api/tournaments').set('X-CSRF-Token', adminTestCsrf).send({ ...VALID, subject_id: subjectIds[0] })
      error(denied, 403, 'FORBIDDEN', 'This action is unauthorized.')
      const [row] = await db.query<{ id: string }>(
        `insert into tournaments (title, education_level_id, format, question_mode, total_questions, time_window_minutes, top_n_scoring, min_participants, status, created_by, is_test)
         values ('Ujian', 'spm', 'knockout', 'subject', 10, 30, 5, 2, 'registration', $1, true) returning id`,
        [admin.session.user.id],
      )
      const id = row!.id
      expect(((await get(clients.student as LoggedIn, '/tournaments')).body.data as unknown[]).length).toBe(0)
      expect((await get(clients.student as LoggedIn, '/tournament/active')).body).toEqual([])
      error(await get(admin, `/tournaments/${id}`), 404, 'NOT_FOUND', 'Tournament tidak dijumpai.')
      expect(((await adminTest.get('/api/tournaments')).body.data as unknown[]).length).toBe(1)
      expect((await adminTest.get(`/api/tournaments/${id}`)).status).toBe(200)
    })
  })
})
