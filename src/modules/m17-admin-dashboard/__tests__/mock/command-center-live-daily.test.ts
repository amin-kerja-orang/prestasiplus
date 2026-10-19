/**
 * M17-T1b: SRS M17 v1.13 §7 #4 and #5, the daily-activity board S3 and its school drill (guards AS and
 * admin-only; FR-M17-34…47, FR-M17-116, BR-M17-11, BR-M17-12, BR-M17-24, BR-M17-34).
 *
 * Covered: the 401 / 403 / 404 rules (#5 is admin only: a school admin gets 403, also for the own school),
 * the observed figures that the owners reproduce (today 340 / 264 / 77.6% / 4 pupils / 3 schools / 17 sessions,
 * week 2,508, month 20,206, missions 3 / 8), every computed figure against an independent read of the owners,
 * the unknown-period echo, the school-admin forcing (every card for the school, `schools` omitted, no
 * platform constant) and the school drill (teachers, pupils, logins, empty state).
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_ISO, formatMyt, dayRange, monthRange, weekRange } from '@/lib/time'
import type { MockRuntime } from '@/mock/index'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { isFixtureSchoolId } from '@/modules/m02-users-schools/mock'
import { practice, practiceAnswers } from '@/modules/m05-practice/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'
import { achievements, learnerBadges } from '@/modules/m14-gamification/mock'

import type { CcDailyActivity, CcPeriod, CcSchoolDrill } from '../../api/command-center-board-types'
import { packageChip } from '../../mock/handlers/command-center-live-reads'
import {
  ADMIN,
  GURU,
  IBU_BAPA,
  PELAJAR,
  PPD,
  bootBoard,
  call,
  data,
  type ErrorBody,
} from './command-center-live-helpers'

const NOW = Date.parse(CLOCK_ANCHOR_ISO)
/** Answers per MYT hour today (SRS §6.7 B: 9:00 20, 13:00 160, 14:00 160; every other hour 0). */
const PINNED_HEAT: Record<string, number> = Object.fromEntries(
  Array.from({ length: 24 }, (_, h) => [String(h), h === 9 ? 20 : h === 13 || h === 14 ? 160 : 0]),
)
const DAILY = '/api/command-center/daily-activity'
const SA_8078 = 1214
const SA_8090 = 4521
const SA_FIXTURE = 8

let runtime: MockRuntime
const admin = {} as Record<CcPeriod, CcDailyActivity>

beforeAll(async () => {
  ;({ runtime } = await bootBoard())
  for (const p of ['today', 'week', 'month'] as const) {
    admin[p] = await data<CcDailyActivity>(runtime, ADMIN, `${DAILY}?period=${p}`)
  }
}, 600_000)

const status = async (as: number | null, url: string) => (await call(runtime, as, url)).status

const numeric = (m: Map<unknown, number>): Map<number, number> =>
  new Map([...m].filter((e): e is [number, number] => typeof e[0] === 'number'))

const pupilsOf = (schoolId: number): number[] =>
  users
    .adminList({ role: 'student', schoolId, page: 1, pageSize: 100_000 })
    .rows.filter((u) => u.isActive)
    .map((u) => u.id)

const windowStart = (p: CcPeriod): number =>
  p === 'today' ? dayRange(NOW).start : p === 'week' ? weekRange(NOW).start : monthRange(NOW).start

/** Users (every role) of the platform or one school with `lastLoginAt` in the window, newest first. */
function loginsOf(p: CcPeriod, schoolId: number | null): UserRow[] {
  const from = windowStart(p)
  return users
    .adminList({ page: 1, pageSize: 100_000 })
    .rows.filter((u) => {
      if (u.lastLoginAt === null) return false
      const ms = Date.parse(u.lastLoginAt)
      if (ms < from || ms > NOW) return false
      return schoolId === null
        ? u.schoolId === null || !isFixtureSchoolId(u.schoolId)
        : u.schoolId === schoolId
    })
    .sort(
      (a, b) => Date.parse(b.lastLoginAt ?? '') - Date.parse(a.lastLoginAt ?? '') || a.id - b.id,
    )
}

