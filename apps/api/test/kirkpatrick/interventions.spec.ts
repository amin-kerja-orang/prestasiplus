import {
  KirkpatrickInterventionListSchema,
  KirkpatrickInterventionRefusalSchema,
  KirkpatrickInterventionRowSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { InterventionsService } from '../../src/modules/reports/kirkpatrick/services/interventions.service'
import { LogCapture } from '../support/app'
import {
  ADMIN,
  SCHOOL_ADMIN_A,
  SCHOOL_ADMIN_B,
  STUDENT_1,
  TEACHER_A,
  TEACHER_C,
  type Client,
  type KirkpatrickTestApp,
  type World,
  bootKirkpatrickApp,
  buildWorld,
  client,
  errorIs,
  fieldsOf,
} from './helpers'

const MARKER = 'Catatan-Sensitif-Zq83'

describe('GET/POST /api/kirkpatrick/interventions (AC 3, 4, 7)', () => {
  let t: KirkpatrickTestApp
  let w: World
  const logs = new LogCapture()
  let admin: Client
  let teacherA: Client
  let teacherC: Client
  let adminA: Client
  let adminB: Client
  let student: Client

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'debug'
    t = await bootKirkpatrickApp({ logStream: logs, env: { LOG_LEVEL: 'debug' } })
    w = await buildWorld(t)
    admin = await client(t, ADMIN)
    teacherA = await client(t, TEACHER_A)
    teacherC = await client(t, TEACHER_C)
    adminA = await client(t, SCHOOL_ADMIN_A)
    adminB = await client(t, SCHOOL_ADMIN_B)
    student = await client(t, STUDENT_1)
  }, 180_000)
  afterAll(async () => {
    process.env.LOG_LEVEL = 'silent'
    await t.close()
  })

  const body = (studentId: string, over: Record<string, unknown> = {}) => ({
    studentId,
    alertType: 'inactive',
    actionDate: '2026-10-15',
    alertDescription: `Tidak aktif ${MARKER}`,
    actionTaken: `Berjumpa murid ${MARKER}`,
    ...over,
  })

  it('starts empty with zero KPIs', async () => {
    const res = await admin.get('/kirkpatrick/interventions')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toContain('no-store')
    expect(envelopeOf(KirkpatrickInterventionListSchema).parse(res.body).data).toEqual({ kpi: { total: 0, pending: 0, up: 0, down: 0 }, rows: [] })
  })

  describe('create', () => {
    it('teacher records an intervention for a pupil of the own class; createdBy is the session user', async () => {
      const res = await teacherA.post('/kirkpatrick/interventions', body(w.ids.p1, { createdBy: '999', beforeAccuracy: '50.04', afterAccuracy: null, beforeMood: 'sad', afterMood: '' }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.headers['cache-control']).toContain('no-store')
      const row = envelopeOf(KirkpatrickInterventionRowSchema).parse(res.body).data
      expect(row).toMatchObject({
        studentId: w.ids.p1,
        alertType: 'inactive',
        actionDate: '2026-10-15',
        beforeAccuracy: 50,
        afterAccuracy: null,
        beforeMood: 'sad',
        afterMood: null,
        createdBy: w.ids.teacherA,
        status: 'Menunggu Semakan',
        studentName: 'Murid Demo',
      })
      expect(row.createdAt).toMatch(/\+08:00$/)
    })

    it('the mock snake_case form names are accepted; the camelCase key wins when both are sent', async () => {
      const res = await teacherA.post('/kirkpatrick/interventions', {
        student_id: w.ids.p2,
        alert_type: 'declining',
        action_date: '2026-10-16',
        alert_description: 'Menurun',
        action_taken: 'Latihan tambahan',
        before_accuracy: 40,
        after_accuracy: 55,
        before_mood: 'okay',
        after_mood: 'happy',
        alertType: 'mood',
      })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.data).toMatchObject({ studentId: w.ids.p2, alertType: 'mood', beforeAccuracy: 40, afterAccuracy: 55, beforeMood: 'okay', afterMood: 'happy', status: 'Meningkat' })
    })

    it('derived statuses: Meningkat, Menurun, equal or missing before is null', async () => {
      const statuses: [Record<string, unknown>, unknown][] = [
        [{ beforeAccuracy: 60, afterAccuracy: 50 }, 'Menurun'],
        [{ beforeAccuracy: 50, afterAccuracy: 50 }, null],
        [{ afterAccuracy: 70 }, null],
        [{ beforeAccuracy: 0, afterAccuracy: 100 }, 'Meningkat'],
        [{ beforeAccuracy: 55 }, 'Menunggu Semakan'],
      ]
      for (const [over, expected] of statuses) {
        const res = await teacherA.post('/kirkpatrick/interventions', body(w.ids.p1, over))
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        expect(res.body.data.status, JSON.stringify(over)).toBe(expected)
      }
    })

    it('an unknown pupil, a non-pupil, a pupil outside the scope and a bad id all give the same typed 422', async () => {
      const refusals = [
        [teacherA, '987654321'],
        [teacherA, w.ids.teacherA], // not a pupil
        [teacherA, w.ids.maju], // same school, not in the teacher's classes
        [teacherA, w.ids.pb], // another school
        [teacherA, 'abc'],
        [teacherA, '007'],
        [adminA, w.ids.pb],
        [adminB, w.ids.p1],
        [teacherC, w.ids.p1],
      ] as const
      for (const [who, id] of refusals) {
        const res = await who.post('/kirkpatrick/interventions', body(id))
        expect(fieldsOf(res), id).toEqual({ studentId: 'Pelajar tidak dijumpai.' })
        expect(KirkpatrickInterventionRefusalSchema.parse(res.body).error.message).toBe('Pelajar tidak dijumpai.')
      }
      expect(fieldsOf(await teacherA.post('/kirkpatrick/interventions', { ...body('1'), studentId: 9876543210123 }))).toEqual({ studentId: 'Pelajar tidak dijumpai.' })
    })

    it('BUG-10: only a Tingkatan 4 or 5 pupil is accepted; a Tingkatan 2 pupil gets the same 422 as an unknown id (FN-M12-8.2.4)', async () => {
      const [form2] = await t.db.query<{ id: string }>(`select id::text from users where email like 'murid.demo001.%' and grade = 8 order by id limit 1`)
      expect(form2, 'the fixture keeps generated pupils of school A in Tingkatan 2').toBeDefined()
      const refuse = async (who: Client, id: string) => {
        const res = await who.post('/kirkpatrick/interventions', body(id))
        expect(res.status, id).toBe(422)
        expect(fieldsOf(res), id).toEqual({ studentId: 'Pelajar tidak dijumpai.' })
        expect(KirkpatrickInterventionRefusalSchema.parse(res.body).error.message).toBe('Pelajar tidak dijumpai.')
      }
      await refuse(admin, form2!.id)
      await refuse(adminA, form2!.id)
      // A teacher of the pupil's own class is refused too once the pupil is outside T4/T5 (grade 8, then no grade).
      for (const grade of ['8', 'null']) {
        await t.db.query(`update users set grade = ${grade} where id = $1`, [w.ids.p2])
        try {
          await refuse(teacherA, w.ids.p2)
        } finally {
          await t.db.query(`update users set grade = 10 where id = $1`, [w.ids.p2])
        }
      }
      // Tingkatan 4 (grade 10) and Tingkatan 5 (grade 11) are still accepted.
      for (const [who, id] of [[admin, w.ids.maju], [adminA, w.ids.p1], [teacherA, w.ids.p2]] as const) {
        const res = await who.post('/kirkpatrick/interventions', body(id))
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        // Remove the row again: the list-scope tests below count the rows of the earlier tests.
        await t.db.query(`delete from interventions where id = $1`, [res.body.data.id])
      }
    })

    it('stage order: field checks, then the pupil, then the calendar date', async () => {
      const badDate = await teacherA.post('/kirkpatrick/interventions', body(w.ids.p1, { actionDate: '2026-02-30' }))
      expect(fieldsOf(badDate)).toEqual({ actionDate: 'Tarikh tidak sah.' })
      expect(KirkpatrickInterventionRefusalSchema.parse(badDate.body).error.message).toBe('Tarikh tidak sah.')
      expect(fieldsOf(await teacherA.post('/kirkpatrick/interventions', body(w.ids.p1, { actionDate: '15/10/2026' })))).toEqual({ actionDate: 'Tarikh tidak sah.' })
      // Both wrong: the pupil is reported, not the date.
      expect(fieldsOf(await teacherA.post('/kirkpatrick/interventions', body(w.ids.pb, { actionDate: '2026-02-30' })))).toEqual({ studentId: 'Pelajar tidak dijumpai.' })
      // A field error beats the pupil check.
      expect(fieldsOf(await teacherA.post('/kirkpatrick/interventions', body(w.ids.pb, { alertType: 'x' })))).toEqual({ alertType: 'Medan ini tidak sah.' })
    })

    it('blank fields are required, bad values invalid, with the Laravel-style summary message', async () => {
      const empty = await teacherA.post('/kirkpatrick/interventions', {})
      expect(fieldsOf(empty)).toEqual({
        studentId: 'Medan ini diperlukan.',
        alertType: 'Medan ini diperlukan.',
        actionDate: 'Medan ini diperlukan.',
        alertDescription: 'Medan ini diperlukan.',
        actionTaken: 'Medan ini diperlukan.',
      })
      expect(empty.body.error.message).toBe('Medan ini diperlukan. (and 4 more errors)')
      expect(fieldsOf(await teacherA.post('/kirkpatrick/interventions', body(w.ids.p1, { alertDescription: '   ' })))).toEqual({ alertDescription: 'Medan ini diperlukan.' })
      expect(fieldsOf(await teacherA.post('/kirkpatrick/interventions', body(w.ids.p1, { actionTaken: 'x'.repeat(2001) })))).toEqual({ actionTaken: 'Medan ini tidak sah.' })
      for (const over of [
        { alertType: 'wellbeing' },
        { beforeAccuracy: 101 },
        { afterAccuracy: -1 },
        { beforeAccuracy: 'abc' },
        { beforeMood: 'angry' },
        { afterMood: 7 },
      ]) {
        expect(Object.values(fieldsOf(await teacherA.post('/kirkpatrick/interventions', body(w.ids.p1, over)))), JSON.stringify(over)).toEqual(['Medan ini tidak sah.'])
      }
    })

    it('a malformed body is a 422, never a 500', async () => {
      const res = await teacherA.who.agent.post('/api/kirkpatrick/interventions').set('X-CSRF-Token', teacherA.who.csrf).set('Content-Type', 'application/json').send('[1,2')
      expect(res.status).toBe(422)
    })

    it('a write without the CSRF token is 403 CSRF_INVALID and stores nothing', async () => {
      const before = (await t.db.query<{ n: number }>(`select count(*)::int as n from interventions`))[0]?.n
      errorIs(await teacherA.who.agent.post('/api/kirkpatrick/interventions').send(body(w.ids.p1)), 403, 'CSRF_INVALID')
      expect((await t.db.query<{ n: number }>(`select count(*)::int as n from interventions`))[0]?.n).toBe(before)
    })
  })

  describe('list scope (staff in scope only)', () => {
    let mine: number

    it('school_admin records one for a pupil the teacher does not teach', async () => {
      const res = await adminA.post('/kirkpatrick/interventions', body(w.ids.maju, { alertType: 'mood' }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.data.createdBy).not.toBe(w.ids.teacherA)
    })

    it('Mod Pelajar never creates a real row: 403 FORBIDDEN and nothing stored', async () => {
      const who = await client(t, ADMIN)
      const entered = await who.who.agent.post('/api/session/mode').set('X-CSRF-Token', who.who.csrf).send({ mode: 'mod_pelajar' })
      expect(entered.status, JSON.stringify(entered.body)).toBe(200)
      const before = (await t.db.query<{ n: number }>(`select count(*)::int as n from interventions`))[0]?.n
      const res = await who.who.agent
        .post('/api/kirkpatrick/interventions')
        .set('X-CSRF-Token', entered.body.data.csrf as string)
        .send(body(w.ids.p1))
      errorIs(res, 403, 'FORBIDDEN')
      expect((await t.db.query<{ n: number }>(`select count(*)::int as n from interventions`))[0]?.n).toBe(before)
    })

    it('the service itself refuses a test context before touching any store (defence in depth)', async () => {
      const service = new InterventionsService(null as never, null as never, null as never, null as never, null as never)
      const ctx = { isTest: true, role: 'school_admin', userId: '1', schoolId: '1', requestId: null, ip: null, sessionRowId: '1', scopeLevel: 'school' }
      await expect(service.create(ctx as never, body(w.ids.p1) as never)).rejects.toMatchObject({ status: 403 })
    })

    it('newest first, with KPIs over the visible rows only', async () => {
      const all = envelopeOf(KirkpatrickInterventionListSchema).parse((await admin.get('/kirkpatrick/interventions')).body).data
      const total = (await t.db.query<{ n: number }>(`select count(*)::int as n from interventions`))[0]?.n as number
      expect(all.rows).toHaveLength(total)
      expect(all.kpi.total).toBe(total)
      const stamps = all.rows.map((r) => [r.createdAt, Number(r.id)] as const)
      expect([...stamps].sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : b[1] - a[1]))).toEqual(stamps)
      expect(all.kpi.pending).toBe(all.rows.filter((r) => r.status === 'Menunggu Semakan').length)
      expect(all.kpi.up).toBe(all.rows.filter((r) => r.status === 'Meningkat').length)
      expect(all.kpi.down).toBe(all.rows.filter((r) => r.status === 'Menurun').length)

      const teacher = envelopeOf(KirkpatrickInterventionListSchema).parse((await teacherA.get('/kirkpatrick/interventions')).body).data
      mine = teacher.rows.length
      expect(mine).toBe(total - 1)
      expect(teacher.rows.every((r) => [w.ids.p1, w.ids.p2].includes(r.studentId))).toBe(true)
      expect(teacher.kpi.total).toBe(mine)
    })

    it('school_admin sees the pupils of the own school; the other school and its teacher see nothing', async () => {
      const own = envelopeOf(KirkpatrickInterventionListSchema).parse((await adminA.get('/kirkpatrick/interventions')).body).data
      expect(own.rows).toHaveLength(mine + 1)
      for (const who of [adminB, teacherC]) {
        expect(envelopeOf(KirkpatrickInterventionListSchema).parse((await who.get('/kirkpatrick/interventions')).body).data).toEqual({
          kpi: { total: 0, pending: 0, up: 0, down: 0 },
          rows: [],
        })
      }
    })

    it('a student cannot read or write', async () => {
      errorIs(await student.get('/kirkpatrick/interventions'), 403, 'FORBIDDEN')
      errorIs(await student.post('/kirkpatrick/interventions', body(w.ids.p1)), 403, 'FORBIDDEN')
    })
  })

  describe('sensitive text (AC 4)', () => {
    it('the notes are never logged and never written to the audit trail', async () => {
      // Includes a refused request (422) and an out-of-scope one, which log their failures.
      await teacherA.post('/kirkpatrick/interventions', body(w.ids.pb))
      await teacherA.post('/kirkpatrick/interventions', body(w.ids.p1, { actionDate: '2026-13-45' }))
      await teacherA.post('/kirkpatrick/interventions', body(w.ids.p1, { alertType: 'x' }))
      await teacherA.get('/kirkpatrick/interventions')
      await admin.get('/kirkpatrick/interventions')
      expect(logs.lines.length).toBeGreaterThan(0)
      expect(logs.lines.join('\n')).not.toContain(MARKER)

      const audit = await t.db.query<{ target_id: string; actor_role: string; detail: Record<string, unknown> }>(
        `select target_id, actor_role, detail from audit_events where action = 'kirkpatrick.intervention.created' order by id`,
      )
      expect(audit.length).toBeGreaterThanOrEqual(1)
      expect(JSON.stringify(audit)).not.toContain(MARKER)
      expect(audit[0]).toMatchObject({ actor_role: 'teacher', detail: { studentId: w.ids.p1, alertType: 'inactive' } })
      const stored = await t.db.query<{ n: number }>(`select count(*)::int as n from interventions where alert_description like $1`, [`%${MARKER}%`])
      expect(stored[0]?.n).toBeGreaterThan(0)
    })

    it('anonymous requests are 401', async () => {
      errorIs(await t.http().get('/api/kirkpatrick/interventions'), 401, 'UNAUTHORIZED')
      errorIs(await t.http().post('/api/kirkpatrick/interventions').send(body(w.ids.p1)), 401, 'UNAUTHORIZED')
    })
  })
})
