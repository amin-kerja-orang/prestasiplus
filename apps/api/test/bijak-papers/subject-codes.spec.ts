import { describe, expect, it } from 'vitest'

import { bijakCodeOf, curriculumCodeOf } from '../../src/modules/bijak/papers'

// #45 M6: exam_attempts.subject and the aggregate subject_code hold the Bijak code; readers convert.
describe('Bijak <-> curriculum subject codes', () => {
  it('maps the curriculum codes to the Bijak codes', () => {
    expect(bijakCodeOf('MATH')).toBe('MAT')
    expect(bijakCodeOf('SCI')).toBe('SN')
  })

  it('maps the Bijak codes back to the curriculum codes', () => {
    expect(curriculumCodeOf('MAT')).toBe('MATH')
    expect(curriculumCodeOf('SN')).toBe('SCI')
  })

  it('passes any other code through unchanged in both directions (open dictionary)', () => {
    for (const code of ['SEJ', 'BM', 'BI', 'ADD']) {
      expect(bijakCodeOf(code)).toBe(code)
      expect(curriculumCodeOf(code)).toBe(code)
    }
  })

  it('is a round trip for every code', () => {
    for (const code of ['MATH', 'SCI', 'SEJ']) expect(curriculumCodeOf(bijakCodeOf(code))).toBe(code)
    for (const code of ['MAT', 'SN', 'SEJ']) expect(bijakCodeOf(curriculumCodeOf(code))).toBe(code)
  })
})
