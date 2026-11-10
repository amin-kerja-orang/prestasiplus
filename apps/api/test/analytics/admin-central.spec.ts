import { AdminAnalyticsResponseSchema, AdminDashboardResponseSchema, AdminLaporanResponseSchema, AnalyticsMonitoringOverviewSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  SCHOOL_ADMIN_A,
  STUDENT_1,
  TEACHER_A,
  type AnalyticsTestApp,
  type Client,
  type World,
  addModeSession,
  addQuestion,
  bootAnalyticsApp,
  buildWorld,
  client,
  errorIs,
} from './helpers'
import { PrismaService } from '../../src/db/prisma.service'
import { XS_ALL_TIME, XsQueries } from '../../src/modules/school-admin/xs-queries'

/**
 * DB spec (needs Docker/Testcontainers): API-ADM-11, API-ADM-12 and API-ADM-13 laporan (S6-T11). Activity of the Laporan is answer rows. Clock 2026-10-19 (a Monday).
 * Fixture of `buildWorld`: sessions of pelajar 09-10 (8 answered, 6 right) and 10-05 (10, 5), pelajarmaju 10-10 (50, 40), the school B
 * pupil 10-12 (5, 5); a test session never counts; an in-progress session (4 answers, 4 right, 10-18) does (XS-8).
 */
