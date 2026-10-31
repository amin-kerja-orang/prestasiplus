import 'reflect-metadata'

import { PracticeReadChapterSubjectListResponseSchema, QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
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
import { createTestDatabase } from '../support/db'
import { mcqBody, refsOf, tagOf } from './http-helpers'

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

    const plain = await admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag }))
    expect(plain.status, JSON.stringify(plain.body)).toBe(201)
    expect(await list()).toEqual([])

    const chapter = await chapterIdOf(t.db, 'MATH', 'T4', 1)
    const res = await admin.post('/api/questions', mcqBody(refs, { status: 'approved', tag, curriculumChapterId: chapter }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(mutationEnvelopeOf(QuestionSchema).parse(res.body).data.curriculumChapterId).toBe(chapter)

    const rows = await list()
    expect(rows.map((s) => s.code)).toEqual(['MATH'])
    // questionCount is the subject's practice questions (the untagged one counts too); chapterCount is the Bab that has a question.
    expect(rows[0]).toMatchObject({ chapterCount: 1, questionCount: 2 })
  })
})
