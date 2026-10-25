/**
 * M11-T1 endpoints #3 (S2 overview) and #7 (export) over the real owners (SRS M11 v1.10 §6.7, §7, §9):
 * every observed S2 figure of the 2026-09-25 snapshot is reproduced from the M01 / M02 / M05 datasets
 * (KPIs per period and state, tahap counts, both tables, the weekly table cell by cell, the signal lists),
 * BR-M11-34 (fixture schools out of the rollups), the flags (52 / 35), a runtime school (AC-M11-14.7),
 * and the guards (401 / 403 / 422, the school admin forced to its own school).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { practice } from '@/modules/m05-practice/mock'

import type { MonitoringExport, MonitoringOverview } from '../../api/types'
import { FLAG_COUNTS } from '../../mock/data/settings'
import { monitoring } from '../../mock'
import { ADMIN, ADMIN_SEKOLAH, GURU, MemoryStorage, PELAJAR, bootM11, dataAs, getAs } from './boot'

let runtime: MockRuntime
let now: number

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  const booted = await bootM11()
  runtime = booted.runtime
  now = booted.clock.now()
}, 300_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const overview = (query = '', as: number | null = ADMIN) =>
  dataAs<MonitoringOverview>(runtime, as, `/api/monitoring/overview${query}`)

const kpiOf = (o: MonitoringOverview) => [
  o.kpi.schools,
  o.kpi.students,
  o.kpi.engaged,
  o.kpi.engagementPct,
  o.kpi.answers,
  o.kpi.avgPerStudent,
  o.kpi.teachers,
  o.kpi.teachersLoggedIn,
  o.kpi.teacherPct,
]

const FIXTURE = (id: number) => id >= 900001 && id <= 900099

describe('KPIs (FR-M11-35/36, BR-M11-09; E2E-M11-22/23/51)', () => {
  it('default: 57 · 4,158 · 1,462 · 35.2% · 472,371 · 323.1 · 522 · 277 · 53.1%', async () => {
    expect(kpiOf(await overview())).toEqual([57, 4158, 1462, 35.2, 472371, 323.1, 522, 277, 53.1])
  })

  it('period 7d: 44 active · 1.1% · 7,651 answers · 173.9 per pupil', async () => {
    const o = await overview('?period=7d')
    expect(kpiOf(o)).toEqual([57, 4158, 44, 1.1, 7651, 173.9, 522, 277, 53.1])
    expect(o.filters.period).toBe('7d')
  })

  it('period 30d keeps the observed 22,207 answers (the active pupils: see the next two tests)', async () => {
    const o = await overview('?period=30d')
    expect(o.kpi.answers).toBe(22207)
    expect(o.kpi.students).toBe(4158)
  })

  it('period 30d: 89 active · 2.1% · 22,207 · 249.5 per pupil', async () => {
    expect(kpiOf(await overview('?period=30d'))).toEqual([
      57, 4158, 89, 2.1, 22207, 249.5, 522, 277, 53.1,
    ])
  })

  it('period 3m: 298 · 7.2% · 86,697 · 290.9', async () => {
    expect(kpiOf(await overview('?period=3m'))).toEqual([
      57, 4158, 298, 7.2, 86697, 290.9, 522, 277, 53.1,
    ])
  })

  it('an unknown period is all time (INFERRED)', async () => {
    const o = await overview('?period=999d')
    expect(o.filters.period).toBe('')
    expect(o.kpi.answers).toBe(472371)
  })

  it('state=Selangor & tahap=Kritikal: the tahap filter leaves the KPIs alone', async () => {
    const o = await overview('?state=Selangor&tahap=Kritikal')
    expect(kpiOf(o).slice(1)).toEqual([4042, 1424, 35.2, 460858, 323.6, 517, 273, 52.8])
    expect(o.studentRows.map((r) => r.schoolId)).toEqual([8102, 8107])
    expect(o.teacherRows).toHaveLength(10)
    expect(o.weekly).toHaveLength(21)
  })

  it('Jumlah Sekolah of a state is the M01 / M02 count of its schools with users', async () => {
    const o = await overview('?state=Selangor')
    const expected = users
      .schoolsWithUsers({ excludeFixtures: true })
      .filter((id) => schools.get(id)?.state === 'Selangor').length
    expect(o.kpi.schools).toBe(expected)
  })

  it('characterisation: Selangor has 25 schools with users today (observed 28)', async () => {
    expect((await overview('?state=Selangor&tahap=Kritikal')).kpi.schools).toBe(25)
  })

  // Observed 28 (E2E-M11-23); the M01 / M02 users allocation puts 25 Selangor schools in the register. The
  // total 57 and Johor's 7 hold. Owner: M02 (XR-M11-02/03). Flips to a pass when the allocation is fixed.
  it.fails('Selangor "Jumlah Sekolah" is the observed 28 (M02 allocation gap)', async () => {
    expect((await overview('?state=Selangor&tahap=Kritikal')).kpi.schools).toBe(28)
  })

  it('state=Johor: 7 · 84 · 37 · 44% · 10,418 · 281.6 · 2 · 1 · 50%', async () => {
    expect(kpiOf(await overview('?state=Johor'))).toEqual([7, 84, 37, 44, 10418, 281.6, 2, 1, 50])
  })

  it('Kelantan + Cemerlang: empty tables, signals and weekly; Jumlah Sekolah keeps its count', async () => {
    const o = await overview('?state=Kelantan&tahap=Cemerlang')
    expect(o.studentRows).toEqual([])
    expect(o.teacherRows).toEqual([])
    expect(o.weekly).toEqual([])
    expect(o.signals).toEqual({ best: [], attention: [], suggestions: [] })
    expect(kpiOf(o).slice(1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect(o.kpi.schools).toBeGreaterThan(0)
  })

  it('an unknown state or tahap gives an empty result (FR-M11-51)', async () => {
    expect((await overview('?state=Narnia')).studentRows).toEqual([])
    expect((await overview('?tahap=Hebat')).studentRows).toEqual([])
  })
})

describe('student table (FR-M11-38, BR-M11-12/13/34; E2E-M11-24)', () => {
  it('33 schools in table order: percentage descending, ties by school id', async () => {
    const o = await overview()
    expect(o.studentRows.map((r) => r.schoolId)).toEqual([
      940, 987, 995, 8098, 8284, 8080, 8078, 8082, 8880, 8106, 8298, 10220, 1014, 8765, 8090, 8087,
      8102, 8107, 7780, 8030, 8198, 8228, 8277, 8300, 8302, 8308, 8767, 8772, 8965, 9167, 9681,
      9801, 9806,
    ])
  })

  it('row 6 is 8080: 184 registered, 174 active, 94.6%, Cemerlang', async () => {
    const o = await overview()
    expect(o.studentRows[5]).toMatchObject({
      schoolId: 8080,
      state: 'Selangor',
      registered: 184,
      engaged: 174,
      pct: 94.6,
      tahap: 'Cemerlang',
    })
  })

  it('tahap counts 8 / 7 / 1 / 2 / 15', async () => {
    const o = await overview()
    const count = (t: string) => o.studentRows.filter((r) => r.tahap === t).length
    expect(['Cemerlang', 'Sederhana', 'Rendah', 'Kritikal', 'Tiada Langsung'].map(count)).toEqual([
      8, 7, 1, 2, 15,
    ])
  })

  it('schools without a code have code null (9681, 9801)', async () => {
    const o = await overview()
    const noCode = o.studentRows.filter((r) => r.code === null).map((r) => r.schoolId)
    expect(noCode.sort((a, b) => a - b)).toEqual([9681, 9801])
  })

  it('characterisation: 8300 carries a generated code today', async () => {
    const o = await overview()
    expect(typeof o.studentRows.find((r) => r.schoolId === 8300)?.code).toBe('string')
  })

  // The register of M02 gives 8300 a generated code; observed: no code (E2E-M11-24, XR-M11-03). Owner: M02.
  it.fails('8300 has no code either (M02 register gap)', async () => {
    const o = await overview()
    expect(o.studentRows.find((r) => r.schoolId === 8300)?.code).toBeNull()
  })

  it('period 7d / 30d re-orders by the period percentage (first rows 8284, then 8080)', async () => {
    const d7 = await overview('?period=7d')
    expect(d7.studentRows.slice(0, 2).map((r) => [r.schoolId, r.engaged, r.pct])).toEqual([
      [8284, 1, 100],
      [8080, 12, 6.5],
    ])
    const d30 = await overview('?period=30d')
    expect(d30.studentRows.slice(0, 2).map((r) => r.schoolId)).toEqual([8284, 8080])
  })

  it('30d 8080 is 18 / 184, 9.8%', async () => {
    const d30 = await overview('?period=30d')
    expect(d30.studentRows[1]).toMatchObject({ schoolId: 8080, engaged: 18, pct: 9.8 })
  })

  it('tahap filter keeps only that tahap in the student table (BR-M11-14)', async () => {
    const o = await overview('?tahap=Rendah')
    expect(o.studentRows.map((r) => r.schoolId)).toEqual([8087])
    expect(o.teacherRows).toHaveLength(13)
  })

  it('BR-M11-34: no fixture school in any rollup', async () => {
    const o = await overview()
    const ids = [
      ...o.studentRows.map((r) => r.schoolId),
      ...o.teacherRows.map((r) => r.schoolId),
      ...o.weekly.map((r) => r.schoolId),
      ...o.signals.best.map((s) => s.schoolId),
      ...o.signals.attention.map((s) => s.schoolId),
    ]
    expect(ids.some(FIXTURE)).toBe(false)
    expect(o.kpi.schools).toBe(57)
  })
})

describe('teacher table (FR-M11-41; E2E-M11-25)', () => {
  it('13 schools in the observed order with logged-in / registered', async () => {
    const o = await overview()
    expect(o.teacherRows.map((r) => [r.schoolId, r.loggedIn, r.registered])).toEqual([
      [5183, 1, 1],
      [8080, 34, 34],
      [8300, 1, 1],
      [10220, 2, 2],
      [8078, 53, 60],
      [8082, 51, 68],
      [8277, 16, 29],
      [8090, 42, 83],
      [8880, 1, 2],
      [8102, 42, 118],
      [8106, 18, 60],
      [8087, 12, 44],
      [8107, 4, 20],
    ])
  })

  it('the teacher table ignores the period and the tahap', async () => {
    const all = await overview()
    const filtered = await overview('?period=7d&tahap=Kritikal')
    expect(filtered.teacherRows).toEqual(all.teacherRows)
  })
})

describe('weekly tracking (FR-M11-43, BR-M11-15; E2E-M11-26/27)', () => {
  it('32 weeks M1 … M32 and 33 rows in the observed order', async () => {
    const o = await overview()
    expect(o.weeks).toHaveLength(32)
    expect(o.weeks[0]).toEqual({ k: 1, from: '16/02', to: '22/02' })
    expect(o.weeks[31]).toEqual({ k: 32, from: '21/09', to: '25/09' })
    expect(o.weekly.map((r) => r.schoolId)).toEqual([
      8082, 8090, 8078, 8106, 8080, 8880, 8087, 8102, 10220, 8765, 1014, 987, 8098, 8107, 995, 940,
      8298, 8284, 7780, 8030, 8198, 8228, 8277, 8300, 8302, 8308, 8767, 8772, 8965, 9167, 9681,
      9801, 9806,
    ])
    expect(o.weekly.every((r) => r.cells.length === 32)).toBe(true)
  })

  it('8080: M12 2,637 up, M13 315 down, M16 zero, M18 37,748 best, M29 equal (blue), M32 552 down', async () => {
    const w = (await overview()).weekly.find((r) => r.schoolId === 8080)
    const cell = (k: number) => w?.cells[k - 1]
    expect(cell(12)).toMatchObject({ count: 2637, cls: 'up', best: false })
    expect(cell(13)).toMatchObject({ count: 315, cls: 'down' })
    expect(cell(16)).toMatchObject({ count: 0, cls: 'zero' })
    expect(cell(17)).toMatchObject({ count: 352, cls: 'up' })
    expect(cell(18)).toMatchObject({ count: 37748, cls: 'up', best: true })
    expect(cell(28)).toMatchObject({ count: 150, cls: 'up' })
    expect(cell(29)).toMatchObject({ count: 150, cls: 'first' })
    expect(cell(32)).toMatchObject({ count: 552, cls: 'down' })
    expect(w?.trend).toBe('down')
    expect(w?.best).toEqual({ k: 18, count: 37748 })
  })

  it('8090 M1 268 is blue; 8284 M32 5 is green and trends up', async () => {
    const o = await overview()
    expect(o.weekly.find((r) => r.schoolId === 8090)?.cells[0]).toMatchObject({
      count: 268,
      cls: 'first',
    })
    const r = o.weekly.find((x) => x.schoolId === 8284)
    expect(r?.cells[31]).toMatchObject({ count: 5, cls: 'up' })
    expect(r?.trend).toBe('up')
    expect(r?.best).toEqual({ k: 32, count: 5 })
  })

  it('trends 2 up / 4 down / 27 same; rows without answers have no best', async () => {
    const o = await overview()
    const n = (t: string) => o.weekly.filter((r) => r.trend === t).length
    expect([n('up'), n('down'), n('same')]).toEqual([2, 4, 27])
    const empty = o.weekly.find((r) => r.schoolId === 7780)
    expect(empty?.best).toBeNull()
    expect(empty?.cells.every((c) => c.cls === 'zero' && !c.best)).toBe(true)
  })

  it('the weekly cells of every school add up to its answers (the 12 before M1 are week 0)', async () => {
    const o = await overview()
    const total = o.weekly.reduce((a, r) => a + r.cells.reduce((b, c) => b + c.count, 0), 0)
    expect(total).toBe(472371 - 12)
  })

  it('the weekly table ignores the period and the tahap, not the state', async () => {
    const all = await overview()
    expect((await overview('?period=7d&tahap=Kritikal')).weekly).toEqual(all.weekly)
    expect((await overview('?state=Selangor')).weekly).toHaveLength(21)
  })
})

describe('signals (FR-M11-45…48, BR-M11-16; E2E-M11-28/29)', () => {
  it('default: best 940, 987, 995; 18 attention; 17 suggestions', async () => {
    const o = await overview()
    expect(o.signals.best.map((s) => s.schoolId)).toEqual([940, 987, 995])
    expect(o.signals.attention.map((s) => [s.schoolId, s.kind])).toEqual([
      [8087, 'rendah'],
      [8102, 'kritikal'],
      [8107, 'kritikal'],
      ...[
        7780, 8030, 8198, 8228, 8277, 8300, 8302, 8308, 8767, 8772, 8965, 9167, 9681, 9801, 9806,
      ].map((id) => [id, 'tiada']),
    ])
    expect(o.signals.suggestions).toHaveLength(17)
  })

  it('Nota: 8277 has 16 logged-in teachers on the S2 table (its S3 card shows 17), 8300 has 1', async () => {
    const o = await overview()
    const nota = o.signals.attention.filter((s) => s.teachersLoggedIn > 0 && s.kind === 'tiada')
    expect(nota.map((s) => [s.schoolId, s.teachersLoggedIn])).toEqual([
      [8277, 16],
      [8300, 1],
    ])
  })

  it('suggestion templates: 2 motivasi (Kritikal), 2 handsOn, 13 hubungi', async () => {
    const o = await overview()
    const n = (k: string) => o.signals.suggestions.filter((s) => s.kind === k).length
    expect([n('motivasi'), n('handsOn'), n('hubungi')]).toEqual([2, 2, 13])
    expect(
      o.signals.suggestions.filter((s) => s.kind === 'motivasi').map((s) => s.schoolId),
    ).toEqual([8102, 8107])
  })

  it('period lists: 7d 1 / 32 / 31 (best 8284), 30d 1 / 32 / 31, 3m 2 / 29 / 26', async () => {
    const lens = (o: MonitoringOverview) => [
      o.signals.best.length,
      o.signals.attention.length,
      o.signals.suggestions.length,
    ]
    const d7 = await overview('?period=7d')
    expect(lens(d7)).toEqual([1, 32, 31])
    expect(d7.signals.best[0]?.schoolId).toBe(8284)
    const first = d7.signals.attention[0]
    expect([first?.schoolId, first?.engaged, first?.registered, first?.pct]).toEqual([
      8080, 12, 184, 6.5,
    ])
    expect(lens(await overview('?period=30d'))).toEqual([1, 32, 31])
    expect(lens(await overview('?period=3m'))).toEqual([2, 29, 26])
  })
})

describe('flags (DATA-M11-01, §6.2)', () => {
  it('52 review + 35 excluded, per school as observed, on pupils who answered', () => {
    const flags = monitoring.flags()
    expect(flags.filter((f) => f.level === 'review')).toHaveLength(52)
    expect(flags.filter((f) => f.level === 'excluded')).toHaveLength(35)
    const counts = monitoring.flagCounts()
    for (const [school, [review, excluded]] of Object.entries(FLAG_COUNTS)) {
      expect(counts.get(Number(school))).toEqual({ review, excluded })
    }
    expect(counts.size).toBe(Object.keys(FLAG_COUNTS).length)
    for (const f of flags) {
      expect(users.get(f.userId)?.lastLoginAt).not.toBeNull()
    }
  })
})

describe('#7 export (PROPOSED) and the guards', () => {
  it('csv rows are the student table of the filters', async () => {
    const e = await dataAs<MonitoringExport>(
      runtime,
      ADMIN,
      '/api/monitoring/export?format=csv&state=Selangor&tahap=Kritikal',
    )
    expect(e.filename).toBe('monitoring-penglibatan.csv')
    expect(e.rows.map((r) => r.schoolId)).toEqual([8102, 8107])
    const all = await dataAs<MonitoringExport>(runtime, ADMIN, '/api/monitoring/export?format=pdf')
    expect(all.filename).toBe('monitoring-penglibatan.pdf')
    expect(all.rows).toHaveLength(33)
  })

  it('422 for a missing or unknown format, with the field error', async () => {
    for (const q of ['', '?format=xlsx', '?format=']) {
      const r = await getAs<{ error: { code: string; fields?: Record<string, string> } }>(
        runtime,
        ADMIN,
        `/api/monitoring/export${q}`,
      )
      expect(r.status).toBe(422)
      expect(r.body.error.code).toBe('VALIDATION_ERROR')
      expect(Object.keys(r.body.error.fields ?? {})).toEqual(['format'])
    }
  })

  it.each(['/api/monitoring/overview', '/api/monitoring/export?format=csv'])(
    '401 for a guest and 403 for a pupil: %s',
    async (url) => {
      expect((await getAs(runtime, null, url)).status).toBe(401)
      expect((await getAs(runtime, PELAJAR, url)).status).toBe(403)
    },
  )

  it('the teacher sees the same monitoring data (provisional, OQ-M11-02)', async () => {
    expect(await overview('', GURU)).toEqual(await overview())
  })

  it('school admin: forced to the own school (SMK DEMO 900001, INFERRED alias scope)', async () => {
    const o = await overview('', ADMIN_SEKOLAH)
    expect(o.studentRows.map((r) => r.schoolId)).toEqual([900001])
    expect(o.teacherRows.map((r) => r.schoolId)).toEqual([900001])
    expect(o.weekly.map((r) => r.schoolId)).toEqual([900001])
    expect(o.kpi.schools).toBe(1)
    // 9 pupils + pelajarmaju, who joined SMK DEMO on D54.
    expect(o.kpi.students).toBe(10)
    expect(o.kpi.engaged).toBe(10)
    expect(o.kpi.teachers).toBe(1)
    // The filters still apply inside the scope; the other schools never appear.
    expect((await overview('?state=Johor', ADMIN_SEKOLAH)).studentRows).toEqual([])
    const exp = await dataAs<MonitoringExport>(
      runtime,
      ADMIN_SEKOLAH,
      '/api/monitoring/export?format=csv',
    )
    expect(exp.rows.map((r) => r.schoolId)).toEqual([900001])
  })

  it('a school admin without a school sees an empty view', () => {
    const o = monitoring.overview({}, { now, scopeSchoolId: 0 })
    expect(o.studentRows).toEqual([])
    expect(o.kpi.schools).toBe(0)
  })
})

describe('a runtime school is counted (BR-M11-34, AC-M11-14.7, E2E-M11-54)', () => {
  it('shows in both tables, the KPIs and the weekly table', async () => {
    const before = await overview()
    const t = runtime.clock.now()
    const school = schools.create(
      {
        name: 'SMK UJIAN RUNTIME',
        code: 'UJI9001',
        type: 'SMK',
        state: 'Selangor',
        isActive: true,
      },
      t,
    )
    expect(school.id).toBeGreaterThanOrEqual(10301)
    const pupil = users.create(
      {
        name: 'Pelajar Runtime Demo',
        email: 'pelajar-runtime@demo.test',
        role: 'student',
        grade: 11,
        schoolId: school.id,
      },
      t,
    )
    const teacher = users.create(
      {
        name: 'Guru Runtime Demo',
        email: 'guru-runtime@demo.test',
        role: 'teacher',
        schoolId: school.id,
      },
      t,
    )
    users.recordLogin(pupil.id, t)
    users.recordLogin(teacher.id, t)
    for (let i = 0; i < 5; i++) {
      practice.addAnswer({ userId: pupil.id, questionId: 700401, isCorrect: true }, t)
    }

    const o = await overview()
    expect(o.kpi).toMatchObject({
      schools: before.kpi.schools + 1,
      students: 4159,
      engaged: 1463,
      answers: 472376,
      teachers: 523,
    })
    const row = o.studentRows.find((r) => r.schoolId === school.id)
    expect(row).toMatchObject({ registered: 1, engaged: 1, pct: 100, tahap: 'Cemerlang' })
    // After the 1 / 1 schools with lower ids (940, 987, 995, 8098, 8284), before 8080.
    expect(o.studentRows.slice(0, 7).map((r) => r.schoolId)).toEqual([
      940,
      987,
      995,
      8098,
      8284,
      school.id,
      8080,
    ])
    expect(o.teacherRows.find((r) => r.schoolId === school.id)).toMatchObject({
      registered: 1,
      loggedIn: 1,
    })
    expect(o.weekly.find((r) => r.schoolId === school.id)?.cells[31]).toMatchObject({ count: 5 })
    const detail = await dataAs<{ cards: { students: number } }>(
      runtime,
      ADMIN,
      `/api/monitoring/schools/${String(school.id)}`,
    )
    expect(detail.cards.students).toBe(1)
  })
})
