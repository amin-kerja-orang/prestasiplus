/**
 * H-A9 / lesson RC5: "no test proved admin enters -> student sees". The R1 acceptance flow as ONE chain, over HTTP only, on the real
 * application (every feature module), a migrated Testcontainers database and the demo seed as it is (identity, curriculum, exam
 * blueprints, wallet tiers, SPM subject configs; no question seed, so the bank holds exactly the fixtures made here).
 *
 *   1  admin creates T4 questions: a D90 group (image stimulus + 2 member MCQs), a second D90 group (passage + 2 members), solo MCQs
 *      and one structured/essay question
 *   2  admin approves them (review -> approved -> [published until T04 lands])
 *   3  admin builds a MAT kertas 2 paper: places the group as a unit, reviews (structural tier), Terbit
 *   4  a grade 10 pupil lists the paper, starts, sees the stimulus ONCE with both members, answers, submits, self-marks, sees the
 *      result, does Cuba Lagi (the old sitting stays)
 *   5  the approved solo MCQs reach Databank and Latih Tubi SPM; grouped members are refused there (R1 U2)
 *
 * A step that the current tree cannot do is kept and marked `it.fails` / `it.todo` with the exact reason (R1 gap list in the report).
 */
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { SessionSchema } from '@pp/contract'
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
import { QuestionsService } from '../../src/modules/questions'
import { makePng } from '../files/fixtures'
import { createTestDatabase, type TestDatabase } from '../support/db'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/** Until T04 (approved = servable, migration 0100) lands a question must also be published to be served. Final pass: drop 'published'. */
const SERVE_STEPS = ['review', 'approved', 'published'] as const

const START = '2026-10-19T09:00:00+08:00'
const PASSWORD = 'Demo1234'

interface Client {
  csrf: string
  userId: string
  get(url: string): request.Test
  post(url: string, body?: unknown): request.Test
  put(url: string, body?: unknown): request.Test
  del(url: string): request.Test
  attach(url: string, file: Buffer): request.Test
}

let app: INestApplication
let db: TestDatabase
let clock: FixedClock
let admin: Client
let pupil: Client

