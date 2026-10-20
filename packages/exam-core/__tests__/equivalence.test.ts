import { describe, expect, it } from 'vitest'

import {
  answersEquivalent,
  latexToPlain,
  matchFinal,
  numericValue,
  plainToLatex,
  splitUnit,
} from '../src/math-expr'

describe('answersEquivalent (table)', () => {
  const same: [string, string][] = [
    ['2x+6', '2(x+3)'],
    ['2x + 6', '2*(x+3)'],
    ['x^2-4', '(x-2)(x+2)'],
    ['3(x^2-4)', '3x^2-12'],
    ['0.5', '1/2'],
    ['0.5', '50%'],
    ['\\frac{1}{2}', '0.5'],
    ['\\frac{1}{2}', '50%'],
    ['0,5', '0.5'],
    ['x = 3', '3'],
    ['3', 'x=3'],
    ['\\frac{12}{13}', '12/13'],
    ['\\sqrt{169}', '13'],
    ['√3', '\\sqrt{3}'],
    ['2^{3}', '8'],
    ['10^3', '1000'],
    ['x^2', 'x*x'],
    ['4x/2', '2x'],
    ['2, 3', '3 atau 2'],
    ['x=2, x=3', '3, 2'],
    ['±3', '3, -3'],
    ['−5', '-5'],
    ['y = 2x + 3', '2x+3'],
    ['2y = 4x + 6', 'y = 2x + 3'],
    ['x < 5', '5 > x'],
    ['1.5\\times 2', '3'],
    ['6 ÷ 4', '1.5'],
  ]
  it.each(same)('%s ≡ %s', (a, b) => {
    expect(answersEquivalent(a, b)).toBe(true)
  })

  const different: [string, string][] = [
    ['2x+6', '2x+3'],
    ['x^2+4', '(x+2)^2'],
    ['0.5', '0.55'],
    ['1/2', '1/3'],
    ['x = 3', '4'],
    ['3(x-2)(x+2)', '3(x-2)(x-2)'],
    ['2, 3', '2, 4'],
    ['2, 3', '2'],
    ['x < 5', 'x > 5'],
    ['abc def', '5'],
  ]
  it.each(different)('%s ≢ %s', (a, b) => {
    expect(answersEquivalent(a, b)).toBe(false)
  })

  it('honours a numeric tolerance', () => {
    expect(answersEquivalent('3.14', '3.1416', 0.005)).toBe(true)
    expect(answersEquivalent('3.14', '3.1416', 0)).toBe(false)
  })
})

describe('LaTeX and plain-text conversion', () => {
  it('turns LaTeX into one plain form', () => {
    expect(latexToPlain('\\frac{1}{2}')).toBe('((1)/(2))')
    expect(latexToPlain('x^{2} \\times 3')).toBe('x^(2) * 3')
    expect(latexToPlain('0,5')).toBe('0.5')
  })
  it('keeps a comma that separates a list', () => {
    expect(latexToPlain('2, 3')).toBe('2, 3')
  })
  it('converts friendly typing to LaTeX and leaves LaTeX alone', () => {
    expect(plainToLatex('1/2')).toBe('\\frac{1}{2}')
    expect(plainToLatex('x^2')).toBe('x^{2}')
    expect(plainToLatex('sqrt(3)')).toBe('\\sqrt{3}')
    expect(plainToLatex('√3')).toBe('\\sqrt{3}')
    expect(plainToLatex('\\frac{1}{2}')).toBe('\\frac{1}{2}')
  })
  it('numericValue evaluates variable-free answers', () => {
    expect(numericValue('50%')).toBeCloseTo(0.5)
    expect(numericValue('x')).toBeNull()
    expect(numericValue('abc def')).toBeNull()
  })
})

describe('units', () => {
  it('splits a trailing unit that the part expects', () => {
    expect(splitUnit('12 cm', 'cm')).toEqual({ value: '12', unit: 'cm' })
    expect(splitUnit('30cm^2', 'cm²')).toEqual({ value: '30', unit: 'cm2' })
    expect(splitUnit('RM12', 'RM')).toEqual({ value: '12', unit: 'rm' })
  })
  it('does not eat a variable as a unit', () => {
    expect(splitUnit('2x', 'cm')).toEqual({ value: '2x', unit: '' })
  })
  const key = { accept: ['13'], unit: 'cm', tolerance: 0 }
  it('matches value and unit separately', () => {
    expect(matchFinal('13', 'cm', key)).toEqual({ value: 'match', unit: 'ok' })
    expect(matchFinal('13 cm', '', key)).toEqual({ value: 'match', unit: 'ok' })
    expect(matchFinal('13', '', key)).toEqual({ value: 'match', unit: 'missing' })
    expect(matchFinal('13', 'm', key)).toEqual({ value: 'match', unit: 'wrong' })
    expect(matchFinal('12', 'cm', key)).toEqual({ value: 'mismatch', unit: 'ok' })
    expect(matchFinal('', 'cm', key).value).toBe('empty')
    expect(matchFinal('banyak sekali', 'cm', key).value).toBe('unparseable')
  })
  it('compares squared units written three ways', () => {
    const k = { accept: ['30'], unit: 'cm²' }
    for (const u of ['cm²', 'cm^2', 'cm2', 'cm^{2}']) expect(matchFinal('30', u, k).unit).toBe('ok')
  })
})
