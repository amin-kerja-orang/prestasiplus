import {
  AnalyticsItemAnalysisSchema,
  AnalyticsMonitoringExportSchema,
  AnalyticsMonitoringOverviewSchema,
  AnalyticsSchoolDetailSchema,
  AnalyticsStudentDetailSchema,
  AnalyticsTeacherDetailSchema,
  AnalyticsTeacherReportSchema,
  envelopeOf,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  SCHOOL_ADMIN_A,
  SCHOOL_ADMIN_B,
  STUDENT_1,
  STUDENT_B,
  TEACHER_A,
  TEACHER_C,
  type AnalyticsTestApp,
  type Client,
  type World,
  addClass,
  addFlag,
  addQuestion,
  addQuestionSession,
  bootAnalyticsApp,
  buildWorld,
  client,
  errorIs,
  fieldsOf,
  idOfEmail,
} from './helpers'

const MONITORING = [
  '/monitoring/overview',
  '/monitoring/export?format=csv',
  '/monitoring/schools/1',
  '/monitoring/schools/1/students/1',
  '/monitoring/schools/1/teachers/1',
] as const
const TEACHER_ROUTES = ['/teacher/report', '/teacher/item-analysis'] as const

type Row = Record<string, unknown>
const rowOf = (rows: unknown, schoolId: string): Row | undefined => (rows as Row[]).find((r) => r.schoolId === schoolId)

