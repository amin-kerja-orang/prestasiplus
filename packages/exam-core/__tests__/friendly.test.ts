import { describe, expect, it } from 'vitest'

import { answersEquivalent, latexToFriendly, plainToLatex } from '../src/math-expr'

describe('friendly notation (students never see LaTeX)', () => {
  it('converts what the on-screen keyboard inserts', () => {
    expect(plainToLatex('(1)/(2)')).toBe('\\frac{1}{2}')
    expect(plainToLatex('()/()')).toBe('\\frac{}{}')
    expect(plainToLatex('(x+1)/(x-1)')).toBe('\\frac{x+1}{x-1}')
    expect(plainToLatex('√(3)')).toBe('\\sqrt{3}')
    expect(plainToLatex('x^2')).toBe('x^{2}')
    expect(plainToLatex('2×3÷4')).toBe('2\\times 3\\div 4')
    expect(plainToLatex('x≤5')).toBe('x\\le 5')
  })
  it('shows stored LaTeX back as friendly text', () => {
    expect(latexToFriendly('\\frac{1}{2}')).toBe('1/2')
    expect(latexToFriendly('\\frac{x+1}{x-1}')).toBe('(x+1)/(x-1)')
    expect(latexToFriendly('x^{2}')).toBe('x^2')
    expect(latexToFriendly('x^{n+1}')).toBe('x^(n+1)')
    expect(latexToFriendly('\\sqrt{3}')).toBe('√3')
    expect(latexToFriendly('2\\times 3')).toBe('2×3')
    expect(latexToFriendly('\\frac{}{}')).toBe('()/()')
  })
  it('round-trips and still marks as the same answer', () => {
    for (const friendly of ['(1)/(2)', '3x^2+2x', '√(x+1)', '2×3', '(x+1)/(x-1)']) {
      const latex = plainToLatex(friendly)
      expect(answersEquivalent(latex, friendly.replace('×', '*'))).toBe(true)
      expect(plainToLatex(latexToFriendly(latex))).toBe(latex)
    }
  })
})
