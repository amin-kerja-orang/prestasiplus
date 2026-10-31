/**
 * R1 T44: PIPE AC-06.5 and AC-06.6 on the real application (every feature module, a migrated Testcontainers database, HTTP only).
 *
 *  - AC-06.5 "a null blueprint value never fails conformance": the seeded MAT kertas 2 contract has no profile, quota, KBAT marks
 *    or T4:T5 share. A curated paper built on it publishes with no blocker, no note and no "Blueprint perlu semakan" flag.
 *  - AC-06.6 "a curated or official Kertas Pilihan that misses quota/profile/KBAT is never blocked; the blueprint is flagged
 *    'Blueprint perlu semakan'" (v2-bijak-spm AC-26.7, architecture 6.3a): once the head contract states a quota and KBAT marks the
 *    published paper does not meet, `GET /admin/blueprints/MAT/2` says `needsReview` with the paper and its gaps, a further paper still
 *    publishes (with the flag in its result), and the flag clears when the contract no longer states the mismatching values.
 */
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { BIJAK_STANDARDS_MESSAGES, SessionSchema } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { walletTiersSeed } from '../../prisma/seed/core/wallet-tiers'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { examSeed } from '../../prisma/seed/exam'
import { spmSubjectConfigsSeed } from '../../prisma/seed/spm-subject-configs'
import { walletSeed } from '../../prisma/seed/wallet'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { featureModules } from '../../src/modules'
import { createTestDatabase, type TestDatabase } from '../support/db'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

const START = '2026-10-19T09:00:00+08:00'

let app: INestApplication
let db: TestDatabase
let admin: { csrf: string; get(u: string): request.Test; post(u: string, b?: unknown): request.Test; put(u: string, b?: unknown): request.Test }

const one = async (sql: string, params: unknown[] = []): Promise<string> => String((await db.query<Record<string, string>>(sql, params))[0]?.id)

const fx = { subject: '', level: '', units: [] as string[], sp: '', a: [] as string[], b: '', c: [] as string[] }

