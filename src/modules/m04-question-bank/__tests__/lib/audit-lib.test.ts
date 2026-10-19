import { describe, expect, it } from 'vitest'

import { cutText, formatEnDate, formatTime } from '../../lib/audit-format'
import { KBAT_FILTER_OPTIONS, kbatLabel, partLabelText } from '../../lib/structured-options'

describe('M04 S8-S12 helpers', () => {
  it('kbatLabel follows BR-M04-28', () => {
    expect(kbatLabel(3)).toBe('Mengaplikasi (L3)')
    expect(kbatLabel(5)).toBe('Menilai/Mencipta (L5)')
    expect(kbatLabel(1)).toBe('Mengingat (L1)')
    expect(kbatLabel(6)).toBe('Mencipta (L6)')
    expect(KBAT_FILTER_OPTIONS.map((o) => o.value)).toEqual([2, 3, 4, 5])
  })

  it('partLabelText shows "3(A)" for a numbered question and "A" otherwise', () => {
    expect(partLabelText(3, 'a')).toBe('3(A)')
    expect(partLabelText(null, 'a')).toBe('A')
    expect(partLabelText(3, '3(B)')).toBe('3(B)')
  })

  it('formats dates as "dd Mon yyyy" with English months and times as HH:mm', () => {
    expect(formatEnDate('2026-04-08T09:00:00+08:00')).toBe('08 Apr 2026')
    expect(formatEnDate('2026-05-20T09:00:00+08:00')).toBe('20 May 2026')
    expect(formatTime('2026-03-09T08:49:00+08:00')).toBe('08:49')
  })

  it('cutText adds "..." only when it cuts', () => {
    expect(cutText('abc', 5)).toBe('abc')
    expect(cutText('abcdef', 5)).toBe('abcde...')
  })
})
