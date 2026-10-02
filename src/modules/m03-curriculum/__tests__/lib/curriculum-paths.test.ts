import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import {
  chapterCreateTo,
  chapterHeading,
  errorLines,
  GENERIC_ERROR,
  isNotFound,
  orNull,
  topicHeading,
  treeTo,
} from '../../lib/curriculum-paths'

describe('curriculum paths and helpers (M03-T3)', () => {
  it('treeTo carries only the given non-empty parameters', () => {
    expect(treeTo(3, 10)).toEqual({
      path: '/admin/curriculum',
      query: { subject_id: '3', education_level_id: '10' },
    })
    expect(treeTo('3', '')).toEqual({ path: '/admin/curriculum', query: { subject_id: '3' } })
    expect(treeTo()).toEqual({ path: '/admin/curriculum', query: {} })
  })

  it('chapterCreateTo points at S2 with the pair', () => {
    expect(chapterCreateTo(3, 10)).toEqual({
      path: '/admin/curriculum/chapters/create',
      query: { subject_id: '3', education_level_id: '10' },
    })
  })

  it('headings print an empty number as the live template does', () => {
    expect(chapterHeading({ chapterNumber: 4, name: 'Nombor' })).toBe('Bab 4: Nombor')
    expect(chapterHeading({ chapterNumber: null, name: 'Nombor' })).toBe('Bab : Nombor')
    expect(topicHeading({ topicNumber: '1.1', name: 'Hingga 100' })).toBe('Topik 1.1: Hingga 100')
    expect(topicHeading({ topicNumber: null, name: 'X' })).toBe('Topik : X')
  })

  it('errorLines lists field messages, else the message, else the generic copy', () => {
    const fields = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'x',
      fields: { name: 'A', other: 'B' },
    })
    expect(errorLines(fields)).toEqual(['A', 'B'])
    expect(
      errorLines(new ApiError({ status: 409, code: 'CONFLICT', message: 'Bertindih' })),
    ).toEqual(['Bertindih'])
    expect(errorLines(new Error('x'))).toEqual([GENERIC_ERROR])
    expect(
      errorLines(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' })),
    ).toEqual([GENERIC_ERROR])
  })

  it('isNotFound and orNull', () => {
    expect(isNotFound(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'n' }))).toBe(true)
    expect(isNotFound(new Error('n'))).toBe(false)
    expect(orNull('')).toBeNull()
    expect(orNull('a')).toBe('a')
  })
})
