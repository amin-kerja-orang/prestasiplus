import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../../prisma/seed'
import { identitySeed } from '../../../prisma/seed/core/identity'
import { contentSeed } from '../../../prisma/seed/content'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import { walletSeed } from '../../../prisma/seed/wallet'
import { defineAppModule } from '../../../src/app.module'
import { configureApp } from '../../../src/configure-app'
import { CLOCK, FixedClock } from '../../../src/db/clock'
import { AuthModule } from '../../../src/modules/auth'
import { PracticeQuestionsBridgeModule } from '../../../src/modules/practice/question-bridge'
import { PracticeOverviewReadsModule } from '../../../src/modules/practice/reads/overview'
import { OVERVIEW_OPTIONS } from '../../../src/modules/practice/reads/overview/overview.service'
import { QuestionsService } from '../../../src/modules/questions'
import { type Client, type CurriculumTestApp, dropDatabase, idOf, loginAs, START } from '../../curriculum/helpers'
import { createTestDatabase } from '../../support/db'

/**
 * AC-X3-1 [CI] (S4-T06, D101): Bab mode ("Soalan by Chapter") serves a T1 pupil exactly as it serves a T5 pupil.
 * One app with the REAL question bank bound to the practice start (the bridge), approved servable MCQs created through
 * the question service, and two pupils whose `grade` is 7 (Tingkatan 1) and 11 (Tingkatan 5).
 * Routes: GET /api/practice/chapter-subjects, GET /api/practice/chapter-subjects/:code?levelId=, POST /api/practice/sessions { mode: 'chapter', chapterId }.
 */
let t: CurriculumTestApp
let t1Pupil: Client
let t5Pupil: Client
let math: string
let bm: string
let bi: string
let t1: string
let t5: string
let mathT1Chapters: { id: string; number: number }[]
let mathT5Chapters: { id: string; number: number }[]
const created: Record<string, string[]> = {}

async function chaptersOf(subject: string, level: string, take: number) {
  const rows = await t.db.query<{ id: string; n: number }>(
    `select id::text id, chapter_number n from chapters where subject_id = $1::bigint and education_level_id = $2::bigint and is_active and in_tree order by chapter_number, id limit ${take}`,
    [subject, level],
  )
  return rows.map((r) => ({ id: r.id, number: r.n }))
}

