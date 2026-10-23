import { AnalyticsItemAnalysisSchema, AnalyticsTeacherReportSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  SCHOOL_ADMIN_A,
  STUDENT_1,
  TEACHER_A,
  TEACHER_C,
  type AnalyticsTestApp,
  type Client,
  type World,
  addClass,
  addModeSession,
  addQuestion,
  addQuestionSession,
  bootAnalyticsApp,
  buildWorld,
  client,
  errorIs,
} from './helpers'

const report = (res: { body: unknown }) => envelopeOf(AnalyticsTeacherReportSchema).parse(res.body).data
const items = (res: { body: unknown }) => envelopeOf(AnalyticsItemAnalysisSchema).parse(res.body).data

describe('M11 teacher report S1 and item analysis S6 (AC 1 to 3)', () => {
  let t: AnalyticsTestApp
  let w: World
  let admin: Client
  let teacherA: Client
  let teacherC: Client
  let adminA: Client
  let student: Client
  let classMain: string
  let classOther: string
  let classItems: string
  let classInactive: string
  let classOfC: string

  beforeAll(async () => {
    t = await bootAnalyticsApp()
    w = await buildWorld(t)
    const { p1, p2, maju, susp, pb, teacherC: cId } = w.ids
    // buildWorld gives teacher A the class "Kelas Kirkpatrick" with p1 and p2 (both T4). Practice of the fixture:
    // p1 random 2026-09-10 (8/6) and 2026-10-05 (10/5), a test session and an in-progress session (never counted).
    const q = t.db.query.bind(t.db)
    classMain = ((await q<{ id: string }>(`select id::text from classrooms where name = 'Kelas Kirkpatrick'`))[0] as { id: string }).id
    await addModeSession(t.db, { userId: p2, subjectId: w.subjects[0], at: '2026-10-17T10:00:00+08:00', mode: 'latih_tubi', questions: 6, correct: 3 })
    await addModeSession(t.db, { userId: p1, subjectId: w.subjects[0], at: '2026-10-19T08:00:00+08:00', mode: 'ramalan', questions: 4, correct: 4 })
    // Extra enrolments that must not count: a Mod Pelajar row and a removed one.
    await q(`insert into enrolments (classroom_id, student_id, is_test) values ($1, $2, true)`, [classMain, maju])
    await q(`insert into enrolments (classroom_id, student_id, status) values ($1, $2, 'removed')`, [classMain, pb])
    classOther = await addClass(t.db, { name: 'Kelas Satu Murid', teacherId: w.ids.teacherA, schoolId: w.schoolA, members: [p1] })
    classInactive = await addClass(t.db, { name: 'Kelas Tidak Aktif', teacherId: w.ids.teacherA, schoolId: w.schoolA, members: [maju] })
    await q(`update classrooms set is_active = false where id = $1`, [classInactive])
    classOfC = await addClass(t.db, { name: 'Kelas Guru Lain', teacherId: cId, schoolId: w.schoolB, members: [pb] })
    classItems = await addClass(t.db, { name: 'Kelas Item', teacherId: w.ids.teacherA, schoolId: w.schoolA, subjectId: w.subjects[0], members: [p1, p2, maju, susp] })

    // Item analysis data: four pupils answer q1 and q2 in subject 0, the first also q3 in subject 1.
    const q1 = await addQuestion(t.db, { stem: '<p>Soalan <b>satu</b>?</p>', subjectId: w.subjects[0], correct: 'A' })
    const q2 = await addQuestion(t.db, { stem: 'Soalan dua', subjectId: w.subjects[0], correct: 'A' })
    const q3 = await addQuestion(t.db, { stem: 'Soalan tiga', subjectId: w.subjects[1], correct: 'A' })
    const at = '2026-05-01T09:00:00+08:00' // before every report window (90 days from 2026-10-19 starts 2026-07-22)
    const a = (questionId: string, correct: boolean) => ({ questionId, label: 'A' as const, correct })
    await addQuestionSession(t.db, { userId: p1, subjectId: w.subjects[0], at, answers: [a(q1, true), a(q2, true)] })
    await addQuestionSession(t.db, { userId: p2, subjectId: w.subjects[0], at, answers: [a(q1, true), a(q2, false)] })
    await addQuestionSession(t.db, { userId: maju, subjectId: w.subjects[0], at, answers: [a(q1, true), a(q2, false)] })
    await addQuestionSession(t.db, { userId: susp, subjectId: w.subjects[0], at, answers: [a(q1, false), a(q2, false)] })
    await addQuestionSession(t.db, { userId: p1, subjectId: w.subjects[1], at, answers: [a(q3, true)] })
    await addQuestionSession(t.db, { userId: p2, subjectId: w.subjects[0], at, isTest: true, answers: [a(q1, false)] })

    admin = await client(t, ADMIN)
    teacherA = await client(t, TEACHER_A)
    teacherC = await client(t, TEACHER_C)
    adminA = await client(t, SCHOOL_ADMIN_A)
    student = await client(t, STUDENT_1)
  }, 240_000)
  afterAll(async () => {
    await t.close()
  })

  /** The options are exactly the active real classes the teacher owns in the database (a seed may add more), and include `known`. */
  async function expectOnlyClassesOf(teacherId: string, optionIds: string[], known: string): Promise<void> {
    const owned = await t.db.query<{ id: string }>(`select id::text from classrooms where teacher_id = $1 and kind = 'classroom' and is_active`, [teacherId])
    expect([...optionIds].sort()).toEqual(owned.map((r) => r.id).sort())
    expect(optionIds).toContain(known)
    for (const other of [classMain, classOther, classItems, classInactive]) expect(optionIds).not.toContain(other)
  }

  describe('guards', () => {
    it('school_admin and student are 403, no session is 401, on both routes', async () => {
      for (const path of ['/teacher/report', '/teacher/item-analysis']) {
        errorIs(await t.http().get(`/api${path}`), 401, 'UNAUTHORIZED')
        errorIs(await student.get(path), 403, 'FORBIDDEN', 'This action is unauthorized.')
        errorIs(await adminA.get(path), 403, 'FORBIDDEN', 'This action is unauthorized.')
      }
    })

    it('admin and teacher are 200 with no-store', async () => {
      for (const who of [admin, teacherA, teacherC]) {
        for (const path of ['/teacher/report', '/teacher/item-analysis']) {
          const res = await who.get(path)
          expect(res.status).toBe(200)
          expect(res.headers['cache-control']).toContain('no-store')
        }
      }
    })
  })

  describe('report S1', () => {
    it('population of the own active classes: all-classes view counts every distinct real member once', async () => {
      const body = report(await teacherA.get('/teacher/report'))
      // p1, p2 (Kirkpatrick + others), maju and susp (Kelas Item); the Mod Pelajar and removed enrolments and the inactive class add nobody new... maju is in Kelas Item.
      expect(body.population.total).toBe(4)
      expect(body.options.classes.map((c) => c.id).sort()).toEqual([classMain, classOther, classItems].sort())
      expect(body.options.classes.map((c) => c.id)).not.toContain(classInactive)
      expect(body.options.classes.map((c) => c.id)).not.toContain(classOfC)
      expect(body.classroomId).toBeNull()
      expect(body.range).toBe(30)
    })

    it('a selected own class narrows the population; activities, scores, trend and lists follow the sessions (test and in-progress left out)', async () => {
      const body = report(await teacherA.get(`/teacher/report?classroomId=${classMain}`))
      expect(body.classroomId).toBe(classMain)
      // Members p1 and p2 only: the Mod Pelajar enrolment of maju and the removed enrolment of pb do not count.
      expect(body.population).toEqual({ total: 2, loggedIn: 1, practised: 2 })
      // Window 2026-09-20 .. now: p1 random 10-05 (10 q, 5 right), p2 latih_tubi 10-17 (6, 3), p1 ramalan 10-19 (4, 4).
      expect(body.activity.byType).toEqual({ kuiz: 1, struktur: 0, latihTubi: 1, trackingA: 1, battle: 0, permainan: 0 })
      expect(body.activity.total).toBe(3)
      expect(body.score).toEqual({ overall: 60, byType: { kuiz: 50, struktur: null, latihTubi: 50, trackingA: 100, battle: null } })
      expect(body.trend).toHaveLength(30)
      expect(body.trend[0]?.date).toBe('20/09')
      expect(body.trend[29]).toEqual({ date: '19/10', count: 1 })
      expect(body.trend.find((x) => x.date === '05/10')?.count).toBe(1)
      expect(body.trend.find((x) => x.date === '17/10')?.count).toBe(1)
      expect(body.trend.find((x) => x.date === '18/10')?.count).toBe(0)
      expect(body.trend.reduce((n, x) => n + x.count, 0)).toBe(3)
      expect(body.notLoggedIn.map((s) => s.id)).toEqual([w.ids.p2])
      expect(body.notLoggedIn[0]).toMatchObject({ neverLoggedIn: true, avatarUrl: null })
      expect(body.notPractised).toEqual([])
      expect(body.notPractisedAll).toEqual([])
      expect(body.mostActive.map((s) => [s.id, s.activities])).toEqual([
        [w.ids.p1, 2],
        [w.ids.p2, 1],
      ])
    })

    it('SW7-06: a deactivated pupil leaves the selected class population and returns when reactivated', async () => {
      const q = t.db.query.bind(t.db)
      await q(`update users set is_active = false where id = $1`, [w.ids.p2])
      try {
        const body = report(await teacherA.get(`/teacher/report?classroomId=${classMain}`))
        expect(body.population.total).toBe(1)
        expect(body.notLoggedIn).toEqual([])
      } finally {
        await q(`update users set is_active = true where id = $1`, [w.ids.p2])
      }
      expect(report(await teacherA.get(`/teacher/report?classroomId=${classMain}`)).population.total).toBe(2)
    })

    it('ranges: 7 days keeps the last two activities, 90 days adds the 2026-09-10 session; the score is Σ correct ÷ Σ questions', async () => {
      const d7 = report(await teacherA.get(`/teacher/report?classroomId=${classMain}&range=7`))
      expect(d7.range).toBe(7)
      expect(d7.trend).toHaveLength(7)
      expect(d7.activity.total).toBe(2)
      const d90 = report(await teacherA.get(`/teacher/report?classroomId=${classMain}&range=90`))
      expect(d90.range).toBe(90)
      expect(d90.trend).toHaveLength(90)
      expect(d90.activity.byType.kuiz).toBe(2)
      expect(d90.score.byType.kuiz).toBe(61) // 11 / 18
      expect(d90.score.overall).toBe(64) // 18 / 28
    })

    it('an invalid range is 30; a classroomId that is not an own class is ignored (all classes), never an error', async () => {
      for (const q of ['range=abc', 'range=999', 'range=7.5', 'range=', 'range=-7', 'range[a]=1']) {
        const res = await teacherA.get(`/teacher/report?${q}`)
        expect(res.status, q).toBe(200)
        expect(report(res).range, q).toBe(30)
      }
      for (const id of [classOfC, classInactive, '987654321', 'abc', '0', '']) {
        const body = report(await teacherA.get(`/teacher/report?classroomId=${id}`))
        expect(body.classroomId, id).toBeNull()
        expect(body.population.total, id).toBe(4)
      }
    })

    it('lists: pupils without a login or a session are named, A to Z, with the first ten in notPractised', async () => {
      const body = report(await teacherA.get('/teacher/report'))
      // maju, susp: no login. susp: no session at all besides the item-analysis ones (susp has one completed session) -> all practised.
      expect(body.notLoggedIn.map((s) => s.id).sort()).toEqual([w.ids.p2, w.ids.maju, w.ids.susp].sort())
      const names = body.notLoggedIn.map((s) => s.name)
      expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y, 'ms', { sensitivity: 'base' })))
      expect(body.population.practised).toBe(4)
    })

    it('a pupil without any session is in notPractised (capped at 10) and notPractisedAll', async () => {
      const lone = await addClass(t.db, { name: 'Kelas Tanpa Latihan', teacherId: w.ids.teacherA, schoolId: w.schoolA, members: [] })
      const rows = await t.db.query<{ id: string }>(
        `select u.id::text from users u where u.school_id = $1 and u.email like 'murid.demo001.%' and not exists (select 1 from practice_sessions s where s.user_id = u.id) order by u.id limit 12`,
        [w.schoolA],
      )
      expect(rows.length).toBeGreaterThan(0)
      for (const r of rows) await t.db.query(`insert into enrolments (classroom_id, student_id) values ($1, $2)`, [lone, r.id])
      const body = report(await teacherA.get(`/teacher/report?classroomId=${lone}`))
      expect(body.population.total).toBe(rows.length)
      expect(body.population.practised).toBe(0)
      expect(body.notPractisedAll).toHaveLength(rows.length)
      expect(body.notPractised).toHaveLength(Math.min(10, rows.length))
      expect(body.activity.total).toBe(0)
      expect(body.score.overall).toBeNull()
      expect(body.mostActive).toEqual([])
    })

    it('another teacher sees only the own classes; the admin has an empty population and the class filter is ignored', async () => {
      const c = report(await teacherC.get(`/teacher/report?classroomId=${classMain}`))
      expect(c.classroomId).toBeNull()
      expect(c.population.total).toBe(1)
      await expectOnlyClassesOf(w.ids.teacherC, c.options.classes.map((x) => x.id), classOfC)
      expect(c.activity.total).toBe(1) // only pupil B's 2026-10-12 session
      const a = report(await admin.get(`/teacher/report?classroomId=${classMain}&range=7`))
      expect(a.classroomId).toBeNull()
      expect(a.population).toEqual({ total: 0, loggedIn: 0, practised: 0 })
      expect(a.options.classes).toEqual([])
      expect(a.trend).toHaveLength(7)
      expect(a.trend.every((x) => x.count === 0)).toBe(true)
      expect(a.score.overall).toBeNull()
      expect(a.notLoggedIn).toEqual([])
    })
  })

  describe('item analysis S6', () => {
    it('a selected class uses its own subject: p, band, discrimination and the order (% right ascending)', async () => {
      const body = items(await teacherA.get(`/teacher/item-analysis?classroomId=${classItems}`))
      expect(body.rows).toHaveLength(2)
      const [hard, easy] = body.rows
      // q2: 1 of 4 right (25 percent, sukar); q1: 3 of 4 (75, mudah); the test answer of p2 is left out.
      expect(hard).toMatchObject({ textPlain: 'Soalan dua', attempts: 4, pct: 25, band: 'sukar', discrimination: 1 })
      expect(easy).toMatchObject({ textPlain: 'Soalan satu ?', attempts: 4, pct: 75, band: 'mudah', discrimination: 1 })
      expect(hard?.subjectName).not.toBe('')
      expect(body.options.classes.map((c) => c.id)).toContain(classItems)
      expect(body.options.subjects.length).toBeGreaterThan(1)
      const names = body.options.subjects.map((s) => s.name)
      expect(names).toEqual([...names].sort((x, y) => x.localeCompare(y, 'ms', { sensitivity: 'base' })))
    })

    it('an explicit subject wins over the class subject; all classes and all subjects keep every answer of the own pupils', async () => {
      const other = items(await teacherA.get(`/teacher/item-analysis?classroomId=${classItems}&subjectId=${w.subjects[1]}`))
      expect(other.rows.map((r) => [r.textPlain, r.attempts, r.pct])).toEqual([['Soalan tiga', 1, 100]])
      expect(other.rows[0]?.discrimination).toBeNull() // fewer than 4 pupils with a session in that subject
      const all = items(await teacherA.get('/teacher/item-analysis'))
      expect(all.rows.map((r) => r.textPlain)).toEqual(['Soalan dua', 'Soalan satu ?', 'Soalan tiga'])
    })

    it('a class that is not an own class, an unknown or non-numeric subject, another teacher and the admin give no rows (200)', async () => {
      for (const q of [`classroomId=${classOfC}`, 'classroomId=987654321', 'classroomId=abc', `classroomId=${classInactive}`, 'subjectId=987654321', 'subjectId=abc', `subjectId=${w.subjects[1]}&classroomId=${classOfC}`]) {
        const res = await teacherA.get(`/teacher/item-analysis?${q}`)
        expect(res.status, q).toBe(200)
        expect(items(res).rows, q).toEqual([])
      }
      const c = items(await teacherC.get(`/teacher/item-analysis?classroomId=${classItems}`))
      expect(c.rows).toEqual([])
      await expectOnlyClassesOf(w.ids.teacherC, c.options.classes.map((x) => x.id), classOfC)
      const a = items(await admin.get(`/teacher/item-analysis?classroomId=${classItems}`))
      expect(a.rows).toEqual([])
      expect(a.options.classes).toEqual([])
      expect(a.options.subjects.length).toBeGreaterThan(1)
    })
  })
})
