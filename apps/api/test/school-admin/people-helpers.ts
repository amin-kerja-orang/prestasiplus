import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { ErrorBodySchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { SchoolAdminModule } from '../../src/modules/school-admin'
import { UsersModule } from '../../src/modules/users'
import { loginAs, START, type LoggedIn } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'
import type { LogCapture } from '../support/app'
import type { SchoolAdminTestApp } from './helpers'

/**
 * Test kit of BE-21 Part A (teachers and pupils). Own boot (so a spec can capture the logs and set the throttles) next to the
 * shared `helpers.ts`, which it does not change. All data is fictitious.
 */

export interface PeopleBoot {
  env?: Record<string, string | undefined>
  logs?: LogCapture
}

export async function bootPeopleApp(opts: PeopleBoot = {}): Promise<SchoolAdminTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    // The ceilings are lifted unless a spec asks for a low one.
    THROTTLE_SCHOOL_ADMIN_READ_PER_MINUTE: '100000',
    THROTTLE_SCHOOL_ADMIN_WRITE_PER_MINUTE: '100000',
    THROTTLE_SCHOOL_ADMIN_CREATE_PER_MINUTE: '100000',
    THROTTLE_SCHOOL_ADMIN_RESET_PER_MINUTE: '100000',
    THROTTLE_SCHOOL_ADMIN_EXPORT_PER_MINUTE: '100000',
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    ...opts.env,
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule([AuthModule, UsersModule, SchoolAdminModule], opts.logs ? { logStream: opts.logs } : {})],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  return {
    app,
    db,
    clock,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

export interface PeopleApi {
  get(path: string): Promise<Response>
  post(path: string, body?: unknown, headers?: Record<string, string>): Promise<Response>
  put(path: string, body?: unknown): Promise<Response>
}

/** A logged-in client that sends the CSRF header on writes. */
export function peopleApiOf(who: LoggedIn): PeopleApi {
  return {
    get: (path) => who.agent.get(`/api${path}`),
    post: (path, body = {}, headers = {}) => who.agent.post(`/api${path}`).set('X-CSRF-Token', who.csrf).set(headers).send(body as object),
    put: (path, body = {}) => who.agent.put(`/api${path}`).set('X-CSRF-Token', who.csrf).send(body as object),
  }
}

export interface NewUser {
  name: string
  email: string | null
  roles: ('student' | 'teacher' | 'parent' | 'school_admin')[]
  schoolId: string | null
  isActive?: boolean
  isSuspended?: boolean
  grade?: number | null
  phone?: string | null
}

/** Inserts a user (no password: it cannot log in) with its roles. Returns the id. */
export async function insertUser(db: TestDatabase, u: NewUser): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into users (name, email, phone, school_id, grade, is_active, is_suspended, created_at, updated_at)
     values ($1, $2, $3, $4::bigint, $5, $6, $7, now(), now()) returning id::text`,
    [u.name, u.email, u.phone ?? null, u.schoolId, u.grade ?? null, u.isActive ?? true, u.isSuspended ?? false],
  )
  const id = rows[0]?.id as string
  for (const role of u.roles) await db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, $2, now())`, [id, role])
  return id
}

/** A school admin of another school: the demo school admin's password hash is copied, so it logs in with the demo password. */
export async function insertSchoolAdmin(db: TestDatabase, schoolId: string, email: string): Promise<string> {
  const id = await insertUser(db, { name: 'Admin Sekolah Dua', email, roles: ['school_admin'], schoolId })
  await db.query(`update users set password_hash = (select password_hash from users where lower(email) = 'adminsekolah@demo.test') where id = $1::bigint`, [id])
  return id
}

/** Logs in with an explicit password (the one-time credential of a created account, or one typed by the admin). */
export const loginWith = (t: SchoolAdminTestApp, identifier: string, password: string): Promise<LoggedIn> =>
  loginAs(t as unknown as Parameters<typeof loginAs>[0], identifier, { password })

/** Inserts a class (default kind `classroom`) and returns its id. The education level is created on first use. */
export async function insertClass(
  db: TestDatabase,
  c: { name: string; schoolId: string | null; teacherId?: string | null; isActive?: boolean; kind?: 'classroom' | 'school_class' },
): Promise<string> {
  const level = (await db.query<{ id: string }>(`select id::text from education_levels order by id limit 1`))[0]?.id
  const levelId =
    level ??
    ((
      await db.query<{ id: string }>(
        `insert into education_levels (code, name, name_en, stage, curriculum, grade) values ('T4', 'Tingkatan 4', 'Form 4', 'upper_secondary', 'KSSM', 10) returning id::text`,
      )
    )[0]?.id as string)
  const rows = await db.query<{ id: string }>(
    `insert into classrooms (kind, name, teacher_id, school_id, education_level_id, academic_year, is_active)
     values ($1, $2, $3::bigint, $4::bigint, $5::bigint, 2026, $6) returning id::text`,
    [c.kind ?? 'classroom', c.name, c.teacherId ?? null, c.schoolId, levelId, c.isActive ?? true],
  )
  return rows[0]?.id as string
}

export async function enrolIn(db: TestDatabase, classId: string, studentId: string, status: 'active' | 'removed' = 'active'): Promise<void> {
  await db.query(`insert into enrolments (classroom_id, student_id, status, source) values ($1::bigint, $2::bigint, $3, 'school_admin')`, [classId, studentId, status])
}

export const countOf = async (db: TestDatabase, sql: string, params: unknown[] = []): Promise<number> => Number((await db.query<{ n: string }>(sql, params))[0]?.n ?? 0)

/** The contract error body of a response, with the status checked. */
export function errorOf(res: Response, status: number, code: string, message?: string) {
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  const body = ErrorBodySchema.parse(res.body).error
  expect(body.code).toBe(code)
  if (message !== undefined) expect(body.message).toBe(message)
  return body
}

/** Both anti-cache headers of a credential or export answer. */
export function expectNoCache(res: Response, pragma = true): void {
  expect(res.headers['cache-control']).toBe('no-store')
  if (pragma) expect(res.headers.pragma).toBe('no-cache')
}

/** All audit rows of an action, newest first. */
export const auditRows = (db: TestDatabase, action: string) =>
  db.query<{ id: string; actor_user_id: string | null; actor_role: string | null; scope_school_id: string | null; target_type: string | null; target_id: string | null; detail: Record<string, unknown> | null; is_test: boolean; scope_level: string | null; request_id: string | null; ip_hash: string | null }>(
    `select id::text, actor_user_id::text, actor_role, scope_school_id::text, target_type, target_id, detail, is_test, scope_level, request_id, ip_hash
       from audit_events where action = $1 order by audit_events.id desc`,
    [action],
  )

/** A pupil/teacher user row as stored. */
export const userRow = async (db: TestDatabase, id: string) =>
  (
    await db.query<{ name: string; email: string | null; phone: string | null; school_id: string | null; is_active: boolean; password_hash: string | null; must_reset_password: boolean; created_by_id: string | null; grade: number | null; roles: string[] }>(
      `select u.name, u.email, u.phone, u.school_id::text, u.is_active, u.password_hash, u.must_reset_password, u.created_by_id::text, u.grade,
              coalesce((select array_agg(role order by role) from user_roles r where r.user_id = u.id), '{}') as roles
         from users u where u.id = $1::bigint`,
      [id],
    )
  )[0]

export const liveSessions = (db: TestDatabase, userId: string) =>
  countOf(db, `select count(*)::text as n from sessions where user_id = $1::bigint and revoked_at is null`, [userId])
