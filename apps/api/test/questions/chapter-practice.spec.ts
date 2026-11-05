import 'reflect-metadata'

import { PracticeReadChapterSubjectListResponseSchema, QuestionSchema, ServabilityReportSchema, mutationEnvelopeOf } from '@pp/contract'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { walletSeed } from '../../prisma/seed/wallet'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AuthModule } from '../../src/modules/auth'
import { CurriculumModule } from '../../src/modules/curriculum'
import { PracticeOverviewReadsModule } from '../../src/modules/practice/reads/overview'
import { OVERVIEW_OPTIONS } from '../../src/modules/practice/reads/overview/overview.service'
import { QuestionsModule } from '../../src/modules/questions'
import { chapterIdOf, dropDatabase, loginAs, START, type CurriculumTestApp } from '../curriculum/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { mcqBody, refsOf, tagOf } from './http-helpers'

/**
 * S1-T02: Terbitkan asks for the Bab wherever the Subjek + Tingkatan has chapters (NO_CHAPTER), so an approved question WITHOUT a Bab can only exist for a
 * Subjek + Tingkatan that has none. The chapters of MATH T4 leave the tree for the duration of `fn` and are restored after it.
 */
async function withoutChapters<T>(db: TestDatabase, subjectId: string, levelId: string, fn: () => Promise<T>): Promise<T> {
  const ids = (await db.query<{ id: string }>(`select id::text from chapters where subject_id = $1::bigint and education_level_id = $2::bigint and is_active and in_tree`, [subjectId, levelId])).map((r) => r.id)
  await db.query(`update chapters set in_tree = false where id = any($1::bigint[])`, [ids])
  try {
    return await fn()
  } finally {
    await db.query(`update chapters set in_tree = true where id = any($1::bigint[])`, [ids])
  }
}

/** R1 B-01: a question the admin tags with a Bab shows up in Soalan by Chapter (read only; practice is not touched). */
describe('Bab set by the admin feeds GET /api/practice/chapter-subjects', () => {
  let t: CurriculumTestApp

  beforeAll(async () => {
    const db = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed, walletSeed], { prisma: db.prisma })
    Object.assign(process.env, { DATABASE_URL: db.url, COOKIE_SECURE: 'false', SESSION_SECRET: 'x'.repeat(32), LEGACY_BCRYPT_DUMMY_COST: '4', LOGIN_FAILURE_FLOOR_MS: '0' })
    const clock = new FixedClock(START)
    const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, CurriculumModule, QuestionsModule, PracticeOverviewReadsModule])] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .overrideProvider(OVERVIEW_OPTIONS)
      .useValue({ bankTtlMs: 0 })
      .compile()
    const app = moduleRef.createNestApplication({ bufferLogs: false })
    configureApp(app)
    await app.init()
    t = {
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
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('is empty without a chapter, then lists the subject and chapter once a published MCQ carries one', async () => {
    const admin = await loginAs(t, 'admin@demo.test')
    const student = await loginAs(t, 'pelajar@demo.test')
    const refs = await refsOf(t.db)
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const list = async () => PracticeReadChapterSubjectListResponseSchema.parse((await student.get('/api/practice/chapter-subjects')).body).data

    const plain = await withoutChapters(t.db, refs.mathId, refs.t4Id, () => admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag, curriculumChapterId: undefined })))
    expect(plain.status, JSON.stringify(plain.body)).toBe(201)
    expect(await list()).toEqual([])

    const chapter = await chapterIdOf(t.db, 'MATH', 'T4', 1)
    const res = await admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag, curriculumChapterId: chapter }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(mutationEnvelopeOf(QuestionSchema).parse(res.body).data.curriculumChapterId).toBe(chapter)

    const rows = await list()
    expect(rows.map((s) => s.code)).toEqual(['MATH'])
    // questionCount is what the chapter draw can serve (chaptered, ungrouped, approved; D91, FD-11, R1E2E-09): the question without a chapter
    // does not count in the tile, though it is a practice question of the subject. chapterCount is the Bab that has a question.
    expect(rows[0]).toMatchObject({ chapterCount: 1, questionCount: 1 })
    // The tile equals the sum of the per-level counts of the subject's Bab page (card = detail = drawable).
    const detail = await student.get('/api/practice/chapter-subjects/MATH')
    expect(detail.status, JSON.stringify(detail.body)).toBe(200)
    const levels = (detail.body as { data: { levels: { count: number }[] } }).data.levels
    expect(levels.reduce((n, l) => n + l.count, 0)).toBe(rows[0]!.questionCount)
  })

  // PIPE AC-18.1 (R1-20.4), the Latihan Bab step of the chain: after the admin flow (approved, DSKP-tagged) each applicable activity serves the
  // question and the Bab one waits for a Bab. The admin reads this as "Dilihat murid di"; the pupil reads the same fact in the chapter list.
  it('AC-18.1 Latihan Bab: an approved MCQ is not served in Latihan Bab without a Bab (no_chapter) and is served with one, in step with the pupil chapter list', async () => {
    const admin = await loginAs(t, 'admin@demo.test')
    const student = await loginAs(t, 'pelajar@demo.test')
    const refs = await refsOf(t.db)
    const tag = await tagOf(t.db, refs.mathId, refs.t4Id)
    const bab = async (id: string) => {
      const res = await admin.get(`/api/admin/servability/questions/${id}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const report = ServabilityReportSchema.parse(res.body.data)
      return report.activities.find((a) => a.activity === 'bab')!
    }
    const inChapterList = async (): Promise<number> =>
      PracticeReadChapterSubjectListResponseSchema.parse((await student.get('/api/practice/chapter-subjects')).body).data.find((x) => x.code === 'MATH')?.chapterCount ?? 0

    const before = await inChapterList()
    // `mcqBody` gives a question a Bab by default, so the "without a Bab" case says so explicitly (S1-T02: a Bab is required to approve only where the Subjek + Tingkatan has chapters; without one the question is not served in Latihan Bab).
    const created = await withoutChapters(t.db, refs.mathId, refs.t4Id, () => admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag, curriculumChapterId: null })))
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const withoutBab = await bab(created.body.data.id as string)
    expect(withoutBab).toMatchObject({ label: 'Latihan Bab', served: false })
    expect(withoutBab.reasons.map((r) => r.code)).toEqual(['no_chapter'])

    // a MATH T4 chapter that carries no question yet, whatever the other cases of this file did: only then does the list grow by one
    const [free] = await t.db.query<{ id: string }>(
      `select c.id::text id from chapters c where c.subject_id = $1::bigint and c.education_level_id = $2::bigint and not exists (select 1 from question_versions v where v.chapter_id = c.id) order by c.id limit 1`,
      [refs.mathId, refs.t4Id],
    )
    const chapter = free!.id
    const withBab = await admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag, curriculumChapterId: chapter }))
    expect(withBab.status, JSON.stringify(withBab.body)).toBe(201)
    expect(await bab(withBab.body.data.id as string)).toMatchObject({ label: 'Latihan Bab', served: true, reasons: [] })
    expect(await inChapterList()).toBe(before + 1) // the chapter list follows the Bab the admin set (a new chapter of MATH)
  })
})
