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
