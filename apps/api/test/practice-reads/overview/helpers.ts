import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'

import { runSeeds, type SeedModule } from '../../../prisma/seed'
import { identitySeed } from '../../../prisma/seed/core/identity'
import { contentSeed } from '../../../prisma/seed/content'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import { walletSeed } from '../../../prisma/seed/wallet'
import { defineAppModule } from '../../../src/app.module'
import { configureApp } from '../../../src/configure-app'
import { CLOCK, FixedClock } from '../../../src/db/clock'
import { AuthModule } from '../../../src/modules/auth'
import { ContentArticlesModule } from '../../../src/modules/content/articles'
import { PracticeOverviewReadsModule } from '../../../src/modules/practice/reads/overview'
import { OVERVIEW_OPTIONS } from '../../../src/modules/practice/reads/overview/overview.service'
import { type CurriculumTestApp, dropDatabase, START } from '../../curriculum/helpers'
import { createTestDatabase, type TestDatabase } from '../../support/db'

export { chapterIdOf, dropDatabase, idOf, loginAs, type Client } from '../../curriculum/helpers'
export { START }

/** Nest app with auth, the overview reads module and the articles module on a private migrated and seeded database. */
export async function bootOverviewApp(opts: { withArticles?: boolean; bankTtlMs?: number; seeds?: SeedModule[] } = {}): Promise<CurriculumTestApp> {
  const db = await createTestDatabase()
  await runSeeds(opts.seeds ?? [identitySeed, curriculumSeed, walletSeed, contentSeed], { prisma: db.prisma })
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
  })
  const clock = new FixedClock(START)
  const modules = [AuthModule, PracticeOverviewReadsModule, ...(opts.withArticles === false ? [] : [ContentArticlesModule])]
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule(modules)] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(OVERVIEW_OPTIONS)
    .useValue({ bankTtlMs: opts.bankTtlMs ?? 0 })
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  return {
    app,
    db,
    clock,
    http: () => request(app.getHttpServer()) as never,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      await dropDatabase(db)
    },
  }
}

export async function userIdByEmail(db: TestDatabase, email: string): Promise<string> {
  const rows = await db.query<{ id: string }>('select id::text from users where email = $1', [email])
  if (!rows[0]) throw new Error(`no user ${email}`)
  return rows[0].id
}

export async function clearPractice(db: TestDatabase): Promise<void> {
  await db.query('delete from practice_sessions')
  await db.query('delete from practice_answers')
  await db.query('delete from revision_queue')
  await db.query('delete from mastery')
  await db.query('delete from subject_usage')
}

/** Removes every bank row this suite added (the seeds add none of the chapter questions). */
export async function clearBank(db: TestDatabase, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  await db.query('delete from questions where id = any($1::bigint[])', [ids])
}

export interface AnswerSeed {
  user: string
  question?: string | null
  subject?: string | null
  chapter?: string | null
  correct: boolean
  at: string
  session?: string | null
  isTest?: boolean
  historical?: boolean
}

export async function addAnswer(db: TestDatabase, a: AnswerSeed): Promise<void> {
  await db.query(
    `insert into practice_answers (user_id, session_id, question_id, subject_id, chapter_id, is_correct, answered_at, is_test, historical)
     values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9)`,
    [a.user, a.session ?? null, a.question ?? null, a.subject ?? null, a.chapter ?? null, a.correct, a.at, a.isTest ?? false, a.historical ?? false],
  )
}

export interface SessionSeed {
  user: string
  mode?: string
  subject?: string | null
  count: number
  correct: number
  completedAt: string | null
  status?: string
  isTest?: boolean
}

export async function addSession(db: TestDatabase, s: SessionSeed): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into practice_sessions (user_id, mode, subject_id, question_count, correct_count, status, started_at, completed_at, is_test)
     values ($1, $2, $3, $4, $5, $6, '2026-01-01T00:00:00Z', $7::timestamptz, $8) returning id::text`,
    [s.user, s.mode ?? 'random', s.subject ?? null, s.count, s.correct, s.status ?? 'completed', s.completedAt, s.isTest ?? false],
  )
  return rows[0]?.id as string
}

export interface QuestionSeed {
  active?: boolean
  status?: 'approved' | 'draft'
  type?: string
  subject?: string | null
  level?: string | null
  chapter?: string | null
  tp?: number | null
  stem?: string
}

/** A bank question with one live version. */
export async function addQuestion(db: TestDatabase, q: QuestionSeed = {}): Promise<string> {
  const rows = await db.query<{ id: string }>(`insert into questions (source_type, live_version_no, is_active) values ('manual', 1, $1) returning id::text`, [q.active ?? true])
  const id = rows[0]?.id as string
  await db.query(
    `insert into question_versions (question_id, version_no, status, type, stem_ms, subject_id, education_level_id, chapter_id, difficulty_tp, published_at)
     values ($1, 1, $2, $3, $4, $5, $6, $7, $8, case when $2 = 'approved' then now() else null end)`,
    [id, q.status ?? 'approved', q.type ?? 'mcq', q.stem ?? 'Soalan ujian', q.subject ?? null, q.level ?? null, q.chapter ?? null, q.tp === undefined ? 1 : q.tp],
  )
  return id
}

export async function queue(db: TestDatabase, user: string, question: string, subject: string): Promise<void> {
  await db.query(
    `insert into revision_queue (user_id, question_id, subject_id, wrong_times, last_wrong_at) values ($1, $2, $3, 1, '2026-10-18T10:00:00+08:00')`,
    [user, question, subject],
  )
}
