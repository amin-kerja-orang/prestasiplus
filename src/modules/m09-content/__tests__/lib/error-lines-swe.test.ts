import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import { errorLines as notesErrorLines } from '../../lib/admin-articles-notes'
import { errorLines as mediaErrorLines } from '../../lib/admin-media/common'
import { errorLines as videoErrorLines } from '../../lib/video'

const GENERIC = 'Ralat berlaku. Sila cuba lagi.'
const fail = (status: number, message: string, fields?: Record<string, string>) =>
  new ApiError({ status, code: 'X', message, ...(fields ? { fields } : {}) })

describe.each([
  ['video', videoErrorLines],
  ['admin-articles-notes', notesErrorLines],
  ['admin-media/common', mediaErrorLines],
])('%s errorLines: no English server text (SWE-04/05)', (_name, errorLines) => {
  it('returns the generic BM line for a 500 "Server Error" and any 5xx', () => {
    expect(errorLines(fail(500, 'Server Error'))).toEqual([GENERIC])
    expect(errorLines(fail(504, 'Ralat pelayan.'))).toEqual([GENERIC])
  })

  it('returns the generic BM line for status 0 "Failed to fetch"', () => {
    expect(errorLines(fail(0, 'Failed to fetch'))).toEqual([GENERIC])
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
      expect(errorLines(fail(413, text))).toEqual([GENERIC])
    }
  })

  it('keeps a module BM 404/409 message and the field texts', () => {
    expect(errorLines(fail(404, 'Video tidak dijumpai.'))).toEqual(['Video tidak dijumpai.'])
    expect(errorLines(fail(409, 'Tajuk sudah wujud.'))).toEqual(['Tajuk sudah wujud.'])
    expect(
      errorLines(fail(422, 'The given data was invalid.', { title: 'Tajuk diperlukan.' })),
    ).toEqual(['Tajuk diperlukan.'])
  })
})
