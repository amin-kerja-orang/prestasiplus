import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import { errorLines, GENERIC_ERROR } from '../../lib/error-lines'

describe('errorLines', () => {
  it('lists each distinct field text once', () => {
    const err = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'x',
      fields: { email: 'A', password: 'B', passwordConfirmation: 'B' },
    })
    expect(errorLines(err)).toEqual(['A', 'B'])
  })

  it('uses the message when there are no fields (inactive account)', () => {
    const err = new ApiError({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Akaun tidak aktif',
    })
    expect(errorLines(err)).toEqual(['Akaun tidak aktif'])
  })

  it('falls back to the generic line for developer messages and non-API errors', () => {
    expect(
      errorLines(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' })),
    ).toEqual([GENERIC_ERROR])
    expect(errorLines(new Error('boom'))).toEqual([GENERIC_ERROR])
  })

  it('returns the generic line for a network failure (no English "Failed to fetch")', () => {
    expect(
      errorLines(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' })),
    ).toEqual([GENERIC_ERROR])
    expect(
      errorLines(new ApiError({ status: 0, code: 'SERVER_ERROR', message: 'Failed to fetch' })),
    ).toEqual([GENERIC_ERROR])
  })
})

describe('errorLines: no English server text (SWE-02)', () => {
  const fail = (status: number, message: string) => new ApiError({ status, code: 'X', message })

  it('returns the generic BM line for a 5xx "Server Error"', () => {
    expect(errorLines(fail(500, 'Server Error'))).toEqual([GENERIC_ERROR])
    expect(errorLines(fail(503, 'Ralat pelayan.'))).toEqual([GENERIC_ERROR])
  })

  it('returns the generic BM line for the API generic English defaults', () => {
    for (const text of [
      'Not Found.',
      'This action is unauthorized.',
      'Unauthenticated.',
      'Conflict.',
      'The given data was invalid.',
      'Payload Too Large.',
    ]) {
      expect(errorLines(fail(401, text))).toEqual([GENERIC_ERROR])
    }
  })

  it('keeps the BM auth messages of a 4xx', () => {
    expect(errorLines(fail(401, 'Emel atau kata laluan tidak sah.'))).toEqual([
      'Emel atau kata laluan tidak sah.',
    ])
    expect(errorLines(fail(409, 'Emel sudah didaftarkan.'))).toEqual(['Emel sudah didaftarkan.'])
  })
})

describe('errorLines BM mapping (BUG-04)', () => {
  const lines = (fields: Record<string, string>) =>
    errorLines(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x', fields }))

  it.each([
    ['The grade field is required.', 'Ruang darjah wajib diisi.'],
    ['The email has already been taken.', 'Alamat email ini telah digunakan.'],
    ['The password confirmation does not match.', 'Pengesahan kata laluan tidak sepadan.'],
    ['The password field confirmation does not match.', 'Pengesahan kata laluan tidak sepadan.'],
    [
      'The password must be at least 8 characters.',
      'Ruang kata laluan mestilah sekurang-kurangnya 8 aksara.',
    ],
    [
      'The password field must be at least 6 characters.',
      'Ruang kata laluan mestilah sekurang-kurangnya 6 aksara.',
    ],
    ['This password reset token is invalid.', 'Token tetapan semula kata laluan ini tidak sah.'],
  ])('maps %s', (en, bm) => {
    expect(lines({ f: en })).toEqual([bm])
  })

  it('maps a message without fields and passes unknown or BM text through', () => {
    expect(
      errorLines(
        new ApiError({ status: 422, code: 'X', message: 'This password reset token is invalid.' }),
      ),
    ).toEqual(['Token tetapan semula kata laluan ini tidak sah.'])
    expect(lines({ a: 'Teks lain.', b: 'Email atau kata laluan tidak sah.' })).toEqual([
      'Teks lain.',
      'Email atau kata laluan tidak sah.',
    ])
  })
})