describe('M11 monitoring S2 to S5 and export (AC 1 to 3, 5)', () => {
  let t: AnalyticsTestApp
  let w: World
  let admin: Client
  let teacherA: Client
  let teacherC: Client
  let adminA: Client
  let adminB: Client
  let student: Client
  let ids: { teacherA: string; teacherB: string; adminA: string; p1: string; p2: string; maju: string; susp: string; pb: string }
  const sub = (i: 0 | 1): string => w.subjects[i]

  beforeAll(async () => {
    t = await bootAnalyticsApp()
    w = await buildWorld(t)
    // buildWorld: p1 8/6 (2026-09-10, subject 0) + 10/5 (2026-10-05, subject 1) + a test and an in-progress session;
    // maju 50/40 (2026-10-10); pupil B 5/5 (2026-10-12). Flags: p1 review, maju excluded. States for the state filter.
    await t.db.query(`update schools set state = 'Negeri Ujian Satu' where id = $1`, [w.schoolA])
    await t.db.query(`update schools set state = 'Negeri Ujian Dua' where id = $1`, [w.schoolB])
    await addFlag(t.db, w.ids.p1, 'review')
    await addFlag(t.db, w.ids.maju, 'excluded')
    await addFlag(t.db, w.ids.pb, 'review') // school B, never counted for school A
    ids = { ...w.ids, teacherB: w.ids.teacherC, adminA: await idOfEmail(t, SCHOOL_ADMIN_A) }
    admin = await client(t, ADMIN)
    teacherA = await client(t, TEACHER_A)
    teacherC = await client(t, TEACHER_C)
    adminA = await client(t, SCHOOL_ADMIN_A)
    adminB = await client(t, SCHOOL_ADMIN_B)
    student = await client(t, STUDENT_1)
  }, 240_000)
  afterAll(async () => {
    await t.close()
  })

  describe('guards', () => {
    it('no session is 401 on all seven routes', async () => {
      for (const path of [...MONITORING, ...TEACHER_ROUTES]) {
        errorIs(await t.http().get(`/api${path}`), 401, 'UNAUTHORIZED', 'Unauthenticated.')
      }
    })

    it('a student is 403 on all seven routes', async () => {
      for (const path of [...MONITORING, ...TEACHER_ROUTES]) {
        errorIs(await student.get(path), 403, 'FORBIDDEN', 'This action is unauthorized.')
      }
    })

    it('admin, teacher and school_admin are 200 on overview and export, with no-store on personal bodies', async () => {
      for (const who of [admin, teacherA, adminA]) {
        expect((await who.get('/monitoring/overview')).status).toBe(200)
        expect((await who.get('/monitoring/export?format=pdf')).status).toBe(200)
        const detail = await who.get(`/monitoring/schools/${w.schoolA}`)
        expect(detail.status === 200 || who === adminB).toBe(true)
        expect(detail.headers['cache-control']).toContain('no-store')
      }
    })
  })

  describe('overview (S2)', () => {
    it('student table: registered, engaged, percent and tahap per school are computed from the tables', async () => {
      const res = await admin.get('/monitoring/overview')
      const body = envelopeOf(AnalyticsMonitoringOverviewSchema).parse(res.body).data
      const a = rowOf(body.studentRows, w.schoolA)
      const b = rowOf(body.studentRows, w.schoolB)
      // School A: 4 T4/T5 pupils (p1, p2, maju, susp); p1 and maju answered (test and in-progress sessions do not count).
      expect(a).toMatchObject({ registered: 4, engaged: 2, pct: 50, tahap: 'Sederhana' })
      expect(b).toMatchObject({ registered: 1, engaged: 1, pct: 100, tahap: 'Cemerlang' })
      const order = body.studentRows.map((r) => r.pct)
      expect(order).toEqual([...order].sort((x, y) => y - x))
      expect(body.kpi.students).toBe(body.studentRows.reduce((n, r) => n + r.registered, 0))
      expect(body.kpi.engaged).toBe(body.studentRows.reduce((n, r) => n + r.engaged, 0))
      expect(body.filters).toEqual({ period: '', state: '', tahap: '' })
    })

    it('answers: 68 in school A (8 + 10 of the first pupil + 50), 5 in B; the test session and the in-progress one are left out', async () => {
      const body = AnalyticsMonitoringOverviewSchema.parse((await admin.get('/monitoring/overview')).body.data)
      const a = (await adminA.get('/monitoring/overview')).body.data
      expect(AnalyticsMonitoringOverviewSchema.parse(a).kpi).toMatchObject({ students: 4, engaged: 2, answers: 68, avgPerStudent: 34 })
      expect(body.kpi.answers).toBeGreaterThanOrEqual(73)
    })

    it('teacher table: teachers and logged-in teachers per school come from users.last_login_at', async () => {
      const body = AnalyticsMonitoringOverviewSchema.parse((await admin.get('/monitoring/overview')).body.data)
      const expected = await t.db.query<{ school_id: string; n: number; logged: number }>(
        `select u.school_id::text, count(*)::int n, count(*) filter (where u.last_login_at is not null)::int logged
         from users u where u.is_active and u.school_id is not null and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'teacher') group by 1`,
      )
      for (const e of expected) {
        expect(rowOf(body.teacherRows, e.school_id), e.school_id).toMatchObject({ registered: e.n, loggedIn: e.logged })
      }
      expect(body.kpi.teachers).toBe(body.teacherRows.reduce((n, r) => n + r.registered, 0))
    })

    it('period windows: 30d drops the 2026-09-10 session (clock 2026-10-19), 7d keeps only the 2026-10-12 one', async () => {
      const d30 = AnalyticsMonitoringOverviewSchema.parse((await adminA.get('/monitoring/overview?period=30d')).body.data)
      expect(d30.filters.period).toBe('30d')
      expect(d30.kpi).toMatchObject({ engaged: 2, answers: 60 })
      const d7 = AnalyticsMonitoringOverviewSchema.parse((await admin.get('/monitoring/overview?period=7d')).body.data)
      expect(rowOf(d7.studentRows, w.schoolA)).toMatchObject({ engaged: 0, pct: 0, tahap: 'Tiada Langsung' })
      expect(rowOf(d7.studentRows, w.schoolB)).toMatchObject({ engaged: 1 })
      const m3 = AnalyticsMonitoringOverviewSchema.parse((await adminA.get('/monitoring/overview?period=3m')).body.data)
      expect(m3.kpi.answers).toBe(68)
    })

    it('an unknown period is all time and is echoed as an empty string; invalid filters are never rejected', async () => {
      for (const q of ['period=1y', 'period=%00', 'period[a]=1', 'period=7d&period=30d', `state=${'x'.repeat(500)}`, 'tahap=%E0%A4%A']) {
        const res = await admin.get(`/monitoring/overview?${q}`)
        expect(res.status, q).toBe(200)
        AnalyticsMonitoringOverviewSchema.parse(res.body.data)
      }
      const odd = AnalyticsMonitoringOverviewSchema.parse((await adminA.get('/monitoring/overview?period=1y')).body.data)
      expect(odd.filters.period).toBe('')
      expect(odd.kpi.answers).toBe(68)
    })

    it('the state filter narrows both tables and the school count; an unknown state gives empty tables', async () => {
      const johor = AnalyticsMonitoringOverviewSchema.parse((await admin.get('/monitoring/overview?state=Negeri%20Ujian%20Satu')).body.data)
      expect(johor.studentRows.map((r) => r.schoolId)).toEqual([w.schoolA])
      expect(johor.kpi.schools).toBe(1)
      expect(johor.teacherRows.every((r) => r.schoolId === w.schoolA)).toBe(true)
      const none = AnalyticsMonitoringOverviewSchema.parse((await admin.get('/monitoring/overview?state=Atlantis')).body.data)
      expect(none.studentRows).toEqual([])
      expect(none.kpi).toMatchObject({ schools: 0, students: 0, engaged: 0 })
      expect(none.weekly).toEqual([])
    })

    it('the tahap filter narrows the student table only, not the KPIs, the weekly table or the signals (BR-M11-14)', async () => {
      const all = AnalyticsMonitoringOverviewSchema.parse((await admin.get('/monitoring/overview')).body.data)
      const best = AnalyticsMonitoringOverviewSchema.parse((await admin.get('/monitoring/overview?tahap=Cemerlang')).body.data)
      expect(best.studentRows.every((r) => r.tahap === 'Cemerlang')).toBe(true)
      expect(best.studentRows.map((r) => r.schoolId)).toContain(w.schoolB)
      expect(best.studentRows.map((r) => r.schoolId)).not.toContain(w.schoolA)
      expect(best.kpi).toEqual(all.kpi)
      expect(best.weekly).toEqual(all.weekly)
      expect(best.signals).toEqual(all.signals)
      const unknown = AnalyticsMonitoringOverviewSchema.parse((await admin.get('/monitoring/overview?tahap=Hebat')).body.data)
      expect(unknown.studentRows).toEqual([])
      expect(unknown.kpi).toEqual(all.kpi)
    })

    it('signals: Cemerlang schools are "best" (at most 3), low bands are attention and suggestions', async () => {
      const body = AnalyticsMonitoringOverviewSchema.parse((await admin.get('/monitoring/overview?period=7d')).body.data)
      expect(body.signals.best.map((s) => s.schoolId)).toContain(w.schoolB)
      expect(body.signals.best.length).toBeLessThanOrEqual(3)
      const a = body.signals.attention.find((s) => s.schoolId === w.schoolA)
      expect(a).toMatchObject({ kind: 'tiada', engaged: 0 })
      const s = body.signals.suggestions.find((x) => x.schoolId === w.schoolA)
      // Tiada Langsung with a teacher who logged in: hands-on; without: contact.
      expect(s?.kind).toBe(a && a.teachersLoggedIn > 0 ? 'handsOn' : 'hubungi')
    })

    it('weekly tracking: Monday weeks from 16/02, school A has 8 answers in M30 (10/09) and 60 in M34 (best)', async () => {
      const body = AnalyticsMonitoringOverviewSchema.parse((await admin.get('/monitoring/overview')).body.data)
      expect(body.weeks[0]).toEqual({ k: 1, from: '16/02', to: '22/02' })
      expect(body.weeks).toHaveLength(36)
      expect(body.weeks[35]).toEqual({ k: 36, from: '19/10', to: '19/10' })
      const row = rowOf(body.weekly, w.schoolA) as unknown as (typeof body.weekly)[number]
      const cell = (k: number) => row.cells.find((c) => c.k === k)
      expect(cell(30)?.count).toBe(8)
      expect(cell(34)).toMatchObject({ count: 60, best: true })
      expect(row.best).toEqual({ k: 34, count: 60 })
      expect(row.trend).toBe('same') // M36 = 0 and M35 = 0
      expect(row.cells).toHaveLength(36)
    })

    it('a teacher S2 counts use the S3/S5 minimisation filter: only pupils of the own classes (G5-M11 bug 5)', async () => {
      const body = AnalyticsMonitoringOverviewSchema.parse((await teacherA.get('/monitoring/overview')).body.data)
      const detail = AnalyticsSchoolDetailSchema.parse((await teacherA.get(`/monitoring/schools/${w.schoolA}`)).body.data)
      const teacher = AnalyticsTeacherDetailSchema.parse((await teacherA.get(`/monitoring/schools/${w.schoolA}/teachers/${ids.teacherA}`)).body.data)
      // Own class holds p1 and p2 only; maju and susp are in the school but outside the teacher's classes.
      expect(detail.students.map((r) => r.id).sort()).toEqual([ids.p1, ids.p2].sort())
      expect(teacher.cards.students).toBe(detail.cards.students)
      expect(rowOf(body.studentRows, w.schoolA)).toMatchObject({ registered: detail.cards.students, engaged: 1 })
      expect(body.kpi.students).toBe(detail.cards.students)
      expect(body.kpi.engaged).toBe(detail.cards.engaged)
      expect(body.kpi.answers).toBe(detail.cards.answers)
      const weekly = rowOf(body.weekly, w.schoolA) as unknown as (typeof body.weekly)[number]
      expect(weekly.cells.reduce((n, c) => n + c.count, 0)).toBe(detail.cards.answers)
      // The school admin still sees the whole school.
      expect(AnalyticsMonitoringOverviewSchema.parse((await adminA.get('/monitoring/overview')).body.data).kpi.students).toBe(4)
    })

    it('teacher and school_admin are forced to the own school whatever the query says', async () => {
      for (const who of [teacherA, adminA]) {
        const body = AnalyticsMonitoringOverviewSchema.parse((await who.get(`/monitoring/overview?state=Negeri%20Ujian%20Dua&schoolId=${w.schoolB}`)).body.data)
        // State Kedah narrows to nothing for school A; the other school is never visible.
        expect(body.studentRows).toEqual([])
        const own = AnalyticsMonitoringOverviewSchema.parse((await who.get('/monitoring/overview')).body.data)
        expect(own.studentRows.map((r) => r.schoolId)).toEqual([w.schoolA])
        expect(own.teacherRows.map((r) => r.schoolId)).toEqual([w.schoolA])
        expect(own.kpi.schools).toBe(1)
      }
      const b = AnalyticsMonitoringOverviewSchema.parse((await adminB.get('/monitoring/overview')).body.data)
      expect(b.studentRows.map((r) => r.schoolId)).toEqual([w.schoolB])
      const c = AnalyticsMonitoringOverviewSchema.parse((await teacherC.get('/monitoring/overview')).body.data)
      expect(c.studentRows.map((r) => r.schoolId)).toEqual([w.schoolB])
    })
  })

  describe('export', () => {
    it('csv and pdf return the filename and the student table of the filters (tahap applied)', async () => {
      const csv = envelopeOf(AnalyticsMonitoringExportSchema).parse((await admin.get('/monitoring/export?format=csv')).body).data
      expect(csv.filename).toBe('monitoring-penglibatan.csv')
      const overview = AnalyticsMonitoringOverviewSchema.parse((await admin.get('/monitoring/overview')).body.data)
      expect(csv.rows).toEqual(overview.studentRows)
      const pdf = AnalyticsMonitoringExportSchema.parse((await admin.get('/monitoring/export?format=pdf&tahap=Cemerlang')).body.data)
      expect(pdf.filename).toBe('monitoring-penglibatan.pdf')
      expect(pdf.rows.every((r) => r.tahap === 'Cemerlang')).toBe(true)
      expect(pdf.rows.map((r) => r.schoolId)).toContain(w.schoolB)
    })

    it('a missing, empty or other format is 422 VALIDATION_ERROR with fields.format', async () => {
      for (const q of ['', '?format=', '?format=xlsx', '?format=PDF', '?format=csv&format=pdf&format[]=x', '?format[a]=csv']) {
        const res = await admin.get(`/monitoring/export${q}`)
        if (q === '?format=csv&format=pdf&format[]=x') {
          // A repeated key reads its first value.
          expect(res.status).toBe(200)
          continue
        }
        const fields = fieldsOf(res)
        expect(fields.format, q).toBe('Format eksport mesti pdf atau csv.')
        expect(res.body.error.message).toBe('Format eksport mesti pdf atau csv.')
      }
    })

    it('is forced to the own school for teacher and school_admin; rows are not cell-neutralised (JSON, the client builds the file)', async () => {
      for (const who of [teacherA, adminA]) {
        const rows = AnalyticsMonitoringExportSchema.parse((await who.get(`/monitoring/export?format=csv&state=Negeri%20Ujian%20Dua`)).body.data).rows
        expect(rows).toEqual([])
        const own = AnalyticsMonitoringExportSchema.parse((await who.get('/monitoring/export?format=csv')).body.data).rows
        expect(own.map((r) => r.schoolId)).toEqual([w.schoolA])
      }
      await t.db.query(`update schools set name = '=SUM(A1)' where id = $1`, [w.schoolA])
      const row = AnalyticsMonitoringExportSchema.parse((await adminA.get('/monitoring/export?format=csv')).body.data).rows[0]
      expect(row?.name).toBe('=SUM(A1)')
      await t.db.query(`update schools set name = 'SMK Demo Satu' where id = $1`, [w.schoolA])
    })
  })

  describe('school detail (S3)', () => {
    it('cards, flags, tahap and pupil rows; S3 engagement excludes the excluded account while the status keeps it', async () => {
      const res = await admin.get(`/monitoring/schools/${w.schoolA}`)
      const body = envelopeOf(AnalyticsSchoolDetailSchema).parse(res.body).data
      expect(res.headers['cache-control']).toContain('no-store')
      expect(body.school).toMatchObject({ id: w.schoolA, state: 'Negeri Ujian Satu' })
      expect(body.flags).toEqual({ review: 1, excluded: 1 })
      expect(body.warning).toEqual({ review: 1, excluded: 1 })
      // 4 pupils; p1 and maju answered, maju is excluded: 1 engaged of 4.
      expect(body.cards).toMatchObject({ students: 4, engaged: 1, answers: 68 })
      expect(body.pct).toBe(25)
      expect(body.tahap).toBe('Sederhana')
      const maju = body.students.find((s) => s.id === ids.maju)
      expect(maju).toMatchObject({ answers: 50, status: 'aktif', engaged: false, flag: 'excluded', level: 'T5' })
      const p1 = body.students.find((s) => s.id === ids.p1)
      expect(p1).toMatchObject({ answers: 18, status: 'aktif', engaged: true, flag: 'review', level: 'T4' })
      expect(p1?.lastActivityAt).toBe('2026-10-05T10:00:00.000+08:00')
      expect(body.students.find((s) => s.id === ids.p2)).toMatchObject({ answers: 0, flag: null, engaged: false, lastActivityAt: null })
      expect(body.students.map((s) => s.level)).toEqual([...body.students.map((s) => s.level)].sort())
      // The flag of a pupil of school B never counts here.
      const b = envelopeOf(AnalyticsSchoolDetailSchema).parse((await admin.get(`/monitoring/schools/${w.schoolB}`)).body).data
      expect(b.flags).toEqual({ review: 1, excluded: 0 })
      expect(b.cards).toMatchObject({ students: 1, engaged: 1, answers: 5 })
    })

    it('the latest subscription of the school is shown (active, cancelled, expired) and grace is not', async () => {
      const pkg = (await t.db.query<{ id: string }>(`insert into school_packages (code, name, slug, education_level, form_level, price_annual) values ('T4', 'Pakej T4', 'pakej-t4', 'spm', 't4', 10) returning id::text`))[0] as { id: string }
      const add = (status: string, ends: string) =>
        t.db.query(
          `insert into school_subscriptions (school_id, school_package_id, package_tier, student_quota, status, starts_on, ends_on) values ($1, $2, 'full', 10, $3, '2025-01-01', $4)`,
          [w.schoolB, pkg.id, status, ends],
        )
      expect(AnalyticsSchoolDetailSchema.parse((await admin.get(`/monitoring/schools/${w.schoolB}`)).body.data).subscription).toBeNull()
      await add('expired', '2026-05-22')
      await add('active', '2027-01-31')
      expect(AnalyticsSchoolDetailSchema.parse((await admin.get(`/monitoring/schools/${w.schoolB}`)).body.data).subscription).toEqual({
        status: 'active',
        endsAt: '2027-01-31T23:59:59+08:00',
      })
      await add('grace', '2027-06-30')
      expect(AnalyticsSchoolDetailSchema.parse((await admin.get(`/monitoring/schools/${w.schoolB}`)).body.data).subscription).toBeNull()
    })

    it('a teacher and a school_admin open the own school; every other school, unknown and non-numeric id is 404', async () => {
      for (const who of [teacherA, adminA]) {
        expect((await who.get(`/monitoring/schools/${w.schoolA}`)).status).toBe(200)
        for (const id of [w.schoolB, '987654321', '0', 'abc', '00012', '99999999999999999999']) {
          errorIs(await who.get(`/monitoring/schools/${id}`), 404, 'NOT_FOUND', 'Not Found.')
        }
      }
      errorIs(await adminB.get(`/monitoring/schools/${w.schoolA}`), 404, 'NOT_FOUND')
      errorIs(await admin.get('/monitoring/schools/987654321'), 404, 'NOT_FOUND')
      errorIs(await admin.get('/monitoring/schools/abc'), 404, 'NOT_FOUND')
      expect((await admin.get(`/monitoring/schools/${w.schoolB}`)).status).toBe(200)
    })
  })

  describe('pupil detail (S4)', () => {
    let chapter: string
    let topic: string
    let qs: string[]

    beforeAll(async () => {
      const level = (await t.db.query<{ id: string }>(`select id::text from education_levels where grade = 10 limit 1`))[0] as { id: string }
      chapter = ((await t.db.query<{ id: string }>(
        `insert into chapters (subject_id, education_level_id, name, chapter_number) values ($1, $2, 'Bab Demo Sejarah', 3) returning id::text`,
        [sub(0), level.id],
      ))[0] as { id: string }).id
      topic = ((await t.db.query<{ id: string }>(`insert into topics (chapter_id, name, topic_number) values ($1, 'Topik Demo', '3.1') returning id::text`, [chapter]))[0] as { id: string }).id
      qs = [
        await addQuestion(t.db, { stem: '<p>Soalan <b>satu</b>?</p>', subjectId: sub(0), chapterId: chapter, topicId: topic, correct: 'B', explanation: 'Sebab B.', examType: 'percubaan', year: 2025, difficulty: 2 }),
        await addQuestion(t.db, { stem: 'Soalan dua', subjectId: sub(0), chapterId: chapter, topicId: null, correct: 'C' }),
        await addQuestion(t.db, { stem: 'Soalan tiga', subjectId: sub(1), correct: 'A' }),
      ]
      // The second pupil of school A answers 3 questions (1 right) in subject 0 and 1 (right) in subject 1; one test answer is ignored.
      await addQuestionSession(t.db, {
        userId: ids.susp,
        subjectId: sub(0),
        at: '2026-10-14T09:00:00+08:00',
        answers: [
          { questionId: qs[0] as string, label: 'B', correct: true, chapterId: chapter, topicId: topic },
          { questionId: qs[1] as string, label: 'A', correct: false, chapterId: chapter },
          { questionId: qs[1] as string, label: 'D', correct: false, chapterId: chapter, at: '2026-10-14T09:05:00+08:00' },
        ],
      })
      await addQuestionSession(t.db, { userId: ids.susp, subjectId: sub(1), at: '2026-10-15T09:00:00+08:00', answers: [{ questionId: qs[2] as string, label: 'A', correct: true }] })
      await addQuestionSession(t.db, { userId: ids.susp, subjectId: sub(0), at: '2026-10-16T09:00:00+08:00', isTest: true, answers: [{ questionId: qs[0] as string, label: 'A', correct: false }] })
    }, 60_000)

    it('cards, subjects, topics, rows, wrong list, gaps and observations of a pupil with answers', async () => {
      const res = await admin.get(`/monitoring/schools/${w.schoolA}/students/${ids.susp}`)
      const body = envelopeOf(AnalyticsStudentDetailSchema).parse(res.body).data
      expect(res.headers['cache-control']).toContain('no-store')
      expect(body.student).toMatchObject({ id: ids.susp, level: 'T4', lastActivityAt: '2026-10-15T09:00:00.000+08:00' })
      expect(body.school.id).toBe(w.schoolA)
      expect(body.cards).toEqual({ answered: 4, correct: 2, wrong: 2, accuracy: 50 })
      expect(body.subjects.map((s) => [s.subjectId, s.correct, s.total, s.pct])).toEqual([
        [sub(0), 1, 3, 33.3],
        [sub(1), 1, 1, 100],
      ])
      const topicRows = body.topics.find((x) => x.subjectId === sub(0))?.rows
      expect(topicRows).toEqual([
        { bab: null, name: 'Umum', correct: 0, total: 2, pct: 0, badge: 'Lemah' },
        { bab: 3, name: 'Topik Demo', correct: 1, total: 1, pct: 100, badge: 'Kuat' },
      ])
      expect(body.answers).toMatchObject({ available: 4, total: 4 })
      expect(body.answers.rows[0]).toMatchObject({ questionId: qs[2], selectedLabel: 'A', correctLabel: 'A', isCorrect: true, chapterLabel: null })
      const first = body.answers.rows.find((r) => r.questionId === qs[0])
      expect(first).toMatchObject({
        html: '<p>Soalan <b>satu</b>?</p>',
        textPlain: 'Soalan satu ?',
        chapterLabel: 'Bab Demo Sejarah',
        source: 'Percubaan 2025',
        difficulty: 2,
        selectedLabel: 'B',
        correctLabel: 'B',
        explanation: 'Sebab B.',
      })
      expect(first?.options).toEqual([
        { label: 'A', text: 'Pilihan A' },
        { label: 'B', text: 'Pilihan B' },
        { label: 'C', text: 'Pilihan C' },
        { label: 'D', text: 'Pilihan D' },
      ])
      // Newest first.
      expect(body.answers.rows.map((r) => r.answeredAt)).toEqual([...body.answers.rows.map((r) => r.answeredAt)].sort().reverse())
      expect(body.wrong).toMatchObject({ count: 2, unique: 1 })
      // The chapter group has 1 of 3 right (33.3 percent): a Lemah gap with the published questions of that chapter.
      expect(body.gaps.items).toEqual([{ group: 'Bab Demo Sejarah', subjectName: expect.any(String), pct: 33.3, correct: 1, total: 3, severity: 'Lemah', availableQuestions: 2 }])
      expect(body.gaps.count).toBe(1)
      expect(body.gaps.strong).toEqual([])
      expect(body.observations).toEqual([
        expect.objectContaining({ kind: 'weak', pct: 33.3, wrong: 2, total: 3 }),
        expect.objectContaining({ kind: 'strong', pct: 100, wrong: 0, total: 1 }),
      ])
    })

    it('the test session of the pupil is not counted anywhere', async () => {
      const body = AnalyticsStudentDetailSchema.parse((await admin.get(`/monitoring/schools/${w.schoolA}/students/${ids.susp}`)).body.data)
      expect(body.cards.answered).toBe(4)
    })

    it('a pupil without answers is the empty state (200), with every subject of the level untried', async () => {
      const res = await admin.get(`/monitoring/schools/${w.schoolA}/students/${ids.p2}`)
      const body = AnalyticsStudentDetailSchema.parse(res.body.data)
      expect(res.status).toBe(200)
      expect(body.cards).toEqual({ answered: 0, correct: 0, wrong: 0, accuracy: 0 })
      expect(body.student.lastActivityAt).toBeNull()
      expect(body.answers).toEqual({ available: 0, total: 0, rows: [] })
      expect(body.gaps.untried.length).toBeGreaterThan(0)
    })

    it('admin: the school segment is not validated against the pupil (BR-M11-29) but an unknown school is 404', async () => {
      const res = await admin.get(`/monitoring/schools/${w.schoolB}/students/${ids.susp}`)
      expect(res.status).toBe(200)
      expect(AnalyticsStudentDetailSchema.parse(res.body.data).school.id).toBe(w.schoolB)
      errorIs(await admin.get(`/monitoring/schools/987654321/students/${ids.susp}`), 404, 'NOT_FOUND')
    })

    it('unknown, non-numeric, non-pupil and not-T4/T5 users are 404 for the admin too', async () => {
      for (const id of ['987654321', '0', 'abc', ids.teacherB, ids.adminA]) {
        errorIs(await admin.get(`/monitoring/schools/${w.schoolA}/students/${id}`), 404, 'NOT_FOUND', 'Not Found.')
      }
      await t.db.query(`update users set grade = 8 where id = $1`, [ids.p2])
      errorIs(await admin.get(`/monitoring/schools/${w.schoolA}/students/${ids.p2}`), 404, 'NOT_FOUND')
      await t.db.query(`update users set grade = 10 where id = $1`, [ids.p2])
    })

    it('teacher and school_admin: own school and own pupil only; other school, other school pupil, unknown ids are 404', async () => {
      for (const who of [teacherA, adminA]) {
        // A teacher opens own-class pupils only (p1); the school admin the whole school.
        expect((await who.get(`/monitoring/schools/${w.schoolA}/students/${who === teacherA ? ids.p1 : ids.susp}`)).status).toBe(200)
        errorIs(await who.get(`/monitoring/schools/${w.schoolB}/students/${ids.pb}`), 404, 'NOT_FOUND')
        errorIs(await who.get(`/monitoring/schools/${w.schoolB}/students/${ids.susp}`), 404, 'NOT_FOUND')
        errorIs(await who.get(`/monitoring/schools/${w.schoolA}/students/${ids.pb}`), 404, 'NOT_FOUND')
        errorIs(await who.get(`/monitoring/schools/${w.schoolA}/students/987654321`), 404, 'NOT_FOUND')
        errorIs(await who.get(`/monitoring/schools/${w.schoolA}/students/x1`), 404, 'NOT_FOUND')
      }
      errorIs(await adminB.get(`/monitoring/schools/${w.schoolA}/students/${ids.susp}`), 404, 'NOT_FOUND')
    })
  })

  describe('pupil detail: question version fallback', () => {
    it('an answer whose served version row is missing falls back to the live version instead of dropping out', async () => {
      const q = await addQuestion(t.db, { stem: 'Soalan versi', subjectId: sub(0), correct: 'A' })
      await addQuestionSession(t.db, { userId: ids.pb, subjectId: sub(0), at: '2026-10-13T09:00:00+08:00', answers: [{ questionId: q, label: 'A', correct: true }] })
      await t.db.query(`update practice_answers set question_version_no = 99 where question_id = $1`, [q])
      const body = AnalyticsStudentDetailSchema.parse((await admin.get(`/monitoring/schools/${w.schoolB}/students/${ids.pb}`)).body.data)
      expect(body.answers.available).toBeGreaterThanOrEqual(1)
      expect(body.answers.rows.some((r) => r.questionId === q && r.textPlain === 'Soalan versi')).toBe(true)
    })
  })

  describe('teacher scope narrowed to own classes (data minimisation)', () => {
    it('school detail lists only the own-class pupils and only the teacher themself; school_admin and admin see the whole school', async () => {
      const own = AnalyticsSchoolDetailSchema.parse((await teacherA.get(`/monitoring/schools/${w.schoolA}`)).body.data)
      expect(own.students.map((x) => x.id).sort()).toEqual([ids.p1, ids.p2].sort())
      expect(own.teachers.map((x) => x.id)).toEqual([ids.teacherA])
      expect(own.cards.students).toBe(2)
      for (const who of [adminA, admin]) {
        const all = AnalyticsSchoolDetailSchema.parse((await who.get(`/monitoring/schools/${w.schoolA}`)).body.data)
        expect(all.students).toHaveLength(4)
      }
    })

    it('a pupil of the same school outside the own classes, and a colleague teacher, are 404; own-class pupil and self are 200', async () => {
      errorIs(await teacherA.get(`/monitoring/schools/${w.schoolA}/students/${ids.maju}`), 404, 'NOT_FOUND')
      errorIs(await teacherA.get(`/monitoring/schools/${w.schoolA}/students/${ids.susp}`), 404, 'NOT_FOUND')
      expect((await teacherA.get(`/monitoring/schools/${w.schoolA}/students/${ids.p1}`)).status).toBe(200)
      // A colleague teacher of the same school with a class of their own that holds a pupil outside teacher A's classes.
      const colleague = (await t.db.query<{ id: string }>(
        `insert into users (name, email, school_id, is_active) values ('Guru Rakan Demo', 'rakan.guru@example.test', $1, true) returning id::text`,
        [w.schoolA],
      ))[0] as { id: string }
      await t.db.query(`insert into user_roles (user_id, role) values ($1, 'teacher')`, [colleague.id])
      await addClass(t.db, { name: 'Kelas Rakan', teacherId: colleague.id, schoolId: w.schoolA, members: [ids.maju] })
      errorIs(await teacherA.get(`/monitoring/schools/${w.schoolA}/teachers/${colleague.id}`), 404, 'NOT_FOUND')
      errorIs(await teacherA.get(`/monitoring/schools/${w.schoolA}/students/${ids.maju}`), 404, 'NOT_FOUND')
      expect((await adminA.get(`/monitoring/schools/${w.schoolA}/teachers/${colleague.id}`)).status).toBe(200)
      expect(AnalyticsSchoolDetailSchema.parse((await teacherA.get(`/monitoring/schools/${w.schoolA}`)).body.data).teachers.map((x) => x.id)).toEqual([ids.teacherA])
      const self = AnalyticsTeacherDetailSchema.parse((await teacherA.get(`/monitoring/schools/${w.schoolA}/teachers/${ids.teacherA}`)).body.data)
      expect(self.students.map((x) => x.id).sort()).toEqual([ids.p1, ids.p2].sort())
      expect(self.cards.students).toBe(2)
    })

    it('the overview and the export count the own-class pupils only (G5-M11 bug 5), with no pupil identities', async () => {
      const o = AnalyticsMonitoringOverviewSchema.parse((await teacherA.get('/monitoring/overview')).body.data)
      expect(rowOf(o.studentRows, w.schoolA)).toMatchObject({ registered: 2 })
      const e = AnalyticsMonitoringExportSchema.parse((await teacherA.get('/monitoring/export?format=csv')).body.data)
      expect(JSON.stringify(e)).not.toContain('@')
    })
  })

  describe('teacher detail (S5)', () => {
    it('cards, pupil rows by name and the three suggestion counts', async () => {
      const res = await admin.get(`/monitoring/schools/${w.schoolA}/teachers/${ids.teacherA}`)
      const body = envelopeOf(AnalyticsTeacherDetailSchema).parse(res.body).data
      expect(res.headers['cache-control']).toContain('no-store')
      expect(body.teacher).toMatchObject({ id: ids.teacherA })
      expect(body.teacher.lastLoginAt).toBe('2026-10-19T09:00:00.000+08:00')
      // 4 pupils: p1 (18 answers, 15 + ... ), maju (50, 40) and susp (4, 2) answered; p2 did not.
      expect(body.cards).toMatchObject({ students: 4, engaged: 3, pct: 75, needAttention: 1 })
      const maju = body.students.find((s) => s.id === ids.maju)
      expect(maju).toMatchObject({ answers: 50, accuracy: 80, status: 'aktif', level: 'T5' })
      expect(body.students.find((s) => s.id === ids.p2)).toMatchObject({ answers: 0, accuracy: null })
      const names = body.students.map((s) => s.name)
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms', { sensitivity: 'base' })))
      // Only the first pupil has logged in; the accuracies of the three who answered are 61.1, 80 and 50, so none is under 50.
      expect(body.suggestions).toEqual({ neverLoggedIn: 3, lowAccuracy: 0, answered: 3 })
    })

    it('a user who is not a teacher is 404, also for the admin; the school segment is not validated for the admin', async () => {
      for (const id of [ids.p1, ids.adminA, '987654321', '0']) {
        errorIs(await admin.get(`/monitoring/schools/${w.schoolA}/teachers/${id}`), 404, 'NOT_FOUND', 'Not Found.')
      }
      errorIs(await admin.get(`/monitoring/schools/${w.schoolA}/teachers/abc`), 404, 'NOT_FOUND')
      // Teacher of school A under school B: the person is loaded by id, the pupil list is the school in the URL.
      const res = await admin.get(`/monitoring/schools/${w.schoolB}/teachers/${ids.teacherA}`)
      expect(res.status).toBe(200)
      const body = AnalyticsTeacherDetailSchema.parse(res.body.data)
      expect(body.school.id).toBe(w.schoolB)
      expect(body.cards.students).toBe(1)
    })

    it('teacher and school_admin: a teacher or school of another school is 404, a pupil id is 404', async () => {
      for (const who of [teacherA, adminA]) {
        expect((await who.get(`/monitoring/schools/${w.schoolA}/teachers/${ids.teacherA}`)).status).toBe(200)
        errorIs(await who.get(`/monitoring/schools/${w.schoolA}/teachers/${ids.teacherB}`), 404, 'NOT_FOUND')
        errorIs(await who.get(`/monitoring/schools/${w.schoolB}/teachers/${ids.teacherB}`), 404, 'NOT_FOUND')
        errorIs(await who.get(`/monitoring/schools/${w.schoolB}/teachers/${ids.teacherA}`), 404, 'NOT_FOUND')
        errorIs(await who.get(`/monitoring/schools/${w.schoolA}/teachers/${ids.p1}`), 404, 'NOT_FOUND')
        errorIs(await who.get(`/monitoring/schools/${w.schoolA}/teachers/987654321`), 404, 'NOT_FOUND')
      }
      errorIs(await teacherC.get(`/monitoring/schools/${w.schoolA}/teachers/${ids.teacherA}`), 404, 'NOT_FOUND')
    })
  })

  describe('other contract bodies', () => {
    it('the teacher report and item analysis bodies of the admin parse (empty population)', async () => {
      envelopeOf(AnalyticsTeacherReportSchema).parse((await admin.get('/teacher/report')).body)
      envelopeOf(AnalyticsItemAnalysisSchema).parse((await admin.get('/teacher/item-analysis')).body)
    })

    it('school pupil of another school (STUDENT_B) exists as a fixture', async () => {
      expect(await idOfEmail(t, STUDENT_B)).toBe(ids.pb)
    })
  })
})
