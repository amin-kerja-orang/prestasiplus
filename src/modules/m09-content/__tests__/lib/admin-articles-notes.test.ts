import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import {
  CATEGORY_OPTIONS,
  GRADE_OPTIONS,
  errorLines,
  fieldErrors,
  isNotFoundError,
  limitText,
  listDate,
  noteGradeText,
  noteSubjectText,
  previewDate,
  queryPage,
  queryText,
} from '../../lib/admin-articles-notes'

describe('limitText (Laravel Str::limit)', () => {
  it('keeps text up to the limit and cuts longer text with "..."', () => {
    expect(limitText('a'.repeat(50), 50)).toBe('a'.repeat(50))
    expect(limitText('a'.repeat(51), 50)).toBe(`${'a'.repeat(50)}...`)
  })

  it('right-trims the cut part before the ellipsis', () => {
    expect(limitText('abcd efgh', 5)).toBe('abcd...')
  })
})

describe('display helpers', () => {
  it('shows note subjects as the upper-case label and grades with a space', () => {
    expect(noteSubjectText('matematik')).toBe('MATEMATIK')
    expect(noteSubjectText('bahasa_melayu')).toBe('BAHASA MELAYU')
    expect(noteSubjectText('bahasa_inggeris')).toBe('BAHASA INGGERIS')
    expect(noteGradeText('DARJAH_2')).toBe('DARJAH 2')
  })

  it('formats dates dd/mm/yyyy (list) and dd Mon yyyy in English (preview)', () => {
    expect(listDate('2026-02-22T10:00:00+08:00')).toBe('22/02/2026')
    expect(previewDate('2026-02-22T10:00:00+08:00')).toBe('22 Feb 2026')
    expect(previewDate('2026-03-17T23:23:00+08:00')).toBe('17 Mar 2026')
  })

  it('reads query values and pages safely', () => {
    expect(queryText(['a', 'b'])).toBe('a')
    expect(queryText(undefined)).toBe('')
    expect(queryPage('3')).toBe(3)
    expect(queryPage('0')).toBe(1)
    expect(queryPage('x')).toBe(1)
  })
})

describe('options', () => {
  it('has the 7 article categories and 7 levels in live order', () => {
    expect(CATEGORY_OPTIONS.map((o) => o.value)).toEqual([
      'TIPS_BELAJAR',
      'BERITA',
      'MOTIVASI',
      'PANDUAN_IBU_BAPA',
      'PANDUAN_GURU',
      'KEJAYAAN',
      'UMUM',
    ])
    expect(GRADE_OPTIONS.map((o) => o.value)).toEqual([
      'SEMUA',
      'DARJAH_1',
      'DARJAH_2',
      'DARJAH_3',
      'DARJAH_4',
      'DARJAH_5',
      'DARJAH_6',
    ])
  })
})

describe('error helpers', () => {
  const fieldsError = new ApiError({
    status: 422,
    code: 'VALIDATION_ERROR',
    message: 'Invalid',
    fields: { title: 'Medan ini tidak sah.', content: 'Medan ini tidak sah.' },
  })

  it('lists unique field messages, else the message, else the generic copy', () => {
    expect(errorLines(fieldsError)).toEqual(['Medan ini tidak sah.'])
    expect(
      errorLines(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Dilarang.' })),
    ).toEqual(['Dilarang.'])
    expect(
      errorLines(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' })),
    ).toEqual(['Ralat berlaku. Sila cuba lagi.'])
    expect(errorLines(new Error('x'))).toEqual(['Ralat berlaku. Sila cuba lagi.'])
  })

  it('returns field messages by name and detects 404', () => {
    expect(fieldErrors(fieldsError)).toEqual({
      title: 'Medan ini tidak sah.',
      content: 'Medan ini tidak sah.',
    })
    expect(fieldErrors(new Error('x'))).toEqual({})
    expect(isNotFoundError(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))).toBe(
      true,
    )
    expect(isNotFoundError(fieldsError)).toBe(false)
  })
})
