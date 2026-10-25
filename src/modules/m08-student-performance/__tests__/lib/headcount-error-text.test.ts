import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import { headcountActionError } from '../../lib/headcount/error-text'
import { LOAD_ERROR } from '../../lib/prestasi/load'

const fail = (status: number, message: string) => new ApiError({ status, code: 'X', message })

describe('headcountActionError (SWE-12)', () => {
  it('shows the BM load error for a 5xx, a lost connection, a non-API error and transport text', () => {
    expect(headcountActionError(fail(500, 'Server Error'))).toBe(LOAD_ERROR)
    expect(headcountActionError(fail(0, 'Failed to fetch'))).toBe(LOAD_ERROR)
    expect(headcountActionError(fail(404, 'Not Found.'))).toBe(LOAD_ERROR)
    expect(headcountActionError(fail(502, 'HTTP 502'))).toBe(LOAD_ERROR)
    expect(headcountActionError(new Error('boom'))).toBe(LOAD_ERROR)
  })

  it('shows the headcount service BM message of a 409 or 422', () => {
    expect(headcountActionError(fail(409, 'Headcount sudah wujud.'))).toBe('Headcount sudah wujud.')
    expect(headcountActionError(fail(422, 'Pilih tahap.'))).toBe('Pilih tahap.')
  })

  it('shows the load error when a 409 or 422 carries only an English default or nothing', () => {
    expect(headcountActionError(fail(409, 'Conflict.'))).toBe(LOAD_ERROR)
    expect(headcountActionError(fail(422, 'The given data was invalid.'))).toBe(LOAD_ERROR)
    expect(headcountActionError(fail(422, ''))).toBe(LOAD_ERROR)
  })
})
