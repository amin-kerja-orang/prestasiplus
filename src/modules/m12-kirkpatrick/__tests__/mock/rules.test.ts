/**
 * Pure M12 rules (SRS M12 v1.6 §4) without a boot: bands, tahap, grades, statuses, the number formats, the
 * feedback seed builder and the PDF writer.
 */

import { describe, expect, it } from 'vitest'

import {
  FEEDBACK_MONTHS,
  STUDENT_POOL,
  TEACHER_POOL,
  buildFeedbackRows,
  fitSeries,
} from '../../mock/data/feedback'
import { buildPdf, reportLines } from '../../mock/handlers/pdf'
import { fmt1, mean1, pct1, pctTenths, round1 } from '../../mock/repository/common'
import { statusOf } from '../../mock/repository/interventions'
import {
  bandOfGrade,
  bandOfAnswers,
  gradeOfAccuracyTenths,
  gradeOfGps,
  isFail,
  isPass,
  needsIntervention,
  statusOfAccuracy,
  strengthOfR,
  tahapOfScore,
} from '../../mock/repository/rules'

describe('BR-M12-06 engagement bands (v1.6 bounds >= 50 / 20-49 / 5-19 / 1-4 / 0)', () => {
  it.each([
    [0, 'tidakTerlibat'],
    [1, 'minimum'],
    [4, 'minimum'],
    [5, 'berkembang'],
    [19, 'berkembang'],
    [20, 'konsisten'],
    [49, 'konsisten'],
    [50, 'champion'],
    [51, 'champion'],
  ] as const)('%i answers is %s', (n, band) => {
    expect(bandOfAnswers(n)).toBe(band)
  })
})

describe('BR-M12-12 tahap by score, BR-M12-09 subject status, BR-M12-25 strength', () => {
  it.each([
    [100, 'champion'],
    [80, 'champion'],
    [79.9, 'konsisten'],
    [60, 'konsisten'],
    [40, 'berkembang'],
    [20, 'minimum'],
    [19.9, 'tidakTerlibat'],
    [0, 'tidakTerlibat'],
  ] as const)('score %s is %s', (score, tahap) => {
    expect(tahapOfScore(score)).toBe(tahap)
  })

  it('subject status bounds 80 / 50', () => {
    expect([80.6, 80, 79.1, 51.5, 50, 45, 0].map(statusOfAccuracy)).toEqual([
      'Mastered',
      'Mastered',
      'Developing',
      'Developing',
      'Developing',
      'Beginning',
      'Beginning',
    ])
  })

  it('strength of r: < 0.3 Lemah, < 0.7 Sederhana, else Kuat', () => {
    expect([0.1298, -0.29, 0.3, 0.69, 0.7, -0.9].map(strengthOfR)).toEqual([
      'Lemah',
      'Lemah',
      'Sederhana',
      'Sederhana',
      'Kuat',
      'Kuat',
    ])
  })
})

describe('BR-M12-21 Anggaran Gred and BR-M12-19 grade of a GPS', () => {
  it('maps the accuracy to the grade at every bound (tenths of a percent)', () => {
    const at = (t: number) => gradeOfAccuracyTenths(t)
    expect(
      [
        1000, 900, 899, 800, 799, 700, 699, 650, 649, 600, 599, 550, 549, 500, 499, 400, 399, 300,
        299, 0,
      ].map(at),
    ).toEqual([
      'A+',
      'A+',
      'A',
      'A',
      'A-',
      'A-',
      'B+',
      'B+',
      'B',
      'B',
      'C+',
      'C+',
      'C',
      'C',
      'D',
      'D',
      'E',
      'E',
      'G',
      'G',
    ])
  })

  it('grade of point ceil(GPS) - 1 (fits all five observed subject rows and 4.00 = B+)', () => {
    expect([2.5, 2.8, 2.9, 3, 3.2, 4, 4.3, 0.5, 11].map(gradeOfGps)).toEqual([
      'A-',
      'A-',
      'A-',
      'A-',
      'B+',
      'B+',
      'B',
      'A+',
      'G',
    ])
  })

  it('ALESA tiles: pass A+ ... D, fail E and G, intervention D and E; the band follows the grade', () => {
    expect(['A+', 'D', 'E', 'G'].map(isPass)).toEqual([true, true, false, false])
    expect(['A+', 'D', 'E', 'G'].map(isFail)).toEqual([false, false, true, true])
    expect(['C', 'D', 'E', 'G'].map(needsIntervention)).toEqual([false, true, true, false])
    expect(['A+', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'].map(bandOfGrade)).toEqual([
      'A',
      'A',
      'B',
      'B',
      'C',
      'C',
      'D/E',
      'D/E',
      'D/E',
    ])
  })
})

