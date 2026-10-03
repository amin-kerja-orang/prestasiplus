/**
 * M12-T1 endpoints (SRS M12 v1.6 §7 #1-#14, §9): happy paths, 401 / 403 per role (admin and teacher twins, the
 * INFERRED school administrator forced to the own school), 404, 409, 422, the PDF, and the test hooks. Booted with
 * the real core, M01-M05, M08, M10 and M12 at the project clock. Tests run in order and share one runtime: the
 * read-only checks come first, the mutations after, the hooks (which change the M05 segment) last.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { users } from '@/modules/m01-authentication/mock'

import { feedback } from '../../mock'
import { addFeedback, addIntervention, addSegmentStudent } from '../../mock/hooks'
import {
  ADMIN,
  ADMIN_SEKOLAH,
  GURU,
  IBU_BAPA,
  PELAJAR,
  PPD,
  bootM12,
  shutdownM12,
  type DataBody,
  type ErrorBody,
  type M12Harness,
} from './helpers'

let h: M12Harness

beforeAll(async () => {
  h = await bootM12()
}, 600_000)

afterAll(() => {
  shutdownM12()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

const data = <T = Json>(r: { body: unknown }): T => (r.body as DataBody<T>).data
const errorOf = (r: { body: unknown }) => (r.body as ErrorBody).error

/** Moves the school administrator (account 8) to a school for one test, then back to SMK DEMO (900001). */
async function asSchoolAdmin<T>(schoolId: number | null, run: () => Promise<T>): Promise<T> {
  users.update(ADMIN_SEKOLAH, { schoolId }, h.clock.now())
  try {
    return await run()
  } finally {
    users.update(ADMIN_SEKOLAH, { schoolId: 900_001 }, h.clock.now())
  }
}

const SCOPED_GETS = [
  '/api/kirkpatrick/overview',
  '/api/kirkpatrick/learning',
  '/api/kirkpatrick/behavior',
  '/api/kirkpatrick/results',
  '/api/kirkpatrick/students/4664',
  '/api/kirkpatrick/filter-options',
] as const
/** The only endpoints of the school administrator (INFERRED S1 alias, G4 F6). */
const SA_GETS = ['/api/kirkpatrick/overview', '/api/kirkpatrick/filter-options'] as const
const STAFF_GETS = [
  '/api/kirkpatrick/reaction',
  '/api/kirkpatrick/chain',
  '/api/kirkpatrick/export-pdf',
  '/api/kirkpatrick/interventions',
] as const
const OPEN_GETS = ['/api/kirkpatrick/me', '/api/feedback/status'] as const

const INTERVENTION = {
  studentId: 4664,
  alertType: 'inactive',
  actionDate: '2026-09-24',
  alertDescription: 'Tidak aktif seminggu',
  actionTaken: 'Panggilan kepada penjaga',
} as const

// ---------------------------------------------------------------------------------------------
// Access (SRS §9, SEC-M12-01): independent of the URL prefix
// ---------------------------------------------------------------------------------------------

