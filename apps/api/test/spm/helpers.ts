import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'

import { runSeeds, type SeedModule } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { questionsSeed } from '../../prisma/seed/questions'
import { spmSeed } from '../../prisma/seed/spm'
import { spmSubjectConfigsSeed } from '../../prisma/seed/spm-subject-configs'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { SpmModule, SpmPorts, type SpmStructuredAttemptSource, type SpmStructuredStats } from '../../src/modules/spm'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { dropDatabase, loginAs as loginWith, type Client } from '../curriculum/helpers'

export { dropDatabase, expectCsrfInvalid, expectError, idOf, parseData, type Client } from '../curriculum/helpers'

export const START = '2026-10-19T09:00:00+08:00'

export const ACCOUNTS = {
  admin: 'admin@demo.test',
  teacher: 'guru@demo.test',
  student: 'pelajar@demo.test',
  student2: 'pelajar2@demo.test',
  studentMaju: 'pelajarmaju@demo.test',
  schoolAdmin: 'adminsekolah@demo.test',
  teacherAdmin: 'guruadmin@demo.test',
} as const

/** Fake of the BE-13 structured-attempt source: attempts per user, summarised like the real adapter would. */
export class FakeAttempts implements SpmStructuredAttemptSource {
  readonly rows: { userId: string; subjectId: string; questionId: string; pct: number; isTest?: boolean }[] = []
  readonly calls: { userId: string; subjectIds: readonly string[]; includeTest: boolean }[] = []
  async statsFor(userId: string, subjectIds: readonly string[], options: { includeTest: boolean }): Promise<SpmStructuredStats> {
    this.calls.push({ userId, subjectIds, includeTest: options.includeTest })
    const own = this.rows.filter((r) => r.userId === userId && (options.includeTest || !r.isTest))
    return {
      setsAnswered: own.length,
      subjectsTried: new Set(own.map((r) => r.subjectId)).size,
      bestScore: own.length === 0 ? null : Math.round(Math.max(...own.map((r) => r.pct))),
      bestSetsSaved: new Set(own.map((r) => r.questionId)).size,
    }
  }
}

export interface SpmTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  attempts: FakeAttempts
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootOptions {
  db?: TestDatabase
  /** Seeds run after identity, curriculum and the question seed (default: the SPM seed). */
  seeds?: SeedModule[]
  env?: Record<string, string>
  /** Keep the real default of the structured-attempt port. */
  defaultAttempts?: boolean
}

/** Nest app with auth + the SPM module (and the curriculum, questions and practice it needs) on a seeded private database. */
export async function bootSpmApp(opts: BootOptions = {}): Promise<SpmTestApp> {
  const db = opts.db ?? (await createTestDatabase())
  if (!opts.db) await runSeeds([identitySeed, curriculumSeed, questionsSeed, ...(opts.seeds ?? [spmSubjectConfigsSeed, spmSeed])], { prisma: db.prisma })
  Object.assign(process.env, {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    // Counts must follow the bank at once, and the simulated delay is off.
    SPM_POOL_CACHE_SECONDS: '0',
    SPM_WALKTHROUGH_DELAY_MS: '0',
    // The clock is frozen, so a window never ends: lift the limits unless a test asks for a low one.
    THROTTLE_SPM_MOCK_CREATE_PER_MINUTE: '100000',
    THROTTLE_SPM_WALKTHROUGH_PER_MINUTE: '100000',
    ...opts.env,
  })
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, SpmModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  const attempts = new FakeAttempts()
  if (!opts.defaultAttempts) app.get(SpmPorts).provideStructuredAttempts(attempts)
  await app.init()
  return {
    app,
    db,
    clock,
    attempts,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()),
    async close() {
      await app.close()
      if (!opts.db) await dropDatabase(db)
    },
  }
}

export const loginAs = (t: SpmTestApp, role: keyof typeof ACCOUNTS): Promise<Client> => loginWith(t as never, ACCOUNTS[role])