describe('BR-M12-26 intervention status', () => {
  it('pending without an after value, up, down, and null for equal or a missing before', () => {
    expect(statusOf({ beforeAccuracy: null, afterAccuracy: null })).toBe('Menunggu Semakan')
    expect(statusOf({ beforeAccuracy: 40, afterAccuracy: null })).toBe('Menunggu Semakan')
    expect(statusOf({ beforeAccuracy: 40, afterAccuracy: 41 })).toBe('Meningkat')
    expect(statusOf({ beforeAccuracy: 40, afterAccuracy: 39.9 })).toBe('Menurun')
    expect(statusOf({ beforeAccuracy: 40, afterAccuracy: 40 })).toBeNull()
    expect(statusOf({ beforeAccuracy: null, afterAccuracy: 40 })).toBeNull()
  })
})

describe('BR-M12-03 / BR-M12-33 number formats', () => {
  it('rounds half-up to one decimal in integer arithmetic (253,478 / 306,133 = 82.8)', () => {
    expect(pct1(253_478, 306_133)).toBe(82.8)
    expect(pct1(1, 8)).toBe(12.5)
    expect(pct1(1, 3)).toBe(33.3)
    expect(pct1(5, 8)).toBe(62.5)
    expect(pct1(0, 0)).toBe(0)
    expect(pctTenths(11_339, 15_007)).toBe(756)
    expect(pct1(1, 16)).toBe(6.3)
    expect(pct1(1, 800)).toBe(0.1)
  })

  it('mean1 and round1, symmetric for negatives', () => {
    expect(mean1(2790, 336)).toBe(8.3)
    expect(mean1(2612, 311)).toBe(8.4)
    expect(mean1(0, 0)).toBe(0)
    expect(round1(-16.66)).toBe(-16.7)
    expect(round1(16.64)).toBe(16.6)
  })

  it('prints without a trailing ".0" and without a thousands separator', () => {
    expect(fmt1(100)).toBe('100')
    expect(fmt1(62.5)).toBe('62.5')
    expect(fmt1(465_500)).toBe('465500')
    expect(fmt1(467_833.33)).toBe('467833.3')
    expect(fmt1(10.04)).toBe('10')
  })
})