describe('access', () => {
  it('a guest gets 401 UNAUTHORIZED on all 14 endpoints', async () => {
    for (const url of [...SCOPED_GETS, ...STAFF_GETS, ...OPEN_GETS]) {
      const r = await h.get(url, null)
      expect([url, r.status, errorOf(r).code]).toEqual([url, 401, 'UNAUTHORIZED'])
    }
    expect((await h.post('/api/kirkpatrick/interventions', null, INTERVENTION)).status).toBe(401)
    expect((await h.post('/api/feedback', null, { nps: 5, satisfaction: 3 })).status).toBe(401)
  })

  it('pelajar, ibu bapa and PPD get 403 FORBIDDEN on every S1-S8 endpoint and the intervention form', async () => {
    for (const as of [PELAJAR, IBU_BAPA, PPD]) {
      for (const url of [...SCOPED_GETS, ...STAFF_GETS]) {
        const r = await h.get(url, as)
        expect([as, url, r.status, errorOf(r).code]).toEqual([as, url, 403, 'FORBIDDEN'])
      }
      expect((await h.post('/api/kirkpatrick/interventions', as, INTERVENTION)).status).toBe(403)
    }
  })

  it('admin and teacher (provisional, the /guru twins) get 200 on every read endpoint with the same data', async () => {
    for (const url of [...SCOPED_GETS, ...STAFF_GETS]) {
      const a = await h.get(url, ADMIN)
      const t = await h.get(url, GURU)
      expect([url, a.status, t.status]).toEqual([url, 200, 200])
      if (!url.endsWith('export-pdf')) expect(t.body).toEqual(a.body)
    }
  })

  it('any logged-in user reaches /me and the feedback status', async () => {
    for (const as of [ADMIN, PELAJAR, GURU, IBU_BAPA, PPD, ADMIN_SEKOLAH]) {
      for (const url of OPEN_GETS) expect((await h.get(url, as)).status).toBe(200)
    }
  })

  it('the school administrator (INFERRED alias of S1) reaches #1 and #14 only (G4 F6); every other endpoint is 403', async () => {
    for (const url of SA_GETS)
      expect([url, (await h.get(url, ADMIN_SEKOLAH)).status]).toEqual([url, 200])
    for (const url of [
      ...SCOPED_GETS.filter((u) => !SA_GETS.includes(u as never)),
      ...STAFF_GETS,
    ]) {
      const r = await h.get(url, ADMIN_SEKOLAH)
      expect([url, r.status, errorOf(r).code]).toEqual([url, 403, 'FORBIDDEN'])
    }
    expect(
      (await h.post('/api/kirkpatrick/interventions', ADMIN_SEKOLAH, INTERVENTION)).status,
    ).toBe(403)
  })

  it('the unrouted paths are 404 (DV-M12-11: GET on /interventions/{id} and /create, not 405)', async () => {
    for (const url of [
      '/api/kirkpatrick/interventions/1',
      '/api/kirkpatrick/interventions/create',
      '/api/kirkpatrick/students/abc',
      '/api/kirkpatrick/nope',
    ]) {
      const r = await h.get(url, ADMIN)
      expect([url, r.status, errorOf(r).code]).toEqual([url, 404, 'NOT_FOUND'])
    }
  })
})

// ---------------------------------------------------------------------------------------------
// #1-#6, #14 reads
// ---------------------------------------------------------------------------------------------

