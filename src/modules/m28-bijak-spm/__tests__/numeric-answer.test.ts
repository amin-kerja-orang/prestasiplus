import { describe, expect, it } from 'vitest'

import { isReadableNumber, plainToLatex } from '../domain/math-expr'

/** What the field stores is the LaTeX form of the typed text (MathField converts on every change). */
const stored = (typed: string): string => plainToLatex(typed)

describe('isReadableNumber: the marker can read a numeric final answer (FB-050)', () => {
  it.each([
    '68',
    '3.5',
    '-2',
    '0.075',
    '1/2',
    '(1)/(2)',
    '12 cm',
    'RM12',
    'RM 12.50',
    '2.5×10^3',
    '1 000',
    '  7  ',
    '3, 5',
    '3 dan 5',
    '3;5',
    '3 and 5',
    '1.2E3',
    '5.',
    '30 °C',
    '7 hari',
    '1\u00a0000',
  ])('accepts %s', (typed) => {
    expect(isReadableNumber(stored(typed))).toBe(true)
  })

  it.each(['68ab', 'abc', 'x', '2x+1', '..', '1/', 'x + 2 y', '3 dan x'])('flags %s', (typed) => {
    expect(isReadableNumber(stored(typed))).toBe(false)
  })

  it('does not flag an empty field (that is "belum dijawab", not an error)', () => {
    expect(isReadableNumber('')).toBe(true)
    expect(isReadableNumber('   ')).toBe(true)
  })
})
