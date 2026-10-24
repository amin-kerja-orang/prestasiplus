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
    expect(lastLoginText(null)).toBe('Belum log masuk')
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
      errorLines(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' })),
    ).toEqual(['Ralat pelayan.'])
    expect(errorLines(new Error('boom'))).toEqual([GENERIC_ERROR])
  })
})
