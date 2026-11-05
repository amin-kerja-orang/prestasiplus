import { AdminAnalyticsResponseSchema, AdminDashboardResponseSchema, AdminLaporanResponseSchema } from '@pp/contract'
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

/**
 * DB spec (needs Docker/Testcontainers): API-ADM-11, API-ADM-12 and API-ADM-13 laporan (S6-T11). Activity of the Laporan is answer rows. Clock 2026-10-19 (a Monday).
 * Fixture of `buildWorld`: sessions of pelajar 09-10 (8 answered, 6 right) and 10-05 (10, 5), pelajarmaju 10-10 (50, 40), the school B
 * pupil 10-12 (5, 5); a test session and an in-progress session never count.
 */
describe('Admin Pusat central screens (S6-T11)', () => {
  let t: AnalyticsTestApp
  let w: World
  let admin: Client

  beforeAll(async () => {
    t = await bootAnalyticsApp()
    w = await buildWorld(t)
    const q = t.db.query.bind(t.db)

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
    })

    it('a pending, an inactive or a school-admin teacher is not counted; an inactive pupil is not counted', async () => {
      const before = AdminDashboardResponseSchema.parse((await admin.get('/admin/dashboard')).body).data.users
      const q = t.db.query.bind(t.db)
      const mk = async (email: string, active: boolean, pending: boolean, roles: string[]) => {
        const row = (
          await q<{ id: string }>(
            `insert into users (name, email, is_active, school_id, pending_school_id, created_at, updated_at)
             values ('Ujian Pusat', $1, $2, $3::bigint, $4, now(), now()) returning id::text`,
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
      // Window 2026-09-20 .. now: p1 10-05 (10, 5), maju 10-10 (50, 40), school B pupil 10-12 (5, 5) = 65 answered, 50 right.
      expect(a.platform.answered).toBe(65)
      expect(a.platform.accuracy).toBe(76.9)
      expect(a.platform.activeStudents).toBe(3)
      expect(a.platform.students).toBeGreaterThanOrEqual(a.platform.activeStudents)
      expect(a.trend).toHaveLength(30)
      expect(a.trend[0]?.date).toBe('2026-09-20')
      expect(a.trend[29]).toEqual({ date: '2026-10-19', answered: 0 })
      expect(a.trend.find((x) => x.date === '2026-10-05')?.answered).toBe(10)
      expect(a.trend.find((x) => x.date === '2026-10-10')?.answered).toBe(50)
      expect(a.trend.reduce((n, x) => n + x.answered, 0)).toBe(65)
      expect(a.topSchools.map((s) => [s.schoolId, s.answered])).toEqual([
        [w.schoolA, 60],
        [w.schoolB, 5],
      ])
    })

    it('range 7d has no answers (accuracy null); 90d adds the September session; an unknown range is 30d', async () => {
      const week = AdminAnalyticsResponseSchema.parse((await admin.get('/admin/analytics?range=7d')).body).data
      expect(week.range).toBe('7d')
      expect(week.trend).toHaveLength(7)
      expect(week.platform).toMatchObject({ answered: 0, accuracy: null, activeStudents: 0 })
      expect(week.topSchools).toEqual([])
      const quarter = AdminAnalyticsResponseSchema.parse((await admin.get('/admin/analytics?range=90d')).body).data
      expect(quarter.trend).toHaveLength(90)
      expect(quarter.platform.answered).toBe(73)
      expect(quarter.platform.accuracy).toBe(76.7)
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
      expect(r.tiles.activities).toBe(65)
      expect(r.tiles.averageScore).toBe(76.9)
      expect(r.breakdown.map((b) => [b.type, b.count])).toEqual([
        ['kuiz', 65],
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
      expect(r.trend.reduce((n, x) => n + x.count, 0)).toBe(55)
    })

    it('tiles count schools, teachers, pupils, access and practice; top pupils and schools carry names for the admin', async () => {
      const r = await read()
      expect(r.tiles.schools).toBeGreaterThanOrEqual(2)
      expect(r.tiles.teachersAccessed).toBeLessThanOrEqual(r.tiles.teachers)
      expect(r.tiles.pupilsAccessed).toBeLessThanOrEqual(r.tiles.pupils)
      expect(r.tiles.pupilsPractised).toBeGreaterThanOrEqual(4)
      expect(r.mostActive.map((p) => [p.id, p.activities])).toEqual([
        [w.ids.maju, 50],
        [w.ids.p1, 10],
        [w.ids.pb, 5],
      ])
      expect(r.mostActive[0]?.name).toEqual(expect.any(String))
      expect(r.mostActive[0]?.school).toEqual({ id: w.schoolA, name: expect.any(String) })
      expect(r.schoolActivity.map((s) => [s.schoolId, s.activities, s.activePupils])).toEqual([
        [w.schoolA, 60, 2],
        [w.schoolB, 5, 1],
      ])
    })

    it('range 7 has no answers (score null) but the trend stays 14 days; 90 adds the September session; an unknown range is 30', async () => {
      const week = await read('?range=7')
      expect(week.range).toBe(7)
      expect(week.tiles).toMatchObject({ activities: 0, averageScore: null })
      expect(week.trend).toHaveLength(14)
      const quarter = await read('?range=90')
      expect(quarter.tiles.activities).toBe(73)
      expect(quarter.tiles.averageScore).toBe(76.7)
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
        `insert into practice_answers (session_id, user_id, subject_id, is_correct, answered_at)
         select $1::uuid, $2, $3, g <= 2, $4::timestamptz from generate_series(1, 3) g`,
        [session.id, w.ids.p2, w.subjects[0], '2026-10-18T09:00:00+08:00'],
      )
      const after = await read()
      expect(after.tiles.activities - before.tiles.activities).toBe(3)
      expect(after.breakdown.find((b) => b.type === 'latihTubi')?.count).toBe(3)
      expect(after.trend.find((x) => x.date === '18/10')?.count).toBe(3)
      expect(after.tiles.averageScore).toBe(76.5) // 52 right of 68
    })
  })
})
