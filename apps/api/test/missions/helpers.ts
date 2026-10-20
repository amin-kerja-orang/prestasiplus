import 'reflect-metadata'

import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { runSeeds, type SeedModule } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { populationSeed } from '../../prisma/seed/core/population'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { questionsSeed } from '../../prisma/seed/questions'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { ClassesModule, ClassesRepository } from '../../src/modules/classes'
import { MissionsModule } from '../../src/modules/classes/missions'
import { featureModules } from '../../src/modules'
import { QuestionsService } from '../../src/modules/questions'
import { START } from '../auth/helpers'
import { type ClassesTestApp, idOfEmail } from '../classes/helpers'
import { createTestDatabase } from '../support/db'
import { tagOf, type Tag } from '../questions/fixtures'

export { START } from '../auth/helpers'
export {
  ADMIN, SCHOOL_ADMIN, STUDENT_1, STUDENT_2, STUDENT_MAJU, STUDENT_OTHER_SCHOOL, TEACHER_A, TEACHER_B, TEACHER_C,
  client, errorIs, idOfEmail, type Client, type ClassesTestApp,
} from '../classes/helpers'

export interface MissionsTestApp extends ClassesTestApp {
  /** Everything the clock-driven tests need. */
  now(): Date
}

export interface BootOptions {
  env?: Record<string, string | undefined>
  /** Boot every registered feature module (the real application) instead of the three this half needs. */
  full?: boolean
  /** Runs after the app is created and before `app.init()` (plug a fake into a port). */
  beforeInit?: (app: INestApplication) => void
}

/** Nest app (auth, classes, missions; or every feature module) on a private migrated and seeded database. */
export async function bootMissionsApp(opts: BootOptions = {}): Promise<MissionsTestApp> {
  const db = await createTestDatabase()
  const seeds: SeedModule[] = [identitySeed, schoolsSeed, populationSeed, curriculumSeed, questionsSeed]
  await runSeeds(seeds, { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    IC_HASH_KEY: undefined,
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    THROTTLE_CLASSES_READ_PER_MINUTE: '100000',
    THROTTLE_CLASSES_WRITE_PER_MINUTE: '100000',
    THROTTLE_CLASS_JOIN_PER_MINUTE: '100000',
    PUBLIC_BASE_URL: 'https://app.example.test',
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    ...(opts.full ? { FILE_STORAGE_DIR: await mkdtemp(join(tmpdir(), 'pp-missions-')) } : {}),
    LOG_LEVEL: process.env.PP_TEST_LOG_LEVEL ?? process.env.LOG_LEVEL,
    ...opts.env,
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule(opts.full ? featureModules : [AuthModule, ClassesModule, MissionsModule])],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  opts.beforeInit?.(app)
  await app.init()
  return {
    app,
    db,
    clock,
    now: () => clock.now(),
    http: () => request(app.getHttpServer()) as never,
    agent: () => request.agent(app.getHttpServer()) as never,
    get: <T>(token: abstract new (...args: never[]) => T): T => app.get(token as never),
    async close() {
      await app.close()
      await db.drop()
    },
  }
}

/** Ids and tags every spec needs, read once after boot. */
export interface World {
  teacherA: string
  teacherC: string
  student1: string
  student2: string
  studentOther: string
  admin: string
  /** Subject, level, unit and SP of the seeded MATH Form 4 question. */
  tag: Tag
  subjectName: string
  subjectCode: string
}

export async function loadWorld(t: ClassesTestApp): Promise<World> {
  const tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  const subject = (await t.db.query<{ name: string; code: string }>(`select name, code from subjects where id = $1`, [tag.subjectId]))[0]
  return {
    teacherA: await idOfEmail(t, 'guru@demo.test'),
    teacherC: await idOfEmail(t, 'guru.demo002.01@example.test'),
    student1: await idOfEmail(t, 'pelajar@demo.test'),
    student2: await idOfEmail(t, 'pelajar2@demo.test'),
    studentOther: await idOfEmail(t, 'murid.demo002.01@example.test'),
    admin: await idOfEmail(t, 'admin@demo.test'),
    tag,
    subjectName: subject?.name ?? '',
    subjectCode: subject?.code ?? '',
  }
}

/** A class of `teacherId` with the given students actively enrolled (written through the BE-17 repository). */
export async function makeClass(t: ClassesTestApp, w: World, teacherId: string, studentIds: string[], name = 'Kelas Misi'): Promise<string> {
  const repo = t.get(ClassesRepository)
  const school = (await t.db.query<{ school_id: string | null }>(`select school_id::text from users where id = $1`, [teacherId]))[0]?.school_id ?? null
  const cls = await repo.createClass({
    name,
    teacherId,
    schoolId: school,
    subjectId: w.tag.subjectId,
    educationLevelId: w.tag.levelId,
    academicYear: 2026,
    description: null,
    now: new Date(START),
  })
  for (const studentId of studentIds) await repo.enrol({ classroomId: cls.id, studentId, source: 'teacher', now: new Date(START) })
  return cls.id
}

/** Creates a published, active MCQ with the world's tag (correct option B) through the BE-09 service; returns the id. */
export async function publishedMcq(t: ClassesTestApp, w: World, over: { spId?: string; text?: string } = {}): Promise<string> {
  const svc = t.get(QuestionsService)
  const tag = { ...w.tag, ...(over.spId ? { spId: over.spId } : {}) }
  const q = await svc.create(
    {
      subjectId: tag.subjectId,
      educationLevelId: tag.levelId,
      difficultyLevel: 3,
      questionText: over.text ?? 'Soalan misi: yang manakah jawapan yang betul?',
      questionType: 'mcq',
      options: ['Satu', 'Dua', 'Tiga', 'Empat'],
      correctAnswer: 1,
      tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 },
    } as never,
    { userId: w.admin, role: 'admin' },
  )
  for (const status of ['review', 'approved', 'published'] as const) await svc.bulkAction(status, [q.id], { userId: w.admin, role: 'admin' })
  return q.id
}

