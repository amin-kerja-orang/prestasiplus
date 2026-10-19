import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { NotificationsModule, NotificationsService } from '../../src/modules/notifications'
import { START } from '../auth/helpers'
import { createTestDatabase } from '../support/db'
import type { UsersTestApp } from '../users/helpers'

export { ADMIN, STUDENT, TEACHER, apiOf, login } from '../users/helpers'
export { expectError, userIdOf } from '../auth/helpers'
export type { Api, UsersTestApp } from '../users/helpers'

export interface NotificationsTestApp extends UsersTestApp {
  service: NotificationsService
}

/** Nest app with the auth and notifications modules on a private migrated + identity-seeded database. */
export async function bootNotificationsApp(env: Record<string, string | undefined> = {}): Promise<NotificationsTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed], { prisma: db.prisma })
  const all: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_NOTIFICATION_READ_PER_MINUTE: '100000',
    THROTTLE_NOTIFICATION_WRITE_PER_MINUTE: '100000',
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
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, NotificationsModule])] })
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
    service: app.get(NotificationsService),
    http: () => request(app.getHttpServer()) as unknown as ReturnType<UsersTestApp['http']>,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}
