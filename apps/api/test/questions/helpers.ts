import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { questionsSeed } from '../../prisma/seed/questions'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { CurriculumModule } from '../../src/modules/curriculum'
import { QuestionsModule } from '../../src/modules/questions'
import { QuestionWorkflowModule } from '../../src/modules/questions/workflow'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { dropDatabase, loginAs as loginWithIdentifier, type Client } from '../curriculum/helpers'

export {
  DEMO_PASSWORD, START, count, dropDatabase, expectCsrfInvalid, expectError, parseData, parseList,
  type Client,
} from '../curriculum/helpers'

/** Demo accounts of the identity seed (docs/AKAUN-DEMO.md) by role. */
export const ACCOUNTS = {
  admin: 'admin@demo.test',
  teacher: 'guru@demo.test',
  /** A second teacher (also school admin): another owner for Guru visibility tests. */
  teacher2: 'guruadmin@demo.test',
  student: 'pelajar@demo.test',
  schoolAdmin: 'adminsekolah@demo.test',
} as const
export type AccountRole = keyof typeof ACCOUNTS

export interface QuestionsTestApp {
  app: import('@nestjs/common').INestApplication
  db: TestDatabase
  clock: FixedClock
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

/**
 * Nest app with the auth, curriculum and questions modules on a private migrated database seeded with
 * identity, curriculum and questions. Pass `db` to share a database; the caller then drops it. `withWorkflow` also mounts the question workflow module
 * (`POST /questions/:id/status`, listed before the bank as in `featureModules`).
 */
export async function bootQuestionsApp(opts: { db?: TestDatabase; withWorkflow?: boolean } = {}): Promise<QuestionsTestApp> {
  const db = opts.db ?? (await createTestDatabase())
  if (!opts.db) await runSeeds([identitySeed, curriculumSeed, questionsSeed], { prisma: db.prisma })
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
  })
  const clock = new FixedClock('2026-10-19T09:00:00+08:00')
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule(opts.withWorkflow ? [AuthModule, CurriculumModule, QuestionWorkflowModule, QuestionsModule] : [AuthModule, CurriculumModule, QuestionsModule])] })
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
      if (!opts.db) await dropDatabase(db)
    },
  }
}

/** Logs in as a demo role; mutating calls carry the CSRF token (`client.csrf`). */
export function loginAs(t: QuestionsTestApp, role: AccountRole): Promise<Client> {
  return loginWithIdentifier(t as never, ACCOUNTS[role])
}

/** The header name and value to send by hand on a mutating request. */
export const csrfHeader = (client: Client): Record<string, string> => ({ 'X-CSRF-Token': client.csrf })

/** Decimal-string id of a seeded question by its `number_label` (see prisma/seed/questions). */
export async function questionIdOf(db: TestDatabase, ref: string): Promise<string> {
  const rows = await db.query<{ id: string }>(`select question_id::text as id from question_versions where number_label = $1`, [ref])
  const row = rows[0]
  if (!row) throw new Error(`seeded question ${ref} not found`)
  return row.id
}

/**
 * A valid body of the teacher form `POST /api/guru/questions` (S6-T06, API-GUR-18) for the seeded MATH Tingkatan 4: the Bab, SP, TP and Aras
 * are added where the seed has chapters or DSKP nodes (the conditional rule of D112), so the body passes whatever the seed holds.
 */
export async function guruFormBody(t: Pick<QuestionsTestApp, 'db'>, over: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const q = async (sql: string) => (await t.db.query<{ id: string }>(sql))[0]?.id
  const subject = (typeof over.subjectId === 'string' ? over.subjectId : await q(`select id::text id from subjects where code = 'MATH'`)) as string
  const level = (typeof over.educationLevelId === 'string' ? over.educationLevelId : await q(`select id::text id from education_levels where code = 'T4'`)) as string
  const chapter = await q(`select id::text id from chapters where subject_id = ${subject} and education_level_id = ${level} and is_active and in_tree order by id limit 1`)
  const sp = await q(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by id limit 1`)
  return {
    subjectId: subject,
    educationLevelId: level,
    questionType: 'mcq',
    difficultyLevel: 3,
    questionText: 'Soalan guru untuk ujian?',
    options: ['1', '2', '3', '4'],
    correctAnswer: 1,
    ...(chapter === undefined ? {} : { chapterId: chapter }),
    ...(sp === undefined ? {} : { spIds: [sp], tp: 3, cognitiveLevel: 'memahami' }),
    ...over,
  }
}

/**
 * A question row OWNED by a teacher and saved as `review`, through the question service (what `POST /api/guru/questions` made before S6-T06,
 * when a submission was a question row; it is an intake item now). `body` is the admin create body (`mcqBody` shape); `status` defaults to `review`.
 */
export async function teacherQuestion(t: Pick<QuestionsTestApp, 'app'>, ownerUserId: string, body: Record<string, unknown>, status: 'draft' | 'review' = 'review'): Promise<string> {
  const { QuestionsService } = await import('../../src/modules/questions')
  const svc = t.app.get(QuestionsService, { strict: false })
  const created = await svc.create({ ...body, status } as never, { userId: ownerUserId, role: 'teacher' })
  return created.id
}
