import { KIRKPATRICK_PDF } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { TextPdfAdapter } from '../../src/modules/reports/kirkpatrick/adapters/text-pdf.adapter'
import { bandsOf, monthOf, monthsOf, populationOf, schoolsOf, studentsOf, subjectsOf, totalsOf } from '../../src/modules/reports/kirkpatrick/domain/aggregate'
import {
  bandOfAnswers,
  fmt1,
  gradeOfAccuracyTenths,
  mean1,
  pct1,
  pctTenths,
  round1,
  statusOfAccuracy,
  statusOfIntervention,
  strengthOfR,
  tahapOfScore,
} from '../../src/modules/reports/kirkpatrick/domain/rules'
import { summarizeFields } from '../../src/modules/reports/kirkpatrick/http/request'
import type { Cell } from '../../src/modules/reports/kirkpatrick/kirkpatrick.repository'
import { reportLines } from '../../src/modules/reports/kirkpatrick/services/export.service'
import { schoolIdOf } from '../../src/modules/reports/kirkpatrick/services/scope'
import { feedbackOf } from '../../src/modules/reports/kirkpatrick/services/levels.service'
import { streakOf } from '../../src/modules/reports/kirkpatrick/services/student.service'

describe('number formats (BR-M12-03, BR-M12-33)', () => {
  it('pct1, mean1 and pctTenths round half up in integer arithmetic and give 0 for an empty whole', () => {
    expect(pct1(1, 3)).toBe(33.3)
    expect(pct1(2, 3)).toBe(66.7)
    expect(pct1(1, 8)).toBe(12.5)
    expect(pct1(1, 16)).toBe(6.3) // 6.25 rounds up
    expect(pct1(5, 0)).toBe(0)
    expect(pctTenths(1, 3)).toBe(333)
    expect(mean1(17, 4)).toBe(4.3)
    expect(mean1(0, 0)).toBe(0)
  })

  it('round1 and fmt1', () => {
    expect(round1(1.25)).toBe(1.3)
    expect(round1(-1.25)).toBe(-1.3)
    expect(fmt1(650)).toBe('650')
    expect(fmt1(12.34)).toBe('12.3')
    expect(fmt1(4)).toBe('4')
  })
})

describe('bands, tahap, grades, statuses', () => {
  it('BR-M12-06 bands at the boundaries', () => {
    expect(
      [0, 1, 4, 5, 19, 20, 49, 50, 500].map(bandOfAnswers),
    ).toEqual(['tidakTerlibat', 'minimum', 'minimum', 'berkembang', 'berkembang', 'konsisten', 'konsisten', 'champion', 'champion'])
  })

  it('BR-M12-12 tahap by score', () => {
    expect([100, 80, 79.9, 60, 40, 20, 19.9, 0].map(tahapOfScore)).toEqual(['champion', 'champion', 'konsisten', 'konsisten', 'berkembang', 'minimum', 'tidakTerlibat', 'tidakTerlibat'])
  })

  it('BR-M12-09 subject status and BR-M12-21 grade from the displayed accuracy', () => {
    expect([80, 79.9, 50, 49.9].map(statusOfAccuracy)).toEqual(['Mastered', 'Developing', 'Developing', 'Beginning'])
    expect([1000, 900, 899, 800, 700, 650, 600, 550, 500, 400, 300, 299, 0].map(gradeOfAccuracyTenths)).toEqual([
      'A+', 'A+', 'A', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G', 'G',
    ])
  })

  it('BR-M12-25 strength of r', () => {
    expect([0.1298, 0.3, 0.69, 0.7, -0.8].map(strengthOfR)).toEqual(['Lemah', 'Sederhana', 'Sederhana', 'Kuat', 'Kuat'])
  })

  it('BR-M12-26 intervention status is derived', () => {
    expect(statusOfIntervention({ beforeAccuracy: 1, afterAccuracy: null })).toBe('Menunggu Semakan')
    expect(statusOfIntervention({ beforeAccuracy: null, afterAccuracy: null })).toBe('Menunggu Semakan')
    expect(statusOfIntervention({ beforeAccuracy: null, afterAccuracy: 5 })).toBeNull()
    expect(statusOfIntervention({ beforeAccuracy: 5, afterAccuracy: 5 })).toBeNull()
    expect(statusOfIntervention({ beforeAccuracy: 5, afterAccuracy: 6 })).toBe('Meningkat')
    expect(statusOfIntervention({ beforeAccuracy: 6, afterAccuracy: 5 })).toBe('Menurun')
  })
})

