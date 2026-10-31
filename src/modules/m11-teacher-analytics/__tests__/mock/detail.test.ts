/**
 * M11-T1 endpoints #4 (S3 school detail), #5 (S4 student detail) and #6 (S5 teacher detail) over the
 * real owners (SRS M11 v1.10 §6.7, §7, §9): the observed S3 cards, statuses, subscriptions and flag
 * boxes of the anchor schools, Students A, B and C (cards, subject rows, the 18 topic rows of A, the
 * chapter-label gaps 0 / 2 / 6, the wrong-answer lists), the 0-answer pupils, Teacher T, the 404 rules,
 * the school admin forced to its own school, and the guards.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { curriculum } from '@/modules/m03-curriculum/mock'

import type { SchoolDetail, StudentDetail, TeacherDetail } from '../../api/types'
import { ADMIN, ADMIN_SEKOLAH, GURU, MemoryStorage, PELAJAR, bootM11, dataAs, getAs } from './boot'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM11()).runtime
}, 300_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const school = (id: number, as: number | null = ADMIN) =>
  dataAs<SchoolDetail>(runtime, as, `/api/monitoring/schools/${String(id)}`)
const student = (schoolId: number, userId: number, as: number | null = ADMIN) =>
  dataAs<StudentDetail>(
    runtime,
    as,
    `/api/monitoring/schools/${String(schoolId)}/students/${String(userId)}`,
  )
const teacher = (schoolId: number, userId: number, as: number | null = ADMIN) =>
  dataAs<TeacherDetail>(
    runtime,
    as,
    `/api/monitoring/schools/${String(schoolId)}/teachers/${String(userId)}`,
  )

const count = <T>(rows: T[], pred: (r: T) => boolean) => rows.filter(pred).length

describe('S3 school detail: 8080 (E2E-M11-31/32/34)', () => {
  it('header, subscription, flag box and cards', async () => {
    const d = await school(8080)
    expect(d.school).toMatchObject({ id: 8080, state: 'Selangor' })
    expect(d.school.code).not.toBeNull()
    expect(d.subscription).toEqual({ status: 'active', endsAt: '2027-05-12T09:00:00+08:00' })
    expect(d.warning).toEqual({ review: 10, excluded: 9 })
    expect(d.flags).toEqual({ review: 10, excluded: 9 })
    expect(d.tahap).toBe('Cemerlang')
    expect(d.pct).toBe(89.7)
    expect(d.cards).toEqual({
      students: 184,
      engaged: 165,
      answers: 53494,
      teachers: 34,
      teachersLoggedIn: 34,
    })
  })

  it('184 pupils; S3 engagement excludes the "ditapis" accounts (165), the status counts keep them (174)', async () => {
    const d = await school(8080)
    expect(d.students).toHaveLength(184)
    expect(count(d.students, (s) => s.engaged)).toBe(165)
    expect(count(d.students, (s) => s.flag === 'excluded' && s.engaged)).toBe(0)
    expect(count(d.students, (s) => s.status === 'aktif')).toBe(174)
    expect(count(d.students, (s) => s.flag === 'review')).toBe(10)
    expect(count(d.students, (s) => s.flag === 'excluded')).toBe(9)
    expect(d.students.every((s) => s.flag === null || s.status === 'aktif')).toBe(true)
  })

  it('"Belum login" pill = 8 (6 + 2 answered without login) and every login is the M01 field', async () => {
    const d = await school(8080)
    expect(count(d.students, (s) => s.lastLoginAt === null)).toBe(8)
    expect(count(d.students, (s) => s.status === 'aktif' || s.status === 'login')).toBe(
      178 + (count(d.students, (s) => s.status === 'never' && s.lastLoginAt === null) - 6),
    )
  })

  it('8080 status counts are 174 · 4 · 6 (Aktif · Login sahaja · Belum login)', async () => {
    const d = await school(8080)
    expect([
      count(d.students, (s) => s.status === 'aktif'),
      count(d.students, (s) => s.status === 'login'),
      count(d.students, (s) => s.status === 'never'),
    ]).toEqual([174, 4, 6])
  })

  it('Student A (2008): row values and last activity; order is Tingkatan then name A→Z', async () => {
    const d = await school(8080)
    const a = d.students.find((s) => s.id === 2008)
    expect(a).toEqual({
      id: 2008,
      name: 'Adam Haikal Demo',
      email: expect.stringMatching(/@demo\.test$/) as string,
      level: 'T5',
      answers: 71,
      status: 'aktif',
      engaged: true,
      flag: null,
      lastLoginAt: '2026-06-16T14:11:00+08:00',
      lastActivityAt: '2026-06-16T14:19:57+08:00',
    })
    expect(d.students[0]?.name).toBe('Adam Haikal Demo')
    const keys = d.students.map((s) => `${s.level}|${s.name.toLowerCase()}`)
    expect(keys).toEqual([...keys].sort((x, y) => x.localeCompare(y, 'ms')))
  })

  it('the apostrophe pupil is a plain row (DV-M11-18)', async () => {
    const d = await school(8080)
    const row = d.students.find((s) => s.name === "Nur'ain Demo")
    expect(row).toMatchObject({ status: 'aktif', level: 'T5' })
  })

  it('pupils 4664 ("Login sahaja") and 4644 ("Belum login") have no answers (FR-M11-87)', async () => {
    const d = await school(8080)
    expect(d.students.find((s) => s.id === 4664)).toMatchObject({ answers: 0, status: 'login' })
    expect(d.students.find((s) => s.id === 4644)).toMatchObject({ answers: 0, status: 'never' })
  })

  it('34 teachers, all logged in', async () => {
    const d = await school(8080)
    expect(d.teachers).toHaveLength(34)
    expect(d.teachers.every((t) => t.loggedIn && t.lastLoginAt !== null)).toBe(true)
  })

  it('the S3 last activity of a pupil equals the S4 last activity (one definition)', async () => {
    const d = await school(8078)
    const sample = d.students.filter((s) => s.answers > 0).slice(0, 4)
    expect(sample).toHaveLength(4)
    for (const s of sample) {
      expect((await student(8078, s.id)).student.lastActivityAt).toBe(s.lastActivityAt)
    }
  })
})

describe('S3 school detail: the other anchor schools (E2E-M11-31/52)', () => {
  it('940: no subscription, 1 / 1 / 10 / 0 / 0, Cemerlang 100%, no flag box, no teachers', async () => {
    const d = await school(940)
    expect(d.subscription).toBeNull()
    expect(d.warning).toBeNull()
    expect(d.tahap).toBe('Cemerlang')
    expect(d.pct).toBe(100)
    expect(d.cards).toEqual({
      students: 1,
      engaged: 1,
      answers: 10,
      teachers: 0,
      teachersLoggedIn: 0,
    })
    expect(d.teachers).toEqual([])
  })

  it('8102 Cancelled until 12 May 2027, 8107 Expired until 22 May 2026', async () => {
    expect((await school(8102)).subscription).toEqual({
      status: 'cancelled',
      endsAt: '2027-05-12T09:00:00+08:00',
    })
    expect((await school(8107)).subscription).toEqual({
      status: 'expired',
      endsAt: '2026-05-22T09:00:00+08:00',
    })
  })

  it('8102: 776 · 17 · 1,130 · 118 · 42 (the S2 value, D9), Kritikal 2.2%; statuses 17 · 4 · 755', async () => {
    const d = await school(8102)
    expect(d.cards).toEqual({
      students: 776,
      engaged: 17,
      answers: 1130,
      teachers: 118,
      teachersLoggedIn: 42,
    })
    expect([d.tahap, d.pct]).toEqual(['Kritikal', 2.2])
    expect([
      count(d.students, (s) => s.status === 'aktif'),
      count(d.students, (s) => s.status === 'login'),
      count(d.students, (s) => s.status === 'never'),
    ]).toEqual([17, 4, 755])
  })

  it('8087 and 10220 have the one-sentence flag box (no "ditapis")', async () => {
    expect((await school(8087)).warning).toEqual({ review: 3, excluded: 0 })
    expect((await school(10220)).warning).toEqual({ review: 1, excluded: 0 })
  })

  it('8765: S3 shows 16 · 6 · 222 and "Sederhana — 37.5%", the same as S2 and its own table (D9)', async () => {
    const d = await school(8765)
    expect(d.cards).toMatchObject({ students: 16, engaged: 6, answers: 222 })
    expect([d.tahap, d.pct]).toEqual(['Sederhana', 37.5])
    const s2 = await dataAs<{ studentRows: { schoolId: number; engaged: number; pct: number }[] }>(
      runtime,
      ADMIN,
      '/api/monitoring/overview',
    )
    expect(s2.studentRows.find((r) => r.schoolId === 8765)).toMatchObject({ engaged: 6, pct: 37.5 })
  })

  it.each([940, 8080, 8765, 8078, 8082, 8087, 8090, 8102, 8106, 8277, 8880, 10220, 900001])(
    'school %i: every card equals its own rows (no card contradicts the table, D9)',
    async (id) => {
      const d = await school(id)
      const engaged = count(d.students, (s) => s.engaged)
      expect(d.cards).toEqual({
        students: d.students.length,
        engaged,
        answers: d.students.reduce((a, s) => a + s.answers, 0),
        teachers: d.teachers.length,
        teachersLoggedIn: count(d.teachers, (t) => t.loggedIn),
      })
      expect(d.pct).toBe(Math.round((engaged / d.students.length) * 1000) / 10)
    },
  )

  it('the S3 teacher and answer cards of the former snapshot schools are the computed ones', async () => {
    const logged = async (id: number) => (await school(id)).cards.teachersLoggedIn
    expect(await Promise.all([8087, 8078, 8102, 8106, 8277].map(logged))).toEqual([
      12, 53, 42, 18, 16,
    ])
    expect((await school(8090)).cards.answers).toBe(120782)
    expect((await school(8106)).cards.answers).toBe(59211)
    expect((await school(8082)).cards.answers).toBe(130233)
  })

  it('8082: 68 teachers, 51 logged in and 17 "Belum login" (E2E-M11-50)', async () => {
    const d = await school(8082)
    expect(d.teachers).toHaveLength(68)
    expect(count(d.teachers, (t) => t.loggedIn)).toBe(51)
    expect(count(d.teachers, (t) => !t.loggedIn)).toBe(17)
    expect(d.cards.students).toBe(549)
  })

  it('8880: 53 · 31 · 10,196 · 2 · 1 with 14 login-only and 8 never (pupils 3201–3215 are inside)', async () => {
    const d = await school(8880)
    expect(d.cards).toEqual({
      students: 53,
      engaged: 31,
      answers: 10196,
      teachers: 2,
      teachersLoggedIn: 1,
    })
    expect([
      count(d.students, (s) => s.status === 'aktif'),
      count(d.students, (s) => s.status === 'login'),
      count(d.students, (s) => s.status === 'never'),
    ]).toEqual([31, 14, 8])
    const sessionless = d.students.find((s) => s.id === 3201)
    expect(sessionless?.lastActivityAt).not.toBeNull()
  })

  it('a fixture school renders its detail page (BR-M11-34, INFERRED)', async () => {
    const d = await school(900001)
    expect(d.cards.students).toBe(10)
    expect(d.students.map((s) => s.id)).toContain(3001)
  })
})

describe('S4 student detail (E2E-M11-35…41, 55)', () => {
  it('Student A: 71 · 53 · 18 · 74.6%, T5, last activity 16/06/2026 14:19', async () => {
    const d = await student(8080, 2008)
    expect(d.student).toMatchObject({ id: 2008, name: 'Adam Haikal Demo', level: 'T5' })
    expect(d.student.lastActivityAt).toBe('2026-06-16T14:19:57+08:00')
    expect(d.cards).toEqual({ answered: 71, correct: 53, wrong: 18, accuracy: 74.6 })
    expect(d.school.id).toBe(8080)
  })

  it('subject rows: BM 31/31, Sejarah 16/25, Bahasa Inggeris 6/15 (answers descending)', async () => {
    const d = await student(8080, 2008)
    expect(d.subjects.map((s) => [s.name, s.correct, s.total, s.pct])).toEqual([
      ['Bahasa Melayu', 31, 31, 100],
      ['Sejarah', 16, 25, 64],
      ['Bahasa Inggeris', 6, 15, 40],
    ])
  })

  it('the 18 observed Tajuk rows: Bab, counts, percentages and badges, in the observed order', async () => {
    const d = await student(8080, 2008)
    const rows = d.topics.flatMap((t) =>
      t.rows.map((r) => [t.subjectName, r.bab, r.correct, r.total, r.pct, r.badge] as const),
    )
    expect(rows).toEqual([
      ['Bahasa Inggeris', null, 2, 10, 20, 'Lemah'],
      ['Bahasa Inggeris', 1, 4, 5, 80, 'Kuat'],
      ['Bahasa Melayu', 1, 1, 1, 100, 'Kuat'],
      ['Bahasa Melayu', 1, 21, 21, 100, 'Kuat'],
      ['Bahasa Melayu', 1, 1, 1, 100, 'Kuat'],
      ['Bahasa Melayu', 3, 1, 1, 100, 'Kuat'],
      ['Bahasa Melayu', 3, 1, 1, 100, 'Kuat'],
      ['Bahasa Melayu', 4, 1, 1, 100, 'Kuat'],
      ['Bahasa Melayu', 5, 1, 1, 100, 'Kuat'],
      ['Bahasa Melayu', 9, 1, 1, 100, 'Kuat'],
      ['Bahasa Melayu', 10, 1, 1, 100, 'Kuat'],
      ['Bahasa Melayu', 13, 1, 1, 100, 'Kuat'],
      ['Bahasa Melayu', 99, 1, 1, 100, 'Kuat'],
      ['Sejarah', 1, 0, 1, 0, 'Lemah'],
      ['Sejarah', 1, 1, 1, 100, 'Kuat'],
      ['Sejarah', 1, 12, 20, 60, 'Sederhana'],
      ['Sejarah', 3, 2, 2, 100, 'Kuat'],
      ['Sejarah', 6, 1, 1, 100, 'Kuat'],
    ])
    expect(rows).toHaveLength(18)
  })

  it('the observed Tajuk names that M03 holds as topics', async () => {
    const d = await student(8080, 2008)
    const names = d.topics.flatMap((t) => t.rows.map((r) => r.name))
    for (const name of [
      'Umum',
      'Reading for main ideas',
      'SULUH MASA DEPAN',
      'Penulisan karangan lanjutan',
      'KECERDASAN MENINGKAT,',
      'WASPADA SELALU!',
      'INDAH SENI, ENDAH BUDAYA',
      'SAINS DAN TEKNOLOGI PEMACU',
      'Kemunculan tamadun awal',
      'Persekutuan Tanah Melayu 1948',
      'Warisan Negara Bangsa',
      'Lokasi Zaman Prasejarah di Dunia',
      'Pentadbiran Barat Berkaitan dengan Ekonomi',
    ]) {
      expect(names).toContain(name)
    }
  })

  it('characterisation: the four chapter-title rows show the first topic of their M03 chapter', async () => {
    const d = await student(8080, 2008)
    const names = d.topics.flatMap((t) => t.rows.map((r) => r.name))
    for (const name of [
      'Sihat Membawa Kebahagiaan 2 Lestarikan Kehijauan Bumi',
      'Sayangi Nyawa Anda',
      '19 Dunia Baharu Tani',
      'Sains Merentas Kehidupan 67 Cergas Aktif',
    ]) {
      expect(names).toContain(name)
    }
  })

  // Four observed names ("Kemahiran Membaca dan Memahami", "Tatabahasa", "Dunia Baharu Tani", "Cergas
  // Aktif") exist in M03 only as chapter titles (level 7), so `curriculumTopicId` points at the chapter's
  // first topic and S4 shows that topic's name. Owner decision needed (M03 topics or the S4 name rule).
  it.fails('the four chapter-title Tajuk names of the live page (M03 gap)', async () => {
    const d = await student(8080, 2008)
    const names = d.topics.flatMap((t) => t.rows.map((r) => r.name))
    for (const name of [
      'Kemahiran Membaca dan Memahami',
      'Tatabahasa',
      'Dunia Baharu Tani',
      'Cergas Aktif',
    ]) {
      expect(names).toContain(name)
    }
  })

  it('"Senarai Soalan": 71 of 71, newest first; row 1 and 2 are the observed questions', async () => {
    const d = await student(8080, 2008)
    expect(d.answers.available).toBe(71)
    expect(d.answers.total).toBe(71)
    expect(d.answers.rows[0]).toMatchObject({
      questionId: 700401,
      subjectName: 'Sejarah',
      chapterLabel: 'Sejarah Tingkatan 5 KSSM',
      source: 'Percubaan SPM 2025 Sejarah Melaka',
      difficulty: 2,
      answeredAt: '2026-06-16T14:19:57+08:00',
      selectedLabel: 'A',
      correctLabel: 'D',
      isCorrect: false,
      options: [
        { label: 'A', text: 'I dan IV' },
        { label: 'B', text: 'II dan III' },
        { label: 'C', text: 'III dan IV' },
        { label: 'D', text: 'I dan II' },
      ],
    })
    expect(d.answers.rows[0]?.explanation).toMatch(/^\[AI-repaired 2026-04-22\]/)
    expect(d.answers.rows[1]).toMatchObject({
      questionId: 700402,
      selectedLabel: 'C',
      correctLabel: 'B',
      source: 'Percubaan SPM 2025 Sejarah Johor Muar',
    })
    expect(
      d.answers.rows.slice(0, 8).map((r) => `${r.selectedLabel ?? ''}${r.correctLabel ?? ''}`),
    ).toEqual(['AD', 'CB', 'CB', 'BD', 'DD', 'BA', 'CC', 'AA'])
    const times = d.answers.rows.map((r) => r.answeredAt)
    expect(times).toEqual([...times].sort().reverse())
  })

  it('"Jawapan Salah": 18 answers, 18 unique questions, newest first', async () => {
    const d = await student(8080, 2008)
    expect(d.wrong).toMatchObject({ count: 18, unique: 18 })
    expect(d.wrong.rows[0]?.questionId).toBe(700401)
    expect(d.wrong.rows.every((r) => !r.isCorrect)).toBe(true)
  })

  it('no gaps for A: the chapter-label groups are 100%, 64% and 80%; Bahasa Inggeris "Umum" is ignored', async () => {
    const d = await student(8080, 2008)
    expect(d.gaps.count).toBe(0)
    expect(d.gaps.items).toEqual([])
    expect(d.gaps.strong.map((g) => [g.group, g.pct, g.answered])).toEqual([
      ['Bahasa Inggeris Tingkatan 5', 80, 5],
      ['Bahasa Melayu Tingkatan 5', 100, 31],
    ])
    const offered = curriculum.subjects({ active: true, educationLevelId: 11 }).length
    expect(d.gaps.untried).toHaveLength(offered - 3)
    expect(d.gaps.untried).not.toContain('Sejarah')
  })

  it('Pemerhatian: strength in Bahasa Melayu, weakness in Bahasa Inggeris (9/15 wrong, 40.0%)', async () => {
    const d = await student(8080, 2008)
    expect(d.observations).toEqual([
      { kind: 'strong', subjectName: 'Bahasa Melayu', pct: 100, wrong: 0, total: 31 },
      { kind: 'weak', subjectName: 'Bahasa Inggeris', pct: 40, wrong: 9, total: 15 },
    ])
  })

  it('Student B (2002): 195 · 150 · 45 · 76.9%; two gaps, both Kritikal, with their available questions', async () => {
    const d = await student(8080, 2002)
    expect(d.cards).toEqual({ answered: 195, correct: 150, wrong: 45, accuracy: 76.9 })
    expect(d.student.lastActivityAt).toBe('2026-07-05T06:13:00+08:00')
    expect(d.subjects.map((s) => [s.name, s.correct, s.total])).toEqual([
      ['Biologi', 61, 75],
      ['Sejarah', 35, 40],
      ['Bahasa Melayu', 28, 35],
      ['Pendidikan Islam', 19, 20],
      ['Fizik', 5, 15],
      ['Matematik', 2, 10],
    ])
    expect(d.wrong).toMatchObject({ count: 45, unique: 45 })
    expect(d.gaps.count).toBe(2)
    expect(
      d.gaps.items.map((g) => [g.group, g.correct, g.total, g.severity, g.availableQuestions]),
    ).toEqual([
      ['Kemahiran Bahasa Tingkatan 4', 0, 1, 'Kritikal', 1],
      ['Kemahiran Bahasa Tingkatan 5', 0, 4, 'Kritikal', 4],
    ])
    // Fizik and Matematik answers carry no chapter label: ignored by the gap rule.
    expect(d.observations.filter((o) => o.kind === 'weak').map((o) => o.subjectName)).toEqual([
      'Fizik',
      'Matematik',
    ])
  })

  it('Student C (2010): 265 · 168 · 97 · 63.4%; six gaps in the pinned order', async () => {
    const d = await student(8080, 2010)
    expect(d.cards).toEqual({ answered: 265, correct: 168, wrong: 97, accuracy: 63.4 })
    expect(d.student.lastActivityAt).toBe('2026-06-27T14:24:00+08:00')
    expect(d.wrong).toMatchObject({ count: 97, unique: 97 })
    expect(d.gaps.count).toBe(6)
    expect(d.gaps.items.map((g) => [g.group, g.pct, g.severity])).toEqual([
      ['Sains Tingkatan 3', 0, 'Kritikal'],
      ['Sains Tingkatan 5', 30, 'Lemah'],
      ['Sains Tingkatan 2', 33.3, 'Lemah'],
      ['Sejarah Tingkatan 5 KSSM', 38.9, 'Lemah'],
      ['Sains Tingkatan 4', 44.4, 'Lemah'],
      ['Sejarah Tingkatan 4', 50, 'Perlu Perhatian'],
    ])
    expect(d.subjects.find((s) => s.name === 'Sejarah')).toMatchObject({ correct: 63, total: 105 })
    expect(d.subjects.find((s) => s.name === 'Sains')).toMatchObject({ correct: 33, total: 50 })
  })

  it('the other S5-row anchors keep their observed totals (D 40/21, E 20/11, F 100/100, G, I, J)', async () => {
    const t = await teacher(8080, 2012)
    const row = (id: number) => t.students.find((s) => s.id === id)
    expect(
      [2003, 2006, 2001, 2004, 2007, 2009].map((id) => [row(id)?.answers, row(id)?.accuracy]),
    ).toEqual([
      [40, 52.5],
      [20, 55],
      [100, 100],
      [171, 63.2],
      [190, 74.7],
      [258, 76],
    ])
  })

  it('a pupil with 0 answers gets the FN-M11-4.2.11 state, never 404 (4664, 4644, 2005)', async () => {
    const offered = curriculum.subjects({ active: true, educationLevelId: 11 }).length
    for (const id of [4664, 4644, 2005]) {
      const d = await student(8080, id)
      expect(d.cards).toEqual({ answered: 0, correct: 0, wrong: 0, accuracy: 0 })
      expect(d.student.lastActivityAt).toBeNull()
      expect(d.subjects).toEqual([])
      expect(d.topics).toEqual([])
      expect(d.answers).toEqual({ available: 0, total: 0, rows: [] })
      expect(d.wrong).toEqual({ count: 0, unique: 0, rows: [] })
      expect(d.gaps).toEqual({
        count: 0,
        items: [],
        strong: [],
        untried: expect.any(Array) as string[],
      })
      expect(d.gaps.untried).toHaveLength(offered)
      expect(d.observations).toEqual([])
    }
  })

  it('the school segment is not validated (BR-M11-29): A under school 940 shows school 940 in the breadcrumb', async () => {
    const d = await student(940, 2008)
    expect(d.school.id).toBe(940)
    expect(d.student.id).toBe(2008)
  })
})

describe('S5 teacher detail (E2E-M11-42)', () => {
  it('Teacher T (2012) at 8080: 184 · 174 · 94.6% · 10; the three Cadangan counts', async () => {
    const d = await teacher(8080, 2012)
    expect(d.teacher).toMatchObject({
      id: 2012,
      name: 'Cikgu Rahimah Demo',
      lastLoginAt: '2026-06-15T12:37:00+08:00',
    })
    expect(d.cards).toEqual({ students: 184, engaged: 174, pct: 94.6, needAttention: 10 })
    expect(d.suggestions.neverLoggedIn).toBe(8)
    expect(d.suggestions.answered).toBe(174)
  })

  it('S5: 3 answered pupils below 50%, 57 between 50 and 69.9, 114 at 70 or more', async () => {
    const d = await teacher(8080, 2012)
    const acc = d.students.flatMap((s) => (s.accuracy === null ? [] : [s.accuracy]))
    expect([
      acc.filter((a) => a < 50).length,
      acc.filter((a) => a >= 50 && a < 70).length,
      acc.filter((a) => a >= 70).length,
    ]).toEqual([3, 57, 114])
    expect(d.suggestions.lowAccuracy).toBe(3)
  })

  it('the list is the whole school by name, Student A first with 71 and 74.6; "Login sahaja" row has no accuracy', async () => {
    const d = await teacher(8080, 2012)
    expect(d.students).toHaveLength(184)
    expect(d.students[0]).toMatchObject({
      id: 2008,
      level: 'T5',
      answers: 71,
      accuracy: 74.6,
      status: 'aktif',
    })
    expect(d.students[1]).toMatchObject({ id: 2001, answers: 100, accuracy: 100 })
    expect(d.students.find((s) => s.id === 2005)).toEqual({
      id: 2005,
      name: 'Akmal Demo',
      level: 'T5',
      answers: 0,
      accuracy: null,
      status: 'login',
    })
  })

  it('a teacher who never logged in has lastLoginAt null', async () => {
    const t = (await school(8082)).teachers.find((x) => !x.loggedIn)
    expect(t).toBeDefined()
    const d = await teacher(8082, (t as { id: number }).id)
    expect(d.teacher.lastLoginAt).toBeNull()
  })
})

describe('404 rules and the guards (FR-M11-07, §9)', () => {
  const status = async (as: number | null, url: string) => (await getAs(runtime, as, url)).status

  it('unknown school, student or teacher → 404; non-numeric ids do not match a route', async () => {
    expect(await status(ADMIN, '/api/monitoring/schools/99999999')).toBe(404)
    expect(await status(ADMIN, '/api/monitoring/schools/abc')).toBe(404)
    expect(await status(ADMIN, '/api/monitoring/schools/8080/students/99999999')).toBe(404)
    expect(await status(ADMIN, '/api/monitoring/schools/99999999/students/2008')).toBe(404)
    expect(await status(ADMIN, '/api/monitoring/schools/8080/teachers/99999999')).toBe(404)
    expect(await status(ADMIN, '/api/monitoring/schools/8080/students/x')).toBe(404)
  })

  it('a user who is not a T4/T5 pupil (a teacher) is 404 on S4; a pupil is 404 on S5', async () => {
    expect(await status(ADMIN, '/api/monitoring/schools/900001/students/5')).toBe(404)
    expect(await status(ADMIN, '/api/monitoring/schools/8080/teachers/2008')).toBe(404)
    expect(await status(ADMIN, '/api/monitoring/schools/8080/students/1')).toBe(404)
  })

  it.each([
    '/api/monitoring/schools/8080',
    '/api/monitoring/schools/8080/students/2008',
    '/api/monitoring/schools/8080/teachers/2012',
  ])('401 for a guest and 403 for a pupil: %s', async (url) => {
    expect(await status(null, url)).toBe(401)
    expect(await status(PELAJAR, url)).toBe(403)
  })

  it('the teacher opens the same pages (provisional, OQ-M11-02)', async () => {
    expect(await school(8080, GURU)).toEqual(await school(8080))
    expect((await student(8080, 2008, GURU)).cards.answered).toBe(71)
  })

  it('school admin (SMK DEMO 900001): own school only, 404 for any other (alias scope, INFERRED)', async () => {
    expect((await school(900001, ADMIN_SEKOLAH)).cards.students).toBe(10)
    expect(await status(ADMIN_SEKOLAH, '/api/monitoring/schools/8080')).toBe(404)
    expect(await status(ADMIN_SEKOLAH, '/api/monitoring/schools/99999999')).toBe(404)
    expect(await status(ADMIN_SEKOLAH, '/api/monitoring/schools/8080/students/2008')).toBe(404)
    expect(await status(ADMIN_SEKOLAH, '/api/monitoring/schools/8080/teachers/2012')).toBe(404)
  })

  it('school admin: a pupil or teacher of another school under the own school id is 404 (SEC-M11-02 applied to this scope)', async () => {
    expect(await status(ADMIN_SEKOLAH, '/api/monitoring/schools/900001/students/2008')).toBe(404)
    expect(await status(ADMIN_SEKOLAH, '/api/monitoring/schools/900001/teachers/2012')).toBe(404)
    // Their own pupils and teacher open; an unknown person under the own school is a plain 404.
    expect(await status(ADMIN_SEKOLAH, '/api/monitoring/schools/900001/students/3001')).toBe(200)
    expect(await status(ADMIN_SEKOLAH, '/api/monitoring/schools/900001/teachers/5')).toBe(200)
    expect(await status(ADMIN_SEKOLAH, '/api/monitoring/schools/900001/students/99999999')).toBe(
      404,
    )
  })
})
