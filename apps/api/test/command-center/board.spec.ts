import {
  CommandCenterDailyActivityResponseSchema,
  CommandCenterLiveDataResponseSchema,
  CommandCenterSchoolDrillResponseSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  bootCommandCenterApp,
  buildWorld,
  type CcTestApp,
  createAnswers,
  createUser,
  expectError,
  getAs,
  loginRole,
  type LoggedIn,
  type World,
} from './helpers'

/**
 * Board routes: live-data, daily-activity, daily-activity/school/:id. Fixed clock Monday 2026-10-19 09:00 +08:00. The world (see
 * `buildWorld`): school 1 has 3 class pupils (10 answers today, 8/7/8 correct, plus 2 yesterday with 1 correct) and a loose pupil
 * (4 answers on 13 Oct, 2 correct); school 2 has 1 pupil (6 answers today, 3 correct); an is_test pupil has 50 answers that must
 * never be counted. Platform: 46 answers, 31 correct, 5 answering students.
 */
let t: CcTestApp
let w: World
let admin: LoggedIn
let schoolAdmin: LoggedIn
let teacher: LoggedIn
let loginUser: { id: string }

beforeAll(async () => {
  t = await bootCommandCenterApp()
  w = await buildWorld(t)
  // Two users who logged in today (07:00 and 08:30) and one yesterday; an inactive pupil with answers must never count.
  loginUser = await createUser(t.db, { role: 'student', schoolId: w.school1, name: 'Murid Log', lastLoginAt: '2026-10-19T07:00:00.000+08:00' })
  await createUser(t.db, { role: 'teacher', schoolId: w.school2, name: 'Guru Log', lastLoginAt: '2026-10-19T08:30:00+08:00' })
  await createUser(t.db, { role: 'student', schoolId: w.school2, name: 'Murid Semalam', lastLoginAt: '2026-10-18T09:00:00+08:00' })
  const inactive = await createUser(t.db, { role: 'student', schoolId: w.school1, name: 'Murid Tidak Aktif', isActive: false })
  await createAnswers(t.db, { userId: inactive.id, at: '2026-10-19T08:30:00+08:00', count: 9, correct: 9 })
  admin = await loginRole(t, 'admin')
  schoolAdmin = await loginRole(t, 'school_admin')
  teacher = await loginRole(t, 'teacher')
})
afterAll(async () => {
  await t.close()
})