describe('guards (§7 #4 AS, #5 admin only)', () => {
  it('answers 401 UNAUTHORIZED to a guest on #4 and #5', async () => {
    for (const url of [`${DAILY}?period=today`, `${DAILY}/school/8106?period=today`]) {
      const r = await call<ErrorBody>(runtime, null, url)
      expect(r.status, url).toBe(401)
      expect(r.body.error.code).toBe('UNAUTHORIZED')
    }
  })

  it('answers 403 to a teacher, a pupil, a parent and a PPD officer on #4 and #5', async () => {
    for (const as of [GURU, PELAJAR, IBU_BAPA, PPD]) {
      for (const url of [`${DAILY}?period=today`, `${DAILY}/school/8106?period=today`]) {
        const r = await call<ErrorBody>(runtime, as, url)
        expect(r.status, `${String(as)} ${url}`).toBe(403)
        expect(r.body.error.code).toBe('FORBIDDEN')
      }
    }
  })

  it('#5 refuses a school admin with 403, also for the own school; #4 admits it', async () => {
    expect(await status(SA_8078, `${DAILY}/school/8078?period=today`)).toBe(403)
    expect(await status(SA_8078, `${DAILY}/school/8106?period=today`)).toBe(403)
    expect(await status(SA_8078, `${DAILY}?period=today`)).toBe(200)
  })

  it('#4 refuses a school admin without a school with 403, never platform figures', async () => {
    const original = users.get(SA_8090)?.schoolId ?? null
    users.update(SA_8090, { schoolId: null }, NOW)
    try {
      const r = await call<ErrorBody>(runtime, SA_8090, `${DAILY}?period=week`)
      expect(r.status).toBe(403)
      expect(JSON.stringify(r.body)).not.toContain('totalAnswers')
    } finally {
      users.update(SA_8090, { schoolId: original }, NOW)
    }
  })

  it('#5 answers 404 for an unknown school and for a non-numeric id', async () => {
    const r = await call<ErrorBody>(runtime, ADMIN, `${DAILY}/school/99999999?period=today`)
    expect(r.status).toBe(404)
    expect(r.body.error.code).toBe('NOT_FOUND')
    expect(await status(ADMIN, `${DAILY}/school/abc?period=today`)).toBe(404)
  })
})

