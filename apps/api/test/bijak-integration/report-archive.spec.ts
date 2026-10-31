/**
 * R1-B17: a student reports a bank question (the id a Bijak sitting or a Kuiz shows) and the admin archives it from the report row.
 * "Arkib" is the real lifecycle archive (status archived, one status event), not a deactivation: the question is still `is_active`
 * but leaves every activity (approved = servable), while a sitting already started on a published paper keeps reading it from its pinned version.
 * Reports have no Bijak source of their own (the DB check allows spm, latihan, revision, teacher_databank and structured_attempt),
 * so a Bijak or Kuiz report is filed with the default source `spm`.
 */
import { BIJAK_ATTEMPTS_MESSAGES, QUESTION_REPORT_MESSAGES, SessionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prngStream } from '../../src/db/prng'
import { BijakPapersPorts } from '../../src/modules/bijak/papers'
import { PracticePorts } from '../../src/modules/practice'
import { PracticeQuestionsBridgeModule } from '../../src/modules/practice/question-bridge'
import { QuestionWorkflowModule } from '../../src/modules/questions/workflow'
import { ADMIN, bootIntegrationApp, DEMO_PASSWORD, type IntegrationApp, loginAs, START, STUDENT } from './helpers'

const OTHER_PUPIL = 'pelajar2@demo.test'
let t: IntegrationApp
let qid = ''
let subjectId = ''
let levelId = ''
let paperId = ''
let reportId = ''
let attemptId = ''
let adminPatch: (url: string, body: unknown) => Promise<{ status: number; body: { data?: { status?: string; papers?: { id: string; title: string }[]; warning?: string }; error?: unknown } }>

