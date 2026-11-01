import 'reflect-metadata'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Test } from '@nestjs/testing'
import request from 'supertest'
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
import { AI_EXTRACTOR } from '../../src/modules/intake/files'
import { OCR_ENGINE } from '../../src/modules/ocr'
import { FakeOcrEngine, loginAs as loginIntake, type LoggedIn } from '../intake-files/helpers'
import { draft, extractAndRun, itemsOf, MockExtractor, paper, patch, post, readyBatch, type WorkflowTestApp } from '../intake-workflow/helpers'
import { createTestDatabase } from '../support/db'
import { serveSeededBlueprints } from '../support/serve-blueprints'
import { loginFull, type FullClient } from './full-app'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 300_000 })

/**
 * R1 chain QA (the one link the other chain specs do not cross): an exam paper that INTAKE produced.
 *   teacher uploads a PDF -> AI extraction (a scripted double) -> review -> accept (a figure becomes ONE stimulus group with its image)
 *   -> admin approves (the T33 DSKP gate; the H-A18 Bab where it exists) -> builds a MAT kertas 2 paper (D90 group is one unit, section pools)
 *   -> Terbit (versions pinned) -> a pupil sits it (stimulus served once, with the image; no key leaks) -> submits -> Cuba Lagi.
 * `pipeline-chain.spec.ts` builds its questions through the Studio API; the intake specs stop at "approved". This one joins them.
 * The Bab is given by SQL so the spec is green with and without the H-A18 submit gate (that gate has its own specs).
 */
const REGION = { page: 1, x: 0.1, y: 0.1, w: 0.5, h: 0.4 }
const START = '2026-10-19T09:00:00+08:00'

let t: WorkflowTestApp
let teacher: LoggedIn
let admin: FullClient
let pupil: FullClient
let dir: string

async function boot(): Promise<WorkflowTestApp> {
  const db = await createTestDatabase()
  await runSeeds([identitySeed, walletTiersSeed, curriculumSeed, examSeed, walletSeed, spmSubjectConfigsSeed], { prisma: db.prisma })
  dir = await mkdtemp(join(tmpdir(), 'pp-chain-intake-'))
  const env: Record<string, string> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'x'.repeat(32),
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    FILE_STORAGE_DIR: dir,
    UPLOAD_RATE_PER_MINUTE: '1000',
    FILE_READS_PER_MINUTE: '10000',
    JOBS_WORKER_ENABLED: 'false',
    JOBS_BACKOFF_BASE_MS: '100',
    INTAKE_TEACHER_ENABLED: 'true',
    INTAKE_WRITES_PER_MINUTE: '1000',
    INTAKE_READS_PER_MINUTE: '10000',
    INTAKE_REVIEW_WRITES_PER_MINUTE: '10000',
    INTAKE_REVIEW_READS_PER_MINUTE: '10000',
    INTAKE_EXTRACTS_PER_MINUTE: '10000',
    INTAKE_BULK_PER_MINUTE: '10000',
    BIJAK_POC_QUESTIONS: 'false',
    SPM_POOL_CACHE_SECONDS: '0',
    THROTTLE_QUESTIONS_WRITE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_ATTEMPT_SAVE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_ATTEMPT_WRITE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_CHECK_PER_MINUTE: '100000',
    THROTTLE_BIJAK_PAPERS_READ_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_READ_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_WRITE_PER_MINUTE: '100000',
    BIJAK_SWEEP_INTERVAL_SECONDS: '0',
  }
  for (const [k, v] of Object.entries(env)) process.env[k] = v
  const ai = new MockExtractor()
  const clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule(featureModules)] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(OCR_ENGINE)
    .useValue(new FakeOcrEngine())
    .overrideProvider(AI_EXTRACTOR)
    .useValue(ai)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  const jobs = app.get((await import('../../src/modules/jobs')).JobsService)
  const unit = (await db.query<{ code: string }>(`select n.code from curriculum_nodes n join subjects s on s.id = n.subject_id join education_levels l on l.id = n.education_level_id where s.code = 'MATH' and l.code = 'T4' and n.kind = 'unit' order by n.id limit 1`))[0]!
  const sp = (await db.query<{ code: string }>(`select n.code from curriculum_nodes n join subjects s on s.id = n.subject_id join education_levels l on l.id = n.education_level_id where s.code = 'MATH' and l.code = 'T4' and n.kind = 'sp' order by n.id limit 1`))[0]!
  return {
    app,
    db,
    clock,
    dir,
    ai,
    jobs,
    codes: { unit: unit.code, sp: sp.code },
    http: () => request(app.getHttpServer()) as never,
    agent: () => request.agent(app.getHttpServer()) as never,
    async drain(maxRounds = 200) {
      let total = 0
      for (let i = 0; i < maxRounds; i++) {
        const n = await jobs.runOnce(10)
        if (n === 0) return total
        total += n
      }
      throw new Error('jobs did not settle')
    },
    async releaseDelayed() {
      await db.query(`update jobs set run_after = now() - interval '1 second' where state = 'queued'`)
    },
    async close() {
      await app.close()
      await db.drop()
      await rm(dir, { recursive: true, force: true })
    },
  }
}

