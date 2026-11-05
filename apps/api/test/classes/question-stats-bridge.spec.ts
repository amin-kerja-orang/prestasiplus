/**
 * SW12-02: the classes question bridge binds `ClassesPorts.provideQuestions` to the real teacher question
 * counts, so `/guru/contributions` (S21), the S1 dashboard and everything fed by `submissionStatsOf` stop reading 0.
 * Definitions are in `teacher-question-stats.provider.ts`.
 *
 * S6-T06 (D113, L-6): the counts are those of the teacher's OWN question submissions, i.e. the intake items (`payload.guru`) of the teacher's
 * `source = 'guru'` batches, with the status of the question made from an accepted item. The fixture therefore gives each owned question an
 * accepted item of its owner (`own`), the way the admin's "Terima" links them.
 */
import { QuestionGuruSummarySchema, TeacherContributionsSchema, TeacherDashboardSchema, envelopeOf, listEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { questionsSeed } from '../../prisma/seed/questions'
import { ClassesPorts } from '../../src/modules/classes'
import { ClassesQuestionsBridgeModule } from '../../src/modules/classes/question-bridge'
import { featureModules } from '../../src/modules'
import { QuestionsModule } from '../../src/modules/questions'
import {
  STUDENT_1,
  TEACHER_A,
  TEACHER_B,
  TEACHER_C,
  bootClassesApp,
  client,
  idOfEmail,
  type ClassesTestApp,
  type Client,
} from './helpers'

describe('teacher question stats bridge (SW12-02)', () => {
  let t: ClassesTestApp
  let a: Client
  let b: Client
  let c: Client
  let teacherA: string
  let teacherB: string
  let student: string

  const setOwner = (ref: string, owner: string) =>
    t.db.query(`update questions set created_by_id = $2 where id = (select question_id from question_versions where number_label = $1 order by version_no desc limit 1)`, [ref, owner])
  const setStatus = async (ref: string, status: string) => {
    await t.db.query(
      `update question_versions set status = $2, archive_reason = case when $2 = 'archived' then 'withdrawn' end where number_label = $1`,
      [ref, status],
    )
    // "Diluluskan" = the question has a live version.
    await t.db.query(
      `update questions set live_version_no = case when $2 = 'approved' then latest_version_no else null end where id = (select question_id from question_versions where number_label = $1 limit 1)`,
      [ref, status],
    )
  }
  /** An accepted guru intake item of `owner` that points at the seeded question (its subject and level are the question's). Returns the item id. */
  const own = async (ref: string, owner: string): Promise<string> => {
    const v = (await t.db.query<{ qid: string; subject: string; level: string }>(`select question_id::text qid, subject_id::text subject, education_level_id::text level from question_versions where number_label = $1 order by version_no desc limit 1`, [ref]))[0]!
    const batch = (await t.db.query<{ id: string }>(`insert into intake_batches (owner_user_id, source, status, paper_type, subject, source_text, rights_status) values ($1::bigint, 'guru', 'ready_for_review', 'umum', 'Subjek', 'Kiriman guru', 'own') returning id::text id`, [owner]))[0]!.id
    const guru = { v: 1, questionType: 'mcq', subjectId: v.subject, educationLevelId: v.level, chapterId: null, spIds: [], tp: null, cognitiveLevel: null, difficultyLevel: 3, correctIndex: 1, explanation: null }
    return (await t.db.query<{ id: string }>(
      `insert into intake_items (batch_id, position, source_type, number_label, item_type, payload, review_state, question_id) values ($1::bigint, 1, 'manual', '1', 'mcq', $2::jsonb, 'accepted', $3::bigint) returning id::text id`,
      [batch, JSON.stringify({ stem: ref, options: [], guru }), v.qid],
    ))[0]!.id
  }
  const idOfRef = async (ref: string): Promise<string> =>
    (await t.db.query<{ id: string }>(`select question_id::text id from question_versions where number_label = $1`, [ref]))[0]?.id as string

  beforeAll(async () => {
    t = await bootClassesApp({ seeds: [questionsSeed], modules: [QuestionsModule, ClassesQuestionsBridgeModule] })
    a = await client(t, TEACHER_A)
    b = await client(t, TEACHER_B)
    c = await client(t, TEACHER_C)
    teacherA = await idOfEmail(t, TEACHER_A)
    teacherB = await idOfEmail(t, TEACHER_B)
    student = await idOfEmail(t, STUDENT_1)

    // The seed gives teacher A one `review` science question. Add six more of mixed status and subject (objective and structured).
    for (const ref of ['SEED-MCQ-MATH-T4', 'SEED-MCQ-MATH-T5', 'SEED-STR-TREE', 'SEED-MCQ-SCI-T4', 'SEED-DRAFT-BM-T4', 'SEED-MCQ-BM-T4']) await setOwner(ref, teacherA)
    await setStatus('SEED-MCQ-SCI-T4', 'approved')
    await setStatus('SEED-MCQ-BM-T4', 'archived')
    // Teacher B owns one published question that must never show up for A.
    await setOwner('SEED-MCQ-BM-T5', teacherB)
    // The submissions: one accepted item per owned question (the seeded review question of A included).
    for (const ref of ['SEED-REVIEW-SCI-T5', 'SEED-MCQ-MATH-T4', 'SEED-MCQ-MATH-T5', 'SEED-STR-TREE', 'SEED-MCQ-SCI-T4', 'SEED-DRAFT-BM-T4', 'SEED-MCQ-BM-T4']) await own(ref, teacherA)
    await own('SEED-MCQ-BM-T5', teacherB)

    // Usage: A's MATH-T4 (practice) and STR-TREE (structured) count once each; test traffic, B's question and a null question do not.
    const mathT4 = await idOfRef('SEED-MCQ-MATH-T4')
    const sciT4 = await idOfRef('SEED-MCQ-SCI-T4')
    const strTree = await idOfRef('SEED-STR-TREE')
    const bmT5 = await idOfRef('SEED-MCQ-BM-T5')
    const answer = (qid: string, isTest: boolean) =>
      t.db.query(`insert into practice_answers (user_id, question_id, is_correct, answered_at, is_test) values ($1, $2, true, now(), $3)`, [student, qid, isTest])
    await answer(mathT4, false)
    await answer(mathT4, false)
    await answer(sciT4, true)
    await answer(bmT5, false)
    await t.db.query(
      `insert into structured_attempts (user_id, question_id, question_version_no, total_awarded, total_max, submitted_at, is_test) values ($1, $2, 1, 1, 2, now(), false)`,
      [student, strTree],
    )
  }, 180_000)
  afterAll(async () => {
    await t.close()
  })

  it('the bridge is registered in the real module registry (the app binds it at boot)', () => {
    expect(featureModules).toContain(ClassesQuestionsBridgeModule)
  })

  it('binds the real provider: contributions carry the counts, the tiers and the subject breakdown of the teacher', async () => {
    const res = await a.get('/guru/contributions')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const body = TeacherContributionsSchema.parse(res.body)
    // total 7 = approved 4 (MATH-T4, MATH-T5, STR-TREE, SCI-T4) + "Menunggu Semakan" 3 (accepted but not published: review, draft, archived).
    expect(body.stats).toEqual({ total: 7, approved: 4, pending: 3, used: 2 })
    expect(body.breakdown).toEqual([
      { label: expect.stringMatching(/mat/i), count: 3 },
      { label: expect.any(String), count: 2 },
      { label: expect.any(String), count: 2 },
    ])
    expect(body.breakdown.reduce((s, r) => s + r.count, 0)).toBe(7)
    expect(body.tiers.every((x) => !x.reached)).toBe(true)
    expect(body.nextTier).toEqual({ name: 'Penyumbang Baru', threshold: 10 })
  })

  it('the subject labels are the subject names (MATH 3, SCI 2, BM 2)', async () => {
    const names = Object.fromEntries(
      (await t.db.query<{ code: string; name: string }>(`select code, name from subjects where code in ('MATH', 'SCI', 'BM')`)).map((r) => [r.code, r.name]),
    )
    const got = TeacherContributionsSchema.parse((await a.get('/guru/contributions')).body).breakdown
    expect(Object.fromEntries(got.map((r) => [r.label, r.count]))).toEqual({ [names.MATH as string]: 3, [names.SCI as string]: 2, [names.BM as string]: 2 })
  })

  it('the dashboard "Soalan" cards read the same numbers', async () => {
    const d = envelopeOf(TeacherDashboardSchema).parse((await a.get('/guru/dashboard')).body).data
    expect(d.stats).toMatchObject({ questions: 7, questionsApproved: 4 })
  })

  it('structured is always 0 (a submission is one MCQ); a further item moves total by one and removing it moves it back', async () => {
    const ports = t.app.get(ClassesPorts)
    expect(await ports.questions.submissionStatsOf!(teacherA)).toMatchObject({ total: 7, structured: 0 })
    expect(await ports.questions.submissionStatsOf!(teacherB)).toMatchObject({ total: 1, structured: 0 })
    expect((await ports.questions.submissionStatsOf!('999999999')).structured).toBe(0)
    await setStatus('SEED-STR-ECF', 'draft')
    const item = await own('SEED-STR-ECF', teacherA)
    expect(await ports.questions.submissionStatsOf!(teacherA)).toMatchObject({ total: 8, structured: 0 })
    await t.db.query(`delete from intake_items where id = $1`, [item])
    expect(await ports.questions.submissionStatsOf!(teacherA)).toMatchObject({ total: 7, structured: 0 })
  })

  it('statsOf keeps its bank meaning (owned questions by questions.created_by_id, with the MCQ / Struktur split) for the other consumers', async () => {
    const ports = t.app.get(ClassesPorts)
    expect(await ports.questions.statsOf(teacherA)).toMatchObject({ total: 7, structured: 1 })
    expect(await ports.questions.statsOf(teacherB)).toMatchObject({ total: 1, structured: 0 })
  })

  it("another teacher's questions are not counted: B sees only the own published question", async () => {
    const body = TeacherContributionsSchema.parse((await b.get('/guru/contributions')).body)
    expect(body.stats).toEqual({ total: 1, approved: 1, pending: 0, used: 1 })
    expect(body.breakdown).toHaveLength(1)
    expect(body.breakdown[0]?.count).toBe(1)
  })

  it('a teacher without questions gets zeros and an empty breakdown', async () => {
    const body = TeacherContributionsSchema.parse((await c.get('/guru/contributions')).body)
    expect(body.stats).toEqual({ total: 0, approved: 0, pending: 0, used: 0 })
    expect(body.breakdown).toEqual([])
    const d = envelopeOf(TeacherDashboardSchema).parse((await c.get('/guru/dashboard')).body).data
    expect(d.stats).toMatchObject({ questions: 0, questionsApproved: 0 })
    const ports = t.app.get(ClassesPorts)
    expect(await ports.questions.submissionStatsOf!('999999999')).toEqual({ total: 0, structured: 0, approved: 0, pending: 0, used: 0, bySubject: [] })
    expect(await ports.questions.submissionStatsOf!('not-an-id')).toEqual({ total: 0, structured: 0, approved: 0, pending: 0, used: 0, bySubject: [] })
  })

  it('the numbers follow the tables on each call', async () => {
    await setStatus('SEED-REVIEW-SCI-T5', 'approved')
    const moved = TeacherContributionsSchema.parse((await a.get('/guru/contributions')).body)
    expect(moved.stats).toMatchObject({ total: 7, approved: 5, pending: 2 })
  })

  it('the SQL status behind the counts agrees with the TS status of GET /guru/questions: pending, approved and both forms of rejected', async () => {
    // (1) an item the admin rejected with a reason, never accepted; (2) an accepted item whose Draf question was sent back with a reason.
    const batch = (await t.db.query<{ id: string }>(`insert into intake_batches (owner_user_id, source, status, paper_type, subject, source_text, rights_status) values ($1::bigint, 'guru', 'ready_for_review', 'umum', 'Subjek', 'Kiriman guru', 'own') returning id::text id`, [teacherA]))[0]!.id
    const guru = { v: 1, questionType: 'mcq', subjectId: '1', educationLevelId: '1', chapterId: null, spIds: [], tp: null, cognitiveLevel: null, difficultyLevel: 3, correctIndex: 1, explanation: null }
    await t.db.query(
      `insert into intake_items (batch_id, position, source_type, number_label, item_type, payload, review_state, reject_reason) values ($1::bigint, 1, 'manual', '1', 'mcq', $2::jsonb, 'rejected', 'Kunci jawapan salah.')`,
      [batch, JSON.stringify({ stem: 'ditolak', options: [], guru })],
    )
    await t.db.query(`update question_versions set rejection_reason = 'Betulkan kunci jawapan.' where number_label = 'SEED-DRAFT-BM-T4' and status = 'draft'`)

    const rows: { status: string; rejectionReason: string | null }[] = []
    for (let page = 1; ; page += 1) {
      const res = listEnvelopeOf(QuestionGuruSummarySchema).parse((await a.get(`/guru/questions?page=${String(page)}`)).body)
      rows.push(...res.data)
      if (rows.length >= res.meta.totalItems) break
    }
    const of = (s: string) => rows.filter((r) => r.status === s).length
    expect(of('rejected')).toBe(2)
    expect(rows.filter((r) => r.status === 'rejected').map((r) => r.rejectionReason).sort()).toEqual(['Betulkan kunci jawapan.', 'Kunci jawapan salah.'])
    expect(of('approved')).toBeGreaterThan(0)
    expect(of('pending')).toBeGreaterThan(0)

    const stats = TeacherContributionsSchema.parse((await a.get('/guru/contributions')).body).stats
    expect(stats.total).toBe(rows.length) // Jumlah
    expect(stats.approved).toBe(of('approved')) // Diluluskan
    expect(stats.pending).toBe(of('pending')) // Menunggu (a rejected item is in neither)
  })
})
