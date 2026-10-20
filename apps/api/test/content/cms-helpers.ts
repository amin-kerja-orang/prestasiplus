import 'reflect-metadata'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Test } from '@nestjs/testing'
import { ErrorBodySchema } from '@pp/contract'
import request from 'supertest'
import type { Response } from 'supertest'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { ContentArticlesModule } from '../../src/modules/content/articles'
import { START, loginAs } from '../auth/helpers'
import { createTestDatabase } from '../support/db'
import { apiOf, type Api, type UsersTestApp } from '../users/helpers'

export { ADMIN, SCHOOL_ADMIN, STUDENT, TEACHER, apiOf, expectError, fieldsOf, userIdOf, type Api } from '../users/helpers'
export { START } from '../auth/helpers'

export interface CmsApp extends UsersTestApp {
  dir: string
}

/** Nest app with auth + the BE-24 part A modules (articles, banners, notes, screenshots, files) on a private seeded database. */
export async function bootCmsApp(env: Record<string, string | undefined> = {}): Promise<CmsApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed], { prisma: db.prisma })
  const dir = await mkdtemp(join(tmpdir(), 'pp-cms-test-'))
  const all: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_PUBLIC_SEARCH_PER_MINUTE: '100000',
    THROTTLE_ADMIN_READ_PER_MINUTE: '100000',
    THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000',
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    FILE_STORAGE_DIR: dir,
    PUBLIC_ORIGINS: 'https://app.example',
    UPLOAD_RATE_PER_MINUTE: '1000',
    FILE_READS_PER_MINUTE: '10000',
    ...env,
  }
  for (const [k, v] of Object.entries(all)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, ContentArticlesModule])] })
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
    dir,
    http: () => request(app.getHttpServer()) as unknown as ReturnType<UsersTestApp['http']>,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await db.drop()
      await rm(dir, { recursive: true, force: true })
    },
  }
}

export async function apiFor(t: CmsApp, identifier: string): Promise<Api & { agent: ReturnType<CmsApp['agent']>; csrf: string }> {
  const who = await loginAs(t as never, identifier)
  return { ...apiOf(who), agent: who.agent as never, csrf: who.csrf }
}

/** Reads the error body of a response and checks its status, code and optional exact message. */
export function errorOf(res: Response, status: number, code: string, message?: string): { code: string; message: string; fields?: Record<string, string> | undefined } {
  const body = ErrorBodySchema.parse(res.body).error
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  expect(body.code).toBe(code)
  if (message !== undefined) expect(body.message).toBe(message)
  return body
}

export const FUTURE = '2030-01-01T00:00:00Z'

/** Inserts an article straight into the table; returns its id. */
export async function insertArticle(
  t: CmsApp,
  o: { title: string; slug: string; published?: boolean; featured?: boolean; category?: string; views?: number; content?: string; publishedAt?: string | null; authorEmail?: string },
): Promise<string> {
  const published = o.published ?? true
  const [r] = await t.db.query<{ id: string }>(
    `insert into articles (title, slug, content, category, is_published, is_featured, views, published_at, author_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, (select id from users where lower(email) = lower($9))) returning id::text`,
    [
      o.title,
      o.slug,
      o.content ?? '<p>isi</p>',
      o.category ?? 'UMUM',
      published,
      o.featured ?? false,
      o.views ?? 0,
      published ? (o.publishedAt === undefined ? '2026-10-01T00:00:00Z' : o.publishedAt) : null,
      o.authorEmail ?? 'admin@demo.test',
    ],
  )
  return r?.id as string
}

export const articleBody = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: 'Tip Belajar Ujian',
  excerpt: 'Ringkasan ujian',
  content: '<p>Kandungan <b>HTML</b></p>',
  category: 'TIPS_BELAJAR',
  gradeLevel: 'DARJAH_4',
  isPublished: true,
  isFeatured: false,
  ...over,
})
