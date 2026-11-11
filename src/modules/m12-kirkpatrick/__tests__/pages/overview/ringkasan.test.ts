import { describe, expect, it } from 'vitest'

import { ringkasanText } from '../../../components/kirkpatrick/overview/ringkasan'

const d = (over: Partial<Parameters<typeof ringkasanText>[0]> = {}) => ({
  active: 56,
  accuracy: 53.7,
  answers: 13965,
  champions: 28,
  ...over,
})

describe('C-54 ringkasanText (V2 overview.blade.php:244-247)', () => {
  it('gain: all four clauses in the V2 order, accuracy as a whole number', () => {
    expect(ringkasanText(d())).toBe(
      '56 pelajar baru mula aktif berbanding Januari. Ketepatan jawapan meningkat 54%. Jumlah jawapan bertambah 13,965. 28 pelajar naik ke tahap Champion.',
    )
  })

  it('accuracy below zero reads "menurun" with the absolute value', () => {
    expect(ringkasanText(d({ accuracy: -16.6 }))).toContain('Ketepatan jawapan menurun 17%.')
  })

  it('accuracy exactly zero reads "meningkat 0%"', () => {
    expect(ringkasanText(d({ accuracy: 0 }))).toContain('Ketepatan jawapan meningkat 0%.')
  })

  it('answers below zero read "berkurang" with the absolute count', () => {
    expect(ringkasanText(d({ answers: -451 }))).toContain('Jumlah jawapan berkurang 451.')
  })

  it('answers exactly zero read "bertambah 0"', () => {
    expect(ringkasanText(d({ answers: 0 }))).toContain('Jumlah jawapan bertambah 0.')
  })

  it('active and champion counts are printed as they are, also zero and negative (V2 has no condition)', () => {
    const text = ringkasanText(d({ active: -11, champions: 0 }))
    expect(text.startsWith('-11 pelajar baru mula aktif berbanding Januari.')).toBe(true)
    expect(text.endsWith('0 pelajar naik ke tahap Champion.')).toBe(true)
  })
})