beforeAll(async () => {
  t = await bootIntegrationApp({ pocQuestions: false, extraModules: [QuestionWorkflowModule, PracticeQuestionsBridgeModule] })
  const row = (
    await t.db.query<{ id: string; subject_id: string; level_id: string }>(
      `select q.id::text id, v.subject_id::text subject_id, v.education_level_id::text level_id from questions q
         join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where v.number_label = 'SEED-MCQ-MATH-T4'`,
    )
  )[0]!
  qid = row.id
  subjectId = row.subject_id
  levelId = row.level_id
  // An admin with a CSRF token for PATCH (the shared client has no patch).
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier: ADMIN, password: DEMO_PASSWORD, remember: false })
  const csrf = SessionSchema.parse(res.body.data).csrf
  adminPatch = async (url, body) => {
    const r = await agent.patch(url).set('X-CSRF-Token', csrf).send(body as object)
    return { status: r.status, body: r.body }
  }
  // A published Pilihan paper that places the question (the version is pinned on the placement).
  const subject = await t.db.prisma.subject.findFirstOrThrow({ where: { code: 'MATH' } })
  const paper = await t.db.prisma.paper.create({
    data: {
      kind: 'pilihan',
      title: 'Kertas dengan soalan dilaporkan',
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
}, 240_000)
afterAll(async () => {
  await t.close()
})

const drawn = async (): Promise<string[]> =>
  t.app.get(PracticePorts).questions.sample({ subjectId, educationLevelIds: [levelId], spmPool: true }, 50, prngStream('report-archive'))
const inJanaPool = async (): Promise<boolean> =>
  (await t.app.get(BijakPapersPorts).poolSource.candidates({ subjectId, subjectCode: 'MATH', kertas: 1 })).some((f) => f.id === qid)
const questionRow = async () =>
  (await t.db.query<{ is_active: boolean; status: string; live: number | null }>(
    `select q.is_active, v.status, q.live_version_no live from questions q join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no where q.id = $1`,
    [qid],
  ))[0]!

describe('Laporan Soalan: archive from the report row (R1-B17)', () => {
  it('1. the question is served before the report: Latih Tubi SPM draws it, the Jana Kertas pool holds it', async () => {
    expect(await drawn()).toContain(qid)
    expect(await inJanaPool()).toBe(true)
    expect(await questionRow()).toMatchObject({ is_active: true, status: 'approved' })
    // a pupil starts a sitting of the published paper that places it (its version is pinned on the placement)
    const student = await loginAs(t, STUDENT)
    const started = await student.post('/api/bijak/attempts', { paperId, mode: 'exam' })
    expect(started.status, JSON.stringify(started.body)).toBeLessThan(300)
    attemptId = (started.body as { data: { attemptId: string } }).data.attemptId
    // another pupil, with no sitting, sees the paper in Kertas Pilihan
    const other = await loginAs(t, OTHER_PUPIL)
    expect(((await other.get('/api/bijak/papers')).body as { data: { id: string }[] }).data.map((p) => p.id)).toContain(paperId)
  })

  it('2. a student files a report against the bank question id: pending, on the live version', async () => {
    const student = await loginAs(t, STUDENT)
    const res = await student.post('/api/question-reports', { questionId: qid, reasons: ['wrong_answer'], comment: 'Jawapan tidak tepat' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const [r] = await t.db.query<{ id: string; status: string; question_version_no: number; source: string }>(`select id::text, status, question_version_no, source from question_reports where question_id = $1`, [qid])
    expect(r).toMatchObject({ status: 'pending', question_version_no: 1, source: 'spm' })
    reportId = r!.id
    // an MCQ report switches the question off at once (BR-M04-11), which is a deactivation only
    expect(await questionRow()).toMatchObject({ is_active: false, status: 'approved' })
  })

  it('3. the admin keeps the question (reactivate): it is served again', async () => {
    const res = await adminPatch(`/api/question-reports/${reportId}`, { status: 'reviewed', reactivate: true })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await drawn()).toContain(qid)
  })

  it('4. "Arkib" on the report row archives through the lifecycle: archived, one event, still is_active, and the report reads Dikeluarkan', async () => {
    const res = await adminPatch(`/api/question-reports/${reportId}`, { status: 'fixed', adminNotes: 'Diarkibkan', archive: true })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data?.status).toBe('fixed')
    // H-A13: the admin is told which published papers place the question
    expect(res.body.data?.papers).toEqual([{ id: paperId, title: 'Kertas dengan soalan dilaporkan' }])
    expect(res.body.data?.warning).toBe(QUESTION_REPORT_MESSAGES.archivedOnPapers)
    // the real lifecycle archive, not a deactivation
    expect(await questionRow()).toMatchObject({ is_active: true, status: 'archived' })
    const events = await t.db.query<{ from_status: string; to_status: string; reason: string | null }>(
      `select from_status, to_status, reason from question_status_events where question_id = $1 order by id desc limit 1`,
      [qid],
    )
    expect(events[0]).toMatchObject({ from_status: 'approved', to_status: 'archived' })
    const admin = await loginAs(t, ADMIN)
    const list = (await admin.get('/api/question-reports?status=fixed')).body.data as { id: string; displayStatus: string }[]
    expect(list.find((r) => r.id === reportId)?.displayStatus).toBe('removed')
  })

  it('5. archived leaves every activity: not drawn by Latih Tubi SPM, not in a new Jana Kertas pool', async () => {
    expect(await drawn()).not.toContain(qid)
    expect(await inJanaPool()).toBe(false)
  })

  it('6. a second Arkib is a no-op (idempotent), not a 409', async () => {
    const res = await adminPatch(`/api/question-reports/${reportId}`, { status: 'fixed', archive: true })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(await questionRow()).toMatchObject({ status: 'archived' })
  })

  it('7. a sitting that was started before keeps reading the question; the paper cover still loads', async () => {
    const student = await loginAs(t, STUDENT)
    const view = await student.get(`/api/bijak/attempts/${attemptId}`)
    expect(view.status, JSON.stringify(view.body)).toBe(200)
    const questions = (view.body as { data: { questions: { id: string }[] } }).data.questions
    expect(questions.map((q) => q.id)).toEqual([qid])
    const cover = await student.get(`/api/bijak/papers/${paperId}`)
    expect(cover.status, JSON.stringify(cover.body)).toBe(200)
    expect((cover.body as { data: { questionCount: number } }).data.questionCount).toBe(1)
  })

  it('8. a NEW sitting of that paper is refused with a BM line (BE-15 eligibility: every placed question must be live); a sitting already open is resumed', async () => {
    const other = await loginAs(t, OTHER_PUPIL)
    const refused = await other.post('/api/bijak/attempts', { paperId, mode: 'exam' })
    expect(refused.status).toBe(403)
    expect((refused.body as { error: { code: string; message: string } }).error).toMatchObject({ code: 'FORBIDDEN', message: BIJAK_ATTEMPTS_MESSAGES.paperUnavailable })
    // the pupil whose sitting is open resumes it (the same attempt, nothing new is created)
    const student = await loginAs(t, STUDENT)
    const resumed = await student.post('/api/bijak/attempts', { paperId, mode: 'exam' })
    expect(resumed.status, JSON.stringify(resumed.body)).toBe(200)
    expect((resumed.body as { data: { attemptId: string; created?: boolean } }).data.attemptId).toBe(attemptId)
  })

  it('9. Kertas Pilihan hides the paper for a pupil with no open sitting and keeps the card for the pupil who has one', async () => {
    const other = await loginAs(t, OTHER_PUPIL)
    expect(((await other.get('/api/bijak/papers')).body as { data: { id: string }[] }).data.map((p) => p.id)).not.toContain(paperId)
    const student = await loginAs(t, STUDENT)
    const mine = ((await student.get('/api/bijak/papers')).body as { data: { id: string; status: string }[] }).data.find((p) => p.id === paperId)
    expect(mine).toMatchObject({ id: paperId, status: 'sedang' })
  })
})