describe('#1 overview, #3 learning, #4 behavior, #5 results, #14 filter options', () => {
  it('#1 returns the platform overview and honours schoolId and state', async () => {
    const all = data(await h.get('/api/kirkpatrick/overview', ADMIN))
    expect(all.kpi).toMatchObject({
      t4t5: 4158,
      answers: 306_133,
      teachers: 522,
      teachersLoggedIn: 277,
    })
    expect(all.t4).toEqual({ gps: 4.3, gpsYear: 2025, recordsLabel: 4378 })
    expect(all.t1).toEqual({ satisfaction: 4.6, responses: 336 })

    const one = data(await h.get('/api/kirkpatrick/overview?schoolId=8080', ADMIN))
    expect(one.scope).toEqual({ schoolId: 8080, state: null })
    expect(one.t3).toEqual({ active: 53, t4t5: 184, sessions: 1_002, accuracy: 75.6 })
    expect(one.t4).toEqual({ gps: 4, gpsYear: 2026, recordsLabel: 4378 })

    const kelantan = data(await h.get('/api/kirkpatrick/overview?state=Kelantan', ADMIN))
    expect(kelantan.kpi).toMatchObject({ t4t5: 0, answers: 0, teachers: 0 })
    expect(kelantan.comparison.subtitle).toBe('Tiada Data vs Tiada Data')
    expect(kelantan.t1).toEqual({ satisfaction: 4.6, responses: 336 })

    const noHistory = data(await h.get('/api/kirkpatrick/overview?schoolId=9167', ADMIN))
    expect(noHistory.t4).toEqual({ gps: null, gpsYear: null, recordsLabel: 4378 })
  })

  it('#1 state narrows to the schools of the state and the other ignores no value (state of 8080)', async () => {
    const st = data(await h.get('/api/kirkpatrick/filter-options', ADMIN))
    const options = st.schools as { id: number; name: string }[]
    expect(options).toHaveLength(57)
    expect(st.states.length).toBeGreaterThanOrEqual(10)
    const sum = async () => {
      let t4t5 = 0
      for (const s of st.states as string[]) {
        t4t5 += data(await h.get(`/api/kirkpatrick/overview?state=${encodeURIComponent(s)}`, ADMIN))
          .kpi.t4t5
      }
      return t4t5
    }
    expect(await sum()).toBe(4158)
  })

  it('#3 / #4 / #5 take schoolId only (state ignored), #3 and #4 shapes', async () => {
    const l = data(await h.get('/api/kirkpatrick/learning?state=Kelantan', ADMIN))
    expect(l.kpi.answers).toBe(306_133)
    expect(l.schools).toHaveLength(33)
    const l8 = data(await h.get('/api/kirkpatrick/learning?schoolId=8080', ADMIN))
    expect(l8.kpi).toMatchObject({
      answers: 15_007,
      accuracy: 75.6,
      avgScore: 73.3,
      sessions: 1_002,
    })
    expect(l8.schools).toHaveLength(1)
    expect(l8.schools[0]).toMatchObject({ schoolId: 8080, students: 184, subjects: 3 })

    const b = data(await h.get('/api/kirkpatrick/behavior?schoolId=8080', ADMIN))
    expect(b.kpi).toMatchObject({ t4t5: 184, active: 53, teacherPct: 100 })
    expect(b.schools).toHaveLength(1)
    expect(b.heat.max).toBe(736)
    expect(b.moodCount).toBe(0)
  })

  it('#5 returns the 946 prediction rows in one response and the platform subject / trend tables', async () => {
    const r = data(await h.get('/api/kirkpatrick/results', ADMIN))
    expect(r.predictions).toHaveLength(946)
    expect(r.alesa.rows).toHaveLength(50)
    expect(r.subjectGps.rows).toHaveLength(5)
    expect(r.trend.rows).toHaveLength(7)
    const r8 = data(await h.get('/api/kirkpatrick/results?schoolId=8080', ADMIN))
    expect(r8.predictions).toHaveLength(53)
    expect(r8.alesa).toMatchObject({ lulus: 47, gagal: 3, intervensi: 3 })
    expect(r8.subjectGps.rows).toEqual(r.subjectGps.rows)
    const none = data(await h.get('/api/kirkpatrick/results?schoolId=987654', ADMIN))
    expect(none.predictions).toEqual([])
    expect(none.distribution).toBeNull()
    expect(none.alesa).toEqual({ lulus: 0, gagal: 0, intervensi: 0, rows: [] })
  })

  it('422 VALIDATION_ERROR for a schoolId that is not a whole number (SEC-M12-09)', async () => {
    for (const url of SCOPED_GETS.filter(
      (u) => !u.includes('/students/') && !u.includes('filter'),
    )) {
      for (const bad of ['abc', '1.5', '-3', '8080x']) {
        const r = await h.get(`${url}?schoolId=${bad}`, ADMIN)
        expect([url, bad, r.status, errorOf(r).code]).toEqual([url, bad, 422, 'VALIDATION_ERROR'])
        expect(errorOf(r).fields).toHaveProperty('schoolId')
      }
    }
    // An empty value is no filter.
    expect((await h.get('/api/kirkpatrick/overview?schoolId=', ADMIN)).status).toBe(200)
  })

  it('#2 reaction and #6 chain return the T1 figures and the platform chain; the scope is ignored', async () => {
    expect(data(await h.get('/api/kirkpatrick/reaction?schoolId=8080', ADMIN))).toEqual({
      npsStudent: 8.4,
      npsTeacher: 6.5,
      npsAdmin: 9.6,
      satisfaction: 4.6,
    })
    const c = data(await h.get('/api/kirkpatrick/chain?schoolId=8080', ADMIN))
    expect(c.t1).toEqual({ nps: 8.3, satisfaction: 4.6, responses: 336 })
    expect(c.t3.active).toBe(946)
    expect(c.t4).toEqual({ gps: 4.3, r: 0.1298, strength: 'Lemah' })
  })

  it('#14 lists the 57 schools A to Z and the states; "Semua" entries belong to the screen', async () => {
    const o = data(await h.get('/api/kirkpatrick/filter-options', ADMIN))
    expect(o.schools).toHaveLength(57)
    expect(o.schools[0]).toHaveProperty('name')
    expect(o.states).toContain('Selangor')
  })
})