async function boot(): Promise<void> {
  db = await createTestDatabase()
  await runSeeds([identitySeed, walletTiersSeed, curriculumSeed, examSeed, walletSeed, spmSubjectConfigsSeed], { prisma: db.prisma })
  const env: Record<string, string> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    FILE_STORAGE_DIR: await mkdtemp(join(tmpdir(), 'pp-chain-')),
    UPLOAD_RATE_PER_MINUTE: '1000',
    FILE_READS_PER_MINUTE: '10000',
    BIJAK_POC_QUESTIONS: 'false',
    SPM_POOL_CACHE_SECONDS: '0',
    THROTTLE_BIJAK_ATTEMPT_SAVE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_ATTEMPT_WRITE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_CHECK_PER_MINUTE: '100000',
    THROTTLE_BIJAK_GENERATE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_PAPERS_READ_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_READ_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_WRITE_PER_MINUTE: '100000',
    THROTTLE_BIJAK_BUILDER_GENERATE_PER_MINUTE: '100000',
    BIJAK_SWEEP_INTERVAL_SECONDS: '0',
  }
  for (const [k, v] of Object.entries(env)) process.env[k] = v
  clock = new FixedClock(START)
  const moduleRef = await Test.createTestingModule({ imports: [defineAppModule(featureModules)] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile()
  app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
}

async function login(identifier: string): Promise<Client> {
  const agent = request.agent(app.getHttpServer()) as unknown as TestAgent
  const res = await agent.post('/api/auth/login').send({ identifier, password: PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  const c: Client = {
    csrf: session.csrf,
    userId: session.user.id,
    get: (url) => agent.get(url),
    post: (url, body) => (body === undefined ? agent.post(url).set('X-CSRF-Token', c.csrf) : agent.post(url).set('X-CSRF-Token', c.csrf).send(body as object)),
    put: (url, body) => agent.put(url).set('X-CSRF-Token', c.csrf).send(body as object),
    del: (url) => agent.delete(url).set('X-CSRF-Token', c.csrf),
    attach: (url, file) => agent.post(url).set('X-CSRF-Token', c.csrf).attach('file', file, { filename: 'rajah.png', contentType: 'image/png' }),
  }
  return c
}

const one = async (sql: string, params: unknown[] = []): Promise<string> => String((await db.query<Record<string, string>>(sql, params))[0]?.id)

/** Curriculum facts of MATH / T4 and the ids made by the chain (filled step by step). */
const fx = {
  subject: '',
  level: '',
  unit: '',
  sp: '',
  imageToken: '',
  imageUrl: '',
  imageGroup: '',
  passageGroup: '',
  imageMembers: [] as string[],
  passageMembers: [] as string[],
  soloA: '',
  soloB: '',
  soloC: '',
  essay: '',
  paper: '',
  sections: [] as string[],
  attempt: '',
  retryAttempt: '',
}

const mcqBody = (text: string, extra: Record<string, unknown> = {}) => ({
  subjectId: fx.subject,
  educationLevelId: fx.level,
  difficultyLevel: 3,
  questionType: 'mcq',
  questionText: text,
  options: ['3', '4', '5', '6'],
  correctAnswer: 1,
  explanation: 'Penjelasan ujian rantaian R1.',
  kertas: '2',
  tag: { unitId: fx.unit, spIds: [fx.sp], tp: 3 },
  ...extra,
})

async function createQuestion(body: Record<string, unknown>): Promise<string> {
  const res = await admin.post('/api/questions', body)
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  expect(res.body.data).toMatchObject({ status: 'draft' })
  return res.body.data.id as string
}

async function advance(ids: string[]): Promise<void> {
  for (const action of SERVE_STEPS) {
    const res = await admin.post('/api/questions/bulk-action', { action, ids })
    expect(res.status, `${action}: ${JSON.stringify(res.body)}`).toBe(200)
    expect(res.body.data, action).toMatchObject({ affected: ids.length, failed: [] })
  }
}

beforeAll(async () => {
  await boot()
  admin = await login('admin@demo.test')
  pupil = await login('pelajar@demo.test')
  fx.subject = await one(`select id::text id from subjects where code = 'MATH'`)
  fx.level = await one(`select id::text id from education_levels where code = 'T4'`)
  fx.unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = $1 and education_level_id = $2 order by sort_order, id limit 1`, [fx.subject, fx.level])
  fx.sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = $1 and education_level_id = $2 order by sort_order, id limit 1`, [fx.subject, fx.level])
}, 600_000)

afterAll(async () => {
  await app?.close()
  await db?.drop()
})

describe('R1 pipeline chain: admin enters -> pupil sees', () => {
  it('the pupil is a secondary pupil (grade 10) and the admin is an admin', async () => {
    const grade = Number((await db.query<{ grade: number }>(`select grade from users where id = $1`, [pupil.userId]))[0]?.grade)
    expect([10, 11]).toContain(grade)
    expect((await admin.get('/api/questions')).status).toBe(200)
    expect((await pupil.get('/api/questions')).status).toBe(403)
  })

  describe('1. the admin creates the questions (Studio API)', () => {
    it('uploads the image stimulus file (purpose question_image)', async () => {
      const res = await admin.attach('/api/files?purpose=question_image', makePng())
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      fx.imageToken = res.body.data.id as string
      fx.imageUrl = res.body.data.url as string
      expect(fx.imageUrl).toContain(fx.imageToken)
    })

    // R1 GAP G1: no HTTP route creates a stimulus or a stimulus group. `QuestionsService.createStimulus/createStimulusGroup` have no
    // controller ("tests and later cards; no HTTP route in this contract", questions.service.ts:~500). Hand-off task (e) (Studio D90
    // groups) is not built. The group shells are therefore created through the service; the MEMBER questions use the real route
    // (`stimulusGroupId` on POST /api/questions).
    it.todo('G1: POST a stimulus + group through an admin HTTP route (missing; the group shell is made with QuestionsService below)')

    it('creates the image group (1 image stimulus) and the passage group through the service, then 2 member MCQs each over HTTP', async () => {
      const svc = app.get(QuestionsService)
      const fileId = await one(`select id::text id from files where public_id = $1`, [fx.imageToken])
      const image = await svc.createStimulus({ kind: 'image', label: 'Rajah 1', bodyMs: null, bodyEn: null, altText: 'Rajah segi empat tepat 3 cm kali 4 cm', assetFileId: BigInt(fileId) })
      fx.imageGroup = await svc.createStimulusGroup({ label: 'Rajah 1', scope: 'section', stimulusIds: [image], optionBank: [] })
      const passage = await svc.createStimulus({
        kind: 'passage',
        label: 'Petikan 1',
        bodyMs: 'Sebuah kebun berbentuk segi empat tepat mempunyai panjang 4 m dan lebar 3 m.',
        bodyEn: null,
        altText: null,
        assetFileId: null,
      })
      fx.passageGroup = await svc.createStimulusGroup({ label: 'Petikan 1', scope: 'section', stimulusIds: [passage], optionBank: [] })
      for (const [group, into, label] of [[fx.imageGroup, fx.imageMembers, 'Rajah 1'], [fx.passageGroup, fx.passageMembers, 'Petikan 1']] as const) {
        for (const n of [1, 2]) {
          into.push(await createQuestion(mcqBody(`Merujuk ${label}, berapakah nilai bagi soalan ${String(n)}?`, { stimulusGroupId: group })))
        }
      }
      const detail = await admin.get(`/api/questions/${fx.imageMembers[0]!}`)
      expect(detail.status, JSON.stringify(detail.body)).toBe(200)
      expect(detail.body.data.stimulusGroup).toMatchObject({ id: fx.imageGroup })
      expect(detail.body.data.stimulusGroup.stimuli).toHaveLength(1)
    })

    it('creates three solo MCQs (Bahagian A, B, C) and one structured/essay question with a marking scheme', async () => {
      fx.soloA = await createQuestion(mcqBody('Berapakah luas segi empat tepat 3 cm kali 4 cm, dalam cm persegi?'))
      fx.soloB = await createQuestion(mcqBody('Berapakah perimeter segi empat tepat 3 cm kali 4 cm, dalam cm?'))
      fx.soloC = await createQuestion(mcqBody('Berapakah panjang pepenjuru segi empat tepat 3 cm kali 4 cm, dalam cm?', { pointsValue: 2 }))
      const res = await admin.post('/api/questions', {
        subjectId: fx.subject,
        educationLevelId: fx.level,
        difficultyLevel: 3,
        questionType: 'essay',
        questionText: 'Terangkan cara mengira luas segi empat tepat dan tunjukkan langkah kerja anda.',
        kertas: '2',
        tag: { unitId: fx.unit, spIds: [fx.sp], tp: 3 },
        parts: [
          {
            label: 'a',
            mode: 'working',
            prompt: { ms: 'Kira luas segi empat tepat itu.' },
            marks: 2,
            key: {
              kind: 'points',
              marks: 2,
              points: [
                { id: 'p1', code: 'M', label: 'Darabkan panjang dengan lebar', marks: 1, text: { ms: 'panjang darab lebar' } },
                { id: 'p2', code: 'N', label: '12 cm persegi', marks: 1, text: { ms: '12 cm persegi' } },
              ],
            },
          },
        ],
      })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      fx.essay = res.body.data.id as string
    })
  })

  describe('2. the admin approves them', () => {
    it('review -> approved -> (published) through the bulk-action route; every question ends servable', async () => {
      const all = [...fx.imageMembers, ...fx.passageMembers, fx.soloA, fx.soloB, fx.soloC, fx.essay]
      await advance(all)
      const rows = await db.query<{ status: string; live: number | null }>(
        `select v.status, q.live_version_no live from questions q join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no where q.id = any($1::bigint[])`,
        [all],
      )
      expect(rows).toHaveLength(all.length)
      expect(rows.every((r) => r.live === 1)).toBe(true)
    })
  })

  describe('3. the admin builds the paper (b09a routes)', () => {
    it('creates a MAT kertas 2 paper from the active blueprint', async () => {
      const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      fx.paper = res.body.data.id as string
      const e = await admin.get(`/api/admin/papers/${fx.paper}`)
      expect(e.status, JSON.stringify(e.body)).toBe(200)
      fx.sections = (e.body.data.paper.sections as { id: string }[]).map((s) => s.id)
      expect(fx.sections).toHaveLength(3)
    })

    it('the pool offers the approved questions of the paper subject and kertas', async () => {
      const e = await admin.get(`/api/admin/papers/${fx.paper}`)
      const offered = (e.body.data.questions as { id: string }[]).map((q) => q.id)
      for (const id of [...fx.passageMembers, fx.soloA, fx.soloB, fx.soloC, fx.essay]) expect(offered, id).toContain(id)
    })

    it('places the passage group as ONE unit (one member brings the whole group), then the solo questions and the essay', async () => {
      const [a, b, c] = fx.sections as [string, string, string]
      const place = (sectionId: string, questionId: string) => admin.post(`/api/admin/papers/${fx.paper}/placements`, { sectionId, questionId })
      const g = await place(a, fx.passageMembers[1]!) // the SECOND member names the group
      expect(g.status, JSON.stringify(g.body)).toBe(201)
      expect(g.body.data.added).toEqual(fx.passageMembers)
      const s = await place(a, fx.soloA)
      expect(s.status, JSON.stringify(s.body)).toBe(201)
      expect((await place(b, fx.soloB)).status).toBe(201)
      expect((await place(c, fx.soloC)).status).toBe(201)
      const e = await place(c, fx.essay)
      expect(e.status, JSON.stringify(e.body)).toBe(201)
      const editor = e.body.data.editor.paper.sections as { questionIds: string[] }[]
      expect(editor[0]!.questionIds).toEqual([...fx.passageMembers, fx.soloA])
      expect(editor[1]!.questionIds).toEqual([fx.soloB])
      expect(editor[2]!.questionIds).toEqual([fx.soloC, fx.essay])
      // a single member of a placed group cannot be placed again
      expect((await place(b, fx.passageMembers[0]!)).status).toBe(422)
    })

    it('the review (structural tier) has no blocker, shows every row ok and the paper is not visible yet', async () => {
      const res = await admin.get(`/api/admin/papers/${fx.paper}/review`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toMatchObject({ ok: true, blockers: [], status: 'draf', visibleToStudents: false })
      expect((res.body.data.rows as { ok: boolean }[]).every((r) => r.ok)).toBe(true)
      expect((res.body.data.rows as unknown[]).length).toBe(6)
      const list = await pupil.get('/api/bijak/papers')
      expect(list.status).toBe(200)
      expect((list.body.data as { id: string }[]).some((p) => p.id === fx.paper)).toBe(false)
    })

    it('the student view of the draft shows the stimulus once with both members', async () => {
      const res = await admin.get(`/api/admin/papers/${fx.paper}/student-view`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const units = res.body.data.sections[0].units as { groupId?: string; questions: { id: string }[] }[]
      const group = units.find((u) => u.groupId !== undefined)!
      expect(group.questions.map((x) => x.id)).toEqual(fx.passageMembers)
    })

    it('Terbit: the publish answers ok and the paper is Terbit', async () => {
      const res = await admin.post(`/api/admin/papers/${fx.paper}/publish`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toMatchObject({ ok: true, errors: [] })
      // Structural tier only: the Spec blueprint still needs review, and the fixtures carry no section pool tag (MAT2-A/B/C), which
      // the builder reports as non-blocking notes. R1 GAP G3: no admin HTTP route writes a pool tag, so the notes cannot be cleared.
      expect(res.body.data.blueprintNeedsReview).toBe(true)
      expect((res.body.data.notes as string[]).every((n) => n.includes('bukan dalam kolam bahagian ini'))).toBe(true)
      expect((await db.query<{ status: string }>(`select status from papers where id = $1`, [fx.paper]))[0]?.status).toBe('published')
      const pins = await db.query<{ v: number }>(`select pinned_version_no v from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [fx.paper])
      expect(pins).toHaveLength(6)
      expect(pins.every((p) => p.v === 1)).toBe(true)
    })
  })

  describe('3b. the image group (D90) on a paper', () => {
    // R1 GAP G2 (b08-bridge, `r1/b08-bridge` ab04b498, is not merged): the placement route accepts the image group and Terbit works,
    // but the Bijak bridge refuses an IMAGE stimulus ("an image stimulus cannot be shown yet", question-bridge/be09-mapping.ts:~228;
    // the attempt contract has only diagram|passage|table, no file URL), so the pupil cannot sit a paper that holds the image group:
    // POST /bijak/attempts answers 403 "This action is unauthorized." for a Terbit paper (no BM reason), and the admin publish check
    // does not warn about it either.
    let imagePaper = ''
    it('the builder places the image group as one unit and Terbit works (structural tier)', async () => {
      const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
      expect(created.status).toBe(201)
      imagePaper = created.body.data.id as string
      const sections = ((await admin.get(`/api/admin/papers/${imagePaper}`)).body.data.paper.sections as { id: string }[]).map((x) => x.id)
      const place = (sectionId: string, questionId: string) => admin.post(`/api/admin/papers/${imagePaper}/placements`, { sectionId, questionId })
      const g = await place(sections[0]!, fx.imageMembers[0]!)
      expect(g.status, JSON.stringify(g.body)).toBe(201)
      expect(g.body.data.added).toEqual(fx.imageMembers)
      for (const [sec, q] of [[0, fx.soloA], [1, fx.soloB], [2, fx.soloC], [2, fx.essay]] as const) expect((await place(sections[sec]!, q)).status).toBe(201)
      const pub = await admin.post(`/api/admin/papers/${imagePaper}/publish`)
      expect(pub.status, JSON.stringify(pub.body)).toBe(200)
      expect(pub.body.data.ok).toBe(true)
    })

    it.fails('G2: the pupil starts the image-group paper and is served the image stimulus once with both members', async () => {
      const start = await pupil.post('/api/bijak/attempts', { paperId: imagePaper, mode: 'exam' })
      expect(start.status, JSON.stringify(start.body)).toBe(201)
      const view = await pupil.get(`/api/bijak/attempts/${start.body.data.attemptId as string}`)
      expect(view.status).toBe(200)
      expect(view.body.data.groups).toHaveLength(1)
      expect(view.body.data.groups[0].questionIds).toEqual(fx.imageMembers)
      expect(JSON.stringify(view.body.data.groups[0].stimulus)).toContain(fx.imageToken)
    })
  })

  describe('4. the pupil sits the paper', () => {
    let view: { questions: { id: string; groupId?: string; mcq?: { options: { id: string }[] }; parts?: { id: string }[] }[]; groups: { questionIds: string[]; stimulus: Record<string, unknown> }[] }

    it('sees the paper in the Bijak SPM list and on its cover', async () => {
      const list = await pupil.get('/api/bijak/papers')
      expect(list.status, JSON.stringify(list.body)).toBe(200)
      expect((list.body.data as { id: string; code: string; questionCount: number }[]).find((p) => p.id === fx.paper)).toMatchObject({ code: '1449/2', questionCount: 6 })
      const cover = await pupil.get(`/api/bijak/papers/${fx.paper}`)
      expect(cover.status, JSON.stringify(cover.body)).toBe(200)
    })

    it('starts an attempt: the group stimulus is served ONCE with both members; no answer key leaks', async () => {
      const start = await pupil.post('/api/bijak/attempts', { paperId: fx.paper, mode: 'exam' })
      expect(start.status, JSON.stringify(start.body)).toBe(201)
      fx.attempt = start.body.data.attemptId as string
      const res = await pupil.get(`/api/bijak/attempts/${fx.attempt}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      view = res.body.data
      expect(view.questions.map((q) => q.id)).toEqual([...fx.passageMembers, fx.soloA, fx.soloB, fx.soloC, fx.essay])
      expect(view.groups).toHaveLength(1)
      expect(view.groups[0]!.questionIds).toEqual(fx.passageMembers)
      expect(view.groups[0]!.stimulus).toMatchObject({ kind: 'passage', label: 'Petikan 1' })
      expect(JSON.stringify(res.body)).not.toMatch(/"(correct|scheme|key|modelText)"/)
    })

    // R1 GAP G2 (continued): the image URL of a group stimulus is not part of the attempt view contract at all (kinds
    // diagram|passage|table, no file URL), so the pupil cannot be served an image stimulus. The FILE itself is readable (next test).
    it.todo('G2: the attempt view serves the group image stimulus as a URL (contract has no image kind; r1/b08-bridge not merged)')

    it('the group image file is readable by the pupil once its member question is live (R1-B20), and by no anonymous caller', async () => {
      expect((await pupil.get(fx.imageUrl)).status).toBe(200)
      expect((await admin.get(fx.imageUrl)).status).toBe(200)
      expect((await request(app.getHttpServer()).get(fx.imageUrl)).status).toBe(401)
    })

    it('answers every question and submits', async () => {
      const mcqPart = (q: { id: string; mcq?: unknown; parts?: { id: string }[] }) => q.parts?.[0]?.id ?? q.id
      // Bahagian C is "choose 1 of 2" (best attempted by marks, ties to the lower position): the pupil leaves the MCQ blank and answers the
      // structured question, so that one is the counted question the self-mark applies to.
      const changes = view.questions.filter((q) => q.id !== fx.soloC).map((q) =>
        q.mcq !== undefined
          ? { partId: mcqPart(q), answer: { choice: 'B' }, rev: 1, savedAt: START }
          : { partId: mcqPart(q), answer: { steps: ['3 x 4'], final: '12 cm persegi', text: 'panjang darab lebar ialah 12 cm persegi' }, rev: 1, savedAt: START },
      )
      const save = await pupil.put(`/api/bijak/attempts/${fx.attempt}/answers`, { changes })
      expect(save.status, JSON.stringify(save.body)).toBe(200)
      clock.set('2026-10-19T09:20:00+08:00')
      const sub = await pupil.post(`/api/bijak/attempts/${fx.attempt}/submit`, { idempotencyKey: 'chain-1', changes: [] })
      expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    })

    let essayPart = ''
    it('sees the result: MCQs auto-marked, the structured part waits for self-mark with a suggestion', async () => {
      const res = await pupil.get(`/api/bijak/attempts/${fx.attempt}/result`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const r = res.body.data.result as { score: number; max: number; provisional: boolean; pendingReview: number; questions: { questionId: string; marks: number; awarded: number; parts: { partId: string; status: string; selfMarkable?: boolean; suggestion?: unknown }[] }[] }
      expect(r.max).toBe(3 + 1 + 2) // A: 3 x 1, B: 1, C: choose 1 of 2 (2 marks)
      const byQ = new Map(r.questions.map((q) => [q.questionId, q]))
      for (const id of [...fx.passageMembers, fx.soloA, fx.soloB]) expect(byQ.get(id), id).toMatchObject({ marks: 1, awarded: 1 })
      const essay = byQ.get(fx.essay)!
      essayPart = essay.parts[0]!.partId
      expect(essay.parts[0]).toMatchObject({ status: 'belum_dimarkah', selfMarkable: true, autoSuggested: true, awarded: 2 })
      expect(essay.parts[0]!.suggestion).toMatchObject({ suggestedMark: 2, matched: 2, total: 2 })
      expect(r.score).toBe(6)
      expect(r.provisional).toBe(true)
      expect(r.pendingReview).toBeGreaterThanOrEqual(1)
    })

    it('self-marks the structured part (b12) and the total is recomputed', async () => {
      const res = await pupil.post(`/api/bijak/attempts/${fx.attempt}/self-mark`, { partId: essayPart, mark: 1 })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toMatchObject({ partId: essayPart, awarded: 1, max: 2, status: 'separa', attemptScore: 5, attemptMax: 6, provisional: false, pendingReview: 0 })
      const again = await pupil.get(`/api/bijak/attempts/${fx.attempt}/result`)
      const part = (again.body.data.result.questions as { questionId: string; parts: { partId: string; selfMarked?: boolean; awarded: number }[] }[]).find((q) => q.questionId === fx.essay)!.parts[0]!
      expect(part).toMatchObject({ awarded: 1, selfMarked: true })
    })

    it('Cuba Lagi: a NEW attempt on the same paper; the old attempt, its result and its history row stay', async () => {
      const before = await pupil.get(`/api/bijak/attempts/${fx.attempt}/result`)
      const retry = await pupil.post(`/api/bijak/attempts/${fx.attempt}/retry`)
      expect(retry.status, JSON.stringify(retry.body)).toBe(201)
      fx.retryAttempt = retry.body.data.attemptId as string
      expect(fx.retryAttempt).not.toBe(fx.attempt)
      const fresh = await pupil.get(`/api/bijak/attempts/${fx.retryAttempt}`)
      expect(fresh.status).toBe(200)
      expect(fresh.body.data.attempt).toMatchObject({ paperId: fx.paper, status: 'in_progress', mode: 'exam' })
      const after = await pupil.get(`/api/bijak/attempts/${fx.attempt}/result`)
      expect(after.body.data.result).toEqual(before.body.data.result)
      const past = await pupil.get(`/api/bijak/papers/${fx.paper}/attempts`)
      expect(past.status, JSON.stringify(past.body)).toBe(200)
      expect((past.body.data.sittings as { attemptId: string }[]).map((s) => s.attemptId)).toContain(fx.attempt)
    })
  })

  describe('5. the approved MCQs reach Databank and Latih Tubi SPM; grouped members do not (R1 U2)', () => {
    const solos = () => [fx.soloA, fx.soloB, fx.soloC]

    it('Databank and Latih Tubi SPM count exactly the solo MCQs (grouped members and the essay are not counted)', async () => {
      const databank = await pupil.get('/api/spm/databank')
      expect(databank.status, JSON.stringify(databank.body)).toBe(200)
      expect((databank.body.data as { code: string; databankCount: number }[]).find((d) => d.code === 'MATH')?.databankCount).toBe(solos().length)
      const lt = await pupil.get('/api/spm/latih-tubi/MATH')
      expect(lt.status, JSON.stringify(lt.body)).toBe(200)
      expect(lt.body.data.total).toBe(solos().length)
    })

    it('a Latih Tubi SPM session draws the solo MCQs and NONE of the D90 group members (explicit refusal)', async () => {
      const res = await pupil.post('/api/practice/sessions', { mode: 'latih_tubi', subjectCode: 'MATH', count: 40 })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const served = (res.body.data.questions as { id: string }[]).map((q) => q.id).sort()
      expect(served).toEqual(solos().sort())
      for (const member of [...fx.imageMembers, ...fx.passageMembers]) expect(served).not.toContain(member)
      expect(served).not.toContain(fx.essay)
    })

    it('a Databank (Tahun Lepas) session draws the same set', async () => {
      const res = await pupil.post('/api/practice/sessions', { mode: 'past_year', subjectCode: 'MATH', count: 10 })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const served = (res.body.data.questions as { id: string }[]).map((q) => q.id).sort()
      expect(served).toEqual(solos().sort())
    })

    it('"Buka Soalan Sama" on a grouped member is refused (422), on a solo MCQ it opens', async () => {
      const refused = await pupil.post('/api/practice/sessions', { mode: 'latih_tubi', subjectCode: 'MATH', count: 1, targetQuestionId: fx.passageMembers[0] })
      expect(refused.status, JSON.stringify(refused.body)).toBe(422)
      const opened = await pupil.post('/api/practice/sessions', { mode: 'latih_tubi', subjectCode: 'MATH', count: 1, targetQuestionId: fx.soloA })
      expect(opened.status, JSON.stringify(opened.body)).toBe(201)
    })

    // R1 U2 / R2: serving group members together with their stimulus in Databank / Latih Tubi is R2 (D90 in the practice family).
    it.todo('R2: grouped members appear in Databank / Latih Tubi SPM WITH their stimulus (today they are refused: ungrouped filter)')
  })
})