describe('Admin Pusat central screens (S6-T11)', () => {
  let t: AnalyticsTestApp
  let w: World
  let admin: Client

  beforeAll(async () => {
    t = await bootAnalyticsApp()
    w = await buildWorld(t)
    const q = t.db.query.bind(t.db)
    // The school B pupil of the fixture is a Tingkatan 4 pupil, so school B is a secondary school here. The seed makes DEMO002 a primary
    // school (SK), whose pupils the XS-1 platform scope leaves out (D72); the primary-school case has its own test below.
    await q(`update schools set type = 'SMK' where id = $1::bigint`, [w.schoolB])

    // Questions: three approved (live) and one draft; created_at pinned around the Monday boundary of the clock week.
    const a1 = await addQuestion(t.db, { stem: 'Soalan admin satu', subjectId: w.subjects[0], correct: 'A' })
    const a2 = await addQuestion(t.db, { stem: 'Soalan admin dua', subjectId: w.subjects[0], correct: 'A' })
    const a3 = await addQuestion(t.db, { stem: 'Soalan admin tiga', subjectId: w.subjects[1], correct: 'A' })
    const draft = (
      await q<{ id: string }>(`insert into questions (latest_version_no, is_active) values (1, true) returning id::text`)
    )[0] as { id: string }
    await q(`insert into question_versions (question_id, version_no, status, type, stem_ms, subject_id) values ($1, 1, 'draft', 'mcq', 'Draf admin', $2)`, [draft.id, w.subjects[0]])
    await q(`update questions set created_at = $2::timestamptz where id = $1`, [a1, '2026-10-20T10:00:00+08:00'])
    await q(`update questions set created_at = $2::timestamptz where id = $1`, [a2, '2026-10-10T10:00:00+08:00'])
    await q(`update questions set created_at = $2::timestamptz where id = $1`, [a3, '2026-10-19T00:30:00+08:00'])
    await q(`update questions set created_at = $2::timestamptz where id = $1`, [draft.id, '2026-10-18T23:30:00+08:00'])

    // Two more completed sessions for the breakdown: Latih Tubi and Tracking A, 2026-10-17.
    await addModeSession(t.db, { userId: w.ids.p2, subjectId: w.subjects[0], at: '2026-10-17T10:00:00+08:00', mode: 'latih_tubi', questions: 6, correct: 3 })
    await addModeSession(t.db, { userId: w.ids.p1, subjectId: w.subjects[0], at: '2026-10-19T08:00:00+08:00', mode: 'ramalan', questions: 4, correct: 4 })

    admin = await client(t, ADMIN)
  }, 240_000)
  afterAll(async () => {
    await t.close()
  })

  describe('role matrix', () => {
    it('admin 200 with no-store; school_admin, teacher and student 403; no session 401', async () => {
      const others = [await client(t, SCHOOL_ADMIN_A), await client(t, TEACHER_A), await client(t, STUDENT_1)]
      for (const path of ['/admin/dashboard', '/admin/analytics', '/admin/reports/laporan']) {
        const res = await admin.get(path)
        expect(res.status, path).toBe(200)
        expect(res.headers['cache-control']).toContain('no-store')
        for (const who of others) errorIs(await who.get(path), 403, 'FORBIDDEN')
        errorIs(await t.http().get(`/api${path}`), 401, 'UNAUTHORIZED')
      }
    })
  })

  describe('GET /admin/dashboard (API-ADM-11)', () => {
    it('question tiles share the summary base: byStatus sums to the total; thisWeek counts since Monday 00:00 MYT', async () => {
      const d = AdminDashboardResponseSchema.parse((await admin.get('/admin/dashboard')).body).data
      expect(d.questions.byStatus).toEqual({ draft: 1, review: 0, approved: 3, archived: 0 })
      expect(d.questions.total).toBe(4)
      const sum = Object.values(d.questions.byStatus).reduce((a, b) => a + b, 0)
      expect(sum).toBe(d.questions.total)
      // a1 (Tue 10-20) and a3 (Mon 10-19 00:30) are this week; a2 and the Sunday-night draft are not.
      expect(d.questions.thisWeek).toBe(2)
      const summary = (await admin.get('/questions/summary')).body as { data?: { total?: number } }
      if (summary.data?.total !== undefined) expect(d.questions.total).toBe(summary.data.total)
    })

    it('subjects and levels come from the owners; students and teachers use the same definition as Analitik and Laporan', async () => {
      const d = AdminDashboardResponseSchema.parse((await admin.get('/admin/dashboard')).body).data
      const q = t.db.query.bind(t.db)
      const subjects = (await q<{ total: number; active: number }>(`select count(*)::int total, count(*) filter (where is_active)::int active from subjects`))[0]
      expect(d.subjects).toEqual(subjects)
      const levels = (await q<{ n: number }>(`select count(*)::int n from education_levels where stage <> 'primary' and is_active`))[0]
      expect(d.levels).toBe(levels?.n)
      const analytics = AdminAnalyticsResponseSchema.parse((await admin.get('/admin/analytics')).body).data
      const laporan = AdminLaporanResponseSchema.parse((await admin.get('/admin/reports/laporan')).body).data
      expect(d.users.students).toBe(analytics.platform.students)
      expect(d.users.students).toBe(laporan.tiles.pupils)
      expect(d.users.teachers).toBe(laporan.tiles.teachers)
      expect(d.users.total).toBeGreaterThanOrEqual(d.users.students + d.users.teachers)
      // "Jumlah Sekolah" / "Sekolah Berdaftar" is one number on every admin card (V2 counts the schools table; primary types are hidden, D72):
      // the Dashboard, the Analitik platform card and the Laporan tile agree with the Sekolah list, with or without users.
      expect(analytics.platform.schools).toBe(d.schools.total)
      expect(laporan.tiles.schools).toBe(d.schools.total)
      // Teachers: the same XS-3 teachers of secondary schools on the Dashboard and the Monitoring teacher table.
      const monitoring = AnalyticsMonitoringOverviewSchema.parse((await admin.get('/monitoring/overview')).body.data)
      expect(monitoring.kpi.schools).toBe(d.schools.total)
      expect(monitoring.teacherRows.reduce((n, r) => n + r.registered, 0)).toBe(d.users.teachers)
    })

    it('the Sekolah card is computed from the schools table (secondary stage only), total and active', async () => {
      const d = AdminDashboardResponseSchema.parse((await admin.get('/admin/dashboard')).body).data
      const row = (
        await t.db.query<{ total: number; active: number }>(
          `select count(*)::int total, count(*) filter (where is_active)::int active from schools where type is null or type not in ('SK','SJK(C)','SJK(T)')`,
        )
      )[0]
      expect(d.schools).toEqual(row)
      expect(d.schools.total).toBeGreaterThan(0)
    })

    it('a pending, an inactive or a school-admin teacher is not counted; an inactive pupil is not counted', async () => {
      const before = AdminDashboardResponseSchema.parse((await admin.get('/admin/dashboard')).body).data.users
      const q = t.db.query.bind(t.db)
      const mk = async (email: string, active: boolean, pending: boolean, roles: string[]) => {
        const row = (
          await q<{ id: string }>(
            `insert into users (name, email, is_active, school_id, pending_school_id, grade, created_at, updated_at)
             values ('Ujian Pusat', $1, $2, $3::bigint, $4, 10, now(), now()) returning id::text`,
            [email, active, pending ? null : w.schoolA, pending ? w.schoolA : null],
          )
        )[0] as { id: string }
        for (const r of roles) await q(`insert into user_roles (user_id, role, created_at) values ($1::bigint, $2, now())`, [row.id, r])
      }
      await mk('pusat.guru.ok@central.test', true, false, ['teacher'])
      await mk('pusat.guru.pending@central.test', false, true, ['teacher'])
      await mk('pusat.guru.off@central.test', false, false, ['teacher'])
      await mk('pusat.guru.admin@central.test', true, false, ['teacher', 'school_admin'])
      await mk('pusat.murid.off@central.test', false, false, ['student'])
      await mk('pusat.murid.ok@central.test', true, false, ['student'])
      const after = AdminDashboardResponseSchema.parse((await admin.get('/admin/dashboard')).body).data.users
      expect(after.teachers - before.teachers).toBe(1)
      expect(after.students - before.students).toBe(1)
    })

    it('XS-1 platform scope: a pupil without a Tingkatan grade, a suspended pupil and a pupil of a primary school (SK) are not counted', async () => {
      const read = async () => AdminDashboardResponseSchema.parse((await admin.get('/admin/dashboard')).body).data.users.students
      const before = await read()
      const q = t.db.query.bind(t.db)
      const primary = (await q<{ id: string }>(`select id::text from schools where type = 'SK' limit 1`))[0] as { id: string }
      const mk = async (email: string, school: string, grade: number | null, suspended: boolean) => {
        const row = (
          await q<{ id: string }>(
            `insert into users (name, email, is_active, is_suspended, school_id, grade, created_at, updated_at)
             values ('Ujian XS1', $1, true, $2, $3::bigint, $4, now(), now()) returning id::text`,
            [email, suspended, school, grade],
          )
        )[0] as { id: string }
        await q(`insert into user_roles (user_id, role, created_at) values ($1::bigint, 'student', now())`, [row.id])
      }
      await mk('xs1.sk@central.test', primary.id, 10, false)
      await mk('xs1.nograde@central.test', w.schoolA, null, false)
      await mk('xs1.suspended@central.test', w.schoolA, 10, true)
      expect(await read()).toBe(before)
      await mk('xs1.ok@central.test', w.schoolA, 8, false)
      expect(await read()).toBe(before + 1)
    })

    it('battles count game rooms: test rooms out, active = playing', async () => {
      const read = async () => AdminDashboardResponseSchema.parse((await admin.get('/admin/dashboard')).body).data.battles
      const before = await read()
      await t.db.query(
        `insert into game_rooms (code, game, subject, grade_level, match_mode, max_players, host_id, status, is_test) values
           ('ADM001','papan-bijak','SAINS','TINGKATAN_4','same_grade',2,$1,'playing',false),
           ('ADM002','papan-bijak','SAINS','TINGKATAN_4','same_grade',2,$1,'finished',false),
           ('ADM003','papan-bijak','SAINS','TINGKATAN_4','same_grade',2,$1,'finished',false),
           ('ADM004','papan-bijak','SAINS','TINGKATAN_4','same_grade',2,$1,'waiting',false),
           ('ADM005','papan-bijak','SAINS','TINGKATAN_4','same_grade',2,$1,'finished',true)`,
        [w.ids.p1],
      )
      const after = await read()
      expect(after.total - before.total).toBe(4)
      expect(after.active - before.active).toBe(1)
      expect(after.finished - before.finished).toBe(2)
    })
  })

  describe('GET /admin/analytics (API-ADM-12)', () => {
    it('30d (default): platform figures with one-decimal pooled accuracy, a 30-day trend and the top schools', async () => {
      const a = AdminAnalyticsResponseSchema.parse((await admin.get('/admin/analytics')).body).data
      expect(a.range).toBe('30d')
      // Window 2026-09-20 .. now: p1 10-05 (10, 5), maju 10-10 (50, 40), school B pupil 10-12 (5, 5) and p1's in-progress session of 10-18
      // (4 answers, 4 right: XS-8 counts it) = 69 answered, 54 right.
      expect(a.platform.answered).toBe(69)
      expect(a.platform.accuracy).toBe(78.3)
      expect(a.platform.activeStudents).toBe(3)
      expect(a.platform.students).toBeGreaterThanOrEqual(a.platform.activeStudents)
      expect(a.trend).toHaveLength(30)
      expect(a.trend[0]?.date).toBe('2026-09-20')
      expect(a.trend[29]).toEqual({ date: '2026-10-19', answered: 0 })
      expect(a.trend.find((x) => x.date === '2026-10-05')?.answered).toBe(10)
      expect(a.trend.find((x) => x.date === '2026-10-10')?.answered).toBe(50)
      expect(a.trend.find((x) => x.date === '2026-10-18')?.answered).toBe(4)
      expect(a.trend.reduce((n, x) => n + x.answered, 0)).toBe(69)
      expect(a.topSchools.map((s) => [s.schoolId, s.answered])).toEqual([
        [w.schoolA, 64],
        [w.schoolB, 5],
      ])
    })

    it('has the V2 Analitik extras: Pelajar Teratas (this week), Mood Pelajar and Laporan Soalan, computed from the tables', async () => {
      const q = t.db.query.bind(t.db)
      const qid = (await q<{ id: string }>(`select id::text from questions order by id limit 1`))[0]?.id as string
      await q(`insert into question_reports (question_id, question_version_no, reasons, source, status) values ($1, 1, '{typo}', 'latihan', 'pending'), ($1, 1, '{typo}', 'latihan', 'pending'), ($1, 1, '{typo}', 'latihan', 'fixed')`, [qid])
      for (const [i, mood] of ['gembira', 'gembira', 'sedih', 'tertekan'].entries()) {
        await q(`insert into mood_checkins (user_id, mood, checked_on) values ($1::bigint, $2, $3::date)`, [w.ids.p1, mood, `2026-10-${String(10 + i)}`])
      }
      const a = AdminAnalyticsResponseSchema.parse((await admin.get('/admin/analytics')).body).data
      const dbReports = (await q<{ baru: number; selesai: number }>(`select count(*) filter (where status = 'pending')::int baru, count(*) filter (where status <> 'pending')::int selesai from question_reports where not is_test`))[0]
      expect(a.reports).toEqual(dbReports)
      expect(a.reports.baru).toBeGreaterThanOrEqual(2)
      expect(a.reports.selesai).toBeGreaterThanOrEqual(1)
      expect(a.mood.breakdown.map((b) => b.label)).toEqual(['Gembira', 'Okay', 'Sedih', 'Tertekan'])
      const dbMood = (await q<{ mood: string; n: number }>(`select mood, count(*)::int n from mood_checkins where not is_test group by mood`))
      for (const [key, stored] of [['happy', 'gembira'], ['okay', 'okay'], ['sad', 'sedih'], ['stressed', 'tertekan']] as const) {
        expect(a.mood.breakdown.find((b) => b.key === key)?.count).toBe(dbMood.find((r) => r.mood === stored)?.n ?? 0)
      }
      expect(a.mood.total).toBe(a.mood.breakdown.reduce((n, b) => n + b.count, 0))
      // The clock is Monday 2026-10-19: only the in-progress session of 10-18 is before it, so this week has no answers yet or only those of today.
      expect(a.topStudents.length).toBeLessThanOrEqual(8)
      for (const [i, s] of a.topStudents.entries()) if (i > 0) expect(a.topStudents[i - 1]?.answered).toBeGreaterThanOrEqual(s.answered)
    })

    it('range 7d has only the in-progress answers; 90d adds the September session; an unknown range is 30d', async () => {
      const week = AdminAnalyticsResponseSchema.parse((await admin.get('/admin/analytics?range=7d')).body).data
      expect(week.range).toBe('7d')
      expect(week.trend).toHaveLength(7)
      expect(week.platform).toMatchObject({ answered: 4, accuracy: 100, activeStudents: 1 })
      expect(week.topSchools.map((s) => [s.schoolId, s.answered])).toEqual([[w.schoolA, 4]])
      const quarter = AdminAnalyticsResponseSchema.parse((await admin.get('/admin/analytics?range=90d')).body).data
      expect(quarter.trend).toHaveLength(90)
      expect(quarter.platform.answered).toBe(77)
      expect(quarter.platform.accuracy).toBe(77.9)
      const odd = AdminAnalyticsResponseSchema.parse((await admin.get('/admin/analytics?range=weird')).body).data
      expect(odd.range).toBe('30d')
    })

    it('bank figures are computed from the question bank', async () => {
      const { bank } = AdminAnalyticsResponseSchema.parse((await admin.get('/admin/analytics')).body).data
      expect(bank.total).toBe(4)
      expect(bank.byStatus).toEqual({ draft: 1, review: 0, approved: 3, archived: 0 })
      expect(bank.bySubject.map((s) => [s.id, s.total])).toEqual([
        [w.subjects[0], 3],
        [w.subjects[1], 1],
      ])
      expect(bank.dskpTaggedShare).toBe(0)
      expect(bank.chapterCoverage).toBe(0)
      expect(Object.keys(bank.servability).sort()).toEqual(['bab', 'latih_tubi_spm', 'simulasi_kuiz'])
      for (const n of Object.values(bank.servability)) expect(n).toBeLessThanOrEqual(3)
    })
  })

  describe('GET /admin/reports/laporan (API-ADM-13)', () => {
    const read = async (q = '') => AdminLaporanResponseSchema.parse((await admin.get(`/admin/reports/laporan${q}`)).body).data

    it('30 days: activity is answer rows, one-decimal pooled score, 14-day trend, breakdown', async () => {
      const r = await read()
      expect(r.range).toBe(30)
      // Answer rows 2026-09-20 .. now: p1 10-05 (10, 5 right), maju 10-10 (50, 40), school B pupil 10-12 (5, 5). The mode-only sessions have no answers.
      expect(r.tiles.activities).toBe(69)
      expect(r.tiles.averageScore).toBe(78.3)
      expect(r.breakdown.map((b) => [b.type, b.count])).toEqual([
        ['kuiz', 69],
        ['struktur', 0],
        ['latihTubi', 0],
        ['trackingA', 0],
        ['battle', 0],
        ['permainan', 0],
      ])
      expect(r.trend).toHaveLength(14)
      expect(r.trend[0]?.date).toBe('06/10')
      expect(r.trend[13]).toEqual({ date: '19/10', count: 0 })
      expect(r.trend.find((x) => x.date === '10/10')?.count).toBe(50)
      expect(r.trend.find((x) => x.date === '12/10')?.count).toBe(5)
      expect(r.trend.reduce((n, x) => n + x.count, 0)).toBe(59)
    })

    it('tiles count schools, teachers, pupils, access and practice; top pupils and schools carry names for the admin', async () => {
      const r = await read()
      expect(r.tiles.schools).toBeGreaterThanOrEqual(2)
      expect(r.tiles.teachersAccessed).toBeLessThanOrEqual(r.tiles.teachers)
      expect(r.tiles.pupilsAccessed).toBeLessThanOrEqual(r.tiles.pupils)
      expect(r.tiles.pupilsPractised).toBeGreaterThanOrEqual(4)
      expect(r.mostActive.map((p) => [p.id, p.activities])).toEqual([
        [w.ids.maju, 50],
        [w.ids.p1, 14],
        [w.ids.pb, 5],
      ])
      expect(r.mostActive[0]?.name).toEqual(expect.any(String))
      expect(r.mostActive[0]?.school).toEqual({ id: w.schoolA, name: expect.any(String) })
      expect(r.schoolActivity.map((s) => [s.schoolId, s.activities, s.activePupils])).toEqual([
        [w.schoolA, 64, 2],
        [w.schoolB, 5, 1],
      ])
    })

    it('range 7 has only the in-progress answers but the trend stays 14 days; 90 adds the September session; an unknown range is 30', async () => {
      const week = await read('?range=7')
      expect(week.range).toBe(7)
      expect(week.tiles).toMatchObject({ activities: 4, averageScore: 100 })
      expect(week.trend).toHaveLength(14)
      const quarter = await read('?range=90')
      expect(quarter.tiles.activities).toBe(77)
      expect(quarter.tiles.averageScore).toBe(77.9)
      expect((await read('?range=abc')).range).toBe(30)
    })

    it('AC-ADM-M06.2: a pupil answers 3 questions (2 right) in a Latih Tubi session and Jumlah Aktiviti rises by 3 (all modes)', async () => {
      const before = await read()
      const session = (
        await t.db.query<{ id: string }>(
          `insert into practice_sessions (user_id, mode, subject_id, question_count, status, correct_count, started_at, completed_at)
           values ($1, 'latih_tubi', $2, 3, 'completed', 2, $3::timestamptz, $3::timestamptz) returning id::text`,
          [w.ids.p2, w.subjects[0], '2026-10-18T09:00:00+08:00'],
        )
      )[0] as { id: string }
      await t.db.query(
        `insert into practice_answers (session_id, user_id, subject_id, is_correct, answered_at, mode)
         select $1::uuid, $2, $3, g <= 2, $4::timestamptz, 'latih_tubi' from generate_series(1, 3) g`,
        [session.id, w.ids.p2, w.subjects[0], '2026-10-18T09:00:00+08:00'],
      )
      const after = await read()
      expect(after.tiles.activities - before.tiles.activities).toBe(3)
      expect(after.breakdown.find((b) => b.type === 'latihTubi')?.count).toBe(3)
      expect(after.trend.find((x) => x.date === '18/10')?.count).toBe(7) // 3 + the in-progress session's 4
      expect(after.tiles.averageScore).toBe(77.8) // 56 right of 72
    })
  })
  describe('XS-8: answers of an unfinished session count on every Admin Pusat answer figure', () => {
    it('Analitik Soalan Dijawab, Laporan Jumlah Aktiviti and the top-10 include an in-progress session and equal XsQueries.answerTotals', async () => {
      const xs = new XsQueries(t.app.get(PrismaService))
      const readA = async () => AdminAnalyticsResponseSchema.parse((await admin.get('/admin/analytics?range=90d')).body).data
      const readL = async () => AdminLaporanResponseSchema.parse((await admin.get('/admin/reports/laporan?range=90')).body).data
      const beforeA = await readA()
      const beforeL = await readL()
      const pupilBefore = beforeL.mostActive.find((p) => p.id === w.ids.p2)?.activities ?? 0
      const session = (
        await t.db.query<{ id: string }>(
          `insert into practice_sessions (user_id, mode, subject_id, question_count, status, correct_count, started_at)
           values ($1, 'latih_tubi', $2, 5, 'in_progress', 0, $3::timestamptz) returning id::text`,
          [w.ids.p2, w.subjects[0], '2026-10-18T10:00:00+08:00'],
        )
      )[0] as { id: string }
      await t.db.query(
        `insert into practice_answers (session_id, user_id, subject_id, is_correct, answered_at, mode)
         select $1::uuid, $2, $3, g <= 4, $4::timestamptz, 'latih_tubi' from generate_series(1, 5) g`,
        [session.id, w.ids.p2, w.subjects[0], '2026-10-18T10:00:00+08:00'],
      )
      const afterA = await readA()
      const afterL = await readL()
      expect(afterA.platform.answered - beforeA.platform.answered).toBe(5)
      expect(afterL.tiles.activities - beforeL.tiles.activities).toBe(5)
      expect(afterL.breakdown.find((b) => b.type === 'latihTubi')?.count).toBe((beforeL.breakdown.find((b) => b.type === 'latihTubi')?.count ?? 0) + 5)
      expect(afterL.mostActive.find((p) => p.id === w.ids.p2)?.activities).toBe(pupilBefore + 5)
      const totals = await xs.answerTotals({ kind: 'platform' }, XS_ALL_TIME)
      expect(afterA.platform.answered).toBe(totals.answered)
      expect(afterL.tiles.activities).toBe(totals.answered)
      expect(afterA.platform.accuracy).toBe(totals.accuracy)
      expect(afterA.trend.reduce((n, x) => n + x.answered, 0)).toBe(totals.answered)
    })
  })
})
