import { describe, expect, it } from 'vitest'

import {
  formatCount,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatPlainCount,
  groupThousands,
  percentOf,
  roundHalfUp,
} from '../format'

describe('counts', () => {
  it('ms-MY thousands separator (M01 "128,989", M05 "13,872", M06 "20,529", M11 "4,158")', () => {
    expect(formatCount(128989)).toBe('128,989')
    expect(formatCount(13872)).toBe('13,872')
    expect(formatCount(20529)).toBe('20,529')
    expect(formatCount(1769)).toBe('1,769')
    expect(formatCount(4158)).toBe('4,158')
    expect(formatCount(465278)).toBe('465,278')
    expect(formatCount(999)).toBe('999')
    expect(formatCount(0)).toBe('0')
    expect(formatCount(1234567)).toBe('1,234,567')
  })

  it('plain counts (M05 S1 "13872", pager "Showing 1 to 20 of 465278 results")', () => {
    expect(formatPlainCount(13872)).toBe('13872')
    expect(
      `Showing ${formatPlainCount(1)} to ${formatPlainCount(20)} of ${formatPlainCount(465278)} results`,
    ).toBe('Showing 1 to 20 of 465278 results')
  })

  it('groupThousands', () => {
    expect(groupThousands('15000')).toBe('15,000')
    expect(groupThousands('100')).toBe('100')
  })
})

describe('currency (M02 BR-33)', () => {
  it('RM + 2 decimals, no space', () => {
    expect(formatCurrency(3000)).toBe('RM3,000.00')
    expect(formatCurrency(30)).toBe('RM30.00')
    expect(formatCurrency(15000)).toBe('RM15,000.00')
    expect(formatCurrency(49.9)).toBe('RM49.90')
  })
})

describe('percentages', () => {
  it('1 decimal (M05 S8/S9 "38.7%", "0.0%", M05 BR-18 "33.8%", "10.0%")', () => {
    expect(formatPercent(percentOf(46, 119))).toBe('38.7%')
    expect(formatPercent(percentOf(0, 0))).toBe('0.0%')
    expect(formatPercent(percentOf(25, 74))).toBe('33.8%')
    expect(formatPercent(percentOf(1, 10))).toBe('10.0%')
    expect(formatPercent(100)).toBe('100.0%') // M11 S4 cards
  })

  it('the ".0" rule (M05 S5 "44.4%", "60%", "0%"; M11 "35.2%", "100%", "55%")', () => {
    const drop = { dropZeroFraction: true }
    expect(formatPercent(percentOf(4, 9), drop)).toBe('44.4%')
    expect(formatPercent(percentOf(3, 5), drop)).toBe('60%')
    expect(formatPercent(0, drop)).toBe('0%')
    expect(formatPercent(35.2, drop)).toBe('35.2%')
    expect(formatPercent(100, drop)).toBe('100%')
    expect(formatPercent(55, drop)).toBe('55%')
    expect(formatPercent(59.96, drop)).toBe('60%')
  })

  it('integer and 2-decimal variants (M05 S1, M07 "{n}%"; M06 "(0.00%)")', () => {
    expect(formatPercent(0, { decimals: 0 })).toBe('0%')
    expect(formatPercent(66.5, { decimals: 0 })).toBe('67%')
    expect(formatPercent(0, { decimals: 2 })).toBe('0.00%')
    expect(formatPercent(percentOf(11, 34), { decimals: 2 })).toBe('32.35%')
  })

  it('signed "Peningkatan" (M05 BR-18: "+" when positive)', () => {
    expect(formatPercent(2.5, { signed: true })).toBe('+2.5%')
    expect(formatPercent(0, { signed: true })).toBe('0.0%')
    expect(formatPercent(-3.14, { signed: true })).toBe('-3.1%')
    expect(formatPercent(-0.04, { signed: true })).toBe('0.0%') // no "-0.0"
  })
})

describe('decimals', () => {
  it('1-decimal averages (M06 "21.8", M11 "172.4", "323")', () => {
    expect(formatNumber((0 + 20 + 32.35 + 35) / 4, { decimals: 1 })).toBe('21.8')
    expect(formatNumber(172.44, { decimals: 1, dropZeroFraction: true })).toBe('172.4')
    expect(formatNumber(323, { decimals: 1, dropZeroFraction: true })).toBe('323')
    expect(formatNumber(1234.5, { decimals: 1 })).toBe('1,234.5')
    expect(formatNumber(1234.5, { decimals: 1, grouping: false })).toBe('1234.5')
  })

  it('rounds half away from zero on the decimal value', () => {
    expect(roundHalfUp(1.005, 2)).toBe(1.01)
    expect(roundHalfUp(38.65, 1)).toBe(38.7)
    expect(roundHalfUp(-2.5)).toBe(-3)
    expect(roundHalfUp(2.5)).toBe(3)
    expect(roundHalfUp(1e-7, 2)).toBe(0)
    expect(Object.is(roundHalfUp(-0.001, 1), 0)).toBe(true)
    expect(() => roundHalfUp(Number.NaN)).toThrow(RangeError)
  })

  it('percentOf guards division by zero', () => {
    expect(percentOf(1, 0)).toBe(0)
    expect(percentOf(1, 4)).toBe(25)
  })
})