/** Inserts practice answers for `studentId` (oldest first at one-minute steps from `from`). */
export async function addAnswers(
  t: ClassesTestApp,
  w: World,
  studentId: string,
  rows: { questionId: string | null; correct: boolean; subjectId?: string; chapterId?: string | null; isTest?: boolean }[],
  from = new Date('2026-10-10T09:00:00+08:00'),
): Promise<void> {
  let i = 0
  for (const r of rows) {
    await t.db.query(
      `insert into practice_answers (user_id, question_id, question_version_no, subject_id, education_level_id, chapter_id, is_correct, answered_at, is_test)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [studentId, r.questionId, r.questionId ? 1 : null, r.subjectId ?? w.tag.subjectId, w.tag.levelId, r.chapterId ?? null, r.correct, new Date(from.getTime() + i * 60_000), r.isTest ?? false],
    )
    i++
  }
}

export interface MissionInit {
  teacherId: string
  recipients: string[]
  day?: string
  type?: 'latih_tubi' | 'tracking_a' | 'youtube'
  title?: string
  subjectId?: string
  chapterId?: string | null
  questionCount?: number
  isTest?: boolean
  createdAt?: string
  resource?: { title: string; url: string; note: string } | null
}

/** Inserts a mission and its recipient rows (mission create/list is not built; missions exist as rows). */
export async function insertMission(t: ClassesTestApp, w: World, init: MissionInit): Promise<string> {
  const row = (
    await t.db.query<{ id: string }>(
      `insert into missions (teacher_id, title, mission_type, mission_date, subject_id, chapter_id, question_count, resource_title, resource_url, resource_note, is_test, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id::text`,
      [
        init.teacherId,
        init.title ?? 'Misi Latih Tubi',
        init.type ?? 'latih_tubi',
        init.day ?? '2026-10-19',
        init.subjectId ?? w.tag.subjectId,
        init.chapterId ?? null,
        init.questionCount ?? 5,
        init.resource?.title ?? null,
        init.resource?.url ?? null,
        init.resource?.note ?? null,
        init.isTest ?? false,
        init.createdAt ?? START,
      ],
    )
  )[0] as { id: string }
  for (const studentId of init.recipients) await t.db.query(`insert into mission_items (mission_id, student_id) values ($1, $2)`, [row.id, studentId])
  return row.id
}

export interface RemedialInit {
  teacherId: string
  studentId: string
  subjectId?: string
  status?: 'active' | 'completed' | 'cancelled'
  before?: number
  after?: number | null
  questionIds?: string[]
  createdAt?: string
  isTest?: boolean
}

/** Inserts a remedial test with its ordered items (position 0..n-1, version 1). */
export async function insertRemedial(t: ClassesTestApp, w: World, init: RemedialInit): Promise<string> {
  const status = init.status ?? 'active'
  const ids = init.questionIds ?? []
  const row = (
    await t.db.query<{ id: string }>(
      `insert into remedial_tests (teacher_id, student_id, subject_id, total_questions, status, before_accuracy, after_accuracy, completed_at, is_test, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id::text`,
      [
        init.teacherId,
        init.studentId,
        init.subjectId ?? w.tag.subjectId,
        ids.length,
        status,
        init.before ?? 40,
        status === 'completed' ? (init.after ?? 70) : null,
        status === 'completed' ? START : null,
        init.isTest ?? false,
        init.createdAt ?? START,
      ],
    )
  )[0] as { id: string }
  let position = 0
  for (const questionId of ids) {
    await t.db.query(`insert into remedial_test_items (remedial_test_id, position, question_id, question_version_no) values ($1, $2, $3, 1)`, [row.id, position++, questionId])
  }
  return row.id
}

export const count = async (t: ClassesTestApp, sql: string, params: unknown[] = []): Promise<number> =>
  (await t.db.query<{ n: number }>(`select count(*)::int n from ${sql}`, params))[0]?.n ?? 0

export async function seededQuestionIds(t: ClassesTestApp): Promise<string[]> {
  return (await t.db.query<{ id: string }>(`select question_id::text id from question_versions where number_label like 'SEED-MCQ-%' order by question_id`)).map((r) => r.id)
}

/** Inserts a practice session linked to a mission or remedial test (the status source of `GET /missions/today`). */
export async function insertSession(
  t: ClassesTestApp,
  studentId: string,
  link: { missionId?: string; remedialTestId?: string },
  status: 'in_progress' | 'completed',
  isTest = false,
): Promise<void> {
  await t.db.query(
    `insert into practice_sessions (user_id, mode, mission_id, remedial_test_id, question_count, status, completed_at, started_at, is_test)
     values ($1, $2, $3, $4, 5, $5, $6, $7, $8)`,
    [studentId, link.missionId ? 'mission' : 'remedial', link.missionId ?? null, link.remedialTestId ?? null, status, status === 'completed' ? START : null, START, isTest],
  )
}

/** A draft MCQ with the world's tag (never eligible). */
export async function draftMcq(t: ClassesTestApp, w: World): Promise<string> {
  const q = await t.get(QuestionsService).create(
    { subjectId: w.tag.subjectId, educationLevelId: w.tag.levelId, difficultyLevel: 3, questionText: 'Soalan draf: tidak boleh dipilih?', questionType: 'mcq', options: ['Satu', 'Dua', 'Tiga', 'Empat'], correctAnswer: 1, tag: { unitId: w.tag.unitId, spIds: [w.tag.spId], tp: 3 } } as never,
    { userId: w.admin, role: 'admin' },
  )
  return q.id
}

/** Edits a published question and publishes the edit: the live version becomes 2. */
export async function republish(t: ClassesTestApp, w: World, id: string, text: string): Promise<void> {
  const svc = t.get(QuestionsService)
  const actor = { userId: w.admin, role: 'admin' } as const
  await svc.update(
    id,
    { subjectId: w.tag.subjectId, educationLevelId: w.tag.levelId, difficultyLevel: 3, questionText: text, questionType: 'mcq', options: ['Satu', 'Dua', 'Tiga', 'Empat'], correctAnswer: 1, tag: { unitId: w.tag.unitId, spIds: [w.tag.spId], tp: 3 } } as never,
    actor,
  )
  for (const status of ['review', 'approved', 'published'] as const) await svc.bulkAction(status, [id], actor)
}

/** Ids of the questions practice may serve now for the world's subject and level (published live version, active, mcq). */
export async function eligibleMcqIds(t: ClassesTestApp, w: World): Promise<string[]> {
  return (
    await t.db.query<{ id: string }>(
      `select q.id::text id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
        where q.is_active and v.status = 'published' and v.type = 'mcq' and v.subject_id = $1 and v.education_level_id = $2 order by q.id`,
      [w.tag.subjectId, w.tag.levelId],
    )
  ).map((r) => r.id)
}