/** Logs in and switches Mod Pelajar on; the CSRF token rotates with the session. */
export async function loginModPelajar(t: SpmTestApp, role: keyof typeof ACCOUNTS): Promise<Client> {
  const agent = t.agent()
  const login = await agent.post('/api/auth/login').send({ identifier: ACCOUNTS[role], password: 'Demo1234', remember: false })
  const first = login.body.data as { csrf: string; user: { id: string } }
  const mode = await agent.post('/api/session/mode').set('X-CSRF-Token', first.csrf).send({ mode: 'mod_pelajar' })
  if (mode.status !== 200) throw new Error(`mod_pelajar refused: ${JSON.stringify(mode.body)}`)
  const csrf = (mode.body.data as { csrf?: string }).csrf ?? first.csrf
  return {
    csrf,
    userId: first.user.id,
    get: (url) => agent.get(url),
    post: (url, body) => agent.post(url).set('X-CSRF-Token', csrf).send(body as object),
    put: (url, body) => agent.put(url).set('X-CSRF-Token', csrf).send(body as object),
    patch: (url, body) => agent.patch(url).set('X-CSRF-Token', csrf).send(body as object),
    delete: (url) => agent.delete(url).set('X-CSRF-Token', csrf),
    noCsrf: {
      post: (url, body) => agent.post(url).send(body as object),
      put: (url, body) => agent.put(url).send(body as object),
      patch: (url, body) => agent.patch(url).send(body as object),
      delete: (url) => agent.delete(url),
    },
  }
}

/* ------------------------------------------------------------------------------- bank fixtures */

export interface QInit {
  /** Subject code. */
  subject: string
  /** Level code (T4, T5). Default T4, or a non-offered secondary level when `pool` is false (R1-B06). */
  level?: string
  type?: 'mcq' | 'structured'
  /** Difficulty TP 1..6; null leaves it unset. */
  tp?: number | null
  pool?: boolean
  status?: 'approved' | 'draft'
  active?: boolean
  stem?: string
  /** Option letter of the key (mcq). */
  key?: string
  /** Chapter number of the subject and level, for the topic. */
  chapterNumber?: number
}

let counter = 0

/** Inserts one question (live version 1) with its part tree and returns its decimal id. */
export async function addQuestion(db: TestDatabase, q: QInit): Promise<string> {
  const n = ++counter
  const type = q.type ?? 'mcq'
  const status = q.status ?? 'approved'
  const subject = (await db.query<{ id: string }>('select id::text from subjects where code = $1', [q.subject]))[0]?.id
  // R1-B06: the SPM pool is defined by level (T4/T5), not by the `pool` tag. A multiple-choice question that must stay OUT of the
  // pool (`pool: false`) therefore sits at an active secondary level that is not offered (T1 to T3), unless a level is asked for.
  const outOfPool = type === 'mcq' && q.pool === false
  const nonOffered = outOfPool
    ? ((await db.query<{ code: string }>(`select code from education_levels where stage <> 'primary' and is_active and code not in ('T4','T5') order by sort_order, id limit 1`))[0]?.code ?? 'T4')
    : 'T4'
  const levelCode = q.level ?? nonOffered
  const level = (await db.query<{ id: string }>('select id::text from education_levels where code = $1', [levelCode]))[0]?.id
  if (!subject || !level) throw new Error('unknown subject or level')
  const chapter =
    q.chapterNumber === undefined
      ? null
      : (await db.query<{ id: string }>('select id::text from chapters where subject_id = $1 and education_level_id = $2 and chapter_number = $3 and in_tree order by id limit 1', [subject, level, q.chapterNumber]))[0]?.id ?? null
  const qid = (
    await db.query<{ id: string }>(
      `insert into questions (source_type, latest_version_no, live_version_no, is_active) values ('manual', 1, $1, $2) returning id::text`,
      [status === 'approved' ? 1 : null, q.active ?? true],
    )
  )[0]?.id as string
  const vid = (
    await db.query<{ id: string }>(
      `insert into question_versions (question_id, version_no, status, type, stem_ms, subject_id, education_level_id, chapter_id, difficulty_tp, form_origin, number_label, language, published_at)
       values ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ms', $11) returning id::text`,
      [qid, status, type, q.stem ?? `Soalan ujian SPM ${String(n)}`, subject, level, chapter, q.tp === undefined ? 2 : q.tp, levelCode === 'T5' ? 't5' : 't4', `SPMT-${String(n)}`, status === 'approved' ? '2026-10-01T00:00:00Z' : null],
    )
  )[0]?.id as string
  if (type === 'mcq') {
    const pid = (
      await db.query<{ id: string }>(
        `insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode) values ($1, 1, 1, 'a', $2, 1, 'mcq') returning id::text`,
        [vid, q.stem ?? `Soalan ujian SPM ${String(n)}`],
      )
    )[0]?.id as string
    for (const [i, label] of ['A', 'B', 'C', 'D'].entries()) {
      await db.query(`insert into part_options (part_id, label, body_ms, position) values ($1, $2, $3, $4)`, [pid, label, `Pilihan ${label} ${String(n)}`, i + 1])
    }
    await db.query(`insert into answer_keys (part_id, kind, content) values ($1, 'option', $2::jsonb)`, [pid, JSON.stringify({ kind: 'option', correct: q.key ?? 'B' })])
  } else {
    for (const [i, label] of ['a', 'b'].entries()) {
      const pid = (
        await db.query<{ id: string }>(
          `insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode) values ($1, $2, 1, $3, $4, 4, 'working') returning id::text`,
          [vid, i + 1, label, `Bahagian ${label} soalan ${String(n)}`],
        )
      )[0]?.id as string
      const key = { kind: 'points', marks: 4, points: [{ id: 'p1', code: 'M', label: 'Kaedah', marks: 4 }], modelText: `Model jawapan ${label} ${String(n)}` }
      await db.query(`insert into answer_keys (part_id, kind, content) values ($1, 'points', $2::jsonb)`, [pid, JSON.stringify(key)])
    }
  }
  if (q.pool ?? type === 'mcq') await db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pool', 'spm')`, [qid])
  return qid
}

