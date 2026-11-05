import { KirkpatrickInterventionReviewSchema, KirkpatrickInterventionRowSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LogCapture } from '../support/app'
import {
  ADMIN,
  SCHOOL_ADMIN_A,
  SCHOOL_ADMIN_B,
  STUDENT_1,
  TEACHER_A,
  TEACHER_B,
  TEACHER_C,
  type Client,
  type KirkpatrickTestApp,
  type World,
  addSession,
  bootKirkpatrickApp,
  buildWorld,
  client,
  errorIs,
} from './helpers'

const TOO_EARLY = 'Semakan hanya boleh dibuat selepas 7 hari daripada tarikh tindakan.'
const MARKER = 'Catatan-Semakan-Xk27'

describe('POST /api/kirkpatrick/interventions/:id/review (API-RPT-17, FR-GUR-11-*)', () => {
  let t: KirkpatrickTestApp
  let w: World
  const logs = new LogCapture()
  let admin: Client
  let teacherA: Client
  let teacherB: Client
  let teacherC: Client
  let adminA: Client
  let adminB: Client
  let student: Client

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'debug'
    t = await bootKirkpatrickApp({ logStream: logs, env: { LOG_LEVEL: 'debug' } }) // clock 2026-10-19 09:00 +08:00
    w = await buildWorld(t)
    admin = await client(t, ADMIN)
    teacherA = await client(t, TEACHER_A)
    teacherB = await client(t, TEACHER_B)
    teacherC = await client(t, TEACHER_C)
    adminA = await client(t, SCHOOL_ADMIN_A)
    adminB = await client(t, SCHOOL_ADMIN_B)
    student = await client(t, STUDENT_1)
  }, 180_000)
  afterAll(async () => {
    process.env.LOG_LEVEL = 'silent'
    await t.close()
  })

  const create = async (who: Client, studentId: string, actionDate: string, over: Record<string, unknown> = {}): Promise<string> => {
    const res = await who.post('/kirkpatrick/interventions', {
      studentId,
      alertType: 'inactive',
      actionDate,
      alertDescription: `Tidak aktif ${MARKER}`,
      actionTaken: `Berjumpa murid ${MARKER}`,
      ...over,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return envelopeOf(KirkpatrickInterventionRowSchema).parse(res.body).data.id
  }
  const review = (who: Client, id: string) => who.post(`/kirkpatrick/interventions/${id}/review`)
  const stored = async (id: string) =>
    (await t.db.query<{ after_accuracy: string | null }>(`select after_accuracy::text from interventions where id = $1`, [id]))[0]?.after_accuracy

  it("create accepts the alert type 'other' (DM-30) and still takes the client's before_accuracy as it is", async () => {
    const id = await create(teacherA, w.ids.p1, '2026-10-01', { alertType: 'other', beforeAccuracy: 42 })
    const row = (await t.db.query<{ alert_type: string; before_accuracy: string | null }>(`select alert_type, before_accuracy::text from interventions where id = $1`, [id]))[0]
    expect(row).toEqual({ alert_type: 'other', before_accuracy: '42.00' })
  })

  it('6 days after the action date is 409 with the exact BM text and writes nothing', async () => {
    const id = await create(teacherA, w.ids.p1, '2026-10-13') // today 2026-10-19 = action date + 6
    const res = await review(teacherA, id)
    errorIs(res, 409, 'CONFLICT', TOO_EARLY)
    expect(await stored(id)).toBeNull()
    const audits = await t.db.query(`select 1 from audit_events where action = 'kirkpatrick.intervention.reviewed' and target_id = $1`, [id])
    expect(audits).toHaveLength(0)
  })

  it('7 days after: 200, afterAccuracy = pooled accuracy of action date + 1 .. + 14 (MYT), one decimal', async () => {
    const id = await create(teacherA, w.ids.p1, '2026-10-12') // today = action date + 7
    const { p1 } = w.ids
    const [s0] = w.subjects
    await addSession(t, { userId: p1, subjectId: s0, at: '2026-10-12T10:00:00+08:00', answered: 10, correct: 0 }) // the action day: outside
    await addSession(t, { userId: p1, subjectId: s0, at: '2026-10-14T10:00:00+08:00', answered: 10, correct: 7 })
    await addSession(t, { userId: p1, subjectId: s0, at: '2026-10-26T23:30:00+08:00', answered: 4, correct: 3 }) // day + 14: inside
    await addSession(t, { userId: p1, subjectId: s0, at: '2026-10-27T00:30:00+08:00', answered: 10, correct: 10 }) // day + 15: outside
    await addSession(t, { userId: p1, subjectId: s0, at: '2026-10-15T10:00:00+08:00', answered: 9, correct: 9, isTest: true }) // test row: outside
    await addSession(t, { userId: p1, subjectId: s0, at: '2026-10-15T11:00:00+08:00', answered: 9, correct: 9, status: 'in_progress' }) // unfinished: outside

    const res = await review(teacherA, id)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toContain('no-store')
    expect(envelopeOf(KirkpatrickInterventionReviewSchema).parse(res.body).data).toEqual({ id, actionDate: '2026-10-12', afterAccuracy: 71.4 }) // 10 / 14
    expect(await stored(id)).toBe('71.40')

    // A repeat call recomputes.
    await addSession(t, { userId: p1, subjectId: s0, at: '2026-10-20T10:00:00+08:00', answered: 6, correct: 6 })
    const again = await review(teacherA, id)
    expect(again.body.data.afterAccuracy).toBe(80) // 16 / 20
    expect(await stored(id)).toBe('80.00')

    const audit = await t.db.query<{ actor_role: string; detail: Record<string, unknown> }>(
      `select actor_role, detail from audit_events where action = 'kirkpatrick.intervention.reviewed' and target_id = $1 order by id`,
      [id],
    )
    expect(audit).toHaveLength(2)
    expect(audit[0]).toMatchObject({ actor_role: 'teacher', detail: { studentId: p1 } })
    expect(JSON.stringify(audit)).not.toContain(MARKER)
  })

  it('no answers in the window: 200 with afterAccuracy null', async () => {
    const id = await create(teacherA, w.ids.p2, '2026-10-05')
    const res = await review(teacherA, id)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(envelopeOf(KirkpatrickInterventionReviewSchema).parse(res.body).data).toEqual({ id, actionDate: '2026-10-05', afterAccuracy: null })
    expect(await stored(id)).toBeNull()
  })

  it('school_admin reviews a record of the own school, even one made by a teacher', async () => {
    const id = await create(teacherA, w.ids.p2, '2026-10-01')
    const res = await review(adminA, id)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.afterAccuracy).toBeNull()
  })

  it('a teacher who is not the creator, or no longer teaches the pupil, gets 404', async () => {
    const bySchoolAdmin = await create(adminA, w.ids.p1, '2026-10-01')
    errorIs(await review(teacherA, bySchoolAdmin), 404, 'NOT_FOUND') // teaches the pupil but did not create the record
    const byTeacher = await create(teacherA, w.ids.p1, '2026-10-01')
    errorIs(await review(teacherB, byTeacher), 404, 'NOT_FOUND') // same school, other teacher
    expect(await stored(bySchoolAdmin)).toBeNull()
    expect(await stored(byTeacher)).toBeNull()
  })

  it('another school, an unknown id and a non-numeric id are all 404', async () => {
    const id = await create(teacherA, w.ids.p1, '2026-10-01')
    errorIs(await review(adminB, id), 404, 'NOT_FOUND')
    errorIs(await review(teacherC, id), 404, 'NOT_FOUND')
    errorIs(await review(teacherA, '987654321'), 404, 'NOT_FOUND')
    errorIs(await review(teacherA, 'abc'), 404, 'NOT_FOUND')
    expect(await stored(id)).toBeNull()
  })

  it('admin and student are 403; no session is 401; a write without the CSRF token is 403 CSRF_INVALID', async () => {
    const id = await create(teacherA, w.ids.p1, '2026-10-01')
    errorIs(await review(admin, id), 403, 'FORBIDDEN')
    errorIs(await review(student, id), 403, 'FORBIDDEN')
    errorIs(await t.http().post(`/api/kirkpatrick/interventions/${id}/review`), 401, 'UNAUTHORIZED')
    errorIs(await teacherA.who.agent.post(`/api/kirkpatrick/interventions/${id}/review`), 403, 'CSRF_INVALID')
    expect(await stored(id)).toBeNull()
  })

  it('the notes are never logged', async () => {
    expect(logs.lines.length).toBeGreaterThan(0)
    expect(logs.lines.join('\n')).not.toContain(MARKER)
  })
})
