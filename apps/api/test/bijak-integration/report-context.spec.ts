/**
 * R1-T42 (R1-18.1, 18.3): a question report names the paper and attempt it was filed from. The server proves it: the attempt must be the
 * reporter's own and hold the question, the paper comes from the attempt (a `paperId` from the client is only compared), and the queue
 * shows the paper. Real wiring: a published Pilihan paper, a real sitting started by the pupil, the real report routes.
 */
import { QuestionReportListResponseSchema, QuestionReportMineResponseSchema, QUESTION_REPORT_MESSAGES as M } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionWorkflowModule } from '../../src/modules/questions/workflow'
import { ADMIN, bootIntegrationApp, type Client, type IntegrationApp, loginAs, START, STUDENT } from './helpers'

const OTHER = 'pelajarmaju@demo.test'
let t: IntegrationApp
let student: Client
let other: Client
let qid = ''
let outsider = ''
let paperId = ''
let attemptId = ''
let otherAttemptId = ''

beforeAll(async () => {
  t = await bootIntegrationApp({ pocQuestions: false, extraModules: [QuestionWorkflowModule] })
  const ids = await t.db.query<{ id: string; ref: string }>(
    `select q.id::text id, v.number_label ref from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where v.number_label in ('SEED-MCQ-MATH-T4', 'SEED-MCQ-MATH-T5')`,
  )
  qid = ids.find((r) => r.ref === 'SEED-MCQ-MATH-T4')!.id
  outsider = ids.find((r) => r.ref === 'SEED-MCQ-MATH-T5')!.id
  const subject = await t.db.prisma.subject.findFirstOrThrow({ where: { code: 'MATH' } })
  const paper = await t.db.prisma.paper.create({
    data: {
      kind: 'pilihan',
      title: 'Kertas konteks laporan',
      subjectId: subject.id,
      kertas: 1,
      paperCode: '1449/1',
      printedDurationMin: 60,
      status: 'published',
      publishedAt: new Date(START),
      sections: { create: [{ position: 1, label: 'Bahagian A', questionCount: 1, markBudget: 0, placements: { create: [{ questionId: BigInt(qid), position: 1, pinnedVersionNo: 1 }] } }] },
    },
  })
  paperId = paper.id.toString()
  student = await loginAs(t, STUDENT)
  other = await loginAs(t, OTHER)
  for (const [who, set] of [[student, 'a'], [other, 'b']] as const) {
    const started = await who.post('/api/bijak/attempts', { paperId, mode: 'exam' })
    expect(started.status, JSON.stringify(started.body)).toBeLessThan(300)
    const id = (started.body as { data: { attemptId: string } }).data.attemptId
    if (set === 'a') attemptId = id
    else otherAttemptId = id
  }
}, 240_000)
afterAll(async () => {
  await t.close()
})

const report = (who: Client, extra: Record<string, unknown>, questionId = qid) => who.post('/api/question-reports', { questionId, reasons: ['wrong_answer'], ...extra })
/** An MCQ report switches the question off (BR-M04-11); each case starts with it served again. */
const serve = () => t.db.query(`update questions set is_active = true where id = any($1::bigint[])`, [[qid, outsider]])
const rows = () => t.db.query<{ attempt_id: string | null; paper_id: string | null; paper_label: string | null; reporter: string }>(`select attempt_id::text, paper_id::text, paper_label, reporter_id::text reporter from question_reports where question_id = $1 order by id`, [qid])
const fieldsOf = (res: { body: unknown }) => (res.body as { error: { fields: Record<string, string> } }).error.fields

describe('the report stores the paper and the attempt it came from (R1-18.1)', () => {
  it('a report without a context stores no paper (outside an attempt)', async () => {
    await serve()
    expect((await report(student, {})).status).toBe(201)
    expect((await rows())[0]).toMatchObject({ attempt_id: null, paper_id: null, paper_label: null })
    await t.db.query('delete from question_reports')
  })

  it('a report from the pupil own attempt stores the attempt, the paper from the attempt and a label', async () => {
    await serve()
    const res = await report(student, { attemptId })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(await rows()).toEqual([{ attempt_id: attemptId, paper_id: paperId, paper_label: 'Kertas konteks laporan (1449/1)', reporter: expect.any(String) }])
  })

  it('a paperId that matches the attempt is accepted; a second report from another attempt refreshes the row (one per version)', async () => {
    await serve()
    expect((await report(student, { attemptId, paperId })).status).toBe(201)
    expect(await rows()).toHaveLength(1)
  })

  it('the pupil own list and the admin queue both show the paper', async () => {
    const mine = QuestionReportMineResponseSchema.parse((await student.get('/api/question-reports/mine')).body)
    expect(mine.data[0]?.paper).toEqual({ id: paperId, label: 'Kertas konteks laporan (1449/1)', attemptId })
    const admin = await loginAs(t, ADMIN)
    const list = QuestionReportListResponseSchema.parse((await admin.get('/api/question-reports?status=all')).body)
    const row = list.data.find((r) => r.questionId === qid)!
    expect(row.paper).toEqual({ id: paperId, label: 'Kertas konteks laporan (1449/1)', attemptId })
  })

  it('a report outside an attempt shows paper null in the queue', async () => {
    await t.db.query('delete from question_reports')
    await serve()
    expect((await report(student, {})).status).toBe(201)
    const admin = await loginAs(t, ADMIN)
    expect(QuestionReportListResponseSchema.parse((await admin.get('/api/question-reports?status=all')).body).data[0]?.paper ?? null).toBeNull()
  })
})

describe('the server does not trust the context (R1-18.1, B3)', () => {
  const refused = async (who: Client, extra: Record<string, unknown>, field: string, message: string, questionId = qid) => {
    await t.db.query('delete from question_reports')
    await serve()
    const res = await report(who, extra, questionId)
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(fieldsOf(res)[field]).toBe(message)
    expect(await t.db.query('select 1 from question_reports')).toHaveLength(0) // nothing stored
  }

  it("another pupil's attempt, an unknown attempt and a malformed id all answer the same 422 on attemptId", async () => {
    await refused(student, { attemptId: otherAttemptId }, 'attemptId', M.attempt)
    await refused(student, { attemptId: '3f6c1f2a-8f3e-4c53-9a53-2d3f2f6f1a11' }, 'attemptId', M.attempt)
    await refused(student, { attemptId: 'bukan-uuid' }, 'attemptId', M.attempt)
    await refused(student, { attemptId: 12345 }, 'attemptId', M.attempt)
  })

  it('a question that is not in the attempt is refused', async () => {
    await refused(student, { attemptId }, 'attemptId', M.attemptQuestion, outsider)
  })

  it('a paperId that is not the paper of the attempt is refused; a paperId without an attempt proves nothing', async () => {
    await refused(student, { attemptId, paperId: '999999' }, 'paperId', M.paper)
    await refused(student, { paperId }, 'attemptId', M.attempt)
    await refused(student, { attemptId, paperId: 'abc' }, 'paperId', M.paper)
  })

  it('the stored paper comes from the attempt, never from the body', async () => {
    await t.db.query('delete from question_reports')
    await serve()
    expect((await report(student, { attemptId, paperId, paper_id: '999999', paperLabel: 'Palsu' })).status).toBe(201)
    expect((await rows())[0]).toMatchObject({ paper_id: paperId, paper_label: 'Kertas konteks laporan (1449/1)' })
  })
})
