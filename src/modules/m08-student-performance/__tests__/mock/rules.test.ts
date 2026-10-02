/** Unit tests of the pure M08 rules (SRS M08 v1.11 §4: BR-M08-01…05, 14, 18, 19). */

import { describe, expect, it } from 'vitest'

import {
  GRADES,
  capPercent,
  difficultyIndex,
  difficultyLevel,
  discriminationStatus,
  gpsBand,
  gradeOfPercent,
  gradeOfPoints,
  gradePoints,
  projection,
  round,
  spBand,
} from '../../mock/repository/rules'
import {
  bandStatus,
  latestAr,
  pairIsOn,
  pairStatus,
  type HeadcountEntryView,
} from '../../mock/repository/headcount-port'

const entry = (targets: (number | null)[], actuals: (number | null)[]): HeadcountEntryView => ({
  configId: 1,
  studentId: 1,
  classroomKind: 'classroom',
  classroomId: 1,
  subjectId: 1,
  levelId: 10,
  configUpdatedAt: '2026-01-01T00:00:00+08:00',
  academicYear: 2026,
  activeOtrs: targets.length,
  tov: 50,
  targets,
  actuals,
  etr: null,
  rs: null,
  dropped: false,
})

describe('grades and GPS (BR-M08-01…03)', () => {
  it('maps points A+ 0 … G 9', () => {
    expect(GRADES.map(gradePoints)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('reproduces the observed platform GPS 3.45 from the 744 graded entries', () => {
    const counts = {
      'A+': 125,
      A: 146,
      'A-': 96,
      'B+': 47,
      B: 107,
      'C+': 24,
      C: 23,
      D: 76,
      E: 28,
      G: 72,
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const points = Object.entries(counts).reduce(
      (a, [g, n]) => a + n * gradePoints(g as (typeof GRADES)[number]),
      0,
    )
    expect(total).toBe(744)
    expect(points).toBe(2569)
    expect(round(points / total, 2)).toBe(3.45)
  })

  it('percent to grade uses the BR-M08-02 table', () => {
    expect([100, 90, 89.99, 80, 70, 65, 60, 55, 50, 45, 40, 39.99].map(gradeOfPercent)).toEqual([
      'A+',
      'A+',
      'A',
      'A',
      'A-',
      'B+',
      'B',
      'C+',
      'C',
      'D',
      'E',
      'G',
    ])
  })

  it('rounds GPS to a grade half up and bands it', () => {
    expect(gradeOfPoints(2.5)).toBe('B+')
    expect(gradeOfPoints(3.45)).toBe('B+')
    expect(gradeOfPoints(11)).toBe('G')
    expect([2, 2.01, 4, 4.01, 6, 6.01].map(gpsBand)).toEqual([
      'Cemerlang',
      'Baik',
      'Baik',
      'Sederhana',
      'Sederhana',
      'Perlu Perhatian',
    ])
    expect(gpsBand(3.45)).toBe('Baik')
    expect(gpsBand(5.33)).toBe('Sederhana')
  })
})

describe('accuracy (BR-M08-05, DV-07)', () => {
  it('caps at 100 and rounds half away from zero', () => {
    expect(capPercent(126.7)).toBe(100)
    expect(capPercent(93.3)).toBe(93.3)
    expect(round(2.005, 2)).toBe(2.01)
    expect(round(63.95, 1)).toBe(64)
  })
})

describe('difficulty and discrimination (BR-M08-18, 19)', () => {
  it('Indeks = 1 − p with the cut-offs 0.30 / 0.70', () => {
    expect(difficultyIndex(6, 8)).toBe(0.25)
    expect(difficultyIndex(2, 8)).toBe(0.75)
    expect(difficultyIndex(1, 8)).toBe(0.88)
    expect(difficultyLevel(0.25)).toBe('Mudah')
    expect(difficultyLevel(0.3)).toBe('Mudah')
    expect(difficultyLevel(0.5)).toBe('Sederhana')
    expect(difficultyLevel(0.7)).toBe('Sederhana')
    expect(difficultyLevel(0.75)).toBe('Sukar')
  })

  it('discrimination status bands', () => {
    expect([1, 0.4, 0.399, 0.3, 0.299, 0.2, 0.199, -0.5].map(discriminationStatus)).toEqual([
      'Sangat Baik',
      'Sangat Baik',
      'Baik',
      'Baik',
      'Sederhana',
      'Sederhana',
      'Lemah',
      'Lemah',
    ])
  })
})

describe('adaptive analytics (BR-M08-14)', () => {
  it('bands Mahir ≥ 75, Sederhana 50–74.9, Lemah < 50', () => {
    expect([100, 75, 74.9, 50, 49.9, 0].map(spBand)).toEqual([
      'mahir',
      'mahir',
      'sederhana',
      'sederhana',
      'lemah',
      'lemah',
    ])
  })

  it('projects grade(accuracy − 10) – grade(accuracy + 10): 40.5 → G–C, 35.0 → G–D', () => {
    expect(projection(40.5)).toEqual({ low: 'G', high: 'C' })
    expect(projection(35)).toEqual({ low: 'G', high: 'D' })
  })
})

describe('headcount pair rules (BR-M08-07, 08)', () => {
  it('per-pair status: latest AR against its target', () => {
    const on = entry([60, 65, 70], [61, 66, 72])
    expect(latestAr(on)).toEqual({ n: 3, ar: 72, target: 70 })
    expect(pairIsOn(on)).toBe(true)
    expect(pairStatus(on)).toBe('on')
    const below = entry([60, 65, 70], [61, 66, 60])
    expect(pairStatus(below)).toBe('below')
    expect(pairIsOn(below)).toBe(false)
    // No target at the latest AR: "none" for S6 / S15, but Below for the S3 counters (no such bucket).
    const noTarget = entry([60, null, null], [61, 66, null])
    expect(latestAr(noTarget)).toEqual({ n: 2, ar: 66, target: null })
    expect(pairStatus(noTarget)).toBe('none')
    expect(pairIsOn(noTarget)).toBe(false)
    expect(pairStatus(entry([60], [null]))).toBe('none')
  })

  it('±2 % band (DV-29): Above > OTR; On Track OTR − 2 … OTR; Below < OTR − 2', () => {
    expect(bandStatus(82, 80)).toBe('above')
    expect(bandStatus(80, 80)).toBe('on')
    expect(bandStatus(78, 80)).toBe('on')
    expect(bandStatus(77.9, 80)).toBe('below')
    expect(bandStatus(null, 80)).toBe('na')
    expect(bandStatus(70, null)).toBe('na')
  })
})
