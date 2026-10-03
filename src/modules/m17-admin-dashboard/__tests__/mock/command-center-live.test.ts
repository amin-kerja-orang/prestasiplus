/**
 * M17-T1b: SRS M17 v1.13 §7 #3, `GET /api/admin/command-center/live-data` (guard AS; FR-M17-21…32,
 * FR-M17-101…111, BR-M17-34, SEC-M17-13).
 *
 * Covered: the 401 / 403 rules (teacher, pupil, parent, PPD, school admin without a school), the platform
 * figures that the owners reproduce (observed values, M11-consistent for the per-school anchors, D9), every
 * computed figure against an independent read of the owners (`practiceAnswers` group counts and facets,
 * `practice.answerFacts`, `practice.answers`, `moodCheckins`), the display constants of the platform view,
 * and the school-admin forcing (every field scoped to the session school, `topSchools` empty, a client
 * `school_id` ignored, DC-M17-03 / DC-M17-05 never shown, a school without activity answers zeros).
 * Read-only against one shared runtime; the one test that changes a user restores it.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_ISO, DAY_MS, formatMyt, weekRange } from '@/lib/time'
import { listDisplayConstants } from '@/mock/dataset'
import type { MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'
import { isFixtureSchoolId } from '@/modules/m02-users-schools/mock'
import { practice, practiceAnswers } from '@/modules/m05-practice/mock'

import type { CcLiveData } from '../../api/command-center-board-types'
import { moodCheckins } from '../../mock'
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
const URL = '/api/admin/command-center/live-data'
/** School admins of the generated schools: 8078 (BANDAR BARU BANGI), 8090 (PANDAN INDAH). */
const SA_8078 = 1214
const SA_8090 = 4521
/** Account 8 belongs to the fixture school 900001 (pupils 2 and 3001–3008, teacher 5). */
const SA_FIXTURE = 8

let runtime: MockRuntime
let platform: CcLiveData
let sa8078: CcLiveData

beforeAll(async () => {
  ;({ runtime } = await bootBoard())
  platform = await data<CcLiveData>(runtime, ADMIN, URL)
  sa8078 = await data<CcLiveData>(runtime, SA_8078, URL)
}, 600_000)

const status = async (as: number | null, url: string) => (await call(runtime, as, url)).status

/** Active students of a school (the P pupils of the school view). */
const pupilsOf = (schoolId: number): number[] =>
  users
    .adminList({ role: 'student', schoolId, page: 1, pageSize: 100_000 })
    .rows.filter((u) => u.isActive)
    .map((u) => u.id)

const numeric = (m: Map<unknown, number>): Map<number, number> =>
  new Map([...m].filter((e): e is [number, number] => typeof e[0] === 'number'))

describe('guards (§7 AS)', () => {
  it('answers 401 UNAUTHORIZED to a guest', async () => {
    const r = await call<ErrorBody>(runtime, null, URL)
    expect(r.status).toBe(401)
    expect(r.body.error.code).toBe('UNAUTHORIZED')
  })

  it('answers 403 FORBIDDEN to a teacher, a pupil, a parent and a PPD officer', async () => {
    for (const as of [GURU, PELAJAR, IBU_BAPA, PPD]) {
      const r = await call<ErrorBody>(runtime, as, URL)
      expect(r.status, String(as)).toBe(403)
      expect(r.body.error.code).toBe('FORBIDDEN')
    }
  })

  it('refuses a school admin without a school with 403, never platform figures (FR-M17-104)', async () => {
    const original = users.get(SA_8090)?.schoolId ?? null
    users.update(SA_8090, { schoolId: null }, NOW)
    try {
      const r = await call<ErrorBody>(runtime, SA_8090, URL)
      expect(r.status).toBe(403)
      expect(r.body.error.code).toBe('FORBIDDEN')
      expect(JSON.stringify(r.body)).not.toContain('totalAnswered')
    } finally {
      users.update(SA_8090, { schoolId: original }, NOW)
    }
    expect(await status(SA_8090, URL)).toBe(200)
  })

  it('admits the admin and the school admin', async () => {
    expect(await status(ADMIN, URL)).toBe(200)
    expect(await status(SA_8078, URL)).toBe(200)
  })
})