beforeAll(async () => {
  db = await createTestDatabase()
  await runSeeds([identitySeed, walletTiersSeed, curriculumSeed, examSeed, walletSeed, spmSubjectConfigsSeed], { prisma: db.prisma })
  const env: Record<string, string> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    FILE_STORAGE_DIR: await mkdtemp(join(tmpdir(), 'pp-flag-')),
    UPLOAD_RATE_PER_MINUTE: '1000',
    FILE_READS_PER_MINUTE: '10000',
    BIJAK_POC_QUESTIONS: 'false',
    SPM_POOL_CACHE_SECONDS: '0',
    THROTTLE_BIJAK_PAPERS_READ_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_READ_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_WRITE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_GENERATE_PER_MINUTE: '100000',
    BIJAK_SWEEP_INTERVAL_SECONDS: '0',
  }
  for (const [k, v] of Object.entries(env)) process.env[k] = v
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule(featureModules)] })
    .overrideProvider(CLOCK)
    .useValue(new FixedClock(START))
    .compile()
  app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()

  const agent = request.agent(app.getHttpServer()) as unknown as TestAgent
  const res = await agent.post('/api/auth/login').send({ identifier: 'admin@demo.test', password: 'Demo1234', remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const csrf = SessionSchema.parse(res.body.data).csrf
  admin = {
    csrf,
    get: (u) => agent.get(u),
    post: (u, b) => (b === undefined ? agent.post(u).set('X-CSRF-Token', csrf) : agent.post(u).set('X-CSRF-Token', csrf).send(b as object)),
    put: (u, b) => agent.put(u).set('X-CSRF-Token', csrf).send(b as object),
  }

  fx.subject = await one(`select id::text id from subjects where code = 'MATH'`)
  fx.level = await one(`select id::text id from education_levels where code = 'T4'`)
  const units = await db.query<{ id: string }>(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = $1 and education_level_id = $2 order by sort_order, id limit 2`, [fx.subject, fx.level])
  fx.units = units.map((u) => u.id)
  fx.sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = $1 and education_level_id = $2 order by sort_order, id limit 1`, [fx.subject, fx.level])
  // MAT kertas 2 (seed): A 3 x 1 mark, B 1 x 1 mark, C choose 1 of 2 (2 marks each). Every question sits in the first unit.
  const mk = async (text: string, extra: Record<string, unknown> = {}): Promise<string> => {
    const r = await admin.post('/api/questions', {
      subjectId: fx.subject,
      educationLevelId: fx.level,
      difficultyLevel: 3,
      questionType: 'mcq',
      questionText: text,
      options: ['3', '4', '5', '6'],
      correctAnswer: 1,
      explanation: 'Penjelasan ujian.',
      kertas: '2',
      tag: { unitId: fx.units[0], spIds: [fx.sp], tp: 3 },
      ...extra,
    })
    expect(r.status, JSON.stringify(r.body)).toBe(201)
    return r.body.data.id as string
  }
  fx.a = [await mk('Soalan A satu: berapakah 1 + 2?'), await mk('Soalan A dua: berapakah 2 + 2?'), await mk('Soalan A tiga: berapakah 3 + 2?')]
  fx.b = await mk('Soalan B: berapakah 4 + 2?')
  fx.c = [await mk('Soalan C satu: berapakah 5 + 2?', { pointsValue: 2 }), await mk('Soalan C dua: berapakah 6 + 2?', { pointsValue: 2 })]
  // The section pools (Bahagian A/B/C of the contract) are tag rows, as the Studio writes them.
  for (const [ids, pool] of [[fx.a, 'MAT2-A'], [[fx.b], 'MAT2-B'], [fx.c, 'MAT2-C']] as const)
    for (const id of ids) await db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pool', $2)`, [id, pool])
  const all = [...fx.a, fx.b, ...fx.c]
  for (const action of ['review', 'approved']) {
    const r = await admin.post('/api/questions/bulk-action', { action, ids: all })
    expect(r.status, JSON.stringify(r.body)).toBe(200)
  }
}, 600_000)

afterAll(async () => {
  await app?.close()
  await db?.drop()
})

/** A new paper on MAT kertas 2 filled with the fixture questions, then published. Returns the publish response data. */
async function publishedPaper(title: string): Promise<{ id: string; publish: Record<string, unknown> }> {
  const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2, title })
  expect(created.status, JSON.stringify(created.body)).toBe(201)
  const id = created.body.data.id as string
  const sections = (((await admin.get(`/api/admin/papers/${id}`)).body.data.paper.sections) as { id: string }[]).map((s) => s.id)
  const fill = await admin.put(`/api/admin/papers/${id}`, {
    sections: [
      { id: sections[0], questionIds: fx.a },
      { id: sections[1], questionIds: [fx.b] },
      { id: sections[2], questionIds: fx.c },
    ],
  })
  expect(fill.status, JSON.stringify(fill.body)).toBe(200)
  const pub = await admin.post(`/api/admin/papers/${id}/publish`)
  expect(pub.status, JSON.stringify(pub.body)).toBe(200)
  return { id, publish: pub.body.data as Record<string, unknown> }
}

const blueprint = async () => (await admin.get('/api/admin/blueprints/MAT/2')).body.data as Record<string, any>

/** A new version of MAT kertas 2 that keeps the structure and sets the given standard fields on section A and the paper. */
async function saveVersion(code: string, standard: { quota?: unknown; kbatMarks?: number; autoMarkable?: boolean } | null) {
  const head = await blueprint()
  const sections = (head.sections as Record<string, any>[]).map((s, i) => ({
    label: s.label,
    markBudget: s.markBudget,
    questionCount: s.questionCount,
    rule: s.rule,
    ...(s.pool ? { pool: s.pool } : {}),
    ...(i === 0 && standard?.quota ? { quota: standard.quota } : {}),
    ...(i === 0 && standard?.kbatMarks !== undefined ? { kbatMarks: standard.kbatMarks } : {}),
  }))
  const res = await admin.post('/api/admin/blueprints/MAT/2/versions', { source: 'Spec', code, durationMin: head.durationMin, ...(standard?.autoMarkable !== undefined ? { autoMarkable: standard.autoMarkable } : {}), sections })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body.data as Record<string, any>
}

