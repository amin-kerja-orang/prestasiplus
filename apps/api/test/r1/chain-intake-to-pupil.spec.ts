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
 *   -> admin approves (Semakan needs no Bab; Terbitkan runs the DSKP gate and asks for the Bab, S1-T02) -> builds a MAT kertas 2 paper (D90 group is one unit, section pools)
 *   -> Terbit (versions pinned) -> a pupil sits it (stimulus served once, with the image; no key leaks) -> submits -> Cuba Lagi.
 * `pipeline-chain.spec.ts` builds its questions through the Studio API; the intake specs stop at "approved". This one joins them.
 * S1-T02: the questions go through Semakan WITHOUT a Bab (3a); Terbitkan asks for the Bab and a missing curriculum node is refused by the DSKP gate (3b, 3, 3c).
 */
const REGION = { page: 1, x: 0.1, y: 0.1, w: 0.5, h: 0.4 }
const START = '2026-10-19T09:00:00+08:00'
/** The fixture's marking scheme (helpers `draft`): the correct option and the reason text the pupil must never see before the result. */
const CORRECT = 'B'
const REASON = 'Kerana B.'
/** The keys a served pupil question may carry (V2 Panel shape); `groupId` only on a member of a stimulus group. No scheme, key, reason or per-question stimulus. */
const QUESTION_KEYS = ['formOrigin', 'groupId', 'id', 'marks', 'mcq', 'number', 'sectionId', 'stem', 'topic']
const OPTION_KEYS = ['id', 'text', 'image']

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
let xpBefore = 0 // the seeded pupil already has XP: the reward is checked as a delta

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

  it('3a. Semakan without a Bab passes (no Bab rule at submit): all six move to Semakan with no failed[] entry', async () => {
    await q(`update question_versions set paper_code = 'MATH/2', chapter_id = null where question_id = any($1::bigint[])`, [questionIds])
    const res = await admin.post('/api/questions/bulk-action', { action: 'review', ids: questionIds })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data, JSON.stringify(res.body.data)).toMatchObject({ affected: 6, failed: [] })
    expect((await q(`select distinct v.status from question_versions v where v.question_id = any($1::bigint[])`, [questionIds])).map((r) => r.status)).toEqual(['review'])
    expect((await q(`select distinct v.chapter_id from question_versions v where v.question_id = any($1::bigint[])`, [questionIds])).map((r) => r.chapter_id)).toEqual([null]) // still no Bab
  })

  it('3b. S1-T02: Terbitkan without a curriculum node (no unit, no SP) and no Bab is refused with the DSKP unit, SP and Bab issues, and nothing moves', async () => {
    const solo = questionIds[5]!
    const [before] = await q(`select v.id::text version, v.unit_node_id::text unit from question_versions v where v.question_id = $1::bigint`, [solo])
    expect(before!.unit).not.toBeNull()
    const sps = await q(`select node_id::text node from question_version_sp_nodes where question_version_id = $1::bigint`, [before!.version])
    expect(sps.length).toBeGreaterThan(0)
    await q(`update question_versions set unit_node_id = null where id = $1::bigint`, [before!.version])
    await q(`delete from question_version_sp_nodes where question_version_id = $1::bigint`, [before!.version])
    try {
      const res = await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [solo] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.affected, JSON.stringify(res.body.data)).toBe(0)
      const failed = res.body.data.failed as { id: string; code: string; fields: Record<string, string> }[]
      expect(failed).toHaveLength(1)
      expect(failed[0]).toMatchObject({ id: solo, code: 'VALIDATION_ERROR' })
      // EXACTLY the unit, SP and Bab issues (NO_UNIT + NO_SP + NO_CHAPTER: MATH T4 has chapters, so the Bab is asked, S1-T02)
      expect(failed[0]!.fields).toEqual({ unitId: 'Sila pilih unit DSKP.', spIds: 'Sila pilih sekurang-kurangnya satu SP DSKP.', chapterId: 'Sila pilih Bab.' })
      expect((await q(`select v.status from question_versions v where v.question_id = $1::bigint`, [solo])).map((r) => r.status)).toEqual(['review'])
    } finally {
      await q(`update question_versions set unit_node_id = $2::bigint where id = $1::bigint`, [before!.version, before!.unit])
      for (const sp of sps) await q(`insert into question_version_sp_nodes (question_version_id, node_id) values ($1::bigint, $2::bigint)`, [before!.version, sp.node])
    }
  })

  it('3. S1-T02: Terbitkan needs the Bab (MATH T4 has chapters): without one the five are refused NO_CHAPTER; with a Bab chosen by hand they are approved and carry it', async () => {
    const five = questionIds.slice(0, 5) // the sixth is approved in 3c
    // the two figure-group members are approved as ONE unit (S1-T01; listing only one of them would be a 422 stimulus_group_split): the gate refuses the whole group with 422 details.gate, one line per member
    const groupRefused = await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [five[0]!, five[1]!] })
    expect(groupRefused.status, JSON.stringify(groupRefused.body)).toBe(422)
    const gate = groupRefused.body.error.details.gate as { questionId: string; message: string }[]
    expect(gate.map((g) => g.questionId)).toEqual([questionIds[0], questionIds[1]])
    for (const g of gate) expect(g.message).toMatch(/Sila pilih Bab\.$/)
    // the three solo questions are refused one by one in failed[]
    const refused = await admin.post('/api/questions/bulk-action', { action: 'approved', ids: five.slice(2) })
    expect(refused.status, JSON.stringify(refused.body)).toBe(200)
    expect(refused.body.data.affected).toBe(0)
    expect((refused.body.data.failed as { fields: Record<string, string> }[]).map((f) => f.fields)).toEqual(Array(3).fill({ chapterId: 'Sila pilih Bab.' }))
    const [bab] = await q(`select c.id::text id from chapters c join question_versions v on v.subject_id = c.subject_id and v.education_level_id = c.education_level_id where v.question_id = $1::bigint and c.is_active and c.in_tree order by c.id limit 1`, [five[0]!])
    expect(bab, 'a MATH T4 chapter').toBeDefined()
    await q(`update question_versions set chapter_id = $2::bigint where question_id = any($1::bigint[])`, [five, bab!.id])
    const res = await admin.post('/api/questions/bulk-action', { action: 'approved', ids: five })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data, JSON.stringify(res.body.data)).toMatchObject({ affected: 5, failed: [] })
    const live = await q(`select v.status, v.chapter_id::text chapter from questions qq join question_versions v on v.question_id = qq.id and v.version_no = qq.live_version_no where qq.id = any($1::bigint[])`, [five])
    expect(live.map((r) => r.status)).toEqual(Array(5).fill('approved'))
    expect(live.map((r) => r.chapter)).toEqual(Array(5).fill(bab!.id))
  })

  it('3c. S1-T02: the Bab is not derived from the unit any more: a unique chapters.dskp_code match does not satisfy NO_CHAPTER; once the Bab is chosen it is approved', async () => {
    const solo = questionIds[5]!
    const [row] = await q(
      `select v.subject_id::text subject, v.education_level_id::text level, n.code unit_code, v.chapter_id::text chapter
         from question_versions v join curriculum_nodes n on n.id = v.unit_node_id where v.question_id = $1::bigint`,
      [solo],
    )
    expect(row!.chapter).toBeNull() // no manual Bab
    const [target] = await q(`select c.id::text id from chapters c where c.subject_id = $1::bigint and c.education_level_id = $2::bigint and c.is_active and c.dskp_code is null order by c.id limit 1`, [row!.subject, row!.level])
    expect(target, 'the fixture needs a chapter of the unit subject and level').toBeDefined()
    await q(`update chapters set dskp_code = $2 where id = $1::bigint`, [target!.id, row!.unit_code])
    try {
      const refused = await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [solo] })
      expect(refused.body.data, JSON.stringify(refused.body.data)).toMatchObject({ affected: 0, failed: [{ id: solo, fields: { chapterId: 'Sila pilih Bab.' } }] })
      await q(`update question_versions set chapter_id = $2::bigint where question_id = $1::bigint`, [solo, target!.id])
      const res = await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [solo] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data, JSON.stringify(res.body.data)).toMatchObject({ affected: 1, failed: [] })
    } finally {
      await q(`update chapters set dskp_code = null where id = $1::bigint`, [target!.id]) // scope: nothing after this step depends on the link
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
    // Out of scope here: that the pin FOLLOWS an edit (a question edited before it is placed pins the new version; one edited after Terbit keeps the
    // pinned one). Editing an approved question branches a new version that needs a fresh Semakan and approval, which is its own flow. It is covered by
    // test/exam-builder/builder-placements.spec.ts "pinned versions stay after a question edit; a draft pins the version in force when placed",
    // test/exam-builder/publish-acs.spec.ts AC-07.9 and test/r1/pinned-version-rule.spec.ts. This step proves the intake-made questions are pinned.
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
    // the stimulus is served ONCE: on the group (as `stimulus` and in its one-item `stimuli` list), never on a question
    const raw = res.body.data as { questions: Record<string, unknown>[]; groups: { stimuli: unknown[] }[] }
    expect(raw.groups[0]!.stimuli).toHaveLength(1)
    expect(raw.questions.every((x) => !('stimuli' in x) && !('stimulus' in x))).toBe(true)
    expect(JSON.stringify(res.body).split(`/api/files/${imageToken}`)).toHaveLength(1 + 2) // exactly the group's two spellings of the one image
    // no key leaks: an ALLOW-LIST of keys on every pupil question and every option (a new field fails here, a renamed answer key too) ...
    for (const x of raw.questions) {
      expect(Object.keys(x).filter((k) => !QUESTION_KEYS.includes(k)), `question ${String(x.id)} carries a key outside the allow-list`).toEqual([])
      expect(Object.keys((x.mcq as Record<string, unknown>) ?? {}), `mcq of ${String(x.id)}`).toEqual(['options'])
      for (const o of (x.mcq as { options: Record<string, unknown>[] }).options) expect(Object.keys(o).filter((k) => !OPTION_KEYS.includes(k)), `option ${String(o.id)}`).toEqual([])
    }
    // ... and the payload carries neither the scheme's reason text nor the correct option in a key-like position: no key anywhere is named
    // like an answer, and the correct id ("B") appears only as an option `id`, never as the value of another key.
    const walk = (node: unknown, key: string, out: { key: string; value: unknown }[]) => {
      if (Array.isArray(node)) node.forEach((n) => walk(n, key, out))
      else if (node !== null && typeof node === 'object') for (const [k, v] of Object.entries(node)) { out.push({ key: k, value: v }); walk(v, k, out) }
    }
    const entries: { key: string; value: unknown }[] = []
    walk(res.body.data, '', entries)
    // (`answers` is the pupil's OWN saved answers, empty at the start; it is not the key.)
    expect(entries.map((e) => e.key).filter((k) => k !== 'answers' && /correct|answer|key|scheme|reason|solution|model|explain|rubric/i.test(k))).toEqual([])
    expect(entries.filter((e) => e.value === CORRECT && e.key !== 'id')).toEqual([])
    expect(JSON.stringify(res.body)).not.toContain(REASON)
    expect((await pupil.get(view.groups[0]!.stimulus.image!.url)).status).toBe(200)
  })

  it('8. the pupil answers and submits: the MCQs are auto-marked (A 3 + B 1 + C choose 1 of 2 = 6)', async () => {
    const res = await pupil.get(`/api/bijak/attempts/${attempt}`)
    const view = res.body.data as { questions: { id: string; parts?: { id: string }[] }[] }
    const changes = view.questions.map((x) => ({ partId: x.parts?.[0]?.id ?? x.id, answer: { choice: 'B' }, rev: 1, savedAt: START }))
    const save = await pupil.put(`/api/bijak/attempts/${attempt}/answers`, { changes })
    expect(save.status, JSON.stringify(save.body)).toBe(200)
    xpBefore = Number((await q(`select xp from wallets where user_id = $1`, [pupil.userId]))[0]?.xp ?? 0)
    t.clock.set('2026-10-19T09:20:00+08:00')
    const sub = await pupil.post(`/api/bijak/attempts/${attempt}/submit`, { idempotencyKey: 'chain-intake-1', changes: [] })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    const result = (await pupil.get(`/api/bijak/attempts/${attempt}/result`)).body.data.result as { score: number; max: number; provisional: boolean }
    expect(result.max).toBe(6)
    expect(result.score).toBe(6)
    expect(result.provisional).toBe(false)
  })

  it('8b. the submit paid the reward ONCE on this bank paper: one quiz_spm ledger row for the attempt (6 marks = 12 syiling), 60 XP, a streak; a replay of the same key or another key adds nothing', async () => {
    const pupilId = pupil.userId
    const ledger = () => q(`select user_id::text uid, amount, is_test, type from coin_ledger where source = 'quiz_spm' and source_id = $1`, [attempt])
    const xp = async () => Number((await q(`select xp from wallets where user_id = $1`, [pupilId]))[0]?.xp ?? 0)
    const rows = await ledger()
    expect(rows).toHaveLength(1)
    // 2 syiling and 10 XP per mark (BIJAK reward rate); the score is 6 of 6
    expect(rows[0]).toMatchObject({ uid: pupilId, is_test: false, type: 'earn' })
    expect(Number(rows[0]!.amount)).toBe(12)
    expect((await xp()) - xpBefore).toBe(60)
    expect(Number((await q(`select current from streaks where user_id = $1`, [pupilId]))[0]?.current ?? 0)).toBeGreaterThanOrEqual(1)
    // The replays. NOTE: the wallet's own replay guard (credit with the same source id) is NOT what stops these: a submit of a closed attempt returns
    // early in attempts.service.ts (the 'row.status !== 'in_progress'' branch, "A replay (same key) or a later submit"), so the reward port is not
    // called again. The wallet guard has its own spec (bijak-integration/rewards.spec.ts); this one proves the chain does not pay twice.
    const same = await pupil.post(`/api/bijak/attempts/${attempt}/submit`, { idempotencyKey: 'chain-intake-1', changes: [] })
    expect(same.status, JSON.stringify(same.body)).toBe(200)
    const other = await pupil.post(`/api/bijak/attempts/${attempt}/submit`, { idempotencyKey: 'chain-intake-2', changes: [] })
    expect(other.status, JSON.stringify(other.body)).toBe(200)
    expect((await ledger()).map((r) => Number(r.amount))).toEqual([12])
    expect((await xp()) - xpBefore).toBe(60)
  })

  it('9. Cuba Lagi: a NEW attempt on the same paper; the old attempt and its result stay', async () => {
    const before = await pupil.get(`/api/bijak/attempts/${attempt}/result`)
    const retry = await pupil.post(`/api/bijak/attempts/${attempt}/retry`)
    expect(retry.status, JSON.stringify(retry.body)).toBe(201)
    expect(retry.body.data.attemptId).not.toBe(attempt)
    const fresh = await pupil.get(`/api/bijak/attempts/${retry.body.data.attemptId}`)
    expect(fresh.status, JSON.stringify(fresh.body)).toBe(200)
    expect(fresh.body.data.attempt).toMatchObject({ paperId, status: 'in_progress' })
    // exactly two sittings of this paper for this pupil: the submitted one and the new one
    const sittings = await q(`select id::text id, status from exam_attempts where user_id = $1 and paper_id = $2 order by started_at, id`, [pupil.userId, paperId])
    expect(sittings.map((r) => r.id)).toHaveLength(2)
    expect(sittings.map((r) => r.id)).toContain(attempt)
    expect(sittings.map((r) => r.id)).toContain(retry.body.data.attemptId)
    const after = await pupil.get(`/api/bijak/attempts/${attempt}/result`)
    expect(after.body.data.result).toEqual(before.body.data.result)
  })
})