const cell = (over: Partial<Cell>): Cell => ({
  userId: '1',
  schoolId: '10',
  subjectId: '100',
  month: '2026-10',
  sessions: 1,
  answered: 10,
  correct: 5,
  scoredSessions: 1,
  scoreSum: 50,
  ...over,
})

describe('roll-ups of the cells', () => {
  const cells = [
    cell({ userId: '1', subjectId: '100', month: '2026-09', answered: 8, correct: 6, scoreSum: 75 }),
    cell({ userId: '1', subjectId: '200', month: '2026-10' }),
    cell({ userId: '2', subjectId: '100', month: '2026-10', answered: 50, correct: 40, scoreSum: 80 }),
    cell({ userId: '3', schoolId: '20', subjectId: null, month: '2026-10', sessions: 2, answered: 0, correct: 0, scoredSessions: 0, scoreSum: 0 }),
  ]

  it('totals count a pupil active only with an answer', () => {
    expect(totalsOf(cells)).toEqual({ sessions: 5, answered: 68, correct: 51, scoredSessions: 3, scoreSum: 205, activeStudents: 2 })
    expect(studentsOf(cells).map((s) => [s.userId, s.answered])).toEqual([['1', 18], ['2', 50], ['3', 0]])
  })

  it('schools, subjects and months', () => {
    expect(schoolsOf(cells).map((s) => [s.schoolId, s.answered, s.subjects, s.activeStudents])).toEqual([['10', 68, 2, 2], ['20', 0, 0, 0]])
    expect(subjectsOf(cells)).toEqual([{ subjectId: '100', answered: 58, correct: 46 }, { subjectId: '200', answered: 10, correct: 5 }])
    expect(monthsOf(cells)).toEqual(['2026-09', '2026-10'])
    expect(monthOf(cells, '2026-10')).toEqual({ month: '2026-10', answered: 60, correct: 45, students: [{ userId: '1', answered: 10 }, { userId: '2', answered: 50 }] })
  })

  it('bands: pupils without an answer are Tidak Terlibat and the five counts sum to the population', () => {
    const bands = bandsOf(6, studentsOf(cells))
    expect(bands.map((b) => b.count)).toEqual([1, 0, 1, 0, 4])
    expect(bands.reduce((s, b) => s + b.count, 0)).toBe(6)
    expect(bands[4]?.pct).toBe(66.7)
    expect(bandsOf(0, []).map((b) => b.pct)).toEqual([0, 0, 0, 0, 0])
  })

  it('population: only schools with a T4/T5 pupil are rows; teachers count everywhere', () => {
    const pop = populationOf([
      { schoolId: '20', t4t5: 2, never: 1, teachers: 1, teachersLoggedIn: 0 },
      { schoolId: '3', t4t5: 0, never: 0, teachers: 4, teachersLoggedIn: 2 },
      { schoolId: '10', t4t5: 3, never: 0, teachers: 1, teachersLoggedIn: 1 },
    ])
    expect(pop.schools.map((s) => s.schoolId)).toEqual(['10', '20'])
    expect(pop).toMatchObject({ t4t5: 5, never: 1, teachers: 6, teachersLoggedIn: 3 })
  })
})