describe('PIPE AC-06.5: a null blueprint value never fails conformance', () => {
  let first: { id: string; publish: Record<string, unknown> }

  it('the seeded contract states no profile, quota, KBAT marks, share or Boleh tanda auto (all null)', async () => {
    const head = await blueprint()
    expect(head).toMatchObject({ kbatMarks: null, levelShare: null, autoMarkable: null, needsReview: false, reviewPapers: [] })
    for (const s of head.sections as Record<string, unknown>[]) expect(s).toMatchObject({ profile: null, quota: null, kbatMarks: null })
  })

  it('a curated paper on it publishes: no blocker, no note, no "needs review" flag', async () => {
    first = await publishedPaper('Percubaan satu')
    expect(first.publish).toMatchObject({ ok: true, errors: [] })
    expect(first.publish.notes ?? []).toEqual([])
    expect(first.publish.blueprintNeedsReview).toBeUndefined()
  })

  it('the blueprint is not flagged although a published paper depends on it', async () => {
    const head = await blueprint()
    expect(head.dependentPaperCount).toBeGreaterThanOrEqual(1)
    expect(head).toMatchObject({ needsReview: false, reviewPapers: [] })
  })
})

describe('PIPE AC-06.6: a curated paper that misses quota/KBAT is never blocked; the blueprint is flagged', () => {
  it('the flag text is "Blueprint perlu semakan"', () => {
    expect(BIJAK_STANDARDS_MESSAGES.needsReview).toBe('Blueprint perlu semakan')
  })

  it('stating a quota and KBAT marks the published paper does not meet flags the blueprint, listing the paper and its gaps', async () => {
    const publishedBefore = await one(`select count(*)::text id from papers where kind = 'pilihan' and status = 'published'`)
    const quota = { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: fx.units[0] }, value: 1 }, { unit: { kind: 'unit', nodeId: fx.units[1] }, value: 2 }] }
    const saved = await saveVersion('MAT/2-R', { quota, kbatMarks: 3, autoMarkable: true })
    expect(saved).toMatchObject({ version: 2, autoMarkable: true })
    const head = await blueprint()
    expect(head.needsReview).toBe(true)
    expect(head.reviewPapers).toHaveLength(1)
    expect(head.reviewPapers[0]).toMatchObject({ title: 'Percubaan satu' })
    expect(head.reviewPapers[0].gaps).toEqual(expect.arrayContaining(['quota', 'kbat']))
    // the flag is informational: it changes neither the status nor the paper
    expect(head.source).toBe('Spec')
    expect(await one(`select count(*)::text id from papers where kind = 'pilihan' and status = 'published'`)).toBe(publishedBefore)
  })

  it('the list shows the same flag', async () => {
    const list = await admin.get('/api/admin/blueprints')
    expect(list.status, JSON.stringify(list.body)).toBe(200)
    const mat2 = (list.body.data as Record<string, any>[]).find((b) => b.subject === 'MAT' && b.kertas === 2)
    expect(mat2).toMatchObject({ needsReview: true })
  })

  it('another curated paper still publishes (never blocked) and its result carries the flag and notes', async () => {
    const second = await publishedPaper('Percubaan dua')
    expect(second.publish).toMatchObject({ ok: true, errors: [], blueprintNeedsReview: true })
    expect((second.publish.notes as string[]).length).toBeGreaterThan(0)
    const head = await blueprint()
    expect(head.reviewPapers.map((p: { title: string }) => p.title).sort()).toEqual(['Percubaan dua', 'Percubaan satu'])
  })

  it('the flag clears when the contract no longer states the mismatching values (computed, never stored)', async () => {
    await saveVersion('MAT/2-S', null)
    const head = await blueprint()
    expect(head).toMatchObject({ version: 3, needsReview: false, reviewPapers: [], autoMarkable: null })
  })
})
