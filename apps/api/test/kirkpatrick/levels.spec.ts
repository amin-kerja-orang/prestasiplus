import { treatDemoAsSecondary } from '../support/secondary'
import {
  KirkpatrickBehaviorSchema,
  KirkpatrickChainSchema,
  KirkpatrickFilterOptionsSchema,
  KirkpatrickLearningSchema,
  KirkpatrickOverviewSchema,
  KirkpatrickReactionSchema,
  KirkpatrickResultsSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

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
  bootKirkpatrickApp,
  buildWorld,
  client,
  errorIs,
  fieldsOf,
} from './helpers'

const LEVEL_ROUTES = [
  '/kirkpatrick/overview',
  '/kirkpatrick/reaction',
  '/kirkpatrick/learning',
  '/kirkpatrick/behavior',
  '/kirkpatrick/results',
  '/kirkpatrick/chain',
  '/kirkpatrick/filter-options',
  '/kirkpatrick/interventions',
  '/kirkpatrick/export-pdf',
  '/kirkpatrick/students/1',
] as const

describe('M12 levels S1 to S6 and filter options (AC 1 to 3)', () => {
  let t: KirkpatrickTestApp
  let w: World
  let admin: Client
  let teacherA: Client
  let teacherB: Client
  let teacherC: Client
  let adminA: Client
  let adminB: Client
  let student: Client

  beforeAll(async () => {
    t = await bootKirkpatrickApp()
    await treatDemoAsSecondary(t.db, false)
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
    await t.close()
  })

  describe('guards', () => {
    it('no session is 401 on every route', async () => {
      for (const path of [...LEVEL_ROUTES, '/kirkpatrick/me', '/feedback/status']) {
        errorIs(await t.http().get(`/api${path}`), 401, 'UNAUTHORIZED', 'Unauthenticated.')
      }
      errorIs(await t.http().post('/api/kirkpatrick/interventions').send({}), 401, 'UNAUTHORIZED')
      errorIs(await t.http().post('/api/feedback').send({}), 401, 'UNAUTHORIZED')
    })

    it('a student is 403 on every staff route', async () => {
      for (const path of LEVEL_ROUTES) {
        errorIs(await student.get(path), 403, 'FORBIDDEN', 'This action is unauthorized.')
      }
      errorIs(await student.post('/kirkpatrick/interventions', {}), 403, 'FORBIDDEN')
    })
  })

  describe('overview (S1)', () => {
    it('platform figures for admin parse with the contract and count only completed non-test practice', async () => {
      const res = await admin.get('/kirkpatrick/overview')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.headers['cache-control']).toContain('no-store')
      const data = envelopeOf(KirkpatrickOverviewSchema).parse(res.body).data
      expect(data.scope).toEqual({ schoolId: null, state: null })
      // A: 4 T4/T5 pupils, B: 1. Answers 68 + 5; correct 51 + 5 = 56 of 73.
      expect(data.kpi.t4t5).toBe(5)
      expect(data.kpi.answers).toBe(73)
      expect(data.kpi.accuracy).toBe(76.7)
      expect(data.t3).toEqual({ active: 3, t4t5: 5, sessions: 4, accuracy: 76.7 })
      expect(data.t2).toEqual({ accuracy: 76.7, answers: 73 })
      expect(data.t4).toEqual({ gps: null, gpsYear: null, recordsLabel: 0 })
    })

    it('school A: bands, comparison panels and sentences', async () => {
      const res = await admin.get(`/kirkpatrick/overview?schoolId=${w.schoolA}`)
      const data = envelopeOf(KirkpatrickOverviewSchema).parse(res.body).data
      expect(data.scope).toEqual({ schoolId: w.schoolA, state: null })
      expect(data.t3).toEqual({ active: 2, t4t5: 4, sessions: 3, accuracy: 75 })
      expect(data.bands).toEqual([
        { key: 'champion', count: 1, pct: 25 },
        { key: 'konsisten', count: 0, pct: 0 },
        { key: 'berkembang', count: 1, pct: 25 },
        { key: 'minimum', count: 0, pct: 0 },
        { key: 'tidakTerlibat', count: 2, pct: 50 },
      ])
      expect(data.comparison.subtitle).toBe('September 2026 vs Oktober 2026')
      expect(data.comparison.before).toEqual({ month: '2026-09', from: '2026-09-01', to: '2026-09-30', active: 1, accuracy: 75, answers: 8, champions: 0 })
      expect(data.comparison.after).toEqual({ month: '2026-10', from: '2026-10-01', to: '2026-10-19', active: 2, accuracy: 75, answers: 60, champions: 1 })
      expect(data.comparison.delta).toEqual({ active: 1, accuracy: 0, answers: 52, champions: 1 })
      expect(data.comparison.sentences).toEqual(['1 pelajar baru mula aktif.', 'Jumlah jawapan meningkat 650%.', '1 pelajar naik ke tahap Champion.'])
    })

    it('a state filter selects its schools; an unknown school or state is the zero state; a mismatching pair is empty', async () => {
      const state = (await t.db.query<{ state: string }>(`select state from schools where id = $1`, [w.schoolA]))[0]?.state as string
      const byState = envelopeOf(KirkpatrickOverviewSchema).parse((await admin.get(`/kirkpatrick/overview?state=${encodeURIComponent(state)}`)).body).data
      expect(byState.scope).toEqual({ schoolId: null, state })
      expect(byState.kpi.answers).toBe(73)

      const unknown = envelopeOf(KirkpatrickOverviewSchema).parse((await admin.get('/kirkpatrick/overview?schoolId=987654321')).body).data
      expect(unknown.kpi).toMatchObject({ t4t5: 0, answers: 0, accuracy: 0 })
      expect(unknown.comparison).toMatchObject({ subtitle: 'Tiada Data vs Tiada Data', before: null, after: null, delta: null })
      expect(unknown.bands.map((b) => b.count)).toEqual([0, 0, 0, 0, 0])

      const nowhere = envelopeOf(KirkpatrickOverviewSchema).parse((await admin.get('/kirkpatrick/overview?state=Tiada%20Negeri')).body).data
      expect(nowhere.kpi.t4t5).toBe(0)
      const mismatch = envelopeOf(KirkpatrickOverviewSchema).parse((await admin.get(`/kirkpatrick/overview?schoolId=${w.schoolA}&state=Tiada%20Negeri`)).body).data
      expect(mismatch.kpi.t4t5).toBe(0)
    })

    it('a malformed schoolId is 422 on fields.schoolId with the summary message', async () => {
      for (const path of ['overview', 'learning', 'behavior', 'results']) {
        const res = await admin.get(`/kirkpatrick/${path}?schoolId=abc`)
        expect(fieldsOf(res)).toEqual({ schoolId: 'Medan ini tidak sah.' })
        expect(res.body.error.message).toBe('Medan ini tidak sah.')
      }
      expect(fieldsOf(await admin.get('/kirkpatrick/overview?schoolId=1.5'))).toEqual({ schoolId: 'Medan ini tidak sah.' })
    })

    it('teacher and school_admin are forced to the own school whatever schoolId or state is sent', async () => {
      for (const who of [teacherA, adminA]) {
        const res = await who.get(`/kirkpatrick/overview?schoolId=${w.schoolB}&state=Tiada%20Negeri`)
        const data = envelopeOf(KirkpatrickOverviewSchema).parse(res.body).data
        expect(data.scope).toEqual({ schoolId: w.schoolA, state: null })
        expect(data.kpi.t4t5).toBe(4)
        expect(data.kpi.answers).toBe(68)
      }
      for (const who of [teacherC, adminB]) {
        const data = envelopeOf(KirkpatrickOverviewSchema).parse((await who.get(`/kirkpatrick/overview?schoolId=${w.schoolA}`)).body).data
        expect(data.scope.schoolId).toBe(w.schoolB)
        expect(data.kpi.answers).toBe(5)
      }
    })
  })

  describe('reaction (S2) and chain (S6)', () => {
    it('with no feedback every mean is 0; admin sees the platform, the others their school', async () => {
      for (const who of [admin, teacherA, adminB]) {
        const data = envelopeOf(KirkpatrickReactionSchema).parse((await who.get('/kirkpatrick/reaction')).body).data
        expect(data).toEqual({ npsStudent: 0, npsTeacher: 0, npsAdmin: 0, satisfaction: 0 })
      }
    })

    it('the chain is platform-wide for admin and school-scoped for the others', async () => {
      const platform = envelopeOf(KirkpatrickChainSchema).parse((await admin.get('/kirkpatrick/chain')).body).data
      expect(platform.t2).toEqual({ accuracy: 76.7, answers: 73, avgScore: expect.any(Number) })
      expect(platform.t3).toMatchObject({ active: 3, t4t5: 5, pct: 60, sessions: 4 })
      expect(platform.t4).toEqual({ gps: null, r: 0.1298, strength: 'Lemah' })
      expect(platform.correlation.bands).toHaveLength(3)

      const own = envelopeOf(KirkpatrickChainSchema).parse((await teacherA.get('/kirkpatrick/chain')).body).data
      expect(own.t2.answers).toBe(68)
      expect(own.t3).toMatchObject({ active: 2, t4t5: 4, sessions: 3 })
      const other = envelopeOf(KirkpatrickChainSchema).parse((await adminB.get('/kirkpatrick/chain')).body).data
      expect(other.t2.answers).toBe(5)
    })
  })

  describe('learning (S3)', () => {
    it('subjects by exact accuracy, status, average score and the school table', async () => {
      const res = await admin.get(`/kirkpatrick/learning?schoolId=${w.schoolA}`)
      const data = envelopeOf(KirkpatrickLearningSchema).parse(res.body).data
      expect(data.kpi).toEqual({ answers: 68, accuracy: 75, avgScore: 68.3, sessionsCompleted: 3, sessions: 3, completionPct: 100 })
      expect(data.subjects.map((s) => [s.subjectId, s.answers, s.accuracy, s.status])).toEqual([
        [w.subjects[0], 58, 79.3, 'Developing'],
        [w.subjects[1], 10, 50, 'Developing'],
      ])
      expect(data.schools).toHaveLength(1)
      expect(data.schools[0]).toMatchObject({ schoolId: w.schoolA, students: 4, answers: 68, accuracy: 75, avgScore: 68.3, subjects: 2 })
    })

    it('the platform view lists both schools, best accuracy first; teacher is forced to the own school', async () => {
      const platform = envelopeOf(KirkpatrickLearningSchema).parse((await admin.get('/kirkpatrick/learning')).body).data
      expect(platform.schools.map((s) => s.schoolId)).toEqual([w.schoolB, w.schoolA])
      const forced = envelopeOf(KirkpatrickLearningSchema).parse((await teacherA.get(`/kirkpatrick/learning?schoolId=${w.schoolB}`)).body).data
      expect(forced.kpi.answers).toBe(68)
      const schoolAdmin = await adminA.get('/kirkpatrick/learning')
      expect(schoolAdmin.status).toBe(200)
    })
  })

  describe('behavior (S4)', () => {
    it('kpi, school table, heat grid in MYT, alerts and the fixed mood count', async () => {
      const data = envelopeOf(KirkpatrickBehaviorSchema).parse((await admin.get(`/kirkpatrick/behavior?schoolId=${w.schoolA}`)).body).data
      expect(data.kpi).toMatchObject({ t4t5: 4, active: 2, sessions: 3, answers: 68, accuracy: 75 })
      expect(data.schools).toHaveLength(1)
      expect(data.schools[0]).toMatchObject({ schoolId: w.schoolA, students: 4, active: 2, answers: 68, sessions: 3, perActive: 34, score: 50, tahap: 'berkembang' })
      expect(data.heat.cells).toHaveLength(7)
      expect(data.heat.cells.every((r) => r.length === 18)).toBe(true)
      // Thursday 10:00 (8 answers), Monday 10:00 (10), Saturday 10:00 (50): hour 10 is column 4.
      expect(data.heat.cells[3]?.[4]).toBe(8)
      expect(data.heat.cells[0]?.[4]).toBe(10)
      expect(data.heat.cells[5]?.[4]).toBe(50)
      expect(data.heat.max).toBe(50)
      expect(data.heat.cells.flat().reduce((a, b) => a + b, 0)).toBe(68)
      // 2 of 4 is not more than half: no "good" alert for school A.
      expect(data.alerts.filter((a) => a.list === 3)).toEqual([])
      expect(data.moodCount).toBe(0)
    })

    it('school B is a "good" alert (1 of 1 active)', async () => {
      const data = envelopeOf(KirkpatrickBehaviorSchema).parse((await admin.get(`/kirkpatrick/behavior?schoolId=${w.schoolB}`)).body).data
      expect(data.alerts).toContainEqual(expect.objectContaining({ list: 3, schoolId: w.schoolB, kind: 'good', pct: 100 }))
    })

    it('teacher and school_admin only see the own school', async () => {
      for (const who of [teacherA, adminA]) {
        const data = envelopeOf(KirkpatrickBehaviorSchema).parse((await who.get(`/kirkpatrick/behavior?schoolId=${w.schoolB}`)).body).data
        expect(data.schools.map((s) => s.schoolId)).toEqual([w.schoolA])
      }
    })
  })

  describe('results (S5)', () => {
    it('predictions by accuracy, the school table, zero-state GPS and an empty ALESA block', async () => {
      const data = envelopeOf(KirkpatrickResultsSchema).parse((await admin.get(`/kirkpatrick/results?schoolId=${w.schoolA}`)).body).data
      expect(data.kpi).toMatchObject({ gps: null, gpsYear: null, recordsLabel: 0, accuracy: 75, answers: 68, active: 2, activePct: 50, t4t5: 4, records: 0 })
      expect(data.distribution).toBeNull()
      expect(data.subjectGps).toEqual({ year: 0, rows: [] })
      expect(data.trend).toEqual({ years: [], rows: [] })
      expect(data.alesa).toEqual({ lulus: 0, gagal: 0, intervensi: 0, rows: [] })
      expect(data.predictions.map((p) => [p.userId, p.answers, p.accuracy, p.grade])).toEqual([
        [w.ids.maju, 50, 80, 'A'],
        [w.ids.p1, 18, 61.1, 'B'],
      ])
      expect(data.schools).toEqual([
        { schoolId: w.schoolA, name: 'SMK Demo Satu', students: 4, active: 2, accuracy: 75, answers: 68, engagement: 50, tahap: 'berkembang', faded: false },
      ])
      expect(data.roi).toEqual({ active: 2, perStudent: 34, accuracy: 75, gps: null })
      expect(data.insights).toMatchObject({ active: 2, t4t5: 4, pct: 50, accuracy: 75, grade: 'A-', year: null, gps: null })
    })

    it('a school with a T4/T5 pupil but no practice is a faded row with "-" figures, sorted last', async () => {
      await t.db.query(`update users set grade = 10 where email = 'murid.demo003.01@example.test'`)
      try {
        const data = envelopeOf(KirkpatrickResultsSchema).parse((await admin.get('/kirkpatrick/results')).body).data
        expect(data.schools).toHaveLength(3)
        const faded = data.schools.find((s) => s.faded)
        expect(faded).toMatchObject({ students: 1, active: 0, accuracy: null, answers: null, engagement: null, tahap: 'tidakTerlibat' })
        expect(data.schools[2]?.faded).toBe(true)
        expect(data.schools[0]).toMatchObject({ schoolId: w.schoolB, engagement: 100, tahap: 'champion' })
      } finally {
        await t.db.query(`update users set grade = (select grade from users where email = 'murid.demo003.02@example.test') where email = 'murid.demo003.01@example.test'`)
      }
    })

    it('teacher is forced to the own school', async () => {
      const data = envelopeOf(KirkpatrickResultsSchema).parse((await teacherC.get(`/kirkpatrick/results?schoolId=${w.schoolA}`)).body).data
      expect(data.kpi.answers).toBe(5)
      expect(data.predictions.map((p) => p.userId)).toEqual([w.ids.pb])
    })

    it('a teacher lists by name only the pupils of the own classes', async () => {
      const as = async (who: Client) =>
        envelopeOf(KirkpatrickResultsSchema).parse((await who.get('/kirkpatrick/results')).body).data.predictions.map((p) => p.userId)
      expect(await as(teacherA)).toEqual([w.ids.p1])
      expect(await as(teacherB)).toEqual([w.ids.maju])
      expect(await as(adminA)).toEqual([w.ids.maju, w.ids.p1])
    })
  })

  describe('filter options', () => {
    it('admin lists the schools with users A to Z with their states', async () => {
      const data = envelopeOf(KirkpatrickFilterOptionsSchema).parse((await admin.get('/kirkpatrick/filter-options')).body).data
      const names = data.schools.map((s) => s.name)
      expect(names).toContain('SMK Demo Satu')
      expect(names).toContain('SK Demo Dua')
      expect([...names].sort((a, b) => a.localeCompare(b, 'ms'))).toEqual(names)
      expect(data.states).toContain('Selangor')
    })

    it('a teacher gets only the own session school, whatever the query says (TRIAGE-1, SEC-M12-01/02)', async () => {
      for (const path of ['/kirkpatrick/filter-options', `/kirkpatrick/filter-options?schoolId=${w.schoolB}&state=Johor`]) {
        const data = envelopeOf(KirkpatrickFilterOptionsSchema).parse((await teacherA.get(path)).body).data
        expect(data.schools).toEqual([{ id: w.schoolA, name: 'SMK Demo Satu' }])
        expect(data.states).toEqual(['Selangor'])
      }
      const other = envelopeOf(KirkpatrickFilterOptionsSchema).parse((await teacherC.get(`/kirkpatrick/filter-options?schoolId=${w.schoolA}`)).body).data
      expect(other.schools.map((s) => s.id)).toEqual([w.schoolB])
      expect(other.schools.map((s) => s.name)).not.toContain('SMK Demo Satu')
    })

    it('school_admin gets only the own school', async () => {
      const data = envelopeOf(KirkpatrickFilterOptionsSchema).parse((await adminA.get('/kirkpatrick/filter-options')).body).data
      expect(data.schools).toEqual([{ id: w.schoolA, name: 'SMK Demo Satu' }])
      expect(data.states).toEqual(['Selangor'])
    })
  })

  it('rows written under Mod Pelajar (is_test) and unfinished sessions never count', async () => {
    const before = envelopeOf(KirkpatrickOverviewSchema).parse((await admin.get('/kirkpatrick/overview')).body).data.kpi.answers
    expect(before).toBe(73)
    // The fixture holds a 20-answer test session and a 4-answer in-progress session of the same pupil.
    const raw = await t.db.query<{ n: number }>(`select count(*)::int as n from practice_answers where user_id = $1`, [w.ids.p1])
    expect(raw[0]?.n).toBe(18 + 20 + 4)
  })
})
