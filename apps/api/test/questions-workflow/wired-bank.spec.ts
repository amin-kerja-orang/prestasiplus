/**
 * BE-10 wired to the real BE-09 question bank: no fake port. Proves the lifecycle, the shared gates,
 * the create path, the port methods against real rows, and that BE-10's static Guru routes are not
 * shadowed by BE-09's `GET /guru/questions/:id`.
 */
import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { QuestionPart } from '@pp/contract'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { PrismaService } from '../../src/db/prisma.service'
import { AuthModule } from '../../src/modules/auth'
import { CurriculumModule } from '../../src/modules/curriculum'
import { featureModules } from '../../src/modules'
import { QuestionsModule } from '../../src/modules/questions'
import { QuestionWorkflowModule, QuestionWorkflowPorts, QuestionWorkflowService, type WorkflowActor } from '../../src/modules/questions/workflow'
import { QuestionBankAdapter } from '../../src/modules/questions/workflow/bank'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { mcqBody, refsOf, tagOf, type Refs } from '../questions/http-helpers'
import { FakeQuestionBank } from './fake-question-bank'
import { cloneTeacher, dropDatabase, expectError, loginAs, START, type Client, type WorkflowTestApp } from './helpers'
import { curriculumIds, fixture, uploadClient } from './imports-support'
import { failure } from './lifecycle-support'

/** A working part worth `marks` whose key awards `keyMarks` (the contract-valid shape). */
const workingPart = (marks: number, keyMarks: number): QuestionPart =>
  ({
    label: 'a',
    prompt: { ms: 'Tunjukkan langkah kerja anda.' },
    mode: 'working',
    marks,
    key: { kind: 'points', marks: keyMarks, points: [{ id: 'p1', code: 'M', label: 'Kaedah', marks: keyMarks }] },
  }) as QuestionPart

const actorOf = (c: Client): WorkflowActor => ({ userId: c.userId, role: c.role as WorkflowActor['role'], requestId: 'req-wired', ip: null, isTest: false })

/** The modules this spec needs, in the order the production registry lists them (route order matters). */
const wanted: unknown[] = [AuthModule, CurriculumModule, QuestionsModule, QuestionWorkflowModule]
const productionOrder = featureModules.filter((m) => wanted.includes(m))

