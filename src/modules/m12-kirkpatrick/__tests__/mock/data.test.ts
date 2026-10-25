/**
 * M12-T1 stores, seeds and read models (SRS M12 v1.6 §6.2-§6.9): the observed figures reproduced by the named
 * queries and read models, booted with the real core, M01-M05, M08, M10 and M12 at the project clock. Read-only:
 * every mutating check lives in `handlers.test.ts`.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { listDisplayConstants } from '@/mock/dataset'
import { users } from '@/modules/m01-authentication/mock'
import { kirkpatrick } from '@/modules/m05-practice/mock'
import { schoolSpmHistory } from '@/modules/m08-student-performance/mock'

import {
  alesaPredictions,
  feedback,
  kirkpatrickInterventions,
  schoolEngagementScores,
  studentConsistency,
} from '../../mock'
import {
  alesaOf,
  behaviorOf,
  chainOf,
  comparisonOf,
  filterOptionsOf,
  learningOf,
  myOf,
  overviewOf,
  populationOf,
  predictionsOf,
  reactionOf,
  resolveScope,
  resultsOf,
  studentOf,
} from '../../mock/repository'
import { bootM12, shutdownM12, type M12Harness } from './helpers'
import {
  OBSERVED_ALERTS_GREEN,
  OBSERVED_ALERTS_NEVER,
  OBSERVED_ALERTS_TEACHER,
  OBSERVED_ALESA_8080,
  OBSERVED_ALESA_PLATFORM,
  OBSERVED_S3,
  OBSERVED_S4,
  OBSERVED_S5_ORDER,
  OBSERVED_SUBJECTS_8080,
  OBSERVED_SUBJECTS_PLATFORM,
} from './observed'

let h: M12Harness
let NOW: number

beforeAll(async () => {
  h = await bootM12()
  NOW = h.clock.now()
}, 600_000)

afterAll(() => {
  shutdownM12()
})

const platform = () => resolveScope()
const school = (schoolId: number) => resolveScope({ schoolId })

// ---------------------------------------------------------------------------------------------
// The M12-owned stores
// ---------------------------------------------------------------------------------------------

describe('FeedbackResponse (DATA-M12-01, Q-M12-T1)', () => {
  it('holds 336 responses, ids 1-336, designed split 311 / 20 / 5', () => {
    expect(feedback.count('Q-M12-T1')).toBe(336)
    expect(feedback.count('Q-M12-T1-ROLE', 'student')).toBe(311)
    expect(feedback.count('Q-M12-T1-ROLE', 'teacher')).toBe(20)
    expect(feedback.count('Q-M12-T1-ROLE', 'admin')).toBe(5)
    const rows = feedback.query('Q-M12-T1', { sort: 'id', page: 1, pageSize: 400 }).rows
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 336 }, (_, i) => i + 1))
  })

  it('reproduces the observed T1 means: NPS 8.4 / 6.5 / 9.6, overall 8.3, satisfaction 4.6', () => {
    const a = feedback.aggregates()
    expect(a).toEqual({
      responses: 336,
      satisfaction: 4.6,
      npsStudent: 8.4,
      npsTeacher: 6.5,
      npsAdmin: 9.6,
      nps: 8.3,
    })
    expect(reactionOf()).toEqual({
      npsStudent: 8.4,
      npsTeacher: 6.5,
      npsAdmin: 9.6,
      satisfaction: 4.6,
    })
  })

  it('has at most one response per user and month; admin 1 and 5801 anchors; canonical accounts silent', () => {
    const rows = feedback.query('Q-M12-T1', { page: 1, pageSize: 400 }).rows
    const keys = rows.map((r) => `${String(r.userId)}:${r.month}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(rows.every((r) => r.month >= '2026-02' && r.month <= '2026-09')).toBe(true)
    expect(feedback.forUser(1).map((r) => r.month)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(feedback.forUser(5801).map((r) => r.month)).toEqual(['2026-08', '2026-09'])
    for (const id of [2, 3, 4, 5, 11]) expect(feedback.forUser(id)).toEqual([])
    expect(feedback.hasResponse(1, '2026-09')).toBe(true)
    expect(feedback.hasResponse(2, '2026-09')).toBe(false)
  })

  it('respondents of the students and teachers are users of those roles', () => {
    const rows = feedback.query('Q-M12-T1', { page: 1, pageSize: 400 }).rows
    for (const r of rows) expect(users.get(r.userId)?.role).toBe(r.role)
    for (const r of rows) expect(users.get(r.userId)?.schoolId ?? null).toBe(r.schoolId)
  })

  it('XR-M17-21: Q-M12-T1 and the aggregates accept an optional school filter', () => {
    const first = feedback
      .query('Q-M12-T1', { page: 1, pageSize: 400 })
      .rows.find((r) => r.schoolId !== null)
    expect(first).toBeDefined()
    const sid = first?.schoolId as number
    const own = feedback.query('Q-M12-T1', { page: 1, pageSize: 400 }, sid).rows
    expect(own.length).toBeGreaterThan(0)
    expect(own.every((r) => r.schoolId === sid)).toBe(true)
    expect(feedback.count('Q-M12-T1', sid)).toBe(own.length)

    const a = feedback.aggregates(sid)
    const sat = own.reduce((s, r) => s + r.satisfaction, 0) / own.length
    expect(a.responses).toBe(own.length)
    expect(a.satisfaction).toBe(Math.round(sat * 10) / 10)
    // The platform figure is unchanged by the optional parameter.
    expect(feedback.count('Q-M12-T1')).toBe(336)
    expect(feedback.aggregates().responses).toBe(336)
    // The school filters partition the platform responses.
    const bySchool = new Map<number | null, number>()
    for (const r of feedback.query('Q-M12-T1', { page: 1, pageSize: 400 }).rows) {
      bySchool.set(r.schoolId, (bySchool.get(r.schoolId) ?? 0) + 1)
    }
    for (const [id, n] of bySchool) if (id !== null) expect(feedback.count('Q-M12-T1', id)).toBe(n)
  })

  it('XR-M17-21: a school without respondents returns count 0 and zero means', () => {
    expect(feedback.count('Q-M12-T1', 987_654)).toBe(0)
    expect(feedback.aggregates(987_654)).toEqual({
      responses: 0,
      satisfaction: 0,
      npsStudent: 0,
      npsTeacher: 0,
      npsAdmin: 0,
      nps: 0,
    })
  })
})

describe('KirkpatrickIntervention (DATA-M12-02, Q-M12-INT)', () => {
  it('is empty as on live: 0 rows, all KPIs 0', () => {
    expect(kirkpatrickInterventions.count('Q-M12-INT')).toBe(0)
    expect(kirkpatrickInterventions.list()).toEqual({
      kpi: { total: 0, pending: 0, up: 0, down: 0 },
      rows: [],
    })
  })
})

describe('score tables (DATA-M12-03 ... 05) and display constants', () => {
  it('SchoolEngagementScore: 33 rows; 8080 62.4 / 3 observed; the zero-answer rows observed', () => {
    const all = schoolEngagementScores.all()
    expect(all).toHaveLength(33)
    expect(schoolEngagementScores.get(8080)).toMatchObject({
      score: 62.4,
      subjectCount: 3,
      observed: true,
    })
    expect(schoolEngagementScores.get(940)).toMatchObject({
      score: 2,
      subjectCount: 1,
      observed: true,
    })
    for (const id of [987, 995, 8198, 8284, 8302, 8308, 9801, 10220]) {
      expect(schoolEngagementScores.get(id)).toMatchObject({
        score: 0,
        subjectCount: 0,
        observed: true,
      })
    }
    expect(all.filter((r) => r.observed)).toHaveLength(10)
    expect(all.every((r) => r.score >= 0 && r.score <= 100)).toBe(true)
    expect(schoolEngagementScores.get(123_456)).toBeUndefined()
  })

  it('AlesaPrediction: two stored lists of 50 rows, other schools have none', () => {
    expect(alesaPredictions.stored('platform')).toHaveLength(50)
    expect(alesaPredictions.stored(8080)).toHaveLength(50)
    expect(alesaPredictions.stored(8090)).toEqual([])
    expect(alesaPredictions.stored('platform').every((r) => r.observed)).toBe(true)
  })

  it('StudentConsistency: anchors 22.5 / 21.1; the rest deterministic in 0-100', () => {
    expect(studentConsistency.konsistensiOf(4664)).toBe(22.5)
    expect(studentConsistency.konsistensiOf(4644)).toBe(21.1)
    const a = studentConsistency.konsistensiOf(7)
    expect(studentConsistency.konsistensiOf(7)).toBe(a)
    for (const id of [7, 100, 5000, 123_456]) {
      const v = studentConsistency.konsistensiOf(id)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })

  it('DC-M12-01 ... 03 are registered display constants with their DV ids', () => {
    const m12 = listDisplayConstants().filter((c) => c.module === 'M12')
    expect(m12.map((c) => [c.name, c.value, c.dv])).toEqual([
      [
        'correlationBands',
        '1-20 soalan:215:59.7|51-100 soalan:149:68.7|100+ soalan:348:75.2',
        'DV-M12-23',
      ],
      ['correlationR', 0.1298, 'DV-M12-23'],
      ['gpsRecordsLabel', 41, 'DV-M12-22'],
      ['headcountRecords', 4378, 'DV-M12-22'],
    ])
  })
})

// ---------------------------------------------------------------------------------------------
// Named queries over the owners' stores (SRS §6.5): platform · 8080 · Kelantan
// ---------------------------------------------------------------------------------------------

describe('Q-M12 populations and practice figures', () => {
  const kelantan = () => resolveScope({ state: 'Kelantan' })

  it('Q-M12-T4T5: 4,158 · 184 · 0 and Q-M12-GURU / -LOGIN: 522 / 277 · 34 / 34 · 0 / 0', () => {
    expect(populationOf(platform())).toMatchObject({
      t4t5: 4158,
      teachers: 522,
      teachersLoggedIn: 277,
    })
    expect(populationOf(school(8080))).toMatchObject({
      t4t5: 184,
      teachers: 34,
      teachersLoggedIn: 34,
    })
    expect(populationOf(kelantan())).toMatchObject({ t4t5: 0, teachers: 0, teachersLoggedIn: 0 })
  })

  it('an unknown school, a fixture school and an unknown state are the zero state', () => {
    for (const scope of [school(987_654), school(900_001), resolveScope({ state: 'Atlantis' })]) {
      expect(populationOf(scope).t4t5).toBe(0)
      expect(kirkpatrick.totals(scope.ka).sessions).toBe(0)
    }
    expect(resolveScope({ schoolId: 8080, state: 'Kelantan' }).schoolIds).toEqual([])
  })

  it('Q-M12-SCH-OPTIONS 57 schools A to Z; Q-M12-SCH-TABLE 33 (platform) and 1 (8080)', () => {
    const options = filterOptionsOf()
    expect(options.schools).toHaveLength(57)
    const names = options.schools.map((s) => s.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms')))
    expect(populationOf(platform()).schools).toHaveLength(33)
    expect(populationOf(school(8080)).schools).toHaveLength(1)
    expect(filterOptionsOf(8080).schools.map((s) => s.id)).toEqual([8080])
    expect(filterOptionsOf(-1).schools).toEqual([])
  })

  it('the state select holds exactly the ten observed states', () => {
    const observed = [
      'Johor',
      'Kedah',
      'Kelantan',
      'Kuala Lumpur',
      'Melaka',
      'Pahang',
      'Perak',
      'Sabah',
      'Selangor',
      'Terengganu',
    ]
    const states = filterOptionsOf().states
    for (const s of observed) expect(states).toContain(s)
    expect(states).toEqual([...states].sort((a, b) => a.localeCompare(b, 'ms')))
    expect(states).toEqual(observed)
  })

  it('Q-M12-NEVER-LOGIN per school equals the observed 22 red counts (the M11 "Belum login" figures)', () => {
    const pop = populationOf(platform())
    for (const [id, n] of OBSERVED_ALERTS_NEVER) {
      expect(pop.schools.find((s) => s.schoolId === id)?.never).toBe(n)
    }
  })

  it('Q-M12-SESSIONS 20,991 · 1,002 · 0; Q-M12-ANSWERS 306,133 · 15,007 · 0; correct 253,478 · 11,339 · 0', () => {
    const t = (scope = platform()) => kirkpatrick.totals(scope.ka)
    expect([t().sessions, t().answered, t().correct]).toEqual([20_991, 306_133, 253_478])
    expect([t(school(8080)).sessions, t(school(8080)).answered, t(school(8080)).correct]).toEqual([
      1_002, 15_007, 11_339,
    ])
    expect([
      t(resolveScope({ state: 'Kelantan' })).sessions,
      t(resolveScope({ state: 'Kelantan' })).answered,
    ]).toEqual([0, 0])
    expect(overviewOf(platform(), NOW).t3).toEqual({
      active: 946,
      t4t5: 4158,
      sessions: 20_991,
      accuracy: 82.8,
    })
    expect(overviewOf(school(8080), NOW).t3).toEqual({
      active: 53,
      t4t5: 184,
      sessions: 1_002,
      accuracy: 75.6,
    })
  })

  it('Q-M12-ACTIVE 946 · 53 · 0, and per school the S5 prediction rows (9167 5, 8082 225, 8106 142, 8765 4, 8107 4)', () => {
    expect(kirkpatrick.totals().activeStudents).toBe(946)
    expect(kirkpatrick.totals(school(8080).ka).activeStudents).toBe(53)
    expect(kirkpatrick.totals(resolveScope({ state: 'Kelantan' }).ka).activeStudents).toBe(0)
    const rows = resultsOf(platform()).schools
    const active = (id: number) => rows.find((r) => r.schoolId === id)?.active
    expect([9167, 8082, 8106, 8765, 8107].map(active)).toEqual([5, 225, 142, 4, 4])
    expect(rows.reduce((s, r) => s + r.active, 0)).toBe(946)
  })

  it('Q-M12-TBL-AKTIF 951 / Q-M12-SESSION-STUDENTS 952 / TBL-SOALAN are modelled by M05, not displayed', () => {
    const t = kirkpatrick.totals()
    expect([t.servedStudents, t.sessionStudents]).toEqual([951, 952])
    expect(t.served).toBeGreaterThan(t.answered)
  })

  it('Q-M12-BANDS 513 / 259 / 169 / 5 / 3,212 · 36 / 8 / 9 / 0 / 131 and the five bands sum to T4/T5', () => {
    const counts = (o: ReturnType<typeof overviewOf>) => o.bands.map((b) => b.count)
    expect(counts(overviewOf(platform(), NOW))).toEqual([513, 259, 169, 5, 3_212])
    expect(counts(overviewOf(school(8080), NOW))).toEqual([36, 8, 9, 0, 131])
    expect(overviewOf(platform(), NOW).bands.map((b) => b.pct)).toEqual([12.3, 6.2, 4.1, 0.1, 77.2])
    expect(overviewOf(platform(), NOW).bands.map((b) => b.key)).toEqual([
      'champion',
      'konsisten',
      'berkembang',
      'minimum',
      'tidakTerlibat',
    ])
  })

  it('Q-M12-SKOR 80.3% · 73.3%', () => {
    expect(learningOf(platform()).kpi.avgScore).toBe(80.3)
    expect(learningOf(school(8080)).kpi.avgScore).toBe(73.3)
  })

  it('Q-M12-SUBJECTS: 26 rows summing to 306,133 (15 Mastered / 11 Developing); 8080: 24 rows (11 / 10 / 3)', () => {
    const p = learningOf(platform()).subjects
    expect(p).toHaveLength(26)
    expect(p.reduce((s, r) => s + r.answers, 0)).toBe(306_133)
    expect(p.filter((r) => r.status === 'Mastered')).toHaveLength(15)
    expect(p.filter((r) => r.status === 'Developing')).toHaveLength(11)
    expect(p[0]).toMatchObject({
      name: 'Pendidikan Muzik',
      accuracy: 100,
      answers: 20,
      status: 'Mastered',
    })
    expect(p.find((r) => r.name === 'Matematik')).toMatchObject({ accuracy: 70.5, answers: 19_026 })
    const s = learningOf(school(8080)).subjects
    expect(s).toHaveLength(24)
    const count = (st: string) => s.filter((r) => r.status === st).length
    expect([count('Mastered'), count('Developing'), count('Beginning')]).toEqual([11, 10, 3])
    expect(s.find((r) => r.name === 'Biologi')).toMatchObject({
      accuracy: 33.3,
      answers: 30,
      status: 'Beginning',
    })
  })

  it('S3 subject order reproduces every observed list (exact accuracy desc, then name A-Z)', () => {
    const rows = (scope: ReturnType<typeof resolveScope>) =>
      learningOf(scope).subjects.map((r) => [r.name, r.accuracy.toFixed(1) + '%', r.answers])
    // Platform: Sejarah 57,765 on 26 Sep, 57,695 on 25 Sep (the SRS pin), so compare names and accuracy only.
    expect(rows(platform()).map((r) => [r[0], r[1]])).toEqual(
      OBSERVED_SUBJECTS_PLATFORM.map((r) => [r[0], r[1]]),
    )
    expect(rows(school(8080))).toEqual(OBSERVED_SUBJECTS_8080.map((r) => [...r]))
    expect(rows(school(8080))[0]).toEqual(['Bahasa Cina', '100.0%', 10])
  })

  it('S3 tie proof: Tasawwur Islam 697/738 before Pendidikan Moral 285/302 (both 94.4) by exact accuracy', () => {
    const by = new Map(kirkpatrick.subjects(school(8080).ka).map((x) => [x.subjectId, x]))
    const tasawwur = by.get(25)
    const moral = by.get(7)
    expect([tasawwur?.correct, tasawwur?.answered]).toEqual([697, 738])
    expect([moral?.correct, moral?.answered]).toEqual([285, 302])
    // Same displayed value, different exact value: 697/738 = 94.444% > 285/302 = 94.371%.
    expect(Math.round(((697 / 738) * 1000) / 1)).toBe(944)
    expect(Math.round(((285 / 302) * 1000) / 1)).toBe(944)
    expect(697 * 302).toBeGreaterThan(285 * 738)
    const names = learningOf(school(8080)).subjects.map((r) => r.name)
    expect(names.indexOf('Tasawwur Islam')).toBe(names.indexOf('Pendidikan Moral') - 1)
  })

  it('S3: kpi and the school table in the observed order with the observed values (25-Sep drift only at 8880)', () => {
    const l = learningOf(platform())
    expect(l.kpi).toEqual({
      answers: 306_133,
      accuracy: 82.8,
      avgScore: 80.3,
      sessionsCompleted: 20_991,
      sessions: 20_991,
      completionPct: 100,
    })
    expect(l.schools.map((r) => r.schoolId)).toEqual(OBSERVED_S3.map((r) => r[0]))
    for (const [i, [id, students, answers, accuracy, subjects]] of OBSERVED_S3.entries()) {
      const row = l.schools[i]
      expect(row?.students).toBe(students)
      expect(row?.subjects).toBe(subjects)
      if (id === 8880) {
        // DV-M12-F26c-03: the 25-Sep value 90.1 (INFERRED), 70 answers fewer than 26 Sep.
        expect([row?.answers, row?.accuracy]).toEqual([71_338, 90.1])
      } else {
        expect([row?.answers, row?.accuracy]).toEqual([answers, accuracy])
      }
    }
    // DV-M12-15: Skor Purata counts answered sessions only, so the question-less session of 940 gives 0.
    expect(l.schools.find((r) => r.schoolId === 940)?.avgScore).toBe(0)
  })

  it('Q-M12-MONTH: Jan 2026 2 / 3 / 33.3 / 0; Sep (1-25) 58 / 13,968 / 87 / 28; 8080 Apr and Sep', () => {
    const c = comparisonOf(platform(), NOW)
    expect(c.subtitle).toBe('Januari 2026 vs September 2026')
    expect(c.before).toMatchObject({
      from: '2026-01-01',
      to: '2026-01-31',
      active: 2,
      accuracy: 33.3,
      answers: 3,
      champions: 0,
    })
    expect(c.after).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-25',
      active: 58,
      accuracy: 87,
      answers: 13_968,
      champions: 28,
    })
    expect(c.delta).toEqual({ active: 56, accuracy: 53.7, answers: 13_965, champions: 28 })
    expect(c.sentences).toEqual([
      'Peningkatan 53.7% dalam ketepatan jawapan.',
      '56 pelajar baru mula aktif.',
      'Jumlah jawapan meningkat 465500%.',
      '28 pelajar naik ke tahap Champion.',
    ])
    const c8 = comparisonOf(school(8080), NOW)
    expect(c8.subtitle).toBe('April 2026 vs September 2026')
    expect(c8.before).toMatchObject({ active: 12, accuracy: 71.6, answers: 511, champions: 3 })
    expect(c8.after).toMatchObject({ active: 1, accuracy: 55, answers: 60, champions: 1 })
    expect(c8.delta).toEqual({ active: -11, accuracy: -16.6, answers: -451, champions: -2 })
    expect(c8.sentences).toEqual([
      'Penurunan 16.6% dalam ketepatan jawapan.',
      '11 pelajar kurang aktif berbanding sebelumnya.',
    ])
  })

  it('a scope without any answer: "Tiada Data vs Tiada Data" and the not-enough-data sentence', () => {
    expect(comparisonOf(resolveScope({ state: 'Kelantan' }), NOW)).toEqual({
      subtitle: 'Tiada Data vs Tiada Data',
      before: null,
      after: null,
      delta: null,
      sentences: ['Data tidak mencukupi untuk perbandingan.'],
    })
  })

  it('Q-M12-HEAT: platform max 6,253 at Selasa 14:00, Isnin 06:00 944, sum 218,000; 8080 max 736 sum 12,008 43 zeros; 9167 4 cells', () => {
    const grid = behaviorOf(platform()).heat
    expect(grid.cells).toHaveLength(7)
    expect(grid.cells.every((r) => r.length === 18)).toBe(true)
    expect(grid.max).toBe(6_253)
    expect(grid.cells[1]?.[8]).toBe(6_253)
    expect(grid.cells[0]?.[0]).toBe(944)
    expect(grid.cells.flat().reduce((a, b) => a + b, 0)).toBe(218_000)
    const g8 = behaviorOf(school(8080)).heat
    expect(g8.max).toBe(736)
    expect(g8.cells.flat().reduce((a, b) => a + b, 0)).toBe(12_008)
    expect(g8.cells.flat().filter((n) => n === 0)).toHaveLength(43)
    const g9 = behaviorOf(school(9167)).heat
    expect(g9.cells.flat().filter((n) => n > 0)).toHaveLength(4)
    expect(g9.cells.flat().reduce((a, b) => a + b, 0)).toBe(116)
  })

  it('Q-M12-PRED: 946 rows, 512 A-band / 206 B / 104 C / 95 D-E / 29 G; 8080: 53 rows with Students A and B', () => {
    const p = predictionsOf(platform())
    expect(p).toHaveLength(946)
    const n = (...g: string[]) => p.filter((r) => g.includes(r.grade)).length
    expect([n('A+', 'A', 'A-'), n('B+', 'B'), n('C+', 'C'), n('D', 'E'), n('G')]).toEqual([
      512, 206, 104, 95, 29,
    ])
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1]
      const b = p[i]
      expect(
        a && b && (a.tenths > b.tenths || (a.tenths === b.tenths && a.userId < b.userId)),
      ).toBe(true)
    }
    // The first row is a 100% student (live: at school 8090). The order inside equal accuracies is not
    // observable (BR-M12-21, PROPOSED user id ascending), so the school of the first row is not asserted.
    expect(p[0]?.tenths).toBe(1000)
    const p8 = predictionsOf(school(8080))
    expect(p8).toHaveLength(53)
    expect(p8[18]).toMatchObject({ userId: 4664, answers: 219, tenths: 731, grade: 'A-' })
    expect(p8[49]).toMatchObject({ userId: 4644, answers: 70, tenths: 386, grade: 'E' })
  })

  it('Q-M12-HIST: platform 2025 · 4.30 · 180 · 10/18/24/32/32/26/21/11/5/1; 8080 2026 · 4 · one B+', () => {
    const k = resultsOf(platform())
    expect(k.kpi).toMatchObject({
      gps: 4.3,
      gpsYear: 2025,
      candidates: 180,
      pass: 174,
      passPct: 96.7,
      gradeA: 52,
      gradeAPct: 28.9,
    })
    expect(k.distribution?.rows.map((r) => r.n)).toEqual([10, 18, 24, 32, 32, 26, 21, 11, 5, 1])
    expect(k.distribution?.rows[0]).toEqual({ grade: 'A+', n: 10, pct: 5.6 })
    expect(k.distribution?.rows[9]).toEqual({ grade: 'G', n: 1, pct: 0.6 })
    const k8 = resultsOf(school(8080))
    expect(k8.kpi).toMatchObject({
      gps: 4,
      gpsYear: 2026,
      candidates: 1,
      pass: 1,
      passPct: 100,
      gradeA: 0,
      gradeAPct: 0,
      accuracy: 75.6,
      answers: 15_007,
      active: 53,
      activePct: 28.8,
      t4t5: 184,
    })
    expect(k8.distribution?.rows.map((r) => r.n)).toEqual([0, 0, 0, 1, 0, 0, 0, 0, 0, 0])
  })

  it('DC-M12-01/02 on S5 and S1: 41 "rekod" and 4,378 "Rekod Headcount", unchanged by the scope', () => {
    for (const scope of [platform(), school(8080)]) {
      expect(resultsOf(scope).kpi).toMatchObject({ recordsLabel: 41, records: 4378 })
      expect(overviewOf(scope, NOW).t4.recordsLabel).toBe(4378)
    }
  })

  it('a school without an SPM history row (9167): no GPS, no grade distribution, 0/0 candidates, no GPS insight', () => {
    const o = overviewOf(school(9167), NOW)
    expect(o.t4).toEqual({ gps: null, gpsYear: null, recordsLabel: 4378 })
    const r = resultsOf(school(9167))
    expect(r.distribution).toBeNull()
    expect(r.kpi).toMatchObject({
      gps: null,
      gpsYear: null,
      passPct: 0,
      pass: 0,
      candidates: 0,
      gradeA: 0,
      gradeAPct: 0,
    })
    expect(r.roi).toMatchObject({ active: 5, perStudent: 109, gps: null })
    expect(r.insights).toMatchObject({ gps: null, year: null, active: 5, t4t5: 8, pct: 62.5 })
  })

  it('school 8880 (G4 F5, D9 choice): GPS 2.88 with the 150 candidates, no grade distribution, no 0/0 calon', () => {
    const r = resultsOf(school(8880))
    expect(r.distribution).toBeNull()
    expect(r.kpi).toMatchObject({
      gps: 2.88,
      gpsYear: 2026,
      candidates: 150,
      pass: null,
      passPct: null,
      gradeA: null,
      gradeAPct: null,
    })
    expect(r.insights).toMatchObject({ gps: 2.88, year: 2026 })
  })

  it('S5 Trend GPS equals the M08 subjectTrend() read (live row order, Keseluruhan from the platform rows)', () => {
    const m08 = schoolSpmHistory.subjectTrend()
    const t = resultsOf(platform()).trend
    expect(t.years).toEqual([...m08.years])
    expect(
      t.rows
        .slice(1)
        .map((r) => r.name)
        .sort(),
    ).toEqual(m08.subjects.map((x) => x.name).sort())
    for (const r of t.rows.slice(1)) {
      expect(r.values).toEqual([...(m08.subjects.find((x) => x.name === r.name)?.data ?? [])])
    }
    expect(t.rows[0]?.values).toEqual(
      m08.years.map((y) => schoolSpmHistory.platform().find((p) => p.year === y)?.gps ?? null),
    )
  })

  it('S5 subject GPS (platform rows in every scope) and the trend table', () => {
    for (const scope of [platform(), school(8080)]) {
      const r = resultsOf(scope)
      expect(r.subjectGps.year).toBe(2026)
      expect(r.subjectGps.rows).toEqual([
        { name: 'Matematik', gps: 2.5, grade: 'A-', candidates: 30, prev: 4.45 },
        { name: 'Bahasa Melayu', gps: 2.8, grade: 'A-', candidates: 30, prev: 4 },
        { name: 'Sains', gps: 2.9, grade: 'A-', candidates: 30, prev: 4.7 },
        { name: 'Sejarah', gps: 3, grade: 'A-', candidates: 30, prev: 4.5 },
        { name: 'Bahasa Inggeris', gps: 3.2, grade: 'B+', candidates: 30, prev: 4.3 },
      ])
      expect(r.trend.years).toEqual([2022, 2023, 2024, 2025, 2026])
      expect(r.trend.rows.map((x) => [x.name, ...x.values])).toEqual([
        ['Keseluruhan', 5.2, 4.8, 4.5, 4.3, null],
        ['Bahasa Melayu', 4.8, 4.5, 4.2, 4, 2.8],
        ['Bahasa Inggeris', 5.2, 4.9, 4.55, 4.3, 3.2],
        ['Matematik', 5.5, 5.1, 4.75, 4.45, 2.5],
        ['Sains', 5.8, 5.4, 5, 4.7, 2.9],
        ['Sejarah', 5.6, 5.2, 4.8, 4.5, 3],
        ['Pendidikan Islam', 4.2, 3.9, 3.65, 3.4, null],
      ])
    }
  })

  it('S4 school table: observed order, students, scores; 25-Sep drift only where DV-M12-08 / F26c-04 say', () => {
    const b = behaviorOf(platform())
    expect(b.schools.map((r) => r.schoolId)).toEqual(OBSERVED_S4.map((r) => r[0]))
    // Served-but-unanswered students are "Tidak Terlibat" (DV-M12-08): one fewer "Aktif" at these five.
    const servedOnly = new Set([9167, 8082, 8106, 8765, 8107])
    // DV-M12-F26c-04: "Sesi" 8880 3,935 (live 3,947), 8107 5 (live 1), 8228 4 (live 3).
    const sessions: Record<number, number> = { 8880: 3_935, 8107: 5, 8228: 4 }
    for (const [i, [id, students, aktif, sesi, skor]] of OBSERVED_S4.entries()) {
      const row = b.schools[i]
      expect([row?.students, row?.score]).toEqual([students, skor])
      expect(row?.active).toBe(servedOnly.has(id) ? aktif - 1 : aktif)
      expect(row?.sessions).toBe(sessions[id] ?? sesi)
    }
    expect(b.schools[0]).toMatchObject({ schoolId: 9681, tahap: 'champion', perActive: 127 })
    expect(b.schools[8]).toMatchObject({ schoolId: 8078, tahap: 'konsisten' })
    const tahap = (k: string) => b.schools.filter((r) => r.tahap === k).length
    expect([
      tahap('champion'),
      tahap('konsisten'),
      tahap('berkembang'),
      tahap('minimum'),
      tahap('tidakTerlibat'),
    ]).toEqual([8, 7, 2, 4, 12])
    expect(b.kpi).toMatchObject({
      t4t5: 4158,
      active: 946,
      teacherPct: 53.1,
      teachersLoggedIn: 277,
      teachers: 522,
    })
    expect(b.moodCount).toBe(0)
  })

  it('S5 school table: observed order, faded rows, Engagement "-" only without active students and sessions', () => {
    const r = resultsOf(platform())
    expect(r.schools.map((x) => x.schoolId)).toEqual(OBSERVED_S5_ORDER)
    expect(r.schools.filter((x) => x.faded)).toHaveLength(9)
    expect(r.schools.find((x) => x.schoolId === 940)).toMatchObject({
      engagement: 2,
      faded: true,
      accuracy: null,
      answers: null,
    })
    expect(r.schools.filter((x) => x.engagement === null).map((x) => x.schoolId)).toEqual([
      987, 995, 8198, 8284, 8302, 8308, 9801, 10220,
    ])
    expect(r.schools[0]).toMatchObject({
      schoolId: 9681,
      engagement: 100,
      tahap: 'champion',
      accuracy: 56.7,
      answers: 127,
    })
  })

  it('BR-M12-14 alerts: 22 + 1 + 12 = 35 items in the three lists, school-id order, as observed (9167 62.5 per DV-M12-08)', () => {
    const { alerts } = behaviorOf(platform())
    expect(alerts).toHaveLength(35)
    const list = (n: number) => alerts.filter((a) => a.list === n)
    expect(list(1).map((a) => [a.schoolId, a.n])).toEqual(
      OBSERVED_ALERTS_NEVER.map(([id, n]) => [id, n]),
    )
    expect(list(2).map((a) => [a.schoolId, a.n])).toEqual(
      OBSERVED_ALERTS_TEACHER.map(([id, n]) => [id, n]),
    )
    expect(list(3).map((a) => [a.schoolId, a.pct])).toEqual(
      OBSERVED_ALERTS_GREEN.map(([id, pct]) => [id, id === 9167 ? 62.5 : pct]),
    )
    expect(alerts.map((a) => a.list)).toEqual([...alerts.map((a) => a.list)].sort())
    expect(list(3).find((a) => a.schoolId === 8298)).toBeUndefined()
    // 9 schools appear in both list 1 and list 3 (22 + 12 - 9 = 25 distinct).
    const inBoth = list(1).filter((a) => list(3).some((g) => g.schoolId === a.schoolId))
    expect(inBoth).toHaveLength(9)
    expect(new Set(alerts.filter((a) => a.list !== 2).map((a) => a.schoolId)).size).toBe(25)
  })

  it('FR-M12-46 alerts for a school scope and the zero state', () => {
    expect(behaviorOf(school(8080)).alerts).toEqual([])
    expect(behaviorOf(school(8098)).alerts.map((a) => [a.list, a.n ?? a.pct])).toEqual([
      [1, 1],
      [3, 100],
    ])
    expect(behaviorOf(resolveScope({ state: 'Kelantan' })).alerts).toEqual([])
  })

  it('Q-M12-T1 on S1 / S6: 336 respon, 4.6, NPS 8.3; the chain with DC-M12-03', () => {
    expect(overviewOf(platform(), NOW).t1).toEqual({ satisfaction: 4.6, responses: 336 })
    expect(overviewOf(school(8080), NOW).t1).toEqual({ satisfaction: 4.6, responses: 336 })
    const c = chainOf(platform())
    expect(c.t1).toEqual({ nps: 8.3, satisfaction: 4.6, responses: 336 })
    expect(c.t2).toEqual({ accuracy: 82.8, answers: 306_133, avgScore: 80.3 })
    expect(c.t3).toMatchObject({ active: 946, t4t5: 4158, pct: 22.8, sessions: 20_991 })
    expect(c.t4).toEqual({ gps: 4.3, r: 0.1298, strength: 'Lemah' })
    expect(c.correlation.bands).toEqual([
      { label: '1-20 soalan', n: 215, acc: 59.7 },
      { label: '51-100 soalan', n: 149, acc: 68.7 },
      { label: '100+ soalan', n: 348, acc: 75.2 },
    ])
  })

  it('BR-M12-22 ALESA platform list: 50 rows, tiles 48 / 2 / 4, grades and Keyakinan as observed, reproduced school and accuracy', () => {
    const preds = predictionsOf(platform())
    const a = alesaOf(platform(), preds)
    expect(a.rows).toHaveLength(50)
    expect([a.lulus, a.gagal, a.intervensi]).toEqual([48, 2, 4])
    const grades = (g: string) => a.rows.filter((r) => r.grade === g).length
    expect(['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E'].map(grades)).toEqual([
      6, 16, 9, 9, 3, 1, 2, 2, 2,
    ])
    const conf = (c: string) => a.rows.filter((r) => r.confidence === c).length
    expect([conf('rendah'), conf('sederhana'), conf('tinggi')]).toEqual([38, 10, 2])
    const school = new Map(preds.map((p) => [Number(p.userId), Number(p.schoolId)]))
    const got = a.rows.map((r) => `${String(school.get(Number(r.userId)))}:${String(r.accuracy)}`).sort()
    // DV-M12-F26c-03: the one 8880 student reads 87.8 in the 25-Sep model of M05 (live 26-Sep 87.7).
    const want = OBSERVED_ALESA_PLATFORM.map(([id, acc]) =>
      id === 8880
        ? `8880:${String(Math.round((acc + 0.1) * 10) / 10)}`
        : `${String(id)}:${String(acc)}`,
    ).sort()
    expect(got).toEqual(want)
    const bySchool = new Map<number, number>()
    for (const r of a.rows)
      bySchool.set(
        school.get(Number(r.userId)) as number,
        (bySchool.get(school.get(Number(r.userId)) as number) ?? 0) + 1,
      )
    expect([...bySchool].sort((x, y) => x[0] - y[0])).toEqual([
      [8080, 4],
      [8090, 28],
      [8107, 4],
      [8228, 2],
      [8277, 11],
      [8880, 1],
    ])
    // Order: grade best first, then user id ascending; no student twice.
    const order = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G']
    for (let i = 1; i < a.rows.length; i++) {
      const p = a.rows[i - 1]
      const q = a.rows[i]
      if (!p || !q) continue
      const gp = order.indexOf(p.grade)
      const gq = order.indexOf(q.grade)
      expect(gp < gq || (gp === gq && p.userId < q.userId)).toBe(true)
    }
    expect(new Set(a.rows.map((r) => r.userId)).size).toBe(50)
    // G4 F4: `observed` is false only for a substitute student (nearest rank of the school). With the current M05
    // data every stored row resolves to an exact student of its rank group (the 8880 row reads 87.8 against live
    // 87.7, the DV-M12-F26c-03 drift, which the rank group cannot see), so none is a substitute.
    expect(a.rows.filter((r) => !r.observed)).toHaveLength(0)
    expect(alesaPredictions.stored('platform')).toHaveLength(50)
  })

  it('BR-M12-22 ALESA 8080 list: 50 of 53, tiles 47 / 3 / 3, Student A absent, Student B grade C with the D/E band', () => {
    const preds = predictionsOf(school(8080))
    const a = alesaOf(school(8080), preds)
    expect(a.rows).toHaveLength(50)
    expect([a.lulus, a.gagal, a.intervensi]).toEqual([47, 3, 3])
    const grades = (g: string) => a.rows.filter((r) => r.grade === g).length
    expect(['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'E'].map(grades)).toEqual([
      3, 9, 11, 13, 7, 3, 1, 3,
    ])
    expect(a.rows.every((r) => r.observed)).toBe(true)
    expect(a.rows.some((r) => r.userId === 4664)).toBe(false)
    expect(a.rows.find((r) => r.userId === 4644)).toMatchObject({
      accuracy: 38.6,
      grade: 'C',
      cadanganBand: 'D/E',
      confidence: 'rendah',
    })
    expect(a.rows.map((r) => r.accuracy).sort((x, y) => x - y)).toEqual(
      [...OBSERVED_ALESA_8080].sort((x, y) => x - y),
    )
  })

  it('an ALESA list of any other school is generated from its active students (at most 50)', () => {
    for (const id of [8765, 8098]) {
      const preds = predictionsOf(school(id))
      const a = alesaOf(school(id), preds)
      expect(a.rows).toHaveLength(Math.min(50, preds.length))
      expect(
        a.rows.every((r) => preds.some((p) => p.userId === r.userId && p.grade === r.grade)),
      ).toBe(true)
      expect(a.rows.every((r) => !r.observed)).toBe(true)
    }
    const big = alesaOf(school(8078), predictionsOf(school(8078)))
    expect(big.rows).toHaveLength(50)
    expect(alesaOf(resolveScope({ state: 'Kelantan' }), []).rows).toEqual([])
  })

  it('ROI and insights of the platform: 946 active, 323.6 questions per student, grade A at 82.8%', () => {
    const r = resultsOf(platform())
    expect(r.roi).toEqual({ active: 946, perStudent: 323.6, accuracy: 82.8, gps: 4.3 })
    expect(r.insights).toEqual({
      active: 946,
      t4t5: 4158,
      pct: 22.8,
      accuracy: 82.8,
      grade: 'A',
      year: 2025,
      gps: 4.3,
    })
  })

  it('S8 Student A (4664): 219 answers 73.1%, 4 days, streak 1, Konsistensi 22.5, 12 headcount subjects, 3 platform rows', () => {
    const s = studentOf(4664, NOW)
    expect(s).toMatchObject({
      student: { id: 4664, name: 'Pelajar Demo 004664', grade: 11 },
      activeDays: 4,
      answers: 219,
      accuracy: 73.1,
      konsistensi: 22.5,
      streak: 1,
      strongest: { subjectName: 'Sejarah', accuracy: 78.9 },
      weakest: { subjectName: 'Matematik', accuracy: 16.7 },
    })
    expect(s?.platform).toEqual([
      { subjectName: 'Sejarah', accuracy: 78.9, answers: 190 },
      { subjectName: 'Sains', accuracy: 39.1, answers: 23 },
      { subjectName: 'Matematik', accuracy: 16.7, answers: 6 },
    ])
    expect(s?.headcount.year).toBe(2026)
    expect(s?.headcount.rows).toHaveLength(12)
    expect(s?.headcount.rows.filter((r) => r.tov !== null)).toEqual([
      { subjectName: 'Pendidikan Islam', tov: 78 },
    ])
    const names = s?.headcount.rows.map((r) => r.subjectName) ?? []
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms')))
  })

  it('S8 Student B (4644): 70 answers 38.6%, 3 days, Konsistensi 21.1, 11 headcount subjects with the six observed TOV', () => {
    const s = studentOf(4644, NOW)
    expect(s).toMatchObject({
      activeDays: 3,
      answers: 70,
      accuracy: 38.6,
      konsistensi: 21.1,
      streak: 1,
    })
    expect(s?.platform.map((p) => p.accuracy)).toEqual([60, 55, 40, 33.3, 20, 0])
    expect(s?.strongest).toMatchObject({ subjectName: 'Bahasa Melayu', accuracy: 60 })
    expect(s?.weakest).toMatchObject({ subjectName: 'Sejarah', accuracy: 0 })
    expect(s?.headcount.rows).toHaveLength(11)
    expect(
      s?.headcount.rows
        .filter((r) => r.tov !== null)
        .map((r) => r.tov)
        .sort((a, b) => (a as number) - (b as number)),
    ).toEqual([20, 33.33, 37, 40, 55, 60])
  })

  it('S8 for a student without a session is the zero state; a non-student user or a missing id is null (403)', () => {
    expect(studentOf(2, NOW)).toMatchObject({
      student: { id: 2 },
      activeDays: 0,
      answers: 0,
      accuracy: 0,
      konsistensi: 0,
      streak: 0,
      strongest: null,
      weakest: null,
      platform: [],
    })
    expect(studentOf(1, NOW)).toBeNull()
    expect(studentOf(5, NOW)).toBeNull()
    expect(studentOf(987_654_321, NOW)).toBeNull()
    // XR-M12-10 / DV-M12-25: the live second ids are not users (M01/M02), so S8 gives 403.
    expect(studentOf(5571, NOW)).toBeNull()
    expect(studentOf(5551, NOW)).toBeNull()
  })

  it('S9 for the admin: no headcount, 30 gray squares from 27/08 to 25/09', () => {
    const m = myOf(1, NOW)
    expect(m.headcount).toBeNull()
    expect(m.days).toHaveLength(30)
    expect(m.days[0]).toEqual({ date: '27/08', answers: 0 })
    expect(m.days[29]).toEqual({ date: '25/09', answers: 0 })
    expect(m.days.every((d) => d.answers === 0)).toBe(true)
  })

  it('S9 counts the viewer answers per day (M05 answer log)', () => {
    const m = myOf(2, NOW)
    expect(m.days).toHaveLength(30)
    expect(m.days.every((d) => Number.isInteger(d.answers) && d.answers >= 0)).toBe(true)
    expect(m.headcount).toBeNull()
  })

  it('S9 shows the Head Count rows for a viewer with a TOV this year (Student A)', () => {
    const m = myOf(4664, NOW)
    expect(m.headcount?.year).toBe(2026)
    expect(m.headcount?.rows).toHaveLength(12)
  })
})
