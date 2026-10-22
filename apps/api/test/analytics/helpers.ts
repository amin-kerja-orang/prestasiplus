import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { populationSeed } from '../../prisma/seed/core/population'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { ClassesModule } from '../../src/modules/classes'
import { AnalyticsReportsModule } from '../../src/modules/reports/analytics'
import { START } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'
import type { INestApplication } from '@nestjs/common'

export {
  ADMIN,
  SCHOOL_ADMIN_A,
  SCHOOL_ADMIN_B,
  STUDENT_1,
  STUDENT_2,
  STUDENT_B,
  STUDENT_MAJU,
  STUDENT_SUSPENDED,
  TEACHER_A,
  TEACHER_C,
  type Client,
  type World,
  addSession,
  buildWorld,
  client,
  errorIs,
  fieldsOf,
  idOfEmail,
  schoolOfCode,
} from '../kirkpatrick/helpers'
export { START }

export interface AnalyticsTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

/** Nest app with auth, classes and the M11 module on a private migrated and seeded database. */
export async function bootAnalyticsApp(opts: { env?: Record<string, string | undefined>; start?: string } = {}): Promise<AnalyticsTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, schoolsSeed, populationSeed, curriculumSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    IC_HASH_KEY: undefined,
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_ANALYTICS_READ_PER_MINUTE: '100000',
    THROTTLE_CLASSES_READ_PER_MINUTE: '100000',
    THROTTLE_CLASSES_WRITE_PER_MINUTE: '100000',
    PUBLIC_BASE_URL: 'https://app.example.test',
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    LOG_LEVEL: process.env.PP_TEST_LOG_LEVEL ?? process.env.LOG_LEVEL,
    ...opts.env,
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(opts.start ?? START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, ClassesModule, AnalyticsReportsModule])] })
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


export interface QuestionInput {
  stem: string
  subjectId: string
  chapterId?: string | null
  topicId?: string | null
  correct: 'A' | 'B' | 'C' | 'D'
  options?: [string, string, string, string]
  explanation?: string
  examType?: string
  year?: number
  difficulty?: number
}

/** One published objective question (one mcq leaf, four options and its key). Returns the question id. */
export async function addQuestion(db: TestDatabase, input: QuestionInput): Promise<string> {
  const question = await db.query<{ id: string }>(`insert into questions (latest_version_no, live_version_no, is_active) values (1, 1, true) returning id::text`)
  const questionId = (question[0] as { id: string }).id
  const version = await db.query<{ id: string }>(
    `insert into question_versions (question_id, version_no, status, published_at, type, stem_ms, explanation_ms, subject_id, chapter_id, topic_id, exam_type, year, difficulty_tp)
     values ($1, 1, 'published', now(), 'mcq', $2, $3, $4, $5, $6, $7, $8, $9) returning id::text`,
    [questionId, input.stem, input.explanation ?? null, input.subjectId, input.chapterId ?? null, input.topicId ?? null, input.examType ?? null, input.year ?? null, input.difficulty ?? null],
  )
  const versionId = (version[0] as { id: string }).id
  const part = await db.query<{ id: string }>(
    `insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode) values ($1, 1, 1, '1', 'prompt', 1, 'mcq') returning id::text`,
    [versionId],
  )
  const partId = (part[0] as { id: string }).id
  const texts = input.options ?? ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D']
  for (const [i, label] of ['A', 'B', 'C', 'D'].entries()) {
    await db.query(`insert into part_options (part_id, label, body_ms, position) values ($1, $2, $3, $4)`, [partId, label, texts[i], i + 1])
  }
  await db.query(`insert into answer_keys (part_id, kind, content) values ($1, 'option', $2::jsonb)`, [partId, JSON.stringify({ correct: input.correct })])
  return questionId
}

export interface SessionAnswer {
  questionId: string
  label: 'A' | 'B' | 'C' | 'D'
  correct: boolean
  chapterId?: string | null
  topicId?: string | null
  at?: string
}

/** A completed session with one answer per entry (question ids set), written straight into the tables. */
export async function addQuestionSession(
  db: TestDatabase,
  input: { userId: string; subjectId: string; at: string; mode?: string; answers: SessionAnswer[]; isTest?: boolean },
): Promise<string> {
  const correct = input.answers.filter((a) => a.correct).length
  const rows = await db.query<{ id: string }>(
    `insert into practice_sessions (user_id, mode, subject_id, question_count, status, correct_count, started_at, completed_at, is_test)
     values ($1, $2, $3, $4, 'completed', $5, $6::timestamptz, $6::timestamptz, $7) returning id::text`,
    [input.userId, input.mode ?? 'random', input.subjectId, input.answers.length, correct, input.at, input.isTest ?? false],
  )
  const id = (rows[0] as { id: string }).id
  for (const a of input.answers) {
    await db.query(
      `insert into practice_answers (session_id, user_id, question_id, question_version_no, subject_id, chapter_id, topic_id, selected_label, is_correct, answered_at, is_test)
       values ($1::uuid, $2, $3, 1, $4, $5, $6, $7, $8, $9::timestamptz, $10)`,
      [id, input.userId, a.questionId, input.subjectId, a.chapterId ?? null, a.topicId ?? null, a.label, a.correct, a.at ?? input.at, input.isTest ?? false],
    )
  }
  return id
}

/** A completed session of a given mode with no answer rows (the S1 report reads the session columns). */
export async function addModeSession(db: TestDatabase, input: { userId: string; subjectId: string; at: string; mode: string; questions: number; correct: number; isTest?: boolean }): Promise<void> {
  await db.query(
    `insert into practice_sessions (user_id, mode, subject_id, question_count, status, correct_count, started_at, completed_at, is_test)
     values ($1, $2, $3, $4, 'completed', $5, $6::timestamptz, $6::timestamptz, $7)`,
    [input.userId, input.mode, input.subjectId, input.questions, input.correct, input.at, input.isTest ?? false],
  )
}

export async function addFlag(db: TestDatabase, userId: string, level: 'review' | 'excluded'): Promise<void> {
  await db.query(`insert into monitoring_flags (user_id, level) values ($1, $2)`, [userId, level])
}

export async function addClass(db: TestDatabase, input: { name: string; teacherId: string; schoolId: string; subjectId?: string | null; members: string[] }): Promise<string> {
  const level = (await db.query<{ id: string }>(`select id::text from education_levels order by id limit 1`))[0] as { id: string }
  const rows = await db.query<{ id: string }>(
    `insert into classrooms (name, teacher_id, school_id, subject_id, education_level_id, academic_year) values ($1, $2, $3, $4, $5, 2026) returning id::text`,
    [input.name, input.teacherId, input.schoolId, input.subjectId ?? null, level.id],
  )
  const id = (rows[0] as { id: string }).id
  for (const m of input.members) await db.query(`insert into enrolments (classroom_id, student_id) values ($1, $2)`, [id, m])
  return id
}