describe('school administrator scope (INFERRED, build-plan v1.12 R.1.3)', () => {
  it('SMK DEMO (a fixture school) is included for its own administrator: own populations, whatever the query says', async () => {
    const o = data(await h.get('/api/kirkpatrick/overview?schoolId=8080', ADMIN_SEKOLAH))
    expect(o.scope.schoolId).toBe(900_001)
    // Own school's populations (fixture students and teachers), no practice segment for fixtures.
    expect(o.kpi.t4t5).toBeGreaterThan(0)
    expect(o.kpi.teachers).toBeGreaterThan(0)
    expect(o.t3.t4t5).toBe(o.kpi.t4t5)
    expect(o.t3).toMatchObject({ active: 0, sessions: 0 })
    const f = data(await h.get('/api/kirkpatrick/filter-options', ADMIN_SEKOLAH))
    expect(f.schools.map((s: { id: number }) => s.id)).toEqual([900_001])
  })

  it('admin and teacher still exclude fixture schools (BR-M12-01)', async () => {
    for (const as of [ADMIN, GURU]) {
      const o = data(await h.get('/api/kirkpatrick/overview?schoolId=900001', as))
      expect(o.kpi).toMatchObject({ t4t5: 0, teachers: 0 })
    }
    expect(data(await h.get('/api/kirkpatrick/overview', ADMIN)).kpi.t4t5).toBe(4158)
  })

  it('the account is forced to its own school: schoolId and state in the request cannot widen it', async () => {
    await asSchoolAdmin(8080, async () => {
      for (const q of ['', '?schoolId=8082', '?schoolId=8082&state=Kelantan', '?state=Kelantan']) {
        const o = data(await h.get(`/api/kirkpatrick/overview${q}`, ADMIN_SEKOLAH))
        expect([q, o.scope.schoolId, o.t3.t4t5, o.t3.active]).toEqual([q, 8080, 184, 53])
      }
      const f = data(await h.get('/api/kirkpatrick/filter-options', ADMIN_SEKOLAH))
      expect(f.schools.map((s: { id: number }) => s.id)).toEqual([8080])
      expect(f.states).toHaveLength(1)
      // A malformed schoolId is still a 422 (the input is validated before it is overridden).
      expect((await h.get('/api/kirkpatrick/overview?schoolId=abc', ADMIN_SEKOLAH)).status).toBe(
        422,
      )
    })
  })

  it('#3, #4, #5 and S8 are 403 for the school administrator even for its own school', async () => {
    await asSchoolAdmin(8080, async () => {
      for (const url of [
        '/api/kirkpatrick/learning',
        '/api/kirkpatrick/behavior?schoolId=8080',
        '/api/kirkpatrick/results',
        '/api/kirkpatrick/students/4664',
      ]) {
        expect([url, (await h.get(url, ADMIN_SEKOLAH)).status]).toEqual([url, 403])
      }
    })
  })

  it('an account without a school gets the empty scope', async () => {
    await asSchoolAdmin(null, async () => {
      const o = data(await h.get('/api/kirkpatrick/overview', ADMIN_SEKOLAH))
      expect(o.kpi).toMatchObject({ t4t5: 0, answers: 0 })
      expect(data(await h.get('/api/kirkpatrick/filter-options', ADMIN_SEKOLAH)).schools).toEqual(
        [],
      )
    })
  })
})

// ---------------------------------------------------------------------------------------------
// #10 S8, #11 S9, #7 PDF
// ---------------------------------------------------------------------------------------------

