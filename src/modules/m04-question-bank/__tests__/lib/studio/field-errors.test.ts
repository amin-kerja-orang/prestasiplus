import { describe, expect, it } from 'vitest'

import { studioFieldErrors } from '../../../lib/studio/field-errors'

describe('studioFieldErrors', () => {
  it('maps the gate key chapterId to the Bab field curriculumChapterId', () => {
    expect(studioFieldErrors({ chapterId: 'Bab belum dipilih', questionText: 'x' })).toEqual({
      curriculumChapterId: 'Bab belum dipilih',
      questionText: 'x',
    })
  })
  it('keeps an explicit curriculumChapterId over the alias', () => {
    expect(studioFieldErrors({ chapterId: 'a', curriculumChapterId: 'b' })).toEqual({ curriculumChapterId: 'b' })
    expect(studioFieldErrors({ curriculumChapterId: 'b', chapterId: 'a' })).toEqual({ curriculumChapterId: 'b' })
  })
  it('handles no fields', () => {
    expect(studioFieldErrors(undefined)).toEqual({})
  })
})
