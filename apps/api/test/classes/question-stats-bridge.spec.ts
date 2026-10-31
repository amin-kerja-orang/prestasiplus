/**
 * SW12-02: the classes question bridge binds `ClassesPorts.provideQuestions` to the real teacher question
 * counts, so `/guru/contributions` (S21), the S1 dashboard and everything fed by `statsOf` stop reading 0.
 * Definitions are in `teacher-question-stats.provider.ts`.
 */
import { QuestionGuruSummarySchema, TeacherContributionsSchema, TeacherDashboardSchema, envelopeOf, listEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { questionsSeed } from '../../prisma/seed/questions'
import { ClassesPorts } from '../../src/modules/classes'
import { ClassesQuestionsBridgeModule } from '../../src/modules/classes/question-bridge'
import { featureModules } from '../../src/modules'
import { QuestionsModule, QuestionsService } from '../../src/modules/questions'
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
  const setStatus = (ref: string, status: string) =>
    t.db.query(
      `update question_versions set status = $2, archive_reason = case when $2 = 'archived' then 'withdrawn' end where number_label = $1`,
      [ref, status],
    )
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
    // total 7 = approved 4 (the 3 served ones: MATH-T4, MATH-T5, STR-TREE, plus SCI-T4) + review 1 + draft 1 + archived 1.
    expect(body.stats).toEqual({ total: 7, approved: 4, pending: 1, used: 2 })
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

  it('total equals the teacher list and QuestionsService.contributionCountsFor (no drift in scope)', async () => {
    const list = listEnvelopeOf(QuestionGuruSummarySchema).parse((await a.get('/guru/questions')).body)
    const svc = t.app.get(QuestionsService)
    const counts = await svc.contributionCountsFor(teacherA)
    expect(list.meta.totalItems).toBe(7)
    expect(counts.total).toBe(7)
    expect(counts.byStatus).toMatchObject({ draft: 1, review: 1, approved: 4, archived: 1 })
    const stats = await t.app.get(ClassesPorts).questions.statsOf(teacherA)
    expect(stats.total).toBe(counts.total)
    expect(stats.approved).toBe(counts.byStatus.approved)
    expect(stats.pending).toBe(counts.byStatus.review)
  })

  it('structured is the structured subset of total (A: 1 of 7, B: 0 of 1, nobody: 0)', async () => {
    const ports = t.app.get(ClassesPorts)
    const mine = await ports.questions.statsOf(teacherA)
    expect(mine).toMatchObject({ total: 7, structured: 1 })
    expect(await ports.questions.statsOf(teacherB)).toMatchObject({ total: 1, structured: 0 })
    const none = await ports.questions.statsOf('999999999')
    expect(none.structured).toBe(0)
    // A second structured question (a draft one) moves from the objective share to the structured one, total unchanged.
    await setOwner('SEED-STR-ECF', teacherA)
    await setStatus('SEED-STR-ECF', 'draft')
    expect(await ports.questions.statsOf(teacherA)).toMatchObject({ total: 8, structured: 2 })
    await setOwner('SEED-STR-ECF', await idOfEmail(t, 'admin@demo.test'))
    expect(await ports.questions.statsOf(teacherA)).toMatchObject({ total: 7, structured: 1 })
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
    expect(await ports.questions.statsOf('999999999')).toEqual({ total: 0, structured: 0, approved: 0, pending: 0, used: 0, bySubject: [] })
    expect(await ports.questions.statsOf('not-an-id')).toEqual({ total: 0, structured: 0, approved: 0, pending: 0, used: 0, bySubject: [] })
  })

  it('PKSK questions never count and the numbers follow the tables on each call', async () => {
    const before = await t.app.get(ClassesPorts).questions.statsOf(teacherA)
    const qid = await idOfRef('SEED-DRAFT-BM-T4')
    await t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pksk_domain', 'D1')`, [qid])
    const after = TeacherContributionsSchema.parse((await a.get('/guru/contributions')).body)
    expect(after.stats.total).toBe(before.total - 1)
    await t.db.query(`delete from question_tags where question_id = $1 and kind = 'pksk_domain'`, [qid])
    await setStatus('SEED-REVIEW-SCI-T5', 'approved')
    const moved = TeacherContributionsSchema.parse((await a.get('/guru/contributions')).body)
    expect(moved.stats).toMatchObject({ total: 7, approved: 5, pending: 0 })
  })
})