describe('#10 student detail', () => {
  it('Student A (4664) for the admin and the teacher', async () => {
    for (const as of [ADMIN, GURU]) {
      const s = data(await h.get('/api/kirkpatrick/students/4664', as))
      expect(s).toMatchObject({
        answers: 219,
        accuracy: 73.1,
        activeDays: 4,
        streak: 1,
        konsistensi: 22.5,
      })
      expect(s.student.name).toBe('Pelajar Demo 004664')
    }
  })

  it('403 FORBIDDEN (one uniform answer) for a missing id and for a user that is not a student', async () => {
    const missing = await h.get('/api/kirkpatrick/students/987654321', ADMIN)
    const notStudent = await h.get('/api/kirkpatrick/students/1', ADMIN)
    expect([missing.status, notStudent.status]).toEqual([403, 403])
    expect(errorOf(missing).code).toBe('FORBIDDEN')
    expect(missing.body).toEqual(notStudent.body)
  })

  it('403 FORBIDDEN for 5571 and 5551 (the live second ids are not users, DV-M12-25)', async () => {
    for (const id of [5571, 5551]) {
      const r = await h.get(`/api/kirkpatrick/students/${String(id)}`, ADMIN)
      expect([id, r.status, errorOf(r).code]).toEqual([id, 403, 'FORBIDDEN'])
    }
  })

  it('a student without a session is the zero state (200)', async () => {
    const s = data(await h.get(`/api/kirkpatrick/students/${String(PELAJAR)}`, ADMIN))
    expect(s).toMatchObject({ answers: 0, accuracy: 0, activeDays: 0, streak: 0, platform: [] })
  })
})

describe('#11 my Kirkpatrick', () => {
  it('the admin: no headcount and 30 empty squares from 27/08 to 25/09', async () => {
    const m = data(await h.get('/api/kirkpatrick/me', ADMIN))
    expect(m.headcount).toBeNull()
    expect(m.days).toHaveLength(30)
    expect(m.days[0].date).toBe('27/08')
    expect(m.days[29].date).toBe('25/09')
  })

  it('the viewer is the session user, never a query parameter', async () => {
    const own = data(await h.get('/api/kirkpatrick/me?userId=4664', PELAJAR))
    expect(own.headcount).toBeNull()
    expect(own.days).toHaveLength(30)
  })
})