describe('platform view: the observed figures the owners reproduce', () => {
  it('labels (FN-M17-4.1.2): "Hari Ini (25 Sep 2026)", "Minggu Ini", "Bulan Ini"', () => {
    expect(admin.today.label).toBe('Hari Ini (25 Sep 2026)')
    expect(admin.week.label).toBe('Minggu Ini')
    expect(admin.month.label).toBe('Bulan Ini')
    expect(admin.today.scope).toBe('platform')
    expect(admin.today.school).toBeNull()
  })

  it('answers card: today 340 · 264 correct · 77.6% · 4 pupils (FR-M17-39)', () => {
    expect(admin.today.practice).toMatchObject({
      totalAnswers: 340,
      correctAnswers: 264,
      accuracy: 77.6,
      activeStudents: 4,
    })
    expect(admin.today.summary).toMatchObject({
      activeSchools: 3,
      totalSchools: 57,
      activeStudents: 4,
      totalStudents: 3152,
    })
  })

  it('answers card: week 2,508 · 2,122 · 84.6% · 32 pupils; month 20,206 · 17,667 · 87.4% · 86 pupils', () => {
    expect(admin.week.practice).toMatchObject({
      totalAnswers: 2508,
      correctAnswers: 2122,
      accuracy: 84.6,
      activeStudents: 32,
    })
    expect(admin.month.practice).toMatchObject({
      totalAnswers: 20_206,
      correctAnswers: 17_667,
      accuracy: 87.4,
      activeStudents: 86,
    })
  })

  it('sessions card (FR-M17-40): 17/17, 152/152, 1,250/1,250 and missions 0 / 3 / 8', () => {
    expect([admin.today, admin.week, admin.month].map((d) => d.practice.sessionsStarted)).toEqual([
      17, 152, 1250,
    ])
    expect([admin.today, admin.week, admin.month].map((d) => d.practice.sessionsCompleted)).toEqual(
      [17, 152, 1250],
    )
    expect(
      [admin.today, admin.week, admin.month].map((d) => d.engagement.missionsCompleted),
    ).toEqual([0, 3, 8])
  })

  it('mean session time is the floor of the mean `timeSpent` in seconds', () => {
    for (const p of ['today', 'week', 'month'] as const) {
      const sessions = practice.query('Q-SESS-P', {}, p)
      const n = sessions.total
      let seconds = 0
      for (const s of sessions.rows) seconds += s.timeSpent
      expect(n, p).toBe(admin[p].practice.sessionsCompleted)
      expect(admin[p].practice.avgSessionSeconds, p).toBe(Math.floor(seconds / n))
      // Observed 2m 48s / 2m 48s / 1m 54s (means 168.3 / 168.8 / 114.4 s, floored).
      expect(admin[p].practice.avgSessionSeconds, p).toBe(p === 'month' ? 114 : 168)
    }
  })

  it('"Top Pelajar" (FR-M17-46): today 160 · 80 · 80 · 20; week the observed five; month the observed five', () => {
    const rows = (p: CcPeriod) => admin[p].topStudents.map((s) => [s.userId, s.answers, s.accuracy])
    expect(rows('today')).toEqual([
      [2016, 160, 73.8],
      [2018, 80, 78.8],
      [2019, 80, 78.8],
      [2022, 20, 100],
    ])
    expect(rows('week')).toEqual([
      [2022, 452, 99.6],
      [2013, 330, 99.7],
      [2014, 234, 62],
      [2015, 200, 93.5],
      [2016, 160, 73.8],
    ])
    expect(rows('month')).toEqual([
      [2020, 3637, 92.6],
      [2013, 2893, 99.2],
      [2017, 1701, 90.2],
      [2022, 1618, 98.1],
      [2023, 1179, 87.9],
    ])
  })

  it('"Sekolah" today (FR-M17-41): 8106 (2 pupils, 160, 78.8%), 8082 (1, 160, 73.8%), 8080 (1, 20, 100%), then login-only rows', () => {
    const rows = admin.today.schools ?? []
    expect(
      rows.slice(0, 3).map((r) => [r.schoolId, r.activeStudents, r.totalAnswers, r.accuracy]),
    ).toEqual([
      [8106, 2, 160, 78.8],
      [8082, 1, 160, 73.8],
      [8080, 1, 20, 100],
    ])
    for (const r of rows.slice(3)) {
      expect(r.totalAnswers).toBe(0)
      expect(r.accuracy).toBeNull()
      expect(r.loginCount).toBeGreaterThan(0)
    }
    expect(rows.slice(3).map((r) => r.schoolId)).toEqual(
      rows
        .slice(3)
        .map((r) => r.schoolId)
        .sort((a, b) => a - b),
    )
  })
})