describe('platform view: observed figures the owners reproduce', () => {
  it('counters (FR-M17-23): schools 9, pupils 3,152 / 1,563, answers 477,743, accuracy 82.9%', () => {
    expect(platform.scope).toBe('platform')
    expect(platform.school).toBeNull()
    expect(platform.generatedAt).toBe('2026-09-25T15:40:00+08:00')
    expect(platform.totalSchools).toBe(9)
    expect(platform.totalStudents).toBe(3152)
    expect(platform.activeStudents).toBe(1563)
    expect(platform.totalAnswered).toBe(477_743)
    expect(platform.accuracy).toBe(82.9)
  })

  it('activity today and this week (FR-M17-27): 340 and 2,508', () => {
    expect(platform.answeredToday).toBe(340)
    expect(platform.answeredWeek).toBe(2508)
  })

  it('"Top Pelajar Minggu Ini" (FR-M17-29): the observed five, names fictitious', () => {
    expect(
      platform.topStudents.map((s) => [s.studentId, s.answersCount, s.accuracy, s.schoolName]),
    ).toEqual([
      [2022, 452, 99.6, 'SEKOLAH MENENGAH KEBANGSAAN KHIR JOHARI'],
      [2013, 330, 99.7, 'SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN'],
      [2014, 234, 62, 'SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN'],
      [2015, 200, 93.5, 'SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN'],
      [2016, 160, 73.8, 'SEKOLAH MENENGAH KEBANGSAAN ENGKU HUSAIN'],
    ])
    expect(platform.topStudents[0]?.name).toBe('Murid Demo 2022')
  })

  // 8082 / 8080 follow M11 (D9); 8078 / 8106 are the computed counts of the owners' datasets.
  it('"Top Sekolah" (FR-M17-24): five schools by engaged pupils; 8082 and 8080 hold the M11 values (D9)', () => {
    const rows = platform.topSchools
    expect(rows).toHaveLength(5)
    expect(rows.map((r) => r.schoolId)).toEqual([8082, 8078, 8106, 8080, 8090])
    const by = (id: number) => rows.find((r) => r.schoolId === id)
    expect(by(8082)).toMatchObject({ activeCount: 393, totalAnswers: 130_233 })
    expect(by(8080)).toMatchObject({ activeCount: 174, totalAnswers: 53_494 })
    expect(by(8090)).toMatchObject({ activeCount: 134, totalAnswers: 120_782 })
    // Ordered by engaged pupils, then answers.
    for (let i = 1; i < rows.length; i++) {
      expect((rows[i - 1] as { activeCount: number }).activeCount).toBeGreaterThanOrEqual(
        (rows[i] as { activeCount: number }).activeCount,
      )
    }
  })

  it('"Top Sekolah" figures equal an independent read of the answer facts', () => {
    for (const row of platform.topSchools) {
      const ids = pupilsOf(row.schoolId)
      const facts = practice.answerFacts(ids)
      let answers = 0
      let engaged = 0
      for (const list of facts.values()) {
        answers += list.length
        if (list.length > 0) engaged++
      }
      expect(row.activeCount, String(row.schoolId)).toBe(engaged)
      expect(row.totalAnswers, String(row.schoolId)).toBe(answers)
    }
  })

  it('Kirkpatrick (FR-M17-25): T1 = M12 4.6 on its 1–5 scale from 336 responses, T4 GPS 2.880', () => {
    expect(platform.kirk.t1).toEqual({ value: 4.6, scale: 5, count: 336 })
    expect(platform.kirk.t2Accuracy).toBe(82.9)
    expect(platform.kirk.t4Gps).toBe(2.88)
    expect(platform.gpsOverall).toBe(platform.kirk.t4Gps)
  })

  // Recorded D9 deviation DV-M17-38: T3 shows the computed 95 (live 91).
  it('T3 = pupils with an answer in the last 30 days (independent group count)', () => {
    const t3 = practiceAnswers.groupCount('Q-ANS-P', 'userId', '30d').size
    expect(platform.kirk.t3Active).toBe(t3)
    expect(t3).toBe(95)
  })

  it('"Mood Pelajar" (FR-M17-30): 307 / 280 / 72 / 91 from the F-33 store', () => {
    expect(platform.mood).toEqual({ happy: 307, okay: 280, sad: 72, stressed: 91 })
  })

  it('"Live Feed" (FR-M17-28): the 10 latest answers, newest first, school name beside each', () => {
    expect(platform.recentFeed).toHaveLength(10)
    for (const row of platform.recentFeed) {
      expect(row.time).toMatch(/^\d{2}:\d{2}$/)
      expect(row.schoolName).not.toBeNull()
    }
    const times = platform.recentFeed.map((r) => r.time)
    expect([...times].sort().reverse()).toEqual(times)
  })

  it('the feed is the last 10 answers of pupil 2016 in the 8082 session ending 14:59 (SRS §6.7 B, DV-M17-27)', () => {
    for (const row of platform.recentFeed) {
      expect(row.student).toBe('Murid Demo 2016')
      expect(row.schoolId).toBe(8082)
    }
    expect(platform.recentFeed[0]?.time).toBe('14:59')
  })
})