describe('#7 export PDF', () => {
  it('returns application/pdf named laporan-kirkpatrick.pdf with the chain content (admin and teacher)', async () => {
    for (const as of [ADMIN, GURU]) {
      const r = await h.get('/api/kirkpatrick/export-pdf', as)
      expect(r.status).toBe(200)
      expect(r.headers['content-type']).toBe('application/pdf')
      expect(r.headers['content-disposition']).toContain('laporan-kirkpatrick.pdf')
      const text = await (r.body as Blob).text()
      expect(text.startsWith('%PDF-1.4')).toBe(true)
      expect(text).toContain('Model Kirkpatrick - Rantaian Impak')
      // Parentheses are escaped in the PDF text operators.
      expect(text).toContain('r = 0.1298 \\(Lemah\\)')
      expect(text).toContain('\\(perbezaan +15.5%\\)')
      expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------------------------
// #8-#9 interventions
// ---------------------------------------------------------------------------------------------

describe('#8 / #9 interventions', () => {
  it('starts empty: KPIs 0, no rows', async () => {
    expect(data(await h.get('/api/kirkpatrick/interventions', ADMIN))).toEqual({
      kpi: { total: 0, pending: 0, up: 0, down: 0 },
      rows: [],
    })
  })

  it('#9 stores one (201), createdBy is the session user, the status derives on read (BR-M12-26)', async () => {
    const r = await h.post('/api/kirkpatrick/interventions', ADMIN, INTERVENTION)
    expect(r.status).toBe(201)
    expect(data(r)).toMatchObject({
      id: 1,
      studentId: 4664,
      alertType: 'inactive',
      createdBy: ADMIN,
      beforeAccuracy: null,
      afterAccuracy: null,
      status: 'Menunggu Semakan',
      studentName: 'Pelajar Demo 004664',
    })

    await h.post('/api/kirkpatrick/interventions', GURU, {
      ...INTERVENTION,
      studentId: 4644,
      alertType: 'declining',
      beforeAccuracy: 40,
      afterAccuracy: 55.56,
      beforeMood: 'sad',
      afterMood: 'okay',
    })
    await h.post('/api/kirkpatrick/interventions', ADMIN, {
      ...INTERVENTION,
      alertType: 'mood',
      beforeAccuracy: 70,
      afterAccuracy: 60,
    })
    await h.post('/api/kirkpatrick/interventions', ADMIN, {
      ...INTERVENTION,
      beforeAccuracy: 50,
      afterAccuracy: 50,
    })
    const list = data(await h.get('/api/kirkpatrick/interventions', GURU))
    expect(list.kpi).toEqual({ total: 4, pending: 1, up: 1, down: 1 })
    // Newest first; "equal" is counted only in the total.
    expect(list.rows.map((x: { id: number }) => x.id)).toEqual([4, 3, 2, 1])
    expect(list.rows.map((x: { status: string | null }) => x.status)).toEqual([
      null,
      'Menurun',
      'Meningkat',
      'Menunggu Semakan',
    ])
    expect(list.rows[2]).toMatchObject({
      afterAccuracy: 55.6,
      beforeMood: 'sad',
      afterMood: 'okay',
      createdBy: GURU,
    })
  })

  it('accepts the form field names (snake_case), strings for numbers and blank optional fields', async () => {
    const r = await h.post('/api/kirkpatrick/interventions', ADMIN, {
      student_id: '4664',
      alert_type: 'mood',
      action_date: '2026-09-25',
      alert_description: '  Sedih  ',
      action_taken: 'Kaunseling',
      before_accuracy: '45.5',
      after_accuracy: '',
      before_mood: '',
      after_mood: 'happy',
    })
    expect(r.status).toBe(201)
    expect(data(r)).toMatchObject({
      studentId: 4664,
      alertDescription: 'Sedih',
      beforeAccuracy: 45.5,
      afterAccuracy: null,
      beforeMood: null,
      afterMood: 'happy',
      status: 'Menunggu Semakan',
    })
  })

  it('422 "Pelajar tidak dijumpai." for a user that is not a student or an unknown id (BR-M12-27)', async () => {
    for (const studentId of [1, 5, 987_654_321]) {
      const r = await h.post('/api/kirkpatrick/interventions', ADMIN, {
        ...INTERVENTION,
        studentId,
      })
      expect(r.status).toBe(422)
      expect(errorOf(r).code).toBe('VALIDATION_ERROR')
      expect(errorOf(r).fields).toEqual({ studentId: 'Pelajar tidak dijumpai.' })
    }
  })

  it('422 with a field error for every missing or invalid field; nothing is stored', async () => {
    const before = data(await h.get('/api/kirkpatrick/interventions', ADMIN)).kpi.total
    const empty = await h.post('/api/kirkpatrick/interventions', ADMIN, {})
    expect(empty.status).toBe(422)
    expect(Object.keys(errorOf(empty).fields ?? {}).sort()).toEqual([
      'actionDate',
      'actionTaken',
      'alertDescription',
      'alertType',
      'studentId',
    ])
    const bad = await h.post('/api/kirkpatrick/interventions', ADMIN, {
      studentId: 'x',
      alertType: 'sleepy',
      actionDate: 7,
      alertDescription: 'a'.repeat(2001),
      actionTaken: '   ',
      beforeAccuracy: 'abc',
      afterAccuracy: 100.5,
      beforeMood: 'angry',
    })
    expect(bad.status).toBe(422)
    expect(Object.keys(errorOf(bad).fields ?? {}).sort()).toEqual([
      'actionDate',
      'actionTaken',
      'afterAccuracy',
      'alertDescription',
      'alertType',
      'beforeAccuracy',
      'beforeMood',
      'studentId',
    ])
    const range = await h.post('/api/kirkpatrick/interventions', ADMIN, {
      ...INTERVENTION,
      beforeAccuracy: -1,
    })
    expect(range.status).toBe(422)
    expect(errorOf(range).fields).toHaveProperty('beforeAccuracy')
    const date = await h.post('/api/kirkpatrick/interventions', ADMIN, {
      ...INTERVENTION,
      actionDate: '2026-13-40',
    })
    expect(date.status).toBe(422)
    expect(errorOf(date).fields).toEqual({ actionDate: 'Tarikh tidak sah.' })
    // A body that is not an object is a 422, never a crash.
    expect((await h.post('/api/kirkpatrick/interventions', ADMIN, [1, 2])).status).toBe(422)
    expect(data(await h.get('/api/kirkpatrick/interventions', ADMIN)).kpi.total).toBe(before)
  })
})

// ---------------------------------------------------------------------------------------------
// #12-#13 feedback
// ---------------------------------------------------------------------------------------------

describe('#12 / #13 feedback', () => {
  it('#12 status: the admin already answered 2026-09, the pelajar has not', async () => {
    expect(data(await h.get('/api/feedback/status', ADMIN))).toEqual({
      month: '2026-09',
      answered: true,
    })
    expect(data(await h.get('/api/feedback/status', PELAJAR))).toEqual({
      month: '2026-09',
      answered: false,
    })
  })

  it('#13 stores one response (201): T1 gains it (337 respon, NPS 8.4), the role is the session role', async () => {
    const r = await h.post('/api/feedback', PELAJAR, {
      nps: 10,
      satisfaction: 5,
      role: 'admin',
      userId: 1,
    })
    expect(r.status).toBe(201)
    expect(data(r)).toMatchObject({
      userId: PELAJAR,
      role: 'student',
      month: '2026-09',
      nps: 10,
      satisfaction: 5,
      schoolId: 900_001,
    })
    expect(data(r).id).toBeGreaterThanOrEqual(1001)
    expect(data(await h.get('/api/feedback/status', PELAJAR))).toEqual({
      month: '2026-09',
      answered: true,
    })
    expect(data(await h.get('/api/kirkpatrick/reaction', ADMIN)).npsStudent).toBe(8.4)
    expect(data(await h.get('/api/kirkpatrick/overview', ADMIN)).t1).toEqual({
      satisfaction: 4.6,
      responses: 337,
    })
  })

  it('409 CONFLICT for a second response in the same month (the admin and the pelajar)', async () => {
    for (const as of [PELAJAR, ADMIN]) {
      const r = await h.post('/api/feedback', as, { nps: 3, satisfaction: 2 })
      expect([r.status, errorOf(r).code]).toEqual([409, 'CONFLICT'])
    }
    expect(feedback.count('Q-M12-T1')).toBe(337)
  })

  it('422 for values out of range, not whole numbers or missing; nothing is stored', async () => {
    const cases: [unknown, string][] = [
      [{ nps: 11, satisfaction: 3 }, 'nps'],
      [{ nps: -1, satisfaction: 3 }, 'nps'],
      [{ nps: 7.5, satisfaction: 3 }, 'nps'],
      [{ nps: 'x', satisfaction: 3 }, 'nps'],
      [{ nps: 5, satisfaction: 0 }, 'satisfaction'],
      [{ nps: 5, satisfaction: 6 }, 'satisfaction'],
      [{ satisfaction: 3 }, 'nps'],
      [{ nps: 5 }, 'satisfaction'],
    ]
    for (const [body, field] of cases) {
      const r = await h.post('/api/feedback', GURU, body)
      expect([JSON.stringify(body), r.status]).toEqual([JSON.stringify(body), 422])
      expect(errorOf(r).fields).toHaveProperty(field)
    }
    expect((await h.post('/api/feedback', GURU, {})).status).toBe(422)
    expect((await h.post('/api/feedback', GURU, [])).status).toBe(422)
    expect(data(await h.get('/api/feedback/status', GURU)).answered).toBe(false)
  })

  it('the teacher and the school administrator may answer; only student / teacher / admin enter the NPS by role', async () => {
    expect((await h.post('/api/feedback', GURU, { nps: 8, satisfaction: 4 })).status).toBe(201)
    const sa = await h.post('/api/feedback', ADMIN_SEKOLAH, { nps: 0, satisfaction: 1 })
    expect(sa.status).toBe(201)
    expect(data(sa).role).toBe('school_admin')
    const a = feedback.aggregates()
    expect(a.responses).toBe(339)
    expect(a.npsAdmin).toBe(9.6)
    expect(a.npsTeacher).toBe(Math.round(((130 + 8) / 21) * 10) / 10)
  })

  it('XR-M17-21: the school filter of Q-M12-T1 counts the runtime responses of the respondents school', () => {
    // SMK DEMO (900001): the pelajar, the teacher and the school administrator answered above.
    expect(feedback.count('Q-M12-T1', 900_001)).toBe(3)
    expect(feedback.aggregates(900_001)).toMatchObject({
      responses: 3,
      npsStudent: 10,
      npsTeacher: 8,
      npsAdmin: 0,
    })
    expect(feedback.aggregates(900_001).satisfaction).toBe(3.3)
    expect(feedback.count('Q-M12-T1')).toBe(339)
  })
})

// ---------------------------------------------------------------------------------------------
// §6.11 test hooks (they change the M05 segment: last)
// ---------------------------------------------------------------------------------------------

describe('test hooks (SRS §6.11)', () => {
  it('addFeedback stores a response for the current month; a second one is refused', () => {
    const row = addFeedback({ userId: 3, nps: 7, satisfaction: 4 })
    expect(row).toMatchObject({
      userId: 3,
      role: 'student',
      month: '2026-09',
      nps: 7,
      satisfaction: 4,
    })
    expect(() => addFeedback({ userId: 3, nps: 7, satisfaction: 4 })).toThrow()
    expect(() => addFeedback({ userId: 987_654_321, nps: 7, satisfaction: 4 })).toThrow(RangeError)
    expect(feedback.count('Q-M12-T1')).toBe(340)
  })

  it('addIntervention stores one with createdBy 1 by default and validates the student', () => {
    const row = addIntervention({ ...INTERVENTION, studentId: 4644 })
    expect(row).toMatchObject({ studentId: 4644, createdBy: 1, status: 'Menunggu Semakan' })
    expect(() => addIntervention({ ...INTERVENTION, studentId: 1 })).toThrow()
  })

  it('addSegmentStudent adds one T4/T5 student with the given answers (band-boundary checks)', async () => {
    const before = data(await h.get('/api/kirkpatrick/overview?schoolId=8080', ADMIN))
    const id = addSegmentStudent({ schoolId: 8080, answers: 50, correct: 40 })
    expect(users.get(id)).toMatchObject({ role: 'student', schoolId: 8080 })
    const after = data(await h.get('/api/kirkpatrick/overview?schoolId=8080', ADMIN))
    const count = (o: Json, key: string) =>
      o.bands.find((b: { key: string }) => b.key === key).count
    expect(count(after, 'champion')).toBe(count(before, 'champion') + 1)
    expect(count(after, 'tidakTerlibat')).toBe(count(before, 'tidakTerlibat') - 1)
    expect(after.t3.active).toBe(before.t3.active + 1)
    expect(after.kpi.answers).toBe(before.kpi.answers + 50)
    // 49 answers is still Konsisten, 50 is Champion (BR-M12-06, v1.6).
    const id49 = addSegmentStudent({ schoolId: 8080, answers: 49, correct: 49 })
    expect(id49).not.toBe(id)
    const last = data(await h.get('/api/kirkpatrick/overview?schoolId=8080', ADMIN))
    expect(count(last, 'konsisten')).toBe(count(before, 'konsisten') + 1)
    expect(count(last, 'champion')).toBe(count(before, 'champion') + 1)
  })

  it('addSegmentStudent rejects bad input', () => {
    expect(() => addSegmentStudent({ schoolId: 8080, answers: 5, correct: 6 })).toThrow(RangeError)
    expect(() => addSegmentStudent({ schoolId: 8080, answers: -1, correct: 0 })).toThrow(RangeError)
    expect(() => addSegmentStudent({ schoolId: 987_654, answers: 5, correct: 5 })).toThrow(
      RangeError,
    )
    expect(() => addSegmentStudent({ schoolId: 1.5, answers: 5, correct: 5 })).toThrow(TypeError)
  })
})
