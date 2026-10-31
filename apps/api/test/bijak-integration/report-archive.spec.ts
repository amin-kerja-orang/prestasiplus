/**
 * R1-B17: a student reports a bank question (the id a Bijak sitting or a Kuiz shows) and the admin archives it from the report row.
 * "Arkib" is the real lifecycle archive (status archived, one status event), not a deactivation: the question is still `is_active`
 * but leaves every activity (approved = servable), while a sitting already started on a published paper keeps reading it from its pinned version.
 * Reports have no Bijak source of their own (the DB check allows spm, latihan, revision, teacher_databank and structured_attempt),
 * so a Bijak or Kuiz report is filed with the default source `spm`.
 */
import { QUESTION_REPORT_MESSAGES, SessionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prngStream } from '../../src/db/prng'
import { BijakPapersPorts } from '../../src/modules/bijak/papers'
import { PracticePorts } from '../../src/modules/practice'
import { PracticeQuestionsBridgeModule } from '../../src/modules/practice/question-bridge'
import { QuestionWorkflowModule } from '../../src/modules/questions/workflow'
import { ADMIN, bootIntegrationApp, DEMO_PASSWORD, type IntegrationApp, loginAs, START, STUDENT } from './helpers'

let t: IntegrationApp
let qid = ''
let subjectId = ''
let levelId = ''
let paperId = ''
let reportId = ''
let attemptId = ''
let adminPatch: (url: string, body: unknown) => Promise<{ status: number; body: { data?: { status?: string }; error?: unknown } }>

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

  it('8. a NEW sitting of that paper is refused (BE-15 eligibility: every placed question must be live), the archive is what withdraws it', async () => {
    const student = await loginAs(t, STUDENT)
    const res = await student.post('/api/bijak/attempts', { paperId, mode: 'exam' })
    expect(res.status).toBe(403)
  })
})

