import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import {
  errorLines,
  formatCount,
  formatDate,
  formatDateTime,
  GENERIC_ERROR,
  lastLoginText,
  phoneText,
  schoolMeta,
} from '../../components/users/users-format'

describe('users-format (BR-M27-36, 39)', () => {
  it('formats dates as dd/mm/yyyy and dd/mm/yyyy HH:mm in Asia/Kuala_Lumpur', () => {
    expect(formatDate('2026-03-04T10:00:00+08:00')).toBe('04/03/2026')
    expect(formatDateTime('2026-04-05T14:07:00+08:00')).toBe('05/04/2026 14:07')
    // 23:30 UTC on the 4th is 07:30 MYT on the 5th
    expect(formatDate('2026-03-04T23:30:00Z')).toBe('05/03/2026')
    expect(formatDate('not a date')).toBe('')
  })

  it('formats counts with the ms-MY separator', () => {
    expect(formatCount(1234)).toBe('1,234')
  })

  it('shows "Belum login" for a null last login and a relative time otherwise', () => {
    expect(lastLoginText(null)).toBe('Belum login')
    expect(lastLoginText('2000-01-01T00:00:00+08:00')).toMatch(/ tahun yang lepas$/)
  })

  it('shows "-" for an empty phone', () => {
    expect(phoneText(null)).toBe('-')
    expect(phoneText('')).toBe('-')
    expect(phoneText('0191234567')).toBe('0191234567')
  })

  it('joins the school meta without empty parts', () => {
    expect(schoolMeta({ code: 'A1', district: 'PPD X', state: 'Selangor' })).toBe('A1 · PPD X · Selangor')
    expect(schoolMeta({ code: null, district: null, state: 'Selangor' })).toBe('Selangor')
    expect(schoolMeta({ code: 'A1', district: '', state: 'Selangor' })).toBe('A1 · Selangor')
  })

  it('turns an ApiError into one line per distinct field message, else the message, else the generic copy', () => {
    const fields = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'x',
      fields: { name: 'Nama diperlukan.', email: 'Emel diperlukan.', other: 'Nama diperlukan.' },
    })
    expect(errorLines(fields)).toEqual(['Nama diperlukan.', 'Emel diperlukan.'])
    expect(
      errorLines(new ApiError({ status: 409, code: 'CONFLICT', message: 'Emel sudah digunakan.' })),
    ).toEqual(['Emel sudah digunakan.'])
    expect(errorLines(new Error('boom'))).toEqual([GENERIC_ERROR])
  })

  it('shows the generic BM line for a 5xx, a transport text and the API generic English defaults (SWE)', () => {
    const fail = (status: number, message: string) =>
      new ApiError({ status, code: 'X', message })
    expect(errorLines(fail(500, 'Server Error'))).toEqual([GENERIC_ERROR])
    expect(errorLines(fail(503, 'Ralat pelayan.'))).toEqual([GENERIC_ERROR])
    expect(errorLines(fail(0, 'Failed to fetch'))).toEqual([GENERIC_ERROR])
    expect(errorLines(fail(502, 'HTTP 502'))).toEqual([GENERIC_ERROR])
    for (const text of [
      'Not Found.',
      'This action is unauthorized.',
      'Unauthenticated.',
      'Conflict.',
      'The given data was invalid.',
      'Payload Too Large.',
    ]) {
      expect(errorLines(fail(404, text))).toEqual([GENERIC_ERROR])
    }
    expect(errorLines(fail(404, 'Pelajar tidak dijumpai.'))).toEqual(['Pelajar tidak dijumpai.'])
  })
})