describe('platform view: figures against an independent read', () => {
  it('active schools are the distinct schools of the answering pupils (Q-M17-SCH-ACTIVE)', () => {
    for (const p of ['today', 'week', 'month'] as const) {
      const schools = new Set<number>()
      for (const id of numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId', p)).keys()) {
        const s = users.get(id)?.schoolId
        if (s != null) schools.add(s)
      }
      expect(admin[p].summary.activeSchools, p).toBe(schools.size)
      if (p !== 'today') {
        // Observed 7 and 7: 8106, 8082, 8078, 8080, 8090, 8088, 8284.
        expect(
          [...schools].sort((a, b) => a - b),
          p,
        ).toEqual([8078, 8080, 8082, 8088, 8090, 8106, 8284])
      }
    }
  })

  it('"Sekolah" lists every school with an answer or a login, answered ones first by pupils (BR-M17-11)', () => {
    for (const p of ['week', 'month'] as const) {
      const rows = admin[p].schools ?? []
      const answered = new Map<number, { pupils: number; answers: number }>()
      for (const [id, n] of numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId', p))) {
        const s = users.get(id)?.schoolId
        if (s == null) continue
        const a = answered.get(s) ?? { pupils: 0, answers: 0 }
        a.pupils++
        a.answers += n
        answered.set(s, a)
      }
      const loggedIn = new Set(
        loginsOf(p, null)
          .map((u) => u.schoolId)
          .filter((s): s is number => s !== null),
      )
      expect(new Set(rows.map((r) => r.schoolId)), p).toEqual(
        new Set([...answered.keys(), ...loggedIn]),
      )
      for (const r of rows) {
        const a = answered.get(r.schoolId)
        expect(r.activeStudents, `${p} ${String(r.schoolId)}`).toBe(a?.pupils ?? 0)
        expect(r.totalAnswers, `${p} ${String(r.schoolId)}`).toBe(a?.answers ?? 0)
      }
      const answeredRows = rows.filter((r) => r.totalAnswers > 0)
      for (let i = 1; i < answeredRows.length; i++) {
        const a = answeredRows[i - 1]
        const b = answeredRows[i]
        expect(a !== undefined && b !== undefined && a.activeStudents >= b.activeStudents).toBe(
          true,
        )
      }
      // Answered rows come before login-only rows.
      const firstLoginOnly = rows.findIndex((r) => r.totalAnswers === 0)
      if (firstLoginOnly >= 0) {
        expect(rows.slice(firstLoginOnly).every((r) => r.totalAnswers === 0)).toBe(true)
      }
    }
  })

  // Owner gap M10 §6.2.1: the designed GURU enrolments (SRS 2 / 61 / 18 …) are not in M10's data; read independently.
  it('"{n} GURU" = distinct teachers owning a class with an active enrolment of an answering pupil (BR-M17-11)', () => {
    const rows = admin.week.schools ?? []
    const bySchool = new Map<number, Set<number>>()
    for (const id of numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId', 'week')).keys()) {
      const s = users.get(id)?.schoolId
      if (s == null) continue
      for (const e of classrooms.enrolmentsOf(id)) {
        if (e.status !== 'active' || e.classroomKind !== 'classroom') continue
        const owner = classrooms.get('classroom', e.classroomId)?.teacherId
        if (owner == null) continue
        const set = bySchool.get(s) ?? new Set<number>()
        set.add(owner)
        bySchool.set(s, set)
      }
    }
    for (const r of rows) {
      expect(r.activeTeachers, String(r.schoolId)).toBe(bySchool.get(r.schoolId)?.size ?? 0)
    }
  })

  // Owner gap M01/M02 XR-M17-07: SRS logins 13 / 31 / 95; the users store holds far fewer. Read independently.
  it('"Login" card (FR-M17-38): total, role line in the fixed order, the 10 latest with package chips', () => {
    for (const p of ['today', 'week', 'month'] as const) {
      const expected = loginsOf(p, null)
      const d = admin[p]
      expect(d.logins.total, p).toBe(expected.length)
      expect(d.summary.totalLogins, p).toBe(expected.length)
      const counts = new Map<string, number>()
      for (const u of expected) counts.set(u.role, (counts.get(u.role) ?? 0) + 1)
      expect(Object.fromEntries(Object.entries(d.logins.byRole)), p).toEqual(
        Object.fromEntries(counts),
      )
      // Order: student, teacher, parent, admin, school_admin, then the others A→Z.
      const order = ['student', 'teacher', 'parent', 'admin', 'school_admin']
      const keys = Object.keys(d.logins.byRole)
      const known = keys.filter((k) => order.includes(k))
      expect(known).toEqual(order.filter((k) => known.includes(k)))
      const others = keys.filter((k) => !order.includes(k))
      expect(others).toEqual([...others].sort())
      expect(keys.slice(0, known.length)).toEqual(known)
      expect(
        d.logins.recent.map((r) => r.userId),
        p,
      ).toEqual(expected.slice(0, 10).map((u) => u.id))
    }
  })

  it('login rows carry the school name, "Pelajar Luar" is a null school, and relative times follow BR-M17-20', () => {
    const rows = admin.month.logins.recent
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.timeAgo).toMatch(/^\d+ (saat|minit|jam|hari|minggu|bulan|tahun) yang lepas$/)
      const u = users.get(r.userId)
      expect(r.lastLoginAt).toBe(u?.lastLoginAt)
      expect(r.schoolId).toBe(u?.schoolId ?? null)
    }
    expect(rows.some((r) => r.role === 'student' && r.schoolName === null)).toBe(true)
  })

  // Heatmap: SRS §6.7 B, 9:00 20 / 13:00 160 / 14:00 160. The hours are checked against formatMyt (MYT, not UTC).
  it('heatmap buckets are the MYT hours of the answers (SRS §6.7 B)', () => {
    const heat = admin.today.hourlyHeatmap
    const byHour: Record<string, number> = {}
    for (const id of numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId', 'today')).keys()) {
      for (const a of practice.answers(id)) {
        if (a.answeredAtMs < windowStart('today') || a.answeredAtMs > NOW) continue
        const h = String(Number(formatMyt(a.answeredAtMs, 'HH')))
        byHour[h] = (byHour[h] ?? 0) + 1
      }
    }
    for (let h = 0; h < 24; h++) expect(heat[String(h)], String(h)).toBe(byHour[String(h)] ?? 0)
    expect(heat).toEqual(PINNED_HEAT)
  })

  it('subject bars sum to the answers of the period, most answers first; heatmap only today (FR-M17-43, 44)', () => {
    for (const p of ['today', 'week', 'month'] as const) {
      const d = admin[p]
      expect(
        d.subjectBreakdown.reduce((n, s) => n + s.answers, 0),
        p,
      ).toBe(d.practice.totalAnswers)
      for (let i = 1; i < d.subjectBreakdown.length; i++) {
        expect((d.subjectBreakdown[i - 1] as { answers: number }).answers).toBeGreaterThanOrEqual(
          (d.subjectBreakdown[i] as { answers: number }).answers,
        )
      }
    }
    const heat = admin.today.hourlyHeatmap
    expect(Object.keys(heat)).toHaveLength(24)
    expect(Object.values(heat).reduce((a, b) => a + b, 0)).toBe(340)
    expect(admin.week.hourlyHeatmap).toEqual({})
    expect(admin.month.hourlyHeatmap).toEqual({})
  })

  it('short subject names follow BR-M17-26 and name the rest by their M03 name', () => {
    const names = new Map(admin.month.subjectBreakdown.map((s) => [s.code, s.shortName]))
    expect(names.get('MATH')).toBe('Matematik')
    expect(names.get('BM')).toBe('BM')
    expect(names.get('BI')).toBe('BI')
    expect(names.get('SCI')).toBe('Sains')
    expect(names.get('PI')).toBe('P.Islam')
    expect(names.get('SEJ')).toBe('Sejarah')
    expect(names.get('GEO')).toBe('Geo')
    expect(names.get('PM')).toBe('Moral')
    expect(names.get('BIO')).toBe('Biologi')
  })

  it('"Live Feed" (FR-M17-43): at most 10 answers of the period, newest first', () => {
    for (const p of ['today', 'week', 'month'] as const) {
      const feed = admin[p].liveFeed
      expect(feed).toHaveLength(10)
      for (const row of feed) {
        expect(row.time).toMatch(/^\d{2}:\d{2}$/)
        expect(users.get(row.studentId)?.name).toBe(row.student)
      }
      const times = feed.map((r) => r.time)
      if (p === 'today') expect([...times].sort().reverse()).toEqual(times)
      // SRS §6.7 B: the last 10 answers of pupil 2016's 8082 session ending 14:59.
      if (p === 'today') {
        expect(feed.every((r) => r.studentId === 2016 && r.schoolId === 8082)).toBe(true)
        expect(feed[0]?.time).toBe('14:59')
      }
    }
  })

  it('engagement card: mood, badges and question sets equal the owners (FR-M17-40, 47)', () => {
    const pupils = users
      .adminList({ role: 'student', isActive: true, page: 1, pageSize: 100_000 })
      .rows.filter((u) => u.schoolId === null || !isFixtureSchoolId(u.schoolId))
    const catalogue = new Set(achievements.catalogue().map((a) => a.id))
    for (const p of ['today', 'week', 'month'] as const) {
      const from = windowStart(p)
      let badges = 0
      for (const u of pupils) {
        badges += learnerBadges
          .forUser(u.id)
          .filter((b) => Date.parse(b.awardedAt) >= from && Date.parse(b.awardedAt) <= NOW).length
        badges += achievements
          .query('Q-ACH-UNLOCKED', {}, u.id)
          .rows.filter(
            (a) =>
              catalogue.has(a.achievementId) &&
              Date.parse(a.unlockedAt) >= from &&
              Date.parse(a.unlockedAt) <= NOW,
          ).length
      }
      const d = admin[p].engagement
      expect(d.badgesEarned, p).toBe(badges)
      expect(d.moodCheckins, p).toBe(
        d.moodDist.happy + d.moodDist.okay + d.moodDist.sad + d.moodDist.stressed,
      )
      expect(d.moodCheckins, p).toBe(0) // no check-in exists in September (SRS §6.4)
      expect(d.quizSetsCreated, p).toBe(0)
    }
  })
})

