import { PerformanceClassItemAnalysisSchema, PerformanceSchoolItemAnalysisSchema } from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import type { OptionLetter } from '../../../../src/modules/reports/performance/ports'
import { ctxOf, item, sitting, world, type World } from '../fakes/fixtures'

let w: World
const national = { level: 'national', label: 'x' } as const
const officer = (district: string) => ctxOf('ppd_officer', `o-${district}`, { level: 'district', stateCode: 'Negeri A', districtCode: district, label: 'x' })

/** Q100: pupils 1 to 6 answer A (correct), B, B, C, A, blank. Q200: pupils 1 and 2 both correct. */
function seed(target: World, pupils = ['1', '2', '3', '4', '5', '6']): void {
  const chosen: Record<string, OptionLetter | null> = { '1': 'A', '2': 'B', '3': 'B', '4': 'C', '5': 'A', '6': null }
  for (const id of pupils) {
    target.bijak.addSitting(sitting({ userId: id, attemptId: `at${id}` }))
    const c = chosen[id] ?? null
    target.bijak.addItem(item({ attemptId: `at${id}`, userId: id, questionId: '100', chosenLetter: c, awarded: c === 'A' ? 1 : 0 }))
  }
  for (const id of ['1', '2'].filter((p) => pupils.includes(p))) target.bijak.addItem(item({ attemptId: `at${id}`, userId: id, questionId: '200', topic: 'Karangan', subtopic: 'Ayat' }))
}

beforeEach(() => {
  w = world()
  w.directory.addSchool({ id: 's1' }).addSchool({ id: 's2', district: 'Daerah B' })
  for (const id of ['1', '2', '3', '4', '5', '6']) w.directory.addPupil({ id, name: `Murid Ujian ${id}`, schoolId: 's1' })
  w.directory.addPupil({ id: '7', name: 'Murid Ujian 7', schoolId: 's1', levelSlug: 't5' })
  w.classes
    .add({ id: '10', schoolId: 's1', teacherId: 't1', teacherName: 'Cikgu Satu', subjectId: '1', subjectName: 'Bahasa Melayu' }, ['1', '2', '3', '4', '5', '6'])
    .add({ id: '20', schoolId: 's1', levelSlug: 't5' }, ['7'])
  seed(w)
})

const sa = ctxOf('school_admin', 'sa1')

