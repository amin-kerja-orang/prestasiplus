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

  // Every real backend text of the M01 endpoints (contract account/schema.ts, account/paths.ts).
  it.each([
    ['The name field is required.', 'Ruang Nama Penuh wajib diisi.'],
    ['The email field is required.', 'Ruang Alamat Email wajib diisi.'],
    ['The password field is required.', 'Ruang Kata Laluan wajib diisi.'],
    ['The current password field is required.', 'Ruang Kata Laluan Semasa wajib diisi.'],
    ['The token field is required.', 'Ruang Token wajib diisi.'],
    ['The ic number field is required.', 'Ruang No. Kad Pengenalan wajib diisi.'],
    ['The grade field is required.', 'Ruang Darjah wajib diisi.'],
    ['The profile picture field is required.', 'Ruang Gambar Profil wajib diisi.'],
    [
      'The email field must be a valid email address.',
      'Ruang Alamat Email mestilah alamat email yang sah.',
    ],
    ['The email has already been taken.', 'Alamat Email ini telah digunakan.'],
    ['The password field confirmation does not match.', 'Pengesahan Kata Laluan tidak sepadan.'],
    ['The password confirmation does not match.', 'Pengesahan Kata Laluan tidak sepadan.'],
    [
      'The password field must be at least 6 characters.',
      'Ruang Kata Laluan mestilah sekurang-kurangnya 6 aksara.',
    ],
    [
      'The name field must not be greater than 255 characters.',
      'Ruang Nama Penuh tidak boleh melebihi 255 aksara.',
    ],
    [
      'The phone field must not be greater than 14 characters.',
      'Ruang No. Telefon tidak boleh melebihi 14 aksara.',
    ],
    [
      'The ic number field must not be greater than 14 characters.',
      'Ruang No. Kad Pengenalan tidak boleh melebihi 14 aksara.',
    ],
    [
      'The bio field must not be greater than 500 characters.',
      'Ruang Bio / Motto tidak boleh melebihi 500 aksara.',
    ],
    ['The selected role is invalid.', 'Pilihan Peranan tidak sah.'],
    ['The selected grade is invalid.', 'Pilihan Darjah tidak sah.'],
    ['The selected school id is invalid.', 'Pilihan Sekolah tidak sah.'],
    ['The selected faith is invalid.', 'Pilihan Agama tidak sah.'],
    [
      'The profile picture field must be a file of type: jpeg, png, webp.',
      'Ruang Gambar Profil mestilah fail jenis: jpeg, png, webp.',
    ],
    [
      'The profile picture field must not be greater than 2048 kilobytes.',
      'Ruang Gambar Profil tidak boleh melebihi 2048 KB.',
    ],
    [
      'The subuh push time field must match the format H:i.',
      'Ruang Push waktu Subuh mestilah dalam format JJ:MM.',
    ],
    [
      'The sahur push time field must match the format H:i.',
      'Ruang Mod Ramadan mestilah dalam format JJ:MM.',
    ],
    ['The password is incorrect.', 'Kata laluan tidak betul.'],
    ['This password reset token is invalid.', 'Token tetapan semula kata laluan ini tidak sah.'],
    ['Please wait before retrying.', 'Sila tunggu sebentar sebelum mencuba lagi.'],
    [
      "We can't find a user with that email address.",
      'Kami tidak menjumpai pengguna dengan alamat email itu.',
    ],
  ])('maps %s', (en, bm) => {
    expect(lines({ f: en })).toEqual([bm])
  })

  it('never echoes an unknown English attribute name', () => {
    expect(lines({ a: 'The widget field is required.' })).toEqual(['Ruang ini wajib diisi.'])
    expect(lines({ a: 'The widget field must be a valid email address.' })).toEqual([
      'Alamat email tidak sah.',
    ])
    expect(lines({ a: 'The widget has already been taken.' })).toEqual([
      'Nilai ini telah digunakan.',
    ])
    expect(lines({ a: 'The widget field confirmation does not match.' })).toEqual([
      'Pengesahan tidak sepadan.',
    ])
    expect(lines({ a: 'The widget field must be at least 3 characters.' })).toEqual([
      'Ruang ini mestilah sekurang-kurangnya 3 aksara.',
    ])
    expect(lines({ a: 'The selected widget is invalid.' })).toEqual(['Pilihan ini tidak sah.'])
  })

  it('maps a message without fields and passes unrelated or BM text through', () => {
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
