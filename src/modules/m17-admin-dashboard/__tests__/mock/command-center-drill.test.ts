/**
 * M17-T1a: SRS M17 v1.12 §7 #6–#13, the Command Center drill-down handlers (guard AT; BR-M17-30).
 *
 * Covered: the 401 / 403 / 404 / 422 rules, the observed figures that the owners reproduce (school
 * and class shapes, the headcount modal of config 617), every computed figure against an independent
 * read of the owners (`practice.answers`, `classrooms`, `moodCheckins`), the admin and teacher scopes
 * (a teacher reaches only own classes; any other id is a 404), the mood trend of the F-33 store, and
 * the session modals. Read-only against one shared runtime, except the one mood-trend test, which adds
 * check-ins for a pupil no other test reads.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_ISO, DAY_MS, formatDateKey, type Clock } from '@/lib/time'
import type { MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'
import { practice } from '@/modules/m05-practice/mock'
import { headcount } from '@/modules/m08-student-performance/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type {
  CcClass,
  CcHeadcountDetail,
  CcSchool,
  CcSessionDetail,
  CcSessionList,
  CcStudent,
  CcTeacher,
} from '../../api/command-center-types'
import { moodCheckins } from '../../mock'
import {
  ADMIN,
  ADMIN_SEKOLAH,
  GURU,
  IBU_BAPA,
  PELAJAR,
  PPD,
  bootDrill,
  call,
  data,
} from './drill-helpers'
import type { ErrorBody } from './drill-helpers'

const NOW = Date.parse(CLOCK_ANCHOR_ISO)
const FIXTURE_SCHOOL = 900001
const FIXTURE_CLASS = 2001
const FIXTURE_PUPIL = 3001

let runtime: MockRuntime
let clock: Clock

beforeAll(async () => {
  ;({ runtime, clock } = await bootDrill())
}, 600_000)

const get = <T>(as: number | null, url: string) => data<T>(runtime, as, url)
const status = async (as: number | null, url: string) => (await call(runtime, as, url)).status

const cc = '/api/command-center'
const ENDPOINTS = [
  `${cc}/school/8080`,
  `${cc}/school/8080/teacher/1919`,
  `${cc}/classroom/370`,
  `${cc}/student/2022`,
  `${cc}/student/2022/week?start=2026-09-21&end=2026-09-27`,
  `${cc}/student/2022/subject?code=UMUM`,
  `${cc}/session/g1`,
  `${cc}/headcount/617`,
] as const

describe('guards (§7 AT)', () => {
  it('answers 401 UNAUTHORIZED to a guest on #6–#13', async () => {
    for (const url of ENDPOINTS) {
      const r = await call<ErrorBody>(runtime, null, url)
      expect(r.status, url).toBe(401)
      expect(r.body.error.code).toBe('UNAUTHORIZED')
    }
  })

  it('answers 403 FORBIDDEN to every role other than admin and teacher on #6–#13', async () => {
    for (const as of [PELAJAR, IBU_BAPA, PPD]) {
      for (const url of ENDPOINTS) {
        const r = await call<ErrorBody>(runtime, as, url)
        expect(r.status, `${String(as)} ${url}`).toBe(403)
        expect(r.body.error.code).toBe('FORBIDDEN')
      }
    }
  })

  it('answers 404 to a non-numeric id (no route matches, FR-M17-07)', async () => {
    for (const url of [
      `${cc}/school/abc`,
      `${cc}/school/8080/teacher/x`,
      `${cc}/classroom/1.5`,
      `${cc}/student/-3`,
      `${cc}/headcount/abc`,
    ]) {
      expect(await status(ADMIN, url), url).toBe(404)
    }
  })

  it('answers 404 to an unknown id, and to an id of the wrong kind, for an admin', async () => {
    for (const url of [
      `${cc}/school/99999999`,
      `${cc}/school/8080/teacher/99999999`,
      `${cc}/school/8080/teacher/2022`, // a pupil is not a teacher
      `${cc}/school/8082/teacher/1919`, // 1919 is neither employed nor owns a class at 8082
      `${cc}/classroom/99999999`,
      `${cc}/student/99999999`,
      `${cc}/student/4402`, // a teacher is not a pupil
      `${cc}/student/99999999/week?start=2026-09-21&end=2026-09-27`,
      `${cc}/student/99999999/subject?code=UMUM`,
      `${cc}/session/nope`,
      `${cc}/session/bad.id`,
      `${cc}/headcount/99999999`,
    ]) {
      const r = await call<ErrorBody>(runtime, ADMIN, url)
      expect(r.status, url).toBe(404)
      expect(r.body.error.code).toBe('NOT_FOUND')
    }
  })
})

describe('#6 S4 school (FR-M17-48…50)', () => {
  it('8082: 549 students, 68 teachers of whom 14 own classes, no owner-only row', async () => {
    const s = await get<CcSchool>(ADMIN, `${cc}/school/8082`)
    expect(s.school).toEqual({ id: 8082, name: 'SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN' })
    expect(s.cards.students).toBe(549)
    expect(s.teachers).toHaveLength(68)
    expect(s.teachers.filter((t) => t.classes > 0)).toHaveLength(14)
    expect(s.teachers.some((t) => t.ownerOnly)).toBe(false)
  }, 60_000)

  it('8080: 185 students; 34 teachers with no class, then the class owner 1919 (DV-M17-22)', async () => {
    const s = await get<CcSchool>(ADMIN, `${cc}/school/8080`)
    expect(s.school.name).toBe('SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI')
    expect(s.cards.students).toBe(185)
    expect(s.teachers).toHaveLength(35)
    const owner = s.teachers[34]
    expect(owner).toMatchObject({ userId: 1919, ownerOnly: true, classes: 7 })
    expect(
      s.teachers.slice(0, 34).every((t) => !t.ownerOnly && t.classes === 0 && t.students === 0),
    ).toBe(true)
    const distinct = new Set(
      classrooms
        .list({ kind: 'classroom', teacherId: 1919 })
        .flatMap((c) => classrooms.memberIds('classroom', c.classId)),
    )
    expect(owner?.students).toBe(distinct.size)
  }, 60_000)

  it('answers and engaged are the M11-consistent owner values (lead decision, D9): 8082 130,233 / 393; 8080 53,494', async () => {
    const a = await get<CcSchool>(ADMIN, `${cc}/school/8082`)
    expect(a.cards).toMatchObject({ answers: 130_233, active: 393 })
    const b = await get<CcSchool>(ADMIN, `${cc}/school/8080`)
    expect(b.cards.answers).toBe(53_494)
  })

  it('the teacher cards cover only the active members of the own classes at the school (FR-M17-60)', async () => {
    const ids = classrooms
      .list({ kind: 'classroom', teacherId: 1919, isActive: true })
      .flatMap((c) => classrooms.memberIds('classroom', c.classId))
    const members = [...new Set(ids)]
    let answers = 0
    let correct = 0
    let engaged = 0
    for (const id of members) {
      const u = users.get(id)
      if (u?.role !== 'student' || !u.isActive) continue
      const rows = practice.answers(id)
      if (rows.length > 0) engaged++
      answers += rows.length
      correct += rows.filter((x) => x.isCorrect).length
    }
    const own = await get<CcSchool>(1919, `${cc}/school/8080`)
    expect(own.cards).toEqual({
      students: members.length,
      active: engaged,
      answers,
      accuracy: Math.round((correct / answers) * 1000) / 10,
    })
    const whole = await get<CcSchool>(ADMIN, `${cc}/school/8080`)
    expect(own.cards.students).toBeLessThan(whole.cards.students)
    expect(own.cards.answers).toBeLessThan(whole.cards.answers)
  }, 60_000)

  it('lists each group by name A→Z', async () => {
    const s = await get<CcSchool>(ADMIN, `${cc}/school/8082`)
    const names = s.teachers.map((t) => t.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('cards of a fixture school equal the pupils of P read one by one from M05 (BR-M17-03, BR-M17-04)', async () => {
    const s = await get<CcSchool>(ADMIN, `${cc}/school/${String(FIXTURE_SCHOOL)}`)
    const pupils = users.adminList({
      role: 'student',
      schoolId: FIXTURE_SCHOOL,
      pageSize: 1000,
    }).rows
    const active = pupils.filter((u) => u.isActive)
    let answers = 0
    let correct = 0
    let engaged = 0
    for (const u of active) {
      const rows = practice.answers(u.id)
      if (rows.length > 0) engaged++
      answers += rows.length
      correct += rows.filter((a) => a.isCorrect).length
    }
    expect(s.school.name).toBe('SMK DEMO')
    expect(s.cards).toEqual({
      students: pupils.length,
      active: engaged,
      answers,
      accuracy: answers === 0 ? 0 : Math.round((correct / answers) * 1000) / 10,
    })
  })

  it('shows the teacher profile subject as free text, "-" (null) when none', async () => {
    const s = await get<CcSchool>(ADMIN, `${cc}/school/${String(FIXTURE_SCHOOL)}`)
    const guru = s.teachers.find((t) => t.userId === GURU)
    expect(guru).toMatchObject({ subjectText: 'Kimia, Bahasa Melayu', classes: 2, students: 8 })
    const none = await get<CcSchool>(ADMIN, `${cc}/school/8080`)
    expect(none.teachers[0]?.subjectText).toBeNull()
  })

  it('counts "Aktif (30h)" from answers in the 30 days before the clock', async () => {
    const s = await get<CcSchool>(ADMIN, `${cc}/school/${String(FIXTURE_SCHOOL)}`)
    const members = classrooms
      .list({ kind: 'classroom', teacherId: GURU, isActive: true })
      .flatMap((c) => classrooms.memberIds('classroom', c.classId))
    const unique = [...new Set(members)]
    const expected = unique.filter((id) =>
      practice
        .answers(id)
        .some((a) => a.answeredAtMs >= NOW - 30 * DAY_MS && a.answeredAtMs <= NOW),
    ).length
    expect(s.teachers.find((t) => t.userId === GURU)?.active30d).toBe(expected)
  })
})

describe('#7 S5 teacher (FR-M17-51)', () => {
  it('1919 at 8080: classes 366–372 in id order with the observed members 19 · 15 · 33 · 20 · 30 · 25 · 22', async () => {
    const t = await get<CcTeacher>(ADMIN, `${cc}/school/8080/teacher/1919`)
    expect(t.school.id).toBe(8080)
    expect(t.teacher).toEqual({ id: 1919, name: 'Cikgu Demo 1919' })
    expect(t.classes.map((c) => [c.id, c.name, c.level, c.students])).toEqual([
      [366, '5 SAINS TULEN', 'T5', 19],
      [367, '5 KAA', 'T5', 15],
      [368, '5 PRINSIP AKAUN', 'T5', 33],
      [369, '5 RGD', 'T5', 20],
      [370, '5 PERNIAGAAN', 'T5', 30],
      [371, '5 PSV 1', 'T5', 25],
      [372, '5 PSV 2', 'T5', 22],
    ])
  })

  it('4402 at 8082 owns "5 CYBER" (813) with 44 members; 4418 owns none (the empty state, not an error)', async () => {
    const a = await get<CcTeacher>(ADMIN, `${cc}/school/8082/teacher/4402`)
    expect(a.classes.map((c) => [c.id, c.name, c.students])).toEqual([[813, '5 CYBER', 44]])
    const b = await get<CcTeacher>(ADMIN, `${cc}/school/8082/teacher/4418`)
    expect(b.teacher.id).toBe(4418)
    expect(b.classes).toEqual([])
  })

  it("answers and accuracy of a class are its members' answers read from M05", async () => {
    const t = await get<CcTeacher>(ADMIN, `${cc}/school/8080/teacher/1919`)
    const row = t.classes.find((c) => c.id === 367)
    let answers = 0
    let correct = 0
    for (const id of classrooms.memberIds('classroom', 367)) {
      const rows = practice.answers(id)
      answers += rows.length
      correct += rows.filter((a) => a.isCorrect).length
    }
    expect(row?.answers).toBe(answers)
    expect(row?.accuracy).toBe(Math.round((correct / answers) * 1000) / 10)
  })
})

describe('#8 S6 class (FR-M17-52)', () => {
  let cls: CcClass

  beforeAll(async () => {
    cls = await get<CcClass>(ADMIN, `${cc}/classroom/370`)
  }, 60_000)

  it('370 "5 PERNIAGAAN": school 8080, teacher 1919, T5, 30 pupils', () => {
    expect(cls.school).toEqual({ id: 8080, name: 'SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI' })
    expect(cls.teacher).toEqual({ id: 1919, name: 'Cikgu Demo 1919' })
    expect(cls.class).toEqual({ id: 370, name: '5 PERNIAGAAN', level: 'T5' })
    expect(cls.students).toHaveLength(30)
  })

  it('orders the pupils by answers descending, then id', () => {
    const keys = cls.students.map((s) => [s.answers, s.userId] as const)
    for (let i = 1; i < keys.length; i++) {
      const [pa, pu] = keys[i - 1] as readonly [number, number]
      const [a, u] = keys[i] as readonly [number, number]
      expect(pa > a || (pa === a && pu < u)).toBe(true)
    }
  })

  it("each row equals the pupil's own answers, last answer, 7-day status and latest mood", () => {
    for (const s of cls.students) {
      const rows = practice.answers(s.userId)
      const last = rows[rows.length - 1]
      expect(s.answers, String(s.userId)).toBe(rows.length)
      expect(s.accuracy).toBe(
        rows.length === 0
          ? 0
          : Math.round((rows.filter((a) => a.isCorrect).length / rows.length) * 1000) / 10,
      )
      expect(s.lastActiveAt).toBe(last?.answeredAt ?? null)
      expect(s.status).toBe(last && last.answeredAtMs >= NOW - 7 * DAY_MS ? 'aktif' : 'tidak_aktif')
      expect(s.mood).toBe(moodCheckins.latestForUser(s.userId)?.mood ?? null)
    }
  })

  it('shows the F-33 mood of a pupil with a check-in and null ("-") otherwise', () => {
    const withMood = cls.students.filter((s) => s.mood !== null)
    expect(withMood.length).toBeGreaterThan(0)
    expect(cls.students.some((s) => s.mood === null)).toBe(true)
  })
})

describe('#9 S7 pupil (FR-M17-53…55)', () => {
  let s7: CcStudent

  beforeAll(async () => {
    s7 = await get<CcStudent>(ADMIN, `${cc}/student/2022`)
  }, 60_000)

  it('breadcrumb: school 8080, teacher 1919, the first active class 370 (T5)', () => {
    expect(s7.student).toEqual({ id: 2022, name: 'Murid Demo 2022' })
    expect(s7.school?.id).toBe(8080)
    expect(s7.teacher?.id).toBe(1919)
    expect(s7.class).toEqual({ id: 370, name: '5 PERNIAGAAN', level: 'T5' })
  })

  it("cards come from the pupil's answers, M14 streak and the 56-day window", () => {
    const rows = practice.answers(2022)
    const days = new Set(rows.map((a) => formatDateKey(a.answeredAtMs)))
    const recent = new Set(
      rows
        .filter((a) => a.answeredAtMs >= NOW - 56 * DAY_MS && a.answeredAtMs <= NOW)
        .map((a) => formatDateKey(a.answeredAtMs)),
    )
    expect(s7.cards.answers).toBe(rows.length)
    expect(s7.cards.accuracy).toBe(
      Math.round((rows.filter((a) => a.isCorrect).length / rows.length) * 1000) / 10,
    )
    expect(s7.cards.activeDays).toBe(days.size)
    expect(s7.cards.streak).toBe(1)
    expect(s7.cards.consistency).toBe(Math.round((recent.size / 56) * 100))
  })

  it('"Pecahan Subjek" adds up to every answer, one row per session subject, best-covered first', () => {
    expect(s7.subjects.reduce((n, r) => n + r.total, 0)).toBe(s7.cards.answers)
    for (const r of s7.subjects) expect(r.pct).toBe(Math.round((r.correct / r.total) * 1000) / 10)
    for (let i = 1; i < s7.subjects.length; i++) {
      expect((s7.subjects[i - 1]?.total ?? 0) >= (s7.subjects[i]?.total ?? 0)).toBe(true)
    }
  })

  it('"Aktiviti Mingguan": 8 Monday-based weeks ending with the week of the clock (Mon 21 Sep)', () => {
    expect(s7.weeks.map((w) => w.label)).toEqual([
      '03/08',
      '10/08',
      '17/08',
      '24/08',
      '31/08',
      '07/09',
      '14/09',
      '21/09',
    ])
    expect(s7.weeks[7]).toMatchObject({ start: '2026-09-21', end: '2026-09-27' })
    const rows = practice.answers(2022)
    for (const w of s7.weeks) {
      const from = Date.parse(`${w.start}T00:00:00+08:00`)
      expect(w.count).toBe(
        rows.filter((a) => a.answeredAtMs >= from && a.answeredAtMs < from + 7 * DAY_MS).length,
      )
    }
  })

  it('"HeadCount": the three observed configs, Perniagaan TOV 40 dated 16/06/2026', () => {
    expect(s7.headcount.map((h) => [h.configId, h.subject, h.date])).toEqual([
      [617, 'Perniagaan', '2026-06-16'],
      [710, 'Sains', '2026-06-16'],
      [711, 'Matematik', '2026-06-16'],
    ])
    expect(s7.headcount[0]).toMatchObject({ tov: 40, etr: null, rs: null, grade: null })
  })

  it('"ALESA AI Insight" applies the BR-M17-27 rules to the cards', () => {
    const expected: string[] = []
    if (s7.cards.accuracy >= 90)
      expected.push(`Ketepatan cemerlang (${String(s7.cards.accuracy)}%).`)
    if (s7.cards.consistency < 30) {
      expected.push(`Konsistensi rendah (${String(s7.cards.consistency)}%) - perlu usaha lebih.`)
    }
    expect(s7.insight).toEqual({ texts: expected, source: 'Rule-based Analysis' })
  })

  it('has no mood dots without check-ins in the last 30 days ("Tiada data mood")', () => {
    expect(s7.moodTrend).toEqual([])
  })

  it('"Trend Mood (30 Hari)": check-ins of the last 30 days from the F-33 store, oldest first', async () => {
    const pupil = 2025
    const day = (back: number) => formatDateKey(NOW - back * DAY_MS)
    moodCheckins.add({ userId: pupil, mood: 'sad', reason: 'Peperiksaan', date: day(3) })
    moodCheckins.add({ userId: pupil, mood: 'happy', reason: null, date: day(10) })
    moodCheckins.add({ userId: pupil, mood: 'okay', reason: null, date: day(40) }) // outside the window
    const out = await get<CcStudent>(ADMIN, `${cc}/student/${String(pupil)}`)
    expect(out.moodTrend).toEqual([
      { date: day(10), mood: 'happy', reason: null },
      { date: day(3), mood: 'sad', reason: 'Peperiksaan' },
    ])
  })

  it('a pupil with no class has null teacher and class (admin view)', async () => {
    const free = users
      .adminList({ role: 'student', pageSize: 200 })
      .rows.find((u) => u.schoolId !== null && classrooms.forStudent(u.id).length === 0)
    expect(free).toBeDefined()
    const out = await get<CcStudent>(ADMIN, `${cc}/student/${String(free?.id)}`)
    expect(out.class).toBeNull()
    expect(out.teacher).toBeNull()
  })
})

describe('#10 / #11 session lists (FR-M17-56)', () => {
  const all = `${cc}/student/2022/week?start=2020-01-01&end=2030-12-31`

  it("all sessions: totals are the pupil's completed sessions, oldest first (BR-M17-16)", async () => {
    const list = await get<CcSessionList>(ADMIN, all)
    const sessions = practice.history(2022)
    const answers = sessions.reduce((n, s) => n + s.questionCount, 0)
    const correct = sessions.reduce((n, s) => n + s.correctCount, 0)
    expect(list.totalSessions).toBe(sessions.length)
    expect(list.totalAnswers).toBe(answers)
    expect(list.accuracy).toBe(Math.round((correct / answers) * 1000) / 10)
    expect(list.timeSpentMinutes).toBe(
      Math.floor(sessions.reduce((n, s) => n + s.timeSpent, 0) / 60),
    )
    const times = list.sessions.map((s) => Date.parse(s.completedAt))
    expect(times).toEqual([...times].sort((a, b) => a - b))
    for (const r of list.sessions) {
      expect(r.accuracy).toBe(Math.round((r.correct / r.total) * 10000) / 100)
    }
  })

  it('a week holds only the sessions finished from Monday 00:00 to Sunday 23:59 (MYT)', async () => {
    const [first] = (await get<CcSessionList>(ADMIN, all)).sessions
    expect(first).toBeDefined()
    const day = (first?.completedAt ?? '').slice(0, 10)
    const d = new Date(`${day}T00:00:00Z`)
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS)
      .toISOString()
      .slice(0, 10)
    const sunday = new Date(Date.parse(`${monday}T00:00:00Z`) + 6 * DAY_MS)
      .toISOString()
      .slice(0, 10)
    const week = await get<CcSessionList>(
      ADMIN,
      `${cc}/student/2022/week?start=${monday}&end=${sunday}`,
    )
    expect(week.totalSessions).toBeGreaterThan(0)
    for (const r of week.sessions) {
      expect(r.completedAt.slice(0, 10) >= monday && r.completedAt.slice(0, 10) <= sunday).toBe(
        true,
      )
    }
    expect(week.sessions.some((r) => r.id === first?.id)).toBe(true)
  })

  it('a week without sessions is an empty list, not an error ("Tiada sesi minggu ini")', async () => {
    const list = await get<CcSessionList>(
      ADMIN,
      `${cc}/student/2022/week?start=2020-01-06&end=2020-01-12`,
    )
    expect(list).toMatchObject({ totalAnswers: 0, totalSessions: 0, accuracy: 0, sessions: [] })
  })

  it('422 "Julat tarikh tidak sah." for a missing, malformed, impossible or reversed range', async () => {
    for (const q of [
      '',
      '?start=2026-09-21',
      '?start=21-09-2026&end=2026-09-27',
      '?start=2026-02-30&end=2026-03-05',
      '?start=2026-09-27&end=2026-09-21',
    ]) {
      const r = await call<ErrorBody>(runtime, ADMIN, `${cc}/student/2022/week${q}`)
      expect(r.status, q).toBe(422)
      expect(r.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Julat tarikh tidak sah.',
      })
    }
  })

  it("a subject list holds that subject's sessions only, newest first, with a topic", async () => {
    const s7 = await get<CcStudent>(ADMIN, `${cc}/student/2022`)
    const subject = s7.subjects[0]
    expect(subject).toBeDefined()
    const list = await get<CcSessionList>(
      ADMIN,
      `${cc}/student/2022/subject?code=${subject?.code ?? ''}`,
    )
    expect(list.totalSessions).toBeGreaterThan(0)
    expect(new Set(list.sessions.map((s) => s.subjectLabel))).toEqual(new Set([subject?.label]))
    const times = list.sessions.map((s) => Date.parse(s.completedAt))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('UMUM is free practice (subject null, topic "Latihan Bebas"); an unknown code is an empty list', async () => {
    const umum = await get<CcSessionList>(ADMIN, `${cc}/student/2022/subject?code=UMUM`)
    const expected = practice.history(2022).filter((s) => s.subjectId === null)
    expect(umum.totalSessions).toBe(expected.length)
    for (const r of umum.sessions) {
      expect(r.subjectLabel).toBe('Umum')
      expect(r.topic).toBe('Latihan Bebas')
    }
    const none = await get<CcSessionList>(ADMIN, `${cc}/student/2022/subject?code=TIADA`)
    expect(none.sessions).toEqual([])
  })
})

describe('#12 session detail (FR-M17-58)', () => {
  let detail: CcSessionDetail
  let id = ''

  beforeAll(async () => {
    const list = await get<CcSessionList>(
      ADMIN,
      `${cc}/student/2022/week?start=2020-01-01&end=2030-12-31`,
    )
    id = list.sessions[0]?.id ?? ''
    detail = await get<CcSessionDetail>(ADMIN, `${cc}/session/${id}`)
  }, 60_000)

  it('matches the stored session: totals, wrong = total − correct, time as {m, s}', () => {
    const s = practice.session(id)
    expect(s).toBeDefined()
    expect(detail.total).toBe(s?.questionCount)
    expect(detail.correctCount).toBe(s?.correctCount)
    expect(detail.wrongCount).toBe((s?.questionCount ?? 0) - (s?.correctCount ?? 0))
    expect(detail.timeSpent).toEqual({
      m: Math.floor((s?.timeSpent ?? 0) / 60),
      s: (s?.timeSpent ?? 0) % 60,
    })
    expect(detail.accuracy).toBe(
      Math.round(((s?.correctCount ?? 0) / (s?.questionCount ?? 1)) * 10000) / 100,
    )
    expect(detail.completedAt).toBe(s?.completedAt)
  })

  it('lists the session\'s answers in order with "{L}) {text}" options and texts cut at 150', () => {
    expect(detail.answers.length).toBe(practice.sessionAnswers(id).length)
    detail.answers.forEach((a, i) => {
      expect(a.no).toBe(i + 1)
      expect(a.questionText.length).toBeLessThanOrEqual(153)
      if (a.selectedAnswer !== null) expect(a.selectedAnswer).toMatch(/^[A-D]\) /)
      if (a.correctAnswer !== null) expect(a.correctAnswer).toMatch(/^[A-D]\) /)
      if (a.correct && a.selectedAnswer !== null) expect(a.selectedAnswer).toBe(a.correctAnswer)
    })
    expect(detail.answers.filter((a) => a.correct)).toHaveLength(detail.correctCount)
  })
})

describe('#13 headcount detail (FR-M17-57)', () => {
  it('config 617 (Perniagaan, class 370): 30 pupils, mean TOV 29.7, ETR 0, pass rate 0 %', async () => {
    const h = await get<CcHeadcountDetail>(ADMIN, `${cc}/headcount/617`)
    expect(h).toMatchObject({
      subject: 'Perniagaan',
      totalStudents: 30,
      avgTov: 29.7,
      avgEtr: 0,
      passRate: 0,
    })
    expect(h.students).toHaveLength(30)
    expect(h.students.find((s) => s.userId === 2022)).toMatchObject({
      tov: 40,
      etr: null,
      rs: null,
      grade: null,
    })
  })

  it('pass rate = graded entries with grade A+ … C over graded entries', async () => {
    const graded = headcount
      .configs()
      .map((c) => ({ c, d: headcount.get(c.id) }))
      .find(({ d }) => (d?.entries.filter((e) => e.grade !== null).length ?? 0) > 1)
    expect(graded).toBeDefined()
    const rows = graded?.d?.entries.filter((e) => e.grade !== null) ?? []
    const pass = rows.filter((e) =>
      ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C'].includes(e.grade ?? ''),
    ).length
    const h = await get<CcHeadcountDetail>(ADMIN, `${cc}/headcount/${String(graded?.c.id)}`)
    expect(h.passRate).toBe(Math.round((pass / rows.length) * 100))
  })
})

describe('teacher scope (BR-M17-30, FR-M17-60, guard AT)', () => {
  it('a teacher opens the school of an own class and only sees the own teacher row', async () => {
    const s = await get<CcSchool>(GURU, `${cc}/school/${String(FIXTURE_SCHOOL)}`)
    expect(s.teachers.map((t) => t.userId)).toEqual([GURU])
    const other = await get<CcSchool>(1919, `${cc}/school/8080`)
    expect(other.cards.students).toBe(164) // the 7 own classes' distinct members, not the school's 185
    expect(other.teachers.map((t) => t.userId)).toEqual([1919])
  })

  it("a school with none of the teacher's classes is a 404, never a 403", async () => {
    const r = await call<ErrorBody>(runtime, GURU, `${cc}/school/8082`)
    expect(r.status).toBe(404)
    expect(r.body.error.code).toBe('NOT_FOUND')
  })

  it("S5 is the teacher's own page only", async () => {
    const own = await get<CcTeacher>(
      GURU,
      `${cc}/school/${String(FIXTURE_SCHOOL)}/teacher/${String(GURU)}`,
    )
    expect(own.classes.map((c) => c.id)).toEqual([2001, 2002])
    expect(await status(GURU, `${cc}/school/${String(FIXTURE_SCHOOL)}/teacher/1919`)).toBe(404)
    expect(await status(1919, `${cc}/school/8080/teacher/4402`)).toBe(404)
    expect(await status(1919, `${cc}/school/8082/teacher/1919`)).toBe(404)
  })

  it('S6 is an own class only', async () => {
    const own = await get<CcClass>(GURU, `${cc}/classroom/${String(FIXTURE_CLASS)}`)
    expect(own.students.map((s) => s.userId).sort((a, b) => a - b)).toEqual(
      classrooms.memberIds('classroom', FIXTURE_CLASS),
    )
    expect(await status(GURU, `${cc}/classroom/370`)).toBe(404)
    expect(await status(1919, `${cc}/classroom/813`)).toBe(404)
    expect((await get<CcClass>(1919, `${cc}/classroom/370`)).students).toHaveLength(30)
  })

  it('S7 and its modals are for an active member of an own class only', async () => {
    const own = await get<CcStudent>(GURU, `${cc}/student/${String(FIXTURE_PUPIL)}`)
    expect(own.class?.id).toBe(FIXTURE_CLASS)
    expect(await status(GURU, `${cc}/student/2022`)).toBe(404)
    expect(await status(GURU, `${cc}/student/2022/week?start=2020-01-01&end=2030-12-31`)).toBe(404)
    expect(await status(GURU, `${cc}/student/2022/subject?code=UMUM`)).toBe(404)
    expect(await status(4402, `${cc}/student/2022`)).toBe(404)
    expect(await status(1919, `${cc}/student/2022`)).toBe(200)
  })

  it('a session modal is reachable only through a pupil in scope', async () => {
    const list = await get<CcSessionList>(
      GURU,
      `${cc}/student/${String(FIXTURE_PUPIL)}/week?start=2020-01-01&end=2030-12-31`,
    )
    const mine = list.sessions[0]?.id
    expect(mine).toBeDefined()
    expect(await status(GURU, `${cc}/session/${String(mine)}`)).toBe(200)
    const theirs = (
      await get<CcSessionList>(ADMIN, `${cc}/student/2022/week?start=2020-01-01&end=2030-12-31`)
    ).sessions[0]?.id
    expect(await status(GURU, `${cc}/session/${String(theirs)}`)).toBe(404)
    expect(await status(1919, `${cc}/session/${String(theirs)}`)).toBe(200)
  })

  it('a headcount modal is for a config of an own class only', async () => {
    const own = headcount.configsOfClass(FIXTURE_CLASS)[0]
    expect(own).toBeDefined()
    expect(await status(GURU, `${cc}/headcount/${String(own?.id)}`)).toBe(200)
    expect(await status(GURU, `${cc}/headcount/617`)).toBe(404)
    expect(await status(1919, `${cc}/headcount/617`)).toBe(200)
  })

  it("the pupil page lists only the headcount rows of the viewer's own configs", async () => {
    const asAdmin = await get<CcStudent>(ADMIN, `${cc}/student/2022`)
    const as1919 = await get<CcStudent>(1919, `${cc}/student/2022`)
    expect(as1919.headcount.map((h) => h.configId)).toEqual(
      asAdmin.headcount.map((h) => h.configId),
    )
    expect(as1919.headcount.length).toBeGreaterThan(0)
  })
})

describe('the mock clock (§7: handlers read ctx.clock.now())', () => {
  it('moves the S7 weeks and the 7-day / 30-day windows with the clock', async () => {
    clock.advance(14 * DAY_MS)
    try {
      const s7 = await get<CcStudent>(ADMIN, `${cc}/student/2022`)
      expect(s7.weeks[7]).toMatchObject({ start: '2026-10-05', end: '2026-10-11', label: '05/10' })
      expect(s7.weeks[0]?.start).toBe('2026-08-17')
      // 14 days on, a pupil whose last answer was 8–14 days before the anchor is no longer "Aktif".
      const cls = await get<CcClass>(ADMIN, `${cc}/classroom/${String(FIXTURE_CLASS)}`)
      for (const s of cls.students) {
        const last = s.lastActiveAt === null ? null : Date.parse(s.lastActiveAt)
        expect(s.status).toBe(
          last !== null && last >= clock.now() - 7 * DAY_MS ? 'aktif' : 'tidak_aktif',
        )
      }
    } finally {
      clock.setNow(CLOCK_ANCHOR_ISO)
    }
  })
})

describe('school admin scope (ATS, BR-M17-34, FR-M17-114, SEC-M17-13)', () => {
  // Account 8 belongs to the fixture school 900001 (teacher 5, classes 2001 / 2002, pupils 3001–3008).
  const SA = ADMIN_SEKOLAH
  const FOREIGN_NAMES = [
    'Murid Demo 2022',
    'Cikgu Demo 1919',
    'KHIR JOHARI',
    '5 PERNIAGAAN',
    'Perniagaan',
  ]

  it('opens the own school with the whole-school cards and every teacher', async () => {
    const s = await get<CcSchool>(SA, `${cc}/school/${String(FIXTURE_SCHOOL)}`)
    const asAdmin = await get<CcSchool>(ADMIN, `${cc}/school/${String(FIXTURE_SCHOOL)}`)
    expect(s).toEqual(asAdmin)
  })

  it('reaches the own teacher, class, pupil, sessions and headcount configs', async () => {
    expect(await status(SA, `${cc}/school/${String(FIXTURE_SCHOOL)}/teacher/${String(GURU)}`)).toBe(
      200,
    )
    expect(await status(SA, `${cc}/classroom/${String(FIXTURE_CLASS)}`)).toBe(200)
    expect(await status(SA, `${cc}/student/${String(FIXTURE_PUPIL)}`)).toBe(200)
    const list = await get<CcSessionList>(
      SA,
      `${cc}/student/${String(FIXTURE_PUPIL)}/week?start=2020-01-01&end=2030-12-31`,
    )
    expect(await status(SA, `${cc}/session/${String(list.sessions[0]?.id)}`)).toBe(200)
    const config = headcount.configsOfClass(FIXTURE_CLASS)[0]
    expect(await status(SA, `${cc}/headcount/${String(config?.id)}`)).toBe(200)
  })

  it('answers 404 (never 403) for objects of another school, and leaks no name or number', async () => {
    const foreignSession = (
      await get<CcSessionList>(ADMIN, `${cc}/student/2022/week?start=2020-01-01&end=2030-12-31`)
    ).sessions[0]?.id
    for (const url of [
      `${cc}/school/8080`,
      `${cc}/school/8080/teacher/1919`,
      `${cc}/school/${String(FIXTURE_SCHOOL)}/teacher/1919`,
      `${cc}/classroom/370`,
      `${cc}/student/2022`,
      `${cc}/student/2022/week?start=2020-01-01&end=2030-12-31`,
      `${cc}/student/2022/subject?code=UMUM`,
      `${cc}/session/${String(foreignSession)}`,
      `${cc}/headcount/617`,
    ]) {
      const r = await call<ErrorBody>(runtime, SA, url)
      expect(r.status, url).toBe(404)
      const text = JSON.stringify(r.body)
      for (const name of FOREIGN_NAMES) expect(text, url).not.toContain(name)
    }
  })

  it('answers the same 404 for an unknown id, so existence is not revealed', async () => {
    const unknown = await call<ErrorBody>(runtime, SA, `${cc}/classroom/99999999`)
    const foreign = await call<ErrorBody>(runtime, SA, `${cc}/classroom/370`)
    expect(unknown.status).toBe(404)
    expect(unknown.body).toEqual(foreign.body)
  })

  it('ignores a client-supplied school id', async () => {
    expect(await status(SA, `${cc}/school/8080?school_id=8080&schoolId=8080`)).toBe(404)
    const own = await get<CcSchool>(SA, `${cc}/school/${String(FIXTURE_SCHOOL)}?school_id=8080`)
    expect(own.school.id).toBe(FIXTURE_SCHOOL)
  })

  it('refuses a school admin without a school with 403, and still refuses PPD', async () => {
    const original = users.get(4521)?.schoolId ?? null
    users.update(4521, { schoolId: null }, NOW)
    try {
      const r = await call<ErrorBody>(runtime, 4521, `${cc}/school/8090`)
      expect(r.status).toBe(403)
      expect(r.body.error.code).toBe('FORBIDDEN')
    } finally {
      users.update(4521, { schoolId: original }, NOW)
    }
    expect(await status(PPD, `${cc}/school/8080`)).toBe(403)
  })

  it('the page of a pupil lists only headcount rows of classes of the school', async () => {
    const s7 = await get<CcStudent>(SA, `${cc}/student/${String(FIXTURE_PUPIL)}`)
    for (const h of s7.headcount) {
      const c = headcount.config(h.configId)
      expect(classrooms.get('classroom', c?.classroomId ?? 0)?.schoolId).toBe(FIXTURE_SCHOOL)
    }
  })
})

describe('observed figures (M17 SRS §6.7 B/C, XR-M17-02 landed in M05)', () => {
  it('S4 8082: 549 pupils · 393 engaged · 130,233 answers · 82.3 %', async () => {
    const s = await get<CcSchool>(ADMIN, `${cc}/school/8082`)
    expect(s.cards).toEqual({ students: 549, active: 393, answers: 130_233, accuracy: 82.3 })
    expect(s.teachers).toHaveLength(68)
  })

  it('S4 8080: 185 pupils · 174 engaged · 53,494 answers · 81.7 %', async () => {
    const s = await get<CcSchool>(ADMIN, `${cc}/school/8080`)
    expect(s.cards).toEqual({ students: 185, active: 174, answers: 53_494, accuracy: 81.7 })
  })

  it('S5 1919: class 370 has 30 members · 8 active (30h) · 13,641 answers · 79.0 %', async () => {
    const t = await get<CcTeacher>(ADMIN, `${cc}/school/8080/teacher/1919`)
    const row = t.classes.find((c) => c.id === 370)
    expect(row).toMatchObject({ students: 30, active30d: 8, answers: 13_641, accuracy: 79 })
  })

  it('S6 370: 30 members, Σ answers 13,641, 3 "Aktif", pupil 2022 first with 2,378 · 93.5 %', async () => {
    const c = await get<CcClass>(ADMIN, `${cc}/classroom/370`)
    expect(c.students).toHaveLength(30)
    expect(c.students.reduce((n, s) => n + s.answers, 0)).toBe(13_641)
    expect(c.students.filter((s) => s.status === 'aktif')).toHaveLength(3)
    expect(c.students[0]).toMatchObject({ userId: 2022, answers: 2378, accuracy: 93.5 })
    expect(c.students.slice(1, 3).map((s) => [s.answers, s.accuracy])).toEqual([
      [2204, 73.2],
      [1836, 77.8],
    ])
  })

  it('S7 2022: 2,378 answers · 93.5 %; 123 sessions (2,372 answers, 93.7 %); week 452 · 23 · 99.6 %', async () => {
    const s = await get<CcStudent>(ADMIN, `${cc}/student/2022`)
    expect(s.cards).toMatchObject({ answers: 2378, accuracy: 93.5, streak: 1 })
    expect(s.weeks.slice(-2).map((w) => w.count)).toEqual([1166, 452])
    const all = await get<CcSessionList>(
      ADMIN,
      `${cc}/student/2022/week?start=2020-01-01&end=2030-12-31`,
    )
    expect(all).toMatchObject({ totalSessions: 123, totalAnswers: 2372, accuracy: 93.7 })
    const wk = await get<CcSessionList>(
      ADMIN,
      `${cc}/student/2022/week?start=2026-09-21&end=2026-09-27`,
    )
    expect(wk).toMatchObject({ totalSessions: 23, totalAnswers: 452, accuracy: 99.6 })
  })

  const week = (id: number) =>
    get<CcSessionList>(ADMIN, `${cc}/student/${String(id)}/week?start=2026-09-21&end=2026-09-27`)

  it.each([
    [2013, 330, 18, 99.7],
    [2014, 234, 11, 62],
    [2015, 200, 15, 93.5],
    [2016, 160, 4, 73.8],
    [2018, 159, 10, 78.6],
    [2019, 159, 10, 78.6],
    [2017, 99, 5, 80.8],
  ])(
    'week of pupil %i: %i answers · %i sessions · %f %%',
    async (id, answers, sessions, accuracy) => {
      expect(await week(id)).toMatchObject({
        totalAnswers: answers,
        totalSessions: sessions,
        accuracy,
      })
    },
  )

  it.each([
    [2013, 2893, 99.2],
    [2017, 1701, 90.2],
    [2020, 3637, 92.6],
    [2023, 1179, 87.9],
  ])('month top pupil %i: %i answers · %f %%', async (id, answers, accuracy) => {
    const s = await get<CcStudent>(ADMIN, `${cc}/student/${String(id)}`)
    expect(s.cards).toMatchObject({ answers, accuracy })
  })
})
