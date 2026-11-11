import { describe, expect, it } from 'vitest'

import { hasMathml, mathmlToLatex } from '../../lib/mathml'
import { excerpt } from '../../lib/question-list'

const baked = (tex: string): string =>
  `<math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">${tex}</annotation></semantics></math>`

describe('mathmlToLatex', () => {
  it('turns baked MathML into its TeX annotation', () => {
    expect(mathmlToLatex(`Selesaikan ${baked('x^2 &lt; 4')} sekarang`)).toBe('Selesaikan $x^2 < 4$ sekarang')
  })
  it('falls back to the plain text of MathML without a TeX annotation', () => {
    expect(mathmlToLatex('A <math><mn>3</mn><mo>+</mo><mn>4</mn></math> B')).toBe('A $3 + 4$ B')
  })
  it('leaves text without MathML as it is', () => {
    expect(hasMathml('1 < 2')).toBe(false)
    expect(mathmlToLatex('1 < 2 dan 3 > 2')).toBe('1 < 2 dan 3 > 2')
  })
  it('is read before the list excerpt is cut', () => {
    expect(excerpt(`${baked('y')} ok`)).toBe('$y$ ok')
  })
})