describe('Laporan Soalan: "Arkib" on a live question with a newer revision in Semakan (T35 follow-up)', () => {
  let q2 = ''
  let report2 = ''

  it('setup: a second served question gets a version 2 in Semakan (live stays version 1)', async () => {
    q2 = (await t.db.query<{ id: string }>(`select question_id::text id from question_versions where number_label = 'SEED-MCQ-MATH-T5' limit 1`))[0]!.id
    const cols = (
      await t.db.query<{ column_name: string }>(
        `select column_name from information_schema.columns where table_name = 'question_versions' and column_name not in ('id', 'version_no', 'status') order by ordinal_position`,
      )
    ).map((c) => `"${c.column_name}"`)
    await t.db.query(
      `insert into question_versions (version_no, status, ${cols.join(', ')}) select 2, 'review', ${cols.join(', ')} from question_versions where question_id = $1 and version_no = 1`,
      [q2],
    )
    await t.db.query(`update questions set latest_version_no = 2 where id = $1`, [q2])
    const [row] = await t.db.query<{ live: number; latest: number; status: string }>(
      `select q.live_version_no live, q.latest_version_no latest, v.status from questions q join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no where q.id = $1`,
      [q2],
    )
    expect(row).toEqual({ live: 1, latest: 2, status: 'review' })
    const student = await loginAs(t, STUDENT)
    const res = await student.post('/api/question-reports', { questionId: q2, reasons: ['wrong_answer'], comment: 'Jawapan tidak tepat' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    report2 = (await t.db.query<{ id: string }>(`select id::text from question_reports where question_id = $1`, [q2]))[0]!.id
  })

  it('Arkib archives the LIVE version (200, not a 409 "Conflict."): serving ends, the revision stays in Semakan, one event on version 1', async () => {
    const res = await adminPatch(`/api/question-reports/${report2}`, { status: 'fixed', archive: true })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const versions = await t.db.query<{ version_no: number; status: string }>(`select version_no, status from question_versions where question_id = $1 order by version_no`, [q2])
    expect(versions).toEqual([
      { version_no: 1, status: 'archived' },
      { version_no: 2, status: 'review' },
    ])
    expect((await t.db.query<{ live: number | null }>(`select live_version_no live from questions where id = $1`, [q2]))[0]!.live).toBeNull()
    const events = await t.db.query<{ version_no: number; from_status: string; to_status: string; reason: string | null }>(
      `select version_no, from_status, to_status, reason from question_status_events where question_id = $1 order by id desc limit 1`,
      [q2],
    )
    expect(events[0]).toMatchObject({ version_no: 1, from_status: 'approved', to_status: 'archived' })
  })

  it('the archived live question is no longer drawn and a second Arkib is a no-op', async () => {
    expect(await drawn()).not.toContain(q2)
    const again = await adminPatch(`/api/question-reports/${report2}`, { status: 'fixed', archive: true })
    expect(again.status, JSON.stringify(again.body)).toBe(200)
  })
})

describe('Laporan Soalan: "Arkib" is tied to the reported version (REQ-B-018)', () => {
  let q3 = ''
  let report3 = ''
  const state = async () =>
    (
      await t.db.query<{ live: number | null; latest: number; status: string; report: string }>(
        `select q.live_version_no live, q.latest_version_no latest, v.status, (select status from question_reports where id = $2) report
           from questions q join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no where q.id = $1`,
        [q3, report3],
      )
    )[0]!

  it('setup: a report on version 1 of a served question, then version 2 is published (live moves to 2)', async () => {
    q3 = (await t.db.query<{ id: string }>(`select question_id::text id from question_versions where number_label = 'SEED-MCQ-SCI-T4' limit 1`))[0]!.id
    const student = await loginAs(t, STUDENT)
    const res = await student.post('/api/question-reports', { questionId: q3, reasons: ['wrong_answer'], comment: 'Jawapan tidak tepat' })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const [r] = await t.db.query<{ id: string; question_version_no: number }>(`select id::text, question_version_no from question_reports where question_id = $1`, [q3])
    expect(r!.question_version_no).toBe(1)
    report3 = r!.id
    const cols = (
      await t.db.query<{ column_name: string }>(
        `select column_name from information_schema.columns where table_name = 'question_versions' and column_name not in ('id', 'version_no', 'status') order by ordinal_position`,
      )
    ).map((c) => `"${c.column_name}"`)
    // publishing version 2 supersedes version 1 (one approved version per question)
    await t.db.query(`update question_versions set status = 'archived' where question_id = $1 and version_no = 1`, [q3])
    await t.db.query(
      `insert into question_versions (version_no, status, ${cols.join(', ')}) select 2, 'approved', ${cols.join(', ')} from question_versions where question_id = $1 and version_no = 1`,
      [q3],
    )
    await t.db.query(`update questions set latest_version_no = 2, live_version_no = 2 where id = $1`, [q3])
    expect(await state()).toMatchObject({ live: 2, latest: 2, status: 'approved', report: 'pending' })
  })

  it('an old report cannot archive the newer version: 409 with the BM text, the question and the report stay as they were', async () => {
    const res = await adminPatch(`/api/question-reports/${report3}`, { status: 'fixed', archive: true })
    expect(res.status, JSON.stringify(res.body)).toBe(409)
    expect((res.body as { error: { code: string; message: string } }).error).toMatchObject({ code: 'CONFLICT', message: QUESTION_REPORT_MESSAGES.archiveStaleVersion })
    expect(QUESTION_REPORT_MESSAGES.archiveStaleVersion).toBe('Soalan ini sudah mempunyai versi yang lebih baharu daripada yang dilaporkan. Arkib dibatalkan; semak versi terkini dahulu.')
    expect(await state()).toMatchObject({ live: 2, latest: 2, status: 'approved', report: 'pending' })
  })

  it('a request that names another version than the reported one is also a 409; a bad value is 422; the correct one is not blocked by the check', async () => {
    const wrong = await adminPatch(`/api/question-reports/${report3}`, { status: 'fixed', archive: true, expectedVersionNo: 2 })
    expect(wrong.status, JSON.stringify(wrong.body)).toBe(409)
    const bad = await adminPatch(`/api/question-reports/${report3}`, { status: 'fixed', archive: true, expectedVersionNo: 0 })
    expect(bad.status, JSON.stringify(bad.body)).toBe(422)
    expect((bad.body as { error: { fields: Record<string, string> } }).error.fields.expectedVersionNo).toBe(QUESTION_REPORT_MESSAGES.expectedVersionNo)
    // naming the reported version (1) still meets the stale live version 2: 409, nothing archived
    const stale = await adminPatch(`/api/question-reports/${report3}`, { status: 'fixed', archive: true, expectedVersionNo: 1 })
    expect(stale.status, JSON.stringify(stale.body)).toBe(409)
    expect(await state()).toMatchObject({ live: 2, status: 'approved', report: 'pending' })
  })

  it('a note-only resolution (no archive) of the same old report still works', async () => {
    const res = await adminPatch(`/api/question-reports/${report3}`, { status: 'reviewed', adminNotes: 'Disemak' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect((await state()).status).toBe('approved')
  })
})

describe('Laporan Soalan: the admin list carries the lifecycle status of the question (REQ-C-018)', () => {
  type Row = { id: string; question: { exists: boolean; status?: string; liveVersionNo?: number | null; isActive?: boolean } }
  const rowOf = async (label: string): Promise<Row['question']> => {
    const questionId = (await t.db.query<{ id: string }>(`select question_id::text id from question_versions where number_label = $1 limit 1`, [label]))[0]!.id
    const admin = await loginAs(t, ADMIN)
    const rows = (await admin.get('/api/question-reports?status=all')).body as { data: Row[] }
    const reportIds = (await t.db.query<{ id: string }>(`select id::text from question_reports where question_id = $1`, [questionId])).map((r) => r.id)
    return rows.data.find((r) => reportIds.includes(r.id))!.question
  }

  it('an archived question reads status archived with no live version, so the screen can hide "Arkib"', async () => {
    expect(await rowOf('SEED-MCQ-MATH-T4')).toMatchObject({ exists: true, status: 'archived', liveVersionNo: null })
  })

  it('a published question reads status approved with its live version', async () => {
    expect(await rowOf('SEED-MCQ-SCI-T4')).toMatchObject({ exists: true, status: 'approved', liveVersionNo: 2 })
  })

  it('a question whose live version was archived under a revision in Semakan reads status review with no live version', async () => {
    expect(await rowOf('SEED-MCQ-MATH-T5')).toMatchObject({ exists: true, status: 'review', liveVersionNo: null })
  })
})