describe('platform view: figures against an independent read', () => {
  it('week, last week and the change follow the M05 week facet (BR-M17-07)', () => {
    const byWeek = numeric(practiceAnswers.groupCount('Q-ANS-P', 'week'))
    const thisWeek = Math.max(...byWeek.keys())
    expect(platform.answeredWeek).toBe(byWeek.get(thisWeek))
    expect(platform.answeredLastWeek).toBe(byWeek.get(thisWeek - 1))
    const pct =
      ((platform.answeredWeek - platform.answeredLastWeek) / platform.answeredLastWeek) * 100
    expect(platform.weekChange).toBe(-Math.round(-pct))
    expect(platform.weekChange).toBeLessThan(0)
    // Observed: last week 7,571, this week 2,508, change -67% (SRS §6.4 Q-M17-WEEK-CHANGE).
    expect(platform.answeredLastWeek).toBe(7571)
    expect(platform.answeredWeek).toBe(2508)
    expect(platform.weekChange).toBe(-67)
  })

  it('today / all-time totals equal the P named queries', () => {
    expect(platform.answeredToday).toBe(practiceAnswers.count('Q-ANS-P', 'today'))
    expect(platform.totalAnswered).toBe(practiceAnswers.count('Q-ANS-P'))
    const correct = practiceAnswers.count('Q-ANS-P-CORRECT')
    expect(platform.accuracy).toBe(Math.round((correct / platform.totalAnswered) * 1000) / 10)
  })

  it('registered pupils and engaged pupils equal the owners', () => {
    expect(platform.totalStudents).toBe(
      users.outsideFixtureSchools({ role: 'student', isActive: true }),
    )
    expect(platform.activeStudents).toBe(practiceAnswers.groupCount('Q-ANS-P', 'userId').size)
  })
})

