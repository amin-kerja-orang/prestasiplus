/** `loadErrorMessage` (SW11-08, DV-M18-52): the BM line of a failed S21 / S23 load, chosen by status. */
import { describe, expect, it } from 'vitest'

import { ApiError, RATE_LIMITED_MESSAGE_BM } from '@/api'

import { GENERIC_LOAD_ERROR, loadErrorMessage } from '../../lib/load-error'

const apiError = (status: number, message: string) =>
  new ApiError({ status, code: 'x', message, method: 'GET', url: '/api/amaran/summary' })

describe('loadErrorMessage', () => {
  it('uses the generic BM line when there is no error', () => {
    expect(loadErrorMessage(null)).toBe(GENERIC_LOAD_ERROR)
    expect(loadErrorMessage(undefined)).toBe(GENERIC_LOAD_ERROR)
  })

  it('uses the generic BM line for a plain Error ("Failed to fetch")', () => {
    expect(loadErrorMessage(new TypeError('Failed to fetch'))).toBe(GENERIC_LOAD_ERROR)
  })

  it.each([
    [0, 'Failed to fetch'],
    [500, 'Internal server error'],
    [502, 'Bad Gateway'],
    [503, 'HTTP 503'],
    [503, 'Ralat pelayan.'],
    [400, 'Bad request.'],
    [422, 'The scope must be school, district or state.'],
    [422, 'Skop mestilah sekolah, daerah atau negeri.'],
  ])('status %i "%s" shows the generic BM line', (status, message) => {
    expect(loadErrorMessage(apiError(status, message))).toBe(GENERIC_LOAD_ERROR)
  })

  it('shows the BM rate-limit line for a 429, whatever the text', () => {
    expect(loadErrorMessage(apiError(429, 'Too Many Attempts.'))).toBe(RATE_LIMITED_MESSAGE_BM)
    expect(RATE_LIMITED_MESSAGE_BM).toBe('Terlalu banyak percubaan. Cuba sebentar lagi.')
  })

  it('keeps the server message of another status unless it is empty or the bare client fallback', () => {
    expect(loadErrorMessage(apiError(409, 'Konflik data.'))).toBe('Konflik data.')
    expect(loadErrorMessage(apiError(409, ''))).toBe(GENERIC_LOAD_ERROR)
    expect(loadErrorMessage(apiError(409, 'HTTP 409'))).toBe(GENERIC_LOAD_ERROR)
  })
})