describe('the feedback seed builder (SRS §6.6 designed split)', () => {
  const studentPool = Array.from({ length: STUDENT_POOL }, (_, i) => 100 + i)
  const teacherPool = Array.from({ length: TEACHER_POOL }, (_, i) => 900 + i)
  const rows = buildFeedbackRows(studentPool, teacherPool, (id) => (id < 900 ? 8080 : 8082))

  it('fitSeries is exact and stays in range', () => {
    const s = fitSeries(311, 2612, 0, 10, [9, 10, 8, 7])
    expect(s).toHaveLength(311)
    expect(s.reduce((a, b) => a + b, 0)).toBe(2612)
    expect(Math.min(...s)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...s)).toBeLessThanOrEqual(10)
    expect(() => fitSeries(2, 100, 0, 10, [5])).toThrow(RangeError)
  })

  it('336 rows, ids 1-336, the designed sums and counts per role', () => {
    expect(rows).toHaveLength(336)
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 336 }, (_, i) => i + 1))
    const role = (r: string) => rows.filter((x) => x.role === r)
    expect(role('student')).toHaveLength(311)
    expect(role('teacher')).toHaveLength(20)
    expect(role('admin')).toHaveLength(5)
    const sum = (rs: typeof rows, k: 'nps' | 'satisfaction') => rs.reduce((a, r) => a + r[k], 0)
    expect([
      sum(role('student'), 'nps'),
      sum(role('teacher'), 'nps'),
      sum(role('admin'), 'nps'),
    ]).toEqual([2612, 130, 48])
    expect(sum(rows, 'satisfaction')).toBe(1546)
    expect(sum(rows, 'nps')).toBe(2790)
  })

  it('one response per user and month, months 2026-02 ... 2026-09, admin anchors, school snapshot', () => {
    const keys = rows.map((r) => `${String(r.userId)}:${r.month}`)
    expect(new Set(keys).size).toBe(336)
    expect(new Set(rows.map((r) => r.month))).toEqual(new Set(FEEDBACK_MONTHS))
    expect(rows.filter((r) => r.userId === 1).map((r) => r.month)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ])
    expect(rows.filter((r) => r.userId === 5801).map((r) => r.month)).toEqual([
      '2026-08',
      '2026-09',
    ])
    expect(
      rows.every((r) => r.nps >= 0 && r.nps <= 10 && r.satisfaction >= 1 && r.satisfaction <= 5),
    ).toBe(true)
    expect(rows.find((r) => r.role === 'student')?.schoolId).toBe(8080)
    expect(rows.find((r) => r.role === 'teacher')?.schoolId).toBe(8082)
    expect(rows.every((r) => r.createdAt.slice(0, 7) === r.month)).toBe(true)
    // Every response is before the mock clock (2026-09-25 15:40 +08:00).
    expect(
      rows.every((r) => Date.parse(r.createdAt) < Date.parse('2026-09-25T15:40:00+08:00')),
    ).toBe(true)
  })

  it('refuses pools that are too small', () => {
    expect(() => buildFeedbackRows(studentPool.slice(0, 10), teacherPool, () => null)).toThrow(
      RangeError,
    )
  })
})

describe('the S6 PDF (PROPOSED content)', () => {
  const chain = {
    t1: { nps: 8.3, satisfaction: 4.6, responses: 336 },
    t2: { accuracy: 82.8, answers: 306_133, avgScore: 80.3 },
    t3: { active: 946, t4t5: 4158, pct: 22.8, sessions: 20_991, bands: [] },
    t4: { gps: 4.3, r: 0.1298, strength: 'Lemah' as const },
    correlation: {
      bands: [
        { label: '1-20 soalan', n: 215, acc: 59.7 },
        { label: '51-100 soalan', n: 149, acc: 68.7 },
        { label: '100+ soalan', n: 348, acc: 75.2 },
      ],
      r: 0.1298,
    },
  }

  it('lists the four level cards, the correlation rows and the two conclusions', () => {
    const lines = reportLines(chain)
    expect(lines).toContain('Pelajar aktif: 946/4158 (22.8%)')
    expect(lines).toContain('Responden: 336')
    expect(lines).toContain('Korelasi (r): 0.1298')
    expect(
      lines.some((l) =>
        l.startsWith(
          'Kesimpulan ALESA: Pelajar yang menjawab 100+ soalan mencapai ketepatan 75.2%, berbanding 59.7%',
        ),
      ),
    ).toBe(true)
    expect(lines.some((l) => l.includes('(perbezaan +15.5%)'))).toBe(true)
    expect(
      lines.some((l) => l.startsWith('Berdasarkan analisis empat tahap Model Kirkpatrick')),
    ).toBe(true)
  })

  it('is a well-formed single-page PDF with correct xref offsets and escaped text', () => {
    const text = new TextDecoder().decode(
      buildPdf('Ujian (a\\b) — é', ['baris (satu)', '', 'x'.repeat(200)]),
    )
    expect(text.startsWith('%PDF-1.4\n')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(text).toContain('(Ujian \\(a\\\\b\\) - ?) Tj')
    expect(text).toContain('(baris \\(satu\\)) Tj')
    const xref = Number(/startxref\n(\d+)/.exec(text)?.[1])
    expect(text.slice(xref, xref + 4)).toBe('xref')
    const offsets = [...text.matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]))
    expect(offsets).toHaveLength(5)
    offsets.forEach((o, i) => expect(text.slice(o, o + 7)).toBe(`${String(i + 1)} 0 obj`))
    const length = Number(/\/Length (\d+)/.exec(text)?.[1])
    const stream = /stream\n([\s\S]*?)endstream/.exec(text)?.[1] ?? ''
    expect(stream.length).toBe(length)
  })
})
