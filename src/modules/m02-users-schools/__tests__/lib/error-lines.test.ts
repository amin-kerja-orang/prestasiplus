import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import {
  errorLines as schoolErrorLines,
  GENERIC_ERROR as SCHOOL_GENERIC,
} from '../../lib/school-errors'
import { errorLines as userErrorLines, GENERIC_ERROR as USER_GENERIC } from '../../lib/user-list'

const fail = (status: number, message: string, fields?: Record<string, string>) =>
  new ApiError({ status, code: 'X', message, ...(fields ? { fields } : {}) })

describe.each([
  ['school-errors', schoolErrorLines, SCHOOL_GENERIC],
  ['user-list', userErrorLines, USER_GENERIC],
])('%s errorLines: no English server text (SWE-03)', (_name, errorLines, generic) => {
  it('returns the generic BM line for a 500 "Server Error" and a 5xx of any text', () => {
    expect(errorLines(fail(500, 'Server Error'))).toEqual([generic])
    expect(errorLines(fail(502, 'Ralat pelayan.'))).toEqual([generic])
  })

  it('returns the generic BM line for status 0 "Failed to fetch" and "HTTP 404"', () => {
    expect(errorLines(fail(0, 'Failed to fetch'))).toEqual([generic])
    expect(errorLines(fail(404, 'HTTP 404'))).toEqual([generic])
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
      expect(errorLines(fail(400, text))).toEqual([generic])
    }
  })

  it('keeps a module BM 404 or 409 message and the field texts', () => {
    expect(errorLines(fail(404, 'Sekolah tidak dijumpai.'))).toEqual(['Sekolah tidak dijumpai.'])
    expect(errorLines(fail(409, 'Kod sekolah sudah wujud.'))).toEqual(['Kod sekolah sudah wujud.'])
    expect(
      errorLines(fail(422, 'The given data was invalid.', { name: 'Nama diperlukan.' })),
    ).toEqual(['Nama diperlukan.'])
  })
})