describe('package chip (BR-M17-24)', () => {
  const base = {
    role: 'student',
    subscriptionPackage: 'none',
    hasPkskSubscription: false,
    isComplimentary: false,
    schoolId: 1,
  } as unknown as UserRow
  const chip = (patch: Partial<UserRow>, subscribed: number[] = []) =>
    packageChip({ ...base, ...patch }, new Set(subscribed))

  it('applies the precedence admin, parent, AKTIF, PKSK, SEKOLAH, BEBAS, FREE', () => {
    expect(chip({ role: 'admin', subscriptionPackage: 'personal' })).toBe('ADMIN')
    expect(chip({ role: 'parent', subscriptionPackage: 'personal' })).toBe('PARENT')
    expect(chip({ subscriptionPackage: 'personal', hasPkskSubscription: true })).toBe('AKTIF')
    expect(chip({ hasPkskSubscription: true }, [1])).toBe('PKSK')
    expect(chip({ isComplimentary: true }, [1])).toBe('SEKOLAH')
    expect(chip({ isComplimentary: true })).toBe('BEBAS')
    expect(chip({})).toBe('FREE')
    expect(chip({ schoolId: null }, [1])).toBe('FREE')
  })
})

describe('unknown period (FR-M17-35)', () => {
  it("answers with today's figures and echoes the value", async () => {
    const bogus = await data<CcDailyActivity>(runtime, ADMIN, `${DAILY}?period=bogus`)
    expect(bogus.period).toBe('bogus')
    expect({ ...bogus, period: 'today' }).toEqual(admin.today)
    const none = await data<CcDailyActivity>(runtime, ADMIN, DAILY)
    expect(none.period).toBe('today')
    expect(none).toEqual(admin.today)
  })
})

