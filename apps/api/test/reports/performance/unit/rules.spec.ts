import { describe, expect, it } from 'vitest'

import {
  accuracyOf,
  capPercent,
  compareIds,
  difficultyIndex,
  difficultyLevel,
  discriminationGroupSize,
  discriminationStatus,
  gradeOfPercent,
  parseRiskLevel,
  pct,
  projection,
  riskOfAccuracy,
  round,
  trendOf,
} from '../../../../src/modules/reports/performance/domain/rules'
import { addMytDays, lastDays, trendWindows } from '../../../../src/modules/reports/performance/domain/windows'
import { StatsService } from '../../../../src/modules/reports/performance/services'

describe('grade table', () => {
  it.each([
    [100, 'A+'], [90, 'A+'], [89.9, 'A'], [80, 'A'], [70, 'A-'], [65, 'B+'], [60, 'B'], [55, 'C+'],
    [50, 'C'], [45, 'D'], [40, 'E'], [39.9, 'G'], [0, 'G'],
  ])('%s is %s', (value, grade) => {
    expect(gradeOfPercent(value)).toBe(grade)
  })
})

describe('rounding and percentages', () => {
  it('rounds halves up', () => {
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(2.5, 0)).toBe(3)
  })
  it('percent of zero marks is 0, never NaN', () => {
    expect(pct(0, 0)).toBe(0)
    expect(accuracyOf(0, 0)).toBe(0)
  })
  it('caps accuracy at 100 and keeps one decimal', () => {
    expect(capPercent(130)).toBe(100)
    expect(accuracyOf(2, 3)).toBe(66.7)
    expect(accuracyOf(15, 10)).toBe(100)
  })
})

describe('difficulty and discrimination', () => {
  it('index is 1 - p to two decimals; zero attempts gives 0', () => {
    expect(difficultyIndex(1, 3)).toBe(0.67)
    expect(difficultyIndex(0, 0)).toBe(0)
  })
  it('levels on the whole-number % betul: > 70 Mudah, 40 to 70 Sederhana, < 40 Sukar (AC-GUR-6-11)', () => {
    expect(difficultyLevel(71)).toBe('Mudah')
    expect(difficultyLevel(70)).toBe('Sederhana')
    expect(difficultyLevel(40)).toBe('Sederhana')
    expect(difficultyLevel(39)).toBe('Sukar')
    expect(difficultyLevel(0)).toBe('Sukar')
    expect(difficultyLevel(100)).toBe('Mudah')
  })
  it('the level follows the number the screen shows: 70.4 shows 70 (Sederhana), 70.5 shows 71 (Mudah), 39.5 shows 40, 39.4 shows 39', () => {
    expect(difficultyLevel(70.4)).toBe('Sederhana')
    expect(difficultyLevel(70.5)).toBe('Mudah')
    expect(difficultyLevel(39.5)).toBe('Sederhana')
    expect(difficultyLevel(39.4)).toBe('Sukar')
    // two decimals first round to the one-decimal wire value
    expect(difficultyLevel(70.46)).toBe('Mudah')
  })
  it('the index is display only: 1 - p no longer decides the level', () => {
    expect(difficultyIndex(3, 10)).toBe(0.7)
    expect(difficultyLevel(30)).toBe('Sukar')
    expect(difficultyLevel(25)).toBe('Sukar')
  })
  it('group size is ceil(0.27 x N), at least 1, with no float drift at N = 100', () => {
    expect([1, 4, 10, 11, 15, 100, 101].map((n) => discriminationGroupSize(n, 0.27))).toEqual([1, 2, 3, 3, 5, 27, 28])
  })
  it('discrimination status thresholds', () => {
    expect(discriminationStatus(0.4)).toBe('Sangat Baik')
    expect(discriminationStatus(0.3)).toBe('Baik')
    expect(discriminationStatus(0.2)).toBe('Sederhana')
    expect(discriminationStatus(0.19)).toBe('Lemah')
    expect(discriminationStatus(-0.5)).toBe('Lemah')
  })
})

describe('trend', () => {
  it('up at +5, down at -5, stable between', () => {
    expect(trendOf({ score: 75, max: 100 }, { score: 70, max: 100 })).toBe('up')
    expect(trendOf({ score: 65, max: 100 }, { score: 70, max: 100 })).toBe('down')
    expect(trendOf({ score: 72, max: 100 }, { score: 70, max: 100 })).toBe('stable')
  })
  it('stable when either window has no graded marks', () => {
    expect(trendOf({ score: 0, max: 0 }, { score: 70, max: 100 })).toBe('stable')
    expect(trendOf({ score: 70, max: 100 }, { score: 0, max: 0 })).toBe('stable')
  })
})

describe('projection and risk', () => {
  it('projection is grade(acc - 10) to grade(acc + 10), clamped to 0..100', () => {
    expect(projection(40.5)).toEqual({ low: 'G', high: 'C' })
    expect(projection(5)).toEqual({ low: 'G', high: 'G' })
    expect(projection(98)).toEqual({ low: 'A', high: 'A+' })
  })
  it.each([
    [30, 'critical'], [40, 'critical'], [44.9, 'critical'], [45, 'high'], [49.9, 'high'],
    [50, 'medium'], [59.9, 'medium'], [60, 'low'], [100, 'low'],
  ])('accuracy %s is %s risk', (value, level) => {
    expect(riskOfAccuracy(value)).toBe(level)
  })
  it('an unknown risk filter means all', () => {
    expect(parseRiskLevel('bogus')).toBe('')
    expect(parseRiskLevel(undefined)).toBe('')
    expect(parseRiskLevel('high')).toBe('high')
  })
})

describe('ids and windows', () => {
  it('orders decimal ids numerically', () => {
    expect(['10', '9', '100', '1'].sort(compareIds)).toEqual(['1', '9', '10', '100'])
  })
  it('adds days across a month end', () => {
    expect(addMytDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addMytDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('lists the last n Malaysian days ending today', () => {
    expect(lastDays(new Date('2026-09-25T16:30:00Z'), 3)).toEqual(['2026-09-24', '2026-09-25', '2026-09-26'])
  })
  it('windows: recent is 30 days ending with today, before is the 30 before', () => {
    const w = trendWindows(new Date('2026-09-25T15:40:00+08:00'))
    expect(w.recentTo.toISOString()).toBe('2026-09-25T16:00:00.000Z')
    expect(w.recentFrom.toISOString()).toBe('2026-08-26T16:00:00.000Z')
    expect(w.beforeFrom.toISOString()).toBe('2026-07-27T16:00:00.000Z')
  })
})

describe('StatsService', () => {
  const stats = new StatsService()
  it('wraps the rules', () => {
    expect(stats.grade(82)).toBe('A')
    expect(stats.difficulty(1, 4)).toEqual({ index: 0.75, level: 'Sukar' })
    expect(stats.mean([])).toBe(0)
    expect(stats.mean([2, 4])).toBe(3)
  })
  it('ranks a large list quickly (n log n)', () => {
    const values = Array.from({ length: 200_000 }, (_, i) => i % 1000)
    const t = Date.now()
    const ranks = stats.rankWithTies(values)
    expect(Date.now() - t).toBeLessThan(1500)
    expect(ranks[999]).toBe(1)
  })
  it('ranks with ties (1, 2, 2, 4)', () => {
    expect(stats.rankWithTies([90, 80, 80, 70])).toEqual([1, 2, 2, 4])
  })
})