describe('feedback roll-up', () => {
  it('NPS means leave out rows without an NPS; satisfaction counts them', () => {
    const f = feedbackOf([
      { role: 'student', responses: 3, satSum: 12, npsCount: 2, npsSum: 15 },
      { role: 'teacher', responses: 1, satSum: 4, npsCount: 1, npsSum: 7 },
    ])
    expect(f).toEqual({ responses: 4, satisfaction: 4, nps: 7.3, npsStudent: 7.5, npsTeacher: 7, npsAdmin: 0 })
    expect(feedbackOf([])).toEqual({ responses: 0, satisfaction: 0, nps: 0, npsStudent: 0, npsTeacher: 0, npsAdmin: 0 })
  })
})

describe('helpers', () => {
  it('streak is the run of consecutive days ending at the last active day', () => {
    expect(streakOf([])).toBe(0)
    expect(streakOf(['2026-10-01'])).toBe(1)
    expect(streakOf(['2026-09-10', '2026-10-05'])).toBe(1)
    expect(streakOf(['2026-09-30', '2026-10-01', '2026-10-02'])).toBe(3)
    expect(streakOf(['2026-09-01', '2026-09-02', '2026-10-01', '2026-10-02'])).toBe(2)
  })

  it('summary message is the first message plus the count of the others', () => {
    expect(summarizeFields({ a: 'A.' })).toBe('A.')
    expect(summarizeFields({ a: 'A.', b: 'B.' })).toBe('A. (and 1 more error)')
    expect(summarizeFields({ a: 'A.', b: 'B.', c: 'C.' })).toBe('A. (and 2 more errors)')
  })

  it('schoolId query: blank is all schools, digits become the canonical id', () => {
    expect(schoolIdOf(undefined)).toBeNull()
    expect(schoolIdOf('  ')).toBeNull()
    expect(schoolIdOf('0012')).toBe('12')
  })
})

describe('PDF writer (PdfPort adapter)', () => {
  const lines = reportLines({
    t1: { nps: 8.2, satisfaction: 4.5, responses: 12 },
    t2: { accuracy: 70.5, answers: 100, avgScore: 65 },
    t3: { active: 3, t4t5: 5, pct: 60, sessions: 7, bands: [] },
    t4: { gps: null, r: 0.1298, strength: 'Lemah' },
    correlation: { bands: [{ label: '1-20 soalan', n: 1, acc: 50 }, { label: '100+ soalan', n: 2, acc: 75.2 }], r: 0.1298 },
  })

  it('starts with %PDF, ends with %%EOF and has a consistent cross-reference table', () => {
    const bytes = new TextPdfAdapter().render(KIRKPATRICK_PDF.title, lines)
    const text = Buffer.from(bytes).toString('latin1')
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    const startxref = Number(/startxref\n(\d+)\n/.exec(text)?.[1])
    expect(text.slice(startxref, startxref + 4)).toBe('xref')
    // Every object offset of the table points at its "N 0 obj".
    const entries = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]))
    expect(entries).toHaveLength(5)
    entries.forEach((offset, i) => expect(text.slice(offset, offset + 7)).toBe(`${String(i + 1)} 0 obj`))
    expect(text).toContain('(Tahap 1: Reaksi)')
    expect(text).toContain('GPS: -')
  })

  it('escapes parentheses and backslashes, turns non-ASCII into "?" and wraps long lines', () => {
    const text = Buffer.from(new TextPdfAdapter().render('Tajuk (a) \\ – é', ['x '.repeat(100)])).toString('latin1')
    expect(text).toContain('(Tajuk \\(a\\) \\\\ - ?)')
    expect(text.match(/Tj ET/g)?.length).toBeGreaterThan(2)
  })

  it('stops at the bottom of the page instead of overflowing', () => {
    const many = Array.from({ length: 200 }, (_, i) => `Baris ${String(i)}`)
    const text = Buffer.from(new TextPdfAdapter().render('T', many)).toString('latin1')
    expect(text).toContain('Baris 0')
    expect(text).not.toContain('Baris 199')
  })
})
