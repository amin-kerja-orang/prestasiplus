import { IntakeBudgetSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { budgetOf, daysOfMonth, isMissingObjectError, monthRange, mytMonthOf, percent } from '../../src/modules/intake/dashboard'

describe('Malaysia month (AC2)', () => {
  it('a month is [1st 00:00 +08:00, next 1st 00:00 +08:00)', () => {
    const r = monthRange('2026-10')
    expect(r.from.toISOString()).toBe('2026-09-30T16:00:00.000Z')
    expect(r.to.toISOString()).toBe('2026-10-31T16:00:00.000Z')
    const dec = monthRange('2026-12')
    expect(dec.to.toISOString()).toBe('2026-12-31T16:00:00.000Z')
  })

  it('2026-09-30T23:59+08:00 is September and 2026-10-01T00:01+08:00 is October', () => {
    expect(mytMonthOf(new Date('2026-09-30T23:59:00+08:00'))).toBe('2026-09')
    expect(mytMonthOf(new Date('2026-10-01T00:01:00+08:00'))).toBe('2026-10')
    // The UTC calendar would say otherwise for the first one: 15:59Z on 30 Sept, and for 16:01Z on 30 Sept.
    expect(mytMonthOf(new Date('2026-09-30T16:01:00Z'))).toBe('2026-10')
  })

  it('days of a month, leap year included', () => {
    expect(daysOfMonth('2026-10')).toHaveLength(31)
    expect(daysOfMonth('2026-09').at(-1)).toBe('2026-09-30')
    expect(daysOfMonth('2028-02')).toHaveLength(29)
    expect(daysOfMonth('2026-02')).toHaveLength(28)
  })

  it('rejects a malformed month', () => {
    expect(() => monthRange('2026-13')).toThrow(RangeError)
  })
})

describe('percent: one decimal, null on a zero denominator', () => {
  it('rounds half up with integer arithmetic', () => {
    expect(percent(3, 4)).toBe(75)
    expect(percent(2, 3)).toBe(66.7)
    expect(percent(1, 8)).toBe(12.5)
    expect(percent(1, 6)).toBe(16.7)
    expect(percent(0, 5)).toBe(0)
    expect(percent(5, 5)).toBe(100)
  })
  it('a zero denominator is null, never 0 %', () => {
    expect(percent(0, 0)).toBeNull()
  })
})

describe('budgetOf (AC5, BE-36 thresholds 80 % and 100 %)', () => {
  it('below 80 % is ok', () => {
    const b = budgetOf(7_000, 10_000, 'env')
    expect(b).toEqual({ costSen: 7_000, budgetSen: 10_000, budgetSource: 'env', remainingSen: 3_000, percentUsed: 70, budgetState: 'ok', warnReached: false, capReached: false })
    expect(IntakeBudgetSchema.parse(b)).toEqual(b)
  })
  it('the flags use the exact ratio: 79.99 % shows 80.0 but is not a warning', () => {
    const b = budgetOf(7_999, 10_000, 'settings')
    expect(b.percentUsed).toBe(80)
    expect(b.budgetState).toBe('ok')
    expect(b.warnReached).toBe(false)
  })
  it('exactly 80 % is a warning, exactly 100 % is exhausted', () => {
    expect(budgetOf(8_000, 10_000, 'env')).toMatchObject({ percentUsed: 80, budgetState: 'warning', warnReached: true, capReached: false })
    expect(budgetOf(10_000, 10_000, 'env')).toMatchObject({ percentUsed: 100, budgetState: 'exhausted', warnReached: true, capReached: true, remainingSen: 0 })
  })
  it('over the cap: percent above 100, remaining 0', () => {
    expect(budgetOf(12_345, 10_000, 'env')).toMatchObject({ percentUsed: 123.5, remainingSen: 0, budgetState: 'exhausted' })
  })
  it('a cap of 0 is exhausted; percent 0 without cost, 100 with cost (AiStatus rule)', () => {
    expect(budgetOf(0, 0, 'none')).toMatchObject({ percentUsed: 0, budgetState: 'exhausted', capReached: true, warnReached: true, remainingSen: 0 })
    expect(budgetOf(5, 0, 'settings')).toMatchObject({ percentUsed: 100, budgetState: 'exhausted' })
  })
})

describe('isMissingObjectError (degrade only on a missing table or column)', () => {
  it('recognises SQLSTATE 42P01 and 42703 at any nesting', () => {
    expect(isMissingObjectError({ code: '42P01' })).toBe(true)
    expect(isMissingObjectError({ code: 'P2010', meta: { code: '42703' } })).toBe(true)
    expect(isMissingObjectError(Object.assign(new Error('x'), { cause: { originalCode: '42P01' } }))).toBe(true)
    expect(isMissingObjectError(new Error('column "is_test" does not exist'))).toBe(true)
    expect(isMissingObjectError(new Error('relation "ai_usage_logs" does not exist'))).toBe(true)
  })
  it('anything else is a real error', () => {
    expect(isMissingObjectError({ code: '57014' })).toBe(false)
    expect(isMissingObjectError(new Error('connection terminated'))).toBe(false)
    expect(isMissingObjectError(null)).toBe(false)
  })
})
