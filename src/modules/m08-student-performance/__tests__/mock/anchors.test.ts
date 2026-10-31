/**
 * M08-T1 seed anchors (SRS M08 v1.11 §6.3, §6.10): every figure the SRS observed on live, asserted
 * through the endpoints against the real owners (M01, M02, M03, M04, M05, M10, M14). Headcount-driven
 * figures (GPS 3.45, On Track / Below 34 / 41, the 15 at-risk rows, school admin GPS 5.33) come from the
 * M08-T1b headcount seed and are asserted here since M08-T1b.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { questions } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'
import { dskp } from '@/modules/m10-teacher-class/mock'
import { wallet } from '@/modules/m14-gamification/mock'

import type {
  Analytics,
  ClassCard,
  ClassItemAnalysis,
  Leaderboard,
  LevelCard,
  LevelDetail,
  PublicProfile,
  Ranking,
  SchoolItemAnalysis,
  SchoolPerformance,
  StudentPerformance,
  Timeline,
} from '../../api/types'
import { itemStatistics, schoolSpmHistory, spRecords } from '../../mock'
import { ADMIN, GURU, MAJU, MemoryStorage, PELAJAR, bootM08, dataAs, getAs } from './boot'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM08()).runtime
}, 180_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const get = <T>(as: number | null, url: string) => dataAs<T>(runtime, as, url)

describe('S1 Dashboard Sekolah (admin: the platform)', () => {
  let s1: SchoolPerformance
  beforeAll(async () => {
    s1 = await get<SchoolPerformance>(ADMIN, '/api/performance/school')
  }, 120_000)

  it('shows the seven stat cards from the datasets', () => {
    expect(s1.scope).toBe('platform')
    expect(s1.header).toEqual({ classCount: 750, studentCount: 4533 })
    expect(s1.stats).toEqual({
      students: 4533,
      teachers: 551,
      classes: 750,
      subjects: 27,
      sessions: 32122,
      answered: 478499,
      accuracy: 79.8,
    })
  })

  it('level cards equal the S2 / S3 aggregates (DV-05)', () => {
    const [t4, t5] = s1.levels
    expect(t4).toEqual({ code: 't4', accuracy: 63.9, classes: 13, students: 149, sessions: 11 })
    expect(t5).toEqual({
      code: 't5',
      accuracy: 79.7,
      classes: 645,
      students: 3911,
      sessions: 29971,
    })
  })

  it('lists one card per teacher who owns a class (310), A to Z', () => {
    expect(s1.teachers).toHaveLength(310)
    const names = s1.teachers.map((t) => t.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('trend rows are the platform SPM history and the current year has no data', () => {
    expect(s1.trend.years.map((y) => [y.year, y.gps, y.candidates])).toEqual([
      [2022, 5.2, 150],
      [2023, 4.8, 160],
      [2024, 4.5, 175],
      [2025, 4.3, 180],
      [2026, null, null],
    ])
    expect(s1.trend.years.map((y) => y.change)).toEqual([null, -0.4, -0.3, -0.2, null])
    expect(s1.trend.years.at(-1)?.current).toBe(true)
    expect(s1.trend.chart.labels).toEqual([2022, 2023, 2024, 2025, 2026])
    expect(s1.trend.chart.overall).toEqual([5.2, 4.8, 4.5, 4.3, null])
    expect(s1.trend.chart.subjects.map((s) => s.name)).toEqual([
      'Bahasa Melayu',
      'Matematik',
      'Bahasa Inggeris',
      'Sains',
      'Pendidikan Islam',
      'Sejarah',
    ])
  })

  it('GPS 3.45 from 744 graded entries with the platform grade counts (BR-M08-01)', () => {
    expect(s1.gps).toEqual({ value: 3.45, band: 'Baik', entries: 744 })
    expect(s1.distribution.map((d) => [d.grade, d.count])).toEqual([
      ['A+', 125],
      ['A', 146],
      ['A-', 96],
      ['B+', 47],
      ['B', 107],
      ['C+', 24],
      ['C', 23],
      ['D', 76],
      ['E', 28],
      ['G', 72],
    ])
    // (125·0 + 146·1 + 96·2 + 47·3 + 107·4 + 24·5 + 23·6 + 76·7 + 28·8 + 72·9) ÷ 744 = 2569 ÷ 744
    const points = s1.distribution.reduce((a, d, i) => a + d.count * i, 0)
    expect(points).toBe(2569)
    expect(s1.distribution.reduce((a, d) => a + d.count, 0)).toBe(744)
  })

  it('the 16 subject rows of discovery A.2 (entries, GPS, On Track, Below, Tiada Sasaran), GPS ascending', () => {
    expect(
      s1.subjects
        .slice(0, 16)
        .map((r) => [r.name, r.entries, r.gps, r.onTrack, r.below, r.noTarget]),
    ).toEqual([
      ['Tasawwur Islam', 7, 0.29, 0, 0, 7],
      ['Pendidikan Islam', 48, 0.98, 0, 1, 47],
      ['Prinsip Perakaunan', 5, 1.4, 0, 3, 2],
      ['Ekonomi', 28, 1.86, 9, 7, 12],
      ['Biologi', 23, 1.96, 19, 4, 0],
      ['Fizik', 2, 2.5, 1, 0, 1],
      ['Bahasa Inggeris', 37, 2.57, 13, 16, 8],
      ['Sains', 131, 2.79, 74, 36, 21],
      ['Bahasa Melayu', 109, 2.84, 22, 4, 83],
      ['Kimia', 56, 3.21, 8, 4, 44],
      ['Pendidikan Moral', 9, 3.44, 3, 2, 4],
      ['Sejarah', 101, 3.56, 27, 34, 40],
      ['Matematik Tambahan', 3, 3.67, 3, 0, 0],
      ['Sains Komputer', 1, 4, 1, 0, 0],
      ['Matematik', 100, 4.54, 24, 28, 48],
      ['Perniagaan', 84, 7.15, 7, 61, 16],
    ])
    expect(s1.subjects.map((r) => r.grade).slice(0, 3)).toEqual(['A+', 'A', 'A'])
  })
})

describe('S1 for the school admin (own school, INFERRED)', () => {
  it('counts the school SMK DEMO: 2 kelas · 10 murid · 1 guru', async () => {
    const s1 = await get<SchoolPerformance>(8, '/api/performance/school')
    expect(s1.scope).toBe('school')
    expect(s1.header).toEqual({ classCount: 2, studentCount: 10 })
    expect(s1.stats.teachers).toBe(1)
    expect(s1.teachers.map((t) => [t.userId, t.classCount, t.studentCount])).toEqual([[5, 2, 8]])
  })

  it('GPS 5.33 from 6 graded entries (A-, C, C, G, D, A-) → "Sederhana"', async () => {
    const s1 = await get<SchoolPerformance>(8, '/api/performance/school')
    expect(s1.gps).toEqual({ value: 5.33, band: 'Sederhana', entries: 6 })
    expect(s1.distribution.filter((d) => d.count > 0).map((d) => [d.grade, d.count])).toEqual([
      ['A-', 2],
      ['C', 2],
      ['D', 1],
      ['G', 1],
    ])
    // 3 On Track (3001 Kimia, 3003 Kimia, 3001 BM 2025) and 3 Below: the designed configs only.
    expect([
      s1.subjects.reduce((a, r) => a + r.onTrack, 0),
      s1.subjects.reduce((a, r) => a + r.below, 0),
    ]).toEqual([3, 3])
  })
})

describe('S2 / S3 levels', () => {
  it('S2 cards', async () => {
    const cards = await get<LevelCard[]>(ADMIN, '/api/performance/levels')
    expect(cards).toEqual([
      { code: 't4', name: 'Tingkatan 4', classes: 13, students: 149 },
      { code: 't5', name: 'Tingkatan 5', classes: 645, students: 3911 },
    ])
  })

  it('S3 Tingkatan 4: cards, the 13 observed class rows and the two Murid Terbaik rows', async () => {
    const t4 = await get<LevelDetail>(ADMIN, '/api/performance/levels/t4')
    expect(t4).toMatchObject({ classes: 13, students: 149, accuracy: 63.9, sessions: 11 })
    const rows = Object.fromEntries(t4.classRows.map((r) => [`${r.kind}:${String(r.classId)}`, r]))
    expect(t4.classRows).toHaveLength(13)
    expect(t4.classRows.map((r) => r.classId)).toEqual([
      419, 516, 4, 5, 6, 90, 25, 115, 8, 9, 10, 419, 806,
    ])
    const at = (
      key: string,
      name: string,
      subject: string,
      students: number,
      sessions: number,
      accuracy: number,
    ) => expect(rows[key]).toMatchObject({ name, subject, students, sessions, accuracy })
    at('classroom:419', '4 Bestari', 'Tiada Subjek', 5, 0, 0)
    at('classroom:516', '4 Simulasi', 'Tiada Subjek', 15, 0, 0)
    at('classroom:4', '4 Bestari - BM', 'Bahasa Melayu', 58, 0, 0)
    at('classroom:5', '4 Cemerlang - BM', 'Bahasa Melayu', 53, 7, 51.3)
    at('classroom:6', '4 Dedikasi - BM', 'Bahasa Melayu', 54, 4, 81.7)
    at('classroom:90', 'MUMTAZ - Biologi', 'Biologi', 0, 0, 0)
    at('classroom:25', '5 BEST', 'Fizik', 0, 0, 0)
    at('classroom:115', '4 IBNU SINA', 'Matematik', 0, 0, 0)
    at('classroom:8', '4 Bestari - SEJ', 'Sejarah', 58, 0, 0)
    at('classroom:9', '4 Cemerlang - SEJ', 'Sejarah', 53, 7, 51.3)
    at('classroom:10', '4 Dedikasi - SEJ', 'Sejarah', 54, 4, 81.7)
    at('school_class:419', 'T4 4 Bestari', 'Kelas Sekolah', 5, 0, 0)
    at('school_class:806', 'T4 4 Khawarizmi', 'Kelas Sekolah', 1, 0, 0)
    // DV-06: no link on "Kelas Sekolah" rows, and they have no teacher.
    expect(rows['school_class:419']).toMatchObject({ href: null, teacher: null })
    expect(rows['classroom:5']?.href).toBe('/prestasi/kelas/5')
    // Murid Terbaik: "3 sesi · 30 soalan 93.3%" and "4 sesi · 60 soalan 64%" (R4-01 session means).
    expect(t4.topStudents.map((s) => [s.sessions, s.answered, s.accuracy])).toEqual([
      [3, 30, 93.3],
      [4, 60, 64],
    ])
  })

  it('S3 Tingkatan 5: 645 classes, 3,911 pupils, 29,971 sessions at 79.7 % and 10 top rows at 100 %', async () => {
    const t5 = await get<LevelDetail>(ADMIN, '/api/performance/levels/t5')
    expect(t5).toMatchObject({ classes: 645, students: 3911, accuracy: 79.7, sessions: 29971 })
    expect(t5.classRows).toHaveLength(645)
    // The 10 observed rows [sessions, questions] in live order; every session fully correct (100.0 %).
    expect(t5.topStudents.map((s) => [s.sessions, s.answered, s.accuracy])).toEqual([
      [3, 15, 100],
      [4, 50, 100],
      [6, 60, 100],
      [3, 84, 100],
      [5, 30, 100],
      [3, 114, 100],
      [5, 100, 100],
      [6, 55, 100],
      [3, 35, 100],
      [13, 295, 100],
    ])
    // Ties at 100 % are listed by user id ascending (BR-M08-07).
    const ids = t5.topStudents.map((s) => s.userId)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
  })

  it('S3 answers 404 for a level other than t4 / t5, and 401 without a session', async () => {
    const r = await getAs(runtime, ADMIN, '/api/performance/levels/t6')
    expect(r.status).toBe(404)
    expect((await getAs(runtime, null, '/api/performance/levels/t4')).status).toBe(401)
  })

  it('S3 Tingkatan 4: 34 On Track / 41 Below (45 %), "4 Simulasi" 13 / 2, the 15 at-risk rows of 11 pupils', async () => {
    const t4 = await get<LevelDetail>(ADMIN, '/api/performance/levels/t4')
    expect([t4.onTrack, t4.below, t4.onTrackPct]).toEqual([34, 41, 45])
    expect(t4.classRows.find((r) => r.classId === 516)).toMatchObject({ onTrack: 13, below: 2 })
    // Murid Berisiko in live order: gap ascending, then config id, then user id.
    expect(
      t4.atRisk.map((r) => [r.userId, r.className, r.checkpoint, r.ar, r.target, r.gap]),
    ).toEqual([
      [3201, '4 Simulasi', 3, 56, 82, -26],
      [3202, '4 Simulasi', 3, 58, 77, -19],
      [3207, '4 Simulasi', 3, 75, 93, -18],
      [3202, '4 Simulasi', 3, 65, 83, -18],
      [3212, '4 Simulasi', 3, 57, 74, -17],
      [3203, '4 Simulasi', 3, 66, 82, -16],
      [3211, '4 Simulasi', 3, 68, 84, -16],
      [3210, '4 Simulasi', 3, 83, 98, -15],
      [3213, '4 Simulasi', 3, 64, 79, -15],
      [3208, '4 Simulasi', 3, 68, 82, -14],
      [3210, '4 Simulasi', 3, 75, 89, -14],
      [3213, '4 Simulasi', 3, 69, 82, -13],
      [3215, '4 Simulasi', 3, 62, 75, -13],
      [3214, '4 Simulasi', 3, 61, 74, -13],
      [3214, '4 Simulasi', 3, 83, 93, -10],
    ])
    expect(new Set(t4.atRisk.map((r) => r.userId)).size).toBe(11)
  })

  it('S3 Tingkatan 5: 114 On Track / 289 Below (28 %) and the 14 observed at-risk rows first', async () => {
    const t5 = await get<LevelDetail>(ADMIN, '/api/performance/levels/t5')
    expect([t5.onTrack, t5.below, t5.onTrackPct]).toEqual([114, 289, 28])
    expect(t5.atRisk).toHaveLength(15)
    expect(t5.atRisk.slice(0, 14).map((r) => [r.checkpoint, r.ar, r.target, r.gap])).toEqual([
      [3, 0, 70, -70],
      [3, 0, 69, -69],
      [3, 20, 88, -68],
      [3, 20, 86, -66],
      [3, 0, 60, -60],
      [3, 40, 98, -58],
      [2, 40, 90, -50],
      [3, 20, 69, -49],
      [3, 40, 80, -40],
      [3, 40, 78, -38],
      [3, 60, 96, -36],
      [2, 0, 33.33, -33.3],
      [1, 20, 51.33, -31.3],
      [3, 40, 71, -31],
    ])
    // The 15th row is a generated pair, above the 14th observed gap.
    expect(t5.atRisk[14]?.gap).toBeGreaterThan(-31)
  })
})

describe('S4 own classes', () => {
  it('the admin owns none (OBSERVED); teacher 5 owns 2001 and 2002', async () => {
    expect(await get<ClassCard[]>(ADMIN, '/api/performance/classes')).toEqual([])
    const own = await get<ClassCard[]>(GURU, '/api/performance/classes')
    expect(own.map((c) => [c.id, c.name, c.subjectName, c.students, c.joinCode])).toEqual([
      [2001, '5 MARIKH - Kimia', 'Kimia', 8, 'DMO101'],
      [2002, '5 MARIKH - Sejarah', 'Sejarah', 8, 'DMO102'],
    ])
  })
})

describe('S6 Prestasi 360', () => {
  it('admin (id 1): no practice-mode session, streak 1 / 5, Koin 256, 13 practice days', async () => {
    const s = await get<StudentPerformance>(ADMIN, '/api/performance/students/1')
    expect(s.user).toEqual({ id: 1, name: 'Admin Demo', initial: 'A' })
    expect(s.stats).toEqual({ sessions: 0, accuracy: 0, answered: 0, seconds: 0 })
    expect(s.streak).toBe(1)
    expect(s.activity).toEqual({
      streakCurrent: 1,
      streakBest: 5,
      koinTotal: 256,
      practiceDays: 13,
    })
    expect(s.headcount).toEqual([])
    expect(s.badges).toEqual([])
    expect(s.mastery).toEqual([])
    expect(s.heatmap).toHaveLength(90)
    expect(s.heatmap.at(-1)?.date).toBe('2026-09-25')
    expect(s.heatmap.every((d) => d.sessions === 0)).toBe(true)
    // AC-M08-16.1: no weak topic (S6 reads the user's own answers; the observed S7 set is not one).
    expect(s.weakTopics).toEqual([])
    // Cadangan: "Sudah 127 hari…" from the stored lastPracticeAt (2026-05-21), then "start".
    expect(s.suggestions[0]?.text).toBe(
      'Sudah 127 hari tiada latihan. Mulakan semula dengan 10 soalan mudah untuk pemanasan.',
    )
    expect(s.suggestions.at(-1)?.text).toBe(
      'Mulakan perjalanan belajar kamu — setiap sesi latihan membina asas yang kukuh!',
    )
    expect(s.suggestions.map((x) => x.kind)).toEqual(['inactive', 'start'])
  })

  it('pupil 3008: weak topic Sel Elektrolisis, 2 attempts, Fokus capped at 25', async () => {
    const s = await get<StudentPerformance>(ADMIN, '/api/performance/students/3008')
    const w = s.weakTopics.find((x) => x.spId === 9001)
    expect(w).toMatchObject({
      code: '1.1.1',
      subjectCode: 'CHEM',
      attempts: 2,
      accuracy: 0,
      focusCount: 25,
    })
    const acc = s.weakTopics.map((x) => x.accuracy)
    expect(acc).toEqual([...acc].sort((p, q) => p - q))
  })

  it('designed pupil 3001: 3 sessions, 14 answered, 12 correct, 14 min; Kimia 89 %, Sejarah 80 %', async () => {
    const s = await get<StudentPerformance>(ADMIN, '/api/performance/students/3001')
    expect(s.stats).toEqual({ sessions: 3, accuracy: 85.7, answered: 14, seconds: 840 })
    const by = Object.fromEntries(s.mastery.map((m) => [m.subjectName, m]))
    expect(by.Kimia).toMatchObject({ accuracy: 88.9, sessions: 2, answered: 9 })
    expect(by.Sejarah).toMatchObject({ accuracy: 80, sessions: 1, answered: 5 })
    expect(s.heroAccuracy).toBe(86)
    // The 2026-09-24 sessions are on the heatmap (1 practice session that day for 3001? two: Kimia 60 s).
    const day = (d: string) => s.heatmap.find((h) => h.date === d)?.sessions
    expect(day('2026-09-15')).toBe(1)
    expect(day('2026-09-18')).toBe(1)
    expect(day('2026-09-24')).toBe(1)
    expect(day('2026-09-20')).toBe(0)
  })

  it('Kimia accuracies of the eight designed pupils', async () => {
    const expected: Record<number, [number, number]> = {
      3001: [8, 9],
      3002: [5, 10],
      3003: [3, 8],
      3004: [3, 8],
      3005: [3, 8],
      3006: [3, 8],
      3007: [3, 9],
      3008: [1, 8],
    }
    const pct = (c: number, n: number) => Math.round((c / n) * 1000) / 10
    for (const [id, [c, n]] of Object.entries(expected)) {
      const s = await get<StudentPerformance>(ADMIN, `/api/performance/students/${id}`)
      const kimia = s.mastery.find((m) => m.subjectName === 'Kimia')
      expect(kimia, `pupil ${id}`).toMatchObject({ accuracy: pct(c, n), answered: n })
    }
  })
})

describe('S7 Analitik Pembelajaran', () => {
  it('admin: BM 79 answers 40.5 % (3/6/17/0), Sejarah 40 answers 35.0 % (8/2/13/0)', async () => {
    const a = await get<Analytics>(ADMIN, '/api/analytics/me')
    // D72: the central admin has no school and no grade (it was Darjah 4), so it has no DSKP map.
    expect(a.userLevelId).toBeNull()
    expect(a.subjects.map((s) => s.code)).toEqual(['BM', 'SEJ'])
    const [bm, sej] = a.subjects
    expect(bm).toMatchObject({
      accuracy: 40.5,
      answered: 79,
      counts: { mahir: 3, sederhana: 6, lemah: 17, belum: 0 },
      projection: { low: 'G', high: 'C' },
      trend: 'stable',
    })
    expect(sej).toMatchObject({
      accuracy: 35,
      answered: 40,
      counts: { mahir: 8, sederhana: 2, lemah: 13, belum: 0 },
      projection: { low: 'G', high: 'D' },
    })
    // DV-13: the ring denominator is the map tile count (BM 3 tiles, mahir 3 is not greater) unless mahir
    // exceeds it: SEJ has 2 tiles and mahir 8, so mahir + sederhana + lemah + belum = 23 ("/ 23 SP").
    // Without a level there are no map tiles, so the ring total is the answered SP count (mahir exceeds 0 tiles).
    expect(bm?.ringTotal).toBe(26)
    expect(sej?.ringTotal).toBe(23)
    expect(bm?.map).toEqual({ caption: '', tiles: [] })
  })

  it('the observed weak cards: SP, code, answers and the available-question counts', async () => {
    const a = await get<Analytics>(ADMIN, '/api/analytics/me')
    const bm = a.subjects.find((s) => s.code === 'BM')
    const cards = Object.fromEntries((bm?.weak ?? []).map((w) => [w.spId, w]))
    const expected: Record<number, [string, number, number]> = {
      221: ['5.1.2', 3, 16],
      206: ['3.4.1', 1, 16],
      222: ['5.1.3', 1, 7],
      214: ['4.2.1', 4, 12],
      179: ['5.3.4', 1, 13],
      194: ['2.1.1', 1, 50],
    }
    for (const [sp, [code, answered, available]] of Object.entries(expected)) {
      expect(cards[Number(sp)], `SP ${sp}`).toMatchObject({
        code,
        answered,
        accuracy: 0,
        available,
      })
    }
    const sej = a.subjects.find((s) => s.code === 'SEJ')
    // All 13 lemah SPs resolve now that M10 seeds the filler block (17 for BM, 13 for SEJ); 418 is first.
    expect(bm?.weak).toHaveLength(17)
    expect(sej?.weak).toHaveLength(13)
    expect(sej?.weak[0]).toMatchObject({ spId: 418, code: '15.3.2', answered: 1, available: 13 })
    // The four weakest over all subjects: the observed card order 5.1.2, 3.4.1, 5.1.3, 4.2.1 (equal 0 %
    // accuracies keep the record order; the tie rule is INFERRED beyond that observation).
    expect(a.topWeak.map((w) => w.spId)).toEqual([221, 206, 222, 214])
    expect(a.topWeak.map((w) => w.code)).toEqual(['5.1.2', '3.4.1', '5.1.3', '4.2.1'])
    expect(bm?.weak.find((w) => w.spId === 194)?.focusCount).toBe(25)
  })

  it('pelajarmaju has no SP record: the no-data state (its M05 answers carry no dskpSpId)', async () => {
    const a = await get<Analytics>(MAJU, '/api/analytics/me')
    expect(a.subjects).toEqual([])
    expect(a.topWeak).toEqual([])
  })

  it('designed pupils have SP records derived from their answers on the 9001–9004 questions', () => {
    const recs = spRecords.forUser(3001)
    expect(recs.map((r) => [r.dskpSpId, r.answered, r.correct])).toEqual([
      [9001, 2, 2],
      [9002, 3, 3],
      [9003, 2, 1],
      [9004, 2, 2],
    ])
    expect(spRecords.forUser(PELAJAR)).toEqual([])
  })
})

describe('admin SP records resolve against M10', () => {
  it('every record of the admin has a DSKP SP in M10 (no placeholder ids)', () => {
    const recs = spRecords.forUser(ADMIN)
    expect(recs).toHaveLength(26 + 23)
    for (const r of recs) expect(dskp.spPath(r.dskpSpId), `SP ${String(r.dskpSpId)}`).toBeDefined()
  })
})

describe('S9 Analisa Item Sekolah', () => {
  it('the central admin has no school of its own (D72): own school is 404; a school without a pupil answers 0 / 0', async () => {
    const own = await getAs(runtime, ADMIN, '/api/item-analysis/school')
    expect(own.status).toBe(404)
    // The school admin of SMK Demo Seri Putra (900003, no pupil): the own-school variant with nothing to count.
    const s9 = await get<SchoolItemAnalysis>(3102, '/api/item-analysis/school')
    expect(s9.school.id).toBe(900003)
    expect(s9).toMatchObject({ students: 0, answers: 0, accuracy: 0, variant: 'own' })
    expect(s9.questions).toEqual([])
  })

  it('school 8880: 59 pupils, 10,194 answers at 71.7 %, 20 critical questions all "Sukar"', async () => {
    const s9 = await get<SchoolItemAnalysis>(ADMIN, '/api/item-analysis/school/8880')
    expect(s9.school).toMatchObject({
      id: 8880,
      code: 'JEB2037',
      type: 'SMK',
      district: 'PPD KLUANG',
      state: 'Johor',
    })
    expect(s9).toMatchObject({ students: 59, answers: 10194, accuracy: 71.7, variant: 'byId' })
    expect(s9.difficulty).toEqual({ mudah: 0, sederhana: 0, sukar: 20 })
    expect(s9.questions).toHaveLength(20)
    const q1 = s9.questions[0]
    expect(q1).toMatchObject({
      rank: 1,
      stem: 'Prinsip Pascal menyatakan bahawa:',
      subjectName: 'Sains',
      wrongPct: 100,
      attempts: 2,
      pupils: 2,
      pupilsPct: 3.4,
      level: 'Sukar',
      correctOption: {
        letter: 'A',
        text: 'Tekanan dalam cecair tertutup dipindahkan sama rata ke semua bahagian',
      },
      popularWrongOption: { letter: 'B', text: 'Tekanan meningkat dengan kedalaman' },
      popularWrongCount: 1,
    })
    expect(q1?.wrongPupils).toHaveLength(2)
    // Subject pills: BM 13, Sains 6, Sejarah 1.
    const by = (name: string) => s9.questions.filter((q) => q.subjectName === name).length
    expect([by('Bahasa Melayu'), by('Sains'), by('Sejarah')]).toEqual([13, 6, 1])
  })

  it('the T4 view of 8880: 15 pupils, 6,563 answers at 76.3 % and its own 20 questions', async () => {
    const s9 = await get<SchoolItemAnalysis>(ADMIN, '/api/item-analysis/school/8880?tingkatan=T4')
    expect(s9).toMatchObject({ students: 15, answers: 6563, accuracy: 76.3, tingkatan: 'T4' })
    expect(s9.questions).toHaveLength(20)
    const by = (name: string) => s9.questions.filter((q) => q.subjectName === name).length
    expect([by('Bahasa Inggeris'), by('Bahasa Melayu'), by('Sains'), by('Sejarah')]).toEqual([
      1, 11, 2, 6,
    ])
    expect(s9.questions[0]?.pupilsPct).toBe(13.3)
  })

  it('8765 lists 6 questions (Matematik 4, Pendidikan Islam 2); 2710 lists none', async () => {
    const s9 = await get<SchoolItemAnalysis>(ADMIN, '/api/item-analysis/school/8765')
    expect(s9.questions).toHaveLength(6)
    expect(s9.difficulty).toEqual({ mudah: 5, sederhana: 0, sukar: 1 })
    // The observed 83.8 % header (kept: it is observed; the log gives 82.4 %).
    expect(s9).toMatchObject({ students: 21, answers: 222, accuracy: 83.8 })
    expect(s9.questions[0]).toMatchObject({ level: 'Sukar', wrongPct: 84.6, pupils: 6 })
    const subjects = s9.questions.map((q) => q.subjectName)
    expect(subjects.filter((s) => s === 'Matematik')).toHaveLength(4)
    expect(subjects.filter((s) => s === 'Pendidikan Islam')).toHaveLength(2)
    const t5 = await get<SchoolItemAnalysis>(ADMIN, '/api/item-analysis/school/8765?tingkatan=T5')
    expect(t5.questions[0]).toMatchObject({ level: 'Sederhana', wrongPct: 50, pupils: 2 })
    // D11: the T4 / T5 lists are observed but their headers are not, so no computed header is shown.
    expect(t5).toMatchObject({ answers: null, correct: null, accuracy: null })
    expect(t5.subjects).toEqual([])
    const t4 = await get<SchoolItemAnalysis>(ADMIN, '/api/item-analysis/school/8765?tingkatan=T4')
    expect(t4).toMatchObject({ answers: null, accuracy: null })
    const s2710 = await get<SchoolItemAnalysis>(ADMIN, '/api/item-analysis/school/2710')
    expect(s2710.questions).toEqual([])
  })

  it('DATA-M08-11 store: KLUANG = Johor 20, 8880 20 + T4 variant 20, 8765 6 + T4 / T5 variants', () => {
    expect(itemStatistics.forScope('ppd', 'PPD KLUANG')).toHaveLength(20)
    expect(itemStatistics.forScope('state', 'Johor')).toHaveLength(20)
    expect(itemStatistics.forScope('school', 8880)).toHaveLength(20)
    expect(itemStatistics.forScope('school', 8880, 'T4')).toHaveLength(20)
    expect(itemStatistics.forScope('school', 8765)).toHaveLength(6)
    expect(itemStatistics.forScope('school', 8765, 'T4')).toHaveLength(6)
    expect(itemStatistics.forScope('school', 8765, 'T5')).toHaveLength(6)
    expect(itemStatistics.forScope('school', 2710)).toEqual([])
    // Every question id is in the M18 block 701001–701099 and the catalogue covers them all.
    const catalogue = new Set(itemStatistics.catalogue().map((q) => q.id))
    expect(catalogue.size).toBe(37)
    for (const id of catalogue) expect(id).toBeGreaterThanOrEqual(701001)
    for (const id of catalogue) expect(id).toBeLessThanOrEqual(701099)
    for (const kind of ['ppd', 'state'] as const) {
      for (const r of itemStatistics.forScope(kind, kind === 'ppd' ? 'PPD KLUANG' : 'Johor')) {
        expect(catalogue.has(r.questionId)).toBe(true)
      }
    }
  })
})

describe('S10 / S11 item analysis of a class', () => {
  it('the admin lists every class, newest created first: 1156, 1155, 1154 first', async () => {
    const list = await get<ClassCard[]>(ADMIN, '/api/item-analysis/classes')
    expect(list.slice(0, 3).map((c) => [c.id, c.name, c.students, c.joinCode])).toEqual([
      [1156, '5 CYBER', 1, 'JOV330'],
      [1155, 'sains rumah tangga', 0, '0VV295'],
      [1154, 'Chaos Academy', 0, 'PVZ601'],
    ])
  })

  it('class 2001 (Kimia): 8 pupils, 8 questions, the observed indices, summary 1 / 4 / 3 and D values', async () => {
    const r = await get<ClassItemAnalysis>(GURU, '/api/item-analysis/classes/2001')
    expect(r.class).toMatchObject({
      id: 2001,
      subjectName: 'Kimia',
      levelSlug: 'tingkatan-5',
      students: 8,
    })
    const a = r.analysis
    expect(a.questionCount).toBe(8)
    expect(a.summary).toEqual({ mudah: 1, sederhana: 4, sukar: 3 })
    const rows = Object.fromEntries(a.difficulty.map((d) => [d.questionId, d]))
    const expected: Record<number, [number, number, string]> = {
      700001: [75, 0.25, 'Mudah'],
      700002: [50, 0.5, 'Sederhana'],
      700003: [60, 0.4, 'Sederhana'],
      700004: [25, 0.75, 'Sukar'],
      700005: [12.5, 0.88, 'Sukar'],
      700006: [12.5, 0.88, 'Sukar'],
      700007: [50, 0.5, 'Sederhana'],
      700008: [50, 0.5, 'Sederhana'],
    }
    for (const [id, [accuracy, index, level]] of Object.entries(expected)) {
      expect(rows[Number(id)], `Q ${id}`).toMatchObject({ accuracy, index, level })
    }
    expect(rows[700003]).toMatchObject({ attempts: 10, students: 8 })
    // Default order: Indeks descending, ties by question id.
    expect(a.difficulty.map((d) => d.questionId)).toEqual([
      700005, 700006, 700004, 700002, 700007, 700008, 700003, 700001,
    ])
    // Discrimination: N = 8, g = 2.
    expect(a.discrimination.sufficient).toBe(true)
    const d = Object.fromEntries(a.discrimination.rows.map((x) => [x.questionId, x.index]))
    expect(d).toEqual({
      700001: 1,
      700007: 1,
      700008: 1,
      700006: 0.5,
      700002: 0.333,
      700003: 0.25,
      700004: 0,
      700005: -0.5,
    })
  })

  it('class 2002 has 3 pupils with sessions: "Data Tidak Mencukupi"', async () => {
    const r = await get<ClassItemAnalysis>(GURU, '/api/item-analysis/classes/2002')
    expect(r.analysis.questionCount).toBe(5)
    expect(r.analysis.discrimination).toEqual({ sufficient: false, rows: [] })
  })

  it('class 6 "4 Dedikasi - BM" has no answers', async () => {
    const r = await get<ClassItemAnalysis>(ADMIN, '/api/item-analysis/classes/6')
    expect(r.class.name).toBe('4 Dedikasi - BM')
    expect(r.analysis.questionCount).toBe(0)
  })

  it('class 228: 596 tested questions, summary 381 / 78 / 137', async () => {
    const r = await get<ClassItemAnalysis>(ADMIN, '/api/item-analysis/classes/228')
    expect(r.analysis.questionCount).toBe(596)
    expect(r.analysis.summary).toEqual({ mudah: 381, sederhana: 78, sukar: 137 })
  }, 120_000)
})

describe('S16 – S18 timeline and public profile', () => {
  it('no timeline posts are seeded (none observed on live; no generated photos)', async () => {
    const t = await get<Timeline>(PELAJAR, '/api/timeline')
    expect(t.profileUrl).toBe('/pelajar/2')
    expect(t.posts).toEqual([])
    expect((await get<Timeline>(ADMIN, '/api/timeline')).posts).toEqual([])
  })

  it('admin public profile: Admin Demo, no school or level (D72), 256 syiling, Kombo 1 / 5, no practice', async () => {
    const p = await get<PublicProfile>(null, '/api/public/students/1')
    expect(p).toMatchObject({
      id: 1,
      name: 'Admin Demo',
      firstName: 'Admin',
      schoolName: null,
      levelName: 'Darjah 6', // OBSERVED profile level (M08 activity anchor), kept as stored
      joinedAt: '2025-10-25T20:00:00+08:00',
      syiling: 256,
      streak: { current: 1, best: 5 },
      activity: { sessions: 0, practiceDays: 0, correct: 0, bestStreak: 5 },
      posts: [],
    })
    expect(p.daysWith).toBe(
      Math.floor(
        (Date.parse('2026-09-25T15:40:00+08:00') - Date.parse('2025-10-25T20:00:00+08:00')) /
          86_400_000,
      ),
    )
    expect(p.tier).toMatchObject({
      ordinal: 1,
      key: 'bronze',
      nextKey: 'silver',
      toNext: 244,
      progressPct: 51.2,
    })
  })
  it('"Tahap" is the tier ordinal by minSyiling: a Silver-tier user gets 2, Bronze 1 (INFERRED)', async () => {
    let silver: number | undefined
    for (let id = 2; id < 3300 && silver === undefined; id++) {
      try {
        if (wallet.summary(id).tier.key === 'silver') silver = id
      } catch {
        // no wallet for this id
      }
    }
    expect(silver).toBeDefined()
    const p = await get<PublicProfile>(null, `/api/public/students/${String(silver)}`)
    expect(p.tier).toMatchObject({ key: 'silver', ordinal: 2 })
  })
})

describe('S19 Kedudukan', () => {
  it('lists the three observed ranked students by Betul ascending', async () => {
    const r = await get<Ranking>(ADMIN, '/api/rankings')
    expect(r).toMatchObject({
      scope: 'nasional',
      title: 'Kedudukan Nasional',
      showFooter: true,
      total: 3,
    })
    expect(r.rows.map((x) => [x.rank, x.name, x.tahap, x.correct, x.accuracy])).toEqual([
      [1, 'Nur Aina Demo', 8, 2223, 93.48],
      [2, 'Adam Firdaus Demo', 10, 5293, 83.79],
      [3, 'Siti Hajar Demo', 10, 17612, 89.94],
    ])
    expect(r.states).toEqual(['Selangor'])
  })

  it('Matematik figures in list order; negeri without a state is empty; unknown scope has no footer', async () => {
    const m = await get<Ranking>(ADMIN, '/api/rankings?subjectId=3')
    expect(m.rows.map((x) => [x.tahap, x.correct, x.accuracy])).toEqual([
      [4, 128, 48.85],
      [7, 530, 35.5],
      [8, 889, 99.78],
    ])
    const neg = await get<Ranking>(ADMIN, '/api/rankings?scope=negeri')
    expect(neg).toMatchObject({ rows: [], total: 0, title: 'Kedudukan Negeri', showFooter: false })
    const sel = await get<Ranking>(ADMIN, '/api/rankings?scope=negeri&negeri=Selangor')
    expect(sel.title).toBe('Kedudukan Selangor')
    expect(sel.rows).toHaveLength(3)
    const unk = await get<Ranking>(ADMIN, '/api/rankings?scope=xyz')
    expect(unk).toMatchObject({ scope: null, title: 'Kedudukan Nasional', showFooter: false })
    expect(unk.rows).toHaveLength(3)
    const t4 = await get<Ranking>(ADMIN, '/api/rankings?tingkatan=T4')
    expect(t4.rows).toEqual([])
  })
})

describe('S20 Papan Pendahulu', () => {
  it('week: 46 participants before the 50-row cap; the admin is not a participant', async () => {
    const lb = await get<Leaderboard>(ADMIN, '/api/leaderboard')
    expect(lb.period).toBe('week')
    expect(lb.participants).toBe(46)
    expect(lb.me).toEqual({ rank: null, coins: 0, sessions: 0, accuracy: 0 })
    // Observed podium: 98 % 1,547 · 89 % 1,215 · 99 % 787; rows 4 and 5 at 68 % and 100 %.
    expect(lb.rows.slice(0, 3).map((r) => [r.accuracy, r.coins])).toEqual([
      [98, 1547],
      [89, 1215],
      [99, 787],
    ])
    expect(lb.rows.slice(3, 5).map((r) => r.accuracy)).toEqual([68, 100])
  })

  it('week standings of the designed learners come from the M05 log', async () => {
    const lb = await get<Leaderboard>(PELAJAR, '/api/leaderboard?period=week')
    const pick = (id: number) => lb.rows.find((r) => r.userId === id)
    expect(pick(2)).toMatchObject({ coins: 70, sessions: 4 })
    expect(pick(2)?.accuracy).toBeCloseTo(65.4, 1)
    expect(pick(4)).toMatchObject({ coins: 26, sessions: 4 })
    expect(pick(4)?.accuracy).toBeCloseTo(68.2, 1)
    expect(pick(3007)).toMatchObject({ coins: 3, sessions: 2, accuracy: 62.5 })
    expect(pick(3005)).toMatchObject({ coins: 3, sessions: 1, accuracy: 37.5 })
    expect(pick(3006)).toMatchObject({ coins: 3, sessions: 1, accuracy: 37.5 })
    expect(pick(3001)).toMatchObject({ coins: 1, sessions: 1, accuracy: 100 })
    expect(pick(3008)).toMatchObject({ coins: 1, sessions: 1, accuracy: 12.5 })
    expect(pick(3002)).toMatchObject({ coins: 0, sessions: 1, accuracy: 0 })
    expect(lb.me.rank).toBe(39)
  })

  it('all time: the admin is #1050 with 26 coins, 4 sessions, 21.8 %', async () => {
    const lb = await get<Leaderboard>(ADMIN, '/api/leaderboard?period=all')
    expect(lb.rows).toHaveLength(50)
    expect(lb.rows.slice(0, 3).map((r) => [r.accuracy, r.coins])).toEqual([
      [88, 64689],
      [100, 30510],
      [93, 25736],
    ])
    expect(lb.me.rank).toBe(1050)
    expect(lb.me).toMatchObject({ coins: 26, sessions: 4 })
    expect(lb.me.accuracy).toBeCloseTo(21.8, 1)
  })

  it('an unknown period falls back to the week; month lists the designed pupils too', async () => {
    const lb = await get<Leaderboard>(ADMIN, '/api/leaderboard?period=year')
    expect(lb.period).toBe('week')
    const month = await get<Leaderboard>(ADMIN, '/api/leaderboard?period=month')
    expect(month.period).toBe('month')
    expect(month.rows.length).toBe(50)
  })
})

describe('M04 / M05 contributions', () => {
  it('51 fixture questions: SP 9001 has 30 eligible (2 answered + 28 unanswered), 9002–9004 have 2', () => {
    expect(questions.spAvailable(9001)).toBe(30)
    expect(questions.spAvailable(9002)).toBe(2)
    expect(questions.spAvailable(9003)).toBe(2)
    expect(questions.spAvailable(9004)).toBe(2)
    const q = questions.get(700201)
    expect(q).toMatchObject({
      subjectId: 5,
      educationLevelId: 10,
      spmPool: true,
      difficultyLevel: 2,
      status: 'approved',
      isActive: true,
    })
    expect(questions.get(700001)).toMatchObject({
      subjectId: 10,
      educationLevelId: 11,
      spmPool: false,
      dskpSpId: 9001,
    })
    expect(questions.get(700215)).not.toBeNull()
    expect(questions.get(700216)).toBeNull()
  })

  it('14 designed sessions H01–H14 with 83 answers sit inside the M05 log', () => {
    const ids = Array.from({ length: 14 }, (_, i) => `H${String(i + 1).padStart(2, '0')}`)
    const rows = ids.map((id) => practice.session(id))
    expect(rows.every((r) => r !== undefined)).toBe(true)
    expect(rows.reduce((a, r) => a + (r?.questionCount ?? 0), 0)).toBe(83)
    expect(practice.count('Q-SESS-ALL')).toBe(32122)
  })
})

describe('SchoolSpmHistory (DATA-M08-09)', () => {
  it('subjectTrend(): the observed 2022–2026 per-subject series, read-only', () => {
    const t = schoolSpmHistory.subjectTrend()
    expect(t.years).toEqual([2022, 2023, 2024, 2025, 2026])
    expect(t.subjects.map((x) => x.name)).toEqual([
      'Bahasa Melayu',
      'Matematik',
      'Bahasa Inggeris',
      'Sains',
      'Pendidikan Islam',
      'Sejarah',
    ])
    expect(t.subjects[0]?.data).toEqual([4.8, 4.5, 4.2, 4, 2.8])
    expect(t.subjects[4]?.data).toEqual([4.2, 3.9, 3.65, 3.4, null])
    expect(Object.isFrozen(t)).toBe(true)
    expect(Object.isFrozen(t.subjects[0]?.data)).toBe(true)
    expect(() => (t.subjects[0]?.data as number[]).push(1)).toThrow()
    expect(schoolSpmHistory.subjectTrend().subjects[0]?.data).toEqual([4.8, 4.5, 4.2, 4, 2.8])
  })

  it('platform rows and the school rows M12 / M17 read', () => {
    expect(schoolSpmHistory.platform().map((r) => [r.year, r.gps, r.candidates, r.source])).toEqual(
      [
        [2022, 5.2, 150, 'SPM Sebenar'],
        [2023, 4.8, 160, 'SPM Sebenar'],
        [2024, 4.5, 175, 'SPM Sebenar'],
        [2025, 4.3, 180, 'SPM Sebenar'],
      ],
    )
    expect(schoolSpmHistory.platform().at(-1)?.gradeCounts).toEqual([
      10, 18, 24, 32, 32, 26, 21, 11, 5, 1,
    ])
    expect(schoolSpmHistory.forSchool(8080)).toMatchObject([{ year: 2026, gps: 4, candidates: 1 }])
    const s8880 = schoolSpmHistory.forSchool(8880)
    expect(s8880).toHaveLength(1)
    expect(s8880[0]?.subjects.map((s) => [s.subjectName, s.gps, s.candidates])).toEqual([
      ['Matematik', 2.5, 30],
      ['Bahasa Melayu', 2.8, 30],
      ['Sains', 2.9, 30],
      ['Sejarah', 3, 30],
      ['Bahasa Inggeris', 3.2, 30],
    ])
  })
})