describe('Analisa Item: school', () => {
  it('headline figures count item facts of submitted sittings (test rows excluded)', async () => {
    w.bijak.addSitting(sitting({ userId: '1', attemptId: 'test1' }), { isTest: true })
    w.bijak.addItem(item({ attemptId: 'test1', userId: '1', questionId: '100', chosenLetter: 'D', awarded: 0 }))
    const r = await w.items.school(sa, {})
    expect(r).toMatchObject({ variant: 'own', tingkatan: null, students: 7, answers: 8, correct: 4, accuracy: 50 })
    expect(r.difficulty).toEqual({ mudah: 1, sederhana: 1, sukar: 0 })
    expect(r.subjects).toEqual([{ subjectId: '1', name: 'Bahasa Melayu', pupils: 6, questions: 2, accuracy: 50, wrong: 4 }])
    expect(r.gps).toEqual({ value: null, band: null, entries: 0, years: [] })
    PerformanceSchoolItemAnalysisSchema.parse(r)
  })

  it('questions: hardest first, with counts, options and the popular wrong answer', async () => {
    const r = await w.items.school(sa, {})
    expect(r.questions.map((q) => [q.rank, q.questionId, q.wrongPct, q.attempts, q.pupils, q.level])).toEqual([
      [1, '100', 66.7, 6, 6, 'Sederhana'],
      [2, '200', 0, 2, 2, 'Mudah'],
    ])
    const q = r.questions[0]
    expect(q).toMatchObject({ pupilsPct: 85.7, popularWrongCount: 2, chips: ['Tatabahasa'], stem: 'Soalan 100' })
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

  it('privacy: a student gets no pupil rows; questions under 5 pupils are omitted', async () => {
    const r = await w.items.school(ctxOf('student', '1'), {})
    expect(r.questions.map((q) => q.questionId)).toEqual(['100'])
    expect(r.questions[0]?.wrongPupils).toEqual([])
    expect(r.difficulty).toEqual({ mudah: 0, sederhana: 1, sukar: 0 })
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

  it('privacy: fewer than 5 pupils behind the whole school hides the figures from a student', async () => {
    const small = world()
    small.directory.addSchool({ id: 's1' })
    for (const id of ['1', '2', '3']) small.directory.addPupil({ id, schoolId: 's1' })
    seed(small, ['1', '2', '3'])
    const r = await small.items.school(ctxOf('student', '1'), {})
    expect(r).toMatchObject({ answers: null, correct: null, accuracy: null, subjects: [], questions: [] })
    const staff = await small.items.school(sa, {})
    expect(staff.answers).toBe(5)
    expect(staff.questions.length).toBeGreaterThan(0)
  })

  it('a school with no sittings has null answers, correct and accuracy', async () => {
    const e = world()
    e.directory.addSchool({ id: 's1' })
    const r = await e.items.school(sa, {})
    expect(r).toMatchObject({ students: 0, answers: null, correct: null, accuracy: null, questions: [] })
    PerformanceSchoolItemAnalysisSchema.parse(r)
  })

  it('non-staff always get the all-levels view: tingkatan cannot be used to difference a small level (M2)', async () => {
    const all = await w.items.school(ctxOf('student', '1'), {})
    for (const t of ['T4', 'T5']) {
      const r = await w.items.school(ctxOf('student', '1'), { tingkatan: t })
      expect(r.tingkatan).toBeNull()
      expect(r.students).toBe(all.students)
      expect(r.questions).toEqual(all.questions)
    }
    const off = await w.items.school(officer('Daerah A'), { tingkatan: 'T5' }, 's1')
    expect(off.tingkatan).toBeNull()
  })

  it('a district officer is matched on state AND district; a district without a state matches nothing (L1)', async () => {
    const wrongState = ctxOf('ppd_officer', 'o', { level: 'district', stateCode: 'Negeri B', districtCode: 'Daerah A', label: 'x' })
    const noState = ctxOf('ppd_officer', 'o', { level: 'district', districtCode: 'Daerah A', label: 'x' })
    await expect(w.items.school(wrongState, {}, 's1')).rejects.toMatchObject({ status: 403 })
    await expect(w.items.school(noState, {}, 's1')).rejects.toMatchObject({ status: 403 })
    await expect(w.items.school(officer('Daerah A'), {}, 's1')).resolves.toBeTruthy()
  })

  it('tingkatan narrows pupils by class level for staff; anything else is ignored', async () => {
    expect(await w.items.school(sa, { tingkatan: 'T4' })).toMatchObject({ tingkatan: 'T4', students: 6 })
    const t5 = await w.items.school(sa, { tingkatan: 'T5' })
    expect(t5).toMatchObject({ tingkatan: 'T5', students: 1, questions: [] })
    expect(await w.items.school(sa, { tingkatan: 'T9' })).toMatchObject({ tingkatan: null, students: 7 })
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
    expect(empty).toMatchObject({ variant: 'byId', students: 0, answers: null, questions: [] })
    expect(empty.school.id).toBe('999')
    PerformanceSchoolItemAnalysisSchema.parse(empty)
  })

  it('the cap keeps 50 questions but difficulty counts all of them', async () => {
    for (let i = 0; i < 60; i++) {
      for (const id of ['1', '2', '3', '4', '5']) w.bijak.addItem(item({ attemptId: `at${id}`, userId: id, questionId: String(1000 + i) }))
    }
    const r = await w.items.school(sa, {})
    expect(r.questions).toHaveLength(50)
    expect(r.questions.at(-1)?.rank).toBe(50)
    expect(r.difficulty.mudah + r.difficulty.sederhana + r.difficulty.sukar).toBe(62)
  })
})

describe('Analisa Item: class', () => {
  const teacher = ctxOf('teacher', 't1')

  it('per question: attempts, students, accuracy, index, wrong students, options', async () => {
    const r = await w.items.classAnalysis(teacher, '10')
    expect(r.class).toEqual({ id: '10', name: 'Kelas 10', subjectName: 'Bahasa Melayu', levelSlug: 't4', year: 2026, students: 6 })
    expect(r.analysis.questionCount).toBe(2)
    expect(r.analysis.summary).toEqual({ mudah: 1, sederhana: 1, sukar: 0 })
    const q = r.analysis.difficulty[0]
    expect(q).toMatchObject({ questionId: '100', attempts: 6, students: 6, accuracy: 33.3, index: 0.67, level: 'Sederhana', text: 'Soalan 100', topic: 'Tatabahasa' })
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

  it('discrimination: upper and lower 27 percent of the finished members', async () => {
    const d = (await w.items.classAnalysis(teacher, '10')).analysis.discrimination
    expect(d.sufficient).toBe(true)
    // ranked 1, 5, 2, 3, 4, 6 -> upper {1, 5}, lower {4, 6}; Q200 has no lower answers and is skipped
    expect(d.rows).toEqual([{ questionId: '100', text: 'Soalan 100', upperPct: 100, lowerPct: 0, index: 1, status: 'Sangat Baik' }])
  })

  it('discrimination needs 4 finished members', async () => {
    const small = world()
    small.directory.addSchool({ id: 's1' })
    small.classes.add({ id: '10', schoolId: 's1', teacherId: 't1', subjectId: '1' }, ['1', '2', '3'])
    seed(small, ['1', '2', '3'])
    const r = await small.items.classAnalysis(teacher, '10')
    expect(r.analysis.discrimination).toEqual({ sufficient: false, rows: [] })
    expect(r.analysis.questionCount).toBe(2)
  })

  it('a provisional-only member is not finished', async () => {
    const small = world()
    small.classes.add({ id: '10', schoolId: 's1', teacherId: 't1', subjectId: '1' }, ['1', '2', '3', '4'])
    seed(small, ['1', '2', '3'])
    small.bijak.addSitting(sitting({ userId: '4', provisional: true }))
    expect((await small.items.classAnalysis(teacher, '10')).analysis.discrimination.sufficient).toBe(false)
  })

  it('stem, options and topic are the snapshot carried by the fact, with no live lookup (AC4)', async () => {
    w.bijak.addItem(item({ attemptId: 'at1', userId: '1', questionId: '300', stem: 'Teks asal beku', topic: 'Topik beku', options: [{ letter: 'A', text: 'Jawapan beku' }] }))
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
