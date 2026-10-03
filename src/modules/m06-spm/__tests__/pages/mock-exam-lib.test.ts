import { describe, expect, it } from 'vitest'

import {
  GRADE_CHIP_CLASS,
  HERO_CLASS,
  MOCK_SUBJECT_OPTIONS,
  WALKTHROUGH_SUBJECT_OPTIONS,
  elapsedLabel,
  isCorrect,
  itemHeader,
  optionLetter,
  percentLabel,
  scoreLabel,
  wrongLabel,
} from '../../components/mock-lib'

describe('mock-lib', () => {
  it('lists 10 mock subjects and 15 walkthrough subjects in live order', () => {
    expect(MOCK_SUBJECT_OPTIONS).toHaveLength(10)
    expect(WALKTHROUGH_SUBJECT_OPTIONS).toHaveLength(15)
    expect(WALKTHROUGH_SUBJECT_OPTIONS[9]).toBe('Pendidikan Islam')
    expect(WALKTHROUGH_SUBJECT_OPTIONS.at(-1)).toBe('Prinsip Akaun')
  })

  it('formats score, percent, header and wrong counts', () => {
    expect(scoreLabel(0, 30, 0)).toBe('Score: 0/30 (0.00%)')
    expect(percentLabel(96.6666)).toBe('96.67%')
    expect(itemHeader({ no: 1, marks: 0, maxMarks: 1 })).toBe('Soalan 1 · 0/1 markah')
    expect(itemHeader({ no: 2, marks: null, maxMarks: 10 })).toBe('Soalan 2 · 0/10 markah')
    expect(wrongLabel(9)).toBe('9 soalan tersilap')
  })

  it('judges an item correct only at full marks', () => {
    expect(isCorrect({ marks: 1, maxMarks: 1 })).toBe(true)
    expect(isCorrect({ marks: 6, maxMarks: 10 })).toBe(false)
    expect(isCorrect({ marks: null, maxMarks: 1 })).toBe(false)
  })

  it('maps grades to chip colours (DV-M06-06) and hero classes', () => {
    expect(GRADE_CHIP_CLASS['A+']).toContain('emerald')
    expect(GRADE_CHIP_CLASS.A).toContain('emerald')
    expect(GRADE_CHIP_CLASS['B+']).toContain('blue')
    expect(GRADE_CHIP_CLASS.C).toContain('amber')
    for (const g of ['D', 'E', 'G'] as const) expect(GRADE_CHIP_CLASS[g]).toContain('red')
    expect(GRADE_CHIP_CLASS.pending).toContain('slate')
    expect(HERO_CLASS.good).toContain('emerald')
    expect(HERO_CLASS.mid).toContain('amber')
    expect(HERO_CLASS.bad).toContain('red')
  })

  it('letters options and formats the elapsed timer without going negative', () => {
    expect([0, 1, 3].map(optionLetter)).toEqual(['A', 'B', 'D'])
    const t0 = Date.parse('2026-09-25T10:00:00+08:00')
    expect(elapsedLabel('2026-09-25T10:00:00+08:00', t0 + 65_000)).toBe('01:05')
    expect(elapsedLabel('2026-09-25T10:00:00+08:00', t0 + 3_725_000)).toBe('1:02:05')
    expect(elapsedLabel('2026-09-25T10:00:00+08:00', t0 - 5000)).toBe('00:00')
  })
})