const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)

describe('R1 chain QA: intake -> approve -> paper -> Terbit -> pupil -> submit -> Cuba Lagi', () => {
  const questionIds: string[] = [] // item order: 1,2 = figure group; 3 = solo A; 4 = B; 5,6 = C
  let groupId = ''
  let imageToken = ''
  let paperId = ''
  let attempt = ''

  beforeAll(async () => {
    t = await boot()
    teacher = await loginIntake(t, 'guru@demo.test')
    admin = await loginFull(t as never, 'admin@demo.test')
    pupil = await loginFull(t as never, 'pelajar@demo.test')
    await serveSeededBlueprints(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  it('1. the teacher uploads a PDF and the extraction yields six drafts, two of them sharing one figure', async () => {
    t.ai.paper = () =>
      paper(
        [
          draft(t.codes, '1', { stimulusId: 'stim-1' }),
          draft(t.codes, '2', { stimulusId: 'stim-1' }),
          draft(t.codes, '3'),
          draft(t.codes, '4'),
          draft(t.codes, '5', { marks: 2, scheme: { kind: 'option', marks: 2, correct: 'B', reason: 'Kerana B.' } }),
          draft(t.codes, '6', { marks: 2, scheme: { kind: 'option', marks: 2, correct: 'B', reason: 'Kerana B.' } }),
        ],
        { stimuli: [{ id: 'stim-1', kind: 'diagram', label: 'Rajah 1', alt: 'Rajah segi tiga sama kaki', page: 1, region: REGION }] },
      )
    const { batchId } = await readyBatch(t, teacher)
    await extractAndRun(t, teacher, batchId)
    const items = await itemsOf(teacher, batchId)
    expect(items.map((i) => i.label)).toEqual(['1', '2', '3', '4', '5', '6'])
    // the reviewer sets the cognitive level of every item (the T33 approve gate needs a level per leaf), then accepts each one
    for (const i of items) expect((await patch(teacher, `/intake/items/${i.id}`, { cognitiveLevel: 'mengaplikasi' })).status).toBe(200)
    for (const i of items) {
      const res = await post(teacher, `/intake/items/${i.id}/accept`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      questionIds.push(res.body.data.question.id as string)
    }
    expect(questionIds).toHaveLength(6)
  })

  it('2. accept made ONE stimulus group with its own question_image for the two figure questions; every question is a Draf', async () => {
    const groups = await q(`select distinct group_id::text g from questions where id = any($1::bigint[]) and group_id is not null`, [questionIds])
    expect(groups).toHaveLength(1)
    groupId = String(groups[0]!.g)
    const members = await q(`select id::text id from questions where group_id = $1 order by group_position, id`, [groupId])
    expect(members.map((r) => String(r.id))).toEqual([questionIds[0], questionIds[1]])
    const image = await q(`select f.public_id, f.purpose from stimulus_group_stimuli gs join stimuli s on s.id = gs.stimulus_id join files f on f.id = s.asset_file_id where gs.group_id = $1`, [groupId])
    expect(image).toHaveLength(1)
    expect(image[0]).toMatchObject({ purpose: 'question_image' })
    imageToken = String(image[0]!.public_id)
    const status = await q(`select distinct v.status from question_versions v where v.question_id = any($1::bigint[])`, [questionIds])
    expect(status.map((r) => r.status)).toEqual(['draft'])
  })

  it('3. the admin approves them: Semakan then Terbit pass the gates (T33 cognitive level + kertas; the Bab is given where the H-A18 gate asks for it)', async () => {
    await q(`update question_versions set paper_code = 'MATH/2', chapter_id = (select id from chapters where subject_id = question_versions.subject_id and education_level_id = question_versions.education_level_id order by id limit 1) where question_id = any($1::bigint[])`, [questionIds])
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids: questionIds })
      expect(res.status, `${action}: ${JSON.stringify(res.body)}`).toBe(200)
      expect(res.body.data, `${action}: ${JSON.stringify(res.body.data)}`).toMatchObject({ affected: 6, failed: [] })
    }
    const live = await q(`select v.status from questions qq join question_versions v on v.question_id = qq.id and v.version_no = qq.live_version_no where qq.id = any($1::bigint[])`, [questionIds])
    expect(live.map((r) => r.status)).toEqual(Array(6).fill('approved'))
  })

  it('4. once the questions are approved the pupil reads the group image; an anonymous caller does not', async () => {
    expect((await pupil.get(`/api/files/${imageToken}`)).status).toBe(200)
    expect((await request(t.app.getHttpServer()).get(`/api/files/${imageToken}`)).status).toBe(401)
  })

  it('5. the admin builds the MAT kertas 2 paper: the figure group is placed as ONE unit; the review is clean', async () => {
    for (const [i, id] of questionIds.entries()) {
      const res = await admin.put(`/api/admin/section-pools/${id}`, { pools: [i < 3 ? 'MAT2-A' : i === 3 ? 'MAT2-B' : 'MAT2-C'] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
    }
    const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    paperId = created.body.data.id as string
    const sections = ((await admin.get(`/api/admin/papers/${paperId}`)).body.data.paper.sections as { id: string }[]).map((s) => s.id)
    const place = (section: string, questionId: string) => admin.post(`/api/admin/papers/${paperId}/placements`, { sectionId: section, questionId })
    // one member brings the whole group (D90), then the solo question of Bahagian A
    const first = await place(sections[0]!, questionIds[0]!)
    expect(first.status, JSON.stringify(first.body)).toBe(201)
    expect(first.body.data.added).toEqual([questionIds[0], questionIds[1]])
    for (const [section, id] of [[0, 2], [1, 3], [2, 4], [2, 5]] as const) expect((await place(sections[section]!, questionIds[id]!)).status).toBe(201)
    const editor = (await admin.get(`/api/admin/papers/${paperId}`)).body.data
    expect(editor.paper.sections[0].questionIds).toEqual([questionIds[0], questionIds[1], questionIds[2]])
    expect(editor.groups.find((g: { id: string }) => g.id === groupId).questionIds).toEqual([questionIds[0], questionIds[1]])
    const review = (await admin.get(`/api/admin/papers/${paperId}/review`)).body.data
    expect(review, JSON.stringify(review.blockers)).toMatchObject({ ok: true, blockers: [], canOverride: false })
  })

  it('6. Terbit: the paper is published and every placement pins the version in force', async () => {
    const pub = await admin.post(`/api/admin/papers/${paperId}/publish`)
    expect(pub.body.data, JSON.stringify(pub.body)).toMatchObject({ ok: true, errors: [] })
    expect((await q(`select status from papers where id = $1`, [paperId]))[0]?.status).toBe('published')
    const pins = await q(`select pl.question_id::text id, pl.pinned_version_no n from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [paperId])
    expect(pins).toHaveLength(6)
    expect(pins.every((r) => Number(r.n) === 1)).toBe(true)
  })

  it('7. the pupil sees the paper and starts it: the figure stimulus is served ONCE with both members and a readable image; no key leaks', async () => {
    const list = await pupil.get('/api/bijak/papers')
    expect((list.body.data as { id: string }[]).some((p) => p.id === paperId)).toBe(true)
    const start = await pupil.post('/api/bijak/attempts', { paperId, mode: 'exam' })
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    attempt = start.body.data.attemptId as string
    const res = await pupil.get(`/api/bijak/attempts/${attempt}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const view = res.body.data as { questions: { id: string }[]; groups: { questionIds: string[]; stimulus: { kind: string; image?: { url: string } } }[] }
    expect(view.questions.map((x) => x.id)).toEqual(questionIds)
    expect(view.groups).toHaveLength(1)
    expect(view.groups[0]!.questionIds).toEqual([questionIds[0], questionIds[1]])
    expect(view.groups[0]!.stimulus).toMatchObject({ kind: 'diagram', image: { url: `/api/files/${imageToken}` } })
    expect(JSON.stringify(res.body)).not.toMatch(/"(correct|scheme|key|modelText)"/)
    expect((await pupil.get(view.groups[0]!.stimulus.image!.url)).status).toBe(200)
  })

  it('8. the pupil answers and submits: the MCQs are auto-marked (A 3 + B 1 + C choose 1 of 2 = 6)', async () => {
    const res = await pupil.get(`/api/bijak/attempts/${attempt}`)
    const view = res.body.data as { questions: { id: string; parts?: { id: string }[] }[] }
    const changes = view.questions.map((x) => ({ partId: x.parts?.[0]?.id ?? x.id, answer: { choice: 'B' }, rev: 1, savedAt: START }))
    const save = await pupil.put(`/api/bijak/attempts/${attempt}/answers`, { changes })
    expect(save.status, JSON.stringify(save.body)).toBe(200)
    t.clock.set('2026-10-19T09:20:00+08:00')
    const sub = await pupil.post(`/api/bijak/attempts/${attempt}/submit`, { idempotencyKey: 'chain-intake-1', changes: [] })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    const result = (await pupil.get(`/api/bijak/attempts/${attempt}/result`)).body.data.result as { score: number; max: number; provisional: boolean }
    expect(result.max).toBe(6)
    expect(result.score).toBe(6)
    expect(result.provisional).toBe(false)
  })

  it('8b. the submit paid the reward ONCE on this bank paper: one quiz_spm ledger row for the attempt (the score in syiling), the XP of the score, a streak', async () => {
    const pupilId = pupil.userId
    const rows = await q(`select user_id::text uid, amount, is_test, type from coin_ledger where source = 'quiz_spm' and source_id = $1`, [attempt])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ uid: pupilId, is_test: false, type: 'earn' })
    expect(Number(rows[0]!.amount)).toBeGreaterThan(0)
    const wallet = (await q(`select xp from wallets where user_id = $1`, [pupilId]))[0]
    expect(Number(wallet?.xp ?? 0)).toBeGreaterThanOrEqual(60) // 10 per mark of a score of 6
    expect(Number((await q(`select current from streaks where user_id = $1`, [pupilId]))[0]?.current ?? 0)).toBeGreaterThanOrEqual(1)
    // a replay of the submit is a replay: still one ledger row
    const again = await pupil.post(`/api/bijak/attempts/${attempt}/submit`, { idempotencyKey: 'chain-intake-2', changes: [] })
    expect([200, 409]).toContain(again.status)
    expect(await q(`select 1 from coin_ledger where source = 'quiz_spm' and source_id = $1`, [attempt])).toHaveLength(1)
  })

  it('9. Cuba Lagi: a NEW attempt on the same paper; the old attempt and its result stay', async () => {
    const before = await pupil.get(`/api/bijak/attempts/${attempt}/result`)
    const retry = await pupil.post(`/api/bijak/attempts/${attempt}/retry`)
    expect(retry.status, JSON.stringify(retry.body)).toBe(201)
    expect(retry.body.data.attemptId).not.toBe(attempt)
    const after = await pupil.get(`/api/bijak/attempts/${attempt}/result`)
    expect(after.body.data.result).toEqual(before.body.data.result)
  })
})
