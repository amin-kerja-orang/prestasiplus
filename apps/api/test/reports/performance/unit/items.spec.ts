import { PerformanceClassItemAnalysisSchema, PerformanceSchoolItemAnalysisSchema } from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import type { HeadcountEntryView } from '../../../../src/modules/reports/performance/services/headcount-facts.types'
import type { OptionLetter } from '../../../../src/modules/reports/performance/ports'
import { ctxOf, item, sitting, world, type World } from '../fakes/fixtures'
import type { AnswerRow } from '../fakes/in-memory-answer-facts'
import { entry } from '../fakes/in-memory-headcount-facts'

let w: World
const national = { level: 'national', label: 'x' } as const
const officer = (district: string) => ctxOf('ppd_officer', `o-${district}`, { level: 'district', stateCode: 'Negeri A', districtCode: district, label: 'x' })
/** The non-staff reader of the school item analysis (a student is refused). */
const reader = () => w.items.school(officer('Daerah A'), {}, 's1')

const at = (minute: number): Date => new Date(`2026-09-20T10:${String(minute).padStart(2, '0')}:00+08:00`)
/** One answer in the single answer store (subject 1, mode simulasi unless `over` says otherwise). */
function ans(target: World, userId: string, questionId: string, isCorrect: boolean, over: Partial<AnswerRow> = {}): void {
  target.answers.add({ userId, subjectId: '1', questionId, mode: 'simulasi', isCorrect, answeredAt: at(0), ...over })
}

/**
 * Q100: pupils 1 to 6 answer A (correct), B, B, C, A, blank. Q200: pupils 1 and 2 both correct.
 * Every answer is in the single answer store (the counts) and in a Bijak sitting (stem, options, chosen letter).
 */
function seed(target: World, pupils = ['1', '2', '3', '4', '5', '6']): void {
  const chosen: Record<string, OptionLetter | null> = { '1': 'A', '2': 'B', '3': 'B', '4': 'C', '5': 'A', '6': null }
  for (const id of pupils) {
    target.answers.addPupil({ id, schoolId: 's1' })
    target.bijak.addSitting(sitting({ userId: id, attemptId: `at${id}` }))
    const c = chosen[id] ?? null
    target.bijak.addItem(item({ attemptId: `at${id}`, userId: id, questionId: '100', chosenLetter: c, awarded: c === 'A' ? 1 : 0 }))
    ans(target, id, '100', c === 'A')
  }
  for (const id of ['1', '2'].filter((p) => pupils.includes(p))) {
    target.bijak.addItem(item({ attemptId: `at${id}`, userId: id, questionId: '200', topic: 'Karangan', subtopic: 'Ayat' }))
    ans(target, id, '200', true)
  }
}

beforeEach(() => {
  w = world()
  w.directory.addSchool({ id: 's1' }).addSchool({ id: 's2', district: 'Daerah B' }).addSubject('BM', '1', 'Bahasa Melayu')
  for (const id of ['1', '2', '3', '4', '5', '6']) w.directory.addPupil({ id, name: `Murid Ujian ${id}`, schoolId: 's1' })
  w.directory.addPupil({ id: '7', name: 'Murid Ujian 7', schoolId: 's1', levelSlug: 't5' })
  w.answers.addPupil({ id: '7', schoolId: 's1' })
  w.classes
    .add({ id: '10', schoolId: 's1', teacherId: 't1', teacherName: 'Cikgu Satu', subjectId: '1', subjectName: 'Bahasa Melayu' }, ['1', '2', '3', '4', '5', '6'])
    .add({ id: '20', schoolId: 's1', levelSlug: 't5' }, ['7'])
  seed(w)
})

const sa = ctxOf('school_admin', 'sa1')