describe('question workflow over the real question bank', () => {
  let db: TestDatabase
  let app: INestApplication
  let t: WorkflowTestApp
  let admin: Client
  let teacher: Client
  let refs: Refs
  let tag: { unitId: string; spIds: string[]; tp: number }
  let workflow: QuestionWorkflowService
  let bank: QuestionBankAdapter

  const rows = (sql: string, params: unknown[] = []) => db.query<Record<string, unknown>>(sql, params)
  const events = (id: string) =>
    rows(`select from_status, to_status, actor_user_id::text actor, version_no from question_status_events where question_id = $1 order by id`, [id])

  async function create(body: Record<string, unknown>): Promise<string> {
    const res = await admin.post('/api/questions', body)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return String(res.body.data.id)
  }
  /** The submit gate wants a chapter, which the admin create body cannot set. */
  async function giveChapter(id: string): Promise<void> {
    await db.query(
      `update question_versions set chapter_id = (select id from chapters where subject_id = $2 limit 1) where question_id = $1`,
      [id, refs.mathId],
    )
  }
  const mcq = (over: Record<string, unknown> = {}) => mcqBody(refs, { tag, ...over })

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed], { prisma: db.prisma })
    await cloneTeacher(db)
    Object.assign(process.env, {
      DATABASE_URL: db.url,
      COOKIE_SECURE: 'false',
      SESSION_SECRET: 'x'.repeat(32),
      LEGACY_BCRYPT_DUMMY_COST: '4',
      LOGIN_FAILURE_FLOOR_MS: '0',
      THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000',
    })
    const moduleRef = await Test.createTestingModule({ imports: [defineAppModule(productionOrder)] })
      .overrideProvider(CLOCK)
      .useValue(new FixedClock(START))
      .compile()
    app = moduleRef.createNestApplication({ bufferLogs: false })
    configureApp(app)
    await app.init()
    t = {
      app,
      db,
      clock: new FixedClock(START),
      bank: app.get(QuestionWorkflowPorts).questionBank,
      fake: new FakeQuestionBank(),
      http: () => request(app.getHttpServer()) as unknown as TestAgent,
      agent: () => request.agent(app.getHttpServer()),
      close: async () => undefined,
    }
    admin = await loginAs(t, 'admin@demo.test')
    teacher = await loginAs(t, 'guru@demo.test')
    refs = await refsOf(db)
    tag = await tagOf(db, refs.mathId, refs.t4Id)
    workflow = app.get(QuestionWorkflowService)
    bank = app.get(QuestionBankAdapter)
  })
  afterAll(async () => {
    await app.close()
    await dropDatabase(db)
  })

  it('registers the real adapter as the one bank, and a second registration still throws', () => {
    expect(app.get(QuestionWorkflowPorts).questionBank).toBe(bank)
    expect(() => app.get(QuestionWorkflowPorts).provideQuestionBank(new FakeQuestionBank())).toThrow(/already set/)
  })

  describe('lifecycle on a BE-09 question', () => {
    it('draft to review to approved to published: BE-09 shows live_version_no, one event per step', async () => {
      const id = await create(mcq())
      await giveChapter(id)
      for (const to of ['review', 'approved', 'published']) {
        const done = await workflow.transition(id, to, actorOf(admin))
        expect(done.to).toBe(to)
      }
      const [q] = await rows(`select live_version_no, latest_version_no from questions where id = $1`, [id])
      expect(q).toMatchObject({ live_version_no: 1, latest_version_no: 1 })
      const [v] = await rows(`select status, published_at from question_versions where question_id = $1`, [id])
      expect(v?.status).toBe('published')
      expect(v?.published_at).not.toBeNull()
      expect(await events(id)).toEqual([
        { from_status: 'draft', to_status: 'review', actor: admin.userId, version_no: 1 },
        { from_status: 'review', to_status: 'approved', actor: admin.userId, version_no: 1 },
        { from_status: 'approved', to_status: 'published', actor: admin.userId, version_no: 1 },
      ])
      const status = await bank.getStatus(id)
      expect(status).toMatchObject({ status: 'published', liveVersionNo: 1, isActive: true, createdById: admin.userId })
    })

    it('"Lulus & Terbit" (review to published) writes both events', async () => {
      const id = await create(mcq({ status: 'review' }))
      const done = await workflow.transition(id, 'published', actorOf(admin))
      expect(done.events).toEqual([{ from: 'review', to: 'approved' }, { from: 'approved', to: 'published' }])
      expect((await events(id)).map((e) => e.to_status)).toEqual(['approved', 'published'])
      expect((await bank.getStatus(id))?.liveVersionNo).toBe(1)
    })

    it('publishing version 2 supersedes version 1; a takedown of the live version leaves the newer draft alone', async () => {
      const id = await create(mcq({ status: 'published' }))
      expect((await bank.getStatus(id))?.liveVersionNo).toBe(1)
      const put = await admin.put(`/api/questions/${id}`, mcq({ questionText: 'Soalan versi dua yang diubah?' }))
      expect(put.status, JSON.stringify(put.body)).toBe(200)
      expect(await bank.getStatus(id)).toMatchObject({ status: 'draft', latestVersionNo: 2, liveVersionNo: 1 })

      await bank.setStatus(id, 'archived', admin.userId, { target: 'live', expectedFrom: 'published', archiveReason: 'source_takedown' })
      const after = await rows(`select version_no, status, archive_reason from question_versions where question_id = $1 order by version_no`, [id])
      expect(after).toEqual([
        { version_no: 1, status: 'archived', archive_reason: 'source_takedown' },
        { version_no: 2, status: 'draft', archive_reason: null },
      ])
      expect(await bank.getStatus(id)).toMatchObject({ status: 'draft', latestVersionNo: 2, liveVersionNo: null })
    })

    it('publishing the new version archives the old live one as superseded', async () => {
      const id = await create(mcq({ status: 'published' }))
      await admin.put(`/api/questions/${id}`, mcq({ questionText: 'Soalan versi dua untuk diterbitkan?' }))
      await giveChapter(id)
      await workflow.transition(id, 'review', actorOf(admin))
      await workflow.transition(id, 'published', actorOf(admin)) // review to published in one call
      const versions = await rows(`select version_no, status, archive_reason from question_versions where question_id = $1 order by version_no`, [id])
      expect(versions).toEqual([
        { version_no: 1, status: 'archived', archive_reason: 'superseded' },
        { version_no: 2, status: 'published', archive_reason: null },
      ])
      expect(await bank.getStatus(id)).toMatchObject({ status: 'published', liveVersionNo: 2 })
    })

    it('withdrawing a published question clears the live version', async () => {
      const id = await create(mcq({ status: 'published' }))
      await workflow.transition(id, 'archived', actorOf(admin), { reason: 'Tersilap' })
      expect(await bank.getStatus(id)).toMatchObject({ status: 'archived', liveVersionNo: null })
      const [v] = await rows(`select archive_reason from question_versions where question_id = $1`, [id])
      expect(v?.archive_reason).toBe('withdrawn')
    })
  })

  describe('publish gates (checkKeysGate and checkTagGate are BE-09 rules)', () => {
    it('a key whose marks differ from the part marks blocks publish: 422 on parts.<path>.key, no change, no event', async () => {
      const parts: QuestionPart[] = [workingPart(3, 2)]
      const id = await create(mcq({ status: 'approved', parts }))
      const before = await events(id)
      const err = await failure(workflow.transition(id, 'published', actorOf(admin)))
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.fields).toHaveProperty(['parts.a.key'], 'Jumlah markah tidak sepadan dengan skema.')
      expect((await bank.getStatus(id))?.status).toBe('approved')
      expect(await events(id)).toEqual(before)
      const [q] = await rows(`select live_version_no from questions where id = $1`, [id])
      expect(q?.live_version_no).toBeNull()
    })

    it('missing tags block publish (unit, SP)', async () => {
      const id = await create(mcqBody(refs, { status: 'approved' })) // no tag: no unit, no SP
      const err = await failure(workflow.transition(id, 'published', actorOf(admin)))
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.fields).toMatchObject({ unitId: 'Sila pilih unit DSKP.', spIds: 'Sila pilih sekurang-kurangnya satu SP DSKP.' })
      expect((await bank.getStatus(id))?.status).toBe('approved')
      expect(await events(id)).toEqual([])
    })

    it('the adapter itself re-checks both gates on publish (second line of defence)', async () => {
      const id = await create(mcq({ status: 'approved', parts: [workingPart(3, 2)] }))
      const err = await failure(bank.setStatus(id, 'published', admin.userId, { expectedFrom: 'approved' }))
      expect(err.fields).toHaveProperty(['parts.a.key'])
      expect((await bank.getStatus(id))?.status).toBe('approved')
    })
  })

  describe('create as published', () => {
    const gateInput = (over: Record<string, unknown> = {}) => ({
      status: 'published' as const,
      parts: [] as QuestionPart[],
      marks: null,
      subjectId: '1',
      educationLevelId: '1',
      chapterId: '1',
      unitId: '1',
      spIds: ['1'],
      tp: 3,
      rightsStatus: 'own',
      hasSourceDeclaration: true,
      unconfirmedLowConfidenceFields: [],
      hasOpenDuplicateFlag: false,
      mediaResolved: true,
      missingRequiredFields: [],
      lastEditedByAi: false,
      ...over,
    })

    it('BE-10 assertCreateAllowed refuses bad keys and missing tags', async () => {
      const keys = await (async () => {
        try {
          workflow.assertCreateAllowed(gateInput({ parts: [workingPart(3, 2)] }), actorOf(admin))
        } catch (e) {
          return e as { code: string; fields?: Record<string, string> }
        }
        throw new Error('expected a refusal')
      })()
      expect(keys.code).toBe('VALIDATION_ERROR')
      expect(keys.fields).toHaveProperty(['parts.a.key'])
      expect(() => workflow.assertCreateAllowed(gateInput({ unitId: null, spIds: [] }), actorOf(admin))).toThrow()
      expect(() => workflow.assertCreateAllowed(gateInput(), actorOf(admin))).not.toThrow()
    })

    it('BE-09 POST /questions with status published and a bad key is 422, and no row is created', async () => {
      const before = await rows(`select count(*)::int n from questions`)
      const res = await admin.post('/api/questions', mcq({ status: 'published', parts: [workingPart(3, 2)] }))
      const error = expectError(res, 'VALIDATION_ERROR')
      expect(error.fields).toHaveProperty(['parts.a.key'])
      expect(await rows(`select count(*)::int n from questions`)).toEqual(before)
    })

    it('BE-09 POST /questions with status published and no tag is 422 (tag gate)', async () => {
      const before = await rows(`select count(*)::int n from questions`)
      expectError(await admin.post('/api/questions', mcqBody(refs, { status: 'published' })), 'VALIDATION_ERROR')
      expect(await rows(`select count(*)::int n from questions`)).toEqual(before)
    })
  })

  describe('other port methods on real rows', () => {
    it('unknown ids answer null, false or absent', async () => {
      expect(await bank.getStatus('999999999')).toBeNull()
      expect(await bank.getForGates('999999999')).toBeNull()
      expect(await bank.setStatus('999999999', 'review', '1')).toBeNull()
      expect(await bank.deactivate('999999999')).toBe(false)
      expect(await bank.reactivate('not-an-id')).toBe(false)
      expect((await bank.describe(['999999999'])).size).toBe(0)
      expect(await bank.getExplanationSource('999999999')).toBeNull()
      expect(await bank.setExplanation('999999999', 'x')).toBe(false)
      expect(await bank.attachDiagram('999999999', '1')).toBe(false)
    })

    it('deactivate and reactivate flip is_active at once', async () => {
      const id = await create(mcq({ status: 'published' }))
      expect(await bank.deactivate(id)).toBe(true)
      expect((await bank.getStatus(id))?.isActive).toBe(false)
      expect(await bank.reactivate(id)).toBe(true)
      expect((await bank.getStatus(id))?.isActive).toBe(true)
    })

    it('expectedFrom mismatch is 409 and changes nothing', async () => {
      const id = await create(mcq()) // draft
      const err = await failure(bank.setStatus(id, 'review', admin.userId, { expectedFrom: 'approved' }))
      expect(err.code).toBe('CONFLICT')
      expect(err.getStatus()).toBe(409)
      expect((await bank.getStatus(id))?.status).toBe('draft')
    })

    it('describe, getForGates, quality and explanation read the real question', async () => {
      const id = await create(mcq({ questionText: '<p>Berapakah <b>hasil</b> tambah?</p>', explanation: 'Dua tambah tiga ialah lima.' }))
      await giveChapter(id)
      const brief = (await bank.describe([id])).get(id)
      expect(brief).toMatchObject({ id, stemText: 'Berapakah hasil tambah?', type: 'mcq', status: 'draft', subjectId: refs.mathId, educationLevelId: refs.t4Id })
      expect(brief?.subjectName).toBeTruthy()
      expect(brief?.levelName).toBeTruthy()
      expect(brief?.chapterName).not.toBeUndefined()

      const gates = await bank.getForGates(id)
      expect(gates).toMatchObject({ id, subjectId: refs.mathId, unitId: tag.unitId, spIds: tag.spIds, tp: 3, rightsStatus: 'own', hasSourceDeclaration: true, marks: 1 })
      expect(gates?.chapterId).not.toBeNull()
      expect(gates?.hasOpenDuplicateFlag).toBe(false)

      const quality = (await bank.listForQuality()).find((q) => q.id === id)
      expect(quality).toMatchObject({ explanation: 'Dua tambah tiga ialah lima.', untagged: false, sourceType: 'manual', quarantinedOrRejected: false, isLegacy: false })

      const source = await bank.getExplanationSource(id)
      expect(source?.options?.filter((o) => o.isCorrect).map((o) => o.label)).toEqual(['B'])
      expect(await bank.setExplanation(id, 'Penjelasan baharu.')).toBe(true)
      expect((await bank.getExplanationSource(id))?.explanation).toBe('Penjelasan baharu.')
      expect(await bank.listDiagramCandidates('mcq')).toEqual([])
    })

    it('create (import) makes a real BE-09 question owned by createdById, legacy difficulty mapped to TP', async () => {
      const id = await prisma().transaction(() =>
        bank.create({
          stemMs: 'Soalan import: yang manakah betul?',
          options: [
            { label: 'A', text: 'Satu' },
            { label: 'B', text: 'Dua' },
            { label: 'C', text: 'Tiga' },
            { label: 'D', text: 'Empat' },
          ],
          correctLabel: 'C',
          subjectId: refs.mathId,
          educationLevelId: refs.t4Id,
          difficultyLevel: 4,
          explanation: 'Tiga.',
          sourceType: 'excel',
          createdById: teacher.userId,
          status: 'review',
          sourceSet: 'Set A',
          marks: 2,
        }),
      )
      expect(await bank.getStatus(id)).toMatchObject({ status: 'review', latestVersionNo: 1, liveVersionNo: null, createdById: teacher.userId })
      const [q] = await rows(`select q.source_type, v.difficulty_tp, v.set_label, v.form_origin, v.explanation_ms from questions q join question_versions v on v.question_id = q.id where q.id = $1`, [id])
      expect(q).toMatchObject({ source_type: 'excel', difficulty_tp: 4, set_label: 'Set A', form_origin: 't4', explanation_ms: 'Tiga.' })
      const gates = await bank.getForGates(id)
      expect(gates?.marks).toBe(2)
      const admin404 = await admin.get(`/api/questions/${id}`)
      expect(admin404.status).toBe(200)
      const own = await teacher.get(`/api/guru/questions/${id}`)
      expect(own.status).toBe(200)
    })

    it('listIdsBySourcePaper finds the questions of a paper and the BE-10 takedown archives them (live and newer draft)', async () => {
      const id = await create(mcq({ status: 'published' }))
      await admin.put(`/api/questions/${id}`, mcq({ questionText: 'Versi dua untuk takedown?' }))
      const [paper] = await rows(`insert into source_papers (natural_key, subject_id) values ('wired|takedown', $1) returning id::text`, [refs.mathId])
      const paperId = String(paper?.id)
      await db.query(`update question_versions set source_paper_id = $2 where question_id = $1`, [id, paperId])
      expect(await bank.listIdsBySourcePaper(paperId)).toEqual([id])
      expect(await bank.listIdsBySourcePaper('999999')).toEqual([])

      const done = await workflow.takedownSource(paperId, actorOf(admin), 'Sumber ditarik balik')
      expect(done).toMatchObject({ archived: 1, skipped: 0 })
      const versions = await rows(`select version_no, status, archive_reason from question_versions where question_id = $1 order by version_no`, [id])
      expect(versions).toEqual([
        { version_no: 1, status: 'archived', archive_reason: 'source_takedown' },
        { version_no: 2, status: 'archived', archive_reason: 'source_takedown' },
      ])
      expect((await bank.getStatus(id))?.liveVersionNo).toBeNull()
    })
  })

  describe('routes', () => {
    it('the production registry lists BE-10 before BE-09 so static Guru routes win over /guru/questions/:id', () => {
      expect(productionOrder).toHaveLength(4)
      expect(productionOrder.indexOf(QuestionWorkflowModule)).toBeLessThan(productionOrder.indexOf(QuestionsModule))
    })

    it('BE-10 static Guru routes are reached, not shadowed by GET /guru/questions/:id', async () => {
      const tpl = await teacher.get('/api/guru/questions/template')
      expect(tpl.status).toBe(200)
      expect(String(tpl.headers['content-type'])).toContain('text/csv')
      expect(String(tpl.headers['content-disposition'] ?? '')).toContain('attachment')

      const ids = await curriculumIds(t)
      const up = await uploadClient(t, 'teacher')
      const res = await up.upload('/api/guru/questions/import', { name: 'guru.csv', body: fixture('import-mixed.csv', ids) })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.imported).toBe(2)
      // The imported rows are real BE-09 questions in review, owned by the Guru.
      const owned = await rows(
        `select v.status, q.source_type from questions q join question_versions v on v.question_id = q.id where q.created_by_id = $1 and q.source_type = 'excel' order by q.id`,
        [up.userId],
      )
      expect(owned.length).toBeGreaterThanOrEqual(2)
      expect(owned.every((r) => r.status === 'review')).toBe(true)
      const created = await rows(`select count(*)::int n from question_status_events e join questions q on q.id = e.question_id where q.source_type = 'excel' and e.from_status is null and e.to_status = 'review'`)
      expect(Number(created[0]?.n)).toBeGreaterThanOrEqual(2)
    })
  })

  function prisma(): PrismaService {
    return app.get(PrismaService)
  }
})
