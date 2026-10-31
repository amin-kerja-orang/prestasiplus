import { normaliseKuizCount } from '@pp/contract'
import { describe, expect, it } from 'vitest'

// V2 ExamQuizController: (int) cast, then in_array(5,10,20,40) else 20. Never an error.
describe('normaliseKuizCount', () => {
  it('keeps 5/10/20/40, casts numeric strings and truncates decimals', () => {
    expect([5, 10, 20, 40, '10', '40', 5.5, '5.9'].map(normaliseKuizCount)).toEqual([5, 10, 20, 40, 10, 40, 5, 5])
  })
  it('falls back to 20 for anything else', () => {
    expect([undefined, null, 0, 7, 100, -5, Number.NaN, 'abc', '', {}, [], true].map(normaliseKuizCount)).toEqual(Array(12).fill(20))
  })
})