describe('Analisa Item: school', () => {
  it('headline figures count the answers of the single store (test rows excluded)', async () => {
    ans(w, '1', '100', false, { isTest: true })
    const r = await w.items.school(sa, {})
    expect(r).toMatchObject({ variant: 'own', tingkatan: null, tingkatanOptions: ['T4'], students: 7, answers: 8, questionsTested: 2, correct: 4, accuracy: 50 })
    // Q100 is 33.3 percent (Sukar), Q200 is 100 percent (Mudah)
    expect(r.difficulty).toEqual({ mudah: 1, sederhana: 0, sukar: 1 })
    expect(r.subjects).toEqual([{ subjectId: '1', name: 'Bahasa Melayu', pupils: 6, questions: 2, accuracy: 50, wrong: 4 }])
    expect(r.gps).toEqual({ value: null, band: null, entries: 0, years: [] })
    PerformanceSchoolItemAnalysisSchema.parse(r)
  })

  it('every mode counts: a Latih Tubi and a Battle answer add to Cubaan, Jawapan and Soalan Diuji (FR-GUR-6-8, FR-AS-6-5)', async () => {
    ans(w, '3', '100', true, { mode: 'latih_tubi', answeredAt: at(5) })
    ans(w, '7', '300', false, { mode: 'battle' })
    const r = await w.items.school(sa, {})
    expect(r).toMatchObject({ answers: 10, correct: 5, questionsTested: 3 })
    expect(r.questions.find((q) => q.questionId === '100')).toMatchObject({ attempts: 7, pupils: 6 })
    // a question never sat in a Bijak paper has no snapshot: empty stem, no chips, no popular wrong option
    expect(r.questions.find((q) => q.questionId === '300')).toMatchObject({ stem: '', chips: [], popularWrongOption: null })
    PerformanceSchoolItemAnalysisSchema.parse(r)
  })

  it('the stem of a question without a Bijak snapshot comes from the question content', async () => {
    w.content.add({ questionId: '300' })
    ans(w, '7', '300', false, { mode: 'battle' })
    const q300 = (await w.items.school(sa, {})).questions.find((q) => q.questionId === '300')
    expect(q300?.stem).toBe('Soalan 300')
    expect(q300?.correctOption).toBeNull()
  })

  describe('GPS card (SW5-07, DV-M08-31)', () => {
    const graded = (studentId: string, ar: number, over: Partial<HeadcountEntryView> = {}) =>
      entry({ studentId, actuals: [ar, null], targets: [80, null], ...over })

    it('is the headcount GPS of Prestasi sekolah with the yearly series, tombstones left out', async () => {
      // A+ 0, A 1, A- 2, B 4, C 6 in 2026 (sum 13), D 7 in 2025; a dropped E (8) never counts.
      w.facts.add(
        graded('1', 95),
        graded('2', 85),
        graded('3', 75),
        graded('4', 62),
        graded('5', 52),
        graded('1', 45, { configId: '2', academicYear: 2025 }),
        graded('6', 42, { configId: '3', dropped: true }),
      )
      const s9 = await w.items.school(sa, {})
      const s1 = await w.school.school(sa)
      expect(s1.gps).toEqual({ value: 3.33, band: 'Baik', entries: 6 })
      expect(s9.gps).toEqual({ ...s1.gps, years: [{ year: 2025, gps: 7 }, { year: 2026, gps: 2.6 }] })
      PerformanceSchoolItemAnalysisSchema.parse(s9)
    })

    it('non-staff: empty below 5 graded pupils; staff see the series', async () => {
      w.facts.add(graded('1', 95), graded('2', 85), graded('3', 75), graded('4', 62))
      expect((await reader()).gps).toEqual({ value: null, band: null, entries: 0, years: [] })
      expect((await w.items.school(sa, {})).gps).toMatchObject({ value: 1.75, entries: 4, years: [{ year: 2026, gps: 1.75 }] })
    })

    it('non-staff: all years at 5 pupils or more give the full series', async () => {
      w.facts.add(graded('1', 95), graded('2', 85), graded('3', 75), graded('4', 62), graded('5', 52))
      for (const id of ['1', '2', '3', '4', '5']) w.facts.add(graded(id, 45, { configId: '2', academicYear: 2025 }))
      expect((await reader()).gps.years).toEqual([{ year: 2025, gps: 7 }, { year: 2026, gps: 2.6 }])
    })

    it('non-staff: one year under 5 pupils withholds the whole series (no differencing); staff always get it; the overall is unchanged', async () => {
      w.facts.add(graded('1', 95), graded('2', 85), graded('3', 75), graded('4', 62), graded('5', 52), graded('1', 45, { configId: '2', academicYear: 2025 }))
      expect((await reader()).gps).toEqual({ value: 3.33, band: 'Baik', entries: 6, years: [] })
      expect((await w.items.school(sa, {})).gps).toEqual({ value: 3.33, band: 'Baik', entries: 6, years: [{ year: 2025, gps: 7 }, { year: 2026, gps: 2.6 }] })
    })

    it('a tingkatan narrows it to the pupils of that level', async () => {
      w.facts.add(graded('1', 95), graded('7', 45))
      expect((await w.items.school(sa, { tingkatan: 'T5' })).gps).toEqual({ value: 7, band: 'Perlu Perhatian', entries: 1, years: [{ year: 2026, gps: 7 }] })
      expect((await w.items.school(sa, { tingkatan: 'T4' })).gps).toMatchObject({ value: 0, entries: 1 })
    })

    it('another school entries do not count; a school without entries keeps the empty card', async () => {
      w.facts.add(graded('1', 95, { schoolId: 's2' }))
      expect((await w.items.school(sa, {})).gps).toEqual({ value: null, band: null, entries: 0, years: [] })
    })
  })

  it('questions: hardest first, with counts, options and the popular wrong answer', async () => {
    const r = await w.items.school(sa, {})
    expect(r.questions.map((q) => [q.rank, q.questionId, q.wrongPct, q.attempts, q.pupils, q.level])).toEqual([
      [1, '100', 66.7, 6, 6, 'Sukar'],
      [2, '200', 0, 2, 2, 'Mudah'],
    ])
    const q = r.questions[0]
    expect(q).toMatchObject({ pupilsPct: 85.7, popularWrongCount: 2, chips: ['Tatabahasa'], stem: 'Soalan 100', subjectName: 'Bahasa Melayu' })
    expect(q?.correctOption).toEqual({ letter: 'A', text: 'Pilihan A' })
    expect(q?.popularWrongOption).toEqual({ letter: 'B', text: 'Pilihan B' })
    expect(r.questions[1]?.chips).toEqual(['Karangan', 'Ayat'])
    expect(r.questions[1]?.popularWrongOption).toBeNull()
  })

  it('wrong pupils: who got it wrong with their option, blanks left out, class label from the lowest class id', async () => {
    const q = (await w.items.school(sa, {})).questions[0]
    expect(q?.wrongPupils).toEqual([
      { userId: '2', name: 'Murid Ujian 2', classLabel: 'Kelas 10', wrongOption: 'B' },
      { userId: '3', name: 'Murid Ujian 3', classLabel: 'Kelas 10', wrongOption: 'B' },
      { userId: '4', name: 'Murid Ujian 4', classLabel: 'Kelas 10', wrongOption: 'C' },
    ])
  })

  it('privacy: a student is refused on the school item analysis, own or by id (AC-MUR-6-5, FR-MUR-6-2)', async () => {
    await expect(w.items.school(ctxOf('student', '1'), {})).rejects.toMatchObject({ status: 403 })
    await expect(w.items.school(ctxOf('student', '1'), {}, 's1')).rejects.toMatchObject({ status: 403 })
    await expect(w.items.school(ctxOf('student', '1'), { tingkatan: 'T4' })).rejects.toMatchObject({ status: 403 })
  })

  it('privacy: an officer gets no pupil rows with names and no question under 5 pupils', async () => {
    const r = await reader()
    expect(r.questions.map((q) => q.questionId)).toEqual(['100'])
    expect(r.questions[0]?.wrongPupils.every((p) => p.name === 'Murid' && p.userId === '0')).toBe(true)
    expect(r.difficulty).toEqual({ mudah: 0, sederhana: 0, sukar: 1 })
    expect(r.tingkatanOptions).toEqual([])
  })

  it('non-staff totals cover only the shown questions, so none can be recovered by subtraction', async () => {
    const r = await reader()
    expect(r.questions.map((q) => q.questionId)).toEqual(['100'])
    expect(r).toMatchObject({ answers: 6, correct: 2, accuracy: 33.3, questionsTested: 1 })
    expect(r.subjects).toEqual([{ subjectId: '1', name: 'Bahasa Melayu', pupils: 6, questions: 1, accuracy: 33.3, wrong: 4 }])
    expect(r.answers).toBe(r.questions.reduce((n, q) => n + q.attempts, 0))
    const staff = await w.items.school(sa, {})
    expect(staff).toMatchObject({ answers: 8, correct: 4, questionsTested: 2 })
  })

  it('a teacher whose only class is inactive sees no names (active classes only)', async () => {
    w.classes.add({ id: '90', schoolId: 's1', teacherId: 't5', isActive: false }, ['2', '3', '4'])
    const r = await w.items.school(ctxOf('teacher', 't5'), {})
    expect(r.questions[0]?.wrongPupils.every((p) => p.name === 'Murid' && p.userId === '0')).toBe(true)
    w.classes.add({ id: '91', schoolId: 's1', teacherId: 't5' }, ['2'])
    const after = await w.items.school(ctxOf('teacher', 't5'), {})
    expect(after.questions[0]?.wrongPupils.map((p) => p.name)).toEqual(['Murid Ujian 2', 'Murid', 'Murid'])
  })

  it('privacy: an officer sees class labels but neither names nor ids', async () => {
    const r = await w.items.school(officer('Daerah A'), {}, 's1')
    expect(r.variant).toBe('byId')
    expect(r.questions[0]?.wrongPupils).toEqual([
      { userId: '0', name: 'Murid', classLabel: 'Kelas 10', wrongOption: 'B' },
      { userId: '0', name: 'Murid', classLabel: 'Kelas 10', wrongOption: 'B' },
      { userId: '0', name: 'Murid', classLabel: 'Kelas 10', wrongOption: 'C' },
    ])
  })

  it('privacy: a teacher sees names of own pupils only', async () => {
    const own = await w.items.school(ctxOf('teacher', 't1'), {})
    expect(own.questions[0]?.wrongPupils[0]?.name).toBe('Murid Ujian 2')
    const other = await w.items.school(ctxOf('teacher', 't9'), {})
    expect(other.questions[0]?.wrongPupils[0]).toMatchObject({ name: 'Murid', userId: '0' })
  })

  it('privacy: fewer than 5 pupils behind the whole school hides the figures from an officer', async () => {
    const small = world()
    small.directory.addSchool({ id: 's1' })
    for (const id of ['1', '2', '3']) small.directory.addPupil({ id, schoolId: 's1' })
    seed(small, ['1', '2', '3'])
    const r = await small.items.school(officer('Daerah A'), {}, 's1')
    expect(r).toMatchObject({ answers: null, correct: null, accuracy: null, questionsTested: null, subjects: [], questions: [] })
    const staff = await small.items.school(sa, {})
    expect(staff.answers).toBe(5)
    expect(staff.questions.length).toBeGreaterThan(0)
  })

  it('a school with no answers has null answers, correct, accuracy and questionsTested', async () => {
    const e = world()
    e.directory.addSchool({ id: 's1' })
    const r = await e.items.school(sa, {})
    expect(r).toMatchObject({ students: 0, answers: null, correct: null, accuracy: null, questionsTested: null, tingkatanOptions: [], questions: [] })
    PerformanceSchoolItemAnalysisSchema.parse(r)
  })

  it('non-staff always get the all-levels view: tingkatan cannot be used to difference a small level (M2)', async () => {
    const all = await reader()
    for (const t of ['T4', 'T5']) {
      const r = await w.items.school(officer('Daerah A'), { tingkatan: t }, 's1')
      expect(r.tingkatan).toBeNull()
      expect(r.students).toBe(all.students)
      expect(r.questions).toEqual(all.questions)
      expect(r.tingkatanOptions).toEqual([])
    }
  })

  it('a district officer is matched on state AND district; a district without a state matches nothing (L1)', async () => {
    const wrongState = ctxOf('ppd_officer', 'o', { level: 'district', stateCode: 'Negeri B', districtCode: 'Daerah A', label: 'x' })
    const noState = ctxOf('ppd_officer', 'o', { level: 'district', districtCode: 'Daerah A', label: 'x' })
    await expect(w.items.school(wrongState, {}, 's1')).rejects.toMatchObject({ status: 403 })
    await expect(w.items.school(noState, {}, 's1')).rejects.toMatchObject({ status: 403 })
    await expect(w.items.school(officer('Daerah A'), {}, 's1')).resolves.toBeTruthy()
  })

  it('tingkatan T1 to T5 narrow the pupils by class level for staff; anything else is ignored', async () => {
    expect(await w.items.school(sa, { tingkatan: 'T4' })).toMatchObject({ tingkatan: 'T4', students: 6 })
    const t5 = await w.items.school(sa, { tingkatan: 'T5' })
    expect(t5).toMatchObject({ tingkatan: 'T5', students: 1, questions: [] })
    expect(await w.items.school(sa, { tingkatan: 'T1' })).toMatchObject({ tingkatan: 'T1', students: 0, questions: [] })
    expect(await w.items.school(sa, { tingkatan: 'T9' })).toMatchObject({ tingkatan: null, students: 7 })
    expect(await w.items.school(sa, { tingkatan: 't4' })).toMatchObject({ tingkatan: null, students: 7 })
  })

  it('a tingkatan narrows the answers too: the figures of T4 are the answers of its pupils only (FR-AS-6-1)', async () => {
    ans(w, '7', '100', true)
    expect(await w.items.school(sa, { tingkatan: 'T5' })).toMatchObject({ students: 1, answers: 1, correct: 1, questionsTested: 1 })
    expect(await w.items.school(sa, { tingkatan: 'T4' })).toMatchObject({ students: 6, answers: 8, questionsTested: 2 })
    expect(await w.items.school(sa, {})).toMatchObject({ students: 7, answers: 9 })
  })

  it('tingkatanOptions: the tingkatan that have data, from T1 to T5 (AC-AS-6-6)', async () => {
    // data in T4 only (pupils 1 to 6)
    expect((await w.items.school(sa, {})).tingkatanOptions).toEqual(['T4'])
    // a pupil of T5 answers, a pupil of T3 does not: the chips are Semua, Tingkatan 4, Tingkatan 5
    ans(w, '7', '100', true)
    w.directory.addPupil({ id: '8', name: 'Murid Ujian 8', schoolId: 's1', levelSlug: 't3' })
    w.answers.addPupil({ id: '8', schoolId: 's1' })
    expect((await w.items.school(sa, {})).tingkatanOptions).toEqual(['T4', 'T5'])
    // the chips do not shrink when a tingkatan is chosen
    expect((await w.items.school(sa, { tingkatan: 'T5' })).tingkatanOptions).toEqual(['T4', 'T5'])
    // data in T1 and T3 too
    w.directory.addPupil({ id: '9', name: 'Murid Ujian 9', schoolId: 's1', levelSlug: 't1' })
    w.answers.addPupil({ id: '9', schoolId: 's1' })
    ans(w, '8', '100', true)
    ans(w, '9', '100', true)
    expect((await w.items.school(sa, {})).tingkatanOptions).toEqual(['T1', 'T3', 'T4', 'T5'])
  })

  it('gates: role, scope, unknown id, no school', async () => {
    await expect(w.items.school(ctxOf('parent', 'p'), {})).rejects.toMatchObject({ status: 403 })
    await expect(w.items.school(ctxOf('sponsor', 'p'), {})).rejects.toMatchObject({ status: 403 })
    await expect(w.items.school(sa, {}, 's2')).rejects.toMatchObject({ status: 403 })
    await expect(w.items.school(sa, {}, '999')).rejects.toMatchObject({ status: 403 })
    await expect(w.items.school(officer('Daerah B'), {}, 's1')).rejects.toMatchObject({ status: 403 })
    await expect(w.items.school(officer('Daerah A'), {})).rejects.toMatchObject({ status: 404 })
    await expect(w.items.school(ctxOf('admin', 'a', national), {})).rejects.toMatchObject({ status: 404 })
  })

  it('an admin may open any school; an unknown id gives the empty payload', async () => {
    const admin = ctxOf('admin', 'a', national)
    expect((await w.items.school(admin, {}, 's1')).students).toBe(7)
    const empty = await w.items.school(admin, {}, '999')
    expect(empty).toMatchObject({ variant: 'byId', students: 0, answers: null, questions: [], tingkatanOptions: [] })
    expect(empty.school.id).toBe('999')
    PerformanceSchoolItemAnalysisSchema.parse(empty)
  })

  it('the cap keeps 50 questions but difficulty counts all of them', async () => {
    for (let i = 0; i < 60; i++) {
      for (const id of ['1', '2', '3', '4', '5']) ans(w, id, String(1000 + i), true)
    }
    const r = await w.items.school(sa, {})
    expect(r.questions).toHaveLength(50)
    expect(r.questions.at(-1)?.rank).toBe(50)
    expect(r.difficulty.mudah + r.difficulty.sederhana + r.difficulty.sukar).toBe(62)
    expect(r.questionsTested).toBe(62)
  })

  it('the Tahap of a school question is the whole-number % betul band: 71 Mudah, 70 and 40 Sederhana, 39 Sukar (AC-GUR-6-11)', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' }).addSubject('BM', '1', 'Bahasa Melayu')
    x.directory.addPupil({ id: '1', schoolId: 's1' })
    x.answers.addPupil({ id: '1', schoolId: 's1' })
    for (const [q, right] of [['q71', 71], ['q70', 70], ['q40', 40], ['q39', 39]] as const) {
      for (let i = 0; i < 100; i++) ans(x, '1', q, i < right, { answeredAt: at(i % 60) })
    }
    const r = await x.items.school(sa, {})
    expect(r.difficulty).toEqual({ mudah: 1, sederhana: 2, sukar: 1 })
    expect(Object.fromEntries(r.questions.map((q) => [q.questionId, q.level]))).toEqual({ q71: 'Mudah', q70: 'Sederhana', q40: 'Sederhana', q39: 'Sukar' })
  })
})