describe('school admin view (FR-M17-116, BR-M17-34)', () => {
  const FOREIGN = [
    'ENGKU HUSAIN',
    'KHIR JOHARI',
    'PANDAN INDAH',
    'BANDAR RINCHING',
    'Murid Demo 2022',
  ]
  const sa = {} as Record<CcPeriod, CcDailyActivity>

  beforeAll(async () => {
    for (const p of ['today', 'week', 'month'] as const) {
      sa[p] = await data<CcDailyActivity>(runtime, SA_8078, `${DAILY}?period=${p}`)
    }
  }, 120_000)

  it('keeps the shape except the school list, which is omitted', () => {
    for (const p of ['today', 'week', 'month'] as const) {
      expect(sa[p].scope).toBe('school')
      expect(sa[p].school).toEqual({
        id: 8078,
        name: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR BARU BANGI',
      })
      expect('schools' in sa[p]).toBe(false)
      const keys = Object.keys(admin[p]).filter((k) => k !== 'schools')
      expect(Object.keys(sa[p]).sort()).toEqual(keys.sort())
    }
  })

  it('"Sekolah Aktif" is "{0|1} daripada 1" and the pupil total is the school\'s', () => {
    expect(sa.today.summary.totalSchools).toBe(1)
    expect(sa.today.summary.activeSchools).toBe(0) // no 8078 answer today
    expect(sa.week.summary.activeSchools).toBe(1)
    expect(sa.month.summary.activeSchools).toBe(1)
    expect(sa.week.summary.totalStudents).toBe(pupilsOf(8078).length)
  })

  it("every card is the school's own: answers, pupils, accuracy, rankings", () => {
    const ids = new Set(pupilsOf(8078))
    for (const p of ['week', 'month'] as const) {
      const by = numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId', p))
      const correct = numeric(practiceAnswers.groupCount('Q-ANS-P-CORRECT', 'userId', p))
      let answers = 0
      let right = 0
      let pupils = 0
      for (const [id, n] of by) {
        if (!ids.has(id)) continue
        answers += n
        right += correct.get(id) ?? 0
        pupils++
      }
      expect(sa[p].practice.totalAnswers, p).toBe(answers)
      expect(sa[p].practice.correctAnswers, p).toBe(right)
      expect(sa[p].practice.activeStudents, p).toBe(pupils)
      expect(sa[p].practice.accuracy, p).toBe(Math.round((right / answers) * 1000) / 10)
      expect(sa[p].practice.totalAnswers).toBeLessThan(admin[p].practice.totalAnswers)
      for (const s of sa[p].topStudents) {
        expect(ids.has(s.userId)).toBe(true)
        expect(s.schoolId).toBe(8078)
      }
      for (const f of sa[p].liveFeed) expect(f.schoolId).toBe(8078)
      expect(sa[p].subjectBreakdown.reduce((n, s) => n + s.answers, 0)).toBe(answers)
    }
  })

  it("logins are the school's users only, of every role (the server's placeholder is not adopted)", () => {
    for (const p of ['week', 'month'] as const) {
      const expected = loginsOf(p, 8078)
      expect(sa[p].logins.total, p).toBe(expected.length)
      expect(
        sa[p].logins.recent.map((r) => r.userId),
        p,
      ).toEqual(expected.slice(0, 10).map((u) => u.id))
      for (const r of sa[p].logins.recent) expect(r.schoolId).toBe(8078)
    }
    expect(sa.month.logins.total).toBeGreaterThan(0)
  })

  it('shows no other school and no platform constant', () => {
    for (const p of ['today', 'week', 'month'] as const) {
      const text = JSON.stringify(sa[p])
      for (const name of FOREIGN) expect(text, `${p} ${name}`).not.toContain(name)
    }
  })

  it("the heatmap is the school's hours of today only", () => {
    expect(Object.keys(sa.today.hourlyHeatmap)).toHaveLength(24)
    expect(Object.values(sa.today.hourlyHeatmap).reduce((a, b) => a + b, 0)).toBe(
      sa.today.practice.totalAnswers,
    )
    expect(sa.week.hourlyHeatmap).toEqual({})
  })

  it("the fixture school is shown to its own admin from its pupils' answers", async () => {
    const d = await data<CcDailyActivity>(runtime, SA_FIXTURE, `${DAILY}?period=week`)
    const from = windowStart('week')
    let answers = 0
    for (const id of pupilsOf(900001)) {
      answers += practice
        .answers(id)
        .filter((a) => a.answeredAtMs >= from && a.answeredAtMs <= NOW).length
    }
    expect(d.practice.totalAnswers).toBe(answers)
    expect(d.school?.id).toBe(900001)
    expect(d.summary.totalSchools).toBe(1)
    expect('schools' in d).toBe(false)
    for (const f of d.liveFeed) expect(f.schoolId).toBe(900001)
  })

  it('a school without activity answers zeros and empty lists, not an error', async () => {
    const answering = new Set(
      [...numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId')).keys()].map(
        (id) => users.get(id)?.schoolId,
      ),
    )
    const quiet = users
      .adminList({ role: 'school_admin', page: 1, pageSize: 1000 })
      .rows.filter(
        (u) => u.schoolId !== null && !isFixtureSchoolId(u.schoolId) && !answering.has(u.schoolId),
      )
      .sort((a, b) => a.id - b.id)[0]
    expect(quiet).toBeDefined()
    const d = await data<CcDailyActivity>(runtime, quiet?.id ?? 0, `${DAILY}?period=month`)
    expect(d.practice).toMatchObject({ totalAnswers: 0, activeStudents: 0, accuracy: 0 })
    expect(d.summary.activeSchools).toBe(0)
    expect(d.topStudents).toEqual([])
    expect(d.subjectBreakdown).toEqual([])
    expect(d.liveFeed).toEqual([])
  })
})

