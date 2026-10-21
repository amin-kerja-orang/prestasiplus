import { describe, expect, it } from 'vitest'

import {
  bandStatus,
  gradeOrNull,
  isGraded,
  latestAr,
  meanOrNull,
  pairStatus,
  predictionOf,
  projectionOf,
  rowTone,
  toNum,
} from '../../../../src/modules/reports/performance/headcount/headcount.rules'

describe('latest AR and pair status (BR-M08-01/07/08)', () => {
  it('takes the last checkpoint that has an AR, with its target', () => {
    expect(latestAr({ targets: [60, 70, 80], actuals: [65, 72, null] })).toEqual({ n: 2, ar: 72, target: 70 })
    expect(latestAr({ targets: [60], actuals: [null] })).toBeNull()
  })

  it('is graded only with an AR', () => {
    expect(isGraded({ targets: [60], actuals: [null] })).toBe(false)
    expect(isGraded({ targets: [null], actuals: [10] })).toBe(true)
  })

  it('on when the latest AR reaches its target, below when under, none without AR or target', () => {
    expect(pairStatus({ targets: [60], actuals: [60] })).toBe('on')
    expect(pairStatus({ targets: [60], actuals: [59.9] })).toBe('below')
    expect(pairStatus({ targets: [null], actuals: [70] })).toBe('none')
    expect(pairStatus({ targets: [60], actuals: [null] })).toBe('none')
  })

  it('band: above over the target, on within 2 points under, below beyond, na without data', () => {
    expect(bandStatus(61, 60)).toBe('above')
    expect(bandStatus(60, 60)).toBe('on')
    expect(bandStatus(58, 60)).toBe('on')
    expect(bandStatus(57.99, 60)).toBe('below')
    expect(bandStatus(null, 60)).toBe('na')
    expect(bandStatus(50, null)).toBe('na')
  })
})

describe('mean and grades', () => {
  it('means the non-null values to 1 decimal, null when there are none', () => {
    expect(meanOrNull([50, 75, null])).toBe(62.5)
    expect(meanOrNull([null, null])).toBeNull()
    expect(meanOrNull([])).toBeNull()
  })

  it('grades a percentage, null stays null', () => {
    expect(gradeOrNull(90)).toBe('A+')
    expect(gradeOrNull(39.9)).toBe('G')
    expect(gradeOrNull(null)).toBeNull()
  })

  it('reads numerics from Prisma decimals, numbers and nothing', () => {
    expect(toNum({ toString: () => '72.50' })).toBe(72.5)
    expect(toNum(3)).toBe(3)
    expect(toNum(null)).toBeNull()
    expect(toNum(undefined)).toBeNull()
  })
})

describe('projection (BR-M08-24)', () => {
  it('adds the mean step to the last AR and compares with the ETR and TOV', () => {
    expect(projectionOf({ actuals: [60, 70, null], tov: 50, etr: 80 })).toEqual({
      value: 80,
      variant: 'green',
      trend: 'Meningkat',
      confidence: 'Sederhana',
    })
  })

  it('amber under the ETR, red without an ETR, low confidence with one point', () => {
    expect(projectionOf({ actuals: [60, 62, 64], tov: 60, etr: 90 })).toMatchObject({ value: 66, variant: 'amber', trend: 'Meningkat', confidence: 'Tinggi' })
    expect(projectionOf({ actuals: [65, null], tov: null, etr: null })).toEqual({ value: 65, variant: 'red', trend: 'Stabil', confidence: 'Rendah' })
  })

  it('clamps to 0..100 and trends down', () => {
    expect(projectionOf({ actuals: [80, 95], tov: 99, etr: 90 })?.value).toBe(100)
    expect(projectionOf({ actuals: [20, 5], tov: 30, etr: 50 })).toMatchObject({ value: 0, trend: 'Menurun' })
  })

  it('has none without an AR', () => {
    expect(projectionOf({ actuals: [null, null], tov: 50, etr: 70 })).toBeNull()
  })
})

describe('prediction (BR-M08-33)', () => {
  it.each([
    [82, 85, -3, 'Ramalan Tepat'],
    [90, 85, 5, 'Ramalan Tepat'],
    [75, 85, -10, 'Hampir Tepat'],
    [70, 85, -15, 'Selisih Besar'],
  ])('rs %s against etr %s is %s (%s)', (rs, etr, diff, verdict) => {
    expect(predictionOf({ etr, rs })).toEqual({ etr, rs, diff, verdict })
  })

  it('needs both ETR and RS', () => {
    expect(predictionOf({ etr: null, rs: 50 })).toBeNull()
    expect(predictionOf({ etr: 50, rs: null })).toBeNull()
  })
})

describe('row tone', () => {
  it('noAr first, then noTarget, then on / below', () => {
    expect(rowTone(null, 50)).toBe('noAr')
    expect(rowTone(null, null)).toBe('noAr')
    expect(rowTone(50, null)).toBe('noTarget')
    expect(rowTone(50, 50)).toBe('on')
    expect(rowTone(49, 50)).toBe('below')
  })
})
