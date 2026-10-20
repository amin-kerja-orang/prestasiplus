import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { startOfDay } from '../../src/modules/command-center/shared/windows'
import { boardWindows, guruWindows, periodWindow, startOfIsoWeek, weekdayLabelBm } from '../../src/modules/command-center/shared/windows'
import { percent, round, round1, weekChange, formatCount } from '../../src/modules/command-center/shared/math'
import { CommandCenterRepository } from '../../src/modules/command-center/shared/command-center.repository'
import { ScopeService } from '../../src/modules/command-center/shared/scope.service'
import type { Viewer } from '../../src/modules/command-center/http/viewer'
import { bootCommandCenterApp, buildWorld, createSession, type CcTestApp, type World } from './helpers'

const NOW = new Date('2026-10-19T09:00:00+08:00')
const TODAY = startOfDay(NOW)

describe('windows and math (pure)', () => {
  it('admin week is the ISO week (Monday 00:00 MYT); guru week is 7 calendar days', () => {
    const b = boardWindows(NOW)
    expect(b.week.from.toISOString()).toBe('2026-10-18T16:00:00.000Z') // Mon 19 Oct 00:00 +08
    expect(b.lastWeek.from.toISOString()).toBe('2026-10-11T16:00:00.000Z')
    expect(b.lastWeek.to).toEqual(b.week.from)
    expect(b.month.from.toISOString()).toBe('2026-09-30T16:00:00.000Z')
    const wed = new Date('2026-10-21T23:30:00+08:00')
    expect(startOfIsoWeek(wed).toISOString()).toBe('2026-10-18T16:00:00.000Z')
    const sun = new Date('2026-10-25T23:59:00+08:00')
    expect(startOfIsoWeek(sun).toISOString()).toBe('2026-10-18T16:00:00.000Z')
    const g = guruWindows(NOW)
    expect(g.week.from.toISOString()).toBe('2026-10-12T16:00:00.000Z') // todayStart - 6d
    expect(g.prevWeek.to).toEqual(g.week.from)
    expect(g.d30.from.toISOString()).toBe('2026-09-19T16:00:00.000Z')
    expect(g.prev30.to).toEqual(g.d30.from)
  })

  it('period falls back to today for unknown text', () => {
    expect(periodWindow('week', NOW).key).toBe('week')
    expect(periodWindow('month', NOW).key).toBe('month')
    expect(periodWindow('banana', NOW).key).toBe('today')
    expect(periodWindow(undefined, NOW).window.from).toEqual(TODAY)
  })

  it('weekday labels are BM', () => {
    expect(weekdayLabelBm('2026-10-19')).toBe('Isn')
    expect(weekdayLabelBm('2026-10-18')).toBe('Ahd')
  })

  it('rounding is half away from zero; percent and weekChange guard zero', () => {
    expect(round(-2.5)).toBe(-3)
    expect(round(2.5)).toBe(3)
    expect(round1(66.65)).toBe(66.7)
    expect(percent(1, 0)).toBe(0)
    expect(percent(2, 3, 1)).toBe(66.7)
    expect(weekChange(5, 0)).toBe(0)
    expect(weekChange(15, 10)).toBe(50)
    expect(formatCount(1234567)).toBe('1,234,567')
  })
})

