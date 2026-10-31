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
import { makePng } from '../files/fixtures'
import { createTestDatabase, type TestDatabase } from '../support/db'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/** Approved is servable (T04, migration 0100): review -> approved is the whole path. */
const SERVE_STEPS = ['review', 'approved'] as const

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
let pupil5: Client

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
  kertas: '3',
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
  pupil5 = await login('pelajarmaju@demo.test')
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

    // G1 (closed by T32): the Studio authors stimuli and groups over HTTP: POST /api/stimuli, then POST /api/stimulus-groups with the
    // ids of 1 to 3 stimuli and at least 2 existing member questions (D90: one stimulus shown once, no marks on the group).
    it('creates the image stimulus and the passage stimulus (POST /api/stimuli), 4 member MCQs, then the two groups (POST /api/stimulus-groups)', async () => {
      const image = await admin.post('/api/stimuli', { kind: 'image', label: 'Rajah 1', caption: 'Segi empat tepat', alt: 'Rajah segi empat tepat 3 cm kali 4 cm', imageFileId: fx.imageToken })
      expect(image.status, JSON.stringify(image.body)).toBe(201)
      expect(image.body.data).toMatchObject({ kind: 'image', label: 'Rajah 1', imageId: fx.imageToken, groupCount: 0 })
      const passage = await admin.post('/api/stimuli', {
        kind: 'passage',
        label: 'Petikan 1',
        body: { ms: 'Sebuah kebun berbentuk segi empat tepat mempunyai panjang 4 m dan lebar 3 m.' },
      })
      expect(passage.status, JSON.stringify(passage.body)).toBe(201)
      for (const [into, label] of [[fx.imageMembers, 'Rajah 1'], [fx.passageMembers, 'Petikan 1']] as const) {
        for (const n of [1, 2]) into.push(await createQuestion(mcqBody(`Merujuk ${label}, berapakah nilai bagi soalan ${String(n)}?`)))
      }
      const imageGroup = await admin.post('/api/stimulus-groups', { label: 'Rajah 1', scope: 'section', stimulusIds: [image.body.data.id], questionIds: fx.imageMembers })
      expect(imageGroup.status, JSON.stringify(imageGroup.body)).toBe(201)
      expect(imageGroup.body.data).toMatchObject({ label: 'Rajah 1', questionIds: fx.imageMembers })
      fx.imageGroup = imageGroup.body.data.id as string
      const passageGroup = await admin.post('/api/stimulus-groups', { label: 'Petikan 1', scope: 'section', stimulusIds: [passage.body.data.id], questionIds: fx.passageMembers })
      expect(passageGroup.status, JSON.stringify(passageGroup.body)).toBe(201)
      fx.passageGroup = passageGroup.body.data.id as string
      // a group needs at least 2 members and a stimulus; a bad body is 422
      expect((await admin.post('/api/stimulus-groups', { stimulusIds: [image.body.data.id], questionIds: [fx.imageMembers[0]] })).status).toBe(422)
      expect((await pupil.post('/api/stimulus-groups', { stimulusIds: [image.body.data.id], questionIds: fx.imageMembers })).status).toBe(403)
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
        kertas: '3',
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

  // R1-20.1 / AC-R1-16.2 (T43): the Kontrak is created, given evidence and made Disahkan over the real API; nothing is seeded Disahkan by SQL.
  describe('2b. the admin makes a Kontrak Disahkan (create, evidence, verify)', () => {
    // Each section carries the full standard (pool tag, TP profile, unit quota, KBAT) so the Kontrak can be verified (AC-R1-15.2).
    const section = (label: string, pool: string, markBudget: number, questionCount: number, rule: { type: 'all' } | { type: 'choose'; n: number }) => ({
      label,
      pool,
      markBudget,
      questionCount,
      rule,
      profile: { kind: 'bahagian', groups: [{ from: 1, to: questionCount, tpMin: 1, tpMax: 6 }] },
      quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: fx.unit }, value: questionCount }] },
      kbatMarks: 0,
    })
    const sections = () => [
      section('Bahagian A', 'MAT3-A', 3, 3, { type: 'all' }),
      section('Bahagian B', 'MAT3-B', 1, 1, { type: 'all' }),
      section('Bahagian C', 'MAT3-C', 2, 2, { type: 'choose', n: 1 }),
    ]

    it('creates the Kontrak MAT kertas 3 as Spec; a Spec Kontrak does not serve pupils yet', async () => {
      const res = await admin.post('/api/admin/blueprints', { subject: 'MAT', kertas: 3, source: 'Spec', code: 'MAT/E2E', durationMin: 90, instructions: ['Jawab semua soalan.'], sections: sections() })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.data).toMatchObject({ source: 'Spec', servesStudents: false, code: 'MAT/E2E' })
    })

    it('verify is refused without evidence, then Disahkan with a body-format (LPM) evidence item that states every compared value', async () => {
      const refused = await admin.post('/api/admin/blueprints/MAT/3/verify', { note: 'Semakan awal tanpa bukti.' })
      expect(refused.status, JSON.stringify(refused.body)).toBeGreaterThanOrEqual(400)
      const evidence = await admin.post('/api/admin/blueprints/MAT/3/evidence', {
        kind: 'lpm_format',
        body: 'lpm',
        year: 2025,
        paperCode: '1449/2',
        values: { durationMin: 90, totalMarks: 6, sections: sections().map((x, i) => ({ position: i + 1, markBudget: x.markBudget, rule: x.rule, questionCount: x.questionCount })) },
      })
      expect(evidence.status, JSON.stringify(evidence.body)).toBe(201)
      const verified = await admin.post('/api/admin/blueprints/MAT/3/verify', { note: 'Struktur disemak dengan dokumen format LPM.' })
      expect(verified.status, JSON.stringify(verified.body)).toBe(200)
      expect(verified.body.data).toMatchObject({ source: 'Disahkan', servesStudents: true })
      expect((await db.query<{ source: string; serves_students: boolean }>(`select source, serves_students from blueprints where code = 'MAT/E2E'`))[0]).toMatchObject({ source: 'verified', serves_students: true })
    })
  })

  describe('3. the admin builds the paper (b09a routes)', () => {
    it('creates a MAT kertas 3 paper from the Disahkan Kontrak made in step 2b', async () => {
      const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 3 })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      fx.paper = res.body.data.id as string
      const e = await admin.get(`/api/admin/papers/${fx.paper}`)
      expect(e.status, JSON.stringify(e.body)).toBe(200)
      fx.sections = (e.body.data.paper.sections as { id: string }[]).map((s) => s.id)
      expect(fx.sections).toHaveLength(3)
    })

    // G3 (closed by T34): the admin gives each question its section pool (Bahagian A/B/C of the Kontrak) over HTTP.
    it('tags the section pools of the questions (PUT /api/admin/section-pools/:id)', async () => {
      const plan: [string, string][] = [
        ...fx.passageMembers.map((id): [string, string] => [id, 'MAT3-A']),
        ...fx.imageMembers.map((id): [string, string] => [id, 'MAT3-A']),
        [fx.soloA, 'MAT3-A'],
        [fx.soloB, 'MAT3-B'],
        [fx.soloC, 'MAT3-C'],
        [fx.essay, 'MAT3-C'],
      ]
      for (const [id, pool] of plan) {
        const res = await admin.put(`/api/admin/section-pools/${id}`, { pools: [pool] })
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        expect(res.body.data.pools).toEqual([pool])
      }
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
      // AC-R1-16.2: the Kontrak is Disahkan (step 2b), so a plain Terbit works: no override.
      const res = await admin.post(`/api/admin/papers/${fx.paper}/publish`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data).toMatchObject({ ok: true, errors: [] })
      expect(res.body.data.overridden).toBeUndefined()
      // Structural tier. With the section pools tagged (previous step) there is no "bukan dalam kolam bahagian ini" note any more.
      expect((res.body.data.notes ?? []).some((n: string) => n.includes('bukan dalam kolam bahagian ini'))).toBe(false)
      expect((await db.query<{ status: string }>(`select status from papers where id = $1`, [fx.paper]))[0]?.status).toBe('published')
      const pins = await db.query<{ v: number }>(`select pinned_version_no v from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [fx.paper])
      expect(pins).toHaveLength(6)
      expect(pins.every((p) => p.v === 1)).toBe(true)
    })
  })

  describe('3b. the image group (D90) on a paper', () => {
    // G2 (image stimulus in a Bijak attempt) was an R1 gap on the base (the bridge refused an image stimulus and the pupil got 403 on start);
    // it is closed by b08 (merged with T04). Kept as a plain test so it cannot regress.
    let imagePaper = ''
    it('the builder places the image group as one unit and Terbit works (structural tier)', async () => {
      const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 3 })
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

    // R1-T31: the builder wire carries `stimuli[]` (1 to 3, D90) with the public file URL of a picture, so the admin preview shows it.
    it('the admin student view (pupil preview) of the published image paper shows the image stimulus once, with a readable /api/files/<token> URL', async () => {
      const res = await admin.get(`/api/admin/papers/${imagePaper}/student-view`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const units = res.body.data.sections[0].units as { groupId?: string; stimulus?: { kind: string }; stimuli?: { kind: string; label: string; image?: { url: string } }[]; questions: { id: string }[] }[]
      const grouped = units.filter((u) => u.groupId !== undefined)
      expect(grouped).toHaveLength(1)
      const unit = grouped[0]!
      expect(unit.groupId).toBe(fx.imageGroup)
      expect(unit.questions.map((q) => q.id)).toEqual(fx.imageMembers)
      expect(unit.stimuli).toHaveLength(1)
      expect(unit.stimuli![0]).toMatchObject({ kind: 'image', label: 'Rajah 1', caption: 'Segi empat tepat', image: { url: `/api/files/${fx.imageToken}` } })
      expect(unit.stimulus).toEqual(unit.stimuli![0]) // `stimulus` is the first of `stimuli`
      const url = unit.stimuli![0]!.image!.url
      expect(url).toMatch(/^\/api\/files\/[^/]+$/)
      expect(url).toBe(fx.imageUrl)
      expect((await admin.get(url)).status).toBe(200)
      expect((await request(app.getHttpServer()).get(url)).status).toBe(401)
    })

    it('the admin editor data and the picker carry the same image stimulus on the group (stimuli[])', async () => {
      const e = await admin.get(`/api/admin/papers/${imagePaper}`)
      expect(e.status, JSON.stringify(e.body)).toBe(200)
      const group = (e.body.data.groups as { id: string; stimulus: { kind: string }; stimuli?: { kind: string; image?: { url: string } }[]; questionIds: string[] }[]).find((g) => g.id === fx.imageGroup)
      expect(group, JSON.stringify(e.body.data.groups)).toBeDefined()
      expect(group!.questionIds).toEqual(fx.imageMembers)
      expect(group!.stimuli).toHaveLength(1)
      expect(group!.stimuli![0]).toMatchObject({ kind: 'image', image: { url: fx.imageUrl } })
      expect(group!.stimulus).toMatchObject({ kind: 'image' })
    })

    it('the pupil starts the image-group paper and is served the image stimulus ONCE with both members, with a readable URL', async () => {
      const start = await pupil.post('/api/bijak/attempts', { paperId: imagePaper, mode: 'exam' })
      expect(start.status, JSON.stringify(start.body)).toBe(201)
      const view = await pupil.get(`/api/bijak/attempts/${start.body.data.attemptId as string}`)
      expect(view.status).toBe(200)
      expect(view.body.data.groups).toHaveLength(1)
      expect(view.body.data.groups[0].questionIds).toEqual(fx.imageMembers)
      const stimulus = view.body.data.groups[0].stimulus as { kind: string; label: string; image?: { url: string } }
      expect(stimulus).toMatchObject({ kind: 'image', label: 'Rajah 1', image: { url: fx.imageUrl } })
      // the pupil reads the image through the URL the attempt view gave
      expect((await pupil.get(stimulus.image!.url)).status).toBe(200)
      expect((await request(app.getHttpServer()).get(stimulus.image!.url)).status).toBe(401)
    })
  })

  describe('4. the pupil sits the paper', () => {
    let view: { questions: { id: string; groupId?: string; mcq?: { options: { id: string }[] }; parts?: { id: string }[] }[]; groups: { questionIds: string[]; stimulus: Record<string, unknown> }[] }

    it('sees the paper in the Bijak SPM list and on its cover', async () => {
      const list = await pupil.get('/api/bijak/papers')
      expect(list.status, JSON.stringify(list.body)).toBe(200)
      expect((list.body.data as { id: string; code: string; questionCount: number }[]).find((p) => p.id === fx.paper)).toMatchObject({ code: 'MAT/E2E', questionCount: 6 })
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

  // R1-20.1: a Tingkatan 4 AND a Tingkatan 5 pupil each sit the paper (objective and written parts), submit, self-mark and see the result.
  describe('4b. a Tingkatan 5 pupil sits the same paper', () => {
    let attempt = ''
    let essayPart = ''

    it('is a Tingkatan 5 pupil (grade 11) who sees the paper in the list', async () => {
      expect((await db.query<{ grade: number }>(`select grade from users where id = $1`, [pupil5.userId]))[0]?.grade).toBe(11)
      const list = await pupil5.get('/api/bijak/papers')
      expect(list.status, JSON.stringify(list.body)).toBe(200)
      expect((list.body.data as { id: string }[]).some((p) => p.id === fx.paper)).toBe(true)
    })

    it('answers every question (the structured part with working) and submits', async () => {
      const start = await pupil5.post('/api/bijak/attempts', { paperId: fx.paper, mode: 'exam' })
      expect(start.status, JSON.stringify(start.body)).toBe(201)
      attempt = start.body.data.attemptId as string
      const view = (await pupil5.get(`/api/bijak/attempts/${attempt}`)).body.data as { questions: { id: string; mcq?: unknown; parts?: { id: string }[] }[] }
      const changes = view.questions.filter((q) => q.id !== fx.soloC).map((q) =>
        q.mcq !== undefined
          ? { partId: q.parts?.[0]?.id ?? q.id, answer: { choice: 'B' }, rev: 1, savedAt: START }
          : { partId: q.parts?.[0]?.id ?? q.id, answer: { steps: ['3 x 4'], final: '12 cm persegi', text: 'panjang darab lebar ialah 12 cm persegi' }, rev: 1, savedAt: START },
      )
      expect((await pupil5.put(`/api/bijak/attempts/${attempt}/answers`, { changes })).status).toBe(200)
      const sub = await pupil5.post(`/api/bijak/attempts/${attempt}/submit`, { idempotencyKey: 'chain-t5', changes: [] })
      expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    })

    it('sees the result, self-marks the written part and presses "Cuba Lagi"', async () => {
      const res = await pupil5.get(`/api/bijak/attempts/${attempt}/result`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const r = res.body.data.result as { max: number; score: number; provisional: boolean; questions: { questionId: string; parts: { partId: string }[] }[] }
      expect(r.max).toBe(6)
      expect(r.provisional).toBe(true)
      essayPart = r.questions.find((q) => q.questionId === fx.essay)!.parts[0]!.partId
      const mark = await pupil5.post(`/api/bijak/attempts/${attempt}/self-mark`, { partId: essayPart, mark: 2 })
      expect(mark.status, JSON.stringify(mark.body)).toBe(200)
      expect(mark.body.data).toMatchObject({ awarded: 2, provisional: false })
      const retry = await pupil5.post(`/api/bijak/attempts/${attempt}/retry`)
      expect(retry.status, JSON.stringify(retry.body)).toBe(201)
      expect(retry.body.data.attemptId).not.toBe(attempt)
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

  // R1-20.2: the same with Jana Kertas under the Disahkan Kontrak (exact-or-refuse).
  describe('6. Jana Kertas under the Disahkan Kontrak (pupil)', () => {
    it('a Tingkatan 4 and a Tingkatan 5 pupil each generate a private paper from the approved pool and start it', async () => {
      const made: string[] = []
      for (const who of [pupil, pupil5]) {
        const res = await who.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 3 })
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        const id = res.body.data.paperId as string
        made.push(id)
        const start = await who.post('/api/bijak/attempts', { paperId: id, mode: 'exam' })
        expect(start.status, JSON.stringify(start.body)).toBe(201)
      }
      expect(new Set(made).size).toBe(2)
      // a generated paper is private: not in the Kertas Pilihan list, and another pupil gets 404
      expect(((await pupil.get('/api/bijak/papers')).body.data as { id: string }[]).some((p) => made.includes(p.id))).toBe(false)
      expect((await pupil5.get(`/api/bijak/papers/${made[0]}`)).status).toBe(404)
    })

    // R1-20.2 (exact-or-refuse): a Disahkan Kontrak whose pool cannot fill a section gives 422 SHORTAGE with the shortage list in BM, never a
    // short paper and no paper row; the admin sees the same shortfall in "Pratonton kolam".
    it('a short pool is refused with SHORTAGE and the shortfall (no paper is made); the admin preview names it', async () => {
      const need = 5
      const create = await admin.post('/api/admin/blueprints', {
        subject: 'MAT',
        kertas: 4,
        source: 'Spec',
        code: 'MAT/E2E-S',
        durationMin: 30,
        instructions: ['Jawab semua soalan.'],
        sections: [
          {
            label: 'Bahagian A',
            pool: 'MAT4-A',
            markBudget: need,
            questionCount: need,
            rule: { type: 'all' },
            profile: { kind: 'bahagian', groups: [{ from: 1, to: need, tpMin: 1, tpMax: 6 }] },
            quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: fx.unit }, value: need }] },
            kbatMarks: 0,
          },
        ],
      })
      expect(create.status, JSON.stringify(create.body)).toBe(201)
      const ev = await admin.post('/api/admin/blueprints/MAT/4/evidence', {
        kind: 'lpm_format',
        body: 'lpm',
        year: 2025,
        paperCode: '1449/4',
        values: { durationMin: 30, totalMarks: need, sections: [{ position: 1, markBudget: need, rule: { type: 'all' }, questionCount: need }] },
      })
      expect(ev.status, JSON.stringify(ev.body)).toBe(201)
      const ok = await admin.post('/api/admin/blueprints/MAT/4/verify', { note: 'Struktur disemak dengan dokumen format LPM.' })
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)

      const before = Number((await db.query<{ n: string }>(`select count(*) n from papers where kind = 'jana'`))[0]!.n)
      for (const who of [pupil, pupil5]) {
        const res = await who.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 4 })
        expect(res.status, JSON.stringify(res.body)).toBe(422)
        expect(res.body.error).toMatchObject({ code: 'SHORTAGE', message: 'Kertas tidak dapat dijana kerana soalan tidak mencukupi.' })
        expect(res.body.error.details.shortages).toEqual([expect.objectContaining({ section: 'Bahagian A', kind: 'count', need, have: 0 })])
      }
      expect(Number((await db.query<{ n: string }>(`select count(*) n from papers where kind = 'jana'`))[0]!.n)).toBe(before)

      const preview = await admin.get('/api/admin/papers/pool-preview?subject=MAT&kertas=4')
      expect(preview.status, JSON.stringify(preview.body)).toBe(200)
      expect(preview.body.data.verdict).not.toBe('boleh')
      expect(preview.body.data.firstFailure).toMatchObject({ section: 'Bahagian A', need })
    })

    it('only a Disahkan Kontrak is offered: a Spec Kontrak (the seeded MAT kertas 1) is refused with NO_BLUEPRINT', async () => {
      const res = await pupil.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.code).toBe('NO_BLUEPRINT')
    })
  })

  // R1-20.3 negatives.
  describe('7. negatives: the T33 gate, a draft is invisible, a withdrawn paper', () => {
    // T33 (branch r1/t33-leaf-tags @ 276a6622, not in this base): the DSKP approve gate for SPM T4/T5.
    it.todo('a question without a DSKP tag cannot be approved (AC-R1-20.3, T33 merged approve gate, POST /api/questions/bulk-action approved -> 422)')

    it('a draft paper is not visible to a pupil; a withdrawn paper is gone for the pupil and cannot be retried, but the past attempt and its result stay (R1-20.3)', async () => {
      const draft = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 3 })
      expect(draft.status).toBe(201)
      expect((await pupil.get(`/api/bijak/papers/${draft.body.data.id as string}`)).status).toBe(404)

      expect((await admin.post(`/api/admin/papers/${fx.paper}/withdraw`)).status).toBe(200)
      expect((await pupil.get(`/api/bijak/papers/${fx.paper}`)).status).toBe(404)
      const retry = await pupil.post(`/api/bijak/attempts/${fx.attempt}/retry`)
      expect(retry.status, JSON.stringify(retry.body)).toBeGreaterThanOrEqual(400)
      const result = await pupil.get(`/api/bijak/attempts/${fx.attempt}/result`)
      expect(result.status, JSON.stringify(result.body)).toBe(200)
    })
  })
})