describe('platform display constants (DC-M17-03, DC-M17-05)', () => {
  it('"Pembetulan" 899 · +0.0% · 0% with no Top Improvers; "Engagement" 29 · 11 · 43 · 3 · 2,229', () => {
    expect(platform.correction).toEqual({
      total: 899,
      avgImprovement: 0,
      improvedCount: 0,
      topImprovers: [],
    })
    expect(platform.engagement).toEqual({
      champion: 29,
      consistent: 11,
      developing: 43,
      minimum: 3,
      disengaged: 2229,
    })
    expect(platform.dailyTrend).toEqual([])
  })

  it('both constants are registered for the unit list (ADR-0013)', () => {
    const m17 = listDisplayConstants().filter((c) => c.module === 'M17')
    expect(m17.map((c) => c.name)).toEqual(
      expect.arrayContaining(['correctionPanel', 'engagementBuckets']),
    )
    expect(m17.find((c) => c.name === 'correctionPanel')?.value).toBe('899|0|0')
    expect(m17.find((c) => c.name === 'engagementBuckets')?.value).toBe('29|11|43|3|2229')
  })
})

describe('school admin view (BR-M17-34, FR-M17-105…111)', () => {
  const FOREIGN = [
    'ENGKU HUSAIN',
    'KHIR JOHARI',
    'PANDAN INDAH',
    'BANDAR RINCHING',
    'Murid Demo 2022',
    'Murid Demo 2013',
  ]

  it('keeps the shape, scopes it to the session school and empties "Top Sekolah"', () => {
    expect(Object.keys(sa8078).sort()).toEqual(Object.keys(platform).sort())
    expect(sa8078.scope).toBe('school')
    expect(sa8078.school).toEqual({
      id: 8078,
      name: 'SEKOLAH MENENGAH KEBANGSAAN BANDAR BARU BANGI',
    })
    expect(sa8078.topSchools).toEqual([])
  })

  it("every figure is the school's own: pupils, engaged, answers, accuracy", () => {
    const ids = pupilsOf(8078)
    const facts = practice.answerFacts(ids)
    let answers = 0
    let correct = 0
    let engaged = 0
    for (const list of facts.values()) {
      if (list.length > 0) engaged++
      answers += list.length
      correct += list.filter((f) => f.isCorrect).length
    }
    expect(sa8078.totalStudents).toBe(ids.length)
    expect(sa8078.activeStudents).toBe(engaged)
    expect(sa8078.totalAnswered).toBe(answers)
    expect(sa8078.accuracy).toBe(Math.round((correct / answers) * 1000) / 10)
    expect(sa8078.totalStudents).toBeLessThan(platform.totalStudents)
    expect(sa8078.totalAnswered).toBeLessThan(platform.totalAnswered)
  })

  it("today, week, last week and the change are the school's own", () => {
    const ids = new Set(pupilsOf(8078))
    const sumOf = (m: Map<number, number>) =>
      [...m].reduce((n, [id, v]) => n + (ids.has(id) ? v : 0), 0)
    expect(sa8078.answeredToday).toBe(
      sumOf(numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId', 'today'))),
    )
    expect(sa8078.answeredWeek).toBe(
      sumOf(numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId', 'week'))),
    )
    // Last week from the answers of the pupils active in the last 30 days (the only ones who can hold it).
    const to = weekRange(NOW).start
    const from = to - 7 * DAY_MS
    let lastWeek = 0
    for (const id of numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId', '30d')).keys()) {
      if (!ids.has(id)) continue
      lastWeek += practice
        .answers(id)
        .filter((a) => a.answeredAtMs >= from && a.answeredAtMs < to).length
    }
    expect(sa8078.answeredLastWeek).toBe(lastWeek)
    expect(sa8078.weekChange).toBe(
      lastWeek === 0
        ? 0
        : (() => {
            const pct = ((sa8078.answeredWeek - lastWeek) / lastWeek) * 100
            return pct < 0 ? -Math.round(-pct) : Math.round(pct)
          })(),
    )
  })

  it('"Top Pelajar", "Live Feed" and the whole body hold no pupil or school of another school (FR-M17-110, FR-M17-115)', () => {
    const ids = new Set(pupilsOf(8078))
    expect(sa8078.topStudents.length).toBeGreaterThan(0)
    for (const s of sa8078.topStudents) {
      expect(ids.has(s.studentId)).toBe(true)
      expect(s.schoolName).toBe(sa8078.school?.name)
    }
    expect(sa8078.recentFeed).toHaveLength(10)
    for (const row of sa8078.recentFeed) {
      expect(row.schoolId).toBe(8078)
      expect(row.schoolName).toBe(sa8078.school?.name)
    }
    const text = JSON.stringify(sa8078)
    for (const name of FOREIGN) expect(text).not.toContain(name)
  })

  it("the school feed starts with the school's latest answer", () => {
    const ids = new Set(pupilsOf(8078))
    let latest = 0
    for (const id of numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId', 'month')).keys()) {
      if (!ids.has(id)) continue
      for (const a of practice.answers(id)) latest = Math.max(latest, a.answeredAtMs)
    }
    expect(sa8078.recentFeed[0]?.time).toBe(formatMyt(latest, 'HH:mm'))
  })

  it('"Mood Pelajar" counts the school\'s pupils only', () => {
    const expected = { happy: 0, okay: 0, sad: 0, stressed: 0 }
    for (const id of pupilsOf(8078)) {
      const c = moodCheckins.countByMood(undefined, id)
      for (const k of Object.keys(expected) as (keyof typeof expected)[]) expected[k] += c[k]
    }
    expect(sa8078.mood).toEqual(expected)
    expect(
      sa8078.mood.happy + sa8078.mood.okay + sa8078.mood.sad + sa8078.mood.stressed,
    ).toBeLessThan(750)
  })

  it('never shows the platform display constants: "Pembetulan" zeros, no buckets, the 7-day trend instead (OQ-M17-12)', () => {
    expect(sa8078.correction).toEqual({
      total: 0,
      avgImprovement: 0,
      improvedCount: 0,
      topImprovers: [],
    })
    expect(sa8078.engagement).toEqual({
      champion: 0,
      consistent: 0,
      developing: 0,
      minimum: 0,
      disengaged: 0,
    })
    expect(sa8078.dailyTrend).toHaveLength(7)
    expect(sa8078.dailyTrend.map((p) => p.date)).toEqual([
      '2026-09-19',
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ])
    expect(sa8078.dailyTrend.map((p) => p.label)).toEqual([
      'Sab',
      'Ahd',
      'Isn',
      'Sel',
      'Rab',
      'Kha',
      'Jum',
    ])
    // The school's own daily answers, from an independent read of the pupils of the last 7 days.
    const ids = new Set(pupilsOf(8078))
    const perDay = new Map<string, number>()
    for (const id of numeric(practiceAnswers.groupCount('Q-ANS-P', 'userId', '7d')).keys()) {
      if (!ids.has(id)) continue
      for (const a of practice.answers(id)) {
        if (a.answeredAtMs < NOW - 7 * DAY_MS) continue
        const key = formatMyt(a.answeredAtMs, 'yyyy-MM-dd')
        perDay.set(key, (perDay.get(key) ?? 0) + 1)
      }
    }
    for (const p of sa8078.dailyTrend) {
      if (p.date === '2026-09-19') continue // the 7th day back holds only the part after 15:40
      expect(p.count, p.date).toBe(perDay.get(p.date) ?? 0)
    }
    expect(sa8078.dailyTrend.reduce((n, p) => n + p.count, 0)).toBeGreaterThan(0)
    const text = JSON.stringify(sa8078)
    for (const value of ['899', '2229', '"champion":29']) expect(text).not.toContain(value)
  })

  it("Kirkpatrick and ALESA AI inputs are the school's (FR-M17-108): T3, GPS 0 without SPM rows, T1 from its respondents", () => {
    expect(sa8078.kirk.t2Accuracy).toBe(sa8078.accuracy)
    expect(sa8078.kirk.t3Active).toBeLessThanOrEqual(sa8078.activeStudents)
    expect(sa8078.kirk.t3Active).toBeLessThan(platform.kirk.t3Active)
    expect(sa8078.kirk.t4Gps).toBe(0)
    expect(sa8078.gpsOverall).toBe(0)
    expect(sa8078.kirk.t1.scale).toBe(5)
    expect(sa8078.kirk.t1.count).toBeLessThan(336)
  })

  it('"Sekolah Berdaftar" is 1 for a subscribed school and 0 otherwise (INFERRED)', async () => {
    expect(sa8078.totalSchools).toBe(1) // 8078 holds an active subscription
    const fixture = await data<CcLiveData>(runtime, SA_FIXTURE, URL)
    expect(fixture.totalSchools).toBe(0) // the fixture school has none
  })

  it('ignores a client-supplied school id, for the school admin and the admin', async () => {
    const forced = await data<CcLiveData>(runtime, SA_8078, `${URL}?school_id=8082&schoolId=8082`)
    expect(forced).toEqual(sa8078)
    const admin = await data<CcLiveData>(runtime, ADMIN, `${URL}?school_id=8082&schoolId=8082`)
    expect(admin).toEqual(platform)
  })

  it('two school admins see only their own school', async () => {
    const pandan = await data<CcLiveData>(runtime, SA_8090, URL)
    expect(pandan.school?.id).toBe(8090)
    expect(pandan.totalStudents).toBe(pupilsOf(8090).length)
    expect(pandan.totalAnswered).not.toBe(sa8078.totalAnswered)
    expect(JSON.stringify(pandan)).not.toContain('BANDAR BARU BANGI')
  })
})

describe('school admin view: fixture school and a school without activity', () => {
  it('the fixture school is shown to its own admin although the platform excludes it (BR-M17-02)', async () => {
    const d = await data<CcLiveData>(runtime, SA_FIXTURE, URL)
    expect(d.school).toEqual({ id: 900001, name: 'SMK DEMO' })
    const ids = pupilsOf(900001)
    expect(d.totalStudents).toBe(ids.length)
    expect(d.totalStudents).toBeGreaterThan(0)
    let all = 0
    let correct = 0
    const engaged = new Set<number>()
    for (const id of ids) {
      for (const a of practice.answers(id)) {
        if (a.answeredAtMs > NOW) continue
        all++
        if (a.isCorrect) correct++
        engaged.add(id)
      }
    }
    expect(d.totalAnswered).toBe(all)
    expect(d.activeStudents).toBe(engaged.size)
    expect(d.accuracy).toBe(Math.round((correct / all) * 1000) / 10)
    expect(d.topSchools).toEqual([])
    for (const row of d.recentFeed) expect(row.schoolId).toBe(900001)
    // The platform figures never include the fixture school.
    expect(platform.totalStudents).toBe(3152)
  })

  it('a school without any answer renders zeros and empty states, not an error (FR-M17-111)', async () => {
    // The first school admin (id order) whose school has no pupil with an answer.
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
    const d = await data<CcLiveData>(runtime, quiet?.id ?? 0, URL)
    expect(d.scope).toBe('school')
    expect(d.school?.id).toBe(quiet?.schoolId)
    expect(d.totalAnswered).toBe(0)
    expect(d.activeStudents).toBe(0)
    expect(d.answeredToday).toBe(0)
    expect(d.answeredWeek).toBe(0)
    expect(d.answeredLastWeek).toBe(0)
    expect(d.weekChange).toBe(0)
    expect(d.accuracy).toBe(0)
    expect(d.topStudents).toEqual([])
    expect(d.recentFeed).toEqual([])
    expect(d.topSchools).toEqual([])
    expect(d.mood).toEqual({ happy: 0, okay: 0, sad: 0, stressed: 0 })
    expect(d.dailyTrend).toHaveLength(7)
    expect(d.dailyTrend.every((p) => p.count === 0)).toBe(true)
    expect(d.kirk.t3Active).toBe(0)
  })
})