/** An approved, active, text-only MCQ in a chapter, through the question service (review, then approved). */
async function approvedMcq(subject: string, level: string, chapter: string): Promise<string> {
  const svc = t.app.get(QuestionsService, { strict: false })
  const admin = { userId: (await t.db.query<{ id: string }>(`select id::text id from users where email = 'admin@demo.test'`))[0]?.id as string, role: 'admin' as const }
  // Where the seed has DSKP nodes (T4, T5) the question needs an SP (D112); T1 to T3 have none, so no SP is sent there.
  const sp = (await t.db.query<{ id: string }>(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = $1::bigint and education_level_id = $2::bigint order by id limit 1`, [subject, level]))[0]?.id
  const q = await svc.create(
    {
      subjectId: subject,
      educationLevelId: level,
      difficultyLevel: 3,
      questionText: 'Soalan AC-X3-1: yang manakah jawapan yang betul?',
      questionType: 'mcq',
      options: ['Satu', 'Dua', 'Tiga', 'Empat'],
      correctAnswer: 1,
      explanation: 'Penjelasan ujian.',
      cognitiveLevel: 'mengaplikasi',
      curriculumChapterId: chapter,
      // With SP nodes the tag carries the SP and a TP (TP has no Kesukaran fallback, #685/#783); the unit is the SP's ancestor.
      ...(sp === undefined ? {} : { tag: { unitId: null, spIds: [sp], tp: 3 } }),
    } as never,
    admin,
  )
  for (const status of ['review', 'approved'] as const) await svc.bulkAction(status, [q.id], admin)
  const live = await t.db.query<{ status: string }>(`select v.status from question_versions v join questions x on x.id = v.question_id and x.live_version_no = v.version_no where x.id = $1::bigint`, [q.id])
  expect(live[0]?.status, `question ${q.id} approved`).toBe('approved')
  return q.id
}

async function seedChapter(key: string, subject: string, level: string, chapter: string, n: number) {
  created[key] = []
  for (let i = 0; i < n; i++) created[key]?.push(await approvedMcq(subject, level, chapter))
}

beforeAll(async () => {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, curriculumSeed, walletSeed, contentSeed], { prisma: db.prisma })
  Object.assign(process.env, { DATABASE_URL: db.url, COOKIE_SECURE: 'false', SESSION_SECRET: 'x'.repeat(32), LEGACY_BCRYPT_DUMMY_COST: '4', LOGIN_FAILURE_FLOOR_MS: '0', THROTTLE_PRACTICE_WRITE_PER_MINUTE: '100000' })
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, PracticeOverviewReadsModule, PracticeQuestionsBridgeModule])] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(OVERVIEW_OPTIONS)
    .useValue({ bankTtlMs: 0 })
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  t = { app, db, clock, http: () => request(app.getHttpServer()) as never, agent: () => request.agent(app.getHttpServer()), close: async () => { await app.close(); await dropDatabase(db) } } as CurriculumTestApp

  math = await idOf(db, 'subjects', 'MATH')
  bm = await idOf(db, 'subjects', 'BM')
  bi = await idOf(db, 'subjects', 'BI')
  t1 = await idOf(db, 'education_levels', 'T1')
  t5 = await idOf(db, 'education_levels', 'T5')
  // Two pupils: Tingkatan 1 (grade 7) and Tingkatan 5 (grade 11).
  await db.query(`update users set grade = 7 where email = 'pelajar2@demo.test'`)
  await db.query(`update users set grade = 11 where email = 'pelajarmaju@demo.test'`)
  t1Pupil = await loginAs(t, 'pelajar2@demo.test')
  t5Pupil = await loginAs(t, 'pelajarmaju@demo.test')

  mathT1Chapters = await chaptersOf(math, t1, 2)
  mathT5Chapters = await chaptersOf(math, t5, 1)
  expect(mathT1Chapters).toHaveLength(2)
  expect(mathT5Chapters).toHaveLength(1)
  // T1: MATH chapter A has 3, chapter B has 2; BM chapter 1 has 2; BI has chapters but no question (per-subject empty state).
  await seedChapter('math-t1-a', math, t1, (mathT1Chapters[0] as { id: string }).id, 3)
  await seedChapter('math-t1-b', math, t1, (mathT1Chapters[1] as { id: string }).id, 2)
  const bmT1 = await chaptersOf(bm, t1, 1)
  await seedChapter('bm-t1', bm, t1, (bmT1[0] as { id: string }).id, 2)
  // T5 parity: the seeded MATH T5 has one chapter; it gets 5.
  await seedChapter('math-t5-a', math, t5, (mathT5Chapters[0] as { id: string }).id, 5)
}, 180_000)

afterAll(async () => {
  await t.close()
})

type LevelRow = { id: string; code: string; chapterCount: number; questionCount: number }
type Tile = { code: string; questionCount: number; levels: LevelRow[] }

describe('AC-X3-1 CI: Bab mode (Soalan by Chapter) serves a T1 pupil and a T5 pupil', () => {
  it.each([
    ['T1', () => t1Pupil, () => t1, 5],
    ['T5', () => t5Pupil, () => t5, 5],
  ] as const)('AC-X3-1 %s pupil: the Bab list has MATH with its own level entry and question count', async (code, pupil, level, expected) => {
    const res = await pupil().get('/api/practice/chapter-subjects')
    expect(res.status).toBe(200)
    const tiles = res.body.data as Tile[]
    const mathTile = tiles.find((s) => s.code === 'MATH')
    expect(mathTile, 'MATH is offered').toBeDefined()
    const entry = mathTile?.levels.find((l) => l.code === code)
    expect(entry?.id).toBe(level())
    expect(entry?.chapterCount).toBeGreaterThan(0)
    expect(entry?.questionCount).toBe(expected)
  })

  it('AC-X3-1 T1 pupil: per-level subjects with counts (MATH 5, BM 2 at T1; BI has none and is left out, a per-subject empty state)', async () => {
    const res = await t1Pupil.get('/api/practice/chapter-subjects')
    expect(res.status).toBe(200)
    const tiles = res.body.data as Tile[]
    const at = (code: string) => tiles.find((s) => s.code === code)?.levels.find((l) => l.code === 'T1')
    expect(at('MATH')?.questionCount).toBe(5)
    expect(at('BM')?.questionCount).toBe(2)
    // A subject with chapters but no servable question at T1 (BI) is not listed: the empty state is per subject, never level-wide.
    expect(tiles.find((s) => s.code === 'BI')?.levels.find((l) => l.code === 'T1')).toBeUndefined()
    // The T1 entries are the same for the T5 pupil: no pupil-level gate on the list (D101), and no level-wide "akan datang" payload anywhere.
    const other = await t5Pupil.get('/api/practice/chapter-subjects')
    expect((other.body.data as Tile[]).find((s) => s.code === 'BM')?.levels.find((l) => l.code === 'T1')?.questionCount).toBe(2)
    expect(JSON.stringify(res.body)).not.toMatch(/akan datang/i)
  })

  it.each([
    ['T1', () => t1Pupil, () => t1, () => mathT1Chapters, [3, 2]],
    ['T5', () => t5Pupil, () => t5, () => mathT5Chapters, [5]],
  ] as const)('AC-X3-1 %s pupil: the MATH detail for the level lists its chapters with counts', async (code, pupil, level, chapters, totals) => {
    const res = await pupil().get(`/api/practice/chapter-subjects/MATH?levelId=${level()}`)
    expect(res.status).toBe(200)
    expect(res.body.data.levelId).toBe(level())
    const levels = res.body.data.levels as { id: string; name: string; count: number }[]
    expect(levels.find((l) => l.id === level())?.count).toBe(5)
    const rows = res.body.data.chapters as { id: string; total: number; state: string; remaining: number }[]
    const wanted = chapters()
    for (const [i, c] of wanted.entries()) {
      const row = rows.find((r) => r.id === c.id)
      expect(row, `${code} chapter ${c.number} listed`).toBeDefined()
      expect(row?.total).toBe(totals[i])
      expect(row?.state).toBe('open')
      expect(row?.remaining).toBe(totals[i])
    }
    // Only chapters that hold servable questions are listed, and only those of this level.
    expect(rows.map((r) => r.id).sort()).toEqual(wanted.map((c) => c.id).sort())
  })

  it('AC-X3-1 T1 pupil: starting practice from a T1 Bab returns 201 with questions of that chapter', async () => {
    const chapter = (mathT1Chapters[0] as { id: string }).id
    const res = await t1Pupil.post('/api/practice/sessions', { mode: 'chapter', chapterId: chapter, count: 5 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const served = res.body.data.questions as { id: string }[]
    expect(served).toHaveLength(3) // the chapter holds 3; the pupil asked for up to 5
    expect(served.map((q) => q.id).sort()).toEqual([...(created['math-t1-a'] as string[])].sort())
    const rows = await t.db.query<{ chapter_id: string }>(`select v.chapter_id::text chapter_id from question_versions v where v.question_id = any($1::bigint[])`, [served.map((q) => q.id)])
    expect(rows.every((r) => r.chapter_id === chapter)).toBe(true)
    expect(JSON.stringify(res.body)).not.toMatch(/akan datang/i)
  })

  it('AC-X3-1 T5 pupil (parity): starting practice from a T5 Bab returns 201 with questions of that chapter', async () => {
    const chapter = (mathT5Chapters[0] as { id: string }).id
    const res = await t5Pupil.post('/api/practice/sessions', { mode: 'chapter', chapterId: chapter, count: 5 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const served = res.body.data.questions as { id: string }[]
    expect(served.map((q) => q.id).sort()).toEqual([...(created['math-t5-a'] as string[])].sort())
  })

  it('AC-X3-1 a T1 Bab with no servable question is refused per chapter (422), not level-wide', async () => {
    const empty = (await chaptersOf(bi, t1, 1))[0] as { id: string }
    const res = await t1Pupil.post('/api/practice/sessions', { mode: 'chapter', chapterId: empty.id, count: 5 })
    expect(res.status).toBe(422)
    // The other T1 chapters still start.
    const ok = await t1Pupil.post('/api/practice/sessions', { mode: 'chapter', chapterId: (mathT1Chapters[1] as { id: string }).id, count: 5 })
    expect(ok.status).toBe(201)
  })
})
