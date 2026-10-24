/**
 * M08-T1b seed anchors (SRS M08 v1.12 §6.3, §6.4, §6.10): the headcount configs and entries against the
 * observed figures, through the repository contracts other modules read (M12 `headcountEntries`, M17
 * `headcount.get`, M18 `headcount.entries`) and the reader of the headcount port.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import { headcount, headcountEntries } from '../../mock'
import { headcountReads, latestAr, pairStatus } from '../../mock/repository/headcount-port'
import { gpsOf } from '../../mock/repository/performance'
import { MemoryStorage, bootM08 } from './boot'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM08()).runtime
}, 180_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G']

describe('the reader of the headcount port', () => {
  it('is registered by the T1b seed: 744 graded entries, GPS 3.45', () => {
    const graded = headcountReads.entries().filter((e) => latestAr(e) !== null)
    expect(graded).toHaveLength(744)
    expect(gpsOf(headcountReads.entries())).toEqual({ value: 3.45, entries: 744 })
  })

  it('every entry of the reader belongs to a config of the store', () => {
    const ids = new Set(headcount.configs().map((c) => c.id))
    for (const e of headcountReads.entries()) expect(ids.has(e.configId)).toBe(true)
  })

  it('level 10 holds the 75 pairs of class 516 (34 / 41); level 11 holds 403 (114 / 289)', () => {
    const entries = headcountReads.entries()
    const by = (level: number) => entries.filter((e) => e.levelId === level)
    const on = (rows: typeof entries) =>
      rows.filter((e) => latestAr(e) !== null && pairStatus(e) === 'on')
    expect(by(10)).toHaveLength(75)
    expect(on(by(10))).toHaveLength(34)
    expect(by(11)).toHaveLength(403)
    expect(on(by(11))).toHaveLength(114)
    // The remaining graded entries sit in configs of the other levels (Persediaan Auto levels 1-9).
    const other = entries.filter((e) => e.levelId < 10)
    expect(other).toHaveLength(330)
    expect(other.every((e) => latestAr(e) !== null)).toBe(true)
  })
})

describe('class 516 "4 Simulasi" (configs 209-213)', () => {
  it('five auto configs of 3 OTR, 2026, 15 pupils each, newest first Sejarah, Matematik, BM, Sains, BI', () => {
    const configs = [209, 210, 211, 212, 213].map((id) => headcount.config(id))
    expect(configs.map((c) => [c?.subjectId, c?.activeOtrs, c?.mode, c?.academicYear])).toEqual([
      [1, 3, 'auto', 2026],
      [2, 3, 'auto', 2026],
      [3, 3, 'auto', 2026],
      [4, 3, 'auto', 2026],
      [5, 3, 'auto', 2026],
    ])
    for (const id of [209, 210, 211, 212, 213]) {
      expect(headcount.entriesOf(id)).toHaveLength(15)
    }
    const order = headcount
      .configsOfClass(516)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((c) => c.subjectId)
    expect(order).toEqual([5, 3, 1, 4, 2])
  })

  it('config 213 mirrors the 15 live TOV / AR3 pairs; OTR targets = TOV + 5 / 10 / 15; ETR = AR3', () => {
    const live: [number, number, number][] = [
      [3204, 73, 93],
      [3205, 76, 91],
      [3206, 69, 90],
      [3207, 68, 81],
      [3208, 63, 80],
      [3209, 54, 77],
      [3210, 74, 75],
      [3211, 55, 73],
      [3202, 68, 65],
      [3212, 54, 65],
      [3213, 64, 64],
      [3214, 59, 61],
      [3203, 46, 57],
      [3201, 67, 56],
      [3215, 42, 51],
    ]
    const rows = new Map(headcount.entriesOf(213).map((e) => [e.studentId, e]))
    for (const [pupil, tov, ar] of live) {
      const e = rows.get(pupil)
      expect(e, `pupil ${String(pupil)}`).toMatchObject({
        tov,
        targets: [tov + 5, tov + 10, tov + 15],
        actuals: [null, null, ar],
        etr: ar,
      })
    }
    // Computed averages: TOV 932 / 15 = 62.1, AR3 1,079 / 15 = 71.9, gaps give 6 of 15 AR >= OTR3.
    const all = [...rows.values()]
    const mean = (f: (e: (typeof all)[number]) => number) => all.reduce((a, e) => a + f(e), 0) / 15
    expect(Math.round(mean((e) => e.tov as number) * 10) / 10).toBe(62.1)
    expect(Math.round(mean((e) => e.actuals[2] as number) * 10) / 10).toBe(71.9)
    expect(all.filter((e) => (e.actuals[2] as number) >= (e.targets[2] as number))).toHaveLength(6)
  })

  it('the S15 anchors of 3201 - 3203 keep RS, recorded date and observed chips', () => {
    const rows = new Map(headcount.entriesOf(213).map((e) => [e.studentId, e]))
    expect(rows.get(3201)).toMatchObject({
      rs: 56.4,
      rsRecordedAt: '2026-04-13',
      trendOverride: 'Menurun',
      confidenceOverride: 'Rendah',
    })
    expect(rows.get(3202)).toMatchObject({ rs: 35.1, trendOverride: 'Stabil' })
    expect(rows.get(3203)).toMatchObject({ rs: 47, trendOverride: 'Meningkat' })
  })

  it('per config: BM 11 / 3 / 1, BI 5 / 10 / 0, MATH 6 / 9 / 0, SCI 6 / 1 / 8, SEJ 6 / 9 / 0 (on / below / no target)', () => {
    const count = (id: number) => {
      let on = 0
      let below = 0
      let none = 0
      for (const e of headcountReads.entries().filter((x) => x.configId === id)) {
        const l = latestAr(e)
        if (l === null || l.target === null) none++
        else if (l.ar >= l.target) on++
        else below++
      }
      return [on, below, none]
    }
    expect(count(209)).toEqual([11, 3, 1])
    expect(count(210)).toEqual([5, 10, 0])
    expect(count(211)).toEqual([6, 9, 0])
    expect(count(212)).toEqual([6, 1, 8])
    expect(count(213)).toEqual([6, 9, 0])
  })

  it('3201 BM 58 → 60 on track, BI 51 → 74, MATH 55 → 65 (target 70), SCI TOV 70.2 AR3 61 without targets', () => {
    const of = (cfg: number) => headcount.entriesOf(cfg).find((e) => e.studentId === 3201)
    expect(of(209)).toMatchObject({ tov: 58, actuals: [null, null, 60] })
    expect(of(210)).toMatchObject({ tov: 51, actuals: [null, null, 74] })
    expect(of(211)).toMatchObject({ tov: 55, targets: [60, 65, 70], actuals: [null, null, 65] })
    expect(of(212)).toMatchObject({
      tov: 70.2,
      targets: [null, null, null],
      actuals: [null, null, 61],
    })
  })

  it('pupils 3212 and 3215 have no on-track pair, the other 13 at least one', () => {
    const on = new Set<number>()
    const all = new Set<number>()
    for (const e of headcountReads.entries().filter((x) => x.classroomId === 516)) {
      all.add(e.studentId)
      if (pairStatus(e) === 'on') on.add(e.studentId)
    }
    expect(all.size).toBe(15)
    expect([...all].filter((id) => !on.has(id)).sort()).toEqual([3212, 3215])
  })
})

describe('designed configs 501 - 506 (teacher 5, SMK DEMO)', () => {
  it('six configs, updatedAt newest first 504, 501, 502, 503, 505, 506', () => {
    expect(headcount.configsOfTeacher(5).map((c) => c.id)).toEqual([504, 501, 502, 503, 505, 506])
    expect(headcount.config(505)).toMatchObject({ academicYear: 2025, mode: 'manual' })
    expect(headcount.config(506)).toMatchObject({ educationLevelId: 10, activeOtrs: 2 })
    expect(headcount.entriesOf(506)).toEqual([])
  })

  it('the marks of §6.10', () => {
    const of = (cfg: number, pupil: number) =>
      headcount.entriesOf(cfg).find((e) => e.studentId === pupil)
    expect(of(501, 3001)).toMatchObject({
      tov: 60,
      targets: [62, 66, 70],
      actuals: [65, 70, null],
      etr: 75,
    })
    expect(of(501, 3004)).toMatchObject({
      tov: 40,
      targets: [45, null, null],
      actuals: [30, null, null],
    })
    expect(of(502, 3001)).toMatchObject({ tov: 64, actuals: [null, null, null] })
    expect(headcount.entriesOf(503)).toHaveLength(8)
    expect(of(503, 3001)?.tov).toBe(58)
    expect(of(504, 3001)).toMatchObject({ tov: 50, targets: [55, 60], actuals: [40, 45], etr: 65 })
    expect(of(505, 3001)).toMatchObject({ actuals: [68, 72, 78], etr: 80, rs: 82 })
  })

  it('school 900001 holds exactly the 6 graded entries A-, C, C, G, D, A- (GPS 5.33)', () => {
    const e = headcount.entries({ pupilSchoolIds: [900001], graded: true })
    expect(e).toHaveLength(6)
    expect(e.map((x) => x.grade).sort()).toEqual(['A-', 'A-', 'C', 'C', 'D', 'G'])
    const points = e.reduce((a, x) => a + GRADES.indexOf(x.grade as string), 0)
    expect(Math.round((points / 6) * 100) / 100).toBe(5.33)
  })
})

describe('school 8880 (M18 S27 pins)', () => {
  const e8880 = () => headcount.entries({ pupilSchoolIds: [8880], graded: true })

  it('148 graded entries with the grade counts A+ 4 · A 36 · A- 42 · B+ 36 · B 18 · C+ 6 · C 4 · D 1 · E 1 · G 0', () => {
    const rows = e8880()
    expect(rows).toHaveLength(148)
    const counts = GRADES.map((g) => rows.filter((r) => r.grade === g).length)
    expect(counts).toEqual([4, 36, 42, 36, 18, 6, 4, 1, 1, 0])
    expect(gpsOf(rows).value).toBe(2.49)
  })

  it('the six subject rows (entries · GPS · on / below / no target)', () => {
    const rows = e8880()
    const row = (subjectId: number) => {
      const list = rows.filter((r) => r.subjectId === subjectId)
      let on = 0
      let below = 0
      let none = 0
      for (const e of list) {
        const l = latestAr(e)
        if (l === null || l.target === null) none++
        else if (l.ar >= l.target) on++
        else below++
      }
      return [list.length, gpsOf(list).value, on, below, none]
    }
    expect(row(2)).toEqual([28, 2.21, 13, 15, 0])
    expect(row(3)).toEqual([41, 2.41, 19, 22, 0])
    expect(row(1)).toEqual([24, 2.58, 20, 3, 1])
    expect(row(5)).toEqual([20, 2.6, 9, 11, 0])
    expect(row(4)).toEqual([34, 2.65, 16, 9, 9])
    expect(row(9)).toEqual([1, 4, 1, 0, 0])
  })

  it('contains the 75 class-516 entries and 73 T5 entries of 8880 pupils (class 517, 540, 628)', () => {
    const rows = e8880()
    expect(rows.filter((r) => r.levelId === 10)).toHaveLength(75)
    const t5 = rows.filter((r) => r.levelId === 11)
    expect(t5).toHaveLength(73)
    expect(new Set(t5.map((r) => r.classroomId))).toEqual(new Set([517, 540, 628]))
    // Every T5 Below gap is above the observed at-risk gaps of the platform list (> -31).
    for (const r of t5) {
      const l = latestAr(r)
      if (l && l.target !== null && l.ar < l.target) expect(l.ar - l.target).toBeGreaterThan(-31)
    }
  })

  it('the pupil (not the class) school scopes the entries; the class school is 8880 for them all', () => {
    const rows = headcount.entries({ classSchoolIds: [8880], graded: true })
    expect(rows.length).toBeGreaterThanOrEqual(148)
    expect(rows.every((r) => r.classSchoolId === 8880)).toBe(true)
    const pupils = new Set(rows.map((r) => r.studentId))
    // 3201 - 3215 (class 516) and the members of the 8880 T5 classes (517 holds 15)
    expect(pupils.size).toBe(30)
    for (const id of pupils) expect(users.get(id)?.schoolId).toBe(8880)
  })
})

describe('monitoring-school requests', () => {
  it('M17 config 617: class 370 "5 PERNIAGAAN", Perniagaan, 2026, 30 entries, mean TOV 29.68, nothing graded', () => {
    const d = headcount.get(617)
    expect(d?.config).toMatchObject({ classroomId: 370, subjectId: 23, academicYear: 2026 })
    expect(d?.entries).toHaveLength(30)
    const tovs = (d?.entries ?? []).map((e) => e.tov as number)
    expect(Math.round((tovs.reduce((a, b) => a + b, 0) / 30) * 100) / 100).toBe(29.68)
    expect(tovs.filter((v) => v === 40)).toHaveLength(2)
    expect(tovs).toContain(82.5)
    expect(
      (d?.entries ?? []).every((e) => e.etr === null && e.rs === null && e.grade === null),
    ).toBe(true)
    expect(new Set(classrooms.memberIds('classroom', 370))).toEqual(
      new Set((d?.entries ?? []).map((e) => e.studentId)),
    )
  })

  it('M17 pupil 2022: a TOV 40.00 entry in 617 and Sains / Matematik entries without a TOV (2026-06-16)', () => {
    const rows = headcountEntries(2022, 2026)
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.subjectId).sort((a, b) => a - b)).toEqual([3, 4, 23])
    expect(rows.find((r) => r.subjectId === 23)?.tov).toBe(40)
    expect(rows.filter((r) => r.subjectId !== 23).every((r) => r.tov === null)).toBe(true)
    expect(rows.every((r) => r.configUpdatedAt.startsWith('2026-06-16'))).toBe(true)
  })

  it('M12 Student A (4664): 12 entries, only Pendidikan Islam has a TOV (78); none graded', () => {
    const rows = headcountEntries(4664, 2026)
    expect(rows).toHaveLength(12)
    expect(rows.filter((r) => r.tov !== null).map((r) => [r.subjectId, r.tov])).toEqual([[6, 78]])
    expect(rows.every((r) => latestAr(r) === null)).toBe(true)
    expect(headcountEntries(4664, 2025)).toEqual([])
  })

  it('M12 Student B (4644): 11 entries with TOV 20 / 60 / 40 / 55 / 33.33 / 37', () => {
    const rows = headcountEntries(4644, 2026)
    expect(rows).toHaveLength(11)
    const by = Object.fromEntries(
      rows.filter((r) => r.tov !== null).map((r) => [r.subjectId, r.tov]),
    )
    expect(by).toEqual({ 2: 20, 1: 60, 3: 40, 6: 55, 4: 33.33, 31: 37 })
    expect(rows.every((r) => latestAr(r) === null)).toBe(true)
  })

  it('M18 scoping: pupil school vs class school are separate filters', () => {
    const both = headcount.entries({ pupilSchoolIds: [8080], classSchoolIds: [8080] })
    expect(both.length).toBeGreaterThanOrEqual(23 + 30)
    // The observed T5 at-risk row "5 SAINS TULEN" is class 366 of 8080, so its pupils hold graded rows;
    // the M12 pupils 4664 / 4644 stay ungraded.
    const graded = headcount.entries({ pupilSchoolIds: [8080], graded: true })
    expect(graded.every((r) => r.classroomId === 366)).toBe(true)
    expect(graded.some((r) => r.studentId === 4664 || r.studentId === 4644)).toBe(false)
  })
})

describe('T5 at-risk rows (AC-10.4)', () => {
  it('each observed row sits in the M10 class with the observed name, held by its members', () => {
    const names = [
      '5 LEQOE',
      '5 ZUHRAH',
      '5 IMTIAZ',
      '5 BAKTI',
      '5 LEQOE',
      '5 LEQOE',
      '5 CAMELIA',
      '5 ZUHRAH',
      '5 MUSYTARI',
      '5 SAINS TULEN',
      '5 IMTIAZ',
      '5 NURANI',
      '5 IKHLAS',
      '5 JUJUR',
    ]
    const rows = headcount.entries({ graded: true }).filter((r) => r.levelId === 11)
    const risk = rows
      .flatMap((r) => {
        const l = latestAr(r)
        return l && l.target !== null && l.ar < l.target ? [{ r, gap: l.ar - l.target }] : []
      })
      .sort((a, b) => a.gap - b.gap || a.r.configId - b.r.configId || a.r.studentId - b.r.studentId)
      .slice(0, 14)
    expect(risk.map((x) => classrooms.get('classroom', x.r.classroomId)?.name)).toEqual(names)
    for (const { r } of risk) {
      expect(classrooms.memberIds('classroom', r.classroomId)).toContain(r.studentId)
    }
  })
})

describe('deferred', () => {
  it.todo('XR-M18-06: KLUANG coverage 65 pupils / 64 graded — deferred to M18-T1a (DL decision)')
})

describe('determinism and reset', () => {
  it('mock.reset() rebuilds the same baseline and re-registers the reader', async () => {
    const before = headcount.configs().map((c) => [c.id, c.classroomId, c.subjectId, c.updatedAt])
    const entriesBefore = headcountReads.entries().length
    await runtime.reset()
    expect(headcount.configs().map((c) => [c.id, c.classroomId, c.subjectId, c.updatedAt])).toEqual(
      before,
    )
    expect(headcountReads.entries()).toHaveLength(entriesBefore)
    expect(gpsOf(headcountReads.entries()).value).toBe(3.45)
  }, 180_000)

  it('no config id collides and the generated ids start at 701', () => {
    const ids = headcount.configs().map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const generated = ids.filter(
      (id) => ![209, 210, 211, 212, 213, 501, 502, 503, 504, 505, 506, 617].includes(id),
    )
    expect(Math.min(...generated)).toBe(701)
  })

  it('unique per class + subject + year + mode (BR-M08-22)', () => {
    const keys = headcount
      .configs()
      .map(
        (c) =>
          `${String(c.classroomId)}:${String(c.subjectId)}:${String(c.academicYear)}:${c.mode}`,
      )
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('a pupil holds a subject once per year, except the designed 3001 Kimia pair (501 / 502) and the 8880 deviation', () => {
    const seen = new Map<string, number[]>()
    for (const e of headcountReads.entries()) {
      const k = `${String(e.studentId)}:${String(e.subjectId)}:${String(e.academicYear)}`
      seen.set(k, [...(seen.get(k) ?? []), e.configId])
    }
    const dup = [...seen.entries()].filter(([, v]) => v.length > 1)
    // Accepted deviation (DL decision): the SRS 6.3 pins give 8880 Matematik 41 and Sains 34 entries, but only
    // 30 pupils are enrolled there (class 516 and 517), so 15 pupil-subject pairs repeat (MATH 11, SAINS 4).
    const outside = dup.filter(
      ([k]) => !k.startsWith('3001:10:') && users.get(Number(k.split(':')[0]))?.schoolId !== 8880,
    )
    expect(outside).toEqual([])
    expect(dup.filter(([k]) => users.get(Number(k.split(':')[0]))?.schoolId === 8880)).toHaveLength(
      15,
    )
  })
})
