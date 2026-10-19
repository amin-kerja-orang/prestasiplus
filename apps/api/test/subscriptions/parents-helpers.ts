import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { CreatedUserSchema } from '@pp/contract'
import request from 'supertest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { ParentsModule } from '../../src/modules/parents'
import { UsersModule } from '../../src/modules/users'
import { START, loginAs, type LoggedIn } from '../auth/helpers'
import { createTestDatabase } from '../support/db'
import { apiOf, type Api, type UsersTestApp } from '../users/helpers'

export { ADMIN, SCHOOL_ADMIN, STUDENT, apiOf, login } from '../users/helpers'
export { expectError, schoolIdOf, userIdOf, type LoggedIn } from '../auth/helpers'
export type { Api, UsersTestApp }

/** Nest app with the auth, users and parents modules on a private migrated + seeded database. */
export async function bootParentsApp(env: Record<string, string | undefined> = {}, logStream?: NodeJS.WritableStream): Promise<UsersTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed], { prisma: db.prisma })
  const all: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    IC_HASH_KEY: undefined,
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_ADMIN_READ_PER_MINUTE: '100000',
    THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000',
    THROTTLE_PARENT_INVITE_PREVIEW_PER_MINUTE: '100000',
    THROTTLE_PARENT_INVITE_READ_PER_MINUTE: '100000',
    THROTTLE_PARENT_INVITE_ISSUE_PER_HOUR: '100000',
    THROTTLE_PARENT_INVITE_ACCEPT_PER_HOUR: '100000',
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    ...env,
  }
  for (const [k, v] of Object.entries(all)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, UsersModule, ParentsModule], logStream ? { logStream } : {})] })
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
    http: () => request(app.getHttpServer()) as unknown as ReturnType<UsersTestApp['http']>,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

/** Creates a parent through the admin API and logs it in with its generated password. */
export async function newParent(t: UsersTestApp, admin: Api, email: string, name = 'Ibu Ujian'): Promise<{ id: string; who: LoggedIn; api: Api }> {
  const res = await admin.post('/admin/users', { roles: ['parent'], name, email })
  const created = CreatedUserSchema.parse(res.body.data)
  const who = await loginAs(t as never, email, { password: created.generatedPassword })
  return { id: created.id, who, api: apiOf(who) }
}

/** Creates a student in a school through the admin API (no login). */
export async function newStudent(admin: Api, schoolId: string, email: string, name = 'Murid Ujian'): Promise<string> {
  const res = await admin.post('/admin/users', { roles: ['student'], name, email, schoolId, grade: 4 })
  return CreatedUserSchema.parse(res.body.data).id
}