describe('#5 school drill (FR-M17-42, BR-M17-12)', () => {
  let drill: CcSchoolDrill

  beforeAll(async () => {
    drill = await data<CcSchoolDrill>(runtime, ADMIN, `${DAILY}/school/8106?period=month`)
  }, 120_000)

  it('echoes the period and names the school', () => {
    expect(drill.school).toEqual({ id: 8106, name: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR RINCHING' })
    expect(drill.period).toBe('month')
  })

  it('"Pelajar": the answering pupils of the school, answers desc, with accuracy and last answer', () => {
    const ids = new Set(pupilsOf(8106))
    const by = numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId', 'month'))
    const correct = numeric(practiceAnswers.groupCount('Q-ANS-P-CORRECT', 'userId', 'month'))
    const expected = [...by].filter(([id]) => ids.has(id))
    expect(drill.students).toHaveLength(expected.length)
    expect(drill.students.length).toBeGreaterThan(0)
    for (const s of drill.students) {
      expect(s.answers).toBe(by.get(s.userId))
      expect(s.accuracy).toBe(
        Math.round(((correct.get(s.userId) ?? 0) / (by.get(s.userId) as number)) * 1000) / 10,
      )
      expect(s.lastActiveHuman).toMatch(/yang lepas$/)
    }
    for (let i = 1; i < drill.students.length; i++) {
      expect((drill.students[i - 1] as { answers: number }).answers).toBeGreaterThanOrEqual(
        (drill.students[i] as { answers: number }).answers,
      )
    }
  })

  it('"Guru Aktif": teachers owning a class an answering pupil is enrolled in, with their pupils', () => {
    const ids = new Set(pupilsOf(8106))
    const teachers = new Map<number, Set<number>>()
    for (const id of numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId', 'month')).keys()) {
      if (!ids.has(id)) continue
      for (const e of classrooms.enrolmentsOf(id)) {
        if (e.status !== 'active' || e.classroomKind !== 'classroom') continue
        const owner = classrooms.get('classroom', e.classroomId)?.teacherId
        if (owner == null) continue
        const set = teachers.get(owner) ?? new Set<number>()
        set.add(id)
        teachers.set(owner, set)
      }
    }
    expect(drill.teachers).toHaveLength(teachers.size)
    for (const t of drill.teachers) {
      expect(t.students, String(t.userId)).toBe(teachers.get(t.userId)?.size)
      expect(t.name).toBe(users.get(t.userId)?.name)
    }
    // The list size equals the "{n} GURU" of the board row (one definition).
    const row = admin.month.schools?.find((r) => r.schoolId === 8106)
    expect(row?.activeTeachers).toBe(drill.teachers.length)
  })

  it('"Login": the school\'s users with a login in the period, newest first, with role and time ago', () => {
    const expected = loginsOf('month', 8106)
    expect(drill.logins.map((l) => l.userId)).toEqual(expected.map((u) => u.id))
    for (const l of drill.logins) expect(l.timeAgo).toMatch(/yang lepas$/)
  })

  it('a school without activity answers the empty drill ("Tiada data terperinci")', async () => {
    const answering = new Set(
      [...numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId')).keys()].map(
        (id) => users.get(id)?.schoolId,
      ),
    )
    const quiet = users
      .adminList({ role: 'school_admin', page: 1, pageSize: 1000 })
      .rows.find(
        (u) => u.schoolId !== null && !isFixtureSchoolId(u.schoolId) && !answering.has(u.schoolId),
      )
    const d = await data<CcSchoolDrill>(
      runtime,
      ADMIN,
      `${DAILY}/school/${String(quiet?.schoolId)}?period=today`,
    )
    expect(d.students).toEqual([])
    expect(d.teachers).toEqual([])
    expect(d.logins).toEqual([])
  })

  it('an unknown period answers today and is echoed', async () => {
    const today = await data<CcSchoolDrill>(runtime, ADMIN, `${DAILY}/school/8106?period=today`)
    const bogus = await data<CcSchoolDrill>(runtime, ADMIN, `${DAILY}/school/8106?period=zzz`)
    expect(bogus.period).toBe('zzz')
    expect({ ...bogus, period: 'today' }).toEqual(today)
    expect(today.students.map((s) => s.answers)).toEqual([80, 80])
  })
})