const live = async (who: LoggedIn, query = '') => {
  const res = await getAs(who, `/admin/command-center/live-data${query}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return CommandCenterLiveDataResponseSchema.parse(res.body).data
}
const daily = async (who: LoggedIn, query = '') => {
  const res = await getAs(who, `/command-center/daily-activity${query}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return CommandCenterDailyActivityResponseSchema.parse(res.body).data
}

describe('GET /admin/command-center/live-data', () => {
  it('platform view for the admin: figures from the answer log, is_test and inactive pupils excluded', async () => {
    const d = await live(admin)
    expect(d.scope).toBe('platform')
    expect(d.school).toBeNull()
    expect(d.generatedAt).toBe('2026-10-19T09:00:00.000+08:00')
    expect(d.totalAnswered).toBe(46)
    expect(d.activeStudents).toBe(5)
    expect(d.answeredToday).toBe(36)
    expect(d.answeredWeek).toBe(36)
    expect(d.answeredLastWeek).toBe(10)
    expect(d.weekChange).toBe(260)
    expect(d.accuracy).toBe(67.4)
    expect(d.kirk.t2Accuracy).toBe(d.accuracy)
    expect(d.kirk.t3Active).toBe(5)
    const students = await t.db.query<{ c: number }>(
      `select count(*)::int c from users u where u.is_active and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student')`,
    )
    expect(d.totalStudents).toBe(students[0]?.c)
  })

  it('AC2: children add up to the parent (schools, students, feed, trend are consistent with the totals)', async () => {
    const d = await live(admin)
    expect(d.topSchools.reduce((n, s) => n + s.totalAnswers, 0)).toBe(d.totalAnswered)
    expect(d.topSchools.reduce((n, s) => n + s.activeCount, 0)).toBe(d.activeStudents)
    expect(d.topSchools.map((s) => [s.schoolId, s.activeCount, s.totalAnswers])).toEqual([
      [w.school1, 4, 40],
      [w.school2, 1, 6],
    ])
    const school = await live(schoolAdmin)
    expect(school.totalAnswered).toBe(40)
    expect(school.dailyTrend.reduce((n, p) => n + p.count, 0)).toBe(40)
  })

  it('top students: answers this ISO week desc, then accuracy desc, then id', async () => {
    const d = await live(admin)
    expect(d.topStudents.map((s) => [s.name, s.answersCount, s.accuracy])).toEqual([
      ['Murid 1', 10, 80],
      ['Murid 3', 10, 80],
      ['Murid 2', 10, 70],
      ['Murid Sekolah Dua', 6, 50],
    ])
    expect(d.topStudents.every((s) => s.name !== 'Murid Ujian' && s.name !== 'Murid Tidak Aktif')).toBe(true)
  })

  it('platform display constants, empty degraded ports and the recent feed', async () => {
    const d = await live(admin)
    expect(d.engagement).toEqual({ champion: 29, consistent: 11, developing: 43, minimum: 3, disengaged: 2229 })
    expect(d.correction).toEqual({ total: 899, avgImprovement: 0, improvedCount: 0, topImprovers: [] })
    expect(d.dailyTrend).toEqual([])
    expect(d.mood).toEqual({ happy: 0, okay: 0, sad: 0, stressed: 0 })
    expect(d.kirk.t1).toEqual({ value: 0, scale: 5, count: 0 })
    expect(d.gpsOverall).toBe(0)
    expect(d.kirk.t4Gps).toBe(0)
    expect(d.recentFeed).toHaveLength(10)
    expect(d.recentFeed.every((r) => /^\d{2}:\d{2}$/.test(r.time))).toBe(true)
    expect(d.recentFeed.map((r) => r.student)).not.toContain('Murid Ujian')
    expect(['BM', 'Matematik']).toContain(d.recentFeed[0]?.subject)
  })

  it('school admin gets the school view, the school comes from the session and ?schoolId= is ignored', async () => {
    const forged = await live(schoolAdmin, `?schoolId=${w.school2}`)
    const d = await live(schoolAdmin)
    expect(forged).toEqual(d)
    expect(d.scope).toBe('school')
    expect(d.school?.id).toBe(w.school1)
    expect(d.totalAnswered).toBe(40)
    expect(d.activeStudents).toBe(4)
    expect(d.answeredToday).toBe(30)
    expect(d.answeredLastWeek).toBe(10)
    expect(d.topSchools).toEqual([])
    expect(d.engagement).toEqual({ champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 })
    expect(d.correction).toEqual({ total: 0, avgImprovement: 0, improvedCount: 0, topImprovers: [] })
    expect(d.topStudents.every((s) => s.schoolName === d.school?.name)).toBe(true)
    expect(d.dailyTrend).toHaveLength(7)
    expect(d.dailyTrend.map((p) => [p.date, p.label, p.count])).toEqual([
      ['2026-10-13', 'Sel', 4],
      ['2026-10-14', 'Rab', 0],
      ['2026-10-15', 'Kha', 0],
      ['2026-10-16', 'Jum', 0],
      ['2026-10-17', 'Sab', 0],
      ['2026-10-18', 'Ahd', 6],
      ['2026-10-19', 'Isn', 30],
    ])
  })

  it('401, 403 for teacher and student, no-store header', async () => {
    expectError(await t.http().get('/api/admin/command-center/live-data'), 'UNAUTHORIZED', 'Unauthenticated.')
    expectError(await getAs(teacher, '/admin/command-center/live-data'), 'FORBIDDEN', 'This action is unauthorized.')
    const res = await getAs(admin, '/admin/command-center/live-data')
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('ETag and 304: stable while the figures stand still, new tag once an answer lands (an inactive pupil changes nothing)', async () => {
    const first = await getAs(admin, '/admin/command-center/live-data')
    const tag = first.headers.etag as string
    expect(tag).toMatch(/^W\/"/)
    t.clock.set(new Date('2026-10-19T09:05:00+08:00'))
    const same = await admin.agent.get('/api/admin/command-center/live-data').set('If-None-Match', tag)
    expect(same.status).toBe(304)
    expect(same.text ?? '').toBe('')
    expect(same.headers['cache-control']).toBe('no-store')
    const inactive = await t.db.query<{ id: string }>(`select id::text from users where name = 'Murid Tidak Aktif'`)
    await createAnswers(t.db, { userId: inactive[0]?.id as string, at: '2026-10-19T09:01:00+08:00', count: 2 })
    expect((await admin.agent.get('/api/admin/command-center/live-data').set('If-None-Match', tag)).status).toBe(304)
    await createAnswers(t.db, { userId: w.pupils[0] as string, at: '2026-10-19T09:02:00+08:00', count: 2, correct: 2 })
    const changed = await admin.agent.get('/api/admin/command-center/live-data').set('If-None-Match', tag)
    expect(changed.status).toBe(200)
    expect(changed.headers.etag).not.toBe(tag)
    expect(CommandCenterLiveDataResponseSchema.parse(changed.body).data.totalAnswered).toBe(48)
    // Put the world back for the other tests.
    await t.db.query(`delete from practice_answers where answered_at >= '2026-10-19T09:00:30+08:00'`)
    t.clock.set(new Date('2026-10-19T09:00:00+08:00'))
  })
})

describe('GET /command-center/daily-activity', () => {
  it('today (default): practice, summary, subjects, hourly heatmap and the live feed agree with each other', async () => {
    const d = await daily(admin)
    expect(d.period).toBe('today')
    expect(d.label).toBe('Hari Ini (19 Oct 2026)')
    expect(d.scope).toBe('platform')
    expect(d.practice).toMatchObject({ totalAnswers: 36, correctAnswers: 26, accuracy: 72.2, activeStudents: 4, sessionsCompleted: 1, sessionsStarted: 1, avgSessionSeconds: 600 })
    expect(d.summary).toMatchObject({ activeSchools: 2, activeStudents: 4 })
    expect(d.summary.totalSchools).toBeGreaterThanOrEqual(2)
    expect(Object.keys(d.hourlyHeatmap)).toHaveLength(24)
    expect(Object.values(d.hourlyHeatmap).reduce((a, b) => a + b, 0)).toBe(36)
    expect(d.hourlyHeatmap['8']).toBe(36)
    expect(d.subjectBreakdown).toEqual([{ code: 'BM', shortName: 'BM', answers: 36 }])
    expect(d.subjectBreakdown.reduce((a, s) => a + s.answers, 0)).toBe(d.practice.totalAnswers)
    expect(d.liveFeed).toHaveLength(10)
    expect(d.topStudents.map((s) => s.name)).toEqual(['Murid 1', 'Murid 3', 'Murid 2', 'Murid Sekolah Dua'])
    expect(d.engagement).toMatchObject({ moodCheckins: 0, missionsCompleted: 0, badgesEarned: 0, recentBadges: [], quizSetsCreated: 0 })
  })

  it('AC2: school rows add up to the practice totals; teachers and ordering', async () => {
    const d = await daily(admin)
    const rows = d.schools ?? []
    expect(rows.reduce((a, s) => a + s.totalAnswers, 0)).toBe(d.practice.totalAnswers)
    expect(rows.reduce((a, s) => a + s.activeStudents, 0)).toBe(d.practice.activeStudents)
    const answered = rows.filter((r) => r.totalAnswers > 0)
    expect(answered.map((r) => [r.schoolId, r.activeStudents, r.totalAnswers, r.activeTeachers])).toEqual([
      [w.school1, 3, 30, 1],
      [w.school2, 1, 6, 1],
    ])
    expect(answered[0]?.accuracy).toBe(76.7)
    expect(answered[0]?.lastActiveHuman).toMatch(/yang lepas$/)
    // Rows without answers (login only) come after the answered ones.
    const firstLoginOnly = rows.findIndex((r) => r.totalAnswers === 0)
    if (firstLoginOnly >= 0) expect(rows.slice(firstLoginOnly).every((r) => r.totalAnswers === 0 && r.accuracy === null)).toBe(true)
  })

  it('logins: counts by role, recent list with role, package chip and time ago', async () => {
    const d = await daily(admin)
    const log = d.logins.recent.find((r) => r.userId === loginUser.id)
    expect(log).toMatchObject({ name: 'Murid Log', role: 'student', schoolId: w.school1, package: 'FREE', timeAgo: '2 jam yang lepas', lastLoginAt: '2026-10-19T07:00:00.000+08:00' })
    expect(d.logins.total).toBe(Object.values(d.logins.byRole).reduce((a, b) => a + b, 0))
    expect(d.summary.totalLogins).toBe(d.logins.total)
    expect(d.logins.byRole.student).toBe(1)
    expect(d.logins.byRole.teacher).toBeGreaterThanOrEqual(1)
    // Newest first.
    const times = d.logins.recent.map((r) => Date.parse(r.lastLoginAt))
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  it('week and month windows; an unknown period answers with today and echoes the raw value', async () => {
    const week = await daily(admin, '?period=week')
    expect(week).toMatchObject({ period: 'week', label: 'Minggu Ini' })
    expect(week.practice.totalAnswers).toBe(36)
    expect(week.hourlyHeatmap).toEqual({})
    const month = await daily(admin, '?period=month')
    expect(month).toMatchObject({ period: 'month', label: 'Bulan Ini' })
    expect(month.practice.totalAnswers).toBe(46)
    expect(month.hourlyHeatmap).toEqual({})
    const odd = await daily(admin, '?period=tahun')
    expect(odd.period).toBe('tahun')
    expect(odd.label).toBe('Hari Ini (19 Oct 2026)')
    expect(odd.practice.totalAnswers).toBe(36)
  })

  it('school admin: the school view without the schools list; ?schoolId= is ignored', async () => {
    const d = await daily(schoolAdmin, `?period=month&schoolId=${w.school2}`)
    expect(d.scope).toBe('school')
    expect(d.school?.id).toBe(w.school1)
    expect(d.schools).toBeUndefined()
    expect(d.practice.totalAnswers).toBe(40)
    expect(d.summary).toMatchObject({ totalSchools: 1, activeSchools: 1, activeStudents: 4 })
    expect(d.logins.recent.every((r) => r.schoolId === w.school1)).toBe(true)
    expect(d.liveFeed.every((r) => r.schoolId === w.school1)).toBe(true)
  })

  it('401 and 403 per role', async () => {
    expectError(await t.http().get('/api/command-center/daily-activity'), 'UNAUTHORIZED', 'Unauthenticated.')
    expectError(await getAs(teacher, '/command-center/daily-activity'), 'FORBIDDEN', 'This action is unauthorized.')
  })

  it('ETag/304 on the daily board', async () => {
    const first = await getAs(admin, '/command-center/daily-activity?period=month')
    const again = await admin.agent.get('/api/command-center/daily-activity?period=month').set('If-None-Match', first.headers.etag as string)
    expect(again.status).toBe(304)
  })
})

describe('GET /command-center/daily-activity/school/:id', () => {
  it('admin: the school drill with teachers, ranked pupils and logins', async () => {
    const res = await getAs(admin, `/command-center/daily-activity/school/${w.school1}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const d = CommandCenterSchoolDrillResponseSchema.parse(res.body).data
    expect(d.school.id).toBe(w.school1)
    expect(d.period).toBe('today')
    expect(d.teachers).toHaveLength(1)
    expect(d.teachers[0]).toMatchObject({ userId: w.teacherId, students: 3, accuracy: 76.7 })
    expect(d.teachers[0]?.lastActiveHuman).toMatch(/yang lepas$/)
    expect(d.students.map((s) => [s.name, s.answers, s.accuracy])).toEqual([
      ['Murid 1', 10, 80],
      ['Murid 3', 10, 80],
      ['Murid 2', 10, 70],
    ])
    expect(d.logins.map((l) => l.name)).toContain('Murid Log')
    expect(d.logins.every((l) => /yang lepas$/.test(l.timeAgo))).toBe(true)
  })

  it('AC2: the month window brings the loose pupil in; teachers keep their own pupils only', async () => {
    const res = await getAs(admin, `/command-center/daily-activity/school/${w.school1}?period=month`)
    const d = CommandCenterSchoolDrillResponseSchema.parse(res.body).data
    expect(d.students).toHaveLength(4)
    expect(d.students.reduce((a, s) => a + s.answers, 0)).toBe(40)
    expect(d.teachers[0]?.students).toBe(3)
    const other = CommandCenterSchoolDrillResponseSchema.parse((await getAs(admin, `/command-center/daily-activity/school/${w.school2}?period=week`)).body).data
    expect(other.students.map((s) => s.name)).toEqual(['Murid Sekolah Dua'])
    expect(other.teachers.map((x) => x.userId)).toEqual([w.teacher2Id])
    expect(other.period).toBe('week')
  })

  it('404 for an unknown or non-numeric school, 403 for the school admin and the teacher, 401 anonymous', async () => {
    expectError(await getAs(admin, '/command-center/daily-activity/school/99999999'), 'NOT_FOUND', 'Not Found.')
    expectError(await getAs(admin, '/command-center/daily-activity/school/abc'), 'NOT_FOUND', 'Not Found.')
    expectError(await getAs(schoolAdmin, `/command-center/daily-activity/school/${w.school1}`), 'FORBIDDEN', 'This action is unauthorized.')
    expectError(await getAs(teacher, `/command-center/daily-activity/school/${w.school1}`), 'FORBIDDEN', 'This action is unauthorized.')
    expectError(await t.http().get(`/api/command-center/daily-activity/school/${w.school1}`), 'UNAUTHORIZED', 'Unauthenticated.')
  })
})

describe('empty state', () => {
  it('a platform without answers answers zeros and empty lists, not errors', async () => {
    const e = await bootCommandCenterApp()
    try {
      const who = await loginRole(e, 'admin')
      const d = CommandCenterLiveDataResponseSchema.parse((await getAs(who, '/admin/command-center/live-data')).body).data
      expect(d).toMatchObject({ totalAnswered: 0, activeStudents: 0, answeredToday: 0, answeredWeek: 0, answeredLastWeek: 0, weekChange: 0, accuracy: 0 })
      expect(d.topSchools).toEqual([])
      expect(d.topStudents).toEqual([])
      expect(d.recentFeed).toEqual([])
      const day = CommandCenterDailyActivityResponseSchema.parse((await getAs(who, '/command-center/daily-activity')).body).data
      expect(day.practice).toMatchObject({ totalAnswers: 0, accuracy: 0, sessionsCompleted: 0, avgSessionSeconds: 0 })
      expect(day.subjectBreakdown).toEqual([])
      expect(Object.keys(day.hourlyHeatmap)).toHaveLength(24)
      const sa = await loginRole(e, 'school_admin')
      const sd = CommandCenterLiveDataResponseSchema.parse((await getAs(sa, '/admin/command-center/live-data')).body).data
      expect(sd.dailyTrend).toHaveLength(7)
      expect(sd.dailyTrend.every((p) => p.count === 0)).toBe(true)
    } finally {
      await e.close()
    }
  })
})
