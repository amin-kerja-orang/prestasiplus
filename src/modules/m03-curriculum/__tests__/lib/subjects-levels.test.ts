import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import {
  errorLines,
  fieldErrors,
  isNetworkFailure,
  isNotFoundError,
  tileBackground,
} from '../../lib/subjects-levels'

describe('tileBackground', () => {
  it('appends 20 (12.5 % alpha) to a hex colour and keeps its case', () => {
    expect(tileBackground('#0f766e')).toBe('#0f766e20')
    expect(tileBackground('#EF4444')).toBe('#EF444420')
  })

  it('returns nothing for a value that is not #rrggbb', () => {
    expect(tileBackground('red')).toBeUndefined()
    expect(tileBackground('#fff')).toBeUndefined()
    expect(tileBackground('')).toBeUndefined()
  })
})

describe('errorLines / fieldErrors', () => {
  const validation = new ApiError({
    status: 422,
    code: 'VALIDATION_ERROR',
    message: 'Invalid',
    fields: { code: 'The code has already been taken.', name: 'The name field is required.' },
  })

  it('lists the field messages once each', () => {
    expect(errorLines(validation)).toEqual([
      'The code has already been taken.',
      'The name field is required.',
    ])
    expect(fieldErrors(validation)).toEqual({
      code: 'The code has already been taken.',
      name: 'The name field is required.',
    })
  })

  it('falls back to the generic line for a network failure or a bare HTTP error', () => {
    const generic = ['Ralat berlaku. Sila cuba lagi.']
    expect(errorLines(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'x' }))).toEqual(
      generic,
    )
    expect(
      errorLines(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' })),
    ).toEqual(generic)
    expect(errorLines(new Error('boom'))).toEqual(generic)
  })

  it('uses the server message when there are no field messages', () => {
    expect(
      errorLines(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Dilarang.' })),
    ).toEqual(['Dilarang.'])
  })
})

describe('error classification', () => {
  it('detects a 404', () => {
    expect(isNotFoundError(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))).toBe(
      true,
    )
    expect(isNotFoundError(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }))).toBe(
      false,
    )
    expect(isNotFoundError(null)).toBe(false)
  })

  it('treats a response-less failure as a network failure', () => {
    expect(isNetworkFailure(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'x' }))).toBe(
      true,
    )
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true)
    expect(
      isNetworkFailure(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' })),
    ).toBe(false)
  })
})
