import { describe, expect, it } from 'vitest'

import { bandOf, jurangOf, otrTarget, otrTargets, parseMark, projectionOfAr } from '../../lib/headcount/otr'

describe('otrTarget (HC-2)', () => {
  it('worked example TOV 40, ETR 80, n = 3 → 53 / 66 / 80', () => {
    expect(otrTargets(40, 80, 3)).toEqual([53, 66, 80])
  })

  it.each([
    [2, [60, 80]],
    [3, [53, 66, 80]],
    [4, [50, 60, 70, 80]],
    [5, [48, 56, 64, 72, 80]],
  ])('n = %s (TOV 40, ETR 80)', (n, expected) => {
    expect(otrTargets(40, 80, n)).toEqual(expected)
  })

  it('OTR_n is the ETR as typed; a missing TOV or ETR gives no target; k outside 1..n gives none', () => {
    expect(otrTarget(40, 66.5, 3, 3)).toBe(66.5)
    expect(otrTargets(null, 80, 3)).toEqual([null, null, null])
    expect(otrTargets(40, null, 3)).toEqual([null, null, null])
    expect(otrTarget(40, 80, 0, 3)).toBeNull()
    expect(otrTarget(40, 80, 4, 3)).toBeNull()
  })

  it('computes in integer tenths, half up: TOV 0.7, ETR 36.3, n = 2 → 19; 40/80/n=3 → 53/66/80', () => {
    expect(otrTargets(0.7, 36.3, 2)).toEqual([19, 36.3])
    expect(otrTarget(0.7, 36.3, 1, 2)).toBe(19)
    expect([1, 2, 3].map((k) => otrTarget(40, 80, k, 3))).toEqual([53, 66, 80])
  })

  it('rounds half up and handles an ETR below the TOV', () => {
    expect(otrTarget(50, 65, 1, 2)).toBe(58) // 57.5
    expect(otrTarget(67, 56, 1, 3)).toBe(63)
  })
})

describe('bands, Jurang, Unjuran, marks', () => {
  it('bands: Above > 2, On Track 0..2, Below < 0 (AC-GUR-3-4)', () => {
    expect(bandOf(55, 53)).toBe('on')
    expect(bandOf(56, 53)).toBe('above')
    expect(bandOf(52, 53)).toBe('below')
    expect(bandOf(53, 53)).toBe('on')
    expect(bandOf(null, 53)).toBe('na')
  })

  it('Jurang is ETR − TOV', () => {
    expect(jurangOf(40, 80)).toBe(40)
    expect(jurangOf(80, 75)).toBe(-5)
    expect(jurangOf(null, 75)).toBeNull()
  })

  it('HC-6: end = ETR when AR ≥ TOV else AR; trend and Keyakinan', () => {
    expect(projectionOfAr({ tov: 40, etr: 80, ar: 60 })).toEqual({
      end: 80,
      trend: 'Meningkat',
      confidence: 'Sederhana',
    })
    expect(projectionOfAr({ tov: 50, etr: 65, ar: 45 })).toEqual({
      end: 45,
      trend: 'Stabil',
      confidence: 'Rendah',
    })
    expect(projectionOfAr({ tov: 40, etr: 80, ar: 85 })).toMatchObject({ trend: 'Menurun', confidence: 'Tinggi' })
    expect(projectionOfAr({ tov: 40, etr: null, ar: 60 })).toBeNull()
  })

  it('parseMark: empty is allowed, 0..100 is a number, anything else is the range error', () => {
    expect(parseMark('')).toEqual({ ok: true, value: null })
    expect(parseMark('66.5')).toEqual({ ok: true, value: 66.5 })
    expect(parseMark('101')).toEqual({ ok: false, error: 'Markah mesti antara 0 dan 100.' })
    expect(parseMark('-1').ok).toBe(false)
    expect(parseMark('abc').ok).toBe(false)
  })
})