/** `n` pool multiple-choice questions of a subject, difficulty cycling 1..4, levels alternating T4 and T5 when asked. */
export async function addPool(db: TestDatabase, subject: string, n: number, extra: Partial<QInit> = {}): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    ids.push(await addQuestion(db, { subject, tp: (i % 4) + 1, level: i % 2 === 0 ? 'T4' : 'T5', ...extra }))
  }
  return ids
}

/** Creates a Tracking A set of year 2026 (or `year`) with the given questions in order. */
export async function addSet(db: TestDatabase, subject: string, setNo: number, questionIds: readonly string[], opts: { year?: number; dskpTagged?: number } = {}): Promise<void> {
  const sid = (await db.query<{ id: string }>('select id::text from subjects where code = $1', [subject]))[0]?.id as string
  const set = (
    await db.query<{ id: string }>(
      `insert into spm_tracking_sets (subject_id, year, set_no, dskp_tagged) values ($1, $2, $3, $4) returning id::text`,
      [sid, opts.year ?? 2026, setNo, opts.dskpTagged ?? questionIds.length],
    )
  )[0]?.id as string
  for (const [i, qid] of questionIds.entries()) {
    await db.query('insert into spm_tracking_set_questions (set_id, question_id, position) values ($1, $2, $3)', [set, qid, i + 1])
  }
}

export const countRows = async (db: TestDatabase, table: string, where = 'true', params: unknown[] = []): Promise<number> =>
  Number((await db.query<{ n: string }>(`select count(*)::text as n from ${table} where ${where}`, params))[0]?.n)

/** Empties the pool-related tables the SPM tests fill (the seeded demo bank stays). */
export async function resetSpmData(db: TestDatabase): Promise<void> {
  await db.query('delete from spm_mock_exams')
  await db.query('delete from spm_tracking_sets')
}

/** Walks a value and returns every key path whose key matches `re`. */
export function keyPaths(value: unknown, re: RegExp, path = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => keyPaths(v, re, `${path}[${String(i)}]`))
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [...(re.test(k) ? [`${path}.${k}`] : []), ...keyPaths(v, re, `${path}.${k}`)])
  }
  return []
}

/** A logged-in agent and its CSRF token, for multipart requests (the `Client` helper sends JSON only). */
export async function loginAgent(t: SpmTestApp, role: keyof typeof ACCOUNTS): Promise<{ agent: TestAgent; csrf: string }> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier: ACCOUNTS[role], password: 'Demo1234', remember: false })
  if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.body)}`)
  return { agent: agent as unknown as TestAgent, csrf: (res.body.data as { csrf: string }).csrf }
}