describe('repository and scope on a seeded world (is_test never counted)', () => {
  let t: CcTestApp
  let w: World
  let repo: CommandCenterRepository
  let scope: ScopeService

  beforeAll(async () => {
    t = await bootCommandCenterApp()
    w = await buildWorld(t)
    repo = t.app.get(CommandCenterRepository)
    scope = t.app.get(ScopeService)
  })
  afterAll(async () => {
    await t.close()
  })

  it('answer tallies: platform, school, window, empty id list; the is_test pupil is excluded', async () => {
    expect(await repo.answerTally({ to: NOW })).toEqual({ answers: 46, correct: 31, students: 5 })
    expect(await repo.answerTally({ from: TODAY, to: NOW, schoolId: w.school1 })).toEqual({ answers: 30, correct: 23, students: 3 })
    expect(await repo.answerTally({ to: NOW, studentIds: [] })).toEqual({ answers: 0, correct: 0, students: 0 })
    expect(await repo.answerTally({ to: NOW, studentIds: [w.testPupil] })).toEqual({ answers: 0, correct: 0, students: 0 })
    expect(await repo.answerTally({ to: NOW, schoolId: 'abc' })).toEqual({ answers: 0, correct: 0, students: 0 })
    // `to` exclusive: the answers at 08:00 are in [.., 08:00:30) but not in [.., 08:00:00)
    expect((await repo.answerTally({ from: TODAY, to: new Date('2026-10-19T08:00:00+08:00'), exclusiveTo: true })).answers).toBe(0)
  })

  it('by user, by school, days, hours, subjects, feed, pairs', async () => {
    const byUser = await repo.answerTallyByUser({ from: TODAY, to: NOW, schoolId: w.school1 })
    expect(byUser.map((u) => u.answers)).toEqual([10, 10, 10])
    expect(byUser[0]?.schoolName).toBeTruthy()
    const bySchool = await repo.answerTallyBySchool({ to: NOW })
    expect(bySchool.map((s) => [s.schoolId, s.students, s.answers])).toEqual([
      [w.school1, 4, 40],
      [w.school2, 1, 6],
    ])
    const days = await repo.answerDays({ to: NOW, studentIds: [w.pupils[0] as string] })
    expect(days.map((d) => d.day).sort()).toEqual(['2026-10-18', '2026-10-19'])
    expect(await repo.dailyCounts({ to: NOW, schoolId: w.school1 })).toEqual([
      { day: '2026-10-13', answers: 4 },
      { day: '2026-10-18', answers: 6 },
      { day: '2026-10-19', answers: 30 },
    ])
    expect(await repo.hourlyCounts({ from: TODAY, to: NOW })).toEqual([{ hour: 8, answers: 36 }])
    const subjects = await repo.subjectTally({ to: NOW })
    expect(subjects.map((s) => [s.code, s.answers])).toEqual([['BM', 40], ['MATH', 6]])
    const feed = await repo.latestAnswers({ to: NOW }, 3)
    expect(feed).toHaveLength(3)
    expect(feed[0]?.answeredAt.getTime()).toBeGreaterThanOrEqual(feed[2]?.answeredAt.getTime() ?? 0)
    expect((await repo.pairTally({ from: TODAY, to: NOW, studentIds: w.pupils })).length).toBe(3)
  })

  it('inactive students leave the default population; includeInactive brings them back', async () => {
    await t.db.query(`update users set is_active = false where id = $1::bigint`, [w.loosePupil])
    expect((await repo.answerTally({ to: NOW })).students).toBe(4)
    expect((await repo.answerTally({ to: NOW, includeInactive: true })).students).toBe(5)
    await t.db.query(`update users set is_active = true where id = $1::bigint`, [w.loosePupil])
  })

  it('sessions: completed, non-test, any owner', async () => {
    const id = await createSession(t.db, { userId: w.pupils[0] as string, completedAt: '2026-10-19T08:30:00+08:00', subjectCode: 'MATH', questionCount: 5, correctCount: 4, timeSpentSec: 125 })
    await createSession(t.db, { userId: w.pupils[0] as string, completedAt: '2026-10-19T08:31:00+08:00', isTest: true })
    await createSession(t.db, { userId: w.pupils[0] as string, completedAt: '2026-10-19T08:32:00+08:00', status: 'in_progress' })
    const list = await repo.completedSessions({ userId: w.pupils[0] as string, newestFirst: true })
    expect(list.map((s) => s.id)).toContain(id)
    expect(list).toHaveLength(2)
    expect(list[0]?.id).toBe(id)
    expect((await repo.completedSessions({ userId: w.pupils[0] as string, subjectCode: 'MATH' })).map((s) => s.subjectName).length).toBe(1)
    expect(await repo.completedSession(id)).toMatchObject({ id, questionCount: 5, correctCount: 4, timeSpentSec: 125, subjectCode: 'MATH' })
    expect(await repo.completedSession('not-a-uuid')).toBeNull()
    expect(await repo.completedSession('00000000-0000-4000-8000-000000000000')).toBeNull()
    expect(await repo.sessionQuestions(id)).toEqual([])
    expect(await repo.sessionAnswers(id)).toEqual([])
    expect(await repo.sessionTally({ from: TODAY, to: NOW, schoolId: w.school1 })).toMatchObject({ completed: 2 })
  })

  it('people, schools, logins', async () => {
    expect(await repo.userBrief(w.pupils[0] as string)).toMatchObject({ roles: ['student'], schoolId: w.school1, isActive: true })
    expect(await repo.userBrief('x')).toBeNull()
    expect((await repo.schoolRef(w.school1))?.name).toBeTruthy()
    expect(await repo.schoolRef('999999')).toBeNull()
    const expected = Number((await t.db.query<{ c: string }>(`select count(*)::int c from users u where u.school_id = $1::bigint and u.is_active and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student')`, [w.school1]))[0]?.c)
    expect(await repo.studentCount({ schoolId: w.school1 })).toBe(expected)
    expect((await repo.studentsOfSchool(w.school1)).length).toBe(expected)
    expect((await repo.teachersOfSchool(w.school1)).map((x) => x.id)).toContain(w.teacherId)
    expect(await repo.subscribedSchoolCount(NOW)).toBeGreaterThanOrEqual(0)
    expect(await repo.schoolsWithStudents()).toBeGreaterThanOrEqual(2)
    await t.db.query(`update users set last_login_at = $2::timestamptz where id = $1::bigint`, [w.pupils[0], '2026-10-19T08:45:00+08:00'])
    const win = { from: TODAY, to: NOW }
    expect(await repo.loginCountsByRole(win)).toEqual([{ role: 'student', count: 1 }])
    expect(await repo.loginUserCount(win, w.school1)).toBe(1)
    expect(await repo.loginUserCount(win, w.school2)).toBe(0)
    const recent = await repo.recentLogins(win, 10)
    expect(recent[0]).toMatchObject({ userId: w.pupils[0], roles: ['student'], isComplimentary: false })
    expect((await repo.schoolLogins(w.school1, win)).length).toBe(1)
  })

  it('classes and enrolments: is_test enrolments are not members; inactive class is not a classroom to open', async () => {
    expect((await repo.classById(w.class1))?.effectiveSchoolId).toBe(w.school1)
    expect((await repo.classById(w.class1))?.educationGrade).toBe(10)
    expect((await repo.classesOfOwner(w.teacherId)).map((c) => c.id)).toEqual([w.class1, w.classInactive])
    expect((await repo.classesOfOwner(w.teacherId, { activeClassroomsOnly: true })).map((c) => c.id)).toEqual([w.class1])
    expect((await repo.classesOfSchool(w.school1, { activeClassroomsOnly: true })).map((c) => c.id)).toEqual([w.class1])
    expect(await repo.teacherSchoolIds(w.teacherId)).toEqual([w.school1])
    const members = await repo.classMembers([w.class1])
    expect(members.map((m) => m.studentId).sort()).toEqual([...w.pupils].sort())
    expect((await repo.classesOfStudent(w.pupils[0] as string)).map((c) => c.id)).toEqual([w.class1])
    expect(await repo.classesOfStudent(w.testPupil)).toEqual([])
    expect((await repo.teacherStudentIds(w.teacherId)).sort()).toEqual([...w.pupils].sort())
    expect(await repo.isTeacherStudent(w.teacherId, w.pupils[0] as string)).toBe(true)
    expect(await repo.isTeacherStudent(w.teacherId, w.testPupil)).toBe(false)
    expect(await repo.isTeacherStudent(w.teacherId, w.otherPupil)).toBe(false)
    expect((await repo.activeTeacherCounts([...w.pupils, w.otherPupil])).get(w.school1)).toBe(1)
  })

  const viewer = (role: Viewer['role'], userId: string, schoolId: string | null = null): Viewer => ({ role, userId, schoolId, isAdmin: role === 'admin' })

  it('scope: teacher opens own school/class/pupils only; every miss is 404 "Not Found."', async () => {
    const s = await scope.scopeOf(viewer('teacher', w.teacherId))
    expect(s.ownedClassIds).toEqual([w.class1])
    expect(s.ownedSchoolIds).toEqual([w.school1])
    await expect(scope.assertSchoolInScope(s, w.school1)).resolves.toMatchObject({ id: w.school1 })
    const misses = [
      () => scope.assertSchoolInScope(s, w.school2),
      () => scope.assertClassInScope(s, w.class2),
      () => scope.assertClassInScope(s, w.classInactive),
      () => scope.assertStudentInScope(s, w.otherPupil),
      () => scope.assertStudentInScope(s, w.loosePupil),
      () => scope.assertStudentInScope(s, w.testPupil),
      () => scope.assertTeacherInScope(s, w.school1, w.teacher2Id),
    ]
    for (const miss of misses) {
      await expect(miss()).rejects.toMatchObject({ status: 404 })
    }
    await expect(scope.assertClassInScope(s, w.class1)).resolves.toMatchObject({ id: w.class1 })
    await expect(scope.assertStudentInScope(s, w.pupils[0] as string)).resolves.toMatchObject({ id: w.pupils[0] })
    await expect(scope.assertTeacherInScope(s, w.school1, w.teacherId)).resolves.toMatchObject({ school: { id: w.school1 } })
  })

  it('scope: school admin is fixed to the session school (pupils active or not); admin opens everything that exists', async () => {
    const sa = await scope.scopeOf(viewer('school_admin', w.schoolAdminId, w.school1))
    await expect(scope.assertClassInScope(sa, w.class1)).resolves.toBeTruthy()
    await expect(scope.assertClassInScope(sa, w.class2)).rejects.toMatchObject({ status: 404 })
    await expect(scope.assertSchoolInScope(sa, w.school2)).rejects.toMatchObject({ status: 404 })
    await expect(scope.assertStudentInScope(sa, w.loosePupil)).resolves.toBeTruthy()
    await expect(scope.assertStudentInScope(sa, w.otherPupil)).rejects.toMatchObject({ status: 404 })
    await expect(scope.assertTeacherInScope(sa, w.school1, w.teacherId)).resolves.toBeTruthy()
    await expect(scope.assertTeacherInScope(sa, w.school2, w.teacher2Id)).rejects.toMatchObject({ status: 404 })
    const admin = await scope.scopeOf(viewer('admin', w.adminId))
    await expect(scope.assertSchoolInScope(admin, w.school2)).resolves.toBeTruthy()
    await expect(scope.assertStudentInScope(admin, w.otherPupil)).resolves.toBeTruthy()
    await expect(scope.assertSchoolInScope(admin, '999999')).rejects.toMatchObject({ status: 404 })
    await expect(scope.assertStudentInScope(admin, w.teacherId)).rejects.toMatchObject({ status: 404 })
    await expect(scope.assertTeacherInScope(admin, w.school1, w.teacher2Id)).rejects.toMatchObject({ status: 404 })
  })
})