describe('Analisa Item: class', () => {
  const teacher = ctxOf('teacher', 't1')

  /** A class of `n` pupils (101..), every one with 24 filler answers (pupil i right in 2i of them, so the pooled ranking has no ties) and, for those where `q500` gives a boolean, one answer to Q500. */
  function ranked(n: number, q500: (i: number) => boolean | null, over: (i: number) => Partial<AnswerRow> = () => ({})): World {
    const x = world()
    x.directory.addSchool({ id: 's1' }).addSubject('BM', '1', 'Bahasa Melayu')
    const ids = Array.from({ length: n }, (_, i) => String(101 + i))
    x.classes.add({ id: '10', schoolId: 's1', teacherId: 't1', subjectId: '1' }, ids)
    ids.forEach((id, i) => {
      x.directory.addPupil({ id, schoolId: 's1' })
      x.answers.addPupil({ id, schoolId: 's1' })
      for (let k = 0; k < 24; k++) ans(x, id, `f${k}`, k < 2 * i)
      const c = q500(i)
      if (c !== null) ans(x, id, '500', c, over(i))
    })
    return x
  }
  const row500 = async (x: World) => (await x.items.classAnalysis(teacher, '10')).analysis.discrimination.rows.find((r) => r.questionId === '500')

  it('the wire level slug is the BE-17 slug (tingkatan-5), while the internal code stays t5', async () => {
    w.classes.add({ id: '30', schoolId: 's1', teacherId: 't1', levelSlug: 't5', classLevelSlug: 'tingkatan-5' }, ['7'])
    expect((await w.items.classAnalysis(teacher, '30')).class.levelSlug).toBe('tingkatan-5')
  })

  it('per question: attempts, students, accuracy, index, wrong students, options', async () => {
    const r = await w.items.classAnalysis(teacher, '10')
    expect(r.class).toEqual({ id: '10', name: 'Kelas 10', subjectName: 'Bahasa Melayu', levelSlug: 't4', year: 2026, students: 6 })
    expect(r.analysis.questionCount).toBe(2)
    expect(r.analysis.summary).toEqual({ mudah: 1, sederhana: 0, sukar: 1 })
    const q = r.analysis.difficulty[0]
    expect(q).toMatchObject({ questionId: '100', attempts: 6, students: 6, accuracy: 33.3, index: 0.67, level: 'Sukar', text: 'Soalan 100', subject: 'Bahasa Melayu', topic: 'Tatabahasa' })
    expect(q?.wrongStudents.map((s) => [s.userId, s.name, s.times])).toEqual([
      ['2', 'Murid Ujian 2', 1],
      ['3', 'Murid Ujian 3', 1],
      ['4', 'Murid Ujian 4', 1],
      ['6', 'Murid Ujian 6', 1],
    ])
    expect(q?.popularWrong).toEqual({ letter: 'B', text: 'Pilihan B', times: 2 })
    expect(q?.correctOption).toEqual({ letter: 'A', text: 'Pilihan A' })
    PerformanceClassItemAnalysisSchema.parse(r)
  })

  it('every mode counts: a question answered in Latih Tubi and in a Bijak sitting has both attempts (FR-GUR-6-8)', async () => {
    ans(w, '2', '100', true, { mode: 'latih_tubi', answeredAt: at(9) })
    const q = (await w.items.classAnalysis(teacher, '10')).analysis.difficulty.find((d) => d.questionId === '100')
    expect(q).toMatchObject({ attempts: 7, students: 6, accuracy: 42.9 })
    // pupil 2 was wrong once (Bijak) and right once (Latih Tubi): one wrong time
    expect(q?.wrongStudents.find((s) => s.userId === '2')?.times).toBe(1)
  })

  it('Tahap on the whole-number % betul and the tiers add up: 71 Mudah; 70 and 40 Sederhana; 39 Sukar (AC-GUR-6-11, FR-GUR-6-2)', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' })
    x.classes.add({ id: '10', schoolId: 's1', teacherId: 't1' }, ['1'])
    x.directory.addPupil({ id: '1', schoolId: 's1' })
    x.answers.addPupil({ id: '1', schoolId: 's1' })
    for (const [q, right] of [['q71', 71], ['q70', 70], ['q40', 40], ['q39', 39]] as const) {
      for (let i = 0; i < 100; i++) ans(x, '1', q, i < right, { answeredAt: at(i % 60) })
    }
    const r = await x.items.classAnalysis(teacher, '10')
    const level = Object.fromEntries(r.analysis.difficulty.map((d) => [d.questionId, d.level]))
    expect(level).toEqual({ q71: 'Mudah', q70: 'Sederhana', q40: 'Sederhana', q39: 'Sukar' })
    expect(r.analysis.summary).toEqual({ mudah: 1, sederhana: 2, sukar: 1 })
    expect(r.analysis.summary.mudah + r.analysis.summary.sederhana + r.analysis.summary.sukar).toBe(r.analysis.questionCount)
    // the index (1 - p) is shown but no longer decides the level: 40 percent has index 0.6, 70 percent 0.3
    expect(r.analysis.difficulty.find((d) => d.questionId === 'q70')?.index).toBe(0.3)
  })

  it('discrimination: 10 pupils, top 3 right and bottom 3 wrong on the first attempt gives D = 1.00 "Sangat Baik" (AC-GUR-6-10)', async () => {
    const x = ranked(10, (i) => i >= 7)
    const d = (await x.items.classAnalysis(teacher, '10')).analysis.discrimination
    expect(d.sufficient).toBe(true)
    expect(await row500(x)).toEqual({ questionId: '500', text: '', upperPct: 100, lowerPct: 0, index: 1, status: 'Sangat Baik' })
    PerformanceClassItemAnalysisSchema.parse(await x.items.classAnalysis(teacher, '10'))
  })

  it('discrimination needs 10 pupils with an answer to the question: 9 give no row, the 10th gives one', async () => {
    const nine = ranked(9, (i) => i >= 6)
    expect((await nine.items.classAnalysis(teacher, '10')).analysis.discrimination).toEqual({ sufficient: false, rows: [] })
    expect(await row500(ranked(10, (i) => i >= 7))).toBeDefined()
  })

  it('N is the pupils who answered THAT question, not the class: 12 members, 9 answered Q500 gives no row for it while the questions of all 12 do', async () => {
    const x = ranked(12, (i) => (i < 3 ? null : i >= 8))
    expect(await row500(x)).toBeUndefined()
    const rows = (await x.items.classAnalysis(teacher, '10')).analysis.discrimination.rows
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.questionId.startsWith('f'))).toBe(true)
  })

  it('N counts the pupils of any mode: Latih Tubi and Battle answers together reach 10', async () => {
    const x = ranked(10, (i) => i >= 7, (i) => ({ mode: i % 2 === 0 ? 'latih_tubi' : 'battle' }))
    expect(await row500(x)).toMatchObject({ index: 1 })
  })

  it('the groups are ceil(27 percent of N): 12 pupils give groups of 4', async () => {
    // top 4 (i 8 to 11) right, bottom 4 (i 0 to 3) wrong, ceil(0.27 x 12) = 4; with round() the group would be 3
    expect(await row500(ranked(12, (i) => i >= 8))).toMatchObject({ upperPct: 100, lowerPct: 0, index: 1 })
    // only 3 of the top 4 right: D = (3 - 0) / 4 = 0.75
    expect(await row500(ranked(12, (i) => i >= 9))).toMatchObject({ upperPct: 75, lowerPct: 0, index: 0.75, status: 'Sangat Baik' })
  })

  it('D is rounded to 2 decimals: 2 of 3 right in the upper group gives 0.67', async () => {
    const x = ranked(10, (i) => i === 7 || i === 8)
    expect(await row500(x)).toMatchObject({ upperPct: 66.7, lowerPct: 0, index: 0.67, status: 'Sangat Baik' })
  })

  it('a pupil counts as right when the FIRST attempt in scope was right, even across modes', async () => {
    // pupil 9 (top) is wrong first in Latih Tubi, then right in a Bijak sitting: counts as wrong
    const x = ranked(10, (i) => (i === 7 || i === 8 ? true : i === 9 ? false : false), (i) => (i === 9 ? { mode: 'latih_tubi', answeredAt: at(0) } : {}))
    ans(x, '110', '500', true, { mode: 'simulasi', answeredAt: at(30) })
    expect(await row500(x)).toMatchObject({ index: 0.67 })
    // the opposite order: right first, wrong later: counts as right
    const y = ranked(10, (i) => i >= 7, (i) => (i === 9 ? { answeredAt: at(0) } : {}))
    ans(y, '110', '500', false, { mode: 'latih_tubi', answeredAt: at(30) })
    expect(await row500(y)).toMatchObject({ index: 1 })
  })

  it('ranking uses the pooled accuracy over ALL answers in scope; ties are broken by pupil id ascending', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' })
    const ids = Array.from({ length: 10 }, (_, i) => String(101 + i))
    x.classes.add({ id: '10', schoolId: 's1', teacherId: 't1' }, ids)
    // every pupil has the same pooled accuracy (1 right of 2): the order is the id order, so 101 to 103 are the upper group and 108 to 110 the lower
    ids.forEach((id) => {
      x.answers.addPupil({ id, schoolId: 's1' })
      ans(x, id, '600', true, { answeredAt: at(0) })
      ans(x, id, '601', false, { answeredAt: at(1) })
    })
    // Q500: only the pupils 101 to 103 are right
    ids.forEach((id, i) => ans(x, id, '500', i < 3, { answeredAt: at(2) }))
    const r = (await x.items.classAnalysis(teacher, '10')).analysis.discrimination.rows.find((q) => q.questionId === '500')
    expect(r).toMatchObject({ upperPct: 100, lowerPct: 0, index: 1 })
  })

  it('a question without a Bijak snapshot takes its text from the question content and shows no chosen-letter data', async () => {
    const x = world()
    x.directory.addSchool({ id: 's1' }).addSubject('BM', '1', 'Bahasa Melayu')
    x.classes.add({ id: '10', schoolId: 's1', teacherId: 't1' }, ['1'])
    x.directory.addPupil({ id: '1', name: 'Murid Ujian 1', schoolId: 's1' })
    x.answers.addPupil({ id: '1', schoolId: 's1' })
    x.content.add({ questionId: 'Z1' })
    ans(x, '1', 'Z1', false, { mode: 'battle' })
    const q = (await x.items.classAnalysis(teacher, '10')).analysis.difficulty[0]
    expect(q).toMatchObject({ questionId: 'Z1', text: 'Soalan Z1', subject: 'Bahasa Melayu', topic: null, subtopic: null, popularWrong: null, correctOption: null, attempts: 1 })
    expect(q?.wrongStudents).toEqual([{ userId: '1', name: 'Murid Ujian 1', times: 1 }])
    PerformanceClassItemAnalysisSchema.parse(await x.items.classAnalysis(teacher, '10'))
  })

  it('stem, options and topic are the snapshot carried by the fact, with no live lookup (AC4)', async () => {
    w.bijak.addItem(item({ attemptId: 'at1', userId: '1', questionId: '300', stem: 'Teks asal beku', topic: 'Topik beku', options: [{ letter: 'A', text: 'Jawapan beku' }] }))
    ans(w, '1', '300', true)
    // the live question text differs, but the snapshot wins
    w.content.add({ questionId: '300' })
    const q = (await w.items.classAnalysis(teacher, '10')).analysis.difficulty.find((d) => d.questionId === '300')
    expect(q).toMatchObject({ text: 'Teks asal beku', topic: 'Topik beku', correctOption: { letter: 'A', text: 'Jawapan beku' } })
  })

  it('403 for unknown, another teacher class, wrong roles; an admin opens any classroom', async () => {
    await expect(w.items.classAnalysis(teacher, '999')).rejects.toMatchObject({ status: 403 })
    await expect(w.items.classAnalysis(ctxOf('teacher', 't2'), '10')).rejects.toMatchObject({ status: 403 })
    await expect(w.items.classAnalysis(ctxOf('student', '1'), '10')).rejects.toMatchObject({ status: 403 })
    await expect(w.items.classAnalysis(sa, '10')).rejects.toMatchObject({ status: 403 })
    await expect(w.items.classAnalysis(ctxOf('admin', 'a', national), '10')).resolves.toBeTruthy()
  })

  it('an empty class is a valid payload', async () => {
    w.classes.add({ id: '30', schoolId: 's1', teacherId: 't1' }, [])
    const r = await w.items.classAnalysis(teacher, '30')
    expect(r.analysis).toEqual({ questionCount: 0, summary: { mudah: 0, sederhana: 0, sukar: 0 }, difficulty: [], discrimination: { sufficient: false, rows: [] } })
  })

  it('class list: teacher own including inactive; admin newest first; others 403', async () => {
    w.classes.add({ id: '31', schoolId: 's1', teacherId: 't1', isActive: false, createdAt: new Date('2026-05-01T00:00:00+08:00') })
    expect((await w.items.classList(teacher)).map((c) => c.id)).toEqual(['10', '31'])
    expect((await w.items.classList(ctxOf('admin', 'a', national))).map((c) => c.id)).toEqual(['31', '10', '20'])
    await expect(w.items.classList(ctxOf('school_admin', 'sa1'))).rejects.toMatchObject({ status: 403 })
  })
})
