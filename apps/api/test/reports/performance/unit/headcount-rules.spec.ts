import { describe, expect, it } from 'vitest'

import {
  bandStatus,
  gradeOrNull,
  isGraded,
  latestAr,
  meanOrNull,
  entryStatusOf,
  otrTargets,
  pairStatus,
  predictionOf,
  projectionOf,
  resolveMarks,
  rowTone,
  statusReasonOf,
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

  it('band (HC-SPEC): above AR - OTR > 2, on 0..2, below < 0, na without data', () => {
    expect(bandStatus(63, 60)).toBe('above')
    expect(bandStatus(62.1, 60)).toBe('above')
    expect(bandStatus(62, 60)).toBe('on')
    expect(bandStatus(60, 60)).toBe('on')
    expect(bandStatus(59.9, 60)).toBe('below')
    expect(bandStatus(58, 60)).toBe('below')
    expect(bandStatus(null, 60)).toBe('na')
    expect(bandStatus(50, null)).toBe('na')
  })

  it('the pair status is the latest checkpoint with an AR against its own OTR', () => {
    expect(pairStatus({ targets: [53, 66, 80], actuals: [60, 60, 60] })).toBe('below')
    expect(pairStatus({ targets: [53, 66, 80], actuals: [60, null, null] })).toBe('on')
    expect(pairStatus({ targets: [53, 66, 80], actuals: [null, null, null] })).toBe('none')
  })
})

describe('OTR targets (HC-2)', () => {
  const table: [number, number, number, (number | null)[]][] = [
    // [n, tov, etr, targets]; r_k = floor(100 k / n) / 100
    [2, 40, 80, [60, 80]],
    [3, 40, 80, [53, 66, 80]],
    [4, 40, 80, [50, 60, 70, 80]],
    [5, 40, 80, [48, 56, 64, 72, 80]],
    [2, 0, 100, [50, 100]],
    [3, 0, 100, [33, 66, 100]],
    [4, 10, 90, [30, 50, 70, 90]],
    [5, 50, 50, [50, 50, 50, 50, 50]],
    [3, 80, 40, [67, 54, 40]],
  ]
  it.each(table)('n = %i, TOV %i, ETR %i', (n, tov, etr, expected) => {
    expect(otrTargets(tov, etr, n)).toEqual(expected)
  })

  it('computes in integer tenths, half up: TOV 0.7, ETR 36.3, n = 2 → 19; 40/80/n=3 → 53/66/80', () => {
    expect(otrTargets(0.7, 36.3, 2)).toEqual([19, 36.3])
    expect(otrTargets(40, 80, 3)).toEqual([53, 66, 80])
  })

  it('rounds half up and is null without a TOV or an ETR', () => {
    expect(otrTargets(41, 80, 2)).toEqual([61, 80])
    expect(otrTargets(null, 80, 3)).toEqual([null, null, null])
    expect(otrTargets(40, null, 2)).toEqual([null, null])
  })

  it('the assembler resolves defaults, computes the targets and sizes the actuals', () => {
    const cfg = { activeOtrs: 3, defaultTov: 40, defaultEtr: 80 }
    expect(resolveMarks(null, cfg)).toEqual({ tov: 40, targets: [53, 66, 80], actuals: [null, null, null], etr: 80, rs: null })
    expect(resolveMarks({ tov: 50, etr: null, rs: 70, actuals: [61.5, undefined, 99, 98] }, cfg)).toEqual({
      tov: 50,
      targets: [60, 70, 80],
      actuals: [61.5, null, 99],
      etr: 80,
      rs: 70,
    })
    expect(resolveMarks(null, { activeOtrs: 2, defaultTov: null, defaultEtr: 80 }).targets).toEqual([null, null])
  })

  it('status reason and entry status', () => {
    expect(statusReasonOf({ tov: 40, etr: null })).toBe('belum_ada_data')
    expect(statusReasonOf({ tov: null, etr: null })).toBe('belum_ada_data')
    expect(statusReasonOf({ tov: null, etr: 80 })).toBe('belum_ada_tov')
    expect(statusReasonOf({ tov: 40, etr: 80 })).toBeNull()
    expect(entryStatusOf({ etr: 80 })).toBe('active')
    expect(entryStatusOf({ etr: null })).toBe('draft')
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
    expect(gradeOrNull(39.9)).toBe('E')
    expect(gradeOrNull(39.4)).toBe('G')
    expect(gradeOrNull(89.5)).toBe('A+')
    expect(gradeOrNull(89.4)).toBe('A')
    expect(gradeOrNull(null)).toBeNull()
  })

  it('reads numerics from Prisma decimals, numbers and nothing', () => {
    expect(toNum({ toString: () => '72.50' })).toBe(72.5)
    expect(toNum(3)).toBe(3)
    expect(toNum(null)).toBeNull()
    expect(toNum(undefined)).toBeNull()
  })
})

describe('projection (HC-6)', () => {
  it('worked example: AR 60 with TOV 40 and ETR 80 ends at the ETR, Meningkat, Sederhana', () => {
    expect(projectionOf({ actuals: [60, 60, 60], tov: 40, etr: 80 })).toEqual({ value: 80, variant: 'green', trend: 'Meningkat', confidence: 'Sederhana' })
  })

  it('end = ETR when the latest AR >= TOV, else the AR itself', () => {
    expect(projectionOf({ actuals: [30, null], tov: 40, etr: 80 })).toEqual({ value: 30, variant: 'amber', trend: 'Stabil', confidence: 'Rendah' })
    expect(projectionOf({ actuals: [40, null], tov: 40, etr: 80 })?.value).toBe(80)
  })

  it('trend: end above AR + 2 rises, below AR - 2 falls, else stable; Tinggi when AR >= ETR', () => {
    expect(projectionOf({ actuals: [78, null], tov: 40, etr: 80 })?.trend).toBe('Stabil')
    expect(projectionOf({ actuals: [77.9, null], tov: 40, etr: 80 })?.trend).toBe('Meningkat')
    expect(projectionOf({ actuals: [90, null], tov: 40, etr: 80 })).toMatchObject({ value: 80, trend: 'Menurun', confidence: 'Tinggi' })
    expect(projectionOf({ actuals: [82, null], tov: 40, etr: 80 })).toMatchObject({ trend: 'Stabil', confidence: 'Tinggi' })
  })

  it('has none without an AR, a TOV or an ETR', () => {
    expect(projectionOf({ actuals: [null, null], tov: 50, etr: 70 })).toBeNull()
    expect(projectionOf({ actuals: [60], tov: null, etr: 70 })).toBeNull()
    expect(projectionOf({ actuals: [60], tov: 50, etr: null })).toBeNull()
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
