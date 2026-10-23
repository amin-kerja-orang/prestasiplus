/** Minimisation of the reporter's free text in the open-reports export (no database). */
import { describe, expect, it } from 'vitest'

import { REASON_MAX, redactReason, TRUNCATED } from '../../../src/migration/export/question-reports'

describe('redactReason', () => {
  it('keeps null and ordinary text', () => {
    expect(redactReason(null)).toBeNull()
    expect(redactReason('Jawapan salah, pilihan B patut A. Markah 3/4 (tahun 2025).')).toBe('Jawapan salah, pilihan B patut A. Markah 3/4 (tahun 2025).')
    expect(redactReason('')).toBe('')
  })

  it('redacts e-mail addresses', () => {
    expect(redactReason('hubungi ali.baba+x@contoh.invalid sekarang')).toBe('hubungi [dihapus] sekarang')
    expect(redactReason('A@b.co dan c_d@sub.contoh.my')).toBe('[dihapus] dan [dihapus]')
  })

  it('redacts Malaysian phone numbers in common formats', () => {
    for (const n of ['0123456789', '012-3456789', '012 345 6789', '011-23456789', '+60123456789', '+60 12-345 6789', '60123456789', '03-12345678', '+603 1234 5678', '04-1234567']) {
      expect(redactReason(`telefon ${n} terima kasih`), n).toBe('telefon [dihapus] terima kasih')
    }
  })

  it('redacts 12-digit IC / MyKad numbers with or without dashes', () => {
    for (const n of ['010203-04-0506', '010203040506', '010203 04 0506']) {
      expect(redactReason(`IC ${n}.`), n).toBe('IC [dihapus].')
    }
  })

  it('leaves short numbers, years and marks alone', () => {
    expect(redactReason('soalan 12, jawapan 345, tahun 2026, 1/2 markah')).toBe('soalan 12, jawapan 345, tahun 2026, 1/2 markah')
  })

  it('caps the length and marks the truncation', () => {
    const exact = 'a'.repeat(REASON_MAX)
    expect(redactReason(exact)).toBe(exact)
    const long = redactReason('b'.repeat(REASON_MAX + 50)) as string
    expect(long).toBe(`${'b'.repeat(REASON_MAX)}${TRUNCATED}`)
    // A number is redacted before the cut, so a half number cannot survive at the boundary.
    const edge = redactReason(`${'c'.repeat(REASON_MAX - 4)} 0123456789 tamat`) as string
    expect(edge).not.toMatch(/\d{3}/)
    expect(Array.from(edge).length).toBeLessThanOrEqual(REASON_MAX + TRUNCATED.length)
    // Code points are not split.
    const emoji = redactReason('😀'.repeat(REASON_MAX + 1)) as string
    expect(emoji).toBe(`${'😀'.repeat(REASON_MAX)}${TRUNCATED}`)
  })
})
