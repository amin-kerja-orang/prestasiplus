import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { HeatmapResponseSchema, type HeatmapResponse } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { expect } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { populationSeed } from '../../prisma/seed/core/population'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { CurriculumModule } from '../../src/modules/curriculum'
import { HeatmapModule, HeatmapPorts, type HeatmapAnswerCounts } from '../../src/modules/heatmap'
import { PracticeModule } from '../../src/modules/practice'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { type CurriculumTestApp, dropDatabase } from '../curriculum/helpers'

export { loginAs, expectError, type Client } from '../curriculum/helpers'
export { loginModPelajar } from '../practice/helpers'

export const START = '2026-10-19T09:00:00+08:00'
export const HEATMAP = '/api/buku-nota/heatmap'

export interface HeatmapBootOptions {
  env?: Record<string, string>
  /** A replacement answer-count source (plugged in before `app.init()`). */
  answerCounts?: HeatmapAnswerCounts
}

/** Nest app with auth, curriculum, practice and heatmap on a private migrated and seeded database. */
export async function bootHeatmapApp(opts: HeatmapBootOptions = {}): Promise<CurriculumTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed, populationSeed, curriculumSeed], { prisma: db.prisma })
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    THROTTLE_PRACTICE_READ_PER_MINUTE: '100000',
    ...opts.env,
  })
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule([AuthModule, CurriculumModule, PracticeModule, HeatmapModule])],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  if (opts.answerCounts) app.get(HeatmapPorts).provideAnswerCounts(opts.answerCounts)
  await app.init()
  return {
    app,
    db,
    clock,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await dropDatabase(db)
    },
  }
}

export async function userIdByEmail(db: TestDatabase, email: string): Promise<string> {
  const rows = await db.query<{ id: string }>('select id::text from users where lower(email) = lower($1)', [email])
  const id = rows[0]?.id
  if (!id) throw new Error(`user ${email} not found`)
  return id
}

let subjectSeq = 0

/** A fixture subject (unique code) with the given curriculum order; returns its id. */
export async function addSubject(db: TestDatabase, name: string, sortOrder: number, id?: string): Promise<string> {
  subjectSeq += 1
  const code = `HM${String(subjectSeq)}`
  const rows = id
    ? await db.query<{ id: string }>(
        `insert into subjects (id, code, name, name_en, color, sort_order) overriding system value values ($1::bigint, $2, $3, $3, '#4f46e5', $4) returning id::text`,
        [id, code, name, sortOrder],
      )
    : await db.query<{ id: string }>(
        `insert into subjects (code, name, name_en, color, sort_order) values ($1, $2, $2, '#4f46e5', $3) returning id::text`,
        [code, name, sortOrder],
      )
  return rows[0]?.id as string
}

/** A fixture in-tree chapter of `subjectId`; `id` forces the id (numeric-order tests). */
export async function addChapter(db: TestDatabase, subjectId: string, name: string, id?: string): Promise<string> {
  const rows = id
    ? await db.query<{ id: string }>(
        `insert into chapters (id, subject_id, education_level_id, name) overriding system value
         values ($1::bigint, $2::bigint, (select min(id) from education_levels), $3) returning id::text`,
        [id, subjectId, name],
      )
    : await db.query<{ id: string }>(
        `insert into chapters (subject_id, education_level_id, name)
         values ($1::bigint, (select min(id) from education_levels), $2) returning id::text`,
        [subjectId, name],
      )
  return rows[0]?.id as string
}

export interface AnswerSpec {
  /** Required: `ck_practice_answers_link` needs a question or a subject on every row. */
  subjectId: string
  chapterId: string | null
  attempts: number
  correct: number
  isTest?: boolean
  /** A question id written on every row (the question bank is never joined). */
  questionId?: string | null
}

/** Writes `attempts` answer rows for a user, the first `correct` of them right (BE-12 table, snapshot dimensions). */
export async function addAnswers(db: TestDatabase, userId: string, spec: AnswerSpec): Promise<void> {
  if (spec.attempts <= 0) return
  await db.query(
    `insert into practice_answers (user_id, question_id, subject_id, chapter_id, is_correct, answered_at, is_test)
     select $1::bigint, $2::bigint, $3::bigint, $4::bigint, g <= $6::int,
            timestamptz '2026-10-18 10:00+08' + (g || ' seconds')::interval, $7::boolean
       from generate_series(1, $5::int) g`,
    [userId, spec.questionId ?? null, spec.subjectId, spec.chapterId, spec.attempts, spec.correct, spec.isTest ?? false],
  )
}

export async function clearAnswers(db: TestDatabase, userId?: string): Promise<void> {
  if (userId) await db.query('delete from practice_answers where user_id = $1::bigint', [userId])
  else await db.query('delete from practice_answers')
}

/** GET the heatmap, assert 200, no-store and the contract schema; returns the parsed `data`. */
export async function heatmapOf(get: (url: string) => request.Test, url = HEATMAP): Promise<HeatmapResponse['data']> {
  const res = await get(url)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  expect(res.headers['cache-control']).toContain('no-store')
  return HeatmapResponseSchema.parse(res.body).data
}

/** Flattened cells as `[chapterId, attempts, correct, percent, band]`. */
export const cells = (data: HeatmapResponse['data']) =>
  data.subjects.flatMap((s) => s.topics.map((t) => [t.chapterId, t.attempts, t.correct, t.percent, t.band] as const))

export const sum = (xs: readonly { attempts: number; correct: number }[]) => ({
  attempts: xs.reduce((n, x) => n + x.attempts, 0),
  correct: xs.reduce((n, x) => n + x.correct, 0),
})
